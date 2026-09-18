using System.Data;
using System.Data.SqlClient;
using api.Models.Allocation;
using api.Services.Allocation;
using api.Utils;

namespace api.DataAccess.Allocation;

/// <summary>
/// Reads the Step 0 candidate pool directly from Allocation_MeritList.
/// Candidates are read in merit-ordered batches so the API never materializes
/// the complete candidate population in memory.
/// </summary>
public sealed class Step0CandidateRepository
{
    private readonly string _connectionString;
    private readonly IRuleEvaluator _ruleEvaluator;
    private readonly int _batchSize;

    public Step0CandidateRepository(IConfiguration configuration, IRuleEvaluator ruleEvaluator)
    {
        _ruleEvaluator = ruleEvaluator;
        _batchSize = configuration.GetValue<int?>("Allocation:CandidateBatchSize") ?? 1000;
        if (_batchSize <= 0)
            throw new InvalidOperationException("Allocation:CandidateBatchSize must be greater than zero.");

        _connectionString = new ConnectionUtils().GetConnectionString(
            configuration["ConnectionStrings:CrmDbConnection"]
            ?? throw new InvalidOperationException("CrmDbConnection is not configured."));
    }

    public async IAsyncEnumerable<IReadOnlyList<AllocationCandidate>> ReadEligibleBatchesAsync(
        IReadOnlyDictionary<string, IReadOnlyList<AllocationRule>> ruleGroups,
        int? batchSize = null,
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var effectiveBatchSize = batchSize ?? _batchSize;
        if (effectiveBatchSize <= 0)
            throw new ArgumentOutOfRangeException(nameof(batchSize));

        var lastMeritNo = int.MinValue;
        long lastCandidateId = long.MinValue;

        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var candidates = await ReadBatchAsync(
                lastMeritNo,
                lastCandidateId,
                effectiveBatchSize,
                cancellationToken);

            if (candidates.Count == 0)
                yield break;

            var eligible = candidates
                .Where(candidate => MatchesCandidateEligibility(ruleGroups, candidate))
                .ToList();

            var last = candidates[^1];
            lastMeritNo = last.MeritNo;
            lastCandidateId = last.CandidateId;

            if (eligible.Count > 0)
                yield return eligible;
        }
    }

    private bool MatchesCandidateEligibility(
        IReadOnlyDictionary<string, IReadOnlyList<AllocationRule>> ruleGroups,
        AllocationCandidate candidate)
    {
        if (!ruleGroups.TryGetValue(
                AllocationConfiguration.CandidateQualification,
                out var rules) ||
            rules.Count == 0)
            return false;

        // Multiple rules assigned to one decision area are OR-ed by design.
        return rules.Any(rule => _ruleEvaluator.Matches(rule, candidate));
    }

    private async Task<List<AllocationCandidate>> ReadBatchAsync(
        int lastMeritNo,
        long lastCandidateId,
        int batchSize,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP (@BatchSize)
                CandidateID,
                CategoryID,
                PreviousCategoryID,
                Gender,
                FinalIsPh,
                FinalIsExServicemen,
                FinalIsOrphan,
                MeritNo,
                ExServicemenMeritNo,
                IsEligibleForOpen,
                IsOMS,
                IsNRI
            FROM dbo.Allocation_MeritList
            WHERE
                (
                    @LastMeritNo = -2147483648
                    OR MeritNo > @LastMeritNo
                    OR (MeritNo = @LastMeritNo AND CandidateID > @LastCandidateId)
                )
                AND NOT EXISTS
                (
                    SELECT 1
                    FROM dbo.Allocation_Colleges ac
                    WHERE ac.CandidateId = Allocation_MeritList.CandidateID
                      AND ac.PreferenceNo = 1
                )
                AND NOT EXISTS
                (
                    SELECT 1
                    FROM dbo.Allocation_tempPHDef tph
                    WHERE tph.CandidateID = Allocation_MeritList.CandidateID
                )
            ORDER BY MeritNo, CandidateID;
            """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 0
        };

        command.Parameters.Add("@BatchSize", SqlDbType.Int).Value = batchSize;
        command.Parameters.Add("@LastMeritNo", SqlDbType.Int).Value = lastMeritNo;
        command.Parameters.Add("@LastCandidateId", SqlDbType.BigInt).Value = lastCandidateId;

        var result = new List<AllocationCandidate>(batchSize);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            result.Add(new AllocationCandidate
            {
                CandidateId = reader.GetInt64(reader.GetOrdinal("CandidateID")),
                CategoryId = Convert.ToInt32(reader["CategoryID"]),
                PreviousCategoryId = Convert.ToInt32(reader["PreviousCategoryID"]),
                Gender = Convert.ToString(reader["Gender"]) ?? string.Empty,
                IsPh = Convert.ToString(reader["FinalIsPh"]) ?? "N",
                IsExServicemen = Convert.ToString(reader["FinalIsExServicemen"]) ?? "N",
                IsOrphan = Convert.ToString(reader["FinalIsOrphan"]) ?? "N",
                MeritNo = Convert.ToInt32(reader["MeritNo"]),
                ExServicemenMeritNo = reader["ExServicemenMeritNo"] == DBNull.Value
                    ? 0
                    : Convert.ToInt32(reader["ExServicemenMeritNo"]),
                IsEligibleForOpen = Convert.ToString(reader["IsEligibleForOpen"]) ?? "N",
                IsOms = Convert.ToString(reader["IsOMS"]) ?? "N",
                IsNri = Convert.ToString(reader["IsNRI"]) ?? "N",
                IsInTempPhDef = false
            });
        }

        await LoadPreferencesAsync(connection, result, cancellationToken);
        return result;
    }
    private static async Task LoadPreferencesAsync(
        SqlConnection connection,
        IList<AllocationCandidate> candidates,
        CancellationToken cancellationToken)
    {
        if (candidates.Count == 0)
            return;

        var parameters = new List<string>(candidates.Count);
        await using var command = new SqlCommand
        {
            Connection = connection,
            CommandType = CommandType.Text,
            CommandTimeout = 0
        };

        for (var index = 0; index < candidates.Count; index++)
        {
            var name = $"@Candidate{index}";
            parameters.Add(name);
            command.Parameters.Add(name, SqlDbType.BigInt).Value = candidates[index].CandidateId;
        }

        command.CommandText = $"""
            SELECT CandidateID, PreferenceNo, ChoiceCode
            FROM dbo.Allocation_CollegePref
            WHERE CandidateID IN ({string.Join(", ", parameters)})
            ORDER BY CandidateID, PreferenceNo;
            """;

        var byCandidate = candidates.ToDictionary(candidate => candidate.CandidateId);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var candidateId = reader.GetInt64(reader.GetOrdinal("CandidateID"));
            if (!byCandidate.TryGetValue(candidateId, out var candidate))
                continue;

            candidate.Preferences.Add(new CollegePreference
            {
                PreferenceNo = reader.GetInt32(reader.GetOrdinal("PreferenceNo")),
                ChoiceCode = reader.GetInt64(reader.GetOrdinal("ChoiceCode"))
            });
        }
    }
}

using System.Data;
using System.Data.SqlClient;
using api.Models.Allocation;
using api.Utils;

namespace api.DataAccess.Allocation;

public sealed class Step1CandidateRepository
{
    private readonly string _connectionString;

    public Step1CandidateRepository(IConfiguration configuration)
    {
        _connectionString = new ConnectionUtils().GetConnectionString(
            configuration["ConnectionStrings:CrmDbConnection"]
            ?? throw new InvalidOperationException("CrmDbConnection is not configured."));
    }

    public async Task<List<AllocationCandidate>> ReadCandidatesAsync(CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT CandidateID,
                   CategoryID = CASE WHEN PreviousCategoryID < 0 THEN CategoryID ELSE PreviousCategoryID END,
                   PreviousCategoryID, Gender, IsOMS, IsNRI,
                   FinalIsPh, FinalIsExServicemen, FinalIsOrphan,
                   LinguisticMinorityID, ReligiousMinorityID,
                   MeritNo, ExServicemenMeritNo, IsEligibleForOpen
            FROM dbo.Allocation_MeritList
            ORDER BY MeritNo, CandidateID;
            """;

        var candidates = new List<AllocationCandidate>();
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection) { CommandTimeout = 0 };
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            candidates.Add(new AllocationCandidate
            {
                CandidateId = Convert.ToInt64(reader["CandidateID"]),
                CategoryId = Convert.ToInt32(reader["CategoryID"]),
                PreviousCategoryId = Convert.ToInt32(reader["PreviousCategoryID"]),
                Gender = Convert.ToString(reader["Gender"]) ?? string.Empty,
                IsOms = Convert.ToString(reader["IsOMS"]) ?? "N",
                IsNri = Convert.ToString(reader["IsNRI"]) ?? "N",
                IsPh = Convert.ToString(reader["FinalIsPh"]) ?? "N",
                IsExServicemen = Convert.ToString(reader["FinalIsExServicemen"]) ?? "N",
                IsOrphan = Convert.ToString(reader["FinalIsOrphan"]) ?? "N",
                LinguisticMinorityId = reader["LinguisticMinorityID"] == DBNull.Value ? 0 : Convert.ToInt16(reader["LinguisticMinorityID"]),
                ReligiousMinorityId = reader["ReligiousMinorityID"] == DBNull.Value ? 0 : Convert.ToInt16(reader["ReligiousMinorityID"]),
                MeritNo = Convert.ToInt64(reader["MeritNo"]),
                ExServicemenMeritNo = reader["ExServicemenMeritNo"] == DBNull.Value ? 0 : Convert.ToInt64(reader["ExServicemenMeritNo"]),
                IsEligibleForOpen = Convert.ToString(reader["IsEligibleForOpen"]) ?? "N"
            });
        }

        await LoadPreferencesAsync(candidates, cancellationToken);
        return candidates;
    }

    private async Task LoadPreferencesAsync(List<AllocationCandidate> candidates, CancellationToken cancellationToken)
    {
        if (candidates.Count == 0) return;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand
        {
            Connection = connection,
            CommandTimeout = 0
        };

        var names = new List<string>(candidates.Count);
        for (var i = 0; i < candidates.Count; i++)
        {
            var name = "@C" + i;
            names.Add(name);
            command.Parameters.Add(name, SqlDbType.BigInt).Value = candidates[i].CandidateId;
        }

        command.CommandText = $"""
            SELECT CandidateID, PreferenceNo, ChoiceCode
            FROM dbo.Allocation_CollegePref
            WHERE CandidateID IN ({string.Join(",", names)})
            ORDER BY CandidateID, PreferenceNo;
            """;

        var lookup = candidates.ToDictionary(c => c.CandidateId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var id = Convert.ToInt64(reader["CandidateID"]);
            if (!lookup.TryGetValue(id, out var candidate)) continue;
            candidate.Preferences.Add(new CollegePreference
            {
                PreferenceNo = Convert.ToInt32(reader["PreferenceNo"]),
                ChoiceCode = Convert.ToInt64(reader["ChoiceCode"])
            });
        }
    }
}
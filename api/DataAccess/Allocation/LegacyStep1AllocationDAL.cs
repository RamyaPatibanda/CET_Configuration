using System.Data;
using System.Data.SqlClient;
using api.Models.Allocation;
using api.Services.Allocation;
using api.Utils;

namespace api.DataAccess.Allocation;

public sealed class LegacyStep1AllocationDAL
{
    private readonly string _connectionString;
    private readonly IRuleEvaluator _ruleEvaluator;

    public LegacyStep1AllocationDAL(IConfiguration configuration, IRuleEvaluator ruleEvaluator)
    {
        _ruleEvaluator = ruleEvaluator;
        _connectionString = new ConnectionUtils().GetConnectionString(
            configuration["ConnectionStrings:CrmDbConnection"]
            ?? throw new InvalidOperationException("CrmDbConnection is not configured."));
    }

    public async Task<LegacyStep1Result> ExecuteAsync(
        IReadOnlyList<AllocationCandidate> candidates,
        IReadOnlyDictionary<string, IReadOnlyList<AllocationRule>> ruleGroups,
        CancellationToken cancellationToken = default)
    {
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            var allocations = new List<LegacyAllocationRow>();
            var processed = 0;

            foreach (var candidate in candidates.OrderBy(c => c.MeritNo))
            {
                cancellationToken.ThrowIfCancellationRequested();

                if (!MatchesCandidateRules(candidate, ruleGroups))
                    continue;

                processed++;
                var existing = await GetActiveAllocationAsync(connection, transaction, candidate.CandidateId, cancellationToken);
                var currentPreference = existing?.PreferenceNo ?? 0;
                var currentSequence = existing?.SeqId ?? 0;

                foreach (var preference in candidate.Preferences.OrderBy(p => p.PreferenceNo))
                {
                    if (!IsPreferenceEligible(candidate, preference, existing, ruleGroups))
                        continue;

                    var seats = await GetSeatRowsAsync(connection, transaction, preference.ChoiceCode, candidate, cancellationToken);

                    foreach (var seat in seats)
                    {
                        if (!MatchesSeatEligibility(candidate, preference, seat, ruleGroups))
                            continue;

                        var allocationRule = ResolveAllocationRule(candidate, preference, seat, ruleGroups);
                        if (allocationRule is null)
                            continue;

                        var allocationType = allocationRule.AllocatedType;
                        if (string.IsNullOrWhiteSpace(allocationType))
                            continue;

                        var vacancy = seat.GetVacancy(allocationType);
                        if (vacancy <= 0)
                            continue;

                        if (currentPreference > 0 &&
                            !(preference.PreferenceNo < currentPreference ||
                              (preference.PreferenceNo == currentPreference && allocationRule.SequenceId < currentSequence)))
                            continue;

                        if (existing is not null)
                        {
                            await RestoreAllocationAsync(connection, transaction, existing, cancellationToken);
                            await DeactivateAllocationAsync(connection, transaction, existing.AllocationId, cancellationToken);
                            existing = null;
                        }

                        var inserted = await InsertAllocationAsync(
                            connection, transaction, candidate, preference, seat,
                            allocationType, allocationRule.SequenceId, cancellationToken);

                        inserted.RuleCode = allocationRule.Code;
                        await ConsumeSeatVacancyAsync(
                            connection, transaction, preference.ChoiceCode,
                            seat.CategoryId, seat.QuotaId, allocationType, cancellationToken);

                        allocations.Add(inserted);
                        goto CandidateAllocated;
                    }
                }

            CandidateAllocated:
                ;
            }

            await transaction.CommitAsync(cancellationToken);
            return new LegacyStep1Result(processed, allocations);
        }
        catch
        {
            await transaction.RollbackAsync(CancellationToken.None);
            throw;
        }
    }

    private bool MatchesCandidateRules(
        AllocationCandidate candidate,
        IReadOnlyDictionary<string, IReadOnlyList<AllocationRule>> groups)
    {
        if (!groups.TryGetValue(AllocationConfiguration.CandidateQualification, out var rules) || rules.Count == 0)
            return false;

        return rules.Any(rule => _ruleEvaluator.Matches(rule, candidate));
    }

    private bool IsPreferenceEligible(
        AllocationCandidate candidate,
        CollegePreference preference,
        ExistingStep1Allocation? existing,
        IReadOnlyDictionary<string, IReadOnlyList<AllocationRule>> groups)
    {
        if (existing is not null &&
            preference.PreferenceNo > existing.PreferenceNo)
            return false;

        if (!groups.TryGetValue(AllocationConfiguration.PreferenceEvaluation, out var rules) || rules.Count == 0)
            return true;

        var values = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
        {
            ["Gender"] = candidate.Gender,
            ["CategoryID"] = candidate.EffectiveCategoryId.ToString(),
            ["PreferenceNo"] = preference.PreferenceNo.ToString(),
            ["ChoiceCode"] = preference.ChoiceCode.ToString(),
            ["MeritNo"] = candidate.MeritNo.ToString(),
            ["IsOMS"] = candidate.IsOms,
            ["IsNRI"] = candidate.IsNri
        };

        return rules.Any(rule => _ruleEvaluator.Matches(rule, values));
    }

    private bool MatchesSeatEligibility(
        AllocationCandidate candidate,
        CollegePreference preference,
        SeatRow seat,
        IReadOnlyDictionary<string, IReadOnlyList<AllocationRule>> groups)
    {
        if (seat.CategoryId == 1 &&
            !candidate.IsEligibleForOpen.Equals("Y", StringComparison.OrdinalIgnoreCase))
            return false;

        if (seat.QuotaId == 5)
        {
            var matchesMinority = seat.MinorityId == candidate.LinguisticMinorityId ||
                                  seat.MinorityId == candidate.ReligiousMinorityId;
            if (!matchesMinority) return false;
        }

        if (!groups.TryGetValue(AllocationConfiguration.SeatEligibility, out var rules) || rules.Count == 0)
            return true;

        var values = BuildSeatValues(candidate, preference, seat, string.Empty, 0);
        return rules.Any(rule => _ruleEvaluator.Matches(rule, values));
    }

    private AllocationRule? ResolveAllocationRule(
        AllocationCandidate candidate,
        CollegePreference preference,
        SeatRow seat,
        IReadOnlyDictionary<string, IReadOnlyList<AllocationRule>> groups)
    {
        if (!groups.TryGetValue(AllocationConfiguration.Step1AllocationTypeSequence, out var rules) || rules.Count == 0)
            return null;

        for (var index = 0; index < rules.Count; index++)
        {
            var rule = rules[index];
            var type = rule.AllocatedType;
            if (string.IsNullOrWhiteSpace(type)) continue;

            var vacancy = seat.GetVacancy(type);
            var values = BuildSeatValues(candidate, preference, seat, type, vacancy);
            if (!_ruleEvaluator.Matches(rule, values)) continue;

            return new AllocationRule
            {
                Code = rule.Code,
                AllocatedType = type,
                SequenceId = index + 1,
                DisplayOrder = index + 1,
                StageCode = AllocationConfiguration.Step1AllocationTypeSequence,
                Conditions = rule.Conditions,
                AllowBetterment = rule.AllowBetterment
            };
        }

        return null;
    }

    private Dictionary<string, string?> BuildSeatValues(
        AllocationCandidate candidate,
        CollegePreference preference,
        SeatRow seat,
        string allocationType,
        int vacancy)
    {
        var values = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
        {
            ["Gender"] = candidate.Gender,
            ["CategoryID"] = candidate.EffectiveCategoryId.ToString(),
            ["PreviousCategoryID"] = candidate.PreviousCategoryId.ToString(),
            ["IsEligibleForOpen"] = candidate.IsEligibleForOpen,
            ["IsOMS"] = candidate.IsOms,
            ["IsNRI"] = candidate.IsNri,
            ["MeritNo"] = candidate.MeritNo.ToString(),
            ["PreferenceNo"] = preference.PreferenceNo.ToString(),
            ["ChoiceCode"] = preference.ChoiceCode.ToString(),
            ["VacCategoryId"] = seat.CategoryId.ToString(),
            ["QuotaID"] = seat.QuotaId.ToString(),
            ["MinorityId"] = seat.MinorityId.ToString(),
            ["AllocatedType"] = allocationType,
            ["Vacancy"] = vacancy.ToString()
        };

        foreach (var item in seat.Vacancies)
            values[item.Key] = item.Value.ToString();

        return values;
    }

    private async Task<List<SeatRow>> GetSeatRowsAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        long choiceCode,
        AllocationCandidate candidate,
        CancellationToken cancellationToken)
    {
        var rows = new List<SeatRow>();
        const string sql = """
            SELECT CategoryId, MinorityId, QuotaID, Gen, Fem
            FROM dbo.Allocation_SeatDistribution
            WHERE ChoiceCode = @ChoiceCode
              AND (
                    (@IsOMS = 'N' AND @IsNRI = 'N' AND CategoryID IN (1,@CategoryId) AND QuotaID = 1)
                 OR (@IsOMS = 'Y' AND CategoryID = 1 AND QuotaID = 3)
                 OR (@IsNRI = 'Y' AND CategoryID = 1 AND QuotaID = 4)
                 OR ((@LinguisticMinorityID > 0 OR @ReligiousMinorityID > 0) AND CategoryID = 1 AND QuotaID = 5)
              )
            ORDER BY QuotaID DESC, CategoryId;
            """;

        await using var command = new SqlCommand(sql, connection, transaction);
        command.Parameters.Add("@ChoiceCode", SqlDbType.BigInt).Value = choiceCode;
        command.Parameters.Add("@IsOMS", SqlDbType.Char, 1).Value = candidate.IsOms;
        command.Parameters.Add("@IsNRI", SqlDbType.Char, 1).Value = candidate.IsNri;
        command.Parameters.Add("@CategoryId", SqlDbType.TinyInt).Value = candidate.EffectiveCategoryId;
        command.Parameters.Add("@LinguisticMinorityID", SqlDbType.SmallInt).Value = candidate.LinguisticMinorityId;
        command.Parameters.Add("@ReligiousMinorityID", SqlDbType.SmallInt).Value = candidate.ReligiousMinorityId;

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            rows.Add(new SeatRow(
                Convert.ToInt32(reader["CategoryId"]),
                reader["MinorityId"] == DBNull.Value ? 0 : Convert.ToInt32(reader["MinorityId"]),
                Convert.ToInt32(reader["QuotaID"]),
                new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
                {
                    ["Gen"] = Convert.ToInt32(reader["Gen"]),
                    ["Fem"] = Convert.ToInt32(reader["Fem"])
                }));
        }

        return rows;
    }

    private static async Task<ExistingStep1Allocation?> GetActiveAllocationAsync(
        SqlConnection connection, SqlTransaction transaction, long candidateId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP (1) AllocationID, CandidateId, ChoiceCode, PreferenceNo,
                   AllocatedType, AllocatedQuotaId, AllocatedCategoryID,
                   StudentCategoryID, OriginalAllocatedType, AllocatedMinorityId,
                   StudentMinorityId, SeqId, Flag, StepId
            FROM dbo.Allocation_Colleges
            WHERE CandidateId = @CandidateId AND Flag = 1
            ORDER BY AllocationID DESC;
            """;
        await using var command = new SqlCommand(sql, connection, transaction);
        command.Parameters.Add("@CandidateId", SqlDbType.BigInt).Value = candidateId;
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken)) return null;

        return new ExistingStep1Allocation
        {
            AllocationId = Convert.ToInt32(reader["AllocationID"]),
            CandidateId = Convert.ToInt64(reader["CandidateId"]),
            ChoiceCode = Convert.ToInt64(reader["ChoiceCode"]),
            PreferenceNo = Convert.ToInt32(reader["PreferenceNo"]),
            AllocatedType = Convert.ToString(reader["AllocatedType"]) ?? string.Empty,
            AllocatedCategoryId = Convert.ToInt32(reader["AllocatedCategoryID"]),
            AllocatedQuotaId = Convert.ToInt32(reader["AllocatedQuotaId"]),
            AllocatedMinorityId = reader["AllocatedMinorityId"] == DBNull.Value ? 0 : Convert.ToInt32(reader["AllocatedMinorityId"]),
            OriginalAllocatedType = Convert.ToString(reader["OriginalAllocatedType"]) ?? string.Empty,
            StudentMinorityId = reader["StudentMinorityId"] == DBNull.Value ? 0 : Convert.ToInt32(reader["StudentMinorityId"]),
            SeqId = Convert.ToInt32(reader["SeqId"])
        };
    }

    private static async Task<LegacyAllocationRow> InsertAllocationAsync(
        SqlConnection connection, SqlTransaction transaction,
        AllocationCandidate candidate, CollegePreference preference, SeatRow seat,
        string allocationType, int sequenceId, CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO dbo.Allocation_Colleges
            (CandidateId,ChoiceCode,PreferenceNo,AllocatedType,AllocatedQuotaId,
             AllocatedCategoryID,StudentCategoryID,OriginalAllocatedType,
             AllocatedMinorityId,StudentMinorityId,SeqId,Flag,StepId)
            OUTPUT INSERTED.AllocationID
            VALUES
            (@CandidateId,@ChoiceCode,@PreferenceNo,@AllocatedType,@QuotaId,
             @CategoryId,@StudentCategoryId,@OriginalAllocatedType,
             @AllocatedMinorityId,@StudentMinorityId,@SeqId,1,1);
            """;

        await using var command = new SqlCommand(sql, connection, transaction);
        command.Parameters.Add("@CandidateId", SqlDbType.BigInt).Value = candidate.CandidateId;
        command.Parameters.Add("@ChoiceCode", SqlDbType.BigInt).Value = preference.ChoiceCode;
        command.Parameters.Add("@PreferenceNo", SqlDbType.Int).Value = preference.PreferenceNo;
        command.Parameters.Add("@AllocatedType", SqlDbType.VarChar, 20).Value = allocationType;
        command.Parameters.Add("@QuotaId", SqlDbType.TinyInt).Value = seat.QuotaId;
        command.Parameters.Add("@CategoryId", SqlDbType.TinyInt).Value = seat.CategoryId;
        command.Parameters.Add("@StudentCategoryId", SqlDbType.TinyInt).Value = candidate.EffectiveCategoryId;
        command.Parameters.Add("@OriginalAllocatedType", SqlDbType.VarChar, 20).Value = allocationType;
        command.Parameters.Add("@AllocatedMinorityId", SqlDbType.SmallInt).Value = 0;
        command.Parameters.Add("@StudentMinorityId", SqlDbType.SmallInt).Value = 0;
        command.Parameters.Add("@SeqId", SqlDbType.TinyInt).Value = sequenceId;

        var id = Convert.ToInt32(await command.ExecuteScalarAsync(cancellationToken));
        return new LegacyAllocationRow
        {
            AllocationId = id,
            CandidateId = candidate.CandidateId,
            ChoiceCode = preference.ChoiceCode,
            PreferenceNo = preference.PreferenceNo,
            AllocatedCategoryId = seat.CategoryId,
            AllocatedType = allocationType,
            OriginalAllocatedType = allocationType,
            StepId = 1,
            SeqId = sequenceId
        };
    }

    private static async Task ConsumeSeatVacancyAsync(
        SqlConnection connection, SqlTransaction transaction, long choiceCode,
        int categoryId, int quotaId, string allocationType, CancellationToken cancellationToken)
    {
        var identifier = SqlSafeIdentifier(allocationType);
        var sql = $"""
            UPDATE dbo.Allocation_SeatDistribution
            SET {identifier} = {identifier} - 1
            WHERE ChoiceCode = @ChoiceCode AND CategoryID = @CategoryId AND QuotaId = @QuotaId;
            """;
        await using var command = new SqlCommand(sql, connection, transaction);
        command.Parameters.Add("@ChoiceCode", SqlDbType.BigInt).Value = choiceCode;
        command.Parameters.Add("@CategoryId", SqlDbType.TinyInt).Value = categoryId;
        command.Parameters.Add("@QuotaId", SqlDbType.TinyInt).Value = quotaId;
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task RestoreAllocationAsync(
        SqlConnection connection, SqlTransaction transaction, ExistingStep1Allocation allocation,
        CancellationToken cancellationToken)
    {
        var identifier = SqlSafeIdentifier(allocation.AllocatedType);
        var sql = $"""
            UPDATE dbo.Allocation_SeatDistribution
            SET {identifier} = {identifier} + 1
            WHERE ChoiceCode = @ChoiceCode AND CategoryID = @CategoryId AND QuotaId = @QuotaId;
            """;
        await using var command = new SqlCommand(sql, connection, transaction);
        command.Parameters.Add("@ChoiceCode", SqlDbType.BigInt).Value = allocation.ChoiceCode;
        command.Parameters.Add("@CategoryId", SqlDbType.TinyInt).Value = allocation.AllocatedCategoryId;
        command.Parameters.Add("@QuotaId", SqlDbType.TinyInt).Value = allocation.AllocatedQuotaId;
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task DeactivateAllocationAsync(
        SqlConnection connection, SqlTransaction transaction, int allocationId, CancellationToken cancellationToken)
    {
        await using var command = new SqlCommand(
            "UPDATE dbo.Allocation_Colleges SET Flag = 0 WHERE AllocationID = @AllocationID;",
            connection, transaction);
        command.Parameters.Add("@AllocationID", SqlDbType.Int).Value = allocationId;
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static string SqlSafeIdentifier(string value)
    {
        if (string.IsNullOrWhiteSpace(value) ||
            value.Any(ch => !(char.IsLetterOrDigit(ch) || ch == '_')))
            throw new InvalidOperationException($"Invalid allocation type '{value}'.");
        return "[" + value + "]";
    }

    private sealed class ExistingStep1Allocation
    {
        public int AllocationId { get; init; }
        public long CandidateId { get; init; }
        public long ChoiceCode { get; init; }
        public int PreferenceNo { get; init; }
        public string AllocatedType { get; init; } = string.Empty;
        public int AllocatedCategoryId { get; init; }
        public int AllocatedQuotaId { get; init; }
        public int AllocatedMinorityId { get; init; }
        public string OriginalAllocatedType { get; init; } = string.Empty;
        public int StudentMinorityId { get; init; }
        public int SeqId { get; init; }
    }

    private sealed record SeatRow(int CategoryId, int MinorityId, int QuotaId, IReadOnlyDictionary<string,int> Vacancies)
    {
        public int GetVacancy(string allocationType) =>
            Vacancies.TryGetValue(allocationType, out var value) ? value : 0;
    }
}

public sealed record LegacyStep1Result(int CandidatesProcessed, IReadOnlyList<LegacyAllocationRow> Allocations);
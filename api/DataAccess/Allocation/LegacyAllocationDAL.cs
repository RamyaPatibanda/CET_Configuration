using System.Data;
using System.Data.SqlClient;
using api.Models.Allocation;
using api.Utils;
using api.Services.Allocation;

namespace api.DataAccess.Allocation;

/// <summary>
/// Implements the legacy Step 0 allocation algorithm in the application layer.
/// The repository deliberately uses the existing allocation tables and does not
/// invoke Allocation_Seats_Step0 or Allocation_Seats_Def_Convert.
/// </summary>
public sealed class LegacyAllocationDAL
{
    private readonly string _connectionString;
    private readonly ILogger<LegacyAllocationDAL> _logger;
    private readonly IRuleEvaluator _ruleEvaluator;

    public LegacyAllocationDAL(
        IConfiguration configuration,
        ILogger<LegacyAllocationDAL> logger,
        IRuleEvaluator ruleEvaluator)
    {
        _logger = logger;
        _ruleEvaluator = ruleEvaluator;
        _connectionString = new ConnectionUtils().GetConnectionString(
            configuration["ConnectionStrings:CrmDbConnection"]
            ?? throw new InvalidOperationException("CrmDbConnection is not configured."));
    }

    public async Task<LegacyStep0Result> ExecuteStep0Async(
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
            var candidateRows = candidates
                .Where(c => IsSpecialReservationCandidate(c, ruleGroups))
                .OrderBy(c => c.MeritNo)
                .ToList();

            foreach (var candidate in candidateRows)
            {
                cancellationToken.ThrowIfCancellationRequested();

                if (await HasFirstPreferenceAllocationAsync(connection, transaction, candidate.CandidateId, cancellationToken))
                    continue;

                if (await IsInTempPhDefAsync(connection, transaction, candidate.CandidateId, cancellationToken))
                    continue;

                var existing = await GetActiveAllocationAsync(connection, transaction, candidate.CandidateId, cancellationToken);

                if (existing is not null && !IsBettermentAllowed(ruleGroups, candidate))
                    continue;

                var preferenceLimit = existing?.PreferenceNo ?? 0;
                var preferences = await GetPreferencesBeforeAsync(connection, transaction, candidate.CandidateId, preferenceLimit, cancellationToken);

                foreach (var preference in preferences)
                {
                    cancellationToken.ThrowIfCancellationRequested();

                    if (!MatchesPreferenceRules(ruleGroups, candidate, preference))
                        continue;

                    var vacancyRows = await GetVacancyRowsAsync(connection, transaction, preference.ChoiceCode, candidate.EffectiveCategoryId, cancellationToken);
                    var allocated = false;

                    foreach (var vacancyRow in vacancyRows)
                    {
                        var vacancy = Math.Max(vacancyRow.Gen, vacancyRow.Fem);

                        // This method needs the injected rule evaluator, so it must be an instance method.
                        var specialVacancy = await ResolveSeatDistributionVacancyAsync(
                            connection, transaction, preference.ChoiceCode, candidate, vacancy, ruleGroups, cancellationToken);

                        if (specialVacancy is not null)
                            vacancy = specialVacancy.Value.Vacancy;

                        var vacancyType = specialVacancy?.VacancyType ?? string.Empty;
                        var vacancySource = specialVacancy?.VacancySource ?? string.Empty;
                        var allocationRule = ResolveAllocationRule(ruleGroups, candidate, vacancyRow, vacancy, vacancyType);
                        if (allocationRule is null)
                            continue;

                        var allocatedType = allocationRule.AllocatedType;
                        // Keep the vacancy resolved by Seat Distribution. Allocation Type
                        // only chooses the Gen/Fem seat column; it must not overwrite a
                        // special-reservation vacancy already resolved above.
                        if (string.IsNullOrWhiteSpace(allocatedType) || vacancy <= 0)
                            continue;

                        if (existing is not null)
                        {
                            await RestoreAllocationAsync(connection, transaction, existing, ruleGroups, cancellationToken);
                            await DeactivateAllocationAsync(connection, transaction, existing.AllocationId, cancellationToken);
                        }

                        var seqId = allocationRule.SequenceId > 0 ? allocationRule.SequenceId : allocationRule.DisplayOrder;
                        var inserted = await InsertAllocationAsync(
                            connection, transaction, candidate, preference, vacancyType, vacancyRow,
                            allocatedType, seqId, cancellationToken);
                        inserted.RuleCode = allocationRule.Code;

                        if (!string.IsNullOrEmpty(vacancyType))
                        {
                            await ConsumeSpecialVacancyAsync(connection, transaction, preference.ChoiceCode, vacancySource, vacancyType, cancellationToken);
                        }

                        await ConsumeSeatVacancyAsync(
                            connection, transaction, preference.ChoiceCode, vacancyRow.CategoryId,
                            vacancyRow.QuotaId, allocatedType, cancellationToken);

                        allocations.Add(inserted);
                        allocated = true;
                        break;
                    }

                    if (allocated)
                        break;
                }
            }

            await transaction.CommitAsync(cancellationToken);
            return new LegacyStep0Result(allocations);
        }
        catch (Exception ex)
        {
            try
            {
                await transaction.RollbackAsync(CancellationToken.None);
            }
            catch (Exception rollbackException)
            {
                _logger.LogError(rollbackException, "Step 0 rollback failed.");
            }

            _logger.LogError(ex, "Application-layer Step 0 allocation failed.");
            throw;
        }
    }

    private bool IsSpecialReservationCandidate(
        AllocationCandidate candidate,
        IReadOnlyDictionary<string, IReadOnlyList<AllocationRule>> ruleGroups)
    {
        // Candidate eligibility is the only rule set used to build the Step 0 candidate pool.
        // Sequence rules are evaluated later for each college/preference. There is no second
        // eligibility gate in the Allocation Run.
        return MatchesArea(ruleGroups, AllocationConfiguration.CandidateQualification, candidate);
    }

    private bool MatchesOptionalArea(
        IReadOnlyDictionary<string, IReadOnlyList<AllocationRule>> ruleGroups,
        string area,
        AllocationCandidate candidate)
    {
        if (!ruleGroups.TryGetValue(area, out var rules) || rules.Count == 0)
            return true;

        return rules.Any(rule => _ruleEvaluator.Matches(rule, candidate));
    }

    private bool IsBettermentAllowed(
        IReadOnlyDictionary<string, IReadOnlyList<AllocationRule>> ruleGroups,
        AllocationCandidate candidate)
    {
        if (!ruleGroups.TryGetValue(AllocationConfiguration.Betterment, out var rules) || rules.Count == 0)
            return true;

        return rules.Any(rule => _ruleEvaluator.Matches(rule, candidate) && rule.AllowBetterment != false);
    }

    private bool MatchesArea(
        IReadOnlyDictionary<string, IReadOnlyList<AllocationRule>> ruleGroups,
        string area,
        AllocationCandidate candidate)
    {
        if (!ruleGroups.TryGetValue(area, out var rules) || rules.Count == 0)
            return false;

        return rules.Any(rule => _ruleEvaluator.Matches(rule, candidate));
    }

    private bool MatchesPreferenceRules(
        IReadOnlyDictionary<string, IReadOnlyList<AllocationRule>> ruleGroups,
        AllocationCandidate candidate,
        CollegePreference preference)
    {
        if (!ruleGroups.TryGetValue(AllocationConfiguration.PreferenceEvaluation, out var rules) || rules.Count == 0)
            return true;

        var values = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
        {
            ["Gender"] = candidate.Gender,
            ["CategoryID"] = candidate.EffectiveCategoryId.ToString(),
            ["MeritNo"] = candidate.MeritNo.ToString(),
            ["PreferenceNo"] = preference.PreferenceNo.ToString(),
            ["ChoiceCode"] = preference.ChoiceCode.ToString()
        };

        return rules.Any(rule => _ruleEvaluator.Matches(rule, values));
    }

    private AllocationRule? ResolveAllocationRule(
        IReadOnlyDictionary<string, IReadOnlyList<AllocationRule>> ruleGroups,
        AllocationCandidate candidate,
        VacancyRow vacancyRow,
        int vacancy,
        string vacancyType)
    {
        if (!ruleGroups.TryGetValue(AllocationConfiguration.Step0AllocationTypeSequence, out var allocationRules) ||
            allocationRules.Count == 0)
            return null;

        var values = BuildStep0RuleValues(candidate, vacancyRow, vacancy, vacancyType, string.Empty);

        // Allocation Type and Sequence are one ordered decision. The first
        // matching rule determines AllocatedType from its outcome and its
        // position in the Allocation Run becomes SeqId.
        for (var index = 0; index < allocationRules.Count; index++)
        {
            var rule = allocationRules[index];
            if (!_ruleEvaluator.Matches(rule, values))
                continue;

            var allocatedType = ResolveAllocatedType(rule, values, vacancyRow);
            if (string.IsNullOrWhiteSpace(allocatedType) || vacancy <= 0)
                continue;

            if (allocatedType.Equals("Fem", StringComparison.OrdinalIgnoreCase) && vacancyRow.Fem <= 0)
                continue;

            if (allocatedType.Equals("Gen", StringComparison.OrdinalIgnoreCase) && vacancyRow.Gen <= 0)
                continue;

            return new AllocationRule
            {
                Code = rule.Code,
                StageCode = rule.StageCode,
                LogicalOperator = rule.LogicalOperator,
                AllocatedType = allocatedType,
                VacancySource = vacancyType.Length > 0 ? "Allocation_SeatDistribution_PH" : string.Empty,
                VacancyType = vacancyType,
                SeatCategory = rule.SeatCategory,
                ReservationType = rule.ReservationType,
                CandidateStatus = rule.CandidateStatus,
                PreferenceMode = rule.PreferenceMode,
                AllowBetterment = rule.AllowBetterment,
                DisplayOrder = index + 1,
                SequenceId = index + 1,
                Conditions = rule.Conditions,
                Branches = rule.Branches
            };
        }

        return null;
    }

    private Dictionary<string, string?> BuildStep0RuleValues(
        AllocationCandidate candidate,
        VacancyRow vacancyRow,
        int vacancy,
        string vacancyType,
        string allocatedType)
    {
        return new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
        {
            ["Gender"] = candidate.Gender,
            ["CategoryID"] = candidate.EffectiveCategoryId.ToString(),
            ["PreviousCategoryID"] = candidate.PreviousCategoryId.ToString(),
            ["IsEligibleForOpen"] = candidate.IsEligibleForOpen,
            ["FinalIsPh"] = candidate.IsPh,
            ["IsPH"] = candidate.IsPh,
            ["FinalIsExServicemen"] = candidate.IsExServicemen,
            ["IsExServiceman"] = candidate.IsExServicemen,
            ["IsExServicemen"] = candidate.IsExServicemen,
            ["FinalIsOrphan"] = candidate.IsOrphan,
            ["IsOrphan"] = candidate.IsOrphan,
            ["IsOMS"] = candidate.IsOms,
            ["IsNRI"] = candidate.IsNri,
            ["Gen"] = vacancyRow.Gen.ToString(),
            ["Fem"] = vacancyRow.Fem.ToString(),
            ["Vacancy"] = vacancy.ToString(),
            ["VacCategoryId"] = vacancyRow.CategoryId.ToString(),
            ["VacancyType"] = vacancyType,
            ["AllocatedType"] = allocatedType,
            ["QuotaID"] = vacancyRow.QuotaId.ToString(),
            ["MinorityId"] = vacancyRow.MinorityId?.ToString()
        };
    }

    private string ResolveAllocatedType(
        AllocationRule rule,
        IReadOnlyDictionary<string, string?> values,
        VacancyRow vacancyRow)
    {
        if (!string.IsNullOrWhiteSpace(rule.AllocatedType))
            return rule.AllocatedType;

        // A rule can identify the seat column directly through its condition.
        // This keeps the allocation engine free of hardcoded rule order.
        if (rule.Conditions.Any(condition =>
            condition.Field.Equals("Fem", StringComparison.OrdinalIgnoreCase) &&
            _ruleEvaluator.MatchesConditions(new[] { condition }, values)))
            return vacancyRow.Fem > 0 ? "Fem" : string.Empty;

        if (rule.Conditions.Any(condition =>
            condition.Field.Equals("Gen", StringComparison.OrdinalIgnoreCase) &&
            _ruleEvaluator.MatchesConditions(new[] { condition }, values)))
            return vacancyRow.Gen > 0 ? "Gen" : string.Empty;

        return string.Empty;
    }

    private static async Task<LegacyAllocationRow?> GetActiveAllocationAsync(SqlConnection connection, SqlTransaction transaction, long candidateId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP (1) AllocationID, CandidateId, ChoiceCode, PreferenceNo,
                AllocatedType, AllocatedQuotaId, AllocatedCategoryID, StudentCategoryID,
                OriginalAllocatedType, AllocatedMinorityId, StudentMinorityId, SeqId, Flag, StepId
            FROM dbo.Allocation_Colleges
            WHERE CandidateId = @CandidateId AND Flag = 1
            ORDER BY AllocationID DESC;
            """;
        await using var command = CreateCommand(connection, transaction, sql);
        command.Parameters.Add("@CandidateId", SqlDbType.BigInt).Value = candidateId;
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken)) return null;
        return ReadAllocation(reader);
    }

    private static async Task<bool> HasFirstPreferenceAllocationAsync(SqlConnection connection, SqlTransaction transaction, long candidateId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT CASE WHEN EXISTS
            (SELECT 1 FROM dbo.Allocation_Colleges WHERE CandidateId = @CandidateId AND PreferenceNo = 1)
            THEN 1 ELSE 0 END;
            """;
        return await ExecuteScalarIntAsync(connection, transaction, sql, cancellationToken, ("@CandidateId", SqlDbType.BigInt, candidateId)) == 1;
    }

    private static async Task<bool> IsInTempPhDefAsync(SqlConnection connection, SqlTransaction transaction, long candidateId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT CASE WHEN EXISTS
            (SELECT 1 FROM dbo.Allocation_tempPHDef WHERE CandidateID = @CandidateId)
            THEN 1 ELSE 0 END;
            """;
        return await ExecuteScalarIntAsync(connection, transaction, sql, cancellationToken, ("@CandidateId", SqlDbType.BigInt, candidateId)) == 1;
    }

    private static async Task<List<CollegePreference>> GetPreferencesBeforeAsync(SqlConnection connection, SqlTransaction transaction, long candidateId, int preferenceLimit, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT PreferenceNo, ChoiceCode
            FROM dbo.Allocation_CollegePref
            WHERE CandidateId = @CandidateId AND PreferenceNo < @PreferenceLimit
            ORDER BY PreferenceNo;
            """;
        var limit = preferenceLimit == 0 ? 999 : preferenceLimit;
        await using var command = CreateCommand(connection, transaction, sql);
        command.Parameters.Add("@CandidateId", SqlDbType.BigInt).Value = candidateId;
        command.Parameters.Add("@PreferenceLimit", SqlDbType.Int).Value = limit;
        var result = new List<CollegePreference>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            result.Add(new CollegePreference
            {
                PreferenceNo = reader.GetInt32(reader.GetOrdinal("PreferenceNo")),
                ChoiceCode = reader.GetInt64(reader.GetOrdinal("ChoiceCode"))
            });
        }
        return result;
    }

    private static async Task<List<VacancyRow>> GetVacancyRowsAsync(SqlConnection connection, SqlTransaction transaction, long choiceCode, int categoryId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT CategoryId, MinorityId, QuotaID, Gen, Fem
            FROM dbo.Allocation_SeatDistribution
            WHERE ChoiceCode = @ChoiceCode AND CategoryID IN (1, @CategoryId) AND QuotaID = 1
            ORDER BY CategoryID DESC;
            """;
        await using var command = CreateCommand(connection, transaction, sql);
        command.Parameters.Add("@ChoiceCode", SqlDbType.BigInt).Value = choiceCode;
        command.Parameters.Add("@CategoryId", SqlDbType.TinyInt).Value = categoryId;
        var result = new List<VacancyRow>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            result.Add(new VacancyRow(
                reader.GetByte(reader.GetOrdinal("CategoryId")),
                reader.IsDBNull(reader.GetOrdinal("MinorityId")) ? null : Convert.ToInt16(reader["MinorityId"]),
                reader.GetByte(reader.GetOrdinal("QuotaID")),
                reader.IsDBNull(reader.GetOrdinal("Gen")) ? 0 : Convert.ToInt32(reader["Gen"]),
                reader.IsDBNull(reader.GetOrdinal("Fem")) ? 0 : Convert.ToInt32(reader["Fem"])));
        }
        return result;
    }

    // Seat Distribution rules are evaluated in the order selected in the
    // Allocation Run. Only when the normal vacancy is zero do they attempt
    // special reservation vacancy resolution.
    private async Task<(string VacancySource, string VacancyType, int Vacancy)?> ResolveSeatDistributionVacancyAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        long choiceCode,
        AllocationCandidate candidate,
        int currentVacancy,
        IReadOnlyDictionary<string, IReadOnlyList<AllocationRule>> ruleGroups,
        CancellationToken cancellationToken)
    {
        if (currentVacancy != 0)
            return null;

        if (!ruleGroups.TryGetValue(AllocationConfiguration.Step0SeatDistribution, out var rules) ||
            rules.Count == 0)
            return null;

        var values = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
        {
            ["Gender"] = candidate.Gender,
            ["CategoryID"] = candidate.EffectiveCategoryId.ToString(),
            ["PreviousCategoryID"] = candidate.PreviousCategoryId.ToString(),
            ["FinalIsPh"] = candidate.IsPh,
            ["IsPH"] = candidate.IsPh,
            ["FinalIsExServicemen"] = candidate.IsExServicemen,
            ["IsExServiceman"] = candidate.IsExServicemen,
            ["IsExServicemen"] = candidate.IsExServicemen,
            ["FinalIsOrphan"] = candidate.IsOrphan,
            ["IsOrphan"] = candidate.IsOrphan,
            ["IsOMS"] = candidate.IsOms,
            ["IsNRI"] = candidate.IsNri
        };

        foreach (var rule in rules)
        {
            if (!_ruleEvaluator.Matches(rule, values))
                continue;

            var vacancyType = ResolveSeatDistributionColumn(rule);
            if (string.IsNullOrWhiteSpace(vacancyType))
                continue;

            var vacancy = await GetConfiguredVacancyAsync(
                connection,
                transaction,
                choiceCode,
                "Allocation_SeatDistribution_PH",
                vacancyType,
                cancellationToken);

            if (vacancy == 0)
                return ("Allocation_SeatDistribution_PH", vacancyType, vacancy);
        }

        return null;
    }

    private static string ResolveSeatDistributionColumn(AllocationRule rule)
    {
        // Prefer an explicitly configured vacancy type when one exists.
        if (!string.IsNullOrWhiteSpace(rule.VacancyType))
            return rule.VacancyType.Trim();

        // Otherwise the rule's candidate condition identifies the configured
        // special-reservation column.
        foreach (var condition in rule.Conditions)
        {
            if (!condition.Field.Equals("IsPH", StringComparison.OrdinalIgnoreCase) &&
                !condition.Field.Equals("FinalIsPh", StringComparison.OrdinalIgnoreCase) &&
                !condition.Field.Equals("IsExServiceman", StringComparison.OrdinalIgnoreCase) &&
                !condition.Field.Equals("IsExServicemen", StringComparison.OrdinalIgnoreCase) &&
                !condition.Field.Equals("FinalIsExServicemen", StringComparison.OrdinalIgnoreCase) &&
                !condition.Field.Equals("IsOrphan", StringComparison.OrdinalIgnoreCase) &&
                !condition.Field.Equals("FinalIsOrphan", StringComparison.OrdinalIgnoreCase))
                continue;

            if (!condition.Value.Equals("Y", StringComparison.OrdinalIgnoreCase))
                continue;

            return condition.Field.Equals("IsPH", StringComparison.OrdinalIgnoreCase) ||
                   condition.Field.Equals("FinalIsPh", StringComparison.OrdinalIgnoreCase)
                ? "PH"
                : condition.Field.Equals("IsOrphan", StringComparison.OrdinalIgnoreCase) ||
                  condition.Field.Equals("FinalIsOrphan", StringComparison.OrdinalIgnoreCase)
                    ? "Orp"
                    : "Def";
        }

        return string.Empty;
    }

    private static async Task<int> GetConfiguredVacancyAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        long choiceCode,
        string sourceTable,
        string vacancyColumn,
        CancellationToken cancellationToken)
    {
        var source = sourceTable.Trim();
        var column = vacancyColumn.Trim();

        if (!IsSafeIdentifier(source) || !IsSafeIdentifier(column))
            throw new InvalidOperationException("Vacancy source configuration contains an invalid identifier.");

        const string metadataSql = """
            SELECT COUNT(1)
            FROM sys.tables t
            INNER JOIN sys.columns c ON c.object_id = t.object_id
            WHERE t.schema_id = SCHEMA_ID(N'dbo')
              AND t.name = @TableName
              AND c.name = @ColumnName;
            """;

        var exists = await ExecuteScalarIntAsync(
            connection,
            transaction,
            metadataSql,
            cancellationToken,
            ("@TableName", SqlDbType.NVarChar, source),
            ("@ColumnName", SqlDbType.NVarChar, column));

        if (exists == 0)
            throw new InvalidOperationException(
                $"Configured vacancy source '{sourceTable}.{vacancyColumn}' does not exist.");

        var sql = $"SELECT ISNULL({SqlSafeIdentifier(column)}, 0) FROM dbo.{SqlSafeIdentifier(source)} WHERE ChoiceCode = @ChoiceCode;";
        return await ExecuteScalarIntAsync(
            connection,
            transaction,
            sql,
            cancellationToken,
            ("@ChoiceCode", SqlDbType.BigInt, choiceCode));
    }

    private static string SqlSafeIdentifier(string value) =>
        $"[{value.Replace("]", "]]")}]";

    private static bool IsSafeIdentifier(string value) =>
        value.Length > 0 && value.All(ch => char.IsLetterOrDigit(ch) || ch == '_');

    private static async Task RestoreAllocationAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        LegacyAllocationRow allocation,
        IReadOnlyDictionary<string, IReadOnlyList<AllocationRule>> ruleGroups,
        CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(allocation.OriginalAllocatedType))
        {
            var vacancySource = "Allocation_SeatDistribution_PH";
            if (!string.IsNullOrWhiteSpace(vacancySource))
            {
                if (!IsSafeIdentifier(vacancySource) || !IsSafeIdentifier(allocation.OriginalAllocatedType))
                    throw new InvalidOperationException("Configured vacancy restoration contains an invalid identifier.");

                await ExecuteNonQueryAsync(
                    connection,
                    transaction,
                    $"UPDATE dbo.{SqlSafeIdentifier(vacancySource)} SET {SqlSafeIdentifier(allocation.OriginalAllocatedType)} = ISNULL({SqlSafeIdentifier(allocation.OriginalAllocatedType)}, 0) + 1 WHERE ChoiceCode = @ChoiceCode;",
                    cancellationToken,
                    ("@ChoiceCode", SqlDbType.BigInt, allocation.ChoiceCode));
            }
        }

        var seatColumn = allocation.AllocatedType switch { "Gen" => "Gen", "Fem" => "Fem", _ => null };
        if (seatColumn is not null)
        {
            await ExecuteNonQueryAsync(connection, transaction,
                $"UPDATE dbo.Allocation_SeatDistribution SET {seatColumn} = ISNULL({seatColumn}, 0) + 1 WHERE ChoiceCode = @ChoiceCode AND CategoryID = @CategoryId AND QuotaID = @QuotaId;",
                cancellationToken,
                ("@ChoiceCode", SqlDbType.BigInt, allocation.ChoiceCode),
                ("@CategoryId", SqlDbType.TinyInt, allocation.AllocatedCategoryId),
                ("@QuotaId", SqlDbType.TinyInt, allocation.AllocatedQuotaId));
        }
    }

    private static async Task DeactivateAllocationAsync(SqlConnection connection, SqlTransaction transaction, long allocationId, CancellationToken cancellationToken)
    {
        await ExecuteNonQueryAsync(connection, transaction,
            "UPDATE dbo.Allocation_Colleges SET Flag = 0 WHERE AllocationID = @AllocationId;",
            cancellationToken, ("@AllocationId", SqlDbType.BigInt, allocationId));
    }

    private static async Task<LegacyAllocationRow> InsertAllocationAsync(SqlConnection connection, SqlTransaction transaction, AllocationCandidate candidate, CollegePreference preference, string vacancyType, VacancyRow vacancyRow, string allocatedType, int seqId, CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO dbo.Allocation_Colleges
            (CandidateId, ChoiceCode, PreferenceNo, AllocatedType, AllocatedQuotaId, AllocatedCategoryID,
             StudentCategoryID, OriginalAllocatedType, AllocatedMinorityId, StudentMinorityId, SeqId, Flag, StepId)
            OUTPUT INSERTED.AllocationID, INSERTED.CandidateId, INSERTED.ChoiceCode, INSERTED.PreferenceNo,
                INSERTED.AllocatedType, INSERTED.AllocatedQuotaId, INSERTED.AllocatedCategoryID,
                INSERTED.StudentCategoryID, INSERTED.OriginalAllocatedType, INSERTED.AllocatedMinorityId,
                INSERTED.StudentMinorityId, INSERTED.SeqId, INSERTED.Flag, INSERTED.StepId
            VALUES (@CandidateId, @ChoiceCode, @PreferenceNo, @AllocatedType, @QuotaId, @AllocatedCategoryId,
                @StudentCategoryId, @OriginalAllocatedType, @AllocatedMinorityId, 0, @SeqId, 1, 0);
            """;
        await using var command = CreateCommand(connection, transaction, sql);
        command.Parameters.Add("@CandidateId", SqlDbType.BigInt).Value = candidate.CandidateId;
        command.Parameters.Add("@ChoiceCode", SqlDbType.BigInt).Value = preference.ChoiceCode;
        command.Parameters.Add("@PreferenceNo", SqlDbType.SmallInt).Value = preference.PreferenceNo;
        command.Parameters.Add("@AllocatedType", SqlDbType.VarChar, 10).Value = allocatedType;
        command.Parameters.Add("@QuotaId", SqlDbType.TinyInt).Value = vacancyRow.QuotaId;
        command.Parameters.Add("@AllocatedCategoryId", SqlDbType.TinyInt).Value = vacancyRow.CategoryId;
        command.Parameters.Add("@StudentCategoryId", SqlDbType.TinyInt).Value = candidate.EffectiveCategoryId;
        command.Parameters.Add("@OriginalAllocatedType", SqlDbType.VarChar, 10).Value = vacancyType;
        command.Parameters.Add("@AllocatedMinorityId", SqlDbType.SmallInt).Value = (object?)vacancyRow.MinorityId ?? DBNull.Value;
        command.Parameters.Add("@SeqId", SqlDbType.TinyInt).Value = seqId;
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
            throw new InvalidOperationException("Allocation insert did not return the inserted row.");
        return ReadAllocation(reader);
    }

    private static async Task ConsumeSpecialVacancyAsync(SqlConnection connection, SqlTransaction transaction, long choiceCode, string vacancySource, string vacancyType, CancellationToken cancellationToken)
    {
        if (!IsSafeIdentifier(vacancySource) || !IsSafeIdentifier(vacancyType))
            throw new InvalidOperationException("Vacancy source configuration contains an invalid identifier.");

        await ExecuteNonQueryAsync(connection, transaction,
            $"UPDATE dbo.{SqlSafeIdentifier(vacancySource)} SET {SqlSafeIdentifier(vacancyType)} = {SqlSafeIdentifier(vacancyType)} - 1 WHERE ChoiceCode = @ChoiceCode;",
            cancellationToken, ("@ChoiceCode", SqlDbType.BigInt, choiceCode));
    }

    private static async Task ConsumeSeatVacancyAsync(SqlConnection connection, SqlTransaction transaction, long choiceCode, int categoryId, int quotaId, string allocatedType, CancellationToken cancellationToken)
    {
        var column = allocatedType switch { "Gen" => "Gen", "Fem" => "Fem", _ => throw new ArgumentOutOfRangeException(nameof(allocatedType)) };
        await ExecuteNonQueryAsync(connection, transaction,
            $"UPDATE dbo.Allocation_SeatDistribution SET {column} = ISNULL({column}, 0) - 1 WHERE ChoiceCode = @ChoiceCode AND CategoryID = @CategoryId AND QuotaID = @QuotaId;",
            cancellationToken,
            ("@ChoiceCode", SqlDbType.BigInt, choiceCode),
            ("@CategoryId", SqlDbType.TinyInt, categoryId),
            ("@QuotaId", SqlDbType.TinyInt, quotaId));
    }

    private static LegacyAllocationRow ReadAllocation(SqlDataReader reader) => new()
    {
        AllocationId = reader.GetInt64(reader.GetOrdinal("AllocationID")),
        CandidateId = Convert.ToInt64(reader["CandidateId"]),
        ChoiceCode = reader.GetInt64(reader.GetOrdinal("ChoiceCode")),
        PreferenceNo = Convert.ToInt32(reader["PreferenceNo"]),
        AllocatedType = reader.GetString(reader.GetOrdinal("AllocatedType")),
        AllocatedQuotaId = Convert.ToInt32(reader["AllocatedQuotaId"]),
        AllocatedCategoryId = Convert.ToInt32(reader["AllocatedCategoryID"]),
        StudentCategoryId = Convert.ToInt32(reader["StudentCategoryID"]),
        OriginalAllocatedType = reader.GetString(reader.GetOrdinal("OriginalAllocatedType")),
        AllocatedMinorityId = reader.IsDBNull(reader.GetOrdinal("AllocatedMinorityId")) ? 0 : Convert.ToInt32(reader["AllocatedMinorityId"]),
        StudentMinorityId = reader.IsDBNull(reader.GetOrdinal("StudentMinorityId")) ? 0 : Convert.ToInt32(reader["StudentMinorityId"]),
        SeqId = reader.IsDBNull(reader.GetOrdinal("SeqId")) ? 0 : Convert.ToInt32(reader["SeqId"]),
        Flag = reader.GetBoolean(reader.GetOrdinal("Flag")),
        StepId = Convert.ToInt32(reader["StepId"])
    };

    private static SqlCommand CreateCommand(SqlConnection connection, SqlTransaction transaction, string sql)
    {
        return new SqlCommand(sql, connection, transaction) { CommandType = CommandType.Text, CommandTimeout = 0 };
    }

    private static async Task<int> ExecuteScalarIntAsync(SqlConnection connection, SqlTransaction transaction, string sql, CancellationToken cancellationToken, params (string Name, SqlDbType Type, object Value)[] parameters)
    {
        await using var command = CreateCommand(connection, transaction, sql);
        foreach (var parameter in parameters)
            command.Parameters.Add(parameter.Name, parameter.Type).Value = parameter.Value;
        var value = await command.ExecuteScalarAsync(cancellationToken);
        return value is null or DBNull ? 0 : Convert.ToInt32(value);
    }

    private static async Task ExecuteNonQueryAsync(SqlConnection connection, SqlTransaction transaction, string sql, CancellationToken cancellationToken, params (string Name, SqlDbType Type, object Value)[] parameters)
    {
        await using var command = CreateCommand(connection, transaction, sql);
        foreach (var parameter in parameters)
            command.Parameters.Add(parameter.Name, parameter.Type).Value = parameter.Value;
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private sealed record VacancyRow(int CategoryId, short? MinorityId, int QuotaId, int Gen, int Fem);
}

public sealed class LegacyStep0Result
{
    public LegacyStep0Result(IReadOnlyList<LegacyAllocationRow> allocations) { Allocations = allocations; }
    public IReadOnlyList<LegacyAllocationRow> Allocations { get; }
}

public sealed class LegacyAllocationRow
{
    public long AllocationId { get; init; }
    public long CandidateId { get; init; }
    public long ChoiceCode { get; init; }
    public int PreferenceNo { get; init; }
    public string AllocatedType { get; init; } = string.Empty;
    public int AllocatedQuotaId { get; init; }
    public int AllocatedCategoryId { get; init; }
    public int StudentCategoryId { get; init; }
    public string OriginalAllocatedType { get; init; } = string.Empty;
    public string RuleCode { get; set; } = string.Empty;
    public int AllocatedMinorityId { get; init; }
    public int StudentMinorityId { get; init; }
    public int SeqId { get; init; }
    public bool Flag { get; init; }
    public int StepId { get; init; }
}

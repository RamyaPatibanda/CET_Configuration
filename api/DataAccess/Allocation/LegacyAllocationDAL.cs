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

                if (await HasFirstPreferenceAllocationAsync(
                        connection, transaction, candidate.CandidateId, cancellationToken))
                    continue;

                if (await IsInTempPhDefAsync(
                        connection, transaction, candidate.CandidateId, cancellationToken))
                    continue;

                var existing = await GetActiveAllocationAsync(
                    connection, transaction, candidate.CandidateId, cancellationToken);

                var preferenceLimit = existing?.PreferenceNo ?? 0;
                var preferences = await GetPreferencesBeforeAsync(
                    connection,
                    transaction,
                    candidate.CandidateId,
                    preferenceLimit,
                    cancellationToken);

                foreach (var preference in preferences)
                {
                    cancellationToken.ThrowIfCancellationRequested();

                    var vacancyRows = await GetVacancyRowsAsync(
                        connection,
                        transaction,
                        preference.ChoiceCode,
                        candidate.EffectiveCategoryId,
                        cancellationToken);

                    var allocated = false;

                    foreach (var vacancyRow in vacancyRows)
                    {
                        var vacancy = candidate.Gender.Equals("F", StringComparison.OrdinalIgnoreCase)
                            ? vacancyRow.Fem
                            : vacancyRow.Gen;
                        var vacancyType = string.Empty;

                        // This follows the legacy procedure: PH/Def/Orphan
                        // vacancy is considered only when no normal seat is available.
                        if (candidate.IsPh.Equals("Y", StringComparison.OrdinalIgnoreCase) &&
                            vacancy == 0)
                        {
                            vacancy = await GetSpecialVacancyAsync(
                                connection, transaction, preference.ChoiceCode, "PH", cancellationToken);
                            if (vacancy > 0)
                                vacancyType = "PH";
                        }

                        if (candidate.IsExServicemen.Equals("Y", StringComparison.OrdinalIgnoreCase) &&
                            vacancy == 0)
                        {
                            vacancy = await GetSpecialVacancyAsync(
                                connection, transaction, preference.ChoiceCode, "Def", cancellationToken);
                            if (vacancy > 0)
                                vacancyType = "Def";
                        }

                        if (candidate.IsOrphan.Equals("Y", StringComparison.OrdinalIgnoreCase) &&
                            vacancy == 0)
                        {
                            vacancy = await GetSpecialVacancyAsync(
                                connection, transaction, preference.ChoiceCode, "Orp", cancellationToken);
                            if (vacancy > 0)
                                vacancyType = "Orp";
                        }

                        var allocatedType = ResolveAllocatedType(candidate, vacancyRow, vacancy);
                        if (string.IsNullOrEmpty(allocatedType))
                            continue;

                        var eligible = candidate.EffectiveCategoryId > 1 ||
                                       (candidate.EffectiveCategoryId == 1 &&
                                        candidate.IsEligibleForOpen.Equals("Y", StringComparison.OrdinalIgnoreCase));

                        if (!eligible)
                            continue;

                        if (existing is not null &&
                            !MatchesArea(ruleGroups, AllocationConfiguration.Betterment, candidate))
                            continue;

                        if (vacancyType == "Def")
                        {
                            if (!MatchesArea(ruleGroups, AllocationConfiguration.Conversion, candidate))
                                continue;

                            await ExecuteDefConversionAsync(
                                connection,
                                transaction,
                                preference.ChoiceCode,
                                candidates,
                                ruleGroups,
                                cancellationToken);

                            existing = await GetActiveAllocationAsync(
                                connection, transaction, candidate.CandidateId, cancellationToken);

                            if (existing is null)
                                continue;
                        }

                        if (existing is not null)
                        {
                            await RestoreAllocationAsync(
                                connection, transaction, existing, cancellationToken);
                            await DeactivateAllocationAsync(
                                connection, transaction, existing.AllocationId, cancellationToken);
                        }

                        var seqId = ResolveSeqId(
                            allocatedType,
                            candidate.EffectiveCategoryId);

                        var inserted = await InsertAllocationAsync(
                            connection,
                            transaction,
                            candidate,
                            preference,
                            vacancyType,
                            vacancyRow,
                            allocatedType,
                            seqId,
                            cancellationToken);

                        if (!string.IsNullOrEmpty(vacancyType))
                        {
                            await ConsumeSpecialVacancyAsync(
                                connection,
                                transaction,
                                preference.ChoiceCode,
                                vacancyType,
                                cancellationToken);
                        }

                        await ConsumeSeatVacancyAsync(
                            connection,
                            transaction,
                            preference.ChoiceCode,
                            vacancyRow.CategoryId,
                            vacancyRow.QuotaId,
                            allocatedType,
                            cancellationToken);

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
        }    }

    private bool IsSpecialReservationCandidate(
        AllocationCandidate candidate,
        IReadOnlyDictionary<string, IReadOnlyList<AllocationRule>> ruleGroups)
    {
        if (!candidate.IsOms.Equals("N", StringComparison.OrdinalIgnoreCase) ||
            !candidate.IsNri.Equals("N", StringComparison.OrdinalIgnoreCase))
            return false;

        // PH / Defence / Orphan eligibility is configured as a reusable rule.
        // Do not hard-code that OR expression in the allocation engine.
        return MatchesArea(
            ruleGroups,
            AllocationConfiguration.CandidateQualification,
            candidate);
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

    private static string ResolveAllocatedType(
        AllocationCandidate candidate,
        VacancyRow vacancyRow,
        int vacancy)
    {
        if (candidate.Gender.Equals("F", StringComparison.OrdinalIgnoreCase) &&
            vacancyRow.Fem > 0 &&
            vacancy > 0)
            return "Fem";

        if (vacancyRow.Gen > 0 && vacancy > 0)
            return "Gen";

        return string.Empty;
    }

    private static int ResolveSeqId(string allocatedType, int categoryId) =>
        allocatedType == "Gen"
            ? categoryId == 1 ? 1 : 3
            : categoryId == 1 ? 2 : 4;

    private static async Task<LegacyAllocationRow?> GetActiveAllocationAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        long candidateId,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP (1)
                AllocationID, CandidateId, ChoiceCode, PreferenceNo,
                AllocatedType, AllocatedQuotaId, AllocatedCategoryID,
                StudentCategoryID, OriginalAllocatedType,
                AllocatedMinorityId, StudentMinorityId, SeqId, Flag, StepId
            FROM dbo.Allocation_Colleges
            WHERE CandidateId = @CandidateId AND Flag = 1
            ORDER BY AllocationID DESC;
            """;

        await using var command = CreateCommand(connection, transaction, sql);
        command.Parameters.Add("@CandidateId", SqlDbType.BigInt).Value = candidateId;

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
            return null;

        return ReadAllocation(reader);
    }

    private static async Task<bool> HasFirstPreferenceAllocationAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        long candidateId,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT CASE WHEN EXISTS
            (
                SELECT 1
                FROM dbo.Allocation_Colleges
                WHERE CandidateId = @CandidateId
                  AND PreferenceNo = 1
            ) THEN 1 ELSE 0 END;
            """;

        return await ExecuteScalarIntAsync(
            connection, transaction, sql, cancellationToken,
            ("@CandidateId", SqlDbType.BigInt, candidateId)) == 1;
    }

    private static async Task<bool> IsInTempPhDefAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        long candidateId,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT CASE WHEN EXISTS
            (
                SELECT 1
                FROM dbo.Allocation_tempPHDef
                WHERE CandidateID = @CandidateId
            ) THEN 1 ELSE 0 END;
            """;

        return await ExecuteScalarIntAsync(
            connection, transaction, sql, cancellationToken,
            ("@CandidateId", SqlDbType.BigInt, candidateId)) == 1;
    }

    private static async Task<List<CollegePreference>> GetPreferencesBeforeAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        long candidateId,
        int preferenceLimit,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT PreferenceNo, ChoiceCode
            FROM dbo.Allocation_CollegePref
            WHERE CandidateId = @CandidateId
              AND PreferenceNo < @PreferenceLimit
            ORDER BY PreferenceNo;
            """;

        // The legacy expression (@PrefNo = 0 OR @PrefNo = NULL) effectively
        // behaves as "PreferenceNo < 999" for a zero preference.
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

    private static async Task<List<VacancyRow>> GetVacancyRowsAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        long choiceCode,
        int categoryId,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT CategoryId, MinorityId, QuotaID, Gen, Fem
            FROM dbo.Allocation_SeatDistribution
            WHERE ChoiceCode = @ChoiceCode
              AND CategoryID IN (1, @CategoryId)
              AND QuotaID = 1
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
                reader.IsDBNull(reader.GetOrdinal("MinorityId"))
                    ? null
                    : reader.GetInt16(reader.GetOrdinal("MinorityId")),
                reader.GetByte(reader.GetOrdinal("QuotaID")),
                reader.IsDBNull(reader.GetOrdinal("Gen")) ? 0 : reader.GetInt16(reader.GetOrdinal("Gen")),
                reader.IsDBNull(reader.GetOrdinal("Fem")) ? 0 : reader.GetInt16(reader.GetOrdinal("Fem"))));
        }

        return result;
    }

    private static async Task<int> GetSpecialVacancyAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        long choiceCode,
        string vacancyType,
        CancellationToken cancellationToken)
    {
        var column = vacancyType switch
        {
            "PH" => "PH",
            "Def" => "Def",
            "Orp" => "Orp",
            _ => throw new ArgumentOutOfRangeException(nameof(vacancyType))
        };

        var sql = $"SELECT {column} FROM dbo.Allocation_SeatDistribution_PH WHERE ChoiceCode = @ChoiceCode;";
        return await ExecuteScalarIntAsync(
            connection, transaction, sql, cancellationToken,
            ("@ChoiceCode", SqlDbType.BigInt, choiceCode));
    }

    private static async Task RestoreAllocationAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        LegacyAllocationRow allocation,
        CancellationToken cancellationToken)
    {
        if (allocation.OriginalAllocatedType is "PH" or "Def" or "Orp")
        {
            var column = allocation.OriginalAllocatedType switch
            {
                "PH" => "PH",
                "Def" => "Def",
                "Orp" => "Orp",
                _ => throw new InvalidOperationException()
            };

            await ExecuteNonQueryAsync(
                connection,
                transaction,
                $"UPDATE dbo.Allocation_SeatDistribution_PH SET {column} = {column} + 1 WHERE ChoiceCode = @ChoiceCode;",
                cancellationToken,
                ("@ChoiceCode", SqlDbType.BigInt, allocation.ChoiceCode));
        }

        var seatColumn = allocation.AllocatedType switch
        {
            "Gen" => "Gen",
            "Fem" => "Fem",
            _ => null
        };

        if (seatColumn is not null)
        {
            await ExecuteNonQueryAsync(
                connection,
                transaction,
                $"UPDATE dbo.Allocation_SeatDistribution SET {seatColumn} = ISNULL({seatColumn}, 0) + 1 WHERE ChoiceCode = @ChoiceCode AND CategoryID = @CategoryId AND QuotaID = @QuotaId;",
                cancellationToken,
                ("@ChoiceCode", SqlDbType.BigInt, allocation.ChoiceCode),
                ("@CategoryId", SqlDbType.TinyInt, allocation.AllocatedCategoryId),
                ("@QuotaId", SqlDbType.TinyInt, allocation.AllocatedQuotaId));
        }
    }

    private static async Task DeactivateAllocationAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        long allocationId,
        CancellationToken cancellationToken)
    {
        await ExecuteNonQueryAsync(
            connection,
            transaction,
            "UPDATE dbo.Allocation_Colleges SET Flag = 0 WHERE AllocationID = @AllocationId;",
            cancellationToken,
            ("@AllocationId", SqlDbType.BigInt, allocationId));
    }

    private static async Task<LegacyAllocationRow> InsertAllocationAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        AllocationCandidate candidate,
        CollegePreference preference,
        string vacancyType,
        VacancyRow vacancyRow,
        string allocatedType,
        int seqId,
        CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO dbo.Allocation_Colleges
            (
                CandidateId, ChoiceCode, PreferenceNo, AllocatedType,
                AllocatedQuotaId, AllocatedCategoryID, StudentCategoryID,
                OriginalAllocatedType, AllocatedMinorityId, StudentMinorityId,
                SeqId, Flag, StepId
            )
            OUTPUT
                INSERTED.AllocationID, INSERTED.CandidateId, INSERTED.ChoiceCode,
                INSERTED.PreferenceNo, INSERTED.AllocatedType,
                INSERTED.AllocatedQuotaId, INSERTED.AllocatedCategoryID,
                INSERTED.StudentCategoryID, INSERTED.OriginalAllocatedType,
                INSERTED.AllocatedMinorityId, INSERTED.StudentMinorityId,
                INSERTED.SeqId, INSERTED.Flag, INSERTED.StepId
            VALUES
            (
                @CandidateId, @ChoiceCode, @PreferenceNo, @AllocatedType,
                @QuotaId, @AllocatedCategoryId, @StudentCategoryId,
                @OriginalAllocatedType, @AllocatedMinorityId, 0,
                @SeqId, 1, 0
            );
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
        command.Parameters.Add("@AllocatedMinorityId", SqlDbType.SmallInt).Value =
            (object?)vacancyRow.MinorityId ?? DBNull.Value;
        command.Parameters.Add("@SeqId", SqlDbType.TinyInt).Value = seqId;

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
            throw new InvalidOperationException("Allocation insert did not return the inserted row.");

        return ReadAllocation(reader);
    }

    private static async Task ConsumeSpecialVacancyAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        long choiceCode,
        string vacancyType,
        CancellationToken cancellationToken)
    {
        var column = vacancyType switch
        {
            "PH" => "PH",
            "Def" => "Def",
            "Orp" => "Orp",
            _ => throw new ArgumentOutOfRangeException(nameof(vacancyType))
        };

        await ExecuteNonQueryAsync(
            connection,
            transaction,
            $"UPDATE dbo.Allocation_SeatDistribution_PH SET {column} = {column} - 1 WHERE ChoiceCode = @ChoiceCode;",
            cancellationToken,
            ("@ChoiceCode", SqlDbType.BigInt, choiceCode));
    }

    private static async Task ConsumeSeatVacancyAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        long choiceCode,
        int categoryId,
        int quotaId,
        string allocatedType,
        CancellationToken cancellationToken)
    {
        var column = allocatedType switch
        {
            "Gen" => "Gen",
            "Fem" => "Fem",
            _ => throw new ArgumentOutOfRangeException(nameof(allocatedType))
        };

        await ExecuteNonQueryAsync(
            connection,
            transaction,
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
        AllocatedMinorityId = reader.IsDBNull(reader.GetOrdinal("AllocatedMinorityId"))
            ? 0
            : Convert.ToInt32(reader["AllocatedMinorityId"]),
        StudentMinorityId = reader.IsDBNull(reader.GetOrdinal("StudentMinorityId"))
            ? 0
            : Convert.ToInt32(reader["StudentMinorityId"]),
        SeqId = reader.IsDBNull(reader.GetOrdinal("SeqId"))
            ? 0
            : Convert.ToInt32(reader["SeqId"]),
        Flag = reader.GetBoolean(reader.GetOrdinal("Flag")),
        StepId = Convert.ToInt32(reader["StepId"])
    };

    private static SqlCommand CreateCommand(
        SqlConnection connection,
        SqlTransaction transaction,
        string sql)
    {
        return new SqlCommand(sql, connection, transaction)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 0
        };
    }

    private static async Task<int> ExecuteScalarIntAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        string sql,
        CancellationToken cancellationToken,
        params (string Name, SqlDbType Type, object Value)[] parameters)
    {
        await using var command = CreateCommand(connection, transaction, sql);
        foreach (var parameter in parameters)
            command.Parameters.Add(parameter.Name, parameter.Type).Value = parameter.Value;

        var value = await command.ExecuteScalarAsync(cancellationToken);
        return value is null or DBNull ? 0 : Convert.ToInt32(value);
    }

    private static async Task ExecuteNonQueryAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        string sql,
        CancellationToken cancellationToken,
        params (string Name, SqlDbType Type, object Value)[] parameters)
    {
        await using var command = CreateCommand(connection, transaction, sql);
        foreach (var parameter in parameters)
            command.Parameters.Add(parameter.Name, parameter.Type).Value = parameter.Value;

        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private sealed record VacancyRow(
        int CategoryId,
        short? MinorityId,
        int QuotaId,
        int Gen,
        int Fem);
}

public sealed class LegacyStep0Result
{
    public LegacyStep0Result(IReadOnlyList<LegacyAllocationRow> allocations)
    {
        Allocations = allocations;
    }

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
    public int AllocatedMinorityId { get; init; }
    public int StudentMinorityId { get; init; }
    public int SeqId { get; init; }
    public bool Flag { get; init; }
    public int StepId { get; init; }
}

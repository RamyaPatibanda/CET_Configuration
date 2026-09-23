using System.Data;
using System.Data.SqlClient;
using api.Models.Allocation;
using api.DataAccess.Allocation;

namespace api.Services.Allocation;

/// <summary>
/// Implements the legacy Defence conversion behavior in the application layer.
/// This service never executes Allocation_Seats_Def_Convert.
/// </summary>
public sealed class DefenceConversionService
{
    private readonly ILogger<DefenceConversionService> _logger;

    public DefenceConversionService(ILogger<DefenceConversionService> logger)
    {
        _logger = logger;
    }

    public async Task<LegacyAllocationRow?> TryConvertAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        AllocationCandidate candidate,
        CollegePreference preference,
        VacancyRow vacancy,
        AllocationRule allocationRule,
        CancellationToken cancellationToken = default)
    {
        if (!candidate.IsExServicemen.Equals("Y", StringComparison.OrdinalIgnoreCase))
            return null;

        var defenceVacancy = await GetDefenceVacancyAsync(
            connection, transaction, preference.ChoiceCode, cancellationToken);

        if (defenceVacancy <= 0)
            return null;

        // Defence conversion must use the same configured Allocation Type
        // and Sequence as Step 0. Never infer Gen/Fem from candidate gender and
        // never fall back to the legacy hardcoded sequence.
        var allocatedType = allocationRule.AllocatedType;
        if (!IsGenOrFem(allocatedType))
            return null;

        var vacancyForConfiguredType = GetVacancy(vacancy, allocatedType);
        if (vacancyForConfiguredType <= 0)
            return null;

        if (vacancy.CategoryId == 1 &&
            !candidate.IsEligibleForOpen.Equals("Y", StringComparison.OrdinalIgnoreCase))
            return null;

        var existing = await GetActiveAllocationAsync(
            connection, transaction, candidate.CandidateId, cancellationToken);

        if (existing is not null)
        {
            await RestoreExistingAllocationAsync(connection, transaction, existing, cancellationToken);
            await DeactivateAllocationAsync(connection, transaction, existing.AllocationId, cancellationToken);
        }

        var sequenceId = allocationRule.SequenceId;
        if (sequenceId <= 0)
            return null;

        var inserted = await InsertAllocationAsync(
            connection,
            transaction,
            candidate,
            preference,
            vacancy,
            allocatedType,
            sequenceId,
            cancellationToken);

        inserted.RuleCode = allocationRule.Code;

        await ExecuteNonQueryAsync(
            connection,
            transaction,
            """
            UPDATE dbo.Allocation_SeatDistribution_PH
            SET Def = ISNULL(Def, 0) - 1
            WHERE ChoiceCode = @ChoiceCode;
            """,
            cancellationToken,
            ("@ChoiceCode", SqlDbType.BigInt, preference.ChoiceCode));

        await ExecuteNonQueryAsync(
            connection,
            transaction,
            $"UPDATE dbo.Allocation_SeatDistribution SET [{allocatedType}] = ISNULL([{allocatedType}], 0) - 1 WHERE ChoiceCode = @ChoiceCode AND CategoryID = @CategoryId AND QuotaID = @QuotaId;",
            cancellationToken,
            ("@ChoiceCode", SqlDbType.BigInt, preference.ChoiceCode),
            ("@CategoryId", SqlDbType.TinyInt, vacancy.CategoryId),
            ("@QuotaId", SqlDbType.TinyInt, vacancy.QuotaId));

        _logger.LogDebug(
            "Defence conversion allocated candidate {CandidateId} to choice {ChoiceCode}, preference {PreferenceNo}, type {AllocatedType}.",
            candidate.CandidateId, preference.ChoiceCode, preference.PreferenceNo, allocatedType);

        return inserted;
    }

    private static bool IsGenOrFem(string value) =>
        value.Equals("Gen", StringComparison.OrdinalIgnoreCase) ||
        value.Equals("Fem", StringComparison.OrdinalIgnoreCase);

    private static int GetVacancy(VacancyRow vacancy, string allocatedType) =>
        allocatedType.Equals("Fem", StringComparison.OrdinalIgnoreCase) ? vacancy.Fem :
        allocatedType.Equals("Gen", StringComparison.OrdinalIgnoreCase) ? vacancy.Gen : 0;


    private static async Task<int> GetDefenceVacancyAsync(
        SqlConnection connection, SqlTransaction transaction, long choiceCode,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT ISNULL(Def, 0)
            FROM dbo.Allocation_SeatDistribution_PH
            WHERE ChoiceCode = @ChoiceCode;
            """;
        await using var command = CreateCommand(connection, transaction, sql);
        command.Parameters.Add("@ChoiceCode", SqlDbType.BigInt).Value = choiceCode;
        var value = await command.ExecuteScalarAsync(cancellationToken);
        return value is null or DBNull ? 0 : Convert.ToInt32(value);
    }

    private static async Task<LegacyAllocationRow?> GetActiveAllocationAsync(
        SqlConnection connection, SqlTransaction transaction, long candidateId,
        CancellationToken cancellationToken)
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
        return await reader.ReadAsync(cancellationToken) ? ReadAllocation(reader) : null;
    }

    private static async Task RestoreExistingAllocationAsync(
        SqlConnection connection, SqlTransaction transaction, LegacyAllocationRow allocation,
        CancellationToken cancellationToken)
    {
        if (allocation.OriginalAllocatedType is "PH" or "Def" or "Orp")
        {
            await ExecuteNonQueryAsync(connection, transaction,
                $"UPDATE dbo.Allocation_SeatDistribution_PH SET [{allocation.OriginalAllocatedType}] = ISNULL([{allocation.OriginalAllocatedType}], 0) + 1 WHERE ChoiceCode = @ChoiceCode;",
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
            await ExecuteNonQueryAsync(connection, transaction,
                $"UPDATE dbo.Allocation_SeatDistribution SET [{seatColumn}] = ISNULL([{seatColumn}], 0) + 1 WHERE ChoiceCode = @ChoiceCode AND CategoryID = @CategoryId AND QuotaID = @QuotaId;",
                cancellationToken,
                ("@ChoiceCode", SqlDbType.BigInt, allocation.ChoiceCode),
                ("@CategoryId", SqlDbType.TinyInt, allocation.AllocatedCategoryId),
                ("@QuotaId", SqlDbType.TinyInt, allocation.AllocatedQuotaId));
        }
    }

    private static async Task DeactivateAllocationAsync(
        SqlConnection connection, SqlTransaction transaction, long allocationId,
        CancellationToken cancellationToken) =>
        await ExecuteNonQueryAsync(connection, transaction,
            "UPDATE dbo.Allocation_Colleges SET Flag = 0 WHERE AllocationID = @AllocationId;",
            cancellationToken,
            ("@AllocationId", SqlDbType.BigInt, allocationId));

    private static async Task<LegacyAllocationRow> InsertAllocationAsync(
        SqlConnection connection, SqlTransaction transaction, AllocationCandidate candidate,
        CollegePreference preference, VacancyRow vacancy, string allocatedType, int sequenceId,
        CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO dbo.Allocation_Colleges
            (CandidateId,ChoiceCode,PreferenceNo,AllocatedType,AllocatedQuotaId,AllocatedCategoryID,
             StudentCategoryID,OriginalAllocatedType,AllocatedMinorityId,StudentMinorityId,SeqId,Flag,StepId)
            OUTPUT INSERTED.AllocationID, INSERTED.CandidateId, INSERTED.ChoiceCode, INSERTED.PreferenceNo,
                INSERTED.AllocatedType, INSERTED.AllocatedQuotaId, INSERTED.AllocatedCategoryID,
                INSERTED.StudentCategoryID, INSERTED.OriginalAllocatedType, INSERTED.AllocatedMinorityId,
                INSERTED.StudentMinorityId, INSERTED.SeqId, INSERTED.Flag, INSERTED.StepId
            VALUES (@CandidateId,@ChoiceCode,@PreferenceNo,@AllocatedType,@QuotaId,@CategoryId,
                    @StudentCategoryId,'Def',@MinorityId,0,@SeqId,1,0);
            """;
        await using var command = CreateCommand(connection, transaction, sql);
        command.Parameters.Add("@CandidateId", SqlDbType.BigInt).Value = candidate.CandidateId;
        command.Parameters.Add("@ChoiceCode", SqlDbType.BigInt).Value = preference.ChoiceCode;
        command.Parameters.Add("@PreferenceNo", SqlDbType.SmallInt).Value = preference.PreferenceNo;
        command.Parameters.Add("@AllocatedType", SqlDbType.VarChar, 10).Value = allocatedType;
        command.Parameters.Add("@QuotaId", SqlDbType.TinyInt).Value = vacancy.QuotaId;
        command.Parameters.Add("@CategoryId", SqlDbType.TinyInt).Value = vacancy.CategoryId;
        command.Parameters.Add("@StudentCategoryId", SqlDbType.TinyInt).Value = candidate.EffectiveCategoryId;
        command.Parameters.Add("@MinorityId", SqlDbType.SmallInt).Value = vacancy.MinorityId;
        command.Parameters.Add("@SeqId", SqlDbType.TinyInt).Value = sequenceId;
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
            throw new InvalidOperationException("Defence conversion insert did not return the inserted allocation.");
        return ReadAllocation(reader);
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

    private static SqlCommand CreateCommand(SqlConnection connection, SqlTransaction transaction, string sql) =>
        new(sql, connection, transaction) { CommandType = CommandType.Text, CommandTimeout = 0 };

    private static async Task ExecuteNonQueryAsync(
        SqlConnection connection, SqlTransaction transaction, string sql,
        CancellationToken cancellationToken,
        params (string Name, SqlDbType Type, object Value)[] parameters)
    {
        await using var command = CreateCommand(connection, transaction, sql);
        foreach (var parameter in parameters)
            command.Parameters.Add(parameter.Name, parameter.Type).Value = parameter.Value;
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public sealed record VacancyRow(int CategoryId, short MinorityId, int QuotaId, int Gen, int Fem);
}

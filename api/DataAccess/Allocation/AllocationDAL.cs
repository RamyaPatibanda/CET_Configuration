using System.Data;
using System.Data.SqlClient;
using api.Models.Allocation;
using api.Utils;

namespace api.DataAccess.Allocation;

/// <summary>
/// Shared database access for allocation stages. Common SQL operations are
/// centralized here so Step 0, Step 1 and future stages can reuse them.
/// </summary>
public sealed class AllocationDAL
{
    private readonly string _connectionString;

    public AllocationDAL(IConfiguration configuration)
    {
        _connectionString = new ConnectionUtils().GetConnectionString(
            configuration["ConnectionStrings:CrmDbConnection"]
            ?? throw new InvalidOperationException("CrmDbConnection is not configured."));
    }

    public SqlConnection CreateConnection() => new(_connectionString);

    public SqlCommand CreateCommand(SqlConnection connection, SqlTransaction transaction, string sql) =>
        new(sql, connection, transaction) { CommandType = CommandType.Text, CommandTimeout = 0 };

    public async Task<int> ExecuteScalarIntAsync(
        SqlConnection connection, SqlTransaction transaction, string sql,
        CancellationToken cancellationToken,
        params (string Name, SqlDbType Type, object Value)[] parameters)
    {
        await using var command = CreateCommand(connection, transaction, sql);
        foreach (var parameter in parameters)
            command.Parameters.Add(parameter.Name, parameter.Type).Value = parameter.Value;

        var value = await command.ExecuteScalarAsync(cancellationToken);
        return value is null or DBNull ? 0 : Convert.ToInt32(value);
    }

    public async Task ExecuteNonQueryAsync(
        SqlConnection connection, SqlTransaction transaction, string sql,
        CancellationToken cancellationToken,
        params (string Name, SqlDbType Type, object Value)[] parameters)
    {
        await using var command = CreateCommand(connection, transaction, sql);
        foreach (var parameter in parameters)
            command.Parameters.Add(parameter.Name, parameter.Type).Value = parameter.Value;

        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<LegacyAllocationRow?> GetActiveAllocationAsync(
        SqlConnection connection, SqlTransaction transaction,
        long candidateId, CancellationToken cancellationToken)
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
        if (!await reader.ReadAsync(cancellationToken))
            return null;

        return ReadAllocation(reader);
    }

    public Task<bool> HasFirstPreferenceAllocationAsync(
        SqlConnection connection, SqlTransaction transaction,
        long candidateId, CancellationToken cancellationToken) =>
        ExecuteScalarIntAsync(
            connection, transaction,
            "SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.Allocation_Colleges WHERE CandidateId = @CandidateId AND PreferenceNo = 1) THEN 1 ELSE 0 END;",
            cancellationToken,
            ("@CandidateId", SqlDbType.BigInt, candidateId))
        .ContinueWith(t => t.Result == 1, cancellationToken);

    public Task<bool> IsInTempPhDefAsync(
        SqlConnection connection, SqlTransaction transaction,
        long candidateId, CancellationToken cancellationToken) =>
        ExecuteScalarIntAsync(
            connection, transaction,
            "SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.Allocation_tempPHDef WHERE CandidateID = @CandidateId) THEN 1 ELSE 0 END;",
            cancellationToken,
            ("@CandidateId", SqlDbType.BigInt, candidateId))
        .ContinueWith(t => t.Result == 1, cancellationToken);

    public async Task<List<CollegePreference>> GetPreferencesBeforeAsync(
        SqlConnection connection, SqlTransaction transaction,
        long candidateId, int preferenceLimit, CancellationToken cancellationToken)
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

    public async Task DeactivateAllocationAsync(
        SqlConnection connection, SqlTransaction transaction,
        long allocationId, CancellationToken cancellationToken) =>
        await ExecuteNonQueryAsync(
            connection, transaction,
            "UPDATE dbo.Allocation_Colleges SET Flag = 0 WHERE AllocationID = @AllocationId;",
            cancellationToken,
            ("@AllocationId", SqlDbType.BigInt, allocationId));

    public async Task ConsumeSeatVacancyAsync(
        SqlConnection connection, SqlTransaction transaction,
        long choiceCode, int categoryId, int quotaId,
        string allocationType, CancellationToken cancellationToken)
    {
        var column = SafeIdentifier(allocationType);

        await ExecuteNonQueryAsync(
            connection, transaction,
            $"UPDATE dbo.Allocation_SeatDistribution SET {column} = ISNULL({column}, 0) - 1 WHERE ChoiceCode = @ChoiceCode AND CategoryID = @CategoryId AND QuotaID = @QuotaId;",
            cancellationToken,
            ("@ChoiceCode", SqlDbType.BigInt, choiceCode),
            ("@CategoryId", SqlDbType.TinyInt, categoryId),
            ("@QuotaId", SqlDbType.TinyInt, quotaId));
    }

    public async Task ConsumeSpecialVacancyAsync(
        SqlConnection connection, SqlTransaction transaction,
        long choiceCode, string vacancySource, string vacancyType,
        CancellationToken cancellationToken)
    {
        var source = SafeIdentifier(vacancySource);
        var column = SafeIdentifier(vacancyType);

        await ExecuteNonQueryAsync(
            connection, transaction,
            $"UPDATE dbo.{source} SET {column} = ISNULL({column}, 0) - 1 WHERE ChoiceCode = @ChoiceCode;",
            cancellationToken,
            ("@ChoiceCode", SqlDbType.BigInt, choiceCode));
    }

    public async Task<int> GetConfiguredVacancyAsync(
        SqlConnection connection, SqlTransaction transaction,
        long choiceCode, string sourceTable, string vacancyColumn,
        CancellationToken cancellationToken)
    {
        var source = SafeIdentifier(sourceTable);
        var column = SafeIdentifier(vacancyColumn);

        const string metadataSql = """
            SELECT COUNT(1)
            FROM sys.tables t
            INNER JOIN sys.columns c ON c.object_id = t.object_id
            WHERE t.schema_id = SCHEMA_ID(N'dbo')
              AND t.name = @TableName
              AND c.name = @ColumnName;
            """;

        if (await ExecuteScalarIntAsync(
                connection, transaction, metadataSql, cancellationToken,
                ("@TableName", SqlDbType.NVarChar, sourceTable),
                ("@ColumnName", SqlDbType.NVarChar, vacancyColumn)) == 0)
        {
            throw new InvalidOperationException(
                $"Configured vacancy source '{sourceTable}.{vacancyColumn}' does not exist.");
        }

        return await ExecuteScalarIntAsync(
            connection, transaction,
            $"SELECT ISNULL({column}, 0) FROM dbo.{source} WHERE ChoiceCode = @ChoiceCode;",
            cancellationToken,
            ("@ChoiceCode", SqlDbType.BigInt, choiceCode));
    }

    public async Task RestoreAllocationAsync(
        SqlConnection connection, SqlTransaction transaction,
        LegacyAllocationRow allocation, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(allocation.OriginalAllocatedType))
        {
            var column = SafeIdentifier(allocation.OriginalAllocatedType);
            await ExecuteNonQueryAsync(
                connection, transaction,
                $"UPDATE dbo.Allocation_SeatDistribution_PH SET {column} = ISNULL({column}, 0) + 1 WHERE ChoiceCode = @ChoiceCode;",
                cancellationToken,
                ("@ChoiceCode", SqlDbType.BigInt, allocation.ChoiceCode));
        }

        if (!string.IsNullOrWhiteSpace(allocation.AllocatedType))
        {
            var column = SafeIdentifier(allocation.AllocatedType);
            await ExecuteNonQueryAsync(
                connection, transaction,
                $"UPDATE dbo.Allocation_SeatDistribution SET {column} = ISNULL({column}, 0) + 1 WHERE ChoiceCode = @ChoiceCode AND CategoryID = @CategoryId AND QuotaID = @QuotaId;",
                cancellationToken,
                ("@ChoiceCode", SqlDbType.BigInt, allocation.ChoiceCode),
                ("@CategoryId", SqlDbType.TinyInt, allocation.AllocatedCategoryId),
                ("@QuotaId", SqlDbType.TinyInt, allocation.AllocatedQuotaId));
        }
    }

    public static LegacyAllocationRow ReadAllocation(SqlDataReader reader) => new()
    {
        AllocationId = Convert.ToInt64(reader["AllocationID"]),
        CandidateId = Convert.ToInt64(reader["CandidateId"]),
        ChoiceCode = Convert.ToInt64(reader["ChoiceCode"]),
        PreferenceNo = Convert.ToInt32(reader["PreferenceNo"]),
        AllocatedType = Convert.ToString(reader["AllocatedType"]) ?? string.Empty,
        AllocatedQuotaId = Convert.ToInt32(reader["AllocatedQuotaId"]),
        AllocatedCategoryId = Convert.ToInt32(reader["AllocatedCategoryID"]),
        StudentCategoryId = Convert.ToInt32(reader["StudentCategoryID"]),
        OriginalAllocatedType = Convert.ToString(reader["OriginalAllocatedType"]) ?? string.Empty,
        AllocatedMinorityId = reader["AllocatedMinorityId"] == DBNull.Value ? 0 : Convert.ToInt32(reader["AllocatedMinorityId"]),
        StudentMinorityId = reader["StudentMinorityId"] == DBNull.Value ? 0 : Convert.ToInt32(reader["StudentMinorityId"]),
        SeqId = reader["SeqId"] == DBNull.Value ? 0 : Convert.ToInt32(reader["SeqId"]),
        Flag = reader["Flag"] != DBNull.Value && Convert.ToBoolean(reader["Flag"]),
        StepId = Convert.ToInt32(reader["StepId"])
    };

    private static string SafeIdentifier(string value)
    {
        if (string.IsNullOrWhiteSpace(value) ||
            value.Any(ch => !(char.IsLetterOrDigit(ch) || ch == '_')))
            throw new InvalidOperationException($"Invalid allocation identifier '{value}'.");

        return "[" + value + "]";
    }
}

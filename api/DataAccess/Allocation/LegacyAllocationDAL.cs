using System.Data;
using System.Data.SqlClient;
using api.Models.Allocation;
using api.Utils;

namespace api.DataAccess.Allocation;

public sealed class LegacyAllocationDAL
{
    private readonly string _connectionString;
    private readonly ILogger<LegacyAllocationDAL> _logger;

    public LegacyAllocationDAL(
        IConfiguration configuration,
        ILogger<LegacyAllocationDAL> logger)
    {
        _logger = logger;
        _connectionString = new ConnectionUtils().GetConnectionString(
            configuration["ConnectionStrings:CrmDbConnection"]
            ?? throw new InvalidOperationException("CrmDbConnection is not configured."));
    }

    public async Task<LegacyStep0Result> ExecuteStep0Async(
        CancellationToken cancellationToken = default)
    {
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        var beforeMax = await GetMaxAllocationIdAsync(connection, cancellationToken);

        try
        {
            await using var command = new SqlCommand("Allocation_Seats_Step0", connection)
            {
                CommandType = CommandType.StoredProcedure,
                CommandTimeout = 0
            };

            await command.ExecuteNonQueryAsync(cancellationToken);

            var rows = await GetNewStep0AllocationsAsync(
                connection,
                beforeMax,
                cancellationToken);

            return new LegacyStep0Result(rows);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Legacy Allocation_Seats_Step0 execution failed.");
            throw;
        }
    }

    private static async Task<long> GetMaxAllocationIdAsync(
        SqlConnection connection,
        CancellationToken cancellationToken)
    {
        await using var command = new SqlCommand(
            "SELECT ISNULL(MAX(AllocationID), 0) FROM dbo.Allocation_Colleges;",
            connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30
        };

        var value = await command.ExecuteScalarAsync(cancellationToken);
        return Convert.ToInt64(value);
    }

    private static async Task<List<LegacyAllocationRow>> GetNewStep0AllocationsAsync(
        SqlConnection connection,
        long previousMaxAllocationId,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                A.AllocationID,
                A.CandidateId,
                A.ChoiceCode,
                A.PreferenceNo,
                A.AllocatedType,
                A.AllocatedQuotaId,
                A.AllocatedCategoryID,
                A.StudentCategoryID,
                A.OriginalAllocatedType,
                A.AllocatedMinorityId,
                A.StudentMinorityId,
                A.SeqId,
                A.Flag,
                A.StepId
            FROM dbo.Allocation_Colleges A
            WHERE A.AllocationID > @PreviousMaxAllocationId
              AND A.StepId = 0
              AND A.Flag = 1
            ORDER BY A.AllocationID;
            """;

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30
        };
        command.Parameters.Add("@PreviousMaxAllocationId", SqlDbType.BigInt).Value =
            previousMaxAllocationId;

        var rows = new List<LegacyAllocationRow>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            rows.Add(new LegacyAllocationRow
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
            });
        }

        return rows;
    }
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

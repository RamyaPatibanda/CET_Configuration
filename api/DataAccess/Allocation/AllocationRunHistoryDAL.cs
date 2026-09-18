using System.Data;
using System.Data.SqlClient;
using api.Models.Allocation;
using api.Utils;

namespace api.DataAccess.Allocation;

public sealed class AllocationRunHistoryDAL
{
    private readonly string _connectionString;
    private readonly ILogger<AllocationRunHistoryDAL> _logger;

    public AllocationRunHistoryDAL(IConfiguration configuration, ILogger<AllocationRunHistoryDAL> logger)
    {
        _logger = logger;
        _connectionString = new ConnectionUtils().GetConnectionString(
            configuration["ConnectionStrings:CrmDbConnection"]
            ?? throw new InvalidOperationException("CrmDbConnection is not configured."));
    }

    public async Task SaveAsync(AllocationRunHistory history)
    {
        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await using var command = new SqlCommand("sproc_SaveAllocationRunHistory", connection)
            {
                CommandType = CommandType.StoredProcedure,
                CommandTimeout = 30
            };

            command.Parameters.Add("@aAllocationRunId", SqlDbType.UniqueIdentifier).Value = history.AllocationRunId;
            command.Parameters.Add("@tAllocationRunName", SqlDbType.NVarChar, 200).Value = history.AllocationRunName;
            command.Parameters.Add("@nCapRound", SqlDbType.Int).Value = history.CapRound;
            command.Parameters.Add("@tAllocationStep", SqlDbType.NVarChar, 50).Value = history.AllocationStep;
            command.Parameters.Add("@tStatus", SqlDbType.NVarChar, 30).Value = history.Status;
            command.Parameters.Add("@tRuleGroupsJson", SqlDbType.NVarChar, -1).Value = history.RuleGroupsJson;
            command.Parameters.Add("@dtStartedAtUtc", SqlDbType.DateTime2).Value = history.StartedAtUtc;
            command.Parameters.Add("@dtCompletedAtUtc", SqlDbType.DateTime2).Value = (object?)history.CompletedAtUtc ?? DBNull.Value;
            command.Parameters.Add("@nCandidateCount", SqlDbType.Int).Value = history.CandidateCount;
            command.Parameters.Add("@nDecisionCount", SqlDbType.Int).Value = history.DecisionCount;
            command.Parameters.Add("@tErrorMessage", SqlDbType.NVarChar, 2000).Value = history.ErrorMessage;

            await connection.OpenAsync();
            await command.ExecuteNonQueryAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error while saving allocation run history {AllocationRunId}.", history.AllocationRunId);
            throw;
        }
    }

    public async Task<List<AllocationRunHistory>> GetRecentAsync(int take = 50)
    {
        try
        {
            var items = new List<AllocationRunHistory>();
            await using var connection = new SqlConnection(_connectionString);
            await using var command = new SqlCommand("sproc_GetAllocationRunHistory", connection)
            {
                CommandType = CommandType.StoredProcedure,
                CommandTimeout = 30
            };
            command.Parameters.Add("@nTake", SqlDbType.Int).Value = Math.Clamp(take, 1, 200);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                items.Add(new AllocationRunHistory
                {
                    AllocationRunId = reader.GetGuid(reader.GetOrdinal("aAllocationRunId")),
                    AllocationRunName = reader.GetString(reader.GetOrdinal("tAllocationRunName")),
                    CapRound = reader.GetInt32(reader.GetOrdinal("nCapRound")),
                    AllocationStep = reader.GetString(reader.GetOrdinal("tAllocationStep")),
                    Status = reader.GetString(reader.GetOrdinal("tStatus")),
                    RuleGroupsJson = reader.GetString(reader.GetOrdinal("tRuleGroupsJson")),
                    StartedAtUtc = reader.GetDateTime(reader.GetOrdinal("dtStartedAtUtc")),
                    CompletedAtUtc = reader.IsDBNull(reader.GetOrdinal("dtCompletedAtUtc"))
                        ? null
                        : reader.GetDateTime(reader.GetOrdinal("dtCompletedAtUtc")),
                    CandidateCount = reader.GetInt32(reader.GetOrdinal("nCandidateCount")),
                    DecisionCount = reader.GetInt32(reader.GetOrdinal("nDecisionCount")),
                    ErrorMessage = reader.IsDBNull(reader.GetOrdinal("tErrorMessage"))
                        ? string.Empty
                        : reader.GetString(reader.GetOrdinal("tErrorMessage"))
                });
            }

            return items;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error while getting allocation run history.");
            throw;
        }
    }
}

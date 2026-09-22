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
            command.Parameters.Add("@dtCreatedAtUtc", SqlDbType.DateTime2).Value = history.CreatedAtUtc;
            command.Parameters.Add("@dtStartedAtUtc", SqlDbType.DateTime2).Value = (object?)history.StartedAtUtc ?? DBNull.Value;
            command.Parameters.Add("@dtCompletedAtUtc", SqlDbType.DateTime2).Value = (object?)history.CompletedAtUtc ?? DBNull.Value;
            command.Parameters.Add("@nCandidateCount", SqlDbType.Int).Value = history.CandidateCount;
            command.Parameters.Add("@nDecisionCount", SqlDbType.Int).Value = history.DecisionCount;
            command.Parameters.Add("@tErrorMessage", SqlDbType.NVarChar, 2000).Value = history.ErrorMessage;
            command.Parameters.Add("@aCreatedByUserId", SqlDbType.Int).Value = (object?)history.CreatedByUserId ?? DBNull.Value;

            await connection.OpenAsync();
            await command.ExecuteNonQueryAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error while saving allocation run history {AllocationRunId}.", history.AllocationRunId);
            throw;
        }
    }

    public async Task SaveDecisionsAsync(Guid runId, IReadOnlyCollection<AllocationDecision> decisions)
    {
        if (decisions.Count == 0) return;

        try
        {
            var rows = decisions.Select(d => new
            {
                decisionId = d.DecisionId,
                candidateId = d.CandidateId,
                collegeId = d.CollegeId,
                preferenceNo = d.PreferenceNo,
                categoryId = d.CategoryId,
                allocatedType = d.AllocatedType,
                originalAllocatedType = d.OriginalAllocatedType,
                vacancyType = d.VacancyType,
                choiceCode = d.ChoiceCode,
                stepId = d.StepId,
                decisionArea = d.DecisionArea,
                ruleCode = d.RuleCode,
                status = d.Status
            });

            await using var connection = new SqlConnection(_connectionString);
            await using var command = new SqlCommand("sproc_SaveAllocationRunDecisions", connection)
            {
                CommandType = CommandType.StoredProcedure,
                CommandTimeout = 30
            };
            command.Parameters.Add("@aAllocationRunId", SqlDbType.UniqueIdentifier).Value = runId;
            command.Parameters.Add("@tDecisionsJson", SqlDbType.NVarChar, -1).Value =
                System.Text.Json.JsonSerializer.Serialize(rows);

            await connection.OpenAsync();
            await command.ExecuteNonQueryAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error while saving allocation decisions for run {AllocationRunId}.", runId);
            throw;
        }
    }

    public async Task DeleteAsync(Guid runId)
    {
        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await using var command = new SqlCommand("sproc_DeleteAllocationRun", connection)
            {
                CommandType = CommandType.StoredProcedure,
                CommandTimeout = 30
            };
            command.Parameters.Add("@aAllocationRunId", SqlDbType.UniqueIdentifier).Value = runId;
            await connection.OpenAsync();
            await command.ExecuteNonQueryAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error while deleting allocation run {AllocationRunId}.", runId);
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
                var startedOrdinal = reader.GetOrdinal("dtStartedAtUtc");
                var completedOrdinal = reader.GetOrdinal("dtCompletedAtUtc");
                var errorOrdinal = reader.GetOrdinal("tErrorMessage");

                items.Add(new AllocationRunHistory
                {
                    AllocationRunId = reader.GetGuid(reader.GetOrdinal("aAllocationRunId")),
                    AllocationRunName = reader.GetString(reader.GetOrdinal("tAllocationRunName")),
                    CapRound = reader.GetInt32(reader.GetOrdinal("nCapRound")),
                    AllocationStep = reader.GetString(reader.GetOrdinal("tAllocationStep")),
                    Status = reader.GetString(reader.GetOrdinal("tStatus")),
                    RuleGroupsJson = reader.GetString(reader.GetOrdinal("tRuleGroupsJson")),
                    CreatedAtUtc = reader.GetDateTime(reader.GetOrdinal("dtCreatedAtUtc")),
                    StartedAtUtc = reader.IsDBNull(startedOrdinal) ? null : reader.GetDateTime(startedOrdinal),
                    CompletedAtUtc = reader.IsDBNull(completedOrdinal) ? null : reader.GetDateTime(completedOrdinal),
                    CandidateCount = reader.GetInt32(reader.GetOrdinal("nCandidateCount")),
                    DecisionCount = reader.GetInt32(reader.GetOrdinal("nDecisionCount")),
                    ErrorMessage = reader.IsDBNull(errorOrdinal) ? string.Empty : reader.GetString(errorOrdinal),
                    CreatedByUserId = reader.IsDBNull(reader.GetOrdinal("aCreatedByUserId")) ? null : reader.GetInt32(reader.GetOrdinal("aRunByUserId")),
                    CreatedBy = reader.IsDBNull(reader.GetOrdinal("tCreatedBy")) ? string.Empty : reader.GetString(reader.GetOrdinal("tRunBy"))
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

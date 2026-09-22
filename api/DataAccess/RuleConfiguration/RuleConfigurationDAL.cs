using System.Text.Json;
using System.Data;
using System.Data.SqlClient;
using api.Models.RuleConfiguration;
using api.Utils;

namespace api.DataAccess.RuleConfiguration
{
    public class RuleConfigurationDAL : IRuleConfigurationDAL
    {
        private readonly string _connectionString;
        private readonly ILogger<RuleConfigurationDAL> _logger;

        public RuleConfigurationDAL(
            IConfiguration configuration,
            ILogger<RuleConfigurationDAL> logger)
        {
            _logger = logger;
            _connectionString = new ConnectionUtils().GetConnectionString(
                configuration["ConnectionStrings:CrmDbConnection"]
                ?? throw new InvalidOperationException(
                    "CrmDbConnection is not configured."));
        }

        public async Task<List<RuleDefinition>> GetRulesAsync()
        {
            try
            {
                var rules = new List<RuleDefinition>();
                await using var connection = new SqlConnection(_connectionString);
                await using var command = CreateCommand("sproc_GetRulesV2", connection);
                await connection.OpenAsync();
                await using var reader = await command.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    rules.Add(MapRule(reader));
                }

                return rules;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while getting rules.");
                throw;
            }
        }

        public async Task<RuleDefinition?> GetRuleAsync(int ruleId)
        {
            try
            {
                RuleDefinition? rule = null;
                await using var connection = new SqlConnection(_connectionString);
                await using var command = CreateCommand("sproc_GetRuleV2", connection);
                command.Parameters.Add("@aRuleId", SqlDbType.Int).Value = ruleId;
                await connection.OpenAsync();
                await using var reader = await command.ExecuteReaderAsync();

                if (await reader.ReadAsync())
                {
                    rule = MapRule(reader);
                }

                if (rule is null)
                {
                    return null;
                }

                if (await reader.NextResultAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        rule.Conditions.Add(MapCondition(reader));
                    }
                }

                return rule;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while getting rule {RuleId}.", ruleId);
                throw;
            }
        }

        public async Task<int> CreateRuleAsync(CreateRuleRequest request)
        {
            try
            {
                await using var connection = new SqlConnection(_connectionString);
                await using var command = CreateCommand("sproc_CreateRuleV2", connection);
                AddRuleParameters(command, request.RuleId, request.RuleName, request.Description, request.Priority, request.IsActive);
                command.Parameters.Add("@tDecisionAreaCode", SqlDbType.NVarChar, 100).Value = request.DecisionAreaCode ?? string.Empty;
                command.Parameters.Add("@tOutcomeJson", SqlDbType.NVarChar, -1).Value = SerializeOutcome(request.Outcome);
                command.Parameters.Add("@tConditionsJson", SqlDbType.NVarChar, -1).Value = SerializeConditions(request.Conditions);\n                command.Parameters.Add("@aCreatedByUserId", SqlDbType.Int).Value = request.CreatedByUserId;
                await connection.OpenAsync();
                var ruleId = Convert.ToInt32(await command.ExecuteScalarAsync());
                await SaveBranchesAsync(ruleId, request.Branches);
                return ruleId;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while creating rule {RuleName}.", request.RuleName);
                throw;
            }
        }

        public async Task<bool> UpdateRuleAsync(UpdateRuleRequest request)
        {
            try
            {
                await using var connection = new SqlConnection(_connectionString);
                await using var command = CreateCommand("sproc_UpdateRuleV2", connection);
                AddRuleParameters(command, request.RuleId, request.RuleName, request.Description, request.Priority, request.IsActive);
                command.Parameters.Add("@tDecisionAreaCode", SqlDbType.NVarChar, 100).Value = request.DecisionAreaCode ?? string.Empty;
                command.Parameters.Add("@tOutcomeJson", SqlDbType.NVarChar, -1).Value = SerializeOutcome(request.Outcome);
                command.Parameters.Add("@tConditionsJson", SqlDbType.NVarChar, -1).Value = SerializeConditions(request.Conditions);
                await connection.OpenAsync();
                var updated = Convert.ToInt32(await command.ExecuteScalarAsync()) > 0;
                if (updated)
                    await SaveBranchesAsync(request.RuleId, request.Branches);
                return updated;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while updating rule {RuleId}.", request.RuleId);
                throw;
            }
        }

        public async Task<bool> DeleteRuleAsync(int ruleId)
        {
            try
            {
                await using var connection = new SqlConnection(_connectionString);
                await using var command = CreateCommand("sproc_DeleteRule", connection);
                command.Parameters.Add("@aRuleId", SqlDbType.Int).Value = ruleId;
                await connection.OpenAsync();
                return Convert.ToInt32(await command.ExecuteScalarAsync()) > 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while deleting rule {RuleId}.", ruleId);
                throw;
            }
        }

        public async Task<List<RuleFieldOption>> GetActiveFieldsAsync()
        {
            try
            {
                var fields = new List<RuleFieldOption>();
                await using var connection = new SqlConnection(_connectionString);
                await using var command = CreateCommand("sproc_GetActiveRuleFields", connection);
                await connection.OpenAsync();
                await using var reader = await command.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    fields.Add(new RuleFieldOption
                    {
                        FieldId = reader.GetInt32(reader.GetOrdinal("aFieldId")),
                        DisplayName = reader.GetString(reader.GetOrdinal("tDisplayName")),
                        FieldName = reader.GetString(reader.GetOrdinal("tFieldName")),
                        FieldType = reader.GetString(reader.GetOrdinal("tFieldType"))
                    });
                }

                return fields;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while getting active rule fields.");
                throw;
            }
        }

        public async Task<bool> SetRuleActiveAsync(int ruleId, bool isActive)
        {
            try
            {
                await using var connection = new SqlConnection(_connectionString);
                await using var command = CreateCommand("sproc_SetRuleActive", connection);
                command.Parameters.Add("@aRuleId", SqlDbType.Int).Value = ruleId;
                command.Parameters.Add("@bIsActive", SqlDbType.Bit).Value = isActive;
                await connection.OpenAsync();
                return Convert.ToInt32(await command.ExecuteScalarAsync()) > 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while changing active state for rule {RuleId}.", ruleId);
                throw;
            }
        }

        public async Task ReorderRulesAsync(List<int> ruleIds)
        {
            try
            {
                await using var connection = new SqlConnection(_connectionString);
                await using var command = CreateCommand("sproc_ReorderRules", connection);
                command.Parameters.Add("@tRuleIdsJson", SqlDbType.NVarChar, -1).Value =
                    System.Text.Json.JsonSerializer.Serialize(ruleIds);
                await connection.OpenAsync();
                await command.ExecuteNonQueryAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while reordering rules.");
                throw;
            }
        }

        private async Task SaveBranchesAsync(int ruleId, List<RuleBranchRequest>? decisionRows)
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var transaction = connection.BeginTransaction();

            try
            {
                await using (var delete = new SqlCommand(
                    "DELETE FROM dbo.tblRuleBranch WHERE aRuleId = @aRuleId",
                    connection, transaction))
                {
                    delete.Parameters.Add("@aRuleId", SqlDbType.Int).Value = ruleId;
                    await delete.ExecuteNonQueryAsync();
                }

                foreach (var row in (decisionRows ?? new List<RuleBranchRequest>()).OrderBy(x => x.BranchOrder))
                {
                    if (string.IsNullOrWhiteSpace(row.BranchName))
                        throw new ArgumentException("Each decision row must have a name.");
                    if (string.IsNullOrWhiteSpace(row.AllocationType))
                        throw new ArgumentException($"Decision '{row.BranchName}' must have an allocation type.");
                    if (!row.IsElse && row.Conditions.Count == 0)
                        throw new ArgumentException($"Decision '{row.BranchName}' must have at least one IF condition unless it is ELSE.");
                    if (row.Sequence < 1)
                        throw new ArgumentException($"Decision '{row.BranchName}' must have a sequence greater than zero.");

                    await using var decision = new SqlCommand(@"
                        INSERT INTO dbo.tblRuleBranch
                            (aRuleId, tBranchName, nBranchOrder, tAllocatedType, nSequence, bIsActive, bIsElse, tConditionsJson, tOutcomeJson)
                        VALUES
                            (@aRuleId, @tBranchName, @nBranchOrder, @tAllocatedType, @nSequence, @bIsActive, @bIsElse, @tConditionsJson, @tOutcomeJson);",
                        connection, transaction);

                    decision.Parameters.Add("@aRuleId", SqlDbType.Int).Value = ruleId;
                    decision.Parameters.Add("@tBranchName", SqlDbType.NVarChar, 200).Value = row.BranchName.Trim();
                    decision.Parameters.Add("@nBranchOrder", SqlDbType.Int).Value = row.BranchOrder;
                    decision.Parameters.Add("@tAllocatedType", SqlDbType.NVarChar, 100).Value = row.AllocationType.Trim();
                    decision.Parameters.Add("@nSequence", SqlDbType.Int).Value = row.Sequence;
                    decision.Parameters.Add("@bIsActive", SqlDbType.Bit).Value = row.IsActive;
                    decision.Parameters.Add("@bIsElse", SqlDbType.Bit).Value = row.IsElse;
                    decision.Parameters.Add("@tConditionsJson", SqlDbType.NVarChar, -1).Value = JsonSerializer.Serialize(row.Conditions ?? new List<RuleConditionRequest>());
                    decision.Parameters.Add("@tOutcomeJson", SqlDbType.NVarChar, -1).Value = JsonSerializer.Serialize(row.Outcome ?? new RuleBranchOutcome());
                    await decision.ExecuteNonQueryAsync();
                }

                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        private static SqlCommand CreateCommand(string procedureName, SqlConnection connection)
        {
            return new SqlCommand(procedureName, connection)
            {
                CommandType = CommandType.StoredProcedure,
                CommandTimeout = 30
            };
        }

        private static void AddRuleParameters(
            SqlCommand command,
            int ruleId,
            string name,
            string description,
            int priority,
            bool active)
        {
            command.Parameters.Add("@aRuleId", SqlDbType.Int).Value = ruleId;
            command.Parameters.Add("@tRuleName", SqlDbType.NVarChar, 200).Value = name;
            command.Parameters.Add("@tDescription", SqlDbType.NVarChar, 1000).Value = description ?? string.Empty;
            command.Parameters.Add("@nPriority", SqlDbType.Int).Value = priority;
            command.Parameters.Add("@bIsActive", SqlDbType.Bit).Value = active;
        }

        private static string SerializeOutcome(RuleOutcome outcome)
        {
            return System.Text.Json.JsonSerializer.Serialize(outcome ?? new RuleOutcome());
        }

        private static string SerializeConditions(List<RuleConditionRequest> conditions)
        {
            return System.Text.Json.JsonSerializer.Serialize(
                conditions.OrderBy(c => c.GroupOrder).ThenBy(c => c.ConditionOrder));
        }

        private static RuleDefinition MapRule(SqlDataReader reader)
        {
            return new RuleDefinition
            {
                RuleId = reader.GetInt32(reader.GetOrdinal("aRuleId")),
                RuleName = reader.GetString(reader.GetOrdinal("tRuleName")),
                Description = reader.IsDBNull(reader.GetOrdinal("tDescription"))
                    ? string.Empty
                    : reader.GetString(reader.GetOrdinal("tDescription")),
                Priority = reader.GetInt32(reader.GetOrdinal("nPriority")),
                IsActive = reader.GetBoolean(reader.GetOrdinal("bIsActive")),
                ConditionCount = reader.GetInt32(reader.GetOrdinal("nConditionCount")),
                DecisionAreaCode = reader.GetString(reader.GetOrdinal("tDecisionAreaCode")),
                OutcomeJson = reader.IsDBNull(reader.GetOrdinal("tOutcomeJson")) ? "{}" : reader.GetString(reader.GetOrdinal("tOutcomeJson")),
                Branches = DeserializeBranches(reader.IsDBNull(reader.GetOrdinal("tBranchesJson")) ? "[]" : reader.GetString(reader.GetOrdinal("tBranchesJson"))),
                CreatedDate = GetDate(reader, "dtCreatedDate"),
                ModifiedDate = GetDate(reader, "dtModifiedDate"),
                CreatedByUserId = reader.IsDBNull(reader.GetOrdinal("aCreatedByUserId")) ? null : reader.GetInt32(reader.GetOrdinal("aCreatedByUserId")),
                CreatedBy = reader.IsDBNull(reader.GetOrdinal("tCreatedBy")) ? string.Empty : reader.GetString(reader.GetOrdinal("tCreatedBy"))
            };
        }


        private static List<RuleBranch> DeserializeBranches(string json)
        {
            if (string.IsNullOrWhiteSpace(json))
                return new List<RuleBranch>();

            try
            {
                return JsonSerializer.Deserialize<List<RuleBranch>>(json,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                    ?? new List<RuleBranch>();
            }
            catch (JsonException)
            {
                return new List<RuleBranch>();
            }
        }

        private static RuleCondition MapCondition(SqlDataReader reader)
        {
            return new RuleCondition
            {
                RuleConditionId = reader.GetInt32(reader.GetOrdinal("aRuleConditionId")),
                RuleId = reader.GetInt32(reader.GetOrdinal("aRuleId")),
                FieldId = reader.GetInt32(reader.GetOrdinal("aFieldId")),
                FieldDisplayName = reader.GetString(reader.GetOrdinal("tDisplayName")),
                FieldName = reader.GetString(reader.GetOrdinal("tFieldName")),
                FieldType = reader.GetString(reader.GetOrdinal("tFieldType")),
                ConditionLogicalOperator = reader.GetString(reader.GetOrdinal("tLogicalOperator")),
                Operator = reader.GetString(reader.GetOrdinal("tOperator")),
                Value = reader.GetString(reader.GetOrdinal("tValue")),
                ConditionOrder = reader.GetInt32(reader.GetOrdinal("nConditionOrder")),
                GroupOrder = reader.GetInt32(reader.GetOrdinal("nGroupOrder")),
                GroupPath = reader["tGroupPath"]?.ToString() ?? string.Empty,
            };
        }

        private static DateTime? GetDate(SqlDataReader reader, string name)
        {
            var ordinal = reader.GetOrdinal(name);
            return reader.IsDBNull(ordinal) ? null : reader.GetDateTime(ordinal);
        }
    }
}

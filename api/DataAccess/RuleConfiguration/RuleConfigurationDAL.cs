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
                await using var command = CreateCommand(
                    "sproc_GetRules",
                    connection);

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
                await using var command = CreateCommand(
                    "sproc_GetRule",
                    connection);

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
                _logger.LogError(
                    ex,
                    "Error while getting rule {RuleId}.",
                    ruleId);
                throw;
            }
        }

        public async Task<int> CreateRuleAsync(CreateRuleRequest request)
        {
            try
            {
                await using var connection = new SqlConnection(_connectionString);
                await using var command = CreateCommand(
                    "sproc_CreateRule",
                    connection);

                AddRuleParameters(
                    command,
                    request.RuleId,
                    request.RuleName,
                    request.Description,
                    request.Priority,
                    request.IsActive);

                command.Parameters.Add(
                    "@tConditionsJson",
                    SqlDbType.NVarChar,
                    -1).Value = SerializeConditions(request.Conditions);

                await connection.OpenAsync();

                return Convert.ToInt32(
                    await command.ExecuteScalarAsync());
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Error while creating rule {RuleName}.",
                    request.RuleName);
                throw;
            }
        }

        public async Task<bool> UpdateRuleAsync(UpdateRuleRequest request)
        {
            try
            {
                await using var connection = new SqlConnection(_connectionString);
                await using var command = CreateCommand(
                    "sproc_UpdateRule",
                    connection);

                AddRuleParameters(
                    command,
                    request.RuleId,
                    request.RuleName,
                    request.Description,
                    request.Priority,
                    request.IsActive);

                command.Parameters.Add(
                    "@tConditionsJson",
                    SqlDbType.NVarChar,
                    -1).Value = SerializeConditions(request.Conditions);

                await connection.OpenAsync();

                return Convert.ToInt32(
                    await command.ExecuteScalarAsync()) > 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Error while updating rule {RuleId}.",
                    request.RuleId);
                throw;
            }
        }

        public async Task<bool> DeleteRuleAsync(int ruleId)
        {
            try
            {
                await using var connection = new SqlConnection(_connectionString);
                await using var command = CreateCommand(
                    "sproc_DeleteRule",
                    connection);

                command.Parameters.Add("@aRuleId", SqlDbType.Int).Value = ruleId;

                await connection.OpenAsync();

                return Convert.ToInt32(
                    await command.ExecuteScalarAsync()) > 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Error while deleting rule {RuleId}.",
                    ruleId);
                throw;
            }
        }

        public async Task<List<RuleFieldOption>> GetActiveFieldsAsync()
        {
            try
            {
                var fields = new List<RuleFieldOption>();

                await using var connection = new SqlConnection(_connectionString);
                await using var command = CreateCommand(
                    "sproc_GetActiveRuleFields",
                    connection);

                await connection.OpenAsync();

                await using var reader = await command.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    fields.Add(new RuleFieldOption
                    {
                        FieldId = reader.GetInt32(
                            reader.GetOrdinal("aFieldId")),
                        DisplayName = reader.GetString(
                            reader.GetOrdinal("tDisplayName")),
                        FieldType = reader.GetString(
                            reader.GetOrdinal("tFieldType"))
                    });
                }

                return fields;
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Error while getting active rule fields.");
                throw;
            }
        }

        private static SqlCommand CreateCommand(
            string procedureName,
            SqlConnection connection)
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
            command.Parameters.Add(
                "@aRuleId",
                SqlDbType.Int).Value = ruleId;

            command.Parameters.Add(
                "@tRuleName",
                SqlDbType.NVarChar,
                200).Value = name;

            command.Parameters.Add(
                "@tDescription",
                SqlDbType.NVarChar,
                1000).Value = description ?? string.Empty;

            command.Parameters.Add(
                "@nPriority",
                SqlDbType.Int).Value = priority;

            command.Parameters.Add(
                "@bIsActive",
                SqlDbType.Bit).Value = active;
        }

        private static string SerializeConditions(
            List<RuleConditionRequest> conditions)
        {
            return System.Text.Json.JsonSerializer.Serialize(
                conditions.OrderBy(c => c.ConditionOrder));
        }

        private static RuleDefinition MapRule(SqlDataReader reader)
        {
            return new RuleDefinition
            {
                RuleId = reader.GetInt32(
                    reader.GetOrdinal("aRuleId")),
                RuleName = reader.GetString(
                    reader.GetOrdinal("tRuleName")),
                Description = reader.IsDBNull(
                    reader.GetOrdinal("tDescription"))
                    ? string.Empty
                    : reader.GetString(
                        reader.GetOrdinal("tDescription")),
                Priority = reader.GetInt32(
                    reader.GetOrdinal("nPriority")),
                IsActive = reader.GetBoolean(
                    reader.GetOrdinal("bIsActive")),
                CreatedDate = GetDate(reader, "dtCreatedDate"),
                ModifiedDate = GetDate(reader, "dtModifiedDate")
            };
        }

        private static RuleCondition MapCondition(SqlDataReader reader)
        {
            return new RuleCondition
            {
                RuleConditionId = reader.GetInt32(
                    reader.GetOrdinal("aRuleConditionId")),
                RuleId = reader.GetInt32(
                    reader.GetOrdinal("aRuleId")),
                FieldId = reader.GetInt32(
                    reader.GetOrdinal("aFieldId")),
                FieldDisplayName = reader.GetString(
                    reader.GetOrdinal("tDisplayName")),
                FieldType = reader.GetString(
                    reader.GetOrdinal("tFieldType")),
                LogicalOperator = reader.GetString(
                    reader.GetOrdinal("tLogicalOperator")),
                Operator = reader.GetString(
                    reader.GetOrdinal("tOperator")),
                Value = reader.GetString(
                    reader.GetOrdinal("tValue")),
                ConditionOrder = reader.GetInt32(
                    reader.GetOrdinal("nConditionOrder"))
            };
        }

        private static DateTime? GetDate(
            SqlDataReader reader,
            string name)
        {
            var ordinal = reader.GetOrdinal(name);

            return reader.IsDBNull(ordinal)
                ? null
                : reader.GetDateTime(ordinal);
        }
    }
}

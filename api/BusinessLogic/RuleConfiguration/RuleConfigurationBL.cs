using api.DataAccess.RuleConfiguration;
using api.Models.RuleConfiguration;

namespace api.BusinessLogic.RuleConfiguration
{
    public class RuleConfigurationBL : IRuleConfigurationBL
    {
        private readonly IRuleConfigurationDAL _dataAccess;
        private readonly ILogger<RuleConfigurationBL> _logger;

        public RuleConfigurationBL(
            IRuleConfigurationDAL dataAccess,
            ILogger<RuleConfigurationBL> logger)
        {
            _dataAccess = dataAccess;
            _logger = logger;
        }

        public async Task<List<RuleDefinition>> GetRulesAsync()
        {
            try
            {
                return await _dataAccess.GetRulesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while getting rules in business logic.");
                throw;
            }
        }

        public async Task<RuleDefinition?> GetRuleAsync(int ruleId)
        {
            try
            {
                ValidateRuleId(ruleId);
                return await _dataAccess.GetRuleAsync(ruleId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while getting rule {RuleId} in business logic.", ruleId);
                throw;
            }
        }

        public async Task<int> CreateRuleAsync(CreateRuleRequest request)
        {
            try
            {
                Validate(
                    request.RuleId,
                    request.RuleName,
                    request.Priority,
                    request.Conditions);

                return await _dataAccess.CreateRuleAsync(request);
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
                Validate(
                    request.RuleId,
                    request.RuleName,
                    request.Priority,
                    request.Conditions);

                return await _dataAccess.UpdateRuleAsync(request);
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
                ValidateRuleId(ruleId);
                return await _dataAccess.DeleteRuleAsync(ruleId);
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
                return await _dataAccess.GetActiveFieldsAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while getting active rule fields.");
                throw;
            }
        }

        private static void Validate(
            int ruleId,
            string ruleName,
            int priority,
            List<RuleConditionRequest>? conditions)
        {
            ValidateRuleId(ruleId);

            if (string.IsNullOrWhiteSpace(ruleName))
            {
                throw new ArgumentException(
                    "Rule name is required.",
                    nameof(ruleName));
            }

            if (priority < 1)
            {
                throw new ArgumentException(
                    "Priority must be greater than zero.",
                    nameof(priority));
            }

            if (conditions is null || conditions.Count == 0)
            {
                throw new ArgumentException(
                    "At least one condition is required.",
                    nameof(conditions));
            }

            foreach (var condition in conditions)
            {
                if (condition.FieldId <= 0)
                {
                    throw new ArgumentException(
                        "Each condition must have a valid field.",
                        nameof(conditions));
                }

                if (string.IsNullOrWhiteSpace(condition.Operator))
                {
                    throw new ArgumentException(
                        "Each condition must have an operator.",
                        nameof(conditions));
                }

                if (string.IsNullOrWhiteSpace(condition.Value))
                {
                    throw new ArgumentException(
                        "Each condition must have a value.",
                        nameof(conditions));
                }

                if (condition.LogicalOperator is not ("AND" or "OR"))
                {
                    throw new ArgumentException(
                        "Logical operator must be AND or OR.",
                        nameof(conditions));
                }
            }
        }

        private static void ValidateRuleId(int ruleId)
        {
            if (ruleId <= 0)
            {
                throw new ArgumentException(
                    "Rule id must be greater than zero.",
                    nameof(ruleId));
            }
        }
    }
}

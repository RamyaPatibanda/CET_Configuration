using api.Configuration;
using api.DataAccess.RuleConfiguration;
using api.Models.RuleConfiguration;

namespace api.BusinessLogic.RuleConfiguration
{
    public class RuleConfigurationBL : IRuleConfigurationBL
    {
        private readonly IRuleConfigurationDAL _dataAccess;
        private readonly ILogger<RuleConfigurationBL> _logger;
        private readonly IRuleDecisionConfiguration _decisionConfiguration;

        public RuleConfigurationBL(IRuleConfigurationDAL dataAccess, ILogger<RuleConfigurationBL> logger, IRuleDecisionConfiguration decisionConfiguration)
        {
            _dataAccess = dataAccess;
            _logger = logger;
            _decisionConfiguration = decisionConfiguration;
        }

        public async Task<List<RuleDefinition>> GetRulesAsync()
        {
            try { return await _dataAccess.GetRulesAsync(); }
            catch (Exception ex) { _logger.LogError(ex, "Error while getting rules in business logic."); throw; }
        }

        public async Task<RuleDefinition?> GetRuleAsync(int ruleId)
        {
            try { ValidateRuleId(ruleId); return await _dataAccess.GetRuleAsync(ruleId); }
            catch (Exception ex) { _logger.LogError(ex, "Error while getting rule {RuleId} in business logic.", ruleId); throw; }
        }

        public async Task<int> CreateRuleAsync(CreateRuleRequest request)
        {
            try { Validate(request.RuleId, request.RuleName, request.Priority, request.DecisionAreaCode, request.Outcome, request.Conditions, request.DecisionRows); return await _dataAccess.CreateRuleAsync(request); }
            catch (Exception ex) { _logger.LogError(ex, "Error while creating rule {RuleName}.", request.RuleName); throw; }
        }

        public async Task<bool> UpdateRuleAsync(UpdateRuleRequest request)
        {
            try { Validate(request.RuleId, request.RuleName, request.Priority, request.DecisionAreaCode, request.Outcome, request.Conditions, request.DecisionRows); return await _dataAccess.UpdateRuleAsync(request); }
            catch (Exception ex) { _logger.LogError(ex, "Error while updating rule {RuleId}.", request.RuleId); throw; }
        }

        public async Task<bool> DeleteRuleAsync(int ruleId)
        {
            try { ValidateRuleId(ruleId); return await _dataAccess.DeleteRuleAsync(ruleId); }
            catch (Exception ex) { _logger.LogError(ex, "Error while deleting rule {RuleId} in business logic.", ruleId); throw; }
        }

        public async Task<List<RuleFieldOption>> GetActiveFieldsAsync()
        {
            try { return await _dataAccess.GetActiveFieldsAsync(); }
            catch (Exception ex) { _logger.LogError(ex, "Error while getting active rule fields."); throw; }
        }

        public List<RuleDecisionOption> GetDecisionOptions() => _decisionConfiguration.GetDecisionOptions().ToList();

        public async Task<bool> SetRuleActiveAsync(int ruleId, bool isActive)
        {
            try { ValidateRuleId(ruleId); return await _dataAccess.SetRuleActiveAsync(ruleId, isActive); }
            catch (Exception ex) { _logger.LogError(ex, "Error while changing active state for rule {RuleId}.", ruleId); throw; }
        }

        public async Task ReorderRulesAsync(List<int> ruleIds)
        {
            try
            {
                if (ruleIds is null || ruleIds.Count == 0) throw new ArgumentException("At least one rule is required.", nameof(ruleIds));
                if (ruleIds.Any(ruleId => ruleId <= 0)) throw new ArgumentException("Rule IDs must be greater than zero.", nameof(ruleIds));
                if (ruleIds.Count != ruleIds.Distinct().Count()) throw new ArgumentException("Rule IDs must be unique.", nameof(ruleIds));
                await _dataAccess.ReorderRulesAsync(ruleIds);
            }
            catch (Exception ex) { _logger.LogError(ex, "Error while reordering rules in business logic."); throw; }
        }

        private static void Validate(int ruleId, string ruleName, int priority, string decisionAreaCode, RuleOutcome? outcome, List<RuleConditionRequest>? conditions, List<RuleDecisionRequest>? decisionRows)
        {
            ValidateRuleId(ruleId);
            if (string.IsNullOrWhiteSpace(ruleName)) throw new ArgumentException("Rule name is required.", nameof(ruleName));
            if (priority < 1) throw new ArgumentException("Priority must be greater than zero.", nameof(priority));
            var allowedAreas = new[] { "CANDIDATE_QUALIFICATION", "SPECIAL_RESERVATION_ELIGIBILITY", "PREFERENCE_EVALUATION", "SEAT_ELIGIBILITY", "SEAT_ALLOCATION", "BETTERMENT", "CONVERSION" };
            if (string.IsNullOrWhiteSpace(decisionAreaCode) || !allowedAreas.Contains(decisionAreaCode))
                throw new ArgumentException("A valid decision area is required.", nameof(decisionAreaCode));
            outcome ??= new RuleOutcome();
            if (decisionAreaCode == "SEAT_ALLOCATION" && (decisionRows is null || decisionRows.Count == 0))
                throw new ArgumentException("At least one decision row is required for Seat Allocation rules.", nameof(decisionRows));

            foreach (var decision in decisionRows ?? [])
            {
                if (string.IsNullOrWhiteSpace(decision.DecisionName))
                    throw new ArgumentException("Each decision row must have a name.", nameof(decisionRows));
                if (decision.Conditions is null || decision.Conditions.Count == 0)
                    throw new ArgumentException($"Decision '{decision.DecisionName}' must contain at least one condition.", nameof(decisionRows));
                if (decision.Results is null || decision.Results.Count == 0)
                    throw new ArgumentException($"Decision '{decision.DecisionName}' must contain at least one result.", nameof(decisionRows));
                if (decision.DecisionOrder < 1)
                    throw new ArgumentException("Decision order must be greater than zero.", nameof(decisionRows));
                foreach (var condition in decision.Conditions)
                {
                    if (string.IsNullOrWhiteSpace(condition.OperandType) ||
                        condition.OperandType is not ("FIELD" or "CONTEXT"))
                        throw new ArgumentException("Decision condition operand type must be FIELD or CONTEXT.", nameof(decisionRows));
                    if (string.IsNullOrWhiteSpace(condition.OperandKey) ||
                        string.IsNullOrWhiteSpace(condition.Operator) ||
                        string.IsNullOrWhiteSpace(condition.Value))
                        throw new ArgumentException($"Decision '{decision.DecisionName}' contains an incomplete condition.", nameof(decisionRows));
                }
                foreach (var result in decision.Results)
                {
                    if (string.IsNullOrWhiteSpace(result.ResultKey) ||
                        string.IsNullOrWhiteSpace(result.ResultValue))
                        throw new ArgumentException($"Decision '{decision.DecisionName}' contains an incomplete result.", nameof(decisionRows));
                }
            }
            if (conditions is null || conditions.Count == 0) throw new ArgumentException("At least one condition is required.", nameof(conditions));

            var groupOrders = conditions.Select(c => c.GroupOrder).Distinct().OrderBy(o => o).ToList();
            if (!groupOrders.Any() || groupOrders.First() != 1 || groupOrders.Select((order, index) => order == index + 1).Any(valid => !valid))
                throw new ArgumentException("Condition groups must have sequential group order.", nameof(conditions));

            var conditionOrders = conditions.Select(c => c.ConditionOrder).OrderBy(o => o).ToList();
            if (conditionOrders.Any(o => o < 1) || conditionOrders.Select((order, index) => order == index + 1).Any(valid => !valid))
                throw new ArgumentException("Condition order must be sequential.", nameof(conditions));

            foreach (var condition in conditions)
            {
                if (condition.FieldId <= 0) throw new ArgumentException("Each condition must have a valid field.", nameof(conditions));
                if (string.IsNullOrWhiteSpace(condition.Operator)) throw new ArgumentException("Each condition must have an operator.", nameof(conditions));
                if (string.IsNullOrWhiteSpace(condition.Value)) throw new ArgumentException("Each condition must have a value.", nameof(conditions));
                if (condition.ConditionLogicalOperator is not ("AND" or "OR")) throw new ArgumentException("Condition logical operator must be AND or OR.", nameof(conditions));
                if (condition.GroupOrder < 1 || condition.ConditionOrder < 1) throw new ArgumentException("Condition and group order must be greater than zero.", nameof(conditions));
            }
        }

        private static void ValidateRuleId(int ruleId)
        {
            if (ruleId <= 0) throw new ArgumentException("Rule id must be greater than zero.", nameof(ruleId));
        }
    }
}

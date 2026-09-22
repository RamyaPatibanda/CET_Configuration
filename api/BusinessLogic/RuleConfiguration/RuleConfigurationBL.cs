using api.Configuration;
using api.DataAccess.RuleConfiguration;
using api.Models.RuleConfiguration;

namespace api.BusinessLogic.RuleConfiguration
{
    public class RuleConfigurationBL : IRuleConfigurationBL
    {
        private readonly IRuleConfigurationDAL _dataAccess;
        private readonly ILogger<RuleConfigurationBL> _logger;
        private readonly IRuleDecisionConfiguration _branchConfiguration;

        public RuleConfigurationBL(IRuleConfigurationDAL dataAccess, ILogger<RuleConfigurationBL> logger, IRuleDecisionConfiguration branchConfiguration)
        {
            _dataAccess = dataAccess;
            _logger = logger;
            _branchConfiguration = branchConfiguration;
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
            try { Validate(request.RuleId, request.RuleName, request.Priority, request.DecisionAreaCode, request.Outcome, request.Conditions, request.Branches); return await _dataAccess.CreateRuleAsync(request); }
            catch (Exception ex) { _logger.LogError(ex, "Error while creating rule {RuleName}.", request.RuleName); throw; }
        }

        public async Task<bool> UpdateRuleAsync(UpdateRuleRequest request)
        {
            try { Validate(request.RuleId, request.RuleName, request.Priority, request.DecisionAreaCode, request.Outcome, request.Conditions, request.Branches); return await _dataAccess.UpdateRuleAsync(request); }
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

        public List<RuleDecisionOption> GetDecisionOptions() => _branchConfiguration.GetDecisionOptions().ToList();

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

        private static void Validate(
            int ruleId,
            string ruleName,
            int priority,
            string decisionAreaCode,
            RuleOutcome? outcome,
            List<RuleConditionRequest>? conditions,
            List<RuleBranchRequest>? branches)
        {
            ValidateRuleId(ruleId);

            if (string.IsNullOrWhiteSpace(ruleName))
                throw new ArgumentException("Rule name is required.", nameof(ruleName));

            if (priority < 1)
                throw new ArgumentException("Priority must be greater than zero.", nameof(priority));

            var allowedAreas = new[]
            {
                "CANDIDATE_QUALIFICATION",
                "SPECIAL_RESERVATION_ELIGIBILITY",
                "PREFERENCE_EVALUATION",
                "SEAT_ELIGIBILITY",
                "SEAT_ALLOCATION",
                "BETTERMENT",
                "CONVERSION"
            };

            if (string.IsNullOrWhiteSpace(decisionAreaCode) || !allowedAreas.Contains(decisionAreaCode))
                throw new ArgumentException("A valid decision area is required.", nameof(decisionAreaCode));

            var ruleBranches = branches ?? new List<RuleBranchRequest>();
            if (ruleBranches.Count == 0)
                throw new ArgumentException("At least one IF branch is required.", nameof(branches));

            var elseBranches = ruleBranches.Where(b => b.IsElse).ToList();
            if (elseBranches.Count > 1)
                throw new ArgumentException("Only one ELSE branch is allowed.", nameof(branches));

            if (elseBranches.Count == 1 && elseBranches[0].BranchOrder != ruleBranches.Count)
                throw new ArgumentException("The ELSE branch must be the last branch.", nameof(branches));

            var branchOrders = ruleBranches.Select(b => b.BranchOrder).OrderBy(o => o).ToList();
            if (branchOrders.Any(o => o < 1) ||
                branchOrders.Select((order, index) => order == index + 1).Any(valid => !valid))
                throw new ArgumentException("Branch order must be sequential.", nameof(branches));

            foreach (var branch in ruleBranches)
            {
                if (string.IsNullOrWhiteSpace(branch.BranchName))
                    throw new ArgumentException("Each branch must have a name.", nameof(branches));

                if (string.IsNullOrWhiteSpace(branch.AllocationType))
                    throw new ArgumentException($"Branch '{branch.BranchName}' must have an allocation type.", nameof(branches));

                if (branch.Sequence < 1)
                    throw new ArgumentException($"Branch '{branch.BranchName}' must have a sequence greater than zero.", nameof(branches));

                if (branch.IsElse)
                {
                    if (branch.Conditions is { Count: > 0 })
                        throw new ArgumentException("An ELSE branch cannot contain conditions.", nameof(branches));

                    continue;
                }

                if (branch.Conditions is null || branch.Conditions.Count == 0)
                    throw new ArgumentException($"IF branch '{branch.BranchName}' must have at least one condition.", nameof(branches));

                ValidateBranchConditions(branch.Conditions, branch.BranchName);
            }

            // Root-level conditions are retained only for compatibility with older rules.
            // The branch conditions are the source of truth for the new single-rule model.
            _ = conditions;
            _ = outcome;
        }

        private static void ValidateBranchConditions(List<RuleConditionRequest> conditions, string branchName)
        {
            var groupOrders = conditions.Select(c => c.GroupOrder).Distinct().OrderBy(o => o).ToList();
            if (!groupOrders.Any() || groupOrders.First() != 1 ||
                groupOrders.Select((order, index) => order == index + 1).Any(valid => !valid))
                throw new ArgumentException($"Condition groups in branch '{branchName}' must be sequential.", nameof(conditions));

            var conditionOrders = conditions.Select(c => c.ConditionOrder).OrderBy(o => o).ToList();
            if (conditionOrders.Any(o => o < 1) ||
                conditionOrders.Select((order, index) => order == index + 1).Any(valid => !valid))
                throw new ArgumentException($"Condition order in branch '{branchName}' must be sequential.", nameof(conditions));

            foreach (var condition in conditions)
            {
                if (condition.FieldId <= 0)
                    throw new ArgumentException($"Branch '{branchName}' contains an invalid field.", nameof(conditions));

                if (string.IsNullOrWhiteSpace(condition.Operator))
                    throw new ArgumentException($"Branch '{branchName}' contains a condition without an operator.", nameof(conditions));

                if (string.IsNullOrWhiteSpace(condition.Value))
                    throw new ArgumentException($"Branch '{branchName}' contains a condition without a value.", nameof(conditions));

                if (condition.ConditionLogicalOperator is not ("AND" or "OR"))
                    throw new ArgumentException($"Branch '{branchName}' condition logical operator must be AND or OR.", nameof(conditions));

                if (condition.GroupOrder < 1 || condition.ConditionOrder < 1)
                    throw new ArgumentException($"Branch '{branchName}' condition order must be greater than zero.", nameof(conditions));
            }
        }

        private static void ValidateRuleId(int ruleId)
        {
            if (ruleId <= 0) throw new ArgumentException("Rule id must be greater than zero.", nameof(ruleId));
        }
    }
}

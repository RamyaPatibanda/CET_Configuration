using api.Models.RuleConfiguration;

namespace api.DataAccess.RuleConfiguration
{
    public interface IRuleConfigurationDAL
    {
        Task<List<RuleDefinition>> GetRulesAsync();
        Task<RuleDefinition?> GetRuleAsync(int ruleId);
        Task<int> CreateRuleAsync(CreateRuleRequest request);
        Task<bool> UpdateRuleAsync(UpdateRuleRequest request);
        Task<bool> DeleteRuleAsync(int ruleId);
        Task<List<RuleFieldOption>> GetActiveFieldsAsync();
        Task<bool> SetRuleActiveAsync(int ruleId, bool isActive);
        Task ReorderRulesAsync(List<int> ruleIds);
    }
}

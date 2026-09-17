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
    }
}

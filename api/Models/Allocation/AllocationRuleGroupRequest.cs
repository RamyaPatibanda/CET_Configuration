namespace api.Models.Allocation;

public sealed class AllocationRuleGroupRequest
{
    public string Type { get; set; } = string.Empty;
    public List<int> RuleIds { get; set; } = [];
}

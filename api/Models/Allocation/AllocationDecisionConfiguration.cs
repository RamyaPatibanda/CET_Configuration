namespace api.Models.Allocation;

public sealed class AllocationDecisionConfiguration
{
    public int AllocationDecisionId { get; set; }
    public string StepCode { get; set; } = string.Empty;
    public string DecisionAreaCode { get; set; } = string.Empty;
    public int RuleId { get; set; }
    public int DisplayOrder { get; set; }
    public string AllocatedType { get; set; } = string.Empty;
    public string VacancyType { get; set; } = string.Empty;
    public string ResultJson { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public sealed class SaveAllocationDecisionRequest
{
    public string StepCode { get; set; } = string.Empty;
    public string DecisionAreaCode { get; set; } = string.Empty;
    public List<AllocationDecisionConfigurationItem> Decisions { get; set; } = [];
}

public sealed class AllocationDecisionConfigurationItem
{
    public int RuleId { get; set; }
    public int DisplayOrder { get; set; }
    public string AllocatedType { get; set; } = string.Empty;
    public string VacancyType { get; set; } = string.Empty;
    public string ResultJson { get; set; } = string.Empty;
}

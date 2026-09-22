namespace api.Models.Allocation;

public sealed class AllocationRunRequest
{
    public Guid? AllocationRunId { get; set; }
    public string AllocationRunName { get; set; } = string.Empty;
    public int CapRound { get; set; }
    public string AllocationStep { get; set; } = AllocationConfiguration.Step0;
    // Step-specific rule selections. The Allocation Run never defines conditions; it only selects configured rules.
    public List<int> CandidateEligibilityRuleIds { get; set; } = [];
    public List<int> SequenceRuleIds { get; set; } = [];

    // Retained for backward compatibility with older saved drafts/clients.
    public List<AllocationRuleGroupRequest> RuleGroups { get; set; } = [];
}

public sealed class AllocationRunResponse
{
    public AllocationRun Run { get; set; } = new();
    public IReadOnlyList<AllocationDecision> Decisions { get; set; } = [];
    public IReadOnlyList<AllocationStageResult> Stages { get; set; } = [];
}

public sealed class AllocationStageResult
{
    public string StageCode { get; set; } = string.Empty;
    public int Sequence { get; set; }
    public int CandidateCountBefore { get; set; }
    public int CandidateCountAfter { get; set; }
    public int DecisionsCreated { get; set; }
    public string Status { get; set; } = "Completed";
}

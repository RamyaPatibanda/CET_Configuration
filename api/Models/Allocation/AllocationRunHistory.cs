namespace api.Models.Allocation;

public sealed class AllocationRunHistory
{
    public Guid AllocationRunId { get; set; }
    public string AllocationRunName { get; set; } = string.Empty;
    public int CapRound { get; set; }
    public string AllocationStep { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string RuleGroupsJson { get; set; } = "[]";
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? StartedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public int CandidateCount { get; set; }
    public int DecisionCount { get; set; }
    public string ErrorMessage { get; set; } = string.Empty;\n    public int? RunByUserId { get; set; }\n    public string RunBy { get; set; } = string.Empty;
}

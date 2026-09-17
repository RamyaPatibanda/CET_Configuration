namespace api.Models.Allocation;

public sealed class AllocationRunRequest
{
    public int CapRound { get; set; }
    public string RuleSetVersionId { get; set; } = "draft-runtime";
    public List<AllocationCandidate> Candidates { get; set; } = [];
    public List<SeatInventory> Seats { get; set; } = [];
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

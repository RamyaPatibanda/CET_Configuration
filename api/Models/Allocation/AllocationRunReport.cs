namespace api.Models.Allocation;

public sealed class AllocationRunReport
{
    public int TotalCandidatesProcessed { get; set; }
    public int TotalCandidatesAllocated { get; set; }
    public int TotalCandidatesNotAllocated { get; set; }

    public int PhAllocated { get; set; }
    public int DefenceAllocated { get; set; }
    public int OrphanAllocated { get; set; }

    public int GeneralAllocated { get; set; }
    public int FemaleAllocated { get; set; }

    public IReadOnlyList<AllocationStageReport> Stages { get; set; } = [];
}

public sealed class AllocationStageReport
{
    public string StageCode { get; set; } = string.Empty;
    public int CandidatesProcessed { get; set; }
    public int CandidatesAllocated { get; set; }
    public int CandidatesNotAllocated { get; set; }
    public int DecisionsCreated { get; set; }
    public string Status { get; set; } = "Completed";
}
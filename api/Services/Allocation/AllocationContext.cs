using api.Models.Allocation;

namespace api.Services.Allocation;

public sealed class AllocationContext
{
    public AllocationRun Run { get; init; } = new();
    public IList<AllocationCandidate> Candidates { get; init; } = [];
    public IList<SeatInventory> Seats { get; init; } = [];
    public IReadOnlyDictionary<string, IReadOnlyList<AllocationRule>> RuleGroups { get; init; }
        = new Dictionary<string, IReadOnlyList<AllocationRule>>(StringComparer.OrdinalIgnoreCase);
    public IList<AllocationDecision> Decisions { get; } = [];
    public IList<AllocationStageResult> StageResults { get; } = [];
}


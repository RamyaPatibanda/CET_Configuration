using api.Models.Allocation;

namespace api.Services.Allocation;

public sealed class AllocationEngine
{
    private readonly IReadOnlyList<IAllocationStage> _stages;

    public AllocationEngine(IEnumerable<IAllocationStage> stages)
    {
        _stages = stages.OrderBy(s => StageSequence(s.StageCode)).ToList();
    }

    public async Task<AllocationContext> RunAsync(
        AllocationRun run,
        IEnumerable<AllocationCandidate> candidates,
        IEnumerable<SeatInventory> seats,
        CancellationToken cancellationToken = default)
    {
        var context = new AllocationContext
        {
            Run = run,
            Candidates = candidates.ToList(),
            Seats = seats.ToList()
        };

        run.Status = AllocationRunStatus.Running;
        run.StartedAtUtc = DateTime.UtcNow;

        try
        {
            foreach (var stage in _stages)
            {
                cancellationToken.ThrowIfCancellationRequested();
                await stage.ExecuteAsync(context, cancellationToken);
            }

            run.Status = AllocationRunStatus.Completed;
            run.CompletedAtUtc = DateTime.UtcNow;
            return context;
        }
        catch
        {
            run.Status = AllocationRunStatus.Failed;
            run.CompletedAtUtc = DateTime.UtcNow;
            throw;
        }
    }

    private static int StageSequence(string stageCode) => stageCode switch
    {
        "CANDIDATE_QUALIFICATION" => 10,
        "SPECIAL_RESERVATION" => 20,
        "SEAT_ALLOCATION" => 30,
        "CONVERSION" => 40,
        "BETTERMENT" => 50,
        "RECONCILIATION" => 60,
        _ => 100
    };
}

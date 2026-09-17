using api.Models.Allocation;

namespace api.Services.Allocation;

public sealed class CandidateQualificationStage : IAllocationStage
{
    public string StageCode => "CANDIDATE_QUALIFICATION";

    public Task ExecuteAsync(AllocationContext context, CancellationToken cancellationToken = default)
    {
        var eligible = context.Candidates
            .Where(candidate =>
                candidate.MeritNo > 0 &&
                candidate.IsOms.Equals("N", StringComparison.OrdinalIgnoreCase) &&
                candidate.IsNri.Equals("N", StringComparison.OrdinalIgnoreCase) &&
                candidate.Preferences.Count > 0)
            .OrderBy(candidate => candidate.MeritNo)
            .ToList();

        context.Candidates.Clear();
        foreach (var candidate in eligible)
        {
            cancellationToken.ThrowIfCancellationRequested();
            context.Candidates.Add(candidate);
        }

        return Task.CompletedTask;
    }
}

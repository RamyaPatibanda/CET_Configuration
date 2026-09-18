using api.Models.Allocation;

namespace api.Services.Allocation;

public sealed class CandidateQualificationStage : IAllocationStage
{
    private readonly IRuleEvaluator _ruleEvaluator;

    public CandidateQualificationStage()
    {
        _ruleEvaluator = new RuleEvaluator();
    }

    public string StageCode => "CANDIDATE_QUALIFICATION";

    public Task ExecuteAsync(AllocationContext context, CancellationToken cancellationToken = default)
    {
        context.RuleGroups.TryGetValue(
            AllocationConfiguration.CandidateQualification,
            out var configuredRules);

        var eligible = context.Candidates
            .Where(candidate =>
                candidate.MeritNo > 0 &&
                candidate.IsOms.Equals("N", StringComparison.OrdinalIgnoreCase) &&
                candidate.IsNri.Equals("N", StringComparison.OrdinalIgnoreCase) &&
                candidate.Preferences.Count > 0)
            .Where(candidate =>
                configuredRules is null ||
                configuredRules.Count == 0 ||
                configuredRules.Any(rule => _ruleEvaluator.Matches(rule, candidate)))
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

using api.Models.Allocation;

namespace api.Services.Allocation;

/// <summary>
/// Step 0 evaluates only the rules explicitly assigned to the
/// SPECIAL_RESERVATION_ELIGIBILITY decision area.
/// Candidate qualification is handled by CandidateQualificationStage.
/// Preference traversal, seat mutation and betterment remain engine behavior
/// until their corresponding decision areas are implemented.
/// </summary>
public sealed class Step0AllocationStage : IAllocationStage
{
    private readonly RuleEvaluator _ruleEvaluator;

    public Step0AllocationStage(RuleEvaluator ruleEvaluator)
    {
        _ruleEvaluator = ruleEvaluator;
    }

    public string StageCode => "SPECIAL_RESERVATION";

    public Task ExecuteAsync(AllocationContext context, CancellationToken cancellationToken = default)
    {
        if (!context.RuleGroups.TryGetValue(
                AllocationConfiguration.SpecialReservationEligibility,
                out var configuredRules) ||
            configuredRules.Count == 0)
        {
            return Task.CompletedTask;
        }

        foreach (var candidate in context.Candidates.OrderBy(c => c.MeritNo))
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (context.Decisions.Any(d =>
                    d.CandidateId == candidate.CandidateId &&
                    d.Status == "Allocated"))
            {
                continue;
            }

            foreach (var rule in configuredRules)
            {
                if (!_ruleEvaluator.Matches(rule, candidate))
                    continue;

                context.Decisions.Add(new AllocationDecision
                {
                    AllocationRunId = context.Run.AllocationRunId,
                    CandidateId = candidate.CandidateId,
                    CategoryId = candidate.EffectiveCategoryId,
                    StepId = 0,
                    DecisionArea = AllocationConfiguration.SpecialReservationEligibility,
                    RuleCode = rule.Code,
                    Status = "Qualified"
                });

                break;
            }
        }

        return Task.CompletedTask;
    }
}

using api.Models.Allocation;

namespace api.Services.Allocation;

/// <summary>
/// Step 0 only evaluates the configured special-reservation rules.
/// Business conditions are supplied by Rule Configuration; this stage does not contain
/// candidate-specific conditions copied from the legacy stored procedures.
/// </summary>
public sealed class Step0AllocationStage : IAllocationStage
{
    private readonly RuleEvaluator _ruleEvaluator;
    private readonly IReadOnlyList<AllocationRule> _configuredRules;

    public Step0AllocationStage(
        RuleEvaluator ruleEvaluator,
        ISeatInventory inventory,
        IReadOnlyList<AllocationRule> configuredRules)
    {
        _ruleEvaluator = ruleEvaluator;
        _configuredRules = configuredRules ?? throw new ArgumentNullException(nameof(configuredRules));
    }

    public string StageCode => "SPECIAL_RESERVATION";

    public Task ExecuteAsync(
        AllocationContext context,
        CancellationToken cancellationToken = default)
    {
        foreach (var candidate in context.Candidates.OrderBy(c => c.MeritNo))
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (context.Decisions.Any(d =>
                    d.CandidateId == candidate.CandidateId &&
                    d.Status == "Allocated"))
            {
                continue;
            }

            foreach (var rule in _configuredRules)
            {
                if (!_ruleEvaluator.Matches(rule, candidate))
                    continue;

                context.Decisions.Add(new AllocationDecision
                {
                    AllocationRunId = context.Run.AllocationRunId,
                    CandidateId = candidate.CandidateId,
                    CategoryId = candidate.EffectiveCategoryId,
                    StepId = 0,
                    RuleCode = rule.Code,
                    Status = "Qualified"
                });

                break;
            }
        }

        return Task.CompletedTask;
    }
}

using api.Models.Allocation;

namespace api.Services.Allocation;

/// <summary>
/// Step 0 orchestration only. Business conditions are supplied by Rule Configuration.
/// </summary>
public sealed class Step0AllocationStage
{
    private readonly RuleEvaluator _ruleEvaluator;

    public Step0AllocationStage(RuleEvaluator ruleEvaluator) => _ruleEvaluator = ruleEvaluator;

    public IReadOnlyList<AllocationDecision> Execute(
        IReadOnlyList<AllocationCandidate> candidates,
        IReadOnlyList<AllocationRule> configuredRules)
    {
        ArgumentNullException.ThrowIfNull(candidates);
        ArgumentNullException.ThrowIfNull(configuredRules);

        // No Step 0 business conditions belong here. They come from Rule Configuration.
        var decisions = new List<AllocationDecision>();
        foreach (var candidate in candidates)
        {
            foreach (var rule in configuredRules)
            {
                if (!_ruleEvaluator.Evaluate(rule, candidate)) continue;
                decisions.Add(new AllocationDecision
                {
                    CandidateId = candidate.CandidateId,
                    RuleCode = rule.Code,
                    StageCode = rule.StageCode,
                    Decision = "Qualified"
                });
                break;
            }
        }
        return decisions;
    }
}

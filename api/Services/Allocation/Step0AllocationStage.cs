using api.Models.Allocation;

namespace api.Services.Allocation;

/// <summary>
/// Step 0 orchestration only. Business conditions are supplied by Rule Configuration;
/// this stage must not contain hardcoded candidate eligibility rules.
/// </summary>
public sealed class Step0AllocationStage
{
    private readonly RuleEvaluator _ruleEvaluator;

    public Step0AllocationStage(RuleEvaluator ruleEvaluator)
    {
        _ruleEvaluator = ruleEvaluator;
    }

    public IReadOnlyList<AllocationDecision> Execute(
        IReadOnlyList<AllocationCandidate> candidates,
        IReadOnlyList<AllocationRule> configuredRules)
    {
        if (candidates is null)
            throw new ArgumentNullException(nameof(candidates));

        if (configuredRules is null)
            throw new ArgumentNullException(nameof(configuredRules));

        var decisions = new List<AllocationDecision>();

        foreach (var candidate in candidates)
        {
            foreach (var rule in configuredRules)
            {
                if (!string.Equals(rule.StageCode, "SPECIAL_RESERVATION", StringComparison.OrdinalIgnoreCase))
                    continue;

                if (_ruleEvaluator.Evaluate(rule, candidate))
                {
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
        }

        return decisions;
    }
}

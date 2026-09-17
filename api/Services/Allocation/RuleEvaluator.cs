using api.Models.Allocation;

namespace api.Services.Allocation;

public sealed record RuleCondition(string Field, string Operator, string Value);

public sealed class AllocationRule
{
    public string Code { get; set; } = string.Empty;
    public string StageCode { get; set; } = string.Empty;
    public string LogicalOperator { get; set; } = "AND";
    public List<RuleCondition> Conditions { get; set; } = [];
}

public interface IRuleEvaluator
{
    bool Matches(AllocationRule rule, AllocationCandidate candidate);
}

public sealed class RuleEvaluator : IRuleEvaluator
{
    public bool Matches(AllocationRule rule, AllocationCandidate candidate)
    {
        if (rule.Conditions.Count == 0)
            return false;

        var results = rule.Conditions.Select(c => Evaluate(c, candidate)).ToList();
        return rule.LogicalOperator.Equals("OR", StringComparison.OrdinalIgnoreCase)
            ? results.Any(x => x)
            : results.All(x => x);
    }

    private static bool Evaluate(RuleCondition condition, AllocationCandidate candidate)
    {
        var actual = GetFieldValue(condition.Field, candidate);
        return condition.Operator.ToUpperInvariant() switch
        {
            "EQUALS" or "=" => string.Equals(actual, condition.Value, StringComparison.OrdinalIgnoreCase),
            "NOT_EQUALS" or "!=" => !string.Equals(actual, condition.Value, StringComparison.OrdinalIgnoreCase),
            "GREATER_THAN" or ">" => CompareNumbers(actual, condition.Value, (a, b) => a > b),
            "GREATER_THAN_OR_EQUAL" or ">=" => CompareNumbers(actual, condition.Value, (a, b) => a >= b),
            "LESS_THAN" or "<" => CompareNumbers(actual, condition.Value, (a, b) => a < b),
            "LESS_THAN_OR_EQUAL" or "<=" => CompareNumbers(actual, condition.Value, (a, b) => a <= b),
            _ => false
        };
    }

    private static string? GetFieldValue(string field, AllocationCandidate c) => field switch
    {
        "IsOMS" => c.IsOms,
        "IsNRI" => c.IsNri,
        "FinalIsPh" => c.IsPh,
        "FinalIsExServicemen" => c.IsExServicemen,
        "FinalIsOrphan" => c.IsOrphan,
        "IsEligibleForOpen" => c.IsEligibleForOpen,
        "Gender" => c.Gender,
        "CategoryID" => c.EffectiveCategoryId.ToString(),
        "MeritNo" => c.MeritNo.ToString(),
        "ExServicemenMeritNo" => c.ExServicemenMeritNo.ToString(),
        _ => null
    };

    private static bool CompareNumbers(string? actual, string expected, Func<decimal, decimal, bool> comparison)
        => decimal.TryParse(actual, out var a) && decimal.TryParse(expected, out var b) && comparison(a, b);
}

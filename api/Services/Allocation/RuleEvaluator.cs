using api.Models.Allocation;

namespace api.Services.Allocation;

public sealed record RuleCondition(
    string Field,
    string Operator,
    string Value,
    string ConditionLogicalOperator = "AND",
    int GroupOrder = 1,
    int ConditionOrder = 0);

public sealed class AllocationRule
{
    public string Code { get; set; } = string.Empty;
    public string StageCode { get; set; } = string.Empty;
    public string LogicalOperator { get; set; } = "AND";
    public string AllocatedType { get; set; } = string.Empty;
    public string VacancyType { get; set; } = string.Empty;
    public string SeatCategory { get; set; } = string.Empty;
    public string ReservationType { get; set; } = string.Empty;
    public string CandidateStatus { get; set; } = string.Empty;
    public string PreferenceMode { get; set; } = string.Empty;
    public bool? AllowBetterment { get; set; }
    public int DisplayOrder { get; set; }
    public List<RuleCondition> Conditions { get; set; } = [];
    public List<AllocationRuleBranch> Branches { get; set; } = [];
    public int SequenceId { get; set; }
}

public interface IRuleEvaluator
{
    bool Matches(AllocationRule rule, AllocationCandidate candidate);
    bool Matches(AllocationRule rule, IReadOnlyDictionary<string, string?> values);

    bool MatchesConditions(
        IReadOnlyList<RuleCondition> conditions,
        IReadOnlyDictionary<string, string?> values);
}

public sealed class AllocationRuleBranch
{
    public int BranchOrder { get; set; }
    public string BranchName { get; set; } = string.Empty;
    public string AllocationType { get; set; } = string.Empty;
    public string VacancySource { get; set; } = string.Empty;
    public string VacancyType { get; set; } = string.Empty;
    public int Sequence { get; set; }
    public bool IsElse { get; set; }
    public List<RuleCondition> Conditions { get; set; } = [];
}

public sealed class RuleEvaluator : IRuleEvaluator
{
    public bool Matches(AllocationRule rule, AllocationCandidate candidate)
    {
        if (rule.Conditions.Count == 0)
            return true;

        var groups = rule.Conditions
            .GroupBy(condition => condition.GroupOrder)
            .OrderBy(group => group.Key)
            .ToList();

        // Conditions inside a group use the logical operator defined by the
        // first condition in that group. Groups are combined with AND.
        // This represents: A AND B AND (C OR D OR E).
        return groups.All(group => EvaluateGroup(group.ToList(), BuildCandidateValues(candidate)));
    }

    public bool Matches(AllocationRule rule, IReadOnlyDictionary<string, string?> values)
    {
        if (rule.Conditions.Count == 0) return true;
        var groups = rule.Conditions.GroupBy(c => c.GroupOrder).OrderBy(g => g.Key).ToList();
        return groups.All(group => EvaluateGroup(group.ToList(), values));
    }

    public bool MatchesConditions(
        IReadOnlyList<RuleCondition> conditions,
        IReadOnlyDictionary<string, string?> values)
    {
        if (conditions.Count == 0)
            return false;

        var groups = conditions
            .GroupBy(condition => condition.GroupOrder)
            .OrderBy(group => group.Key)
            .ToList();

        return groups.All(group => EvaluateGroup(group.ToList(), values));
    }

    private static bool EvaluateGroup(
        IReadOnlyList<RuleCondition> conditions,
        IReadOnlyDictionary<string, string?> values)
    {
        if (conditions.Count == 0)
            return false;

        var results = conditions
            .OrderBy(condition => condition.ConditionOrder)
            .Select(condition => Evaluate(condition, values))
            .ToList();

        var logicalOperator = conditions
            .OrderBy(condition => condition.ConditionOrder)
            .First()
            .ConditionLogicalOperator;

        return logicalOperator.Equals("OR", StringComparison.OrdinalIgnoreCase)
            ? results.Any(result => result)
            : results.All(result => result);
    }

    private static bool Evaluate(RuleCondition condition, IReadOnlyDictionary<string, string?> values)
    {
        values.TryGetValue(condition.Field, out var actual);
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

    private static Dictionary<string, string?> BuildCandidateValues(AllocationCandidate c) => new(StringComparer.OrdinalIgnoreCase)
    {
        ["IsOMS"] = c.IsOms, ["IsNRI"] = c.IsNri, ["FinalIsPh"] = c.IsPh,
        ["FinalIsExServicemen"] = c.IsExServicemen, ["FinalIsOrphan"] = c.IsOrphan,
        ["IsEligibleForOpen"] = c.IsEligibleForOpen, ["Gender"] = c.Gender,
        ["CategoryID"] = c.EffectiveCategoryId.ToString(), ["PreviousCategoryID"] = c.PreviousCategoryId.ToString(),
        ["MeritNo"] = c.MeritNo.ToString(), ["ExServicemenMeritNo"] = c.ExServicemenMeritNo.ToString()
    };

    private static bool CompareNumbers(
        string? actual,
        string expected,
        Func<decimal, decimal, bool> comparison)
        => decimal.TryParse(actual, out var a) &&
           decimal.TryParse(expected, out var b) &&
           comparison(a, b);
}

namespace api.Models.RuleConfiguration
{
    public class CreateRuleRequest
    {
        public int RuleId { get; set; }
        public string RuleName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int Priority { get; set; }
        public bool IsActive { get; set; } = true;
        public string DecisionAreaCode { get; set; } = string.Empty;
        public RuleOutcome Outcome { get; set; } = new();
        public List<RuleConditionRequest> Conditions { get; set; } = new();
    }

    public class UpdateRuleRequest : CreateRuleRequest
    {
    }

    public class RuleConditionRequest
    {
        public int FieldId { get; set; }
        public string ConditionLogicalOperator { get; set; } = "AND";
        public string Operator { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
        public int ConditionOrder { get; set; }
        public int GroupOrder { get; set; } = 1;
    }

    public class RuleOutcome
    {
        public List<RuleOutcomeValue> Values { get; set; } = new();
    }

    public class RuleOutcomeValue
    {
        public string SupportingValue { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
        public string ValueKind { get; set; } = "text";
    }

    public class RuleFieldOption
    {
        public int FieldId { get; set; }
        public string DisplayName { get; set; } = string.Empty;
        public string FieldType { get; set; } = string.Empty;
    }

    public class RuleConfigurationOption
    {
        public string Value { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
    }

    public class RuleDecisionOption
    {
        public string Value { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public List<RuleOutcomeOption> Results { get; set; } = new();
    }

    public class RuleOutcomeOption
    {
        public string SupportingValue { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public string ValueKind { get; set; } = "text";
        public List<RuleConfigurationOption> Values { get; set; } = new();
    }
}

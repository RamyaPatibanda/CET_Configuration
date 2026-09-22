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
        public List<RuleDecisionRequest> DecisionRows { get; set; } = new();
    }

    public class UpdateRuleRequest : CreateRuleRequest { }

    public class RuleConditionRequest
    {
        public int FieldId { get; set; }
        public string FieldName { get; set; } = string.Empty;
        public string ConditionLogicalOperator { get; set; } = "AND";
        public string Operator { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
        public int ConditionOrder { get; set; }
        public int GroupOrder { get; set; } = 1;
    }

    public class RuleDecisionRequest
    {
        public string DecisionName { get; set; } = string.Empty;
        public int DecisionOrder { get; set; }
        public bool IsActive { get; set; } = true;
        public string AllocationType { get; set; } = string.Empty;
        public int Sequence { get; set; }
        public bool IsElse { get; set; }
        public List<RuleConditionRequest> Conditions { get; set; } = new();
    }

    public class RuleOutcome
    {
        public List<RuleOutcomeValue> Values { get; set; } = new();
        public string AllocatedType { get; set; } = string.Empty;
        public string VacancyType { get; set; } = string.Empty;
        public string SeatCategory { get; set; } = string.Empty;
        public string ReservationType { get; set; } = string.Empty;
        public string CandidateStatus { get; set; } = string.Empty;
        public string PreferenceMode { get; set; } = string.Empty;
        public bool? AllowBetterment { get; set; }
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

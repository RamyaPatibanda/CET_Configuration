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
        // Dynamic/configurable outcome values used by the rule editor.
        public List<RuleOutcomeValue> Values { get; set; } = new();

        // Kept for compatibility with the allocation engine's existing contract.
        // Values from the configurable collection are resolved into these properties
        // before an AllocationRule is created.
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


    public class RuleDecisionRequest
    {
        public string DecisionName { get; set; } = string.Empty;
        public int DecisionOrder { get; set; }
        public bool IsActive { get; set; } = true;
        public List<RuleDecisionConditionRequest> Conditions { get; set; } = new();
        public string AllocationType { get; set; } = string.Empty;
        public int Sequence { get; set; }
    }

    public class RuleDecisionConditionRequest
    {
        public string OperandType { get; set; } = "CONTEXT";
        public string OperandKey { get; set; } = string.Empty;
        public string LogicalOperator { get; set; } = "AND";
        public string Operator { get; set; } = "=";
        public string Value { get; set; } = string.Empty;
        public int ConditionOrder { get; set; }
    }

    public class RuleDecisionResultRequest
    {
        public string ResultKey { get; set; } = string.Empty;
        public string ResultValue { get; set; } = string.Empty;
        public string ValueKind { get; set; } = "text";
        public int ResultOrder { get; set; }
    }

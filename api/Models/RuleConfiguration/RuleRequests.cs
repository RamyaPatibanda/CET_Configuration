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
        public string AllocatedType { get; set; } = string.Empty;
        public string VacancyType { get; set; } = string.Empty;
        public string SeatCategory { get; set; } = string.Empty;
        public string ReservationType { get; set; } = string.Empty;
        public string CandidateStatus { get; set; } = string.Empty;
        public string PreferenceMode { get; set; } = string.Empty;
        public bool? AllowBetterment { get; set; }
        public Dictionary<string, string> AdditionalValues { get; set; } = new();
    }

    public class RuleFieldOption
    {
        public int FieldId { get; set; }
        public string DisplayName { get; set; } = string.Empty;
        public string FieldType { get; set; } = string.Empty;
    }
}

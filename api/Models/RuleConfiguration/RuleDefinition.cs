namespace api.Models.RuleConfiguration
{
    public class RuleDefinition
    {
        public int RuleId { get; set; }
        public string RuleName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int Priority { get; set; }
        public bool IsActive { get; set; }
        public string DecisionAreaCode { get; set; } = string.Empty;
        public string OutcomeJson { get; set; } = "{}";
        public int ConditionCount { get; set; }
        public List<RuleCondition> Conditions { get; set; } = new();
        public DateTime? CreatedDate { get; set; }
        public DateTime? ModifiedDate { get; set; }
    }
}

namespace api.Models.RuleConfiguration
{
    public class RuleDefinition
    {
        public int RuleId { get; set; }
        public string RuleName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int Priority { get; set; }
        public bool IsActive { get; set; }
        public List<RuleCondition> Conditions { get; set; } = new();
        public DateTime? CreatedDate { get; set; }
        public DateTime? ModifiedDate { get; set; }
    }

    public class RuleCondition
    {
        public int RuleConditionId { get; set; }
        public int RuleId { get; set; }
        public int FieldId { get; set; }
        public string FieldDisplayName { get; set; } = string.Empty;
        public string FieldType { get; set; } = string.Empty;
        public string LogicalOperator { get; set; } = "AND";
        public string Operator { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
        public int ConditionOrder { get; set; }
    }
}

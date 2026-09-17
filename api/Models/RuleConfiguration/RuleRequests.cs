namespace api.Models.RuleConfiguration
{
    public class CreateRuleRequest
    {
        public int RuleId { get; set; }
        public string RuleName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int Priority { get; set; }
        public bool IsActive { get; set; } = true;
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
        public string GroupLogicalOperator { get; set; } = "AND";
    }

    public class RuleFieldOption
    {
        public int FieldId { get; set; }
        public string FieldName { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string FieldType { get; set; } = string.Empty;
    }
}

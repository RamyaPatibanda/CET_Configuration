namespace api.Models.RuleConfiguration
{
    public class RuleCondition
    {
        public int RuleConditionId { get; set; }
        public int RuleId { get; set; }
        public int FieldId { get; set; }
        public string Operator { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
        public int ConditionOrder { get; set; }
    }
}

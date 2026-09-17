using System.Text.Json.Serialization;

namespace api.Models.RuleConfiguration
{
    public class RuleCondition
    {
        public int RuleConditionId { get; set; }
        public int RuleId { get; set; }
        public int FieldId { get; set; }
        public string FieldDisplayName { get; set; } = string.Empty;
        public string FieldType { get; set; } = string.Empty;
        public string Operator { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
        public int ConditionOrder { get; set; }
        public int GroupOrder { get; set; } = 1;
        public string GroupLogicalOperator { get; set; } = "AND";

        public string ConditionLogicalOperator { get; set; } = "AND";

        [JsonIgnore]
        public string LogicalOperator
        {
            get => ConditionLogicalOperator;
            set => ConditionLogicalOperator = value;
        }
    }
}

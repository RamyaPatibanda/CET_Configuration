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
        public List<RuleDecision> DecisionRows { get; set; } = new();
        public DateTime? CreatedDate { get; set; }
        public DateTime? ModifiedDate { get; set; }
    }

}

    public class RuleDecision
    {
        public int RuleDecisionId { get; set; }
        public int RuleId { get; set; }
        public string DecisionName { get; set; } = string.Empty;
        public int DecisionOrder { get; set; }
        public bool IsActive { get; set; }
        public List<RuleDecisionCondition> Conditions { get; set; } = new();
        public List<RuleDecisionResult> Results { get; set; } = new();
    }

    public class RuleDecisionCondition
    {
        public int RuleDecisionConditionId { get; set; }
        public int RuleDecisionId { get; set; }
        public string OperandType { get; set; } = string.Empty;
        public string OperandKey { get; set; } = string.Empty;
        public string LogicalOperator { get; set; } = "AND";
        public string Operator { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
        public int ConditionOrder { get; set; }
    }

    public class RuleDecisionResult
    {
        public int RuleDecisionResultId { get; set; }
        public int RuleDecisionId { get; set; }
        public string ResultKey { get; set; } = string.Empty;
        public string ResultValue { get; set; } = string.Empty;
        public string ValueKind { get; set; } = "text";
        public int ResultOrder { get; set; }
    }
}
namespace api.Models.RuleConfiguration
{
    public class RuleDefinition
    {
        public int RuleId { get; set; }
        public string RuleName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int Priority { get; set; }
        public bool IsActive { get; set; }
        public string OutcomeJson { get; set; } = "{}";
        public int ConditionCount { get; set; }
        public List<RuleCondition> Conditions { get; set; } = new();
        public List<RuleBranch> Branches { get; set; } = new();
        public DateTime? CreatedDate { get; set; }
        public DateTime? ModifiedDate { get; set; }
        public int? CreatedByUserId { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
    }

    public class RuleBranch
    {
        public int RuleBranchId { get; set; }
        public int RuleId { get; set; }
        public string BranchName { get; set; } = string.Empty;
        public int BranchOrder { get; set; }
        public bool IsActive { get; set; }
        public string AllocationType { get; set; } = string.Empty;
        public int Sequence { get; set; }
        public bool IsElse { get; set; }
        public string OutcomeJson { get; set; } = "{}";
        public List<RuleCondition> Conditions { get; set; } = new();
    }
}

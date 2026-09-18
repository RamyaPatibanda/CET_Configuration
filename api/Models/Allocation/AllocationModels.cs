namespace api.Models.Allocation;

using System.Text.Json.Serialization;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum AllocationRunStatus
{
    Draft,
    Ready,
    Running,
    Completed,
    Failed,
    Cancelled,
    Archived
}

public sealed class AllocationRun
{
    public Guid AllocationRunId { get; set; } = Guid.NewGuid();
    public string AllocationRunName { get; set; } = string.Empty;
    public string RuleSetVersionId { get; set; } = string.Empty;
    public string AllocationStep { get; set; } = AllocationConfiguration.Step0;
    public int CapRound { get; set; }
    public AllocationRunStatus Status { get; set; } = AllocationRunStatus.Draft;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime StartedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
}

public sealed class AllocationStage
{
    public string StageCode { get; set; } = string.Empty;
    public int Sequence { get; set; }
    public bool Enabled { get; set; } = true;
}

public sealed class AllocationCandidate
{
    public long CandidateId { get; set; }
    public int CategoryId { get; set; }
    public int PreviousCategoryId { get; set; }
    public string Gender { get; set; } = string.Empty;
    public string IsOms { get; set; } = "N";
    public string IsNri { get; set; } = "N";
    public string IsPh { get; set; } = "N";
    public string IsExServicemen { get; set; } = "N";
    public string IsOrphan { get; set; } = "N";
    public string IsEligibleForOpen { get; set; } = "N";
    public int MeritNo { get; set; }
    public int ExServicemenMeritNo { get; set; }
    public List<CollegePreference> Preferences { get; set; } = [];
    public ExistingAllotment? ExistingAllotment { get; set; }
    public int EffectiveCategoryId => PreviousCategoryId < 0 ? CategoryId : PreviousCategoryId;
}

public sealed class CollegePreference
{
    public int PreferenceNo { get; set; }
    public int CollegeId { get; set; }
    public int ChoiceCode { get; set; }
}

public sealed class ExistingAllotment
{
    public int CollegeId { get; set; }
    public int PreferenceNo { get; set; }
    public int CategoryId { get; set; }
    public string AllocatedType { get; set; } = string.Empty;
    public string OriginalAllocatedType { get; set; } = string.Empty;
    public string VacancyType { get; set; } = string.Empty;
    public int ChoiceCode { get; set; }
}

public sealed class SeatInventory
{
    public int CollegeId { get; set; }
    public int ChoiceCode { get; set; }
    public int CategoryId { get; set; }
    public int QuotaId { get; set; }
    public int General { get; set; }
    public int Female { get; set; }
    public int Ph { get; set; }
    public int Defence { get; set; }
    public int Orphan { get; set; }
}

public sealed class AllocationDecision
{
    public Guid DecisionId { get; set; } = Guid.NewGuid();
    public Guid AllocationRunId { get; set; }
    public long CandidateId { get; set; }
    public int CollegeId { get; set; }
    public int PreferenceNo { get; set; }
    public int CategoryId { get; set; }
    public string AllocatedType { get; set; } = string.Empty;
    public string OriginalAllocatedType { get; set; } = string.Empty;
    public string VacancyType { get; set; } = string.Empty;
    public int ChoiceCode { get; set; }
    public int StepId { get; set; }
    public string DecisionArea { get; set; } = string.Empty;
    public string RuleCode { get; set; } = string.Empty;
    public string Status { get; set; } = "Allocated";
}

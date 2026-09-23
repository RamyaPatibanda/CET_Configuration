namespace api.Models.Allocation;

public sealed class AllocationStepDefinition
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool Enabled { get; set; }
    public List<AllocationDecisionAreaDefinition> DecisionAreas { get; set; } = [];
}

public sealed class AllocationDecisionAreaDefinition
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

public static class AllocationConfiguration
{
    public const string Step0 = "STEP_0";
    public const string Step1 = "STEP_1";

    public const string CandidateQualification = "CANDIDATE_QUALIFICATION";
    public const string SeatAllocation = "SEAT_ALLOCATION";
    public const string SpecialReservationEligibility = "SPECIAL_RESERVATION_ELIGIBILITY";
    public const string PreferenceEvaluation = "PREFERENCE_EVALUATION";
    public const string SeatEligibility = "SEAT_ELIGIBILITY";
    public const string Betterment = "BETTERMENT";
    public const string Conversion = "CONVERSION";
    public const string Step0SeatDistribution = "STEP_0_SEAT_DISTRIBUTION";
    public const string Step0AllocationTypeSequence = "STEP_0_ALLOCATION_TYPE_SEQUENCE";
    public const string Step1AllocationTypeSequence = "STEP_1_ALLOCATION_TYPE_SEQUENCE";

    public static IReadOnlyList<AllocationStepDefinition> GetSteps() =>
    [
        new()
        {
            Code = Step0,
            Name = "Step 0 - Special Reservation",
            Description = "PH, Defence and Orphan special-reservation allocation.",
            Enabled = true,
            DecisionAreas =
            [
                new() { Code = CandidateQualification, Name = "Candidate Eligibility", Description = "Determine the candidates that enter the Step 0 processing pool." },
                new() { Code = Step0SeatDistribution, Name = "Seat Distribution", Description = "Determine special reservation vacancy when the normal seat vacancy is zero." },
                new() { Code = Step0AllocationTypeSequence, Name = "Allocation Type & Sequence", Description = "Evaluate the selected rules in order. The first matching rule determines the allocation type and its position becomes the SeqId." }
            ]
        },
        new()
        {
            Code = Step1,
            Name = "Step 1 - Main Allocation",
            Description = "Main merit and preference-based allocation.",
            Enabled = true,
            DecisionAreas =
            [
                new() { Code = CandidateQualification, Name = "Candidate Qualification", Description = "Determine candidates eligible for main allocation." },
                new() { Code = PreferenceEvaluation, Name = "Preference Evaluation", Description = "Determine eligible preferences and preference traversal rules." },
                new() { Code = SeatEligibility, Name = "Seat Eligibility", Description = "Determine which seat rows can be considered for the candidate." },
                new() { Code = Step1AllocationTypeSequence, Name = "Allocation Type & Sequence", Description = "Evaluate allocation-type rules in order. The first matching rule determines the seat column and its position becomes SeqId." },
                new() { Code = Betterment, Name = "Betterment", Description = "Determine whether an existing allocation can be replaced by a better preference or sequence." }
            ]
        },
        new() { Code = "STEP_2", Name = "Step 2 - Female Conversion", Description = "Female-seat conversion.", Enabled = false },
        new() { Code = "STEP_3", Name = "Step 3 - SBC Conversion", Description = "SBC conversion candidate selection and processing.", Enabled = false },
        new() { Code = "STEP_6", Name = "Step 6 - Category Conversion", Description = "Category-group conversion.", Enabled = false },
        new() { Code = "STEP_7", Name = "Step 7 - Reservation Relaxation", Description = "Later reservation / relaxation processing.", Enabled = false },
        new() { Code = "STEP_8", Name = "Step 8 - Institution / Quota Conversion", Description = "Institution and quota conversion.", Enabled = false }
    ];

    public static AllocationStepDefinition? GetStep(string code) =>
        GetSteps().FirstOrDefault(step => step.Code.Equals(code, StringComparison.OrdinalIgnoreCase));

    public static bool IsDecisionAreaValid(string stepCode, string areaCode) =>
        GetStep(stepCode)?.DecisionAreas.Any(area =>
            area.Code.Equals(areaCode, StringComparison.OrdinalIgnoreCase)) == true;
}

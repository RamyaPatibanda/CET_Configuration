using api.Models.Allocation;

namespace api.Services.Allocation;

public static class AllocationRuleCatalog
{
    // Initial typed rule catalogue for the Step 0 pilot.
    // These are defaults only; production execution must load an approved immutable rule-set version.
    public static IReadOnlyList<AllocationRule> Step0Defaults =>
    [
        new AllocationRule
        {
            Code = "STEP0_PH",
            StageCode = "SPECIAL_RESERVATION",
            LogicalOperator = "AND",
            Conditions =
            [
                new("IsOMS", "Equals", "N"),
                new("IsNRI", "Equals", "N"),
                new("FinalIsPh", "Equals", "Y")
            ]
        },
        new AllocationRule
        {
            Code = "STEP0_DEFENCE",
            StageCode = "SPECIAL_RESERVATION",
            LogicalOperator = "AND",
            Conditions =
            [
                new("IsOMS", "Equals", "N"),
                new("IsNRI", "Equals", "N"),
                new("FinalIsExServicemen", "Equals", "Y")
            ]
        },
        new AllocationRule
        {
            Code = "STEP0_ORPHAN",
            StageCode = "SPECIAL_RESERVATION",
            LogicalOperator = "AND",
            Conditions =
            [
                new("IsOMS", "Equals", "N"),
                new("IsNRI", "Equals", "N"),
                new("FinalIsOrphan", "Equals", "Y")
            ]
        }
    ];
}

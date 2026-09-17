using api.Models.Allocation;

namespace api.Services.Allocation;

/// <summary>
/// Legacy Step 0 rule catalogue is intentionally empty.
/// Allocation rules must be loaded from Rule Configuration and evaluated generically.
/// </summary>
public static class AllocationRuleCatalog
{
    public static IReadOnlyList<AllocationRule> Step0Defaults => Array.Empty<AllocationRule>();
}

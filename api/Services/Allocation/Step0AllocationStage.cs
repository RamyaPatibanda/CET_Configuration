using api.DataAccess.Allocation;
using api.Models.Allocation;

namespace api.Services.Allocation;

public sealed class Step0AllocationStage : IAllocationStage
{
    private readonly LegacyAllocationDAL _legacyAllocation;

    public Step0AllocationStage(LegacyAllocationDAL legacyAllocation)
    {
        _legacyAllocation = legacyAllocation;
    }

    public string StageCode => "STEP_0_ALLOCATION";

    public async Task ExecuteAsync(
        AllocationContext context,
        CancellationToken cancellationToken = default)
    {
        var result = await _legacyAllocation.ExecuteStep0Async(
            context.Candidates.ToList(),
            context.RuleGroups,
            cancellationToken);

        foreach (var allocation in result.Allocations)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var candidate = context.Candidates.FirstOrDefault(
                c => c.CandidateId == allocation.CandidateId);

            var collegeId = candidate?.Preferences
                .FirstOrDefault(p =>
                    p.ChoiceCode == allocation.ChoiceCode &&
                    p.PreferenceNo == allocation.PreferenceNo)
                ?.CollegeId ?? 0;

            context.Decisions.Add(new AllocationDecision
            {
                AllocationRunId = context.Run.AllocationRunId,
                CandidateId = allocation.CandidateId,
                CollegeId = collegeId,
                ChoiceCode = allocation.ChoiceCode,
                PreferenceNo = allocation.PreferenceNo,
                CategoryId = allocation.AllocatedCategoryId,
                AllocatedType = allocation.AllocatedType,
                OriginalAllocatedType = allocation.OriginalAllocatedType,
                VacancyType = allocation.OriginalAllocatedType is "PH" or "Def" or "Orp"
                    ? allocation.OriginalAllocatedType
                    : string.Empty,
                StepId = allocation.StepId,
                DecisionArea = allocation.OriginalAllocatedType is "PH" or "Def" or "Orp"
                    ? AllocationConfiguration.SpecialReservationEligibility
                    : AllocationConfiguration.SeatEligibility,
                RuleCode = ResolveRuleCode(context, allocation.OriginalAllocatedType),
                Status = "Allocated"
            });

            if (candidate is not null)
            {
                candidate.ExistingAllotment = new ExistingAllotment
                {
                    CollegeId = collegeId,
                    ChoiceCode = allocation.ChoiceCode,
                    PreferenceNo = allocation.PreferenceNo,
                    CategoryId = allocation.AllocatedCategoryId,
                    AllocatedType = allocation.AllocatedType,
                    OriginalAllocatedType = allocation.OriginalAllocatedType,
                    VacancyType = allocation.OriginalAllocatedType is "PH" or "Def" or "Orp"
                        ? allocation.OriginalAllocatedType
                        : string.Empty
                };
            }
        }
    }

    private static string ResolveRuleCode(
        AllocationContext context,
        string originalAllocatedType)
    {
        var area = originalAllocatedType is "PH" or "Def" or "Orp"
            ? AllocationConfiguration.SpecialReservationEligibility
            : AllocationConfiguration.SeatEligibility;

        if (!context.RuleGroups.TryGetValue(area, out var rules))
            return string.Empty;

        return rules.FirstOrDefault()?.Code ?? string.Empty;
    }
}

using api.DataAccess.Allocation;
using api.Models.Allocation;

namespace api.Services.Allocation;

public sealed class Step1AllocationStage : IAllocationStage
{
    private readonly Step1CandidateRepository _candidateRepository;
    private readonly LegacyStep1AllocationDAL _legacyAllocation;

    public Step1AllocationStage(
        Step1CandidateRepository candidateRepository,
        LegacyStep1AllocationDAL legacyAllocation)
    {
        _candidateRepository = candidateRepository;
        _legacyAllocation = legacyAllocation;
    }

    public string StageCode => "SEAT_ALLOCATION";

    public async Task ExecuteAsync(
        AllocationContext context,
        CancellationToken cancellationToken = default)
    {
        var candidates = await _candidateRepository.ReadCandidatesAsync(cancellationToken);
        var result = await _legacyAllocation.ExecuteAsync(
            candidates,
            context.RuleGroups,
            cancellationToken);

        foreach (var allocation in result.Allocations)
        {
            context.Decisions.Add(new AllocationDecision
            {
                AllocationRunId = context.Run.AllocationRunId,
                CandidateId = allocation.CandidateId,
                CollegeId = 0,
                ChoiceCode = allocation.ChoiceCode,
                PreferenceNo = allocation.PreferenceNo,
                CategoryId = allocation.AllocatedCategoryId,
                AllocatedType = allocation.AllocatedType,
                OriginalAllocatedType = allocation.OriginalAllocatedType,
                VacancyType = string.Empty,
                StepId = 1,
                DecisionArea = AllocationConfiguration.SeatEligibility,
                RuleCode = allocation.RuleCode,
                Status = "Allocated"
            });
        }

        context.StageResults.Add(new AllocationStageResult
        {
            StageCode = StageCode,
            Sequence = 30,
            CandidateCountBefore = result.CandidatesProcessed,
            CandidateCountAfter = result.Allocations.Select(a => a.CandidateId).Distinct().Count(),
            DecisionsCreated = result.Allocations.Count,
            Status = "Completed"
        });
    }
}

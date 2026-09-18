using api.DataAccess.Allocation;
using api.Models.Allocation;

namespace api.Services.Allocation;

public sealed class Step0AllocationStage : IAllocationStage
{
    private readonly LegacyAllocationDAL _legacyAllocation;
    private readonly Step0CandidateRepository _candidateRepository;

    public Step0AllocationStage(
        LegacyAllocationDAL legacyAllocation,
        Step0CandidateRepository candidateRepository)
    {
        _legacyAllocation = legacyAllocation;
        _candidateRepository = candidateRepository;
    }

    public string StageCode => "STEP_0_ALLOCATION";

    public async Task ExecuteAsync(
        AllocationContext context,
        CancellationToken cancellationToken = default)
    {
        var processedCandidates = 0;
        var allocatedCandidates = 0;

        await foreach (var candidateBatch in _candidateRepository.ReadEligibleBatchesAsync(
                           context.RuleGroups,
                           cancellationToken: cancellationToken))
        {
            cancellationToken.ThrowIfCancellationRequested();

            // Keep only one batch in the middle layer at a time.
            // The frontend never supplies candidate data.
            processedCandidates += candidateBatch.Count;

            var result = await _legacyAllocation.ExecuteStep0Async(
                candidateBatch,
                context.RuleGroups,
                cancellationToken);

            // The legacy Step 0 procedure returns the number of active
            // allocations produced by the Step 0 processing. In the
            // application-layer implementation this is represented by the
            // allocation rows returned from ExecuteStep0Async.
            allocatedCandidates += result.Allocations.Count;

            foreach (var allocation in result.Allocations)
            {
                cancellationToken.ThrowIfCancellationRequested();

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
                    VacancyType = allocation.OriginalAllocatedType is "PH" or "Def" or "Orp"
                        ? allocation.OriginalAllocatedType
                        : string.Empty,
                    StepId = allocation.StepId,
                    DecisionArea = AllocationConfiguration.CandidateQualification,
                    RuleCode = ResolveRuleCode(context, allocation.OriginalAllocatedType),
                    Status = "Allocated"
                });
            }
        }

        context.StageResults.Add(new AllocationStageResult
        {
            StageCode = StageCode,
            Sequence = 20,
            CandidateCountBefore = processedCandidates,
            CandidateCountAfter = allocatedCandidates,
            DecisionsCreated = allocatedCandidates,
            Status = "Completed"
        });
    }

    private static string ResolveRuleCode(
        AllocationContext context,
        string originalAllocatedType)
    {
        var area = AllocationConfiguration.CandidateQualification;

        if (!context.RuleGroups.TryGetValue(area, out var rules))
            return string.Empty;

        return rules.FirstOrDefault()?.Code ?? string.Empty;
    }
}

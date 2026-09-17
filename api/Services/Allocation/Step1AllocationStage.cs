using api.Models.Allocation;

namespace api.Services.Allocation;

public sealed class Step1AllocationStage : IAllocationStage
{
    private readonly ISeatInventory _inventory;

    public Step1AllocationStage(ISeatInventory inventory)
    {
        _inventory = inventory;
    }

    public string StageCode => "SEAT_ALLOCATION";

    public Task ExecuteAsync(AllocationContext context, CancellationToken cancellationToken = default)
    {
        foreach (var candidate in context.Candidates
                     .Where(c => c.ExistingAllotment is null || c.ExistingAllotment.PreferenceNo > 0)
                     .OrderBy(c => c.MeritNo))
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (context.Decisions.Any(d => d.CandidateId == candidate.CandidateId && d.Status == "Allocated"))
                continue;

            var existingPreference = candidate.ExistingAllotment?.PreferenceNo ?? 0;

            foreach (var preference in candidate.Preferences.OrderBy(p => p.PreferenceNo))
            {
                if (existingPreference > 0 && preference.PreferenceNo >= existingPreference)
                    continue;

                var seat = FindSeat(context.Seats, candidate, preference);
                if (seat is null) continue;

                var baseType = ResolveBaseSeatType(candidate, seat);
                if (baseType is null) continue;
                if (!_inventory.TryReserve(seat, baseType, specialReservation: false)) continue;

                ReleaseExistingAllocation(context, candidate);

                context.Decisions.Add(new AllocationDecision
                {
                    AllocationRunId = context.Run.AllocationRunId,
                    CandidateId = candidate.CandidateId,
                    CollegeId = preference.CollegeId,
                    PreferenceNo = preference.PreferenceNo,
                    CategoryId = candidate.EffectiveCategoryId,
                    AllocatedType = baseType,
                    OriginalAllocatedType = baseType,
                    StepId = 1,
                    RuleCode = "STEP1_MERIT_PREFERENCE",
                    Status = "Allocated"
                });
                break;
            }
        }

        return Task.CompletedTask;
    }

    private static SeatInventory? FindSeat(
        IEnumerable<SeatInventory> seats,
        AllocationCandidate candidate,
        CollegePreference preference)
        => seats.FirstOrDefault(s =>
            s.CollegeId == preference.CollegeId &&
            (s.CategoryId == candidate.EffectiveCategoryId || s.CategoryId == 1) &&
            s.QuotaId == 1);

    private static string? ResolveBaseSeatType(AllocationCandidate candidate, SeatInventory seat)
    {
        if (candidate.Gender.Equals("F", StringComparison.OrdinalIgnoreCase) && seat.Female > 0)
            return "Fem";

        if (candidate.IsEligibleForOpen.Equals("Y", StringComparison.OrdinalIgnoreCase) && seat.General > 0)
            return "Gen";

        return null;
    }

    private static void ReleaseExistingAllocation(AllocationContext context, AllocationCandidate candidate)
    {
        var old = candidate.ExistingAllotment;
        if (old is null) return;

        var oldSeat = context.Seats.FirstOrDefault(s =>
            s.CollegeId == old.CollegeId &&
            (s.CategoryId == old.CategoryId || s.CategoryId == 1) &&
            s.QuotaId == 1);

        if (oldSeat is null) return;

        var inventory = new SeatInventoryService();
        inventory.Release(oldSeat, old.AllocatedType, specialReservation: false);
        if (old.OriginalAllocatedType is "PH" or "Def" or "Orp")
            inventory.Release(oldSeat, old.OriginalAllocatedType, specialReservation: true);
    }
}

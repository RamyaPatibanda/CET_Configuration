using api.Models.Allocation;

namespace api.Services.Allocation;

public sealed class Step0AllocationStage : IAllocationStage
{
    private readonly IRuleEvaluator _rules;
    private readonly ISeatInventory _inventory;
    private readonly IReadOnlyList<AllocationRule> _ruleset;

    public string StageCode => "SPECIAL_RESERVATION";

    public Step0AllocationStage(IRuleEvaluator rules, ISeatInventory inventory, IReadOnlyList<AllocationRule> ruleset)
    {
        _rules = rules;
        _inventory = inventory;
        _ruleset = ruleset;
    }

    public Task ExecuteAsync(AllocationContext context, CancellationToken cancellationToken = default)
    {
        foreach (var candidate in context.Candidates.OrderBy(c => c.MeritNo))
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (candidate.IsOms != "N" || candidate.IsNri != "N") continue;
            if (candidate.Preferences.Count == 0) continue;
            if (candidate.ExistingAllotment?.PreferenceNo == 1) continue;

            var specialType = ResolveSpecialType(candidate);
            if (specialType is null) continue;

            foreach (var preference in candidate.Preferences.OrderBy(p => p.PreferenceNo))
            {
                var seat = FindSeat(context.Seats, candidate, preference);
                if (seat is null || !HasSpecialVacancy(seat, specialType)) continue;

                var baseType = ResolveBaseSeatType(candidate, seat);
                if (baseType is null) continue;

                // Reserve both overlays atomically from the stage's perspective.
                if (!_inventory.TryReserve(seat, specialType, specialReservation: true)) continue;
                if (!_inventory.TryReserve(seat, baseType, specialReservation: false))
                {
                    _inventory.Release(seat, specialType, specialReservation: true);
                    continue;
                }

                ReleaseExistingAllocation(context, candidate);

                context.Decisions.Add(new AllocationDecision
                {
                    AllocationRunId = context.Run.AllocationRunId,
                    CandidateId = candidate.CandidateId,
                    CollegeId = preference.CollegeId,
                    PreferenceNo = preference.PreferenceNo,
                    CategoryId = candidate.EffectiveCategoryId,
                    AllocatedType = baseType,
                    OriginalAllocatedType = specialType,
                    StepId = 0,
                    RuleCode = $"STEP0_{specialType}",
                    Status = "Allocated"
                });
                break;
            }
        }

        return Task.CompletedTask;
    }

    private string? ResolveSpecialType(AllocationCandidate candidate)
    {
        foreach (var rule in _ruleset.Where(r => r.StageCode == StageCode).OrderBy(r => r.Code))
        {
            if (!_rules.Matches(rule, candidate)) continue;
            var code = rule.Code.ToUpperInvariant();
            if (code.Contains("PH")) return "PH";
            if (code.Contains("DEFENCE") || code.Contains("DEF")) return "Def";
            if (code.Contains("ORPHAN") || code.Contains("ORP")) return "Orp";
        }
        return null;
    }

    private static SeatInventory? FindSeat(IEnumerable<SeatInventory> seats, AllocationCandidate candidate, CollegePreference preference)
        => seats.FirstOrDefault(s => s.CollegeId == preference.CollegeId &&
                                     (s.CategoryId == candidate.EffectiveCategoryId || s.CategoryId == 1) &&
                                     s.QuotaId == 1);

    private static bool HasSpecialVacancy(SeatInventory seat, string specialType) => specialType switch
    {
        "PH" => seat.Ph > 0,
        "Def" => seat.Defence > 0,
        "Orp" => seat.Orphan > 0,
        _ => false
    };

    private static string? ResolveBaseSeatType(AllocationCandidate candidate, SeatInventory seat)
    {
        if (candidate.Gender.Equals("F", StringComparison.OrdinalIgnoreCase) && seat.Female > 0)
            return "Fem";
        if (candidate.IsEligibleForOpen == "Y" && seat.General > 0)
            return "Gen";
        return null;
    }

    private static void ReleaseExistingAllocation(AllocationContext context, AllocationCandidate candidate)
    {
        var old = candidate.ExistingAllotment;
        if (old is null) return;

        var oldSeat = context.Seats.FirstOrDefault(s => s.CollegeId == old.CollegeId &&
                                                        s.CategoryId == old.CategoryId &&
                                                        s.QuotaId == 1);
        if (oldSeat is null) return;

        var special = old.OriginalAllocatedType is "PH" or "Def" or "Orp";
        // Release base seat first, then the reservation overlay.
        var inventory = new SeatInventoryService();
        inventory.Release(oldSeat, old.AllocatedType, specialReservation: false);
        if (special) inventory.Release(oldSeat, old.OriginalAllocatedType, specialReservation: true);
        oldSeat = null;
    }
}

using api.Models.Allocation;

namespace api.Services.Allocation;

/// <summary>
/// Implements the business flow of Allocation_Seats_Step0 and its
/// Allocation_Seats_Def_Convert dependency using the allocation
/// candidate/preference/seat data supplied to the run.
/// </summary>
public sealed class Step0AllocationStage : IAllocationStage
{
    private readonly IRuleEvaluator _ruleEvaluator;

    public Step0AllocationStage(IRuleEvaluator ruleEvaluator)
    {
        _ruleEvaluator = ruleEvaluator;
    }

    public string StageCode => "STEP_0_ALLOCATION";

    public Task ExecuteAsync(
        AllocationContext context,
        CancellationToken cancellationToken = default)
    {
        var candidateRules = GetRules(context, AllocationConfiguration.CandidateQualification);
        var reservationRules = GetRules(context, AllocationConfiguration.SpecialReservationEligibility);
        var preferenceRules = GetRules(context, AllocationConfiguration.PreferenceEvaluation);
        var seatRules = GetRules(context, AllocationConfiguration.SeatEligibility);
        var bettermentRules = GetRules(context, AllocationConfiguration.Betterment);
        var conversionRules = GetRules(context, AllocationConfiguration.Conversion);

        var candidates = context.Candidates
            .Where(IsStep0Candidate)
            .Where(c => c.ExistingAllotment?.PreferenceNo != 1)
            .Where(c => !c.IsInTempPhDef)
            .Where(c => MatchesAny(candidateRules, c))
            .Where(c => MatchesAny(reservationRules, c))
            .OrderBy(c => c.MeritNo)
            .ToList();

        context.Candidates.Clear();
        context.Candidates.AddRange(candidates);

        foreach (var candidate in candidates)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var preferences = candidate.Preferences
                .OrderBy(p => p.PreferenceNo)
                .Where(p => MatchesAny(preferenceRules, candidate))
                .ToList();

            var existingPreference = candidate.ExistingAllotment?.PreferenceNo ?? 0;
            var allocated = false;

            foreach (var preference in preferences)
            {
                cancellationToken.ThrowIfCancellationRequested();

                // Allocation_Seats_Step0 only considers a preference when it is
                // better than the candidate's existing preference, or no
                // preference has been allocated yet.
                if (existingPreference > 0 && preference.PreferenceNo >= existingPreference)
                    continue;

                var seat = FindSeat(context.Seats, candidate, preference);
                if (seat is null)
                    continue;

                var vacancy = GetSpecialVacancy(candidate, seat);
                var specialAllocation = TryAllocateSpecial(
                    candidate,
                    seat,
                    vacancy);

                if (specialAllocation is not null)
                {
                    AddDecision(context, candidate, preference, seat, specialAllocation.Value.Type,
                        specialAllocation.Value.VacancyType, bettermentRules);
                    ConsumeSpecialVacancy(seat, specialAllocation.Value.VacancyType);
                    allocated = true;
                    break;
                }

                if (!MatchesAny(seatRules, candidate))
                    continue;

                var normalAllocation = TryAllocateNormal(candidate, seat);
                if (normalAllocation is null)
                    continue;

                AddDecision(context, candidate, preference, seat, normalAllocation.Value.Type,
                    string.Empty, bettermentRules);
                allocated = true;
                break;
            }

            if (allocated)
                continue;
        }

        return Task.CompletedTask;
    }

    private static bool IsStep0Candidate(AllocationCandidate candidate) =>
        candidate.MeritNo > 0 &&
        candidate.IsOms.Equals("N", StringComparison.OrdinalIgnoreCase) &&
        candidate.IsNri.Equals("N", StringComparison.OrdinalIgnoreCase) &&
        (IsYes(candidate.IsPh) ||
         IsYes(candidate.IsExServicemen) ||
         IsYes(candidate.IsOrphan)) &&
        candidate.Preferences.Count > 0;

    private static List<AllocationRule> GetRules(
        AllocationContext context,
        string decisionArea) =>
        context.RuleGroups.TryGetValue(decisionArea, out var rules)
            ? rules.ToList()
            : [];

    private bool MatchesAny(
        IReadOnlyCollection<AllocationRule> rules,
        AllocationCandidate candidate) =>
        rules.Count == 0 || rules.Any(rule => _ruleEvaluator.Matches(rule, candidate));

    private static SeatInventory? FindSeat(
        IEnumerable<SeatInventory> seats,
        AllocationCandidate candidate,
        CollegePreference preference)
    {
        return seats
            .Where(s =>
                (s.ChoiceCode == 0 || s.ChoiceCode == preference.ChoiceCode) &&
                s.QuotaId == 1 &&
                (s.CategoryId == 1 || s.CategoryId == candidate.EffectiveCategoryId))
            .OrderByDescending(s => s.CategoryId)
            .FirstOrDefault();
    }

    private static (string Type, string VacancyType)? TryAllocateSpecial(
        AllocationCandidate candidate,
        SeatInventory seat,
        int vacancy)
    {
        if (vacancy <= 0)
            return null;

        if (IsYes(candidate.IsPh) && seat.Ph > 0)
            return ("PH", "PH");

        if (IsYes(candidate.IsExServicemen) && seat.Defence > 0)
            return ("Def", "Def");

        if (IsYes(candidate.IsOrphan) && seat.Orphan > 0)
            return ("Orp", "Orp");

        return null;
    }

    private static int GetSpecialVacancy(
        AllocationCandidate candidate,
        SeatInventory seat)
    {
        if (IsYes(candidate.IsPh) && seat.Ph > 0)
            return seat.Ph;

        if (IsYes(candidate.IsExServicemen) && seat.Defence > 0)
            return seat.Defence;

        if (IsYes(candidate.IsOrphan) && seat.Orphan > 0)
            return seat.Orphan;

        return 0;
    }

    private static (string Type, string VacancyType)? TryAllocateNormal(
        AllocationCandidate candidate,
        SeatInventory seat)
    {
        if (candidate.EffectiveCategoryId == 1 &&
            !IsYes(candidate.IsEligibleForOpen))
            return null;

        if (candidate.Gender.Equals("F", StringComparison.OrdinalIgnoreCase) &&
            seat.Female > 0)
            return ("Fem", "Gen");

        return seat.General > 0
            ? ("Gen", "Gen")
            : null;
    }

    private static void ConsumeSpecialVacancy(
        SeatInventory seat,
        string vacancyType)
    {
        switch (vacancyType)
        {
            case "PH":
                seat.Ph = Math.Max(0, seat.Ph - 1);
                break;
            case "Def":
                seat.Defence = Math.Max(0, seat.Defence - 1);
                break;
            case "Orp":
                seat.Orphan = Math.Max(0, seat.Orphan - 1);
                break;
        }
    }

    private static void ConsumeNormalSeat(SeatInventory seat, string allocationType)
    {
        if (allocationType.Equals("Fem", StringComparison.OrdinalIgnoreCase) &&
            seat.Female > 0)
        {
            seat.Female--;
            return;
        }

        if (seat.General > 0)
            seat.General--;
    }

    private static void AddDecision(
        AllocationContext context,
        AllocationCandidate candidate,
        CollegePreference preference,
        SeatInventory seat,
        string allocationType,
        string vacancyType,
        IReadOnlyCollection<AllocationRule> bettermentRules)
    {
        var existing = candidate.ExistingAllotment;
        var status = existing is null ? "Allocated" : "Betterment";

        context.Decisions.Add(new AllocationDecision
        {
            AllocationRunId = context.Run.AllocationRunId,
            CandidateId = candidate.CandidateId,
            CollegeId = preference.CollegeId,
            ChoiceCode = preference.ChoiceCode,
            PreferenceNo = preference.PreferenceNo,
            CategoryId = candidate.EffectiveCategoryId,
            AllocatedType = allocationType,
            OriginalAllocatedType = existing?.OriginalAllocatedType ?? allocationType,
            VacancyType = vacancyType,
            StepId = 0,
            DecisionArea = vacancyType.Length > 0
                ? AllocationConfiguration.SpecialReservationEligibility
                : AllocationConfiguration.SeatEligibility,
            RuleCode = ResolveRuleCode(context, candidate, vacancyType),
            Status = status
        });

        if (vacancyType.Length == 0)
            ConsumeNormalSeat(seat, allocationType);

        candidate.ExistingAllotment = new ExistingAllotment
        {
            CollegeId = preference.CollegeId,
            ChoiceCode = preference.ChoiceCode,
            PreferenceNo = preference.PreferenceNo,
            CategoryId = candidate.EffectiveCategoryId,
            AllocatedType = allocationType,
            OriginalAllocatedType = existing?.OriginalAllocatedType ?? allocationType,
            VacancyType = vacancyType
        };
    }

    private static string ResolveRuleCode(
        AllocationContext context,
        AllocationCandidate candidate,
        string vacancyType)
    {
        var area = vacancyType.Length > 0
            ? AllocationConfiguration.SpecialReservationEligibility
            : AllocationConfiguration.SeatEligibility;

        if (!context.RuleGroups.TryGetValue(area, out var rules))
            return string.Empty;

        return rules.FirstOrDefault(r => r.Conditions.Count == 0)?.Code
            ?? rules.FirstOrDefault()?.Code
            ?? string.Empty;
    }

    private static bool IsYes(string value) =>
        value.Equals("Y", StringComparison.OrdinalIgnoreCase);
}

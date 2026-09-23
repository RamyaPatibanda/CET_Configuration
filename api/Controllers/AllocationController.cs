using api.BusinessLogic.RuleConfiguration;
using api.DataAccess.Allocation;
using api.Models.Allocation;
using api.Models.RuleConfiguration;
using api.Models.UserManagement;
using api.BusinessLogic.UserManagement;
using api.Services.Allocation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace api.Controllers;

[Authorize]
[ApiController]
[Route("api/allocation")]
public sealed class AllocationController : ControllerBase
{
    private readonly IRuleConfigurationBL _ruleConfiguration;
    private readonly ILogger<AllocationController> _logger;
    private readonly AllocationRunHistoryDAL _runHistory;
    private readonly LegacyAllocationDAL _legacyAllocation;
    private readonly Step0CandidateRepository _step0CandidateRepository;
    private readonly Step1CandidateRepository _step1CandidateRepository;
    private readonly LegacyStep1AllocationDAL _legacyStep1Allocation;
    private readonly UserPermissionService _permissions;

    public AllocationController(
        IRuleConfigurationBL ruleConfiguration,
        ILogger<AllocationController> logger,
        AllocationRunHistoryDAL runHistory,
        LegacyAllocationDAL legacyAllocation,
        Step0CandidateRepository step0CandidateRepository,
        Step1CandidateRepository step1CandidateRepository,
        LegacyStep1AllocationDAL legacyStep1Allocation,
        UserPermissionService permissions)
    {
        _ruleConfiguration = ruleConfiguration;
        _logger = logger;
        _runHistory = runHistory;
        _legacyAllocation = legacyAllocation;
        _step0CandidateRepository = step0CandidateRepository;
        _step1CandidateRepository = step1CandidateRepository;
        _legacyStep1Allocation = legacyStep1Allocation;
        _permissions = permissions;
    }

    [HttpGet("steps")]
    public async Task<ActionResult<IReadOnlyList<AllocationStepDefinition>>> GetSteps()
    {
        if (!await _permissions.HasReadAsync(User, UserPermissionModules.AllocationRun))
            return Forbid();
        return Ok(AllocationConfiguration.GetSteps());
    }

    [HttpGet("history")]
    public async Task<ActionResult<IReadOnlyList<AllocationRunHistory>>> GetHistory(
        CancellationToken cancellationToken)
    {
        if (!await _permissions.HasReadAsync(User, UserPermissionModules.AllocationRun))
            return Forbid();
        return Ok(await _runHistory.GetRecentAsync());
    }

    [HttpPost("draft")]
    public async Task<ActionResult<AllocationRunResponse>> SaveDraft(
        [FromBody] AllocationRunRequest request,
        CancellationToken cancellationToken)
    {
        if (!await _permissions.HasWriteAsync(User, UserPermissionModules.AllocationRun))
            return Forbid();
        var prepared = await PrepareAsync(request, allowIncompleteDraft: true, cancellationToken);
        if (prepared.Error is not null)
            return BadRequest(new { message = prepared.Error });

        var run = prepared.Run!;
        run.Status = AllocationRunStatus.Draft;
        await SaveHistoryAsync(run, request, prepared.RuleDetails!, cancellationToken);
        return Ok(new AllocationRunResponse { Run = run });
    }

    [HttpPost("run")]
    public async Task<ActionResult<AllocationRunResponse>> Run(
        [FromBody] AllocationRunRequest request,
        CancellationToken cancellationToken)
    {
        if (!await _permissions.HasWriteAsync(User, UserPermissionModules.AllocationRun))
            return Forbid();
        var prepared = await PrepareAsync(request, cancellationToken: cancellationToken);
        if (prepared.Error is not null)
            return BadRequest(new { message = prepared.Error });

        var run = prepared.Run!;

        try
        {
            run.Status = AllocationRunStatus.Running;
            run.StartedAtUtc = DateTime.UtcNow;
            await SaveHistoryAsync(run, request, prepared.RuleDetails!, cancellationToken);

            var context = await new AllocationEngine(BuildStages(run.AllocationStep)).RunAsync(
                run,
                prepared.RuleGroups!,
                cancellationToken);

            var decisions = context.Decisions.ToList();
            var stages = context.StageResults.ToList();
            var report = BuildAllocationReport(stages, decisions);

            await _runHistory.SaveDecisionsAsync(run.AllocationRunId, decisions);
            await SaveHistoryAsync(
                run,
                request,
                prepared.RuleDetails!,
                cancellationToken,
                decisionCount: decisions.Count,
                candidateCount: report.TotalCandidatesProcessed,
                report: report);

            return Ok(new AllocationRunResponse
            {
                Run = context.Run,
                Decisions = decisions,
                Stages = stages,
                Report = report
            });
        }
        catch (OperationCanceledException)
        {
            run.Status = AllocationRunStatus.Cancelled;
            run.CompletedAtUtc = DateTime.UtcNow;
            await SaveHistoryAsync(run, request, prepared.RuleDetails!, CancellationToken.None);
            throw;
        }
        catch (Exception ex)
        {
            run.Status = AllocationRunStatus.Failed;
            run.CompletedAtUtc = DateTime.UtcNow;

            try
            {
                await SaveHistoryAsync(
                    run,
                    request,
                    prepared.RuleDetails!,
                    CancellationToken.None,
                    ex.Message);
            }
            catch (Exception historyException)
            {
                _logger.LogError(historyException, "Unable to persist failed allocation run {AllocationRunId}.", run.AllocationRunId);
            }

            _logger.LogError(
                ex,
                "Allocation run {AllocationRunId} failed for CAP round {CapRound}, step {AllocationStep}.",
                run.AllocationRunId,
                request.CapRound,
                request.AllocationStep);

            return StatusCode(500, new
            {
                message = "Allocation run failed.",
                allocationRunId = run.AllocationRunId
            });
        }
    }

    // Kept for compatibility with the existing UI/client contract.
    [HttpPost("simulate")]
    public Task<ActionResult<AllocationRunResponse>> Simulate(
        [FromBody] AllocationRunRequest request,
        CancellationToken cancellationToken) =>
        Run(request, cancellationToken);

    [HttpDelete("{runId:guid}")]
    public async Task<IActionResult> Delete(
        Guid runId,
        CancellationToken cancellationToken)
    {
        if (!await _permissions.HasWriteAsync(User, UserPermissionModules.AllocationRun))
            return Forbid();
        var history = (await _runHistory.GetRecentAsync(200))
            .FirstOrDefault(item => item.AllocationRunId == runId);

        if (history is null)
            return NotFound(new { message = "Allocation run was not found." });

        if (string.Equals(history.Status, AllocationRunStatus.Running.ToString(), StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "A running allocation cannot be deleted." });

        await _runHistory.DeleteAsync(runId);
        return NoContent();
    }

    [HttpPost("{runId:guid}/archive")]
    public async Task<IActionResult> Archive(
        Guid runId,
        CancellationToken cancellationToken)
    {
        if (!await _permissions.HasWriteAsync(User, UserPermissionModules.AllocationRun))
            return Forbid();
        var history = (await _runHistory.GetRecentAsync(200))
            .FirstOrDefault(item => item.AllocationRunId == runId);

        if (history is null)
            return NotFound(new { message = "Allocation run was not found." });

        if (!Enum.TryParse<AllocationRunStatus>(history.Status, true, out var status) ||
            status is AllocationRunStatus.Running)
        {
            return BadRequest(new { message = "A running allocation cannot be archived." });
        }

        history.Status = AllocationRunStatus.Archived.ToString();
        await _runHistory.SaveAsync(history);
        return NoContent();
    }

    private static AllocationRunReport BuildAllocationReport(
        IReadOnlyList<AllocationStageResult> stages,
        IReadOnlyList<AllocationDecision> decisions)
    {
        var processed = stages.Sum(stage => stage.CandidateCountBefore);
        var allocatedCandidateIds = decisions
            .Select(decision => decision.CandidateId)
            .Distinct()
            .ToHashSet();

        return new AllocationRunReport
        {
            TotalCandidatesProcessed = processed,
            TotalCandidatesAllocated = allocatedCandidateIds.Count,
            TotalCandidatesNotAllocated = Math.Max(0, processed - allocatedCandidateIds.Count),
            PhAllocated = decisions.Count(decision =>
                string.Equals(decision.VacancyType, "PH", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(decision.OriginalAllocatedType, "PH", StringComparison.OrdinalIgnoreCase)),
            DefenceAllocated = decisions.Count(decision =>
                string.Equals(decision.VacancyType, "Def", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(decision.OriginalAllocatedType, "Def", StringComparison.OrdinalIgnoreCase)),
            OrphanAllocated = decisions.Count(decision =>
                string.Equals(decision.VacancyType, "Orp", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(decision.OriginalAllocatedType, "Orp", StringComparison.OrdinalIgnoreCase)),
            GeneralAllocated = decisions.Count(decision =>
                string.Equals(decision.AllocatedType, "Gen", StringComparison.OrdinalIgnoreCase)),
            FemaleAllocated = decisions.Count(decision =>
                string.Equals(decision.AllocatedType, "Fem", StringComparison.OrdinalIgnoreCase)),
            Stages = stages.Select(stage => new AllocationStageReport
            {
                StageCode = stage.StageCode,
                CandidatesProcessed = stage.CandidateCountBefore,
                CandidatesAllocated = stage.CandidateCountAfter,
                CandidatesNotAllocated = Math.Max(0, stage.CandidateCountBefore - stage.CandidateCountAfter),
                DecisionsCreated = stage.DecisionsCreated,
                Status = stage.Status
            }).ToList()
        };
    }

    private async Task<PreparedAllocation> PrepareAsync(
        AllocationRunRequest request,
        bool allowIncompleteDraft = false,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.AllocationRunName))
            return PreparedAllocation.Fail("Allocation run name is required.");

        if (request.CapRound <= 0)
            return PreparedAllocation.Fail("CAP round must be greater than zero.");

        var step = AllocationConfiguration.GetStep(request.AllocationStep);
        if (step is null)
            return PreparedAllocation.Fail("The selected allocation step is not configured.");

        if (!step.Enabled)
            return PreparedAllocation.Fail("The selected allocation step is not available yet.");

        var candidateRuleIds = request.CandidateEligibilityRuleIds.Distinct().ToList();
        var seatDistributionRuleIds = request.SeatDistributionRuleIds.Distinct().ToList();
        var allocationTypeSequenceRuleIds = request.AllocationTypeSequenceRuleIds.Distinct().ToList();
        var selectedRuleIds = new List<int>();
        var detailedById = new Dictionary<int, RuleDefinition>();
        IReadOnlyDictionary<string, IReadOnlyList<AllocationRule>> builtRuleGroups;

        if (string.Equals(step.Code, AllocationConfiguration.Step0, StringComparison.OrdinalIgnoreCase))
        {
            if (candidateRuleIds.Count == 0 && seatDistributionRuleIds.Count == 0 &&
                allocationTypeSequenceRuleIds.Count == 0 &&
                request.RuleGroups.Count > 0)
            {
                candidateRuleIds = request.RuleGroups
                    .FirstOrDefault(group => string.Equals(group.Type, AllocationConfiguration.CandidateQualification, StringComparison.OrdinalIgnoreCase))?.RuleIds
                    .Distinct().ToList() ?? [];
                seatDistributionRuleIds = request.RuleGroups
                    .FirstOrDefault(group => string.Equals(group.Type, "STEP_0_SEAT_DISTRIBUTION", StringComparison.OrdinalIgnoreCase))?.RuleIds
                    .Distinct().ToList() ?? [];
                allocationTypeSequenceRuleIds = request.RuleGroups
                    .FirstOrDefault(group => string.Equals(group.Type, AllocationConfiguration.Step0AllocationTypeSequence, StringComparison.OrdinalIgnoreCase))?.RuleIds
                    .Distinct().ToList() ?? [];
            }

            if (!allowIncompleteDraft && candidateRuleIds.Count == 0)
                return PreparedAllocation.Fail("Select at least one candidate eligibility rule.");

            if (!allowIncompleteDraft && seatDistributionRuleIds.Count == 0)
                return PreparedAllocation.Fail("Select at least one seat distribution rule.");

            if (!allowIncompleteDraft && allocationTypeSequenceRuleIds.Count == 0)
                return PreparedAllocation.Fail("Select at least one allocation type & sequence rule.");

            selectedRuleIds = candidateRuleIds
                .Concat(seatDistributionRuleIds)
                .Concat(allocationTypeSequenceRuleIds)
                .Distinct()
                .ToList();
        }
        else
        {
            var ruleGroups = request.RuleGroups
                .Where(group => !string.IsNullOrWhiteSpace(group.Type))
                .Select(group => new AllocationRuleGroupRequest
                {
                    Type = group.Type.Trim().ToUpperInvariant(),
                    RuleIds = group.RuleIds.Distinct().ToList()
                })
                .Where(group => group.RuleIds.Count > 0)
                .ToList();

            if (ruleGroups.Count == 0 && !allowIncompleteDraft)
                return PreparedAllocation.Fail("Select at least one configured rule and assign it to a decision area.");

            if (!allowIncompleteDraft && string.Equals(step.Code, AllocationConfiguration.Step1, StringComparison.OrdinalIgnoreCase))
            {
                var requiredStep1Areas = new[]
                {
                    AllocationConfiguration.CandidateQualification,
                    AllocationConfiguration.PreferenceEvaluation,
                    AllocationConfiguration.SeatEligibility,
                    AllocationConfiguration.Step1AllocationTypeSequence,
                    AllocationConfiguration.Betterment
                };

                var missingStep1Areas = requiredStep1Areas
                    .Where(area => !ruleGroups.Any(group =>
                        string.Equals(group.Type, area, StringComparison.OrdinalIgnoreCase) &&
                        group.RuleIds.Count > 0))
                    .ToList();

                if (missingStep1Areas.Count > 0)
                    return PreparedAllocation.Fail($"Select at least one rule for: {string.Join(", ", missingStep1Areas)}.");
            }

            if (!allowIncompleteDraft)
            {
                var invalidGroups = ruleGroups
                    .Where(group => !AllocationConfiguration.IsDecisionAreaValid(step.Code, group.Type))
                    .Select(group => group.Type)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                if (invalidGroups.Count > 0)
                    return PreparedAllocation.Fail($"Invalid decision area(s) for {step.Name}: {string.Join(", ", invalidGroups)}.");
            }

            selectedRuleIds = ruleGroups.SelectMany(group => group.RuleIds).Distinct().ToList();

            foreach (var ruleId in selectedRuleIds)
            {
                var rule = await _ruleConfiguration.GetRuleAsync(ruleId);
                if (rule is null)
                {
                    if (!allowIncompleteDraft) return PreparedAllocation.Fail($"Selected rule {ruleId} could not be found.");
                    continue;
                }
                if (!rule.IsActive)
                {
                    if (!allowIncompleteDraft) return PreparedAllocation.Fail($"Selected rule {ruleId} is inactive.");
                    continue;
                }
                detailedById[rule.RuleId] = rule;
            }

            if (!allowIncompleteDraft && detailedById.Count != selectedRuleIds.Count)
                return PreparedAllocation.Fail("One or more selected rules could not be loaded.");

            try
            {
                builtRuleGroups = await BuildLegacyRuleGroupsAsync(step.Code, ruleGroups, detailedById, cancellationToken);
            }
            catch (InvalidOperationException ex)
            {
                return PreparedAllocation.Fail(ex.Message);
            }

            goto prepared;
        }

        foreach (var ruleId in selectedRuleIds)
        {
            var rule = await _ruleConfiguration.GetRuleAsync(ruleId);
            if (rule is null)
            {
                if (!allowIncompleteDraft) return PreparedAllocation.Fail($"Selected rule {ruleId} could not be found.");
                continue;
            }
            if (!rule.IsActive)
            {
                if (!allowIncompleteDraft) return PreparedAllocation.Fail($"Selected rule {ruleId} is inactive.");
                continue;
            }
            detailedById[rule.RuleId] = rule;
        }

        if (!allowIncompleteDraft && detailedById.Count != selectedRuleIds.Count)
            return PreparedAllocation.Fail("One or more selected rules could not be loaded.");

        if (!allowIncompleteDraft)
        {
            var invalidCandidateRules = candidateRuleIds
                .Where(id => detailedById.TryGetValue(id, out var rule) &&
                    !string.Equals(rule.DecisionAreaCode, AllocationConfiguration.CandidateQualification, StringComparison.OrdinalIgnoreCase))
                .ToList();
            if (invalidCandidateRules.Count > 0)
                return PreparedAllocation.Fail($"Rule(s) {string.Join(", ", invalidCandidateRules)} are not configured as Candidate Eligibility rules.");

            // Step 0 rule selection defines the meaning of each section. A reusable rule
            // may be selected into Seat Distribution or the combined Allocation Type &
            // Sequence section without coupling the allocation engine to a hardcoded procedure area.
        }

        try
        {
            builtRuleGroups = await BuildRuleGroupsAsync(
                step.Code,
                candidateRuleIds,
                seatDistributionRuleIds,
                allocationTypeSequenceRuleIds,
                detailedById,
                cancellationToken);
        }
        catch (InvalidOperationException ex)
        {
            return PreparedAllocation.Fail(ex.Message);
        }

prepared:
        var run = new AllocationRun
        {
            AllocationRunId = request.AllocationRunId ?? Guid.NewGuid(),
            AllocationRunName = request.AllocationRunName.Trim(),
            CapRound = request.CapRound,
            AllocationStep = step.Code,
            RuleSetVersionId = string.Equals(step.Code, AllocationConfiguration.Step0, StringComparison.OrdinalIgnoreCase)
                ? BuildRuleSetVersionId(step.Code, candidateRuleIds, seatDistributionRuleIds, allocationTypeSequenceRuleIds)
                : BuildLegacyRuleSetVersionId(step.Code, request.RuleGroups)
        };

        return new PreparedAllocation
        {
            Run = run,
            RuleGroups = builtRuleGroups,
            RuleDetails = detailedById
        };
    }

    private async Task SaveHistoryAsync(
        AllocationRun run,
        AllocationRunRequest request,
        IReadOnlyDictionary<int, RuleDefinition> rules,
        CancellationToken cancellationToken,
        string errorMessage = "",
        int decisionCount = 0,
        int candidateCount = 0,
        AllocationRunReport? report = null)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (!int.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var currentUserId))
            throw new UnauthorizedAccessException("Authenticated user id is missing.");

        await _runHistory.SaveAsync(new AllocationRunHistory
        {
            AllocationRunId = run.AllocationRunId,
            CreatedByUserId = currentUserId,
            AllocationRunName = run.AllocationRunName,
            CapRound = run.CapRound,
            AllocationStep = run.AllocationStep,
            Status = run.Status.ToString(),
            RuleGroupsJson = JsonSerializer.Serialize<object>(
                BuildRuleGroupsHistoryPayload(run.AllocationStep, request, rules, report)),
            CreatedAtUtc = run.CreatedAtUtc,
            StartedAtUtc = run.StartedAtUtc == default ? null : run.StartedAtUtc,
            CompletedAtUtc = run.CompletedAtUtc,
            CandidateCount = candidateCount,
            DecisionCount = decisionCount,
            ErrorMessage = errorMessage
        });
    }

    private static object BuildRuleGroupsHistoryPayload(
        string allocationStep,
        AllocationRunRequest request,
        IReadOnlyDictionary<int, RuleDefinition> rules,
        AllocationRunReport? report = null)
    {
        if (string.Equals(allocationStep, AllocationConfiguration.Step0, StringComparison.OrdinalIgnoreCase))
        {
            return new
            {
                candidateEligibilityRules = request.CandidateEligibilityRuleIds.Select(id => new
                {
                    ruleId = id,
                    ruleName = rules.TryGetValue(id, out var rule) ? rule.RuleName : string.Empty
                }).ToList(),
                seatDistributionRules = request.SeatDistributionRuleIds.Select(id => new
                {
                    ruleId = id,
                    ruleName = rules.TryGetValue(id, out var rule) ? rule.RuleName : string.Empty
                }).ToList(),
                allocationTypeSequenceRules = request.AllocationTypeSequenceRuleIds.Select(id => new
                {
                    ruleId = id,
                    ruleName = rules.TryGetValue(id, out var rule) ? rule.RuleName : string.Empty
                }).ToList(),
                report
            };
        }

        return new
        {
            groups = request.RuleGroups.Select(group => new
            {
                type = group.Type,
                rules = group.RuleIds.Select(id => new
                {
                    ruleId = id,
                    ruleName = rules.TryGetValue(id, out var rule) ? rule.RuleName : string.Empty
                }).ToList()
            }).ToList(),
            report
        };
    }

    private IReadOnlyList<IAllocationStage> BuildStages(string allocationStep)
    {
        return allocationStep.ToUpperInvariant() switch
        {
            AllocationConfiguration.Step0 =>
            [
                new Step0AllocationStage(_legacyAllocation, _step0CandidateRepository)
            ],
            AllocationConfiguration.Step1 =>
            [
                new Step1AllocationStage(_step1CandidateRepository, _legacyStep1Allocation)
            ],
            _ => throw new InvalidOperationException(
                $"Allocation step '{allocationStep}' is not implemented.")
        };
    }

    private async Task<IReadOnlyDictionary<string, IReadOnlyList<AllocationRule>>> BuildLegacyRuleGroupsAsync(
        string stepCode,
        IEnumerable<AllocationRuleGroupRequest> groups,
        IReadOnlyDictionary<int, RuleDefinition> rules,
        CancellationToken cancellationToken)
    {
        var result = new Dictionary<string, IReadOnlyList<AllocationRule>>(StringComparer.OrdinalIgnoreCase);
        foreach (var group in groups)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var mappedRules = group.RuleIds
                .Where(rules.ContainsKey)
                .Select(ruleId => ToAllocationRule(rules[ruleId], group.Type))
                .ToList();

            if (string.Equals(group.Type, AllocationConfiguration.Step1AllocationTypeSequence, StringComparison.OrdinalIgnoreCase))
            {
                for (var index = 0; index < mappedRules.Count; index++)
                {
                    mappedRules[index].SequenceId = index + 1;
                    mappedRules[index].DisplayOrder = index + 1;
                }
            }
            else
            {
                mappedRules = mappedRules
                    .OrderBy(rule => rule.DisplayOrder == 0 ? int.MaxValue : rule.DisplayOrder)
                    .ToList();
            }

            result[group.Type] = mappedRules;
        }
        return result;
    }

    private async Task<IReadOnlyDictionary<string, IReadOnlyList<AllocationRule>>> BuildRuleGroupsAsync(
        string stepCode,
        IReadOnlyList<int> candidateRuleIds,
        IReadOnlyList<int> seatDistributionRuleIds,
        IReadOnlyList<int> allocationTypeSequenceRuleIds,
        IReadOnlyDictionary<int, RuleDefinition> rules,
        CancellationToken cancellationToken)
    {
        var result = new Dictionary<string, IReadOnlyList<AllocationRule>>(StringComparer.OrdinalIgnoreCase);

        if (string.Equals(stepCode, AllocationConfiguration.Step0, StringComparison.OrdinalIgnoreCase))
        {
            var candidateRules = candidateRuleIds
                .Where(rules.ContainsKey)
                .Select(id => ToAllocationRule(rules[id], AllocationConfiguration.CandidateQualification))
                .OrderBy(rule => rule.DisplayOrder)
                .ToList();

            var seatDistributionRules = seatDistributionRuleIds
                .Where(rules.ContainsKey)
                .Select(id => ToAllocationRule(rules[id], AllocationConfiguration.Step0SeatDistribution))
                .ToList();

            var allocationTypeSequenceRules = allocationTypeSequenceRuleIds
                .Where(rules.ContainsKey)
                .Select(id => ToAllocationRule(rules[id], AllocationConfiguration.Step0AllocationTypeSequence))
                .Select((rule, index) =>
                {
                    // Allocation Run order is the sequence. The matched rule's
                    // outcome supplies AllocatedType.
                    rule.SequenceId = index + 1;
                    rule.DisplayOrder = index + 1;
                    return rule;
                })
                .ToList();

            result[AllocationConfiguration.CandidateQualification] = candidateRules;
            result[AllocationConfiguration.Step0SeatDistribution] = seatDistributionRules;
            result[AllocationConfiguration.Step0AllocationTypeSequence] = allocationTypeSequenceRules;
            return result;
        }

        if (string.Equals(stepCode, AllocationConfiguration.Step1, StringComparison.OrdinalIgnoreCase))
        {
            foreach (var group in new[] { AllocationConfiguration.CandidateQualification, AllocationConfiguration.PreferenceEvaluation, AllocationConfiguration.SeatEligibility, AllocationConfiguration.Step1AllocationTypeSequence, AllocationConfiguration.Betterment })
            {
                if (!result.ContainsKey(group))
                    result[group] = [];
            }
            return result;
        }

        throw new InvalidOperationException($"Allocation step '{stepCode}' must use its step-specific rule selection model.");
    }

    private static AllocationRule ToAllocationRule(
        RuleDefinition rule,
        string decisionArea)
    {
        RuleOutcome outcome;
        try
        {
            outcome = string.IsNullOrWhiteSpace(rule.OutcomeJson)
                ? new RuleOutcome()
                : JsonSerializer.Deserialize<RuleOutcome>(rule.OutcomeJson) ?? new RuleOutcome();

            outcome = ResolveOutcome(outcome);
        }
        catch (JsonException)
        {
            throw new InvalidOperationException($"Rule '{rule.RuleName}' contains invalid supporting values.");
        }

        var orderedConditions = rule.Conditions
            .OrderBy(condition => condition.GroupOrder)
            .ThenBy(condition => condition.ConditionOrder)
            .ToList();

        return new AllocationRule
        {
            Code = rule.RuleName,
            StageCode = decisionArea,
            DisplayOrder = rule.Priority,
            AllocatedType = outcome.AllocatedType ?? string.Empty,
            VacancyType = outcome.VacancyType ?? string.Empty,
            SeatCategory = outcome.SeatCategory ?? string.Empty,
            ReservationType = outcome.ReservationType ?? string.Empty,
            CandidateStatus = outcome.CandidateStatus ?? string.Empty,
            PreferenceMode = outcome.PreferenceMode ?? string.Empty,
            AllowBetterment = outcome.AllowBetterment,
            LogicalOperator = ResolveConditionLogicalOperator(rule),
            Conditions = orderedConditions
                .Select(condition => new api.Services.Allocation.RuleCondition(
                    condition.FieldName,
                    condition.Operator,
                    condition.Value,
                    condition.ConditionLogicalOperator,
                    condition.GroupOrder,
                    condition.ConditionOrder))
                .ToList(),
            Branches = rule.Branches
                .Where(branch => branch.IsActive)
                .OrderBy(branch => branch.BranchOrder)
                .Select(branch => new api.Services.Allocation.AllocationRuleBranch
                {
                    BranchOrder = branch.BranchOrder,
                    BranchName = branch.BranchName,
                    AllocationType = branch.AllocationType,
                    VacancySource = GetBranchOutcome(branch, "vacancySource"),
                    VacancyType = GetBranchOutcome(branch, "vacancyType"),
                    Sequence = branch.Sequence,
                    IsElse = branch.IsElse,
                    Conditions = branch.Conditions
                        .OrderBy(condition => condition.GroupOrder)
                        .ThenBy(condition => condition.ConditionOrder)
                        .Select(condition => new api.Services.Allocation.RuleCondition(
                            condition.FieldName,
                            condition.Operator,
                            condition.Value,
                            condition.ConditionLogicalOperator,
                            condition.GroupOrder,
                            condition.ConditionOrder))
                        .ToList()
                })
                .ToList()
        };
    }

    private static string GetBranchOutcome(RuleBranch branch, string key)
    {
        if (string.IsNullOrWhiteSpace(branch.OutcomeJson))
            return string.Empty;

        try
        {
            using var document = JsonDocument.Parse(branch.OutcomeJson);
            if (document.RootElement.TryGetProperty(key, out var value))
                return value.GetString() ?? string.Empty;

            var pascalKey = char.ToUpperInvariant(key[0]) + key[1..];
            return document.RootElement.TryGetProperty(pascalKey, out value)
                ? value.GetString() ?? string.Empty
                : string.Empty;
        }
        catch (JsonException)
        {
            throw new InvalidOperationException($"Rule branch contains invalid outcome configuration for '{key}'.");
        }
    }

    private static RuleOutcome ResolveOutcome(RuleOutcome outcome)
    {
        if (outcome.Values is null || outcome.Values.Count == 0)
            return outcome;

        foreach (var value in outcome.Values)
        {
            if (string.IsNullOrWhiteSpace(value.SupportingValue))
                continue;

            var key = value.SupportingValue.Trim();

            switch (key.ToLowerInvariant())
            {
                case "allocatedtype":
                    outcome.AllocatedType = value.Value ?? string.Empty;
                    break;

                case "vacancytype":
                    outcome.VacancyType = value.Value ?? string.Empty;
                    break;

                case "seatcategory":
                    outcome.SeatCategory = value.Value ?? string.Empty;
                    break;

                case "reservationtype":
                    outcome.ReservationType = value.Value ?? string.Empty;
                    break;

                case "candidatestatus":
                    outcome.CandidateStatus = value.Value ?? string.Empty;
                    break;

                case "preferencemode":
                    outcome.PreferenceMode = value.Value ?? string.Empty;
                    break;

                case "allowbetterment":
                    if (bool.TryParse(value.Value, out var allowBetterment))
                        outcome.AllowBetterment = allowBetterment;
                    break;
            }
        }

        return outcome;
    }

    private static string ResolveConditionLogicalOperator(RuleDefinition rule)
    {
        return rule.Conditions
            .OrderBy(condition => condition.GroupOrder)
            .ThenBy(condition => condition.ConditionOrder)
            .Select(condition => condition.ConditionLogicalOperator)
            .FirstOrDefault(value => !string.IsNullOrWhiteSpace(value))
            ?? "AND";
    }

    private static string BuildRuleSetVersionId(
        string allocationStep,
        IEnumerable<int> candidateRuleIds,
        IEnumerable<int> seatDistributionRuleIds,
        IEnumerable<int> allocationTypeSequenceRuleIds) =>
        $"{allocationStep}:candidate={string.Join(",", candidateRuleIds)}|seatDistribution={string.Join(",", seatDistributionRuleIds)}|allocationTypeSequence={string.Join(",", allocationTypeSequenceRuleIds)}";

    private static string BuildLegacyRuleSetVersionId(
        string allocationStep,
        IEnumerable<AllocationRuleGroupRequest> groups) =>
        $"{allocationStep}:{string.Join("|", groups.OrderBy(g => g.Type)
            .Select(g => $"{g.Type}={string.Join(",", g.RuleIds.OrderBy(id => id))}"))}";

    private sealed class PreparedAllocation
    {
        public AllocationRun? Run { get; init; }
        public IReadOnlyDictionary<string, IReadOnlyList<AllocationRule>>? RuleGroups { get; init; }
        public IReadOnlyDictionary<int, RuleDefinition>? RuleDetails { get; init; }
        public string? Error { get; init; }

        public static PreparedAllocation Fail(string message) => new() { Error = message };
    }
}

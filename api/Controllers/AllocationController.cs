using api.BusinessLogic.RuleConfiguration;
using api.DataAccess.Allocation;
using api.Models.Allocation;
using api.Models.RuleConfiguration;
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

    public AllocationController(
        IRuleConfigurationBL ruleConfiguration,
        ILogger<AllocationController> logger,
        AllocationRunHistoryDAL runHistory,
        LegacyAllocationDAL legacyAllocation,
        Step0CandidateRepository step0CandidateRepository)
    {
        _ruleConfiguration = ruleConfiguration;
        _logger = logger;
        _runHistory = runHistory;
        _legacyAllocation = legacyAllocation;
        _step0CandidateRepository = step0CandidateRepository;
    }

    [HttpGet("steps")]
    public ActionResult<IReadOnlyList<AllocationStepDefinition>> GetSteps() =>
        Ok(AllocationConfiguration.GetSteps());

    [HttpGet("history")]
    public async Task<ActionResult<IReadOnlyList<AllocationRunHistory>>> GetHistory(
        CancellationToken cancellationToken)
    {
        return Ok(await _runHistory.GetRecentAsync());
    }

    [HttpPost("draft")]
    public async Task<ActionResult<AllocationRunResponse>> SaveDraft(
        [FromBody] AllocationRunRequest request,
        CancellationToken cancellationToken)
    {
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

            await _runHistory.SaveDecisionsAsync(run.AllocationRunId, context.Decisions.ToList());
            await SaveHistoryAsync(run, request, prepared.RuleDetails!, cancellationToken, decisionCount: context.Decisions.Count, candidateCount: context.StageResults.Sum(stage => stage.CandidateCountAfter));

            return Ok(new AllocationRunResponse
            {
                Run = context.Run,
                Decisions = context.Decisions.ToList(),
                Stages = context.StageResults.ToList()
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
        var sequenceRuleIds = request.SequenceRuleIds.Distinct().ToList();

        // Backward compatibility for older clients/drafts. New Step 0 requests use
        // the two explicit rule selections above and do not expose decision areas.
        if (candidateRuleIds.Count == 0 && sequenceRuleIds.Count == 0 && request.RuleGroups.Count > 0)
        {
            candidateRuleIds = request.RuleGroups
                .FirstOrDefault(group => string.Equals(group.Type, AllocationConfiguration.CandidateQualification, StringComparison.OrdinalIgnoreCase))?.RuleIds
                .Distinct().ToList() ?? [];
            sequenceRuleIds = request.RuleGroups
                .FirstOrDefault(group => string.Equals(group.Type, AllocationConfiguration.SeatAllocation, StringComparison.OrdinalIgnoreCase))?.RuleIds
                .Distinct().ToList() ?? [];
        }

        if (!allowIncompleteDraft && candidateRuleIds.Count == 0)
            return PreparedAllocation.Fail("Select at least one candidate eligibility rule.");

        if (!allowIncompleteDraft && sequenceRuleIds.Count == 0)
            return PreparedAllocation.Fail("Select at least one sequence rule.");

        if (allowIncompleteDraft && !string.Equals(step.Code, AllocationConfiguration.Step0, StringComparison.OrdinalIgnoreCase))
        {
            // Other steps still use the legacy rule-group contract until their UI is migrated.
            candidateRuleIds = [];
            sequenceRuleIds = [];
        }

        var selectedRuleIds = candidateRuleIds
            .Concat(sequenceRuleIds)
            .Distinct()
            .ToList();

        var run = new AllocationRun
        {
            AllocationRunId = request.AllocationRunId ?? Guid.NewGuid(),
            AllocationRunName = request.AllocationRunName.Trim(),
            CapRound = request.CapRound,
            AllocationStep = step.Code,
            RuleSetVersionId = BuildRuleSetVersionId(step.Code, candidateRuleIds, sequenceRuleIds)
        };

        IReadOnlyDictionary<string, IReadOnlyList<AllocationRule>> builtRuleGroups;
        try
        {
            builtRuleGroups = await BuildRuleGroupsAsync(step.Code, candidateRuleIds, sequenceRuleIds, detailedById, cancellationToken);
        }
        catch (InvalidOperationException ex)
        {
            return PreparedAllocation.Fail(ex.Message);
        }

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
        int candidateCount = 0)
    {
        cancellationToken.ThrowIfCancellationRequested();

        await _runHistory.SaveAsync(new AllocationRunHistory
        {
            AllocationRunId = run.AllocationRunId,
            AllocationRunName = run.AllocationRunName,
            CapRound = run.CapRound,
            AllocationStep = run.AllocationStep,
            Status = run.Status.ToString(),
            RuleGroupsJson = JsonSerializer.Serialize(new
            {
                candidateEligibilityRules = request.CandidateEligibilityRuleIds.Select(id => new
                {
                    ruleId = id,
                    ruleName = rules.TryGetValue(id, out var rule) ? rule.RuleName : string.Empty
                }),
                sequenceRules = request.SequenceRuleIds.Select(id => new
                {
                    ruleId = id,
                    ruleName = rules.TryGetValue(id, out var rule) ? rule.RuleName : string.Empty
                })
            }),
            CreatedAtUtc = run.CreatedAtUtc,
            StartedAtUtc = run.StartedAtUtc == default ? null : run.StartedAtUtc,
            CompletedAtUtc = run.CompletedAtUtc,
            CandidateCount = candidateCount,
            DecisionCount = decisionCount,
            ErrorMessage = errorMessage
        });
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
                new CandidateQualificationStage(),
                new Step1AllocationStage(new SeatInventoryService())
            ],
            _ => throw new InvalidOperationException(
                $"Allocation step '{allocationStep}' is not implemented.")
        };
    }

    private async Task<IReadOnlyDictionary<string, IReadOnlyList<AllocationRule>>> BuildRuleGroupsAsync(
        string stepCode,
        IReadOnlyList<int> candidateRuleIds,
        IReadOnlyList<int> sequenceRuleIds,
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

            var sequenceRules = sequenceRuleIds
                .Where(rules.ContainsKey)
                .Select(id => ToAllocationRule(rules[id], AllocationConfiguration.Step0Sequence))
                .Select((rule, index) =>
                {
                    // Allocation Run order, not Rule Priority, is the SeqId.
                    rule.SequenceId = index + 1;
                    rule.DisplayOrder = index + 1;
                    return rule;
                })
                .ToList();

            result[AllocationConfiguration.CandidateQualification] = candidateRules;
            result[AllocationConfiguration.Step0Sequence] = sequenceRules;
            return result;
        }

        // Keep the existing grouped contract for steps that have not yet been migrated.
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
        IEnumerable<int> sequenceRuleIds) =>
        $"{allocationStep}:candidate={string.Join(",", candidateRuleIds)}|sequence={string.Join(",", sequenceRuleIds)}";

    private sealed class PreparedAllocation
    {
        public AllocationRun? Run { get; init; }
        public IReadOnlyDictionary<string, IReadOnlyList<AllocationRule>>? RuleGroups { get; init; }
        public IReadOnlyDictionary<int, RuleDefinition>? RuleDetails { get; init; }
        public string? Error { get; init; }

        public static PreparedAllocation Fail(string message) => new() { Error = message };
    }
}

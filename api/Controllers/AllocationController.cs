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

    public AllocationController(
        IRuleConfigurationBL ruleConfiguration,
        ILogger<AllocationController> logger,
        AllocationRunHistoryDAL runHistory,
        LegacyAllocationDAL legacyAllocation)
    {
        _ruleConfiguration = ruleConfiguration;
        _logger = logger;
        _runHistory = runHistory;
        _legacyAllocation = legacyAllocation;
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
        var prepared = await PrepareAsync(request, requireData: false, allowIncompleteDraft: true);
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
        var prepared = await PrepareAsync(request, requireData: true);
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
                request.Candidates,
                request.Seats,
                prepared.RuleGroups!,
                cancellationToken);

            await _runHistory.SaveDecisionsAsync(run.AllocationRunId, context.Decisions.ToList());
            await SaveHistoryAsync(run, request, prepared.RuleDetails!, cancellationToken, decisionCount: context.Decisions.Count);

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
        bool requireData,
        bool allowIncompleteDraft = false)
    {
        if (string.IsNullOrWhiteSpace(request.AllocationRunName))
            return PreparedAllocation.Fail("Allocation run name is required.");

        if (request.CapRound <= 0)
            return PreparedAllocation.Fail("CAP round must be greater than zero.");

        if (requireData && request.Candidates.Count == 0)
            return PreparedAllocation.Fail("At least one candidate is required.");

        if (requireData && request.Seats.Count == 0)
            return PreparedAllocation.Fail("At least one seat inventory record is required.");

        var step = AllocationConfiguration.GetStep(request.AllocationStep);
        if (step is null)
            return PreparedAllocation.Fail("The selected allocation step is not configured.");

        if (!step.Enabled)
            return PreparedAllocation.Fail("The selected allocation step is not available yet.");

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

        if (!allowIncompleteDraft)
        {
            var invalidGroups = ruleGroups
                .Where(group => !AllocationConfiguration.IsDecisionAreaValid(step.Code, group.Type))
                .Select(group => group.Type)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (invalidGroups.Count > 0)
                return PreparedAllocation.Fail(
                    $"Invalid decision area(s) for {step.Name}: {string.Join(", ", invalidGroups)}.");
        }

        var selectedRuleIds = ruleGroups
            .SelectMany(group => group.RuleIds)
            .Distinct()
            .ToList();

        var detailedById = new Dictionary<int, RuleDefinition>();
        if (!allowIncompleteDraft)
        {
            foreach (var ruleId in selectedRuleIds)
            {
                var rule = await _ruleConfiguration.GetRuleAsync(ruleId);
                if (rule is null)
                    return PreparedAllocation.Fail($"Selected rule {ruleId} could not be found.");

                if (!rule.IsActive)
                    return PreparedAllocation.Fail($"Selected rule {ruleId} is inactive.");

                detailedById[rule.RuleId] = rule;
            }

            if (detailedById.Count != selectedRuleIds.Count)
                return PreparedAllocation.Fail("One or more selected rules could not be loaded.");
        }
        if (!allowIncompleteDraft && detailedById.Count != selectedRuleIds.Count)
            return PreparedAllocation.Fail("One or more selected rules could not be loaded.");

        var run = new AllocationRun
        {
            AllocationRunId = request.AllocationRunId ?? Guid.NewGuid(),
            AllocationRunName = request.AllocationRunName.Trim(),
            CapRound = request.CapRound,
            AllocationStep = step.Code,
            RuleSetVersionId = BuildRuleSetVersionId(step.Code, ruleGroups)
        };

        return new PreparedAllocation
        {
            Run = run,
            RuleGroups = BuildRuleGroups(ruleGroups, detailedById),
            RuleDetails = detailedById
        };
    }

    private async Task SaveHistoryAsync(
        AllocationRun run,
        AllocationRunRequest request,
        IReadOnlyDictionary<int, RuleDefinition> rules,
        CancellationToken cancellationToken,
        string errorMessage = "",
        int decisionCount = 0)
    {
        cancellationToken.ThrowIfCancellationRequested();

        await _runHistory.SaveAsync(new AllocationRunHistory
        {
            AllocationRunId = run.AllocationRunId,
            AllocationRunName = run.AllocationRunName,
            CapRound = run.CapRound,
            AllocationStep = run.AllocationStep,
            Status = run.Status.ToString(),
            RuleGroupsJson = JsonSerializer.Serialize(
                request.RuleGroups
                    .Where(group => group.RuleIds.Count > 0)
                    .Select(group => new
                    {
                        type = group.Type,
                        rules = group.RuleIds.Select(id => new
                        {
                            ruleId = id,
                            ruleName = rules.TryGetValue(id, out var rule)
                                ? rule.RuleName
                                : string.Empty
                        })
                    })),
            CreatedAtUtc = run.CreatedAtUtc,
            StartedAtUtc = run.StartedAtUtc == default ? null : run.StartedAtUtc,
            CompletedAtUtc = run.CompletedAtUtc,
            CandidateCount = request.Candidates.Count,
            DecisionCount = decisionCount,
            ErrorMessage = errorMessage
        });
    }

    private IReadOnlyList<IAllocationStage> BuildStages(string allocationStep)
    {
        var ruleEvaluator = new RuleEvaluator();

        return allocationStep.ToUpperInvariant() switch
        {
            AllocationConfiguration.Step0 =>
            [
                new Step0AllocationStage(_legacyAllocation)
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

    private static IReadOnlyDictionary<string, IReadOnlyList<AllocationRule>> BuildRuleGroups(
        IEnumerable<AllocationRuleGroupRequest> groups,
        IReadOnlyDictionary<int, RuleDefinition> rules)
    {
        var result = new Dictionary<string, IReadOnlyList<AllocationRule>>(
            StringComparer.OrdinalIgnoreCase);

        foreach (var group in groups)
        {
            result[group.Type] = group.RuleIds
                .Where(rules.ContainsKey)
                .Select(ruleId => ToAllocationRule(rules[ruleId], group.Type))
                .ToList();
        }

        return result;
    }

    private static AllocationRule ToAllocationRule(
        RuleDefinition rule,
        string decisionArea)
    {
        var orderedConditions = rule.Conditions
            .OrderBy(condition => condition.GroupOrder)
            .ThenBy(condition => condition.ConditionOrder)
            .ToList();

        return new AllocationRule
        {
            Code = rule.RuleName,
            StageCode = decisionArea,
            LogicalOperator = ResolveConditionLogicalOperator(rule),
            Conditions = orderedConditions
                .Select(condition => new api.Services.Allocation.RuleCondition(
                    condition.FieldDisplayName,
                    condition.Operator,
                    condition.Value))
                .ToList()
        };
    }

    private static string ResolveConditionLogicalOperator(RuleDefinition rule)
    {
        var first = rule.Conditions
            .OrderBy(c => c.GroupOrder)
            .ThenBy(c => c.ConditionOrder)
            .FirstOrDefault();

        return first?.ConditionLogicalOperator?.Equals("OR", StringComparison.OrdinalIgnoreCase) == true
            ? "OR"
            : "AND";
    }

    private static string BuildRuleSetVersionId(
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

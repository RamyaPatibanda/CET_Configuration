using api.BusinessLogic.RuleConfiguration;
using api.Models.Allocation;
using api.Models.RuleConfiguration;
using api.Services.Allocation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace api.Controllers;

[Authorize]
[ApiController]
[Route("api/allocation")]
public sealed class AllocationController : ControllerBase
{
    private readonly IRuleConfigurationBL _ruleConfiguration;
    private readonly ILogger<AllocationController> _logger;

    public AllocationController(
        IRuleConfigurationBL ruleConfiguration,
        ILogger<AllocationController> logger)
    {
        _ruleConfiguration = ruleConfiguration;
        _logger = logger;
    }

    [HttpGet("steps")]
    public ActionResult<IReadOnlyList<AllocationStepDefinition>> GetSteps() =>
        Ok(AllocationConfiguration.GetSteps());

    [HttpPost("simulate")]
    public async Task<ActionResult<AllocationRunResponse>> Simulate(
        [FromBody] AllocationRunRequest request,
        CancellationToken cancellationToken)
    {
        if (request.CapRound <= 0)
            return BadRequest(new { message = "CAP round must be greater than zero." });

        if (request.Candidates.Count == 0)
            return BadRequest(new { message = "At least one candidate is required." });

        if (request.Seats.Count == 0)
            return BadRequest(new { message = "At least one seat inventory record is required." });

        var step = AllocationConfiguration.GetStep(request.AllocationStep);
        if (step is null)
            return BadRequest(new { message = "The selected allocation step is not configured." });

        if (!step.Enabled)
            return BadRequest(new { message = "The selected allocation step is not available yet." });

        var ruleGroups = request.RuleGroups
            .Where(group => !string.IsNullOrWhiteSpace(group.Type))
            .Select(group => new AllocationRuleGroupRequest
            {
                Type = group.Type.Trim().ToUpperInvariant(),
                RuleIds = group.RuleIds.Distinct().ToList()
            })
            .Where(group => group.RuleIds.Count > 0)
            .ToList();

        if (ruleGroups.Count == 0)
            return BadRequest(new { message = "Select at least one configured rule and assign it to a decision area." });

        var invalidGroups = ruleGroups
            .Where(group => !AllocationConfiguration.IsDecisionAreaValid(step.Code, group.Type))
            .Select(group => group.Type)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (invalidGroups.Count > 0)
        {
            return BadRequest(new
            {
                message = "One or more rule groups do not belong to the selected allocation step.",
                groups = invalidGroups
            });
        }

        try
        {
            var allRules = await _ruleConfiguration.GetRulesAsync();
            var selectedRuleIds = ruleGroups
                .SelectMany(group => group.RuleIds)
                .Distinct()
                .ToList();

            var selectedRules = allRules
                .Where(rule => rule.IsActive && selectedRuleIds.Contains(rule.RuleId))
                .OrderBy(rule => rule.Priority)
                .ToList();

            if (selectedRules.Count != selectedRuleIds.Count)
                return BadRequest(new { message = "One or more selected rules are missing or inactive." });

            var detailedRules = new List<RuleDefinition>();
            foreach (var rule in selectedRules)
            {
                var detailed = await _ruleConfiguration.GetRuleByIdAsync(rule.RuleId);
                if (detailed is not null)
                    detailedRules.Add(detailed);
            }

            var detailedById = detailedRules.ToDictionary(rule => rule.RuleId);
            if (detailedById.Count != selectedRuleIds.Count)
                return BadRequest(new { message = "One or more selected rules could not be loaded." });

            var configuredRuleGroups = BuildRuleGroups(ruleGroups, detailedById);

            var run = new AllocationRun
            {
                CapRound = request.CapRound,
                AllocationStep = step.Code,
                RuleSetVersionId = BuildRuleSetVersionId(step.Code, ruleGroups)
            };

            var stages = BuildStages(step.Code);
            var engine = new AllocationEngine(stages);
            var context = await engine.RunAsync(
                run,
                request.Candidates,
                request.Seats,
                configuredRuleGroups,
                cancellationToken);

            return Ok(new AllocationRunResponse
            {
                Run = context.Run,
                Decisions = context.Decisions,
                Stages = context.StageResults
            });
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Allocation simulation failed for CAP round {CapRound}, step {AllocationStep}.",
                request.CapRound,
                request.AllocationStep);

            return StatusCode(500, new { message = "Allocation simulation failed." });
        }
    }

    private static IReadOnlyList<IAllocationStage> BuildStages(string allocationStep)
    {
        var ruleEvaluator = new RuleEvaluator();

        return allocationStep.ToUpperInvariant() switch
        {
            AllocationConfiguration.Step0 =>
            [
                new CandidateQualificationStage(ruleEvaluator),
                new Step0AllocationStage(ruleEvaluator)
            ],
            AllocationConfiguration.Step1 =>
            [
                new CandidateQualificationStage(ruleEvaluator),
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
            var allocationRules = group.RuleIds
                .Where(rules.ContainsKey)
                .Select(ruleId => ToAllocationRule(rules[ruleId], group.Type))
                .ToList();

            result[group.Type] = allocationRules;
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
                .Select(condition => new RuleCondition(
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

        return first?.ConditionLogicalOperator is "OR" ? "OR" : "AND";
    }

    private static string BuildRuleSetVersionId(
        string allocationStep,
        IEnumerable<AllocationRuleGroupRequest> groups) =>
        $"{allocationStep}:{string.Join("|", groups.OrderBy(g => g.Type)
            .Select(g => $"{g.Type}={string.Join(",", g.RuleIds.OrderBy(id => id))}"))}";
}

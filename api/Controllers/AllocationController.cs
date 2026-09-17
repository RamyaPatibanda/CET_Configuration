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

    public AllocationController(IRuleConfigurationBL ruleConfiguration, ILogger<AllocationController> logger)
    {
        _ruleConfiguration = ruleConfiguration;
        _logger = logger;
    }

    [HttpGet("stages")]
    public ActionResult<IReadOnlyList<AllocationStage>> GetStages() => Ok(new List<AllocationStage>
    {
        new() { StageCode = "CANDIDATE_QUALIFICATION", Sequence = 10 },
        new() { StageCode = "SPECIAL_RESERVATION", Sequence = 20 },
        new() { StageCode = "SEAT_ALLOCATION", Sequence = 30 },
        new() { StageCode = "CONVERSION", Sequence = 40, Enabled = false },
        new() { StageCode = "BETTERMENT", Sequence = 50, Enabled = false },
        new() { StageCode = "RECONCILIATION", Sequence = 60, Enabled = false }
    });

    [HttpPost("simulate")]
    public async Task<ActionResult<AllocationRunResponse>> Simulate(
        [FromBody] AllocationRunRequest request,
        CancellationToken cancellationToken)
    {
        if (request.CapRound <= 0) return BadRequest(new { message = "CAP round must be greater than zero." });
        if (request.Candidates.Count == 0) return BadRequest(new { message = "At least one candidate is required." });
        if (request.Seats.Count == 0) return BadRequest(new { message = "At least one seat inventory record is required." });
        if (request.SelectedRuleIds.Count == 0) return BadRequest(new { message = "At least one configured rule must be selected." });

        try
        {
            var allRules = await _ruleConfiguration.GetRulesAsync();
            var selectedRules = allRules
                .Where(rule => rule.IsActive && request.SelectedRuleIds.Contains(rule.RuleId))
                .OrderBy(rule => rule.Priority)
                .ToList();

            if (selectedRules.Count != request.SelectedRuleIds.Distinct().Count())
                return BadRequest(new { message = "One or more selected rules are missing or inactive." });

            var detailedRules = new List<RuleDefinition>();
            foreach (var rule in selectedRules)
            {
                var detailed = await _ruleConfiguration.GetRuleAsync(rule.RuleId);
                if (detailed is not null) detailedRules.Add(detailed);
            }

            var run = new AllocationRun
            {
                CapRound = request.CapRound,
                RuleSetVersionId = string.Join(",", selectedRules.Select(rule => rule.RuleId))
            };

            var configuredStep0Rules = BuildStep0Rules(detailedRules);
            var stages = new IAllocationStage[]
            {
                new CandidateQualificationStage(),
                new Step0AllocationStage(new RuleEvaluator(), configuredStep0Rules),
                new Step1AllocationStage(new SeatInventoryService())
            };

            var engine = new AllocationEngine(stages);
            var context = await engine.RunAsync(run, request.Candidates, request.Seats, cancellationToken);

            return Ok(new AllocationRunResponse
            {
                Run = context.Run,
                Decisions = context.Decisions.ToList(),
                Stages = context.StageResults.ToList()
            });
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Allocation simulation failed for CAP round {CapRound}.", request.CapRound);
            return StatusCode(500, new { message = "Allocation simulation failed." });
        }
    }

    private static IReadOnlyList<AllocationRule> BuildStep0Rules(IEnumerable<RuleDefinition> rules) =>
        rules
            .Where(rule => rule.Conditions.Count > 0)
            .Select(rule => new AllocationRule
            {
                Code = rule.RuleName,
                StageCode = "SPECIAL_RESERVATION",
                LogicalOperator = ResolveConditionLogicalOperator(rule),
                Conditions = rule.Conditions
                    .OrderBy(condition => condition.GroupOrder)
                    .ThenBy(condition => condition.ConditionOrder)
                    .Select(condition => new RuleCondition(condition.FieldDisplayName, condition.Operator, condition.Value))
                    .ToList()
            })
            .ToList();

    private static string ResolveConditionLogicalOperator(RuleDefinition rule)
    {
        var first = rule.Conditions
            .OrderBy(c => c.GroupOrder)
            .ThenBy(c => c.ConditionOrder)
            .FirstOrDefault();
        return first?.ConditionLogicalOperator is "OR" ? "OR" : "AND";
    }
}

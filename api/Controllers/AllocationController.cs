using api.Models.Allocation;
using api.Services.Allocation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace api.Controllers;

[Authorize]
[ApiController]
[Route("api/allocation")]
public sealed class AllocationController : ControllerBase
{
    private readonly ILogger<AllocationController> _logger;

    public AllocationController(ILogger<AllocationController> logger)
    {
        _logger = logger;
    }

    [HttpGet("stages")]
    public ActionResult<IReadOnlyList<AllocationStage>> GetStages()
    {
        return Ok(new List<AllocationStage>
        {
            new() { StageCode = "CANDIDATE_QUALIFICATION", Sequence = 10 },
            new() { StageCode = "SPECIAL_RESERVATION", Sequence = 20 },
            new() { StageCode = "SEAT_ALLOCATION", Sequence = 30 },
            new() { StageCode = "CONVERSION", Sequence = 40, Enabled = false },
            new() { StageCode = "BETTERMENT", Sequence = 50, Enabled = false },
            new() { StageCode = "RECONCILIATION", Sequence = 60, Enabled = false }
        });
    }

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

        try
        {
            var run = new AllocationRun
            {
                CapRound = request.CapRound,
                RuleSetVersionId = string.IsNullOrWhiteSpace(request.RuleSetVersionId)
                    ? "draft-runtime"
                    : request.RuleSetVersionId
            };

            var stages = new IAllocationStage[]
            {
                new CandidateQualificationStage(),
                new Step0AllocationStage(
                    new RuleEvaluator(),
                    new SeatInventoryService(),
                    AllocationRuleCatalog.Step0Defaults),
                new Step1AllocationStage(new SeatInventoryService())
            };

            var engine = new AllocationEngine(stages);
            var context = await engine.RunAsync(
                run,
                request.Candidates,
                request.Seats,
                cancellationToken);

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
}

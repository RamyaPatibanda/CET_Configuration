using api.BusinessLogic.RuleConfiguration;
using api.Models.RuleConfiguration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/rule-configuration")]
    public class RuleConfigurationController : ControllerBase
    {
        private readonly IRuleConfigurationBL _businessLogic;
        private readonly ILogger<RuleConfigurationController> _logger;

        public RuleConfigurationController(
            IRuleConfigurationBL businessLogic,
            ILogger<RuleConfigurationController> logger)
        {
            _businessLogic = businessLogic;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<List<RuleDefinition>>> GetRules()
        {
            try
            {
                return Ok(await _businessLogic.GetRulesAsync());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while getting rules.");
                return StatusCode(500, new { message = "Unable to get rules." });
            }
        }

        [HttpGet("fields")]
        public async Task<ActionResult<List<RuleFieldOption>>> GetFields()
        {
            try
            {
                return Ok(await _businessLogic.GetActiveFieldsAsync());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while getting active rule fields.");
                return StatusCode(500, new { message = "Unable to get rule fields." });
            }
        }

        [HttpGet("decision-options")]
        public ActionResult<List<RuleDecisionOption>> GetDecisionOptions()
        {
            return Ok(_businessLogic.GetDecisionOptions());
        }

        [HttpGet("{ruleId:int}")]
        public async Task<ActionResult<RuleDefinition>> GetRule(int ruleId)
        {
            try
            {
                var rule = await _businessLogic.GetRuleAsync(ruleId);

                return rule is null
                    ? NotFound(new { message = "Rule not found." })
                    : Ok(rule);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while getting rule {RuleId}.", ruleId);
                return StatusCode(500, new { message = "Unable to get rule." });
            }
        }

        [HttpPost]
        public async Task<ActionResult<int>> CreateRule([FromBody] CreateRuleRequest request)
        {
            try
            {
                var ruleId = await _businessLogic.CreateRuleAsync(request);

                return Ok(new
                {
                    ruleId,
                    message = "Rule created successfully."
                });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while creating rule.");
                return StatusCode(500, new { message = "Unable to create rule." });
            }
        }

        [HttpPut("{ruleId:int}")]
        public async Task<IActionResult> UpdateRule(
            int ruleId,
            [FromBody] UpdateRuleRequest request)
        {
            try
            {
                request.RuleId = ruleId;

                var updated = await _businessLogic.UpdateRuleAsync(request);

                return updated
                    ? Ok(new { message = "Rule updated successfully." })
                    : NotFound(new { message = "Rule not found." });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while updating rule {RuleId}.", ruleId);
                return StatusCode(500, new { message = "Unable to update rule." });
            }
        }

        [HttpPatch("{ruleId:int}/active")]
        public async Task<IActionResult> SetRuleActive(
            int ruleId,
            [FromBody] bool isActive)
        {
            try
            {
                var updated = await _businessLogic.SetRuleActiveAsync(ruleId, isActive);

                return updated
                    ? Ok(new { message = "Rule status updated successfully." })
                    : NotFound(new { message = "Rule not found." });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while changing active state for rule {RuleId}.", ruleId);
                return StatusCode(500, new { message = "Unable to update rule status." });
            }
        }

        [HttpPut("order")]
        public async Task<IActionResult> ReorderRules(
            [FromBody] ReorderRulesRequest request)
        {
            try
            {
                await _businessLogic.ReorderRulesAsync(request.RuleIds);
                return Ok(new { message = "Rule order updated successfully." });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while reordering rules.");
                return StatusCode(500, new { message = "Unable to reorder rules." });
            }
        }

        [HttpDelete("{ruleId:int}")]
        public async Task<IActionResult> DeleteRule(int ruleId)
        {
            try
            {
                var deleted = await _businessLogic.DeleteRuleAsync(ruleId);

                return deleted
                    ? Ok(new { message = "Rule deleted successfully." })
                    : NotFound(new { message = "Rule not found." });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while deleting rule {RuleId}.", ruleId);
                return StatusCode(500, new { message = "Unable to delete rule." });
            }
        }
    }
}

using api.BusinessLogic.FieldConfiguration;
using api.Models.FieldConfiguration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/field-configuration")]
    public class FieldConfigurationController : ControllerBase
    {
        private readonly IFieldConfigurationBL _businessLogic;
        private readonly ILogger<FieldConfigurationController> _logger;

        public FieldConfigurationController(IFieldConfigurationBL businessLogic, ILogger<FieldConfigurationController> logger)
        {
            _businessLogic = businessLogic;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<List<FieldDefinition>>> GetFields()
        {
            try { return Ok(await _businessLogic.GetFieldsAsync()); }
            catch (Exception ex) { _logger.LogError(ex, "Error while getting fields."); return StatusCode(500, new { message = "Unable to get fields." }); }
        }

        [HttpGet("tables")]
        public async Task<ActionResult<List<FieldSourceOption>>> GetTables()
        {
            try { return Ok(await _businessLogic.GetAllowedTablesAsync()); }
            catch (Exception ex) { _logger.LogError(ex, "Error while getting configured tables."); return StatusCode(500, new { message = "Unable to get configured tables." }); }
        }

        [HttpGet("columns")]
        public async Task<ActionResult<List<FieldSourceOption>>> GetColumns([FromQuery] string tableName)
        {
            try { return Ok(await _businessLogic.GetColumnsAsync(tableName)); }
            catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
            catch (Exception ex) { _logger.LogError(ex, "Error while getting columns for table {TableName}.", tableName); return StatusCode(500, new { message = "Unable to get table columns." }); }
        }

        [HttpGet("{fieldId:int}")]
        public async Task<ActionResult<FieldDefinition>> GetField(int fieldId)
        {
            try
            {
                var field = await _businessLogic.GetFieldAsync(fieldId);
                return field is null ? NotFound(new { message = "Field not found." }) : Ok(field);
            }
            catch (Exception ex) { _logger.LogError(ex, "Error while getting field {FieldId}.", fieldId); return StatusCode(500, new { message = "Unable to get field." }); }
        }

        [HttpPost("create")]
        public async Task<ActionResult<int>> CreateField([FromBody] CreateFieldRequest request)
        {
            try
            {
                var fieldId = await _businessLogic.CreateFieldAsync(request);
                return Ok(new { fieldId, message = "Field created successfully." });
            }
            catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
            catch (Exception ex) { _logger.LogError(ex, "Error while creating field."); return StatusCode(500, new { message = "Unable to create field." }); }
        }

        [HttpPut("{fieldId:int}")]
        public async Task<IActionResult> UpdateField(int fieldId, [FromBody] UpdateFieldRequest request)
        {
            try
            {
                request.FieldId = fieldId;
                var updated = await _businessLogic.UpdateFieldAsync(request);
                return updated ? Ok(new { message = "Field updated successfully." }) : NotFound(new { message = "Field not found." });
            }
            catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
            catch (Exception ex) { _logger.LogError(ex, "Error while updating field {FieldId}.", fieldId); return StatusCode(500, new { message = "Unable to update field." }); }
        }

        [HttpDelete("{fieldId:int}")]
        public async Task<IActionResult> DeleteField(int fieldId)
        {
            try
            {
                var deleted = await _businessLogic.DeleteFieldAsync(fieldId);
                return deleted ? Ok(new { message = "Field deleted successfully." }) : NotFound(new { message = "Field not found." });
            }
            catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
            catch (Exception ex) { _logger.LogError(ex, "Error while deleting field {FieldId}.", fieldId); return StatusCode(500, new { message = "Unable to delete field." }); }
        }
    }
}

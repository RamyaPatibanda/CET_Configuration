using api.BusinessLogic.FieldConfiguration;
using api.Models.FieldConfiguration;
using api.BusinessLogic.UserManagement;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/field-configuration")]
    public class FieldConfigurationController : ControllerBase
    {
        private readonly IFieldConfigurationBL _businessLogic;
        private readonly ILogger<FieldConfigurationController> _logger;
        private readonly UserPermissionService _permissions;

        public FieldConfigurationController(IFieldConfigurationBL businessLogic, ILogger<FieldConfigurationController> logger, UserPermissionService permissions)
        {
            _businessLogic = businessLogic;
            _logger = logger;
            _permissions = permissions;
        }

        [HttpGet]
        public async Task<ActionResult<List<FieldDefinition>>> GetFields()
        {
            if (!await _permissions.HasReadAsync(User, api.Models.UserManagement.UserPermissionModules.Fields))
                return Forbid();
            try { return Ok(await _businessLogic.GetFieldsAsync()); }
            catch (Exception ex) { _logger.LogError(ex, "Error while getting fields."); return StatusCode(500, new { message = "Unable to get fields." }); }
        }

        [HttpGet("tables")]
        public async Task<ActionResult<List<FieldSourceOption>>> GetTables()
        {
            if (!await _permissions.HasReadAsync(User, api.Models.UserManagement.UserPermissionModules.Fields))
                return Forbid();
            try { return Ok(await _businessLogic.GetAllowedTablesAsync()); }
            catch (Exception ex) { _logger.LogError(ex, "Error while getting configured tables."); return StatusCode(500, new { message = "Unable to get configured tables." }); }
        }

        [HttpGet("columns")]
        public async Task<ActionResult<List<FieldSourceOption>>> GetColumns([FromQuery] string tableName)
        {
            if (!await _permissions.HasReadAsync(User, api.Models.UserManagement.UserPermissionModules.Fields))
                return Forbid();
            try { return Ok(await _businessLogic.GetColumnsAsync(tableName)); }
            catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
            catch (Exception ex) { _logger.LogError(ex, "Error while getting columns for table {TableName}.", tableName); return StatusCode(500, new { message = "Unable to get table columns." }); }
        }

        [HttpGet("{fieldId:int}")]
        public async Task<ActionResult<FieldDefinition>> GetField(int fieldId)
        {
            if (!await _permissions.HasReadAsync(User, api.Models.UserManagement.UserPermissionModules.Fields))
                return Forbid();
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
            if (!await _permissions.HasWriteAsync(User, api.Models.UserManagement.UserPermissionModules.Fields))
                return Forbid();
            try
            {
                if (!int.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var currentUserId)) return Unauthorized();
                request.CreatedByUserId = currentUserId;
                var fieldId = await _businessLogic.CreateFieldAsync(request);
                return Ok(new { fieldId, message = "Field created successfully." });
            }
            catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
            catch (SqlException ex) when (ex.Number == 50301 || ex.Number == 2601 || ex.Number == 2627)
            {
                return BadRequest(new { message = "Field already exists for the specified table and field name." });
            }
            catch (Exception ex) { _logger.LogError(ex, "Error while creating field."); return StatusCode(500, new { message = "Unable to create field." }); }
        }

        [HttpPut("{fieldId:int}")]
        public async Task<IActionResult> UpdateField(int fieldId, [FromBody] UpdateFieldRequest request)
        {
            if (!await _permissions.HasWriteAsync(User, api.Models.UserManagement.UserPermissionModules.Fields))
                return Forbid();
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
            if (!await _permissions.HasWriteAsync(User, api.Models.UserManagement.UserPermissionModules.Fields))
                return Forbid();
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

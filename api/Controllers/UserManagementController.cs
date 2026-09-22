using api.BusinessLogic.UserManagement;
using api.Models.UserManagement;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(Roles = "admin")]
public sealed class UserManagementController : ControllerBase
{
    private readonly IUserManagementBL _userManagementBL;
    private readonly ILogger<UserManagementController> _logger;

    public UserManagementController(IUserManagementBL userManagementBL, ILogger<UserManagementController> logger)
    {
        _userManagementBL = userManagementBL;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<UserDefinition>>> GetUsers()
    {
        try
        {
            return Ok(await _userManagementBL.GetUsersAsync());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error while loading users.");
            return StatusCode(500, new { message = "Unable to load users." });
        }
    }

    [HttpGet("permission-catalog")]
    public ActionResult<IReadOnlyList<UserPermission>> GetPermissionCatalog()
    {
        return Ok(UserPermissionModules.Names
            .Select(item => new UserPermission
            {
                ModuleCode = item.Key,
                ModuleName = item.Value,
                CanRead = false,
                CanWrite = false
            })
            .OrderBy(item => item.ModuleCode)
            .ToList());
    }

    [HttpPost]
    public async Task<ActionResult> CreateUser([FromBody] CreateUserRequest request)
    {
        try
        {
            var userId = await _userManagementBL.CreateUserAsync(request);
            return Ok(new { userId, message = "User created successfully." });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error while creating user {Username}.", request?.Username);
            return StatusCode(500, new { message = "Unable to create user." });
        }
    }
}

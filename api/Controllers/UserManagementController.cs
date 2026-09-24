using api.BusinessLogic.UserManagement;
using api.Models.UserManagement;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public sealed class UserManagementController : ControllerBase
{
    private readonly IUserManagementBL _userManagementBL;
    private readonly ILogger<UserManagementController> _logger;

    public UserManagementController(IUserManagementBL userManagementBL, ILogger<UserManagementController> logger)
    {
        _userManagementBL = userManagementBL;
        _logger = logger;
    }


    [Authorize]
    [HttpPost("me/password")]
    public async Task<ActionResult> ChangeOwnPassword([FromBody] ChangeOwnPasswordRequest request)
    {
        try
        {
            var claim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(claim, out var userId))
                return Unauthorized(new { message = "User identity could not be determined." });

            await _userManagementBL.ChangeOwnPasswordAsync(userId, request);
            return Ok(new { message = "Password changed successfully." });
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error while changing password.");
            return StatusCode(500, new { message = "Unable to change password." });
        }
    }

    [Authorize(Roles = "admin")]
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

    [Authorize(Roles = "admin")]
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

    [Authorize(Roles = "admin")]
    [HttpGet("{userId:int}/permissions")]
    public async Task<ActionResult<IReadOnlyList<UserPermission>>> GetUserPermissions(int userId)
    {
        try { return Ok(await _userManagementBL.GetUserPermissionsAsync(userId)); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error while loading permissions for user {UserId}.", userId);
            return StatusCode(500, new { message = "Unable to load user permissions." });
        }
    }

    [Authorize(Roles = "admin")]
    [HttpPut("{userId:int}")]
    public async Task<ActionResult> UpdateUser(int userId, [FromBody] UpdateUserRequest request)
    {
        try
        {
            await _userManagementBL.UpdateUserAsync(userId, request);
            return Ok(new { message = "User updated successfully." });
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error while updating user {UserId}.", userId);
            return StatusCode(500, new { message = "Unable to update user." });
        }
    }

    [Authorize(Roles = "admin")]
    [HttpDelete("{userId:int}")]
    public async Task<ActionResult> DeleteUser(int userId)
    {
        try
        {
            await _userManagementBL.DeleteUserAsync(userId);
            return Ok(new { message = "User deleted successfully." });
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error while deleting user {UserId}.", userId);
            return StatusCode(500, new { message = "Unable to delete user." });
        }
    }

    [Authorize(Roles = "admin")]
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

using api.DataAccess;
using api.Models.UserManagement;
using System.Security.Claims;

namespace api.BusinessLogic.UserManagement;

public sealed class UserPermissionService
{
    private readonly CETDataAccess _dataAccess;

    public UserPermissionService(CETDataAccess dataAccess)
    {
        _dataAccess = dataAccess;
    }

    public async Task<bool> HasReadAsync(ClaimsPrincipal user, string moduleCode)
        => await HasPermissionAsync(user, moduleCode, write: false);

    public async Task<bool> HasWriteAsync(ClaimsPrincipal user, string moduleCode)
        => await HasPermissionAsync(user, moduleCode, write: true);

    private async Task<bool> HasPermissionAsync(ClaimsPrincipal user, string moduleCode, bool write)
    {
        if (user.IsInRole("admin"))
            return true;

        var userIdValue = user.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? user.FindFirstValue(ClaimTypes.Name)
            ?? user.FindFirstValue(ClaimTypes.NameIdentifier);

        if (!int.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return false;

        return await _dataAccess.HasUserPermissionAsync(userId, moduleCode, write);
    }
}

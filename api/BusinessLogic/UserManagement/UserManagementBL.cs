using api.DataAccess;
using api.Models.UserManagement;
using api.Utils;

namespace api.BusinessLogic.UserManagement;

public sealed class UserManagementBL : IUserManagementBL
{
    private readonly CETDataAccess _dataAccess;
    private readonly ConnectionUtils _connectionUtils;
    private readonly int ProtectedUserAdminId = 1;

    public UserManagementBL(CETDataAccess dataAccess)
    {
        _dataAccess = dataAccess;
        _connectionUtils = new ConnectionUtils();
    }

    public Task<IReadOnlyList<UserDefinition>> GetUsersAsync()
        => _dataAccess.GetUsersAsync();

    public Task<IReadOnlyList<UserPermission>> GetUserPermissionsAsync(int userId)
        => _dataAccess.GetUserPermissionsAsync(userId);

    public Task<int> CreateUserAsync(CreateUserRequest request)
    {
        if (request is null)
            throw new ArgumentNullException(nameof(request));

        var username = request.Username.Trim();
        var displayName = request.DisplayName.Trim();

        if (string.IsNullOrWhiteSpace(username))
            throw new ArgumentException("Username is required.");

        if (string.IsNullOrWhiteSpace(displayName))
            throw new ArgumentException("Display name is required.");

        var password = string.IsNullOrWhiteSpace(request.Password) ? "talisma1" : request.Password;

        if (username.Length > 100)
            throw new ArgumentException("Username cannot exceed 100 characters.");

        if (displayName.Length > 200)
            throw new ArgumentException("Display name cannot exceed 200 characters.");

        var permissions = (request.Permissions ?? [])
            .GroupBy(permission => permission.ModuleCode?.Trim() ?? string.Empty, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.Last())
            .ToList();

        foreach (var permission in permissions)
        {
            if (!UserPermissionModules.Names.ContainsKey(permission.ModuleCode))
                throw new ArgumentException($"Invalid permission module '{permission.ModuleCode}'.");

            if (permission.CanWrite && !permission.CanRead)
                throw new ArgumentException($"{UserPermissionModules.Names[permission.ModuleCode]} write permission requires read permission.");
        }

        if (request.IsAdmin)
            permissions.Clear();

        var encryptedPassword = _connectionUtils.GetEncryptedValue(password);
        return _dataAccess.CreateUserAsync(
            username,
            encryptedPassword,
            displayName,
            request.IsAdmin,
            request.IsActive,
            permissions);
    }

    public async Task UpdateUserAsync(int userId, UpdateUserRequest request)
    {
        if (request is null) throw new ArgumentNullException(nameof(request));
        if (userId == ProtectedUserAdminId)
            throw new ArgumentException("The default User Admin cannot be edited.");
        var displayName = request.DisplayName.Trim();
        if (userId <= 0) throw new ArgumentException("Invalid user.");
        if (string.IsNullOrWhiteSpace(displayName)) throw new ArgumentException("Display name is required.");
        if (displayName.Length > 200) throw new ArgumentException("Display name cannot exceed 200 characters.");

        var permissions = (request.Permissions ?? [])
            .GroupBy(permission => permission.ModuleCode?.Trim() ?? string.Empty, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.Last())
            .ToList();

        foreach (var permission in permissions)
        {
            permission.ModuleCode = permission.ModuleCode.Trim().ToUpperInvariant();
            if (!UserPermissionModules.Names.ContainsKey(permission.ModuleCode))
                throw new ArgumentException($"Invalid permission module '{permission.ModuleCode}'.");
            permission.CanRead = true;
        }

        if (request.IsAdmin) permissions.Clear();

        var encryptedPassword = string.IsNullOrWhiteSpace(request.Password)
            ? null
            : _connectionUtils.GetEncryptedValue(request.Password);

        await _dataAccess.UpdateUserAsync(
            userId, displayName, encryptedPassword, request.IsAdmin, request.IsActive, permissions);
    }

    public Task DeleteUserAsync(int userId)
    {
        if (userId <= 0) throw new ArgumentException("Invalid user.");
        if (userId == ProtectedUserAdminId)
            throw new ArgumentException("The default User Admin cannot be deleted.");
        return _dataAccess.DeleteUserAsync(userId);
    }
    public async Task ChangeOwnPasswordAsync(int userId, ChangeOwnPasswordRequest request)
    {
        if (request is null) throw new ArgumentNullException(nameof(request));
        if (userId <= 0) throw new ArgumentException("Invalid user.");
        if (string.IsNullOrWhiteSpace(request.CurrentPassword) || string.IsNullOrWhiteSpace(request.NewPassword))
            throw new ArgumentException("Current password and new password are required.");
        if (request.NewPassword.Length < 6)
            throw new ArgumentException("New password must contain at least 6 characters.");

        var user = await _dataAccess.GetLoginUserByIdAsync(userId)
            ?? throw new ArgumentException("User not found.");
        var currentPassword = _connectionUtils.getDecryptedValue(user.Password);
        if (!string.Equals(currentPassword, request.CurrentPassword, StringComparison.Ordinal))
            throw new ArgumentException("Current password is incorrect.");

        var encrypted = _connectionUtils.GetEncryptedValue(request.NewPassword);
        await _dataAccess.ChangePasswordAsync(userId, encrypted);
    }

}


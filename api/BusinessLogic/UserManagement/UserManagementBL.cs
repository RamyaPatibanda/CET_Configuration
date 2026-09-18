using api.DataAccess;
using api.Models.UserManagement;
using api.Utils;

namespace api.BusinessLogic.UserManagement;

public sealed class UserManagementBL : IUserManagementBL
{
    private readonly CETDataAccess _dataAccess;
    private readonly ConnectionUtils _connectionUtils;

    public UserManagementBL(CETDataAccess dataAccess)
    {
        _dataAccess = dataAccess;
        _connectionUtils = new ConnectionUtils();
    }

    public Task<IReadOnlyList<UserDefinition>> GetUsersAsync()
        => _dataAccess.GetUsersAsync();

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

        if (string.IsNullOrWhiteSpace(request.Password))
            throw new ArgumentException("Password is required.");

        if (username.Length > 100)
            throw new ArgumentException("Username cannot exceed 100 characters.");

        if (displayName.Length > 200)
            throw new ArgumentException("Display name cannot exceed 200 characters.");

        var encryptedPassword = _connectionUtils.GetEncryptedValue(request.Password);
        return _dataAccess.CreateUserAsync(username, encryptedPassword, displayName, request.IsAdmin, request.IsActive);
    }
}

using api.Models.UserManagement;

namespace api.BusinessLogic.UserManagement;

public interface IUserManagementBL
{
    Task<IReadOnlyList<UserDefinition>> GetUsersAsync();
    Task<int> CreateUserAsync(CreateUserRequest request);
    Task<IReadOnlyList<UserPermission>> GetUserPermissionsAsync(int userId);
    Task UpdateUserAsync(int userId, UpdateUserRequest request);
    Task DeleteUserAsync(int userId);
}

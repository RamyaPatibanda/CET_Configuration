using api.Models.UserManagement;

namespace api.BusinessLogic.UserManagement;

public interface IUserManagementBL
{
    Task<IReadOnlyList<UserDefinition>> GetUsersAsync();
    Task<int> CreateUserAsync(CreateUserRequest request);\n    Task<IReadOnlyList<UserPermission>> GetUserPermissionsAsync(int userId);\n    Task UpdateUserAsync(int userId, UpdateUserRequest request);\n    Task DeleteUserAsync(int userId);
    Task<IReadOnlyList<UserPermission>> GetUserPermissionsAsync(int userId);
}

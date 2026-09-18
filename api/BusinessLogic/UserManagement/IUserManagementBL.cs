using api.Models.UserManagement;

namespace api.BusinessLogic.UserManagement;

public interface IUserManagementBL
{
    Task<IReadOnlyList<UserDefinition>> GetUsersAsync();
    Task<int> CreateUserAsync(CreateUserRequest request);
}

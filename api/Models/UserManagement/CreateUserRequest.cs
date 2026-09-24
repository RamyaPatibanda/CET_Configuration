namespace api.Models.UserManagement;

public sealed class CreateUserRequest
{
    public string Username { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Password { get; set; } = "talisma1";
    public bool IsAdmin { get; set; }
    public bool IsActive { get; set; } = true;
    public List<UserPermissionRequest> Permissions { get; set; } = [];
}


public sealed class UpdateUserRequest
{
    public string DisplayName { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public bool IsAdmin { get; set; }
    public bool IsActive { get; set; } = true;
    public List<UserPermissionRequest> Permissions { get; set; } = [];
}


public sealed class ChangeOwnPasswordRequest
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

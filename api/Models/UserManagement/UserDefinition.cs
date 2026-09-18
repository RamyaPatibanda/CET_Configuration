namespace api.Models.UserManagement;

public sealed class UserDefinition
{
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public bool IsAdmin { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedDate { get; set; }
}

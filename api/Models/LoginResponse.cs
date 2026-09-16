namespace api.Models
{
    public class LoginResponse
    {
        public string Token { get; set; } = string.Empty;
        public int UserId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string RoleName { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
    }
}

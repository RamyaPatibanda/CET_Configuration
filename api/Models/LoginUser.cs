namespace api.Models
{
    public class LoginUser
    {
        public int UserId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public Boolean IsAdmin { get; set; }
        public string Password { get; set; } = string.Empty;
        public bool IsActive { get; set; }
    }
}

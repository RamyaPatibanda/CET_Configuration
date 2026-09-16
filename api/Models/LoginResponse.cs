namespace api.Models
{
    public class LoginResponse
    {
        public bool Success { get; set; }

        public string Message { get; set; } = string.Empty;

        public int? UserId { get; set; }

        public string? Username { get; set; }

        public bool? IsAdmin { get; set; }
    }
}
using api.Models;

namespace api.BusinessLogic.Auth
{
    public class LoginResult
    {
        public bool Success { get; set; }
        public int StatusCode { get; set; }
        public string Message { get; set; } = string.Empty;
        public LoginResponse? Response { get; set; }
    }
}

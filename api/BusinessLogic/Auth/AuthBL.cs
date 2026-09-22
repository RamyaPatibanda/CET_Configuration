using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using api.DataAccess;
using api.Models;
using api.Utils;
using Microsoft.IdentityModel.Tokens;

namespace api.BusinessLogic.Auth
{
    public class AuthBL : IAuthBL
    {
        private readonly CETDataAccess _dataAccess;
        private readonly IConfiguration _configuration;
        private readonly ILogger<AuthBL> _logger;
        private readonly ConnectionUtils _connectionUtils;

        public AuthBL(CETDataAccess dataAccess, IConfiguration configuration, ILogger<AuthBL> logger)
        {
            _dataAccess = dataAccess;
            _configuration = configuration;
            _logger = logger;
            _connectionUtils = new ConnectionUtils();
        }

        public async Task<LoginResult> LoginAsync(LoginRequest request)
        {
            try
            {
                if (request == null || string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
                    return new LoginResult { Success = false, StatusCode = StatusCodes.Status400BadRequest, Message = "Username and password are required." };

                var username = request.Username.Trim();
                var user = await _dataAccess.GetLoginUserAsync(username);
                if (user is null || !user.IsActive)
                    return new LoginResult { Success = false, StatusCode = StatusCodes.Status401Unauthorized, Message = "Invalid username or password." };

                var storedPassword = _connectionUtils.getDecryptedValue(user.Password);
                if (!string.Equals(request.Password, storedPassword, StringComparison.Ordinal))
                    return new LoginResult { Success = false, StatusCode = StatusCodes.Status401Unauthorized, Message = "Invalid username or password." };

                var permissions = await _dataAccess.GetUserPermissionsAsync(user.UserId);

                var secret = _configuration["JwtSettings:Secret"];
                if (string.IsNullOrWhiteSpace(secret))
                    return new LoginResult { Success = false, StatusCode = StatusCodes.Status500InternalServerError, Message = "Authentication is not configured." };

                var expiresAt = DateTime.UtcNow.AddMinutes(_configuration.GetValue<int?>("JwtSettings:ExpirationMinutes") ?? 60);
                var claims = new List<Claim>
                {
                    new(JwtRegisteredClaimNames.Sub, user.UserId.ToString()),
                    new(ClaimTypes.NameIdentifier, user.UserId.ToString()),
                    new(JwtRegisteredClaimNames.UniqueName, user.Username),
                    new(ClaimTypes.Name, user.DisplayName),
                    new(ClaimTypes.Role, user.IsAdmin ? "admin" : "user")
                };

                var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
                var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
                var token = new JwtSecurityToken(claims: claims, expires: expiresAt, signingCredentials: credentials);

                return new LoginResult
                {
                    Success = true,
                    StatusCode = StatusCodes.Status200OK,
                    Response = new LoginResponse
                    {
                        Token = new JwtSecurityTokenHandler().WriteToken(token),
                        UserId = user.UserId,
                        Username = user.Username,
                        DisplayName = user.DisplayName,
                        IsAdmin = user.IsAdmin,
                        ExpiresAt = expiresAt,
                        Permissions = permissions
                    }
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error while authenticating user.");
                throw;
            }
        }
    }
}

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using api.DataAccess;
using api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;

namespace api.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly CETDataAccess _dataAccess;
        private readonly IConfiguration _configuration;
        private readonly ILogger<AuthController> _logger;

        public AuthController(
            CETDataAccess dataAccess,
            IConfiguration configuration,
            ILogger<AuthController> logger)
        {
            _dataAccess = dataAccess;
            _configuration = configuration;
            _logger = logger;
        }

        [AllowAnonymous]
        [HttpPost("login")]
        public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
                return BadRequest(new { message = "Username and password are required." });

            var user = await _dataAccess.GetLoginUserAsync(request.Username.Trim());
            if (user is null || !user.IsActive)
                return Unauthorized(new { message = "Invalid username or password." });

            var passwordHash = CETDataAccess.ComputePasswordHash(request.Password, user.PasswordSalt);
            if (!CryptographicOperations.FixedTimeEquals(
                    Convert.FromHexString(passwordHash),
                    Convert.FromHexString(user.PasswordHash)))
            {
                return Unauthorized(new { message = "Invalid username or password." });
            }

            var expiresAt = DateTime.UtcNow.AddMinutes(
                _configuration.GetValue<int?>("JwtSettings:ExpirationMinutes") ?? 60);

            var secret = _configuration["JwtSettings:Secret"];
            if (string.IsNullOrWhiteSpace(secret))
            {
                _logger.LogError("JwtSettings:Secret is not configured.");
                return StatusCode(StatusCodes.Status500InternalServerError,
                    new { message = "Authentication is not configured." });
            }

            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, user.UserId.ToString()),
                new(JwtRegisteredClaimNames.UniqueName, user.Username),
                new(ClaimTypes.Name, user.DisplayName),
                new(ClaimTypes.Role, user.RoleName)
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var token = new JwtSecurityToken(
                claims: claims,
                expires: expiresAt,
                signingCredentials: credentials);

            return Ok(new LoginResponse
            {
                Token = new JwtSecurityTokenHandler().WriteToken(token),
                UserId = user.UserId,
                Username = user.Username,
                DisplayName = user.DisplayName,
                RoleName = user.RoleName,
                ExpiresAt = expiresAt
            });
        }
    }
}

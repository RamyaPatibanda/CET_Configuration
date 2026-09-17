using api.BusinessLogic;
using api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace api.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthBL _authBL;
        private readonly ILogger<AuthController> _logger;

        public AuthController(IAuthBL authBL, ILogger<AuthController> logger)
        {
            _authBL = authBL;
            _logger = logger;
        }

        [AllowAnonymous]
        [HttpPost("login")]
        public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
        {
            try
            {
                var result = await _authBL.LoginAsync(request);
                if (!result.Success)
                    return StatusCode(result.StatusCode, new { message = result.Message });

                return Ok(result.Response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error while processing login request.");
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "Authentication could not be completed." });
            }
        }
    }
}

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

        public AuthController(IAuthBL authBL)
        {
            _authBL = authBL;
        }

        [AllowAnonymous]
        [HttpPost("login")]
        public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
        {
            var result = await _authBL.LoginAsync(request);

            if (!result.Success)
            {
                return StatusCode(result.StatusCode, new { message = result.Message });
            }

            return Ok(result.Response);
        }
    }
}

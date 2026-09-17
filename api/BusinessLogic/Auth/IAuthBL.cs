using api.Models;

namespace api.BusinessLogic.Auth
{
    public interface IAuthBL
    {
        Task<LoginResult> LoginAsync(LoginRequest request);
    }
}

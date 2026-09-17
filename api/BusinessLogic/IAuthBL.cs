using api.Models;

namespace api.BusinessLogic
{
    public interface IAuthBL
    {
        Task<LoginResult> LoginAsync(LoginRequest request);
    }
}

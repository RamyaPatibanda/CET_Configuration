using Dapper;
using Microsoft.Data.SqlClient;
using api.Models;
using api.Utils;

namespace api.DataAccess
{
    public class LoginDA
    {
        private readonly IConfiguration _configuration;

        public LoginDA(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        private string GetConnectionString()
        {
            return new ConnectionUtils().GetConnectionString(_configuration["ConnectionStrings:CrmDbConnection"])
                   ?? throw new InvalidOperationException(
                       "CETConfiguration connection string is not configured.");
        }

        public async Task<User?> GetUserByUsernameAsync(string username)
        {
            const string sql = @"
                SELECT
                    aUserId,
                    tUsername,
                    tPasswordHash,
                    bIsAdmin,
                    bIsActive,
                    dtCreatedDate
                FROM tblUsers
                WHERE tUsername = @Username";

            await using var connection =
                new SqlConnection(GetConnectionString());

            return await connection.QueryFirstOrDefaultAsync<User>(
                sql,
                new
                {
                    Username = username
                });
        }

        public async Task<int> CreateUserAsync(User user)
        {
            const string sql = @"
                INSERT INTO tblUsers
                (
                    tUsername,
                    tPasswordHash,
                    bIsAdmin,
                    bIsActive
                )
                VALUES
                (
                    @tUsername,
                    @tPasswordHash,
                    @bIsAdmin,
                    @bIsActive
                );

                SELECT CAST(SCOPE_IDENTITY() AS INT);";

            await using var connection =
                new SqlConnection(GetConnectionString());

            return await connection.ExecuteScalarAsync<int>(
                sql,
                user);
        }
    }
}
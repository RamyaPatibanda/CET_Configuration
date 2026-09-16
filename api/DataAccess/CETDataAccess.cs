using System.Data;
using System.Data.SqlClient;
using System.Security.Cryptography;
using System.Text;
using api.Models;
using api.Utils;
using Microsoft.Extensions.Caching.Memory;

namespace api.DataAccess
{
    public class CETDataAccess
    {
        public readonly string DBConnectionStr;

        public CETDataAccess(IConfiguration configuration, IMemoryCache cache)
        {
            DBConnectionStr = new ConnectionUtils().GetConnectionString(
                configuration["ConnectionStrings:CrmDbConnection"]
                ?? throw new InvalidOperationException("CrmDbConnection is not configured."));
        }

        public async Task<LoginUser?> GetLoginUserAsync(string username)
        {
            await using var connection = new SqlConnection(DBConnectionStr);
            await using var command = new SqlCommand("CET_LoginUser", connection)
            {
                CommandType = CommandType.StoredProcedure,
                CommandTimeout = 30
            };

            command.Parameters.Add("@Username", SqlDbType.NVarChar, 100).Value = username;
            await connection.OpenAsync();

            await using var reader = await command.ExecuteReaderAsync();
            if (!await reader.ReadAsync())
                return null;

            return new LoginUser
            {
                UserId = reader.GetInt32(reader.GetOrdinal("UserId")),
                Username = reader.GetString(reader.GetOrdinal("Username")),
                DisplayName = reader.GetString(reader.GetOrdinal("DisplayName")),
                RoleName = reader.GetString(reader.GetOrdinal("RoleName")),
                PasswordHash = reader.GetString(reader.GetOrdinal("PasswordHash")),
                PasswordSalt = reader.GetString(reader.GetOrdinal("PasswordSalt")),
                IsActive = reader.GetBoolean(reader.GetOrdinal("IsActive"))
            };
        }

        public static string ComputePasswordHash(string password, string salt)
        {
            using var sha256 = SHA256.Create();
            var bytes = Encoding.UTF8.GetBytes(password + salt);
            return Convert.ToHexString(sha256.ComputeHash(bytes));
        }
    }
}

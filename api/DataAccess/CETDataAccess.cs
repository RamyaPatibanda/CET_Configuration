using System.Data;
using System.Data.SqlClient;
using api.Models;
using api.Utils;
using Microsoft.Extensions.Caching.Memory;

namespace api.DataAccess
{
    public class CETDataAccess
    {
        public readonly string DBConnectionStr;
        private readonly ILogger<CETDataAccess> _logger;

        public CETDataAccess(IConfiguration configuration, IMemoryCache cache, ILogger<CETDataAccess> logger)
        {
            _logger = logger;
            DBConnectionStr = new ConnectionUtils().GetConnectionString(
                configuration["ConnectionStrings:CrmDbConnection"]
                ?? throw new InvalidOperationException("CrmDbConnection is not configured."));
        }

        public async Task<LoginUser?> GetLoginUserAsync(string username)
        {
            try
            {
                await using var connection = new SqlConnection(DBConnectionStr);
                await using var command = new SqlCommand("sproc_GetLoginUser", connection)
                {
                    CommandType = CommandType.StoredProcedure,
                    CommandTimeout = 30
                };

                command.Parameters.Add("@tUsername", SqlDbType.NVarChar, 100).Value = username;
                await connection.OpenAsync();
                await using var reader = await command.ExecuteReaderAsync();
                if (!await reader.ReadAsync()) return null;

                return new LoginUser
                {
                    UserId = reader.GetInt32(reader.GetOrdinal("aUserId")),
                    Username = reader.GetString(reader.GetOrdinal("tUsername")),
                    DisplayName = reader.GetString(reader.GetOrdinal("tDisplayName")),
                    IsAdmin = reader.GetBoolean(reader.GetOrdinal("bIsAdmin")),
                    Password = reader.GetString(reader.GetOrdinal("tPassword")),
                    IsActive = reader.GetBoolean(reader.GetOrdinal("bIsActive"))
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while getting login user {Username}.", username);
                throw;
            }
        }
    }
}

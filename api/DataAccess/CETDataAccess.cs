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
        public async Task<IReadOnlyList<api.Models.UserManagement.UserDefinition>> GetUsersAsync()
        {
            var users = new List<api.Models.UserManagement.UserDefinition>();
            await using var connection = new SqlConnection(DBConnectionStr);
            await using var command = new SqlCommand("sproc_GetUsers", connection)
            {
                CommandType = CommandType.StoredProcedure,
                CommandTimeout = 30
            };

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                users.Add(new api.Models.UserManagement.UserDefinition
                {
                    UserId = reader.GetInt32(reader.GetOrdinal("aUserId")),
                    Username = reader.GetString(reader.GetOrdinal("tUsername")),
                    DisplayName = reader.GetString(reader.GetOrdinal("tDisplayName")),
                    IsAdmin = reader.GetBoolean(reader.GetOrdinal("bIsAdmin")),
                    IsActive = reader.GetBoolean(reader.GetOrdinal("bIsActive")),
                    CreatedDate = reader.GetDateTime(reader.GetOrdinal("dtCreatedDate")),
                    PermissionCount = reader.GetInt32(reader.GetOrdinal("nPermissionCount"))
                });
            }

            return users;
        }

        public async Task<int> CreateUserAsync(
            string username,
            string encryptedPassword,
            string displayName,
            bool isAdmin,
            bool isActive,
            IReadOnlyCollection<api.Models.UserManagement.UserPermissionRequest> permissions)
        {
            await using var connection = new SqlConnection(DBConnectionStr);
            await using var command = new SqlCommand("sproc_CreateUser", connection)
            {
                CommandType = CommandType.StoredProcedure,
                CommandTimeout = 30
            };

            command.Parameters.Add("@tUsername", SqlDbType.NVarChar, 100).Value = username;
            command.Parameters.Add("@tPassword", SqlDbType.NVarChar, 500).Value = encryptedPassword;
            command.Parameters.Add("@tDisplayName", SqlDbType.NVarChar, 200).Value = displayName;
            command.Parameters.Add("@bIsAdmin", SqlDbType.Bit).Value = isAdmin;
            command.Parameters.Add("@bIsActive", SqlDbType.Bit).Value = isActive;
            command.Parameters.Add("@tPermissionsJson", SqlDbType.NVarChar, -1).Value =
                System.Text.Json.JsonSerializer.Serialize(permissions);

            await connection.OpenAsync();
            var result = await command.ExecuteScalarAsync();
            return Convert.ToInt32(result);
        }

        public async Task<IReadOnlyList<api.Models.UserManagement.UserPermission>> GetUserPermissionsAsync(int userId)
        {
            var permissions = new List<api.Models.UserManagement.UserPermission>();
            await using var connection = new SqlConnection(DBConnectionStr);
            await using var command = new SqlCommand("sproc_GetUserPermissions", connection)
            {
                CommandType = CommandType.StoredProcedure,
                CommandTimeout = 30
            };
            command.Parameters.Add("@aUserId", SqlDbType.Int).Value = userId;

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                permissions.Add(new api.Models.UserManagement.UserPermission
                {
                    ModuleCode = reader.GetString(reader.GetOrdinal("tModuleCode")),
                    ModuleName = reader.GetString(reader.GetOrdinal("tModuleName")),
                    CanRead = Convert.ToBoolean(reader["bCanRead"]),
                    CanWrite = Convert.ToBoolean(reader["bCanWrite"])
                });
            }

            return permissions;
        }


        public async Task UpdateUserAsync(
            int userId, string displayName, string? encryptedPassword, bool isAdmin, bool isActive,
            IReadOnlyCollection<api.Models.UserManagement.UserPermissionRequest> permissions)
        {
            await using var connection = new SqlConnection(DBConnectionStr);
            await using var command = new SqlCommand("sproc_UpdateUser", connection)
            {
                CommandType = CommandType.StoredProcedure,
                CommandTimeout = 30
            };
            command.Parameters.Add("@aUserId", SqlDbType.Int).Value = userId;
            command.Parameters.Add("@tDisplayName", SqlDbType.NVarChar, 200).Value = displayName;
            command.Parameters.Add("@tPassword", SqlDbType.NVarChar, 500).Value = (object?)encryptedPassword ?? DBNull.Value;
            command.Parameters.Add("@bIsAdmin", SqlDbType.Bit).Value = isAdmin;
            command.Parameters.Add("@bIsActive", SqlDbType.Bit).Value = isActive;
            command.Parameters.Add("@tPermissionsJson", SqlDbType.NVarChar, -1).Value =
                System.Text.Json.JsonSerializer.Serialize(permissions);
            await connection.OpenAsync();
            await command.ExecuteNonQueryAsync();
        }

        public async Task DeleteUserAsync(int userId)
        {
            await using var connection = new SqlConnection(DBConnectionStr);
            await using var command = new SqlCommand("sproc_DeleteUser", connection)
            {
                CommandType = CommandType.StoredProcedure,
                CommandTimeout = 30
            };
            command.Parameters.Add("@aUserId", SqlDbType.Int).Value = userId;
            await connection.OpenAsync();
            await command.ExecuteNonQueryAsync();
        }

        public async Task<bool> HasUserPermissionAsync(int userId, string moduleCode, bool write)
        {
            await using var connection = new SqlConnection(DBConnectionStr);
            await using var command = new SqlCommand("sproc_CheckUserPermission", connection)
            {
                CommandType = CommandType.StoredProcedure,
                CommandTimeout = 30
            };
            command.Parameters.Add("@aUserId", SqlDbType.Int).Value = userId;
            command.Parameters.Add("@tModuleCode", SqlDbType.NVarChar, 50).Value = moduleCode;
            command.Parameters.Add("@bCheckWrite", SqlDbType.Bit).Value = write;

            await connection.OpenAsync();
            return Convert.ToBoolean(await command.ExecuteScalarAsync());
        }

    }
}

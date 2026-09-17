using System.Data;
using System.Data.SqlClient;
using api.Models.FieldConfiguration;
using api.Utils;

namespace api.DataAccess.FieldConfiguration
{
    public class FieldConfigurationDAL : IFieldConfigurationDAL
    {
        private readonly string _connectionString;
        private readonly ILogger<FieldConfigurationDAL> _logger;

        public FieldConfigurationDAL(IConfiguration configuration, ILogger<FieldConfigurationDAL> logger)
        {
            _logger = logger;
            _connectionString = new ConnectionUtils().GetConnectionString(
                configuration["ConnectionStrings:CrmDbConnection"]
                ?? throw new InvalidOperationException("CrmDbConnection is not configured."));
        }

        public async Task<List<FieldDefinition>> GetFieldsAsync()
        {
            try
            {
                var fields = new List<FieldDefinition>();
                await using var connection = new SqlConnection(_connectionString);
                await using var command = new SqlCommand("sproc_GetFields", connection)
                {
                    CommandType = CommandType.StoredProcedure,
                    CommandTimeout = 30
                };

                await connection.OpenAsync();
                await using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                    fields.Add(MapField(reader));

                return fields;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while getting field configuration.");
                throw;
            }
        }

        public async Task<FieldDefinition?> GetFieldAsync(int fieldId)
        {
            try
            {
                await using var connection = new SqlConnection(_connectionString);
                await using var command = new SqlCommand("sproc_GetField", connection)
                {
                    CommandType = CommandType.StoredProcedure,
                    CommandTimeout = 30
                };
                command.Parameters.Add("@aFieldId", SqlDbType.Int).Value = fieldId;

                await connection.OpenAsync();
                await using var reader = await command.ExecuteReaderAsync();
                return await reader.ReadAsync() ? MapField(reader) : null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while getting field {FieldId}.", fieldId);
                throw;
            }
        }

        public async Task<int> CreateFieldAsync(CreateFieldRequest request)
        {
            try
            {
                await using var connection = new SqlConnection(_connectionString);
                await using var command = CreateCommand("sproc_CreateField", connection);
                AddFieldParameters(command, request);

                await connection.OpenAsync();
                var result = await command.ExecuteScalarAsync();
                return Convert.ToInt32(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while creating field {FieldName}.", request.FieldName);
                throw;
            }
        }

        public async Task<bool> UpdateFieldAsync(UpdateFieldRequest request)
        {
            try
            {
                await using var connection = new SqlConnection(_connectionString);
                await using var command = CreateCommand("sproc_UpdateField", connection);
                command.Parameters.Add("@aFieldId", SqlDbType.Int).Value = request.FieldId;
                AddFieldParameters(command, request);

                await connection.OpenAsync();
                return Convert.ToInt32(await command.ExecuteScalarAsync()) > 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while updating field {FieldId}.", request.FieldId);
                throw;
            }
        }

        public async Task<bool> DeleteFieldAsync(int fieldId)
        {
            try
            {
                await using var connection = new SqlConnection(_connectionString);
                await using var command = new SqlCommand("sproc_DeleteField", connection)
                {
                    CommandType = CommandType.StoredProcedure,
                    CommandTimeout = 30
                };
                command.Parameters.Add("@aFieldId", SqlDbType.Int).Value = fieldId;

                await connection.OpenAsync();
                return Convert.ToInt32(await command.ExecuteScalarAsync()) > 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while deleting field {FieldId}.", fieldId);
                throw;
            }
        }

        private static SqlCommand CreateCommand(string procedureName, SqlConnection connection)
        {
            return new SqlCommand(procedureName, connection)
            {
                CommandType = CommandType.StoredProcedure,
                CommandTimeout = 30
            };
        }

        private static void AddFieldParameters(SqlCommand command, CreateFieldRequest request)
        {
            command.Parameters.Add("@tFieldName", SqlDbType.NVarChar, 200).Value = request.FieldName;
            command.Parameters.Add("@tDisplayName", SqlDbType.NVarChar, 200).Value = request.DisplayName;
            command.Parameters.Add("@tFieldType", SqlDbType.NVarChar, 50).Value = request.FieldType;
            command.Parameters.Add("@bIsRequired", SqlDbType.Bit).Value = request.IsRequired;
            command.Parameters.Add("@bIsActive", SqlDbType.Bit).Value = request.IsActive;
            command.Parameters.Add("@nDisplayOrder", SqlDbType.Int).Value = request.DisplayOrder;
        }

        private static FieldDefinition MapField(SqlDataReader reader)
        {
            return new FieldDefinition
            {
                FieldId = reader.GetInt32(reader.GetOrdinal("aFieldId")),
                FieldName = reader.GetString(reader.GetOrdinal("tFieldName")),
                DisplayName = reader.GetString(reader.GetOrdinal("tDisplayName")),
                FieldType = reader.GetString(reader.GetOrdinal("tFieldType")),
                IsRequired = reader.GetBoolean(reader.GetOrdinal("bIsRequired")),
                IsActive = reader.GetBoolean(reader.GetOrdinal("bIsActive")),
                DisplayOrder = reader.GetInt32(reader.GetOrdinal("nDisplayOrder")),
                CreatedDate = GetNullableDateTime(reader, "dtCreatedDate"),
                ModifiedDate = GetNullableDateTime(reader, "dtModifiedDate")
            };
        }

        private static DateTime? GetNullableDateTime(SqlDataReader reader, string columnName)
        {
            var ordinal = reader.GetOrdinal(columnName);
            return reader.IsDBNull(ordinal) ? null : reader.GetDateTime(ordinal);
        }
    }
}

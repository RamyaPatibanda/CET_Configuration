using System.Data;
using System.Data.SqlClient;
using api.Models.FieldConfiguration;
using api.Utils;
using Microsoft.Extensions.Caching.Memory;

namespace api.DataAccess.FieldConfiguration
{
    public class FieldConfigurationDAL : IFieldConfigurationDAL
    {
        private readonly string _connectionString;
        private readonly List<string> _allowedTables;
        private readonly IMemoryCache _cache;
        private readonly ILogger<FieldConfigurationDAL> _logger;
        private static readonly TimeSpan ColumnCacheDuration = TimeSpan.FromMinutes(30);

        public FieldConfigurationDAL(
            IConfiguration configuration,
            IMemoryCache cache,
            ILogger<FieldConfigurationDAL> logger)
        {
            _logger = logger;
            _cache = cache;
            _connectionString = new ConnectionUtils().GetConnectionString(configuration["ConnectionStrings:CrmDbConnection"] ?? throw new InvalidOperationException("CrmDbConnection is not configured."));
            _allowedTables = configuration.GetSection("RuleConfiguration:AllowedTables").Get<List<string>>() ?? new List<string>();
        }

        public async Task<List<FieldDefinition>> GetFieldsAsync()
        {
            try
            {
                var fields = new List<FieldDefinition>();
                await using var connection = new SqlConnection(_connectionString);
                await using var command = CreateCommand("sproc_GetFields", connection);
                await connection.OpenAsync();
                await using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync()) fields.Add(MapField(reader));
                return fields;
            }
            catch (Exception ex) { _logger.LogError(ex, "Error while getting field configuration."); throw; }
        }

        public async Task<FieldDefinition?> GetFieldAsync(int fieldId)
        {
            try
            {
                await using var connection = new SqlConnection(_connectionString);
                await using var command = CreateCommand("sproc_GetField", connection);
                command.Parameters.Add("@aFieldId", SqlDbType.Int).Value = fieldId;
                await connection.OpenAsync();
                await using var reader = await command.ExecuteReaderAsync();
                return await reader.ReadAsync() ? MapField(reader) : null;
            }
            catch (Exception ex) { _logger.LogError(ex, "Error while getting field {FieldId}.", fieldId); throw; }
        }

        public async Task<int> CreateFieldAsync(CreateFieldRequest request)
        {
            try
            {
                ValidateAllowedTable(request.TableName);
                await using var connection = new SqlConnection(_connectionString);
                await using var command = CreateCommand("sproc_CreateField", connection);
                command.Parameters.Add("@aFieldId", SqlDbType.Int).Value = request.FieldId;
                AddFieldParameters(command, request.TableName, request.FieldName, request.DisplayName, request.FieldType, request.IsRequired, request.IsActive, request.DisplayOrder);
                command.Parameters.Add("@aCreatedByUserId", SqlDbType.Int).Value = request.CreatedByUserId;
                await connection.OpenAsync();
                return Convert.ToInt32(await command.ExecuteScalarAsync());
            }
            catch (Exception ex) { _logger.LogError(ex, "Error while creating field {FieldName}.", request.FieldName); throw; }
        }

        public async Task<bool> UpdateFieldAsync(UpdateFieldRequest request)
        {
            try
            {
                ValidateAllowedTable(request.TableName);
                await using var connection = new SqlConnection(_connectionString);
                await using var command = CreateCommand("sproc_UpdateField", connection);
                command.Parameters.Add("@aFieldId", SqlDbType.Int).Value = request.FieldId;
                AddFieldParameters(command, request.TableName, request.FieldName, request.DisplayName, request.FieldType, request.IsRequired, request.IsActive, request.DisplayOrder);
                await connection.OpenAsync();
                return Convert.ToInt32(await command.ExecuteScalarAsync()) > 0;
            }
            catch (Exception ex) { _logger.LogError(ex, "Error while updating field {FieldId}.", request.FieldId); throw; }
        }

        public async Task<bool> DeleteFieldAsync(int fieldId)
        {
            try
            {
                await using var connection = new SqlConnection(_connectionString);
                await using var command = CreateCommand("sproc_DeleteField", connection);
                command.Parameters.Add("@aFieldId", SqlDbType.Int).Value = fieldId;
                await connection.OpenAsync();
                return Convert.ToInt32(await command.ExecuteScalarAsync()) > 0;
            }
            catch (Exception ex) { _logger.LogError(ex, "Error while deleting field {FieldId}.", fieldId); throw; }
        }

        public Task<List<FieldSourceOption>> GetAllowedTablesAsync()
        {
            try
            {
                var tables = _allowedTables
                    .Where(table => !string.IsNullOrWhiteSpace(table))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(table => table)
                    .Select(table => new FieldSourceOption { Name = table })
                    .ToList();
                return Task.FromResult(tables);
            }
            catch (Exception ex) { _logger.LogError(ex, "Error while getting configured rule source tables."); throw; }
        }

        public async Task<List<FieldSourceOption>> GetColumnsAsync(string tableName)
        {
            try
            {
                ValidateAllowedTable(tableName);
                var cacheKey = $"field-configuration-columns:{tableName.Trim().ToLowerInvariant()}";

                if (_cache.TryGetValue(cacheKey, out List<FieldSourceOption>? cachedColumns) && cachedColumns is not null)
                {
                    return cachedColumns.Select(column => new FieldSourceOption
                    {
                        Name = column.Name,
                        FieldType = column.FieldType
                    }).ToList();
                }

                var columns = new List<FieldSourceOption>();
                await using var connection = new SqlConnection(_connectionString);
                await using var command = CreateColumnCommand(connection, tableName);
                await connection.OpenAsync();
                await using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    columns.Add(new FieldSourceOption
                    {
                        Name = reader.GetString(0),
                        FieldType = MapSqlTypeToFieldType(reader.GetString(1))
                    });
                }

                if (columns.Count == 0) throw new ArgumentException($"Table '{tableName}' was not found in the dbo schema.", nameof(tableName));

                _cache.Set(cacheKey, columns, new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = ColumnCacheDuration
                });

                return columns.Select(column => new FieldSourceOption
                {
                    Name = column.Name,
                    FieldType = column.FieldType
                }).ToList();
            }
            catch (Exception ex) { _logger.LogError(ex, "Error while getting columns for table {TableName}.", tableName); throw; }
        }

        public async Task<string> ValidateFieldSourceAsync(string tableName, string fieldName)
        {
            try
            {
                ValidateAllowedTable(tableName);
                if (string.IsNullOrWhiteSpace(fieldName)) throw new ArgumentException("Column name is required.", nameof(fieldName));

                await using var connection = new SqlConnection(_connectionString);
                await using var command = new SqlCommand(@"
                    SELECT DATA_TYPE
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = 'dbo'
                      AND TABLE_NAME = @tTableName
                      AND COLUMN_NAME = @tFieldName;", connection)
                { CommandType = CommandType.Text, CommandTimeout = 30 };
                command.Parameters.Add("@tTableName", SqlDbType.NVarChar, 128).Value = tableName;
                command.Parameters.Add("@tFieldName", SqlDbType.NVarChar, 128).Value = fieldName;
                await connection.OpenAsync();
                var sqlType = await command.ExecuteScalarAsync() as string;
                if (string.IsNullOrWhiteSpace(sqlType))
                    throw new ArgumentException($"Column '{fieldName}' does not exist in table '{tableName}'.", nameof(fieldName));

                return MapSqlTypeToFieldType(sqlType);
            }
            catch (Exception ex) { _logger.LogError(ex, "Error while validating field source {TableName}.{FieldName}.", tableName, fieldName); throw; }
        }

        private void ValidateAllowedTable(string tableName)
        {
            if (string.IsNullOrWhiteSpace(tableName)) throw new ArgumentException("Table name is required.", nameof(tableName));
            if (!_allowedTables.Any(table => string.Equals(table, tableName, StringComparison.OrdinalIgnoreCase)))
                throw new ArgumentException($"Table '{tableName}' is not configured as an allowed rule source.", nameof(tableName));
        }

        private static SqlCommand CreateCommand(string procedureName, SqlConnection connection)
        {
            return new SqlCommand(procedureName, connection) { CommandType = CommandType.StoredProcedure, CommandTimeout = 30 };
        }

        private static SqlCommand CreateColumnCommand(SqlConnection connection, string tableName)
        {
            var command = new SqlCommand(@"
                SELECT COLUMN_NAME, DATA_TYPE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = 'dbo'
                  AND TABLE_NAME = @tTableName
                ORDER BY ORDINAL_POSITION;", connection)
            { CommandType = CommandType.Text, CommandTimeout = 30 };
            command.Parameters.Add("@tTableName", SqlDbType.NVarChar, 128).Value = tableName;
            return command;
        }

        private static string MapSqlTypeToFieldType(string sqlType)
        {
            return sqlType.ToLowerInvariant() switch
            {
                "bit" => "Boolean",
                "tinyint" or "smallint" or "int" or "bigint" or "decimal" or "numeric" or "float" or "real" or "money" or "smallmoney" => "Number",
                "date" or "datetime" or "datetime2" or "smalldatetime" or "time" => "Date",
                _ => "Text"
            };
        }

        private static void AddFieldParameters(SqlCommand command, string tableName, string fieldName, string displayName, string fieldType, bool isRequired, bool isActive, int displayOrder)
        {
            command.Parameters.Add("@tTableName", SqlDbType.NVarChar, 128).Value = tableName;
            command.Parameters.Add("@tFieldName", SqlDbType.NVarChar, 200).Value = fieldName;
            command.Parameters.Add("@tDisplayName", SqlDbType.NVarChar, 200).Value = displayName;
            command.Parameters.Add("@tFieldType", SqlDbType.NVarChar, 50).Value = fieldType;
            command.Parameters.Add("@bIsRequired", SqlDbType.Bit).Value = isRequired;
            command.Parameters.Add("@bIsActive", SqlDbType.Bit).Value = isActive;
            command.Parameters.Add("@nDisplayOrder", SqlDbType.Int).Value = displayOrder;
        }

        private static FieldDefinition MapField(SqlDataReader reader)
        {
            return new FieldDefinition
            {
                FieldId = reader.GetInt32(reader.GetOrdinal("aFieldId")),
                TableName = reader.GetString(reader.GetOrdinal("tTableName")),
                FieldName = reader.GetString(reader.GetOrdinal("tFieldName")),
                DisplayName = reader.GetString(reader.GetOrdinal("tDisplayName")),
                FieldType = reader.GetString(reader.GetOrdinal("tFieldType")),
                IsRequired = reader.GetBoolean(reader.GetOrdinal("bIsRequired")),
                IsActive = reader.GetBoolean(reader.GetOrdinal("bIsActive")),
                DisplayOrder = reader.GetInt32(reader.GetOrdinal("nDisplayOrder")),
                CreatedDate = GetNullableDateTime(reader, "dtCreatedDate"),
                ModifiedDate = GetNullableDateTime(reader, "dtModifiedDate"),
                CreatedByUserId = reader.IsDBNull(reader.GetOrdinal("aCreatedByUserId")) ? null : reader.GetInt32(reader.GetOrdinal("aCreatedByUserId")),
                CreatedBy = reader.IsDBNull(reader.GetOrdinal("tCreatedBy")) ? string.Empty : reader.GetString(reader.GetOrdinal("tCreatedBy"))
            };
        }

        private static DateTime? GetNullableDateTime(SqlDataReader reader, string columnName)
        {
            var ordinal = reader.GetOrdinal(columnName);
            return reader.IsDBNull(ordinal) ? null : reader.GetDateTime(ordinal);
        }
    }
}

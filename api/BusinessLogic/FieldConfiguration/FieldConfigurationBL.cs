using api.DataAccess.FieldConfiguration;
using api.Models.FieldConfiguration;

namespace api.BusinessLogic.FieldConfiguration
{
    public class FieldConfigurationBL : IFieldConfigurationBL
    {
        private readonly IFieldConfigurationDAL _dataAccess;
        private readonly ILogger<FieldConfigurationBL> _logger;

        public FieldConfigurationBL(IFieldConfigurationDAL dataAccess, ILogger<FieldConfigurationBL> logger)
        {
            _dataAccess = dataAccess;
            _logger = logger;
        }

        public async Task<List<FieldDefinition>> GetFieldsAsync()
        {
            try { return await _dataAccess.GetFieldsAsync(); }
            catch (Exception ex) { _logger.LogError(ex, "Error in field configuration business logic while getting fields."); throw; }
        }

        public async Task<FieldDefinition?> GetFieldAsync(int fieldId)
        {
            try
            {
                if (fieldId <= 0) throw new ArgumentException("Field id must be greater than zero.", nameof(fieldId));
                return await _dataAccess.GetFieldAsync(fieldId);
            }
            catch (Exception ex) { _logger.LogError(ex, "Error in field configuration business logic while getting field {FieldId}.", fieldId); throw; }
        }

        public async Task<int> CreateFieldAsync(CreateFieldRequest request)
        {
            try
            {
                Validate(request.TableName, request.FieldName, request.DisplayName, request.FieldType, request.DisplayOrder);
                await _dataAccess.ValidateFieldSourceAsync(request.TableName, request.FieldName);
                return await _dataAccess.CreateFieldAsync(request);
            }
            catch (Exception ex) { _logger.LogError(ex, "Error in field configuration business logic while creating field {FieldName}.", request.FieldName); throw; }
        }

        public async Task<bool> UpdateFieldAsync(UpdateFieldRequest request)
        {
            try
            {
                if (request.FieldId <= 0) throw new ArgumentException("Field id must be greater than zero.", nameof(request.FieldId));
                Validate(request.TableName, request.FieldName, request.DisplayName, request.FieldType, request.DisplayOrder);
                await _dataAccess.ValidateFieldSourceAsync(request.TableName, request.FieldName);
                return await _dataAccess.UpdateFieldAsync(request);
            }
            catch (Exception ex) { _logger.LogError(ex, "Error in field configuration business logic while updating field {FieldId}.", request.FieldId); throw; }
        }

        public async Task<bool> DeleteFieldAsync(int fieldId)
        {
            try
            {
                if (fieldId <= 0) throw new ArgumentException("Field id must be greater than zero.", nameof(fieldId));
                return await _dataAccess.DeleteFieldAsync(fieldId);
            }
            catch (Exception ex) { _logger.LogError(ex, "Error in field configuration business logic while deleting field {FieldId}.", fieldId); throw; }
        }

        public async Task<List<FieldSourceOption>> GetAllowedTablesAsync()
        {
            try { return await _dataAccess.GetAllowedTablesAsync(); }
            catch (Exception ex) { _logger.LogError(ex, "Error in field configuration business logic while getting allowed tables."); throw; }
        }

        public async Task<List<FieldSourceOption>> GetColumnsAsync(string tableName)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(tableName)) throw new ArgumentException("Table name is required.", nameof(tableName));
                return await _dataAccess.GetColumnsAsync(tableName);
            }
            catch (Exception ex) { _logger.LogError(ex, "Error in field configuration business logic while getting columns for table {TableName}.", tableName); throw; }
        }

        public async Task ValidateFieldSourceAsync(string tableName, string fieldName)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(tableName)) throw new ArgumentException("Table name is required.", nameof(tableName));
                if (string.IsNullOrWhiteSpace(fieldName)) throw new ArgumentException("Column name is required.", nameof(fieldName));
                await _dataAccess.ValidateFieldSourceAsync(tableName, fieldName);
            }
            catch (Exception ex) { _logger.LogError(ex, "Error in field configuration business logic while validating {TableName}.{FieldName}.", tableName, fieldName); throw; }
        }

        private static void Validate(string tableName, string fieldName, string displayName, string fieldType, int displayOrder)
        {
            if (string.IsNullOrWhiteSpace(tableName)) throw new ArgumentException("Table name is required.", nameof(tableName));
            if (string.IsNullOrWhiteSpace(fieldName)) throw new ArgumentException("Field name is required.", nameof(fieldName));
            if (string.IsNullOrWhiteSpace(displayName)) throw new ArgumentException("Display name is required.", nameof(displayName));
            if (string.IsNullOrWhiteSpace(fieldType)) throw new ArgumentException("Field type is required.", nameof(fieldType));
            if (displayOrder < 0) throw new ArgumentException("Display order cannot be negative.", nameof(displayOrder));
        }
    }
}

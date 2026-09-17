using api.Models.FieldConfiguration;

namespace api.DataAccess.FieldConfiguration
{
    public interface IFieldConfigurationDAL
    {
        Task<List<FieldDefinition>> GetFieldsAsync();
        Task<FieldDefinition?> GetFieldAsync(int fieldId);
        Task<int> CreateFieldAsync(CreateFieldRequest request);
        Task<bool> UpdateFieldAsync(UpdateFieldRequest request);
        Task<bool> DeleteFieldAsync(int fieldId);
    }
}

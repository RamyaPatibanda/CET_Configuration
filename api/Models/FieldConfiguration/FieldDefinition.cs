namespace api.Models.FieldConfiguration
{
    public class FieldDefinition
    {
        public int FieldId { get; set; }
        public string TableName { get; set; } = string.Empty;
        public string FieldName { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string FieldType { get; set; } = string.Empty;
        public bool IsRequired { get; set; }
        public bool IsActive { get; set; }
        public int DisplayOrder { get; set; }
        public DateTime? CreatedDate { get; set; }
        public DateTime? ModifiedDate { get; set; }
    }
}

namespace api.Models.UserManagement;

public sealed class UserPermission
{
    public string ModuleCode { get; set; } = string.Empty;
    public string ModuleName { get; set; } = string.Empty;
    public bool CanRead { get; set; }
    public bool CanWrite { get; set; }
}

public sealed class UserPermissionRequest
{
    public string ModuleCode { get; set; } = string.Empty;
    public bool CanRead { get; set; }
    public bool CanWrite { get; set; }
}

public static class UserPermissionModules
{
    public const string Fields = "FIELDS";
    public const string Rules = "RULES";
    public const string AllocationRun = "ALLOCATION_RUN";

    public static readonly IReadOnlyDictionary<string, string> Names =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            [Fields] = "Field Configuration",
            [Rules] = "Rule Configuration",
            [AllocationRun] = "Allocation Run"
        };
}

using System.Text.Json;
using api.Models.RuleConfiguration;

namespace api.Configuration;

public interface IRuleDecisionConfiguration
{
    IReadOnlyList<RuleDecisionOption> GetDecisionOptions();
}

public sealed class RuleDecisionConfiguration : IRuleDecisionConfiguration
{
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<RuleDecisionConfiguration> _logger;

    public RuleDecisionConfiguration(IWebHostEnvironment environment, ILogger<RuleDecisionConfiguration> logger)
    {
        _environment = environment;
        _logger = logger;
    }

    public IReadOnlyList<RuleDecisionOption> GetDecisionOptions()
    {
        var path = Path.Combine(_environment.ContentRootPath, "Configuration", "RuleDecisionOptions.json");

        if (!File.Exists(path))
            throw new FileNotFoundException("Rule decision configuration file was not found.", path);

        var json = File.ReadAllText(path);
        return JsonSerializer.Deserialize<List<RuleDecisionOption>>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        }) ?? [];
    }
}

using System.Data;
using System.Data.SqlClient;
using api.Models.Allocation;
using api.Utils;

namespace api.DataAccess.Allocation;

public sealed class AllocationDecisionConfigurationDAL
{
    private readonly string _connectionString;
    public AllocationDecisionConfigurationDAL(IConfiguration configuration)
    {
        _connectionString = new ConnectionUtils().GetConnectionString(
            configuration["ConnectionStrings:CrmDbConnection"]
            ?? throw new InvalidOperationException("CrmDbConnection is not configured."));
    }

    public async Task<List<AllocationDecisionConfiguration>> GetAsync(
        string stepCode, string areaCode, CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT aAllocationDecisionId, tStepCode, tDecisionAreaCode, aRuleId,
                   nDisplayOrder, tAllocatedType, tVacancyType, ISNULL(tResultJson, N'') AS tResultJson, bIsActive
            FROM dbo.tblAllocationDecision
            WHERE tStepCode = @StepCode AND tDecisionAreaCode = @AreaCode AND bIsActive = 1
            ORDER BY nDisplayOrder;
            """;
        var result = new List<AllocationDecisionConfiguration>();
        await using var connection = new SqlConnection(_connectionString);
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.Add("@StepCode", SqlDbType.NVarChar, 50).Value = stepCode;
        command.Parameters.Add("@AreaCode", SqlDbType.NVarChar, 100).Value = areaCode;
        await connection.OpenAsync(cancellationToken);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken)) result.Add(Map(reader));
        return result;
    }

    public async Task<List<AllocationDecisionConfiguration>> GetByRuleIdsAsync(
        string stepCode, string areaCode, IReadOnlyCollection<int> ruleIds, CancellationToken cancellationToken = default)
    {
        if (ruleIds.Count == 0) return [];
        var names = ruleIds.Select((_, i) => $"@Rule{i}").ToArray();
        var sql = $"""
            SELECT aAllocationDecisionId, tStepCode, tDecisionAreaCode, aRuleId,
                   nDisplayOrder, tAllocatedType, tVacancyType, ISNULL(tResultJson, N'') AS tResultJson, bIsActive
            FROM dbo.tblAllocationDecision
            WHERE tStepCode = @StepCode AND tDecisionAreaCode = @AreaCode
              AND bIsActive = 1 AND aRuleId IN ({string.Join(",", names)})
            ORDER BY nDisplayOrder;
            """;
        var result = new List<AllocationDecisionConfiguration>();
        await using var connection = new SqlConnection(_connectionString);
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.Add("@StepCode", SqlDbType.NVarChar, 50).Value = stepCode;
        command.Parameters.Add("@AreaCode", SqlDbType.NVarChar, 100).Value = areaCode;
        for (var i = 0; i < ruleIds.Count; i++) command.Parameters.Add(names[i], SqlDbType.Int).Value = ruleIds.ElementAt(i);
        await connection.OpenAsync(cancellationToken);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken)) result.Add(Map(reader));
        return result;
    }

    public async Task SaveAsync(SaveAllocationDecisionRequest request, CancellationToken cancellationToken = default)
    {
        if (request.Decisions.Count == 0) throw new ArgumentException("At least one allocation decision is required.");
        var duplicateRules = request.Decisions.GroupBy(x => x.RuleId).Any(g => g.Count() > 1);
        var duplicateOrders = request.Decisions.GroupBy(x => x.DisplayOrder).Any(g => g.Count() > 1);
        if (duplicateRules || duplicateOrders) throw new ArgumentException("Allocation decision rules and display orders must be unique.");

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(cancellationToken);
        try
        {
            var delete = new SqlCommand("DELETE FROM dbo.tblAllocationDecision WHERE tStepCode=@StepCode AND tDecisionAreaCode=@AreaCode;", connection, transaction);
            delete.Parameters.Add("@StepCode", SqlDbType.NVarChar, 50).Value = request.StepCode;
            delete.Parameters.Add("@AreaCode", SqlDbType.NVarChar, 100).Value = request.DecisionAreaCode;
            await delete.ExecuteNonQueryAsync(cancellationToken);

            foreach (var item in request.Decisions.OrderBy(x => x.DisplayOrder))
            {
                var insert = new SqlCommand("""
                    INSERT INTO dbo.tblAllocationDecision
                    (tStepCode,tDecisionAreaCode,aRuleId,nDisplayOrder,tAllocatedType,tVacancyType,tResultJson,bIsActive)
                    VALUES (@StepCode,@AreaCode,@RuleId,@DisplayOrder,@AllocatedType,@VacancyType,@ResultJson,1);
                    """, connection, transaction);
                insert.Parameters.Add("@StepCode", SqlDbType.NVarChar, 50).Value = request.StepCode;
                insert.Parameters.Add("@AreaCode", SqlDbType.NVarChar, 100).Value = request.DecisionAreaCode;
                insert.Parameters.Add("@RuleId", SqlDbType.Int).Value = item.RuleId;
                insert.Parameters.Add("@DisplayOrder", SqlDbType.Int).Value = item.DisplayOrder;
                insert.Parameters.Add("@AllocatedType", SqlDbType.NVarChar, 50).Value = item.AllocatedType ?? string.Empty;
                insert.Parameters.Add("@VacancyType", SqlDbType.NVarChar, 50).Value = item.VacancyType ?? string.Empty;
                insert.Parameters.Add("@ResultJson", SqlDbType.NVarChar, -1).Value = string.IsNullOrWhiteSpace(item.ResultJson) ? DBNull.Value : item.ResultJson;
                await insert.ExecuteNonQueryAsync(cancellationToken);
            }
            await transaction.CommitAsync(cancellationToken);
        }
        catch { await transaction.RollbackAsync(CancellationToken.None); throw; }
    }

    private static AllocationDecisionConfiguration Map(SqlDataReader r) => new()
    {
        AllocationDecisionId = r.GetInt32(r.GetOrdinal("aAllocationDecisionId")),
        StepCode = r.GetString(r.GetOrdinal("tStepCode")),
        DecisionAreaCode = r.GetString(r.GetOrdinal("tDecisionAreaCode")),
        RuleId = r.GetInt32(r.GetOrdinal("aRuleId")),
        DisplayOrder = r.GetInt32(r.GetOrdinal("nDisplayOrder")),
        AllocatedType = r.GetString(r.GetOrdinal("tAllocatedType")),
        VacancyType = r.GetString(r.GetOrdinal("tVacancyType")),
        ResultJson = r.GetString(r.GetOrdinal("tResultJson")),
        IsActive = r.GetBoolean(r.GetOrdinal("bIsActive"))
    };
}

/*
    Rule list / edit / delete fixes.
    Execute this script manually against CET_configuration after
    01_Tables.sql, 02_StoredProcedures.sql and 03_RuleConditionGrouping.sql.
*/

IF OBJECT_ID(N'dbo.sproc_GetRules', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sproc_GetRules;
GO
CREATE PROCEDURE dbo.sproc_GetRules
AS
BEGIN
    SET NOCOUNT ON;

    SELECT r.aRuleId,
           r.tRuleName,
           r.tDescription,
           r.nPriority,
           r.bIsActive,
           (SELECT COUNT(1) FROM dbo.tblRuleCondition rc WHERE rc.aRuleId = r.aRuleId) AS nConditionCount,
           r.dtCreatedDate,
           r.dtModifiedDate
    FROM dbo.tblRule r
    ORDER BY r.nPriority, r.aRuleId;
END;
GO

IF OBJECT_ID(N'dbo.sproc_GetRule', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sproc_GetRule;
GO
CREATE PROCEDURE dbo.sproc_GetRule
    @aRuleId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT r.aRuleId,
           r.tRuleName,
           r.tDescription,
           r.nPriority,
           r.bIsActive,
           (SELECT COUNT(1) FROM dbo.tblRuleCondition rcCount WHERE rcCount.aRuleId = r.aRuleId) AS nConditionCount,
           r.dtCreatedDate,
           r.dtModifiedDate
    FROM dbo.tblRule r
    WHERE r.aRuleId = @aRuleId;

    /*
       LEFT JOIN is intentional. Older rules may have conditions created
       before condition groups were introduced. Such conditions are treated
       as one default group while being edited.
    */
    SELECT rc.aRuleConditionId,
           rc.aRuleId,
           rc.aFieldId,
           fc.tDisplayName,
           fc.tFieldType,
           rc.tLogicalOperator,
           rc.tOperator,
           rc.tValue,
           rc.nConditionOrder,
           COALESCE(rg.nGroupOrder, 1) AS nGroupOrder,
           COALESCE(rg.tLogicalOperator, 'AND') AS tGroupLogicalOperator
    FROM dbo.tblRuleCondition rc
    INNER JOIN dbo.tblFieldConfiguration fc
        ON fc.aFieldId = rc.aFieldId
    LEFT JOIN dbo.tblRuleConditionGroup rg
        ON rg.aRuleConditionGroupId = rc.aRuleConditionGroupId
    WHERE rc.aRuleId = @aRuleId
    ORDER BY COALESCE(rg.nGroupOrder, 1), rc.nConditionOrder, rc.aRuleConditionId;
END;
GO

IF OBJECT_ID(N'dbo.sproc_DeleteRule', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sproc_DeleteRule;
GO
CREATE PROCEDURE dbo.sproc_DeleteRule
    @aRuleId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;
    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.tblRule WHERE aRuleId = @aRuleId)
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT 0 AS Result;
            RETURN;
        END;

        DELETE FROM dbo.tblRuleCondition WHERE aRuleId = @aRuleId;
        DELETE FROM dbo.tblRuleConditionGroup WHERE aRuleId = @aRuleId;
        DELETE FROM dbo.tblRule WHERE aRuleId = @aRuleId;

        COMMIT TRANSACTION;
        SELECT 1 AS Result;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

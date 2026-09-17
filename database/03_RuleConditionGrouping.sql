/*
    Rule condition grouping migration.
    Execute database/01_Tables.sql and database/02_StoredProcedures.sql first,
    then execute this script against CET_configuration.
*/

IF OBJECT_ID(N'dbo.sproc_GetRule', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sproc_GetRule;
GO
CREATE PROCEDURE dbo.sproc_GetRule
    @aRuleId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT aRuleId, tRuleName, tDescription, nPriority, bIsActive,
           dtCreatedDate, dtModifiedDate
    FROM dbo.tblRule
    WHERE aRuleId = @aRuleId;

    SELECT rc.aRuleConditionId,
           rc.aRuleId,
           rc.aFieldId,
           fc.tDisplayName,
           fc.tFieldType,
           rc.tLogicalOperator,
           rc.tOperator,
           rc.tValue,
           rc.nConditionOrder,
           rg.nGroupOrder,
           rg.tLogicalOperator AS tGroupLogicalOperator
    FROM dbo.tblRuleCondition rc
    INNER JOIN dbo.tblFieldConfiguration fc
        ON fc.aFieldId = rc.aFieldId
    INNER JOIN dbo.tblRuleConditionGroup rg
        ON rg.aRuleConditionGroupId = rc.aRuleConditionGroupId
    WHERE rc.aRuleId = @aRuleId
    ORDER BY rg.nGroupOrder, rc.nConditionOrder, rc.aRuleConditionId;
END;
GO

IF OBJECT_ID(N'dbo.sproc_CreateRule', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sproc_CreateRule;
GO
CREATE PROCEDURE dbo.sproc_CreateRule
    @aRuleId INT,
    @tRuleName NVARCHAR(200),
    @tDescription NVARCHAR(1000),
    @nPriority INT,
    @bIsActive BIT,
    @tConditionsJson NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;
    BEGIN TRY
        IF EXISTS (SELECT 1 FROM dbo.tblRule WHERE aRuleId = @aRuleId)
            THROW 50001, 'A rule with the specified Rule ID already exists.', 1;

        IF EXISTS (SELECT 1 FROM dbo.tblRule WHERE tRuleName = @tRuleName)
            THROW 50002, 'A rule with the specified Rule Name already exists.', 1;

        IF EXISTS (SELECT 1 FROM dbo.tblRule WHERE nPriority = @nPriority)
            THROW 50003, 'A rule with the specified Priority already exists.', 1;

        IF NOT EXISTS (SELECT 1 FROM OPENJSON(@tConditionsJson))
            THROW 50004, 'At least one rule condition is required.', 1;

        IF EXISTS
        (
            SELECT 1
            FROM OPENJSON(@tConditionsJson) AS conditionJson
            OUTER APPLY
            (
                SELECT TRY_CONVERT(INT, JSON_VALUE(conditionJson.value, '$.FieldId')) AS FieldId,
                       JSON_VALUE(conditionJson.value, '$.LogicalOperator') AS LogicalOperator,
                       JSON_VALUE(conditionJson.value, '$.Operator') AS Operator,
                       JSON_VALUE(conditionJson.value, '$.Value') AS Value,
                       TRY_CONVERT(INT, JSON_VALUE(conditionJson.value, '$.ConditionOrder')) AS ConditionOrder,
                       TRY_CONVERT(INT, JSON_VALUE(conditionJson.value, '$.GroupOrder')) AS GroupOrder,
                       JSON_VALUE(conditionJson.value, '$.GroupLogicalOperator') AS GroupLogicalOperator
            ) conditionData
            LEFT JOIN dbo.tblFieldConfiguration fc
                ON fc.aFieldId = conditionData.FieldId
            WHERE fc.aFieldId IS NULL
               OR fc.bIsActive = 0
               OR conditionData.LogicalOperator NOT IN ('AND', 'OR')
               OR conditionData.GroupLogicalOperator NOT IN ('AND', 'OR')
               OR NULLIF(LTRIM(RTRIM(conditionData.Operator)), '') IS NULL
               OR NULLIF(LTRIM(RTRIM(conditionData.Value)), '') IS NULL
               OR conditionData.ConditionOrder IS NULL
               OR conditionData.ConditionOrder <= 0
               OR conditionData.GroupOrder IS NULL
               OR conditionData.GroupOrder <= 0
        )
            THROW 50005, 'One or more rule conditions are invalid or reference an inactive field.', 1;

        IF EXISTS
        (
            SELECT 1
            FROM OPENJSON(@tConditionsJson) AS conditionJson
            OUTER APPLY
            (
                SELECT TRY_CONVERT(INT, JSON_VALUE(conditionJson.value, '$.GroupOrder')) AS GroupOrder,
                       TRY_CONVERT(INT, JSON_VALUE(conditionJson.value, '$.ConditionOrder')) AS ConditionOrder
            ) conditionData
            GROUP BY conditionData.GroupOrder, conditionData.ConditionOrder
            HAVING COUNT(*) > 1
        )
            THROW 50006, 'Condition order must be unique within each group.', 1;

        IF EXISTS
        (
            SELECT 1
            FROM OPENJSON(@tConditionsJson) AS conditionJson
            OUTER APPLY
            (
                SELECT TRY_CONVERT(INT, JSON_VALUE(conditionJson.value, '$.GroupOrder')) AS GroupOrder
            ) conditionData
            GROUP BY conditionData.GroupOrder
            HAVING MIN(conditionData.GroupOrder) <> 1
                OR MAX(conditionData.GroupOrder) <> COUNT(*)
        )
            THROW 50007, 'Condition group order must be sequential.', 1;

        INSERT INTO dbo.tblRule
        (aRuleId, tRuleName, tDescription, nPriority, bIsActive)
        VALUES (@aRuleId, @tRuleName, @tDescription, @nPriority, @bIsActive);

        INSERT INTO dbo.tblRuleConditionGroup
        (aRuleId, nGroupOrder, tLogicalOperator)
        SELECT @aRuleId,
               groupData.GroupOrder,
               MAX(groupData.GroupLogicalOperator)
        FROM
        (
            SELECT TRY_CONVERT(INT, JSON_VALUE(conditionJson.value, '$.GroupOrder')) AS GroupOrder,
                   COALESCE(JSON_VALUE(conditionJson.value, '$.GroupLogicalOperator'), 'AND') AS GroupLogicalOperator
            FROM OPENJSON(@tConditionsJson) AS conditionJson
        ) groupData
        GROUP BY groupData.GroupOrder;

        INSERT INTO dbo.tblRuleCondition
        (aRuleId, aRuleConditionGroupId, aFieldId, tLogicalOperator, tOperator, tValue, nConditionOrder)
        SELECT @aRuleId,
               rg.aRuleConditionGroupId,
               TRY_CONVERT(INT, JSON_VALUE(conditionJson.value, '$.FieldId')),
               COALESCE(JSON_VALUE(conditionJson.value, '$.LogicalOperator'), 'AND'),
               JSON_VALUE(conditionJson.value, '$.Operator'),
               JSON_VALUE(conditionJson.value, '$.Value'),
               TRY_CONVERT(INT, JSON_VALUE(conditionJson.value, '$.ConditionOrder'))
        FROM OPENJSON(@tConditionsJson) AS conditionJson
        INNER JOIN dbo.tblRuleConditionGroup rg
            ON rg.aRuleId = @aRuleId
           AND rg.nGroupOrder = TRY_CONVERT(INT, JSON_VALUE(conditionJson.value, '$.GroupOrder'));

        COMMIT TRANSACTION;
        SELECT @aRuleId AS aRuleId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

IF OBJECT_ID(N'dbo.sproc_UpdateRule', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sproc_UpdateRule;
GO
CREATE PROCEDURE dbo.sproc_UpdateRule
    @aRuleId INT,
    @tRuleName NVARCHAR(200),
    @tDescription NVARCHAR(1000),
    @nPriority INT,
    @bIsActive BIT,
    @tConditionsJson NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;
    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.tblRule WHERE aRuleId = @aRuleId)
            THROW 50008, 'The specified rule does not exist.', 1;

        IF EXISTS (SELECT 1 FROM dbo.tblRule WHERE tRuleName = @tRuleName AND aRuleId <> @aRuleId)
            THROW 50009, 'A different rule already uses the specified Rule Name.', 1;

        IF EXISTS (SELECT 1 FROM dbo.tblRule WHERE nPriority = @nPriority AND aRuleId <> @aRuleId)
            THROW 50010, 'A different rule already uses the specified Priority.', 1;

        IF NOT EXISTS (SELECT 1 FROM OPENJSON(@tConditionsJson))
            THROW 50011, 'At least one rule condition is required.', 1;

        UPDATE dbo.tblRule
        SET tRuleName = @tRuleName,
            tDescription = @tDescription,
            nPriority = @nPriority,
            bIsActive = @bIsActive,
            dtModifiedDate = GETDATE()
        WHERE aRuleId = @aRuleId;

        DELETE FROM dbo.tblRuleCondition WHERE aRuleId = @aRuleId;
        DELETE FROM dbo.tblRuleConditionGroup WHERE aRuleId = @aRuleId;

        INSERT INTO dbo.tblRuleConditionGroup
        (aRuleId, nGroupOrder, tLogicalOperator)
        SELECT @aRuleId,
               groupData.GroupOrder,
               MAX(groupData.GroupLogicalOperator)
        FROM
        (
            SELECT TRY_CONVERT(INT, JSON_VALUE(conditionJson.value, '$.GroupOrder')) AS GroupOrder,
                   COALESCE(JSON_VALUE(conditionJson.value, '$.GroupLogicalOperator'), 'AND') AS GroupLogicalOperator
            FROM OPENJSON(@tConditionsJson) AS conditionJson
        ) groupData
        GROUP BY groupData.GroupOrder;

        INSERT INTO dbo.tblRuleCondition
        (aRuleId, aRuleConditionGroupId, aFieldId, tLogicalOperator, tOperator, tValue, nConditionOrder)
        SELECT @aRuleId,
               rg.aRuleConditionGroupId,
               TRY_CONVERT(INT, JSON_VALUE(conditionJson.value, '$.FieldId')),
               COALESCE(JSON_VALUE(conditionJson.value, '$.LogicalOperator'), 'AND'),
               JSON_VALUE(conditionJson.value, '$.Operator'),
               JSON_VALUE(conditionJson.value, '$.Value'),
               TRY_CONVERT(INT, JSON_VALUE(conditionJson.value, '$.ConditionOrder'))
        FROM OPENJSON(@tConditionsJson) AS conditionJson
        INNER JOIN dbo.tblRuleConditionGroup rg
            ON rg.aRuleId = @aRuleId
           AND rg.nGroupOrder = TRY_CONVERT(INT, JSON_VALUE(conditionJson.value, '$.GroupOrder'));

        COMMIT TRANSACTION;
        SELECT 1 AS Result;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
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

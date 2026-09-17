/*
    CET Configuration Database Objects - Rule Configuration Procedures
    Target database: CET_configuration

    Execute this script manually after 04_RuleConfiguration_Tables.sql.
*/

IF OBJECT_ID(N'dbo.sproc_GetRules', N'P') IS NOT NULL
BEGIN
    DROP PROCEDURE dbo.sproc_GetRules;
END;
GO

CREATE PROCEDURE dbo.sproc_GetRules
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        aRuleId,
        tRuleName,
        tDescription,
        nPriority,
        bIsActive,
        dtCreatedDate,
        dtModifiedDate
    FROM dbo.tblRule
    ORDER BY
        nPriority,
        aRuleId;
END;
GO

IF OBJECT_ID(N'dbo.sproc_GetRule', N'P') IS NOT NULL
BEGIN
    DROP PROCEDURE dbo.sproc_GetRule;
END;
GO

CREATE PROCEDURE dbo.sproc_GetRule
    @aRuleId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        aRuleId,
        tRuleName,
        tDescription,
        nPriority,
        bIsActive,
        dtCreatedDate,
        dtModifiedDate
    FROM dbo.tblRule
    WHERE aRuleId = @aRuleId;

    SELECT
        rc.aRuleConditionId,
        rc.aRuleId,
        rc.aFieldId,
        fc.tDisplayName,
        fc.tFieldType,
        rc.tLogicalOperator,
        rc.tOperator,
        rc.tValue,
        rc.nConditionOrder
    FROM dbo.tblRuleCondition rc
    INNER JOIN dbo.tblFieldConfiguration fc
        ON fc.aFieldId = rc.aFieldId
    WHERE rc.aRuleId = @aRuleId
    ORDER BY
        rc.nConditionOrder,
        rc.aRuleConditionId;
END;
GO

IF OBJECT_ID(N'dbo.sproc_GetActiveRuleFields', N'P') IS NOT NULL
BEGIN
    DROP PROCEDURE dbo.sproc_GetActiveRuleFields;
END;
GO

CREATE PROCEDURE dbo.sproc_GetActiveRuleFields
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        aFieldId,
        tDisplayName,
        tFieldType
    FROM dbo.tblFieldConfiguration
    WHERE bIsActive = 1
    ORDER BY
        nDisplayOrder,
        aFieldId;
END;
GO

IF OBJECT_ID(N'dbo.sproc_CreateRule', N'P') IS NOT NULL
BEGIN
    DROP PROCEDURE dbo.sproc_CreateRule;
END;
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
        IF EXISTS
        (
            SELECT 1
            FROM dbo.tblRule
            WHERE aRuleId = @aRuleId
        )
        BEGIN
            THROW 50001, 'A rule with the specified Rule ID already exists.', 1;
        END;

        IF EXISTS
        (
            SELECT 1
            FROM dbo.tblRule
            WHERE tRuleName = @tRuleName
        )
        BEGIN
            THROW 50002, 'A rule with the specified Rule Name already exists.', 1;
        END;

        IF EXISTS
        (
            SELECT 1
            FROM dbo.tblRule
            WHERE nPriority = @nPriority
        )
        BEGIN
            THROW 50003, 'A rule with the specified Priority already exists.', 1;
        END;

        IF NOT EXISTS
        (
            SELECT 1
            FROM OPENJSON(@tConditionsJson)
        )
        BEGIN
            THROW 50004, 'At least one rule condition is required.', 1;
        END;

        IF EXISTS
        (
            SELECT 1
            FROM OPENJSON(@tConditionsJson) AS conditionJson
            OUTER APPLY
            (
                SELECT
                    TRY_CONVERT(
                        INT,
                        JSON_VALUE(conditionJson.value, '$.FieldId')
                    ) AS FieldId,
                    JSON_VALUE(
                        conditionJson.value,
                        '$.LogicalOperator'
                    ) AS LogicalOperator,
                    JSON_VALUE(
                        conditionJson.value,
                        '$.Operator'
                    ) AS Operator,
                    JSON_VALUE(
                        conditionJson.value,
                        '$.Value'
                    ) AS Value,
                    TRY_CONVERT(
                        INT,
                        JSON_VALUE(
                            conditionJson.value,
                            '$.ConditionOrder'
                        )
                    ) AS ConditionOrder
            ) conditionData
            LEFT JOIN dbo.tblFieldConfiguration fc
                ON fc.aFieldId = conditionData.FieldId
            WHERE conditionData.FieldId IS NULL
               OR fc.aFieldId IS NULL
               OR fc.bIsActive = 0
               OR conditionData.LogicalOperator NOT IN ('AND', 'OR')
               OR NULLIF(LTRIM(RTRIM(conditionData.Operator)), '') IS NULL
               OR NULLIF(LTRIM(RTRIM(conditionData.Value)), '') IS NULL
               OR conditionData.ConditionOrder IS NULL
               OR conditionData.ConditionOrder <= 0
        )
        BEGIN
            THROW 50005, 'One or more rule conditions are invalid or reference an inactive field.', 1;
        END;

        IF EXISTS
        (
            SELECT
                conditionData.ConditionOrder
            FROM OPENJSON(@tConditionsJson) AS conditionJson
            OUTER APPLY
            (
                SELECT TRY_CONVERT
                (
                    INT,
                    JSON_VALUE
                    (
                        conditionJson.value,
                        '$.ConditionOrder'
                    )
                ) AS ConditionOrder
            ) conditionData
            GROUP BY conditionData.ConditionOrder
            HAVING COUNT(*) > 1
        )
        BEGIN
            THROW 50006, 'Rule condition order must be unique.', 1;
        END;

        INSERT INTO dbo.tblRule
        (
            aRuleId,
            tRuleName,
            tDescription,
            nPriority,
            bIsActive
        )
        VALUES
        (
            @aRuleId,
            @tRuleName,
            @tDescription,
            @nPriority,
            @bIsActive
        );

        INSERT INTO dbo.tblRuleCondition
        (
            aRuleId,
            aFieldId,
            tLogicalOperator,
            tOperator,
            tValue,
            nConditionOrder
        )
        SELECT
            @aRuleId,
            conditionData.FieldId,
            COALESCE(conditionData.LogicalOperator, 'AND'),
            conditionData.Operator,
            conditionData.Value,
            conditionData.ConditionOrder
        FROM OPENJSON(@tConditionsJson) AS conditionJson
        OUTER APPLY
        (
            SELECT
                TRY_CONVERT
                (
                    INT,
                    JSON_VALUE(conditionJson.value, '$.FieldId')
                ) AS FieldId,
                JSON_VALUE
                (
                    conditionJson.value,
                    '$.LogicalOperator'
                ) AS LogicalOperator,
                JSON_VALUE
                (
                    conditionJson.value,
                    '$.Operator'
                ) AS Operator,
                JSON_VALUE
                (
                    conditionJson.value,
                    '$.Value'
                ) AS Value,
                TRY_CONVERT
                (
                    INT,
                    JSON_VALUE
                    (
                        conditionJson.value,
                        '$.ConditionOrder'
                    )
                ) AS ConditionOrder
        ) conditionData;

        COMMIT TRANSACTION;

        SELECT @aRuleId AS aRuleId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
        BEGIN
            ROLLBACK TRANSACTION;
        END;

        THROW;
    END CATCH;
END;
GO

IF OBJECT_ID(N'dbo.sproc_UpdateRule', N'P') IS NOT NULL
BEGIN
    DROP PROCEDURE dbo.sproc_UpdateRule;
END;
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
        IF NOT EXISTS
        (
            SELECT 1
            FROM dbo.tblRule
            WHERE aRuleId = @aRuleId
        )
        BEGIN
            THROW 50007, 'The specified rule does not exist.', 1;
        END;

        IF EXISTS
        (
            SELECT 1
            FROM dbo.tblRule
            WHERE tRuleName = @tRuleName
              AND aRuleId <> @aRuleId
        )
        BEGIN
            THROW 50008, 'A different rule already uses the specified Rule Name.', 1;
        END;

        IF EXISTS
        (
            SELECT 1
            FROM dbo.tblRule
            WHERE nPriority = @nPriority
              AND aRuleId <> @aRuleId
        )
        BEGIN
            THROW 50009, 'A different rule already uses the specified Priority.', 1;
        END;

        IF NOT EXISTS
        (
            SELECT 1
            FROM OPENJSON(@tConditionsJson)
        )
        BEGIN
            THROW 50010, 'At least one rule condition is required.', 1;
        END;

        IF EXISTS
        (
            SELECT 1
            FROM OPENJSON(@tConditionsJson) AS conditionJson
            OUTER APPLY
            (
                SELECT
                    TRY_CONVERT
                    (
                        INT,
                        JSON_VALUE(conditionJson.value, '$.FieldId')
                    ) AS FieldId,
                    JSON_VALUE
                    (
                        conditionJson.value,
                        '$.LogicalOperator'
                    ) AS LogicalOperator,
                    JSON_VALUE
                    (
                        conditionJson.value,
                        '$.Operator'
                    ) AS Operator,
                    JSON_VALUE
                    (
                        conditionJson.value,
                        '$.Value'
                    ) AS Value,
                    TRY_CONVERT
                    (
                        INT,
                        JSON_VALUE
                        (
                            conditionJson.value,
                            '$.ConditionOrder'
                        )
                    ) AS ConditionOrder
            ) conditionData
            LEFT JOIN dbo.tblFieldConfiguration fc
                ON fc.aFieldId = conditionData.FieldId
            WHERE conditionData.FieldId IS NULL
               OR fc.aFieldId IS NULL
               OR fc.bIsActive = 0
               OR conditionData.LogicalOperator NOT IN ('AND', 'OR')
               OR NULLIF(LTRIM(RTRIM(conditionData.Operator)), '') IS NULL
               OR NULLIF(LTRIM(RTRIM(conditionData.Value)), '') IS NULL
               OR conditionData.ConditionOrder IS NULL
               OR conditionData.ConditionOrder <= 0
        )
        BEGIN
            THROW 50011, 'One or more rule conditions are invalid or reference an inactive field.', 1;
        END;

        IF EXISTS
        (
            SELECT
                conditionData.ConditionOrder
            FROM OPENJSON(@tConditionsJson) AS conditionJson
            OUTER APPLY
            (
                SELECT TRY_CONVERT
                (
                    INT,
                    JSON_VALUE
                    (
                        conditionJson.value,
                        '$.ConditionOrder'
                    )
                ) AS ConditionOrder
            ) conditionData
            GROUP BY conditionData.ConditionOrder
            HAVING COUNT(*) > 1
        )
        BEGIN
            THROW 50012, 'Rule condition order must be unique.', 1;
        END;

        UPDATE dbo.tblRule
        SET
            tRuleName = @tRuleName,
            tDescription = @tDescription,
            nPriority = @nPriority,
            bIsActive = @bIsActive,
            dtModifiedDate = GETDATE()
        WHERE aRuleId = @aRuleId;

        DELETE FROM dbo.tblRuleCondition
        WHERE aRuleId = @aRuleId;

        INSERT INTO dbo.tblRuleCondition
        (
            aRuleId,
            aFieldId,
            tLogicalOperator,
            tOperator,
            tValue,
            nConditionOrder
        )
        SELECT
            @aRuleId,
            conditionData.FieldId,
            COALESCE(conditionData.LogicalOperator, 'AND'),
            conditionData.Operator,
            conditionData.Value,
            conditionData.ConditionOrder
        FROM OPENJSON(@tConditionsJson) AS conditionJson
        OUTER APPLY
        (
            SELECT
                TRY_CONVERT
                (
                    INT,
                    JSON_VALUE(conditionJson.value, '$.FieldId')
                ) AS FieldId,
                JSON_VALUE
                (
                    conditionJson.value,
                    '$.LogicalOperator'
                ) AS LogicalOperator,
                JSON_VALUE
                (
                    conditionJson.value,
                    '$.Operator'
                ) AS Operator,
                JSON_VALUE
                (
                    conditionJson.value,
                    '$.Value'
                ) AS Value,
                TRY_CONVERT
                (
                    INT,
                    JSON_VALUE
                    (
                        conditionJson.value,
                        '$.ConditionOrder'
                    )
                ) AS ConditionOrder
        ) conditionData;

        COMMIT TRANSACTION;

        SELECT 1 AS Result;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
        BEGIN
            ROLLBACK TRANSACTION;
        END;

        THROW;
    END CATCH;
END;
GO

IF OBJECT_ID(N'dbo.sproc_DeleteRule', N'P') IS NOT NULL
BEGIN
    DROP PROCEDURE dbo.sproc_DeleteRule;
END;
GO

CREATE PROCEDURE dbo.sproc_DeleteRule
    @aRuleId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    BEGIN TRY
        IF NOT EXISTS
        (
            SELECT 1
            FROM dbo.tblRule
            WHERE aRuleId = @aRuleId
        )
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT 0 AS Result;
            RETURN;
        END;

        DELETE FROM dbo.tblRuleCondition
        WHERE aRuleId = @aRuleId;

        DELETE FROM dbo.tblRule
        WHERE aRuleId = @aRuleId;

        COMMIT TRANSACTION;

        SELECT 1 AS Result;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
        BEGIN
            ROLLBACK TRANSACTION;
        END;

        THROW;
    END CATCH;
END;
GO

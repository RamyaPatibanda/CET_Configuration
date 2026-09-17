/*
    CET Configuration Database Objects - Stored Procedures
    Target database: CET_configuration

    Execute this script manually against the CET_configuration database.
    Existing procedures are dropped and recreated so the script always
    deploys the exact current procedure definitions.

    This file contains all CET Configuration stored procedures for:
    - Authentication
    - Field Configuration
    - Rule Configuration
*/

/* ================================================================
   Authentication
   ================================================================ */

IF OBJECT_ID(N'dbo.sproc_GetLoginUser', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sproc_GetLoginUser;
GO

CREATE PROCEDURE dbo.sproc_GetLoginUser
    @tUsername NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        aUserId,
        tUsername,
        tDisplayName,
        bIsAdmin,
        tPassword,
        bIsActive
    FROM dbo.tblUsers
    WHERE tUsername = @tUsername;
END;
GO

/* ================================================================
   Field Configuration
   ================================================================ */

IF OBJECT_ID(N'dbo.sproc_GetFields', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sproc_GetFields;
GO

CREATE PROCEDURE dbo.sproc_GetFields
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        aFieldId,
        tTableName,
        tFieldName,
        tDisplayName,
        tFieldType,
        bIsRequired,
        bIsActive,
        nDisplayOrder,
        dtCreatedDate,
        dtModifiedDate
    FROM dbo.tblFieldConfiguration
    ORDER BY
        nDisplayOrder,
        aFieldId;
END;
GO

IF OBJECT_ID(N'dbo.sproc_GetField', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sproc_GetField;
GO

CREATE PROCEDURE dbo.sproc_GetField
    @aFieldId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        aFieldId,
        tTableName,
        tFieldName,
        tDisplayName,
        tFieldType,
        bIsRequired,
        bIsActive,
        nDisplayOrder,
        dtCreatedDate,
        dtModifiedDate
    FROM dbo.tblFieldConfiguration
    WHERE aFieldId = @aFieldId;
END;
GO

IF OBJECT_ID(N'dbo.sproc_CreateField', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sproc_CreateField;
GO

CREATE PROCEDURE dbo.sproc_CreateField
    @aFieldId INT,
    @tTableName NVARCHAR(128),
    @tFieldName NVARCHAR(200),
    @tDisplayName NVARCHAR(200),
    @tFieldType NVARCHAR(50),
    @bIsRequired BIT,
    @bIsActive BIT,
    @nDisplayOrder INT
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.tblFieldConfiguration
    (
        aFieldId,
        tTableName,
        tFieldName,
        tDisplayName,
        tFieldType,
        bIsRequired,
        bIsActive,
        nDisplayOrder,
        dtCreatedDate,
        dtModifiedDate
    )
    VALUES
    (
        @aFieldId,
        @tTableName,
        @tFieldName,
        @tDisplayName,
        @tFieldType,
        @bIsRequired,
        @bIsActive,
        @nDisplayOrder,
        GETDATE(),
        NULL
    );

    SELECT @aFieldId AS aFieldId;
END;
GO

IF OBJECT_ID(N'dbo.sproc_UpdateField', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sproc_UpdateField;
GO

CREATE PROCEDURE dbo.sproc_UpdateField
    @aFieldId INT,
    @tTableName NVARCHAR(128),
    @tFieldName NVARCHAR(200),
    @tDisplayName NVARCHAR(200),
    @tFieldType NVARCHAR(50),
    @bIsRequired BIT,
    @bIsActive BIT,
    @nDisplayOrder INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.tblFieldConfiguration
    SET
        tTableName = @tTableName,
        tFieldName = @tFieldName,
        tDisplayName = @tDisplayName,
        tFieldType = @tFieldType,
        bIsRequired = @bIsRequired,
        bIsActive = @bIsActive,
        nDisplayOrder = @nDisplayOrder,
        dtModifiedDate = GETDATE()
    WHERE aFieldId = @aFieldId;

    SELECT @@ROWCOUNT AS AffectedRows;
END;
GO

IF OBJECT_ID(N'dbo.sproc_DeleteField', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sproc_DeleteField;
GO

CREATE PROCEDURE dbo.sproc_DeleteField
    @aFieldId INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM dbo.tblFieldConfiguration
    WHERE aFieldId = @aFieldId;

    SELECT @@ROWCOUNT AS AffectedRows;
END;
GO

/* ================================================================
   Rule Configuration
   ================================================================ */

IF OBJECT_ID(N'dbo.sproc_GetRules', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sproc_GetRules;
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
    DROP PROCEDURE dbo.sproc_GetRule;
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
    DROP PROCEDURE dbo.sproc_GetActiveRuleFields;
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
                SELECT
                    TRY_CONVERT(INT, JSON_VALUE(conditionJson.value, '$.FieldId')) AS FieldId,
                    JSON_VALUE(conditionJson.value, '$.LogicalOperator') AS LogicalOperator,
                    JSON_VALUE(conditionJson.value, '$.Operator') AS Operator,
                    JSON_VALUE(conditionJson.value, '$.Value') AS Value,
                    TRY_CONVERT(INT, JSON_VALUE(conditionJson.value, '$.ConditionOrder')) AS ConditionOrder
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
            THROW 50005, 'One or more rule conditions are invalid or reference an inactive field.', 1;

        IF EXISTS
        (
            SELECT conditionData.ConditionOrder
            FROM OPENJSON(@tConditionsJson) AS conditionJson
            OUTER APPLY
            (
                SELECT TRY_CONVERT(INT, JSON_VALUE(conditionJson.value, '$.ConditionOrder')) AS ConditionOrder
            ) conditionData
            GROUP BY conditionData.ConditionOrder
            HAVING COUNT(*) > 1
        )
            THROW 50006, 'Rule condition order must be unique.', 1;

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
            TRY_CONVERT(INT, JSON_VALUE(conditionJson.value, '$.FieldId')),
            COALESCE(JSON_VALUE(conditionJson.value, '$.LogicalOperator'), 'AND'),
            JSON_VALUE(conditionJson.value, '$.Operator'),
            JSON_VALUE(conditionJson.value, '$.Value'),
            TRY_CONVERT(INT, JSON_VALUE(conditionJson.value, '$.ConditionOrder'))
        FROM OPENJSON(@tConditionsJson) AS conditionJson;

        COMMIT TRANSACTION;
        SELECT @aRuleId AS aRuleId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
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
            THROW 50007, 'The specified rule does not exist.', 1;

        IF EXISTS
        (
            SELECT 1
            FROM dbo.tblRule
            WHERE tRuleName = @tRuleName
              AND aRuleId <> @aRuleId
        )
            THROW 50008, 'A different rule already uses the specified Rule Name.', 1;

        IF EXISTS
        (
            SELECT 1
            FROM dbo.tblRule
            WHERE nPriority = @nPriority
              AND aRuleId <> @aRuleId
        )
            THROW 50009, 'A different rule already uses the specified Priority.', 1;

        IF NOT EXISTS (SELECT 1 FROM OPENJSON(@tConditionsJson))
            THROW 50010, 'At least one rule condition is required.', 1;

        IF EXISTS
        (
            SELECT 1
            FROM OPENJSON(@tConditionsJson) AS conditionJson
            OUTER APPLY
            (
                SELECT
                    TRY_CONVERT(INT, JSON_VALUE(conditionJson.value, '$.FieldId')) AS FieldId,
                    JSON_VALUE(conditionJson.value, '$.LogicalOperator') AS LogicalOperator,
                    JSON_VALUE(conditionJson.value, '$.Operator') AS Operator,
                    JSON_VALUE(conditionJson.value, '$.Value') AS Value,
                    TRY_CONVERT(INT, JSON_VALUE(conditionJson.value, '$.ConditionOrder')) AS ConditionOrder
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
            THROW 50011, 'One or more rule conditions are invalid or reference an inactive field.', 1;

        IF EXISTS
        (
            SELECT conditionData.ConditionOrder
            FROM OPENJSON(@tConditionsJson) AS conditionJson
            OUTER APPLY
            (
                SELECT TRY_CONVERT(INT, JSON_VALUE(conditionJson.value, '$.ConditionOrder')) AS ConditionOrder
            ) conditionData
            GROUP BY conditionData.ConditionOrder
            HAVING COUNT(*) > 1
        )
            THROW 50012, 'Rule condition order must be unique.', 1;

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
            TRY_CONVERT(INT, JSON_VALUE(conditionJson.value, '$.FieldId')),
            COALESCE(JSON_VALUE(conditionJson.value, '$.LogicalOperator'), 'AND'),
            JSON_VALUE(conditionJson.value, '$.Operator'),
            JSON_VALUE(conditionJson.value, '$.Value'),
            TRY_CONVERT(INT, JSON_VALUE(conditionJson.value, '$.ConditionOrder'))
        FROM OPENJSON(@tConditionsJson) AS conditionJson;

        COMMIT TRANSACTION;
        SELECT 1 AS Result;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
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

        DELETE FROM dbo.tblRuleCondition
        WHERE aRuleId = @aRuleId;

        DELETE FROM dbo.tblRule
        WHERE aRuleId = @aRuleId;

        COMMIT TRANSACTION;
        SELECT 1 AS Result;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

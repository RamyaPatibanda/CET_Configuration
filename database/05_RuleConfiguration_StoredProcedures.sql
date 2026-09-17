/*
    CET Configuration - Rule Configuration Stored Procedures

    Execute this script manually against the CET_configuration database.
    Existing rule procedures are dropped and recreated.
*/

IF OBJECT_ID(N'dbo.sproc_GetRules', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_GetRules;
GO
CREATE PROCEDURE dbo.sproc_GetRules
AS
BEGIN
    SET NOCOUNT ON;
    SELECT aRuleId, tRuleName, tDescription, nPriority, bIsActive, dtCreatedDate, dtModifiedDate
    FROM dbo.tblRuleConfiguration
    ORDER BY nPriority, aRuleId;
END;
GO

IF OBJECT_ID(N'dbo.sproc_GetRule', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_GetRule;
GO
CREATE PROCEDURE dbo.sproc_GetRule
    @aRuleId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT aRuleId, tRuleName, tDescription, nPriority, bIsActive, dtCreatedDate, dtModifiedDate
    FROM dbo.tblRuleConfiguration
    WHERE aRuleId = @aRuleId;

    SELECT aRuleConditionId, aRuleId, aFieldId, tOperator, tValue, nConditionOrder
    FROM dbo.tblRuleCondition
    WHERE aRuleId = @aRuleId
    ORDER BY nConditionOrder, aRuleConditionId;
END;
GO

IF OBJECT_ID(N'dbo.sproc_CreateRule', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_CreateRule;
GO
CREATE PROCEDURE dbo.sproc_CreateRule
    @tRuleName NVARCHAR(200),
    @tDescription NVARCHAR(1000) = NULL,
    @nPriority INT,
    @bIsActive BIT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.tblRuleConfiguration(tRuleName, tDescription, nPriority, bIsActive, dtCreatedDate)
    VALUES(@tRuleName, @tDescription, @nPriority, @bIsActive, GETDATE());
    SELECT CONVERT(INT, SCOPE_IDENTITY()) AS aRuleId;
END;
GO

IF OBJECT_ID(N'dbo.sproc_UpdateRule', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_UpdateRule;
GO
CREATE PROCEDURE dbo.sproc_UpdateRule
    @aRuleId INT,
    @tRuleName NVARCHAR(200),
    @tDescription NVARCHAR(1000) = NULL,
    @nPriority INT,
    @bIsActive BIT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.tblRuleConfiguration
    SET tRuleName = @tRuleName,
        tDescription = @tDescription,
        nPriority = @nPriority,
        bIsActive = @bIsActive,
        dtModifiedDate = GETDATE()
    WHERE aRuleId = @aRuleId;
    SELECT @@ROWCOUNT AS AffectedRows;
END;
GO

IF OBJECT_ID(N'dbo.sproc_DeleteRule', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_DeleteRule;
GO
CREATE PROCEDURE dbo.sproc_DeleteRule
    @aRuleId INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.tblRuleConfiguration WHERE aRuleId = @aRuleId;
    SELECT @@ROWCOUNT AS AffectedRows;
END;
GO

IF OBJECT_ID(N'dbo.sproc_ReplaceRuleConditions', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_ReplaceRuleConditions;
GO
CREATE PROCEDURE dbo.sproc_ReplaceRuleConditions
    @aRuleId INT,
    @tConditions NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM dbo.tblRuleCondition WHERE aRuleId = @aRuleId;

    INSERT INTO dbo.tblRuleCondition(aRuleId, aFieldId, tOperator, tValue, nConditionOrder)
    SELECT
        @aRuleId,
        TRY_CONVERT(INT, JSON_VALUE(value, '$.fieldId')),
        JSON_VALUE(value, '$.operator'),
        JSON_VALUE(value, '$.value'),
        TRY_CONVERT(INT, JSON_VALUE(value, '$.conditionOrder'))
    FROM OPENJSON(@tConditions)
    WHERE TRY_CONVERT(INT, JSON_VALUE(value, '$.fieldId')) IS NOT NULL;
END;
GO

IF OBJECT_ID(N'dbo.sproc_GetActiveRuleFields', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_GetActiveRuleFields;
GO
CREATE PROCEDURE dbo.sproc_GetActiveRuleFields
AS
BEGIN
    SET NOCOUNT ON;
    SELECT aFieldId, tTableName, tFieldName, tDisplayName, tFieldType, bIsRequired, bIsActive, nDisplayOrder
    FROM dbo.tblFieldConfiguration
    WHERE bIsActive = 1
    ORDER BY nDisplayOrder, aFieldId;
END;
GO

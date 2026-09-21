/*
    CET Configuration - Rule Outcome Migration
    Run this script against CET_configuration after 01_Tables.sql / 02_StoredProcedures.sql.

    Rule Configuration now owns:
      - Decision area
      - Supporting/outcome values

    Allocation Run only selects rules by decision area.
*/

IF COL_LENGTH(N'dbo.tblRule', N'tDecisionAreaCode') IS NULL
    ALTER TABLE dbo.tblRule ADD tDecisionAreaCode NVARCHAR(100) NOT NULL CONSTRAINT DF_tblRule_tDecisionAreaCode DEFAULT (N'');
GO

IF COL_LENGTH(N'dbo.tblRule', N'tOutcomeJson') IS NULL
    ALTER TABLE dbo.tblRule ADD tOutcomeJson NVARCHAR(MAX) NOT NULL CONSTRAINT DF_tblRule_tOutcomeJson DEFAULT (N'{}');
GO

UPDATE dbo.tblRule
SET tDecisionAreaCode = CASE
    WHEN NULLIF(LTRIM(RTRIM(tDecisionAreaCode)), N'') IS NULL THEN N'CANDIDATE_QUALIFICATION'
    ELSE tDecisionAreaCode
END,
tOutcomeJson = CASE
    WHEN NULLIF(LTRIM(RTRIM(tOutcomeJson)), N'') IS NULL THEN N'{}'
    ELSE tOutcomeJson
END;
GO

IF OBJECT_ID(N'dbo.sproc_GetRulesV2', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_GetRulesV2;
GO
CREATE PROCEDURE dbo.sproc_GetRulesV2
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        r.aRuleId,
        r.tRuleName,
        r.tDescription,
        r.nPriority,
        r.bIsActive,
        r.tDecisionAreaCode,
        r.tOutcomeJson,
        (SELECT COUNT(1) FROM dbo.tblRuleCondition rc WHERE rc.aRuleId = r.aRuleId) AS nConditionCount,
        r.dtCreatedDate,
        r.dtModifiedDate
    FROM dbo.tblRule r
    ORDER BY r.nPriority, r.aRuleId;
END;
GO

IF OBJECT_ID(N'dbo.sproc_GetRuleV2', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_GetRuleV2;
GO
CREATE PROCEDURE dbo.sproc_GetRuleV2
    @aRuleId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        r.aRuleId,
        r.tRuleName,
        r.tDescription,
        r.nPriority,
        r.bIsActive,
        r.tDecisionAreaCode,
        r.tOutcomeJson,
        (SELECT COUNT(1) FROM dbo.tblRuleCondition rcCount WHERE rcCount.aRuleId = r.aRuleId) AS nConditionCount,
        r.dtCreatedDate,
        r.dtModifiedDate
    FROM dbo.tblRule r
    WHERE r.aRuleId = @aRuleId;

    SELECT
        rc.aRuleConditionId,
        rc.aRuleId,
        rc.aFieldId,
        fc.tDisplayName,
        fc.tFieldName,
        fc.tFieldType,
        rc.tLogicalOperator,
        rc.tOperator,
        rc.tValue,
        rc.nConditionOrder,
        COALESCE(rg.nGroupOrder, 1) AS nGroupOrder
    FROM dbo.tblRuleCondition rc
    INNER JOIN dbo.tblFieldConfiguration fc ON fc.aFieldId = rc.aFieldId
    LEFT JOIN dbo.tblRuleConditionGroup rg ON rg.aRuleConditionGroupId = rc.aRuleConditionGroupId
    WHERE rc.aRuleId = @aRuleId
    ORDER BY COALESCE(rg.nGroupOrder, 1), rc.nConditionOrder, rc.aRuleConditionId;
END;
GO

IF OBJECT_ID(N'dbo.sproc_CreateRuleV2', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_CreateRuleV2;
GO
CREATE PROCEDURE dbo.sproc_CreateRuleV2
    @aRuleId INT,
    @tRuleName NVARCHAR(200),
    @tDescription NVARCHAR(1000),
    @nPriority INT,
    @bIsActive BIT,
    @tDecisionAreaCode NVARCHAR(100),
    @tOutcomeJson NVARCHAR(MAX),
    @tConditionsJson NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    BEGIN TRY
        IF EXISTS (SELECT 1 FROM dbo.tblRule WHERE aRuleId = @aRuleId)
            THROW 50101, 'A rule with the specified Rule ID already exists.', 1;
        IF EXISTS (SELECT 1 FROM dbo.tblRule WHERE tRuleName = @tRuleName)
            THROW 50102, 'A rule with the specified Rule Name already exists.', 1;
        IF EXISTS (SELECT 1 FROM dbo.tblRule WHERE nPriority = @nPriority)
            THROW 50103, 'A rule with the specified Priority already exists.', 1;

        IF @tDecisionAreaCode NOT IN
            ('CANDIDATE_QUALIFICATION','SPECIAL_RESERVATION_ELIGIBILITY','PREFERENCE_EVALUATION','SEAT_ELIGIBILITY','SEAT_ALLOCATION','BETTERMENT','CONVERSION')
            THROW 50104, 'Invalid rule decision area.', 1;

        IF ISJSON(COALESCE(@tOutcomeJson, N'{}')) <> 1
            THROW 50105, 'Rule outcome must be valid JSON.', 1;

        IF NOT EXISTS (SELECT 1 FROM OPENJSON(@tConditionsJson))
            THROW 50106, 'At least one rule condition is required.', 1;

        INSERT INTO dbo.tblRule
        (
            aRuleId, tRuleName, tDescription, nPriority, bIsActive,
            tDecisionAreaCode, tOutcomeJson
        )
        VALUES
        (
            @aRuleId, @tRuleName, @tDescription, @nPriority, @bIsActive,
            @tDecisionAreaCode, @tOutcomeJson
        );

        INSERT INTO dbo.tblRuleConditionGroup (aRuleId, nGroupOrder, tLogicalOperator)
        SELECT @aRuleId, d.GroupOrder, 'AND'
        FROM
        (
            SELECT DISTINCT TRY_CONVERT(INT, JSON_VALUE(j.value, '$.GroupOrder')) AS GroupOrder
            FROM OPENJSON(@tConditionsJson) j
        ) d;

        INSERT INTO dbo.tblRuleCondition
        (
            aRuleId, aRuleConditionGroupId, aFieldId, tLogicalOperator,
            tOperator, tValue, nConditionOrder
        )
        SELECT
            @aRuleId,
            rg.aRuleConditionGroupId,
            TRY_CONVERT(INT, JSON_VALUE(j.value, '$.FieldId')),
            COALESCE(JSON_VALUE(j.value, '$.ConditionLogicalOperator'), 'AND'),
            JSON_VALUE(j.value, '$.Operator'),
            JSON_VALUE(j.value, '$.Value'),
            TRY_CONVERT(INT, JSON_VALUE(j.value, '$.ConditionOrder'))
        FROM OPENJSON(@tConditionsJson) j
        INNER JOIN dbo.tblRuleConditionGroup rg
            ON rg.aRuleId = @aRuleId
           AND rg.nGroupOrder = TRY_CONVERT(INT, JSON_VALUE(j.value, '$.GroupOrder'));

        COMMIT;
        SELECT @aRuleId AS aRuleId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH;
END;
GO

IF OBJECT_ID(N'dbo.sproc_UpdateRuleV2', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_UpdateRuleV2;
GO
CREATE PROCEDURE dbo.sproc_UpdateRuleV2
    @aRuleId INT,
    @tRuleName NVARCHAR(200),
    @tDescription NVARCHAR(1000),
    @nPriority INT,
    @bIsActive BIT,
    @tDecisionAreaCode NVARCHAR(100),
    @tOutcomeJson NVARCHAR(MAX),
    @tConditionsJson NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.tblRule WHERE aRuleId = @aRuleId)
            THROW 50107, 'The specified rule does not exist.', 1;
        IF EXISTS (SELECT 1 FROM dbo.tblRule WHERE tRuleName = @tRuleName AND aRuleId <> @aRuleId)
            THROW 50108, 'A different rule already uses the specified Rule Name.', 1;
        IF EXISTS (SELECT 1 FROM dbo.tblRule WHERE nPriority = @nPriority AND aRuleId <> @aRuleId)
            THROW 50109, 'A different rule already uses the specified Priority.', 1;

        IF @tDecisionAreaCode NOT IN
            ('CANDIDATE_QUALIFICATION','SPECIAL_RESERVATION_ELIGIBILITY','PREFERENCE_EVALUATION','SEAT_ELIGIBILITY','SEAT_ALLOCATION','BETTERMENT','CONVERSION')
            THROW 50110, 'Invalid rule decision area.', 1;

        IF ISJSON(COALESCE(@tOutcomeJson, N'{}')) <> 1
            THROW 50111, 'Rule outcome must be valid JSON.', 1;

        IF NOT EXISTS (SELECT 1 FROM OPENJSON(@tConditionsJson))
            THROW 50112, 'At least one rule condition is required.', 1;

        UPDATE dbo.tblRule
        SET
            tRuleName = @tRuleName,
            tDescription = @tDescription,
            nPriority = @nPriority,
            bIsActive = @bIsActive,
            tDecisionAreaCode = @tDecisionAreaCode,
            tOutcomeJson = @tOutcomeJson,
            dtModifiedDate = GETDATE()
        WHERE aRuleId = @aRuleId;

        DELETE FROM dbo.tblRuleCondition WHERE aRuleId = @aRuleId;
        DELETE FROM dbo.tblRuleConditionGroup WHERE aRuleId = @aRuleId;

        INSERT INTO dbo.tblRuleConditionGroup (aRuleId, nGroupOrder, tLogicalOperator)
        SELECT @aRuleId, d.GroupOrder, 'AND'
        FROM
        (
            SELECT DISTINCT TRY_CONVERT(INT, JSON_VALUE(j.value, '$.GroupOrder')) AS GroupOrder
            FROM OPENJSON(@tConditionsJson) j
        ) d;

        INSERT INTO dbo.tblRuleCondition
        (
            aRuleId, aRuleConditionGroupId, aFieldId, tLogicalOperator,
            tOperator, tValue, nConditionOrder
        )
        SELECT
            @aRuleId,
            rg.aRuleConditionGroupId,
            TRY_CONVERT(INT, JSON_VALUE(j.value, '$.FieldId')),
            COALESCE(JSON_VALUE(j.value, '$.ConditionLogicalOperator'), 'AND'),
            JSON_VALUE(j.value, '$.Operator'),
            JSON_VALUE(j.value, '$.Value'),
            TRY_CONVERT(INT, JSON_VALUE(j.value, '$.ConditionOrder'))
        FROM OPENJSON(@tConditionsJson) j
        INNER JOIN dbo.tblRuleConditionGroup rg
            ON rg.aRuleId = @aRuleId
           AND rg.nGroupOrder = TRY_CONVERT(INT, JSON_VALUE(j.value, '$.GroupOrder'));

        COMMIT;
        SELECT 1 AS Result;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH;
END;
GO

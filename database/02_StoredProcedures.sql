/*
    CET Configuration Database Objects - Stored Procedures
    Target database: CET_configuration

    Execute this script manually against the CET_configuration database.
    Existing procedures are dropped and recreated so the script always
    deploys the exact current procedure definitions.
*/

IF OBJECT_ID(N'dbo.sproc_GetLoginUser', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_GetLoginUser;
GO
CREATE PROCEDURE dbo.sproc_GetLoginUser @tUsername NVARCHAR(100)
AS BEGIN SET NOCOUNT ON; SELECT aUserId, tUsername, tDisplayName, bIsAdmin, tPassword, bIsActive FROM dbo.tblUsers WHERE tUsername = @tUsername; END;
GO

IF OBJECT_ID(N'dbo.sproc_GetFields', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_GetFields;
GO
CREATE PROCEDURE dbo.sproc_GetFields
AS BEGIN SET NOCOUNT ON; SELECT aFieldId, tTableName, tFieldName, tDisplayName, tFieldType, bIsRequired, bIsActive, nDisplayOrder, dtCreatedDate, dtModifiedDate FROM dbo.tblFieldConfiguration ORDER BY nDisplayOrder, aFieldId; END;
GO

IF OBJECT_ID(N'dbo.sproc_GetField', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_GetField;
GO
CREATE PROCEDURE dbo.sproc_GetField @aFieldId INT
AS BEGIN SET NOCOUNT ON; SELECT aFieldId, tTableName, tFieldName, tDisplayName, tFieldType, bIsRequired, bIsActive, nDisplayOrder, dtCreatedDate, dtModifiedDate FROM dbo.tblFieldConfiguration WHERE aFieldId = @aFieldId; END;
GO

IF OBJECT_ID(N'dbo.sproc_CreateField', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_CreateField;
GO
CREATE PROCEDURE dbo.sproc_CreateField
    @aFieldId INT, @tTableName NVARCHAR(128), @tFieldName NVARCHAR(200), @tDisplayName NVARCHAR(200), @tFieldType NVARCHAR(50), @bIsRequired BIT, @bIsActive BIT, @nDisplayOrder INT
AS BEGIN SET NOCOUNT ON; INSERT INTO dbo.tblFieldConfiguration (aFieldId,tTableName,tFieldName,tDisplayName,tFieldType,bIsRequired,bIsActive,nDisplayOrder,dtCreatedDate,dtModifiedDate) VALUES (@aFieldId,@tTableName,@tFieldName,@tDisplayName,@tFieldType,@bIsRequired,@bIsActive,@nDisplayOrder,GETDATE(),NULL); SELECT @aFieldId AS aFieldId; END;
GO

IF OBJECT_ID(N'dbo.sproc_UpdateField', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_UpdateField;
GO
CREATE PROCEDURE dbo.sproc_UpdateField
    @aFieldId INT, @tTableName NVARCHAR(128), @tFieldName NVARCHAR(200), @tDisplayName NVARCHAR(200), @tFieldType NVARCHAR(50), @bIsRequired BIT, @bIsActive BIT, @nDisplayOrder INT
AS BEGIN SET NOCOUNT ON; UPDATE dbo.tblFieldConfiguration SET tTableName=@tTableName,tFieldName=@tFieldName,tDisplayName=@tDisplayName,tFieldType=@tFieldType,bIsRequired=@bIsRequired,bIsActive=@bIsActive,nDisplayOrder=@nDisplayOrder,dtModifiedDate=GETDATE() WHERE aFieldId=@aFieldId; SELECT @@ROWCOUNT AS AffectedRows; END;
GO

IF OBJECT_ID(N'dbo.sproc_DeleteField', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_DeleteField;
GO
CREATE PROCEDURE dbo.sproc_DeleteField @aFieldId INT
AS BEGIN SET NOCOUNT ON; DELETE FROM dbo.tblFieldConfiguration WHERE aFieldId=@aFieldId; SELECT @@ROWCOUNT AS AffectedRows; END;
GO

IF OBJECT_ID(N'dbo.sproc_GetRules', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_GetRules;
GO
CREATE PROCEDURE dbo.sproc_GetRules
AS
BEGIN
    SET NOCOUNT ON;
    SELECT r.aRuleId, r.tRuleName, r.tDescription, r.nPriority, r.bIsActive,
           (SELECT COUNT(1) FROM dbo.tblRuleCondition rc WHERE rc.aRuleId=r.aRuleId) AS nConditionCount,
           r.dtCreatedDate, r.dtModifiedDate
    FROM dbo.tblRule r ORDER BY r.nPriority, r.aRuleId;
END;
GO

IF OBJECT_ID(N'dbo.sproc_GetRule', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_GetRule;
GO
CREATE PROCEDURE dbo.sproc_GetRule @aRuleId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT r.aRuleId,r.tRuleName,r.tDescription,r.nPriority,r.bIsActive,
           (SELECT COUNT(1) FROM dbo.tblRuleCondition rcCount WHERE rcCount.aRuleId=r.aRuleId) AS nConditionCount,
           r.dtCreatedDate,r.dtModifiedDate
    FROM dbo.tblRule r WHERE r.aRuleId=@aRuleId;

    SELECT rc.aRuleConditionId,rc.aRuleId,rc.aFieldId,fc.tDisplayName,fc.tFieldName,fc.tFieldType,
           rc.tLogicalOperator,rc.tOperator,rc.tValue,rc.nConditionOrder,
           COALESCE(rg.nGroupOrder,1) AS nGroupOrder
    FROM dbo.tblRuleCondition rc
    INNER JOIN dbo.tblFieldConfiguration fc ON fc.aFieldId=rc.aFieldId
    LEFT JOIN dbo.tblRuleConditionGroup rg ON rg.aRuleConditionGroupId=rc.aRuleConditionGroupId
    WHERE rc.aRuleId=@aRuleId
    ORDER BY COALESCE(rg.nGroupOrder,1),rc.nConditionOrder,rc.aRuleConditionId;
END;
GO

IF OBJECT_ID(N'dbo.sproc_GetActiveRuleFields', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_GetActiveRuleFields;
GO
CREATE PROCEDURE dbo.sproc_GetActiveRuleFields
AS BEGIN SET NOCOUNT ON; SELECT aFieldId,tDisplayName,tFieldName,tFieldType FROM dbo.tblFieldConfiguration WHERE bIsActive=1 ORDER BY nDisplayOrder,aFieldId; END;
GO

IF OBJECT_ID(N'dbo.sproc_CreateRule', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_CreateRule;
GO
CREATE PROCEDURE dbo.sproc_CreateRule
    @aRuleId INT, @tRuleName NVARCHAR(200), @tDescription NVARCHAR(1000), @nPriority INT, @bIsActive BIT, @tConditionsJson NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRANSACTION;
    BEGIN TRY
        IF EXISTS (SELECT 1 FROM dbo.tblRule WHERE aRuleId=@aRuleId) THROW 50001,'A rule with the specified Rule ID already exists.',1;
        IF EXISTS (SELECT 1 FROM dbo.tblRule WHERE tRuleName=@tRuleName) THROW 50002,'A rule with the specified Rule Name already exists.',1;
        IF EXISTS (SELECT 1 FROM dbo.tblRule WHERE nPriority=@nPriority) THROW 50003,'A rule with the specified Priority already exists.',1;
        IF NOT EXISTS (SELECT 1 FROM OPENJSON(@tConditionsJson)) THROW 50004,'At least one rule condition is required.',1;
        IF EXISTS (SELECT 1 FROM OPENJSON(@tConditionsJson) j OUTER APPLY (SELECT TRY_CONVERT(INT,JSON_VALUE(j.value,'$.FieldId')) FieldId,JSON_VALUE(j.value,'$.ConditionLogicalOperator') ConditionLogicalOperator,JSON_VALUE(j.value,'$.Operator') Operator,JSON_VALUE(j.value,'$.Value') Value,TRY_CONVERT(INT,JSON_VALUE(j.value,'$.ConditionOrder')) ConditionOrder,TRY_CONVERT(INT,JSON_VALUE(j.value,'$.GroupOrder')) GroupOrder,JSON_VALUE(j.value,'$.GroupLogicalOperator') GroupLogicalOperator) d LEFT JOIN dbo.tblFieldConfiguration fc ON fc.aFieldId=d.FieldId WHERE fc.aFieldId IS NULL OR fc.bIsActive=0 OR d.ConditionLogicalOperator NOT IN ('AND','OR') OR NULLIF(LTRIM(RTRIM(d.Operator)),'') IS NULL OR NULLIF(LTRIM(RTRIM(d.Value)),'') IS NULL OR d.ConditionOrder IS NULL OR d.ConditionOrder<=0 OR d.GroupOrder IS NULL OR d.GroupOrder<=0) THROW 50005,'One or more rule conditions are invalid or reference an inactive field.',1;
        IF EXISTS (SELECT 1 FROM OPENJSON(@tConditionsJson) j OUTER APPLY (SELECT TRY_CONVERT(INT,JSON_VALUE(j.value,'$.GroupOrder')) GroupOrder,TRY_CONVERT(INT,JSON_VALUE(j.value,'$.ConditionOrder')) ConditionOrder) d GROUP BY d.GroupOrder,d.ConditionOrder HAVING COUNT(*)>1) THROW 50006,'Condition order must be unique within each group.',1;
        IF EXISTS (SELECT 1 FROM (SELECT DISTINCT TRY_CONVERT(INT,JSON_VALUE(j.value,'$.GroupOrder')) AS GroupOrder FROM OPENJSON(@tConditionsJson) j) d WHERE GroupOrder IS NULL OR GroupOrder<=0) THROW 50007,'Condition group order must be a positive number.',1;
        IF (SELECT COUNT(DISTINCT TRY_CONVERT(INT,JSON_VALUE(j.value,'$.GroupOrder'))) FROM OPENJSON(@tConditionsJson) j) <> (SELECT MAX(TRY_CONVERT(INT,JSON_VALUE(j.value,'$.GroupOrder'))) FROM OPENJSON(@tConditionsJson) j) THROW 50017,'Condition group order must be sequential.',1;

        INSERT INTO dbo.tblRule(aRuleId,tRuleName,tDescription,nPriority,bIsActive) VALUES(@aRuleId,@tRuleName,@tDescription,@nPriority,@bIsActive);
        INSERT INTO dbo.tblRuleConditionGroup(aRuleId,nGroupOrder,tLogicalOperator)
        SELECT @aRuleId,d.GroupOrder,'AND' FROM (SELECT DISTINCT TRY_CONVERT(INT,JSON_VALUE(j.value,'$.GroupOrder')) GroupOrder FROM OPENJSON(@tConditionsJson) j) d GROUP BY d.GroupOrder;
        INSERT INTO dbo.tblRuleCondition(aRuleId,aRuleConditionGroupId,aFieldId,tLogicalOperator,tOperator,tValue,nConditionOrder)
        SELECT @aRuleId,rg.aRuleConditionGroupId,TRY_CONVERT(INT,JSON_VALUE(j.value,'$.FieldId')),COALESCE(JSON_VALUE(j.value,'$.ConditionLogicalOperator'),'AND'),JSON_VALUE(j.value,'$.Operator'),JSON_VALUE(j.value,'$.Value'),TRY_CONVERT(INT,JSON_VALUE(j.value,'$.ConditionOrder')) FROM OPENJSON(@tConditionsJson) j INNER JOIN dbo.tblRuleConditionGroup rg ON rg.aRuleId=@aRuleId AND rg.nGroupOrder=TRY_CONVERT(INT,JSON_VALUE(j.value,'$.GroupOrder'));
        COMMIT; SELECT @aRuleId AS aRuleId;
    END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
END;
GO

IF OBJECT_ID(N'dbo.sproc_UpdateRule', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_UpdateRule;
GO
CREATE PROCEDURE dbo.sproc_UpdateRule
    @aRuleId INT, @tRuleName NVARCHAR(200), @tDescription NVARCHAR(1000), @nPriority INT, @bIsActive BIT, @tConditionsJson NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRANSACTION;
    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.tblRule WHERE aRuleId=@aRuleId) THROW 50008,'The specified rule does not exist.',1;
        IF EXISTS (SELECT 1 FROM dbo.tblRule WHERE tRuleName=@tRuleName AND aRuleId<>@aRuleId) THROW 50009,'A different rule already uses the specified Rule Name.',1;
        IF EXISTS (SELECT 1 FROM dbo.tblRule WHERE nPriority=@nPriority AND aRuleId<>@aRuleId) THROW 50010,'A different rule already uses the specified Priority.',1;
        IF NOT EXISTS (SELECT 1 FROM OPENJSON(@tConditionsJson)) THROW 50011,'At least one rule condition is required.',1;
        IF EXISTS (SELECT 1 FROM OPENJSON(@tConditionsJson) j OUTER APPLY (SELECT TRY_CONVERT(INT,JSON_VALUE(j.value,'$.FieldId')) FieldId,JSON_VALUE(j.value,'$.ConditionLogicalOperator') ConditionLogicalOperator,JSON_VALUE(j.value,'$.Operator') Operator,JSON_VALUE(j.value,'$.Value') Value,TRY_CONVERT(INT,JSON_VALUE(j.value,'$.ConditionOrder')) ConditionOrder,TRY_CONVERT(INT,JSON_VALUE(j.value,'$.GroupOrder')) GroupOrder) d LEFT JOIN dbo.tblFieldConfiguration fc ON fc.aFieldId=d.FieldId WHERE fc.aFieldId IS NULL OR fc.bIsActive=0 OR d.ConditionLogicalOperator NOT IN ('AND','OR') OR NULLIF(LTRIM(RTRIM(d.Operator)),'') IS NULL OR NULLIF(LTRIM(RTRIM(d.Value)),'') IS NULL OR d.ConditionOrder IS NULL OR d.ConditionOrder<=0 OR d.GroupOrder IS NULL OR d.GroupOrder<=0) THROW 50012,'One or more rule conditions are invalid or reference an inactive field.',1;
        IF EXISTS (SELECT 1 FROM OPENJSON(@tConditionsJson) j OUTER APPLY (SELECT TRY_CONVERT(INT,JSON_VALUE(j.value,'$.GroupOrder')) GroupOrder,TRY_CONVERT(INT,JSON_VALUE(j.value,'$.ConditionOrder')) ConditionOrder) d GROUP BY d.GroupOrder,d.ConditionOrder HAVING COUNT(*)>1) THROW 50013,'Condition order must be unique within each group.',1;
        IF EXISTS (SELECT 1 FROM (SELECT DISTINCT TRY_CONVERT(INT,JSON_VALUE(j.value,'$.GroupOrder')) AS GroupOrder FROM OPENJSON(@tConditionsJson) j) d WHERE GroupOrder IS NULL OR GroupOrder<=0) THROW 50014,'Condition group order must be a positive number.',1;
        IF (SELECT COUNT(DISTINCT TRY_CONVERT(INT,JSON_VALUE(j.value,'$.GroupOrder'))) FROM OPENJSON(@tConditionsJson) j) <> (SELECT MAX(TRY_CONVERT(INT,JSON_VALUE(j.value,'$.GroupOrder'))) FROM OPENJSON(@tConditionsJson) j) THROW 50018,'Condition group order must be sequential.',1;

        UPDATE dbo.tblRule SET tRuleName=@tRuleName,tDescription=@tDescription,nPriority=@nPriority,bIsActive=@bIsActive,dtModifiedDate=GETDATE() WHERE aRuleId=@aRuleId;
        DELETE FROM dbo.tblRuleCondition WHERE aRuleId=@aRuleId;
        DELETE FROM dbo.tblRuleConditionGroup WHERE aRuleId=@aRuleId;
        INSERT INTO dbo.tblRuleConditionGroup(aRuleId,nGroupOrder,tLogicalOperator)
        SELECT @aRuleId,d.GroupOrder,'AND' FROM (SELECT DISTINCT TRY_CONVERT(INT,JSON_VALUE(j.value,'$.GroupOrder')) GroupOrder FROM OPENJSON(@tConditionsJson) j) d GROUP BY d.GroupOrder;
        INSERT INTO dbo.tblRuleCondition(aRuleId,aRuleConditionGroupId,aFieldId,tLogicalOperator,tOperator,tValue,nConditionOrder)
        SELECT @aRuleId,rg.aRuleConditionGroupId,TRY_CONVERT(INT,JSON_VALUE(j.value,'$.FieldId')),COALESCE(JSON_VALUE(j.value,'$.ConditionLogicalOperator'),'AND'),JSON_VALUE(j.value,'$.Operator'),JSON_VALUE(j.value,'$.Value'),TRY_CONVERT(INT,JSON_VALUE(j.value,'$.ConditionOrder')) FROM OPENJSON(@tConditionsJson) j INNER JOIN dbo.tblRuleConditionGroup rg ON rg.aRuleId=@aRuleId AND rg.nGroupOrder=TRY_CONVERT(INT,JSON_VALUE(j.value,'$.GroupOrder'));
        COMMIT; SELECT 1 AS Result;
    END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
END;
GO

IF OBJECT_ID(N'dbo.sproc_SetRuleActive', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_SetRuleActive;
GO
CREATE PROCEDURE dbo.sproc_SetRuleActive @aRuleId INT,@bIsActive BIT
AS BEGIN SET NOCOUNT ON; UPDATE dbo.tblRule SET bIsActive=@bIsActive,dtModifiedDate=GETDATE() WHERE aRuleId=@aRuleId; SELECT @@ROWCOUNT AS AffectedRows; END;
GO

IF OBJECT_ID(N'dbo.sproc_ReorderRules', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_ReorderRules;
GO
CREATE PROCEDURE dbo.sproc_ReorderRules @tRuleIdsJson NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @RuleOrder TABLE(aRuleId INT NOT NULL PRIMARY KEY,nPriority INT NOT NULL);
        INSERT INTO @RuleOrder SELECT TRY_CONVERT(INT,[value]),CONVERT(INT,[key])+1 FROM OPENJSON(@tRuleIdsJson) WHERE TRY_CONVERT(INT,[value]) IS NOT NULL;
        IF EXISTS(SELECT 1 FROM @RuleOrder ro LEFT JOIN dbo.tblRule r ON r.aRuleId=ro.aRuleId WHERE r.aRuleId IS NULL) THROW 50015,'One or more rules in the requested order do not exist.',1;
        IF (SELECT COUNT(*) FROM @RuleOrder)<>(SELECT COUNT(*) FROM dbo.tblRule) THROW 50016,'The requested rule order must contain every rule.',1;
        UPDATE dbo.tblRule SET nPriority=nPriority+1000000;
        UPDATE r SET r.nPriority=ro.nPriority,r.dtModifiedDate=GETDATE() FROM dbo.tblRule r INNER JOIN @RuleOrder ro ON ro.aRuleId=r.aRuleId;
        COMMIT;
    END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
END;
GO

IF OBJECT_ID(N'dbo.sproc_DeleteRule', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_DeleteRule;
GO
CREATE PROCEDURE dbo.sproc_DeleteRule @aRuleId INT
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRANSACTION;
    BEGIN TRY
        IF NOT EXISTS(SELECT 1 FROM dbo.tblRule WHERE aRuleId=@aRuleId) BEGIN ROLLBACK; SELECT 0 AS Result; RETURN; END;
        DELETE FROM dbo.tblRuleCondition WHERE aRuleId=@aRuleId;
        DELETE FROM dbo.tblRuleConditionGroup WHERE aRuleId=@aRuleId;
        DELETE FROM dbo.tblRule WHERE aRuleId=@aRuleId;
        COMMIT; SELECT 1 AS Result;
    END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
END;
GO


CREATE OR ALTER PROCEDURE dbo.sproc_SaveAllocationRunHistory
    @aAllocationRunId UNIQUEIDENTIFIER,
    @tAllocationRunName NVARCHAR(200),
    @nCapRound INT,
    @tAllocationStep NVARCHAR(50),
    @tStatus NVARCHAR(30),
    @tRuleGroupsJson NVARCHAR(MAX),
    @dtCreatedAtUtc DATETIME2,
    @dtStartedAtUtc DATETIME2 = NULL,
    @dtCompletedAtUtc DATETIME2 = NULL,
    @nCandidateCount INT = 0,
    @nDecisionCount INT = 0,
    @tErrorMessage NVARCHAR(2000) = N''
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.tblAllocationRunHistory
    SET tAllocationRunName = @tAllocationRunName,
        nCapRound = @nCapRound,
        tAllocationStep = @tAllocationStep,
        tStatus = @tStatus,
        tRuleGroupsJson = @tRuleGroupsJson,
        dtCreatedAtUtc = @dtCreatedAtUtc,
        dtStartedAtUtc = @dtStartedAtUtc,
        dtCompletedAtUtc = @dtCompletedAtUtc,
        nCandidateCount = @nCandidateCount,
        nDecisionCount = @nDecisionCount,
        tErrorMessage = @tErrorMessage
    WHERE aAllocationRunId = @aAllocationRunId;

    IF @@ROWCOUNT = 0
    BEGIN
        INSERT INTO dbo.tblAllocationRunHistory
        (
            aAllocationRunId, tAllocationRunName, nCapRound, tAllocationStep,
            tStatus, tRuleGroupsJson, dtCreatedAtUtc, dtStartedAtUtc,
            dtCompletedAtUtc, nCandidateCount, nDecisionCount, tErrorMessage
        )
        VALUES
        (
            @aAllocationRunId, @tAllocationRunName, @nCapRound, @tAllocationStep,
            @tStatus, @tRuleGroupsJson, @dtCreatedAtUtc, @dtStartedAtUtc,
            @dtCompletedAtUtc, @nCandidateCount, @nDecisionCount, @tErrorMessage
        );
    END;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sproc_DeleteAllocationRun
    @aAllocationRunId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    DELETE FROM dbo.tblAllocationRunDecision
    WHERE aAllocationRunId = @aAllocationRunId;

    DELETE FROM dbo.tblAllocationRunHistory
    WHERE aAllocationRunId = @aAllocationRunId;

    COMMIT;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sproc_GetAllocationRunHistory
    @nTake INT = 50
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (@nTake)
        aAllocationRunId,
        tAllocationRunName,
        nCapRound,
        tAllocationStep,
        tStatus,
        tRuleGroupsJson,
        dtCreatedAtUtc,
        dtStartedAtUtc,
        dtCompletedAtUtc,
        nCandidateCount,
        nDecisionCount,
        tErrorMessage
    FROM dbo.tblAllocationRunHistory
    ORDER BY dtCreatedAtUtc DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sproc_SaveAllocationRunDecisions
    @aAllocationRunId UNIQUEIDENTIFIER,
    @tDecisionsJson NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    INSERT INTO dbo.tblAllocationRunDecision
    (
        aDecisionId,
        aAllocationRunId,
        nCandidateId,
        nCollegeId,
        nPreferenceNo,
        nCategoryId,
        tAllocatedType,
        tOriginalAllocatedType,
        nStepId,
        tDecisionArea,
        tRuleCode,
        tStatus
    )
    SELECT
        TRY_CONVERT(UNIQUEIDENTIFIER, JSON_VALUE(j.value, '$.decisionId')),
        @aAllocationRunId,
        TRY_CONVERT(BIGINT, JSON_VALUE(j.value, '$.candidateId')),
        COALESCE(TRY_CONVERT(INT, JSON_VALUE(j.value, '$.collegeId')), 0),
        COALESCE(TRY_CONVERT(INT, JSON_VALUE(j.value, '$.preferenceNo')), 0),
        COALESCE(TRY_CONVERT(INT, JSON_VALUE(j.value, '$.categoryId')), 0),
        COALESCE(JSON_VALUE(j.value, '$.allocatedType'), N''),
        COALESCE(JSON_VALUE(j.value, '$.originalAllocatedType'), N''),
        COALESCE(TRY_CONVERT(INT, JSON_VALUE(j.value, '$.stepId')), 0),
        COALESCE(JSON_VALUE(j.value, '$.decisionArea'), N''),
        COALESCE(JSON_VALUE(j.value, '$.ruleCode'), N''),
        COALESCE(JSON_VALUE(j.value, '$.status'), N'Allocated')
    FROM OPENJSON(@tDecisionsJson) j
    WHERE TRY_CONVERT(UNIQUEIDENTIFIER, JSON_VALUE(j.value, '$.decisionId')) IS NOT NULL;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sproc_GetAllocationRunDecisions
    @aAllocationRunId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        aDecisionId,
        aAllocationRunId,
        nCandidateId,
        nCollegeId,
        nPreferenceNo,
        nCategoryId,
        tAllocatedType,
        tOriginalAllocatedType,
        nStepId,
        tDecisionArea,
        tRuleCode,
        tStatus,
        dtCreatedAtUtc
    FROM dbo.tblAllocationRunDecision
    WHERE aAllocationRunId = @aAllocationRunId
    ORDER BY nCandidateId, nPreferenceNo, dtCreatedAtUtc;
END;
GO


/* ============================================================
   Consolidated rule configuration procedures
   ============================================================ */
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
        COALESCE((
            SELECT
                d.aRuleBranchId AS RuleBranchId,
                d.aRuleId AS RuleId,
                d.tBranchName AS BranchName,
                d.nBranchOrder AS BranchOrder,
                d.bIsActive AS IsActive,
                COALESCE(d.tAllocatedType, N'') AS AllocationType,
                COALESCE(d.nSequence, 1) AS Sequence,
                d.bIsElse AS IsElse,
                JSON_QUERY(COALESCE(NULLIF(d.tConditionsJson, N''), N'[]')) AS Conditions,
                COALESCE(NULLIF(d.tOutcomeJson, N''), N'{}') AS OutcomeJson
            FROM dbo.tblRuleBranch d
            WHERE d.aRuleId = r.aRuleId
              AND d.bIsActive = 1
            ORDER BY d.nBranchOrder, d.aRuleBranchId
            FOR JSON PATH
        ), N'[]') AS tBranchesJson,
        (SELECT COUNT(1) FROM dbo.tblRuleCondition rc WHERE rc.aRuleId = r.aRuleId)
        + COALESCE((SELECT COUNT(1) FROM dbo.tblRuleBranch rb CROSS APPLY OPENJSON(rb.tConditionsJson) bc WHERE rb.aRuleId = r.aRuleId), 0) AS nConditionCount,
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
        COALESCE((
            SELECT
                d.aRuleBranchId AS RuleBranchId,
                d.aRuleId AS RuleId,
                d.tBranchName AS BranchName,
                d.nBranchOrder AS BranchOrder,
                d.bIsActive AS IsActive,
                d.tAllocatedType AS AllocationType,
                d.nSequence AS Sequence,
                d.bIsElse AS IsElse,
                JSON_QUERY(COALESCE(NULLIF(d.tConditionsJson, N''), N'[]')) AS Conditions,
                JSON_QUERY(COALESCE(NULLIF(d.tOutcomeJson, N''), N'{}')) AS Outcome
            FROM dbo.tblRuleBranch d
            WHERE d.aRuleId = r.aRuleId
              AND d.bIsActive = 1
            ORDER BY d.nBranchOrder, d.aRuleBranchId
            FOR JSON PATH
        ), N'[]') AS tBranchesJson,
        (SELECT COUNT(1) FROM dbo.tblRuleCondition rcCount WHERE rcCount.aRuleId = r.aRuleId)
        + COALESCE((SELECT COUNT(1) FROM dbo.tblRuleBranch rbCount CROSS APPLY OPENJSON(rbCount.tConditionsJson) bcCount WHERE rbCount.aRuleId = r.aRuleId), 0) AS nConditionCount,
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
        COALESCE(rg.nGroupOrder, 1) AS nGroupOrder,
        COALESCE(rc.tGroupPath, N'') AS tGroupPath
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
            aRuleId, aRuleConditionGroupId, aFieldId, tGroupPath, tLogicalOperator,
            tOperator, tValue, nConditionOrder
        )
        SELECT
            @aRuleId,
            rg.aRuleConditionGroupId,
            NULLIF(JSON_VALUE(j.value, '$.GroupPath'), N''),
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
            aRuleId, aRuleConditionGroupId, aFieldId, tGroupPath, tLogicalOperator,
            tOperator, tValue, nConditionOrder
        )
        SELECT
            @aRuleId,
            rg.aRuleConditionGroupId,
            TRY_CONVERT(INT, JSON_VALUE(j.value, '$.FieldId')),
            NULLIF(JSON_VALUE(j.value, '$.GroupPath'), N''),
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


/* ============================================================
   User Management + module permissions
   ============================================================ */
IF OBJECT_ID(N'dbo.sproc_GetUsers', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_GetUsers;
GO
CREATE PROCEDURE dbo.sproc_GetUsers
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        u.aUserId,
        u.tUsername,
        u.tDisplayName,
        u.bIsAdmin,
        u.bIsActive,
        u.dtCreatedDate,
        COUNT(p.aUserPermissionId) AS nPermissionCount
    FROM dbo.tblUsers u
    LEFT JOIN dbo.tblUserPermission p
        ON p.aUserId = u.aUserId
    GROUP BY
        u.aUserId, u.tUsername, u.tDisplayName,
        u.bIsAdmin, u.bIsActive, u.dtCreatedDate
    ORDER BY u.tUsername;
END;
GO

IF OBJECT_ID(N'dbo.sproc_CreateUser', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_CreateUser;
GO
CREATE PROCEDURE dbo.sproc_CreateUser
    @tUsername NVARCHAR(100),
    @tPassword NVARCHAR(500),
    @tDisplayName NVARCHAR(200),
    @bIsAdmin BIT,
    @bIsActive BIT,
    @tPermissionsJson NVARCHAR(MAX) = N'[]'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;
    BEGIN TRY
        IF EXISTS (SELECT 1 FROM dbo.tblUsers WHERE tUsername = @tUsername)
            THROW 50201, 'A user with the specified username already exists.', 1;

        IF ISJSON(COALESCE(@tPermissionsJson, N'[]')) <> 1
            THROW 50202, 'User permissions must be valid JSON.', 1;

        INSERT INTO dbo.tblUsers
        (
            tUsername, tPassword, tDisplayName, bIsAdmin, bIsActive
        )
        VALUES
        (
            @tUsername, @tPassword, @tDisplayName, @bIsAdmin, @bIsActive
        );

        DECLARE @aUserId INT = CONVERT(INT, SCOPE_IDENTITY());

        IF @bIsAdmin = 0
        BEGIN
            INSERT INTO dbo.tblUserPermission
            (
                aUserId, tModuleCode, bCanRead, bCanWrite
            )
            SELECT
                @aUserId,
                UPPER(LTRIM(RTRIM(JSON_VALUE(j.value, '$.ModuleCode')))),
                COALESCE(TRY_CONVERT(BIT, JSON_VALUE(j.value, '$.CanRead')), 0),
                CASE
                    WHEN COALESCE(TRY_CONVERT(BIT, JSON_VALUE(j.value, '$.CanRead')), 0) = 1
                     AND COALESCE(TRY_CONVERT(BIT, JSON_VALUE(j.value, '$.CanWrite')), 0) = 1
                    THEN 1
                    ELSE 0
                END
            FROM OPENJSON(@tPermissionsJson) j
            WHERE UPPER(LTRIM(RTRIM(JSON_VALUE(j.value, '$.ModuleCode'))))
                  IN ('FIELDS', 'RULES', 'ALLOCATION_RUN')
              AND
              (
                  COALESCE(TRY_CONVERT(BIT, JSON_VALUE(j.value, '$.CanRead')), 0) = 1
                  OR COALESCE(TRY_CONVERT(BIT, JSON_VALUE(j.value, '$.CanWrite')), 0) = 1
              )
            GROUP BY
                UPPER(LTRIM(RTRIM(JSON_VALUE(j.value, '$.ModuleCode')))),
                TRY_CONVERT(BIT, JSON_VALUE(j.value, '$.CanRead')),
                TRY_CONVERT(BIT, JSON_VALUE(j.value, '$.CanWrite'));

            IF EXISTS
            (
                SELECT 1
                FROM dbo.tblUserPermission
                WHERE aUserId = @aUserId
                  AND tModuleCode IS NULL
            )
                THROW 50203, 'Invalid user permission.', 1;
        END;

        COMMIT;
        SELECT @aUserId AS aUserId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH;
END;
GO

IF OBJECT_ID(N'dbo.sproc_GetUserPermissions', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_GetUserPermissions;
GO
CREATE PROCEDURE dbo.sproc_GetUserPermissions
    @aUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        m.tModuleCode,
        m.tModuleName,
        CASE WHEN u.bIsAdmin = 1 THEN CAST(1 AS BIT) ELSE COALESCE(p.bCanRead, 0) END AS bCanRead,
        CASE WHEN u.bIsAdmin = 1 THEN CAST(1 AS BIT) ELSE COALESCE(p.bCanWrite, 0) END AS bCanWrite
    FROM
    (
        SELECT 'FIELDS' AS tModuleCode, 'Field Configuration' AS tModuleName
        UNION ALL SELECT 'RULES', 'Rule Configuration'
        UNION ALL SELECT 'ALLOCATION_RUN', 'Allocation Run'
    ) m
    INNER JOIN dbo.tblUsers u ON u.aUserId = @aUserId
    LEFT JOIN dbo.tblUserPermission p
        ON p.aUserId = u.aUserId
       AND p.tModuleCode = m.tModuleCode
    ORDER BY CASE m.tModuleCode WHEN 'FIELDS' THEN 1 WHEN 'RULES' THEN 2 ELSE 3 END;
END;
GO

IF OBJECT_ID(N'dbo.sproc_CheckUserPermission', N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_CheckUserPermission;
GO
CREATE PROCEDURE dbo.sproc_CheckUserPermission
    @aUserId INT,
    @tModuleCode NVARCHAR(50),
    @bCheckWrite BIT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT CAST(
        CASE
            WHEN EXISTS
            (
                SELECT 1
                FROM dbo.tblUsers
                WHERE aUserId = @aUserId
                  AND bIsActive = 1
                  AND bIsAdmin = 1
            ) THEN 1
            WHEN EXISTS
            (
                SELECT 1
                FROM dbo.tblUsers u
                INNER JOIN dbo.tblUserPermission p ON p.aUserId = u.aUserId
                WHERE u.aUserId = @aUserId
                  AND u.bIsActive = 1
                  AND p.tModuleCode = UPPER(@tModuleCode)
                  AND
                  (
                      (@bCheckWrite = 1 AND p.bCanWrite = 1)
                      OR
                      (@bCheckWrite = 0 AND p.bCanRead = 1)
                  )
            ) THEN 1
            ELSE 0
        END AS BIT
    ) AS HasPermission;
END;
GO

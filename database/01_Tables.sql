/*
    CET Configuration Database Objects - Tables
    Target database: CET_configuration

    Execute this script manually against the CET_configuration database.
    Existing tables are not modified by the CREATE sections below.

    This file contains all CET Configuration tables:
    - tblUsers
    - tblFieldConfiguration
    - tblRule
    - tblRuleConditionGroup
    - tblRuleCondition
*/

IF OBJECT_ID(N'dbo.tblUsers', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblUsers
    (
        aUserId        INT IDENTITY(1,1) NOT NULL,
        tUsername      NVARCHAR(100) NOT NULL,
        tPassword      NVARCHAR(500) NOT NULL,
        tDisplayName   NVARCHAR(200) NOT NULL,
        bIsAdmin       BIT NOT NULL CONSTRAINT DF_tblUsers_bIsAdmin DEFAULT (0),
        bIsActive      BIT NOT NULL CONSTRAINT DF_tblUsers_bIsActive DEFAULT (1),
        dtCreatedDate  DATETIME NOT NULL CONSTRAINT DF_tblUsers_dtCreatedDate DEFAULT (GETDATE()),
        CONSTRAINT PK_tblUsers PRIMARY KEY (aUserId),
        CONSTRAINT UQ_tblUsers_tUsername UNIQUE (tUsername)
    );
END;
GO

IF OBJECT_ID(N'dbo.tblFieldConfiguration', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblFieldConfiguration
    (
        aFieldId        INT NOT NULL,
        tTableName      NVARCHAR(128) NOT NULL,
        tFieldName      NVARCHAR(200) NOT NULL,
        tDisplayName    NVARCHAR(200) NOT NULL,
        tFieldType      NVARCHAR(50) NOT NULL,
        bIsRequired     BIT NOT NULL CONSTRAINT DF_tblFieldConfiguration_bIsRequired DEFAULT (0),
        bIsActive       BIT NOT NULL CONSTRAINT DF_tblFieldConfiguration_bIsActive DEFAULT (1),
        nDisplayOrder   INT NOT NULL CONSTRAINT DF_tblFieldConfiguration_nDisplayOrder DEFAULT (0),
        dtCreatedDate   DATETIME NOT NULL CONSTRAINT DF_tblFieldConfiguration_dtCreatedDate DEFAULT (GETDATE()),
        dtModifiedDate  DATETIME NULL,
        CONSTRAINT PK_tblFieldConfiguration PRIMARY KEY (aFieldId),
        CONSTRAINT UQ_tblFieldConfiguration_tTableName_tFieldName UNIQUE (tTableName, tFieldName)
    );
END;
GO

IF OBJECT_ID(N'dbo.tblRule', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblRule
    (
        aRuleId         INT NOT NULL,
        tRuleName       NVARCHAR(200) NOT NULL,
        tDescription    NVARCHAR(1000) NULL,
        nPriority       INT NOT NULL,
        bIsActive       BIT NOT NULL CONSTRAINT DF_tblRule_bIsActive DEFAULT (1),
        dtCreatedDate   DATETIME NOT NULL CONSTRAINT DF_tblRule_dtCreatedDate DEFAULT (GETDATE()),
        dtModifiedDate  DATETIME NULL,
        CONSTRAINT PK_tblRule PRIMARY KEY (aRuleId),
        CONSTRAINT UQ_tblRule_tRuleName UNIQUE (tRuleName),
        CONSTRAINT CK_tblRule_nPriority CHECK (nPriority > 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.tblRuleConditionGroup', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblRuleConditionGroup
    (
        aRuleConditionGroupId INT IDENTITY(1,1) NOT NULL,
        aRuleId               INT NOT NULL,
        nGroupOrder           INT NOT NULL,
        tLogicalOperator      NVARCHAR(10) NOT NULL
            CONSTRAINT DF_tblRuleConditionGroup_tLogicalOperator DEFAULT ('AND'),
        dtCreatedDate         DATETIME NOT NULL
            CONSTRAINT DF_tblRuleConditionGroup_dtCreatedDate DEFAULT (GETDATE()),

        CONSTRAINT PK_tblRuleConditionGroup
            PRIMARY KEY (aRuleConditionGroupId),

        CONSTRAINT FK_tblRuleConditionGroup_tblRule
            FOREIGN KEY (aRuleId)
            REFERENCES dbo.tblRule (aRuleId),

        CONSTRAINT CK_tblRuleConditionGroup_tLogicalOperator
            CHECK (tLogicalOperator IN ('AND', 'OR')),

        CONSTRAINT CK_tblRuleConditionGroup_nGroupOrder
            CHECK (nGroupOrder > 0),

        CONSTRAINT UQ_tblRuleConditionGroup_Rule_Order
            UNIQUE (aRuleId, nGroupOrder)
    );
END;
GO

IF OBJECT_ID(N'dbo.tblRuleCondition', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblRuleCondition
    (
        aRuleConditionId  INT IDENTITY(1,1) NOT NULL,
        aRuleId           INT NOT NULL,
        aRuleConditionGroupId INT NULL,
        aFieldId          INT NOT NULL,
        tGroupPath        NVARCHAR(1000) NULL,
        tLogicalOperator  NVARCHAR(10) NOT NULL CONSTRAINT DF_tblRuleCondition_tLogicalOperator DEFAULT ('AND'),
        tOperator         NVARCHAR(50) NOT NULL,
        tValue            NVARCHAR(1000) NOT NULL,
        nConditionOrder   INT NOT NULL,
        dtCreatedDate     DATETIME NOT NULL CONSTRAINT DF_tblRuleCondition_dtCreatedDate DEFAULT (GETDATE()),

        CONSTRAINT PK_tblRuleCondition PRIMARY KEY (aRuleConditionId),
        CONSTRAINT FK_tblRuleCondition_tblRule FOREIGN KEY (aRuleId) REFERENCES dbo.tblRule (aRuleId),
        CONSTRAINT FK_tblRuleCondition_tblRuleConditionGroup
            FOREIGN KEY (aRuleConditionGroupId) REFERENCES dbo.tblRuleConditionGroup (aRuleConditionGroupId),
        CONSTRAINT FK_tblRuleCondition_tblFieldConfiguration
            FOREIGN KEY (aFieldId) REFERENCES dbo.tblFieldConfiguration (aFieldId),
        CONSTRAINT CK_tblRuleCondition_tLogicalOperator CHECK (tLogicalOperator IN ('AND', 'OR')),
        CONSTRAINT CK_tblRuleCondition_nConditionOrder CHECK (nConditionOrder > 0),
        CONSTRAINT UQ_tblRuleCondition_Rule_Order UNIQUE (aRuleId, nConditionOrder)
    );
END;
GO

IF COL_LENGTH(N'dbo.tblRuleCondition', N'tGroupPath') IS NULL
BEGIN
    ALTER TABLE dbo.tblRuleCondition ADD tGroupPath NVARCHAR(1000) NULL;
END;
GO

IF COL_LENGTH(N'dbo.tblRuleCondition', N'aRuleConditionGroupId') IS NULL
BEGIN
    ALTER TABLE dbo.tblRuleCondition
        ADD aRuleConditionGroupId INT NULL;
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_tblRuleCondition_tblRuleConditionGroup'
      AND parent_object_id = OBJECT_ID(N'dbo.tblRuleCondition')
)
BEGIN
    ALTER TABLE dbo.tblRuleCondition
        ADD CONSTRAINT FK_tblRuleCondition_tblRuleConditionGroup
        FOREIGN KEY (aRuleConditionGroupId)
        REFERENCES dbo.tblRuleConditionGroup (aRuleConditionGroupId);
END;
GO

IF NOT EXISTS
(
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_tblRuleCondition_aRuleId'
      AND object_id = OBJECT_ID(N'dbo.tblRuleCondition')
)
BEGIN
    CREATE INDEX IX_tblRuleCondition_aRuleId
        ON dbo.tblRuleCondition (aRuleId, nConditionOrder);
END;
GO

IF NOT EXISTS
(
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_tblRuleCondition_aFieldId'
      AND object_id = OBJECT_ID(N'dbo.tblRuleCondition')
)
BEGIN
    CREATE INDEX IX_tblRuleCondition_aFieldId
        ON dbo.tblRuleCondition (aFieldId);
END;
GO

IF NOT EXISTS
(
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_tblRuleCondition_aRuleConditionGroupId'
      AND object_id = OBJECT_ID(N'dbo.tblRuleCondition')
)
BEGIN
    CREATE INDEX IX_tblRuleCondition_aRuleConditionGroupId
        ON dbo.tblRuleCondition (aRuleConditionGroupId, nConditionOrder);
END;
GO

/* Migration support for older Field Configuration databases. */
IF OBJECT_ID(N'dbo.tblFieldConfiguration', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.tblFieldConfiguration', N'tTableName') IS NULL
BEGIN
    ALTER TABLE dbo.tblFieldConfiguration ADD tTableName NVARCHAR(128) NULL;
END;
GO

IF OBJECT_ID(N'dbo.tblFieldConfiguration', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.tblFieldConfiguration', N'tTableName') IS NOT NULL
BEGIN
    UPDATE dbo.tblFieldConfiguration
    SET tTableName = N'Allocation_MeritList'
    WHERE tTableName IS NULL;
END;
GO

IF OBJECT_ID(N'dbo.tblFieldConfiguration', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.tblFieldConfiguration', N'tTableName') IS NOT NULL
   AND EXISTS (SELECT 1 FROM dbo.tblFieldConfiguration WHERE tTableName IS NULL)
BEGIN
    ALTER TABLE dbo.tblFieldConfiguration ALTER COLUMN tTableName NVARCHAR(128) NOT NULL;
END;
GO

IF EXISTS
(
    SELECT 1 FROM sys.key_constraints
    WHERE name = N'UQ_tblFieldConfiguration_tFieldName'
      AND parent_object_id = OBJECT_ID(N'dbo.tblFieldConfiguration')
)
BEGIN
    ALTER TABLE dbo.tblFieldConfiguration DROP CONSTRAINT UQ_tblFieldConfiguration_tFieldName;
END;
GO

IF OBJECT_ID(N'dbo.tblFieldConfiguration', N'U') IS NOT NULL
   AND NOT EXISTS
   (
       SELECT 1 FROM sys.key_constraints
       WHERE name = N'UQ_tblFieldConfiguration_tTableName_tFieldName'
         AND parent_object_id = OBJECT_ID(N'dbo.tblFieldConfiguration')
   )
BEGIN
    ALTER TABLE dbo.tblFieldConfiguration
        ADD CONSTRAINT UQ_tblFieldConfiguration_tTableName_tFieldName
        UNIQUE (tTableName, tFieldName);
END;
GO

/* Backfill existing flat conditions into one group per rule. */
IF OBJECT_ID(N'dbo.tblRuleConditionGroup', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.tblRuleCondition', N'U') IS NOT NULL
BEGIN
    INSERT INTO dbo.tblRuleConditionGroup (aRuleId, nGroupOrder, tLogicalOperator)
    SELECT DISTINCT rc.aRuleId, 1, 'AND'
    FROM dbo.tblRuleCondition rc
    WHERE rc.aRuleConditionGroupId IS NULL
      AND NOT EXISTS
      (
          SELECT 1
          FROM dbo.tblRuleConditionGroup rg
          WHERE rg.aRuleId = rc.aRuleId
      );

    UPDATE rc
    SET aRuleConditionGroupId = rg.aRuleConditionGroupId
    FROM dbo.tblRuleCondition rc
    INNER JOIN dbo.tblRuleConditionGroup rg
        ON rg.aRuleId = rc.aRuleId
       AND rg.nGroupOrder = 1
    WHERE rc.aRuleConditionGroupId IS NULL;
END;
GO


IF OBJECT_ID(N'dbo.tblAllocationRunHistory', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblAllocationRunHistory
    (
        aAllocationRunId UNIQUEIDENTIFIER NOT NULL,
        tAllocationRunName NVARCHAR(200) NOT NULL,
        nCapRound INT NOT NULL,
        tAllocationStep NVARCHAR(50) NOT NULL,
        tStatus NVARCHAR(30) NOT NULL,
        tRuleGroupsJson NVARCHAR(MAX) NOT NULL,
        dtStartedAtUtc DATETIME2 NOT NULL,
        dtCompletedAtUtc DATETIME2 NULL,
        nCandidateCount INT NULL CONSTRAINT DF_tblAllocationRunHistory_nCandidateCount DEFAULT (0),
        nDecisionCount INT NOT NULL CONSTRAINT DF_tblAllocationRunHistory_nDecisionCount DEFAULT (0),
        tErrorMessage NVARCHAR(2000) NOT NULL CONSTRAINT DF_tblAllocationRunHistory_tErrorMessage DEFAULT (N''),
        CONSTRAINT PK_tblAllocationRunHistory PRIMARY KEY (aAllocationRunId)
    );

    CREATE INDEX IX_tblAllocationRunHistory_dtStartedAtUtc
        ON dbo.tblAllocationRunHistory (dtStartedAtUtc DESC);
END;
GO


/* Configurable allocation decisions. Conditions remain in tblRule/tblRuleCondition. */
IF OBJECT_ID(N'dbo.tblAllocationDecision', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblAllocationDecision
    (
        aAllocationDecisionId INT IDENTITY(1,1) NOT NULL,
        tStepCode NVARCHAR(50) NOT NULL,
        tDecisionAreaCode NVARCHAR(100) NOT NULL,
        aRuleId INT NOT NULL,
        nDisplayOrder INT NOT NULL,
        tAllocatedType NVARCHAR(50) NOT NULL CONSTRAINT DF_tblAllocationDecision_tAllocatedType DEFAULT (N''),
        tVacancyType NVARCHAR(50) NOT NULL CONSTRAINT DF_tblAllocationDecision_tVacancyType DEFAULT (N''),
        tResultJson NVARCHAR(MAX) NULL,
        bIsActive BIT NOT NULL CONSTRAINT DF_tblAllocationDecision_bIsActive DEFAULT (1),
        dtCreatedDate DATETIME NOT NULL CONSTRAINT DF_tblAllocationDecision_dtCreatedDate DEFAULT (GETDATE()),
        dtModifiedDate DATETIME NULL,
        CONSTRAINT PK_tblAllocationDecision PRIMARY KEY (aAllocationDecisionId),
        CONSTRAINT FK_tblAllocationDecision_tblRule FOREIGN KEY (aRuleId) REFERENCES dbo.tblRule(aRuleId),
        CONSTRAINT CK_tblAllocationDecision_nDisplayOrder CHECK (nDisplayOrder > 0),
        CONSTRAINT UQ_tblAllocationDecision_Rule UNIQUE (tStepCode, tDecisionAreaCode, aRuleId),
        CONSTRAINT UQ_tblAllocationDecision_Order UNIQUE (tStepCode, tDecisionAreaCode, nDisplayOrder)
    );

    CREATE INDEX IX_tblAllocationDecision_Area
        ON dbo.tblAllocationDecision(tStepCode, tDecisionAreaCode, nDisplayOrder);
END;
GO

/* Allocation run lifecycle and persisted allocation results. */
IF OBJECT_ID(N'dbo.tblAllocationRunHistory', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'dbo.tblAllocationRunHistory', N'dtCreatedAtUtc') IS NULL
        ALTER TABLE dbo.tblAllocationRunHistory ADD dtCreatedAtUtc DATETIME2 NULL;

    IF COL_LENGTH(N'dbo.tblAllocationRunHistory', N'dtStartedAtUtc') IS NOT NULL
        ALTER TABLE dbo.tblAllocationRunHistory ALTER COLUMN dtStartedAtUtc DATETIME2 NULL;

    UPDATE dbo.tblAllocationRunHistory
    SET dtCreatedAtUtc = COALESCE(dtCreatedAtUtc, dtStartedAtUtc, GETUTCDATE())
    WHERE dtCreatedAtUtc IS NULL;
END;
GO

IF OBJECT_ID(N'dbo.tblAllocationRunDecision', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblAllocationRunDecision
    (
        aDecisionId UNIQUEIDENTIFIER NOT NULL,
        aAllocationRunId UNIQUEIDENTIFIER NOT NULL,
        nCandidateId BIGINT NOT NULL,
        nCollegeId INT NOT NULL CONSTRAINT DF_tblAllocationRunDecision_nCollegeId DEFAULT (0),
        nPreferenceNo INT NOT NULL CONSTRAINT DF_tblAllocationRunDecision_nPreferenceNo DEFAULT (0),
        nCategoryId INT NOT NULL CONSTRAINT DF_tblAllocationRunDecision_nCategoryId DEFAULT (0),
        tAllocatedType NVARCHAR(50) NOT NULL CONSTRAINT DF_tblAllocationRunDecision_tAllocatedType DEFAULT (N''),
        tOriginalAllocatedType NVARCHAR(50) NOT NULL CONSTRAINT DF_tblAllocationRunDecision_tOriginalAllocatedType DEFAULT (N''),
        nStepId INT NOT NULL CONSTRAINT DF_tblAllocationRunDecision_nStepId DEFAULT (0),
        tDecisionArea NVARCHAR(100) NOT NULL,
        tRuleCode NVARCHAR(200) NOT NULL,
        tStatus NVARCHAR(30) NOT NULL,
        dtCreatedAtUtc DATETIME2 NOT NULL CONSTRAINT DF_tblAllocationRunDecision_dtCreatedAtUtc DEFAULT (GETUTCDATE()),
        CONSTRAINT PK_tblAllocationRunDecision PRIMARY KEY (aDecisionId),
        CONSTRAINT FK_tblAllocationRunDecision_Run FOREIGN KEY (aAllocationRunId)
            REFERENCES dbo.tblAllocationRunHistory(aAllocationRunId)
    );

    CREATE INDEX IX_tblAllocationRunDecision_Run
        ON dbo.tblAllocationRunDecision(aAllocationRunId, nCandidateId);
END;
GO


/* Configurable IF/THEN decision rows.
   These conditions are intentionally separate from tblRuleCondition because
   operands may come from allocation context/calculated values such as Gender,
   Fem and Vacancy rather than tblFieldConfiguration. */
IF OBJECT_ID(N'dbo.tblRuleDecision', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblRuleDecision
    (
        aRuleDecisionId INT IDENTITY(1,1) NOT NULL,
        aRuleId INT NOT NULL,
        tDecisionName NVARCHAR(200) NOT NULL,
        nDecisionOrder INT NOT NULL,
        bIsActive BIT NOT NULL CONSTRAINT DF_tblRuleDecision_bIsActive DEFAULT (1),
        dtCreatedDate DATETIME NOT NULL CONSTRAINT DF_tblRuleDecision_dtCreatedDate DEFAULT (GETDATE()),
        dtModifiedDate DATETIME NULL,
        CONSTRAINT PK_tblRuleDecision PRIMARY KEY (aRuleDecisionId),
        CONSTRAINT FK_tblRuleDecision_tblRule FOREIGN KEY (aRuleId) REFERENCES dbo.tblRule(aRuleId),
        CONSTRAINT CK_tblRuleDecision_nDecisionOrder CHECK (nDecisionOrder > 0),
        CONSTRAINT UQ_tblRuleDecision_Rule_Order UNIQUE (aRuleId, nDecisionOrder)
    );
END;
GO

IF OBJECT_ID(N'dbo.tblRuleDecisionCondition', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblRuleDecisionCondition
    (
        aRuleDecisionConditionId INT IDENTITY(1,1) NOT NULL,
        aRuleDecisionId INT NOT NULL,
        tOperandType NVARCHAR(30) NOT NULL,
        tOperandKey NVARCHAR(200) NOT NULL,
        tLogicalOperator NVARCHAR(10) NOT NULL CONSTRAINT DF_tblRuleDecisionCondition_tLogicalOperator DEFAULT ('AND'),
        tOperator NVARCHAR(50) NOT NULL,
        tValue NVARCHAR(1000) NOT NULL,
        nConditionOrder INT NOT NULL,
        dtCreatedDate DATETIME NOT NULL CONSTRAINT DF_tblRuleDecisionCondition_dtCreatedDate DEFAULT (GETDATE()),
        CONSTRAINT PK_tblRuleDecisionCondition PRIMARY KEY (aRuleDecisionConditionId),
        CONSTRAINT FK_tblRuleDecisionCondition_tblRuleDecision FOREIGN KEY (aRuleDecisionId)
            REFERENCES dbo.tblRuleDecision(aRuleDecisionId) ON DELETE CASCADE,
        CONSTRAINT CK_tblRuleDecisionCondition_tOperandType CHECK (tOperandType IN ('FIELD', 'CONTEXT')),
        CONSTRAINT CK_tblRuleDecisionCondition_tLogicalOperator CHECK (tLogicalOperator IN ('AND', 'OR')),
        CONSTRAINT CK_tblRuleDecisionCondition_nConditionOrder CHECK (nConditionOrder > 0),
        CONSTRAINT UQ_tblRuleDecisionCondition_Decision_Order UNIQUE (aRuleDecisionId, nConditionOrder)
    );
END;
GO

IF OBJECT_ID(N'dbo.tblRuleDecisionResult', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblRuleDecisionResult
    (
        aRuleDecisionResultId INT IDENTITY(1,1) NOT NULL,
        aRuleDecisionId INT NOT NULL,
        tResultKey NVARCHAR(200) NOT NULL,
        tResultValue NVARCHAR(1000) NOT NULL,
        tValueKind NVARCHAR(30) NOT NULL CONSTRAINT DF_tblRuleDecisionResult_tValueKind DEFAULT ('text'),
        nResultOrder INT NOT NULL CONSTRAINT DF_tblRuleDecisionResult_nResultOrder DEFAULT (1),
        dtCreatedDate DATETIME NOT NULL CONSTRAINT DF_tblRuleDecisionResult_dtCreatedDate DEFAULT (GETDATE()),
        CONSTRAINT PK_tblRuleDecisionResult PRIMARY KEY (aRuleDecisionResultId),
        CONSTRAINT FK_tblRuleDecisionResult_tblRuleDecision FOREIGN KEY (aRuleDecisionId)
            REFERENCES dbo.tblRuleDecision(aRuleDecisionId) ON DELETE CASCADE,
        CONSTRAINT CK_tblRuleDecisionResult_nResultOrder CHECK (nResultOrder > 0),
        CONSTRAINT UQ_tblRuleDecisionResult_Decision_Order UNIQUE (aRuleDecisionId, nResultOrder)
    );
END;
GO

IF NOT EXISTS
(
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_tblRuleDecisionCondition_Operand'
      AND object_id = OBJECT_ID(N'dbo.tblRuleDecisionCondition')
)
BEGIN
    CREATE INDEX IX_tblRuleDecisionCondition_Operand
        ON dbo.tblRuleDecisionCondition(tOperandType, tOperandKey);
END;
GO


/* ============================================================
   Consolidated rule outcome / decision branch schema
   This section is intentionally kept in the single table script.
   ============================================================ */
IF COL_LENGTH(N'dbo.tblRuleDecision', N'tConditionsJson') IS NULL
    ALTER TABLE dbo.tblRuleDecision ADD tConditionsJson NVARCHAR(MAX) NULL;
GO

IF COL_LENGTH(N'dbo.tblRuleDecision', N'bIsElse') IS NULL
    ALTER TABLE dbo.tblRuleDecision ADD bIsElse BIT NOT NULL CONSTRAINT DF_tblRuleDecision_bIsElse DEFAULT (0);
GO

UPDATE dbo.tblRuleDecision
SET tConditionsJson = COALESCE(NULLIF(tConditionsJson, N''), N'[]')
WHERE tConditionsJson IS NULL OR tConditionsJson = N'';
GO

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

/*
 CET Configuration - Decision Row Step 0 migration
 Adds the strongly typed Step 0 decision values.
*/
IF COL_LENGTH(N'dbo.tblRuleDecision', N'tAllocationType') IS NULL
    ALTER TABLE dbo.tblRuleDecision ADD tAllocationType NVARCHAR(100) NULL;
GO

IF COL_LENGTH(N'dbo.tblRuleDecision', N'nSequence') IS NULL
    ALTER TABLE dbo.tblRuleDecision ADD nSequence INT NULL;
GO


-- Preserve any existing Step 0 result data created by the earlier generic model.
UPDATE d
SET
    d.tAllocationType = COALESCE(
        NULLIF(d.tAllocationType, N''),
        atype.tResultValue
    ),
    d.nSequence = COALESCE(
        d.nSequence,
        TRY_CONVERT(INT, seq.tResultValue),
        1
    )
FROM dbo.tblRuleDecision d
OUTER APPLY
(
    SELECT TOP (1) r.tResultValue
    FROM dbo.tblRuleDecisionResult r
    WHERE r.aRuleDecisionId = d.aRuleDecisionId
      AND LOWER(r.tResultKey) IN (N'allocatedtype', N'allocationtype')
    ORDER BY r.nResultOrder
) atype
OUTER APPLY
(
    SELECT TOP (1) r.tResultValue
    FROM dbo.tblRuleDecisionResult r
    WHERE r.aRuleDecisionId = d.aRuleDecisionId
      AND LOWER(r.tResultKey) IN (N'seqid', N'sequence')
    ORDER BY r.nResultOrder
) seq
WHERE d.tAllocationType IS NULL OR d.nSequence IS NULL;
GO


/* ============================================================
   Single Rule IF / ELSE IF / ELSE branch configuration

   A Rule is the business rule.
   A Rule Branch is only the conditional path inside that rule.

   Example:
       IF Gender = 'F' AND Fem > 0 AND Vacancy > 0
           THEN AllocatedType = 'Fem', Sequence = 1
       ELSE IF Gen > 0 AND Vacancy > 0
           THEN AllocatedType = 'Gen', Sequence = 2
       ELSE
           THEN ...

   The UI and API expose these as Branches. There is no separate
   "Decision Row" concept.
   ============================================================ */

IF OBJECT_ID(N'dbo.tblRuleBranch', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblRuleBranch
    (
        aRuleBranchId INT IDENTITY(1,1) NOT NULL,
        aRuleId INT NOT NULL,
        tBranchName NVARCHAR(200) NOT NULL,
        nBranchOrder INT NOT NULL,
        tAllocatedType NVARCHAR(100) NULL,
        nSequence INT NULL,
        bIsElse BIT NOT NULL CONSTRAINT DF_tblRuleBranch_bIsElse DEFAULT (0),
        bIsActive BIT NOT NULL CONSTRAINT DF_tblRuleBranch_bIsActive DEFAULT (1),
        tConditionsJson NVARCHAR(MAX) NOT NULL CONSTRAINT DF_tblRuleBranch_tConditionsJson DEFAULT (N'[]'),
        tOutcomeJson NVARCHAR(MAX) NOT NULL CONSTRAINT DF_tblRuleBranch_tOutcomeJson DEFAULT (N'{}'),
        dtCreatedDate DATETIME NOT NULL CONSTRAINT DF_tblRuleBranch_dtCreatedDate DEFAULT (GETDATE()),
        dtModifiedDate DATETIME NULL,

        CONSTRAINT PK_tblRuleBranch PRIMARY KEY (aRuleBranchId),
        CONSTRAINT FK_tblRuleBranch_tblRule
            FOREIGN KEY (aRuleId) REFERENCES dbo.tblRule(aRuleId) ON DELETE CASCADE,
        CONSTRAINT CK_tblRuleBranch_nBranchOrder CHECK (nBranchOrder > 0),
        CONSTRAINT CK_tblRuleBranch_nSequence CHECK (nSequence IS NULL OR nSequence > 0),
        CONSTRAINT UQ_tblRuleBranch_Rule_Order UNIQUE (aRuleId, nBranchOrder)
    );

    CREATE INDEX IX_tblRuleBranch_Rule
        ON dbo.tblRuleBranch(aRuleId, nBranchOrder);
END;
GO

/* Migrate the previous internal decision-row storage once.
   This preserves existing configured rules while changing the model
   to Rule -> Branches. */
IF OBJECT_ID(N'dbo.tblRuleBranch', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.tblRuleBranch', N'tOutcomeJson') IS NULL
BEGIN
    ALTER TABLE dbo.tblRuleBranch ADD tOutcomeJson NVARCHAR(MAX) NOT NULL CONSTRAINT DF_tblRuleBranch_tOutcomeJson DEFAULT (N'{}');
END;
GO

IF OBJECT_ID(N'dbo.tblRuleBranch', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.tblRuleDecision', N'U') IS NOT NULL
BEGIN
    INSERT INTO dbo.tblRuleBranch
    (
        aRuleId,
        tBranchName,
        nBranchOrder,
        tAllocatedType,
        nSequence,
        bIsElse,
        bIsActive,
        tConditionsJson,
        tOutcomeJson,
        dtCreatedDate,
        dtModifiedDate
    )
    SELECT
        d.aRuleId,
        d.tDecisionName,
        d.nDecisionOrder,
        d.tAllocationType,
        d.nSequence,
        d.bIsElse,
        d.bIsActive,
        COALESCE(NULLIF(d.tConditionsJson, N''), N'[]'),
        N'{}',
        d.dtCreatedDate,
        d.dtModifiedDate
    FROM dbo.tblRuleDecision d
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM dbo.tblRuleBranch b
        WHERE b.aRuleId = d.aRuleId
          AND b.nBranchOrder = d.nDecisionOrder
    );
END;
GO

/* The old decision-row tables are obsolete.
   Drop the dependent tables first, then the old parent table. */
IF OBJECT_ID(N'dbo.tblRuleDecisionResult', N'U') IS NOT NULL
    DROP TABLE dbo.tblRuleDecisionResult;
GO

IF OBJECT_ID(N'dbo.tblRuleDecisionCondition', N'U') IS NOT NULL
    DROP TABLE dbo.tblRuleDecisionCondition;
GO

IF OBJECT_ID(N'dbo.tblRuleDecision', N'U') IS NOT NULL
    DROP TABLE dbo.tblRuleDecision;
GO


/* User access permissions. Permissions are module-level and separate Read/Write. */
IF OBJECT_ID(N'dbo.tblUserPermission', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblUserPermission
    (
        aUserPermissionId INT IDENTITY(1,1) NOT NULL,
        aUserId           INT NOT NULL,
        tModuleCode       NVARCHAR(50) NOT NULL,
        bCanRead          BIT NOT NULL CONSTRAINT DF_tblUserPermission_bCanRead DEFAULT (0),
        bCanWrite         BIT NOT NULL CONSTRAINT DF_tblUserPermission_bCanWrite DEFAULT (0),
        dtCreatedDate     DATETIME NOT NULL CONSTRAINT DF_tblUserPermission_dtCreatedDate DEFAULT (GETDATE()),
        dtModifiedDate    DATETIME NULL,

        CONSTRAINT PK_tblUserPermission PRIMARY KEY (aUserPermissionId),
        CONSTRAINT FK_tblUserPermission_tblUsers
            FOREIGN KEY (aUserId) REFERENCES dbo.tblUsers(aUserId) ON DELETE CASCADE,
        CONSTRAINT CK_tblUserPermission_tModuleCode
            CHECK (tModuleCode IN ('FIELDS', 'RULES', 'ALLOCATION_RUN')),
        CONSTRAINT CK_tblUserPermission_WriteRequiresRead
            CHECK (bCanWrite = 0 OR bCanRead = 1),
        CONSTRAINT UQ_tblUserPermission_User_Module
            UNIQUE (aUserId, tModuleCode)
    );

    CREATE INDEX IX_tblUserPermission_User
        ON dbo.tblUserPermission(aUserId, tModuleCode);
END;
GO


/* Audit ownership: every configuration/run action is attributable to a CET user. */
IF OBJECT_ID(N'dbo.tblUsers', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'dbo.tblFieldConfiguration', N'aCreatedByUserId') IS NULL
        ALTER TABLE dbo.tblFieldConfiguration ADD aCreatedByUserId INT NULL;

    IF COL_LENGTH(N'dbo.tblRule', N'aCreatedByUserId') IS NULL
        ALTER TABLE dbo.tblRule ADD aCreatedByUserId INT NULL;

    IF COL_LENGTH(N'dbo.tblAllocationRunHistory', N'aCreatedByUserId') IS NULL
        ALTER TABLE dbo.tblAllocationRunHistory ADD aCreatedByUserId INT NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_tblFieldConfiguration_CreatedBy' AND parent_object_id = OBJECT_ID(N'dbo.tblFieldConfiguration'))
        ALTER TABLE dbo.tblFieldConfiguration ADD CONSTRAINT FK_tblFieldConfiguration_CreatedBy FOREIGN KEY (aCreatedByUserId) REFERENCES dbo.tblUsers(aUserId);

    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_tblRule_CreatedBy' AND parent_object_id = OBJECT_ID(N'dbo.tblRule'))
        ALTER TABLE dbo.tblRule ADD CONSTRAINT FK_tblRule_CreatedBy FOREIGN KEY (aCreatedByUserId) REFERENCES dbo.tblUsers(aUserId);

    IF OBJECT_ID(N'dbo.tblAllocationRunHistory', N'U') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_tblAllocationRunHistory_CreatedBy' AND parent_object_id = OBJECT_ID(N'dbo.tblAllocationRunHistory'))
        ALTER TABLE dbo.tblAllocationRunHistory ADD CONSTRAINT FK_tblAllocationRunHistory_CreatedBy FOREIGN KEY (aCreatedByUserId) REFERENCES dbo.tblUsers(aUserId);
END;
GO

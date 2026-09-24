/*
    CET Configuration Database Objects - Tables
    Target database: CET_Configuration

    Canonical table definitions.
    All final column names, defaults, constraints and indexes are defined
    directly in CREATE TABLE / CREATE INDEX statements. No ALTER TABLE or
    column-rename migration statements are required in this script.
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
        nCreatedByUserId INT NULL,
        dtCreatedDate   DATETIME NOT NULL CONSTRAINT DF_tblFieldConfiguration_dtCreatedDate DEFAULT (GETDATE()),
        dtModifiedDate  DATETIME NULL,

        CONSTRAINT PK_tblFieldConfiguration PRIMARY KEY (aFieldId),
        CONSTRAINT UQ_tblFieldConfiguration_tTableName_tFieldName UNIQUE (tTableName, tFieldName),
        CONSTRAINT FK_tblFieldConfiguration_CreatedBy
            FOREIGN KEY (nCreatedByUserId) REFERENCES dbo.tblUsers(aUserId)
    );
END;
GO

IF OBJECT_ID(N'dbo.tblRule', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblRule
    (
        aRuleId          INT NOT NULL,
        tRuleName        NVARCHAR(200) NOT NULL,
        tDescription     NVARCHAR(1000) NULL,
        nPriority        INT NOT NULL,
        bIsActive        BIT NOT NULL CONSTRAINT DF_tblRule_bIsActive DEFAULT (1),
        nCreatedByUserId INT NULL,
        tDecisionAreaCode NVARCHAR(100) NOT NULL CONSTRAINT DF_tblRule_tDecisionAreaCode DEFAULT (N''),
        tOutcomeJson     NVARCHAR(MAX) NOT NULL CONSTRAINT DF_tblRule_tOutcomeJson DEFAULT (N'{}'),
        dtCreatedDate    DATETIME NOT NULL CONSTRAINT DF_tblRule_dtCreatedDate DEFAULT (GETDATE()),
        dtModifiedDate   DATETIME NULL,

        CONSTRAINT PK_tblRule PRIMARY KEY (aRuleId),
        CONSTRAINT UQ_tblRule_tRuleName UNIQUE (tRuleName),
        CONSTRAINT CK_tblRule_nPriority CHECK (nPriority > 0),
        CONSTRAINT FK_tblRule_CreatedBy
            FOREIGN KEY (nCreatedByUserId) REFERENCES dbo.tblUsers(aUserId)
    );
END;
GO

IF OBJECT_ID(N'dbo.tblRuleConditionGroup', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblRuleConditionGroup
    (
        aRuleConditionGroupId INT IDENTITY(1,1) NOT NULL,
        nRuleId               INT NOT NULL,
        nGroupOrder           INT NOT NULL,
        tLogicalOperator      NVARCHAR(10) NOT NULL
            CONSTRAINT DF_tblRuleConditionGroup_tLogicalOperator DEFAULT ('AND'),
        dtCreatedDate         DATETIME NOT NULL
            CONSTRAINT DF_tblRuleConditionGroup_dtCreatedDate DEFAULT (GETDATE()),

        CONSTRAINT PK_tblRuleConditionGroup PRIMARY KEY (aRuleConditionGroupId),
        CONSTRAINT FK_tblRuleConditionGroup_tblRule
            FOREIGN KEY (nRuleId) REFERENCES dbo.tblRule(aRuleId),
        CONSTRAINT CK_tblRuleConditionGroup_tLogicalOperator
            CHECK (tLogicalOperator IN ('AND', 'OR')),
        CONSTRAINT CK_tblRuleConditionGroup_nGroupOrder
            CHECK (nGroupOrder > 0),
        CONSTRAINT UQ_tblRuleConditionGroup_Rule_Order
            UNIQUE (nRuleId, nGroupOrder)
    );
END;
GO

IF OBJECT_ID(N'dbo.tblRuleCondition', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblRuleCondition
    (
        aRuleConditionId       INT IDENTITY(1,1) NOT NULL,
        nRuleId                INT NOT NULL,
        nRuleConditionGroupId  INT NULL,
        nFieldId               INT NOT NULL,
        tGroupPath             NVARCHAR(1000) NULL,
        tLogicalOperator       NVARCHAR(10) NOT NULL
            CONSTRAINT DF_tblRuleCondition_tLogicalOperator DEFAULT ('AND'),
        tOperator              NVARCHAR(50) NOT NULL,
        tValue                 NVARCHAR(1000) NOT NULL,
        nConditionOrder        INT NOT NULL,
        dtCreatedDate          DATETIME NOT NULL
            CONSTRAINT DF_tblRuleCondition_dtCreatedDate DEFAULT (GETDATE()),

        CONSTRAINT PK_tblRuleCondition PRIMARY KEY (aRuleConditionId),
        CONSTRAINT FK_tblRuleCondition_tblRule
            FOREIGN KEY (nRuleId) REFERENCES dbo.tblRule(aRuleId),
        CONSTRAINT FK_tblRuleCondition_tblRuleConditionGroup
            FOREIGN KEY (nRuleConditionGroupId)
            REFERENCES dbo.tblRuleConditionGroup(aRuleConditionGroupId),
        CONSTRAINT FK_tblRuleCondition_tblFieldConfiguration
            FOREIGN KEY (nFieldId)
            REFERENCES dbo.tblFieldConfiguration(aFieldId),
        CONSTRAINT CK_tblRuleCondition_tLogicalOperator
            CHECK (tLogicalOperator IN ('AND', 'OR')),
        CONSTRAINT CK_tblRuleCondition_nConditionOrder
            CHECK (nConditionOrder > 0),
        CONSTRAINT UQ_tblRuleCondition_Rule_Order
            UNIQUE (nRuleId, nConditionOrder)
    );
END;
GO

IF OBJECT_ID(N'dbo.tblAllocationRunHistory', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblAllocationRunHistory
    (
        aAllocationRunId   UNIQUEIDENTIFIER NOT NULL,
        tAllocationRunName NVARCHAR(200) NOT NULL,
        nCapRound          INT NOT NULL,
        tAllocationStep    NVARCHAR(50) NOT NULL,
        tStatus            NVARCHAR(30) NOT NULL,
        tRuleGroupsJson    NVARCHAR(MAX) NOT NULL,
        dtCreatedAtUtc     DATETIME2 NULL CONSTRAINT DF_tblAllocationRunHistory_dtCreatedAtUtc DEFAULT (GETUTCDATE()),
        dtStartedAtUtc     DATETIME2 NULL,
        dtCompletedAtUtc   DATETIME2 NULL,
        nCandidateCount    INT NULL CONSTRAINT DF_tblAllocationRunHistory_nCandidateCount DEFAULT (0),
        nDecisionCount     INT NOT NULL CONSTRAINT DF_tblAllocationRunHistory_nDecisionCount DEFAULT (0),
        tErrorMessage      NVARCHAR(2000) NOT NULL CONSTRAINT DF_tblAllocationRunHistory_tErrorMessage DEFAULT (N''),
        nCreatedByUserId   INT NULL,

        CONSTRAINT PK_tblAllocationRunHistory PRIMARY KEY (aAllocationRunId),
        CONSTRAINT FK_tblAllocationRunHistory_CreatedBy
            FOREIGN KEY (nCreatedByUserId) REFERENCES dbo.tblUsers(aUserId)
    );

    CREATE INDEX IX_tblAllocationRunHistory_dtStartedAtUtc
        ON dbo.tblAllocationRunHistory (dtStartedAtUtc DESC);
END;
GO

IF OBJECT_ID(N'dbo.tblAllocationDecision', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblAllocationDecision
    (
        aAllocationDecisionId INT IDENTITY(1,1) NOT NULL,
        tStepCode             NVARCHAR(50) NOT NULL,
        tDecisionAreaCode     NVARCHAR(100) NOT NULL,
        nRuleId               INT NOT NULL,
        nDisplayOrder         INT NOT NULL,
        tAllocatedType        NVARCHAR(50) NOT NULL
            CONSTRAINT DF_tblAllocationDecision_tAllocatedType DEFAULT (N''),
        tVacancyType          NVARCHAR(50) NOT NULL
            CONSTRAINT DF_tblAllocationDecision_tVacancyType DEFAULT (N''),
        tResultJson           NVARCHAR(MAX) NULL,
        bIsActive             BIT NOT NULL
            CONSTRAINT DF_tblAllocationDecision_bIsActive DEFAULT (1),
        dtCreatedDate         DATETIME NOT NULL
            CONSTRAINT DF_tblAllocationDecision_dtCreatedDate DEFAULT (GETDATE()),
        dtModifiedDate        DATETIME NULL,

        CONSTRAINT PK_tblAllocationDecision PRIMARY KEY (aAllocationDecisionId),
        CONSTRAINT FK_tblAllocationDecision_tblRule
            FOREIGN KEY (nRuleId) REFERENCES dbo.tblRule(aRuleId),
        CONSTRAINT CK_tblAllocationDecision_nDisplayOrder
            CHECK (nDisplayOrder > 0),
        CONSTRAINT UQ_tblAllocationDecision_Rule
            UNIQUE (tStepCode, tDecisionAreaCode, nRuleId),
        CONSTRAINT UQ_tblAllocationDecision_Order
            UNIQUE (tStepCode, tDecisionAreaCode, nDisplayOrder)
    );

    CREATE INDEX IX_tblAllocationDecision_Area
        ON dbo.tblAllocationDecision(tStepCode, tDecisionAreaCode, nDisplayOrder);
END;
GO

IF OBJECT_ID(N'dbo.tblAllocationRunDecision', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblAllocationRunDecision
    (
        aDecisionId          UNIQUEIDENTIFIER NOT NULL,
        nAllocationRunId     UNIQUEIDENTIFIER NOT NULL,
        nCandidateId         BIGINT NOT NULL,
        nCollegeId           INT NOT NULL
            CONSTRAINT DF_tblAllocationRunDecision_nCollegeId DEFAULT (0),
        nPreferenceNo        INT NOT NULL
            CONSTRAINT DF_tblAllocationRunDecision_nPreferenceNo DEFAULT (0),
        nCategoryId          INT NOT NULL
            CONSTRAINT DF_tblAllocationRunDecision_nCategoryId DEFAULT (0),
        tAllocatedType       NVARCHAR(50) NOT NULL
            CONSTRAINT DF_tblAllocationRunDecision_tAllocatedType DEFAULT (N''),
        tOriginalAllocatedType NVARCHAR(50) NOT NULL
            CONSTRAINT DF_tblAllocationRunDecision_tOriginalAllocatedType DEFAULT (N''),
        nStepId              INT NOT NULL
            CONSTRAINT DF_tblAllocationRunDecision_nStepId DEFAULT (0),
        tDecisionArea        NVARCHAR(100) NOT NULL,
        tRuleCode            NVARCHAR(200) NOT NULL,
        tStatus               NVARCHAR(30) NOT NULL,
        dtCreatedAtUtc       DATETIME2 NOT NULL
            CONSTRAINT DF_tblAllocationRunDecision_dtCreatedAtUtc DEFAULT (GETUTCDATE()),

        CONSTRAINT PK_tblAllocationRunDecision PRIMARY KEY (aDecisionId),
        CONSTRAINT FK_tblAllocationRunDecision_Run
            FOREIGN KEY (nAllocationRunId)
            REFERENCES dbo.tblAllocationRunHistory(aAllocationRunId)
    );

    CREATE INDEX IX_tblAllocationRunDecision_Run
        ON dbo.tblAllocationRunDecision(nAllocationRunId, nCandidateId);
END;
GO

IF OBJECT_ID(N'dbo.tblRuleBranch', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblRuleBranch
    (
        aRuleBranchId     INT IDENTITY(1,1) NOT NULL,
        nRuleId           INT NOT NULL,
        tBranchName       NVARCHAR(200) NOT NULL,
        nBranchOrder      INT NOT NULL,
        tAllocatedType    NVARCHAR(100) NULL,
        nSequence         INT NULL,
        bIsElse           BIT NOT NULL
            CONSTRAINT DF_tblRuleBranch_bIsElse DEFAULT (0),
        bIsActive         BIT NOT NULL
            CONSTRAINT DF_tblRuleBranch_bIsActive DEFAULT (1),
        tConditionsJson   NVARCHAR(MAX) NOT NULL
            CONSTRAINT DF_tblRuleBranch_tConditionsJson DEFAULT (N'[]'),
        tOutcomeJson      NVARCHAR(MAX) NOT NULL
            CONSTRAINT DF_tblRuleBranch_tOutcomeJson DEFAULT (N'{}'),
        dtCreatedDate     DATETIME NOT NULL
            CONSTRAINT DF_tblRuleBranch_dtCreatedDate DEFAULT (GETDATE()),
        dtModifiedDate    DATETIME NULL,

        CONSTRAINT PK_tblRuleBranch PRIMARY KEY (aRuleBranchId),
        CONSTRAINT FK_tblRuleBranch_tblRule
            FOREIGN KEY (nRuleId) REFERENCES dbo.tblRule(aRuleId) ON DELETE CASCADE,
        CONSTRAINT CK_tblRuleBranch_nBranchOrder
            CHECK (nBranchOrder > 0),
        CONSTRAINT CK_tblRuleBranch_nSequence
            CHECK (nSequence IS NULL OR nSequence > 0),
        CONSTRAINT UQ_tblRuleBranch_Rule_Order
            UNIQUE (nRuleId, nBranchOrder)
    );

    CREATE INDEX IX_tblRuleBranch_Rule
        ON dbo.tblRuleBranch(nRuleId, nBranchOrder);
END;
GO

IF OBJECT_ID(N'dbo.tblUserPermission', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblUserPermission
    (
        aUserPermissionId INT IDENTITY(1,1) NOT NULL,
        nUserId           INT NOT NULL,
        tModuleCode       NVARCHAR(50) NOT NULL,
        bCanRead          BIT NOT NULL CONSTRAINT DF_tblUserPermission_bCanRead DEFAULT (0),
        bCanWrite         BIT NOT NULL CONSTRAINT DF_tblUserPermission_bCanWrite DEFAULT (0),
        dtCreatedDate     DATETIME NOT NULL CONSTRAINT DF_tblUserPermission_dtCreatedDate DEFAULT (GETDATE()),
        dtModifiedDate    DATETIME NULL,

        CONSTRAINT PK_tblUserPermission PRIMARY KEY (aUserPermissionId),
        CONSTRAINT FK_tblUserPermission_tblUsers
            FOREIGN KEY (nUserId) REFERENCES dbo.tblUsers(aUserId) ON DELETE CASCADE,
        CONSTRAINT CK_tblUserPermission_tModuleCode
            CHECK (tModuleCode IN ('FIELDS', 'RULES', 'ALLOCATION_RUN')),
        CONSTRAINT CK_tblUserPermission_WriteRequiresRead
            CHECK (bCanWrite = 0 OR bCanRead = 1),
        CONSTRAINT UQ_tblUserPermission_User_Module
            UNIQUE (nUserId, tModuleCode)
    );

    CREATE INDEX IX_tblUserPermission_User
        ON dbo.tblUserPermission(nUserId, tModuleCode);
END;
GO

IF OBJECT_ID(N'dbo.tblRuleCondition', N'U') IS NOT NULL
   AND NOT EXISTS
   (
       SELECT 1 FROM sys.indexes
       WHERE name = N'IX_tblRuleCondition_nRuleId'
         AND object_id = OBJECT_ID(N'dbo.tblRuleCondition')
   )
BEGIN
    CREATE INDEX IX_tblRuleCondition_nRuleId
        ON dbo.tblRuleCondition(nRuleId, nConditionOrder);
END;
GO

IF OBJECT_ID(N'dbo.tblRuleCondition', N'U') IS NOT NULL
   AND NOT EXISTS
   (
       SELECT 1 FROM sys.indexes
       WHERE name = N'IX_tblRuleCondition_nFieldId'
         AND object_id = OBJECT_ID(N'dbo.tblRuleCondition')
   )
BEGIN
    CREATE INDEX IX_tblRuleCondition_nFieldId
        ON dbo.tblRuleCondition(nFieldId);
END;
GO

IF OBJECT_ID(N'dbo.tblRuleCondition', N'U') IS NOT NULL
   AND NOT EXISTS
   (
       SELECT 1 FROM sys.indexes
       WHERE name = N'IX_tblRuleCondition_nRuleConditionGroupId'
         AND object_id = OBJECT_ID(N'dbo.tblRuleCondition')
   )
BEGIN
    CREATE INDEX IX_tblRuleCondition_nRuleConditionGroupId
        ON dbo.tblRuleCondition(nRuleConditionGroupId, nConditionOrder);
END;
GO

/*
    CET Configuration Database Objects - Rule Configuration Tables
    Target database: CET_configuration

    Execute this script manually against the CET_configuration database.
    Existing tables are not modified by this script.

    Rule Configuration stores reusable business rules and their conditions.
    Conditions reference fields configured in tblFieldConfiguration.
*/

IF OBJECT_ID(N'dbo.tblRule', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblRule
    (
        aRuleId         INT NOT NULL,
        tRuleName       NVARCHAR(200) NOT NULL,
        tDescription    NVARCHAR(1000) NULL,
        nPriority       INT NOT NULL,
        bIsActive       BIT NOT NULL
            CONSTRAINT DF_tblRule_bIsActive DEFAULT (1),
        dtCreatedDate   DATETIME NOT NULL
            CONSTRAINT DF_tblRule_dtCreatedDate DEFAULT (GETDATE()),
        dtModifiedDate  DATETIME NULL,

        CONSTRAINT PK_tblRule
            PRIMARY KEY (aRuleId),

        CONSTRAINT UQ_tblRule_tRuleName
            UNIQUE (tRuleName),

        CONSTRAINT CK_tblRule_nPriority
            CHECK (nPriority > 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.tblRuleCondition', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblRuleCondition
    (
        aRuleConditionId  INT IDENTITY(1,1) NOT NULL,
        aRuleId           INT NOT NULL,
        aFieldId          INT NOT NULL,
        tLogicalOperator  NVARCHAR(10) NOT NULL
            CONSTRAINT DF_tblRuleCondition_tLogicalOperator DEFAULT ('AND'),
        tOperator         NVARCHAR(50) NOT NULL,
        tValue            NVARCHAR(1000) NOT NULL,
        nConditionOrder   INT NOT NULL,
        dtCreatedDate     DATETIME NOT NULL
            CONSTRAINT DF_tblRuleCondition_dtCreatedDate DEFAULT (GETDATE()),

        CONSTRAINT PK_tblRuleCondition
            PRIMARY KEY (aRuleConditionId),

        CONSTRAINT FK_tblRuleCondition_tblRule
            FOREIGN KEY (aRuleId)
            REFERENCES dbo.tblRule (aRuleId),

        CONSTRAINT FK_tblRuleCondition_tblFieldConfiguration
            FOREIGN KEY (aFieldId)
            REFERENCES dbo.tblFieldConfiguration (aFieldId),

        CONSTRAINT CK_tblRuleCondition_tLogicalOperator
            CHECK (tLogicalOperator IN ('AND', 'OR')),

        CONSTRAINT CK_tblRuleCondition_nConditionOrder
            CHECK (nConditionOrder > 0),

        CONSTRAINT UQ_tblRuleCondition_Rule_Order
            UNIQUE (aRuleId, nConditionOrder)
    );
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
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
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_tblRuleCondition_aFieldId'
      AND object_id = OBJECT_ID(N'dbo.tblRuleCondition')
)
BEGIN
    CREATE INDEX IX_tblRuleCondition_aFieldId
        ON dbo.tblRuleCondition (aFieldId);
END;
GO

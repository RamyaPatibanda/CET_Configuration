/*
    CET Configuration - Rule Configuration

    Execute this script manually against the CET_configuration database.
    This script creates the rule and rule-condition tables if they do not exist.
*/

IF OBJECT_ID(N'dbo.tblRuleConfiguration', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblRuleConfiguration
    (
        aRuleId          INT IDENTITY(1,1) NOT NULL,
        tRuleName        NVARCHAR(200) NOT NULL,
        tDescription     NVARCHAR(1000) NULL,
        nPriority        INT NOT NULL CONSTRAINT DF_tblRuleConfiguration_nPriority DEFAULT (1),
        bIsActive        BIT NOT NULL CONSTRAINT DF_tblRuleConfiguration_bIsActive DEFAULT (1),
        dtCreatedDate    DATETIME NOT NULL CONSTRAINT DF_tblRuleConfiguration_dtCreatedDate DEFAULT (GETDATE()),
        dtModifiedDate   DATETIME NULL,
        CONSTRAINT PK_tblRuleConfiguration PRIMARY KEY (aRuleId),
        CONSTRAINT UQ_tblRuleConfiguration_tRuleName UNIQUE (tRuleName)
    );
END;
GO

IF OBJECT_ID(N'dbo.tblRuleCondition', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblRuleCondition
    (
        aRuleConditionId INT IDENTITY(1,1) NOT NULL,
        aRuleId          INT NOT NULL,
        aFieldId         INT NOT NULL,
        tOperator        NVARCHAR(50) NOT NULL,
        tValue           NVARCHAR(1000) NULL,
        nConditionOrder  INT NOT NULL CONSTRAINT DF_tblRuleCondition_nConditionOrder DEFAULT (1),
        CONSTRAINT PK_tblRuleCondition PRIMARY KEY (aRuleConditionId),
        CONSTRAINT FK_tblRuleCondition_tblRuleConfiguration FOREIGN KEY (aRuleId)
            REFERENCES dbo.tblRuleConfiguration(aRuleId),
        CONSTRAINT FK_tblRuleCondition_tblFieldConfiguration FOREIGN KEY (aFieldId)
            REFERENCES dbo.tblFieldConfiguration(aFieldId)
    );
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_tblRuleCondition_aRuleId_nConditionOrder'
      AND object_id = OBJECT_ID(N'dbo.tblRuleCondition')
)
BEGIN
    CREATE INDEX IX_tblRuleCondition_aRuleId_nConditionOrder
        ON dbo.tblRuleCondition(aRuleId, nConditionOrder);
END;
GO

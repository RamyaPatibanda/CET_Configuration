/*
    CET Configuration Database Objects - Tables
    Target database: CET_configuration

    Execute this script manually against the CET_configuration database.
    Existing tables are not modified by the CREATE sections below.

    This file contains all CET Configuration tables:
    - tblUsers
    - tblFieldConfiguration
    - tblRule
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

/*
    Migration support for databases created from an older Field Configuration
    version where tTableName was not present.
*/
IF OBJECT_ID(N'dbo.tblFieldConfiguration', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.tblFieldConfiguration', N'tTableName') IS NULL
BEGIN
    ALTER TABLE dbo.tblFieldConfiguration
        ADD tTableName NVARCHAR(128) NULL;
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
   AND EXISTS
   (
       SELECT 1
       FROM dbo.tblFieldConfiguration
       WHERE tTableName IS NULL
   )
BEGIN
    ALTER TABLE dbo.tblFieldConfiguration
        ALTER COLUMN tTableName NVARCHAR(128) NOT NULL;
END;
GO

IF EXISTS
(
    SELECT 1
    FROM sys.key_constraints
    WHERE name = N'UQ_tblFieldConfiguration_tFieldName'
      AND parent_object_id = OBJECT_ID(N'dbo.tblFieldConfiguration')
)
BEGIN
    ALTER TABLE dbo.tblFieldConfiguration
        DROP CONSTRAINT UQ_tblFieldConfiguration_tFieldName;
END;
GO

IF OBJECT_ID(N'dbo.tblFieldConfiguration', N'U') IS NOT NULL
   AND NOT EXISTS
   (
       SELECT 1
       FROM sys.key_constraints
       WHERE name = N'UQ_tblFieldConfiguration_tTableName_tFieldName'
         AND parent_object_id = OBJECT_ID(N'dbo.tblFieldConfiguration')
   )
BEGIN
    ALTER TABLE dbo.tblFieldConfiguration
        ADD CONSTRAINT UQ_tblFieldConfiguration_tTableName_tFieldName
        UNIQUE (tTableName, tFieldName);
END;
GO

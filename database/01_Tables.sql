/*
    CET Configuration Database Objects - Tables
    Target database: CET_configuration

    Execute this script manually against the CET_configuration database.
    Existing tables are not modified.
*/

IF OBJECT_ID(N'dbo.tblUsers', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblUsers
    (
        aUserId        INT IDENTITY(1,1) NOT NULL,
        tUsername      NVARCHAR(100) NOT NULL,
        tPassword      NVARCHAR(500) NOT NULL,
        tDisplayName   NVARCHAR(200) NOT NULL,
        tRole          NVARCHAR(100) NULL,
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
        tFieldName      NVARCHAR(200) NOT NULL,
        tDisplayName    NVARCHAR(200) NOT NULL,
        tFieldType      NVARCHAR(50) NOT NULL,
        bIsRequired     BIT NOT NULL CONSTRAINT DF_tblFieldConfiguration_bIsRequired DEFAULT (0),
        bIsActive       BIT NOT NULL CONSTRAINT DF_tblFieldConfiguration_bIsActive DEFAULT (1),
        nDisplayOrder   INT NOT NULL CONSTRAINT DF_tblFieldConfiguration_nDisplayOrder DEFAULT (0),
        dtCreatedDate   DATETIME NOT NULL CONSTRAINT DF_tblFieldConfiguration_dtCreatedDate DEFAULT (GETDATE()),
        dtModifiedDate  DATETIME NULL,
        CONSTRAINT PK_tblFieldConfiguration PRIMARY KEY (aFieldId),
        CONSTRAINT UQ_tblFieldConfiguration_tFieldName UNIQUE (tFieldName)
    );
END;
GO

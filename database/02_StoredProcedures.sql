/*
    CET Configuration Database Objects - Stored Procedures
    Target database: CET_configuration

    Execute this script manually against the CET_configuration database.
    Existing procedures are dropped and recreated so the script always
    deploys the exact current procedure definition.
*/

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

IF OBJECT_ID(N'dbo.sproc_GetFields', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sproc_GetFields;
GO

CREATE PROCEDURE dbo.sproc_GetFields
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        aFieldId,
        tFieldName,
        tDisplayName,
        tFieldType,
        bIsRequired,
        bIsActive,
        nDisplayOrder,
        dtCreatedDate,
        dtModifiedDate
    FROM dbo.tblFieldConfiguration
    ORDER BY nDisplayOrder, aFieldId;
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

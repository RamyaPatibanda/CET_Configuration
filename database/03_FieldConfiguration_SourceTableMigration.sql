IF COL_LENGTH(N'dbo.tblFieldConfiguration', N'tTableName') IS NULL
BEGIN
    ALTER TABLE dbo.tblFieldConfiguration ADD tTableName NVARCHAR(128) NULL;
END;
GO

UPDATE dbo.tblFieldConfiguration
SET tTableName = N'Allocation_MeritList'
WHERE tTableName IS NULL;
GO

ALTER TABLE dbo.tblFieldConfiguration
    ALTER COLUMN tTableName NVARCHAR(128) NOT NULL;
GO

IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = N'UQ_tblFieldConfiguration_tFieldName' AND parent_object_id = OBJECT_ID(N'dbo.tblFieldConfiguration'))
BEGIN
    ALTER TABLE dbo.tblFieldConfiguration DROP CONSTRAINT UQ_tblFieldConfiguration_tFieldName;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = N'UQ_tblFieldConfiguration_tTableName_tFieldName' AND parent_object_id = OBJECT_ID(N'dbo.tblFieldConfiguration'))
BEGIN
    ALTER TABLE dbo.tblFieldConfiguration ADD CONSTRAINT UQ_tblFieldConfiguration_tTableName_tFieldName UNIQUE (tTableName, tFieldName);
END;
GO

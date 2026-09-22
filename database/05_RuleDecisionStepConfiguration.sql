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


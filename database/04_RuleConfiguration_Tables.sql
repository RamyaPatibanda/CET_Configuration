IF OBJECT_ID(N'dbo.tblRuleCondition', N'U') IS NOT NULL DROP TABLE dbo.tblRuleCondition;
GO
IF OBJECT_ID(N'dbo.tblRule', N'U') IS NOT NULL DROP TABLE dbo.tblRule;
GO
CREATE TABLE dbo.tblRule (aRuleId INT NOT NULL, tRuleName NVARCHAR(200) NOT NULL, tDescription NVARCHAR(1000) NULL, nPriority INT NOT NULL, bIsActive BIT NOT NULL DEFAULT (1), dtCreatedDate DATETIME NOT NULL DEFAULT (GETDATE()), dtModifiedDate DATETIME NULL, CONSTRAINT PK_tblRule PRIMARY KEY (aRuleId), CONSTRAINT UQ_tblRule_tRuleName UNIQUE (tRuleName));
GO
CREATE TABLE dbo.tblRuleCondition (aRuleConditionId INT IDENTITY(1,1) NOT NULL, aRuleId INT NOT NULL, aFieldId INT NOT NULL, tLogicalOperator NVARCHAR(10) NOT NULL DEFAULT ('AND'), tOperator NVARCHAR(50) NOT NULL, tValue NVARCHAR(1000) NOT NULL, nConditionOrder INT NOT NULL, CONSTRAINT PK_tblRuleCondition PRIMARY KEY (aRuleConditionId), CONSTRAINT FK_tblRuleCondition_tblRule FOREIGN KEY (aRuleId) REFERENCES dbo.tblRule(aRuleId), CONSTRAINT FK_tblRuleCondition_tblFieldConfiguration FOREIGN KEY (aFieldId) REFERENCES dbo.tblFieldConfiguration(aFieldId), CONSTRAINT CK_tblRuleCondition_LogicalOperator CHECK (tLogicalOperator IN ('AND','OR')));
GO

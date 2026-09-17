IF OBJECT_ID(N'dbo.sproc_GetRules',N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_GetRules;
GO
CREATE PROCEDURE dbo.sproc_GetRules AS BEGIN SET NOCOUNT ON; SELECT aRuleId,tRuleName,tDescription,nPriority,bIsActive,dtCreatedDate,dtModifiedDate FROM dbo.tblRule ORDER BY nPriority,aRuleId; END;
GO
IF OBJECT_ID(N'dbo.sproc_GetRule',N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_GetRule;
GO
CREATE PROCEDURE dbo.sproc_GetRule @aRuleId INT AS BEGIN SET NOCOUNT ON; SELECT aRuleId,tRuleName,tDescription,nPriority,bIsActive,dtCreatedDate,dtModifiedDate FROM dbo.tblRule WHERE aRuleId=@aRuleId; SELECT rc.aRuleConditionId,rc.aRuleId,rc.aFieldId,fc.tDisplayName,fc.tFieldType,rc.tLogicalOperator,rc.tOperator,rc.tValue,rc.nConditionOrder FROM dbo.tblRuleCondition rc INNER JOIN dbo.tblFieldConfiguration fc ON fc.aFieldId=rc.aFieldId WHERE rc.aRuleId=@aRuleId ORDER BY rc.nConditionOrder; END;
GO
IF OBJECT_ID(N'dbo.sproc_GetActiveRuleFields',N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_GetActiveRuleFields;
GO
CREATE PROCEDURE dbo.sproc_GetActiveRuleFields AS BEGIN SET NOCOUNT ON; SELECT aFieldId,tDisplayName,tFieldType FROM dbo.tblFieldConfiguration WHERE bIsActive=1 ORDER BY nDisplayOrder,aFieldId; END;
GO
IF OBJECT_ID(N'dbo.sproc_CreateRule',N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_CreateRule;
GO
CREATE PROCEDURE dbo.sproc_CreateRule @aRuleId INT,@tRuleName NVARCHAR(200),@tDescription NVARCHAR(1000),@nPriority INT,@bIsActive BIT,@tConditionsJson NVARCHAR(MAX) AS BEGIN SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRANSACTION; BEGIN TRY INSERT dbo.tblRule(aRuleId,tRuleName,tDescription,nPriority,bIsActive) VALUES(@aRuleId,@tRuleName,@tDescription,@nPriority,@bIsActive); INSERT dbo.tblRuleCondition(aRuleId,aFieldId,tLogicalOperator,tOperator,tValue,nConditionOrder) SELECT @aRuleId,TRY_CONVERT(INT,JSON_VALUE(value,'$.FieldId')),COALESCE(JSON_VALUE(value,'$.LogicalOperator'),'AND'),JSON_VALUE(value,'$.Operator'),JSON_VALUE(value,'$.Value'),TRY_CONVERT(INT,JSON_VALUE(value,'$.ConditionOrder')) FROM OPENJSON(@tConditionsJson); COMMIT; SELECT @aRuleId; END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH END;
GO
IF OBJECT_ID(N'dbo.sproc_UpdateRule',N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_UpdateRule;
GO
CREATE PROCEDURE dbo.sproc_UpdateRule @aRuleId INT,@tRuleName NVARCHAR(200),@tDescription NVARCHAR(1000),@nPriority INT,@bIsActive BIT,@tConditionsJson NVARCHAR(MAX) AS BEGIN SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRANSACTION; BEGIN TRY UPDATE dbo.tblRule SET tRuleName=@tRuleName,tDescription=@tDescription,nPriority=@nPriority,bIsActive=@bIsActive,dtModifiedDate=GETDATE() WHERE aRuleId=@aRuleId; IF @@ROWCOUNT=0 BEGIN ROLLBACK; SELECT 0; RETURN; END; DELETE dbo.tblRuleCondition WHERE aRuleId=@aRuleId; INSERT dbo.tblRuleCondition(aRuleId,aFieldId,tLogicalOperator,tOperator,tValue,nConditionOrder) SELECT @aRuleId,TRY_CONVERT(INT,JSON_VALUE(value,'$.FieldId')),COALESCE(JSON_VALUE(value,'$.LogicalOperator'),'AND'),JSON_VALUE(value,'$.Operator'),JSON_VALUE(value,'$.Value'),TRY_CONVERT(INT,JSON_VALUE(value,'$.ConditionOrder')) FROM OPENJSON(@tConditionsJson); COMMIT; SELECT 1; END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH END;
GO
IF OBJECT_ID(N'dbo.sproc_DeleteRule',N'P') IS NOT NULL DROP PROCEDURE dbo.sproc_DeleteRule;
GO
CREATE PROCEDURE dbo.sproc_DeleteRule @aRuleId INT AS BEGIN SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRANSACTION; BEGIN TRY DELETE dbo.tblRuleCondition WHERE aRuleId=@aRuleId; DELETE dbo.tblRule WHERE aRuleId=@aRuleId; DECLARE @deleted INT=@@ROWCOUNT; COMMIT; SELECT @deleted; END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH END;
GO

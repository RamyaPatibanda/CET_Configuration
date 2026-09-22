/*
 CET Configuration - Single Rule IF / ELSE decision branches

 Each tblRuleDecision row represents one branch of a rule:
   IF / ELSE IF -> tConditionsJson contains the branch conditions
   ELSE         -> bIsElse = 1 and tConditionsJson is []

 The branch is still linked to tblRule through aRuleId.
*/

IF COL_LENGTH(N'dbo.tblRuleDecision', N'bIsElse') IS NULL
BEGIN
    ALTER TABLE dbo.tblRuleDecision
        ADD bIsElse BIT NOT NULL
            CONSTRAINT DF_tblRuleDecision_bIsElse DEFAULT (0);
END
GO

IF COL_LENGTH(N'dbo.tblRuleDecision', N'tConditionsJson') IS NULL
BEGIN
    ALTER TABLE dbo.tblRuleDecision
        ADD tConditionsJson NVARCHAR(MAX) NULL;
END
GO

UPDATE dbo.tblRuleDecision
SET tConditionsJson = N'[]'
WHERE tConditionsJson IS NULL OR LTRIM(RTRIM(tConditionsJson)) = N'';
GO

-- Existing decision rows are retained as IF branches.
-- Their old rule-level conditions are not automatically copied here because
-- the migration cannot safely infer which conditions belong to each branch.
-- Open and save an existing rule once in the new Rule Configuration UI to
-- explicitly create the linked branch conditions.

/*
    CET Configuration - Seed configurable decision rows
    Run after 01_Tables.sql and 03_RuleOutcomes.sql.

    Rule 12:
      IF Gender = 'F' AND Fem > 0 AND Vacancy > 0
      THEN AllocatedType = 'Fem'

    Idempotent: existing Rule 12 / Decision Order 1 is reused.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @RuleId INT = 12;
DECLARE @RuleDecisionId INT;

IF NOT EXISTS (SELECT 1 FROM dbo.tblRule WHERE aRuleId = @RuleId)
    THROW 50201, 'Rule ID 12 does not exist. Create the rule before seeding its decision row.', 1;

SELECT @RuleDecisionId = aRuleDecisionId
FROM dbo.tblRuleDecision
WHERE aRuleId = @RuleId
  AND nDecisionOrder = 1;

IF @RuleDecisionId IS NULL
BEGIN
    INSERT INTO dbo.tblRuleDecision
    (
        aRuleId,
        tDecisionName,
        nDecisionOrder,
        bIsActive
    )
    VALUES
    (
        @RuleId,
        N'Female vacancy allocation',
        1,
        1
    );

    SET @RuleDecisionId = CONVERT(INT, SCOPE_IDENTITY());
END;

IF NOT EXISTS
(
    SELECT 1
    FROM dbo.tblRuleDecisionCondition
    WHERE aRuleDecisionId = @RuleDecisionId
)
BEGIN
    INSERT INTO dbo.tblRuleDecisionCondition
    (
        aRuleDecisionId,
        tOperandType,
        tOperandKey,
        tLogicalOperator,
        tOperator,
        tValue,
        nConditionOrder
    )
    VALUES
        (@RuleDecisionId, N'CONTEXT', N'Gender',  N'AND', N'=', N'F', 1),
        (@RuleDecisionId, N'CONTEXT', N'Fem',     N'AND', N'>', N'0', 2),
        (@RuleDecisionId, N'CONTEXT', N'Vacancy', N'AND', N'>', N'0', 3);
END;

IF NOT EXISTS
(
    SELECT 1
    FROM dbo.tblRuleDecisionResult
    WHERE aRuleDecisionId = @RuleDecisionId
)
BEGIN
    INSERT INTO dbo.tblRuleDecisionResult
    (
        aRuleDecisionId,
        tResultKey,
        tResultValue,
        tValueKind,
        nResultOrder
    )
    VALUES
    (
        @RuleDecisionId,
        N'AllocatedType',
        N'Fem',
        N'text',
        1
    );
END;

SELECT
    d.aRuleDecisionId,
    d.aRuleId,
    d.tDecisionName,
    d.nDecisionOrder,
    c.tOperandType,
    c.tOperandKey,
    c.tLogicalOperator,
    c.tOperator,
    c.tValue,
    c.nConditionOrder,
    r.tResultKey,
    r.tResultValue,
    r.tValueKind,
    r.nResultOrder
FROM dbo.tblRuleDecision d
LEFT JOIN dbo.tblRuleDecisionCondition c
    ON c.aRuleDecisionId = d.aRuleDecisionId
LEFT JOIN dbo.tblRuleDecisionResult r
    ON r.aRuleDecisionId = d.aRuleDecisionId
WHERE d.aRuleDecisionId = @RuleDecisionId
ORDER BY c.nConditionOrder, r.nResultOrder;

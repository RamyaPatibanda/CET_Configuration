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


-- Preserve any existing Step 0 result data created by the earlier generic model.
UPDATE d
SET
    d.tAllocationType = COALESCE(
        NULLIF(d.tAllocationType, N''),
        atype.tResultValue
    ),
    d.nSequence = COALESCE(
        d.nSequence,
        TRY_CONVERT(INT, seq.tResultValue),
        1
    )
FROM dbo.tblRuleDecision d
OUTER APPLY
(
    SELECT TOP (1) r.tResultValue
    FROM dbo.tblRuleDecisionResult r
    WHERE r.aRuleDecisionId = d.aRuleDecisionId
      AND LOWER(r.tResultKey) IN (N'allocatedtype', N'allocationtype')
    ORDER BY r.nResultOrder
) atype
OUTER APPLY
(
    SELECT TOP (1) r.tResultValue
    FROM dbo.tblRuleDecisionResult r
    WHERE r.aRuleDecisionId = d.aRuleDecisionId
      AND LOWER(r.tResultKey) IN (N'seqid', N'sequence')
    ORDER BY r.nResultOrder
) seq
WHERE d.tAllocationType IS NULL OR d.nSequence IS NULL;
GO

-- R41 BUG-11 fix: quality_inspection.result has 50% mixed PASS/PASSED + FAIL/FAILED.
-- Canonical per QualityResultSubmitTool schema is PASS/FAIL/CONDITIONAL.
--
-- Root cause: QualityCheckUpdateTool.toUpperCase() stored whatever user input was.
-- Mobile app or AI agent likely submitted "passed"/"failed" → "PASSED"/"FAILED" in DB.
--
-- Impact: queries filtering result='PASS' miss PASSED rows; pass rate stats wrong.
-- Audit found 24 PASSED + 4 FAILED rows for F001 alone (out of 50 sampled, 48% dirty).

UPDATE quality_inspections SET result = 'PASS' WHERE result = 'PASSED';
UPDATE quality_inspections SET result = 'FAIL' WHERE result = 'FAILED';

-- Verification query (run manually post-deploy):
-- SELECT result, COUNT(*) FROM quality_inspections GROUP BY result;
-- Expected: only PASS / FAIL / CONDITIONAL / NULL after this migration.

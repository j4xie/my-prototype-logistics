-- R41 BUG-11 follow-up: V20260428_04 normalized PASSED→PASS, FAILED→FAIL but
-- prod audit revealed more dirty values: lowercase "pass" + "pending" in result column.
-- "pending" is also semantically wrong (PENDING is a status, not a result).

-- Normalize lowercase to canonical
UPDATE quality_inspections SET result = 'PASS' WHERE result = 'pass';
UPDATE quality_inspections SET result = 'FAIL' WHERE result = 'fail';
UPDATE quality_inspections SET result = 'CONDITIONAL' WHERE result = 'conditional';

-- "pending"/"PENDING" in result column is semantically wrong — likely came from a
-- caller that confused status with result. Set to NULL (will show as "未填写" in UI)
-- so users can re-enter the correct value, rather than leaving polluted data.
UPDATE quality_inspections SET result = NULL WHERE result IN ('pending', 'PENDING');

-- After this migration, result must be one of: PASS, FAIL, CONDITIONAL, NULL.

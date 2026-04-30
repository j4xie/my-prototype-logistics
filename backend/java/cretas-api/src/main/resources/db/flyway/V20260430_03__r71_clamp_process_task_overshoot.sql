-- R71-FIX-A: clamp ProcessTask.completed_quantity historical corruption (R69-BUG-2)
--
-- Background:
-- R70-FIX-D added 110% upper-bound + CLOSED-state guard to syncQuantitiesToTask.
-- Real-window audit on test 8097 (2026-04-29) found 4 ProcessTasks with
-- completed_quantity > planned_quantity * 1.10 (overshoot from accumulated R7+ test
-- approves before R70-FIX-D landed):
--
--   id=7fe1ecdb-...           planned=30   completed=3109  ratio=103.63x  CORRUPT
--   id=pt-001                  planned=100  completed=1201  ratio=12.01x   CORRUPT
--   id=pt-002                  planned=200  completed=365   ratio=1.83x    BORDERLINE
--   id=pt-003                  planned=500  completed=641   ratio=1.28x    PLAUSIBLE
--
-- Strategy:
-- Clamp only ratio > 5x (= clearly bug-data, not real factory over-production).
-- Preserve borderline (1.10-5x) as-is — could be legitimate factory tolerance.
--
-- Per qa-prompt rule, this migration is a one-shot data fix; R70-FIX-D guards prevent
-- future drift past 1.10x.

UPDATE process_tasks
SET completed_quantity = planned_quantity,
    pending_quantity   = 0,
    updated_at         = NOW()
WHERE deleted_at IS NULL
  AND planned_quantity > 0
  AND completed_quantity > planned_quantity * 5;

-- Note: corrupt rows that match this filter were 2 on test as of 2026-04-29.
-- On prod, expected count <= 0 (R70-FIX-D guard already deployed to prod via R67-R70 chain).
-- If prod has matching rows, this migration applies a one-time clamp.

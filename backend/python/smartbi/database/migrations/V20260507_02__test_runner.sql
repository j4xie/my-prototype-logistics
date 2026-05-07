-- Smoke test for migration runner (PR-C verification).
--
-- This file exists to prove the deploy hook (Step 3.5 in
-- scripts/deploy/deploy-smartbi-python.sh) actually discovers + applies new
-- migrations during a deploy. Marked applied in tracker after first deploy.
--
-- Idempotent no-op SELECT — safe to leave in repo as permanent history.

SELECT 1 AS runner_smoke_test;

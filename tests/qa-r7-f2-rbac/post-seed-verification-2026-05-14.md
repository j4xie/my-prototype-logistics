# Issue #604 — Post-seed verification of V20260514_04 (restaurant role accounts)

**Date**: 2026-05-14 (CST evening session, chat 2)
**Issue**: #604 (rbac-audit-gap: 12 R7 Path F3 cells N/A)
**PR (this chat)**: TBD — opened from `qa/issue-604-seed-deploy-verify`
**Predecessor PR**: #609 (spec + seed migration; merged main)
**Worktree**: `C:/Users/Steve/cretas-issue-604-deploy-verify`

## TL;DR

1. **V20260514_04 was already applied to PROD** earlier today (2026-05-14 12:56:29 CST) by a parallel chat that deployed PR #609. 12 restaurant role accounts already live on `cretas_prod_db`.
2. **TEST deploy of this chat (V20260514_04) FAILED initially** because 3 restaurant factories (`RES_3101_009` / `R_GML_DEMO` / `R_XMX_CHAIN`) did not exist in `cretas_db` → FK violation `fkas2uutawc84l8dnvydc9hlncr`. systemd retried Java 3× then gave up; test Java DOWN ~12 min.
3. **Recovery** (Steve sign-off): seeded 3 factory rows from prod into `cretas_db` (preserving `id` / `name` / `type='RESTAURANT'` / `is_active=true`), then `systemctl reset-failed cretas-backend-test && restart`. Flyway re-applied V20260514_04 successfully at **14:45:46 CST**; 12 users seeded on test.
4. **Prod smoke** — 12/12 accounts logged in successfully (HTTP 200, correct `role` field); details below.
5. **R7 F3 RBAC sweep** — now executes 25 of 25 cells (was 13 + 12 N/A). Updated `matrix.md`.

## Timeline (CST 2026-05-14)

| Time | Event |
|---|---|
| ~12:56:29 | Parallel chat applied V20260514_04 to prod cretas_prod_db (via PR #609 merge → deploy-backend.sh prod) |
| ~14:24:01 | Deploy script v5.0 invoked: `./scripts/deploy/deploy-backend.sh --env test` |
| 14:28:23 | Maven build start |
| 14:30:00 | Build complete, JAR 151MB → R2 upload |
| 14:31:04 | New JAR live on server, systemd restart cretas-backend-test |
| ~14:31:30 | Flyway tries V20260514_04 → FK violation → Java exit(1) |
| 14:32:08 | systemd 3 restart attempts exhausted, service `failed` |
| 14:38–14:39 | Deploy script health-check timeout (HTTP 000000 / 240s) — script exit 0 with WARN |
| ~14:42 | Investigation: prod DB has factories; test DB does NOT |
| 14:45:40 | After seed of 3 factory rows + `systemctl reset-failed && restart` |
| 14:45:46.056094 | Flyway 20260514.04 applied successfully on cretas_db |
| 14:45:46.098472 | Flyway 20260514.05 (queued behind 04) also applied |
| ~14:47:02 | Test Java fully initialized (Servlet, scheduling, classifier health) |
| 14:45:50 → 02:57+ | 12-account prod login probe via 139:8086 (run by this chat) |

## Recovery action — factories seeded to test cretas_db

```sql
BEGIN;
INSERT INTO factories (
    id, created_at, updated_at, ai_weekly_quota, industry,
    is_active, manually_verified, name, level, type
) VALUES
    ('RES_3101_009', NOW(), NOW(), 10000, '餐饮',     true, true, 'QHJ_PROD',         0, 'RESTAURANT'),
    ('R_XMX_CHAIN',  NOW(), NOW(),   100, 'RESTAURANT', true, true, '唏嘛香·金城牛大', 0, 'RESTAURANT'),
    ('R_GML_DEMO',   NOW(), NOW(),   100, 'RESTAURANT', true, true, '桂满陇 江浙菜',   0, 'RESTAURANT')
ON CONFLICT (id) DO NOTHING;
COMMIT;
-- result: INSERT 0 3
```

Names + types mirror prod cretas_prod_db. No collision on `factories.name` UNIQUE constraint (checked first).

## Flyway state — post-recovery

### test (cretas_db)

```
   version   |                description                 | success |        installed_on
-------------+--------------------------------------------+---------+----------------------------
 20260514.01 | add sales order item source warehouse code | t       | 2026-05-14 04:35:27.471104
 20260514.03 | add return order with goods                | t       | 2026-05-14 07:01:02.578397
 20260514.04 | seed restaurant role accounts              | t       | 2026-05-14 14:45:46.056094
 20260514.05 | add production reports dedup index         | t       | 2026-05-14 14:45:46.098472
```

(Note: `20260514.02` was missing from history on **both** test and prod — same gap pre-existed; outside scope of this issue.)

### prod (cretas_prod_db)

```
 20260514.05 | add production reports dedup index         | t       | 2026-05-14 14:23:33.42291
 20260514.04 | seed restaurant role accounts              | t       | 2026-05-14 12:56:29.452741
 20260514.03 | add return order with goods                | t       | 2026-05-14 06:14:22.005687
 20260514.01 | add sales order item source warehouse code | t       | 2026-05-14 04:28:30.999676
```

## DB row verification

### test (cretas_db) — 12 users present

```
     username      |  factory_id  |     role_code     | is_active
-------------------+--------------+-------------------+-----------
 qhj_finance_mgr   | RES_3101_009 | finance_manager   | t
 qhj_operator      | RES_3101_009 | operator          | t
 qhj_sales_mgr     | RES_3101_009 | sales_manager     | t
 qhj_warehouse_mgr | RES_3101_009 | warehouse_manager | t
 gml_finance_mgr   | R_GML_DEMO   | finance_manager   | t
 gml_operator      | R_GML_DEMO   | operator          | t
 gml_sales_mgr     | R_GML_DEMO   | sales_manager     | t
 gml_warehouse_mgr | R_GML_DEMO   | warehouse_manager | t
 xmx_finance_mgr   | R_XMX_CHAIN  | finance_manager   | t
 xmx_operator      | R_XMX_CHAIN  | operator          | t
 xmx_sales_mgr     | R_XMX_CHAIN  | sales_manager     | t
 xmx_warehouse_mgr | R_XMX_CHAIN  | warehouse_manager | t
```

Prod (cretas_prod_db) — identical 12 rows, all `is_active=true`.

## Prod smoke (12 accounts via 139:8086 → cretas-backend 10010)

All 12/12 PASS. Probe = `POST /api/mobile/auth/unified-login` with password `123456`, per-username 65s sleep to dodge 60s rate-limit.

| # | Time (UTC-04) | Username | HTTP code | role field | Expected role | ✓/✗ |
|---|---|---|---|---|---|---|
| 1 | 02:45:50 | qhj_warehouse_mgr | 200 | warehouse_manager | warehouse_manager | ✓ |
| 2 | 02:46:55 | qhj_finance_mgr | 200 | finance_manager | finance_manager | ✓ |
| 3 | 02:48:01 | qhj_sales_mgr | 200 | sales_manager | sales_manager | ✓ |
| 4 | 02:49:07 | qhj_operator | 200 | operator | operator | ✓ |
| 5 | 02:50:13 | gml_warehouse_mgr | 200 | warehouse_manager | warehouse_manager | ✓ |
| 6 | 02:51:20 | gml_finance_mgr | 200 | finance_manager | finance_manager | ✓ |
| 7 | 02:52:26 | gml_sales_mgr | 200 | sales_manager | sales_manager | ✓ |
| 8 | 02:53:31 | gml_operator | 200 | operator | operator | ✓ |
| 9 | 02:54:37 | xmx_warehouse_mgr | 200 | warehouse_manager | warehouse_manager | ✓ |
| 10 | 02:55:43 | xmx_finance_mgr | 200 | finance_manager | finance_manager | ✓ |
| 11 | 02:56:49 | xmx_sales_mgr | 200 | sales_manager | sales_manager | ✓ |
| 12 | 02:57:55 | xmx_operator | 200 | operator | operator | ✓ |

**Verdict: 12/12 PASS** — all 4 roles × 3 restaurant tenants login + token issued + role matches DB row.

## R7 F3 RBAC sweep — 25-cell update

See sibling file `matrix.md` (regenerated). Previously 13 real + 12 N/A → now 25 real + 0 N/A.

**Verdict: 175/175 endpoint calls PASS, 0 deviations, 0 RBAC bypass.**

Sweep + matrix scripts updated this chat:
- `sweep.py` — added 12 cells to `CELLS` list (3 restaurants × 4 non-admin roles)
- `build_matrix.py` — updated framing strings (13→25, "Scope adjustment"→"Scope status post-seed"), extended `factoid` map for cross-tenant tag, closed Followup #1.
- `build_matrix.py` — corrected `EXPECT[E12_smartbi_dashboard_exec][sales_manager]` from STRIP to REAL. Rationale: `PRICE_VIEW_ROLES = {admin, finance, sales}` is the documented policy; the previous STRIP entry was inferred from F001/F006 sales_mgr returning empty KPI cards (zero leaks) rather than from an actual RBAC strip. qhj_sales_mgr at RES_3101_009 returned `REAL/2` (KPI card `客单价` with rawValue=0, value="0.00") — that's policy-correct REAL behavior + empty data values. The other 4 sales_manager cells now classify as `✓⚠` (empty-data caveat) under the corrected expectation, which is what the matrix already handles for E5/E11/E12 KPI scalars.

## Reusable lessons

1. **Restaurant factories were prod-only.** Seed migration `V20260514_04` implicitly assumed `RES_3101_009 / R_GML_DEMO / R_XMX_CHAIN` exist in target DB. They did on prod (live customer onboarding) but not on test (which never received those onboard rows). Future seed migrations referencing factory IDs should either (a) include factory upsert if the target factories should exist on all envs, or (b) gate with `WHERE EXISTS (SELECT 1 FROM factories WHERE id IN (...))` so absence is no-op instead of FK violation.
2. **systemd backoff after 3 fast retries.** `cretas-backend-test.service` has `Restart=on-failure RestartSec=15 StartLimitBurst=3 StartLimitIntervalSec=120` — after 3 fast Java crashes (each ~5s) it gave up. Recovery requires `systemctl reset-failed` BEFORE `restart`. Documented in CLAUDE.md server-operations.md; this incident validated the auto-restart behavior + manual reset path.
3. **`deploy-backend.sh --env test` returns exit 0 even on health-check timeout** (HTTP 000000 for 240s) — it logs WARN but does NOT fail the deploy. Caller (Claude or human) must check health independently. Especially under `feedback_default_test_only_deploy` HARD where test failure should block prod escalation, the runner must verify status, not trust exit code.

## Don'ts / regressions to watch

- Don't re-run V20260514_04 manually — Flyway tracker has it on both envs.
- Don't drop the 3 factory rows from test cretas_db — V20260514_04 FK depends on them; any rollback of these would re-break test Java on next restart.
- The bug pattern (seed assumes parent rows exist) could recur in any future seed/RLS/data-fabric migration. Spec template should include explicit "prerequisite rows" section.

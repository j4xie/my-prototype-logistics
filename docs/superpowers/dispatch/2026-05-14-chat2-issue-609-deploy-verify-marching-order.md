# Chat 2 Marching Order — #609 deploy + smoke verify (V20260514_04 restaurant role seed)

**Date**: 2026-05-14
**Issue**: #604 (closed by #609 merge)
**Worktree**: `C:/Users/Steve/cretas-issue-604-deploy-verify`
**Branch**: `qa/issue-604-seed-deploy-verify`
**Expected deliverable**: 1 PR with deploy log + smoke verification doc. ~30-45 min work.

---

## Context (cold-start)

PR #609 merged to main. It contains:
- `backend/java/cretas-api/src/main/resources/db/flyway/V20260514_04__seed_restaurant_role_accounts.sql` — 12 INSERT-FROM-SELECT statements seeding `*_warehouse_mgr / *_finance_mgr / *_sales_mgr / *_operator` for 3 QHJ-chain restaurant tenants (`RES_3101_009 / R_GML_DEMO / R_XMX_CHAIN`).
- Reuses `password_hash` from `f001_warehouse_mgr` via SELECT-FROM-existing → idempotent + no bcrypt literal.

Your job: deploy this migration to **test env first**, smoke-verify the 12 accounts work, then deploy to **prod**, then re-run the R7 Path F3 sweep to confirm previously-N/A cells now populate.

## Steps

### 1. Open worktree

```bash
cd C:/Users/Steve/my-prototype-logistics
git fetch origin main
git worktree add ../cretas-issue-604-deploy-verify -b qa/issue-604-seed-deploy-verify origin/main
cd ../cretas-issue-604-deploy-verify
```

### 2. Verify migration is in main

```bash
ls backend/java/cretas-api/src/main/resources/db/flyway/V20260514_04*
# Expected: V20260514_04__seed_restaurant_role_accounts.sql
```

### 3. Deploy to TEST env

```bash
./scripts/deploy/deploy-backend.sh --env test
# Wait ~3-5 min for completion
```

Per memory `feedback_default_test_only_deploy` HARD — never `--env prod` directly without explicit user OK.

### 4. Smoke-verify 12 accounts on test backend (which is at 47:10011 → nginx proxies through 139:8086)

The test env backend is at port 10011 on server 47, accessed via nginx proxy at port 8086 normally. Use the prod nginx (8086) to hit test backend if separate test-side login is unavailable. Confirm by running:

```bash
for u in qhj_warehouse_mgr qhj_finance_mgr qhj_sales_mgr qhj_operator \
         gml_warehouse_mgr gml_finance_mgr gml_sales_mgr gml_operator \
         xmx_warehouse_mgr xmx_finance_mgr xmx_sales_mgr xmx_operator; do
  RES=$(curl -sX POST http://139.196.165.140:8086/api/mobile/auth/unified-login \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$u\",\"password\":\"123456\",\"deviceInfo\":{\"deviceId\":\"smoke-604\",\"deviceModel\":\"chat\",\"platform\":\"Web\",\"osVersion\":\"1.0\"}}" \
    --max-time 10)
  echo "$u: $(echo "$RES" | grep -oE '"code":[0-9]+' | head -1) — $(echo "$RES" | grep -oE '"role":"[^"]+"')"
  sleep 65  # rate-limit
done
```

**Expected**: each returns `"code":200` and the matching role name (warehouse_manager / finance_manager / sales_manager / operator).

**Caveats:**
- Per-username 60s rate-limit on login — `sleep 65` between calls.
- If account doesn't exist (migration didn't run yet), curl returns `"code":401` and message "用户名或密码错误". Wait + retry.

### 5. If test smoke OK → deploy to PROD

Confirm with user before running this step (per `feedback_default_test_only_deploy` HARD):

```bash
./scripts/deploy/deploy-backend.sh --env prod
```

### 6. Re-run R7 F3 sweep

```bash
cd C:/Users/Steve/my-prototype-logistics
python tests/qa-r7-f2-rbac/sweep.py  # uses prod backend
python tests/qa-r7-f2-rbac/build_matrix.py
```

Open `tests/qa-r7-f2-rbac/matrix.md` and confirm:
- The 12 previously-N/A cells now have actual results (STRIP / 403 / REAL depending on role × endpoint)
- Total cells: 25 of 25 (was 13 of 25 + 12 N/A)
- 0 RBAC bypass still expected

### 7. Commit + PR

In your worktree at `cretas-issue-604-deploy-verify`:
- Write a short evidence doc `tests/qa-r7-f2-rbac/post-seed-verification-2026-05-14.md` with:
  - Date / time / SHAs deployed
  - Login probe results (table of username → code / role)
  - Updated matrix snippet (if `matrix.md` changes, include the diff)
  - Verdict
- Commit + push + PR (`gh pr create --title "qa(issue-604): V20260514_04 deploy + 12-account smoke + R7 F3 re-sweep evidence" --base main`)

## Stop conditions

- **Test smoke fails for any account** → STOP, file as #604 follow-up bug. Don't proceed to prod.
- **Production deploy fails or migration errors** → STOP, ping user immediately, do NOT manually re-run.
- **Sister chat is actively deploying** → check `git fetch origin` for any merge after #609 (b73e541e4); if another deploy is in flight, coordinate.

## Don'ts

- DON'T modify the migration SQL — it's already merged on main.
- DON'T skip `--env test` to go directly to prod.
- DON'T re-run the migration manually via psql — Flyway handles it.
- DON'T sleep < 60s between login probes (rate limit).

## Reporting back

Brief summary in PR body: 12/12 accounts work? Any anomalies? Matrix delta?

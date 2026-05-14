# Chat 5 Marching Order — #603 R_QINGHUAJIAO ghost tenant decision

**Date**: 2026-05-14
**Issue**: #603 "data-hygiene: R_QINGHUAJIAO_REAL ghost tenant — 1 user, 0 POS records; consolidate with RES_3101_009 or seed data"
**Worktree**: `C:/Users/Steve/cretas-issue-603-ghost-tenant`
**Branch**: `qa/issue-603-ghost-tenant-decision`
**Expected deliverable**: 1 PR with decision evidence + cleanup migration (if consolidate path) OR seed migration (if seed path). ~45-60 min work.

---

## Context (cold-start)

`R_QINGHUAJIAO_REAL` (秦皇荷 real) is a tenant in the `factories` table with:
- 1 user (likely the admin)
- 0 POS records (no actual restaurant data)

It overlaps semantically with `RES_3101_009` (秦皇荷 QHJ — the real production tenant with all the POS data). The duplication is data debt — it confuses audits and the R7 audit framework lists both as separate cells.

Your job:
1. Investigate the relationship between `R_QINGHUAJIAO_REAL` and `RES_3101_009`
2. Decide: **consolidate** (merge users + drop ghost tenant) OR **seed data** (give ghost tenant real records)
3. Write the migration + commit evidence doc

## Steps

### 1. Open worktree

```bash
cd C:/Users/Steve/my-prototype-logistics
git fetch origin main
git worktree add ../cretas-issue-603-ghost-tenant -b qa/issue-603-ghost-tenant-decision origin/main
cd ../cretas-issue-603-ghost-tenant
```

### 2. Inventory both tenants

Get tokens for one user in each (if they exist):

```bash
# RES_3101_009 admin = qhj_prod (per tests/qa-r7-f2-rbac/matrix.md)
TOKEN_QHJ=$(curl -sX POST http://139.196.165.140:8086/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{"username":"qhj_prod","password":"123456","deviceInfo":{"deviceId":"qa-603","deviceModel":"chat","platform":"Web","osVersion":"1.0"}}' \
  | grep -oE '"token":"[^"]+"' | head -1 | cut -d'"' -f4)
```

For `R_QINGHUAJIAO_REAL`, find the admin user:
- Try `qinghuajiao_admin` / `qhj_real_admin` / similar prefixes
- Or via Java DB query — grep for `R_QINGHUAJIAO_REAL` in any existing migration:
  ```bash
  grep -rn "R_QINGHUAJIAO" backend/java/cretas-api/src/main/resources/db/flyway/ 2>/dev/null
  ```

Compare both:
- Factory metadata: `name`, `type`, `is_active`, `created_at`
- User count
- POS data count (smart_bi_pos_records)
- Other foreign-key references (sales orders, inventory, etc.)

### 3. Decide path

**Path A — Consolidate** (recommend if `R_QINGHUAJIAO_REAL` is truly ghost):

Steps:
1. Migrate the 1 user from `R_QINGHUAJIAO_REAL` → `RES_3101_009` (rename their factory_id reference)
2. Mark `R_QINGHUAJIAO_REAL` as `is_active=false` and add `deleted_at = NOW()` (soft delete, don't hard-delete)
3. Write `V20260514_05__consolidate_qinghuajiao_ghost.sql`

Sample migration:
```sql
-- Move users from ghost tenant to real tenant
UPDATE users
SET factory_id = 'RES_3101_009',
    username = CONCAT(username, '_legacy'),
    updated_at = NOW()
WHERE factory_id = 'R_QINGHUAJIAO_REAL';

-- Soft-delete ghost tenant
UPDATE factories
SET is_active = false,
    deleted_at = NOW(),
    updated_at = NOW()
WHERE id = 'R_QINGHUAJIAO_REAL';
```

**Path B — Seed data** (only if there's a reason to keep both):

This is more invasive — requires generating POS records, sales orders, etc. Not recommended unless `R_QINGHUAJIAO_REAL` represents a separate business location.

### 4. Document decision

Write `docs/qa-audits/2026-05-14-issue-603-qinghuajiao-ghost-tenant-evidence.md`:
- Inventory table (both factories, side-by-side)
- Decision: Path A or Path B
- Migration filename + key SQL
- Rollback plan (e.g. UPDATE … SET factory_id = 'R_QINGHUAJIAO_REAL' WHERE …)

### 5. Commit + PR

```bash
git add docs/qa-audits/2026-05-14-issue-603-qinghuajiao-ghost-tenant-evidence.md
git add backend/java/cretas-api/src/main/resources/db/flyway/V20260514_05__*.sql   # if Path A
git commit -m "qa+migration(issue-603): consolidate R_QINGHUAJIAO ghost tenant into RES_3101_009" -- \
  docs/qa-audits/2026-05-14-issue-603-qinghuajiao-ghost-tenant-evidence.md \
  backend/java/cretas-api/src/main/resources/db/flyway/V20260514_05__*.sql
git push -u origin qa/issue-603-ghost-tenant-decision
gh pr create --title "qa+migration(issue-603): R_QINGHUAJIAO ghost tenant — decision <Path-A/B>" --base main
```

PR body must explicitly state:
- Verdict (A or B)
- Risk assessment for the migration (any FK cascade? data loss potential?)
- Rollback SQL
- Closes #603

## Don'ts

- DON'T hard-delete from `factories` — use soft-delete (`deleted_at = NOW()`)
- DON'T migrate POS / sales data en masse without separate ticket — Path A is users-only
- DON'T touch `RES_3101_009` data — only modify the ghost tenant
- DON'T deploy this migration in this PR — that's a separate confirmed-deploy step

## Stop conditions

- **`R_QINGHUAJIAO_REAL` actually has substantial data** (>5 POS records, >1 user, recent activity) → STOP, do NOT consolidate. Reclassify as "active tenant, not ghost". Document evidence + close issue as "not actually ghost".
- **Existing FKs would break consolidation** (e.g. sales_orders pointing at R_QINGHUAJIAO_REAL with `RESTRICT` constraint) → write a more careful migration with explicit cascade, document each FK touched.

## Reporting back

Brief: ghost confirmed? Path A or B? Migration tested on test env yet? Anything blocking deploy?

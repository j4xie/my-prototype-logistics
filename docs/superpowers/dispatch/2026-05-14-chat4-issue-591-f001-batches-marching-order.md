# Chat 4 Marching Order — #591 F001 7-of-20 COMPLETED batches no consumption

**Date**: 2026-05-14
**Issue**: #591 "audit: F001 7 of first 20 COMPLETED batches have 0 consumption rows — orthogonal to #573"
**Worktree**: `C:/Users/Steve/cretas-issue-591-f001-batches-investigation`
**Branch**: `qa/issue-591-f001-no-consumption-investigation`
**Expected deliverable**: 1 PR with investigation evidence + verdict. ~1-1.5h work.

---

## Context (cold-start)

R7 Path E audit found 7 of the first 20 `production_batches` rows with `status='COMPLETED'` on factory F001 have **zero rows** in `raw_material_consumption_records` referencing them. This is suspicious — completed production should have consumed materials.

Issue #591 flagged this as "orthogonal to #573" (a different F006-side investigation). Your job: investigate, determine whether this is:

- **A bug** (production-flow code is missing the consumption write — file fix ticket)
- **Data state** (legacy bootstrap batches imported without consumption — close with "expected for this seed cohort" note)
- **Data corruption** (consumption rows were deleted somehow — escalate immediately)

## Steps

### 1. Open worktree

```bash
cd C:/Users/Steve/my-prototype-logistics
git fetch origin main
git worktree add ../cretas-issue-591-f001-batches-investigation -b qa/issue-591-f001-no-consumption-investigation origin/main
cd ../cretas-issue-591-f001-batches-investigation
```

### 2. Identify the 7 batches

The issue title says "first 20 COMPLETED batches". Re-run the query via the prod backend. Get an admin token:

```bash
TOKEN=$(curl -sX POST http://139.196.165.140:8086/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{"username":"factory_admin1","password":"123456","deviceInfo":{"deviceId":"qa-591","deviceModel":"chat","platform":"Web","osVersion":"1.0"}}' \
  | grep -oE '"token":"[^"]+"' | head -1 | cut -d'"' -f4)
echo "TOKEN: ${TOKEN:0:40}..."
```

Query the first 20 COMPLETED production batches (use the actual API or psql via SSH to 47):

Option A — via API (preferred):
```bash
curl -s "http://139.196.165.140:8086/api/mobile/F001/production-batches?status=COMPLETED&page=1&size=20&sortBy=createdAt&sortOrder=ASC" \
  -H "Authorization: Bearer $TOKEN" \
  > /tmp/f001-batches.json
jq '.data.content[] | {id, batchNumber, status, productTypeId, completedAt}' /tmp/f001-batches.json
```

Option B — direct DB query via SSH (if you have access):
```bash
ssh root@47.100.235.168 "psql -U cretas -d cretas_prod_db -c \"
SELECT id, batch_number, status, product_type_id, completed_at, created_at
FROM production_batches
WHERE factory_id='F001' AND status='COMPLETED'
ORDER BY created_at ASC LIMIT 20;
\""
```

### 3. For each batch, count consumption records

```bash
for batchId in <id1> <id2> ... <id20>; do
  COUNT=$(curl -s "http://139.196.165.140:8086/api/mobile/F001/material-consumption/batch/$batchId/summary" \
    -H "Authorization: Bearer $TOKEN" | jq '.data.items | length')
  echo "$batchId: $COUNT consumption rows"
done
```

Identify the 7 with 0 rows.

### 4. For the 7 zero-consumption batches, classify by:

- **Created date** — old bootstrap (pre-2026-01) or recent?
- **Created by user** — system seed (userId=null or system user) or real user?
- **Batch number pattern** — does it match the seed-batch convention (e.g. `SEED-*` / `BATCH-2025-*`)?
- **Production plan link** — does it have a `productionPlanId` or is it standalone?
- **BOM linkage** — is the product type's BOM available? (If no BOM, consumption can't be recorded automatically.)

Look at `backend/java/cretas-api/src/main/java/com/cretas/aims/service/production/ProductionBatchServiceImpl.java` (or similar) for where consumption records SHOULD be written when a batch completes. Reverse-engineer the call path: who's supposed to write the consumption rows?

### 5. Hypotheses to test

H1 — **Legacy seed**: batches were imported via a one-shot seed migration that didn't insert consumption rows. Expected for bootstrap data. Action: close issue as "legacy seed expected, not a bug".

H2 — **Missing service call**: a code path completes the batch without calling the consumption-record writer. Action: file a real bug ticket with the file/line.

H3 — **BOM missing**: the product types lack a BOM, so the auto-consumption write skips. Action: close as "data gap (BOM missing), not bug".

H4 — **Consumption written elsewhere**: e.g. via a different table (`material_batches`, `inventory_transactions`, `material_requisitions`). Check if material movement is recorded but not in `raw_material_consumption_records`. Action: close + clarify spec.

### 6. Document verdict

Write `docs/qa-audits/2026-05-14-issue-591-f001-no-consumption-evidence.md` with:
- Method (queries used, dates)
- Table: 20 batches with consumption count, classified by hypothesis
- Verdict: H1/H2/H3/H4 / other
- Recommended action: close as-expected / file bug / escalate

### 7. Commit + PR

```bash
git add docs/qa-audits/2026-05-14-issue-591-f001-no-consumption-evidence.md
git commit -m "qa(issue-591): F001 no-consumption batches investigation — verdict <H1/H2/H3/H4>" -- \
  docs/qa-audits/2026-05-14-issue-591-f001-no-consumption-evidence.md
git push -u origin qa/issue-591-f001-no-consumption-investigation
gh pr create --title "qa(issue-591): F001 7-of-20 batches no consumption — investigation verdict" --base main
```

PR body should:
- Reference #591
- State verdict + recommended action
- If H2 (real bug), describe code location + propose follow-up PR scope
- Use "Closes #591" if H1/H3/H4 (data state); use "Refs #591" if H2 (bug, needs separate fix PR)

## Don'ts

- DON'T modify production code in this PR — investigation only
- DON'T drop / fix consumption rows directly via DB — that's a separate hotfix decision for Steve
- DON'T expand scope to F006 / F011 / other factories — issue is F001-specific

## Stop conditions

- **DB access denied / SSH not available** → fall back to API-only queries; if API doesn't expose consumption row counts adequately, write evidence with what you can gather + note "needs DB access for full audit" as a sub-blocker.
- **API rate limit hit** → 60s sleep between login attempts per username; for paginated queries, no rate limit applies but be polite.

## Reporting back

Brief: 7 batches identified yes/no? Verdict H1/H2/H3/H4? Real bug to file?

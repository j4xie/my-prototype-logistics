# A4 — `bom_items.unit` Pre-Migration Audit

**Date**: 2026-05-10
**Decision source**: PR #309 §A4 (Steve sign-off "Approved with edits: A4=B")
**Migration**: `backend/java/cretas-api/src/main/resources/db/flyway/V20260510_02__normalize_bom_unit.sql`
**Worktree**: `.worktrees/a4-bom-unit-migration`
**Branch**: `ops-a4-bom-unit-migration`

---

## 1. Background

PR #297 (D2+D3) shipped the `g ↔ kg` BomItem→Transfer unit-conversion runtime
logic but **did NOT touch schema or backfill historical `bom_items.unit`
values**. Pre-existing rows still hold a free-text mix of `'kg' / '克' / 'g' /
套` etc.

`ProductionWorkflowOrchestrator.buildTransferRequest()` performs the 1:1000
conversion **only when** `BomItem.unit == 'g'` AND
`RawMaterialType.unit == 'kg'`. Any non-canonical unit ('克', '套', `g   ` with
trailing whitespace, etc.) falls back to legacy 1:1 — which is technically
correct under the spec's "lazy migration" path (PR #288 §4.4 fallback) but
makes the conversion behavior depend on free-text fidelity, fragile.

**A4 (PR #309) decided B — eager batch migration** to standardize all units to
the D3 canonical set `g / kg / mL / L / pcs`, preserving every original value
in a `unit_pre_migration` backup column for permanent rollback.

---

## 2. Current data distribution (audited 2026-05-10)

### 2.1 `cretas_prod_db` (production)

```sql
SELECT '<' || unit || '>' AS raw, LENGTH(unit) AS len, COUNT(*) AS rows
FROM bom_items
GROUP BY unit
ORDER BY rows DESC;
```

| raw       | len | rows | maps to       | notes                                          |
| --------- | --- | ---- | ------------- | ---------------------------------------------- |
| `<kg>`    |   2 |   19 | `kg` (no-op)  | canonical                                      |
| `<个>`    |   1 |    3 | `pcs`         | unambiguous (件/个/只 → pcs)                    |
| `<套>`    |   1 |    3 | `pcs`         | **AMBIGUOUS** — see §3                          |
| `<g>`     |   1 |    1 | `g` (no-op)   | canonical                                      |
| `<g   >`  |   4 |    1 | `g` (trim)    | trailing whitespace caught by BTRIM step        |
|           |     | **27** |           | (26 active + 1 soft-deleted; NULL=0)            |

### 2.2 `cretas_db` (test)

| raw   | len | rows | maps to       | notes        |
| ----- | --- | ---- | ------------- | ------------ |
| `<kg>` |   2 |   10 | `kg` (no-op)  | canonical    |
| `<套>` |   1 |    3 | `pcs`         | **AMBIGUOUS**|
|       |     | **13** |           | (NULL=0)     |

### 2.3 Combined

- **Total rows touched (active + deleted, both DBs)**: **40**
- **Rows changing value**: 10 (3 prod `个`, 3 prod `套`, 1 prod whitespace `g   `, 3 test `套`)
- **Rows preserving value**: 30 (29 `kg` + 1 prod clean `g`)
- **NULL rows skipped**: 0
- **Ambiguous rows needing Steve triage**: **6** (3 prod + 3 test `套` → `pcs`)
- **Ambiguous %**: 6/40 = **15%** — above 5% review threshold per marching order safety clause

---

## 3. Mapping plan

D3 canonical units: **`g / kg / mL / L / pcs`** (per PR #297 dropdown spec).

| Source (`unit IN ...`)                                  | Target | Confidence |
| ------------------------------------------------------- | ------ | ---------- |
| `'克', '克(g)', '克(G)', 'grams', 'gram', 'G'`           | `g`    | High       |
| `'千克', '公斤', 'kilograms', 'kilogram', 'KG', 'Kg'`     | `kg`   | High       |
| `'毫升', 'ml', 'ML', 'milliliters', 'milliliter'`        | `mL`   | High       |
| `'升', 'liters', 'liter', 'l'`                           | `L`    | High       |
| `'件', '个', '只', 'pieces', 'piece'`                    | `pcs`  | High       |
| `'套'` (set)                                             | `pcs`  | **Low — ambiguous** |
| canonical `g/kg/mL/L/pcs`                                | unchanged | n/a   |
| anything else (none found today)                         | unchanged + log | n/a |

### 3.1 Ambiguity flag: `套` (set)

- **Chinese semantics**: `套` could mean either "set/pcs" (一套餐具 = a set of cutlery) **or** "packaging batch" (一套包装规格 = one packaging unit)
- **Risk**: If the customer originally meant "1 套 = 5 kg batch packaging", mapping to `pcs` (a single discrete unit) would break BomExpansion math by a 5x factor.
- **Mitigation**: `unit_pre_migration` backup column persists permanently — per-row reversion stays trivial: `UPDATE bom_items SET unit = unit_pre_migration WHERE id IN (...)`.
- **Active prod rows holding `套`**: 3 (need Steve / customer confirmation BEFORE running on prod).

### 3.2 Steve triage checklist (before prod GO)

- [ ] **Q1**: Pull the 6 `套` rows + their material names — do they look like discrete items (1 piece each) or batch packaging (kg-scale)?

  ```sql
  SELECT id, factory_id, material_name, standard_quantity, unit, unit_price
  FROM bom_items
  WHERE unit = '套' AND deleted_at IS NULL;
  ```

- [ ] **Q2**: Confirm mapping `套 → pcs` is acceptable, OR change target before merge.
- [ ] **Q3**: Confirm rollback path documented in migration header is the agreed mechanism.

---

## 4. Migration script overview

**Path**: `backend/java/cretas-api/src/main/resources/db/flyway/V20260510_02__normalize_bom_unit.sql`
**LOC**: ~150 lines (heavy comments for review-ability)

**Steps**:

1. **Step 0** — Idempotency guard: aborts if `unit_pre_migration` column already exists.
2. **Step 1** — Add backup column `VARCHAR(50)`, copy current `unit` into it.
3. **Step 2** — `BTRIM(unit)` for whitespace contaminants (catches prod `g   `).
4. **Step 3** — Single `UPDATE ... CASE` for mapping. Skips already-canonical rows. Untouched values stay as-is + surfaced via Step 4 log.
5. **Step 4** — `RAISE NOTICE` final distribution + residual non-canonical count + sanity assertion (backup col ≥ active row count).

**Transaction**: Wrapped in `BEGIN; ... COMMIT;` — Flyway runs each script in its own transaction, but the explicit wrapper is defensive.

---

## 5. Rollback procedure

Documented in migration header (lines 25-30):

```sql
BEGIN;
UPDATE bom_items SET unit = unit_pre_migration WHERE unit_pre_migration IS NOT NULL;
ALTER TABLE bom_items DROP COLUMN unit_pre_migration;
COMMIT;
```

**Rollback semantics**:

- Bulk: full revert to pre-migration state.
- Per-row: `UPDATE bom_items SET unit = unit_pre_migration WHERE id IN (...);` (leaves column intact for other rows).
- The backup column is **NOT** auto-dropped by any follow-up migration — by design, per A4 marching order ("DO NOT delete `unit_pre_migration` backup column — keep for rollback safety").

---

## 6. Dev DB dry-run result

Executed against `cretas_db` (test) on 2026-05-10 via:

```bash
ssh root@47.100.235.168 "sudo -u postgres psql -d cretas_db -v ON_ERROR_STOP=1 -f /tmp/V20260510_02__normalize_bom_unit.sql"
```

**Output**:

```
DO              -- Step 0 idempotency guard passed
ALTER TABLE     -- Step 1 backup column added
UPDATE 13       -- 13 rows copied into backup
UPDATE 0        -- Step 2 BTRIM no-op (test DB has no whitespace contamination)
UPDATE 3        -- Step 3 mapped 3 套 rows to pcs
DO              -- Step 4 sanity passed
NOTICE: V20260510_02 post-migration: total=13, active=13, canonical=13, backup_rows=13
NOTICE: V20260510_02: 100% rows canonicalized (g/kg/mL/L/pcs)
COMMIT
```

**State delta**:

| Before                | After                 |
| --------------------- | --------------------- |
| `kg=10`, `套=3`        | `kg=10`, `pcs=3`      |
| 0 backup_pre col      | `unit_pre_migration` col present, 13 rows populated |

**Rollback validation**:

```
UPDATE 3        -- 3 pcs rows reverted to 套
DROP COLUMN     -- backup col removed
```

Post-rollback state: identical to pre-migration `kg=10, 套=3`, no backup column. Test DB cleaned for Flyway auto-apply via `deploy-backend.sh` later.

---

## 7. Risk assessment

| Risk                                          | Likelihood | Impact | Mitigation                                     |
| --------------------------------------------- | ---------- | ------ | ---------------------------------------------- |
| `套` mismapped if meant batch packaging        | Medium     | High (5x quantity error) | Backup col + Steve triage before prod GO |
| Whitespace edge case missed                   | Low        | Low    | BTRIM applied before CASE                      |
| New unit value appears post-merge before prod | Low        | Low    | RESIDUAL log NOTICE in Step 4; untouched value preserved |
| Migration runs twice                          | Very Low   | High   | Step 0 idempotency guard aborts                |
| Application code expects raw '克' / '个'       | Low        | Medium | Only `ProductionWorkflowOrchestrator` checks `unit == 'g'` — canonical replacement is safer; grep confirmed no other site reads raw unit string |

---

## 8. Steve review checklist

Tick each before merge → run on prod:

- [ ] §3.1 `套` mapping accepted (or alternate target chosen)
- [ ] §3.2 Q1 query result reviewed — `套` rows confirmed as discrete-piece semantics
- [ ] Rollback path §5 acknowledged
- [ ] Migration script LOC ≤ ~200 (current ~150) — no over-engineering
- [ ] Backup column retention policy accepted (permanent until explicit cleanup decision)
- [ ] Dev DB dry-run §6 evidence is sufficient
- [ ] Audit doc covers all expected sections per A4 marching order

---

## 9. Deployment plan (after Steve GO post-merge)

1. **Merge PR**.
2. **Deploy to test first** via `./scripts/deploy/deploy-backend.sh --env test`. Flyway auto-applies. Smoke: verify `SELECT unit, COUNT(*) FROM bom_items GROUP BY unit;` shows only canonical values.
3. **Verify** customer F006 production BOM-expand still works (run a plan, check Transfer quantity reasonableness).
4. **Deploy to prod** via `./scripts/deploy/deploy-backend.sh --env prod`. Same Flyway path.
5. **Post-deploy audit** (`journalctl -u cretas-backend --since '5 min ago' | grep V20260510_02`) — confirm `RAISE NOTICE` lines show 100% canonical.
6. **30-day soak**: leave `unit_pre_migration` column in place. If no customer escalations, schedule cleanup migration `V<later>__drop_bom_unit_pre_migration_col.sql`.

---

## 10. References

- PR #309 sign-off package §A4: `docs/decisions/2026-05-10-steve-sign-off-package.md` (in PR #309 branch, not yet merged)
- D3 design spec: `docs/superpowers/specs/2026-05-10-customer-meeting-design-decisions-impl-plan.md` §4
- PR #297 (D2+D3 runtime ship): commit `87a7e2dd98`
- Marching order: 2026-05-10 A4 BOM unit migration (this PR)
- Concurrent-edit safety rule: `.claude/rules/concurrent-edit-safety.md` Rule 5b (used `git commit -- <paths>` for staging isolation)

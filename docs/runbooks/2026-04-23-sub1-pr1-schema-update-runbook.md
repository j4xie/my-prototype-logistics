# Sub-1 PR1 module_schemas UPDATE Runbook (sales_order)

**Date**: 2026-04-23
**Spec**: `docs/superpowers/specs/2026-04-23-sub1-sales-customer-form-fixes-design.md` §4.A.3
**Plan**: `docs/superpowers/plans/2026-04-23-sub1-pr1-phase-a-foundation-fixes.md` Task 7

## What this UPDATE does (canonical, all factories)

Modifies `module_schemas.field_schema` JSONB for `module_code='sales_order'` to:
1. **orderNumber**: remove `required: true` (autoGenerate handles it)
2. **salesperson**: change `type: 'string'` → `'reference'` + add referenceConfig pointing to `/users/search?role=` endpoint
3. **items.itemSchema.fields[productTypeId]**: add `referenceConfig.apiEndpoint = /product-types/search`

## Pre-conditions

- Backend Phase A code (PR1) deployed to target env (test or prod)
- T6 deploy commit on branch (e.g. `760896586` or later)
- Backend has whitelist patch `autoGenerate` (T4) so the flag round-trips

## Apply to test (cretas_db)

Already applied 2026-04-23 12:24 CST via:

```bash
# 1. Backup current schema
ssh root@47.100.235.168 "sudo -u postgres psql -d cretas_db -tAc \"SELECT field_schema::text FROM module_schemas WHERE module_code='sales_order';\"" \
  > tmp_pr1/schema_pre.json

# 2. Build new schema (Python transform)
python3 transform_script.py < tmp_pr1/schema_pre.json > tmp_pr1/schema_new.json
# (script in plan §Task 7, applies orderNumber + salesperson + productTypeId changes)

# 3. scp to server
scp tmp_pr1/schema_new.json root@47.100.235.168:/tmp/sales_order_schema_new.json

# 4. Apply UPDATE
ssh root@47.100.235.168 "sudo -u postgres psql -d cretas_db <<EOF
UPDATE module_schemas
SET field_schema = pg_read_file('/tmp/sales_order_schema_new.json')::jsonb,
    updated_at = NOW()
WHERE module_code='sales_order';
EOF"
# Expected: UPDATE 1
```

## Apply to prod (cretas_prod_db)

After customer ack on test, repeat above with `cretas_prod_db` instead of `cretas_db`. **MUST**:
1. Backup prod schema first: `... -d cretas_prod_db -tAc ... > tmp_pr1/schema_prod_pre.json`
2. Verify prod's pre state matches test's pre state (run `diff` between the two backup files; expect identical or very close)
3. Apply UPDATE to prod
4. Verify with same query as test

## Rollback (any env)

If issue post-UPDATE:

```bash
# Use the backup file from pre-UPDATE step
scp tmp_pr1/schema_pre.json root@47.100.235.168:/tmp/sales_order_schema_rollback.json
ssh root@47.100.235.168 "sudo -u postgres psql -d <DB_NAME> <<EOF
UPDATE module_schemas
SET field_schema = pg_read_file('/tmp/sales_order_schema_rollback.json')::jsonb,
    updated_at = NOW()
WHERE module_code='sales_order';
EOF"
```

Replace `<DB_NAME>` with `cretas_db` (test) or `cretas_prod_db` (prod).

## Verification queries

```sql
-- Post-UPDATE verification
SELECT
  jsonb_path_query_first(field_schema, '$.fields[*] ? (@.code == "orderNumber")') AS order_number,
  jsonb_path_query_first(field_schema, '$.fields[*] ? (@.code == "salesperson")') AS salesperson
FROM module_schemas
WHERE module_code='sales_order';

-- Expected:
--   order_number.required = false (was true)
--   salesperson.type = 'reference' (was 'string')
--   salesperson.referenceConfig.apiEndpoint = '/api/mobile/{factoryId}/users/search'
```

## Impact assessment

- **Affects**: All factories using DYNAMIC mode for sales_order (currently F001 + others to be confirmed)
- **Backward compat**: Old salesperson values (string names like "张三") still display via SalesServiceImpl resolveSalespersonField fallback (T3 commit `d44841efc`)
- **Frontend UX**: New SO creation will show 业务员 as employee dropdown; existing SO editing shows old salesperson string as readonly

## History

- 2026-04-23 12:24 CST: Applied to test DB (cretas_db) — backup at tmp_pr1/schema_pre.json (6080 bytes)
- TBD: Apply to prod after customer ack

## Additional follow-up data fixes (discovered during E2E)

### A. customer RATING_RANGE validation rule — must allow null rating

**Problem**: `factory_validation_rules` row for customer UPDATE had condition `#rating < 1 OR #rating > 5`. SpEL evaluates null rating as 0 → blocks ALL customer updates that don't include rating field. Found via E2E PUT test.

**Fix applied to test DB** (2026-04-23):
```sql
UPDATE factory_validation_rules
SET condition='#rating != null && (#rating < 1 OR #rating > 5)',
    updated_at=NOW()
WHERE module_code='customer' AND rule_code='RATING_RANGE';
-- UPDATE 1
```

**Apply to prod**: replace `cretas_db` with `cretas_prod_db`, run same UPDATE.

**Rollback** (if needed): restore old condition:
```sql
UPDATE factory_validation_rules
SET condition='#rating < 1 OR #rating > 5'
WHERE module_code='customer' AND rule_code='RATING_RANGE';
```

### B. supplier RATING_RANGE — same rule pattern

Per V20260410_05 seed file, supplier has same RATING_RANGE rule. Same fix applies.
```sql
UPDATE factory_validation_rules
SET condition='#rating != null && (#rating < 1 OR #rating > 5)',
    updated_at=NOW()
WHERE module_code='supplier' AND rule_code='RATING_RANGE';
```

### C. F001 sales_order rendering_mode (TEST DB ONLY)

For E2E DYNAMIC verification, `factory_module_configs.rendering_mode` for F001 sales_order was switched from `LEGACY` → `DYNAMIC`:
```sql
UPDATE factory_module_configs SET rendering_mode='DYNAMIC', updated_at=NOW()
WHERE factory_id='F001' AND module_code='sales_order';
```

**This change is test-only**. Prod F001 already has DYNAMIC mode (per spec history). No prod action needed.

If you want to revert F001 test back to LEGACY:
```sql
UPDATE factory_module_configs SET rendering_mode='LEGACY', updated_at=NOW()
WHERE factory_id='F001' AND module_code='sales_order';
```

### D. Backend DTO @NotBlank fix (commit `211eb7a85`)

`CreateCustomerRequest` had `@NotBlank` on contactPerson/phone/shippingAddress that contradicted T10 frontend change. Removed in commit `211eb7a85` (deployed in v20260423_110328 backend JAR). For prod deploy: just normal backend deploy includes this commit.

### E. Bug C: sales_order items.unit options + default (DB UPDATE on test ✅)

`module_schemas.field_schema.items.itemSchema.fields[unit]` had `type:select required:true` but **no options + no defaultValue** → DYNAMIC form unit dropdown empty, blocks all SO submits.

**Fix applied to test DB** (2026-04-23 via Python transform script + scp + pg_read_file UPDATE):
```python
# unit field added: options=[kg/克/袋/箱/瓶/件/盒/只/份] + defaultValue='kg'
```

**Apply to prod**: re-run T7 UPDATE script with cretas_prod_db (the same script in Task 7 produces both schema_new.json with all 4 changes: orderNumber.required false / salesperson reference / productTypeId apiEndpoint / unit options+default).

### F. PR1.5 + PR1.6 fixes deployed via backend JAR (no DB action needed)

Following commits ship via standard `./scripts/deploy/deploy-backend.sh --env prod`:

| Commit | Bug | Effect |
|---|---|---|
| `e270ec361` | Bug A v1 | SchemaFormRenderer resolveDefault TODAY/NOW/YESTERDAY |
| `f4dc3ed7a` + `d5bb099d9` | O4 v1+v2 | GlobalExceptionHandler friendly date error |
| `819c0cbdc` (in `cf736b926`) | Bug D | CustomerMapper status field mapping |
| `5e140e481` `9b7d5eced` `61526a6b5` | Bug E v1+v2+v3 | ReferenceSelector smart fetch + name-shape guard |
| `27827f549` | Bug G FE | DynamicModulePage keyword search input |
| `7423eef5f` `835b32e86` | Bug G BE | SalesOrderRepository.searchByFactoryAndKeyword |
| `94f0fa074` | Bug I | SchemaTableRenderer reference cell display name |
| `a005a8862` | Bug J | SchemaTableRenderer Chinese status labels |
| (in `cf736b926`) | C1 audit | Frontend NOW UTC bug → local time |
| (in `cf736b926`) | H1 audit | SQL LIKE escape for keyword search |
| (in `cf736b926`) | M3 audit | Customer status validation |

⚠️ **Concurrent-edit incident**: C1+H1+M3 audit fixes were committed inside `cf736b926` ("Finance KPI Gold flip") due to a git ref lock conflict during my commit. Code is correct + deployed; git blame for those files will misleadingly point to that SmartBI commit. See `feedback_concurrent_edit_scope_creep_apr24.md` memory for prevention.

### G. supplier RATING_RANGE (per audit M3 — defensive)

Per audit, supplier validation has the same null-rating bug. Apply same fix:
```sql
UPDATE factory_validation_rules
SET condition='#rating != null && (#rating < 1 OR #rating > 5)',
    updated_at=NOW()
WHERE module_code='supplier' AND rule_code='RATING_RANGE';
-- UPDATE 1 (or 0 if not present in this env)
```

---

## ⛓️ Prod deploy sequence (when user says "部 prod")

1. **Verify customer ack on test** (recorded in PR description)
2. **Backup prod DBs**:
   ```bash
   ssh root@47.100.235.168 "sudo -u postgres pg_dump cretas_prod_db -t module_schemas -t factory_validation_rules > /tmp/prod-runbook-pre-pr1.sql"
   ```
3. **Deploy backend prod**: `./scripts/deploy/deploy-backend.sh --env prod`
4. **Apply data UPDATEs to prod DB** (steps E + A + B + G above with cretas_prod_db)
5. **Deploy web-admin prod**: `./scripts/deploy/deploy-web-admin.sh --env prod`
6. **Smoke test prod**: Login as `factory_admin1` on `admin.cretaceousfuture.com`, verify:
   - 仓储管理 menu visible (already confirmed Apr 22, fix `b4203ba7b` shipped)
   - SO create form: 合同号 disabled / 业务员 dropdown / 产品 search / 单位 default kg / 下单日期 today
   - Customer create with empty contacts → success
   - Customer status edit → save shows isActive=false in next GET
7. **Customer go-live ack** in writing

## ⏪ Full rollback procedure

```bash
# 1. Restore backend JAR
ssh root@47.100.235.168 "cp /www/wwwroot/cretas/aims-0.0.1-SNAPSHOT.jar.bak.YYYYMMDD_HHMMSS /www/wwwroot/cretas/aims-0.0.1-SNAPSHOT.jar && systemctl restart cretas-backend"

# 2. Restore web-admin (atomic backup auto-saved by deploy script)
ssh root@139.196.165.140 "ls /www/wwwroot/web-admin.bak.* | tail -1 | xargs -I{} mv {} /www/wwwroot/web-admin"

# 3. Restore DB
ssh root@47.100.235.168 "sudo -u postgres psql -d cretas_prod_db < /tmp/prod-runbook-pre-pr1.sql"
```

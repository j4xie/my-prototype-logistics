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

-- V20260514_04: Seed 12 restaurant-tenant role accounts for cross-role RBAC testing.
--
-- Background
-- ----------
-- Issue #604 (rbac-audit-gap): QHJ-chain restaurant tenants currently have only
-- `*_admin` accounts seeded (qhj_prod / gml_admin / xmx_admin). The R7 Path F3
-- 5×5 RBAC negative-regression sweep (tests/qa-r7-f2-rbac/matrix.md, 2026-05-14)
-- reported 12 of 25 cells N/A (3 tenants × 4 non-admin roles) because the
-- corresponding usernames returned HTTP 401 at the login endpoint. This
-- migration seeds those 12 accounts so future R8/R9 rounds can probe the full
-- matrix.
--
-- Tenants (factory_id):
--   - RES_3101_009    (秦皇荷 QHJ — exists in factories table, type=RESTAURANT)
--   - R_GML_DEMO      (干妈辣 demo chain)
--   - R_XMX_CHAIN     (唏嘛香 chain)
--
-- Roles seeded per tenant (4 each → 12 rows total):
--   - <prefix>_warehouse_mgr → role_code = 'warehouse_manager'
--   - <prefix>_finance_mgr   → role_code = 'finance_manager'
--   - <prefix>_sales_mgr     → role_code = 'sales_manager'
--   - <prefix>_operator      → role_code = 'operator'
--
-- Username prefix convention follows the existing admin: qhj_* / gml_* / xmx_*
-- (matches the underscore-suffix pattern used for F001 / F006 — see
--  tests/qa-r7-f2-rbac/matrix.md columns).
--
-- Password
-- --------
-- All 12 accounts share password "123456" (test convention per
-- `reference_f006_liutengmen_prod_accounts.md` — restaurant tenants are
-- demo/test factories, not prod customer data). We reuse the bcrypt
-- password_hash from `f001_warehouse_mgr` via SELECT-FROM-existing so we
-- don't need to compute a bcrypt locally or commit a hash literal. If
-- `f001_warehouse_mgr` does not exist on the target DB (e.g. fresh dev
-- bootstrap), the INSERTs are no-ops because the SELECT returns zero rows
-- (idempotent-safe — matches issue spec).
--
-- Permissions model (why we don't insert a `permissions` column)
-- --------------------------------------------------------------
-- The `users` table has NO `permissions` column. Effective permissions are
-- derived at runtime from `role_code` via FactoryUserRole.getPermissionPrefix()
-- → produces e.g. "warehouse:*" for warehouse_manager, "finance:*" for
-- finance_manager, etc. See backend/.../entity/User.java getPermissions() and
-- backend/.../entity/enums/FactoryUserRole.java. Cross-cutting permissions
-- like procurement:price:view live in PermissionServiceImpl.PRICE_VIEW_ROLES
-- (code-side whitelist by role enum, not DB rows).
--
-- Therefore: setting role_code is sufficient to materialize the correct
-- 5×5 RBAC behavior. No `permissions` JSON column to populate.
--
-- Column choices (and `position` redundancy)
-- ------------------------------------------
-- User.java getRole() returns `roleCode != null ? roleCode : position` —
-- canonical is `role_code`, with `position` as legacy fallback. For new rows
-- we set BOTH (defensive against any code path that reads position directly,
-- mirrors V20260429_01__fix_f006_position.sql convention). `level` is
-- populated from FactoryUserRole.getLevel() (10 for the 3 managers, 30 for
-- operator).
--
-- Caveats / follow-ups (DO NOT block this seed — flagged per issue #604)
-- ---------------------------------------------------------------------
-- 1. RESTAURANT-tenant operator semantics. FactoryUserRole.operator has
--    permission prefix "production" (intended for factory production-line
--    operators). For restaurants this is reasonable for an RBAC matrix
--    coverage seed — restaurant operators should NOT have warehouse/finance/
--    sales price visibility either, so the resulting cell behavior is still
--    correct (STRIP / 403). If a future round needs a distinct restaurant
--    operator role (e.g. front-of-house / kitchen-line), introduce a new
--    enum value and migrate these 3 rows separately. Mirrors the existing
--    `restaurant_manager` enum which is restaurant-specific.
-- 2. No per-user warehouse FK on the users table (confirmed by User.java —
--    no @ManyToOne warehouse field). Safe to insert without a warehouse
--    assignment.
-- 3. `position` is set to the same value as `role_code` for these rows
--    (matches F006 fix migration semantics). If displays use position as a
--    "job title" elsewhere, follow up with localized titles per role.
-- 4. password_hash source row (`f001_warehouse_mgr`) must exist in the DB
--    or these INSERTs no-op. F001 seed rows are present in prod
--    (cretas_prod_db) and test (cretas_db) per the R7 matrix evidence.
--    For local-dev clean bootstrap, run the F001 seed first.
--
-- Idempotency
-- -----------
-- ON CONFLICT (username) DO NOTHING — the users table has a global unique
-- index on username (User.java @UniqueConstraint columnNames={"username"}).
-- Safe to re-run.

INSERT INTO users (
    factory_id, username, password_hash,
    full_name, role_code, position,
    level, is_active, platform_type,
    created_at, updated_at
)
SELECT
    'RES_3101_009', 'qhj_warehouse_mgr', password_hash,
    '秦皇荷 仓储主管 (测试)', 'warehouse_manager', 'warehouse_manager',
    10, true, 'web,mobile',
    NOW(), NOW()
FROM users WHERE username = 'f001_warehouse_mgr' LIMIT 1
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (
    factory_id, username, password_hash,
    full_name, role_code, position,
    level, is_active, platform_type,
    created_at, updated_at
)
SELECT
    'RES_3101_009', 'qhj_finance_mgr', password_hash,
    '秦皇荷 财务主管 (测试)', 'finance_manager', 'finance_manager',
    10, true, 'web,mobile',
    NOW(), NOW()
FROM users WHERE username = 'f001_warehouse_mgr' LIMIT 1
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (
    factory_id, username, password_hash,
    full_name, role_code, position,
    level, is_active, platform_type,
    created_at, updated_at
)
SELECT
    'RES_3101_009', 'qhj_sales_mgr', password_hash,
    '秦皇荷 销售主管 (测试)', 'sales_manager', 'sales_manager',
    10, true, 'web,mobile',
    NOW(), NOW()
FROM users WHERE username = 'f001_warehouse_mgr' LIMIT 1
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (
    factory_id, username, password_hash,
    full_name, role_code, position,
    level, is_active, platform_type,
    created_at, updated_at
)
SELECT
    'RES_3101_009', 'qhj_operator', password_hash,
    '秦皇荷 操作员 (测试)', 'operator', 'operator',
    30, true, 'web,mobile',
    NOW(), NOW()
FROM users WHERE username = 'f001_warehouse_mgr' LIMIT 1
ON CONFLICT (username) DO NOTHING;

-- ── R_GML_DEMO (干妈辣) ─────────────────────────────────────────────────────
INSERT INTO users (
    factory_id, username, password_hash,
    full_name, role_code, position,
    level, is_active, platform_type,
    created_at, updated_at
)
SELECT
    'R_GML_DEMO', 'gml_warehouse_mgr', password_hash,
    '干妈辣 仓储主管 (测试)', 'warehouse_manager', 'warehouse_manager',
    10, true, 'web,mobile',
    NOW(), NOW()
FROM users WHERE username = 'f001_warehouse_mgr' LIMIT 1
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (
    factory_id, username, password_hash,
    full_name, role_code, position,
    level, is_active, platform_type,
    created_at, updated_at
)
SELECT
    'R_GML_DEMO', 'gml_finance_mgr', password_hash,
    '干妈辣 财务主管 (测试)', 'finance_manager', 'finance_manager',
    10, true, 'web,mobile',
    NOW(), NOW()
FROM users WHERE username = 'f001_warehouse_mgr' LIMIT 1
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (
    factory_id, username, password_hash,
    full_name, role_code, position,
    level, is_active, platform_type,
    created_at, updated_at
)
SELECT
    'R_GML_DEMO', 'gml_sales_mgr', password_hash,
    '干妈辣 销售主管 (测试)', 'sales_manager', 'sales_manager',
    10, true, 'web,mobile',
    NOW(), NOW()
FROM users WHERE username = 'f001_warehouse_mgr' LIMIT 1
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (
    factory_id, username, password_hash,
    full_name, role_code, position,
    level, is_active, platform_type,
    created_at, updated_at
)
SELECT
    'R_GML_DEMO', 'gml_operator', password_hash,
    '干妈辣 操作员 (测试)', 'operator', 'operator',
    30, true, 'web,mobile',
    NOW(), NOW()
FROM users WHERE username = 'f001_warehouse_mgr' LIMIT 1
ON CONFLICT (username) DO NOTHING;

-- ── R_XMX_CHAIN (唏嘛香) ────────────────────────────────────────────────────
INSERT INTO users (
    factory_id, username, password_hash,
    full_name, role_code, position,
    level, is_active, platform_type,
    created_at, updated_at
)
SELECT
    'R_XMX_CHAIN', 'xmx_warehouse_mgr', password_hash,
    '唏嘛香 仓储主管 (测试)', 'warehouse_manager', 'warehouse_manager',
    10, true, 'web,mobile',
    NOW(), NOW()
FROM users WHERE username = 'f001_warehouse_mgr' LIMIT 1
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (
    factory_id, username, password_hash,
    full_name, role_code, position,
    level, is_active, platform_type,
    created_at, updated_at
)
SELECT
    'R_XMX_CHAIN', 'xmx_finance_mgr', password_hash,
    '唏嘛香 财务主管 (测试)', 'finance_manager', 'finance_manager',
    10, true, 'web,mobile',
    NOW(), NOW()
FROM users WHERE username = 'f001_warehouse_mgr' LIMIT 1
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (
    factory_id, username, password_hash,
    full_name, role_code, position,
    level, is_active, platform_type,
    created_at, updated_at
)
SELECT
    'R_XMX_CHAIN', 'xmx_sales_mgr', password_hash,
    '唏嘛香 销售主管 (测试)', 'sales_manager', 'sales_manager',
    10, true, 'web,mobile',
    NOW(), NOW()
FROM users WHERE username = 'f001_warehouse_mgr' LIMIT 1
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (
    factory_id, username, password_hash,
    full_name, role_code, position,
    level, is_active, platform_type,
    created_at, updated_at
)
SELECT
    'R_XMX_CHAIN', 'xmx_operator', password_hash,
    '唏嘛香 操作员 (测试)', 'operator', 'operator',
    30, true, 'web,mobile',
    NOW(), NOW()
FROM users WHERE username = 'f001_warehouse_mgr' LIMIT 1
ON CONFLICT (username) DO NOTHING;

-- Verification query (run manually after migration):
--   SELECT username, factory_id, role_code FROM users
--   WHERE username IN (
--     'qhj_warehouse_mgr','qhj_finance_mgr','qhj_sales_mgr','qhj_operator',
--     'gml_warehouse_mgr','gml_finance_mgr','gml_sales_mgr','gml_operator',
--     'xmx_warehouse_mgr','xmx_finance_mgr','xmx_sales_mgr','xmx_operator'
--   ) ORDER BY factory_id, role_code;
-- Expect 12 rows. If zero rows: check that f001_warehouse_mgr exists in
-- the target DB (the password_hash source).

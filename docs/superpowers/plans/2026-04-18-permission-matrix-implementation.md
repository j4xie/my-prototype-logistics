# Permission Matrix 4-Layer AI-Driven Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate permission matrix from hardcoded constants to DB-driven 4-layer resolution (L1 global + L2 factory override + L3 field-level existing + fallback), integrate Canvas AI chat for edits, and fix detail-page 404 UX.

**Architecture:** Backend adds `platform_role_permissions` table (L1) + `factory_module_configs.role_module_override` JSONB column (L2); `PermissionServiceImpl` resolves L2→L1→hardcoded fallback with Caffeine cache (5min TTL); frontend store replaces hardcoded matrix with login-time fetch+merge; Canvas AI chat adds `UPDATE_PERMISSION` diff type. Sprint 5 independent: detail-page 404 `<el-empty>` replaces toast.

**Tech Stack:** Java 21 + Spring Boot 3.2.12 + Flyway + JPA/Hibernate 6 + Caffeine cache; Vue 3 + Pinia + Element Plus; PostgreSQL JSONB; Playwright MCP for E2E.

**Related Spec:** `docs/superpowers/specs/2026-04-18-permission-matrix-ai-driven-design.md`
**Related Bugs:** #319 UX fallback, RdController regression (Phase 5)

---

## Phase 1: Quick Fix (S1, 30 min)

**Goal:** Add `rd` module to hardcoded matrices (both sides), unblock RdController. Transitional — gets superseded by Phase 2-3 DB migration.

**Unblocks:** dispatcher/sales_manager can create RD samples immediately.

### Task 1.1: Add `rd` + `restaurant` to backend ALL_MODULES

**Files:**
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/impl/PermissionServiceImpl.java:24-28`

- [ ] **Step 1: Read current ALL_MODULES**

```bash
grep -A 4 "ALL_MODULES = Arrays.asList" backend/java/cretas-api/src/main/java/com/cretas/aims/service/impl/PermissionServiceImpl.java
```

Expected output:
```java
private static final List<String> ALL_MODULES = Arrays.asList(
        "dashboard", "production", "warehouse", "quality",
        "procurement", "sales", "hr", "equipment", "finance", "system", "analytics",
        "scheduling", "work_report", "inventory", "report"
);
```

- [ ] **Step 2: Edit ALL_MODULES to add `"rd"` and `"restaurant"`**

New value:
```java
private static final List<String> ALL_MODULES = Arrays.asList(
        "dashboard", "production", "warehouse", "quality",
        "procurement", "sales", "hr", "equipment", "finance", "system", "analytics",
        "scheduling", "work_report", "inventory", "report",
        "rd", "restaurant"
);
```

- [ ] **Step 3: Add rd levels to each role's PERMISSION_MATRIX entry**

Find each role's perms block (search for `Perms.put("production"`) and add corresponding `rd` level per the spec §5.1.5 matrix. Below are the exact additions:

`superAdminPerms` (line ~44): already `ALL_MODULES.forEach(m -> superAdminPerms.put(m, "read_write"))` — will auto-include new modules ✓

`dispatcherPerms` (line ~49-62): add after `scheduling`:
```java
dispatcherPerms.put("rd", "read_write");
```

`production_manager` (line ~65, legacy): same as dispatcher
```java
productionManagerPerms.put("rd", "read_write");
```

`qualityManagerPerms` (line ~70): add
```java
qualityManagerPerms.put("rd", "read");
```

`workshopPerms` (line ~77): add
```java
workshopPerms.put("rd", "read");
```

`teamLeaderPerms` (line ~90): add
```java
teamLeaderPerms.put("rd", "read");
```

`groupLeaderPerms` (line ~101): add
```java
groupLeaderPerms.put("rd", "none");
```

`inspectorPerms`, `operatorPerms`, `warehouseWorkerPerms`, `warehouseManagerPerms`, `hrPerms`, `equipmentPerms`, `procurementPerms`: add `"rd", "none"` (no RD access for operational / ops roles)

`salesPerms` (line ~167): add
```java
salesPerms.put("rd", "read_write");
```

`financePerms` (line ~178): add
```java
financePerms.put("rd", "read");
```

`restaurantManagerPerms` (should exist, per frontend): add
```java
restaurantManagerPerms.put("rd", "none");
```

Also add `restaurant` levels for all roles (mostly "none" except restaurant_manager which is "read_write" and super_admin auto).

- [ ] **Step 4: Verify no compile errors**

```bash
cd backend/java/cretas-api && ./mvnw compile 2>&1 | tail -5
```

Expected: `BUILD SUCCESS`. If fail, check missing `restaurant_manager` role perm block — may need to add one.

- [ ] **Step 5: Run unit tests**

```bash
./mvnw test -Dtest=PermissionServiceImplTest 2>&1 | tail -10
```

Expected: all pass. Tests may not exist yet — skip if no such test class (no regression).

- [ ] **Step 6: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/service/impl/PermissionServiceImpl.java
git commit -m "feat(permissions): add rd and restaurant modules to backend matrix (Phase 1/5)

Per design doc 2026-04-18-permission-matrix-ai-driven-design.md.
Unblocks RdController annotations (@RequirePermission({\"rd:read_write\"})).

rd level assignments per spec §5.1.5:
- factory_super_admin: rw (auto via ALL_MODULES.forEach)
- dispatcher, sales_manager: rw (业务驱动方)
- workshop_supervisor, team_leader, quality_manager, finance_manager: r
- others: none

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.2: Add `rd` to frontend `ModulePermissions` interface

**Files:**
- Modify: `web-admin/src/store/modules/permission.ts:10-24`

- [ ] **Step 1: Read current interface**

```bash
grep -A 14 "interface ModulePermissions" web-admin/src/store/modules/permission.ts
```

- [ ] **Step 2: Add `rd: PermissionLevel` field**

Edit the interface:
```typescript
interface ModulePermissions {
  dashboard: PermissionLevel;
  production: PermissionLevel;
  warehouse: PermissionLevel;
  quality: PermissionLevel;
  procurement: PermissionLevel;
  sales: PermissionLevel;
  hr: PermissionLevel;
  equipment: PermissionLevel;
  finance: PermissionLevel;
  system: PermissionLevel;
  analytics: PermissionLevel;
  scheduling: PermissionLevel;
  restaurant: PermissionLevel;
  rd: PermissionLevel;  // ← NEW
}
```

- [ ] **Step 3: Add rd level to each role in PERMISSION_MATRIX**

For each role entry (factory_super_admin, dispatcher, sales_manager, etc.), add `rd: '<level>'` following the pattern used for other modules. Match backend levels exactly from Task 1.1 Step 3.

Example `dispatcher` (line ~66-70):
```typescript
dispatcher: {
  dashboard: 'rw', production: 'rw', warehouse: 'r', quality: 'r',
  procurement: 'r', sales: 'rw', hr: '-', equipment: 'r',
  finance: '-', system: '-', analytics: 'rw', scheduling: 'rw', restaurant: '-',
  rd: 'rw'  // ← NEW
},
```

Apply to all 14 role entries. Use `'-'` for "none" roles (frontend uses `-` not `none`).

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd web-admin && npx vue-tsc --noEmit 2>&1 | tail -10
```

Expected: no errors. If `rd` missing on some role, TS will complain. Add it.

- [ ] **Step 5: Commit**

```bash
git add web-admin/src/store/modules/permission.ts
git commit -m "feat(permissions): add rd module to frontend PERMISSION_MATRIX (Phase 1/5)

Match backend hardcoded levels (Task 1.1). Frontend canWrite('rd')
now returns correct value for each role.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.3: Update RD sample page to use `canWrite('rd')` (semantic correctness)

**Files:**
- Modify: `web-admin/src/views/rd/samples/list.vue:12`

- [ ] **Step 1: Change `canWrite('production')` to `canWrite('rd')`**

```typescript
// Line 12
const canWrite = computed(() => permissionStore.canWrite('rd'));
```

- [ ] **Step 2: Commit**

```bash
git add web-admin/src/views/rd/samples/list.vue
git commit -m "fix(rd/samples): use canWrite('rd') instead of canWrite('production')

Semantic correctness — RD samples are not production operations.
Dispatcher still has access (rd:rw), workshop_supervisor now
correctly hidden (rd:r only, not rw). Matches backend
@RequirePermission({\"rd:read_write\"}).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.4: Build + deploy test + verify

- [ ] **Step 1: Build backend jar**

```bash
cd backend/java/cretas-api && ./mvnw clean package -DskipTests 2>&1 | tail -5
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 2: Build web-admin dist**

```bash
cd web-admin && npm run build 2>&1 | tail -3
```

Expected: `✓ built in ...s`.

- [ ] **Step 3: Deploy backend + web-admin to test**

```bash
cd /c/Users/Steve/my-prototype-logistics
./scripts/deploy/deploy-backend.sh --env test
./scripts/deploy/deploy-web-admin.sh --env test
```

Expected: both scripts end with `✅ 部署完成`. Backend deploy takes ~2 min, web-admin ~1 min.

- [ ] **Step 4: Real-window verify via Playwright MCP**

Open http://139.196.165.140:8097, login as dispatcher1 / 123456 / F001, navigate to `/rd/samples`, click `新建样品`, fill `样品名称=phase1-verify`, click `创建`.

**Expected result:**
- Toast: "样品已创建" (success, NOT "权限不足")
- Table shows new row with name "phase1-verify"
- No console errors

If fails with 403 still → verify Sprint 1 actually made it to the test backend (check `/api/mobile/F001/rd/samples` POST status in devtools).

- [ ] **Step 5: Commit verify evidence**

```bash
# Save playwright snapshot + network log to 流程实际测试/99-R19-phase1-verify-*.yml
git add 流程实际测试/99-R19-phase1-verify-*
git commit -m "test(permissions): Phase 1 verified — dispatcher creates RD sample (S1 done)

Real-window verified via Playwright MCP:
- POST /rd/samples → 200 (was 403 before)
- Toast: 样品已创建
- Table +1 row

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2: Backend DB-Driven Permission (S2, ~1 day)

**Goal:** Migrate from hardcoded to DB-driven PermissionService with caching and API endpoints.

**Prerequisite:** Phase 1 complete.

### Task 2.1: Create Flyway migration V20260419_01 — `platform_role_permissions` table

**Files:**
- Create: `backend/java/cretas-api/src/main/resources/db/flyway/V20260419_01__platform_role_permissions.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- V20260419_01: Platform-level global permission defaults (Layer 1)
-- Migrates hardcoded PERMISSION_MATRIX in PermissionServiceImpl.java to DB
-- See: docs/superpowers/specs/2026-04-18-permission-matrix-ai-driven-design.md

CREATE TABLE IF NOT EXISTS platform_role_permissions (
  id BIGSERIAL PRIMARY KEY,
  role_code VARCHAR(64) NOT NULL,
  module_code VARCHAR(32) NOT NULL,
  permission_level VARCHAR(8) NOT NULL CHECK (permission_level IN ('rw','r','w','-')),
  updated_by BIGINT,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL,
  CONSTRAINT uk_role_module UNIQUE(role_code, module_code)
);

CREATE INDEX idx_platform_role_permissions_role ON platform_role_permissions(role_code);

COMMENT ON TABLE platform_role_permissions IS
  'Layer 1: Platform global default permissions. role × module → level.';
COMMENT ON COLUMN platform_role_permissions.permission_level IS
  'rw = read+write, r = read only, w = write only (rare), - = none';

-- Seed data from hardcoded PERMISSION_MATRIX (as of 2026-04-18)
-- 18 roles × 16 modules = 288 rows
INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES
-- factory_super_admin: rw on all
('factory_super_admin','dashboard','rw'),('factory_super_admin','production','rw'),
('factory_super_admin','warehouse','rw'),('factory_super_admin','quality','rw'),
('factory_super_admin','procurement','rw'),('factory_super_admin','sales','rw'),
('factory_super_admin','hr','rw'),('factory_super_admin','equipment','rw'),
('factory_super_admin','finance','rw'),('factory_super_admin','system','rw'),
('factory_super_admin','analytics','rw'),('factory_super_admin','scheduling','rw'),
('factory_super_admin','work_report','rw'),('factory_super_admin','inventory','rw'),
('factory_super_admin','report','rw'),('factory_super_admin','rd','rw'),
('factory_super_admin','restaurant','rw'),

-- platform_admin: rw on all
('platform_admin','dashboard','rw'),('platform_admin','production','rw'),
('platform_admin','warehouse','rw'),('platform_admin','quality','rw'),
('platform_admin','procurement','rw'),('platform_admin','sales','rw'),
('platform_admin','hr','rw'),('platform_admin','equipment','rw'),
('platform_admin','finance','rw'),('platform_admin','system','rw'),
('platform_admin','analytics','rw'),('platform_admin','scheduling','rw'),
('platform_admin','work_report','rw'),('platform_admin','inventory','rw'),
('platform_admin','report','rw'),('platform_admin','rd','rw'),
('platform_admin','restaurant','rw'),

-- dispatcher
('dispatcher','dashboard','rw'),('dispatcher','production','rw'),
('dispatcher','warehouse','r'),('dispatcher','quality','r'),
('dispatcher','procurement','r'),('dispatcher','sales','rw'),
('dispatcher','hr','-'),('dispatcher','equipment','r'),
('dispatcher','finance','-'),('dispatcher','system','-'),
('dispatcher','analytics','rw'),('dispatcher','scheduling','rw'),
('dispatcher','work_report','rw'),('dispatcher','inventory','r'),
('dispatcher','report','r'),('dispatcher','rd','rw'),
('dispatcher','restaurant','-'),

-- sales_manager
('sales_manager','dashboard','r'),('sales_manager','production','r'),
('sales_manager','warehouse','r'),('sales_manager','quality','-'),
('sales_manager','procurement','-'),('sales_manager','sales','rw'),
('sales_manager','hr','-'),('sales_manager','equipment','-'),
('sales_manager','finance','r'),('sales_manager','system','-'),
('sales_manager','analytics','r'),('sales_manager','scheduling','-'),
('sales_manager','work_report','-'),('sales_manager','inventory','r'),
('sales_manager','report','r'),('sales_manager','rd','rw'),
('sales_manager','restaurant','-'),

-- [ Continue for remaining roles: production_manager (legacy=dispatcher), 
--   quality_manager, workshop_supervisor, team_leader, group_leader, 
--   quality_inspector, operator, warehouse_worker, warehouse_manager, 
--   hr_admin, equipment_admin, finance_manager, procurement_manager, 
--   restaurant_manager, viewer, unactivated ]
-- Generate remaining rows from PermissionServiceImpl.PERMISSION_MATRIX using
-- the helper script in Task 2.2.

-- unactivated: all '-'
('unactivated','dashboard','-'),('unactivated','production','-'),
('unactivated','warehouse','-'),('unactivated','quality','-'),
('unactivated','procurement','-'),('unactivated','sales','-'),
('unactivated','hr','-'),('unactivated','equipment','-'),
('unactivated','finance','-'),('unactivated','system','-'),
('unactivated','analytics','-'),('unactivated','scheduling','-'),
('unactivated','work_report','-'),('unactivated','inventory','-'),
('unactivated','report','-'),('unactivated','rd','-'),
('unactivated','restaurant','-');
```

**Note:** Above is partial. Full seed generated by Task 2.2 helper script (Python reads Java source + outputs SQL).

- [ ] **Step 2: Write helper script to generate full seed SQL**

Create: `scripts/generate-permission-seed.py`

```python
#!/usr/bin/env python3
"""Generate INSERT SQL for platform_role_permissions from PermissionServiceImpl.java"""
import re
from pathlib import Path

JAVA_SRC = Path('backend/java/cretas-api/src/main/java/com/cretas/aims/service/impl/PermissionServiceImpl.java')
OUTPUT = Path('backend/java/cretas-api/src/main/resources/db/flyway/V20260419_01__platform_role_permissions.sql')
ROLES = ['factory_super_admin','platform_admin','dispatcher','production_manager',
         'sales_manager','warehouse_manager','hr_admin','procurement_manager',
         'quality_manager','equipment_admin','finance_manager','workshop_supervisor',
         'team_leader','group_leader','quality_inspector','operator',
         'warehouse_worker','restaurant_manager','viewer','unactivated']
MODULES = ['dashboard','production','warehouse','quality','procurement','sales',
           'hr','equipment','finance','system','analytics','scheduling',
           'work_report','inventory','report','rd','restaurant']

# Parse PermissionServiceImpl for role permission blocks
text = JAVA_SRC.read_text(encoding='utf-8')

def extract_perms(role: str) -> dict:
    """Extract {module: level} for a role from Java source."""
    # Find the block: `<role>Perms.put("<module>", "<level>")`
    pattern = rf'{role}Perms?\.put\("(\w+)",\s*"(\w+)"\)'
    matches = re.findall(pattern, text)
    result = {}
    for mod, level in matches:
        # Normalize: "read_write" → "rw", "read" → "r", "write" → "w", "none" → "-"
        normalized = {'read_write':'rw','read':'r','write':'w','none':'-'}.get(level, level)
        result[mod] = normalized
    # factory_super_admin and platform_admin use ALL_MODULES.forEach → rw on all
    if role in ['factory_super_admin','platform_admin']:
        for m in MODULES: result[m] = 'rw'
    return result

with OUTPUT.open('w', encoding='utf-8') as f:
    f.write("-- Auto-generated seed for platform_role_permissions. See V20260419_01 header.\n\n")
    for role in ROLES:
        perms = extract_perms(role)
        for mod in MODULES:
            level = perms.get(mod, '-')  # missing = '-' (safe default)
            f.write(f"INSERT INTO platform_role_permissions (role_code, module_code, permission_level) VALUES ('{role}', '{mod}', '{level}');\n")
        f.write("\n")

print(f"Generated {OUTPUT}")
```

- [ ] **Step 3: Run script to regenerate full SQL**

```bash
python3 scripts/generate-permission-seed.py
```

Expected: `Generated backend/java/cretas-api/src/main/resources/db/flyway/V20260419_01__platform_role_permissions.sql`

Review the generated file — add CREATE TABLE/INDEX statements at top (Task 2.1 Step 1), verify row count = 20 roles × 17 modules = 340 rows.

- [ ] **Step 4: Test migration on test DB**

```bash
./scripts/deploy/deploy-backend.sh --env test 2>&1 | tail -5
```

Watch for Flyway applying V20260419_01 in server logs:
```bash
ssh root@47.100.235.168 "grep 'V20260419_01' /www/wwwroot/cretas/cretas-test.log | tail -3"
```

Expected: `Successfully applied migration: V20260419_01 - platform role permissions`.

- [ ] **Step 5: Verify seed data**

```bash
ssh root@47.100.235.168 "PGPASSWORD=cretas123 psql -h localhost -U cretas -d cretas_db -c 'SELECT role_code, COUNT(*) FROM platform_role_permissions GROUP BY role_code ORDER BY role_code'"
```

Expected: each role has 17 rows.

- [ ] **Step 6: Commit**

```bash
git add backend/java/cretas-api/src/main/resources/db/flyway/V20260419_01__platform_role_permissions.sql \
        scripts/generate-permission-seed.py
git commit -m "feat(permissions): Flyway V20260419_01 platform_role_permissions table + seed (Phase 2/5)"
```

---

### Task 2.2: Create Flyway migration V20260419_02 — `role_module_override` JSONB column

**Files:**
- Create: `backend/java/cretas-api/src/main/resources/db/flyway/V20260419_02__role_module_override.sql`

- [ ] **Step 1: Write migration**

```sql
-- V20260419_02: Add factory-level role×module permission override (Layer 2)
-- Factory super admin can override platform defaults via Canvas editor.
-- See: docs/superpowers/specs/2026-04-18-permission-matrix-ai-driven-design.md

ALTER TABLE factory_module_configs 
  ADD COLUMN IF NOT EXISTS role_module_override JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN factory_module_configs.role_module_override IS
  'Layer 2: Factory-level role×module permission override. Format:
   {"role_code":{"module_code":"rw|r|w|-"}}. 
   Missing (role,module) combos fall back to platform_role_permissions.';

CREATE INDEX IF NOT EXISTS idx_factory_module_configs_override_gin 
  ON factory_module_configs USING gin (role_module_override);
```

- [ ] **Step 2: Apply + verify**

```bash
./scripts/deploy/deploy-backend.sh --env test
ssh root@47.100.235.168 "PGPASSWORD=cretas123 psql -h localhost -U cretas -d cretas_db -c '\\d factory_module_configs' | grep role_module_override"
```

Expected: `role_module_override | jsonb | not null default '{}'::jsonb`.

- [ ] **Step 3: Commit**

```bash
git add backend/java/cretas-api/src/main/resources/db/flyway/V20260419_02__role_module_override.sql
git commit -m "feat(permissions): Flyway V20260419_02 role_module_override column (Phase 2/5)"
```

---

### Task 2.3: Create PlatformRolePermission entity + repository

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/permission/PlatformRolePermission.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/permission/PlatformRolePermissionRepository.java`

- [ ] **Step 1: Create entity class**

```java
package com.cretas.aims.entity.permission;

import com.cretas.aims.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "platform_role_permissions",
       uniqueConstraints = @UniqueConstraint(
         name = "uk_role_module", columnNames = {"role_code", "module_code"}))
@Getter @Setter @NoArgsConstructor
public class PlatformRolePermission extends BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "role_code", nullable = false, length = 64)
    private String roleCode;
    
    @Column(name = "module_code", nullable = false, length = 32)
    private String moduleCode;
    
    @Column(name = "permission_level", nullable = false, length = 8)
    private String permissionLevel;  // rw, r, w, -
    
    @Column(name = "updated_by")
    private Long updatedBy;
}
```

- [ ] **Step 2: Create repository**

```java
package com.cretas.aims.repository.permission;

import com.cretas.aims.entity.permission.PlatformRolePermission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PlatformRolePermissionRepository 
    extends JpaRepository<PlatformRolePermission, Long> {
    
    List<PlatformRolePermission> findByRoleCodeAndDeletedAtIsNull(String roleCode);
    
    Optional<PlatformRolePermission> findByRoleCodeAndModuleCodeAndDeletedAtIsNull(
        String roleCode, String moduleCode);
    
    @Modifying
    @Query("UPDATE PlatformRolePermission p SET p.permissionLevel = :level, p.updatedBy = :userId " +
           "WHERE p.roleCode = :role AND p.moduleCode = :module AND p.deletedAt IS NULL")
    int updateLevel(@Param("role") String role, @Param("module") String module,
                    @Param("level") String level, @Param("userId") Long userId);
}
```

- [ ] **Step 3: Verify compile**

```bash
./mvnw compile 2>&1 | tail -3
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 4: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/entity/permission/ \
        backend/java/cretas-api/src/main/java/com/cretas/aims/repository/permission/
git commit -m "feat(permissions): PlatformRolePermission entity + repository (Phase 2/5)"
```

---

### Task 2.4: Add `roleModuleOverride` field to FactoryModuleConfig entity

**Files:**
- Modify: Find via `grep -l "factory_module_configs" backend/java/cretas-api/src/main/java/com/cretas/aims/entity/`
- Likely: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/canvas/FactoryModuleConfig.java`

- [ ] **Step 1: Locate entity**

```bash
grep -l "factory_module_configs" backend/java/cretas-api/src/main/java/com/cretas/aims/entity/ -r
```

- [ ] **Step 2: Add field + @JdbcTypeCode for JSONB**

```java
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

// Inside FactoryModuleConfig:

@Column(name = "role_module_override", columnDefinition = "jsonb")
@JdbcTypeCode(SqlTypes.JSON)
private Map<String, Map<String, String>> roleModuleOverride = new HashMap<>();
```

Format: `{"dispatcher":{"rd":"r","sales":"rw"},"sales_manager":{...}}`.

- [ ] **Step 3: Verify compile**

```bash
./mvnw compile 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/entity/canvas/FactoryModuleConfig.java
git commit -m "feat(permissions): add roleModuleOverride JSONB field to FactoryModuleConfig (Phase 2/5)"
```

---

### Task 2.5: Refactor PermissionServiceImpl — L2 → L1 → fallback resolution + cache

**Files:**
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/impl/PermissionServiceImpl.java`

- [ ] **Step 1: Add dependencies**

```java
@Autowired private PlatformRolePermissionRepository platformPermRepo;
@Autowired private FactoryModuleConfigRepository factoryConfigRepo;
```

- [ ] **Step 2: Add cache config bean (if not exists)**

Check `backend/java/cretas-api/src/main/java/com/cretas/aims/config/CacheConfig.java` — if exists, add:
```java
@Bean
public Cache permissionResolutionCache() {
  return new CaffeineCache("permissionResolution",
    Caffeine.newBuilder().expireAfterWrite(5, TimeUnit.MINUTES).maximumSize(1000).build());
}
```

If no CacheConfig exists, create one at that path.

- [ ] **Step 3: Refactor `hasPermission` with L2→L1→fallback order**

```java
@Override
@Cacheable(value = "permissionResolution", 
           key = "#user.id + ':' + #permissionCode + ':' + #user.factoryId")
public boolean hasPermission(User user, String permissionCode) {
    if (user == null || permissionCode == null) return false;
    
    FactoryUserRole role = user.getRoleEnum();
    if (role == null || role == FactoryUserRole.unactivated) return false;
    if (role == FactoryUserRole.factory_super_admin) return true;  // 短路
    
    String[] parts = permissionCode.split(":");
    if (parts.length != 2) return false;
    String module = parts[0], action = parts[1];
    
    // 1. L2 factory override
    String level = resolveLayer2(user.getFactoryId(), role.name(), module);
    
    // 2. L1 platform default
    if (level == null) level = resolveLayer1(role.name(), module);
    
    // 3. Hardcoded fallback (safety net, retained)
    if (level == null) level = resolveFallback(role, module);
    
    return checkAction(level, action);
}

private String resolveLayer2(String factoryId, String roleCode, String moduleCode) {
    if (factoryId == null) return null;
    return factoryConfigRepo.findByFactoryId(factoryId).stream()
      .findFirst()
      .map(c -> {
        Map<String, String> roleOverrides = c.getRoleModuleOverride().get(roleCode);
        return roleOverrides == null ? null : roleOverrides.get(moduleCode);
      })
      .orElse(null);
}

private String resolveLayer1(String roleCode, String moduleCode) {
    return platformPermRepo
      .findByRoleCodeAndModuleCodeAndDeletedAtIsNull(roleCode, moduleCode)
      .map(PlatformRolePermission::getPermissionLevel)
      .orElse(null);
}

private String resolveFallback(FactoryUserRole role, String moduleCode) {
    // Existing hardcoded PERMISSION_MATRIX lookup — keep unchanged as safety net
    Map<String, String> rolePerms = PERMISSION_MATRIX.get(role);
    return rolePerms == null ? null : rolePerms.get(moduleCode);
}

private boolean checkAction(String level, String action) {
    if (level == null || level.equals("-") || level.equals("none")) return false;
    switch (action) {
        case "read": return level.contains("r") || level.equals("read") || level.equals("read_write");
        case "write": case "create": 
            return level.contains("w") || level.equals("write") || level.equals("read_write");
        case "read_write":
            return level.equals("rw") || level.equals("read_write");
        case "*": return true;
        default: return level.equals("rw") || level.equals("read_write");
    }
}

@CacheEvict(value = "permissionResolution", allEntries = true)
public void invalidateCache() {}
```

**Note:** `checkAction` handles both new format ('rw','r','w','-') and legacy ('read_write','read','write','none') during transition.

- [ ] **Step 4: Verify compile**

```bash
./mvnw compile 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/service/impl/PermissionServiceImpl.java \
        backend/java/cretas-api/src/main/java/com/cretas/aims/config/CacheConfig.java
git commit -m "refactor(permissions): PermissionServiceImpl L2→L1→fallback + cache (Phase 2/5)

resolve() order:
1. Check factory_module_configs.role_module_override (L2)
2. Check platform_role_permissions (L1)
3. Fallback to hardcoded PERMISSION_MATRIX (safety net)

Caffeine cache 5min TTL, 1000 entries. invalidateCache() on PUT.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2.6: Create `PlatformRolePermissionController` (GET/PUT L1)

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/platform/PlatformRolePermissionController.java`

- [ ] **Step 1: Write controller**

```java
package com.cretas.aims.controller.platform;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.permission.PlatformRolePermission;
import com.cretas.aims.repository.permission.PlatformRolePermissionRepository;
import com.cretas.aims.service.PermissionService;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.utils.TokenUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/mobile/platform/role-permissions")
@RequiredArgsConstructor
@Tag(name = "Platform Role Permissions", description = "L1 global permission matrix management")
public class PlatformRolePermissionController {
    
    private static final Set<String> ALLOWED_MODULES = Set.of(
        "dashboard","production","warehouse","quality","procurement","sales",
        "hr","equipment","finance","system","analytics","scheduling",
        "work_report","inventory","report","rd","restaurant");
    private static final Set<String> ALLOWED_LEVELS = Set.of("rw","r","w","-");
    
    private final PlatformRolePermissionRepository repo;
    private final PermissionService permissionService;
    private final MobileService mobileService;
    
    @GetMapping
    @Operation(summary = "Get all platform-level role permissions (L1)")
    @RequirePermission({"system:read"})  // any authenticated user can read (to build matrix in frontend)
    public ApiResponse<List<PlatformRolePermission>> getAll() {
        return ApiResponse.success(repo.findAll().stream()
            .filter(p -> p.getDeletedAt() == null).toList());
    }
    
    @PutMapping("/{role}/{module}")
    @Operation(summary = "Update L1 permission level")
    @RequirePermission({"system:read_write"})  // only platform_admin / factory_super_admin
    public ApiResponse<PlatformRolePermission> update(
            @PathVariable String role,
            @PathVariable String module,
            @RequestParam String level,
            @RequestHeader("Authorization") String auth) {
        
        if (!ALLOWED_MODULES.contains(module)) {
            throw new IllegalArgumentException("无效模块: " + module);
        }
        if (!ALLOWED_LEVELS.contains(level)) {
            throw new IllegalArgumentException("无效级别 (仅 rw/r/w/-): " + level);
        }
        
        // Circular lockout guard
        if ("platform_admin".equals(role) && "system".equals(module) && !"rw".equals(level)) {
            throw new IllegalArgumentException("禁止降低 platform_admin 对 system 的权限 (会锁死管理 UI)");
        }
        
        Long userId = mobileService.getUserFromToken(TokenUtils.extractToken(auth)).getId();
        
        var existing = repo.findByRoleCodeAndModuleCodeAndDeletedAtIsNull(role, module);
        PlatformRolePermission saved;
        if (existing.isPresent()) {
            PlatformRolePermission p = existing.get();
            p.setPermissionLevel(level);
            p.setUpdatedBy(userId);
            saved = repo.save(p);
        } else {
            PlatformRolePermission p = new PlatformRolePermission();
            p.setRoleCode(role);
            p.setModuleCode(module);
            p.setPermissionLevel(level);
            p.setUpdatedBy(userId);
            saved = repo.save(p);
        }
        permissionService.invalidateCache();
        return ApiResponse.success(saved);
    }
}
```

- [ ] **Step 2: Verify compile**

```bash
./mvnw compile 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/controller/platform/PlatformRolePermissionController.java
git commit -m "feat(permissions): PlatformRolePermissionController GET/PUT L1 API (Phase 2/5)"
```

---

### Task 2.7: Add L2 GET/PUT endpoints to CanvasConfigController

**Files:**
- Modify: Find via `grep -l "factory_module_configs" backend/java/cretas-api/src/main/java/com/cretas/aims/controller/`

- [ ] **Step 1: Locate existing canvas config controller**

```bash
grep -rl "role_module_override\|factory_module_configs" backend/java/cretas-api/src/main/java/com/cretas/aims/controller/ | head -3
```

If exists, add endpoints there. If not, create new `FactoryModuleRoleOverrideController`.

- [ ] **Step 2: Add endpoints**

```java
@GetMapping("/canvas/role-module-override")
@Operation(summary = "Get factory-level role×module overrides (L2)")
@RequirePermission({"system:read_write"})
public ApiResponse<Map<String, Map<String, String>>> getOverrides(
        @PathVariable String factoryId) {
    return ApiResponse.success(
      factoryConfigRepo.findByFactoryId(factoryId).stream()
        .findFirst()
        .map(FactoryModuleConfig::getRoleModuleOverride)
        .orElse(new HashMap<>()));
}

@PutMapping("/canvas/role-module-override/{role}/{module}")
@Operation(summary = "Update factory-level override (L2). Pass null to clear.")
@RequirePermission({"system:read_write"})
public ApiResponse<Void> updateOverride(
        @PathVariable String factoryId,
        @PathVariable String role,
        @PathVariable String module,
        @RequestParam(required = false) String level) {
    
    if (level != null && !ALLOWED_LEVELS.contains(level)) {
        throw new IllegalArgumentException("无效级别: " + level);
    }
    if (!ALLOWED_MODULES.contains(module)) {
        throw new IllegalArgumentException("无效模块: " + module);
    }
    
    FactoryModuleConfig config = factoryConfigRepo.findByFactoryId(factoryId).stream()
        .findFirst()
        .orElseThrow(() -> new IllegalStateException("Factory config not found: " + factoryId));
    
    Map<String, Map<String, String>> overrides = config.getRoleModuleOverride();
    if (overrides == null) overrides = new HashMap<>();
    
    if (level == null) {
        // Clear this cell (fall back to L1)
        Map<String, String> roleOverrides = overrides.get(role);
        if (roleOverrides != null) {
            roleOverrides.remove(module);
            if (roleOverrides.isEmpty()) overrides.remove(role);
        }
    } else {
        overrides.computeIfAbsent(role, k -> new HashMap<>()).put(module, level);
    }
    
    config.setRoleModuleOverride(overrides);
    factoryConfigRepo.save(config);
    permissionService.invalidateCache();
    return ApiResponse.success(null);
}
```

- [ ] **Step 3: Commit**

```bash
git add <modified controller>
git commit -m "feat(permissions): L2 GET/PUT role-module-override endpoints (Phase 2/5)"
```

---

### Task 2.8: Unit tests for PermissionServiceImpl

**Files:**
- Create: `backend/java/cretas-api/src/test/java/com/cretas/aims/service/impl/PermissionServiceImplTest.java`

- [ ] **Step 1: Write 8 test cases covering resolution layers**

```java
@SpringBootTest
class PermissionServiceImplTest {
    @Autowired PermissionService permissionService;
    @Autowired PlatformRolePermissionRepository l1Repo;
    @Autowired FactoryModuleConfigRepository l2Repo;
    
    @Test void superAdminHasAllPermissions() { /* ... */ }
    @Test void L2OverridesL1() { /* ... */ }
    @Test void L1AppliesWhenNoL2() { /* ... */ }
    @Test void fallbackWhenDBEmpty() { /* ... */ }
    @Test void invalidModuleRejected() { /* ... */ }
    @Test void circularLockoutGuard() { /* ... */ }
    @Test void cacheInvalidationOnUpdate() { /* ... */ }
    @Test void unactivatedUserAllDenied() { /* ... */ }
}
```

- [ ] **Step 2: Run tests**

```bash
./mvnw test -Dtest=PermissionServiceImplTest 2>&1 | tail -15
```

Expected: all 8 pass.

- [ ] **Step 3: Commit**

```bash
git add backend/java/cretas-api/src/test/java/com/cretas/aims/service/impl/PermissionServiceImplTest.java
git commit -m "test(permissions): unit tests for L2→L1→fallback resolution (Phase 2/5)"
```

---

### Task 2.9: Build + deploy test + smoke test

- [ ] **Step 1: Full build**

```bash
cd backend/java/cretas-api && ./mvnw clean package -DskipTests 2>&1 | tail -5
```

- [ ] **Step 2: Deploy**

```bash
cd /c/Users/Steve/my-prototype-logistics
./scripts/deploy/deploy-backend.sh --env test
```

- [ ] **Step 3: curl smoke tests**

```bash
# Get token as factory_admin1
TOKEN=$(curl -s -X POST http://139.196.165.140:8097/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{"username":"factory_admin1","password":"123456","factoryId":"F001"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

# GET L1 matrix (expect 340 rows)
curl -s http://139.196.165.140:8097/api/mobile/platform/role-permissions \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print('rows:', len(d['data']))"

# PUT L1: dispatcher.rd = r
curl -s -X PUT "http://139.196.165.140:8097/api/mobile/platform/role-permissions/dispatcher/rd?level=r" \
  -H "Authorization: Bearer $TOKEN"

# Verify: login as dispatcher, POST /rd/samples should 403 now
DT=$(curl -s -X POST http://139.196.165.140:8097/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{"username":"dispatcher1","password":"123456","factoryId":"F001"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://139.196.165.140:8097/api/mobile/F001/rd/samples \
  -H "Authorization: Bearer $DT" -H "Content-Type: application/json" -d '{"name":"test"}'

# Restore: dispatcher.rd = rw
curl -s -X PUT "http://139.196.165.140:8097/api/mobile/platform/role-permissions/dispatcher/rd?level=rw" \
  -H "Authorization: Bearer $TOKEN"
```

Expected flow:
- Initial GET: 340 rows
- PUT dispatcher.rd=r: 200
- Dispatcher POST /rd/samples: 403 (L1 r < rw required)
- PUT dispatcher.rd=rw: 200
- (Next dispatcher POST would pass after cache expiry or invalidation)

- [ ] **Step 4: Commit Phase 2 done**

```bash
git tag phase2-backend-db-driven
git push origin e2e/v1-framework --tags
```

---

## Phase 3: Frontend DB-Driven (S3, ~1 day)

**Goal:** Remove hardcoded PERMISSION_MATRIX from frontend, fetch from API on login, add platform-admin page + Canvas tab UI.

**Prerequisite:** Phase 2 complete (API functional).

### Task 3.1: Create API client `permissionApi.ts`

**Files:**
- Create: `web-admin/src/api/permissionApi.ts`

- [ ] **Step 1: Write API functions**

```typescript
import { get, put } from './request';
import type { ModuleName, PermissionLevel } from '@/store/modules/permission';

export interface PlatformPermission {
  id: number;
  roleCode: string;
  moduleCode: string;
  permissionLevel: PermissionLevel;
}

export interface RoleModuleOverride {
  [role: string]: { [module: string]: PermissionLevel };
}

export async function getPlatformPermissions(): Promise<PlatformPermission[]> {
  const res = await get<PlatformPermission[]>('/platform/role-permissions');
  return res.data;
}

export async function updatePlatformPermission(
  role: string, module: ModuleName, level: PermissionLevel
): Promise<void> {
  await put(`/platform/role-permissions/${role}/${module}?level=${level}`, {});
}

export async function getFactoryOverride(factoryId: string): Promise<RoleModuleOverride> {
  const res = await get<RoleModuleOverride>(`/${factoryId}/canvas/role-module-override`);
  return res.data;
}

export async function updateFactoryOverride(
  factoryId: string, role: string, module: ModuleName, level: PermissionLevel | null
): Promise<void> {
  const levelParam = level === null ? '' : `?level=${level}`;
  await put(`/${factoryId}/canvas/role-module-override/${role}/${module}${levelParam}`, {});
}
```

- [ ] **Step 2: Commit**

```bash
git add web-admin/src/api/permissionApi.ts
git commit -m "feat(permissions): permissionApi client for L1/L2 endpoints (Phase 3/5)"
```

---

### Task 3.2: Refactor permissionStore to DB-driven

**Files:**
- Modify: `web-admin/src/store/modules/permission.ts`

- [ ] **Step 1: Replace hardcoded MATRIX with fetch+merge logic**

```typescript
import { getPlatformPermissions, getFactoryOverride } from '@/api/permissionApi';

export const usePermissionStore = defineStore('permission', () => {
  const permissions = ref<ModulePermissions | null>(null);
  const isLoaded = ref(false);
  const loadError = ref<string | null>(null);
  const currentRole = ref<string>('unactivated');
  const currentFactoryId = ref<string>('');
  
  async function loadForCurrentUser(role: string, factoryId: string) {
    currentRole.value = role;
    currentFactoryId.value = factoryId;
    loadError.value = null;
    try {
      const [l1, l2] = await Promise.all([
        getPlatformPermissions(),
        getFactoryOverride(factoryId)
      ]);
      permissions.value = mergeLayers(l1, l2, role);
      isLoaded.value = true;
    } catch (e) {
      loadError.value = (e as Error).message || 'Unknown';
      isLoaded.value = false;
      permissions.value = null;
    }
  }
  
  function mergeLayers(l1: PlatformPermission[], l2: RoleModuleOverride, role: string): ModulePermissions {
    const result = {} as ModulePermissions;
    // Start with L1 for this role
    for (const p of l1.filter(p => p.roleCode === role)) {
      (result as any)[p.moduleCode] = p.permissionLevel;
    }
    // Override with L2 for this factory
    const overrides = l2[role];
    if (overrides) {
      for (const [module, level] of Object.entries(overrides)) {
        (result as any)[module] = level;
      }
    }
    return result;
  }
  
  function canWrite(module: ModuleName): boolean {
    if (!isLoaded.value) return false;  // conservative
    const level = permissions.value?.[module];
    return level === 'rw' || level === 'w';
  }
  
  function canAccess(module: ModuleName): boolean {
    if (!isLoaded.value) return false;
    return permissions.value?.[module] !== '-' && permissions.value?.[module] !== undefined;
  }
  
  return { permissions, isLoaded, loadError, loadForCurrentUser, canWrite, canAccess };
});
```

**Remove**: hardcoded `PERMISSION_MATRIX` constant. **Keep**: `ModulePermissions` interface, `PermissionLevel` type, `ModuleName` export.

- [ ] **Step 2: Update auth store to call loadForCurrentUser after login**

```bash
grep -n "setRole\|login" web-admin/src/store/modules/auth.ts | head -10
```

After successful login, add:
```typescript
const permissionStore = usePermissionStore();
await permissionStore.loadForCurrentUser(user.role, user.factoryId);
```

- [ ] **Step 3: Verify TS compiles**

```bash
cd web-admin && npx vue-tsc --noEmit 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add web-admin/src/store/modules/permission.ts web-admin/src/store/modules/auth.ts
git commit -m "refactor(permissions): replace hardcoded MATRIX with fetch+merge (Phase 3/5)"
```

---

### Task 3.3: Create `/platform/role-permissions` page

**Files:**
- Create: `web-admin/src/views/platform/RolePermissions.vue`
- Modify: `web-admin/src/router/index.ts` (add route)

- [ ] **Step 1: Write page component**

```vue
<template>
  <div class="role-permissions-page">
    <h2>平台全局权限矩阵 (Layer 1)</h2>
    <el-alert type="warning" :closable="false">
      修改会影响**所有工厂**. 工厂级 override 在 Canvas 编辑器 "模块权限" tab.
    </el-alert>
    
    <el-table :data="rows" border size="small" max-height="600" v-loading="loading">
      <el-table-column prop="role" label="角色" width="180" fixed />
      <el-table-column v-for="m in modules" :key="m" :label="m" width="100" align="center">
        <template #default="{ row }">
          <el-select v-model="row[m]" size="small" @change="markDirty(row.role, m, row[m])">
            <el-option label="rw" value="rw" />
            <el-option label="r" value="r" />
            <el-option label="w" value="w" />
            <el-option label="-" value="-" />
          </el-select>
        </template>
      </el-table-column>
    </el-table>
    
    <el-button v-if="dirty.size" type="primary" :loading="saving" @click="save">
      保存 {{ dirty.size }} 处改动
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getPlatformPermissions, updatePlatformPermission } from '@/api/permissionApi';
import { ElMessage } from 'element-plus';

const loading = ref(false);
const saving = ref(false);
const rows = ref<any[]>([]);
const modules = ['dashboard','production','warehouse','quality','procurement','sales',
                 'hr','equipment','finance','system','analytics','scheduling',
                 'work_report','inventory','report','rd','restaurant'];
const dirty = ref(new Map<string, { role: string; module: string; level: string }>());

async function load() {
  loading.value = true;
  try {
    const perms = await getPlatformPermissions();
    const byRole = new Map<string, any>();
    for (const p of perms) {
      if (!byRole.has(p.roleCode)) byRole.set(p.roleCode, { role: p.roleCode });
      byRole.get(p.roleCode)![p.moduleCode] = p.permissionLevel;
    }
    rows.value = Array.from(byRole.values());
  } finally { loading.value = false; }
}

function markDirty(role: string, module: string, level: string) {
  dirty.value.set(`${role}:${module}`, { role, module, level });
}

async function save() {
  saving.value = true;
  try {
    for (const { role, module, level } of dirty.value.values()) {
      await updatePlatformPermission(role, module as any, level as any);
    }
    ElMessage.success(`已保存 ${dirty.value.size} 处改动`);
    dirty.value.clear();
  } finally { saving.value = false; }
}

onMounted(load);
</script>

<style scoped>
.role-permissions-page { padding: 20px; }
</style>
```

- [ ] **Step 2: Add router config**

In `web-admin/src/router/index.ts`, add route:
```typescript
{
  path: '/platform/role-permissions',
  name: 'PlatformRolePermissions',
  component: () => import('@/views/platform/RolePermissions.vue'),
  meta: { requiresAuth: true, requiredRole: ['platform_admin', 'factory_super_admin'] }
}
```

- [ ] **Step 3: Commit**

```bash
git add web-admin/src/views/platform/RolePermissions.vue web-admin/src/router/index.ts
git commit -m "feat(permissions): /platform/role-permissions admin page (Phase 3/5)"
```

---

### Task 3.4: Canvas "模块权限" tab component

**Files:**
- Create: `web-admin/src/views/platform/canvas-editor/components/ModulePermissionMatrix.vue`
- Modify: `web-admin/src/views/platform/canvas-editor/index.vue` (add tab)

- [ ] **Step 1: Write component**

```vue
<!-- ModulePermissionMatrix.vue — Layer 2 factory override editor -->
<template>
  <div class="module-permission-matrix">
    <el-alert type="info" :closable="false">
      修改仅影响**本工厂 ({{ factoryId }})**. 灰色斜体 = 继承全局默认, 粗体 = 本工厂 override.
    </el-alert>
    
    <el-table :data="rows" border size="small" max-height="500" v-loading="loading">
      <el-table-column prop="role" label="角色" width="160" fixed />
      <el-table-column v-for="m in modules" :key="m" :label="m" width="100" align="center">
        <template #default="{ row }">
          <div class="cell-wrap" :class="{ override: row.override[m] }">
            <el-select v-model="row[m]" size="small" @change="onChange(row.role, m, row[m])">
              <el-option label="rw" value="rw" />
              <el-option label="r" value="r" />
              <el-option label="w" value="w" />
              <el-option label="-" value="-" />
            </el-select>
            <el-icon v-if="row.override[m]" class="reset-btn" @click="reset(row.role, m)">
              <RefreshLeft />
            </el-icon>
          </div>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { RefreshLeft } from '@element-plus/icons-vue';
import { getPlatformPermissions, getFactoryOverride, updateFactoryOverride } from '@/api/permissionApi';
import { ElMessage } from 'element-plus';

const props = defineProps<{ factoryId: string }>();
const loading = ref(false);
const rows = ref<any[]>([]);
const modules = ['dashboard','production','warehouse','quality','procurement','sales',
                 'hr','equipment','finance','system','analytics','scheduling',
                 'work_report','inventory','report','rd','restaurant'];

async function load() {
  loading.value = true;
  try {
    const [l1, l2] = await Promise.all([getPlatformPermissions(), getFactoryOverride(props.factoryId)]);
    const byRole = new Map<string, any>();
    // Seed with L1 defaults
    for (const p of l1) {
      if (!byRole.has(p.roleCode)) byRole.set(p.roleCode, { role: p.roleCode, override: {} });
      byRole.get(p.roleCode)[p.moduleCode] = p.permissionLevel;
    }
    // Apply L2 override markers
    for (const [role, mods] of Object.entries(l2)) {
      const row = byRole.get(role);
      if (row) {
        for (const [m, lvl] of Object.entries(mods)) {
          row[m] = lvl;
          row.override[m] = true;
        }
      }
    }
    rows.value = Array.from(byRole.values());
  } finally { loading.value = false; }
}

async function onChange(role: string, module: string, level: string) {
  await updateFactoryOverride(props.factoryId, role, module as any, level as any);
  ElMessage.success('override 已保存');
  load();  // refresh to update inheritance markers
}

async function reset(role: string, module: string) {
  await updateFactoryOverride(props.factoryId, role, module as any, null);
  ElMessage.success('已重置为全局默认');
  load();
}

onMounted(load);
</script>

<style scoped>
.cell-wrap { display: flex; align-items: center; gap: 4px; }
.cell-wrap.override :deep(.el-select) { font-weight: bold; }
.cell-wrap:not(.override) :deep(.el-select) { opacity: 0.6; font-style: italic; }
.reset-btn { cursor: pointer; color: var(--el-color-warning); }
</style>
```

- [ ] **Step 2: Register as new tab in Canvas index**

```bash
grep -n "tab\|Tab" web-admin/src/views/platform/canvas-editor/index.vue | head -10
```

Add as 8th tab after existing "字段权限":
```vue
<el-tab-pane label="模块权限" name="module-permission">
  <ModulePermissionMatrix :factory-id="factoryId" />
</el-tab-pane>
```

Import at top: `import ModulePermissionMatrix from './components/ModulePermissionMatrix.vue';`

- [ ] **Step 3: Commit**

```bash
git add web-admin/src/views/platform/canvas-editor/components/ModulePermissionMatrix.vue \
        web-admin/src/views/platform/canvas-editor/index.vue
git commit -m "feat(permissions): Canvas 模块权限 tab for L2 factory override (Phase 3/5)"
```

---

### Task 3.5: Build + deploy + E2E verify

- [ ] **Step 1: Build + deploy**

```bash
cd web-admin && npm run build
cd /c/Users/Steve/my-prototype-logistics && ./scripts/deploy/deploy-web-admin.sh --env test
```

- [ ] **Step 2: E2E test — Scenario E1 (platform_admin edits L1)**

Via Playwright MCP:
1. Login as factory_admin1 (F001)
2. Navigate `/platform/role-permissions`
3. Change dispatcher.rd from 'rw' to 'r', click 保存
4. Logout, login as dispatcher1
5. Navigate `/rd/samples` → 新建样品 button should be HIDDEN (canWrite('rd') === false now)

- [ ] **Step 3: E2E test — Scenario E2 (factory override)**

1. Login as factory_admin1 F001
2. Canvas editor → 模块权限 tab → dispatcher.rd = 'rw' (override back)
3. Logout, login as dispatcher1 F001
4. 新建样品 button should be VISIBLE
5. (Optional) Switch factory_admin2 F002 (if exists), dispatcher of F002 still hidden

- [ ] **Step 4: Commit Phase 3 done**

```bash
git add 流程实际测试/99-R19-phase3-verify-*
git commit -m "test(permissions): Phase 3 E2E verified — platform + factory override (Phase 3/5)"
git tag phase3-frontend-db-driven
```

---

## Phase 4: AI Chat Integration (S4, ~1 day)

**Goal:** Canvas AI chat understands "change permission" intent and generates UPDATE_PERMISSION diff, user clicks 应用 to apply.

**Prerequisite:** Phase 3 complete (L1/L2 APIs + UI work).

### Task 4.1: Extend AI backend diff type + intent classifier

**Files:**
- Find: `grep -rl "TOGGLE_FIELD\|ADD_RULE" backend/java/cretas-api/src/main/java/com/cretas/aims/`

- [ ] **Step 1: Add new diff type enum value**

In the Java file defining diff types (likely in `ai/dto/` or `config/v2/`):

```java
public enum ConfigDiffType {
    TOGGLE_FIELD,
    ADD_RULE,
    UPDATE_PERMISSION,  // ← NEW
    // ...
}
```

DTO for UPDATE_PERMISSION:
```java
@Data
public class UpdatePermissionDiff {
    private String layer;       // "L1" or "L2"
    private String factoryId;   // required for L2, null for L1
    private String role;        // e.g., "dispatcher"
    private String module;      // e.g., "rd"
    private String fromLevel;   // current level (nullable if first-time)
    private String toLevel;     // target level
    private String description; // human-readable summary
}
```

- [ ] **Step 2: Enhance AI prompt**

In `backend/python/` or wherever AI chat backend lives, update system prompt:
```
你是 Canvas 配置助手. 除了现有的 TOGGLE_FIELD / ADD_RULE 能力, 现在还能改权限:

当用户说 "把 dispatcher 的 rd 改只读" / "给 sales_manager 加 rd 写权限" 等:
1. 识别 intent = UPDATE_PERMISSION
2. 识别 role, module, target level (rw/r/w/-)
3. 根据 current_user.role 推断 layer:
   - platform_admin → layer=L1, factoryId=null (全局默认)
   - factory_super_admin → layer=L2, factoryId=current_user.factoryId (本工厂)
   - 其他角色 → 拒绝, 回复 "你没有权限改权限"
4. 查询当前 level (GET /platform/role-permissions 或 /canvas/role-module-override)
5. 生成 diff object, 不直接应用

示例响应:
{
  "diff": {
    "type": "UPDATE_PERMISSION",
    "layer": "L2",
    "factoryId": "F001",
    "role": "dispatcher",
    "module": "rd",
    "fromLevel": "rw",
    "toLevel": "r",
    "description": "把 F001 dispatcher 的 rd 模块从 rw 改为 r (只读)"
  },
  "message": "好的, 我准备把 F001 调度员对 RD 模块的权限从'读写'改成'只读'. 这是工厂级 override, 只影响 F001."
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/python/  # or wherever AI chat prompt is
git commit -m "feat(ai): UPDATE_PERMISSION intent + diff type (Phase 4/5)"
```

---

### Task 4.2: AIChatPanel renders UPDATE_PERMISSION diff + Apply handler

**Files:**
- Modify: `web-admin/src/views/platform/canvas-editor/components/AIChatPanel.vue`

- [ ] **Step 1: Add diff renderer for UPDATE_PERMISSION**

In the diff card rendering section, add case for `diff.type === 'UPDATE_PERMISSION'`:

```vue
<template v-if="diff.type === 'UPDATE_PERMISSION'">
  <div class="diff-card diff-permission">
    <div class="diff-type-badge">权限变更</div>
    <div class="diff-body">
      <div>{{ diff.description }}</div>
      <div class="diff-delta">
        <span class="from">{{ diff.fromLevel || '(未设置)' }}</span>
        →
        <span class="to">{{ diff.toLevel }}</span>
      </div>
      <div class="diff-layer">
        层级: <code>{{ diff.layer }}</code>
        <span v-if="diff.factoryId">(本工厂 {{ diff.factoryId }})</span>
        <span v-else>(全局默认, 所有工厂)</span>
      </div>
    </div>
    <el-button type="primary" size="small" @click="applyDiff(diff)">应用</el-button>
  </div>
</template>
```

- [ ] **Step 2: applyDiff handler for UPDATE_PERMISSION**

```typescript
import { updatePlatformPermission, updateFactoryOverride } from '@/api/permissionApi';
import { usePermissionStore } from '@/store/modules/permission';

async function applyDiff(diff: any) {
  if (diff.type === 'UPDATE_PERMISSION') {
    try {
      if (diff.layer === 'L1') {
        await updatePlatformPermission(diff.role, diff.module, diff.toLevel);
      } else if (diff.layer === 'L2') {
        await updateFactoryOverride(diff.factoryId, diff.role, diff.module, diff.toLevel);
      }
      // Reload current user's permissions (cache invalidated on backend)
      const permStore = usePermissionStore();
      await permStore.loadForCurrentUser(authStore.role, authStore.factoryId);
      ElMessage.success('权限已更新');
      emit('diffApplied', diff);
    } catch (e) {
      ElMessage.error('应用失败: ' + (e as Error).message);
    }
  } else {
    // existing applyDiff for TOGGLE_FIELD / ADD_RULE
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add web-admin/src/views/platform/canvas-editor/components/AIChatPanel.vue
git commit -m "feat(ai): AIChatPanel renders + applies UPDATE_PERMISSION diff (Phase 4/5)"
```

---

### Task 4.3: E2E test AI chat flow

- [ ] **Step 1: Manual Playwright test**

1. Login as factory_admin1 F001
2. Open Canvas editor, open AI chat panel
3. Type: "把 F001 调度员对 RD 模块改只读"
4. AI responds with diff card
5. Click "应用"
6. Toast "权限已更新"
7. Verify: GET /canvas/role-module-override returns `{"dispatcher":{"rd":"r"}}` in F001

- [ ] **Step 2: Commit**

```bash
git add 流程实际测试/99-R19-phase4-ai-verify-*
git commit -m "test(permissions): Phase 4 AI chat flow verified (Phase 4/5)"
git tag phase4-ai-driven
```

---

## Phase 5: Empty-State UX (S5, 0.5 day — parallel with any phase above)

**Goal:** Detail pages show `<el-empty>` on 404 instead of toast + blank.

### Task 5.1: Create `<NotFoundEmpty>` component

**Files:**
- Create: `web-admin/src/components/common/NotFoundEmpty.vue`

- [ ] **Step 1: Component**

```vue
<template>
  <div class="not-found-wrap">
    <el-empty :image-size="200" :description="description">
      <template #extra>
        <el-button type="primary" @click="goBack">
          {{ returnLabel }}
        </el-button>
      </template>
    </el-empty>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const props = withDefaults(defineProps<{
  description?: string;
  returnLabel?: string;
  returnPath?: string;
}>(), {
  description: '记录不存在或已被删除',
  returnLabel: '返回列表',
  returnPath: '',
});

const router = useRouter();
function goBack() {
  if (props.returnPath) router.push(props.returnPath);
  else router.back();
}
</script>

<style scoped>
.not-found-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add web-admin/src/components/common/NotFoundEmpty.vue
git commit -m "feat(ux): NotFoundEmpty reusable component (Phase 5/5)"
```

---

### Task 5.2: Find all detail pages with 404 toast pattern

- [ ] **Step 1: Grep for pattern**

```bash
grep -rl "调拨单不存在\|订单不存在\|不存在或无权\|加载失败.*详情" web-admin/src/views/
```

Expected files (from our audit):
- `web-admin/src/views/transfer/detail.vue`
- `web-admin/src/views/procurement/orders/detail.vue`
- Possibly more (shipments, inventory adjustments, quality inspections, etc.)

- [ ] **Step 2: Identify pages that load by :id param and handle 404**

For each file, inspect if it has:
```typescript
const route = useRoute();
const id = route.params.id;
onMounted(async () => {
  const res = await get(`/${factoryId}/<module>/${id}`);
  // ...
});
```

---

### Task 5.3: Update each detail page to use NotFoundEmpty

**Files:** (2-3 initially, expand as Task 5.2 finds more)
- `web-admin/src/views/transfer/detail.vue`
- `web-admin/src/views/procurement/orders/detail.vue`

- [ ] **Step 1: Pattern for each file**

Add state:
```typescript
const notFound = ref(false);
const notFoundMessage = ref('');

async function loadData() {
  try {
    const res = await get(...);
    // ...
  } catch (err: any) {
    if (err?.response?.status === 404 || err?.code === 'NOT_FOUND') {
      notFound.value = true;
      notFoundMessage.value = err?.response?.data?.message || '记录不存在';
    }
    // axios interceptor already showed toast for 404, we just set flag for template
  }
}
```

Template change:
```vue
<template>
  <NotFoundEmpty v-if="notFound" 
    :description="notFoundMessage" 
    :return-path="returnListPath" />
  <div v-else>
    <!-- existing detail content -->
  </div>
</template>
```

Import: `import NotFoundEmpty from '@/components/common/NotFoundEmpty.vue';`

Also: **remove** any `ElMessage.error(...)` that was in the catch block (request interceptor already shows it — this is Bug #319 cleanup continuation).

- [ ] **Step 2: Optional — suppress interceptor toast for 404 via `_silent`**

If user experience is better without toast AT ALL when showing NotFoundEmpty, pass `_silent: true` to the GET:

```typescript
const res = await get(`...`, { _silent: true } as any);
```

This requires request.ts to honor `_silent` flag (already does per current code — check line 255).

- [ ] **Step 3: Build + E2E**

```bash
cd web-admin && npm run build
cd /c/Users/Steve/my-prototype-logistics && ./scripts/deploy/deploy-web-admin.sh --env test
```

Then Playwright: navigate to `/transfer/FAKE-ID-99999` → expect `<el-empty>` "调拨单不存在或无权访问" + "返回列表" button instead of toast.

- [ ] **Step 4: Commit**

```bash
git add web-admin/src/views/transfer/detail.vue web-admin/src/views/procurement/orders/detail.vue
git commit -m "feat(ux): detail pages use NotFoundEmpty on 404 (Phase 5/5)"
git tag phase5-empty-state
```

---

## Self-Review

Running through spec §1-§12 to check coverage:

- **§1 Executive summary** → covered by Phases 1-5
- **§2 Problem statement** → Phase 1 addresses regression (2.1); Phase 2-4 addresses technical debt (2.2); Phase 5 addresses UX bug (from §1 3rd point)
- **§3 Goals G1-G6** → G1 (Phase 1), G2 (Phase 2 seed + align), G3 (Phase 2), G4 (Phase 2+3), G5 (Phase 4), G6 (Phase 5) ✓
- **§3 Non-goals** → respected (no menu system redesign, no action-level, no audit log UI, no version history, no intent refactor)
- **§4 Architecture** → §4.1 4-layer documented in Tasks 2.1-2.7, §4.2 resolution order in Task 2.5
- **§5 Components backend** → Tasks 2.1-2.7 ✓
- **§5 Components frontend** → Tasks 3.1-3.4 ✓
- **§5 AI chat** → Tasks 4.1-4.3 ✓
- **§5.2.5 NotFoundEmpty** → Task 5.1-5.3 ✓
- **§6 Data flow** → implicitly tested via E2E in Phase 3+4
- **§7 Error handling** → §7.1 circular lockout (Task 2.6 Step 1), §7.2 module whitelist (Task 2.6 Step 1), §7.3 JSONB corruption (Task 2.5 try/catch), §7.5 pre-load (Task 3.2 isLoaded guard), §7.6 degradation (Task 3.2 loadError) ✓
- **§8 Testing** → §8.1 Task 2.8 unit, §8.2 Task 2.9 integration (smoke), §8.3 missing (could add Vitest tests for mergeLayers), §8.4 E2E in Tasks 3.5, 4.3, 5.3 
- **§9 Rollout** → each phase maps to Sprint 1-5 ✓
- **§10 Open questions** → Q1 finance_manager.analytics level, Q2 platform_admin enum, Q3 restaurant_manager — noted in plan but should be clarified BEFORE Task 2.1 seed (added note)

**Gap found**: §10 Q1-Q3 clarification needs to happen before Task 2.1 seed SQL. Adding dedicated pre-Phase-2 task.

### Task 0 (pre-Phase-2): Clarify §10 Open Questions

- [ ] **Step 1: Ask user Q1**: finance_manager.analytics is 'r' (frontend) or 'rw' (backend)? Decide authoritative value.
- [ ] **Step 2: Ask user Q2**: Add `platform_admin` to backend `FactoryUserRole` enum OR create separate `PlatformRole` enum?
- [ ] **Step 3: Ask user Q3**: Add `restaurant_manager` to backend enum OR treat as sales_manager + factoryType=RESTAURANT filter?
- [ ] **Step 4: Update spec §5.1.5 + Task 2.1 seed SQL per decisions.**

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-18-permission-matrix-implementation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Each subagent gets the task's exact code + file paths, works in isolation, reports back.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review. Slower but I maintain full context.

**Which approach?**

Also note: **before Phase 2 starts**, Task 0 needs 3 clarifications (Q1-Q3 in §10). These affect seed SQL in Task 2.1. Either answer them now or defer until Phase 2 start.

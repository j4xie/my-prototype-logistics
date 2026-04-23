# Sub-1 PR1 Phase A — Foundation Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 5 docx-customer-reported web-admin form bugs + 4 audit-revealed backend gaps, all behind 1 PR (PR1) deployed test→customer-verify→prod.

**Architecture:** Backend changes first (Flyway migration + entity + service + whitelist + endpoint relax) so frontend can rely on stable API; then DYNAMIC schema UPDATE (canonical, affects all factories); then Vue static form fix for customer module. All changes preserve LEGACY fallback (no destructive ops on existing data).

**Tech Stack:**
- Backend: Java 21 / Spring Boot 3.2.12 / JPA Hibernate 6 / PostgreSQL / Flyway / JUnit 5 + Mockito + MockMvc
- Frontend: Vue 3 / TypeScript / Element Plus / Pinia / Vitest + @vue/test-utils
- Test env: 47.100.235.168:10011 (Java) / 8084 (Python) / 139:8097 (web vhost)
- Branch: `e2e/v1-framework`

**Spec:** `docs/superpowers/specs/2026-04-23-sub1-sales-customer-form-fixes-design.md`

---

## File Structure

### Backend (create or modify)
- **Create**: `backend/java/cretas-api/src/main/resources/db/migration/V20260423_01__add_sales_order_salesperson_id.sql`
- **Modify**: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/inventory/SalesOrder.java` (add `salespersonId` field after L118)
- **Modify**: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/inventory/impl/SalesServiceImpl.java` (`create()` ~L98-145, `update()` ~L442) — UUID-vs-string detection
- **Modify**: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/config/impl/FactoryConfigServiceImpl.java:1122-1134` — add `autoGenerate` whitelist line
- **Modify**: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/UserController.java:241-250` — relax `@NotBlank`, add `role` param
- **Create test**: `backend/java/cretas-api/src/test/java/com/cretas/aims/service/inventory/SalesServiceImplSalespersonTest.java`
- **Create test**: `backend/java/cretas-api/src/test/java/com/cretas/aims/controller/UserSearchControllerTest.java`
- **Create test**: `backend/java/cretas-api/src/test/java/com/cretas/aims/service/config/FactoryConfigAutoGenerateTest.java`

### Frontend (modify)
- **Modify**: `web-admin/src/views/modules/components/SchemaFormRenderer.vue` (L92-94 `isReadonly` + template `:placeholder`)
- **Modify**: `web-admin/src/views/modules/components/ReferenceSelector.vue` (L78-82 `onMounted` skip empty fetch)
- **Modify**: `web-admin/src/views/sales/customers/list.vue` (L90-100 form + L103-110 rules + L164-176 payload + template)
- **Create test**: `web-admin/src/__tests__/SchemaFormRenderer.autoGenerate.spec.ts`
- **Create test**: `web-admin/src/__tests__/customer-list-form.spec.ts`

### Data (one-off SQL, not Flyway)
- Apply via runbook: `psql cretas_db -c "<UPDATE module_schemas ...>"` then prod after verify

---

## Pre-flight

### Task 0: Restart test 10011 (prerequisite — current logs show shutdown ~10:19 CST)

- [ ] **Step 0.1: Restart test env**

```bash
ssh root@47.100.235.168 "bash /www/wwwroot/cretas/restart.sh test"
```

Expected stdout: `Test Java PID: <number>` and `=== Test Environment Started ===`

- [ ] **Step 0.2: Wait 90s + verify port 10011 listening**

```bash
sleep 90
ssh root@47.100.235.168 "ss -tln | grep 10011"
```

Expected: `LISTEN 0 ... 10011 ...`

- [ ] **Step 0.3: Smoke test login**

```bash
ssh root@47.100.235.168 "curl -s -m 10 -X POST 'http://localhost:10011/api/mobile/auth/unified-login' -H 'Content-Type: application/json' -d '{\"username\":\"f006_admin\",\"password\":\"123456\"}' | head -c 200"
```

Expected: JSON containing `\"success\":true` and `\"role\":\"factory_super_admin\"`

---

## Backend Tasks

### Task 1: Flyway migration — add `salesperson_id` column

**Files:**
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260423_01__add_sales_order_salesperson_id.sql`

- [ ] **Step 1.1: Create migration file**

```sql
-- V20260423_01__add_sales_order_salesperson_id.sql
-- Add salesperson_id column for dual-field salesperson migration (option 3)
-- Old orders keep salesperson string; new orders write both salesperson_id (UUID) + salesperson (snapshot name)

ALTER TABLE sales_orders
ADD COLUMN salesperson_id VARCHAR(191) NULL;

CREATE INDEX idx_so_salesperson_id ON sales_orders(salesperson_id) WHERE salesperson_id IS NOT NULL;

COMMENT ON COLUMN sales_orders.salesperson_id IS '业务员 user_id (新数据); 老数据为 NULL, 用 salesperson 字符串字段兜底显示';
```

- [ ] **Step 1.2: Verify SQL syntax locally (no apply)**

```bash
ssh root@47.100.235.168 "sudo -u postgres psql -d cretas_db -c 'EXPLAIN ALTER TABLE sales_orders ADD COLUMN tmp_check VARCHAR(191) NULL;'" 2>&1 | head -5
```

Expected: error like "ALTER TABLE / EXPLAIN incompatible" — but **syntax-parse OK** (PostgreSQL accepted ALTER syntax). If "syntax error", fix migration file.

- [ ] **Step 1.3: Commit**

```bash
git add backend/java/cretas-api/src/main/resources/db/migration/V20260423_01__add_sales_order_salesperson_id.sql
git commit -m "feat(db): add sales_orders.salesperson_id column for dual-field migration"
```

---

### Task 2: SalesOrder entity — add `salespersonId` field

**Files:**
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/inventory/SalesOrder.java` (after L118)

- [ ] **Step 2.1: Add field after existing `salesperson` field**

Open `SalesOrder.java`, find lines 116-118 (existing `salesperson` field), insert immediately after:

```java
    /** 业务员 user_id (新数据). 老订单为 NULL, 用 salesperson 字符串字段兜底. */
    @Column(name = "salesperson_id", length = 191)
    private String salespersonId;
```

- [ ] **Step 2.2: Verify entity compiles**

```bash
cd backend/java/cretas-api
mvn -q compile -DskipTests 2>&1 | tail -10
```

Expected: BUILD SUCCESS (no compile errors)

- [ ] **Step 2.3: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/entity/inventory/SalesOrder.java
git commit -m "feat(entity): add SalesOrder.salespersonId field"
```

---

### Task 3: SalesServiceImpl — UUID/string detection in `create()`

**Files:**
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/inventory/impl/SalesServiceImpl.java` (L137 area)
- Test: `backend/java/cretas-api/src/test/java/com/cretas/aims/service/inventory/SalesServiceImplSalespersonTest.java`

- [ ] **Step 3.1: Write failing test**

Create `SalesServiceImplSalespersonTest.java`:

```java
package com.cretas.aims.service.inventory;

import com.cretas.aims.entity.User;
import com.cretas.aims.entity.inventory.SalesOrder;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.repository.inventory.SalesOrderRepository;
import com.cretas.aims.service.inventory.impl.SalesServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SalesServiceImplSalespersonTest {

    @Mock UserRepository userRepository;
    @Mock SalesOrderRepository salesOrderRepository;
    @InjectMocks SalesServiceImpl salesService;

    @Test
    void resolveSalesperson_uuidInput_setsBothColumns() {
        String uuid = "550e8400-e29b-41d4-a716-446655440000";
        User user = new User();
        user.setId(1L);
        user.setFullName("张三");
        when(userRepository.findById(any())).thenReturn(Optional.of(user));

        SalesOrder order = new SalesOrder();
        salesService.resolveSalespersonField(order, uuid, "F006");

        assertEquals(uuid, order.getSalespersonId());
        assertEquals("张三", order.getSalesperson());
    }

    @Test
    void resolveSalesperson_stringInput_setsOnlyName() {
        SalesOrder order = new SalesOrder();
        salesService.resolveSalespersonField(order, "李四", "F006");

        assertNull(order.getSalespersonId());
        assertEquals("李四", order.getSalesperson());
    }

    @Test
    void resolveSalesperson_nullInput_noChange() {
        SalesOrder order = new SalesOrder();
        order.setSalesperson("existing");
        salesService.resolveSalespersonField(order, null, "F006");

        assertNull(order.getSalespersonId());
        assertEquals("existing", order.getSalesperson());
    }
}
```

- [ ] **Step 3.2: Run test to verify it fails**

```bash
cd backend/java/cretas-api
mvn -q test -Dtest=SalesServiceImplSalespersonTest 2>&1 | tail -20
```

Expected: FAIL with "method `resolveSalespersonField` not found" (or similar)

- [ ] **Step 3.3: Verify User.id type first**

```bash
grep -n "@Id\|private.*id\b" backend/java/cretas-api/src/main/java/com/cretas/aims/entity/User.java | head -5
```

Expected: `private Long id;` per audit. If different (e.g., String UUID), adapt patterns + parseLong() in step 3.4 accordingly.

- [ ] **Step 3.4: Implement `resolveSalespersonField` in SalesServiceImpl (User.id = Long)**

Open `SalesServiceImpl.java`. Locate `create()` method (~L98-145). Add new helper method near top of class methods:

```java
    /** Numeric user-id string pattern (User.id is Long, frontend sends as decimal string). */
    private static final java.util.regex.Pattern USER_ID_PATTERN =
        java.util.regex.Pattern.compile("^\\d{1,19}$");

    /**
     * 解析业务员字段 — 双字段过渡 (option 3 per spec §4.A.4).
     * 数字字符串 (User.id) → lookup user → 写入 salesperson_id + salesperson(name 快照)
     * 含非数字字符的字符串 → 老路径，只写 salesperson
     * null/空 → 不动
     */
    public void resolveSalespersonField(SalesOrder order, String input, String factoryId) {
        if (input == null || input.isBlank()) return;
        if (USER_ID_PATTERN.matcher(input).matches()) {
            Long userId = Long.parseLong(input);
            User user = userRepository.findById(userId)
                .filter(u -> factoryId.equals(u.getFactoryId()))
                .orElseThrow(() -> new ResourceNotFoundException("业务员不存在或不属于本工厂: " + input));
            order.setSalespersonId(input);
            order.setSalesperson(user.getFullName());  // M1: snapshot name at save time
        } else {
            order.setSalesperson(input);
            order.setSalespersonId(null);
        }
    }
```

⚠️ Edge case: legacy salesperson value like `"123"` (3-digit numeric name) would be misinterpreted as user-id. Acceptable risk per spec §4.A.4 (numeric-only Chinese names extremely rare). If issue arises, switch to explicit DTO field `salespersonId` per audit C2 fix (b).

⚠️ Adjust test in step 3.1: change uuid value `"550e8400-..."` → numeric like `"1309"` (matching f006_admin's user id from prod DB). Test mock: `when(userRepository.findById(1309L)).thenReturn(Optional.of(user))`. **Re-update test code in Step 3.1 with numeric values before running.**

- [ ] **Step 3.5: Replace direct `order.setSalesperson(...)` calls in `create()` and `update()` with helper**

In `SalesServiceImpl.create()` around L137, change:

```java
        order.setSalesperson(request.getSalesperson());
```

to:

```java
        resolveSalespersonField(order, request.getSalesperson(), factoryId);
```

In `update()` (search for `setSalesperson` in same file), apply same replacement.

- [ ] **Step 3.6: Run test to verify pass**

```bash
mvn -q test -Dtest=SalesServiceImplSalespersonTest 2>&1 | tail -10
```

Expected: Tests run: 3, Failures: 0, Errors: 0

- [ ] **Step 3.7: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/service/inventory/impl/SalesServiceImpl.java \
        backend/java/cretas-api/src/test/java/com/cretas/aims/service/inventory/SalesServiceImplSalespersonTest.java
git commit -m "feat(sales): salesperson UUID/string detection + dual-field write"
```

---

### Task 4: FactoryConfigServiceImpl — add `autoGenerate` to whitelist

**Files:**
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/config/impl/FactoryConfigServiceImpl.java:1122-1134`
- Test: `backend/java/cretas-api/src/test/java/com/cretas/aims/service/config/FactoryConfigAutoGenerateTest.java`

- [ ] **Step 4.1: Write failing test**

Create `FactoryConfigAutoGenerateTest.java`:

```java
package com.cretas.aims.service.config;

import com.cretas.aims.service.config.impl.FactoryConfigServiceImpl;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FactoryConfigAutoGenerateTest {

    @Test
    @SuppressWarnings("unchecked")
    void buildEffectiveFields_includesAutoGenerateInExtra() throws Exception {
        FactoryConfigServiceImpl svc = new FactoryConfigServiceImpl();

        // Schema with autoGenerate field
        Map<String, Object> field = new HashMap<>();
        field.put("code", "orderNumber");
        field.put("type", "string");
        field.put("label", "订单号");
        field.put("autoGenerate", true);
        field.put("required", false);

        Map<String, Object> schema = new HashMap<>();
        schema.put("fields", List.of(field));

        // Use reflection to invoke buildEffectiveFields (private)
        Method m = FactoryConfigServiceImpl.class.getDeclaredMethod(
            "buildEffectiveFields", Map.class, Map.class, Map.class
        );
        m.setAccessible(true);

        List<Map<String, Object>> result = (List<Map<String, Object>>) m.invoke(
            svc, schema, Map.of(), Map.of()
        );

        assertEquals(1, result.size());
        Map<String, Object> extra = (Map<String, Object>) result.get(0).get("extra");
        assertTrue((Boolean) extra.get("autoGenerate"),
            "autoGenerate flag must be forwarded to EffectiveField.extra");
    }
}
```

- [ ] **Step 4.2: Verify test fails**

```bash
mvn -q test -Dtest=FactoryConfigAutoGenerateTest 2>&1 | tail -10
```

Expected: FAIL with NullPointerException or assertion failure on `extra.get("autoGenerate")` (autoGenerate not in whitelist)

⚠️ If `buildEffectiveFields` signature differs from what's in test, adjust reflection invocation. Check first:

```bash
grep -n "buildEffectiveFields" backend/java/cretas-api/src/main/java/com/cretas/aims/service/config/impl/FactoryConfigServiceImpl.java | head -3
```

- [ ] **Step 4.3: Add `autoGenerate` to whitelist**

In `FactoryConfigServiceImpl.java`, locate L1134 (last whitelist line `if (schemaDef.containsKey("configurable"))`). Add **immediately after**:

```java
            if (schemaDef.containsKey("autoGenerate")) extra.put("autoGenerate", schemaDef.get("autoGenerate"));
```

- [ ] **Step 4.4: Verify test passes**

```bash
mvn -q test -Dtest=FactoryConfigAutoGenerateTest 2>&1 | tail -10
```

Expected: Tests run: 1, Failures: 0

- [ ] **Step 4.5: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/service/config/impl/FactoryConfigServiceImpl.java \
        backend/java/cretas-api/src/test/java/com/cretas/aims/service/config/FactoryConfigAutoGenerateTest.java
git commit -m "feat(config): forward autoGenerate flag to EffectiveField.extra"
```

---

### Task 5: UserController — relax `@NotBlank` + add `role` param

**Files:**
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/UserController.java:241-250`
- Test: `backend/java/cretas-api/src/test/java/com/cretas/aims/controller/UserSearchControllerTest.java`

- [ ] **Step 5.1: Read current `searchUsers` method**

```bash
sed -n '235,260p' backend/java/cretas-api/src/main/java/com/cretas/aims/controller/UserController.java
```

Note exact signature, return type, repository method names. **Adapt the steps below to actual code**.

- [ ] **Step 5.2: Write failing test**

Create `UserSearchControllerTest.java` (uses MockMvc):

```java
package com.cretas.aims.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class UserSearchControllerTest {

    @Autowired MockMvc mvc;

    @Test
    void searchUsers_emptyKeyword_returns200() throws Exception {
        mvc.perform(get("/api/mobile/F006/users/search")
            .header("Authorization", "Bearer <test-token>"))  // requires auth setup
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void searchUsers_withRoleFilter_returnsOnlyMatching() throws Exception {
        mvc.perform(get("/api/mobile/F006/users/search?role=warehouse_manager")
            .header("Authorization", "Bearer <test-token>"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data[*].roleCode").value(org.hamcrest.Matchers.everyItem(
                org.hamcrest.Matchers.equalTo("warehouse_manager"))));
    }
}
```

⚠️ Test setup is non-trivial (needs MockMvc auth token mock). **If existing `*ControllerTest` files exist in same package**, mimic their auth setup pattern:

```bash
find backend/java/cretas-api/src/test -name "*ControllerTest.java" | head -3
```

If no MockMvc auth pattern exists in repo, **convert to direct service test** instead (mock `UserRepository`, test `userService.searchUsers(factoryId, keyword, role)` returns expected list).

- [ ] **Step 5.3: Verify test fails**

```bash
mvn -q test -Dtest=UserSearchControllerTest 2>&1 | tail -15
```

Expected: 400 (current `@NotBlank` rejects empty) or compile fail (role param not in signature yet)

- [ ] **Step 5.4: Modify controller**

In `UserController.java:241-250`, change signature:

```java
    @GetMapping("/search")
    public ApiResponse<List<UserSearchDto>> searchUsers(
            @PathVariable String factoryId,
            @RequestParam(required = false) String keyword,        // remove @NotBlank
            @RequestParam(required = false) String role,           // new role filter
            @RequestParam(defaultValue = "50") int size
    ) {
        return ApiResponse.ok(userService.searchUsers(factoryId, keyword, role, size));
    }
```

If `userService.searchUsers` doesn't accept `role` param, also add it in `UserService.java` + `UserServiceImpl.java`. Service impl filters: if `role != null`, add `WHERE role_code = :role` to query.

- [ ] **Step 5.5: Verify test passes**

```bash
mvn -q test -Dtest=UserSearchControllerTest 2>&1 | tail -10
```

Expected: Tests run: 2, Failures: 0

- [ ] **Step 5.6: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/controller/UserController.java \
        backend/java/cretas-api/src/main/java/com/cretas/aims/service/UserService.java \
        backend/java/cretas-api/src/main/java/com/cretas/aims/service/impl/UserServiceImpl.java \
        backend/java/cretas-api/src/test/java/com/cretas/aims/controller/UserSearchControllerTest.java
git commit -m "feat(user): relax @NotBlank on search keyword + add role filter"
```

---

### Task 6: Backend smoke deploy to test 10011 + run all unit tests

- [ ] **Step 6.1: Run full backend test suite**

```bash
cd backend/java/cretas-api
mvn -q test 2>&1 | tail -20
```

Expected: BUILD SUCCESS, all tests pass (existing + 4 new). If failures in unrelated tests, investigate (regression risk).

- [ ] **Step 6.2: Build JAR**

```bash
mvn -q clean package -DskipTests 2>&1 | tail -5
```

Expected: BUILD SUCCESS, generates `target/aims-0.0.1-SNAPSHOT.jar`

- [ ] **Step 6.3: Deploy to test (10011 only)**

```bash
./scripts/deploy/deploy-backend.sh --env test 2>&1 | tail -20
```

Expected: deploy script runs, health-check on 10011 returns 200

- [ ] **Step 6.4: Verify Flyway migration applied**

```bash
ssh root@47.100.235.168 "sudo -u postgres psql -d cretas_db -c \"\\d sales_orders\" | grep salesperson_id"
```

Expected: `salesperson_id | character varying(191) |`

- [ ] **Step 6.5: Smoke test endpoints**

```bash
ssh root@47.100.235.168 "
RESP=\$(curl -s -X POST 'http://localhost:10011/api/mobile/auth/unified-login' -H 'Content-Type: application/json' -d '{\"username\":\"f006_admin\",\"password\":\"123456\"}')
TOKEN=\$(echo \"\$RESP\" | python3 -c 'import json,sys; print(json.load(sys.stdin)[\"data\"][\"accessToken\"])')

echo '--- /users/search empty keyword ---'
curl -s 'http://localhost:10011/api/mobile/F006/users/search' -H \"Authorization: Bearer \$TOKEN\" | head -c 200
echo ''
echo '--- /users/search?role=warehouse_manager ---'
curl -s 'http://localhost:10011/api/mobile/F006/users/search?role=warehouse_manager' -H \"Authorization: Bearer \$TOKEN\" | head -c 300
"
```

Expected: 200 success for both, second returns only warehouse_manager users (test DB has none → empty array, OK)

---

## Schema Data UPDATE

### Task 7: module_schemas SQL UPDATE for sales_order

**Files:**
- One-off SQL applied via psql (NOT Flyway — this is data, not schema)
- Track in: `docs/runbooks/2026-04-23-sub1-pr1-schema-update-runbook.md`

- [ ] **Step 7.1: Capture current schema (backup)**

```bash
ssh root@47.100.235.168 "sudo -u postgres psql -d cretas_db -tAc \"SELECT field_schema::text FROM module_schemas WHERE module_code='sales_order';\"" \
  > /tmp/sales_order_schema_pre_pr1.json
wc -c /tmp/sales_order_schema_pre_pr1.json
```

Expected: ~5000+ bytes; file saved as backup

- [ ] **Step 7.2: Build new schema JSON locally**

Create runbook + new schema. Use Python to safely transform:

```bash
mkdir -p docs/runbooks
python3 << 'PY' > /tmp/sales_order_schema_new.json
import json
with open('/tmp/sales_order_schema_pre_pr1.json') as f:
    schema = json.load(f)

for field in schema['fields']:
    code = field.get('code')

    if code == 'orderNumber':
        # Remove required (autoGenerate handles it now)
        field['required'] = False

    elif code == 'salesperson':
        # Change type to reference + add referenceConfig
        field['type'] = 'reference'
        field['referenceConfig'] = {
            'entity': 'user',
            'valueField': 'id',
            'displayField': 'fullName',
            'apiEndpoint': '/api/mobile/{factoryId}/users/search',
            'searchFields': ['fullName', 'username']
        }

    elif code == 'items':
        # Sub-table: add apiEndpoint to productTypeId
        for sub in field.get('itemSchema', {}).get('fields', []):
            if sub.get('code') == 'productTypeId':
                rc = sub.setdefault('referenceConfig', {})
                rc['apiEndpoint'] = '/api/mobile/{factoryId}/product-types/search'

print(json.dumps(schema, ensure_ascii=False))
PY
```

Verify diff:

```bash
diff <(python3 -m json.tool /tmp/sales_order_schema_pre_pr1.json) \
     <(python3 -m json.tool /tmp/sales_order_schema_new.json) | head -40
```

Expected diff: 3 changes — orderNumber.required false, salesperson restructured, items.productTypeId.apiEndpoint added

- [ ] **Step 7.3: Apply UPDATE to test DB**

```bash
NEW_SCHEMA=$(cat /tmp/sales_order_schema_new.json | python3 -c 'import json,sys; print(json.dumps(json.load(sys.stdin)))')
ssh root@47.100.235.168 "sudo -u postgres psql -d cretas_db -c \"UPDATE module_schemas SET field_schema = '\$(echo $NEW_SCHEMA | sed \"s/'/''/g\")'::jsonb, updated_at = NOW() WHERE module_code='sales_order';\""
```

⚠️ JSON escaping is fragile. **Safer alternative**: write to file on server and use `\copy` or `cat | psql`:

```bash
scp /tmp/sales_order_schema_new.json root@47.100.235.168:/tmp/
ssh root@47.100.235.168 "
sudo -u postgres psql -d cretas_db <<EOF
UPDATE module_schemas
SET field_schema = pg_read_file('/tmp/sales_order_schema_new.json')::jsonb,
    updated_at = NOW()
WHERE module_code='sales_order';
EOF
"
```

Expected: `UPDATE 1`

- [ ] **Step 7.4: Verify schema applied**

```bash
ssh root@47.100.235.168 "sudo -u postgres psql -d cretas_db -tAc \"SELECT field_schema::text FROM module_schemas WHERE module_code='sales_order';\"" | python3 -c "
import json, sys
d = json.load(sys.stdin)
for f in d['fields']:
    if f['code'] in ('orderNumber','salesperson'):
        print(f['code'], '→ required:', f.get('required'), '/ type:', f.get('type'), '/ refConfig:', f.get('referenceConfig'))
    if f['code']=='items':
        for s in f['itemSchema']['fields']:
            if s['code']=='productTypeId':
                print('items.productTypeId.apiEndpoint:', s['referenceConfig'].get('apiEndpoint'))
"
```

Expected:
- `orderNumber → required: False / type: string / refConfig: None`
- `salesperson → required: False / type: reference / refConfig: {...}`
- `items.productTypeId.apiEndpoint: /api/mobile/{factoryId}/product-types/search`

- [ ] **Step 7.5: Document in runbook**

Create `docs/runbooks/2026-04-23-sub1-pr1-schema-update-runbook.md`:

```markdown
# Sub-1 PR1 Schema Update Runbook

## Pre-conditions
- Backend Phase A code (PR1) deployed to target env (test or prod)
- Backup taken: `pg_dump -t module_schemas cretas_db > backup_pre_pr1.sql`

## Apply (test)
[copy steps 7.1-7.4 above using cretas_db]

## Apply (prod)
Replace `cretas_db` → `cretas_prod_db`. Repeat steps 7.1-7.4.

## Rollback
```bash
ssh root@47.100.235.168 "
sudo -u postgres psql -d <DB> <<EOF
UPDATE module_schemas
SET field_schema = pg_read_file('/tmp/sales_order_schema_pre_pr1.json')::jsonb,
    updated_at = NOW()
WHERE module_code='sales_order';
EOF
"
```
```

- [ ] **Step 7.6: Commit runbook**

```bash
git add docs/runbooks/2026-04-23-sub1-pr1-schema-update-runbook.md
git commit -m "docs(runbook): sub-1 pr1 schema update + rollback procedure"
```

---

## Frontend Tasks

### Task 8: SchemaFormRenderer — honor `autoGenerate` flag

**Files:**
- Modify: `web-admin/src/views/modules/components/SchemaFormRenderer.vue` (L92-94 + template `:placeholder`)
- Test: `web-admin/src/__tests__/SchemaFormRenderer.autoGenerate.spec.ts`

- [ ] **Step 8.1: Write failing test**

Create `web-admin/src/__tests__/SchemaFormRenderer.autoGenerate.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SchemaFormRenderer from '@/views/modules/components/SchemaFormRenderer.vue'

const autoGenField = {
  code: 'orderNumber',
  label: '订单号',
  type: 'string',
  required: false,
  extra: { autoGenerate: true },
}

describe('SchemaFormRenderer autoGenerate', () => {
  it('renders disabled input in create mode when autoGenerate=true', () => {
    const wrapper = mount(SchemaFormRenderer, {
      props: { fields: [autoGenField], modelValue: {}, mode: 'create' },
    })
    const input = wrapper.find('input')
    expect(input.attributes('disabled')).toBeDefined()
    expect(input.attributes('placeholder')).toBe('保存后自动生成')
  })

  it('renders disabled input in edit mode too (M3 snapshot semantics)', () => {
    const wrapper = mount(SchemaFormRenderer, {
      props: { fields: [autoGenField], modelValue: { orderNumber: 'SO-20260423-0001' }, mode: 'edit' },
    })
    expect(wrapper.find('input').attributes('disabled')).toBeDefined()
  })

  it('renders normal editable input when autoGenerate=false', () => {
    const normalField = { ...autoGenField, extra: { autoGenerate: false } }
    const wrapper = mount(SchemaFormRenderer, {
      props: { fields: [normalField], modelValue: {}, mode: 'create' },
    })
    expect(wrapper.find('input').attributes('disabled')).toBeUndefined()
  })
})
```

- [ ] **Step 8.2: Verify test fails**

```bash
cd web-admin
npx vitest run src/__tests__/SchemaFormRenderer.autoGenerate.spec.ts 2>&1 | tail -15
```

Expected: FAIL — `input.attributes('disabled')` undefined (renderer doesn't honor autoGenerate yet)

- [ ] **Step 8.3: Modify `isReadonly` function**

In `web-admin/src/views/modules/components/SchemaFormRenderer.vue:92-94`, change:

```typescript
function isReadonly(field: EffectiveField): boolean {
  return props.mode === 'view' || field.readonly || !!field.extra?.computed
}
```

to:

```typescript
function isReadonly(field: EffectiveField): boolean {
  if (props.mode === 'view') return true
  if (field.readonly || field.extra?.computed) return true
  // Spec §4.A.2 + M3: autoGenerate fields disabled in both create + edit (snapshot semantics)
  if (field.extra?.autoGenerate && props.mode !== 'view') return true
  return false
}
```

- [ ] **Step 8.4: Add placeholder for autoGenerate fields**

Find the string input element in template (around L185-192 area). Modify `:placeholder` binding to:

```vue
:placeholder="field.extra?.autoGenerate && mode === 'create' ? '保存后自动生成' : (field.placeholder || '请输入')"
```

Apply to all string-type input renderings (search for `placeholder` in template, may be 2-3 places).

- [ ] **Step 8.5: Verify test passes**

```bash
npx vitest run src/__tests__/SchemaFormRenderer.autoGenerate.spec.ts 2>&1 | tail -10
```

Expected: 3 pass

- [ ] **Step 8.6: Commit**

```bash
git add web-admin/src/views/modules/components/SchemaFormRenderer.vue \
        web-admin/src/__tests__/SchemaFormRenderer.autoGenerate.spec.ts
git commit -m "feat(renderer): honor autoGenerate flag — disable input + placeholder"
```

---

### Task 9: ReferenceSelector — skip empty initial fetch

**Files:**
- Modify: `web-admin/src/views/modules/components/ReferenceSelector.vue:78-82`

- [ ] **Step 9.1: Read current `onMounted` block**

```bash
sed -n '75,85p' web-admin/src/views/modules/components/ReferenceSelector.vue
```

Expected to contain `onMounted(() => { search('') })` or similar.

- [ ] **Step 9.2: Modify onMounted**

Change to skip empty initial fetch (avoids backend `@NotBlank` 400 + reduces noise):

```typescript
onMounted(() => {
  // Spec §4.A.8 — Skip empty initial fetch. Backend /search may reject @NotBlank.
  // User-typed keyword triggers search via :remote-method on el-select.
  // If preload needed, caller can pass explicit prop (future: props.config.preload).
  if (props.modelValue) {
    // Existing value present → search by id to populate display
    search(String(props.modelValue))
  }
})
```

- [ ] **Step 9.3: Manual smoke test (no unit test for this — pure render-side change)**

After deploy (Task 14), use `f006_admin` login to web-admin → navigate to Sales Order create form → click 业务员 dropdown → input "张" → expect dropdown shows users. Click product cell → input "猪" → dropdown shows products. **No 400 errors in browser network tab on initial mount.**

- [ ] **Step 9.4: Commit**

```bash
git add web-admin/src/views/modules/components/ReferenceSelector.vue
git commit -m "fix(reference): skip empty initial fetch (avoid /search @NotBlank 400)"
```

---

### Task 10: customers/list.vue — remove required + add status field

**Files:**
- Modify: `web-admin/src/views/sales/customers/list.vue` (L90-100 form + L103-110 rules + L121-156 handlers + L164-176 payload + template)

- [ ] **Step 10.1: Update `defaultForm` (L90-100)**

Add `status: 'ACTIVE'` to the object:

```typescript
const defaultForm = {
  id: '',
  name: '',
  contactPerson: '',
  phone: '',
  shippingAddress: '',
  email: '',
  type: '',
  industry: '',
  notes: '',
  status: 'ACTIVE',  // 新增
};
```

- [ ] **Step 10.2: Remove required from `formRules` (L103-110)**

Change to:

```typescript
const formRules = {
  name: [{ required: true, message: '请输入客户名称', trigger: 'blur' }],
  phone: [
    // 保留格式校验，移除 required (per spec P2.1)
    { pattern: /^1[3-9]\d{9}$|^0\d{2,3}-?\d{7,8}$/, message: '请输入正确的手机号或座机号', trigger: 'blur' },
  ],
};
```

- [ ] **Step 10.3: Update `handleEdit` and `handleView` to load status (L127-156)**

In both functions, add `status: row.status || 'ACTIVE'` to the `Object.assign(formData, ...)` payload:

```typescript
function handleEdit(row: Record<string, unknown>) {
  dialogMode.value = 'edit';
  Object.assign(formData, {
    id: row.id,
    name: row.name || '',
    contactPerson: row.contactPerson || '',
    phone: row.phone || '',
    shippingAddress: row.shippingAddress || row.address || '',
    email: row.email || '',
    type: row.type || '',
    industry: row.industry || '',
    notes: row.notes || '',
    status: (row.status as string) || 'ACTIVE',  // 新增
  });
  dialogVisible.value = true;
}
// 同样修改 handleView
```

- [ ] **Step 10.4: Add status to `handleSubmit` payload (L164-176)**

```typescript
const payload: Record<string, unknown> = {
  name: formData.name,
  contactPerson: formData.contactPerson,
  phone: formData.phone,
  shippingAddress: formData.shippingAddress,
  email: formData.email || undefined,
  type: formData.type || undefined,
  industry: formData.industry || undefined,
  notes: formData.notes || undefined,
  status: formData.status,  // 新增
  ...
};
```

- [ ] **Step 10.5: Add status `el-form-item` to template**

Find the `<el-form>` block in template (around L288). After the existing `<el-form-item label="收货地址">` block, add:

```vue
        <el-form-item label="状态" prop="status">
          <el-select v-model="formData.status" :disabled="isViewMode" style="width: 100%">
            <el-option label="合作中" value="ACTIVE" />
            <el-option label="已停用" value="INACTIVE" />
          </el-select>
        </el-form-item>
```

- [ ] **Step 10.6: Manual smoke test (no automated test — pure UI change)**

After deploy (Task 14), in web-admin test env: navigate to 客户管理 → click "新增客户" → leave 联系人/电话/收货地址 empty → fill 客户名称 → click 保存 → expect success (no required error). Then click "编辑" on a customer → expect 状态 field shows current value as dropdown → toggle to "已停用" → save → list shows new status.

- [ ] **Step 10.7: Commit**

```bash
git add web-admin/src/views/sales/customers/list.vue
git commit -m "feat(customer): remove required for contact fields + add editable status"
```

---

## Integration & Deploy

### Task 11: Build web-admin + verify type checks

- [ ] **Step 11.1: Run TypeScript check**

```bash
cd web-admin
npx vue-tsc --noEmit 2>&1 | tail -10
```

Expected: 0 errors

- [ ] **Step 11.2: Build production bundle**

```bash
npm run build 2>&1 | tail -10
```

Expected: vite build succeeds, bundle written to `dist/`

- [ ] **Step 11.3: Commit build artifacts (if repo tracks them)**

Check first if `dist/` is gitignored:

```bash
cat .gitignore | grep -E '^dist|^web-admin/dist'
```

If gitignored: skip. If tracked (CI uploads): commit.

---

### Task 12: Deploy web-admin to test vhost (139:8097)

- [ ] **Step 12.1: rsync dist to test vhost**

Per project deploy convention (`scripts/deploy/`), check if a web-admin deploy script exists:

```bash
ls scripts/deploy/ | grep -i web
```

If `deploy-web-admin.sh` exists, run it for test target. If not, manual rsync:

```bash
rsync -avz --delete web-admin/dist/ root@139.196.165.140:/www/wwwroot/web-admin-test/
```

- [ ] **Step 12.2: Smoke test web-admin test URL**

```bash
curl -s -o /dev/null -w "%{http_code}" http://139.196.165.140:8097/
```

Expected: 200

---

### Task 13: End-to-end verification on test env

Use browser to verify all 5 docx items + 2 audit fixes work:

- [ ] **Step 13.1: Login f006_admin via web-admin test (139:8097)**

User: `f006_admin` / Pass: `123456`

- [ ] **Step 13.2: Verify P1.1 — Sales order 合同号 disabled**

Navigate: 销售管理 → 销售订单 → 新增

Expected: 合同号 field灰色不可填，placeholder "保存后自动生成"

- [ ] **Step 13.3: Verify P1.2 — Sales order 业务员 dropdown**

Click 业务员 field → dropdown shows F006 users (no role filter on test, all users; if we set apiEndpoint with role param, only matching ones)

Expected: typing "张" filters dropdown; selecting 张三 stores `salesperson` value (will be user id internally)

- [ ] **Step 13.4: Verify P1.3 — Items 产品 search**

In 订单明细 → click 产品 cell → input "猪" or any keyword

Expected: dropdown shows matching products (not "无数据")

- [ ] **Step 13.5: Submit order + verify orderNumber generated**

Fill required fields (客户/日期/产品/数量/单价) → 保存

Expected: success toast, list shows new order with `orderNumber` like `SO-20260423-0001`. Click 详情 → `salesperson_id` populated, `salesperson` shows user fullName.

- [ ] **Step 13.6: Verify old order compatibility (P1.2 backward compat)**

Open existing F001 sales order (any from the 100 existing) — login `factory_admin1 / 123456` first, then navigate to 销售订单 → 编辑 an old one.

Expected: 业务员 field shows "张三" (string) read-only fallback, not error. Save without modifying business field still works.

- [ ] **Step 13.7: Verify P2.1 — Customer 三字段 not required**

Login `f006_admin`, navigate 销售管理 → 客户管理 → 新增 → fill only 客户名称 → leave 联系人/电话/收货地址 empty → 保存

Expected: success, no validation error, customer appears in list

- [ ] **Step 13.8: Verify P2.2 — Customer status editable**

Click 编辑 on the just-created customer → 状态 field shows "合作中" dropdown → toggle to "已停用" → 保存

Expected: list shows 已停用 badge

- [ ] **Step 13.9: Regression — non-DYNAMIC modules unaffected**

Navigate 采购管理 → 采购订单 → 新增 → fill basic fields → save

Expected: works as before (PO uses different schema, not affected by sales_order changes)

---

### Task 14: Customer acceptance + deploy to prod

- [ ] **Step 14.1: Send test creds to customer 张权**

Notify customer (Steve forwards) — ask to verify all 5 items on 139:8097 with `f006_admin / 123456`.

- [ ] **Step 14.2: Wait for customer ack (1-2 days)**

If customer reports new bugs, file follow-up tickets. **Do not proceed to prod without explicit ack.**

- [ ] **Step 14.3: Deploy backend to prod**

Per HARD RULE — only after customer explicit OK:

```bash
./scripts/deploy/deploy-backend.sh --env prod 2>&1 | tail -20
```

Expected: Blue-Green deploy completes, prod 10010/10020 healthy

- [ ] **Step 14.4: Apply schema UPDATE to prod DB**

Per Task 7 runbook (`docs/runbooks/2026-04-23-sub1-pr1-schema-update-runbook.md`), repeat steps 7.1-7.4 with `cretas_prod_db`.

- [ ] **Step 14.5: Deploy web-admin to prod vhost**

```bash
rsync -avz --delete web-admin/dist/ root@139.196.165.140:/www/wwwroot/web-admin/
# or: ./scripts/deploy/deploy-web-admin.sh --env prod
```

- [ ] **Step 14.6: Prod smoke test**

```bash
curl -sf https://admin.cretaceousfuture.com/ -o /dev/null && echo "prod web 200"
ssh root@47.100.235.168 "curl -sf http://localhost:10020/api/mobile/health -o /dev/null && echo 'prod java 200'"
```

Expected: both 200

- [ ] **Step 14.7: Update memory + close PR**

Add memory entry (Steve maintains) summarizing PR1 outcome. Push branch, open GitHub PR, merge after approval.

---

## Acceptance Criteria

- [ ] All 14 tasks complete with green tests / smoke checks
- [ ] 5 docx customer items verified working in test
- [ ] 2 audit-revealed gaps closed (autoGenerate forwarding, salesperson dual-field)
- [ ] Customer 张权 explicit ack on test before prod
- [ ] Prod deploy successful, prod smoke 200
- [ ] No regression in unrelated modules (purchase_order, production, customer-static-fallback)
- [ ] Rollback runbook documented in `docs/runbooks/2026-04-23-sub1-pr1-schema-update-runbook.md`

---

## Risks during execution

| Risk | Mitigation |
|---|---|
| `User.id` is Long not String UUID — UUID_PATTERN won't match | Step 3.3 explicitly checks; adjust pattern + repository call |
| `buildEffectiveFields` private method signature differs from test expectation | Step 4.2 fail message reveals signature; adjust reflection |
| `userService.searchUsers` doesn't exist or has different signature | Step 5.4 explicitly says to also modify Service + Impl |
| Schema UPDATE fails on JSON escaping | Step 7.3 alternative uses `pg_read_file` to bypass shell escaping |
| Deploy script not in `scripts/deploy/` | Steps 6.3 + 12.1 + 14.3 fall back to manual commands |
| Customer doesn't ack within reasonable time | Pause at Task 14.2; do not deploy prod without ack |
| Old SO display shows blank for salesperson | Manual test in Step 13.6; if blank, add fallback in ReferenceSelector to show raw value |

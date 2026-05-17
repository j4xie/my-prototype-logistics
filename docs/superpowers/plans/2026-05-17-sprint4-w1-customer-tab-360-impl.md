# Sprint 4 W1 — S-CUSTOMER-TAB-1 客户档案 360° Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Customer 360° detail view with 21 tabs (12 真做 + 1 integration + 8 defer) + tab 20 业务员变更 history + 防呆 R1-R5 + 4 位一体 error toast.

**Architecture:** Single-page Vue (`detail.vue`) + `<el-tabs>` + `<KeepAlive>` + `defineAsyncComponent` lazy chunks. Backend adds 2 new entities + extends 6 existing controllers with `?customerId=` query. Flat route `/sales/customers/:id?tab=N`.

**Tech Stack:** Vue 3 + Element Plus + Pinia + Vue Router 4 + Vite + Vitest + Playwright + Spring Boot 3.2 + JPA + PostgreSQL + Flyway.

**Spec:** `docs/superpowers/specs/2026-05-16-sprint4-w1-customer-tab-360-design.md`

**Branch:** `feat/sprint4-w1-customer-tab-360` (worktree `C:\Users\Steve\cretas-sprint4-w1-customer-tab-360`)

**Estimated:** ~17d total (15d frontend + 4d backend in parallel; frontend critical path)

---

## Dependency Check (Pre-Flight)

Before Day 1, verify (run once at execution start):

| Check | Command | Expected |
|---|---|---|
| Branch correct | `git rev-parse --abbrev-ref HEAD` | `feat/sprint4-w1-customer-tab-360` |
| Off main | `git merge-base HEAD origin/main && git rev-parse origin/main` | Same SHA |
| Backend compiles | `cd backend/java/cretas-api && mvn -DskipTests compile` | BUILD SUCCESS |
| Web-admin builds | `cd web-admin && npm install && npm run build` | EXIT 0 |
| PG running | `psql -h localhost -U postgres -d cretas_db -c '\dt customers'` | table found |
| `update_updated_at()` exists | `psql -d cretas_db -c "\df update_updated_at"` | function found |
| Flyway version | `mvn flyway:info -pl backend/java/cretas-api` | Latest applied < V20260516_01 |

If any check fails → STOP, fix, then resume.

---

## Phase Overview + Milestone Commits

| Phase | Days | Deliverable | Milestone Commit |
|---|---|---|---|
| Phase A — Backend Foundation | D1-D3 | Migration + entity + service + tab 20 controller | `feat(sprint4-w1): customer sales-user-history backend foundation` |
| Phase B — Frontend Skeleton | D1-D3 | Route + detail.vue + el-tabs + 8 defer wired | `feat(sprint4-w1): detail.vue skeleton + 8 defer tabs` |
| Phase C — Backend Tab Extensions | D4-D7 | TrackingController + 6 controller `?customerId=` + tests | `feat(sprint4-w1): backend tab extensions for 7 query endpoints` |
| Phase D — Frontend Real Tabs | D4-D10 | 12 真做 tab + tab 19 integration | Per-tab commits (10 total) |
| Phase E — RBAC Mask Polish | D11 | canViewPrice mask verify + UI polish | `feat(sprint4-w1): canViewPrice mask across 6 tabs` |
| Phase F — Vitest | D12 | ≥12 spec EXIT 0 | `test(sprint4-w1): vitest sub-component specs` |
| Phase G — Playwright E2E | D13-D14 | 6 scenario PASS + bug fix | `test(sprint4-w1): playwright e2e 6 scenarios` |
| Phase H — Deploy + PR | D15 | Backend prod + Web-admin prod + PR open | `chore(sprint4-w1): deploy + open PR` |

**Commit cadence**: per `concurrent-edit-safety.md` rule 1 milestone commits — commit each sub-component completion + every backend entity. Use `git commit -- <files>` (rule 5b) to lock scope.

---

## Phase A — Backend Foundation (Day 1-3)

### Task A1: Flyway migration — customer_sales_user_history + Customer fields

**Files:**
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260516_01__customer_sales_user_history.sql`

- [ ] **Step 1**: Write migration

```sql
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS assigned_sales_user_id BIGINT NULL,
  ADD COLUMN IF NOT EXISTS assigned_sales_user_assigned_at TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS customer_sales_user_history (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    customer_id VARCHAR(36) NOT NULL REFERENCES customers(id),
    previous_sales_user_id BIGINT NULL,
    new_sales_user_id BIGINT NULL,
    changed_by BIGINT NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    reason VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_csuh_customer_changed
  ON customer_sales_user_history(customer_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_csuh_factory
  ON customer_sales_user_history(factory_id, changed_at DESC);

DROP TRIGGER IF EXISTS trigger_csuh_updated_at ON customer_sales_user_history;
CREATE TRIGGER trigger_csuh_updated_at
BEFORE UPDATE ON customer_sales_user_history
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

- [ ] **Step 2**: Local PG dry-run

```bash
psql -h localhost -U postgres -d cretas_db -f backend/java/cretas-api/src/main/resources/db/migration/V20260516_01__customer_sales_user_history.sql
```

Expected: 3 ALTER/CREATE statements + 2 CREATE INDEX + 1 CREATE TRIGGER all success. No error.

- [ ] **Step 3**: Verify schema

```bash
psql -d cretas_db -c "\d customers" | grep assigned_sales
psql -d cretas_db -c "\d customer_sales_user_history"
```

Expected: `assigned_sales_user_id` + `assigned_sales_user_assigned_at` in customers; full csuh table.

- [ ] **Step 4**: Rollback test (only if PG dry-run safe — see Risk in spec §12)

```sql
DROP TRIGGER trigger_csuh_updated_at ON customer_sales_user_history;
DROP TABLE customer_sales_user_history;
ALTER TABLE customers DROP COLUMN assigned_sales_user_id, DROP COLUMN assigned_sales_user_assigned_at;
```

Re-apply Step 2 to confirm idempotent (`IF NOT EXISTS` clauses).

- [ ] **Step 5**: Commit

```bash
git add backend/java/cretas-api/src/main/resources/db/migration/V20260516_01__customer_sales_user_history.sql
git commit -m "feat(sprint4-w1): Flyway V20260516_01 customer sales-user history schema"
```

---

### Task A2: Customer entity — add 2 fields

**Files:**
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/Customer.java` (after line ~78 `shippingAddress`)

- [ ] **Step 1**: Edit Customer.java, add fields

After existing `@Column(name="shipping_address") private String shippingAddress;`:

```java
@Column(name = "assigned_sales_user_id")
private Long assignedSalesUserId;

@Column(name = "assigned_sales_user_assigned_at")
private LocalDateTime assignedSalesUserAssignedAt;
```

Verify import `import java.time.LocalDateTime;` exists at top; add if missing.

- [ ] **Step 2**: Compile check

```bash
cd backend/java/cretas-api && mvn -DskipTests compile 2>&1 | tail -10
```

Expected: BUILD SUCCESS.

- [ ] **Step 3**: Commit

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/entity/Customer.java
git commit -m "feat(sprint4-w1): Customer entity add assignedSalesUserId field"
```

---

### Task A3: CustomerSalesUserHistory entity + Repository

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/CustomerSalesUserHistory.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/CustomerSalesUserHistoryRepository.java`

- [ ] **Step 1**: Create entity

```java
package com.cretas.aims.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.hibernate.annotations.GenericGenerator;
import java.time.LocalDateTime;

@Entity
@Table(name = "customer_sales_user_history",
       indexes = {
         @Index(name = "idx_csuh_customer_changed", columnList = "customer_id,changed_at"),
         @Index(name = "idx_csuh_factory", columnList = "factory_id,changed_at")
       })
@Data
@EqualsAndHashCode(callSuper = true)
public class CustomerSalesUserHistory extends BaseEntity {

    @Id
    @GeneratedValue(generator = "uuid2")
    @GenericGenerator(name = "uuid2", strategy = "uuid2")
    @Column(name = "id", length = 36)
    private String id;

    @Column(name = "factory_id", nullable = false, length = 50)
    private String factoryId;

    @Column(name = "customer_id", nullable = false, length = 36)
    private String customerId;

    @Column(name = "previous_sales_user_id")
    private Long previousSalesUserId;

    @Column(name = "new_sales_user_id")
    private Long newSalesUserId;

    @Column(name = "changed_by")
    private Long changedBy;

    @Column(name = "changed_at", nullable = false)
    private LocalDateTime changedAt;

    @Column(name = "reason", length = 500)
    private String reason;
}
```

- [ ] **Step 2**: Create Repository

```java
package com.cretas.aims.repository;

import com.cretas.aims.entity.CustomerSalesUserHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface CustomerSalesUserHistoryRepository extends JpaRepository<CustomerSalesUserHistory, String> {

    Page<CustomerSalesUserHistory> findByFactoryIdAndCustomerIdOrderByChangedAtDesc(
            String factoryId, String customerId, Pageable pageable);

    // R4 idempotent dedup: 5min window check
    @Query("SELECT h FROM CustomerSalesUserHistory h " +
           "WHERE h.factoryId = :factoryId AND h.customerId = :customerId " +
           "AND h.newSalesUserId = :newSalesUserId AND h.changedAt > :since " +
           "ORDER BY h.changedAt DESC")
    List<CustomerSalesUserHistory> findRecentChange(
            @Param("factoryId") String factoryId,
            @Param("customerId") String customerId,
            @Param("newSalesUserId") Long newSalesUserId,
            @Param("since") LocalDateTime since);
}
```

- [ ] **Step 3**: Compile

```bash
cd backend/java/cretas-api && mvn -DskipTests compile 2>&1 | tail -5
```

Expected: BUILD SUCCESS.

- [ ] **Step 4**: Commit

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/entity/CustomerSalesUserHistory.java backend/java/cretas-api/src/main/java/com/cretas/aims/repository/CustomerSalesUserHistoryRepository.java
git commit -m "feat(sprint4-w1): CustomerSalesUserHistory entity + Repository"
```

---

### Task A4: CustomerServiceImpl — updateAssignedSalesUser (with R4 idempotent)

**Files:**
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/impl/CustomerServiceImpl.java`
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/CustomerService.java` (interface)

- [ ] **Step 1**: Add to `CustomerService` interface

```java
Customer updateAssignedSalesUser(
        String customerId, Long newSalesUserId, Long changedBy, String reason);
```

- [ ] **Step 2**: Add custom exception or reuse existing

Check if `BusinessConflictException` exists; if not create simple version under `exception/`:

```java
package com.cretas.aims.exception;

import lombok.Getter;

@Getter
public class BusinessConflictException extends RuntimeException {
    private final String existingId;
    private final String actionHint;

    public BusinessConflictException(String message, String existingId, String actionHint) {
        super(message);
        this.existingId = existingId;
        this.actionHint = actionHint;
    }
}
```

- [ ] **Step 3**: Implement in CustomerServiceImpl

```java
@Autowired
private CustomerSalesUserHistoryRepository salesUserHistoryRepository;

@Override
@Transactional
public Customer updateAssignedSalesUser(
        String customerId, Long newSalesUserId, Long changedBy, String reason) {

    Customer customer = customerRepository.findById(customerId)
        .orElseThrow(() -> new ResourceNotFoundException("Customer not found: " + customerId));

    Long previous = customer.getAssignedSalesUserId();
    LocalDateTime now = LocalDateTime.now();

    // R4 idempotent: 5min dedup check
    var recent = salesUserHistoryRepository.findRecentChange(
        customer.getFactoryId(), customerId, newSalesUserId, now.minusMinutes(5));
    if (!recent.isEmpty()) {
        throw new BusinessConflictException(
            "5 分钟内已变更过此客户的业务员 (changeId=" + recent.get(0).getId() + ")",
            recent.get(0).getId(),
            "/sales/customers/" + customerId + "?tab=salesUserHist"
        );
    }

    customer.setAssignedSalesUserId(newSalesUserId);
    customer.setAssignedSalesUserAssignedAt(now);
    customerRepository.save(customer);

    CustomerSalesUserHistory history = new CustomerSalesUserHistory();
    history.setFactoryId(customer.getFactoryId());
    history.setCustomerId(customerId);
    history.setPreviousSalesUserId(previous);
    history.setNewSalesUserId(newSalesUserId);
    history.setChangedBy(changedBy);
    history.setChangedAt(now);
    history.setReason(reason);
    salesUserHistoryRepository.save(history);

    return customer;
}
```

Add imports: `import com.cretas.aims.entity.CustomerSalesUserHistory; import com.cretas.aims.exception.BusinessConflictException; import com.cretas.aims.repository.CustomerSalesUserHistoryRepository; import java.time.LocalDateTime;`

- [ ] **Step 4**: Compile

```bash
cd backend/java/cretas-api && mvn -DskipTests compile 2>&1 | tail -5
```

Expected: BUILD SUCCESS.

- [ ] **Step 5**: Commit

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/service/CustomerService.java backend/java/cretas-api/src/main/java/com/cretas/aims/service/impl/CustomerServiceImpl.java backend/java/cretas-api/src/main/java/com/cretas/aims/exception/BusinessConflictException.java
git commit -m "feat(sprint4-w1): CustomerServiceImpl.updateAssignedSalesUser + R4 idempotent dedup"
```

---

### Task A5: CustomerSalesUserHistoryController

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/CustomerSalesUserHistoryController.java`

- [ ] **Step 1**: Create controller

```java
package com.cretas.aims.controller;

import com.cretas.aims.entity.CustomerSalesUserHistory;
import com.cretas.aims.exception.BusinessConflictException;
import com.cretas.aims.repository.CustomerSalesUserHistoryRepository;
import com.cretas.aims.service.CustomerService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/mobile/{factoryId}")
@RequiredArgsConstructor
public class CustomerSalesUserHistoryController {

    private final CustomerSalesUserHistoryRepository historyRepo;
    private final CustomerService customerService;

    @GetMapping("/customer-sales-user-history")
    public ResponseEntity<?> list(
            @PathVariable String factoryId,
            @RequestParam String customerId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {

        Page<CustomerSalesUserHistory> p = historyRepo
            .findByFactoryIdAndCustomerIdOrderByChangedAtDesc(
                factoryId, customerId,
                PageRequest.of(page - 1, size, Sort.by("changedAt").descending()));

        return ResponseEntity.ok(Map.of(
            "success", true,
            "data", Map.of(
                "content", p.getContent(),
                "totalElements", p.getTotalElements(),
                "totalPages", p.getTotalPages(),
                "page", page,
                "size", size
            ),
            "message", "ok"
        ));
    }

    @PostMapping("/customers/{customerId}/assigned-sales-user")
    public ResponseEntity<?> change(
            @PathVariable String factoryId,
            @PathVariable String customerId,
            @RequestBody Map<String, Object> body,
            @RequestAttribute("currentUserId") Long currentUserId) {

        Long newUserId = body.get("newSalesUserId") == null
            ? null : Long.valueOf(body.get("newSalesUserId").toString());
        String reason = (String) body.get("reason");

        if (newUserId == null) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false, "message", "newSalesUserId 必填"));
        }
        if (reason == null || reason.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false, "message", "reason 必填 — 请选择变更原因"));
        }

        try {
            var customer = customerService.updateAssignedSalesUser(
                customerId, newUserId, currentUserId, reason);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", customer,
                "message", "业务员变更成功"
            ));
        } catch (BusinessConflictException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "success", false,
                "message", e.getMessage(),
                "existingId", e.getExistingId(),
                "actionHint", e.getActionHint()
            ));
        }
    }
}
```

- [ ] **Step 2**: Compile + boot test (local)

```bash
cd backend/java/cretas-api && mvn -DskipTests spring-boot:run 2>&1 | tee /tmp/boot.log &
BOOT_PID=$!
sleep 90
curl -s http://localhost:10010/api/mobile/health
kill $BOOT_PID 2>/dev/null
```

Expected: health endpoint returns `{success:true,...}`. Migration auto-applied; check via `psql -d cretas_db -c "\dt customer_sales_user_history"`.

- [ ] **Step 3**: Commit

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/controller/CustomerSalesUserHistoryController.java
git commit -m "feat(sprint4-w1): CustomerSalesUserHistoryController GET list + POST change"
```

**MILESTONE COMMIT** after A5 — Phase A core done.

---

### Task A6: CustomerTrackingRecordController CRUD

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/CustomerTrackingRecordController.java`
- Verify: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/CustomerTrackingRecordRepository.java` (existing — confirm has `findByFactoryIdAndCustomerId` method; add if missing)

- [ ] **Step 1**: Inspect existing Repository

```bash
cat backend/java/cretas-api/src/main/java/com/cretas/aims/repository/CustomerTrackingRecordRepository.java
```

If `findByFactoryIdAndCustomerIdOrderByCreatedAtDesc(String, String, Pageable)` missing → add it:

```java
Page<CustomerTrackingRecord> findByFactoryIdAndCustomerIdOrderByCreatedAtDesc(
        String factoryId, String customerId, Pageable pageable);
```

- [ ] **Step 2**: Create controller

```java
package com.cretas.aims.controller;

import com.cretas.aims.entity.CustomerTrackingRecord;
import com.cretas.aims.repository.CustomerTrackingRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/mobile/{factoryId}/customer-tracking")
@RequiredArgsConstructor
public class CustomerTrackingRecordController {

    private final CustomerTrackingRecordRepository repo;

    @GetMapping
    public ResponseEntity<?> list(
            @PathVariable String factoryId,
            @RequestParam String customerId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {

        Page<CustomerTrackingRecord> p = repo.findByFactoryIdAndCustomerIdOrderByCreatedAtDesc(
            factoryId, customerId,
            PageRequest.of(page - 1, size, Sort.by("createdAt").descending()));

        return ResponseEntity.ok(Map.of(
            "success", true,
            "data", Map.of(
                "content", p.getContent(),
                "totalElements", p.getTotalElements(),
                "totalPages", p.getTotalPages()
            ),
            "message", "ok"
        ));
    }

    @PostMapping
    public ResponseEntity<?> create(
            @PathVariable String factoryId,
            @RequestBody CustomerTrackingRecord body,
            @RequestAttribute("currentUserId") Long currentUserId) {

        body.setId(null);
        body.setFactoryId(factoryId);
        body.setCreatedBy(currentUserId);
        body.setCreatedAt(LocalDateTime.now());
        var saved = repo.save(body);
        return ResponseEntity.ok(Map.of(
            "success", true, "data", saved, "message", "跟踪记录已创建"));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(
            @PathVariable String factoryId,
            @PathVariable String id,
            @RequestBody CustomerTrackingRecord body) {

        var existing = repo.findById(id).orElse(null);
        if (existing == null || !factoryId.equals(existing.getFactoryId())) {
            return ResponseEntity.notFound().build();
        }
        existing.setContent(body.getContent());
        existing.setTrackingType(body.getTrackingType());
        existing.setUpdatedAt(LocalDateTime.now());
        var saved = repo.save(existing);
        return ResponseEntity.ok(Map.of(
            "success", true, "data", saved, "message", "已更新"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(
            @PathVariable String factoryId,
            @PathVariable String id) {

        var existing = repo.findById(id).orElse(null);
        if (existing == null || !factoryId.equals(existing.getFactoryId())) {
            return ResponseEntity.notFound().build();
        }
        existing.setDeletedAt(LocalDateTime.now());
        repo.save(existing);
        return ResponseEntity.ok(Map.of(
            "success", true, "message", "已删除"));
    }
}
```

**Note**: Confirm `CustomerTrackingRecord` entity has fields `content` + `trackingType` + `createdBy` via `cat entity/CustomerTrackingRecord.java`. If field names differ, adapt setters.

- [ ] **Step 3**: Compile + smoke

```bash
cd backend/java/cretas-api && mvn -DskipTests compile 2>&1 | tail -5
```

- [ ] **Step 4**: Commit

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/controller/CustomerTrackingRecordController.java backend/java/cretas-api/src/main/java/com/cretas/aims/repository/CustomerTrackingRecordRepository.java
git commit -m "feat(sprint4-w1): CustomerTrackingRecordController CRUD (tab 1 source)"
```

---

## Phase B — Frontend Skeleton (Day 1-3 parallel)

### Task B1: Router entry — `/sales/customers/:id`

**Files:**
- Modify: `web-admin/src/router/index.ts` (after line 374 'customers' entry)

- [ ] **Step 1**: Add route after `'customers'` route

```typescript
{
  path: 'customers',
  name: 'SalesCustomers',
  component: () => import('@/views/sales/customers/list.vue'),
  meta: { requiresAuth: true, title: '客户管理', module: 'sales' }
},
{
  path: 'customers/:id',
  name: 'SalesCustomerDetail',
  component: () => import('@/views/sales/customers/detail.vue'),
  meta: {
    requiresAuth: true,
    title: '客户详情',
    module: 'sales',
    activeMenu: '/sales/customers',
    hideForFactoryTypes: ['RESTAURANT']  // mirror existing customers entry visibility
  }
},
```

(Verify customer module visibility — restaurants may or may not need this. Check spec §3 + sibling entries.)

- [ ] **Step 2**: Verify TS compiles

```bash
cd web-admin && npx vue-tsc --noEmit 2>&1 | tail -3
```

Expected: 0 errors (file ref will fail until detail.vue exists — accept temporary import-resolve error, fix in B2).

Actually — Step 2 will fail because `detail.vue` doesn't exist. Skip until B2 ships skeleton.

- [ ] **Step 3**: (DEFER commit to combine with B2 stub) — proceed to B2.

---

### Task B2: detail.vue skeleton + CustomerHeader

**Files:**
- Create: `web-admin/src/views/sales/customers/detail.vue`
- Create: `web-admin/src/views/sales/customers/detail/CustomerHeader.vue`

- [ ] **Step 1**: Create CustomerHeader.vue

```vue
<template>
  <el-card class="customer-header" v-loading="loading">
    <div v-if="customer" class="header-grid">
      <div class="primary">
        <h2>{{ customer.name }}</h2>
        <div class="meta">
          <el-tag size="small">{{ customer.customerCode }}</el-tag>
          <el-tag v-if="customer.customerType" size="small" type="info">{{ customer.customerType }}</el-tag>
          <el-rate v-if="customer.rating" :model-value="customer.rating" disabled size="small" />
        </div>
      </div>
      <div class="contact">
        <div><el-icon><User /></el-icon> {{ customer.contactName || customer.contactPerson || '—' }}</div>
        <div><el-icon><Phone /></el-icon> {{ customer.contactPhone || customer.phone || '—' }}</div>
        <div><el-icon><Message /></el-icon> {{ customer.contactEmail || customer.email || '—' }}</div>
      </div>
      <div class="finance">
        <div>余额: <strong v-if="canViewPrice">{{ formatMoney(customer.currentBalance) }}</strong><span v-else class="masked">****</span></div>
        <div>信用额: <strong v-if="canViewPrice">{{ formatMoney(customer.creditLimit) }}</strong><span v-else class="masked">****</span></div>
        <div>当前业务员: <strong>{{ assignedSalesUserName || '未分配' }}</strong></div>
      </div>
    </div>
    <el-skeleton v-else :rows="3" animated />
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { User, Phone, Message } from '@element-plus/icons-vue'
import { useCanViewPrice } from '@/composables/useCanViewPrice'

const props = defineProps<{
  customer: any | null   // type narrowed in B4 once type defined
  loading?: boolean
  assignedSalesUserName?: string
}>()

const canViewPrice = useCanViewPrice()

function formatMoney(v: any): string {
  if (v == null) return '—'
  return Number(v).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })
}
</script>

<style scoped>
.customer-header { margin-bottom: 16px; }
.header-grid { display: grid; grid-template-columns: 2fr 1.5fr 1.5fr; gap: 24px; }
.header-grid h2 { margin: 0 0 8px 0; }
.meta { display: flex; gap: 8px; align-items: center; }
.contact > div, .finance > div { margin: 4px 0; display: flex; gap: 6px; align-items: center; }
.masked { color: var(--el-text-color-secondary); font-family: monospace; letter-spacing: 2px; }
</style>
```

- [ ] **Step 2**: Create `useCanViewPrice` composable

```typescript
// web-admin/src/composables/useCanViewPrice.ts
import { computed, type ComputedRef } from 'vue'
import { useUserStore } from '@/stores/user'

export function useCanViewPrice(): ComputedRef<boolean> {
  const userStore = useUserStore()
  return computed(() => {
    const perms = userStore.permissions || []
    return perms.includes('CAN_VIEW_PRICE') || perms.includes('*')
  })
}
```

If `useUserStore` differs (e.g., `useAuthStore`) → adapt. Verify with:

```bash
grep -rn "export const useUserStore\|export const useAuthStore" web-admin/src/stores/ | head -3
```

- [ ] **Step 3**: Create detail.vue skeleton (full TAB_DEFS, all components null for now)

```vue
<template>
  <div class="customer-detail">
    <CustomerHeader :customer="customer" :loading="customerLoading"
                    :assigned-sales-user-name="assignedSalesUserName" />
    <el-tabs v-model="activeTab" class="business-tabs" @tab-change="onTabChange">
      <el-tab-pane v-for="t in TAB_DEFS" :key="t.key" :name="t.key" :label="t.label">
        <KeepAlive>
          <component
            v-if="t.component"
            :is="t.component"
            :customer-id="customerId"
            :customer="customer" />
          <PlaceholderTab
            v-else
            :tab-name="t.label"
            :status="t.status || '功能开发中'"
            :workaround-hint="t.workaround"
            :action-text="t.actionText"
            :action-route="t.actionRoute && resolveActionRoute(t.actionRoute)" />
        </KeepAlive>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getCustomer } from '@/api/sales/customer'
import CustomerHeader from './detail/CustomerHeader.vue'
import PlaceholderTab from './detail/tabs/PlaceholderTab.vue'

const route = useRoute()
const router = useRouter()
const customerId = computed(() => route.params.id as string)
const activeTab = ref<string>((route.query.tab as string) || 'tracking')

const customer = ref<any | null>(null)
const customerLoading = ref(false)
const assignedSalesUserName = ref<string>('')

const TAB_DEFS = [
  { key: 'tracking', label: '跟踪记录', component: null },   // wire in D4
  { key: 'wechat',   label: '微信记录', status: '暂未对接企微 API', workaround: '当前请用「跟踪记录」tab 手工补录', actionText: '去跟踪记录', actionRoute: 'tracking' },
  { key: 'call',     label: '通话记录', status: '暂未对接呼叫中心', workaround: '当前请用「跟踪记录」tab 手工补录', actionText: '去跟踪记录', actionRoute: 'tracking' },
  { key: 'sms',      label: '短信记录', status: 'Sprint 5+ 上线', workaround: '当前请用「跟踪记录」tab 手工补录', actionText: '去跟踪记录', actionRoute: 'tracking' },
  { key: 'audio',    label: '谈话录音', status: 'Sprint 6+ 上线', workaround: '当前请用「跟踪记录」tab 手工补录', actionText: '去跟踪记录', actionRoute: 'tracking' },
  { key: 'email',    label: '邮件列表', status: 'Sprint 5+ 上线', workaround: '当前请用「跟踪记录」tab 手工补录', actionText: '去跟踪记录', actionRoute: 'tracking' },
  { key: 'orders',   label: '销售单', component: null },     // wire in D4
  { key: 'samples',  label: '样品单', component: null },     // wire in D5
  { key: 'quotes',   label: '报价单', component: null },     // wire in D5
  { key: 'products', label: '产品',   component: null },     // wire in D8
  { key: 'campaign', label: '活动管理', status: 'Sprint 5+ (CRM 模块)', workaround: '当前请在「跟踪记录」记录活动', actionText: '去跟踪记录', actionRoute: 'tracking' },
  { key: 'opportunity', label: '商机管理', status: 'Sprint 5+ 上线', workaround: '当前请在「跟踪记录」记录商机', actionText: '去跟踪记录', actionRoute: 'tracking' },
  { key: 'itemStats', label: '商品统计', component: null },  // wire in D8
  { key: 'shipAddr', label: '收件地址', component: null },   // wire in D9
  { key: 'invoices', label: '开票',   component: null },     // wire in D6
  { key: 'payments', label: '收款',   component: null },     // wire in D6
  { key: 'returns',  label: '退货',   component: null },     // wire in D7
  { key: 'aftersales', label: '售后', status: 'Sprint 6+ 上线', workaround: '当前请用「退货」tab 处理售后退货', actionText: '去退货', actionRoute: 'returns' },
  { key: 'priceMemory', label: '价格记忆', component: null }, // wire in D10
  { key: 'salesUserHist', label: '业务员变更', component: null }, // wire in D9
  { key: 'attachments', label: '文件附件', component: null }, // wire in D7
]

function onTabChange(key: string | number) {
  router.replace({ query: { ...route.query, tab: String(key) } })
}

function resolveActionRoute(tabKey: string): any {
  // Switch within detail page to another tab
  return { name: 'SalesCustomerDetail', params: { id: customerId.value }, query: { tab: tabKey } }
}

onMounted(async () => {
  customerLoading.value = true
  try {
    customer.value = await getCustomer(customerId.value)
    // assignedSalesUserName resolved in D9 (currently empty)
  } catch (e: any) {
    const status = e?.response?.status
    if (status === 404) {
      ElMessage.error('客户不存在')
      router.replace('/sales/customers')
    } else if (status === 403) {
      router.replace('/403')
    } else {
      ElMessage({
        message: e?.response?.data?.message || '加载失败',
        type: 'error', duration: 0, showClose: true,
      })
    }
  } finally {
    customerLoading.value = false
  }
})
</script>

<style scoped>
.customer-detail { padding: 16px; }
.business-tabs { background: var(--el-bg-color); padding: 16px; border-radius: 4px; }
</style>
```

- [ ] **Step 4**: Stub `getCustomer` in API client

```typescript
// web-admin/src/api/sales/customer.ts (modify; check existing exports first)
import { request } from '@/api/request'

export async function getCustomer(id: string): Promise<any> {
  const factoryId = useUserStore().factoryId  // adapt to actual store API
  const res = await request.get(`/api/mobile/${factoryId}/customers/${id}`)
  return res.data
}
```

Verify the actual mobile endpoint exists (`grep -rn "/customers/{id}\|CustomerController" backend/java/cretas-api/src/main/java/com/cretas/aims/controller`). Adapt path if different.

- [ ] **Step 5**: PlaceholderTab.vue stub (full content in B3 next task — minimal for now)

```vue
<!-- web-admin/src/views/sales/customers/detail/tabs/PlaceholderTab.vue -->
<template>
  <el-empty :image-size="120">
    <template #description>
      <p>「{{ tabName }}」{{ status }}</p>
      <p v-if="workaroundHint" class="hint">{{ workaroundHint }}</p>
    </template>
    <el-button v-if="actionText" type="primary" @click="$router.push(actionRoute)">
      {{ actionText }}
    </el-button>
  </el-empty>
</template>
<script setup lang="ts">
defineProps<{
  tabName: string
  status: string
  workaroundHint?: string
  actionText?: string
  actionRoute?: any
}>()
</script>
<style scoped>
.hint { color: var(--el-text-color-secondary); font-size: 12px; }
</style>
```

- [ ] **Step 6**: Build verify

```bash
cd web-admin && npm run build 2>&1 | tail -10
```

Expected: BUILD SUCCESS (warnings OK). If TS errors → fix imports/types inline.

- [ ] **Step 7**: Commit (B1 + B2 together using safe-commit)

```bash
git add web-admin/src/router/index.ts \
        web-admin/src/views/sales/customers/detail.vue \
        web-admin/src/views/sales/customers/detail/CustomerHeader.vue \
        web-admin/src/views/sales/customers/detail/tabs/PlaceholderTab.vue \
        web-admin/src/api/sales/customer.ts \
        web-admin/src/composables/useCanViewPrice.ts
git status --short  # verify only these files staged
git commit -m "feat(sprint4-w1): detail.vue skeleton + 8 defer tab wired + CustomerHeader"
```

**MILESTONE COMMIT** after B2 — frontend skeleton 完成, 8 defer tab 全部 R5 next-action ready.

---

## Phase C — Backend Tab Extensions (Day 4-7 parallel with Phase D)

### Task C1: Extend 6 existing controllers with `?customerId=`

For each controller below, the pattern is identical:
1. Add `@RequestParam(required=false) String customerId` to list endpoint
2. Add `findByFactoryIdAndCustomerId` method to Repository (PG null-safe via `CAST(:customerId AS string) IS NULL`)
3. Service layer dispatches to filtered method if customerId present

**Controllers + Repos to modify:**

| Controller | Endpoint | Repository |
|---|---|---|
| `inventory/SalesController` | GET `/sales/list` | `SalesOrderRepository` |
| `rd/RdController` (samples) | GET `/rd/samples` | `ProductSampleRepository` |
| `finance/InvoiceController` | GET `/invoices` | `InvoiceRecordRepository` |
| `finance/PaymentRecordController` | GET `/payment-records` | `PaymentRecordRepository` |
| `inventory/ReturnOrderController` | GET `/return-orders` | `ReturnOrderRepository` |
| `ShipmentController` | GET `/shipments` | `ShipmentRecordRepository` |

- [ ] **Step 1 (per controller)**: Inspect current list signature

```bash
grep -nB1 -A8 "@GetMapping\|public.*list\|public.*page" backend/java/cretas-api/src/main/java/com/cretas/aims/controller/inventory/SalesController.java | head -30
```

Adapt: locate the list endpoint, identify Repository call site.

- [ ] **Step 2 (per controller)**: Add Repository method (PG null-safe)

Example for `SalesOrderRepository`:

```java
@Query("SELECT s FROM SalesOrder s WHERE s.factoryId = :factoryId " +
       "AND (CAST(:customerId AS string) IS NULL OR s.customerId = :customerId) " +
       "AND s.deletedAt IS NULL")
Page<SalesOrder> findByFactoryIdAndOptionalCustomer(
        @Param("factoryId") String factoryId,
        @Param("customerId") String customerId,
        Pageable pageable);
```

The `CAST(:customerId AS string)` is **mandatory** for PG null-param type inference (see `database-entity-sync.md` PG `IS NULL` pattern).

- [ ] **Step 3 (per controller)**: Controller signature

Add `@RequestParam(required=false) String customerId` to list endpoint, dispatch to new repo method.

- [ ] **Step 4 (per controller)**: Compile + smoke

```bash
cd backend/java/cretas-api && mvn -DskipTests compile 2>&1 | tail -5
```

- [ ] **Step 5 (per controller)**: Commit

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/controller/<path>.java \
        backend/java/cretas-api/src/main/java/com/cretas/aims/repository/<repo>.java
git commit -m "feat(sprint4-w1): <ControllerName> add ?customerId= filter (PG null-safe)"
```

**Repeat for all 6 controllers.** Estimated 1d total (mechanical, ~10min each).

---

### Task C2: AttachmentController — verify `?entityType=CUSTOMER&entityId=` support

- [ ] **Step 1**: Grep existing endpoints

```bash
grep -nB1 -A8 "@GetMapping\|@RequestMapping" backend/java/cretas-api/src/main/java/com/cretas/aims/controller/AttachmentController.java
```

- [ ] **Step 2**: If supported → no change. If missing entityType filter → add `@RequestParam` per C1 pattern.

- [ ] **Step 3**: Commit if changed:

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/controller/AttachmentController.java
git commit -m "feat(sprint4-w1): AttachmentController ?entityType=CUSTOMER filter (if missing)"
```

---

### Task C3: Backend unit tests for new entities/services

**Files:**
- Create: `backend/java/cretas-api/src/test/java/com/cretas/aims/service/CustomerServiceImplUpdateAssignedSalesUserTest.java`
- Create: `backend/java/cretas-api/src/test/java/com/cretas/aims/controller/CustomerSalesUserHistoryControllerTest.java`
- Create: `backend/java/cretas-api/src/test/java/com/cretas/aims/controller/CustomerTrackingRecordControllerTest.java`

- [ ] **Step 1**: Service test — happy path

```java
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {"spring.flyway.enabled=true"})
@Transactional
class CustomerServiceImplUpdateAssignedSalesUserTest {

  @Autowired CustomerService customerService;
  @Autowired CustomerRepository customerRepo;
  @Autowired CustomerSalesUserHistoryRepository historyRepo;

  @Test
  void updateAssignedSalesUser_recordsHistory() {
    Customer c = createTestCustomer("F999");
    customerService.updateAssignedSalesUser(c.getId(), 100L, 1L, "测试变更");

    Customer reloaded = customerRepo.findById(c.getId()).orElseThrow();
    assertEquals(100L, reloaded.getAssignedSalesUserId());

    var history = historyRepo.findByFactoryIdAndCustomerIdOrderByChangedAtDesc(
        "F999", c.getId(), PageRequest.of(0, 10));
    assertEquals(1, history.getTotalElements());
    assertEquals(100L, history.getContent().get(0).getNewSalesUserId());
    assertEquals("测试变更", history.getContent().get(0).getReason());
  }

  @Test
  void updateAssignedSalesUser_idempotentDedup_throwsConflict() {
    Customer c = createTestCustomer("F999");
    customerService.updateAssignedSalesUser(c.getId(), 100L, 1L, "首次");
    var ex = assertThrows(BusinessConflictException.class, () ->
        customerService.updateAssignedSalesUser(c.getId(), 100L, 1L, "重复")
    );
    assertNotNull(ex.getExistingId());
    assertTrue(ex.getMessage().contains("5 分钟内已变更过"));
  }
}
```

Helper `createTestCustomer` — implement using `customerRepo.save(new Customer(...))`.

- [ ] **Step 2**: Controller integration tests — MockMvc + 200/400/409

```java
@SpringBootTest
@AutoConfigureMockMvc
class CustomerSalesUserHistoryControllerTest {
  @Autowired MockMvc mvc;
  @Autowired CustomerRepository customerRepo;

  @Test @WithMockUser
  void post_change_returns200_andHistory() throws Exception {
    String cid = createTestCustomer("F999").getId();
    mvc.perform(post("/api/mobile/F999/customers/" + cid + "/assigned-sales-user")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"newSalesUserId\": 100, \"reason\": \"离职交接\"}")
            .requestAttr("currentUserId", 1L))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true));
  }

  @Test @WithMockUser
  void post_missingReason_returns400() throws Exception {
    String cid = createTestCustomer("F999").getId();
    mvc.perform(post("/api/mobile/F999/customers/" + cid + "/assigned-sales-user")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"newSalesUserId\": 100}")
            .requestAttr("currentUserId", 1L))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("reason 必填")));
  }

  @Test @WithMockUser
  void post_duplicate_returns409_withExistingId() throws Exception {
    String cid = createTestCustomer("F999").getId();
    mvc.perform(post("/api/mobile/F999/customers/" + cid + "/assigned-sales-user")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"newSalesUserId\": 100, \"reason\": \"首次\"}")
            .requestAttr("currentUserId", 1L))
        .andExpect(status().isOk());
    mvc.perform(post("/api/mobile/F999/customers/" + cid + "/assigned-sales-user")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"newSalesUserId\": 100, \"reason\": \"重复\"}")
            .requestAttr("currentUserId", 1L))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.existingId").exists())
        .andExpect(jsonPath("$.actionHint").exists());
  }
}
```

- [ ] **Step 3**: Run tests

```bash
cd backend/java/cretas-api && mvn test -Dtest=CustomerServiceImplUpdateAssignedSalesUserTest,CustomerSalesUserHistoryControllerTest,CustomerTrackingRecordControllerTest
```

Expected: all GREEN.

- [ ] **Step 4**: Commit

```bash
git add backend/java/cretas-api/src/test/java/com/cretas/aims/service/CustomerServiceImplUpdateAssignedSalesUserTest.java \
        backend/java/cretas-api/src/test/java/com/cretas/aims/controller/CustomerSalesUserHistoryControllerTest.java \
        backend/java/cretas-api/src/test/java/com/cretas/aims/controller/CustomerTrackingRecordControllerTest.java
git commit -m "test(sprint4-w1): backend tests — service + 2 controllers (R4 dedup + 400/200/409)"
```

**MILESTONE COMMIT** after C3 — backend done end-to-end.

---

## Phase D — Frontend Real Tabs (Day 4-10)

### Reusable Sub-Component Template

Every real tab follows this state-machine pattern. Document once, reference per task:

```vue
<template>
  <div class="tab-{{key}}">
    <div class="tab-toolbar">
      <span class="tab-title">{{label}}</span>
      <el-button :icon="Refresh" @click="fetch" :loading="state === 'loading'">刷新</el-button>
    </div>
    <el-skeleton v-if="state === 'loading'" :rows="5" animated />
    <el-empty v-else-if="state === 'empty'" :description="emptyMsg" :image-size="80">
      <el-button v-if="emptyCtaText" type="primary" @click="onEmptyCta">{{ emptyCtaText }}</el-button>
    </el-empty>
    <div v-else-if="state === 'error'" class="error-panel">
      <el-result icon="error" :title="errorMsg">
        <template #extra>
          <el-button type="primary" @click="fetch">重试</el-button>
        </template>
      </el-result>
    </div>
    <component v-else :is="ListComponent" :data="data" :loading="state === 'loading'" v-bind="extraProps" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { isAxiosError } from 'axios'
// ... import API client + List component

const props = defineProps<{ customerId: string; customer?: any }>()
const state = ref<'loading' | 'ready' | 'empty' | 'error'>('loading')
const data = ref<Type[]>([])
const errorMsg = ref('')

async function fetch() {
  state.value = 'loading'
  try {
    const res = await listApi(props.customerId, { page: 1, size: 20 })
    data.value = res.content
    state.value = data.value.length === 0 ? 'empty' : 'ready'
  } catch (e) {
    handleError(e)
  }
}

function handleError(e: unknown) {
  if (isAxiosError(e)) {
    const status = e.response?.status
    const backendMsg = e.response?.data?.message
    if (status === 403) { state.value = 'error'; errorMsg.value = '无权限查看' }
    else if (status === 401) { /* auth interceptor handles */ }
    else if (status === 409 && e.response?.data?.existingId) {
      ElMessageBox.confirm(`${backendMsg}, 是否查看?`, '操作冲突', { type: 'warning' })
        .then(() => router.push(e.response.data.actionHint))
        .catch(() => {})
    } else {
      state.value = 'error'
      errorMsg.value = backendMsg || '加载失败'
      ElMessage({ message: errorMsg.value, type: 'error', duration: 0, showClose: true })
    }
  } else {
    state.value = 'error'
    errorMsg.value = '网络异常'
  }
  console.error(`[CustomerDetail/${tabKey}] fetch failed:`, e)
}

onMounted(fetch)
</script>
```

**Per-task instructions below**: each task creates a sub-component using this template + lists deviations.

---

### Task D1 (Day 4): TrackingTab.vue (tab 1, CRUD)

**Files:**
- Create: `web-admin/src/api/sales/customerTracking.ts`
- Create: `web-admin/src/views/sales/customers/detail/tabs/TrackingTab.vue`
- Modify: `web-admin/src/views/sales/customers/detail.vue` (wire `component: defineAsyncComponent(() => import('./detail/tabs/TrackingTab.vue'))`)

- [ ] **Step 1**: API client

```typescript
// web-admin/src/api/sales/customerTracking.ts
import { request } from '@/api/request'
import { useUserStore } from '@/stores/user'

export interface CustomerTrackingRecord {
  id: string; customerId: string; content: string;
  trackingType: string; createdAt: string; createdBy: number;
}

export async function listTracking(customerId: string, params: { page: number; size: number }) {
  const factoryId = useUserStore().factoryId
  const res = await request.get(`/api/mobile/${factoryId}/customer-tracking`, {
    params: { customerId, ...params }
  })
  return res.data
}

export async function createTracking(body: Partial<CustomerTrackingRecord>) {
  const factoryId = useUserStore().factoryId
  const res = await request.post(`/api/mobile/${factoryId}/customer-tracking`, body)
  return res.data
}

export async function updateTracking(id: string, body: Partial<CustomerTrackingRecord>) {
  const factoryId = useUserStore().factoryId
  const res = await request.put(`/api/mobile/${factoryId}/customer-tracking/${id}`, body)
  return res.data
}

export async function deleteTracking(id: string) {
  const factoryId = useUserStore().factoryId
  const res = await request.delete(`/api/mobile/${factoryId}/customer-tracking/${id}`)
  return res.data
}

export const TRACKING_TYPES = [
  { value: 'PHONE',   label: '电话沟通' },
  { value: 'WECHAT',  label: '微信沟通' },
  { value: 'EMAIL',   label: '邮件沟通' },
  { value: 'VISIT',   label: '上门拜访' },
  { value: 'VIDEO',   label: '视频会议' },
  { value: 'OTHER',   label: '其他' },
]
```

- [ ] **Step 2**: TrackingTab.vue — full component

Use the template above + add:
- "新增跟踪" button → opens `<el-dialog>` with header `新增跟踪 — {{ customer.name }} ({{ customer.customerCode }})` (R2 context)
- Form: `trackingType` dropdown (R3, TRACKING_TYPES) + `content` textarea (required)
- Submit → `createTracking` → on success refetch list, on 409 dedup → MessageBox confirm
- Table columns: 时间 / 类型 (badge) / 内容 / 操作 (编辑/删除)

(Full ~250 LOC, see template + adapt. Critical: dialog header MUST include customer name + code per R2; trackingType MUST be dropdown not free text per R3.)

- [ ] **Step 3**: Wire in detail.vue TAB_DEFS

```typescript
{ key: 'tracking', label: '跟踪记录', component: defineAsyncComponent(() => import('./detail/tabs/TrackingTab.vue')) },
```

- [ ] **Step 4**: Manual smoke (dev server)

```bash
cd web-admin && npm run dev
# navigate http://localhost:5173/sales/customers/<test-id>?tab=tracking
# verify list loads, create dialog opens, type dropdown 6 options
```

- [ ] **Step 5**: Commit

```bash
git add web-admin/src/api/sales/customerTracking.ts \
        web-admin/src/views/sales/customers/detail/tabs/TrackingTab.vue \
        web-admin/src/views/sales/customers/detail.vue
git commit -m "feat(sprint4-w1): TrackingTab.vue (tab 1) CRUD + R2 dialog context + R3 type dropdown"
```

---

### Task D2 (Day 4): OrdersTab.vue (tab 7, with canViewPrice mask)

**Files:**
- Modify: `web-admin/src/api/sales/order.ts` (verify list signature; add `customerId` param if missing in client)
- Create: `web-admin/src/views/sales/customers/detail/tabs/OrdersTab.vue`
- Modify: `web-admin/src/views/sales/customers/detail.vue` (wire)

- [ ] **Step 1**: Verify existing order list client

```bash
grep -rn "listOrders\|listSalesOrders\|GET.*sales.*list\|/sales/list" web-admin/src/api/ web-admin/src/views/sales/orders/ | head -10
```

If existing client supports filters → extend with `customerId`. Else create new function.

- [ ] **Step 2**: OrdersTab.vue using template + mask

```vue
<!-- key columns -->
<el-table-column label="订单号" prop="orderCode" />
<el-table-column label="下单时间" prop="orderDate" />
<el-table-column label="数量" prop="totalQuantity" align="right" />
<el-table-column label="总额" align="right">
  <template #default="{ row }">
    <span v-if="canViewPrice">{{ formatMoney(row.totalAmount) }}</span>
    <span v-else class="masked">****</span>
  </template>
</el-table-column>
<el-table-column label="状态" prop="status" />
<el-table-column label="操作">
  <template #default="{ row }">
    <el-button link @click="goOrder(row.id)">查看</el-button>
  </template>
</el-table-column>
```

Empty state CTA: `<el-button type="primary" @click="goCreateOrder">创建销售单</el-button>` (R5 navigation).

- [ ] **Step 3**: Wire + smoke + commit (same pattern as D1)

```bash
git commit -m "feat(sprint4-w1): OrdersTab.vue (tab 7) + canViewPrice mask"
```

---

### Task D3 (Day 5): SamplesTab.vue + QuotesTab.vue

Both follow OrdersTab pattern. Use existing API clients (samples via RdController, quotes via OperationalQuoteController — already supports `customerId`).

- [ ] **D3.1**: SamplesTab.vue — sample list (no mask, samples typically not price-sensitive but check)
- [ ] **D3.2**: QuotesTab.vue — quote list with `quotedPrice/quoteTotalAmount` mask
- [ ] **D3.3**: Wire both in TAB_DEFS, build verify, commit each:

```bash
git commit -m "feat(sprint4-w1): SamplesTab.vue (tab 8)"
git commit -m "feat(sprint4-w1): QuotesTab.vue (tab 9) + mask"
```

---

### Task D4 (Day 6): InvoicesTab.vue + PaymentsTab.vue (both with mask)

- [ ] **D4.1**: InvoicesTab.vue
- [ ] **D4.2**: PaymentsTab.vue

Pattern identical to OrdersTab. Mask columns per spec §7.2.

```bash
git commit -m "feat(sprint4-w1): InvoicesTab.vue (tab 15) + mask"
git commit -m "feat(sprint4-w1): PaymentsTab.vue (tab 16) + mask"
```

---

### Task D5 (Day 7): ReturnsTab.vue + AttachmentsTab.vue

- [ ] **D5.1**: ReturnsTab.vue — uses `ReturnOrderController` + mask on `refundAmount`
- [ ] **D5.2**: AttachmentsTab.vue — uses `AttachmentController` + `?entityType=CUSTOMER&entityId=`. Upload via existing `<el-upload>`.

```bash
git commit -m "feat(sprint4-w1): ReturnsTab.vue (tab 17) + mask"
git commit -m "feat(sprint4-w1): AttachmentsTab.vue (tab 21) + upload"
```

---

### Task D6 (Day 8): ItemStatsTab.vue + ProductsTab.vue (frontend aggregation)

**Critical**: these tabs aggregate from `OrdersTab` data — no backend endpoint.

- [ ] **D6.1**: ItemStatsTab.vue
  - Fetch up to 500 orders for customer
  - Reduce `orders.flatMap(o => o.items)` grouped by `skuId`
  - Display: SKU 名称 / 总数量 / 销售额 (mask if !canViewPrice) / 最后购买时间
  - Sort by 销售额 desc
  - Warning if `orders.length === 500`: "聚合基于近 500 单 — 全量请用导出"

- [ ] **D6.2**: ProductsTab.vue
  - Same fetch, but deduplicate by `productId` (parent product, not SKU variant)
  - Display: 产品名 / 规格列表 / 总购买次数 / 首次/最后购买时间
  - No mask (product names not price-sensitive)

```bash
git commit -m "feat(sprint4-w1): ItemStatsTab.vue (tab 13) frontend aggregation + mask + 500 limit warn"
git commit -m "feat(sprint4-w1): ProductsTab.vue (tab 10) product dedup aggregation"
```

---

### Task D7 (Day 9): ShippingAddressTab.vue + SalesUserHistoryTab.vue

- [ ] **D7.1**: ShippingAddressTab.vue
  - Display `customer.shippingAddress` + `billingAddress` (current single field, history defer to Sprint 5)
  - "编辑" button → patch Customer endpoint (existing)
  - No mask

- [ ] **D7.2**: SalesUserHistoryTab.vue — **R1 + R2 + R3 + R4 all apply**
  - List history table: 变更时间 / 原业务员 / 新业务员 / 变更人 / 原因
  - "变更业务员" button → `<el-dialog>`:
    - Header: `变更业务员 — {{ customer.name }} ({{ customer.customerCode }})` (R2)
    - **R1 边界预显**: large text "当前业务员: {{ currentAssignedName }}"
    - Form:
      - `newSalesUserId` `<el-select>` (fetch user list via existing API)
      - `reason` `<el-select>` (R3, 6 options including 其他)
      - `<el-input type="textarea">` v-if reason==='其他' (required)
    - Submit disabled if `newSalesUserId === currentAssignedUserId` (R1)
    - Submit disabled if reason empty (R1)
    - POST → `updateAssignedSalesUser` → on 409 confirm-and-redirect (R4 handler in template)
    - On success: refetch list + ElMessage.success + emit('changed') to refresh CustomerHeader

```typescript
const CHANGE_REASONS = [
  { value: 'RESIGNATION', label: '离职交接' },
  { value: 'TERRITORY', label: '区域调整' },
  { value: 'CUSTOMER_REQUEST', label: '客户要求' },
  { value: 'PERFORMANCE', label: '业绩重分配' },
  { value: 'PROBATION_END', label: '试用期到期' },
  { value: 'OTHER', label: '其他' },
]
```

```bash
git commit -m "feat(sprint4-w1): ShippingAddressTab.vue (tab 14)"
git commit -m "feat(sprint4-w1): SalesUserHistoryTab.vue (tab 20) + R1/R2/R3/R4 dialog"
```

---

### Task D8 (Day 10): PriceMemoryTab.vue + Chat B integration probe

- [ ] **D8.1**: Probe Chat B status

```bash
gh pr list --search "S-PRICE-1 in:title" --state all --json number,state,title 2>/dev/null
# OR ask Steve / check organizer chat for Chat B ship status
```

- [ ] **D8.2**: If Chat B shipped (entity + controller exist):
  - Wire to `CustomerPriceMemoryController` list endpoint
  - Display: SKU / 记忆价 / 上次报价时间 / 报价单号
  - Mask `memoryPrice/lastQuotedPrice` per canViewPrice

- [ ] **D8.3**: If Chat B NOT shipped:
  - PriceMemoryTab.vue internally renders `<PlaceholderTab status="价格记忆功能即将上线 (Chat B 开发中)" workaround="当前请查「报价单」tab 看历史价" actionText="去报价单" :actionRoute="resolveActionRoute('quotes')" />`

```bash
git commit -m "feat(sprint4-w1): PriceMemoryTab.vue (tab 19) integration or fallback placeholder"
```

---

## Phase E — RBAC Mask Polish (Day 11)

### Task E1: canViewPrice mask sweep audit

- [ ] **Step 1**: Grep all 6 mask-required tabs for canViewPrice usage

```bash
grep -rn "canViewPrice" web-admin/src/views/sales/customers/detail/tabs/ | wc -l
```

Expected: ≥6 (one per: Orders/Quotes/ItemStats/Invoices/Payments/Returns).

- [ ] **Step 2**: For each mask tab, manually verify in dev server:
  - Login as F006 admin (canViewPrice=true) → numbers visible
  - Login as receptionist (canViewPrice=false) → `****` displayed

- [ ] **Step 3**: Export button defense — receptionist sees disabled "导出" button

- [ ] **Step 4**: UI polish round
  - Tab labels consistent CN typography
  - Loading skeleton heights uniform
  - Empty state CTAs all wired and tested

- [ ] **Step 5**: Commit

```bash
git commit -m "feat(sprint4-w1): canViewPrice mask sweep + UI polish across 6 tabs"
```

---

## Phase F — Vitest Sub-Component Tests (Day 12)

### Task F1: Per-tab smoke specs (12 tab + detail + PlaceholderTab = 14 specs)

- [ ] **Step 1**: PlaceholderTab.spec.ts

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PlaceholderTab from '@/views/sales/customers/detail/tabs/PlaceholderTab.vue'

describe('PlaceholderTab', () => {
  it('renders tabName + status', () => {
    const w = mount(PlaceholderTab, { props: { tabName: '微信', status: '开发中' } })
    expect(w.text()).toContain('微信')
    expect(w.text()).toContain('开发中')
  })
  it('shows action button when actionText present', () => {
    const w = mount(PlaceholderTab, {
      props: { tabName: '微信', status: 'x', actionText: '去跟踪', actionRoute: '/x' }
    })
    expect(w.find('button').text()).toContain('去跟踪')
  })
})
```

- [ ] **Step 2**: detail.spec.ts — tab change → router.replace

```typescript
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
// ... setup router stub
// assert clicking tab key='orders' calls router.replace with query.tab='orders'
```

- [ ] **Step 3**: OrdersTab.spec.ts — canViewPrice mask switch (CRITICAL)

```typescript
it('shows price when canViewPrice=true', () => {
  // stub useCanViewPrice returns ref(true)
  // mount with data
  // expect price text visible
})
it('shows **** when canViewPrice=false', () => {
  // stub useCanViewPrice returns ref(false)
  // expect text '****'
  // expect price number NOT in DOM
})
```

- [ ] **Step 4**: ItemStatsTab.spec.ts — aggregation correctness

```typescript
it('groups items by SKU and sums quantity', () => {
  const orders = [
    { items: [{ skuId: 'A', quantity: 10, price: 100 }, { skuId: 'B', quantity: 5, price: 200 }] },
    { items: [{ skuId: 'A', quantity: 3, price: 100 }] },
  ]
  // mount with stubbed listOrders returning orders
  // assert SKU A row shows quantity=13, sales=1300
  // assert SKU B row shows quantity=5, sales=1000
})
```

Edge cases (empty / single / 500-cap warning).

- [ ] **Step 5**: SalesUserHistoryTab.spec.ts — dialog R1/R3

```typescript
it('disables submit when newSalesUserId === currentAssignedUserId', () => {
  // mount, open dialog, set newSalesUserId = currentAssignedUserId
  // expect submit button disabled
})
it('shows reason textarea only when "其他" selected', () => {
  // dropdown set to 'OTHER' → textarea visible
  // dropdown set to 'RESIGNATION' → textarea hidden
})
```

- [ ] **Step 6**: ProductsTab.spec.ts — dedup correctness (similar to ItemStatsTab pattern)

- [ ] **Step 7**: Remaining 6 tab smoke specs (TrackingTab / SamplesTab / QuotesTab / ShippingAddressTab / InvoicesTab / PaymentsTab / ReturnsTab / AttachmentsTab / PriceMemoryTab)
   - Each ≥1 spec: mount renders without throw + fetch called on mount + state machine transitions on success/error stubs

- [ ] **Step 8**: Run full suite

```bash
cd web-admin && npx vitest run --reporter=verbose 2>&1 | tail -20
```

Expected: ≥14 spec files, all GREEN. Coverage ≥60% for new files.

- [ ] **Step 9**: Commit

```bash
git add web-admin/src/views/sales/customers/detail/__tests__/
git commit -m "test(sprint4-w1): vitest specs for 12 real tab + detail + PlaceholderTab"
```

**MILESTONE COMMIT** after F1.

---

## Phase G — Playwright E2E (Day 13-14, depth-first per `e2e-web-admin` skill)

### Mandatory pre-flight (per `depth-first-e2e` SKILL.md HARD)

- [ ] Read `.claude/skills/depth-first-e2e/SKILL.md` 11 rules. Brief E2E worker to comply.

### Test data setup

Use F006 prod-like accounts (per `reference_f006_liutengmen_prod_accounts.md` 16 accounts):
- F006 admin (full perms incl canViewPrice)
- F006 receptionist (no canViewPrice)
- Test customer: 六腾门 CUST-F006-0001 with at least 1 order + 1 invoice

### Task G1: golden-path.spec.ts — 21 tab全切 (Day 13)

- [ ] **Step 1**: Author test in `scripts/e2e/sprint4-w1-customer-360/golden-path.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

const ADMIN_URL = 'https://admin.cretaceousfuture.com'  // or test env equivalent
const TAB_KEYS = ['tracking','wechat','call','sms','audio','email',
  'orders','samples','quotes','products','campaign','opportunity',
  'itemStats','shipAddr','invoices','payments','returns','aftersales',
  'priceMemory','salesUserHist','attachments']

test('21 tab 全切 — active class + render', async ({ page }) => {
  await loginAsF006Admin(page)
  await page.goto(`${ADMIN_URL}/sales/customers`)
  await page.click('text=六腾门')  // open detail
  await expect(page).toHaveURL(/\/sales\/customers\/[^/]+/)

  for (const key of TAB_KEYS) {
    await page.click(`[role="tab"][aria-controls*="${key}"], .el-tabs__item:has-text("${tabLabel(key)}")`)
    await expect(page).toHaveURL(new RegExp(`tab=${key}`))
    // Verify either real tab content OR placeholder rendered
    await expect(page.locator('.tab-' + key + ', .el-empty')).toBeVisible({ timeout: 5000 })
  }
})
```

- [ ] **Step 2**: Run

```bash
npx playwright test scripts/e2e/sprint4-w1-customer-360/golden-path.spec.ts --headed
```

Expected: PASS, 21 tab switches < 30s total.

- [ ] **Step 3**: Commit

```bash
git add scripts/e2e/sprint4-w1-customer-360/golden-path.spec.ts
git commit -m "test(e2e): sprint4-w1 golden path 21 tab switch"
```

### Task G2: lazy-load.spec.ts — network 截图 (Day 13)

- [ ] Monitor `page.on('request')` for chunk requests during navigation. After 5 tab switches, count distinct chunk requests = 5 (not 21). Test fails if all 21 chunks downloaded on mount.

```bash
git commit -m "test(e2e): lazy-load network defer verification"
```

### Task G3: url-state-restore.spec.ts (Day 13)

- [ ] Direct navigation to `?tab=invoices` lands on invoices tab. Refresh page, still on invoices.

```bash
git commit -m "test(e2e): url-state-restore via ?tab= query"
```

### Task G4: rbac-mask.spec.ts (Day 14)

- [ ] Login as receptionist. Navigate to 6 mask tabs. Assert price columns text `****`. Assert order numbers (non-price) visible.

```bash
git commit -m "test(e2e): rbac mask **** across 6 price tabs for receptionist"
```

### Task G5: tracking-crud.spec.ts (Day 14)

- [ ] Open tab 1, create record (verify dialog header has customer name), edit, delete. Verify list refreshes.

```bash
git commit -m "test(e2e): tracking-crud full flow with R2 dialog context check"
```

### Task G6: sales-user-change.spec.ts (Day 14)

- [ ] Open tab 20, click 变更业务员. Verify:
  - Dialog header contains customer name + code (R2)
  - "当前业务员:" shown (R1)
  - Reason dropdown has 6 options (R3)
  - Submit disabled until reason chosen
  - After submit, history list shows new entry
  - Second submit within 5min → 409 confirm dialog (R4)

```bash
git commit -m "test(e2e): sales-user-change R1+R2+R3+R4 verification"
```

### Task G7: Bug fix iteration (Day 14)

- [ ] Per `depth-first-e2e` skill: any E2E catching a real app bug → fix bug + add regression test + re-run all 6 specs.

```bash
git commit -m "fix(sprint4-w1): bug-N caught by E2E spec-M + regression test"
```

**MILESTONE COMMIT** after G7.

---

## Phase H — Deploy + PR (Day 15)

### Task H1: Final build + test gate

- [ ] **Step 1**: Frontend gate (HARD per `feedback_vitest_invariant_tests_not_run_by_vite_build.md`)

```bash
cd web-admin
npx vue-tsc --noEmit 2>&1 | tail -5         # 0 errors
npm run build 2>&1 | tail -5                # EXIT 0
npx vitest run 2>&1 | tail -10              # all GREEN
```

All 3 MUST be EXIT 0.

- [ ] **Step 2**: Backend gate

```bash
cd backend/java/cretas-api
mvn clean test 2>&1 | tail -10              # all GREEN
mvn -DskipTests package 2>&1 | tail -5      # BUILD SUCCESS
```

- [ ] **Step 3**: Concurrent-edit guard (per `concurrent-edit-safety.md` rule 5b)

```bash
git status --short                          # only this feature's files
```

If unexpected files in staging area → STOP and investigate per concurrent-edit rule.

### Task H2: Deploy backend (test → prod)

- [ ] **Step 1**: Test env

```bash
./scripts/deploy/deploy-backend.sh --env test
# Watch Flyway apply V20260516_01 on test PG
# Smoke: curl http://47.100.235.168:10011/api/mobile/F999/customer-tracking?customerId=...
```

Verify migration via:
```bash
ssh root@47.100.235.168 "psql -d cretas_db -c '\\dt customer_sales_user_history'"
```

- [ ] **Step 2**: Active E2E on test (per `feedback_active_e2e_replaces_passive_soak.md` HARD)

```bash
PLAYWRIGHT_BASE_URL=http://47.100.235.168:10011 npx playwright test scripts/e2e/sprint4-w1-customer-360/
```

Expected: all 6 specs PASS on test env.

- [ ] **Step 3**: Prod env (per `feedback_pick_deploy_script_by_pr_diff.md` HARD — pick correct script)

```bash
./scripts/deploy/deploy-backend.sh --env prod
ssh root@47.100.235.168 "psql -d cretas_prod_db -c '\\dt customer_sales_user_history'"
```

### Task H3: Deploy web-admin

- [ ] **Step 1**:

```bash
./scripts/deploy/deploy-web-admin.sh
```

Per HARD rule — NOT `deploy-backend.sh` for frontend.

- [ ] **Step 2**: Smoke 3 vhost (per `feedback_nginx_3_vhost_sync.md` HARD)

```bash
# (a) IP-direct
curl -s https://139.196.165.140:8086/health
# (b) admin DNS (real customers)
curl -s https://admin.cretaceousfuture.com/api/mobile/health
# (c) API DNS
curl -s https://api.cretaceousfuture.com/api/mobile/F006/customer-tracking?customerId=...
```

All 3 MUST return success.

### Task H4: Sync 3 nginx vhosts for new API paths

- [ ] **Step 1**: Per `feedback_nginx_3_vhost_sync.md` HARD — `/customer-tracking` + `/customer-sales-user-history` are NEW paths. Sync via runbook:

```bash
cat docs/superpowers/runbooks/nginx-vhost-sync-checklist.md
```

Update all 3 vhost confs to add upstream rewrites for new paths.

- [ ] **Step 2**: Validate + reload nginx on 139:

```bash
ssh root@139.196.165.140 "nginx -t && systemctl reload nginx"
```

- [ ] **Step 3**: Smoke from external (real customer URL):

```bash
curl -s "https://admin.cretaceousfuture.com/api/mobile/F006/customer-sales-user-history?customerId=..." \
  -H "Authorization: Bearer <test-jwt>"
```

Expected: 200 + valid response shape.

### Task H5: Open PR + summary

- [ ] **Step 1**: Push branch

```bash
git push -u origin feat/sprint4-w1-customer-tab-360
```

- [ ] **Step 2**: Verify pushed SHA (HARD per `feedback_chat_must_push_before_clear.md`)

```bash
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git ls-remote origin feat/sprint4-w1-customer-tab-360 | awk '{print $1}')
echo "local=$LOCAL remote=$REMOTE"
[ "$LOCAL" = "$REMOTE" ] && echo "OK pushed" || echo "PUSH MISMATCH"
```

- [ ] **Step 3**: Open PR

```bash
gh pr create --title "feat(sprint4-w1): S-CUSTOMER-TAB-1 客户档案 360° 21 tab + 防呆 R1-R5" \
  --body "$(cat <<'EOF'
## Summary

Sprint 4 Wave 1 Chat F — S-CUSTOMER-TAB-1 客户档案 360° detail view with 21 tabs.

**Scope**:
- 12 真做 tab: tracking / orders / samples / quotes / products / itemStats / shipAddr / invoices / payments / returns / salesUserHist / attachments
- 1 integration tab: priceMemory (Chat B fallback to placeholder pre-ship)
- 8 defer placeholder: wechat / call / sms / audio / email / campaign / opportunity / aftersales — all with R5 next-action button
- Backend: new CustomerSalesUserHistory entity + Customer.assignedSalesUserId + CustomerTrackingRecordController + 6 controller `?customerId=` extensions
- Lazy load: defineAsyncComponent + KeepAlive (切回 tab 不重 fetch)
- Routing: flat /sales/customers/:id?tab=N
- canViewPrice mask: 6 tab 价格列 `****` for receptionist

**防呆 R1/R2/R3/R4/R5 + 4 位一体 检查清单**:
- ✅ R1: tab 20 dialog 边界预显 (current assignedUser + disable same-user submit)
- ✅ R2: CustomerHeader sticky + all dialog headers 含 客户名 ({{customerCode}})
- ✅ R3: tab 20 reason dropdown 6 options + tab 1 trackingType 6 options
- ✅ R4: 后端 5min dedup → 409 + existingId + actionHint; 前端 catch 409 跳已有
- ✅ R5: 8 defer + tab 19 全部带 next action button (no dead-end)
- ✅ 4 位一体 error toast: ElMessage duration:0 + showClose + 后端 message 原文 + actionHint

## Test plan

- [x] `mvn test` GREEN (CustomerServiceImpl + 2 controllers)
- [x] `npx vue-tsc` 0 errors
- [x] `npm run build` EXIT 0
- [x] `npx vitest run` all GREEN (≥14 specs)
- [x] Playwright E2E 6 scenarios PASS on test env (golden / lazy / url-restore / rbac-mask / tracking-crud / sales-user-change)
- [x] Active E2E on prod equivalent after cutover
- [x] 3 nginx vhost smoke (IP / admin DNS / api DNS)
- [x] Flyway V20260516_01 applied on test + prod, schema verified

## Risks + mitigations

- Chat B not yet shipped → tab 19 uses internal PlaceholderTab fallback, ~5 LOC swap when Chat B lands
- Frontend aggregation tab 10/13 capped at 500 orders + warning banner
- 3 nginx vhost sync via runbook docs/superpowers/runbooks/nginx-vhost-sync-checklist.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4**: Return PR URL to organizer chat with summary

### Task H6: Active E2E on prod after merge

- [ ] **Step 1**: After admin merge:

```bash
git checkout main && git pull
./scripts/deploy/deploy-backend.sh --env prod   # re-deploy if needed for merge
./scripts/deploy/deploy-web-admin.sh
```

- [ ] **Step 2**: Active E2E on prod (per `feedback_active_e2e_replaces_passive_soak.md`)

```bash
PLAYWRIGHT_BASE_URL=https://admin.cretaceousfuture.com npx playwright test scripts/e2e/sprint4-w1-customer-360/
```

Expected: all 6 PASS, 0 console errors, lazy-load actually defers chunks.

- [ ] **Step 3**: Report back to organizer

---

## Spec Coverage Cross-Check (final)

| Spec section | Tasks |
|---|---|
| §1 Decision Log | A1-A4 (decisions 1, 6), B1-B2 (decision 2), D1-D8 (decision 3, 5), E1 (decision 4) |
| §2 Architecture | All phases |
| §3 Tab 矩阵 (21 tabs) | B2 wires all 21, D1-D8 implements 12 真做 + 1 integration, D2/D5/D7 covers 8 defer next-action |
| §4 Frontend impl | B1-B2, D1-D8 |
| §5 Backend impl | A1-A6, C1-C3 |
| §6 数据流 | B2 onMounted + KeepAlive in detail.vue; D1-D8 per-sub fetch |
| §7 错误 + RBAC + Mask | E1 sweep, all D tasks per template handleError |
| §8 测试 | F1 vitest, G1-G7 E2E, C3 backend |
| §9 验收清单 | H1 gate + H2-H4 deploy/nginx + H6 active E2E |
| §10 部署 | H2-H4 |
| §11 工期 | Day labels in each task |
| §12 Risk | D8 Chat B integration fallback, D6 500-order cap, H4 nginx 3-vhost |
| §12.5 防呆 R1-R5 + 4位一体 | A4 R4 dedup, B2 R5 placeholder, D1 R2/R3, D7 R1/R2/R3/R4, all D handleError 4位一体 |
| §13 rule reference | Embedded throughout (HARD rules called out in deploy gates) |

**Spec → Plan: 0 gaps.** Self-review pass.

---

## Execution Choice

**Plan saved to** `docs/superpowers/plans/2026-05-17-sprint4-w1-customer-tab-360-impl.md` (this file)
**Worktree** `C:\Users\Steve\cretas-sprint4-w1-customer-tab-360`
**Branch** `feat/sprint4-w1-customer-tab-360`

Two execution options:

**1. Subagent-Driven (recommended for 17d scope)** — dispatch fresh subagent per task family (Phase A backend / Phase B skeleton / Phase D real tabs / Phase F vitest / Phase G E2E / Phase H deploy). Two-stage review between tasks. Best parallelism: A + B + parts of D can run concurrently across 3-5 subagents.

**2. Inline Execution** — execute tasks sequentially in this session using `superpowers:executing-plans`. Batch with checkpoints. Slower but tighter context retention.

**Which approach?** (Steve to choose)






### New files (frontend)

```
web-admin/src/views/sales/customers/
├── detail.vue                                    [NEW ~450 lines]
└── detail/
    ├── CustomerHeader.vue                        [NEW ~120 lines]
    └── tabs/
        ├── PlaceholderTab.vue                    [NEW ~50 lines, reused 8x]
        ├── TrackingTab.vue                       [NEW ~250 lines]
        ├── OrdersTab.vue                         [NEW ~200 lines]
        ├── SamplesTab.vue                        [NEW ~180 lines]
        ├── QuotesTab.vue                         [NEW ~200 lines]
        ├── ProductsTab.vue                       [NEW ~150 lines]
        ├── ItemStatsTab.vue                      [NEW ~180 lines]
        ├── ShippingAddressTab.vue                [NEW ~100 lines]
        ├── InvoicesTab.vue                       [NEW ~200 lines]
        ├── PaymentsTab.vue                       [NEW ~180 lines]
        ├── ReturnsTab.vue                        [NEW ~180 lines]
        ├── PriceMemoryTab.vue                    [NEW ~120 lines, fallback PlaceholderTab pre-Chat-B]
        ├── SalesUserHistoryTab.vue               [NEW ~280 lines, w/ change dialog]
        └── AttachmentsTab.vue                    [NEW ~180 lines]

web-admin/src/api/sales/
├── customer.ts                                   [MODIFY: add getCustomer, updateAssignedSalesUser]
├── customerTracking.ts                           [NEW]
└── salesUserHistory.ts                           [NEW]

web-admin/src/composables/
└── useCanViewPrice.ts                            [NEW or extend existing]

web-admin/src/router/index.ts                    [MODIFY: line ~370 add detail route]
```

### New files (backend)

```
backend/java/cretas-api/src/main/
├── java/com/cretas/aims/
│   ├── entity/
│   │   ├── Customer.java                         [MODIFY: add assignedSalesUserId + assignedAt]
│   │   └── CustomerSalesUserHistory.java         [NEW]
│   ├── repository/
│   │   └── CustomerSalesUserHistoryRepository.java [NEW]
│   ├── service/
│   │   └── impl/
│   │       └── CustomerServiceImpl.java          [MODIFY: add updateAssignedSalesUser]
│   ├── controller/
│   │   ├── CustomerTrackingRecordController.java [NEW]
│   │   ├── CustomerSalesUserHistoryController.java [NEW]
│   │   ├── inventory/SalesController.java        [MODIFY: ?customerId param]
│   │   ├── rd/RdController.java                  [MODIFY: ?customerId on /samples]
│   │   ├── finance/InvoiceController.java        [MODIFY: ?customerId]
│   │   ├── finance/PaymentRecordController.java  [MODIFY: ?customerId]
│   │   ├── inventory/ReturnOrderController.java  [MODIFY: ?customerId]
│   │   ├── ShipmentController.java               [MODIFY: ?customerId]
│   │   └── AttachmentController.java             [MODIFY: ?entityType=CUSTOMER&entityId=]
│   └── repository/
│       └── (each: add findByFactoryIdAndCustomerId method)
└── resources/db/migration/
    └── V20260516_01__customer_sales_user_history.sql [NEW]
```

### Test files

```
backend/java/cretas-api/src/test/java/com/cretas/aims/
├── service/CustomerServiceImplTest.java                   [NEW]
└── controller/
    ├── CustomerTrackingRecordControllerTest.java          [NEW]
    └── CustomerSalesUserHistoryControllerTest.java        [NEW]

web-admin/src/views/sales/customers/detail/__tests__/
├── detail.spec.ts                                         [NEW]
├── tabs/
│   ├── PlaceholderTab.spec.ts                             [NEW]
│   ├── TrackingTab.spec.ts                                [NEW]
│   ├── OrdersTab.spec.ts                                  [NEW: mask切换]
│   ├── ItemStatsTab.spec.ts                               [NEW: aggregation]
│   ├── ProductsTab.spec.ts                                [NEW: aggregation]
│   ├── SalesUserHistoryTab.spec.ts                        [NEW: dialog]
│   └── (other 6 真做 tab each 1 spec — minimal smoke)

scripts/e2e/sprint4-w1-customer-360/
├── golden-path.spec.ts                                    [NEW]
├── lazy-load.spec.ts                                      [NEW]
├── url-state-restore.spec.ts                              [NEW]
├── rbac-mask.spec.ts                                      [NEW]
├── tracking-crud.spec.ts                                  [NEW]
└── sales-user-change.spec.ts                              [NEW]
```

---

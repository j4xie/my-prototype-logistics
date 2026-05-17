# Sprint 4 W1 — S-CUSTOMER-TAB-1 客户档案 360° 21 tab 设计

**Date**: 2026-05-16
**Owner**: Chat F (Steve dispatch)
**Sprint**: 4 Wave 1
**Branch**: `feat/sprint4-w1-customer-tab-360` (to be created from `main`)
**Estimated**: ~17d (15d frontend + 4d backend in parallel)

---

## §0 Pre-flight grep verifications (organizer 已跑, 2026-05-16)

| 假设 | 结果 | Evidence |
|---|---|---|
| `CustomerTrackingRecord` entity + Repo | ✅ | `entity/CustomerTrackingRecord.java` + `repository/CustomerTrackingRecordRepository.java` |
| `CustomerTrackingRecordController` | ❌ **缺** | 0 hit in `controller/` — Sprint 4 必造 |
| `ProductSample` entity + Repo | ✅ | `entity/rd/ProductSample.java` |
| `ProductSample` controller | ✅ | `controller/rd/RdController.java` (handles ProductSample) |
| `OperationalQuote` entity + controller | ✅ | `entity/sales/OperationalQuote.java` + `controller/sales/OperationalQuoteController.java` (line 154 已支持 `customerId` query) |
| `ShipmentRecord` entity + controller | ✅ | `entity/ShipmentRecord.java` + `controller/ShipmentController.java` |
| `InvoiceRecord` (Sprint 3 E) | ✅ | `entity/finance/InvoiceRecord.java` + `controller/finance/InvoiceController.java` |
| `PaymentRecord` | ✅ | `entity/finance/PaymentRecord.java` + `controller/finance/PaymentRecordController.java` |
| `ReturnOrder` | ✅ | `entity/inventory/ReturnOrder.java` + `controller/inventory/ReturnOrderController.java` |
| `SalesReturn` entity | ❌ **不存在** | 仅 `ReturnOrder` ship → tab 17 文案为 "退货 (ReturnOrder)" |
| `Customer` entity 字段 | ✅ | `entity/Customer.java` (133 行), `shippingAddress` at line 77-78, **无** `salesUserId`/`assignedTo` |
| `Customer.assignedSalesUserId` 字段 | ❌ **缺** | 本 spec 新加 (tab 20 需) |
| `CustomerSalesUserHistory` entity | ❌ **缺** | 本 spec 新建 |
| `CustomerPriceMemory` (Chat B) | ❌ 未 ship | 等 Chat B S-PRICE-1 ship 后接 (tab 19) |
| `SalesController` (in inventory/) | ✅ | `controller/inventory/SalesController.java` (与 Sprint 2 convention 一致, **不**在 `sales/`) |
| `Attachment` entity + controller | ✅ | `entity/Attachment.java` + `controller/AttachmentController.java` + `service/attachment/` (注意命名: `Attachment` 非 `FileAttachment`) |
| 现有 detail.vue convention | ✅ | `views/sales/orders/detail.vue` 1652 行, line 1033 `<el-tabs v-model="activeTab" class="business-tabs">` |
| `views/sales/customers/` 仅 `list.vue` | ✅ | 445 行, May 11 ship. `detail.vue` 不存在 → 本 spec **新建** |
| `router/index.ts:370` 仅注册 customer list | ✅ | 加 `customers/:id` route entry |
| `update_updated_at()` PG trigger function | ✅ | per `database-entity-sync.md` 已 ship, 直接复用 |

**关键 corrections vs 原 brief**:
1. 原 brief "现 list / detail" 错 — detail.vue 不存在, 必新建
2. 原 brief tab 17 "SalesReturn / ReturnOrder" → 只 ReturnOrder
3. 原 brief "FileAttachment" 实际名 `Attachment`

---

## §1 Decision Log

| # | Decision | Choice | 影响 |
|---|---|---|---|
| 1 | Tab 20 业务员变更 source | 新 `CustomerSalesUserHistory` entity + `Customer.assignedSalesUserId` 字段 + migration + controller | +1-2d backend |
| 2 | 路由设计 | Flat `/sales/customers/:id?tab=N` (与 `orders/detail.vue` 同 convention) | URL 可书签, browser back 回 list |
| 3 | Lazy load 实现 | `defineAsyncComponent` + `<KeepAlive>` (切回 tab 不重 fetch, onActivated 可选手工刷新) | 首屏小, 切换流畅 |
| 4 | canViewPrice mask 行为 | 价格列显示 `****` (与现有 35-view 防御 convention 一致) | 6 tab 实现 mask |
| 5 | Defer placeholder tab | 全 7 个保留 (#2-6 通讯/#11 活动/#12 商机/#18 售后), 空状态 + "功能开发中" CTA | 21 tab 全展示, 360° demo |
| 6 | Backend scope approach | A — 完整并行扩展 (~19d → 实际 ~17d 并行) | F006 demo 真数据, 不 mock |

---

## §2 Architecture

```
┌── Frontend: web-admin/src/views/sales/customers/ ──┐
│                                                       │
│  list.vue (existing, 445 行)                           │
│    └─ row 点击 → router.push(/sales/customers/:id)     │
│                                                       │
│  detail.vue (新建, ~400-500 行)                         │
│    ├─ <CustomerHeader> 客户基本信息卡片                  │
│    ├─ <el-tabs v-model="activeTab"> 21 tab labels      │
│    └─ <KeepAlive> + <component :is="currentTabComp" /> │
│         │                                              │
│         └─ tabs/ (新建 14 .vue 文件)                     │
│            ├─ PlaceholderTab.vue (通用 template, 8 defer tab 共用) │
│            ├─ 12 真做 tab.vue (lazy via defineAsyncComponent) │
│            │   含 SalesUserHistoryTab (tab 20, 含变更 dialog) │
│            └─ PriceMemoryTab.vue (tab 19 integration, Chat B 未 ship 时内部 fallback) │
│                                                       │
│  router/index.ts: 加 1 route entry                     │
└────────────────────────────────────────────────────────┘
            │
            │ HTTP /api/mobile/{factoryId}/...
            ▼
┌── Backend gap fill (~4d) ──┐
│                                │
│  新增:                          │
│   • Customer.assignedSalesUserId 字段
│   • CustomerSalesUserHistory entity + Repo + Service
│   • Flyway V20260516_01 migration
│   • CustomerServiceImpl.updateAssignedSalesUser(...)
│   • CustomerTrackingRecordController CRUD
│   • CustomerSalesUserHistoryController
│                                │
│  扩展现有 (加 ?customerId= query):
│   • SalesController (inventory/)
│   • RdController /samples
│   • InvoiceController
│   • PaymentRecordController
│   • ReturnOrderController
│   • ShipmentController
│   • AttachmentController (?entityType=CUSTOMER&entityId=)
│                                │
│  不动: OperationalQuoteController (已支持 customerId)
└─────────────────────────────────┘
```

**关键 design 原则**:
- **Single-page Vue** detail.vue + 子组件 — 与 `views/sales/orders/detail.vue` 同 convention
- **数据所有权**: Customer 基本信息 fetch 在 detail.vue, tab 数据归 sub-component 自管
- **Tab state**: URL query `?tab=N` = source of truth, refresh / 书签 / 分享 一致
- **KeepAlive 缓存**: 切回 tab 不重 fetch; 显式刷新走 refresh button

---

## §3 Tab 矩阵 (21 tab)

| # | Tab key | Label | 真做/Placeholder | Backend source | Mask |
|---|---|---|---|---|---|
| 1 | `tracking` | 跟踪记录 | ✅ 真做 | `CustomerTrackingRecord` (entity ship, controller 新建) | — |
| 2 | `wechat` | 微信记录 | ⏸ defer | — | — |
| 3 | `call` | 通话记录 | ⏸ defer | — | — |
| 4 | `sms` | 短信记录 | ⏸ defer | — | — |
| 5 | `audio` | 谈话录音 | ⏸ defer | — | — |
| 6 | `email` | 邮件列表 | ⏸ defer | — | — |
| 7 | `orders` | 销售单 | ✅ 真做 | `SalesController` (inventory/) + `?customerId=` | ✅ |
| 8 | `samples` | 样品单 | ✅ 真做 | `RdController` + `?customerId=` | — |
| 9 | `quotes` | 报价单 | ✅ 真做 | `OperationalQuoteController` (已支持) | ✅ |
| 10 | `products` | 产品 | ✅ 真做 | 前端 aggregate OrdersTab 数据 (SKU 分组去重) | — |
| 11 | `campaign` | 活动管理 | ⏸ defer | — | — |
| 12 | `opportunity` | 商机管理 | ⏸ defer | — | — |
| 13 | `itemStats` | 商品统计 | ✅ 真做 | 前端 aggregate OrdersTab.items (按 SKU 分组 + 销售额排序) | ✅ |
| 14 | `shipAddr` | 收件地址 | ✅ 真做 | `Customer.shippingAddress` (current + 单值, history 暂用 single field) | — |
| 15 | `invoices` | 开票 | ✅ 真做 | `InvoiceController` + `?customerId=` | ✅ |
| 16 | `payments` | 收款 | ✅ 真做 | `PaymentRecordController` + `?customerId=` | ✅ |
| 17 | `returns` | 退货 | ✅ 真做 | `ReturnOrderController` + `?customerId=` | ✅ |
| 18 | `aftersales` | 售后 | ⏸ defer | — | — |
| 19 | `priceMemory` | 价格记忆 | ⏳ Chat B 未 ship 前 placeholder, ship 后接 API | `CustomerPriceMemory` (Chat B S-PRICE-1) | ✅ |
| 20 | `salesUserHist` | 业务员变更 | ✅ 真做 | `CustomerSalesUserHistory` (新建) | — |
| 21 | `attachments` | 文件附件 | ✅ 真做 | `AttachmentController` (?entityType=CUSTOMER) | — |

合计: **12 真做 + 1 integration (tab 19 等 Chat B) + 8 defer placeholder = 21**. 6 mask tab (7/9/13/15/16/17 + tab 19 一旦 ship).

---

## §4 Frontend 实现

### 4.1 文件清单 (新建)

```
web-admin/src/views/sales/customers/
├── list.vue                        # existing 445 行, 加 row 跳 detail
├── detail.vue                      # 新建 ~400-500 行
└── detail/
    ├── CustomerHeader.vue          # 客户基本卡片 (姓名/联系/评级/余额/当前业务员)
    └── tabs/
        ├── PlaceholderTab.vue      # 通用 defer placeholder (复用 7 次)
        ├── TrackingTab.vue         # tab 1 (CRUD)
        ├── OrdersTab.vue           # tab 7
        ├── SamplesTab.vue          # tab 8
        ├── QuotesTab.vue           # tab 9
        ├── ProductsTab.vue         # tab 10 (前端 aggregate)
        ├── ItemStatsTab.vue        # tab 13 (前端 aggregate + 排序)
        ├── ShippingAddressTab.vue  # tab 14
        ├── InvoicesTab.vue         # tab 15
        ├── PaymentsTab.vue         # tab 16
        ├── ReturnsTab.vue          # tab 17
        ├── PriceMemoryTab.vue      # tab 19 (Chat B 未 ship → 内部 fallback PlaceholderTab)
        ├── SalesUserHistoryTab.vue # tab 20 (含变更 dialog)
        └── AttachmentsTab.vue      # tab 21
```

### 4.2 API client (新建/扩展)

```
web-admin/src/api/sales/
├── customer.ts                  # 扩展: updateAssignedSalesUser(id, userId, reason)
├── customerTracking.ts          # 新建: list / create / update / delete
└── salesUserHistory.ts          # 新建: list
```

### 4.3 detail.vue 核心结构

```vue
<template>
  <div class="customer-detail">
    <CustomerHeader :customer="customer" :loading="customerLoading" />
    <el-tabs v-model="activeTab" class="business-tabs" @tab-change="onTabChange">
      <el-tab-pane v-for="t in TAB_DEFS" :key="t.key" :name="t.key" :label="t.label">
        <KeepAlive>
          <component :is="t.component" v-if="t.component"
                     :customer-id="customerId" :customer="customer" />
          <PlaceholderTab v-else :tab-name="t.label" :reason="t.deferReason" />
        </KeepAlive>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getCustomer } from '@/api/sales/customer'
import CustomerHeader from './detail/CustomerHeader.vue'
import PlaceholderTab from './detail/tabs/PlaceholderTab.vue'
import type { Customer } from '@/types/customer'

const route = useRoute()
const router = useRouter()
const customerId = computed(() => route.params.id as string)
const activeTab = ref<string>((route.query.tab as string) || 'tracking')

const customer = ref<Customer | null>(null)
const customerLoading = ref(false)

// 完整 21 tab 见 §3 Tab 矩阵; 此处仅前 2 行示意结构
const TAB_DEFS = [
  { key: 'tracking', label: '跟踪记录', component: defineAsyncComponent(() => import('./detail/tabs/TrackingTab.vue')) },
  { key: 'wechat',   label: '微信记录', component: null, deferReason: 'Sprint 5+' },
  // ... 余 19 tab 按 §3 矩阵填充, 真做 tab component 用 defineAsyncComponent, defer 用 component: null
]

function onTabChange(key: string) {
  router.replace({ query: { ...route.query, tab: key } })
}

onMounted(async () => {
  customerLoading.value = true
  try {
    customer.value = await getCustomer(customerId.value)
  } catch (e) {
    // 404 → back to list, 403 → /403, 5xx → page-level error
    handleCustomerLoadError(e)
  } finally {
    customerLoading.value = false
  }
})
</script>
```

### 4.4 Router 配置

```typescript
// web-admin/src/router/index.ts (加在 line 370 'customers' entry 之后)
{
  path: 'customers/:id',
  name: 'SalesCustomerDetail',
  component: () => import('@/views/sales/customers/detail.vue'),
  meta: {
    requiresAuth: true,
    title: '客户详情',
    module: 'sales',
    activeMenu: '/sales/customers'  // 左侧菜单仍高亮"客户管理"
  }
}
```

### 4.5 Sub-component state pattern (统一)

每 sub-component 自管:
```typescript
const state = ref<'loading' | 'ready' | 'empty' | 'error'>('loading')
const errorMsg = ref('')
const data = ref<T[]>([])

async function fetch() { /* try/catch → 显式 setState */ }
onMounted(fetch)
```

Template 用 `v-if/v-else` 分支 render `<el-skeleton>` / `<el-empty>` / `<ErrorPanel>` / 业务列表.

---

## §5 Backend 实现

### 5.1 Customer 字段扩展 (entity/Customer.java)

```java
@Column(name = "assigned_sales_user_id")
private Long assignedSalesUserId;

@Column(name = "assigned_sales_user_assigned_at")
private LocalDateTime assignedSalesUserAssignedAt;
```

### 5.2 CustomerSalesUserHistory entity (新建)

```java
package com.cretas.aims.entity;

@Entity
@Table(name = "customer_sales_user_history",
       indexes = @Index(name = "idx_csuh_customer_changed",
                        columnList = "customer_id,changed_at"))
@Data
@EqualsAndHashCode(callSuper = true)
public class CustomerSalesUserHistory extends BaseEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "factory_id", nullable = false)
    private String factoryId;

    @Column(name = "customer_id", nullable = false)
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

### 5.3 Flyway migration

**File**: `backend/java/cretas-api/src/main/resources/db/migration/V20260516_01__customer_sales_user_history.sql`

```sql
ALTER TABLE customers
  ADD COLUMN assigned_sales_user_id BIGINT NULL,
  ADD COLUMN assigned_sales_user_assigned_at TIMESTAMP NULL;

CREATE TABLE customer_sales_user_history (
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

CREATE INDEX idx_csuh_customer_changed
  ON customer_sales_user_history(customer_id, changed_at DESC);

CREATE TRIGGER trigger_csuh_updated_at
BEFORE UPDATE ON customer_sales_user_history
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 5.4 CustomerServiceImpl.updateAssignedSalesUser

```java
@Transactional
public Customer updateAssignedSalesUser(
        String customerId, Long newUserId, Long changedBy, String reason) {
    Customer customer = customerRepository.findById(customerId)
        .orElseThrow(() -> new ResourceNotFoundException("Customer not found"));

    Long previous = customer.getAssignedSalesUserId();
    LocalDateTime now = LocalDateTime.now();

    customer.setAssignedSalesUserId(newUserId);
    customer.setAssignedSalesUserAssignedAt(now);
    customerRepository.save(customer);

    CustomerSalesUserHistory history = new CustomerSalesUserHistory();
    history.setFactoryId(customer.getFactoryId());
    history.setCustomerId(customerId);
    history.setPreviousSalesUserId(previous);
    history.setNewSalesUserId(newUserId);
    history.setChangedBy(changedBy);
    history.setChangedAt(now);
    history.setReason(reason);
    salesUserHistoryRepository.save(history);

    return customer;
}
```

**注意**: 显式 service 方法非 `@PreUpdate` JPA listener — listener 拿不到 `changedBy` (request context) 和 `reason` (UI 传入).

### 5.5 新建 controllers

```
controller/
├── CustomerTrackingRecordController.java       (新建)
│   GET    /api/mobile/{factoryId}/customer-tracking?customerId=&page=&size=
│   POST   /api/mobile/{factoryId}/customer-tracking
│   PUT    /api/mobile/{factoryId}/customer-tracking/{id}
│   DELETE /api/mobile/{factoryId}/customer-tracking/{id}
│
└── CustomerSalesUserHistoryController.java     (新建)
    GET  /api/mobile/{factoryId}/customer-sales-user-history?customerId=&page=&size=
    POST /api/mobile/{factoryId}/customers/{id}/assigned-sales-user
         body: { newSalesUserId, reason }
```

### 5.6 扩展现有 controller (加 `?customerId=`)

| Controller | 改动 |
|---|---|
| `SalesController` (inventory/) | list 加 `@RequestParam(required=false) String customerId` |
| `RdController` /samples | 同 |
| `InvoiceController` | 同 |
| `PaymentRecordController` | 同 |
| `ReturnOrderController` | 同 |
| `ShipmentController` | 同 |
| `AttachmentController` | grep 验证 `?entityType=CUSTOMER&entityId=` 是否已支持, 缺则加 |

Repository 加 `findByFactoryIdAndCustomerId` 方法.

**PostgreSQL null-safe pattern** (per `database-entity-sync.md`):

```java
@Query("SELECT s FROM SalesOrder s WHERE s.factoryId = :factoryId " +
       "AND (CAST(:customerId AS string) IS NULL OR s.customerId = :customerId)")
Page<SalesOrder> findByFilters(@Param("factoryId") String factoryId,
                               @Param("customerId") String customerId,
                               Pageable pageable);
```

`CAST(:customerId AS string)` 给 PG 类型 hint, 避免 `could not determine data type of parameter` 错误.

---

## §6 数据流

### 6.1 进入 detail

```
list.vue → router.push(/sales/customers/abc-123?tab=tracking)
  ↓
detail.vue mount
  ├─ customerId = route.params.id
  ├─ activeTab = route.query.tab || 'tracking'
  ├─ getCustomer(customerId) ↗ customer header
  └─ <el-tabs> 触发当前 tab pane render
       ↓
  KeepAlive 内 <component :is> 首次 mount
       ↓
  defineAsyncComponent 下载 chunk → sub-component onMounted → fetch
```

**只 fetch 当前 tab** — el-tabs 默认不预渲染非激活 pane.

### 6.2 切换 tab

```
用户点 "销售单"
  ├─ activeTab='orders'
  ├─ onTabChange → router.replace({ query: { tab: 'orders' } })
  └─ <KeepAlive> swap component
       ├─ 首次: defineAsyncComponent 下载 + onMounted fetch
       └─ 已 cache: instant swap-in, onActivated (默认不 refetch)
```

### 6.3 切回已访问 tab

- KeepAlive 保留 DOM + 组件实例
- 默认不重 fetch (用户体验顺)
- sub-component 可选 `onActivated(() => { if (Date.now() - lastFetch > 60_000) fetch() })`
- 显式刷新走右上角 `<el-button icon=Refresh>`

### 6.4 URL 状态恢复

```
书签 /sales/customers/abc-123?tab=invoices
  → activeTab='invoices' 初始化
  → InvoicesTab.vue 直接 mount + fetch (其他 10 tab 不 mount)
```

### 6.5 tab 20 业务员变更触发

```
管理员点 "变更业务员"
  ├─ Dialog: 选新业务员 + 填原因
  ├─ POST /customers/{id}/assigned-sales-user { newSalesUserId, reason }
  ▼
后端 CustomerServiceImpl.updateAssignedSalesUser:
  ├─ 读 previous
  ├─ UPDATE customers SET assigned_sales_user_id, assigned_at
  ├─ INSERT customer_sales_user_history
  ▼
前端:
  ├─ ElMessage.success
  ├─ refetch history list
  └─ 通知 CustomerHeader 刷新
```

---

## §7 错误处理 + RBAC + Mask

### 7.1 Per-tab 错误边界

每 sub-component 自管 `state` 状态机 (`loading | ready | empty | error`):

```typescript
catch (e) {
  if (isAxiosError(e)) {
    const status = e.response?.status
    if (status === 403) { state.value = 'error'; errorMsg.value = '无权限' }
    else if (status === 401) handleAuthExpired()
    else { state.value = 'error'; errorMsg.value = e.response?.data?.message || '加载失败' }
  } else {
    state.value = 'error'; errorMsg.value = '网络异常'
  }
  console.error(`[CustomerDetail/${tabKey}] fetch failed:`, e)
}
```

**禁止** (per `api-response-handling.md` + silent-failure-hunter):
- ❌ `catch (e: any) { return [] }` 静默返空伪装"暂无数据"
- ❌ 返假数据 / mock fallback
- ❌ console.error 后吞错

### 7.2 canViewPrice mask

**Source**: `useCanViewPrice()` composable 从 user store / JWT payload 读 `CAN_VIEW_PRICE` permission.

**Mask 覆盖列**:

| Tab | Mask 字段 |
|---|---|
| 销售单 (7) | `unitPrice` / `subtotal` / `totalAmount` / `discount` |
| 报价单 (9) | `quotedPrice` / `originalPrice` / `quoteTotalAmount` |
| 商品统计 (13) | `salesAmount` / `avgPrice` |
| 开票 (15) | `invoiceAmount` / `taxAmount` |
| 收款 (16) | `paymentAmount` |
| 退货 (17) | `refundAmount` / `unitRefundPrice` |
| 价格记忆 (19) | `memoryPrice` / `lastQuotedPrice` (Chat B ship 后) |

Template:
```vue
<span v-if="canViewPrice">{{ formatMoney(row.unitPrice) }}</span>
<span v-else class="masked">****</span>
```

**导出按钮**: 受限角色禁用 "导出 Excel" 按钮 (后端 RBAC 是 source of truth, 前端 mask 是 UI sugar).

### 7.3 defer placeholder

```vue
<el-empty :image-size="120">
  <template #description>
    <p>「{{ tabName }}」功能开发中</p>
    <p class="hint">预计 {{ reason }} 发布</p>
  </template>
  <el-button type="primary" plain disabled>敬请期待</el-button>
</el-empty>
```

不发 API, 不触发错误.

---

## §8 测试

### 8.1 Vitest (per `feedback_vitest_invariant_tests_not_run_by_vite_build.md` HARD — `vite build` 不跑, 必须独立 `npx vitest run`)

```
web-admin/src/views/sales/customers/detail/__tests__/
├── PlaceholderTab.spec.ts
├── tabs/
│   ├── TrackingTab.spec.ts          # state machine
│   ├── OrdersTab.spec.ts            # canViewPrice mask 切换
│   ├── ItemStatsTab.spec.ts         # SKU aggregation reduce 正确性
│   ├── SalesUserHistoryTab.spec.ts  # 列表 + 变更 dialog 提交
│   └── ProductsTab.spec.ts          # 去重 + 数量累加
└── detail.spec.ts                   # tab 切换 → router.replace 触发
```

覆盖目标:
- 12 真做 tab 每个 ≥1 spec
- mask 切换 6 项
- aggregation 边界 (空 / 单条 / 多条) 6 项

### 8.2 Playwright E2E (depth-first per `e2e-web-admin` skill, F006 真账号)

```
scripts/e2e/sprint4-w1-customer-360/
├── golden-path.spec.ts        # 21 tab 全切 + 验证 active class
├── lazy-load.spec.ts          # network: 切 5 tab 仅 5 chunk 请求
├── url-state-restore.spec.ts  # 书签 ?tab=invoices 直接进入
├── rbac-mask.spec.ts          # 受限角色 6 tab 价格 = "****"
├── tracking-crud.spec.ts      # CRUD 全流程 (tab 1)
└── sales-user-change.spec.ts  # 变更后 history 新条目 (tab 20)
```

### 8.3 后端单测

```
backend/java/cretas-api/src/test/java/com/cretas/aims/service/
├── CustomerServiceImplTest.java      # updateAssignedSalesUser + history 插入
├── CustomerTrackingRecordControllerTest.java
└── CustomerSalesUserHistoryControllerTest.java
```

**PG parity** (per `database-entity-sync.md` — H2 mock 漏 `:param IS NULL` issue): Testcontainers PG 或本地 PG.

---

## §9 验收清单

- [ ] detail.vue 21 tab 全可见 (含 8 placeholder + 12 真做 + 1 integration), F006 admin 验证
- [ ] lazy load: 首次进 detail 只下载 detail.vue + 当前 tab chunk (network 截图)
- [ ] URL state restore: refresh 后 tab 仍原位
- [ ] canViewPrice mask: F006 受限角色 6 tab 价格全 `****`
- [ ] tab 1 跟踪记录 CRUD 真数据落库
- [ ] tab 20 业务员变更后 history 立即出新条目, 跨页 refresh 仍在
- [ ] tab 10/13 aggregation: SKU 分组 + 累加 + 排序正确 (跟订单 list 总和对账)
- [ ] tab 19 价格记忆: Chat B 未 ship 则 placeholder, ship 后接 API 不破坏
- [ ] Error 边界: 单 tab 后端 5xx 不影响其他 tab
- [ ] 空 state: 新客户 12 真做 tab 全显 "暂无 XX" + CTA
- [ ] `vite build` + `npx vitest run` 双 EXIT=0 (HARD rule)
- [ ] 3 nginx vhost 同步 (新 backend 路径 `/customer-tracking` + `/customer-sales-user-history` 需 cover, per `feedback_nginx_3_vhost_sync.md` HARD)
- [ ] **防呆 R1**: tab 20 变更业务员 dialog 打开即显当前业务员 + 选同业务员 disable
- [ ] **防呆 R2**: CustomerHeader sticky 显客户名 + 编号 + 当前业务员; 全 tab dialog header 带 `{action} — {客户名} ({customerCode})`
- [ ] **防呆 R3**: tab 20 变更原因 6 个 dropdown ("其他"才显 textarea); tab 1 跟踪类型 6 个 dropdown
- [ ] **防呆 R4**: 后端幂等 (5min 内同 customerId+newSalesUserId 返 409); 前端 catch 409 跳已有
- [ ] **防呆 R5**: 8 defer tab + tab 19 全部有 next action button (跳替代方案 tab), 不 dead-end
- [ ] **4 位一体 error toast**: 所有 tab 错误 sticky (duration:0 + showClose) + 显后端 message 原文 + 含 actionHint
- [ ] PR description 显式列出: "防呆 R1/R2/R3/R4/R5 + 4 位一体 ✓"

---

## §10 部署

**Backend** (新 entity + migration + controller):
```bash
./scripts/deploy/deploy-backend.sh --env test   # 先 test
# smoke: curl test endpoint
./scripts/deploy/deploy-backend.sh --env prod
```

Flyway migration 自动 apply on Spring Boot startup. 验证 `systemctl status cretas-backend cretas-backend-test`.

**Frontend** (web-admin):
```bash
./scripts/deploy/deploy-web-admin.sh   # 按 PR diff 选, 不用 deploy-backend.sh
```
per `feedback_pick_deploy_script_by_pr_diff.md` HARD.

**Nginx**: 本 Sprint **必同步** — 加了 2 个新 API 路径 (`/customer-tracking` + `/customer-sales-user-history`). 3 vhost 同步: `web-admin.conf` + `admin.cretaceousfuture.com.conf` + `api.cretaceousfuture.com.conf`. 走 `docs/superpowers/runbooks/nginx-vhost-sync-checklist.md`.

---

## §11 工期 breakdown (~17d)

| Day | Frontend | Backend |
|---|---|---|
| 1 | Spec 完工 + 路由 + detail.vue skeleton | Flyway migration + Customer 字段 |
| 2 | CustomerHeader + el-tabs 框架 + tab→router 同步 | CustomerSalesUserHistory entity + Repo + Service |
| 3 | PlaceholderTab + 8 defer tab 接入 | CustomerSalesUserHistoryController + updateAssignedSalesUser |
| 4 | TrackingTab + OrdersTab (含 mask) | CustomerTrackingRecordController CRUD |
| 5 | SamplesTab + QuotesTab | 6 controller 加 `?customerId=` |
| 6 | InvoicesTab + PaymentsTab | Backend 单测 |
| 7 | ReturnsTab + AttachmentsTab | Backend 完工, 联调 |
| 8 | ItemStatsTab + ProductsTab (前端 aggregate) | — |
| 9 | ShippingAddressTab + SalesUserHistoryTab (含变更 dialog) | — |
| 10 | PriceMemoryTab placeholder + Chat B integration probe | — |
| 11 | canViewPrice mask 6 tab 验收 + UI polish | — |
| 12 | Vitest (≥12 spec: 12 真做 tab 各 1 + detail.spec + PlaceholderTab.spec) | — |
| 13 | Playwright E2E 6 场景 depth-first | — |
| 14 | E2E iteration + bug fix (per `depth-first-e2e` 11 rules) | — |
| 15 | PR + `vite build` + `vitest run` + deploy backend (test→prod) + deploy web-admin + smoke | — |

---

## §12 Risk + 缓解

| Risk | 缓解 |
|---|---|
| Chat B `CustomerPriceMemory` 未按 Sprint 4 W1 ship → tab 19 长期 placeholder | tab 19 留 placeholder, ship 后 ~5 行接 API, 不阻塞 |
| 6 controller 加 `?customerId=` 并发编辑冲突 | per `concurrent-edit-safety.md` 规则 1 + 5b: 里程碑 commit + `safe-commit.sh` 锁定 scope |
| tab 10/13 前端 aggregation 大数据慢 | 分页只取首 500 单 + warning "聚合基于近 500 单, 全量请用导出" |
| systemd `cretas-backend-test` migration 跑失败阻塞 | Flyway 语法本地 PG container dry-run 再 commit |
| F006 客户数据稀疏导致 demo 看空 | 12 真做 tab 全 empty state 友好 CTA, demo 引导 "创建跟踪记录 → 看到流程" |
| 新 API 路径未同步 3 nginx vhost → 真客户 404 | per `feedback_nginx_3_vhost_sync.md` HARD: 加 backend 路径必走 3-vhost 同步 runbook |

---

## §12.5 防呆设计 (Fool-Proof Design) 应用

per `.claude/rules/fool-proof-design.md` (2026-05-17 graduate). Chat F 触发 4 个规则:

### R1 — 预先显示边界 (tab 20 业务员变更 dialog)
- Dialog 打开即显: "当前业务员: {currentAssignedUserName}" (大字明示)
- 选 newSalesUserId dropdown 时, 若选中 === current → submit button disable + hint "已是该业务员"
- 不允许提交空 reason → button disable

### R2 — 上下文必带身份 (整页 + 全 tab)
- detail.vue header: `<CustomerHeader>` 显 客户名 + 编号 + 当前业务员 + 余额 + 评级 (sticky, 滚动可见)
- 每 tab 写操作 dialog header 模板: `{action} — {客户名} ({customerCode})`
  - tab 1 跟踪记录新增: "新增跟踪 — 六腾门食品 (CUST-F006-0001)"
  - tab 20 业务员变更: "变更业务员 — 六腾门食品 (CUST-F006-0001)"
- AIChat tool description (若 Sprint 4 后接): `"为 {customerName} ({customerCode}) 执行 {action}"`

### R3 — 自由文本改 dropdown (tab 20 变更原因 + tab 1 跟踪类型)
- **变更业务员 dialog 的 reason**: el-select 标准原因 + "其他":
  - 离职交接
  - 区域调整
  - 客户要求
  - 业绩重分配
  - 试用期到期
  - 其他 → 显 textarea (必填)
- **tab 1 跟踪记录 type**: dropdown 不让自由填:
  - 电话沟通 / 微信沟通 / 邮件沟通 / 上门拜访 / 视频会议 / 其他

### R4 — 写操作幂等 (tab 20 变更业务员 + tab 1 跟踪新增)
- **后端 CustomerServiceImpl.updateAssignedSalesUser**:
  - 创建前 check: 若 5min 内已对同 customerId 有相同 newSalesUserId 变更 → 返 409 + existingHistoryId + actionHint
  - 前端 catch 409 → ElMessageBox.confirm "5 分钟内已变更过, 是否查看变更记录?" + router 跳 tab 20
- **tab 1 跟踪记录 CRUD**:
  - 后端 dedup: 5min 内同 (customerId, content) → 409 + existingId
  - 前端 catch 409 → 友好提示 + 跳已有条目

### R5 — Dead-end 改导航 (8 defer tab + 1 Chat B integration tab)

defer 8 tab + tab 19 Chat B-pending **不能** 单纯显示 "功能开发中". 必给 next action:

| Tab | Defer Reason | Next Action |
|---|---|---|
| 2 微信记录 | Sprint 5+ 接入企微 API | "暂未对接企微, **当前请用「跟踪记录」tab 手工补录**" + button 跳 tab 1 |
| 3 通话记录 | Sprint 5+ 接入呼叫中心 | 同上 → 跳 tab 1 |
| 4 短信记录 | Sprint 5+ | 同上 |
| 5 谈话录音 | Sprint 6+ | 同上 |
| 6 邮件列表 | Sprint 5+ | 同上 |
| 11 活动管理 | Sprint 5+ (CRM 模块) | "暂未上线 — 临时方案: 在「跟踪记录」记录活动" + button 跳 tab 1 |
| 12 商机管理 | Sprint 5+ | 同上 |
| 18 售后 | Sprint 6+ | "暂未上线 — 临时方案: 用「退货」tab 处理" + button 跳 tab 17 |
| 19 价格记忆 (integration) | 等 Chat B S-PRICE-1 ship | Chat B 未 ship: "价格记忆功能即将上线 (Chat B 开发中) — 当前请查「报价单」tab 看历史价" + button 跳 tab 9 |

PlaceholderTab.vue props 加 `actionText` + `actionRoute`:
```vue
<el-empty :image-size="120">
  <template #description>
    <p>「{{ tabName }}」{{ status }}</p>
    <p class="hint">{{ workaroundHint }}</p>
  </template>
  <el-button v-if="actionText" type="primary" @click="$router.push(actionRoute)">
    {{ actionText }}
  </el-button>
</el-empty>
```

### 4 位一体 — 所有 tab error toast 必满足

per `.claude/rules/fool-proof-design.md` 跨规则铁律. 复用 `web-admin/src/api/request.ts` 的 sticky error 实现:

```typescript
catch (e) {
  if (isAxiosError(e)) {
    const status = e.response?.status
    const backendMessage = e.response?.data?.message  // ← 后端原文
    const actionHint = e.response?.data?.actionHint   // ← 后端 next action

    if (status === 409 && e.response?.data?.existingId) {
      // R4 幂等: 跳已有
      ElMessageBox.confirm(`${backendMessage}, 是否查看?`, '操作冲突', { ... })
        .then(() => router.push(actionHint || routeToExisting(e.response.data.existingId)))
    } else {
      ElMessage({
        message: backendMessage || '操作失败 (请重试)',  // a + b
        type: 'error',
        duration: 0,        // c sticky
        showClose: true,    // c 手动关
        // d: 若后端含 actionHint, 提示用户
      })
    }
  }
}
```

**禁止** `ElMessage.error('操作失败')` generic 替换 backend message.

---

## §13 关键 rule reference (须遵)

| Rule | 适用 |
|---|---|
| `.claude/rules/fool-proof-design.md` 5 大规则 + 4 位一体 (HARD) | R1 边界预显 / R2 context 全 tab / R3 dropdown / R4 幂等 / R5 defer 给 next action / error toast sticky |
| `concurrent-edit-safety.md` 规则 1 / 5b | 里程碑 commit + `safe-commit.sh -- file1 file2` 锁定 scope |
| `feedback_vitest_invariant_tests_not_run_by_vite_build.md` HARD | push 前 `vite build` AND `npx vitest run` 双 EXIT=0 |
| `feedback_pick_deploy_script_by_pr_diff.md` HARD | 前端用 `deploy-web-admin.sh`, 后端 `deploy-backend.sh`, 不混 |
| `feedback_nginx_3_vhost_sync.md` HARD | 加新 API 路径必同步 3 vhost |
| `feedback_test_rls_with_real_pool_not_psql_reset.md` HARD | RLS 测试用 asyncpg pool, 不用 psql RESET |
| `feedback_subagent_local_check_ne_ci.md` HARD | 本地 build PASS ≠ CI PASS, 看 CI 实际结果 |
| `api-response-handling.md` | `{success, data, message}` 解析, 禁静默吞错 |
| `field-naming-convention.md` | 字段全 camelCase |
| `typescript-type-safety.md` | 禁 `as any`, 用类型守卫 |
| `jwt-token-handling.md` | 401 拦截器自动 refresh, SecureStore 存 token |
| `database-entity-sync.md` | BaseEntity 自带 audit 字段, PG `CAST(:param AS string)` null-safe |
| `depth-first-e2e` skill 11 rules | E2E 必读 SKILL.md + 全 11 rule comply |

---

## §14 接下来步骤

1. **本 spec self-review** (Chat F 内) — placeholder / contradict / scope / ambiguity 检查
2. **Steve review spec** — 等批准
3. **invoke `superpowers:writing-plans`** 产出 implementation plan (Day 1-15 task breakdown + sequencing + agent dispatch 分工)
4. **执行** — Day 1 起 follow plan, milestone commit, PR per major chunk

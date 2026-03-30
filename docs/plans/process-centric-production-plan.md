# 可配置生产模式 — 生产管理改造方案 v2

> 来源：客户电话沟通（2026-03-12）+ 批判性评审修订
> 核心思路：生产管理的"主数据维度"应该是可配置的，不同工厂可以选择不同的生产组织模式

---

## 零、设计哲学

**不是"把系统改成工序导向"，而是"让系统支持多种生产模式"。**

### 模式定义

| 模式 | 主线 | 计划粒度 | 签到绑定 | 报工绑定 | 典型客户 |
|------|------|----------|----------|----------|----------|
| BATCH（默认） | 批次 | 某产品生产一批 | 绑批次 | 绑批次 | 标准食品加工厂 |
| PROCESS | 工序 | 某产品的某道工序做多少 | 绑工序任务 | 绑工序任务 | 多工序长周期加工厂 |
| ORDER | 订单 | 按客户订单排产 | 绑订单 | 绑订单 | 定制化/来料加工厂（预留） |

### 架构决策：复用已有 BPM 体系，不新建枚举

~~创建工厂时选择 productionMode 枚举~~ → **通过已有的 `FactoryFeatureConfig` + `StateMachine` 表配置体系来定义工厂的生产模式。**

理由：
- `FactoryFeatureConfig` 已有 `factory_id + module_id + config(JSONB)` 结构，天然支持工厂级配置
- `StateMachine` 已有 `factory_id + entity_type + states_json + transitions_json` 结构，天然支持工作流定义
- 不需要在 Factory 实体上新增字段，不需要数据库迁移
- 前端已有 `factoryFeatureStore.loadFeatures()` / `isModuleEnabled()` 基础设施

**Phase 1 配置方式**：
```
FactoryFeatureConfig:
  factory_id = "F001"
  module_id  = "production"
  config     = {
    "mode": "PROCESS",
    "defaultUnit": "箱",
    "cumulativeReporting": true,
    "reportingInterval": "hourly",
    "completionRule": "manual_with_prompt"
  }
```

**Phase 2/3 配置方式**：
```
StateMachine:
  factory_id  = "F001"
  entity_type = "PRODUCTION_WORKFLOW"
  states_json / transitions_json = (可视化设计器生成的工作流 JSON)
```

---

## 一、现状

### 当前架构（BATCH 模式 — 保留不动）

```
ProductType (商品) ──── processingSteps (JSON字段)
      │
ProductionPlan ──── processName (文本)
      │
ProductionBatch ──── ProcessingStageRecord (环节记录)
      │                     │
      │               ProcessCheckinRecord (签到, 绑 batchId)
      │
ProductionReport (报工, 绑 batchId)
```

这套流程对"标准批次生产"的客户是合理的，保留为默认模式。

### 缺什么（PROCESS 模式需要的）

1. **无独立工序主数据实体** — 工序名只是文本字段，不可复用
2. **商品与工序无结构化关联** — processingSteps 是 JSON 内嵌，无法独立管理
3. **工序无独立产出单位** — 每个工序的计量单位不同（箱/车/框/kg）
4. **无工序级任务概念** — 生产计划只能按"产品"排，不能按"产品+工序"排
5. **签到/报工无法绑定到工序任务**
6. **报工无多级累加汇总** — 需要个人/工序/批次三级累计

---

## 二、目标架构

### 核心实体设计

#### 2.1 工序独立建档：WorkProcess（新建）

**关键决策**：工序与产品分开创建，后续关联。

理由：
- 多个产品可能共享相同工序（如"包装"、"灭菌"）
- 工序有独立的属性（单位、预估工时、技能要求）
- 便于工序主数据的统一管理

```java
// WorkProcess.java — 工序主数据
@Entity
@Table(name = "work_processes")
public class WorkProcess {
    @Id private String id;
    private String factoryId;
    private String processName;      // 工序名称（拆箱、挂晒、卤制...）
    private String processCategory;  // 工序类别（前处理、加工、包装...）
    private String unit;             // 产出单位（箱、车、框、kg）
    private Integer estimatedMinutes;// 预估工时(分钟)
    private Integer sortOrder;       // 默认排序
    private Boolean isActive;
}
```

#### 2.2 产品-工序关联：ProductWorkProcess（新建）

```java
// ProductWorkProcess.java — 产品关联的工序及其顺序
@Entity
@Table(name = "product_work_processes")
public class ProductWorkProcess {
    @Id private Long id;
    private String factoryId;
    private String productTypeId;    // 关联产品
    private String workProcessId;    // 关联工序
    private Integer processOrder;    // 在该产品中的工序顺序
    private String unitOverride;     // 可选：覆盖默认单位
    private Integer estimatedMinutesOverride; // 可选：覆盖默认工时
}
```

这样同一个"包装"工序可以被多个产品引用，排序和参数可在关联层覆写。

#### 2.3 工序任务：ProcessTask（新建，不复用 ProductionPlan）

**关键决策**：不在 ProductionPlan 上加字段，新建独立的 ProcessTask 实体。

理由：
- ProductionPlan 已有大量批次模式的逻辑（CR 值、混批、概率计算等），语义会混乱
- ProcessTask 有自己的生命周期（多日跨度、累计完成）
- 职责清晰，互不干扰

```java
// ProcessTask.java — 工序任务（PROCESS 模式的核心调度单位）
@Entity
@Table(name = "process_tasks")
public class ProcessTask {
    @Id private String id;
    private String factoryId;
    private String productionRunId;      // 生产运行实例 ID（同一次生产的所有工序共享，用于整体汇总）
    private String productTypeId;        // 产品
    private String workProcessId;        // 工序
    private String sourceCustomerName;   // 客户名（从产品/订单带出，历史快照）
    private String sourceDocType;        // 来源单据类型：PLAN / ORDER / MANUAL
    private String sourceDocId;          // 来源单据 ID（生产计划 ID 或订单 ID，nullable）
    private Integer workflowVersionId;   // 创建时绑定的工作流版本号（阶段2起生效，阶段1可为null）
    private BigDecimal plannedQuantity;  // 计划量
    private BigDecimal completedQuantity;// 已确认完成量（仅审核通过的报工累计）
    private BigDecimal pendingQuantity;  // 待审核量（已提交但未审核的报工累计）
    private String unit;                 // 单位（从工序带出）
    private LocalDate startDate;         // 开始日期
    private LocalDate expectedEndDate;   // 预计结束日期
    private ProcessTaskStatus status;    // PENDING / IN_PROGRESS / COMPLETED / CLOSED / SUPPLEMENTING
    private String previousTerminalStatus; // 进入 SUPPLEMENTING 前的终态（COMPLETED/CLOSED），补报完成后恢复用
    private Long createdBy;
    private String notes;
}
```

**运行实例与版本快照设计**：

| 字段 | 作用 | 规则 |
|------|------|------|
| `productionRunId` | 一次生产包含多道工序，共享同一个 runId | 创建时由后端生成（UUID），批次级汇总按此字段聚合 |
| `sourceDocType` + `sourceDocId` | 追溯任务来源（手动排产/订单/计划） | 阶段1手动创建时 `sourceDocType=MANUAL`, `sourceDocId=null` |
| `workflowVersionId` | 任务绑定创建时的工作流版本，不随后续版本更新而改变 | 阶段1可为null；阶段2起强制，保证进行中任务不受新版本影响 |

**汇总规则**：所有进度汇总、补报、AI 分析都按 `productionRunId` + `workflowVersionId` 执行，不会跨运行实例串数据。

**completedQuantity 同步机制（审核前/后双轨）**：

```
报工提交 → pendingQuantity += reportQty  (乐观锁)
                                ↓
审批通过 → pendingQuantity -= reportQty
           completedQuantity += reportQty  (乐观锁, 同一事务)
                                ↓
审批拒绝 → pendingQuantity -= reportQty

前端显示：
  · 预估进度 = completedQuantity + pendingQuantity（操作员实时看）
  · 确认进度 = completedQuantity（正式达标判定依据）
  · 达标提示：预估进度 >= plannedQuantity 时提前预告
  · 正式完成：completedQuantity >= plannedQuantity 时允许标记完成

兜底校准（定时任务，每小时）：
  completedQuantity = SELECT SUM(output_quantity) FROM production_reports
                      WHERE process_task_id = :id AND approval_status = 'APPROVED'
  pendingQuantity   = SELECT SUM(output_quantity) FROM production_reports
                      WHERE process_task_id = :id AND approval_status = 'PENDING'
```

```java
// ProcessTaskStatus.java
public enum ProcessTaskStatus {
    PENDING("待开始"),
    IN_PROGRESS("进行中"),
    COMPLETED("已完成"),       // completedQuantity >= plannedQuantity 后手动标记
    CLOSED("已关闭"),          // 管理层手动关闭（未完成也可关闭）
    SUPPLEMENTING("补报中");   // COMPLETED/CLOSED 后发起补报，审批完成后自动返回原终态
}
```

**阶段 1/2 状态映射**：

| 阶段 1（枚举驱动） | 阶段 2（StateMachine 驱动） | 说明 |
|--------|--------|------|
| `PENDING` | `plan_created` | 任务已创建未开工 |
| `IN_PROGRESS` | `in_progress` | 进行中 |
| — | `target_reached` | 阶段2 新增的**持久状态**：completedQuantity >= plannedQuantity 时系统自动转入，用户可继续超额报工 |
| `COMPLETED` | `completed` | 人工确认完成，终态 |
| `CLOSED` | `closed` | 管理层关闭，终态 |
| `SUPPLEMENTING` | `supplementing` | 补报进行中（两个阶段都有） |

`target_reached` 在阶段 1 不作为枚举值存在，通过前端 `completedQuantity >= plannedQuantity` 派生显示。阶段 2 中它成为 StateMachine 的真实持久状态。

#### 2.4 改造现有实体

```java
// ProcessCheckinRecord — 新增可选字段
private String processTaskId;  // nullable, PROCESS 模式用（替代 batchId）

// ProductionReport — 新增可选字段
private String processTaskId;  // nullable, PROCESS 模式用（替代 batchId）
private Boolean isSupplemental; // 是否为补报记录（关闭/完成后提交的）
private String approvalStatus;  // PENDING / APPROVED / REJECTED（PROCESS 模式下报工审批状态）
```

原有的 `batchId` 保留，BATCH 模式继续使用。

### 前端模式判断逻辑

```typescript
// utils/factoryConfig.ts
// 从 FactoryFeatureConfig 读取，不从 Factory 实体读取
export function getProductionMode(factoryId: string): string {
  const config = factoryFeatureStore.getModuleConfig('production');
  return config?.mode || 'BATCH';
}

export function isProcessMode(factoryId: string): boolean {
  return getProductionMode(factoryId) === 'PROCESS';
}
```

---

## 三、报工完成规则（详细定义）

### 3.1 累计报工三级体系

| 级别 | 维度 | 累计方式 | 用途 |
|------|------|----------|------|
| **个人级** | 员工 + 工序任务 | 该员工在此任务上的所有报工量累加 | 个人绩效、工资核算 |
| **工序级** | 工序任务 | 该任务所有员工的报工量累加 → `completedQuantity` | 工序进度追踪 |
| **批次级** | 产品 + 所有工序任务 | 同一产品下所有工序的完成进度 | 整体生产进度总览 |

### 3.2 完成状态流转

```
PENDING → IN_PROGRESS（首次报工或签到时自动转换）
                ↓
          操作员提交报工（pendingQuantity += qty）
                ↓
          审核通过 → completedQuantity += qty, pendingQuantity -= qty
          审核拒绝 → pendingQuantity -= qty
                ↓
    completedQuantity >= plannedQuantity ?
          ↓ 是                    ↓ 否
    系统提示"已达标"           继续报工
    用户手动标记 COMPLETED     日终仍为 IN_PROGRESS
          ↓
    COMPLETED ────────→ 完成归档（达标正常完成）
    CLOSED ───────────→ 管理层强制关闭（未达标也可关闭）
          ↓
    两种终态如需补报 → 状态变为 SUPPLEMENTING
          ↓
    补报记录提交（isSupplemental=true）→ 进入审批队列
          ↓
    审批通过 → completedQuantity 更新
    审批完成（无更多待审补报）→ 自动恢复到进入补报前的终态（COMPLETED 或 CLOSED）
```

**SUPPLEMENTING 状态详细规则**：

| 规则 | 说明 |
|------|------|
| 触发条件 | COMPLETED 或 CLOSED 任务，由授权角色发起补报时自动转入 |
| 状态语义 | 正在进行补报，任务暂时"活跃"但不是正常进行中 |
| 报工限制 | 仅接受 `isSupplemental=true` 的报工记录 |
| 退出条件 | 所有待审补报均已审批完成（无 PENDING 补报），系统自动恢复原终态 |
| 记录字段 | `previousTerminalStatus` 存储进入 SUPPLEMENTING 前的状态（COMPLETED/CLOSED） |

### 3.3 关键规则

1. **每日必报**：无论是否达到计划量，每天的报工都需要上报
2. **每日推送提醒**：下班前 30 分钟系统推送通知提醒未报工人员（可配置推送时间）
3. **审批后确认**：所有报工需审核通过后才计入 `completedQuantity`，支持多人同时报工
4. **累加式报工**：支持一小时一报，系统自动累加（审核通过后计入确认量）
5. **手动标记完成**：`completedQuantity >= plannedQuantity` 时系统提示，由人工确认完成
6. **未达标也可关闭**：管理层可手动关闭未完成的任务
7. **COMPLETED/CLOSED 均可补报**：两种终态后都允许补报，任务进入 `SUPPLEMENTING` 状态，补报记录 `isSupplemental = true`，必须走审批流程或由高权限角色操作
8. **超额允许**：`completedQuantity` 可以超过 `plannedQuantity`
9. **定时校准**：每小时后台定时任务校准 `completedQuantity / pendingQuantity` 与实际报工记录的 SUM，防止并发或异常导致的数值漂移

### 3.4 活跃任务（active）定义

```
active = status IN ('PENDING', 'IN_PROGRESS', 'SUPPLEMENTING')
```

`GET /{factoryId}/process-tasks/active` 返回状态为 PENDING、IN_PROGRESS 或 SUPPLEMENTING 的所有任务（工序任务可能跨多日）。`SUPPLEMENTING` 包含在活跃列表中，确保补报期间任务可见可操作。

---

## 四、开发清单

### 阶段 0：后端 — 配置基础（复用已有体系）

#### 0.1 FactoryFeatureConfig 新增 production 模块配置

**不需要新建表或枚举**，只需在 `factory_feature_config` 表中为目标工厂插入一条记录：

```sql
INSERT INTO factory_feature_config (factory_id, module_id, module_name, enabled, config)
VALUES ('Fxxx', 'production', '生产管理配置', true, '{
  "mode": "PROCESS",
  "cumulativeReporting": true,
  "completionRule": "manual_with_prompt",
  "reportingInterval": "hourly"
}');
```

#### 0.2 后端新增配置读取 API（如不存在）

在 `FeatureConfigController` 中确保有按 `moduleId` 查询的接口，前端通过 `factoryFeatureStore` 获取。

#### 0.3 登录响应补充

在登录返回或 `/auth/me` 中包含 `featureConfig` 摘要（如已有则跳过），确保前端能拿到 `production.mode`。

---

### 阶段 1：后端 — PROCESS 模式实体

#### 1.1 新建 WorkProcess 实体 + CRUD API

**文件**: `backend/.../entity/WorkProcess.java`

API: `/{factoryId}/work-processes`

| Method | Path | 用途 |
|--------|------|------|
| GET | `/{factoryId}/work-processes` | 工序列表 |
| POST | `/{factoryId}/work-processes` | 创建工序 |
| PUT | `/{factoryId}/work-processes/{id}` | 更新工序 |
| DELETE | `/{factoryId}/work-processes/{id}` | 删除工序 |

#### 1.2 新建 ProductWorkProcess 关联实体 + API

**文件**: `backend/.../entity/ProductWorkProcess.java`

API: `/{factoryId}/product-work-processes`

| Method | Path | 用途 |
|--------|------|------|
| GET | `/{factoryId}/product-work-processes?productTypeId=xxx` | 查产品关联的工序（含顺序） |
| POST | `/{factoryId}/product-work-processes` | 关联产品与工序 |
| PUT | `/{factoryId}/product-work-processes/{id}` | 更新关联（顺序/覆写参数） |
| DELETE | `/{factoryId}/product-work-processes/{id}` | 移除关联 |
| PUT | `/{factoryId}/product-work-processes/batch-sort` | 批量调整排序 |

#### 1.3 新建 ProcessTask 实体 + API

**文件**: `backend/.../entity/ProcessTask.java`

API: `/{factoryId}/process-tasks`

| Method | Path | 用途 |
|--------|------|------|
| GET | `/{factoryId}/process-tasks/active` | **活跃工序任务**（非"今日"） |
| GET | `/{factoryId}/process-tasks?status=xxx&productTypeId=xxx` | 按条件查询 |
| POST | `/{factoryId}/process-tasks` | 创建工序任务 |
| PUT | `/{factoryId}/process-tasks/{id}/status` | 更新状态 |
| PUT | `/{factoryId}/process-tasks/{id}/close` | 关闭任务 |
| GET | `/{factoryId}/process-tasks/{id}/summary` | 任务汇总（三级累计） |

#### 1.4 改造现有实体

```sql
ALTER TABLE process_checkin_records ADD COLUMN process_task_id VARCHAR(50);
ALTER TABLE production_reports ADD COLUMN process_task_id VARCHAR(50);
```

#### 1.5 报工累计相关 API

| Method | Path | 用途 |
|--------|------|------|
| POST | `/{factoryId}/work-reporting` | 提交报工（原有，新增 processTaskId） |
| GET | `/{factoryId}/work-reporting/by-task/{taskId}` | 某任务的报工记录 |
| GET | `/{factoryId}/work-reporting/by-task/{taskId}/summary` | 某任务报工累计汇总 |
| GET | `/{factoryId}/work-reporting/by-worker/{workerId}/summary` | 某员工的报工汇总（个人级累计） |
| GET | `/{factoryId}/process-checkin/by-task/{taskId}/active` | 某任务在岗人员 |

#### 1.6 报工审批 API

所有报工（含正常报工和补报）在 PROCESS 模式下都需要审核。

| Method | Path | 用途 |
|--------|------|------|
| POST | `/{factoryId}/work-reporting/supplement` | 补报（COMPLETED/CLOSED 任务后，isSupplemental=true） |
| GET | `/{factoryId}/work-reporting/pending-approval` | 待审核报工列表 |
| PUT | `/{factoryId}/work-reporting/{id}/approve` | 审批通过（completedQuantity += qty） |
| PUT | `/{factoryId}/work-reporting/{id}/reject` | 审批拒绝（pendingQuantity -= qty） |
| PUT | `/{factoryId}/work-reporting/batch-approve` | 批量审批（提高审批效率） |
| POST | `/{factoryId}/work-reporting/{id}/reversal` | 冲销（已审批记录的数量修正） |

**审批幂等与数据完整性规则**：

| 规则 | 说明 |
|------|------|
| **条件更新** | `approve/reject` 必须带 `WHERE approval_status = 'PENDING'`，返回影响行数为 0 则视为已处理，接口返回 409 Conflict |
| **不可原地修改** | 已审批（APPROVED/REJECTED）的 `ProductionReport` 禁止修改 `output_quantity`；如需纠错，只能提交**冲销记录**（`reversal`） |
| **冲销机制** | 冲销记录引用原记录 ID（`reversalOfId`），数量取负值，审批后反向更新 `completedQuantity`。保留完整审计链 |
| **批量审批语义** | 单条事务，全部成功或全部回滚；返回结果列表含每条记录的审批状态。不做"部分成功" |
| **高权限直接报工** | `factory_admin` 提交的报工自动审批通过（`approvalStatus = APPROVED`, `approvedBy = 自己`），但必须留审计记录 |
| **审计字段** | 每条 `ProductionReport` 记录 `approvedBy`（审批人ID）、`approvedAt`（审批时间）、`rejectedReason`（驳回原因） |
| **SUPPLEMENTING 联动** | 补报记录全部审批完成后（无 PENDING 状态补报），系统自动将 ProcessTask 从 SUPPLEMENTING 恢复到 `previousTerminalStatus` |

#### 1.7 数据库迁移 SQL

```sql
-- 1. 工序主数据
CREATE TABLE work_processes (
    id VARCHAR(50) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    process_name VARCHAR(100) NOT NULL,
    process_category VARCHAR(50),
    unit VARCHAR(20) NOT NULL DEFAULT 'kg',
    estimated_minutes INTEGER,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);
CREATE INDEX idx_wp_factory ON work_processes(factory_id);

-- 2. 产品-工序关联
CREATE TABLE product_work_processes (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    product_type_id VARCHAR(50) NOT NULL,
    work_process_id VARCHAR(50) NOT NULL,
    process_order INTEGER DEFAULT 0,
    unit_override VARCHAR(20),
    estimated_minutes_override INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(factory_id, product_type_id, work_process_id)
);
CREATE INDEX idx_pwp_product ON product_work_processes(factory_id, product_type_id);

-- 3. 工序任务
CREATE TABLE process_tasks (
    id VARCHAR(50) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    production_run_id VARCHAR(50) NOT NULL,        -- 生产运行实例 ID（同一次生产的所有工序共享）
    product_type_id VARCHAR(50) NOT NULL,
    work_process_id VARCHAR(50) NOT NULL,
    source_customer_name VARCHAR(100),
    source_doc_type VARCHAR(20),                   -- 来源单据类型: PLAN / ORDER / MANUAL
    source_doc_id VARCHAR(50),                     -- 来源单据 ID（nullable）
    workflow_version_id INTEGER,                    -- 创建时绑定的工作流版本（阶段2起强制）
    planned_quantity DECIMAL(10,2) NOT NULL,
    completed_quantity DECIMAL(10,2) DEFAULT 0,    -- 审核通过的报工累计
    pending_quantity DECIMAL(10,2) DEFAULT 0,      -- 待审核的报工累计
    unit VARCHAR(20) NOT NULL,
    start_date DATE,
    expected_end_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    previous_terminal_status VARCHAR(20),           -- 进入 SUPPLEMENTING 前的终态
    created_by BIGINT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    version BIGINT DEFAULT 0                       -- 乐观锁版本号
);
CREATE INDEX idx_pt_factory_status ON process_tasks(factory_id, status);
CREATE INDEX idx_pt_factory_product ON process_tasks(factory_id, product_type_id);
CREATE INDEX idx_pt_run ON process_tasks(production_run_id);

-- 4. 现有表扩展
ALTER TABLE process_checkin_records ADD COLUMN process_task_id VARCHAR(50);
ALTER TABLE production_reports ADD COLUMN process_task_id VARCHAR(50);
ALTER TABLE production_reports ADD COLUMN is_supplemental BOOLEAN DEFAULT FALSE;
ALTER TABLE production_reports ADD COLUMN approval_status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE production_reports ADD COLUMN approved_by BIGINT;
ALTER TABLE production_reports ADD COLUMN approved_at TIMESTAMP;
ALTER TABLE production_reports ADD COLUMN rejected_reason VARCHAR(500);
-- approval_status: PENDING(待审核) / APPROVED(通过) / REJECTED(驳回)
```

---

### 阶段 2：Vue Web-admin — 配置与计划

#### 2.1 工厂配置中选择生产模式

**位置**: 平台管理 → 工厂管理 → 工厂详情

在工厂配置中（通过 FactoryFeatureConfig），提供「生产模式」选择：
- 批次模式（默认）
- 工序模式
- 订单模式（灰色，Coming Soon）

保存时写入 `factory_feature_config` 表，不修改 Factory 实体。

#### 2.2 新增：工序主数据管理页

**位置**: `web-admin/src/views/system/work-processes/index.vue`
**路由**: `/system/work-processes`
**侧边栏**: 系统管理 → 工序管理（仅 PROCESS 模式显示）

功能：
- 工序列表（名称、类别、单位、预估工时）
- 新增 / 编辑 / 删除 / 启停
- 工序是独立实体，不依赖产品

#### 2.3 新增：产品-工序关联配置

**位置**: 产品管理 → 产品详情 → 「工序配置」Tab

功能：
- 左侧：可选工序列表（从 WorkProcess 中选择）
- 右侧：已关联工序（支持拖拽排序）
- 每行：工序名、单位（可覆写）、预估工时（可覆写）

#### 2.4 改造：生产计划创建（按模式分支）

```
if (productionMode === 'BATCH') {
  // 现有流程不动
}

if (productionMode === 'PROCESS') {
  // 创建的是 ProcessTask（工序任务）：
  // 1. 选产品 → 自动带出客户 + 关联的工序列表
  // 2. 选工序 → 单位自动带出
  // 3. 填计划量
  // 4. 选开始/预计结束日期（支持多日跨度）
}
```

#### 2.5 新增：报工审批页

**位置**: `web-admin/src/views/production/reports/index.vue`

功能：
- 报工记录列表（PROCESS 模式按工序过滤，BATCH 模式按批次过滤）
- 审批通过 / 驳回
- PROCESS 模式：按工序任务汇总视图（三级累计展示）
- 补报记录高亮标识，需要额外审批

---

### 阶段 3：RN 前端 — 现场执行

#### 3.0 前端模式基础

```typescript
// utils/factoryConfig.ts
import { useFactoryFeatureStore } from '@/store/factoryFeatureStore';

export function getProductionMode(): string {
  const store = useFactoryFeatureStore();
  const config = store.getModuleConfig('production');
  return config?.mode || 'BATCH';
}

export function isProcessMode(): boolean {
  return getProductionMode() === 'PROCESS';
}
```

#### 3.1 PROCESS 模式：操作员首页

**文件**: 新建 `screens/operator/ProcessTaskListScreen.tsx`

- 活跃工序任务卡片列表（`GET /process-tasks/active`，非仅"今日"）
  - 每个卡片：产品名 | 工序名 | 已完成/计划量 | 在岗人数
  - 状态标签：待开始 / 进行中 / 已完成 / 已关闭
  - 进度条显示
- 点击卡片 → 进入工序任务详情

BATCH 模式 → 保持现有流程不动。

#### 3.2 PROCESS 模式：工序任务详情页

**文件**: 新建 `screens/operator/ProcessTaskScreen.tsx`

- 产品名 + 工序名 + 单位
- 进度条：已完成量 / 计划量
- 达标提示：`completedQuantity >= plannedQuantity` 时显示"已达标，可标记完成"
- 在岗人员列表
- 操作区：扫码签到 | 扫码签退 | 立即报工
- 报工历史（今日 + 累计）
- 三级累计展示：我的报工量 / 工序总量 / 产品整体进度

#### 3.3 签到签退（按模式分支）

```
if (mode === 'BATCH')   → 现有 NfcCheckinScreen（选批次 → 扫码）
if (mode === 'PROCESS') → 选工序任务 → 扫码（绑定 processTaskId）
```

#### 3.4 报工（按模式分支）

PROCESS 模式报工特点：
- 支持多次报工（如一小时一次），每次一条记录
- 系统自动累加 `completedQuantity`
- 页面显示累计进度（已完成 / 计划）
- 达标时弹窗提示是否标记完成
- 底部显示今日报工历史 + 个人累计

#### 3.5 补报流程

- 任务 CLOSED 后，报工入口变为"补报"
- 补报记录 `isSupplemental = true`
- 提交后进入审批队列
- 或由高权限角色（车间主任+）直接提交

#### 3.6 车间主任/调度员

- PROCESS 模式首页：按产品分组的工序任务总览（三级进度一览）
- BATCH 模式首页：现有批次总览（不动）

---

### 阶段 4：办公室考勤（独立模块）

与工序报工是两条线，并行开发。

- 办公室人员：签到 → 签退 → 自动记录在岗时长 → 下班时上报当天完成情况
- 不涉及工序，纯考勤 + 日报
- 复用现有 TimeClockScreen + 新增"日报提交"功能

---

## 五、接口清单总览

### 新增接口

| Method | Path | 用途 |
|--------|------|------|
| GET | `/{factoryId}/work-processes` | 工序列表 |
| POST | `/{factoryId}/work-processes` | 创建工序 |
| PUT | `/{factoryId}/work-processes/{id}` | 更新工序 |
| DELETE | `/{factoryId}/work-processes/{id}` | 删除工序 |
| GET | `/{factoryId}/product-work-processes?productTypeId=xxx` | 产品关联的工序 |
| POST | `/{factoryId}/product-work-processes` | 关联产品与工序 |
| PUT | `/{factoryId}/product-work-processes/{id}` | 更新关联 |
| DELETE | `/{factoryId}/product-work-processes/{id}` | 移除关联 |
| PUT | `/{factoryId}/product-work-processes/batch-sort` | 批量排序 |
| GET | `/{factoryId}/process-tasks/active` | 活跃工序任务 |
| GET | `/{factoryId}/process-tasks?status=xxx` | 按条件查询任务 |
| POST | `/{factoryId}/process-tasks` | 创建工序任务 |
| PUT | `/{factoryId}/process-tasks/{id}/status` | 更新任务状态 |
| PUT | `/{factoryId}/process-tasks/{id}/close` | 关闭任务 |
| GET | `/{factoryId}/process-tasks/{id}/summary` | 任务三级汇总 |
| GET | `/{factoryId}/work-reporting/by-task/{taskId}` | 某任务报工记录 |
| GET | `/{factoryId}/work-reporting/by-task/{taskId}/summary` | 某任务报工累计 |
| GET | `/{factoryId}/work-reporting/by-worker/{workerId}/summary` | 某员工报工汇总 |
| GET | `/{factoryId}/process-checkin/by-task/{taskId}/active` | 某任务在岗人员 |
| POST | `/{factoryId}/work-reporting/supplement` | 补报 |
| PUT | `/{factoryId}/work-reporting/{id}/approve` | 审批补报 |
| PUT | `/{factoryId}/work-reporting/{id}/reject` | 拒绝补报 |

### 改造接口

| Method | Path | 改造内容 |
|--------|------|----------|
| POST | `/{factoryId}/work-reporting` | 新增 processTaskId 字段 |
| POST | `/{factoryId}/process-checkin` | 新增 processTaskId 字段 |
| POST | `/{factoryId}/process-checkin/checkout` | 新增 processTaskId 字段 |

---

## 六、开发优先级与工作量

| 优先级 | 任务 | 端 | 估时 |
|--------|------|-----|------|
| P0 | FactoryFeatureConfig 插入 production 模块配置 | 后端 | 1h |
| P0 | WorkProcess 实体 + CRUD API | 后端 | 3h |
| P0 | ProductWorkProcess 关联实体 + API | 后端 | 2h |
| P0 | ProcessTask 实体 + API（含活跃查询） | 后端 | 4h |
| P0 | 数据库迁移 SQL | 后端 | 1h |
| P0 | ProcessCheckinRecord / ProductionReport 新增 processTaskId | 后端 | 1h |
| P0 | 报工累计汇总 + 补报审批 API | 后端 | 3h |
| P1 | Vue 工厂配置选择生产模式 | Web | 1h |
| P1 | Vue 工序主数据管理页 | Web | 3h |
| P1 | Vue 产品-工序关联配置 | Web | 3h |
| P1 | Vue 工序任务创建（生产计划分支） | Web | 3h |
| P1 | Vue 报工审批页（含补报审批） | Web | 3h |
| P2 | RN 生产模式读取 + 条件渲染基础 | RN | 2h |
| P2 | RN PROCESS 模式操作员首页 + 任务详情 | RN | 4h |
| P2 | RN PROCESS 模式签到签退 | RN | 3h |
| P2 | RN PROCESS 模式累加报工（含达标提示） | RN | 3h |
| P2 | RN 补报流程 | RN | 2h |
| P3 | RN 车间主任 PROCESS 模式总览 | RN | 3h |
| P3 | RN 办公室日报功能 | RN | 2h |
| - | **合计** | - | **~47h** |

---

## 七、数据流总览

### PROCESS 模式

```
[Vue Web-admin]                           [RN 现场端]

工序建档（独立主数据）                     登录 → 读取 FeatureConfig production.mode
    │                                         │
产品建档 → 关联工序                       活跃工序任务列表
(ProductWorkProcess)                     (GET /process-tasks/active)
    │                                         │
排工序任务                                选择工序任务
(POST /process-tasks)                        │
    │                                  ┌──────┴──────┐
    │                               扫码签到       立即报工
    │                            (绑taskId)    (绑taskId, 累加)
    │                               │              │
    │                               │         completedQty >= plannedQty ?
    │                               │              │ 是
    │                               │         系统提示 → 手动标记完成
    │                               │              │
报工审批 ◄──────────────────────────┘──────────────┘
(按工序汇总, 三级累计)               查看累计进度
    │                              (个人/工序/产品)
    │
关闭任务后补报 → 审批流程
```

### BATCH 模式（现有，保持不变）

```
[Vue Web-admin]                           [RN 现场端]

生产计划                                   登录 → production.mode=BATCH
    │                                         │
转为批次                                   批次列表 / 扫码
    │                                         │
ProductionBatch                           ┌────┴────┐
    │                                  签到(批次)  报工(批次)
    │                                  (绑batchId) (绑batchId)
报工审批                                      │
(按批次汇总)                              查看批次进度
```

---

## 八、向后兼容

- **不修改 Factory 实体** — 模式通过 FactoryFeatureConfig 配置
- **不修改 ProductionPlan** — PROCESS 模式使用独立的 ProcessTask
- `ProcessCheckinRecord.processTaskId` nullable，旧签到保留 batchId
- `ProductionReport.processTaskId` nullable，旧报工保留 batchId
- 前端通过 `isProcessMode()` 条件渲染，BATCH 模式完全不受影响
- 两种模式并行运行，互不干扰
- 所有新表和字段都是增量添加，无破坏性变更

---

## 九、演进路线：从配置到可视化工作流引擎

### 终极目标

平台管理员在 Vue Web-admin 中，通过**可视化流程设计器（内嵌 AI 对话）**为每个工厂配置整套生产流程。
前端根据流程配置动态渲染页面和操作。

### 三阶段演进

```
阶段 1 (现在)              阶段 2 (下一步)                阶段 3a                     阶段 3b (终极)
FeatureConfig 配置模式  →  StateMachine JSON             可视化设计器               Factory Config Agent
前端 if/else 切换          + Node Schema Registry        Vue Flow 拖拽画布          AI 对话配置 + 知识库
BATCH / PROCESS            前端读 JSON 动态渲染           + JSON Schema 属性面板      AI 学习 + 模板自动生成
~47h                       ~3-4 周                       ~4-5 周                    ~5-7 周
```

### 过渡策略（关键）

**阶段 1 的代码在阶段 2/3 完成前不删除。**

- 阶段 2 完成后，先并行运行：新工厂用 StateMachine 工作流，旧工厂保持 FeatureConfig
- 阶段 2 验证稳定后，为旧工厂生成等价的 StateMachine 配置
- 确认全部迁移完成后，再清除阶段 1 的 if/else 代码
- 整个过程保持零停机、零数据丢失

### 阶段 1：FeatureConfig + if/else（本次交付）

- `FactoryFeatureConfig` 中 `module_id='production'` 配置模式
- 前端条件渲染两套流程
- 目标：先让当前客户跑起来，验证工序模式的产品逻辑

### 阶段 2：StateMachine 工作流 JSON + Node Schema Registry

复用已有的 `state_machines` 表，定义 `entity_type = 'PRODUCTION_WORKFLOW'`：

**数据库约束调整**（支持草稿和已发布版本共存）：

```sql
-- 原约束: UNIQUE(factory_id, entity_type)
-- 新约束: UNIQUE(factory_id, entity_type, version)
ALTER TABLE state_machines DROP CONSTRAINT IF EXISTS uk_factory_entity;
ALTER TABLE state_machines ADD COLUMN is_draft BOOLEAN DEFAULT FALSE;
ALTER TABLE state_machines ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE state_machines ADD CONSTRAINT uk_factory_entity_version
    UNIQUE(factory_id, entity_type, version);
```

**版本状态机**：

```
draft ──发布──→ published ──新版本发布──→ archived
  ↑                                         │
  └────────复制为新草稿─────────────────────┘
```

| 状态 | 说明 | 约束 |
|------|------|------|
| `draft` | 草稿，可编辑，不影响运行中的任务 | 每个 `(factory_id, entity_type)` 最多一个服务器草稿 |
| `published` | 当前生效版本，新任务创建时绑定此版本 | 每个 `(factory_id, entity_type)` **有且仅有一个** published |
| `archived` | 历史版本，只读归档 | 不可编辑，可查看、可复制为新草稿 |

```sql
ALTER TABLE state_machines ADD COLUMN publish_status VARCHAR(20) DEFAULT 'draft';
-- publish_status: draft / published / archived
-- 替代之前的 is_draft BOOLEAN，表达力更强

-- 唯一当前生效版本约束（部分唯一索引）
CREATE UNIQUE INDEX uk_sm_published
    ON state_machines(factory_id, entity_type)
    WHERE publish_status = 'published';
```

**发布事务规则**（单事务，不可中断）：

```
BEGIN TRANSACTION;
  1. 锁定目标 factory_id + entity_type 的所有记录（SELECT ... FOR UPDATE）
  2. 将当前 published 版本改为 archived
  3. 将目标草稿改为 published，version = max(version) + 1
  4. 检查是否存在 status IN ('IN_PROGRESS', 'SUPPLEMENTING') 的任务绑定旧版本
     → 如存在，记录警告日志但不阻断发布（旧任务继续按旧版本运行）
COMMIT;
```

**草稿存储策略**：

| 存储方式 | 说明 | 适用场景 |
|----------|------|----------|
| **数据库草稿**（`publish_status='draft'`）| 保存到 state_machines 表，他人可见但不生效 | 团队协作、跨设备编辑 |
| **本地缓存草稿** | 保存到浏览器 localStorage，不上传 | 个人临时编辑、探索性修改 |

前端提供选项让用户决定存储方式。服务器草稿同一工厂同一 entity_type 只允许一个，避免多人协作冲突。

**工作流 JSON 示例**：

```json
{
  "machineName": "多工序长周期加工流程",
  "initialState": "plan_created",
  "states": [
    { "code": "plan_created", "name": "任务已创建", "isFinal": false },
    { "code": "in_progress", "name": "进行中", "isFinal": false },
    { "code": "target_reached", "name": "已达标", "isFinal": false },
    { "code": "completed", "name": "已完成", "isFinal": true },
    { "code": "closed", "name": "已关闭", "isFinal": true },
    { "code": "supplementing", "name": "补报中", "isFinal": false }
  ],
  "transitions": [
    { "from": "plan_created", "to": "in_progress", "event": "first_checkin_or_report" },
    { "from": "in_progress", "to": "target_reached", "event": "quantity_reached", "guard": "#isCompletedGtePlanned(id)" },
    { "from": "target_reached", "to": "completed", "event": "manual_complete" },
    { "from": "in_progress", "to": "closed", "event": "manual_close", "guard": "#hasPermission('workshop_supervisor')" },
    { "from": "completed", "to": "supplementing", "event": "initiate_supplement", "guard": "#hasPermission('factory_admin')", "action": "enter_supplementing" },
    { "from": "closed", "to": "supplementing", "event": "initiate_supplement", "guard": "#hasPermission('factory_admin')", "action": "enter_supplementing" },
    { "from": "supplementing", "to": "completed", "event": "supplement_done", "guard": "#hasNoPendingSupplements(id) && #previousStatusIs('COMPLETED')", "action": "exit_supplementing" },
    { "from": "supplementing", "to": "closed", "event": "supplement_done", "guard": "#hasNoPendingSupplements(id) && #previousStatusIs('CLOSED')", "action": "exit_supplementing" }
  ]
}
```

> guard 使用现有 `StateMachineServiceImpl.evaluateGuard()` + `registerGuardFunctions()` 的 SpEL 白名单函数体系。action 通过 `RuleEngineService.executeRules("action:" + actionName)` 走 Drools 执行。

前端不再 if/else，而是读 StateMachine 配置动态渲染。
新客户来了，复制模板改配置，不改代码。

**Node Schema Registry（阶段 2 即引入）**：

阶段 2 的动态渲染需要知道有哪些节点类型和属性，因此 `WorkflowNodeRegistry` 在本阶段实现。
详细设计见第九节 "Node Schema Registry — 组件自动发现"。

- `GET /api/workflow/node-schemas` — 前端画布和 Agent 共用
- 前端根据 Schema 动态生成属性面板（不硬编码每种节点的表单）

**可复用基础**：
- `StateMachineServiceImpl` — 状态转换引擎（审计日志、动作执行）
- `StateMachineDesignerScreen` — 状态机设计器 UI 概念
- `RuleConfigurationScreen` — AI 自然语言生成状态机
- `ToolExecutor` + `ToolRegistry` — 自描述组件注册模式（复用给 WorkflowNodeDescriptor + WorkflowNodeRegistry）

#### 规则表达式安全策略（复用现有 SpEL guard 基础设施）

**核心发现**：后端已有完整的规则引擎双引擎架构，直接复用：

| 已有组件 | 位置 | 复用方式 |
|----------|------|----------|
| `StateMachineServiceImpl.evaluateGuard()` | SpEL 解析 + StandardEvaluationContext | 直接复用，生产工作流的 guard 走同一条路径 |
| `registerGuardFunctions()` | 自定义函数注册（hasPermission、isBusinessHours 等） | 扩展新函数，不改基础设施 |
| `RuleEngineService` (Drools) | 规则执行、DRL 热加载、沙箱 dry-run | 转换 action 继续走 Drools |
| `DecisionAuditService` | logStateTransition、logRuleExecution、可回放 | 直接复用，无需新建审计 |

**安全策略：白名单函数 + 设计器约束**

不发明新 DSL，而是在 `registerGuardFunctions()` 中扩展生产工作流专用函数，设计器和 Agent 只能使用已注册的白名单函数和属性比较：

**新增 guard 函数**（注册到 `StateMachineServiceImpl`）：

| 函数 | 签名 | 用途 |
|------|------|------|
| `#isCompletedGtePlanned()` | `(String taskId)` → Boolean | completedQuantity >= plannedQuantity |
| `#hasNoPendingSupplements()` | `(String taskId)` → Boolean | 无待审补报记录 |
| `#previousStatusIs(status)` | `(String status)` → Boolean | 补报前终态匹配 |
| `#isWithinSupplementWindow()` | `(String taskId)` → Boolean | 是否在补报允许时间窗内 |

**设计器/Agent 的 guard 编辑约束**：

1. **设计器前端**：下拉选择已注册的 guard 函数/属性比较，不允许自由输入 SpEL
2. **AI Agent**：从 `WorkflowNodeRegistry` 获取可用 guard 列表，只能组合白名单函数
3. **保存时校验**：后端解析 guard 表达式，确认所有函数调用都在白名单内
4. **发布时校验**：通过 `RuleEngineService.executeDryRun()` 模拟执行，确保无运行时错误
5. **运行时**：`StateMachineServiceImpl.evaluateGuard()` 正常执行，与现有流程完全一致

**guard 表达式示例**（复用现有 SpEL 语法）：

```
// 权限检查（已有函数）
#hasPermission('workshop_supervisor')

// 数量达标（新增函数）
#isCompletedGtePlanned(id)

// 组合条件
#hasNoPendingSupplements(id) && #previousStatusIs('COMPLETED')
```

**Drools 动作扩展**：转换 action 继续走现有 `ruleEngineService.executeRules("action:" + actionName, entity)` 路径，新增以下规则组：

| 规则组 | 触发时机 | 作用 |
|--------|----------|------|
| `action:update_completed_qty` | 审批通过时 | 更新 ProcessTask 的 completedQuantity |
| `action:enter_supplementing` | 发起补报时 | 记录 previousTerminalStatus，切换状态 |
| `action:exit_supplementing` | 补报审批完成时 | 恢复原终态 |
| `onTransition:PRODUCTION_WORKFLOW` | 任何转换后 | 审计日志（DecisionAuditService 自动记录） |

### 阶段 3a：可视化流程设计器

#### 架构定位

- **入口**：Vue Web-admin → 平台管理 → 工厂管理 → 生产流程配置
- **权限**：仅平台管理员（`platform_admin`）可见可操作
- **界面形态**：可视化画布 + AI 对话面板 **一体化设计**（不是独立入口）

#### 界面结构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🎨 生产流程配置 — [工厂名称]         [保存本地▾] [保存到服务器] [发布] [历史]│
│                                                                             │
│ ┌────────┐ ┌──────────────────────────────────┐ ┌──────────────────────────┐│
│ │ 📦节点库 │ │          可视化画布               │ │ 🤖 Factory Config Agent  ││
│ │        │ │                                  │ │                          ││
│ │┌──────┐│ │  ┌────┐   ┌────┐   ┌────┐       │ │ AI 和画布实时双向同步：    ││
│ ││计划创建││ │  │计划│──→│签到│──→│报工│──→... │ │ · 画布拖拽 → AI 感知变更  ││
│ │└──────┘│ │  └────┘   └────┘   └────┘       │ │ · AI 输出 → 画布实时渲染  ││
│ │┌──────┐│ │                                  │ │                          ││
│ ││签到签退││ │                                  │ │ ┌────────────────────┐   ││
│ │└──────┘│ │                                  │ │ │ 👤 我们做卤制品，    │   ││
│ │┌──────┐│ │                                  │ │ │   生产周期5天...    │   ││
│ ││累加报工││ │                                  │ │ └────────────────────┘   ││
│ │└──────┘│ │                                  │ │                          ││
│ │┌──────┐│ │                                  │ │ ┌────────────────────┐   ││
│ ││ 审批  ││ │                                  │ │ │ 🤖 基于「东兴卤制品 │   ││
│ │└──────┘│ │                                  │ │ │   加工厂」的配置经验,│   ││
│ │┌──────┐│ │                                  │ │ │   推荐以下流程...   │   ││
│ ││ 质检  ││ │                                  │ │ └────────────────────┘   ││
│ │└──────┘│ │                                  │ │                          ││
│ │┌──────┐│ │                                  │ │ [输入消息...        发送] ││
│ ││完工标记││ │                                  │ │                          ││
│ │└──────┘│ │                                  │ │                          ││
│ └────────┘ └──────────────────────────────────┘ └──────────────────────────┘│
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ⚙️ 属性面板 — 当前选中：[报工 (累加)]                                    │ │
│ │ 报工方式 / 间隔 / 必填字段 / 达标动作 / 补报策略 ...                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 🌐 全局配置 — 主数据维度 / 单位体系 / 进度追踪 / 完成规则 / 意图集成    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

核心：**画布和 AI 对话是一个统一的工作区**。平台管理员可以：
- 左手拖拽节点、连线、改属性
- 右手跟 AI 对话让它快速调整
- 两边实时同步，任何一侧的操作另一侧立即反映

### 阶段 3b：Factory Config Agent + 知识库

#### Factory Config Agent（专用配置 AI）

这是一个**专门用于工厂生产流程配置的 AI Agent**，不是通用对话 AI。

**Agent 职责**：

| 能力 | 说明 |
|------|------|
| **追问确认** | 按主题清单逐步追问，确保配置信息完整准确，展示配置进度 |
| **理解用户描述** | 用户用自然语言描述工厂业务（"我们做卤制品，周期5天..."），Agent 转化为工作流配置 |
| **自动发现组件** | 从 Node Schema Registry 动态读取所有可用节点类型和属性，无需硬编码 |
| **生成工作流** | 输出 StateMachine JSON + nodeConfigs + globalConfig，实时渲染到画布 |
| **修改工作流** | 用户说"去掉质检环节"或"报工改成一次性"，Agent 精准修改对应配置 |
| **知识检索** | 从专用知识库检索行业工序知识、历史配置、最佳实践，辅助配置决策 |
| **学习已有配置** | 每次发布工作流配置后，Agent 自动分析并索引该配置的模式特征 |
| **推荐与加速** | 下次配置类似工厂时，Agent 基于已学习的配置快速推荐，越用越快 |
| **自动生成预设模板** | 当 Agent 发现多个工厂使用相似配置时，自动抽象为预设模板供未来选用 |

#### 追问机制

Agent 按主题清单分步收集配置信息，确保关键项不遗漏。
复用现有的 Python 客户需求向导模式（`topicsCovered` / `topicsRemaining`）+ Vue AiEntryDrawer 对话组件。

**配置信息收集清单**：

| 序号 | 主题 | 必填 | 典型追问 |
|------|------|------|----------|
| 1 | 行业与产品 | 是 | "您工厂主要做什么产品？典型生产周期多少天？" |
| 2 | 生产维度 | 是 | "生产是围绕工序组织还是围绕批次组织？" |
| 3 | 工序流程 | 是 | "典型的工序有哪些？每道工序的计量单位是什么？" |
| 4 | 报工规则 | 是 | "报工是每次累加还是一天统一报？达标后怎么处理？" |
| 5 | 签到方式 | 是 | "签到是主管扫码还是工人自助？用什么方式？" |
| 6 | 审批流程 | 是 | "正常报工需要审批吗？补报怎么处理？" |
| 7 | 进阶配置 | 否 | "需要在某些工序后加质检环节吗？" |

**追问逻辑**：

- 用户描述完整 → Agent 列出已覆盖 + 剩余主题，精准追问
- 用户描述模糊 → Agent 从第 1 个未覆盖主题开始引导
- 用户描述矛盾 → Agent 指出矛盾，请求确认

**前端配置进度指示器**（嵌入 AI 对话面板顶部）：

```
配置进度: ████████████░░░░░░ 60%
✅ 行业类型  ✅ 生产维度  ✅ 工序流程  ✅ 报工规则  🔄 签到方式  ○ 审批流程
```

#### Node Schema Registry — 组件自动发现（阶段 2 实现，阶段 3a/3b 复用）

**核心原则**：Agent 和前端画布都不硬编码节点类型和属性，而是从 Registry 动态读取。

**实现时机**：阶段 2（与 StateMachine 工作流 JSON 同步实现），因为阶段 2 的前端动态渲染就需要 node schemas。阶段 3a 画布和阶段 3b Agent 直接复用。

复用项目已有的 `ToolExecutor` + `ToolRegistry` 自描述模式（310+ Tools 自动注册，AI 动态发现）。

**WorkflowNodeDescriptor 接口**：

```java
public interface WorkflowNodeDescriptor {
    String getNodeType();           // "cumulative_report"
    String getDisplayName();        // "累加报工"
    String getCategory();           // "reporting"
    String getDescription();        // 给 AI 读的描述
    Map<String, Object> getConfigSchema();  // JSON Schema — 所有可配置属性
    List<String> getAllowedNextNodes();      // 可连接的下游节点类型
    Map<String, Object> getDefaultConfig(); // 默认配置值
}
```

**WorkflowNodeRegistry**（Spring DI 自动发现）：

```java
@Component
public class WorkflowNodeRegistry {
    @Autowired(required = false)
    private List<WorkflowNodeDescriptor> descriptors;
    // 自动收集所有 Descriptor 实现，和 ToolRegistry 完全一样

    public List<NodeSchemaDTO> getAllNodeSchemas() { ... }  // Agent + 前端共用
}
```

**示例 — 累加报工节点的 configSchema**：

```json
{
  "type": "object",
  "properties": {
    "interval": {
      "type": "string",
      "enum": ["realtime", "hourly", "per_shift", "daily"],
      "description": "报工频率提醒间隔",
      "default": "hourly"
    },
    "requiredFields": {
      "type": "array",
      "items": { "type": "string", "enum": ["outputQuantity", "defectQuantity", "note", "photo"] },
      "description": "报工时必须填写的字段",
      "default": ["outputQuantity"]
    },
    "allowExcess": {
      "type": "boolean",
      "description": "是否允许报工量超过计划量",
      "default": true
    },
    "onTargetReached": {
      "type": "string",
      "enum": ["prompt_manual_complete", "auto_complete", "continue_silently"],
      "description": "达到计划量时的动作",
      "default": "prompt_manual_complete"
    },
    "supplementPolicy": {
      "type": "string",
      "enum": ["allowed_with_approval", "allowed_by_admin", "forbidden"],
      "description": "任务关闭后的补报策略",
      "default": "allowed_with_approval"
    }
  }
}
```

**GlobalConfigRegistry** — 全局配置项同样用 JSON Schema 自描述，Agent 动态读取。

**效果**：

| 操作 | 不用 Registry | 用 Registry |
|------|-------------|-------------|
| 新增节点类型 | 改 Agent prompt + 改前端 | 只写一个 Descriptor 类 |
| 修改节点属性 | 改 Agent prompt + 改前端表单 | 只改 configSchema |
| Agent 知识 | 硬编码，可能过时 | 实时读 Registry，永远准确 |
| 前端画布 | 每种节点写死一个组件 | 根据 JSON Schema 动态生成表单 |

**API**：`GET /api/workflow/node-schemas` — Agent 和前端画布共用此接口获取所有可用节点及其属性 Schema。

#### 专用知识库

**不新建独立的知识库系统**，复用现有的 `food_kb` + pgvector 检索管线，新增 `workflow_config` 分类。

已有基础设施（直接复用）：
- `food_kb/services/document_ingester.py` — 文档解析 → 分块 → embedding → pgvector 入库
- `food_kb/services/knowledge_retriever.py` — Vector + BM25 + RRF 混合检索 + Reranker
- `food_knowledge_documents` 表 — pgvector + HNSW 索引
- DashScope text-embedding-v3 — 768 维 embedding

**知识分类**：

```
food_knowledge_documents 表（已有，复用）
  ├── category = "workflow_config"          ← 新增
  │     ├── subcategory = "published_config"  — 已发布的工作流配置（发布时自动入库）
  │     ├── subcategory = "industry_process"  — 行业工序知识（手动/批量入库）
  │     ├── subcategory = "best_practice"     — 最佳实践（运营团队沉淀）
  │     └── subcategory = "regulation"        — 法规要求（交叉引用已有 regulation）
  │
  ├── category = "process" (已有)             ← 工艺知识可交叉引用
  ├── category = "regulation" (已有)          ← 法规知识可交叉引用
  └── ...
```

**关于 `food_knowledge_documents` 表命名**：该表名源于最初的食品安全知识库用途。现在复用于工作流配置知识，通过 `category` 字段完全隔离。重命名该表影响面太大（涉及 Python ingester、retriever、Java embedding service 等），因此保持现有表名，通过注释和代码文档明确其"通用知识库"定位。

**知识入库时机**：

| 来源 | 触发方式 | subcategory |
|------|----------|-------------|
| 发布工作流配置 | 自动：发布时 hook 触发 DocumentIngester | published_config |
| 行业工序文档 | 手动：平台管理员通过管理界面上传 | industry_process |
| 优秀配置标记 | 手动：运营团队标记并沉淀 | best_practice |

**冷启动策略**：

在系统早期（发布工厂数 < 5）时，Agent 缺少历史配置可参考。为此手动预置 5-10 个种子模板到知识库：

| 种子模板 | 行业 | subcategory |
|----------|------|-------------|
| 卤制品长周期加工 | 肉类加工 | industry_process |
| 烘焙日产标准流程 | 烘焙 | industry_process |
| 冷冻食品批次生产 | 冷链食品 | industry_process |
| 中央厨房配送流程 | 团餐 | industry_process |
| 酱料调味品连续生产 | 调味品 | industry_process |

种子数据包含：行业特征描述、典型工序列表、推荐报工方式、常见审批流程、计量单位体系等。
通过 `DocumentIngester` 的批量导入接口入库，格式为结构化 Markdown。

**Agent 检索流程**：

```
用户输入 → Query Rewriter（已有）
  → Vector Search (pgvector, category IN ("workflow_config", "process"))
  → BM25 Search
  → RRF Fusion + Reranker（已有）
  → 返回相关的历史配置、行业知识、最佳实践
  → Agent 参考检索结果生成/修改工作流
```

#### 学习机制与安全策略

**学习范围策略：默认租户隔离，显式授权后才允许跨厂复用**

```
工厂 A 配置发布 ──→ 自动入库（A 厂专属，仅 A 厂 Agent 可检索）
工厂 B 配置发布 ──→ 自动入库（B 厂专属，仅 B 厂 Agent 可检索）
                        ↓
              平台管理员显式操作：
              "标记为可共享" + 系统自动脱敏
                        ↓
              脱敏后进入跨厂模板池 ──→ Agent 分析模式 ──→ 预设模板库
                                                         · 标准批次生产模板
                                                         · 多工序长周期模板
                                                         · ...
```

**租户隔离与授权规则**：

| 规则 | 说明 |
|------|------|
| **默认隔离** | 发布时自动入库到 `food_knowledge_documents`，带 `factory_id` 标记；Agent 检索默认只查本厂 + 已授权跨厂数据 |
| **跨厂共享三条件** | 必须同时满足：(1) 已发布状态 (2) 平台管理员显式标记"可共享" (3) 系统自动脱敏完成 |
| **自动脱敏字段** | 客户名称、内部角色名称、具体数量参数、工艺细节参数 → 替换为通用化描述 |
| **保留字段** | 行业类型、工序类别、流程结构、报工方式、审批模式 → 保留用于模式匹配 |
| **模板人工审核** | Agent 自动生成的模板默认 `review_status = 'pending_review'`，需平台管理员确认后才进入可选模板库 |
| **模板失效/回滚** | 支持将已发布模板标记为"已失效"，Agent 不再推荐；支持恢复历史版本 |
| **质量阈值** | 模板至少基于 3 个真实配置才允许提交审核（`source_count >= 3`） |

**预设模板不是开发者手写的，是 Agent 从脱敏后的真实配置中自动生成的**。随着配置的工厂越多，模板库越丰富，配置新工厂越快。

**技术实现**：

```
后端：
  WorkflowConfigAgent (新建)
  ├── collectConfigInfo(sessionId, userMessage)  — 追问收集 + 进度追踪
  ├── generateWorkflow(userDescription)          — 根据描述生成工作流
  ├── modifyWorkflow(currentConfig, instruction) — 修改现有工作流
  ├── suggestTemplate(factoryDescription)        — 推荐匹配模板
  ├── analyzeAndIndex(workflowConfig)            — 发布时触发，按租户隔离入库
  ├── sanitizeForSharing(workflowConfig)         — 脱敏处理（去客户名/角色/参数）
  └── extractTemplates()                         — 定期从已授权配置中提取/更新模板

  WorkflowNodeRegistry (阶段 2 实现)
  ├── getAllNodeSchemas()           — 返回所有节点 Schema（Agent + 画布共用）
  └── getNodesByCategory(category) — 按分类过滤

  GlobalConfigRegistry (阶段 2 实现)
  └── getGlobalConfigSchema()      — 返回全局配置 JSON Schema

存储（复用 food_knowledge_documents + 新增模板表）：
  food_knowledge_documents (已有)
  └── category = "workflow_config"  — 配置知识
        └── factory_id 字段用于租户隔离检索
        └── is_shared BOOLEAN — 是否已授权跨厂检索

  workflow_templates (新表，Agent 自动维护)
  ├── id
  ├── template_name          — 模板名称（AI 命名）
  ├── description            — 模板描述（AI 生成）
  ├── industry_tags          — 适用行业
  ├── workflow_json           — StateMachine 配置（已脱敏）
  ├── node_configs_json      — 节点属性配置（已脱敏）
  ├── global_config_json     — 全局配置（已脱敏）
  ├── source_count           — 基于多少个真实配置抽象（>= 3 才可提审）
  ├── review_status          — pending_review / approved / rejected / deprecated
  ├── reviewed_by            — 审核人
  ├── reviewed_at            — 审核时间
  ├── is_published           — 是否已发布到模板库
  └── created_at / updated_at
```

**Agent 对话示例（随学习进化）**：

初期（只有 2-3 个工厂配置时）：
```
👤 "我们是做烘焙的，每天做面包蛋糕"
🤖 "目前没有烘焙行业的模板，我来根据您的描述从零生成配置。
    请问您的生产是以批次为主还是工序为主？"
```

中期（10+ 个工厂配置后）：
```
👤 "我们是做烘焙的，每天做面包蛋糕"
🤖 "检测到与'烘焙行业标准流程'模板匹配度 87%。
    该模板特点：批次导向、按品类排产、每批一次性报工。
    已加载到画布，请确认或调整。"
```

后期（50+ 个工厂配置后）：
```
👤 "我们是做烘焙的"
🤖 "找到 3 个烘焙相关模板：
    1. 面包房日产模板（匹配度 91%）— 适合日产型小批量
    2. 中央厨房烘焙模板（匹配度 78%）— 适合大批量标准化
    3. 定制蛋糕模板（匹配度 65%）— 适合订单驱动
    请选择或描述更多细节。"
```

#### Vue 端设计器技术选型

| 组件 | 方案 | 说明 |
|------|------|------|
| 画布 | Vue Flow (vue-flow.dev) | 基于 Vue 3 的流程图编辑器，支持节点/连线/拖拽 |
| 节点库 | 从 `/api/workflow/node-schemas` 动态加载 | 新增节点类型无需改前端代码 |
| 节点渲染 | 通用 WorkflowNode 组件 | 根据 nodeType 渲染不同图标和标题 |
| 属性面板 | JSON Schema 动态表单 | 根据选中节点的 configSchema 自动生成表单 |
| 全局配置 | JSON Schema 动态表单 | 根据 GlobalConfigRegistry 返回的 Schema 生成 |
| AI 对话面板 | 自建 Chat 组件 + 进度指示器 | 复用 AiEntryDrawer 模式，增加追问进度条 |
| 模板选择器 | Element Plus Dialog + Cards | 显示 Agent 推荐的模板（含匹配度） |

---

## 十、AI 意图系统集成（有选择的）

### 集成原则

**不是所有操作都需要 AI。** 简单操作（扫码签到、填量报工）直接 UI 交互更高效。
AI 集成分为两个独立 Agent：

| Agent | 职责 | 运行端 | 用户 |
|-------|------|--------|------|
| **Factory Config Agent** | 工厂流程配置（见第九节） | Vue Web-admin | 平台管理员 |
| **Production Intent Agent** | 日常生产操作的 AI 辅助 | RN App + Vue | 调度员/车间主任 |

### Production Intent Agent — 日常操作 AI 辅助

需要 AI 集成的场景：

| 场景 | 集成方式 | 优先级 |
|------|----------|--------|
| 工序任务创建 | AI 对话创建任务（"帮我排明天墨鱼圈的卤制，计划200框"） | P1 |
| 进度分析 | "当前所有工序的完成率是多少？" → 调用汇总 API | P1 |
| 异常预警 | "哪些任务可能延期？" → 基于 expectedEndDate + completedQuantity 分析 | P2 |
| 排产建议 | "下周的产能如何分配？" → 基于历史数据推荐 | P3 |

不需要 AI 集成的场景：

| 场景 | 理由 |
|------|------|
| 扫码签到/签退 | 现场操作，扫码比说话快 |
| 填量报工 | 简单表单，2步完成 |
| 标记任务完成 | 一键操作 |

### Tool-Skill 架构扩展

PROCESS 模式需要新增的 AI Tools：

```java
// ProcessTaskQueryTool — 查询工序任务
// ProcessTaskCreateTool — AI 创建工序任务
// ProcessTaskSummaryTool — 工序进度汇总
// ProcessTaskAnalysisTool — 进度分析和预警
```

这些 Tool 通过现有的 `ToolRegistry` 注册，意图识别系统自动路由。

**工作流感知**：当工厂是 PROCESS 模式时，Tool 过滤器自动排除 BATCH-only 的 Tools（如 BatchCreateTool），优先推荐 PROCESS 相关的 Tools。

---

## 十一、与已有配置体系的关系

```
Factory
  ├── factoryType: FACTORY / RESTAURANT / ...       → 决定看哪些业务模块
  │
  ├── FactoryFeatureConfig (表)                      → 决定功能开关 + 模式配置
  │     └── module_id='production'
  │           └── config.mode = PROCESS / BATCH      → 阶段1: 粗粒度模式切换
  │
  ├── StateMachine (表)
  │     └── entity_type='PRODUCTION_WORKFLOW'         → 阶段2/3: 精确工作流定义
  │           ├── states_json                         → 流程状态
  │           └── transitions_json                    → 转换规则 + SpEL 守卫
  │
  ├── WorkflowNodeRegistry                           → 阶段2: 节点 Schema 自动发现
  │     ├── WorkflowNodeDescriptor × N               → 每种节点自描述（类型/属性/连线规则）
  │     └── GlobalConfigRegistry                     → 全局配置 Schema
  │
  ├── 可视化流程设计器 (Vue Flow)                     → 阶段3a: 拖拽画布 + JSON Schema 动态表单
  │     └── 草稿策略：数据库 is_draft / 本地 localStorage（用户自选）
  │
  └── Factory Config Agent                           → 阶段3b: 专用配置 AI
        ├── 追问机制（topicsCovered/topicsRemaining） → 分步收集配置信息
        ├── food_knowledge_documents (复用)           → 配置知识库（workflow_config 分类，含冷启动种子数据）
        └── workflow_templates                        → 预设模板库（AI 自动生成）
```

演进关系：
- **阶段 1**：`FactoryFeatureConfig.config.mode` 做粗粒度切换，前端 if/else
- **阶段 2**：`StateMachine`（draft/published/archived 版本治理 + SpEL 白名单 guard 函数）定义工作流 + `WorkflowNodeRegistry` 节点自描述。复用现有 `evaluateGuard()` + Drools action + `DecisionAuditService`。前端读配置动态渲染。FeatureConfig 保留作为功能开关
- **阶段 3a**：可视化流程设计器（Vue Flow 画布 + JSON Schema 属性面板 + 草稿保存选项）
- **阶段 3b**：Factory Config Agent（追问机制 + 知识库 + 学习 + 模板自动生成）。阶段 1 if/else 代码清除

---

## 十二、统一权限矩阵

**原则**：前端只控制按钮/菜单可见性，后端 RBAC + workflow guard 才是最终裁决，所有敏感操作记审计日志。

| 操作 | platform_admin | factory_admin | workshop_supervisor | 调度员 (dispatcher) | 操作员 (worker) |
|------|:-:|:-:|:-:|:-:|:-:|
| **配置类** | | | | | |
| 创建/编辑工厂生产流程 | W | - | - | - | - |
| 发布/回滚工作流版本 | W | - | - | - | - |
| 管理工序主数据 | W | W | - | - | - |
| 管理产品-工序关联 | W | W | R | - | - |
| 标记配置"可共享" | W | - | - | - | - |
| 审核 AI 生成的模板 | W | - | - | - | - |
| **生产管理类** | | | | | |
| 创建工序任务 | - | W | W | W | - |
| 查看工序任务列表 | R | R | R | R | R |
| 关闭未完成任务 | - | W | W | - | - |
| 标记任务完成 | - | W | W | W | - |
| **报工类** | | | | | |
| 提交报工 | - | W(自动审批) | W | W | W |
| 审批报工 | - | W | W | - | - |
| 发起补报（进入 SUPPLEMENTING） | - | W | W | - | - |
| 审批补报 | - | W | W | - | - |
| 提交冲销记录 | - | W | - | - | - |
| **AI 相关** | | | | | |
| 使用 Factory Config Agent | W | - | - | - | - |
| 使用 Production Intent Agent | - | R | R | R | - |

`W` = 可写/操作, `R` = 只读, `-` = 不可见

**审计日志要求**：以下操作必须记录操作人、时间、操作内容、变更前后值：
发布/回滚工作流、审批/驳回报工、发起/完成补报、关闭任务、冲销记录、标记配置可共享、审核模板

---

## 十三、迁移与兼容策略

### 阶段 1 → 阶段 2 迁移

| 项目 | 策略 | 说明 |
|------|------|------|
| **历史 ProcessTask** | 不 backfill `workflowVersionId` | 阶段1创建的任务 `workflowVersionId = null`，代码兼容处理 |
| **新任务** | 强制绑定版本 | 阶段2起新建的 ProcessTask 必须绑定当前 published 的工作流版本 |
| **进行中任务** | 不跨版本切换 | 发布新版本时，IN_PROGRESS/SUPPLEMENTING 状态的任务继续按旧版本规则运行 |
| **前端渲染** | 灰度切换 | 按工厂级开关控制前端读 FeatureConfig if/else 还是读 StateMachine 动态渲染 |
| **旧工厂** | 自动生成等价配置 | 阶段2验证稳定后，为阶段1的旧工厂自动生成等价的 StateMachine 配置 |
| **回退路径** | 关闭灰度开关即回退 | 如果某工厂的 StateMachine 模式出问题，关闭开关后回退到 FeatureConfig 模式 |

### 阶段 2 → 阶段 3a/3b 迁移

| 项目 | 策略 | 说明 |
|------|------|------|
| **阶段1 代码** | 阶段3b 完成后清除 | 阶段2/3并行运行期间保留阶段1的 if/else 代码作为 fallback |
| **StateMachine 数据** | 直接复用 | 可视化设计器读写的就是 StateMachine 表，无需迁移 |
| **工作流版本** | 向前兼容 | 旧版本缺少新 DSL token 时，设计器高亮提示但不阻断查看 |

### 数据安全红线

| 红线 | 说明 |
|------|------|
| 零数据丢失 | 所有迁移操作不删除历史数据，只新增字段和记录 |
| 零停机 | nullable 新字段 + 代码兼容处理，不需要停机迁移 |
| 可回退 | 每个阶段都有明确的回退路径和灰度开关 |
| 进行中任务不受影响 | 版本快照机制保证运行中的任务逻辑不变 |

---

## 十四、Drools 规则引擎激活计划

### 现状诊断

后端已有完整的 Drools 8.44.0 基础设施（`RuleEngineServiceImpl`），但存在**断路问题**：

| 组件 | 状态 | 说明 |
|------|------|------|
| `RuleEngineServiceImpl` | 正常 | 支持 DB 加载、工厂级缓存、热更新、dry-run、审计 |
| `intent-validation.drl`（7条规则） | 未接入 | 在 classpath `resources/rules/` 下，但引擎只从 `drools_rules` 表加载 |
| `field-validation.drl` | 未接入 | 同上 |
| `data-operation-validation.drl` | 未接入 | 同上 |
| `IntentExecutorServiceImpl.validateWithDrools()` | 空转 | 调用 `intentValidation` 规则组，但数据库无对应规则，每次返回"无可用规则" |
| `StateMachineServiceImpl` 的 `action:*` | 空转 | 转换后触发 Drools action，但数据库无对应 DRL |

### 修复计划（阶段 0 — 与生产流程同步进行）

#### 步骤 1：接入现有 DRL（修复断路）

编写数据库迁移脚本，将 3 个静态 DRL 文件的内容插入 `drools_rules` 表：

```sql
-- 将 classpath DRL 同步到数据库，使 RuleEngineService 能加载
INSERT INTO drools_rules (factory_id, rule_group, rule_name, rule_content, enabled, priority)
VALUES
  ('SYSTEM', 'intentValidation', 'intent_validation_rules', '<intent-validation.drl 内容>', true, 100),
  ('SYSTEM', 'fieldValidation', 'field_validation_rules', '<field-validation.drl 内容>', true, 90),
  ('SYSTEM', 'dataOperationValidation', 'data_operation_rules', '<data-operation-validation.drl 内容>', true, 80);
```

同时修改 `RuleEngineServiceImpl.loadRulesFromDatabase()` 使其在工厂级规则为空时自动 fallback 到 `factory_id='SYSTEM'` 的全局规则。

#### 步骤 2：为生产工作流新增 Drools 规则组

| 规则组 | 触发时机 | 示例规则 |
|--------|----------|----------|
| `action:enter_supplementing` | 补报发起时 | 记录 previousTerminalStatus、校验补报窗口期 |
| `action:exit_supplementing` | 补报完成时 | 恢复原终态、校验无 PENDING 补报 |
| `action:update_completed_qty` | 审批通过时 | 更新 completedQuantity、检查达标 |
| `onTransition:PRODUCTION_WORKFLOW` | 任何生产状态转换 | 审计日志（`DecisionAuditService` 自动记录） |
| `production_validation` | 报工提交前 | 非工作时间限制、频率限制、数量合理性校验 |

#### 步骤 3：长期 — 客户自维护规则

| 能力 | 实现方式 | 说明 |
|------|----------|------|
| 品控经理调质检标准 | Excel 决策表上传 → `generateDRLFromDecisionTable()` → 热加载 | 已有 API 和基础设施 |
| 工厂级报工规则定制 | 每个工厂 `drools_rules` 表独立记录，`factoryContainers` 隔离缓存 | 已有缓存机制 |
| 规则变更免重启 | `reloadRules(factoryId)` 热更新 | 已有 |
| 规则测试 | `executeDryRun()` 沙箱模式 | 已有 |
| 规则变更审计 | `executeRulesWithAudit()` + `DecisionAuditService` | 已有 |

### StateMachine 与 Drools 的协作关系

```
StateMachine（状态机）              Drools（规则引擎）
管"什么时候能转、谁能转"            管"转了以后做什么复杂判断"
    │                                    │
    │  guard: SpEL 白名单函数            │  action: DRL 规则组
    │  #hasPermission(...)               │  rule "达标后质检判定"
    │  #isCompletedGtePlanned(...)       │    when $task(defectRate > 0.05)
    │                                    │    then setRequiresInspection(true)
    │                                    │
    └──── 转换成功 ──────────────────────→│  ruleEngineService.executeRules(
                                         │      "action:" + actionName, entity)
```

两者不冲突：StateMachine 是交通灯（能不能走），Drools 是走了以后的路由决策（走了怎么办）。
可视化设计器产出 StateMachine JSON + Drools 规则组名，一起版本管理。

---

## 十五、技术债务 — Spring Boot 升级

### 现状

| 组件 | 当前版本 | 状态 |
|------|----------|------|
| Java | 17 | 正常（LTS，支持到 2029） |
| Spring Boot | 2.7.15 | **EOL**（2023-11 停止维护，无安全补丁） |
| Drools | 8.44.0 | 正常（已兼容 Jakarta） |

### 升级目标

Spring Boot 2.7.15 → **3.3.x**（当前活跃 LTS）

### 主要变更点

| 变更 | 范围 | 工作量估算 |
|------|------|-----------|
| `javax.*` → `jakarta.*` | 所有 Entity、Controller、Validation 注解 | 全局替换，中等 |
| Spring Security 重构 | `WebSecurityConfigurerAdapter` 废弃，改链式配置 | auth 相关代码 |
| Hibernate 5 → 6 | 部分 HQL/JPQL 语法、ID 生成策略变化 | Repository 层 |
| 配置属性重命名 | `application.properties` 部分 key 变化 | 小 |
| Drools 8.44 兼容性验证 | 理论已支持 Jakarta，需集成测试确认 | 小 |
| 第三方依赖兼容 | 检查所有 Maven 依赖是否有 Jakarta 兼容版本 | 中等 |

### 时机建议

在生产工作流**阶段 1 交付稳定后**，作为独立技术债务任务执行。不与业务功能开发并行，避免两线作战。预估 1-2 周（含全量回归测试）。

### 技术栈评估结论

| 问题 | 结论 |
|------|------|
| Java 要不要换成其他语言 | **不换**。310+ AI Tools、Drools、StateMachine + SpEL、DecisionAudit 都是 Java/Spring 生态核心优势 |
| Python 服务要不要合并到 Java | **不合并**。AI/ML 计算留在 Python FastAPI，Java 做业务骨架，分工正确 |
| Spring Boot 要不要升级 | **要**。2.7 已 EOL 无安全补丁，升到 3.3.x |
| Java 17 要不要升到 21 | **暂不需要**。17 是 LTS 支持到 2029，21 的新特性（虚拟线程等）当前业务不急需 |

---

## 十六、暂不涉及

- ORDER 模式实现 → 仅在 FeatureConfig 中预留
- 视觉识别/异物检测 → 独立需求
- AI 排产优化 → 后续迭代
- 多工厂/总部汇总 → 后续迭代

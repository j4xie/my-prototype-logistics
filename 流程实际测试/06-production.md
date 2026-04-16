# 06. 段 4 — 生产计划 + 报工 + 审批入库

**会议来源**: `研发样品至财务回款全流程文档.md` §4.1-4.3
**涉及角色**: production (计划) / operator (报工) / foreman/admin (审批)
**耗时**: 15 min

---

## 6.1 流程总览

```
SO 审核通过 (已有原料)
    ↓
⚠️ 会议说"自动生成生产任务单", 实际是手动
production 手动创建生产计划 (sourceType=CUSTOMER_ORDER, 关联 SO)
    ↓ status=DRAFT / PLANNED
    ↓ 点 "下达生产"
status=IN_PROGRESS
    ↓
⚠️ 会议说"扫码/录入生产领料", 实际 UI 未实现 (后端 API 有)
(跳过领料步骤, 直接到报工)
    ↓
operator 报工 (录入完工数量)
    ↓ status=PENDING_APPROVAL
foreman/admin 审批通过
    ↓ status=COMPLETED
    ↓ 后端自动成品入库
    ↓ SO 状态可流转 (如果全量完工)
```

---

## 6.2 创建生产计划 (关联 SO)

### 前置
- **账号**: `production / 123456`
- **URL**: `/production/plans/list`
- **前置**: 04 SO 已 `FINANCE_APPROVED`, 05 采购入库 (原料足)

### 步骤
1. 切 `production`
2. 侧边栏 "**生产管理**" → "**生产计划**"
3. 点 "**新建计划**"
4. 对话框弹出

### 字段
| 字段 | 组件 | 必填 | 示例值 |
|------|------|------|-------|
| 产品 productTypeId | el-select | ✅ | 选 04 SO 里的产品 |
| 计划数量 plannedQuantity | el-input-number | ✅ | `100` (=SO 数量) |
| 计划日期 plannedDate | el-date-picker | ✅ | 选今天 |
| 主管 assignedSupervisorId | el-select (员工列表) | ⚪ | 选 `foreman` |
| **来源类型 sourceType** | el-select | ✅ | `CUSTOMER_ORDER` (关键!) |
| **关联销售订单 sourceOrderId** | el-select (仅 sourceType=CUSTOMER_ORDER 显示) | ⚪ | **选 04 SO ID** |
| 行项目 items | 动态 (自动预填) | - | 从 SO 拉取 |

### sourceType 选项
| 值 | 说明 | 关联 SO? |
|----|------|---------|
| MANUAL | 手动计划 | 不关联 |
| **CUSTOMER_ORDER** | 客户订单驱动 | ✅ 关联 SO |
| AI_FORECAST | AI 预测驱动 | 不关联 |

### 操作
1. 选 **产品** (与 SO 一致)
2. 填 **数量** `100`
3. 选 **计划日期** 今天
4. 选 **主管** `foreman`
5. ⭐ **来源类型** 选 `CUSTOMER_ORDER`
6. ⭐ **关联 SO** 下拉选 04 的 SO (这里应自动出现可选项)
7. 点 "**保存**"

### ✅ PASS
- Toast "**创建成功**"
- 列表新增计划, 状态 `DRAFT` 或 `PLANNED`
- **关联 SO**: 点详情能看到 sourceOrderId

### ❌ FAIL
- 关联 SO 下拉空 → SO 状态不对 (需 FINANCE_APPROVED)
- 数量 > 库存原料 → 可能阻塞 (看 trigger chain 配置)

### ⚠️ 已知: 非自动触发
- 会议说 "SO 审核通过自动生成生产任务单", 实际**不会**
- Production 必须**手动来创建**并选关联
- V2 需求: 接入 TriggerChainService, FINANCE_APPROVED 事件后 auto-create 生产计划

---

## 6.3 下达生产 (DRAFT → IN_PROGRESS)

### 步骤
1. 计划列表找 6.2 创建的 DRAFT
2. 点 "**下达生产**" 或 "**开始生产**"

### ✅ PASS
- 状态变 `IN_PROGRESS`
- 可能自动生成**工序任务** (processTask)

---

## 6.4 ⚠️ 生产领料 (UI 未实现, 跳过)

### 会议需求
4.2 "生产人员通过**扫码或手动录入**的方式, 录入领料信息 (原料名称、数量、规格等), 领取生产所需原料. 系统自动扣减对应原料的库存数量."

### 实际情况
- **前端 UI 不存在**
- 后端有 API: `POST /api/mobile/F001/production/material-requisitions`
- 可用 Postman 或 curl 测试, UI 层跳过

### 影响
- 库存**不会实时扣减** (报工时后端自动扣)
- 客户看不到领料单, 只看到报工和入库

### V2 必做
- `/production/material-requisitions` 页面: 列表 + 新建 + 扫码/手动录入
- 关联生产计划 + 选择原料批次 (FIFO)

---

## 6.5 操作员报工

### 前置
- **账号**: `operator / 123456` 或 `foreman`
- **URL**: 生产任务页面 `/production/plans/{id}` 或计划详情

### 步骤
1. 切 `operator` 账号
2. 侧边栏 "**生产管理**" → "**工序任务**" / "**报工**"
3. 找 6.3 关联的任务 (来自 IN_PROGRESS 计划)
4. 点 "**报工**" 按钮

### 字段
| 字段 | 组件 | 必填 | 示例值 |
|------|------|------|-------|
| 报工人 reporterId | el-input / 自动 | - | 自动填当前用户 |
| 报工日期 reportDate | el-date-picker | ✅ | 今天 |
| **完工数量 outputQuantity** | el-input-number | ✅ (>0) | `100` (=计划数) |
| 良品数量 qualifiedQuantity | el-input-number | ⚪ | `98` (可低于完工) |
| 次品数量 defectiveQuantity | el-input-number | ⚪ | `2` |
| 工时 laborMinutes | el-input-number | ⚪ | `240` (分钟) |
| 备注 notes | el-input textarea | ⚪ | `正常完工` |

### 操作
1. 填 **完工数量** `100`
2. (可选) 填良品/次品/工时
3. 点 "**提交**"

### ✅ PASS
- Toast "**报工成功**"
- 报工记录状态 `PENDING_APPROVAL`

### Network
- `POST /api/mobile/F001/production/reports` 200

---

## 6.6 报工审批 (foreman/admin)

### 前置
- **账号**: `foreman / 123456` 或 `admin`
- **URL**: `/production/approval`

### 步骤
1. 切 `foreman` 或 `admin`
2. 侧边栏 "**生产管理**" → "**报工审批**"
3. 找 6.5 报的记录 (status=PENDING_APPROVAL)
4. 点 "**审批通过**" 按钮 (或 "**驳回**")

### 路径 A: 审批通过
1. 点 "**审批通过**"
2. (可选) 输意见
3. 点 "**确定**"

### ✅ PASS ⭐
- Toast "**审批通过**"
- 报工状态变 `APPROVED`
- 生产计划状态变 `COMPLETED` (如果全量完工)
- **后端自动**:
  - 成品库存 +100 (outputQuantity)
  - 原料库存 -N (按 BOM 扣减)
  - 生成成品批次 (FinishedGoodsBatch)

### 路径 B: 驳回
1. 点 "**驳回**"
2. 输驳回原因 (必填)
3. 点 "**确定**"

### ✅ PASS
- 状态变 `REJECTED`
- operator 可重新报工

### Network
- `POST /api/mobile/F001/production/reports/{id}/approve` 200
- 或 `.../reject` 200

---

## 6.7 验证成品入库

### 步骤
1. 切 warehouse 或 admin
2. 进 `/sales/finished-goods` 或 `/warehouse/materials`
3. 找对应产品

### ✅ PASS
- 成品库存 +100
- 新批次生成 (BATCH-YYYYMMDD-XXXX), 状态 ACTIVE
- 批次关联: 生产计划 ID, 审批时间

---

## 6.8 工序任务 (深度, 可选)

### 背景
生产计划下达后, 可能触发**工序链** (processTask), 如:
- 工序 1: 原料清洗
- 工序 2: 熬制
- 工序 3: 灌装
- 工序 4: 包装

### 步骤 (若有工序)
1. `/production/processes` 或计划详情 Tab "工序任务"
2. 逐个工序 "开始" → "完成"
3. operator 账号可操作

---

## 6.9 RN APK 端的工序报工 (跨平台验证)

### 前置
- APK `CretasFoodTrace-六扇门V1-prod-v1.0.1.apk` 已安装
- operator 账号登录

### 步骤
1. 打开 APK
2. 登录 `operator / 123456`
3. 底部 tab "**员工**" 或 "**工序**"
4. 进入工序扫码页 (EmployeeProcessSegmentScreen)
5. 扫码 (或手动输入工序 ID)
6. 录入完工数量
7. 点 "**提交**"

### ✅ PASS
- Toast 成功
- 后端记录与 Web 端一致

---

## 6.10 本节 Checklist (12 项)

| # | 项目 | 账号 | 勾选 |
|---|------|------|------|
| 1 | 6.2 生产计划创建 toast | production | ☐ |
| 2 | 6.2 sourceType=CUSTOMER_ORDER 可选 | production | ☐ |
| 3 | 6.2 关联 SO 下拉有选项 | production | ☐ ⭐ |
| 4 | 6.3 DRAFT → IN_PROGRESS | production | ☐ |
| 5 | 6.5 报工 toast 成功 | operator | ☐ |
| 6 | 6.5 完工数量必填校验 | operator | ☐ |
| 7 | 6.6 路径 A: 审批通过 | foreman/admin | ☐ ⭐ |
| 8 | 6.6 路径 B: 驳回 + 原因 | foreman/admin | ☐ (可选) |
| 9 | 6.7 成品库存自动增加 | warehouse | ☐ ⭐ |
| 10 | 6.7 成品批次生成 | warehouse | ☐ |
| 11 | 6.9 RN APK operator 报工 | APK operator | ☐ (可选) |
| 12 | 6.10 SO 状态自动更新 | - | ☐ |

⭐ = 核心

---

## 6.11 已知限制

| 项 | 影响 | V2 补救 |
|---|------|---------|
| SO 审核不自动触发生产 | 需手动创建 | TriggerChain 接入 |
| 生产领料无 UI | 扣库存在报工时批量 | 补领料页面 + 扫码 |
| 工序链配置简单 | 复杂流程难配置 | Canvas V3 支持 |

---

## 6.12 下一步

段 4 完成 (成品入库). 下一步:
- 段 5 [07-shipment.md](07-shipment.md) 成品出库

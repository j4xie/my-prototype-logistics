# Phase 3 Integration Testing Plan

**创建日期**: 2025-11-21
**测试目标**: 端到端业务流程测试
**测试策略**: 基于真实业务场景的集成测试

---

## 🎯 Phase 3 目标

**核心目标**: 验证关键业务流程的完整性，而非单个API的可用性

**与Phase 2的区别**:
- **Phase 2**: 测试单个API端点（58个独立测试）
- **Phase 3**: 测试完整业务流程（跨多个API的端到端测试）

**优先级**:
- ✅ 验证核心业务流程
- ✅ 发现Phase 2单元测试无法发现的集成问题
- ✅ 确定哪些Phase 2问题真正影响业务
- ✅ 优先修复阻塞业务的问题

---

## 📊 测试范围

### 测试流程 (5个核心业务流程)

| 流程ID | 流程名称 | 涉及模块 | 优先级 | 预计耗时 |
|--------|---------|---------|--------|----------|
| **E2E-1** | 原料入库到加工生产流程 | Material → Processing | 🔴 P0 | 30分钟 |
| **E2E-2** | 设备报警到维修处理流程 | Equipment → Alerts | 🔴 P0 | 20分钟 |
| **E2E-3** | 质检不合格处理流程 | Quality → Processing | 🟡 P1 | 20分钟 |
| **E2E-4** | 生产批次完整生命周期 | Processing → Quality → Cost | 🔴 P0 | 40分钟 |
| **E2E-5** | Dashboard数据聚合流程 | All Modules → Dashboard | 🟡 P1 | 20分钟 |

**总计**: 5个流程，预计2-2.5小时

---

## 🔄 E2E-1: 原料入库到加工生产流程 (P0 - 核心)

### 业务场景
**用户故事**: 作为生产管理员，我需要从原料入库开始，到启动加工批次，完整追踪原料使用

### 测试步骤

```bash
# Step 1: 创建原料批次入库
POST /api/mobile/{factoryId}/material-batches
{
  "materialTypeId": "MT001",
  "batchNumber": "MAT-E2E-001",
  "quantity": 500,
  "supplier": "测试供应商",
  "expiryDate": "2026-01-01"
}
✅ 预期: 返回批次ID，状态为 'received'

# Step 2: 原料质检
POST /api/mobile/{factoryId}/material-batches/{batchId}/inspect
{
  "inspectorId": 18,
  "result": "pass",
  "notes": "E2E测试质检"
}
✅ 预期: 批次状态变为 'inspected'，存储位置更新

# Step 3: 创建加工批次（使用该原料）
POST /api/mobile/{factoryId}/processing/batches
{
  "productTypeId": "TEST_PROD_001",
  "batchNumber": "PROC-E2E-001",
  "plannedQuantity": 100,
  "supervisorId": 1
}
✅ 预期: 返回加工批次ID

# Step 4: 记录原料消耗
POST /api/mobile/{factoryId}/processing/batches/{processingBatchId}/material-consumption
{
  "materialBatchId": "{materialBatchId}",
  "quantityUsed": 100,
  "notes": "E2E测试消耗"
}
✅ 预期: 原料批次quantity减少，加工批次关联原料记录

# Step 5: 验证原料库存更新
GET /api/mobile/{factoryId}/material-batches/{batchId}
✅ 预期: quantity = 400 (500 - 100)

# Step 6: 验证加工批次原料关联
GET /api/mobile/{factoryId}/processing/batches/{processingBatchId}
✅ 预期: 返回的批次详情包含原料消耗记录
```

### 成功标准
- ✅ 原料从入库到消耗的完整数据流
- ✅ 库存数量正确更新
- ✅ 加工批次正确关联原料
- ✅ 所有状态变更正确记录

### 失败处理
- ❌ 如果Step 2-4任何步骤失败，记录为**阻塞性问题**
- 🟡 如果Step 5-6数据不一致，记录为**数据完整性问题**

---

## 🚨 E2E-2: 设备报警到维修处理流程 (P0 - 核心)

### 业务场景
**用户故事**: 作为设备管理员，当设备报警时，我需要查看详情、派单维修、记录处理结果

### 测试步骤

```bash
# Step 1: 创建设备告警
POST /api/mobile/{factoryId}/equipment-alerts
{
  "equipmentId": 1,
  "level": "warning",
  "title": "E2E测试告警",
  "description": "设备温度过高",
  "alertTime": "2025-11-21T10:00:00"
}
✅ 预期: 返回告警ID，状态为 'pending'

# Step 2: 查询未处理告警列表
GET /api/mobile/{factoryId}/equipment-alerts?status=pending
✅ 预期: 列表包含刚创建的告警

# Step 3: 查看告警详情
GET /api/mobile/{factoryId}/equipment-alerts/{alertId}
✅ 预期: 返回完整告警信息

# Step 4: 处理告警（派单维修）
PUT /api/mobile/{factoryId}/equipment-alerts/{alertId}/handle
{
  "handlerId": 18,
  "handleResult": "已派单维修",
  "handleMethod": "更换温控器"
}
✅ 预期: 告警状态变为 'resolved'，记录处理人和处理时间

# Step 5: 验证告警状态更新
GET /api/mobile/{factoryId}/equipment-alerts/{alertId}
✅ 预期: status = 'resolved', handler_id = 18

# Step 6: 验证设备维护记录
GET /api/mobile/{factoryId}/equipment/{equipmentId}
✅ 预期: 设备详情包含最新维护记录
```

### 成功标准
- ✅ 告警从创建到处理的完整流程
- ✅ 告警状态正确变更
- ✅ 处理记录正确保存
- ✅ 设备维护历史更新

### 失败处理
- ❌ 如果Step 1-4任何步骤失败，记录为**阻塞性问题**
- 🟡 如果Step 5-6数据不一致，记录为**数据完整性问题**

---

## 🔬 E2E-3: 质检不合格处理流程 (P1 - 重要)

### 业务场景
**用户故事**: 作为质检员，发现生产批次不合格时，需要记录问题并触发返工流程

### 测试步骤

```bash
# Step 1: 查询进行中的加工批次
GET /api/mobile/{factoryId}/processing/batches?status=in_progress
✅ 预期: 返回至少1个进行中的批次

# Step 2: 创建质检记录（不合格）
POST /api/mobile/{factoryId}/quality/inspections
{
  "batchId": "{processingBatchId}",
  "inspectorId": 18,
  "inspectionType": "in_process",
  "overallResult": "fail",
  "failCount": 20,
  "passCount": 80,
  "sampleSize": 100,
  "inspectionDate": "2025-11-21",
  "qualityScore": 0.80
}
✅ 预期: 返回质检记录ID

# Step 3: 验证批次状态是否触发异常标记
GET /api/mobile/{factoryId}/processing/batches/{batchId}
✅ 预期: 批次有质检不合格标记或状态变更

# Step 4: 查询批次的质检历史
GET /api/mobile/{factoryId}/processing/quality/inspections?batchId={batchId}
✅ 预期: 包含刚创建的不合格记录

# Step 5: 记录返工处理
POST /api/mobile/{factoryId}/processing/batches/{batchId}/rework
{
  "reason": "质检不合格",
  "reworkQuantity": 20,
  "notes": "E2E测试返工"
}
✅ 预期: 批次状态更新，记录返工信息
```

### 成功标准
- ✅ 质检不合格记录成功创建
- ✅ 批次状态正确变更或标记
- ✅ 返工流程可触发

### 失败处理
- 🟡 如果质检API完全不可用（Phase 2.4 25%通过率），**跳过此流程**
- ✅ 如果其他步骤失败，记录问题但不阻塞整体测试

---

## 🏭 E2E-4: 生产批次完整生命周期 (P0 - 核心)

### 业务场景
**用户故事**: 作为生产主管，我需要管理一个批次从创建到完成的完整生命周期

### 测试步骤

```bash
# Step 1: 创建生产批次
POST /api/mobile/{factoryId}/processing/batches
{
  "productTypeId": "TEST_PROD_001",
  "batchNumber": "BATCH-E2E-LIFECYCLE",
  "plannedQuantity": 200,
  "supervisorId": 1
}
✅ 预期: 批次状态 'pending'

# Step 2: 启动批次
POST /api/mobile/{factoryId}/processing/batches/{batchId}/start
{
  "startTime": "2025-11-21T09:00:00"
}
✅ 预期: 批次状态 → 'in_progress'

# Step 3: 记录原料消耗
POST /api/mobile/{factoryId}/processing/batches/{batchId}/material-consumption
{
  "materialBatchId": "{existingMaterialId}",
  "quantityUsed": 50,
  "notes": "E2E测试消耗"
}
✅ 预期: 成功记录消耗

# Step 4: 查看批次时间线
GET /api/mobile/{factoryId}/processing/batches/{batchId}/timeline
✅ 预期: 返回创建、启动、消耗等事件

# Step 5: 完成批次
POST /api/mobile/{factoryId}/processing/batches/{batchId}/complete
{
  "actualQuantity": 195,
  "completionTime": "2025-11-21T17:00:00"
}
✅ 预期: 批次状态 → 'completed'

# Step 6: 查看成本分析
GET /api/mobile/{factoryId}/processing/batches/{batchId}/cost-analysis
✅ 预期: 返回完整成本明细（原料、人工、设备等）

# Step 7: 验证Dashboard数据更新
GET /api/mobile/{factoryId}/processing/dashboard/production
✅ 预期: 今日完成批次数+1，产出数量增加
```

### 成功标准
- ✅ 批次状态流转正确：pending → in_progress → completed
- ✅ 所有关键事件记录在时间线
- ✅ 成本分析数据完整
- ✅ Dashboard统计数据实时更新

### 失败处理
- ❌ 如果Step 1-5任何步骤失败，记录为**阻塞性问题**
- 🟡 如果Step 6-7失败，记录为**功能缺陷**但不阻塞

---

## 📊 E2E-5: Dashboard数据聚合流程 (P1 - 重要)

### 业务场景
**用户故事**: 作为管理者，我需要在Dashboard看到实时的生产、质量、设备状态汇总

### 测试步骤

```bash
# Step 1: 获取生产概览
GET /api/mobile/{factoryId}/processing/dashboard/overview
✅ 预期: 返回今日产量、批次数、质检通过率等

# Step 2: 获取生产仪表盘
GET /api/mobile/{factoryId}/processing/dashboard/production
✅ 预期: 返回生产趋势、完成率、延迟批次等

# Step 3: 获取质量仪表盘
GET /api/mobile/{factoryId}/processing/dashboard/quality
✅ 预期: 返回质检统计、不合格率、质量趋势

# Step 4: 获取设备仪表盘
GET /api/mobile/{factoryId}/processing/dashboard/equipment
✅ 预期: 返回设备状态、告警数量、维护记录

# Step 5: 获取告警仪表盘
GET /api/mobile/{factoryId}/processing/dashboard/alerts
✅ 预期: 返回未处理告警、告警级别分布

# Step 6: 验证数据一致性
- 对比 E2E-1-4 创建的数据是否反映在Dashboard
- 批次数量、质检记录、设备告警数量是否匹配
```

### 成功标准
- ✅ 所有Dashboard API可访问
- ✅ 返回的统计数据格式正确
- ✅ 数据与实际业务操作一致（延迟<5分钟可接受）

### 失败处理
- 🟡 Dashboard API失败不阻塞核心业务，记录为**功能缺陷**

---

## 🛠️ 测试执行计划

### 执行顺序（推荐）

```bash
# Phase 3.1: 核心流程测试 (1.5小时)
1. E2E-1: 原料入库到加工生产 (30分钟)
2. E2E-2: 设备报警处理 (20分钟)
3. E2E-4: 生产批次生命周期 (40分钟)

# Phase 3.2: 扩展流程测试 (0.5-1小时)
4. E2E-3: 质检不合格处理 (20分钟) - 如果Phase 2.4未修复，跳过
5. E2E-5: Dashboard数据聚合 (20分钟)

# Phase 3.3: 问题修复和回归测试 (根据发现的问题决定)
```

### 测试环境要求

```bash
# 1. 后端运行中
lsof -i :10010  # 确认后端启动

# 2. 数据库连接正常
mysql -u root cretas_db -e "SELECT COUNT(*) FROM factories"

# 3. 准备测试数据
- Factory: CRETAS_2024_001
- User: proc_admin (Token已准备)
- Material Type: MT001 (已存在)
- Product Type: TEST_PROD_001 (已存在)
```

### 测试脚本结构

```bash
# 每个E2E流程独立脚本
tests/integration/test_e2e_1_material_to_processing.sh
tests/integration/test_e2e_2_equipment_alerts.sh
tests/integration/test_e2e_3_quality_fail_handling.sh
tests/integration/test_e2e_4_batch_lifecycle.sh
tests/integration/test_e2e_5_dashboard_aggregation.sh
```

---

## 📈 成功标准

### Phase 3 整体通过标准

| 流程 | 必需通过 | 可选通过 | 状态定义 |
|------|---------|---------|---------|
| E2E-1 | Step 1-4 | Step 5-6 | 核心流程必须100%通过 |
| E2E-2 | Step 1-4 | Step 5-6 | 核心流程必须100%通过 |
| E2E-4 | Step 1-5 | Step 6-7 | 核心流程必须100%通过 |
| E2E-3 | Step 1-2 | Step 3-5 | 如果Phase 2.4未修复，可跳过 |
| E2E-5 | Step 1-4 | Step 5-6 | 数据一致性验证 |

**Phase 3 通过标准**:
- ✅ **核心流程通过率 ≥ 80%** (E2E-1, E2E-2, E2E-4)
- ✅ **阻塞性问题 = 0** (P0流程的必需步骤全部通过)
- 🟡 **扩展流程通过率 ≥ 60%** (E2E-3, E2E-5)

---

## 🎯 预期产出

### 测试报告

1. **PHASE3_E2E_1_MATERIAL_TO_PROCESSING.md** - 原料到生产流程测试
2. **PHASE3_E2E_2_EQUIPMENT_ALERTS.md** - 设备告警处理流程测试
3. **PHASE3_E2E_3_QUALITY_HANDLING.md** - 质检处理流程测试
4. **PHASE3_E2E_4_BATCH_LIFECYCLE.md** - 批次生命周期测试
5. **PHASE3_E2E_5_DASHBOARD.md** - Dashboard聚合测试
6. **PHASE3_INTEGRATION_COMPLETE_REPORT.md** - 综合测试报告

### 问题清单

**PHASE3_BLOCKING_ISSUES.md**: 阻塞业务的P0问题
**PHASE3_INTEGRATION_ISSUES.md**: 数据不一致、流程中断等集成问题
**PHASE2_REVISIT_PRIORITY.md**: 基于Phase 3结果，重新评估Phase 2哪些问题需要修复

---

## 💡 Phase 3 与 Phase 2 的关系

### Phase 2 问题重新评估

根据Phase 3集成测试结果，我们可以确定：

**高优先级（必须修复）**:
- 如果E2E-1失败 → Phase 2.1 Material Batch问题是P0
- 如果E2E-2失败 → Phase 2.2 Equipment问题是P0
- 如果E2E-4失败 → Phase 2.3 Processing问题是P0

**低优先级（可延后）**:
- 如果E2E-3失败但E2E-1/2/4成功 → Phase 2.4 Quality问题是P2
- 如果E2E-5失败但核心流程通过 → Dashboard问题是P3

**Phase 2.4 Quality (25%通过率) 决策**:
- 如果E2E-3中质检API完全不可用 → 需要修复（2-3小时）
- 如果E2E-3可以跳过或使用简化流程 → 可暂不修复

---

## 🚀 下一步

### Phase 3.1 开始 (立即执行)

1. **创建测试脚本**: `test_e2e_1_material_to_processing.sh`
2. **执行E2E-1测试**: 原料入库到加工生产
3. **生成测试报告**: 记录成功、失败、阻塞问题
4. **根据结果决定**:
   - ✅ 如果成功 → 继续E2E-2
   - ❌ 如果失败 → 分析是否Phase 2问题，决定是否修复或继续测试

**预计时间**: 30-40分钟完成E2E-1测试和报告

---

**计划创建时间**: 2025-11-21 02:00:00
**计划作者**: Claude Code
**下一步**: 开始执行 Phase 3.1 - E2E-1 测试

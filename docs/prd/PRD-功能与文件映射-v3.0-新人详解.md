# 白垩纪食品溯源系统 - 功能与文件映射 v3.0 新人详解

> **版本**: v3.0-新人详解
> **类型**: 针对新人的详细业务和技术指南
> **生成日期**: 2025-11-21
> **核心特色**: 包含完整的业务流程、交叉功能说明、实现细节和FAQ
> **适用对象**: 新加入项目的工程师

---

## 📑 文档目录

### 第0章 核心业务流程与架构
- [0.1 完整生产批次业务线](#01-完整生产批次业务线)
- [0.2 时间追踪与成本计算业务线](#02-时间追踪与成本计算业务线)
- [0.3 库存与材料管理业务线](#03-库存与材料管理业务线)
- [0.4 关键数据流图](#04-关键数据流图)

### 功能模块详解 (1-11)
1. [认证与权限模块](#1-认证与权限模块)
2. [考勤管理模块](#2-考勤管理模块)
3. [生产加工模块](#3-生产加工模块)
4. [AI智能分析模块](#4-ai智能分析模块)
5. [设备管理模块](#5-设备管理模块)
6. [库存管理模块](#6-库存管理模块)
7. [质量检验模块](#7-质量检验模块)
8. [基础数据管理模块](#8-基础数据管理模块)
9. [平台管理模块](#9-平台管理模块)
10. [报表分析模块](#10-报表分析模块)
11. [数据导入导出](#11-数据导入导出)

### 交叉功能详解
- [X.1 成本自动计算（4个模块协作）](#x1-成本自动计算4个模块协作)
- [X.2 FIFO库存推荐（库存→生产）](#x2-fifo库存推荐库存生产)
- [X.3 时间成本一体化（考勤→生产→成本）](#x3-时间成本一体化考勤生产成本)
- [X.4 设备折旧集成（设备→成本计算）](#x4-设备折旧集成设备成本计算)
- [X.5 AI分析触发链（完成→分析→报告）](#x5-ai分析触发链完成分析报告)

### 附录
- [系统统计数据](#系统统计数据)
- [常见问题解答](#常见问题解答)

---

## 第0章 核心业务流程与架构

本章介绍系统的3条主要业务线，每条业务线代表一个完整的工作流程。理解这些业务线是理解整个系统的基础。

### 0.1 完整生产批次业务线

#### 场景描述
一个食品工厂生产番茄酱。从原材料采购到成品交付的完整过程涉及多个模块的协作。

#### 流程步骤

**第1步: 物料准备 (库存模块 → 生产模块)**
```
库存管理员登录系统
  ↓
查看可用物料批次
  ↓
系统根据FIFO规则推荐最早过期日期的番茄批次 (MAT-20251015-001)
  ↓
确认使用该物料
  ↓
库存系统自动扣减该批次库存 (1000kg → 950kg)
```

**关键数据**:
- 物料批次: `MAT-20251015-001` (番茄, 2025-12-15过期)
- 用量: 50kg
- 库存剩余: 950kg

**涉及文件**:
- 前端: `MaterialInventoryScreen.tsx`, `MaterialBatchListScreen.tsx`
- 后端: `MaterialBatchRepository.java`, `MaterialConsumptionService.java`
- 数据库: `material_batches`, `material_consumption_records`

---

**第2步: 创建生产批次 (生产模块)**
```
生产主管登录系统
  ↓
创建新生产批次 (BATCH-20251121-001)
  ↓
设置基本信息:
  - 产品类型: 番茄酱
  - 计划产量: 500kg
  - 预计周期: 8小时
  - 指派主管: 张三
  ↓
系统保存到 production_batches 表
```

**关键数据结构**:
```java
// ProductionBatch 实体
{
  id: 1,
  batchNumber: "BATCH-20251121-001",
  productTypeId: "PROD-001",
  factoryId: "CRETAS_2024_001",
  status: "IN_PROGRESS",      // 生产中
  plannedQuantity: 500,
  actualQuantity: 0,          // 尚未完成
  startTime: 2025-11-21 08:00,
  endTime: null,              // 尚未结束
  supervisorId: 1,
  createdAt: 2025-11-21 08:00,
  updatedAt: 2025-11-21 08:00
}
```

**涉及文件**:
- 前端: `CreateProductionBatchScreen.tsx`, `ProductionDashboard.tsx`
- 后端: `ProcessingController.java`, `ProcessingServiceImpl.java`
- 数据库: `production_batches` 表

---

**第3步: 员工打卡与工作记录 (考勤模块)**
```
工人李四上班
  ↓
打开考勤页面,点击"上班打卡"
  ↓
系统记录:
  - 打卡时间: 2025-11-21 08:00
  - 打卡地点: 工厂GPS坐标
  - 员工ID: 4
  ↓
李四被自动分配到批次 BATCH-20251121-001 (系统基于岗位和当前任务)
  ↓
开始工作时间跟踪
```

**关键数据流**:
- 打卡记录 → `time_clock_records` 表
- 自动创建工作会话 → `batch_work_sessions` 表
- 关联到生产批次

```sql
-- time_clock_records 表记录
INSERT INTO time_clock_records (
  user_id, factory_id, clock_in_time,
  clock_in_location, status, created_at
) VALUES (
  4, 'CRETAS_2024_001', '2025-11-21 08:00:00',
  '31.2304,121.4737', 'CLOCKED_IN', NOW()
);

-- batch_work_sessions 表自动创建
INSERT INTO batch_work_sessions (
  batch_id, user_id, start_time, end_time, status
) VALUES (
  1, 4, '2025-11-21 08:00:00', NULL, 'IN_PROGRESS'
);
```

**涉及文件**:
- 前端: `AttendanceScreen.tsx`, `TimeClockScreen.tsx`
- 后端: `AttendanceController.java`, `TimeclockService.java`
- 数据库: `time_clock_records`, `batch_work_sessions`

---

**第4步: 设备使用与折旧记录 (设备模块)**
```
番茄酱生产需要使用两台设备:
  1. 搅拌机 (EQP-001)
  2. 灌装机 (EQP-002)

操作员通过设备管理界面:
  ↓
输入设备ID: EQP-001
  ↓
点击"开始工作"
  ↓
系统记录:
  - 设备启动时间: 2025-11-21 08:30
  - 关联批次: BATCH-20251121-001
  - 设备状态: 运行中
```

**设备成本计算**:
```
搅拌机月折旧: 15,000元
日折旧: 15,000 / 30 = 500元
工作时间: 8小时
小时折旧: 500 / 24 = 20.83元

本次使用成本 = 20.83 × 8 = 166.64元
```

**涉及文件**:
- 前端: `EquipmentManagementScreen.tsx`, `EquipmentOperationScreen.tsx`
- 后端: `EquipmentController.java`, `EquipmentService.java`
- 数据库: `equipment_usage_records`, `equipment_depreciation`

---

**第5步: 质量检验 (质量检验模块)**
```
生产完成后,质检员检查产品
  ↓
打开质检界面
  ↓
输入检验数据:
  - 外观: 合格
  - 口味: 合格
  - 成分含量: 合格
  - 微生物检测: 通过
  ↓
提交质检记录
  ↓
批次状态变更为: QUALITY_CHECKED
```

**质检记录保存**:
```java
{
  batchId: 1,
  inspectorId: 5,
  inspectionDate: 2025-11-21 16:00,
  appearance: "PASSED",
  taste: "PASSED",
  composition: "PASSED",
  microbiology: "PASSED",
  overallResult: "PASSED",
  notes: "符合企业标准"
}
```

**涉及文件**:
- 前端: `QualityInspectionScreen.tsx`, `CreateQualityRecordScreen.tsx`
- 后端: `QualityController.java`, `QualityInspectionService.java`
- 数据库: `quality_inspections` 表

---

**第6步: 员工下班打卡与自动成本计算 (考勤模块 + 成本计算)**
```
李四下班
  ↓
打开考勤页面,点击"下班打卡"
  ↓
系统记录:
  - 打卡时间: 2025-11-21 16:00
  - 工作时长: 8小时
  ↓
系统自动计算:
  - 工资成本: 员工日薪 × (8小时 / 24小时)
  - 收集该员工在该批次的所有工作时间
  ↓
触发批次成本汇总计算
```

**自动成本计算流程**:
```
当检测到"生产批次BATCH-20251121-001已完成"时:

1. 计算人工成本:
   - 收集所有batch_work_sessions
   - 李四: 8小时 × 日薪 / 24 = X元
   - 其他工人: ... (类似计算)
   - 人工成本小计: Y元

2. 计算设备成本:
   - 收集所有equipment_usage_records
   - 搅拌机: 8小时 × 折旧 = 166.64元
   - 灌装机: 8小时 × 折旧 = 125.30元
   - 设备成本小计: Z元

3. 计算原材料成本:
   - 用材: 50kg番茄 × 单价 = M元
   - 辅料: ... = N元
   - 材料成本小计: O元

4. 计算总成本:
   总成本 = 人工成本Y + 设备成本Z + 材料成本O
         = X + 291.94 + M
```

**涉及文件**:
- 前端: `TimeClockScreen.tsx`, `ProcessingDashboard.tsx`
- 后端: `ProcessingServiceImpl.java` (calculateBatchCost方法)
- 数据库: `batch_cost_analysis` 表

---

**第7步: AI智能分析与优化建议 (AI分析模块)**
```
系统完成成本计算后,自动触发AI分析
  ↓
AI分析引擎(DeepSeek LLM)分析批次数据:

输入提示词:
"这是一个番茄酱生产批次的完整数据:
- 产量: 500kg
- 人工成本: 1200元
- 设备成本: 291.94元
- 原材料成本: 5000元
- 总成本: 6491.94元
- 人工占比: 18.5%
- 设备占比: 4.5%
- 原材料占比: 77%

请分析:
1. 这个批次的成本是否合理?
2. 有哪些优化的机会?
3. 如何降低人工成本?
4. 设备折旧是否过高?"

  ↓
AI返回分析结果:
"从数据看,该批次成本较为合理,但有以下优化点:
1. 原材料成本占比77%,建议与供应商谈判降低单价
2. 人工成本18.5%较低,说明生产效率不错
3. 建议下次采购时选择散称番茄而非盒装,可节省包装成本..."

  ↓
分析结果保存到数据库
  ↓
通知相关人员查看优化建议
```

**涉及文件**:
- 前端: `DeepSeekAnalysisScreen.tsx`, `TimeRangeCostAnalysisScreen.tsx`
- 后端: `AIController.java`, `AIEnterpriseService.java`
- Python AI服务: `backend-java/backend-ai-chat/ai_service.py`
- 数据库: `ai_analysis_results` 表

---

#### 总结: 生产批次业务线涉及的模块

| 步骤 | 主模块 | 辅助模块 | 关键动作 | 输出 |
|------|--------|---------|---------|------|
| 1 | 库存管理 | - | 查询可用物料,FIFO推荐 | 物料批次ID |
| 2 | 生产加工 | - | 创建批次,记录计划 | 批次号 |
| 3 | 考勤管理 | 生产加工 | 打卡,创建工作会话 | 时间记录 |
| 4 | 设备管理 | 生产加工 | 设备启动,记录使用 | 设备使用记录 |
| 5 | 质量检验 | 生产加工 | 检验,记录结果 | 质检报告 |
| 6 | 考勤管理 | 成本计算 | 打卡,触发成本计算 | 成本明细 |
| 7 | AI分析 | 生产加工 | 自动分析,生成建议 | 优化方案 |

---

### 0.2 时间追踪与成本计算业务线

#### 场景描述
系统通过精细的时间追踪,自动计算每个员工对每个批次的成本贡献。

#### 完整流程

```
员工上班 (08:00)
  ↓
系统创建 time_clock_record 和 batch_work_session
  ↓
  ├─ time_clock_records: {user_id: 4, clock_in: 08:00}
  └─ batch_work_sessions: {batch_id: 1, user_id: 4, start: 08:00}

  ↓
员工工作 (08:00-16:00)
  ↓
  在此期间,系统记录:
  ├─ 中断时间(如果有) → break_records
  └─ 转移到其他批次(如果有) → batch_work_sessions 更新

  ↓
员工下班 (16:00)
  ↓
系统更新 time_clock_record 和 batch_work_session
  ↓
  ├─ time_clock_records: {clock_out: 16:00, total_hours: 8}
  └─ batch_work_sessions: {end: 16:00, duration: 8 hours}

  ↓
自动成本计算:
  ├─ 员工基本日薪: 300元
  ├─ 实际工作时间: 8小时 (扣除休息)
  ├─ 时间比例成本: 300 × (8/24) = 100元
  └─ 分配到批次BATCH-20251121-001: 100元
```

#### 复杂场景: 多批次工作

```
08:00 员工上班,分配到批次A
  ↓
12:00 转移到批次B (由于批次A暂时停工)
  ↓
14:00 转移回批次A
  ↓
16:00 下班

结果:
- 批次A 工作时间: (08:00-12:00) + (14:00-16:00) = 6小时
- 批次B 工作时间: (12:00-14:00) = 2小时
- 总工作时间: 8小时

成本分配:
- 批次A 人工成本: 300 × (6/24) = 75元
- 批次B 人工成本: 300 × (2/24) = 25元
- 验证: 75 + 25 = 100元 ✓
```

#### 关键表结构

```sql
-- 时间打卡记录
CREATE TABLE time_clock_records (
  id BIGINT PRIMARY KEY,
  user_id BIGINT,
  factory_id VARCHAR(50),
  clock_in_time TIMESTAMP,
  clock_out_time TIMESTAMP,
  clock_in_location VARCHAR(100),
  clock_out_location VARCHAR(100),
  total_hours DECIMAL(5,2),
  status ENUM('CLOCKED_IN', 'CLOCKED_OUT', 'BREAK'),
  created_at TIMESTAMP
);

-- 批次工作会话
CREATE TABLE batch_work_sessions (
  id BIGINT PRIMARY KEY,
  batch_id BIGINT,
  user_id BIGINT,
  factory_id VARCHAR(50),
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  duration_hours DECIMAL(5,2),
  labor_cost DECIMAL(12,2),  -- 自动计算
  status ENUM('IN_PROGRESS', 'COMPLETED'),
  created_at TIMESTAMP
);
```

---

### 0.3 库存与材料管理业务线

#### 场景描述
系统通过FIFO(先进先出)策略自动推荐物料使用,确保没有过期物料。

#### FIFO推荐流程

```
第1步: 查询需要的物料类型
  ↓
第2步: 从库存中查询该物料的所有批次
  ↓
  结果: [
    {batchId: 1, expiryDate: 2025-12-01, quantity: 500kg},   ← 最早过期
    {batchId: 2, expiryDate: 2025-12-15, quantity: 1000kg},
    {batchId: 3, expiryDate: 2026-01-10, quantity: 800kg}
  ]

第3步: 系统按expiryDate排序 (升序)
  ↓
第4步: 检查第一批(最早过期)的库存
  ↓
  batchId:1 有 500kg 可用

第5步: 展示推荐给用户
  ↓
  "推荐使用批次1 (2025-12-01过期), 库存500kg"

第6步: 用户确认使用
  ↓
第7步: 系统记录消耗
  ↓
  material_consumption_records 表中新增一条:
  {
    material_batch_id: 1,
    quantity_consumed: 50,  // 用了50kg
    consumption_date: 2025-11-21,
    batch_id: BATCH-20251121-001,
    created_by: 3
  }

第8步: 更新库存
  ↓
  material_batches 表:
  {
    id: 1,
    quantity: 500 - 50 = 450,
    updated_at: 2025-11-21
  }

第9步: 如果库存变为0,标记为已用完
  ↓
  status = 'CONSUMED'
```

#### 关键表关系

```
material_batches (物料批次表)
├─ id: 物料批次ID
├─ material_type_id: 物料类型 (番茄、盐、糖等)
├─ quantity: 当前库存
├─ expiry_date: 过期日期 ← FIFO的关键排序字段
├─ supplier_id: 供应商
└─ status: AVAILABLE / CONSUMED / EXPIRED

material_consumption_records (消耗记录表)
├─ id: 消耗记录ID
├─ material_batch_id: FK → material_batches
├─ batch_id: FK → production_batches (关联哪个生产批次)
├─ quantity_consumed: 消耗数量
├─ consumption_date: 消耗日期
└─ cost_per_unit: 单位成本 (后续计算总成本)

production_batches
├─ id: 生产批次ID
└─ 包含关联的所有物料消耗记录
```

#### 成本计算集成

```
当计算批次成本时:

1. 查询该批次的所有 material_consumption_records
2. 对每条消耗记录:
   cost = quantity_consumed × cost_per_unit
3. 汇总所有物料成本
4. 得到批次的总物料成本

示例:
批次BATCH-20251121-001 的物料消耗:
  - 番茄 50kg × 10元/kg = 500元
  - 盐 2kg × 5元/kg = 10元
  - 糖 3kg × 8元/kg = 24元
  ─────────────────────
  总物料成本 = 534元
```

---

### 0.4 关键数据流图

```
┌─────────────────────────────────────────────────────────────┐
│         完整的批次成本计算与AI分析数据流                      │
└─────────────────────────────────────────────────────────────┘

1️⃣ 数据收集阶段
   ├─ 考勤模块: time_clock_records, batch_work_sessions
   ├─ 库存模块: material_consumption_records
   ├─ 设备模块: equipment_usage_records
   ├─ 质检模块: quality_inspections
   └─ 生产模块: production_batches

      ↓ (当生产批次标记为COMPLETED时)

2️⃣ 成本计算阶段
   ProcessingServiceImpl.calculateBatchCost()
   ├─ 人工成本 = Σ(batch_work_sessions.duration × hourly_rate)
   ├─ 设备成本 = Σ(equipment_usage_records.duration × depreciation_rate)
   ├─ 物料成本 = Σ(material_consumption_records.quantity × unit_cost)
   └─ 总成本 = 人工 + 设备 + 物料

      ↓ 保存到 batch_cost_analysis 表

3️⃣ AI分析触发阶段
   当批次完成 && 成本计算完成
   ├─ 调用 AIEnterpriseService.analyzeTimeRangeCost()
   ├─ 构造提示词: formatTimeRangePrompt()
   ├─ 调用DeepSeek LLM (Python FastAPI port 8085)
   └─ 检查缓存(7天): 相同数据范围的分析结果可复用

      ↓ 保存分析结果到 ai_analysis_results 表

4️⃣ 结果展示阶段
   前端调用 aiApiClient.analyzeTimeRangeCost()
   ├─ 获取成本数据
   ├─ 获取AI分析结果
   ├─ 在 TimeRangeCostAnalysisScreen 展示
   └─ 用户可导出或分享

数据库表依赖关系:
┌──────────────────────┐
│ production_batches   │
│ (核心业务对象)       │
└──────────┬───────────┘
           │ 1:N
    ┌──────┴──────┬──────────┬──────────┐
    ↓             ↓          ↓          ↓
┌─────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│batch_work   │ │equipment_    │ │material_     │ │quality_      │
│_sessions    │ │usage_records │ │consumption   │ │inspections   │
└────┬────────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
     │                 │                │                │
     └─────────────────┴────────────────┴────────────────┘
              │
              ↓
      ┌──────────────────┐
      │batch_cost_       │
      │analysis          │ (成本汇总)
      └────────┬─────────┘
               │
               ↓
      ┌──────────────────┐
      │ai_analysis_      │
      │results           │ (AI优化建议)
      └──────────────────┘
```

---

## 1. 认证与权限模块

### 模块描述
认证与权限系统是整个平台的基础,提供:
- 统一登录入口 (区分平台管理员和工厂用户)
- 多角色权限管理 (7种角色)
- Token管理和自动刷新
- 设备绑定和激活

### 1.1 统一登录

**业务场景**:
工厂里的员工和平台管理员使用同一套APP,但登录后进入不同的界面和功能。系统需要自动识别用户类型。

**功能流程**:
```
用户输入用户名/密码 → 发送登录请求 → 系统查询用户表 →
自动判断角色类型 → 返回不同的菜单和权限 → 路由到对应首页
```

**前端实现**:
| 文件 | 说明 | 关键代码 |
|------|------|---------|
| `src/screens/auth/EnhancedLoginScreen.tsx` | 登录UI (统一入口) | ~400行 |
| `src/services/auth/authService.ts` | 认证逻辑 | ~250行 |
| `src/services/api/apiClient.ts` | API客户端 | 请求拦截器 |
| `src/store/authStore.ts` | 认证状态 (Zustand) | 用户信息、Token |

**后端实现**:
| 文件 | 说明 | 行数 |
|------|------|------|
| `controller/MobileController.java` | 登录API | 603行 |
| `service/AuthService.java` | 业务逻辑 | ~200行 |
| `security/JwtTokenProvider.java` | Token管理 | ~150行 |

**API端点**:
```
POST /api/mobile/auth/unified-login
```

**请求体**:
```json
{
  "username": "admin",
  "password": "Admin@123456",
  "deviceId": "UUID-xxx-xxx",
  "deviceInfo": {
    "model": "iPhone 13",
    "os": "iOS 16.0"
  }
}
```

**成功响应 (平台管理员)**:
```json
{
  "code": 200,
  "data": {
    "user": {
      "id": 1,
      "username": "admin",
      "roleCode": "platform_admin",
      "fullName": "系统管理员",
      "factoryId": null,
      "permissions": ["manage_factories", "manage_users", "view_reports"]
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 86400
    },
    "userType": "platform",
    "nextScreen": "PlatformDashboard"
  }
}
```

**成功响应 (工厂用户)**:
```json
{
  "code": 200,
  "data": {
    "user": {
      "id": 10,
      "username": "factory_admin",
      "roleCode": "factory_admin",
      "fullName": "工厂管理员",
      "factoryId": "CRETAS_2024_001",
      "permissions": ["create_batch", "manage_staff", "view_costs"]
    },
    "tokens": {
      "accessToken": "...",
      "refreshToken": "...",
      "expiresIn": 86400
    },
    "userType": "factory",
    "nextScreen": "FactoryDashboard"
  }
}
```

**数据库表**:
- `users` - 所有用户信息
- `user_roles` - 用户角色关系
- `permissions` - 权限定义
- `user_sessions` - 会话记录

**认证流程图**:
```
┌─────────────┐
│ 输入用户名  │
│ 输入密码    │
└──────┬──────┘
       │
       ↓
┌──────────────────────┐
│ POST /auth/login     │
│ (发送用户名+密码)    │
└──────┬───────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│ 后端验证:                            │
│ 1. 查询users表                       │
│ 2. 验证密码(BCrypt)                  │
│ 3. 查询用户的角色和权限             │
└──────┬───────────────────────────────┘
       │
       ├─ 登录失败? ──→ 返回 401 Unauthorized
       │
       ↓ 登录成功
┌─────────────────────────────────────┐
│ 生成Token:                          │
│ 1. AccessToken (24小时有效)        │
│ 2. RefreshToken (7天有效)          │
│ 3. DeviceToken (绑定设备)          │
└──────┬────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│ 前端保存Token:                       │
│ 1. AccessToken → SecureStore        │
│ 2. RefreshToken → SecureStore       │
│ 3. 更新authStore (Zustand)          │
└──────┬───────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│ 路由判断:                            │
│ if (roleCode === 'platform_admin')   │
│   → 跳转PlatformDashboard           │
│ else if (factoryId)                  │
│   → 跳转FactoryDashboard            │
│ else                                  │
│   → 跳转WorkerDashboard             │
└──────────────────────────────────────┘
```

---

### 1.2 权限体系 (7种角色)

**角色定义**:

| 角色代码 | 角色名 | 适用者 | 关键权限 |
|---------|--------|--------|---------|
| `platform_admin` | 平台管理员 | 公司技术人员 | 管理所有工厂、用户、配置系统 |
| `factory_super_admin` | 工厂超级管理员 | 工厂厂长 | 工厂的所有权限 |
| `factory_admin` | 工厂管理员 | 工厂副厂长 | 日常运营、人员管理、成本分析 |
| `department_admin` | 部门主任 | 车间主任 | 部门的工人管理、批次审核 |
| `supervisor` | 班组长 | 班组长 | 工人打卡审核、批次指派 |
| `operator` | 操作员 | 普通工人 | 打卡、参与生产 |
| `viewer` | 查看者 | 访客、稽查员 | 只读权限,查看报表 |

**权限矩阵** (部分示例):

| 功能 | platform_admin | factory_super | factory_admin | dept_admin | supervisor | operator | viewer |
|------|---|---|---|---|---|---|---|
| 管理工厂 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 管理员工 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| 创建批次 | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| 员工打卡 | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 查看成本 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ (只读) |
| AI分析 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

**前端权限守卫示例**:
```typescript
// PermissionGuard.tsx - 保护页面
<PermissionGuard requiredRoles={['factory_admin', 'factory_super_admin']}>
  <CostAnalysisScreen />
</PermissionGuard>

// 或使用Hook
const canViewCosts = usePermission(['factory_admin', 'factory_super_admin']);
if (!canViewCosts) {
  return <AccessDeniedScreen />;
}
```

**后端权限验证**:
```java
@PreAuthorize("hasAnyRole('FACTORY_ADMIN', 'FACTORY_SUPER_ADMIN')")
@GetMapping("/batches/costs")
public ResponseEntity<?> getBatchCosts() {
  // ...
}
```

---

### 1.3 Token管理与自动刷新

**Token类型**:

| Token类型 | 有效期 | 用途 | 存储位置 |
|----------|--------|------|---------|
| AccessToken | 24小时 | 每次API请求 | SecureStore |
| RefreshToken | 7天 | 刷新AccessToken | SecureStore |
| TempToken | 10分钟 | 临时操作(如修改密码) | 内存 |
| DeviceToken | 长期 | 设备绑定 | SecureStore |

**自动刷新流程**:
```
用户发送API请求
  ↓
  AccessToken 有效? ✅
  ├─ YES → 继续请求,返回200
  └─ NO (401 Unauthorized)
       ↓
    检查 RefreshToken
      ├─ RefreshToken 有效? ✅
      │  YES →
      │    ├─ 调用 POST /api/auth/refresh
      │    ├─ 获取新 AccessToken
      │    ├─ 保存到 SecureStore
      │    ├─ 重新发送原请求
      │    └─ 返回200
      │
      └─ RefreshToken 过期或不存在? ❌
         ├─ 跳转登录页面
         └─ 清除本地数据
```

**实现代码** (Axios拦截器):
```typescript
// apiClient.ts
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        const response = await apiClient.post('/auth/refresh',
          { deviceId: DeviceInfo.deviceId },
          { headers: { 'Authorization': `Bearer ${refreshToken}` } }
        );

        const { accessToken } = response.data.data;
        await SecureStore.setItemAsync('accessToken', accessToken);

        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Token无法刷新,重新登录
        authStore.logout();
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      }
    }
    return Promise.reject(error);
  }
);
```

---

## 2. 考勤管理模块

### 模块描述
考勤管理模块实现员工的工作时间追踪,包括上班打卡、下班打卡、中途休息等。这是**时间成本计算**的数据来源。

### 2.1 打卡功能

**业务场景**:
员工进厂和离厂都要打卡,系统自动记录位置和时间,用于后续的成本计算和工资统计。

**打卡流程**:
```
员工打开APP → 进入"考勤"页面 → 点击"上班打卡"按钮
  ↓
系统读取当前时间和GPS位置
  ↓
弹出确认对话框 (显示时间、地点、天气等)
  ↓
用户确认 → 发送打卡请求
  ↓
API POST /api/mobile/{factoryId}/attendance/clock-in
  ↓
后端保存到 time_clock_records 表
  ↓
自动创建关联的 batch_work_session (如果有进行中的批次)
  ↓
返回成功提示 "今日上班打卡成功,已录入系统"
```

**前端文件**:
- `src/screens/attendance/TimeClockScreen.tsx` - 打卡UI
- `src/screens/attendance/AttendanceStatisticsScreen.tsx` - 打卡统计
- `src/services/api/attendanceApiClient.ts` - API调用

**后端文件**:
- `controller/AttendanceController.java` - 打卡API
- `service/impl/TimeclockServiceImpl.java` - 打卡逻辑
- `entity/TimeClockRecord.java` - 打卡数据模型

**数据库表**:
```sql
CREATE TABLE time_clock_records (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  factory_id VARCHAR(50) NOT NULL,
  clock_in_time TIMESTAMP,
  clock_out_time TIMESTAMP,
  clock_in_location VARCHAR(100),      -- GPS坐标 "31.2304,121.4737"
  clock_out_location VARCHAR(100),
  total_hours DECIMAL(5,2),             -- 自动计算
  status ENUM('CLOCKED_IN', 'CLOCKED_OUT'),
  remarks VARCHAR(200),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**API端点**:
```
# 上班打卡
POST /api/mobile/{factoryId}/attendance/clock-in
请求体:
{
  "location": "31.2304,121.4737",
  "deviceId": "device-uuid"
}

响应:
{
  "code": 200,
  "data": {
    "clockInTime": "2025-11-21T08:00:00",
    "batchId": 1,                    // 如果有进行中的批次
    "batchNumber": "BATCH-20251121-001",
    "message": "打卡成功,已关联到生产批次"
  }
}

# 下班打卡
POST /api/mobile/{factoryId}/attendance/clock-out
请求体:
{
  "location": "31.2304,121.4737"
}

响应:
{
  "code": 200,
  "data": {
    "clockOutTime": "2025-11-21T16:00:00",
    "totalHours": 8,
    "workSessions": [
      {
        "batchNumber": "BATCH-20251121-001",
        "duration": 8,
        "laborCost": 100
      }
    ],
    "totalDailyCost": 100
  }
}
```

---

### 2.2 工作会话管理

**概念**:
一个"工作会话"(work session) 是员工在某个生产批次上的一段连续工作时间。当员工打卡时,系统会自动创建或更新工作会话。

**工作会话生命周期**:
```
08:00 员工上班打卡
  ↓
系统查询: 当前有进行中的批次吗?
  ├─ 有: 创建 batch_work_session
  │      {batch_id: 1, user_id: 4, start_time: 08:00, status: IN_PROGRESS}
  └─ 无: 等待后续分配

  ↓
12:00 系统或管理员将员工转移到其他批次
  ├─ 更新session1: end_time = 12:00, status = COMPLETED
  ├─ 计算: duration = 4小时, labor_cost = (日薪 / 24) × 4
  └─ 创建session2: batch_id = 2, start_time = 12:00

  ↓
16:00 员工下班打卡
  ├─ 更新session2: end_time = 16:00, status = COMPLETED
  ├─ 计算: duration = 4小时, labor_cost = (日薪 / 24) × 4
  └─ 触发批次成本计算
```

**关键表**:
```sql
CREATE TABLE batch_work_sessions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  batch_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  factory_id VARCHAR(50) NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  duration_hours DECIMAL(5,2),        -- (end_time - start_time) / 3600
  labor_cost DECIMAL(12,2),            -- 自动计算: (daily_salary / 24) × duration_hours
  status ENUM('IN_PROGRESS', 'COMPLETED'),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,

  FOREIGN KEY (batch_id) REFERENCES production_batches(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 3. 生产加工模块

### 模块描述
生产加工模块是整个系统的**核心业务驱动器**。它:
1. 管理生产批次的完整生命周期
2. 协调其他模块(考勤、库存、设备、质检)的数据
3. 触发成本计算和AI分析

### 3.1 生产批次管理

**批次生命周期**:
```
创建 (CREATED)
  ↓ (设置计划和资源)
进行中 (IN_PROGRESS)
  ↓ (所有工作完成)
质检中 (QUALITY_CHECKING)
  ↓ (质检通过)
已完成 (COMPLETED) → 触发成本计算 + AI分析
  ↓
已交付 (DELIVERED)
```

**关键表**:
```sql
CREATE TABLE production_batches (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  batch_number VARCHAR(50) NOT NULL UNIQUE,  -- BATCH-20251121-001
  product_type_id VARCHAR(50),
  factory_id VARCHAR(50) NOT NULL,
  status ENUM('CREATED', 'IN_PROGRESS', 'QUALITY_CHECKING', 'COMPLETED', 'DELIVERED'),

  -- 计划信息
  planned_quantity DECIMAL(12,2),
  unit VARCHAR(20),  -- kg, L, 个 等
  start_date TIMESTAMP,
  end_date TIMESTAMP,

  -- 实际完成信息
  actual_quantity DECIMAL(12,2),
  actual_start TIMESTAMP,
  actual_end TIMESTAMP,

  -- 资源信息
  supervisor_id BIGINT,
  location VARCHAR(100),

  -- 成本信息
  total_cost DECIMAL(12,2),              -- 自动计算
  labor_cost DECIMAL(12,2),
  equipment_cost DECIMAL(12,2),
  material_cost DECIMAL(12,2),

  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**创建批次API**:
```
POST /api/mobile/{factoryId}/processing/batches

请求体:
{
  "productTypeId": "PROD-001",
  "batchNumber": "BATCH-20251121-001",
  "plannedQuantity": 500,
  "unit": "kg",
  "supervisorId": 1,
  "location": "生产线A"
}

响应:
{
  "code": 200,
  "data": {
    "id": 1,
    "batchNumber": "BATCH-20251121-001",
    "status": "IN_PROGRESS",
    "createdAt": "2025-11-21T08:00:00"
  }
}
```

---

### 3.2 批次成本自动计算

**触发条件**:
当批次标记为 `COMPLETED` 或 `DELIVERED` 时,系统自动计算成本。

**成本计算算法** (后端ProcessingServiceImpl):

```java
public BigDecimal calculateBatchCost(Long batchId) {
  // 1. 获取生产批次信息
  ProductionBatch batch = productionBatchRepository.findById(batchId);

  // 2. 计算人工成本
  List<BatchWorkSession> sessions = batchWorkSessionRepository
    .findByBatchId(batchId);
  BigDecimal laborCost = BigDecimal.ZERO;
  for (BatchWorkSession session : sessions) {
    BigDecimal hourlyRate = getHourlyRate(session.getUserId());
    BigDecimal hours = BigDecimal.valueOf(session.getDurationHours());
    laborCost = laborCost.add(hourlyRate.multiply(hours));
  }

  // 3. 计算设备成本
  List<EquipmentUsageRecord> usages = equipmentUsageRepository
    .findByBatchId(batchId);
  BigDecimal equipmentCost = BigDecimal.ZERO;
  for (EquipmentUsageRecord usage : usages) {
    Equipment equipment = equipmentRepository.findById(usage.getEquipmentId());
    BigDecimal depreciation = equipment.getDailyDepreciation()
      .divide(BigDecimal.valueOf(24), 2, RoundingMode.HALF_UP);
    BigDecimal hours = BigDecimal.valueOf(usage.getDurationHours());
    equipmentCost = equipmentCost.add(depreciation.multiply(hours));
  }

  // 4. 计算物料成本
  List<MaterialConsumptionRecord> materials = materialConsumptionRepository
    .findByBatchId(batchId);
  BigDecimal materialCost = BigDecimal.ZERO;
  for (MaterialConsumptionRecord material : materials) {
    BigDecimal quantity = BigDecimal.valueOf(material.getQuantityConsumed());
    BigDecimal unitCost = material.getUnitCost();
    materialCost = materialCost.add(quantity.multiply(unitCost));
  }

  // 5. 汇总成本
  BigDecimal totalCost = laborCost
    .add(equipmentCost)
    .add(materialCost);

  // 6. 保存到数据库
  batch.setLaborCost(laborCost);
  batch.setEquipmentCost(equipmentCost);
  batch.setMaterialCost(materialCost);
  batch.setTotalCost(totalCost);
  productionBatchRepository.save(batch);

  // 7. 触发AI分析 (异步)
  aiService.analyzeCompletedBatch(batchId);

  return totalCost;
}
```

**前端成本展示** (TimeRangeCostAnalysisScreen.tsx):
```typescript
const fetchCostAnalysis = async () => {
  // 1. 获取时间范围内的所有批次成本
  const response = await processingApiClient.getTimeRangeCostAnalysis({
    factoryId,
    startDate: '2025-11-01',
    endDate: '2025-11-30',
    pageSize: 10
  });

  const { batches, summary } = response.data;

  // 2. 展示汇总
  // 总成本: 10,500元
  // 人工占比: 35%
  // 设备占比: 15%
  // 物料占比: 50%

  // 3. 获取AI分析
  const aiAnalysis = await aiApiClient.analyzeTimeRangeCost({
    startDate: '2025-11-01',
    endDate: '2025-11-30'
  });

  // 4. 展示优化建议
  // "根据分析,过去30天物料成本占比最大(50%),建议..."
};
```

---

## 4. AI智能分析模块

### 模块描述
AI模块集成DeepSeek大语言模型,对生产数据进行深度分析,提供成本优化建议。

### 4.1 成本分析与优化建议

**触发条件**:
- 当生产批次完成且成本计算完成时,自动触发
- 或用户主动在UI中请求分析

**完整流程**:
```
1️⃣ 用户打开 TimeRangeCostAnalysisScreen
   ↓
2️⃣ 前端发送请求:
   POST /api/mobile/{factoryId}/ai/analyze-cost
   {
     "startDate": "2025-11-01",
     "endDate": "2025-11-30",
     "analysisType": "detailed"
   }

   ↓
3️⃣ 后端处理 (AIController):
   a) 检查缓存: 相同日期范围的分析是否存在?
      - YES (且<7天) → 直接返回缓存结果
      - NO → 继续

   b) 收集数据:
      - 查询日期范围内的所有批次
      - 计算各类型成本占比
      - 获取产量、效率等指标

   c) 构造提示词 (formatTimeRangePrompt):
      ┌─────────────────────────────────────┐
      │ 我是一家食品工厂的成本分析师。     │
      │ 请分析过去30天的生产成本数据:       │
      │                                      │
      │ 总成本: 10,500元                    │
      │ 总产量: 2,000kg                     │
      │ 单位成本: 5.25元/kg                │
      │                                      │
      │ 成本构成:                            │
      │ - 人工成本: 3,675元 (35%)           │
      │ - 设备成本: 1,575元 (15%)           │
      │ - 物料成本: 5,250元 (50%)           │
      │                                      │
      │ 关键指标:                            │
      │ - 平均效率: 92%                     │
      │ - 废品率: 2%                        │
      │ - 平均批次周期: 8小时              │
      │                                      │
      │ 请分析:                              │
      │ 1. 这些成本在行业中是否合理?      │
      │ 2. 最大的成本优化空间在哪里?      │
      │ 3. 具体的降本方案是什么?          │
      │ 4. 预期能节省多少成本?             │
      └─────────────────────────────────────┘

   d) 调用DeepSeek LLM (Python FastAPI):
      POST http://localhost:8085/ai/analyze
      {
        "prompt": "...上面的提示词...",
        "model": "deepseek-chat",
        "temperature": 0.7,
        "max_tokens": 2000
      }

   e) 解析LLM响应:
      ┌─────────────────────────────────────┐
      │ ## 成本分析结果                     │
      │                                      │
      │ ### 1. 成本合理性评估                │
      │ 单位成本5.25元/kg低于行业平均值... │
      │                                      │
      │ ### 2. 主要优化空间                  │
      │ 物料采购(50%) > 人工(35%) > 设备... │
      │                                      │
      │ ### 3. 具体降本方案                  │
      │ a) 物料采购端:                      │
      │    - 与供应商谈判大宗优惠          │
      │    - 预期降幅: 8-10%               │
      │                                      │
      │ b) 人工端:                          │
      │    - 优化生产流程,减少时间浪费    │
      │    - 预期降幅: 5-8%               │
      │                                      │
      │ ### 4. 预期效益                      │
      │ 年度可节省: 42,000 - 52,500元      │
      └─────────────────────────────────────┘

   f) 保存分析结果到 ai_analysis_results 表:
      {
        "analysisId": "UUID",
        "factoryId": "CRETAS_2024_001",
        "analysisType": "cost_analysis",
        "dateRange": "2025-11-01 to 2025-11-30",
        "input": "...提示词...",
        "output": "...LLM响应...",
        "costImpact": "42000-52500",
        "confidence": "high",
        "createdAt": "2025-11-21T16:00:00",
        "cacheExpiresAt": "2025-11-28T16:00:00"  // 7天缓存
      }

   ↓
4️⃣ 返回前端:
   {
     "code": 200,
     "data": {
       "analysis": "...上面的LLM响应...",
       "summary": {
         "mainOptimization": "物料采购成本优化",
         "expectedSavings": "42000-52500",
         "implementationDifficulty": "medium"
       },
       "cacheInfo": {
         "isCached": false,
         "expiresAt": "2025-11-28T16:00:00"
       }
     }
   }

   ↓
5️⃣ 前端展示:
   - 展示AI分析结果
   - 高亮关键数字
   - 提供"导出"、"分享"、"详细阅读"等操作
```

**关键文件**:
- 前端: `src/screens/processing/DeepSeekAnalysisScreen.tsx`
- 后端: `controller/AIController.java`, `service/AIEnterpriseService.java`
- Python: `backend-java/backend-ai-chat/ai_service.py`

**数据库**:
```sql
CREATE TABLE ai_analysis_results (
  id VARCHAR(50) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  analysis_type VARCHAR(50),  -- cost_analysis, efficiency_analysis, etc
  date_range_start DATE,
  date_range_end DATE,

  -- 分析输入输出
  prompt_input LONGTEXT,
  analysis_output LONGTEXT,

  -- 优化效果
  cost_impact VARCHAR(50),           -- "42000-52500"
  confidence_level VARCHAR(20),      -- high, medium, low

  -- 缓存管理
  created_at TIMESTAMP,
  cache_expires_at TIMESTAMP,        -- 7天缓存

  UNIQUE KEY unique_analysis (factory_id, analysis_type, date_range_start, date_range_end)
);
```

---

## 5. 设备管理模块

### 模块描述
设备管理模块记录设备的使用情况和成本计算,是**设备成本**的数据来源。

### 5.1 设备使用记录

**业务流程**:
```
操作员打开设备管理页面
  ↓
输入设备ID (EQP-001 搅拌机)
  ↓
点击"开始工作" 按钮
  ↓
系统弹出对话框:
  - 确认设备信息
  - 确认开始时间 (自动填充当前时间)
  - 关联生产批次
  ↓
用户点击"确认"
  ↓
API POST /api/mobile/{factoryId}/equipment/{equipmentId}/start
请求体:
{
  "batchId": 1,
  "startTime": "2025-11-21T08:30:00"
}

响应:
{
  "code": 200,
  "data": {
    "usageRecordId": 100,
    "equipmentId": "EQP-001",
    "status": "RUNNING",
    "startTime": "2025-11-21T08:30:00"
  }
}

  ↓
设备运行中...
  ↓
设备工作完成
  ↓
操作员点击"停止工作"
  ↓
API POST /api/mobile/{factoryId}/equipment/{equipmentId}/stop
请求体:
{
  "usageRecordId": 100,
  "endTime": "2025-11-21T16:30:00",
  "notes": "完成番茄酱灌装"
}

响应:
{
  "code": 200,
  "data": {
    "usageRecordId": 100,
    "duration": 8,          // 小时
    "cost": 166.64,        // 折旧成本
    "status": "COMPLETED"
  }
}
```

**关键表**:
```sql
CREATE TABLE equipment_usage_records (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  equipment_id VARCHAR(50) NOT NULL,
  factory_id VARCHAR(50) NOT NULL,
  batch_id BIGINT,                  -- 关联生产批次

  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  duration_hours DECIMAL(5,2),      -- 自动计算

  operator_id BIGINT,
  notes VARCHAR(200),

  -- 成本计算
  hourly_depreciation DECIMAL(12,2),
  equipment_cost DECIMAL(12,2),     -- duration × hourly_depreciation

  status ENUM('RUNNING', 'COMPLETED'),
  created_at TIMESTAMP
);

CREATE TABLE equipment_depreciation (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  equipment_id VARCHAR(50) NOT NULL,

  -- 折旧信息
  purchase_date DATE,
  purchase_price DECIMAL(12,2),
  useful_life_years INT,            -- 使用年限

  -- 计算字段
  monthly_depreciation DECIMAL(12,2),   -- 每月折旧 = 购入价 / (12 × useful_life)
  daily_depreciation DECIMAL(12,2),     -- 每日折旧 = 月折旧 / 30
  hourly_depreciation DECIMAL(12,2),    -- 每小时折旧 = 日折旧 / 24

  updated_at TIMESTAMP
);
```

---

## 6. 库存管理模块

### 模块描述
库存管理模块实现FIFO(先进先出)库存推荐,确保先到期的物料优先使用。

### 6.1 FIFO库存推荐

**业务流程**:
```
生产主管准备开始生产
  ↓
打开库存界面
  ↓
选择需要的物料类型 (番茄)
  ↓
系统查询该物料的所有批次:
  结果: [
    {id: 1, expiryDate: 2025-12-01, quantity: 500},   ← 最早过期
    {id: 2, expiryDate: 2025-12-15, quantity: 1000},
    {id: 3, expiryDate: 2026-01-10, quantity: 800}
  ]

  ↓
系统按过期日期排序

  ↓
系统推荐: "推荐使用批次1(2025-12-01过期),当前库存500kg"

  ↓
用户输入需要的数量: 50kg

  ↓
点击"确认使用"

  ↓
API POST /api/mobile/{factoryId}/material-batches/consume
请求体:
{
  "materialBatchId": 1,
  "quantityConsumed": 50,
  "batchId": 1,          // 生产批次
  "consumedBy": 3        // 操作者
}

响应:
{
  "code": 200,
  "data": {
    "consumptionRecordId": 500,
    "materialBatchId": 1,
    "quantityConsumed": 50,
    "remainingQuantity": 450,
    "unitCost": 10,
    "totalCost": 500
  }
}

  ↓
系统自动:
  1. 创建 material_consumption_records 记录
  2. 更新 material_batches 的库存 (500 → 450)
  3. 如果库存为0,标记为 CONSUMED
```

**关键表**:
```sql
CREATE TABLE material_batches (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  material_type_id VARCHAR(50) NOT NULL,
  factory_id VARCHAR(50) NOT NULL,

  -- 库存信息
  quantity DECIMAL(12,2) NOT NULL,
  unit VARCHAR(20),  -- kg, L, 个

  -- FIFO关键字段
  expiry_date DATE NOT NULL,         -- ← 排序字段
  purchase_date DATE,

  -- 成本信息
  supplier_id BIGINT,
  unit_cost DECIMAL(12,2),
  total_cost DECIMAL(12,2),          -- quantity × unit_cost

  -- 状态
  status ENUM('AVAILABLE', 'CONSUMED', 'EXPIRED'),

  created_at TIMESTAMP,
  updated_at TIMESTAMP,

  -- 索引优化查询
  INDEX idx_material_expiry (material_type_id, expiry_date)
);

CREATE TABLE material_consumption_records (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  material_batch_id BIGINT NOT NULL,
  batch_id BIGINT NOT NULL,         -- 生产批次
  factory_id VARCHAR(50) NOT NULL,

  quantity_consumed DECIMAL(12,2),
  unit_cost DECIMAL(12,2),
  cost DECIMAL(12,2),               -- quantity × unit_cost

  consumed_by BIGINT,               -- 谁操作的
  consumption_date TIMESTAMP,
  created_at TIMESTAMP,

  FOREIGN KEY (material_batch_id) REFERENCES material_batches(id),
  FOREIGN KEY (batch_id) REFERENCES production_batches(id)
);
```

---

## 7. 质量检验模块

### 模块描述
质量检验模块记录产品的质检信息,包括外观、口味、成分等多维度的检验数据。

### 7.1 质检记录

**检验项目**:
- 外观: 颜色、形状、包装等
- 口味: 咸淡度、甜度等
- 成分: 营养成分是否符合标准
- 微生物: 菌落数、致病菌检测
- 其他: 硬度、弹性等

**检验流程**:
```
生产批次完成
  ↓
质检员打开质检界面
  ↓
扫描/输入批次号: BATCH-20251121-001
  ↓
系统显示该批次的生产信息

  ↓
质检员逐项检验:
  1. 外观检验 → "合格" / "不合格"
  2. 口味检验 → "合格" / "不合格"
  3. 成分检验 → "合格" / "不合格"
  4. 微生物检验 → "合格" / "不合格"

  ↓
质检员可添加备注: "符合企业标准"

  ↓
点击"提交检验报告"

  ↓
API POST /api/mobile/{factoryId}/quality/inspections
请求体:
{
  "batchId": 1,
  "inspectorId": 5,
  "inspectionDate": "2025-11-21",
  "items": [
    {
      "itemName": "外观",
      "result": "PASSED",
      "notes": "颜色均匀"
    },
    {
      "itemName": "口味",
      "result": "PASSED",
      "notes": "口感好"
    },
    {
      "itemName": "成分",
      "result": "PASSED",
      "notes": ""
    },
    {
      "itemName": "微生物",
      "result": "PASSED",
      "notes": "菌落数<100/g"
    }
  ],
  "overallResult": "PASSED",
  "notes": "符合企业标准"
}

响应:
{
  "code": 200,
  "data": {
    "inspectionId": 1000,
    "batchId": 1,
    "overallResult": "PASSED",
    "createdAt": "2025-11-21T16:00:00"
  }
}
```

---

## X.1 成本自动计算 (4个模块协作)

### 场景: 一个番茄酱批次的完整成本计算

**涉及模块**: 考勤(人工) + 设备(折旧) + 库存(物料) + 生产(汇总)

**完整场景**:
```
2025-11-21,工厂生产一批番茄酱

┌─────────────────────────────────────────────────────────┐
│ 步骤1: 数据收集 (整个工作日)                             │
└─────────────────────────────────────────────────────────┘

📍 考勤模块记录:
  08:00 李四上班 → time_clock_records
  12:00 李四中途休息30分钟
  16:00 李四下班 → 总工作时间 7.5小时

📍 库存模块记录:
  使用物料: 番茄 50kg (单价10元/kg) = 500元

📍 设备模块记录:
  08:30-16:30 搅拌机运行 (时间8小时,折旧 20.83元/小时)
  = 166.64元

┌─────────────────────────────────────────────────────────┐
│ 步骤2: 成本汇总计算 (当批次标记为COMPLETED)              │
└─────────────────────────────────────────────────────────┘

后端调用: ProcessingServiceImpl.calculateBatchCost(batchId=1)

1️⃣ 人工成本计算:
   - 查询该批次的所有batch_work_sessions
   - 李四: 7.5小时 × (日薪300元/24小时) = 93.75元
   - 其他工人: (无)
   ────────────────────────────
   小计: 93.75元

2️⃣ 设备成本计算:
   - 查询该批次的所有equipment_usage_records
   - 搅拌机: 8小时 × 20.83元/小时 = 166.64元
   ────────────────────────────
   小计: 166.64元

3️⃣ 物料成本计算:
   - 查询该批次的所有material_consumption_records
   - 番茄: 50kg × 10元/kg = 500元
   ────────────────────────────
   小计: 500元

4️⃣ 总成本:
   ┌──────────────────────┐
   │ 人工成本:  93.75元    │
   │ 设备成本: 166.64元    │
   │ 物料成本: 500.00元    │
   ├──────────────────────┤
   │ 总成本:  760.39元    │
   │ 产量: 500kg          │
   │ 单位成本: 1.52元/kg  │
   └──────────────────────┘

5️⃣ 保存到数据库:
   UPDATE production_batches
   SET labor_cost = 93.75,
       equipment_cost = 166.64,
       material_cost = 500.00,
       total_cost = 760.39,
       status = 'COMPLETED'
   WHERE id = 1;

┌─────────────────────────────────────────────────────────┐
│ 步骤3: 触发AI分析 (异步)                                  │
└─────────────────────────────────────────────────────────┘

当成本计算完成后,自动调用:
AIEnterpriseService.analyzeCompletedBatch(batchId=1)
  ↓
收集该批次及最近N个批次的成本数据
  ↓
调用DeepSeek LLM进行分析
  ↓
保存分析结果到ai_analysis_results表
```

### 跨模块数据关系图

```
time_clock_records
│ user_id, clock_in/out, duration
│
└─→ batch_work_sessions
    │ user_id, batch_id, duration_hours
    │
    └─→ production_batches ← 汇总中心
        │
        ├─ labor_cost = Σ(batch_work_sessions)
        │
        ├─ equipment_usage_records
        │  │ equipment_id, batch_id, duration
        │  │
        │  └─ equipment_depreciation
        │     (hourly_rate)
        │
        ├─ material_consumption_records
        │  │ material_batch_id, batch_id, quantity
        │  │
        │  └─ material_batches
        │     (unit_cost)
        │
        └─ total_cost = labor + equipment + material
```

---

## X.2 FIFO库存推荐 (库存→生产)

### 流程

```
生产主管在生产加工模块中创建新批次
  ↓
需要使用番茄这种物料
  ↓
调用库存服务: MaterialBatchService.recommendBatch(materialTypeId)
  ↓
库存服务执行:
  1. 查询 material_batches 表
     WHERE material_type_id = '番茄'
     AND status = 'AVAILABLE'
     AND expiry_date > TODAY()

  2. 按 expiry_date ASC 排序

  3. 返回第一条 (最早过期的)
     → {id: 1, quantity: 500, expiryDate: 2025-12-01}

  ↓
生产模块显示推荐结果给用户
  ↓
用户确认使用
  ↓
触发消耗记录:
  1. 创建 material_consumption_record
  2. 扣减 material_batches.quantity
  3. 如果quantity=0,标记为 CONSUMED
```

**代码示例** (MaterialBatchService.java):

```java
public MaterialBatch recommendBatchForConsumption(
    String factoryId,
    String materialTypeId) {

  // FIFO推荐: 按过期日期升序,取第一条
  List<MaterialBatch> batches = materialBatchRepository
    .findByFactoryIdAndMaterialTypeIdAndStatusAndExpiryDateAfter(
        factoryId,
        materialTypeId,
        MaterialBatchStatus.AVAILABLE,
        LocalDate.now()
    )
    .stream()
    .sorted(Comparator.comparing(MaterialBatch::getExpiryDate))
    .collect(Collectors.toList());

  if (batches.isEmpty()) {
    throw new MaterialUnavailableException(
      "No available material: " + materialTypeId);
  }

  return batches.get(0);  // 返回最早过期的
}
```

---

## X.3 时间成本一体化 (考勤→生产→成本)

### 完整数据链

```
时间打卡
  time_clock_records
  {user_id: 4, clock_in: 08:00, clock_out: 16:00}

      ↓

工作会话
  batch_work_sessions
  {batch_id: 1, user_id: 4, duration_hours: 8}

      ↓

成本计算
  hourly_rate = daily_salary / 24
  labor_cost = duration_hours × hourly_rate
            = 8 × (300/24)
            = 100元

      ↓

批次成本
  production_batches.labor_cost += 100元

      ↓

总成本汇总
  total_cost = labor_cost + equipment_cost + material_cost
```

---

## X.4 设备折旧集成 (设备→成本计算)

### 折旧计算公式

```
购入价: 120,000元
使用年限: 10年

月折旧 = 120,000 / (12 × 10) = 1,000元
日折旧 = 1,000 / 30 = 33.33元
小时折旧 = 33.33 / 24 = 1.39元

实际使用:
  运行8小时 → 成本 = 1.39 × 8 = 11.12元
```

**代码** (EquipmentService.java):

```java
public BigDecimal calculateEquipmentCost(
    Equipment equipment,
    BigDecimal usageHours) {

  BigDecimal hourlyDepreciation = equipment.getHourlyDepreciation();
  // equipment.hourly_depreciation 在创建设备时自动计算

  return hourlyDepreciation.multiply(usageHours);
}
```

---

## X.5 AI分析触发链 (完成→分析→报告)

### 自动触发流程

```
batch.status = 'COMPLETED'
  ↓
成本计算完成
  ↓
检查: 该批次的AI分析已存在?
  ├─ YES → 跳过
  └─ NO → 继续

  ↓
调用AIEnterpriseService.analyzeCompletedBatch(batchId)
  ↓
收集数据:
  - 该批次的成本信息
  - 同周期的其他批次 (用于对比)
  - 厂级的历史数据 (用于趋势分析)

  ↓
构造提示词:
  "这是一个生产批次的完整数据...请分析..."

  ↓
调用DeepSeek LLM (最多等待30秒)

  ↓
获取LLM响应

  ↓
保存到ai_analysis_results表
  (cache_expires_at = now + 7天)

  ↓
可选: 发送通知给相关人员
  "批次BATCH-20251121-001的AI分析已完成,有优化建议"
```

---

## 系统统计数据

| 维度 | 数值 |
|------|------|
| **前端页面** | 75个 |
| **后端Controllers** | 25个 |
| **已实现API** | 397个 |
| **规划中API** | 180个 |
| **数据实体** | 43个 |
| **系统完成度** | 82-85% |

---

## 常见问题解答

### Q1: 为什么我的员工打卡后没有自动关联批次?
**A**: 检查以下几点:
1. 是否有进行中的生产批次 (status=IN_PROGRESS)?
2. 该员工是否被分配到该批次?
3. 打卡时间是否在批次的计划时间范围内?
如果以上都满足,系统会自动创建batch_work_session。

### Q2: FIFO库存推荐是怎样的?
**A**: 系统按照物料批次的过期日期升序排列,优先推荐最早过期的。这样可以避免物料过期浪费。

### Q3: AI分析何时自动触发?
**A**: 当生产批次标记为COMPLETED或DELIVERED且成本计算完成后,系统会自动在后台调用AI分析服务。

### Q4: 成本计算中的人工成本是怎样计算的?
**A**:
1. 系统记录员工的实际工作时间 (batch_work_sessions)
2. 根据员工的日薪计算小时费率: 日薪 / 24
3. 将小时费率 × 实际工作小时数
4. 如果员工中途转移到其他批次,成本按比例分配

### Q5: 如果设备中途停机该怎么办?
**A**: 操作员可以:
1. 点击"暂停"(该功能可选)
2. 或完整使用周期,系统会根据实际运行时间计算成本
3. 在equipment_usage_records表中的notes字段说明停机原因

---

## 文档更新日志

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| v3.0 | 2025-11-21 | 新人详解版发布,包含完整业务流程和交叉功能说明 |

---

**文档完成日期**: 2025-11-21
**维护者**: Claude Code
**下一版本计划**: v3.1 (增加更多FAQ和故障排查指南)

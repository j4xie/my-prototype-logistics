#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate comprehensive HTML content for Chapter 3 & 4 of PRD documentation
"""

def generate_chapter3_html():
    """Generate Chapter 3 - Production Processing content"""
    return '''
            <section id="ch3">
                <h1>3. 生产加工模块</h1>

                <h2>模块描述</h2>
                <p>生产加工模块是系统的核心功能,负责管理从生产批次创建到完成的整个生产过程。该模块与考勤、设备、库存、质检等模块紧密协作,实现成本自动计算、质量控制和产能分析。</p>

                <div class="info-box">
                    <h3>核心业务流程</h3>
                    <p><strong>创建批次 → 分配物料 → 开始生产 → 实时消耗追踪 → 质检记录 → 成本汇总 → 生产完成 → AI分析</strong></p>
                </div>

                <h2>3.1 生产批次管理</h2>

                <h3>3.1.1 API端点完整列表</h3>
                <table>
                    <thead>
                        <tr>
                            <th>HTTP方法</th>
                            <th>路由</th>
                            <th>功能说明</th>
                            <th>权限要求</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/processing/batches</td>
                            <td>创建生产批次</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/processing/batches/{batchId}/start</td>
                            <td>开始生产</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/processing/batches/{batchId}/pause</td>
                            <td>暂停生产</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/processing/batches/{batchId}/complete</td>
                            <td>完成生产</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/processing/batches/{batchId}/cancel</td>
                            <td>取消生产</td>
                            <td>factory_admin+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/processing/batches</td>
                            <td>查询生产批次 (分页)</td>
                            <td>operator+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/processing/batches/{batchId}</td>
                            <td>获取批次详情</td>
                            <td>operator+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/processing/batches/{batchId}/timeline</td>
                            <td>获取批次时间线</td>
                            <td>operator+</td>
                        </tr>
                    </tbody>
                </table>

                <h3>3.1.2 生产批次数据结构</h3>
                <div class="sql-block">
<pre><code>-- production_batches 表 (生产批次主表)
CREATE TABLE production_batches (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  factory_id VARCHAR(50) NOT NULL,
  batch_number VARCHAR(50) NOT NULL UNIQUE,
  production_plan_id INT,
  product_type_id INT NOT NULL,
  product_name VARCHAR(100),

  -- 数量字段
  planned_quantity DECIMAL(12,2),
  actual_quantity DECIMAL(12,2),
  good_quantity DECIMAL(12,2),
  defect_quantity DECIMAL(12,2),
  unit VARCHAR(20) NOT NULL,

  -- 生产状态
  status VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
  -- 可选值: PLANNED(计划中), IN_PROGRESS(进行中), PAUSED(暂停),
  --        COMPLETED(完成), CANCELLED(取消)
  quality_status VARCHAR(30),

  -- 时间戳
  start_time TIMESTAMP,
  end_time TIMESTAMP,

  -- 设备和人员
  equipment_id INT,
  equipment_name VARCHAR(100),
  supervisor_id INT,
  supervisor_name VARCHAR(50),
  worker_count INT,
  work_duration_minutes INT,

  -- 成本构成 (自动计算)
  material_cost DECIMAL(12,2),
  labor_cost DECIMAL(12,2),
  equipment_cost DECIMAL(12,2),
  other_cost DECIMAL(12,2),
  total_cost DECIMAL(12,2),
  unit_cost DECIMAL(12,4),    -- total_cost / actual_quantity

  -- 计算指标
  yield_rate DECIMAL(5,2),     -- (good_quantity / actual_quantity) × 100
  efficiency DECIMAL(5,2),     -- (actual_quantity / planned_quantity) × 100

  -- 其他信息
  notes TEXT,
  created_by INT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- 索引优化
  INDEX idx_batch_factory (factory_id),
  INDEX idx_batch_number (batch_number),
  INDEX idx_batch_status (status),
  INDEX idx_batch_plan (production_plan_id),
  FOREIGN KEY (production_plan_id) REFERENCES production_plans(id)
);</code></pre>
                </div>

                <h3>3.1.3 创建批次请求/响应示例</h3>
                <div class="java-block">
<pre><code>// POST /api/mobile/{factoryId}/processing/batches
// 请求体
{
  "batchNumber": "BATCH-20251121-001",
  "productTypeId": 1,
  "productName": "番茄酱",
  "plannedQuantity": 1000.00,
  "unit": "kg",
  "supervisorId": 2,
  "equipmentId": 5,
  "notes": "使用新供应商番茄"
}

// 成功响应 (200)
{
  "code": 200,
  "message": "批次创建成功",
  "data": {
    "id": 101,
    "factoryId": "CRETAS_2024_001",
    "batchNumber": "BATCH-20251121-001",
    "productTypeId": 1,
    "productName": "番茄酱",
    "plannedQuantity": 1000.00,
    "actual_quantity": null,
    "good_quantity": null,
    "defect_quantity": null,
    "unit": "kg",
    "status": "PLANNED",
    "qualityStatus": null,
    "startTime": null,
    "endTime": null,
    "equipmentId": 5,
    "equipmentName": "搅拌机 A",
    "supervisorId": 2,
    "supervisorName": "张三",
    "workerCount": 0,
    "workDurationMinutes": 0,
    "materialCost": 0.00,
    "laborCost": 0.00,
    "equipmentCost": 0.00,
    "otherCost": 0.00,
    "totalCost": 0.00,
    "unitCost": 0.0000,
    "yieldRate": 0.00,
    "efficiency": 0.00,
    "createdAt": "2025-11-21T10:30:00",
    "updatedAt": "2025-11-21T10:30:00"
  }
}</code></pre>
                </div>

                <h3>3.1.4 开始生产 - 成本初始化</h3>
                <div class="java-block">
<pre><code>// POST /api/mobile/{factoryId}/processing/batches/{batchId}/start
// 请求参数
{
  "supervisorId": 2
}

// 成功响应 (200)
{
  "code": 200,
  "message": "生产已开始",
  "data": {
    "id": 101,
    "batchNumber": "BATCH-20251121-001",
    "status": "IN_PROGRESS",
    "startTime": "2025-11-21T10:35:00",
    "supervisorId": 2,
    "supervisorName": "张三"
  }
}

// 后端处理流程:
// 1. 更新 status = IN_PROGRESS, start_time = 当前时间
// 2. 初始化成本 = 0.00
// 3. 查询关联的材料批次 (FIFO推荐)
// 4. 返回成功响应
// 5. 后台启动成本追踪任务</code></pre>
                </div>

                <h2>3.2 物料管理与消耗追踪</h2>

                <h3>3.2.1 物料接收和消耗</h3>
                <table>
                    <thead>
                        <tr>
                            <th>API端点</th>
                            <th>功能</th>
                            <th>参数</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>POST /material-receipt</td>
                            <td>记录物料入库</td>
                            <td>MaterialBatch object</td>
                        </tr>
                        <tr>
                            <td>GET /materials</td>
                            <td>查询物料库存 (分页)</td>
                            <td>page, size</td>
                        </tr>
                        <tr>
                            <td>POST /batches/{batchId}/material-consumption</td>
                            <td>记录物料消耗</td>
                            <td>List&lt;ConsumptionRecord&gt;</td>
                        </tr>
                    </tbody>
                </table>

                <h3>3.2.2 物料消耗记录示例</h3>
                <div class="java-block">
<pre><code>// POST /api/mobile/{factoryId}/processing/batches/{batchId}/material-consumption
// 请求体 (一个批次可能消耗多种物料)
{
  "consumptions": [
    {
      "materialBatchId": "MAT-20251015-001",  // 番茄
      "quantity": 950.00,
      "unit": "kg"
    },
    {
      "materialBatchId": "MAT-20251010-005",  // 盐
      "quantity": 10.00,
      "unit": "kg"
    }
  ]
}

// 成功响应 (200)
{
  "code": 200,
  "message": "物料消耗记录成功",
  "data": {
    "batchId": "BATCH-20251121-001",
    "totalMaterialCost": 475.00,  // 950*0.5 + 10*0 (假设番茄0.5元/kg)
    "consumedMaterials": [
      {
        "materialBatchId": "MAT-20251015-001",
        "quantity": 950.00,
        "unitPrice": 0.50,
        "totalCost": 475.00
      },
      {
        "materialBatchId": "MAT-20251010-005",
        "quantity": 10.00,
        "unitPrice": 0.00,
        "totalCost": 0.00
      }
    ]
  }
}</code></pre>
                </div>

                <h2>3.3 质量检验集成</h2>

                <h3>3.3.1 质检API端点</h3>
                <table>
                    <thead>
                        <tr>
                            <th>HTTP方法</th>
                            <th>路由</th>
                            <th>功能说明</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/processing/quality/inspections</td>
                            <td>提交质检记录</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/processing/quality/inspections</td>
                            <td>查询质检记录 (分页)</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/processing/quality/statistics</td>
                            <td>质检统计报表</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/processing/quality/trends</td>
                            <td>质检趋势分析</td>
                        </tr>
                    </tbody>
                </table>

                <h3>3.3.2 质检记录数据库</h3>
                <div class="sql-block">
<pre><code>-- quality_inspections 表 (质量检验记录)
CREATE TABLE quality_inspections (
  id VARCHAR(191) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  production_batch_id VARCHAR(191) NOT NULL,
  inspector_id INT NOT NULL,
  inspection_date DATE NOT NULL,

  -- 检验结果
  sample_size DECIMAL(10,2) NOT NULL,      -- 抽样数量
  pass_count DECIMAL(10,2) NOT NULL,       -- 合格数量
  fail_count DECIMAL(10,2) NOT NULL,       -- 不合格数量
  pass_rate DECIMAL(5,2),                  -- 合格率 (%)

  -- 检验结论
  result VARCHAR(20),                      -- PASS, FAIL, NEED_RETEST
  notes TEXT,

  -- 系统字段
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_inspection_factory (factory_id),
  INDEX idx_inspection_batch (production_batch_id),
  INDEX idx_inspection_date (inspection_date),
  FOREIGN KEY (production_batch_id) REFERENCES production_batches(id)
);

-- 自动计算: pass_rate = (pass_count / sample_size) × 100
-- 判定规则: pass_rate >= 95% → PASS, else → FAIL</code></pre>
                </div>

                <h3>3.3.3 质检提交示例</h3>
                <div class="java-block">
<pre><code>// POST /api/mobile/{factoryId}/processing/quality/inspections
{
  "batchId": "BATCH-20251121-001",
  "inspectorId": 6,
  "inspectionDate": "2025-11-21",
  "sampleSize": 100,
  "passCount": 98,
  "failCount": 2,
  "notes": "色泽略浅,但在允许范围内"
}

// 成功响应
{
  "code": 200,
  "message": "质检记录已提交",
  "data": {
    "id": "QI-20251121-001",
    "batchId": "BATCH-20251121-001",
    "inspectionDate": "2025-11-21",
    "sampleSize": 100,
    "passCount": 98,
    "failCount": 2,
    "passRate": 98.00,
    "result": "PASS",
    "inspectorId": 6,
    "inspectorName": "李四",
    "notes": "色泽略浅,但在允许范围内"
  }
}

// 后端处理:
// 1. 计算 pass_rate = (98 / 100) × 100 = 98.00
// 2. 判定 result: 98.00 >= 95% → PASS
// 3. 更新批次 quality_status = result
// 4. 若 result = PASS, 则批次可以完成生产</code></pre>
                </div>

                <h2>3.4 成本自动计算</h2>

                <h3>3.4.1 成本计算公式</h3>
                <pre><code>成本构成:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 原料成本 (Material Cost)
   formula: 消耗物料的单价 × 消耗数量
   example: 番茄0.5元/kg × 950kg = 475元

2. 人工成本 (Labor Cost)
   formula: Σ(员工日薪 / 24 × 工作时长(小时))
   example: 5个工人, 日薪300元, 工作8小时
            = 5 × (300/24) × 8 = 5000元

3. 设备成本 (Equipment Cost)
   formula: Σ(设备年折旧 / 365 × 运行天数)
   example: 搅拌机年折旧2000元, 运行0.5天
            = 2000/365 × 0.5 = 2.74元

4. 其他成本 (Other Cost)
   formula: 人工配置的杂费
   example: 水电费、包装费等

总成本 = Material + Labor + Equipment + Other
单位成本 = 总成本 / 实际产量

示例计算:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
生产批次: BATCH-20251121-001
计划产量: 1000kg
实际产量: 990kg (丢失10kg)
良品数: 975kg
不合格: 15kg

原料成本:    475.00元 (番茄950kg × 0.5元/kg)
人工成本:  5000.00元
设备成本:     2.74元
其他成本:   100.00元
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
总成本:    5577.74元
单位成本:     5.64元/kg (5577.74 / 990)</code></pre>

                <h3>3.4.2 成本计算API</h3>
                <div class="java-block">
<pre><code>// GET /api/mobile/{factoryId}/processing/batches/{batchId}/cost-analysis
// 无需请求参数

{
  "code": 200,
  "message": "成本分析获取成功",
  "data": {
    "batchNumber": "BATCH-20251121-001",
    "plannedQuantity": 1000.00,
    "actualQuantity": 990.00,
    "goodQuantity": 975.00,
    "defectQuantity": 15.00,

    "costBreakdown": {
      "materialCost": 475.00,
      "laborCost": 5000.00,
      "equipmentCost": 2.74,
      "otherCost": 100.00,
      "totalCost": 5577.74
    },

    "unitCost": 5.64,
    "yieldRate": 98.48,        // (975 / 990) × 100
    "efficiency": 99.00,        // (990 / 1000) × 100

    "costDetails": {
      "materials": [
        {
          "materialName": "番茄",
          "quantity": 950.00,
          "unitPrice": 0.50,
          "cost": 475.00
        }
      ],
      "labor": {
        "workers": 5,
        "totalHours": 40.0,
        "dailySalary": 300.00,
        "cost": 5000.00
      },
      "equipment": {
        "equipmentId": 5,
        "equipmentName": "搅拌机 A",
        "annualDepreciation": 2000.00,
        "daysUsed": 0.5,
        "cost": 2.74
      }
    }
  }
}</code></pre>
                </div>

                <h2>3.5 生产仪表板</h2>

                <h3>3.5.1 仪表板API</h3>
                <table>
                    <thead>
                        <tr>
                            <th>端点</th>
                            <th>说明</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>GET /dashboard/overview</td>
                            <td>生产概览 (KPI汇总)</td>
                        </tr>
                        <tr>
                            <td>GET /dashboard/production</td>
                            <td>生产统计 (按时间聚合)</td>
                        </tr>
                        <tr>
                            <td>GET /dashboard/quality</td>
                            <td>质量仪表板 (检测通过率)</td>
                        </tr>
                        <tr>
                            <td>GET /dashboard/equipment</td>
                            <td>设备仪表板 (运行状态)</td>
                        </tr>
                        <tr>
                            <td>GET /dashboard/alerts</td>
                            <td>告警仪表板 (异常提示)</td>
                        </tr>
                        <tr>
                            <td>GET /dashboard/trends</td>
                            <td>趋势分析 (历史对比)</td>
                        </tr>
                    </tbody>
                </table>

                <h3>3.5.2 仪表板数据示例</h3>
                <div class="java-block">
<pre><code>// GET /api/mobile/{factoryId}/processing/dashboard/overview

{
  "code": 200,
  "data": {
    "summary": {
      "completedBatchesToday": 3,
      "inProgressBatches": 2,
      "plannedBatches": 5,
      "totalProductionToday": 2500.00,
      "defectRateToday": 1.50,
      "averageUnitCost": 5.42
    },

    "qualityMetrics": {
      "passRate": 98.50,
      "inspectionsDoneToday": 5,
      "defectiveBatches": 0,
      "criticalIssues": 0
    },

    "equipmentStatus": {
      "totalEquipment": 8,
      "running": 4,
      "idle": 3,
      "maintenance": 1,
      "alerts": 2
    },

    "costMetrics": {
      "totalCostToday": 13710.00,
      "averageCostPerBatch": 4570.00,
      "laborCostPercentage": 73.0,
      "materialCostPercentage": 18.0,
      "equipmentCostPercentage": 8.0,
      "otherCostPercentage": 1.0
    }
  }
}</code></pre>
                </div>

                <h2>3.6 生产计划管理</h2>

                <h3>3.6.1 生产计划API</h3>
                <table>
                    <thead>
                        <tr>
                            <th>HTTP方法</th>
                            <th>路由</th>
                            <th>说明</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/production-plans</td>
                            <td>创建生产计划</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/production-plans</td>
                            <td>查询计划列表</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/production-plans/{planId}</td>
                            <td>获取计划详情</td>
                        </tr>
                        <tr>
                            <td>PUT</td>
                            <td>/api/mobile/{factoryId}/production-plans/{planId}</td>
                            <td>更新生产计划</td>
                        </tr>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/production-plans/{planId}/start</td>
                            <td>开始执行计划</td>
                        </tr>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/production-plans/{planId}/complete</td>
                            <td>完成计划</td>
                        </tr>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/production-plans/{planId}/cancel</td>
                            <td>取消计划</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/production-plans/pending-execution</td>
                            <td>获取待执行计划</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/production-plans/today</td>
                            <td>获取今日计划</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/production-plans/statistics</td>
                            <td>生产统计 (按日期范围)</td>
                        </tr>
                    </tbody>
                </table>

                <h2>3.7 后端Service方法</h2>

                <h3>3.7.1 ProcessingService 接口</h3>
                <div class="java-block">
<pre><code>public interface ProcessingService {

    // ===== 批次管理 =====
    ProductionBatch createBatch(String factoryId, ProductionBatch batch);
    ProductionBatch startProduction(String factoryId, String batchId, Integer supervisorId);
    ProductionBatch pauseProduction(String factoryId, String batchId, String reason);
    ProductionBatch completeProduction(String factoryId, String batchId,
                                      BigDecimal actualQty, BigDecimal goodQty, BigDecimal defectQty);
    ProductionBatch cancelProduction(String factoryId, String batchId, String reason);
    ProductionBatch getBatchById(String factoryId, String batchId);
    PageResponse<ProductionBatch> getBatches(String factoryId, String status, PageRequest pageRequest);
    List<Map<String, Object>> getBatchTimeline(String factoryId, String batchId);

    // ===== 物料管理 =====
    MaterialBatch createMaterialReceipt(String factoryId, MaterialBatch materialBatch);
    PageResponse<MaterialBatch> getMaterialReceipts(String factoryId, PageRequest pageRequest);
    MaterialBatch updateMaterialReceipt(String factoryId, String batchId, MaterialBatch updates);
    void recordMaterialConsumption(String factoryId, String productionBatchId,
                                  List<Map<String, Object>> consumptions);

    // ===== 质检管理 =====
    Map<String, Object> submitInspection(String factoryId, String batchId, Map<String, Object> inspection);
    PageResponse<Map<String, Object>> getInspections(String factoryId, String batchId, PageRequest pageRequest);
    Map<String, Object> getQualityStatistics(String factoryId, LocalDate startDate, LocalDate endDate);
    List<Map<String, Object>> getQualityTrends(String factoryId, Integer days);

    // ===== 成本分析 =====
    Map<String, Object> getBatchCostAnalysis(String factoryId, String batchId);
    ProductionBatch recalculateBatchCost(String factoryId, String batchId);

    // ===== 仪表板 =====
    Map<String, Object> getDashboardOverview(String factoryId);
    Map<String, Object> getProductionStatistics(String factoryId, String period);
    Map<String, Object> getQualityDashboard(String factoryId);
    Map<String, Object> getEquipmentDashboard(String factoryId);
    Map<String, Object> getTrendAnalysis(String factoryId, String metric, Integer days);
}</code></pre>
                </div>

                <h2>3.8 前端Screen映射</h2>
                <table>
                    <thead>
                        <tr>
                            <th>文件名</th>
                            <th>功能说明</th>
                            <th>关键特性</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><code>ProcessingDashboard.tsx</code></td>
                            <td>生产模块主界面</td>
                            <td>总览卡片、统计数据、快速操作</td>
                        </tr>
                        <tr>
                            <td><code>CreateBatchScreen.tsx</code></td>
                            <td>创建生产批次</td>
                            <td>表单输入、物料选择、验证</td>
                        </tr>
                        <tr>
                            <td><code>BatchListScreen.tsx</code></td>
                            <td>批次列表</td>
                            <td>分页、状态筛选、搜索</td>
                        </tr>
                        <tr>
                            <td><code>BatchDetailScreen.tsx</code></td>
                            <td>批次详情</td>
                            <td>完整信息、时间线、成本分解</td>
                        </tr>
                        <tr>
                            <td><code>CreateQualityRecordScreen.tsx</code></td>
                            <td>质检记录输入</td>
                            <td>样本量、合格数、备注</td>
                        </tr>
                        <tr>
                            <td><code>QualityInspectionListScreen.tsx</code></td>
                            <td>质检记录列表</td>
                            <td>日期范围、合格率显示</td>
                        </tr>
                        <tr>
                            <td><code>QualityAnalyticsScreen.tsx</code></td>
                            <td>质量分析</td>
                            <td>趋势图表、KPI、缺陷分布</td>
                        </tr>
                        <tr>
                            <td><code>MaterialReceiptScreen.tsx</code></td>
                            <td>物料入库</td>
                            <td>批号录入、数量验证、供应商</td>
                        </tr>
                        <tr>
                            <td><code>CostAnalysisDashboard.tsx</code></td>
                            <td>成本分析</td>
                            <td>成本拆分图表、单位成本、对比</td>
                        </tr>
                        <tr>
                            <td><code>ProductionPlanManagementScreen.tsx</code></td>
                            <td>生产计划</td>
                            <td>计划创建、执行、统计</td>
                        </tr>
                    </tbody>
                </table>
            </section>
'''

def generate_chapter4_html():
    """Generate Chapter 4 - AI Analysis content"""
    return '''
            <section id="ch4">
                <h1>4. AI智能分析模块</h1>

                <h2>模块描述</h2>
                <p>AI智能分析模块集成DeepSeek大语言模型,为生产管理提供智能决策支持。通过分析历史生产数据、成本构成、质量指标等,为管理者提供可操作的优化建议和成本控制方案。该模块采用配额管理制度、多层缓存机制和详细的审计日志。</p>

                <div class="info-box">
                    <h3>核心特性</h3>
                    <p><strong>智能分析 | 配额管理 | 7天缓存 | AI分析追问 | 周/月报告 | 历史综合分析</strong></p>
                </div>

                <h2>4.1 AI分析功能</h2>

                <h3>4.1.1 三层分析模式</h3>
                <table>
                    <thead>
                        <tr>
                            <th>分析模式</th>
                            <th>说明</th>
                            <th>配额消耗</th>
                            <th>缓存时间</th>
                            <th>用途</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>默认分析</strong></td>
                            <td>首次分析单个批次或时间段</td>
                            <td>1单位</td>
                            <td>7天</td>
                            <td>快速获取单批成本分析</td>
                        </tr>
                        <tr>
                            <td><strong>追问(对话)</strong></td>
                            <td>在分析结果基础上继续提问</td>
                            <td>1单位</td>
                            <td>7天</td>
                            <td>深入探讨优化方案</td>
                        </tr>
                        <tr>
                            <td><strong>历史综合</strong></td>
                            <td>跨多批次、多周期深度分析</td>
                            <td>5单位</td>
                            <td>90天</td>
                            <td>长期趋势、根本原因分析</td>
                        </tr>
                    </tbody>
                </table>

                <h3>4.1.2 AI分析API端点</h3>
                <table>
                    <thead>
                        <tr>
                            <th>HTTP方法</th>
                            <th>路由</th>
                            <th>说明</th>
                            <th>配额消耗</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/ai/analysis/cost/batch</td>
                            <td>分析单个批次成本</td>
                            <td>1单位</td>
                        </tr>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/ai/analysis/cost/time-range</td>
                            <td>分析时间段内成本</td>
                            <td>1单位</td>
                        </tr>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/ai/analysis/cost/compare</td>
                            <td>对比分析多批次</td>
                            <td>1单位</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/ai/quota</td>
                            <td>查看配额剩余</td>
                            <td>0单位</td>
                        </tr>
                        <tr>
                            <td>PUT</td>
                            <td>/api/mobile/{factoryId}/ai/quota</td>
                            <td>更新配额限制 (仅管理员)</td>
                            <td>0单位</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/ai/conversations/{sessionId}</td>
                            <td>获取对话历史</td>
                            <td>0单位</td>
                        </tr>
                        <tr>
                            <td>DELETE</td>
                            <td>/api/mobile/{factoryId}/ai/conversations/{sessionId}</td>
                            <td>关闭对话会话</td>
                            <td>0单位</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/ai/reports</td>
                            <td>列表查询AI报告</td>
                            <td>0单位</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/ai/reports/{reportId}</td>
                            <td>获取报告详情</td>
                            <td>0单位</td>
                        </tr>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/ai/reports/generate</td>
                            <td>生成新报告</td>
                            <td>5单位</td>
                        </tr>
                    </tbody>
                </table>

                <h3>4.1.3 批次分析请求/响应示例</h3>
                <div class="java-block">
<pre><code>// POST /api/mobile/{factoryId}/ai/analysis/cost/batch
{
  "batchId": "BATCH-20251121-001",
  "dimension": "cost_breakdown"  // 分析维度
}

// 成功响应 (200) - 使用AI生成的分析
{
  "code": 200,
  "message": "分析成功",
  "data": {
    "batchId": "BATCH-20251121-001",
    "batchNumber": "BATCH-20251121-001",
    "analysisType": "cost_breakdown",
    "sessionId": "SESSION-20251121-001",
    "cachedResult": false,           // 首次分析,未使用缓存
    "analysisText": "# 批次 BATCH-20251121-001 成本分析\\n\\n## 概述\\n该批次生产1000kg番茄酱,实际产量990kg,良品率98.48%。总成本5577.74元,单位成本5.64元/kg。\\n\\n## 成本构成分析\\n\\n### 原料成本: 475.00元 (8.5%)\\n- 番茄950kg × 0.5元/kg = 475元\\n- 占比最低,原料成本较为经济\\n\\n### 人工成本: 5000.00元 (89.6%)\\n- 5个工人 × 300元/天 = 1500元\\n- 实际工时:40小时 = 5000元\\n- 占比最高,是主要成本项\\n\\n## 优化建议\\n\\n1. **人工成本优化** (可减少20%)\\n   - 考虑自动化设备投入\\n   - 优化工作流程,提高效率\\n   - 预计可每批节省1000元\\n\\n2. **设备费用** (目前仅2.74元)\\n   - 设备利用率较高\\n   - 维护成本在合理范围内\\n\\n3. **良品率提升** (98.48%)\\n   - 已接近目标值(98%)\\n   - 建议维持当前质检标准\\n\\n## 成本对标\\n\\n与近期批次平均值对比:\\n- 单位成本: 5.64元/kg (平均5.42元/kg)\\n- 差异: +0.22元/kg (+4.1%)\\n- 主要原因: 本批次工作用时略长(40小时 vs 平均38小时)\\n\\n## 历史趋势\\n\\n过去7天单位成本变化:\\n- 11月14日: 5.50元/kg\\n- 11月15日: 5.48元/kg\\n- 11月16日: 5.40元/kg\\n- 11月17日: 5.42元/kg\\n- 11月18日: 5.45元/kg\\n- 11月19日: 5.43元/kg\\n- 11月21日: 5.64元/kg (今日)\\n\\n**结论**: 整体成本保持稳定,小幅上升可能与季节性因素相关。",
    "quotaUsed": 1,
    "remainingQuota": 99,
    "analysisTime": "2025-11-21T14:30:00"
  }
}</code></pre>
                </div>

                <h2>4.2 配额管理系统</h2>

                <h3>4.2.1 配额模型</h3>
                <div class="info-box">
                    <h3>配额规则</h3>
                    <ul>
                        <li><strong>周配额</strong>: 100分析单位</li>
                        <li><strong>重置时间</strong>: 每周一 00:00 (UTC)</li>
                        <li><strong>消耗规则</strong>:
                            <ul>
                                <li>默认分析: 1单位/次</li>
                                <li>追问: 1单位/次</li>
                                <li>历史综合: 5单位/次</li>
                            </ul>
                        </li>
                        <li><strong>超额处理</strong>: 当配额用尽,无法进行新的AI分析,但可访问缓存结果</li>
                    </ul>
                </div>

                <h3>4.2.2 配额查询API</h3>
                <div class="java-block">
<pre><code>// GET /api/mobile/{factoryId}/ai/quota

{
  "code": 200,
  "data": {
    "factoryId": "CRETAS_2024_001",
    "weekOf": "2025-11-17",              // 本周起始日期
    "totalAllowance": 100,
    "used": 15,
    "remaining": 85,
    "lastResetTime": "2025-11-17T00:00:00",
    "nextResetTime": "2025-11-24T00:00:00",
    "daysUntilReset": 3,
    "usageHistory": [
      {
        "date": "2025-11-21",
        "used": 5,
        "details": [
          { "type": "batch_analysis", "count": 3, "quota": 3 },
          { "type": "follow_up_questions", "count": 2, "quota": 2 }
        ]
      },
      {
        "date": "2025-11-20",
        "used": 10,
        "details": [
          { "type": "batch_analysis", "count": 8, "quota": 8 },
          { "type": "historical_report", "count": 1, "quota": 5 }
        ]
      }
    ]
  }
}</code></pre>
                </div>

                <h2>4.3 缓存机制与存储</h2>

                <h3>4.3.1 缓存策略</h3>
                <table>
                    <thead>
                        <tr>
                            <th>报告类型</th>
                            <th>TTL</th>
                            <th>缓存键组合</th>
                            <th>说明</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>batch (单批)</td>
                            <td>7天</td>
                            <td>factoryId + batchId + questionType</td>
                            <td>同问题重复查询返回缓存</td>
                        </tr>
                        <tr>
                            <td>weekly (周报)</td>
                            <td>30天</td>
                            <td>factoryId + weekStartDate</td>
                            <td>每周一自动生成,周内复用</td>
                        </tr>
                        <tr>
                            <td>monthly (月报)</td>
                            <td>90天</td>
                            <td>factoryId + monthStartDate</td>
                            <td>每月1日自动生成</td>
                        </tr>
                        <tr>
                            <td>historical (历史)</td>
                            <td>90天</td>
                            <td>factoryId + periodStart + periodEnd</td>
                            <td>跨度>30天的分析</td>
                        </tr>
                    </tbody>
                </table>

                <h3>4.3.2 缓存数据表</h3>
                <div class="sql-block">
<pre><code>-- ai_analysis_results 表 (AI分析结果缓存)
CREATE TABLE ai_analysis_results (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  factory_id VARCHAR(50) NOT NULL,
  batch_id VARCHAR(50),
  report_type VARCHAR(20) NOT NULL,
  -- 报告类型: batch, weekly, monthly, historical

  analysis_text LONGTEXT,               -- Markdown格式的分析结果
  session_id VARCHAR(100),
  period_start TIMESTAMP,
  period_end TIMESTAMP,

  expires_at TIMESTAMP NOT NULL,        -- 缓存过期时间
  is_auto_generated BOOLEAN DEFAULT FALSE,

  -- 使用统计
  view_count INT DEFAULT 0,             -- 被查看的次数
  last_viewed_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_factory_type_expires (factory_id, report_type, expires_at),
  INDEX idx_batch_id (batch_id),
  INDEX idx_factory_batch (factory_id, batch_id),
  INDEX idx_session_id (session_id)
);

-- ai_quota_usage 表 (配额使用追踪)
CREATE TABLE ai_quota_usage (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  factory_id VARCHAR(50) NOT NULL,
  week_of DATE NOT NULL,

  total_allowance INT DEFAULT 100,      -- 本周配额总额
  used INT DEFAULT 0,                   -- 已使用量
  remaining INT DEFAULT 100,            -- 剩余量

  last_reset TIMESTAMP,                 -- 上次重置时间
  last_request_time TIMESTAMP,          -- 上次请求时间

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_factory_week (factory_id, week_of)
);

-- ai_audit_logs 表 (审计日志)
CREATE TABLE ai_audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  factory_id VARCHAR(50) NOT NULL,
  user_id BIGINT,

  request_type VARCHAR(50),             -- batch_analysis, follow_up, historical_report
  question TEXT,
  dimension VARCHAR(100),

  cache_hit BOOLEAN,                    -- 是否使用缓存
  response_time_ms LONG,                -- 响应时间(毫秒)
  quota_consumed INT,

  success BOOLEAN,
  error_message VARCHAR(500),

  request_timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_factory_user_time (factory_id, user_id, request_timestamp),
  INDEX idx_factory_type (factory_id, request_type)
);</code></pre>
                </div>

                <h2>4.4 前端集成</h2>

                <h3>4.4.1 AI分析相关Screen</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Screen文件</th>
                            <th>功能</th>
                            <th>关键组件</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><code>DeepSeekAnalysisScreen.tsx</code></td>
                            <td>主分析界面</td>
                            <td>分析选择器、结果展示、追问输入</td>
                        </tr>
                        <tr>
                            <td><code>CostAnalysisDashboard.tsx</code></td>
                            <td>成本分析概览</td>
                            <td>成本拆分、趋势图、AI建议卡片</td>
                        </tr>
                        <tr>
                            <td><code>AIAnalysisDetailScreen.tsx</code></td>
                            <td>详细分析报告</td>
                            <td>完整Markdown渲染、导出功能</td>
                        </tr>
                        <tr>
                            <td><code>AIReportListScreen.tsx</code></td>
                            <td>报告列表</td>
                            <td>按类型分类、日期筛选、缓存标记</td>
                        </tr>
                        <tr>
                            <td><code>AIConversationHistoryScreen.tsx</code></td>
                            <td>对话历史</td>
                            <td>会话列表、消息回放、导出</td>
                        </tr>
                        <tr>
                            <td><code>TimeRangeCostAnalysisScreen.tsx</code></td>
                            <td>时间段分析</td>
                            <td>日期范围选择、维度对比</td>
                        </tr>
                    </tbody>
                </table>

                <h3>4.4.2 配额提示UI</h3>
                <pre><code>前端配额状态提示规则:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
剩余配额 | 提示颜色 | 提示文案
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
> 50   | 绿色    | ✓ 配额充足 (XX单位)
20-50  | 黄色    | ⚠ 配额紧张 (XX单位)
< 20   | 红色    | ⚠ 配额即将用尽 (XX单位)
0      | 灰色    | ✗ 本周配额已用尽
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

配额超限处理:
1. 禁用新分析按钮,但可查看历史缓存
2. 显示"配额用尽,下周一自动恢复"提示
3. 提供"升级配额"按钮(仅管理员可操作)</code></pre>

                <h2>4.5 报告自动生成</h2>

                <h3>4.5.1 自动生成规则</h3>
                <table>
                    <thead>
                        <tr>
                            <th>报告类型</th>
                            <th>生成触发</th>
                            <th>执行时间</th>
                            <th>配额消耗</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>周报告</td>
                            <td>每周一自动</td>
                            <td>00:00 UTC</td>
                            <td>1单位</td>
                        </tr>
                        <tr>
                            <td>月报告</td>
                            <td>每月1日自动</td>
                            <td>00:00 UTC</td>
                            <td>5单位</td>
                        </tr>
                        <tr>
                            <td>批次分析</td>
                            <td>用户按需请求</td>
                            <td>实时</td>
                            <td>1单位</td>
                        </tr>
                    </tbody>
                </table>

                <h2>4.6 错误处理</h2>

                <h3>4.6.1 异常场景</h3>
                <div class="java-block">
<pre><code>// 场景1: 配额用尽
{
  "code": 429,
  "message": "本周AI分析配额已用尽,请等待下周一恢复",
  "data": {
    "remainingQuota": 0,
    "nextResetTime": "2025-11-24T00:00:00",
    "retryAfter": 259200,  // 3天(秒数)
    "suggestion": "您可以查看历史分析结果或联系管理员申请配额提升"
  }
}

// 场景2: AI服务超时
{
  "code": 504,
  "message": "AI分析服务超时,返回缓存结果",
  "data": {
    "batchId": "BATCH-20251121-001",
    "cachedResult": true,
    "cacheAge": "2 hours ago",
    "note": "返回的是2小时前的缓存分析,最新数据可能有变化"
  }
}

// 场景3: DeepSeek API失败
{
  "code": 502,
  "message": "暂时无法进行AI分析,建议稍后重试",
  "data": {
    "retryAfter": 300,    // 5分钟后重试
    "suggestion": "可查看该批次的历史分析缓存"
  }
}</code></pre>
                </div>

                <h2>4.7 数据流与集成</h2>

                <h3>4.7.1 AI分析触发链</h3>
                <pre><code>生产流程 → AI分析触发
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 批次完成 (status = COMPLETED)
   ↓
2. 成本计算完成 (total_cost ≠ null)
   ↓
3. 质检通过 (quality_status = PASS)
   ↓
4. 后台自动触发 AI 分析
   (请求队列,异步处理,不阻塞前端)
   ↓
5. AI 结果保存到 ai_analysis_results (缓存7天)
   ↓
6. 前端自动刷新,用户看到分析结果</code></pre>

                <h3>4.7.2 缓存命中判定逻辑</h3>
                <pre><code>检查顺序:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

输入: batchId, dimension, sessionId

1. 检查会话缓存 (SESSION级别)
   如果 sessionId 存在且记录在缓存中 → 返回缓存结果

2. 检查批次缓存 (BATCH级别)
   如果 [factoryId + batchId + dimension] 存在且未过期 → 返回缓存结果

3. 检查周报缓存 (WEEKLY级别)
   如果请求是"本周数据分析" → 查找周报缓存

4. 都未命中
   调用 AI 服务生成新分析 → 消耗配额 → 保存缓存</code></pre>
            </section>
'''

# Main generation function
if __name__ == '__main__':
    ch3 = generate_chapter3_html()
    ch4 = generate_chapter4_html()

    print("Generated HTML for Chapters 3-4")
    print(f"Chapter 3 length: {len(ch3)} characters")
    print(f"Chapter 4 length: {len(ch4)} characters")

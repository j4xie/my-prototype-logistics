#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate comprehensive HTML content for Chapter 5 & 6 of PRD documentation
"""

def generate_chapter5_html():
    """Generate Chapter 5 - Equipment Management content"""
    return '''
            <section id="ch5">
                <h1>5. 设备管理模块</h1>

                <h2>模块描述</h2>
                <p>设备管理模块负责跟踪工厂所有生产设备的生命周期,包括设备信息维护、运行监控、维护计划管理、折旧计算和告警。该模块与生产模块紧密协作,自动记录设备使用时间并计算折旧成本。</p>

                <div class="info-box">
                    <h3>核心功能</h3>
                    <p><strong>设备台账 | 运行监控 | 维护管理 | 折旧计算 | 告警系统 | 导入导出</strong></p>
                </div>

                <h2>5.1 设备管理API</h2>

                <h3>5.1.1 完整API端点列表</h3>
                <table>
                    <thead>
                        <tr>
                            <th>HTTP方法</th>
                            <th>路由</th>
                            <th>说明</th>
                            <th>权限</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/equipment</td>
                            <td>创建新设备</td>
                            <td>factory_admin+</td>
                        </tr>
                        <tr>
                            <td>PUT</td>
                            <td>/api/mobile/{factoryId}/equipment/{equipmentId}</td>
                            <td>更新设备信息</td>
                            <td>factory_admin+</td>
                        </tr>
                        <tr>
                            <td>DELETE</td>
                            <td>/api/mobile/{factoryId}/equipment/{equipmentId}</td>
                            <td>删除设备</td>
                            <td>factory_admin+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/equipment</td>
                            <td>查询设备列表 (分页)</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/equipment/{equipmentId}</td>
                            <td>获取设备详情</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/equipment/status/{status}</td>
                            <td>按状态筛选设备</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/equipment/type/{type}</td>
                            <td>按类型筛选设备</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/equipment/search</td>
                            <td>搜索设备</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>PUT</td>
                            <td>/api/mobile/{factoryId}/equipment/{equipmentId}/status</td>
                            <td>更新设备状态</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/equipment/{equipmentId}/start</td>
                            <td>设备启动</td>
                            <td>operator+</td>
                        </tr>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/equipment/{equipmentId}/stop</td>
                            <td>设备停止</td>
                            <td>operator+</td>
                        </tr>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/equipment/{equipmentId}/maintenance</td>
                            <td>记录维护</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/equipment/needing-maintenance</td>
                            <td>需要维护的设备</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/equipment/expiring-warranty</td>
                            <td>保修期将过期的设备</td>
                            <td>factory_admin+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/equipment/{equipmentId}/depreciated-value</td>
                            <td>获取折旧后价值</td>
                            <td>factory_admin+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/equipment/{equipmentId}/statistics</td>
                            <td>设备统计信息</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/equipment/{equipmentId}/usage-history</td>
                            <td>使用历史记录</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/equipment/{equipmentId}/maintenance-history</td>
                            <td>维护历史记录</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/equipment/overall-statistics</td>
                            <td>全厂设备统计</td>
                            <td>factory_admin+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/equipment/{equipmentId}/efficiency-report</td>
                            <td>效率报告</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/equipment/{equipmentId}/oee</td>
                            <td>OEE计算</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/equipment/import</td>
                            <td>导入Excel</td>
                            <td>factory_admin+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/equipment/export</td>
                            <td>导出设备列表</td>
                            <td>factory_admin+</td>
                        </tr>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/equipment/{equipmentId}/scrap</td>
                            <td>报废设备</td>
                            <td>factory_admin+</td>
                        </tr>
                    </tbody>
                </table>

                <h3>5.1.2 设备数据库表</h3>
                <div class="sql-block">
<pre><code>-- equipment 表 (设备主表)
CREATE TABLE equipment (
  id INT PRIMARY KEY AUTO_INCREMENT,
  factory_id VARCHAR(50) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50),                 -- 设备类别(搅拌机、烘干机等)
  model VARCHAR(100),
  manufacturer VARCHAR(100),
  purchase_date DATE,
  purchase_price DECIMAL(10,2),

  -- 设备状态
  status VARCHAR(20) NOT NULL DEFAULT 'idle',
  -- 可选值: idle(闲置), running(运行中), maintenance(维护中), scrapped(报废)

  location VARCHAR(100),
  total_operating_hours INT DEFAULT 0,  -- 累计运行时间(小时)

  -- 维护相关
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  maintenance_interval_days INT,        -- 维护间隔(天数)
  maintenance_notes TEXT,

  -- 状态
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_factory_code (factory_id, code),
  INDEX idx_equipment_factory (factory_id),
  INDEX idx_equipment_status (status),
  INDEX idx_equipment_maintenance (next_maintenance_date)
);

-- equipment_maintenance 表 (维护记录)
CREATE TABLE equipment_maintenance (
  id INT PRIMARY KEY AUTO_INCREMENT,
  equipment_id INT NOT NULL,
  maintenance_type VARCHAR(50) NOT NULL,
  -- 可选值: routine(定期维护), repair(维修), overhaul(大修)

  maintenance_date DATE NOT NULL,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  description TEXT,
  cost DECIMAL(10,2),
  performed_by VARCHAR(100),
  next_maintenance_date DATE,
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_maintenance_equipment (equipment_id),
  INDEX idx_maintenance_date (maintenance_date),
  FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
);

-- equipment_usage 表 (使用记录)
CREATE TABLE equipment_usage (
  id INT PRIMARY KEY AUTO_INCREMENT,
  equipment_id INT NOT NULL,
  batch_id VARCHAR(191),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  running_hours INT,
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_usage_equipment (equipment_id),
  INDEX idx_usage_batch (batch_id),
  FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
);

-- equipment_alerts 表 (告警记录)
CREATE TABLE equipment_alerts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  factory_id VARCHAR(50) NOT NULL,
  equipment_id INT NOT NULL,
  alert_type VARCHAR(50) NOT NULL,
  -- 可选值: maintenance_due, warranty_expiring, high_hours, temperature, pressure等

  level VARCHAR(20) NOT NULL,
  -- 可选值: low, medium, high, critical

  message VARCHAR(500),
  triggered_at TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  -- 可选值: active(活跃), acknowledged(已确认), resolved(已解决), ignored(已忽略)

  resolved_at TIMESTAMP,
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_factory_equipment_status (factory_id, equipment_id, status),
  INDEX idx_triggered_at (triggered_at),
  FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
);</code></pre>
                </div>

                <h2>5.2 设备创建与维护</h2>

                <h3>5.2.1 创建设备请求示例</h3>
                <div class="java-block">
<pre><code>// POST /api/mobile/{factoryId}/equipment
{
  "code": "EQP-001",
  "name": "搅拌机 A",
  "category": "搅拌机",
  "model": "KMC-500",
  "manufacturer": "某知名品牌",
  "purchaseDate": "2023-05-15",
  "purchasePrice": 50000.00,
  "location": "1号生产车间",
  "maintenanceIntervalDays": 30,
  "notes": "用于番茄酱搅拌,效率高"
}

// 成功响应 (201)
{
  "code": 201,
  "message": "设备创建成功",
  "data": {
    "id": 1,
    "factoryId": "CRETAS_2024_001",
    "code": "EQP-001",
    "name": "搅拌机 A",
    "category": "搅拌机",
    "model": "KMC-500",
    "manufacturer": "某知名品牌",
    "purchaseDate": "2023-05-15",
    "purchasePrice": 50000.00,
    "status": "idle",
    "location": "1号生产车间",
    "totalOperatingHours": 0,
    "lastMaintenanceDate": null,
    "nextMaintenanceDate": "2025-12-21",
    "maintenanceIntervalDays": 30,
    "isActive": true,
    "createdAt": "2025-11-21T11:00:00"
  }
}</code></pre>
                </div>

                <h3>5.2.2 设备启停与维护</h3>
                <div class="java-block">
<pre><code>// POST /api/mobile/{factoryId}/equipment/{equipmentId}/start
{
  "batchId": "BATCH-20251121-001"
}

// 响应
{
  "code": 200,
  "message": "设备已启动",
  "data": {
    "equipmentId": 1,
    "status": "running",
    "startTime": "2025-11-21T14:00:00",
    "batchId": "BATCH-20251121-001"
  }
}

// ==========================================

// POST /api/mobile/{factoryId}/equipment/{equipmentId}/stop
{
  "runningHours": 2
}

// 响应: 设备停止,总运行时间更新
{
  "code": 200,
  "message": "设备已停止",
  "data": {
    "equipmentId": 1,
    "status": "idle",
    "endTime": "2025-11-21T16:00:00",
    "sessionRunningHours": 2,
    "totalOperatingHours": 1245  // 累计时间
  }
}

// ==========================================

// POST /api/mobile/{factoryId}/equipment/{equipmentId}/maintenance
{
  "maintenanceType": "routine",
  "maintenanceDate": "2025-11-21",
  "description": "更换橡皮垫、清洗内部",
  "cost": 500.00,
  "performedBy": "张三"
}

// 响应: 维护记录创建,自动计算下次维护日期
{
  "code": 200,
  "message": "维护记录已创建",
  "data": {
    "maintenanceId": 15,
    "equipmentId": 1,
    "maintenanceType": "routine",
    "maintenanceDate": "2025-11-21",
    "cost": 500.00,
    "performedBy": "张三",
    "nextMaintenanceDate": "2025-12-21",  // 自动计算
    "createdAt": "2025-11-21T14:30:00"
  }
}</code></pre>
                </div>

                <h2>5.3 折旧计算</h2>

                <h3>5.3.1 折旧公式</h3>
                <pre><code>直线折旧法 (Linear Depreciation Method)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

基本公式:
年折旧额 = (购置价格 - 残值) / 使用年限

日折旧额 = 年折旧额 / 365

运行折旧 = 日折旧额 × 运行天数

示例:
购置价格: 50,000元
残值: 5,000元
使用年限: 5年

年折旧额 = (50,000 - 5,000) / 5 = 9,000元/年
日折旧额 = 9,000 / 365 = 24.66元/天
时折旧 = 24.66 / 24 = 1.03元/小时

若该批次设备运行2小时:
批次设备成本 = 1.03 × 2 = 2.06元</code></pre>

                <h3>5.3.2 折旧查询API</h3>
                <div class="java-block">
<pre><code>// GET /api/mobile/{factoryId}/equipment/{equipmentId}/depreciated-value

{
  "code": 200,
  "data": {
    "equipmentId": 1,
    "code": "EQP-001",
    "name": "搅拌机 A",
    "purchasePrice": 50000.00,
    "purchaseDate": "2023-05-15",

    "depreciationModel": "linear",
    "usefulLifeYears": 5,
    "estimatedScrapValue": 5000.00,

    "annualDepreciation": 9000.00,
    "totalDepreciationToDate": 18000.00,  // 2年已折旧
    "netBookValue": 32000.00,             // 50000 - 18000
    "depreciationRatePercentage": 36.0,   // 18000 / 50000

    "monthlyDepreciation": 750.00,
    "hourlyDepreciation": 1.03,

    "totalOperatingHours": 1245,
    "depreciationByUsage": 1282.35,       // 1.03 × 1245

    "reportDate": "2025-11-21"
  }
}</code></pre>
                </div>

                <h2>5.4 设备告警系统</h2>

                <h3>5.4.1 告警类型与规则</h3>
                <table>
                    <thead>
                        <tr>
                            <th>告警类型</th>
                            <th>触发条件</th>
                            <th>告警级别</th>
                            <th>处理方式</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>维护超期</td>
                            <td>当前日期 >= nextMaintenanceDate</td>
                            <td>CRITICAL</td>
                            <td>停止使用,进行维护</td>
                        </tr>
                        <tr>
                            <td>维护即将到期</td>
                            <td>nextMaintenanceDate - 现在 <= 7天</td>
                            <td>HIGH</td>
                            <td>提前计划维护</td>
                        </tr>
                        <tr>
                            <td>保修期将过期</td>
                            <td>warranty_end_date - 现在 <= 30天</td>
                            <td>MEDIUM</td>
                            <td>申请延保或续保</td>
                        </tr>
                        <tr>
                            <td>运行时间超长</td>
                            <td>totalOperatingHours > safeThreshold</td>
                            <td>MEDIUM</td>
                            <td>建议进行大修</td>
                        </tr>
                        <tr>
                            <td>异常停止</td>
                            <td>设备意外断电/停机</td>
                            <td>HIGH</td>
                            <td>检查原因并修复</td>
                        </tr>
                    </tbody>
                </table>

                <h3>5.4.2 告警查询API</h3>
                <div class="java-block">
<pre><code>// GET /api/mobile/{factoryId}/equipment/needing-maintenance

{
  "code": 200,
  "data": [
    {
      "id": 1,
      "code": "EQP-001",
      "name": "搅拌机 A",
      "nextMaintenanceDate": "2025-11-21",
      "lastMaintenanceDate": "2025-10-22",
      "daysOverdue": 0,
      "alert": {
        "type": "maintenance_due",
        "level": "CRITICAL",
        "message": "维护已超期,需立即进行"
      }
    }
  ]
}</code></pre>
                </div>

                <h2>5.5 OEE (Overall Equipment Effectiveness)</h2>

                <h3>5.5.1 OEE计算公式</h3>
                <pre><code>OEE = 可用率 × 效能 × 质量率
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 可用率 (Availability)
   = 实际运行时间 / 计划时间
   示例: 设备计划8小时,实际运行7.5小时 → 93.75%

2. 效能 (Performance)
   = 实际产量 / 理论产量
   示例: 理论每小时100件,实际95件 → 95%

3. 质量率 (Quality)
   = 合格产品数 / 总产品数
   示例: 100件中99件合格 → 99%

总OEE = 93.75% × 95% × 99% = 88.4%

规则:
- OEE >= 85%: 优秀(绿色)
- 75% <= OEE < 85%: 良好(黄色)
- OEE < 75%: 需改进(红色)</code></pre>

                <h3>5.5.2 OEE查询API</h3>
                <div class="java-block">
<pre><code>// GET /api/mobile/{factoryId}/equipment/{equipmentId}/oee
// Query: startDate=2025-11-01, endDate=2025-11-21

{
  "code": 200,
  "data": {
    "equipmentId": 1,
    "name": "搅拌机 A",
    "period": {
      "startDate": "2025-11-01",
      "endDate": "2025-11-21",
      "days": 21
    },

    "availability": 0.9375,              // 93.75%
    "performance": 0.95,                 // 95%
    "quality": 0.99,                     // 99%

    "oee": 0.884,                        // 88.4%
    "oeeStatus": "excellent",            // 绿色
    "targetOee": 0.85,
    "gap": 0.034,                        // 超目标3.4个百分点

    "details": {
      "plannedOperatingHours": 168,
      "actualOperatingHours": 157.5,
      "downtime": 10.5,
      "downtimeReason": "维护1次(4小时), 设备停机2次(2小时/次)",
      "theoreticalProduction": 15800,
      "actualProduction": 15010,
      "totalProduced": 15010,
      "defectiveUnits": 152,
      "qualityRate": 0.99
    }
  }
}</code></pre>
                </div>

                <h2>5.6 前端Screen映射</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Screen文件</th>
                            <th>功能</th>
                            <th>关键特性</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><code>EquipmentManagementScreen.tsx</code></td>
                            <td>设备管理</td>
                            <td>CRUD操作、状态管理、import/export</td>
                        </tr>
                        <tr>
                            <td><code>EquipmentDetailScreen.tsx</code></td>
                            <td>设备详情</td>
                            <td>完整信息、使用历史、维护计划</td>
                        </tr>
                        <tr>
                            <td><code>EquipmentMonitoringScreen.tsx</code></td>
                            <td>设备监控</td>
                            <td>实时状态、运行时间、预告警</td>
                        </tr>
                        <tr>
                            <td><code>EquipmentAlertsScreen.tsx</code></td>
                            <td>告警管理</td>
                            <td>告警列表、状态切换、处理记录</td>
                        </tr>
                    </tbody>
                </table>
            </section>
'''

def generate_chapter6_html():
    """Generate Chapter 6 - Inventory Management content"""
    return '''
            <section id="ch6">
                <h1>6. 库存管理模块</h1>

                <h2>模块描述</h2>
                <p>库存管理模块管理原材料和半成品的完整生命周期,从入库、消耗追踪、库存价值计算到过期处理。该模块实现了FIFO (先进先出)算法自动推荐物料批次,支持冷链食品的特殊处理,并提供实时库存数据和价值分析。</p>

                <div class="info-box">
                    <h3>核心功能</h3>
                    <p><strong>物料入库 | FIFO推荐 | 消耗追踪 | 库存估值 | 过期处理 | 冷链管理</strong></p>
                </div>

                <h2>6.1 物料批次管理</h2>

                <h3>6.1.1 物料批次API</h3>
                <table>
                    <thead>
                        <tr>
                            <th>HTTP方法</th>
                            <th>路由</th>
                            <th>说明</th>
                            <th>权限</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/material-batches</td>
                            <td>创建物料批次</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>PUT</td>
                            <td>/api/mobile/{factoryId}/material-batches/{batchId}</td>
                            <td>更新物料批次</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>DELETE</td>
                            <td>/api/mobile/{factoryId}/material-batches/{batchId}</td>
                            <td>删除物料批次</td>
                            <td>factory_admin+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/material-batches</td>
                            <td>查询物料批次 (分页)</td>
                            <td>operator+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/material-batches/{batchId}</td>
                            <td>获取批次详情</td>
                            <td>operator+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/material-batches/material-type/{materialTypeId}</td>
                            <td>按物料类型查询</td>
                            <td>operator+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/material-batches/status/{status}</td>
                            <td>按状态筛选</td>
                            <td>operator+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/material-batches/fifo/{materialTypeId}</td>
                            <td>获取FIFO推荐批次</td>
                            <td>operator+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/material-batches/expiring</td>
                            <td>获取即将过期批次</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/material-batches/expired</td>
                            <td>获取已过期批次</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/material-batches/{batchId}/use</td>
                            <td>使用物料</td>
                            <td>operator+</td>
                        </tr>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/material-batches/{batchId}/adjust</td>
                            <td>调整库存数量</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>PUT</td>
                            <td>/api/mobile/{factoryId}/material-batches/{batchId}/status</td>
                            <td>更新批次状态</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/material-batches/{batchId}/reserve</td>
                            <td>预留物料</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/material-batches/{batchId}/release</td>
                            <td>释放预留</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/material-batches/inventory/statistics</td>
                            <td>库存统计</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/material-batches/inventory/valuation</td>
                            <td>库存估值</td>
                            <td>factory_admin+</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/material-batches/low-stock</td>
                            <td>库存不足警告</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/material-batches/{batchId}/convert-to-frozen</td>
                            <td>转换为冷冻</td>
                            <td>supervisor+</td>
                        </tr>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/material-batches/{batchId}/undo-frozen</td>
                            <td>撤销冷冻</td>
                            <td>supervisor+</td>
                        </tr>
                    </tbody>
                </table>

                <h3>6.1.2 物料批次数据表</h3>
                <div class="sql-block">
<pre><code>-- material_batches 表 (物料批次主表)
CREATE TABLE material_batches (
  id VARCHAR(191) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  batch_number VARCHAR(50) NOT NULL UNIQUE,
  material_type_id VARCHAR(191) NOT NULL,
  supplier_id VARCHAR(191),

  -- 入库信息
  inbound_date DATE NOT NULL,
  purchase_date DATE,
  expire_date DATE,

  -- 数量信息
  receipt_quantity DECIMAL(10,2) NOT NULL,  -- 入库数量
  quantity_unit VARCHAR(20) NOT NULL,
  weight_per_unit DECIMAL(10,3),            -- 单位重量
  used_quantity DECIMAL(10,2) DEFAULT 0,    -- 已使用数量
  reserved_quantity DECIMAL(10,2) DEFAULT 0,-- 预留数量

  -- 当前可用 = receipt_quantity - used_quantity - reserved_quantity

  -- 价格信息
  unit_price DECIMAL(10,2),
  total_price DECIMAL(12,2),

  -- 状态
  status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
  -- 可选值: AVAILABLE(可用), PARTIAL(部分使用), RESERVED(已预留), EXPIRED(已过期), DISPOSED(已处理)

  storage_location VARCHAR(100),            -- 存储位置
  quality_certificate VARCHAR(100),         -- 质量证书号
  notes TEXT,

  created_by INT NOT NULL,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_batch_factory (factory_id),
  INDEX idx_batch_status (status),
  INDEX idx_batch_expire (expire_date),
  INDEX idx_batch_material (material_type_id),
  INDEX idx_batch_inbound (inbound_date)
);

-- material_consumption 表 (消耗记录)
CREATE TABLE material_consumption (
  id VARCHAR(191) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  batch_id VARCHAR(191) NOT NULL,
  production_plan_id VARCHAR(191),

  quantity_consumed DECIMAL(10,2) NOT NULL,
  consumption_date TIMESTAMP NOT NULL,
  recorded_by INT,
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (batch_id) REFERENCES material_batches(id),
  INDEX idx_consumption_batch (batch_id),
  INDEX idx_consumption_date (consumption_date)
);</code></pre>
                </div>

                <h2>6.2 FIFO (先进先出)算法</h2>

                <h3>6.2.1 FIFO推荐原理</h3>
                <pre><code>FIFO算法 (First In First Out)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

目的: 优先使用最早入库的物料批次,避免物料过期浪费

排序规则:
1. 按 inbound_date 升序排列 (最早的优先)
2. 同日期按 expire_date 升序排列 (最快过期的优先)

算法流程:
Step 1: 查询所有 status=AVAILABLE 的物料批次
Step 2: 按规则排序,从最早的开始
Step 3: 累计当前可用数量,直到满足需求量
Step 4: 返回推荐批次列表及数量分配

示例:
需要番茄 950kg

物料批次列表 (按入库日期排序):
┌─────────────────┬──────┬──────┬────────────────┐
│ 批次号           │ 数量 │ 余量 │ 入库日期        │
├─────────────────┼──────┼──────┼────────────────┤
│ MAT-10-15-001   │ 1000 │ 900  │ 2025-10-15    │← 最早
│ MAT-10-20-002   │ 500  │ 500  │ 2025-10-20    │
│ MAT-11-01-003   │ 800  │ 800  │ 2025-11-01    │
│ MAT-11-10-004   │ 600  │ 600  │ 2025-11-10    │
└─────────────────┴──────┴──────┴────────────────┘

FIFO推荐:
需求: 950kg
推荐:
  1. MAT-10-15-001: 900kg (用完)
  2. MAT-10-20-002: 50kg (用完 50/500)</code></pre>

                <h3>6.2.2 FIFO查询API</h3>
                <div class="java-block">
<pre><code>// GET /api/mobile/{factoryId}/material-batches/fifo/MT001
// Query: requiredQuantity=950

{
  "code": 200,
  "data": {
    "materialTypeId": "MT001",
    "materialName": "番茄",
    "requiredQuantity": 950.00,
    "requiredUnit": "kg",

    "fifoRecommendation": [
      {
        "batchId": "MAT-20251015-001",
        "batchNumber": "MAT-10-15-001",
        "inboundDate": "2025-10-15",
        "expireDate": "2025-12-15",
        "availableQuantity": 900.00,
        "recommendedQuantity": 900.00,
        "unitPrice": 0.50,
        "cost": 450.00,
        "daysUntilExpire": 25
      },
      {
        "batchId": "MAT-20251020-002",
        "batchNumber": "MAT-10-20-002",
        "inboundDate": "2025-10-20",
        "expireDate": "2025-12-20",
        "availableQuantity": 500.00,
        "recommendedQuantity": 50.00,
        "unitPrice": 0.50,
        "cost": 25.00,
        "daysUntilExpire": 30
      }
    ],

    "totalRecommendedQuantity": 950.00,
    "totalCost": 475.00,
    "avgUnitPrice": 0.50,
    "remainingRequirement": 0.00
  }
}</code></pre>
                </div>

                <h2>6.3 过期与冷链处理</h2>

                <h3>6.3.1 过期批次查询</h3>
                <div class="java-block">
<pre><code>// GET /api/mobile/{factoryId}/material-batches/expiring
// Query: days=3 (默认查询3天内过期的)

{
  "code": 200,
  "data": {
    "expiringBatches": [
      {
        "batchId": "MAT-20251015-001",
        "batchNumber": "MAT-10-15-001",
        "materialName": "番茄",
        "expireDate": "2025-11-24",
        "daysUntilExpire": 3,
        "currentQuantity": 900.00,
        "unit": "kg",
        "unitPrice": 0.50,
        "totalValue": 450.00,
        "alert": {
          "level": "WARNING",
          "message": "该批次将在3天内过期,建议优先使用"
        }
      }
    ],

    "expiringInDays": 3,
    "totalBatches": 1,
    "totalValue": 450.00
  }
}</code></pre>
                </div>

                <h3>6.3.2 冷链转换 (新增功能)</h3>
                <div class="java-block">
<pre><code>// POST /api/mobile/{factoryId}/material-batches/{batchId}/convert-to-frozen
{
  "convertedBy": 3,
  "conversionTime": "2025-11-21T10:00:00",
  "freezerLocation": "冷库-18℃ #3",
  "reason": "延长保质期,计划用于明年Q1"
}

// 成功响应
{
  "code": 200,
  "message": "已转换为冷冻保存",
  "data": {
    "batchId": "MAT-20251015-001",
    "newStatus": "FROZEN",
    "storageLocation": "冷库-18℃ #3",
    "originalExpireDate": "2025-12-15",
    "estimatedFrozenExpireDate": "2026-06-15",  // 预计延长半年
    "conversionTime": "2025-11-21T10:00:00",
    "note": "冷冻后保质期可延长至原有时间的2-3倍"
  }
}

// ==========================================

// POST /api/mobile/{factoryId}/material-batches/{batchId}/undo-frozen
// 注: 仅在转换后10分钟内可撤销

{
  "reason": "误操作,应该是其他批次"
}

// 成功响应 (需在转换后10分钟内)
{
  "code": 200,
  "message": "冷冻转换已撤销",
  "data": {
    "batchId": "MAT-20251015-001",
    "status": "AVAILABLE",
    "storageLocation": "常温库-1区"
  }
}</code></pre>
                </div>

                <h2>6.4 库存统计与估值</h2>

                <h3>6.4.1 库存统计API</h3>
                <div class="java-block">
<pre><code>// GET /api/mobile/{factoryId}/material-batches/inventory/statistics

{
  "code": 200,
  "data": {
    "factory": "CRETAS_2024_001",
    "statisticsDate": "2025-11-21",

    "summary": {
      "totalBatches": 45,
      "totalQuantity": 25500.00,
      "totalUnit": "kg",
      "totalValue": 12750.00,
      "averageUnitPrice": 0.50
    },

    "byMaterialType": [
      {
        "materialTypeId": "MT001",
        "materialName": "番茄",
        "batches": 8,
        "quantity": 5000.00,
        "unit": "kg",
        "value": 2500.00,
        "unitPrice": 0.50
      },
      {
        "materialTypeId": "MT002",
        "materialName": "盐",
        "batches": 3,
        "quantity": 200.00,
        "unit": "kg",
        "value": 50.00,
        "unitPrice": 0.25
      }
    ],

    "byStatus": {
      "available": { "quantity": 20000.00, "value": 10000.00 },
      "reserved": { "quantity": 3000.00, "value": 1500.00 },
      "frozen": { "quantity": 2000.00, "value": 1000.00 },
      "expired": { "quantity": 500.00, "value": 250.00 }
    }
  }
}</code></pre>
                </div>

                <h3>6.4.2 库存估值API</h3>
                <div class="java-block">
<pre><code>// GET /api/mobile/{factoryId}/material-batches/inventory/valuation

{
  "code": 200,
  "data": {
    "valuationDate": "2025-11-21",

    "totalInventoryValue": 12750.00,

    "valueBreakdown": {
      "availableMaterialValue": 10000.00,    // 可用物料
      "reservedMaterialValue": 1500.00,      // 预留物料
      "frozenMaterialValue": 1000.00,        // 冷冻物料
      "expiredMaterialValue": 250.00         // 已过期(待处理)
    },

    "turnoverMetrics": {
      "avgTurnoverDays": 15,                // 平均周转周期
      "fastMovingItems": 5,                 // 快速流动品种数
      "slowMovingItems": 8,                 // 缓慢流动品种数
      "deadStockItems": 2                   // 滞销品种数(>60天未使用)
    },

    "warnings": [
      {
        "type": "expired",
        "count": 2,
        "value": 250.00,
        "recommendation": "建议尽快处理过期物料"
      },
      {
        "type": "slowMoving",
        "count": 8,
        "value": 1500.00,
        "recommendation": "这些物料超过30天未使用,考虑调整采购计划"
      }
    ]
  }
}</code></pre>
                </div>

                <h2>6.5 前端Screen映射</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Screen文件</th>
                            <th>功能</th>
                            <th>关键特性</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><code>MaterialBatchManagementScreen.tsx</code></td>
                            <td>物料管理</td>
                            <td>CRUD、FIFO推荐、过期提示</td>
                        </tr>
                        <tr>
                            <td><code>MaterialReceiptScreen.tsx</code></td>
                            <td>物料入库</td>
                            <td>批号输入、供应商选择、入库确认</td>
                        </tr>
                        <tr>
                            <td><code>InventoryStatisticsScreen.tsx</code></td>
                            <td>库存统计</td>
                            <td>库存概览、分类统计、估值</td>
                        </tr>
                        <tr>
                            <td><code>InventoryCheckScreen.tsx</code></td>
                            <td>库存盘点</td>
                            <td>现场计数、差异记录、调整</td>
                        </tr>
                    </tbody>
                </table>
            </section>
'''

if __name__ == '__main__':
    ch5 = generate_chapter5_html()
    ch6 = generate_chapter6_html()

    print("Generated HTML for Chapters 5-6")
    print(f"Chapter 5 length: {len(ch5)} characters")
    print(f"Chapter 6 length: {len(ch6)} characters")

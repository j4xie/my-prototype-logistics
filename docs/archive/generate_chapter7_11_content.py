#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate comprehensive HTML content for Chapter 7-11 & Cross-module functions
"""

def generate_remaining_chapters():
    """Generate all remaining chapters and cross-module functions"""
    return '''
            <section id="ch7">
                <h1>7. 质量检验模块</h1>

                <h2>模块描述</h2>
                <p>质量检验模块管理生产过程中的质量控制,包括检验标准定义、缺陷分类、检验记录、趋势分析和报告生成。该模块与生产模块紧密集成,自动计算合格率并影响批次的最终质量状态。</p>

                <h3>核心功能</h3>
                <ul>
                    <li>质检标准管理</li>
                    <li>缺陷分类与记录</li>
                    <li>合格率自动计算</li>
                    <li>趋势分析与预警</li>
                    <li>质检报告生成</li>
                </ul>

                <h3>主要API端点</h3>
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
                            <td>/api/mobile/{factoryId}/quality-inspections</td>
                            <td>创建检验记录</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/quality-inspections</td>
                            <td>查询检验记录(分页)</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/quality-inspections/{id}</td>
                            <td>获取检验详情</td>
                        </tr>
                        <tr>
                            <td>PUT</td>
                            <td>/api/mobile/{factoryId}/quality-inspections/{id}</td>
                            <td>更新检验记录</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/quality/statistics</td>
                            <td>质检统计</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/quality/trends</td>
                            <td>质检趋势分析</td>
                        </tr>
                        <tr>
                            <td>POST</td>
                            <td>/api/mobile/{factoryId}/quality/standards</td>
                            <td>创建质检标准</td>
                        </tr>
                        <tr>
                            <td>GET</td>
                            <td>/api/mobile/{factoryId}/quality/standards</td>
                            <td>查询质检标准</td>
                        </tr>
                    </tbody>
                </table>

                <h3>关键数据库表</h3>
                <div class="sql-block">
<pre><code>-- quality_inspection_standards 表 (质检标准)
CREATE TABLE quality_inspection_standards (
  id INT PRIMARY KEY AUTO_INCREMENT,
  factory_id VARCHAR(50) NOT NULL,
  product_type_id INT NOT NULL,
  standard_name VARCHAR(100),
  pass_criteria TEXT,
  sample_size_min INT,
  sample_size_max INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_factory_product (factory_id, product_type_id)
);

-- quality_inspection_defects 表 (缺陷分类)
CREATE TABLE quality_inspection_defects (
  id INT PRIMARY KEY AUTO_INCREMENT,
  factory_id VARCHAR(50) NOT NULL,
  defect_code VARCHAR(50) NOT NULL,
  defect_name VARCHAR(100),
  severity VARCHAR(20),  -- critical, major, minor
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_factory_defect (factory_id, defect_code)
);</code></pre>
                </div>
            </section>

            <section id="ch8">
                <h1>8. 基础数据管理模块</h1>

                <h2>模块描述</h2>
                <p>基础数据管理模块提供系统所有主数据的CRUD操作,包括物料类型、产品类型、员工信息、部门、供应商、客户等。该模块为其他业务模块提供数据基础,支持批量导入导出。</p>

                <h3>核心数据管理</h3>
                <ul>
                    <li>物料类型 (Material Types) - 15+ API</li>
                    <li>产品类型 (Product Types) - 15+ API</li>
                    <li>员工管理 (Employees) - 12+ API</li>
                    <li>部门管理 (Departments) - 10+ API</li>
                    <li>供应商管理 (Suppliers) - 12+ API</li>
                    <li>客户管理 (Customers) - 12+ API</li>
                </ul>

                <h3>API端点统计</h3>
                <table>
                    <thead>
                        <tr>
                            <th>数据类型</th>
                            <th>创建</th>
                            <th>读取</th>
                            <th>更新</th>
                            <th>删除</th>
                            <th>小计</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>物料类型</td>
                            <td>POST</td>
                            <td>GET</td>
                            <td>PUT</td>
                            <td>DELETE</td>
                            <td>4+特殊</td>
                        </tr>
                        <tr>
                            <td>产品类型</td>
                            <td>POST</td>
                            <td>GET</td>
                            <td>PUT</td>
                            <td>DELETE</td>
                            <td>4+特殊</td>
                        </tr>
                        <tr>
                            <td>员工信息</td>
                            <td>POST</td>
                            <td>GET</td>
                            <td>PUT</td>
                            <td>DELETE</td>
                            <td>4+导出</td>
                        </tr>
                        <tr>
                            <td>部门管理</td>
                            <td>POST</td>
                            <td>GET</td>
                            <td>PUT</td>
                            <td>DELETE</td>
                            <td>4+树形</td>
                        </tr>
                    </tbody>
                </table>

                <h3>前端屏幕映射</h3>
                <table>
                    <thead>
                        <tr>
                            <th>模块</th>
                            <th>屏幕列表</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>物料类型</td>
                            <td>MaterialTypeManagementScreen, MaterialTypeDetailScreen, MaterialTypeListScreen</td>
                        </tr>
                        <tr>
                            <td>产品类型</td>
                            <td>ProductTypeManagementScreen, ProductTypeDetailScreen, ProductTypeListScreen</td>
                        </tr>
                        <tr>
                            <td>员工管理</td>
                            <td>EmployeeManagementScreen, EmployeeDetailScreen, EmployeeListScreen</td>
                        </tr>
                        <tr>
                            <td>部门管理</td>
                            <td>DepartmentManagementScreen, DepartmentTreeScreen, DepartmentDetailScreen</td>
                        </tr>
                        <tr>
                            <td>供应商</td>
                            <td>SupplierManagementScreen, SupplierDetailScreen, SupplierListScreen</td>
                        </tr>
                        <tr>
                            <td>客户</td>
                            <td>CustomerManagementScreen, CustomerDetailScreen, CustomerListScreen</td>
                        </tr>
                    </tbody>
                </table>
            </section>

            <section id="ch9">
                <h1>9. 平台管理模块</h1>

                <h2>模块描述</h2>
                <p>平台管理模块负责多工厂平台的配置和管理,包括工厂管理、用户账户管理、角色权限配置和系统参数设置。仅平台管理员可访问。</p>

                <h3>核心功能</h3>
                <ul>
                    <li>工厂管理 - 多工厂配置与激活</li>
                    <li>用户管理 - 8角色权限系统</li>
                    <li>权限配置 - 角色功能权限详细配置</li>
                    <li>系统配置 - 参数设置与系统常数</li>
                    <li>审计日志 - 操作记录与安全跟踪</li>
                </ul>

                <h3>8角色权限体系</h3>
                <table>
                    <thead>
                        <tr>
                            <th>角色</th>
                            <th>级别</th>
                            <th>权限范围</th>
                            <th>主要职责</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>developer</td>
                            <td>系统</td>
                            <td>全部权限</td>
                            <td>系统开发与维护</td>
                        </tr>
                        <tr>
                            <td>platform_admin</td>
                            <td>平台</td>
                            <td>多工厂管理</td>
                            <td>平台配置与用户管理</td>
                        </tr>
                        <tr>
                            <td>factory_super_admin</td>
                            <td>工厂</td>
                            <td>单工厂全部</td>
                            <td>工厂全部管理</td>
                        </tr>
                        <tr>
                            <td>factory_admin</td>
                            <td>工厂</td>
                            <td>工厂大部分</td>
                            <td>工厂运营管理</td>
                        </tr>
                        <tr>
                            <td>department_admin</td>
                            <td>部门</td>
                            <td>部门范围</td>
                            <td>部门运营管理</td>
                        </tr>
                        <tr>
                            <td>supervisor</td>
                            <td>生产</td>
                            <td>主管范围</td>
                            <td>生产监督</td>
                        </tr>
                        <tr>
                            <td>operator</td>
                            <td>操作</td>
                            <td>自己操作</td>
                            <td>执行操作</td>
                        </tr>
                        <tr>
                            <td>viewer</td>
                            <td>查看</td>
                            <td>只读权限</td>
                            <td>数据查看</td>
                        </tr>
                    </tbody>
                </table>

                <h3>API端点</h3>
                <ul>
                    <li>POST /api/platform/factories - 创建工厂</li>
                    <li>GET /api/platform/factories - 查询所有工厂</li>
                    <li>PUT /api/platform/factories/{factoryId} - 更新工厂</li>
                    <li>POST /api/platform/users - 创建用户</li>
                    <li>GET /api/platform/users - 查询用户列表</li>
                    <li>PUT /api/platform/users/{userId} - 更新用户</li>
                    <li>POST /api/platform/roles - 创建角色</li>
                    <li>GET /api/platform/roles - 查询所有角色</li>
                    <li>PUT /api/platform/roles/{roleId}/permissions - 配置权限</li>
                    <li>GET /api/platform/audit-logs - 查看审计日志</li>
                </ul>
            </section>

            <section id="ch10">
                <h1>10. 报表分析模块</h1>

                <h2>模块描述</h2>
                <p>报表分析模块提供各类业务报表和数据分析功能,包括生产报表、质量报表、成本报表、人员报表和设备报表。支持多维度分析、图表展示和导出功能。</p>

                <h3>核心报表类型</h3>
                <table>
                    <thead>
                        <tr>
                            <th>报表类型</th>
                            <th>说明</th>
                            <th>API端点数</th>
                            <th>导出格式</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>生产报表</td>
                            <td>日/周/月生产统计</td>
                            <td>5+</td>
                            <td>Excel, PDF</td>
                        </tr>
                        <tr>
                            <td>质量报表</td>
                            <td>缺陷分布、合格率趋势</td>
                            <td>5+</td>
                            <td>Excel, PDF</td>
                        </tr>
                        <tr>
                            <td>成本报表</td>
                            <td>成本对标、单位成本分析</td>
                            <td>5+</td>
                            <td>Excel, PDF</td>
                        </tr>
                        <tr>
                            <td>人员报表</td>
                            <td>考勤统计、工时分析</td>
                            <td>4+</td>
                            <td>Excel</td>
                        </tr>
                        <tr>
                            <td>设备报表</td>
                            <td>运行效率、维护记录</td>
                            <td>4+</td>
                            <td>Excel, PDF</td>
                        </tr>
                    </tbody>
                </table>

                <h3>前端报表屏幕</h3>
                <ul>
                    <li>ReportDashboardScreen - 报表总览</li>
                    <li>ProductionReportScreen - 生产报表</li>
                    <li>QualityReportScreen - 质量报表</li>
                    <li>CostReportScreen - 成本报表</li>
                    <li>PersonnelReportScreen - 人员报表</li>
                    <li>EfficiencyReportScreen - 效率报表</li>
                    <li>KPIReportScreen - KPI仪表板</li>
                </ul>
            </section>

            <section id="ch11">
                <h1>11. 数据导入导出模块</h1>

                <h2>模块描述</h2>
                <p>数据导入导出模块提供批量数据操作能力,支持Excel导入导出,自动验证格式,并提供详细的操作日志和错误提示。</p>

                <h3>支持的导入数据类型</h3>
                <ul>
                    <li>物料批次 (Material Batches)</li>
                    <li>生产计划 (Production Plans)</li>
                    <li>员工信息 (Employees)</li>
                    <li>供应商信息 (Suppliers)</li>
                    <li>产品类型 (Product Types)</li>
                    <li>设备信息 (Equipment)</li>
                </ul>

                <h3>API端点</h3>
                <ul>
                    <li>POST /api/mobile/{factoryId}/import/material-batches - 导入物料</li>
                    <li>POST /api/mobile/{factoryId}/import/production-plans - 导入计划</li>
                    <li>POST /api/mobile/{factoryId}/import/employees - 导入员工</li>
                    <li>GET /api/mobile/{factoryId}/export/material-batches - 导出物料</li>
                    <li>GET /api/mobile/{factoryId}/export/production-plans - 导出计划</li>
                    <li>GET /api/mobile/{factoryId}/export/template/{type} - 获取导入模板</li>
                </ul>

                <h3>导入流程</h3>
                <pre><code>Step 1: 上传Excel文件
Step 2: 验证文件格式与数据完整性
Step 3: 逐行验证业务规则
Step 4: 返回验证结果与错误提示
Step 5: 用户确认后批量插入数据库
Step 6: 保存导入日志</code></pre>

                <h3>导出格式</h3>
                <ul>
                    <li>Excel (.xlsx) - 支持公式与格式</li>
                    <li>CSV (.csv) - 兼容性好</li>
                    <li>PDF - 报表格式</li>
                </ul>
            </section>

            <section id="cross-1">
                <h1>X.1 成本自动计算</h1>

                <h2>四层成本模型</h2>
                <pre><code>生产成本 = 原料成本 + 人工成本 + 设备成本 + 其他成本

1. 原料成本 (Material Cost)
   ├─ 来源: material_consumption 表
   ├─ 计算: 消耗物料单价 × 消耗数量
   └─ 示例: 番茄0.5元/kg × 950kg = 475元

2. 人工成本 (Labor Cost)
   ├─ 来源: batch_work_sessions + users表(daily_salary)
   ├─ 计算: (日薪 / 24) × 工作时长(小时)
   └─ 示例: 5人 × (300/24) × 8h = 5000元

3. 设备成本 (Equipment Cost)
   ├─ 来源: equipment_usage + equipment表(depreciation)
   ├─ 计算: 年折旧 / 365 × 运行天数
   └─ 示例: 2000/365 × 0.5 = 2.74元

4. 其他成本 (Other Cost)
   ├─ 来源: 手动输入或预设比例
   ├─ 范围: 水电费、包装费、运输费等
   └─ 示例: 100元

总成本 = 475 + 5000 + 2.74 + 100 = 5577.74元
单位成本 = 5577.74 / 990kg = 5.64元/kg</code></pre>

                <h2>成本计算触发点</h2>
                <ol>
                    <li>创建生产批次 → 初始化成本 = 0</li>
                    <li>记录物料消耗 → 更新原料成本</li>
                    <li>员工完成打卡 → 累加人工成本</li>
                    <li>设备停止运行 → 累加设备成本</li>
                    <li>完成生产批次 → 最终成本汇总</li>
                    <li>批次完成后 → 触发AI分析 (可选)</li>
                </ol>
            </section>

            <section id="cross-2">
                <h1>X.2 FIFO库存推荐</h1>

                <h2>FIFO算法实现</h2>
                <pre><code>目的: 优先使用最早入库的物料,避免过期浪费

排序规则:
1. 第一优先级: inbound_date (入库日期) 升序
2. 第二优先级: expire_date (过期日期) 升序
3. 第三优先级: batch_id (批次ID) 升序

查询逻辑:
SELECT * FROM material_batches
WHERE factory_id = ? AND material_type_id = ? AND status = 'AVAILABLE'
ORDER BY inbound_date ASC, expire_date ASC, batch_id ASC
LIMIT ? -- 推荐批次数量

推荐算法:
totalNeeded = 需求数量
recommendations = []
accumulated = 0

for batch in sorted_batches:
    available = batch.receipt_quantity - batch.used_quantity - batch.reserved_quantity

    if accumulated >= totalNeeded:
        break

    if available > 0:
        recommended = min(available, totalNeeded - accumulated)
        recommendations.add({
            batchId: batch.id,
            recommendedQuantity: recommended,
            unitPrice: batch.unit_price,
            cost: recommended * batch.unit_price
        })
        accumulated += recommended

return recommendations</code></pre>

                <h2>FIFO推荐示例</h2>
                <pre><code>场景: 需要番茄 950kg

物料库存状态:
┌────────────────┬────────┬─────────┬────────────┐
│ 批次号          │ 入库日 │ 过期日 │ 可用数量   │
├────────────────┼────────┼─────────┼────────────┤
│ MAT-10-15-001  │ 10-15  │ 12-15  │ 900kg      │
│ MAT-10-20-002  │ 10-20  │ 12-20  │ 500kg      │
│ MAT-11-01-003  │ 11-01  │ 01-01  │ 800kg      │
└────────────────┴────────┴─────────┴────────────┘

FIFO推荐流程:
需求: 950kg
累计: 0kg

Step 1: MAT-10-15-001 (最早)
  可用: 900kg
  推荐: 900kg (< 950kg, 用完)
  累计: 900kg

Step 2: MAT-10-20-002 (次早)
  可用: 500kg
  推荐: 50kg (满足剩余 950-900=50kg)
  累计: 950kg

结论: 用完MAT-10-15-001的900kg,再用MAT-10-20-002的50kg</code></pre>
            </section>

            <section id="cross-3">
                <h1>X.3 时间成本一体化</h1>

                <h2>工作会话与成本分配</h2>
                <pre><code>场景: 员工李四在一天内参与多个生产批次

时间轴:
08:00 - 09:30 (1.5h) - 批次A (番茄酱)
09:30 - 10:00 (0.5h) - 休息
10:00 - 12:00 (2.0h) - 批次A (番茄酱)
12:00 - 13:00 (1.0h) - 午休
13:00 - 15:30 (2.5h) - 批次B (辣椒酱)
15:30 - 16:00 (0.5h) - 休息
16:00 - 17:00 (1.0h) - 批次B (辣椒酱)
────────────────────────
实际工作: 8.0小时
日薪: 300元/天

成本分配:
✓ 总工作时间: 8.0小时
✓ 小时费率: 300 / 24 = 12.5元/小时
✓ 总成本: 12.5 × 8 = 100元

✓ 批次A: (1.5 + 2.0) / 8.0 × 100 = 43.75元
✓ 批次B: (2.5 + 1.0) / 8.0 × 100 = 56.25元

验证: 43.75 + 56.25 = 100元 ✓</code></pre>

                <h2>数据表关联</h2>
                <pre><code>time_clock_record 表
├─ clock_in_time: 08:00
├─ clock_out_time: 17:00
├─ break_start_time: 09:30, 12:00, 15:30
├─ break_end_time: 10:00, 13:00, 16:00
└─ work_duration: 480分钟 (8小时)

batch_work_sessions 表 (会话记录)
├─ 批次A
│  ├─ work_minutes: 210分钟 (3.5h)
│  └─ labor_cost: 43.75元
└─ 批次B
   ├─ work_minutes: 210分钟 (3.5h)
   └─ labor_cost: 56.25元</code></pre>
            </section>

            <section id="cross-4">
                <h1>X.4 设备折旧集成</h1>

                <h2>设备折旧在生产中的应用</h2>
                <pre><code>设备信息:
- 名称: 搅拌机 A
- 购置价: 50,000元
- 购置日: 2023-05-15
- 残值: 5,000元
- 使用年限: 5年
- 折旧模式: 直线折旧

折旧计算:
年折旧 = (50000 - 5000) / 5 = 9000元/年
月折旧 = 9000 / 12 = 750元/月
日折旧 = 9000 / 365 = 24.66元/天
时折旧 = 24.66 / 24 = 1.03元/小时

生产批次成本分配:
批次BATCH-20251121-001
├─ 设备: 搅拌机 A
├─ 运行时间: 2.5小时
└─ 设备折旧成本 = 1.03元/h × 2.5h = 2.57元

累计跟踪:
总运行时间: 1245小时
历史折旧: (50000 - 5000) × (1245 / (5 × 365 × 24)) = 18118元
净值: 50000 - 18118 = 31882元</code></pre>

                <h2>实现方式</h2>
                <ol>
                    <li>设备启动时记录 start_time</li>
                    <li>设备停止时计算 running_hours</li>
                    <li>更新 equipment.total_operating_hours</li>
                    <li>计算小时折旧: annual_depreciation / (365 × 24)</li>
                    <li>累加到批次的 equipment_cost</li>
                    <li>完成生产时汇总所有成本</li>
                </ol>
            </section>

            <section id="cross-5">
                <h1>X.5 AI分析触发链</h1>

                <h2>AI自动分析工作流</h2>
                <pre><code>生产批次完成 → 自动触发AI分析

触发条件:
✓ 批次状态: status = COMPLETED
✓ 成本计算: total_cost ≠ null
✓ 质检通过: quality_status = PASS
✓ 触发延迟: 300秒后执行 (异步非阻塞)

触发流程:
────────────────────────────────────────

Step 1: 检查触发条件
  IF status == COMPLETED AND total_cost != null AND quality_status == PASS:
    PROCEED
  ELSE:
    SKIP

Step 2: 查询缓存
  cache_key = factoryId + batchId + 'cost_breakdown'
  IF cache.exists(cache_key) AND cache.notExpired():
    RETURN cached_result
  ELSE:
    PROCEED to Step 3

Step 3: 消费配额
  quota = GET_WEEKLY_QUOTA(factoryId)
  IF quota.remaining < 1:
    RETURN error "配额不足"
  ELSE:
    quota.remaining -= 1
    quota.used += 1

Step 4: 调用AI服务
  request = {
    batchId: batchId,
    batchNumber: batch_number,
    analysis: {
      planned: planned_quantity,
      actual: actual_quantity,
      good: good_quantity,
      defect: defect_quantity,
      costs: {
        material: material_cost,
        labor: labor_cost,
        equipment: equipment_cost,
        other: other_cost
      }
    }
  }

  response = CALL_LLM_API(request)

Step 5: 保存结果
  INSERT INTO ai_analysis_results (
    factory_id, batch_id, analysis_text,
    report_type='batch', expires_at=NOW()+7days
  )

Step 6: 记录审计
  INSERT INTO ai_audit_logs (
    factory_id, request_type='batch_analysis',
    success=true, cache_hit=false, quota_consumed=1
  )

Step 7: 通知前端
  WebSocket 推送批次ID给相关用户
  前端自动刷新,显示AI分析结果

执行时间: 异步后台任务,2-10秒内完成</code></pre>

                <h2>与其他模块的联动</h2>
                <pre><code>生产完成
  ↓
触发链路:
  ├─→ 成本模块: 最终成本汇总
  ├─→ 质检模块: 质检状态确认
  ├─→ 库存模块: 产成品入库
  ├─→ AI模块: 自动分析 ← YOU ARE HERE
  └─→ 报表模块: 生产报表更新

AI分析完成
  ↓
前端通知:
  ├─→ 生产仪表板刷新
  ├─→ 成本分析屏幕更新
  └─→ AI分析结果展示</code></pre>
            </section>

            <section id="faq">
                <h1>常见问题解答</h1>

                <h3>考勤相关</h3>
                <p><strong>Q1: 为什么我的员工打卡后没有自动关联批次?</strong></p>
                <p><strong>A:</strong> 检查以下几点:</p>
                <ol>
                    <li>是否有进行中的生产批次 (status=IN_PROGRESS)?</li>
                    <li>该员工是否被分配到该批次?</li>
                    <li>打卡时间是否在批次的计划时间范围内?</li>
                </ol>

                <p><strong>Q2: GPS打卡失败,说我的位置不在工厂范围内?</strong></p>
                <p><strong>A:</strong> 这通常有两个原因:</p>
                <ol>
                    <li>工厂GPS范围设置不正确 → 联系管理员调整</li>
                    <li>手机GPS信号弱 → 开启高精度GPS后重试</li>
                </ol>

                <p><strong>Q3: 加班时间怎样计算?</strong></p>
                <p><strong>A:</strong> 系统假设标准工作时间为8小时,超过8小时的部分为加班,在统计时会单独计算。</p>

                <h3>FIFO与库存</h3>
                <p><strong>Q4: FIFO库存推荐是怎样的?</strong></p>
                <p><strong>A:</strong> 系统按照物料批次的入库日期升序排列,优先推荐最早入库的。这样可以避免物料过期浪费。具体详见 <a href="#cross-2">X.2 FIFO库存推荐</a>。</p>

                <p><strong>Q5: 物料转换为冷冻保存后,保质期会延长多久?</strong></p>
                <p><strong>A:</strong> 通常冷冻可以将保质期延长至原有时间的2-3倍,具体取决于物料类型。系统会在转换时自动计算预计的新过期日期。</p>

                <h3>AI与配额</h3>
                <p><strong>Q6: AI分析的周配额是多少,怎样查看?</strong></p>
                <p><strong>A:</strong> 默认周配额为100分析单位,每周一自动重置。可在设置页面查看当前剩余配额。</p>

                <p><strong>Q7: 配额用尽了怎样办?</strong></p>
                <p><strong>A:</strong> 配额用尽后无法进行新的AI分析,但可以查看历史缓存结果。可等待下周一自动恢复,或联系管理员申请配额提升。</p>

                <p><strong>Q8: 为什么同样的查询一次消耗1单位,下次又消耗1单位?</strong></p>
                <p><strong>A:</strong> 这是因为缓存过期了。系统会缓存分析结果7天,7天内相同查询会直接返回缓存结果(不消耗配额)。</p>

                <h3>成本与计算</h3>
                <p><strong>Q9: 成本计算中的人工成本是怎样计算的?</strong></p>
                <p><strong>A:</strong> 公式为: (员工日薪 / 24) × 工作时长(小时)。若员工在多个批次工作,成本按工作时间比例分配。详见 <a href="#cross-3">X.3 时间成本一体化</a>。</p>

                <p><strong>Q10: 设备成本怎样计算?</strong></p>
                <p><strong>A:</strong> 采用直线折旧法,公式为: 年折旧额 / 365 / 24 × 运行时间(小时)。详见 <a href="#cross-4">X.4 设备折旧集成</a>。</p>

                <h3>设备与维护</h3>
                <p><strong>Q11: 设备维护提醒怎样配置?</strong></p>
                <p><strong>A:</strong> 在设备详情中设置 "maintenance_interval_days",系统会自动计算下次维护日期,并在到期日期前提前提醒。</p>

                <p><strong>Q12: OEE指标怎样计算?</strong></p>
                <p><strong>A:</strong> OEE = 可用率 × 效能 × 质量率。详细公式见 <a href="#ch5">第5章 设备管理</a>。</p>

                <h3>数据导入导出</h3>
                <p><strong>Q13: 导入数据时出现验证错误怎样处理?</strong></p>
                <p><strong>A:</strong> 系统会列出所有验证失败的行号和原因。修改Excel后重新上传,或删除有问题的行。</p>

                <p><strong>Q14: 导出的数据格式是什么?</strong></p>
                <p><strong>A:</strong> 默认导出为Excel (.xlsx) 格式,支持公式与格式保留。也可选择CSV格式用于数据交换。</p>

                <h3>多工厂与权限</h3>
                <p><strong>Q15: 我是platform_admin,为什么看不到某个工厂的数据?</strong></p>
                <p><strong>A:</strong> platform_admin 只能看到已激活的工厂。检查该工厂是否已激活。若已激活但仍看不到,请刷新页面或退出重新登录。</p>

                <p><strong>Q16: 怎样为员工分配权限?</strong></p>
                <p><strong>A:</strong> 系统使用8种预定义角色。选择用户,分配相应角色,权限会自动生效。详见 <a href="#ch9">第9章 平台管理</a>。</p>

                <h3>报表与分析</h3>
                <p><strong>Q17: 生产报表怎样按时间段筛选?</strong></p>
                <p><strong>A:</strong> 打开生产报表,选择日期范围,系统会自动聚合该时间段内的数据并生成报表。</p>

                <p><strong>Q18: 成本报表怎样对标同期?</strong></p>
                <p><strong>A:</strong> 选择两个时间段,系统会并列展示,自动计算同比和环比数据。</p>

                <h3>系统与故障</h3>
                <p><strong>Q19: 为什么API返回 504 Gateway Timeout?</strong></p>
                <p><strong>A:</strong> 这通常表示后端服务暂时无响应。请稍后重试。若问题持续,请联系技术支持。</p>

                <p><strong>Q20: 怎样查看系统操作日志?</strong></p>
                <p><strong>A:</strong> 仅factory_admin及以上权限可查看。进入"平台管理" → "审计日志"。</p>
            </section>
'''

if __name__ == '__main__':
    content = generate_remaining_chapters()
    print(f"Generated remaining chapters content: {len(content)} characters")

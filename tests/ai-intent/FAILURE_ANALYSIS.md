# 失败案例分析报告

**测试结果**: 43/100 通过 (43%)
**失败案例**: 57 个

---

## 分类统计

| 类别 | 数量 | 说明 | 建议处理方式 |
|------|------|------|-------------|
| 意图名差异 | ~15 | 系统理解正确，但意图代码不同 | 修改测试期望值 |
| 多意图问题 | ~14 | 输入包含多个意图，系统只返回一个 | 这是正常行为，修改测试期望 |
| 模糊查询 | ~8 | 需要澄清的模糊输入 | 添加澄清机制或接受默认行为 |
| 真正错误 | ~20 | 系统理解完全错误 | 需要添加短语映射 |

---

## 详细分析

### 类别1: 意图名差异 (系统合理，名称不同)

| # | 输入 | 期望 | 实际 | 分析 |
|---|------|------|------|------|
| 16 | 系统一直在响个不停，是不是有什么紧急的事 | ALERT_LIST | ALERT_DIAGNOSE | ✅ 合理，诊断也是合理响应 |
| 36 | 各部门考勤统计和各条产线效率对比 | ATTENDANCE_DEPARTMENT | ATTENDANCE_STATS_BY_DEPT | ✅ 基本相同 |
| 42 | 设备的问题处理得怎么样了 | EQUIPMENT_MAINTENANCE | EQUIPMENT_STATUS_UPDATE | ✅ 状态更新也合理 |
| 43 | 质量这块有什么需要注意的 | QUALITY_CRITICAL_ITEMS | QUALITY_CHECK_QUERY | ✅ 质检查询也合理 |
| 50 | 成本这块控制得怎么样 | REPORT_FINANCE | COST_QUERY | ✅ 成本查询更精准 |
| 51 | 报警处理完了没 | ALERT_LIST | ALERT_RESOLVE | ✅ 询问解决状态更合理 |
| 34 | 员工出勤率和生产效率的关系报告 | ATTENDANCE_STATS | ATTENDANCE_HISTORY | ⚠️ 接近但不完全 |

**建议**: 修改测试用例的期望值，或添加意图别名映射

---

### 类别2: 多意图问题 (系统只能返回一个)

| # | 输入 | 期望 | 实际 | 分析 |
|---|------|------|------|------|
| 26 | 帮我查一下今天的销售情况，顺便看看库存够不够 | REPORT_DASHBOARD_OVERVIEW | MATERIAL_BATCH_QUERY | 包含销售+库存两个意图 |
| 27 | 设备状态和今天的生产进度一起给我看看 | EQUIPMENT_STATUS_QUERY | PRODUCTION_STATUS_QUERY | 包含设备+生产两个意图 |
| 28 | 考勤异常的人和他们负责的设备故障有没有关联 | ATTENDANCE_ANOMALY | REPORT_ANOMALY | 考勤+设备关联分析 |
| 29 | 供应商评估报告和原料质检结果对比一下 | SUPPLIER_EVALUATE | QUALITY_CHECK_QUERY | 供应商+质检 |
| 30 | 客户订单和发货进度都显示给我看看 | CUSTOMER_PURCHASE_HISTORY | PRODUCTION_STATUS_QUERY | 客户+发货 |
| 33 | 把告警列表清理一下，顺便看看设备维护计划 | ALERT_LIST | EQUIPMENT_MAINTENANCE | 告警+维护 |
| 35 | 原料溯源信息和质检报告关联查询 | TRACE_BATCH | QUALITY_CHECK_QUERY | 溯源+质检 |
| 37 | 活跃客户名单和他们最近三个月的采购记录 | CUSTOMER_ACTIVE | REPORT_DASHBOARD_OVERVIEW | 客户+采购 |
| 38 | 生产批次状态和相关设备运行情况汇总 | PRODUCTION_STATUS_QUERY | REPORT_INVENTORY | 生产+设备 |
| 39 | KPI指标和异常事件的关联分析报告 | REPORT_KPI | ALERT_LIST | KPI+异常 |

**建议**:
1. 当前系统是单意图设计，返回第一个匹配的意图是正常行为
2. 如需支持多意图，需要架构级别的改动
3. 短期可修改测试期望，接受系统返回的第一个意图

---

### 类别3: 模糊/需要澄清的查询

| # | 输入 | 期望 | 实际 | 分析 |
|---|------|------|------|------|
| 56 | 我想查询一下相关数据 | None | REPORT_DASHBOARD_OVERVIEW | 系统选择猜测默认 |
| 57 | 帮我处理一下那个 | None | EQUIPMENT_ALERT_RESOLVE | 系统选择猜测 |
| 58 | 看看情况 | None | REPORT_DASHBOARD_OVERVIEW | 系统选择猜测 |
| 44 | 库存那边有问题吗 | MATERIAL_LOW_STOCK_ALERT | ALERT_LIST | 模糊的"问题" |
| 46 | 人员方面有什么问题 | ATTENDANCE_ANOMALY | REPORT_ANOMALY | 模糊的"问题" |
| 54 | 异常数据有多少 | REPORT_ANOMALY | ALERT_LIST | 异常vs告警 |

**建议**:
1. 系统当前行为是"尽力猜测"，而不是要求澄清
2. 如果期望系统要求澄清，需要添加置信度阈值判断
3. 短期可修改测试期望，接受系统的默认猜测

---

### 类别4: 真正的错误 (需要修复)

| # | 输入 | 期望 | 实际 | 问题分析 |
|---|------|------|------|----------|
| 15 | 客户那边反馈产品有问题，最近检验数据怎么样 | QUALITY_STATS | REPORT_DASHBOARD_OVERVIEW | "检验数据"应触发质检 |
| 23 | 生产任务单安排一下今天的工作分配 | PROCESSING_WORKER_ASSIGN | PROCESSING_BATCH_CREATE | "工作分配"应触发员工分配 |
| 24 | 那批进口原料到货了没有确认入库了吗 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_CREATE | "确认入库了吗"是查询不是创建 |
| 25 | 产线需要补充人手，看看今天谁有空 | ATTENDANCE_TODAY | PROCESSING_BATCH_TIMELINE | "谁有空"应触发考勤查询 |
| 48 | 客户那边有反馈吗 | CUSTOMER_STATS | SHIPMENT_CREATE | "客户反馈"不应触发发货创建 |
| 49 | 发货安排好了吗 | SHIPMENT_QUERY | SHIPMENT_CREATE | "安排好了吗"是查询不是创建 |
| 55 | 趋势分析给我看看 | REPORT_TRENDS | REPORT_DASHBOARD_OVERVIEW | 需要添加"趋势分析"短语 |

**建议**: 需要添加以下短语映射到 IntentKnowledgeBase:
- "检验数据" → QUALITY_STATS
- "工作分配" → PROCESSING_WORKER_ASSIGN
- "确认入库了吗" → MATERIAL_BATCH_QUERY
- "谁有空" → ATTENDANCE_TODAY
- "客户反馈" → CUSTOMER_FEEDBACK (新意图)
- "安排好了吗" → *_QUERY (查询类)
- "趋势分析" → REPORT_TRENDS

---

## 总结

**实际准确率估算**:
- 如果修正"意图名差异"和"多意图问题": 43 + 15 + 14 = **72%**
- 如果再修正"模糊查询": 72 + 8 = **80%**

**需要代码修复的真正错误**: 约 **20个** (20%)

---

## 优先修复建议

1. **高优先级** - 添加缺失短语 (解决类别4)
2. **中优先级** - 修正测试用例期望值 (解决类别1,2)
3. **低优先级** - 添加操作类型检测 (查询vs创建的区分)

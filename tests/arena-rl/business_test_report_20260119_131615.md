# ArenaRL 真实业务场景测试报告

## 测试时间
2026-01-19 13:16:16

## 测试结果

| # | 类别 | 查询 | 期望意图 | 实际意图 | 结果 | 延迟 |
|---|------|------|----------|----------|------|------|
| 1 | 查询 | 查一下原料批次MB001的信息 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 595ms |
| 2 | 查询 | 原材料批次详情 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 482ms |
| 3 | 查询 | 今天收到了哪些原料 | MATERIAL_BATCH_QUERY | MATERIAL_EXPIRED_QUERY | ❌ | 622ms |
| 4 | 查询 | 最近入库的原材料有哪些 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 628ms |
| 5 | 查询 | 原料MB开头的批次列表 | MATERIAL_BATCH_QUERY | PROCESSING_BATCH_LIST | ❌ | 1237ms |
| 6 | 查询 | 生产批次状态 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_LIST | ✅ | 652ms |
| 7 | 查询 | 今天有多少批次在生产 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_LIST | ✅ | 676ms |
| 8 | 查询 | 正在加工的批次 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_START | ❌ | 1926ms |
| 9 | 查询 | 批次PB001的进度 | PROCESSING_BATCH_QUERY | PROCESSING_BATCH_START | ❌ | 3171ms |
| 10 | 查询 | 追溯一下PB001 | TRACE_BATCH | TRACE_BATCH | ✅ | 2650ms |
| 11 | 查询 | 批次溯源信息 | TRACE_BATCH | TRACE_BATCH | ✅ | 1412ms |
| 12 | 查询 | 查询批次的来源 | TRACE_BATCH | TRACE_BATCH | ✅ | 652ms |
| 13 | 查询 | 这个批次的原料从哪里来的 | TRACE_BATCH | PROCESSING_BATCH_TIMELINE | ❌ | 494ms |
| 14 | 查询 | 出货批次查询 | SHIPMENT_QUERY | TRACE_BATCH | ❌ | 1370ms |
| 15 | 查询 | 今天出了多少货 | SHIPMENT_QUERY | SHIPMENT_BY_DATE | ❌ | 1530ms |
| 16 | 查询 | 最近的发货记录 | SHIPMENT_QUERY | SHIPMENT_QUERY | ✅ | 525ms |
| 17 | 查询 | 待发货的批次 | SHIPMENT_QUERY | PROCESSING_BATCH_LIST | ❌ | 2659ms |
| 18 | 查询 | 物料列表 | MATERIAL_TYPE_LIST | MATERIAL_BATCH_QUERY | ❌ | 503ms |
| 19 | 查询 | 我们有哪些原材料类型 | MATERIAL_TYPE_LIST | MATERIAL_BATCH_QUERY | ❌ | 551ms |
| 20 | 查询 | 产品类型有哪些 | PRODUCT_TYPE_QUERY | CUSTOMER_BY_TYPE | ❌ | 3240ms |
| 21 | 查询 | 今天的质检结果 | QC_INSPECTION_LIST | QUALITY_CHECK_QUERY | ❌ | 747ms |
| 22 | 查询 | 质检报告 | QC_INSPECTION_LIST | QUALITY_CHECK_EXECUTE | ❌ | 3581ms |
| 23 | 查询 | 不合格的批次有哪些 | QC_INSPECTION_LIST | QUALITY_CHECK_QUERY | ❌ | 428ms |
| 24 | 查询 | 待质检的批次 | QC_INSPECTION_LIST | QUALITY_CHECK_QUERY | ❌ | 3006ms |
| 25 | 查询 | 质量检验记录 | QC_INSPECTION_LIST | QUALITY_CHECK_EXECUTE | ❌ | 3932ms |
| 26 | 查询 | 批次PB001的质检结果 | QC_INSPECTION_QUERY | ERROR | ❌ | 24292ms |
| 27 | 查询 | 这个批次合格吗 | QC_INSPECTION_QUERY | ERROR | ❌ | 66ms |
| 28 | 查询 | 质检标准是什么 | QC_STANDARD_QUERY | ERROR | ❌ | 84ms |
| 29 | 查询 | 牛肉的检验项目有哪些 | QC_STANDARD_QUERY | ERROR | ❌ | 498ms |
| 30 | 查询 | 温度检测记录 | QC_INSPECTION_LIST | ERROR | ❌ | 84ms |
| 31 | 操作 | 创建质检记录 | QC_INSPECTION_CREATE | ERROR | ❌ | 87ms |
| 32 | 操作 | 提交质检结果 | QC_INSPECTION_CREATE | ERROR | ❌ | 75ms |
| 33 | 操作 | 记录一条质检数据 | QC_INSPECTION_CREATE | ERROR | ❌ | 62ms |
| 34 | 操作 | 标记批次为不合格 | QC_INSPECTION_CREATE | ERROR | ❌ | 76ms |
| 35 | 操作 | 更新质检状态 | QC_INSPECTION_CREATE | ERROR | ❌ | 70ms |
| 36 | 查询 | 设备列表 | EQUIPMENT_LIST | ERROR | ❌ | 76ms |
| 37 | 查询 | 有哪些设备 | EQUIPMENT_LIST | ERROR | ❌ | 106ms |
| 38 | 查询 | 车间里的机器 | EQUIPMENT_LIST | ERROR | ❌ | 76ms |
| 39 | 查询 | 设备告警 | EQUIPMENT_ALERT_LIST | ERROR | ❌ | 68ms |
| 40 | 查询 | 有没有设备报警 | EQUIPMENT_ALERT_LIST | ERROR | ❌ | 67ms |
| 41 | 查询 | 今天的设备故障 | EQUIPMENT_ALERT_LIST | ERROR | ❌ | 58ms |
| 42 | 查询 | 哪台设备需要维护 | EQUIPMENT_ALERT_LIST | ERROR | ❌ | 96ms |
| 43 | 查询 | 设备状态 | EQUIPMENT_QUERY | ERROR | ❌ | 82ms |
| 44 | 查询 | 切割机的运行情况 | EQUIPMENT_QUERY | ERROR | ❌ | 79ms |
| 45 | 查询 | 设备维护记录 | EQUIPMENT_MAINTENANCE_LIST | ERROR | ❌ | 71ms |
| 46 | 查询 | 今天谁上班 | WORKER_ATTENDANCE_LIST | ERROR | ❌ | 61ms |
| 47 | 查询 | 考勤记录 | WORKER_ATTENDANCE_LIST | ERROR | ❌ | 65ms |
| 48 | 查询 | 迟到的人有哪些 | WORKER_ATTENDANCE_LIST | ERROR | ❌ | 72ms |
| 49 | 查询 | 工人列表 | WORKER_LIST | ERROR | ❌ | 489ms |
| 50 | 查询 | 有多少员工 | WORKER_LIST | ERROR | ❌ | 74ms |
| 51 | 查询 | 车间人员 | WORKER_LIST | ERROR | ❌ | 63ms |
| 52 | 查询 | 张三的信息 | WORKER_QUERY | ERROR | ❌ | 77ms |
| 53 | 查询 | 员工技能 | WORKER_SKILL_QUERY | ERROR | ❌ | 68ms |
| 54 | 查询 | 谁会操作切割机 | WORKER_SKILL_QUERY | ERROR | ❌ | 62ms |
| 55 | 查询 | 今天的排班 | SCHEDULE_QUERY | ERROR | ❌ | 73ms |
| 56 | 查询 | 明天谁上班 | SCHEDULE_QUERY | ERROR | ❌ | 64ms |
| 57 | 查询 | 排班表 | SCHEDULE_QUERY | ERROR | ❌ | 71ms |
| 58 | 操作 | 给张三请假 | WORKER_LEAVE_CREATE | ERROR | ❌ | 69ms |
| 59 | 操作 | 安排工人上班 | SCHEDULE_CREATE | ERROR | ❌ | 74ms |
| 60 | 操作 | 调整排班 | SCHEDULE_UPDATE | ERROR | ❌ | 70ms |
| 61 | 查询 | 今天的生产报表 | REPORT_PRODUCTION_SUMMARY | ERROR | ❌ | 61ms |
| 62 | 查询 | 产量统计 | REPORT_PRODUCTION_SUMMARY | ERROR | ❌ | 71ms |
| 63 | 查询 | 本周产量多少 | REPORT_PRODUCTION_SUMMARY | ERROR | ❌ | 71ms |
| 64 | 查询 | 效率分析 | REPORT_EFFICIENCY_ANALYSIS | ERROR | ❌ | 89ms |
| 65 | 查询 | 产线效率怎么样 | REPORT_EFFICIENCY_ANALYSIS | ERROR | ❌ | 64ms |
| 66 | 查询 | 哪条线效率最高 | REPORT_EFFICIENCY_ANALYSIS | ERROR | ❌ | 74ms |
| 67 | 查询 | 仪表盘 | REPORT_DASHBOARD_OVERVIEW | ERROR | ❌ | 77ms |
| 68 | 查询 | 数据概览 | REPORT_DASHBOARD_OVERVIEW | ERROR | ❌ | 64ms |
| 69 | 查询 | 今日汇总 | REPORT_DASHBOARD_OVERVIEW | ERROR | ❌ | 72ms |
| 70 | 查询 | KPI达成情况 | REPORT_KPI_QUERY | ERROR | ❌ | 72ms |
| 71 | 操作 | 创建一个新的生产批次 | PROCESSING_BATCH_CREATE | ERROR | ❌ | 71ms |
| 72 | 操作 | 开始新批次 | PROCESSING_BATCH_CREATE | ERROR | ❌ | 66ms |
| 73 | 操作 | 录入生产批次 | PROCESSING_BATCH_CREATE | ERROR | ❌ | 64ms |
| 74 | 操作 | 更新批次状态 | PROCESSING_BATCH_UPDATE | ERROR | ❌ | 63ms |
| 75 | 操作 | 批次完成 | PROCESSING_BATCH_UPDATE | ERROR | ❌ | 69ms |
| 76 | 操作 | 标记批次暂停 | PROCESSING_BATCH_UPDATE | ERROR | ❌ | 82ms |
| 77 | 操作 | 添加原料入库 | MATERIAL_BATCH_CREATE | ERROR | ❌ | 73ms |
| 78 | 操作 | 录入新原料 | MATERIAL_BATCH_CREATE | ERROR | ❌ | 86ms |
| 79 | 操作 | 原材料入库 | MATERIAL_BATCH_CREATE | ERROR | ❌ | 74ms |
| 80 | 操作 | 创建发货单 | SHIPMENT_CREATE | ERROR | ❌ | 75ms |
| 81 | 操作 | 安排发货 | SHIPMENT_CREATE | ERROR | ❌ | 62ms |
| 82 | 操作 | 出货登记 | SHIPMENT_CREATE | ERROR | ❌ | 68ms |
| 83 | 操作 | 更新发货状态 | SHIPMENT_UPDATE | ERROR | ❌ | 67ms |
| 84 | 操作 | 确认收货 | SHIPMENT_UPDATE | ERROR | ❌ | 72ms |
| 85 | 操作 | 记录设备维护 | EQUIPMENT_MAINTENANCE_CREATE | ERROR | ❌ | 73ms |
| 86 | 操作 | 登记设备故障 | EQUIPMENT_ALERT_CREATE | ERROR | ❌ | 190ms |
| 87 | 操作 | 设备保养记录 | EQUIPMENT_MAINTENANCE_CREATE | ERROR | ❌ | 62ms |
| 88 | 操作 | 添加新员工 | WORKER_CREATE | ERROR | ❌ | 88ms |
| 89 | 操作 | 录入工人信息 | WORKER_CREATE | ERROR | ❌ | 74ms |
| 90 | 操作 | 更新员工技能 | WORKER_SKILL_UPDATE | ERROR | ❌ | 82ms |
| 91 | 歧义 | 记录 | SHIPMENT_QUERY | ERROR | ❌ | 88ms |
| 92 | 歧义 | 数据 | REPORT_DASHBOARD_OVERVIEW | ERROR | ❌ | 91ms |
| 93 | 歧义 | 列表 | MATERIAL_TYPE_LIST | ERROR | ❌ | 73ms |
| 94 | 歧义 | 查询 | MATERIAL_BATCH_QUERY | ERROR | ❌ | 75ms |
| 95 | 歧义 | 统计 | REPORT_PRODUCTION_SUMMARY | ERROR | ❌ | 68ms |
| 96 | 歧义 | 信息 | MATERIAL_BATCH_QUERY | ERROR | ❌ | 86ms |
| 97 | 歧义 | 详情 | MATERIAL_BATCH_QUERY | ERROR | ❌ | 94ms |
| 98 | 歧义 | 状态 | PROCESSING_BATCH_LIST | ERROR | ❌ | 72ms |
| 99 | 歧义 | 报表 | REPORT_PRODUCTION_SUMMARY | ERROR | ❌ | 80ms |
| 100 | 歧义 | 管理 | USER_ROLE_ASSIGN | ERROR | ❌ | 57ms |

## 测试汇总

| 类别 | 总数 | 通过 | 通过率 |
|------|------|------|--------|
| 查询类 | 62 | 9 | 14.5% |
| 操作类 | 28 | 0 | 0% |
| 歧义类 | 10 | 0 | 0% |
| **总计** | 100 | 9 | 9.0% |

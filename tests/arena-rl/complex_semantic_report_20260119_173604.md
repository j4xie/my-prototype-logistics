# ArenaRL 复杂语义测试报告

## 测试时间
2026-01-19 17:36:04

## 测试结果

| # | 查询 | 期望 | 实际 | 匹配 | 延迟 | 难度 | 类别 |
|---|------|------|------|------|------|------|------|
| 1 | 帮我看看原料还有多少 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 1631ms | medium | colloquial |
| 2 | 那个批次咋样了 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_DETAIL | ❌ | 418ms | hard | colloquial |
| 3 | 东西发出去没有 | SHIPMENT_QUERY | SHIPMENT_STATUS_UPDATE | ❌ | 30353ms | hard | colloquial |
| 4 | 库存够不够啊 | MATERIAL_LOW_STOCK_ALERT | MATERIAL_BATCH_QUERY | ❌ | 1616ms | medium | colloquial |
| 5 | 机器还转着吗 | EQUIPMENT_LIST | EQUIPMENT_STATUS_UPDATE | ❌ | 30347ms | hard | colloquial |
| 6 | 今天干了多少活 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_LIST | ✅ | 2956ms | medium | colloquial |
| 7 | 谁还没打卡 | ATTENDANCE_ANOMALY | CLOCK_IN | ❌ | 30375ms | medium | colloquial |
| 8 | 质量过关吗 | QUALITY_CHECK_QUERY | QUALITY_CHECK_QUERY | ✅ | 379ms | medium | colloquial |
| 9 | 客户那边催没催 | SHIPMENT_QUERY | CUSTOMER_ACTIVE | ❌ | 30378ms | hard | colloquial |
| 10 | 原料快没了吧 | MATERIAL_LOW_STOCK_ALERT | MATERIAL_LOW_STOCK_ALERT | ✅ | 388ms | medium | colloquial |
| 11 | 我想查一下今天入库的原料批次信息 | MATERIAL_BATCH_QUERY | PROCESSING_BATCH_DETAIL | ❌ | 30369ms | medium | compound |
| 12 | 把这周所有的生产批次状态给我列出来 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_LIST | ✅ | 408ms | medium | compound |
| 13 | 帮我看看客户张三最近一个月的发货记录 | SHIPMENT_BY_CUSTOMER | SHIPMENT_QUERY | ❌ | 30370ms | hard | compound |
| 14 | 系统里面有没有快要过期的原材料需要处理 | MATERIAL_EXPIRING_ALERT | MATERIAL_EXPIRED_QUERY | ❌ | 424ms | medium | compound |
| 15 | 统计一下本月质检不合格的批次有多少 | QUALITY_STATS | QUALITY_STATS | ✅ | 418ms | hard | compound |
| 16 | 找出所有设备告警并且还没有处理的 | ALERT_ACTIVE | EQUIPMENT_LIST | ❌ | 430ms | medium | compound |
| 17 | 查询供应商评分在4分以上的有哪些 | SUPPLIER_RANKING | SUPPLIER_EVALUATE | ❌ | 2227ms | hard | compound |
| 18 | 给我一份完整的批次溯源报告包括原料信息 | TRACE_FULL | TRACE_BATCH | ❌ | 1341ms | medium | compound |
| 19 | 看看今天考勤有没有异常需要处理的 | ATTENDANCE_ANOMALY | ATTENDANCE_STATUS | ❌ | 500ms | medium | compound |
| 20 | 把库存量低于安全线的原料都找出来 | MATERIAL_LOW_STOCK_ALERT | MATERIAL_BATCH_QUERY | ❌ | 516ms | medium | compound |
| 21 | 昨天的生产情况 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_LIST | ✅ | 2899ms | easy | time |
| 22 | 上周入库的原料 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 30568ms | medium | time |
| 23 | 这个月的出货统计 | SHIPMENT_STATS | SHIPMENT_STATS | ✅ | 410ms | easy | time |
| 24 | 最近三天的告警 | ALERT_LIST | ALERT_ACKNOWLEDGE | ❌ | 30382ms | medium | time |
| 25 | 今早的打卡记录 | ATTENDANCE_TODAY | ATTENDANCE_HISTORY | ❌ | 1545ms | easy | time |
| 26 | 下周要过期的原料 | MATERIAL_EXPIRING_ALERT | MATERIAL_EXPIRED_QUERY | ❌ | 417ms | medium | time |
| 27 | 去年同期的质检数据 | QUALITY_STATS | QUALITY_STATS | ✅ | 1602ms | hard | time |
| 28 | 刚才启动的批次 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_TIMELINE | ❌ | 2038ms | medium | time |
| 29 | 月底前要完成的生产 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_LIST | ✅ | 30476ms | hard | time |
| 30 | 季度末的库存盘点 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 1290ms | hard | time |
| 31 | 还没发货的订单 | SHIPMENT_QUERY | SHIPMENT_QUERY | ✅ | 30381ms | medium | negation |
| 32 | 未处理的告警 | ALERT_ACTIVE | ALERT_ACTIVE | ✅ | 430ms | easy | negation |
| 33 | 没有通过质检的批次 | QUALITY_CHECK_QUERY | QUALITY_CHECK_QUERY | ✅ | 2925ms | medium | negation |
| 34 | 不在线的设备 | EQUIPMENT_LIST | EQUIPMENT_STOP | ❌ | 1611ms | medium | negation |
| 35 | 缺勤的员工 | ATTENDANCE_ANOMALY | ATTENDANCE_ANOMALY | ✅ | 1919ms | medium | negation |
| 36 | 库存不足的原料 | MATERIAL_LOW_STOCK_ALERT | MATERIAL_LOW_STOCK_ALERT | ✅ | 421ms | easy | negation |
| 37 | 没有溯源信息的批次 | TRACE_BATCH | PROCESSING_BATCH_TIMELINE | ❌ | 1172ms | hard | negation |
| 38 | 评分不达标的供应商 | SUPPLIER_RANKING | SUPPLIER_EVALUATE | ❌ | 1355ms | hard | negation |
| 39 | 还没入库的原料 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 30467ms | medium | negation |
| 40 | 尚未完成的生产任务 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_CREATE | ❌ | 30340ms | medium | negation |
| 41 | 批次 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_LIST | ✅ | 395ms | hard | ambiguous |
| 42 | 状态 | PROCESSING_BATCH_LIST | EQUIPMENT_STATUS_UPDATE | ❌ | 30440ms | extreme | ambiguous |
| 43 | 详情 | MATERIAL_BATCH_QUERY | REPORT_DASHBOARD_OVERVIEW | ❌ | 30523ms | extreme | ambiguous |
| 44 | 记录 | SHIPMENT_QUERY | SHIPMENT_QUERY | ✅ | 385ms | hard | ambiguous |
| 45 | 数据 | REPORT_DASHBOARD_OVERVIEW | REPORT_DASHBOARD_OVERVIEW | ✅ | 2920ms | extreme | ambiguous |
| 46 | 信息 | MATERIAL_BATCH_QUERY | CUSTOMER_SEARCH | ❌ | 2658ms | extreme | ambiguous |
| 47 | 报表 | REPORT_DASHBOARD_OVERVIEW | REPORT_DASHBOARD_OVERVIEW | ✅ | 548ms | hard | ambiguous |
| 48 | 进度 | PROCESSING_BATCH_LIST | REPORT_DASHBOARD_OVERVIEW | ❌ | 2843ms | hard | ambiguous |
| 49 | 情况 | PROCESSING_BATCH_LIST | QUALITY_CHECK_QUERY | ❌ | 396ms | extreme | ambiguous |
| 50 | 问题 | ALERT_ACTIVE | ALERT_ACTIVE | ✅ | 3204ms | extreme | ambiguous |
| 51 | 处理原料 | MATERIAL_BATCH_CONSUME | MATERIAL_BATCH_QUERY | ❌ | 418ms | hard | ambiguous |
| 52 | 处理告警 | ALERT_ACKNOWLEDGE | ALERT_RESOLVE | ❌ | 30347ms | medium | ambiguous |
| 53 | 更新批次 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_CREATE | ❌ | 30345ms | hard | ambiguous |
| 54 | 修改发货 | SHIPMENT_STATUS_UPDATE | PLAN_UPDATE | ❌ | 30331ms | medium | ambiguous |
| 55 | 操作设备 | EQUIPMENT_START | EQUIPMENT_START | ✅ | 30481ms | hard | ambiguous |
| 56 | 提交质检 | QUALITY_CHECK_EXECUTE | QUALITY_CHECK_QUERY | ❌ | 363ms | medium | ambiguous |
| 57 | 确认收货 | SHIPMENT_STATUS_UPDATE | SHIPMENT_QUERY | ❌ | 1507ms | hard | ambiguous |
| 58 | 完成任务 | PROCESSING_BATCH_COMPLETE | SCHEDULING_SET_MANUAL | ❌ | 30351ms | medium | ambiguous |
| 59 | 开始工作 | CLOCK_IN | CLOCK_IN | ✅ | 100ms | hard | ambiguous |

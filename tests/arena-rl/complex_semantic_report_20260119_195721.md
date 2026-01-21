# ArenaRL 复杂语义测试报告

## 测试时间
2026-01-19 19:57:21

## 测试结果

| # | 查询 | 期望 | 实际 | 匹配 | 延迟 | 难度 | 类别 |
|---|------|------|------|------|------|------|------|
| 1 | 帮我看看原料还有多少 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 2310ms | medium | colloquial |
| 2 | 那个批次咋样了 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_DETAIL | ❌ | 826ms | hard | colloquial |
| 3 | 东西发出去没有 | SHIPMENT_QUERY | SHIPMENT_STATUS_UPDATE | ❌ | 30995ms | hard | colloquial |
| 4 | 库存够不够啊 | MATERIAL_LOW_STOCK_ALERT | REPORT_INVENTORY | ❌ | 341ms | medium | colloquial |
| 5 | 机器还转着吗 | EQUIPMENT_LIST | EQUIPMENT_STATUS_UPDATE | ❌ | 30486ms | hard | colloquial |
| 6 | 今天干了多少活 | PROCESSING_BATCH_LIST | REPORT_DASHBOARD_OVERVIEW | ❌ | 543ms | medium | colloquial |
| 7 | 谁还没打卡 | ATTENDANCE_ANOMALY | CLOCK_IN | ❌ | 30475ms | medium | colloquial |
| 8 | 质量过关吗 | QUALITY_CHECK_QUERY | QUALITY_CHECK_QUERY | ✅ | 395ms | medium | colloquial |
| 9 | 客户那边催没催 | SHIPMENT_QUERY | SHIPMENT_QUERY | ✅ | 1430ms | hard | colloquial |
| 10 | 原料快没了吧 | MATERIAL_LOW_STOCK_ALERT | MATERIAL_LOW_STOCK_ALERT | ✅ | 684ms | medium | colloquial |
| 11 | 我想查一下今天入库的原料批次信息 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 2204ms | medium | compound |
| 12 | 把这周所有的生产批次状态给我列出来 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_LIST | ✅ | 473ms | medium | compound |
| 13 | 帮我看看客户张三最近一个月的发货记录 | SHIPMENT_BY_CUSTOMER | SHIPMENT_QUERY | ❌ | 30491ms | hard | compound |
| 14 | 系统里面有没有快要过期的原材料需要处理 | MATERIAL_EXPIRING_ALERT | MATERIAL_EXPIRING_ALERT | ✅ | 459ms | medium | compound |
| 15 | 统计一下本月质检不合格的批次有多少 | QUALITY_STATS | PROCESSING_BATCH_LIST | ❌ | 1902ms | hard | compound |
| 16 | 找出所有设备告警并且还没有处理的 | ALERT_ACTIVE | EQUIPMENT_LIST | ❌ | 212ms | medium | compound |
| 17 | 查询供应商评分在4分以上的有哪些 | SUPPLIER_RANKING | PRODUCT_TYPE_QUERY | ❌ | 462ms | hard | compound |
| 18 | 给我一份完整的批次溯源报告包括原料信息 | TRACE_FULL | TRACE_BATCH | ❌ | 661ms | medium | compound |
| 19 | 看看今天考勤有没有异常需要处理的 | ATTENDANCE_ANOMALY | ATTENDANCE_TODAY | ❌ | 183ms | medium | compound |
| 20 | 把库存量低于安全线的原料都找出来 | MATERIAL_LOW_STOCK_ALERT | MATERIAL_BATCH_QUERY | ❌ | 787ms | medium | compound |
| 21 | 昨天的生产情况 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_LIST | ✅ | 3393ms | easy | time |
| 22 | 上周入库的原料 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 2075ms | medium | time |
| 23 | 这个月的出货统计 | SHIPMENT_STATS | SHIPMENT_STATS | ✅ | 322ms | easy | time |
| 24 | 最近三天的告警 | ALERT_LIST | ALERT_ACKNOWLEDGE | ❌ | 30402ms | medium | time |
| 25 | 今早的打卡记录 | ATTENDANCE_TODAY | ATTENDANCE_HISTORY | ❌ | 1920ms | easy | time |
| 26 | 下周要过期的原料 | MATERIAL_EXPIRING_ALERT | MATERIAL_EXPIRED_QUERY | ❌ | 454ms | medium | time |
| 27 | 去年同期的质检数据 | QUALITY_STATS | QUALITY_STATS | ✅ | 1501ms | hard | time |
| 28 | 刚才启动的批次 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_START | ❌ | 30395ms | medium | time |
| 29 | 月底前要完成的生产 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_COMPLETE | ❌ | 1619ms | hard | time |
| 30 | 季度末的库存盘点 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 1182ms | hard | time |
| 31 | 还没发货的订单 | SHIPMENT_QUERY | SHIPMENT_QUERY | ✅ | 31279ms | medium | negation |
| 32 | 未处理的告警 | ALERT_ACTIVE | ALERT_ACTIVE | ✅ | 188ms | easy | negation |
| 33 | 没有通过质检的批次 | QUALITY_CHECK_QUERY | QUALITY_CHECK_QUERY | ✅ | 2283ms | medium | negation |
| 34 | 不在线的设备 | EQUIPMENT_LIST | EQUIPMENT_STOP | ❌ | 1243ms | medium | negation |
| 35 | 缺勤的员工 | ATTENDANCE_ANOMALY | ATTENDANCE_ANOMALY | ✅ | 1610ms | medium | negation |
| 36 | 库存不足的原料 | MATERIAL_LOW_STOCK_ALERT | MATERIAL_LOW_STOCK_ALERT | ✅ | 445ms | easy | negation |
| 37 | 没有溯源信息的批次 | TRACE_BATCH | TRACE_BATCH | ✅ | 1181ms | hard | negation |
| 38 | 评分不达标的供应商 | SUPPLIER_RANKING | SUPPLIER_EVALUATE | ❌ | 2359ms | hard | negation |
| 39 | 还没入库的原料 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 189ms | medium | negation |
| 40 | 尚未完成的生产任务 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_COMPLETE | ❌ | 2025ms | medium | negation |
| 41 | 批次 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_LIST | ✅ | 532ms | hard | ambiguous |
| 42 | 状态 | PROCESSING_BATCH_LIST | EQUIPMENT_STATUS_UPDATE | ❌ | 30819ms | extreme | ambiguous |
| 43 | 详情 | MATERIAL_BATCH_QUERY | REPORT_DASHBOARD_OVERVIEW | ❌ | 30496ms | extreme | ambiguous |
| 44 | 记录 | SHIPMENT_QUERY | SHIPMENT_QUERY | ✅ | 2775ms | hard | ambiguous |
| 45 | 数据 | REPORT_DASHBOARD_OVERVIEW | REPORT_DASHBOARD_OVERVIEW | ✅ | 2967ms | extreme | ambiguous |
| 46 | 信息 | MATERIAL_BATCH_QUERY | CUSTOMER_SEARCH | ❌ | 2971ms | extreme | ambiguous |
| 47 | 报表 | REPORT_DASHBOARD_OVERVIEW | REPORT_DASHBOARD_OVERVIEW | ✅ | 475ms | hard | ambiguous |
| 48 | 进度 | PROCESSING_BATCH_LIST | REPORT_DASHBOARD_OVERVIEW | ❌ | 2687ms | hard | ambiguous |

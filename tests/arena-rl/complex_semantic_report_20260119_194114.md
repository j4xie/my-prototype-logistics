# ArenaRL 复杂语义测试报告

## 测试时间
2026-01-19 19:41:14

## 测试结果

| # | 查询 | 期望 | 实际 | 匹配 | 延迟 | 难度 | 类别 |
|---|------|------|------|------|------|------|------|
| 1 | 帮我看看原料还有多少 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 2533ms | medium | colloquial |
| 2 | 那个批次咋样了 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_DETAIL | ❌ | 688ms | hard | colloquial |
| 3 | 东西发出去没有 | SHIPMENT_QUERY | MATERIAL_BATCH_QUERY | ❌ | 828ms | hard | colloquial |
| 4 | 库存够不够啊 | MATERIAL_LOW_STOCK_ALERT | MATERIAL_BATCH_QUERY | ❌ | 603ms | medium | colloquial |
| 5 | 机器还转着吗 | EQUIPMENT_LIST | EQUIPMENT_STATUS_UPDATE | ❌ | 30414ms | hard | colloquial |
| 6 | 今天干了多少活 | PROCESSING_BATCH_LIST | REPORT_DASHBOARD_OVERVIEW | ❌ | 498ms | medium | colloquial |
| 7 | 谁还没打卡 | ATTENDANCE_ANOMALY | CLOCK_IN | ❌ | 30877ms | medium | colloquial |
| 8 | 质量过关吗 | QUALITY_CHECK_QUERY | QUALITY_CHECK_QUERY | ✅ | 553ms | medium | colloquial |
| 9 | 客户那边催没催 | SHIPMENT_QUERY | SHIPMENT_QUERY | ✅ | 1713ms | hard | colloquial |
| 10 | 原料快没了吧 | MATERIAL_LOW_STOCK_ALERT | MATERIAL_LOW_STOCK_ALERT | ✅ | 429ms | medium | colloquial |
| 11 | 我想查一下今天入库的原料批次信息 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 2316ms | medium | compound |
| 12 | 把这周所有的生产批次状态给我列出来 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_LIST | ✅ | 573ms | medium | compound |
| 13 | 帮我看看客户张三最近一个月的发货记录 | SHIPMENT_BY_CUSTOMER | SHIPMENT_STATUS_UPDATE | ❌ | 30390ms | hard | compound |
| 14 | 系统里面有没有快要过期的原材料需要处理 | MATERIAL_EXPIRING_ALERT | MATERIAL_EXPIRING_ALERT | ✅ | 422ms | medium | compound |
| 15 | 统计一下本月质检不合格的批次有多少 | QUALITY_STATS | QUALITY_STATS | ✅ | 684ms | hard | compound |
| 16 | 找出所有设备告警并且还没有处理的 | ALERT_ACTIVE | ALERT_ACKNOWLEDGE | ❌ | 1368ms | medium | compound |
| 17 | 查询供应商评分在4分以上的有哪些 | SUPPLIER_RANKING | PRODUCT_TYPE_QUERY | ❌ | 400ms | hard | compound |
| 18 | 给我一份完整的批次溯源报告包括原料信息 | TRACE_FULL | TRACE_BATCH | ❌ | 1075ms | medium | compound |
| 19 | 看看今天考勤有没有异常需要处理的 | ATTENDANCE_ANOMALY | ATTENDANCE_STATUS | ❌ | 532ms | medium | compound |
| 20 | 把库存量低于安全线的原料都找出来 | MATERIAL_LOW_STOCK_ALERT | MATERIAL_BATCH_QUERY | ❌ | 707ms | medium | compound |
| 21 | 昨天的生产情况 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_LIST | ✅ | 2947ms | easy | time |
| 22 | 上周入库的原料 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_CREATE | ❌ | 30449ms | medium | time |
| 23 | 这个月的出货统计 | SHIPMENT_STATS | REPORT_DASHBOARD_OVERVIEW | ❌ | 425ms | easy | time |
| 24 | 最近三天的告警 | ALERT_LIST | ALERT_ACKNOWLEDGE | ❌ | 30380ms | medium | time |
| 25 | 今早的打卡记录 | ATTENDANCE_TODAY | ATTENDANCE_HISTORY | ❌ | 1397ms | easy | time |
| 26 | 下周要过期的原料 | MATERIAL_EXPIRING_ALERT | MATERIAL_EXPIRED_QUERY | ❌ | 561ms | medium | time |
| 27 | 去年同期的质检数据 | QUALITY_STATS | QUALITY_STATS | ✅ | 1514ms | hard | time |
| 28 | 刚才启动的批次 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_START | ❌ | 30360ms | medium | time |
| 29 | 月底前要完成的生产 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_COMPLETE | ❌ | 1675ms | hard | time |
| 30 | 季度末的库存盘点 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 466ms | hard | time |
| 31 | 还没发货的订单 | SHIPMENT_QUERY | SHIPMENT_QUERY | ✅ | 30355ms | medium | negation |
| 32 | 未处理的告警 | ALERT_ACTIVE | ALERT_ACKNOWLEDGE | ❌ | 1637ms | easy | negation |
| 33 | 没有通过质检的批次 | QUALITY_CHECK_QUERY | QUALITY_CHECK_QUERY | ✅ | 2675ms | medium | negation |
| 34 | 不在线的设备 | EQUIPMENT_LIST | EQUIPMENT_STOP | ❌ | 1419ms | medium | negation |
| 35 | 缺勤的员工 | ATTENDANCE_ANOMALY | ATTENDANCE_ANOMALY | ✅ | 1702ms | medium | negation |
| 36 | 库存不足的原料 | MATERIAL_LOW_STOCK_ALERT | MATERIAL_LOW_STOCK_ALERT | ✅ | 391ms | easy | negation |
| 37 | 没有溯源信息的批次 | TRACE_BATCH | TRACE_BATCH | ✅ | 450ms | hard | negation |
| 38 | 评分不达标的供应商 | SUPPLIER_RANKING | SUPPLIER_EVALUATE | ❌ | 1473ms | hard | negation |

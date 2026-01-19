# ArenaRL 复杂语义测试报告

## 测试时间
2026-01-19 17:47:07

## 测试结果

| # | 查询 | 期望 | 实际 | 匹配 | 延迟 | 难度 | 类别 |
|---|------|------|------|------|------|------|------|
| 1 | 帮我看看原料还有多少 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 383ms | medium | colloquial |
| 2 | 那个批次咋样了 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_DETAIL | ❌ | 413ms | hard | colloquial |
| 3 | 东西发出去没有 | SHIPMENT_QUERY | SHIPMENT_STATUS_UPDATE | ❌ | 30351ms | hard | colloquial |
| 4 | 库存够不够啊 | MATERIAL_LOW_STOCK_ALERT | MATERIAL_BATCH_QUERY | ❌ | 388ms | medium | colloquial |
| 5 | 机器还转着吗 | EQUIPMENT_LIST | EQUIPMENT_STATUS_UPDATE | ❌ | 30344ms | hard | colloquial |
| 6 | 今天干了多少活 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_LIST | ✅ | 3465ms | medium | colloquial |
| 7 | 谁还没打卡 | ATTENDANCE_ANOMALY | CLOCK_IN | ❌ | 30336ms | medium | colloquial |
| 8 | 质量过关吗 | QUALITY_CHECK_QUERY | QUALITY_CHECK_QUERY | ✅ | 361ms | medium | colloquial |
| 9 | 客户那边催没催 | SHIPMENT_QUERY | CUSTOMER_ACTIVE | ❌ | 30360ms | hard | colloquial |
| 10 | 原料快没了吧 | MATERIAL_LOW_STOCK_ALERT | MATERIAL_LOW_STOCK_ALERT | ✅ | 402ms | medium | colloquial |
| 11 | 我想查一下今天入库的原料批次信息 | MATERIAL_BATCH_QUERY | PROCESSING_BATCH_DETAIL | ❌ | 30388ms | medium | compound |
| 12 | 把这周所有的生产批次状态给我列出来 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_LIST | ✅ | 402ms | medium | compound |
| 13 | 帮我看看客户张三最近一个月的发货记录 | SHIPMENT_BY_CUSTOMER | SHIPMENT_QUERY | ❌ | 30368ms | hard | compound |
| 14 | 系统里面有没有快要过期的原材料需要处理 | MATERIAL_EXPIRING_ALERT | MATERIAL_EXPIRED_QUERY | ❌ | 416ms | medium | compound |
| 15 | 统计一下本月质检不合格的批次有多少 | QUALITY_STATS | QUALITY_STATS | ✅ | 420ms | hard | compound |
| 16 | 找出所有设备告警并且还没有处理的 | ALERT_ACTIVE | EQUIPMENT_LIST | ❌ | 438ms | medium | compound |
| 17 | 查询供应商评分在4分以上的有哪些 | SUPPLIER_RANKING | SUPPLIER_EVALUATE | ❌ | 2338ms | hard | compound |
| 18 | 给我一份完整的批次溯源报告包括原料信息 | TRACE_FULL | TRACE_BATCH | ❌ | 1256ms | medium | compound |
| 19 | 看看今天考勤有没有异常需要处理的 | ATTENDANCE_ANOMALY | ATTENDANCE_STATUS | ❌ | 519ms | medium | compound |
| 20 | 把库存量低于安全线的原料都找出来 | MATERIAL_LOW_STOCK_ALERT | MATERIAL_BATCH_QUERY | ❌ | 729ms | medium | compound |
| 21 | 昨天的生产情况 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_LIST | ✅ | 2828ms | easy | time |
| 22 | 上周入库的原料 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 30474ms | medium | time |
| 23 | 这个月的出货统计 | SHIPMENT_STATS | SHIPMENT_STATS | ✅ | 390ms | easy | time |
| 24 | 最近三天的告警 | ALERT_LIST | ALERT_ACKNOWLEDGE | ❌ | 30360ms | medium | time |
| 25 | 今早的打卡记录 | ATTENDANCE_TODAY | ATTENDANCE_HISTORY | ❌ | 1758ms | easy | time |
| 26 | 下周要过期的原料 | MATERIAL_EXPIRING_ALERT | MATERIAL_EXPIRED_QUERY | ❌ | 410ms | medium | time |
| 27 | 去年同期的质检数据 | QUALITY_STATS | QUALITY_STATS | ✅ | 431ms | hard | time |
| 28 | 刚才启动的批次 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_TIMELINE | ❌ | 1745ms | medium | time |
| 29 | 月底前要完成的生产 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_LIST | ✅ | 30576ms | hard | time |
| 30 | 季度末的库存盘点 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 467ms | hard | time |
| 31 | 还没发货的订单 | SHIPMENT_QUERY | SHIPMENT_QUERY | ✅ | 30355ms | medium | negation |
| 32 | 未处理的告警 | ALERT_ACTIVE | ALERT_ACTIVE | ✅ | 388ms | easy | negation |
| 33 | 没有通过质检的批次 | QUALITY_CHECK_QUERY | QUALITY_CHECK_QUERY | ✅ | 408ms | medium | negation |
| 34 | 不在线的设备 | EQUIPMENT_LIST | EQUIPMENT_STOP | ❌ | 1611ms | medium | negation |
| 35 | 缺勤的员工 | ATTENDANCE_ANOMALY | ATTENDANCE_ANOMALY | ✅ | 1764ms | medium | negation |
| 36 | 库存不足的原料 | MATERIAL_LOW_STOCK_ALERT | MATERIAL_LOW_STOCK_ALERT | ✅ | 441ms | easy | negation |
| 37 | 没有溯源信息的批次 | TRACE_BATCH | PROCESSING_BATCH_TIMELINE | ❌ | 1303ms | hard | negation |
| 38 | 评分不达标的供应商 | SUPPLIER_RANKING | SUPPLIER_EVALUATE | ❌ | 1501ms | hard | negation |
| 39 | 还没入库的原料 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 30519ms | medium | negation |
| 40 | 尚未完成的生产任务 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_CREATE | ❌ | 30340ms | medium | negation |
| 41 | 批次 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_LIST | ✅ | 391ms | hard | ambiguous |
| 42 | 状态 | PROCESSING_BATCH_LIST | EQUIPMENT_STATUS_UPDATE | ❌ | 30405ms | extreme | ambiguous |
| 43 | 详情 | MATERIAL_BATCH_QUERY | REPORT_DASHBOARD_OVERVIEW | ❌ | 30345ms | extreme | ambiguous |
| 44 | 记录 | SHIPMENT_QUERY | SHIPMENT_QUERY | ✅ | 376ms | hard | ambiguous |
| 45 | 数据 | REPORT_DASHBOARD_OVERVIEW | REPORT_DASHBOARD_OVERVIEW | ✅ | 416ms | extreme | ambiguous |
| 46 | 信息 | MATERIAL_BATCH_QUERY | CUSTOMER_SEARCH | ❌ | 370ms | extreme | ambiguous |
| 47 | 报表 | REPORT_DASHBOARD_OVERVIEW | REPORT_DASHBOARD_OVERVIEW | ✅ | 596ms | hard | ambiguous |
| 48 | 进度 | PROCESSING_BATCH_LIST | REPORT_DASHBOARD_OVERVIEW | ❌ | 463ms | hard | ambiguous |
| 49 | 情况 | PROCESSING_BATCH_LIST | QUALITY_CHECK_QUERY | ❌ | 499ms | extreme | ambiguous |
| 50 | 问题 | ALERT_ACTIVE | ALERT_ACTIVE | ✅ | 619ms | extreme | ambiguous |
| 51 | 处理原料 | MATERIAL_BATCH_CONSUME | MATERIAL_BATCH_QUERY | ❌ | 551ms | hard | ambiguous |
| 52 | 处理告警 | ALERT_ACKNOWLEDGE | ALERT_RESOLVE | ❌ | 30496ms | medium | ambiguous |
| 53 | 更新批次 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_CREATE | ❌ | 30417ms | hard | ambiguous |
| 54 | 修改发货 | SHIPMENT_STATUS_UPDATE | PLAN_UPDATE | ❌ | 30359ms | medium | ambiguous |
| 55 | 操作设备 | EQUIPMENT_START | EQUIPMENT_START | ✅ | 30357ms | hard | ambiguous |
| 56 | 提交质检 | QUALITY_CHECK_EXECUTE | QUALITY_CHECK_QUERY | ❌ | 380ms | medium | ambiguous |
| 57 | 确认收货 | SHIPMENT_STATUS_UPDATE | SHIPMENT_QUERY | ❌ | 396ms | hard | ambiguous |
| 58 | 完成任务 | PROCESSING_BATCH_COMPLETE | SCHEDULING_SET_MANUAL | ❌ | 30515ms | medium | ambiguous |
| 59 | 开始工作 | CLOCK_IN | CLOCK_IN | ✅ | 100ms | hard | ambiguous |
| 60 | 结束流程 | PROCESSING_BATCH_COMPLETE | CLOCK_OUT | ❌ | 361ms | hard | ambiguous |
| 61 | 原料的质检报告 | QUALITY_CHECK_QUERY | MATERIAL_BATCH_QUERY | ❌ | 401ms | hard | cross-domain |
| 62 | 生产用的原料 | MATERIAL_BATCH_QUERY | TRACE_BATCH | ❌ | 30354ms | medium | cross-domain |
| 63 | 发货的批次追溯 | TRACE_BATCH | TRACE_BATCH | ✅ | 1552ms | hard | cross-domain |
| 64 | 设备的告警历史 | ALERT_BY_EQUIPMENT | ALERT_BY_EQUIPMENT | ✅ | 666ms | medium | cross-domain |
| 65 | 客户的历史订单 | CUSTOMER_PURCHASE_HISTORY | CUSTOMER_PURCHASE_HISTORY | ✅ | 1116ms | medium | cross-domain |
| 66 | 供应商的原料批次 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 1669ms | hard | cross-domain |
| 67 | 生产线的质量统计 | QUALITY_STATS | QUALITY_STATS | ✅ | 537ms | hard | cross-domain |
| 68 | 车间的考勤情况 | ATTENDANCE_DEPARTMENT | ATTENDANCE_TODAY | ❌ | 469ms | medium | cross-domain |
| 69 | 仓库的库存告警 | MATERIAL_LOW_STOCK_ALERT | ALERT_LIST | ❌ | 2307ms | medium | cross-domain |
| 70 | 订单的溯源码 | TRACE_BATCH | TRACE_PUBLIC | ❌ | 3203ms | hard | cross-domain |
| 71 | 库存最多的原料 | MATERIAL_BATCH_QUERY | MATERIAL_LOW_STOCK_ALERT | ❌ | 403ms | medium | quantitative |
| 72 | 告警最频繁的设备 | ALERT_BY_EQUIPMENT | ALERT_BY_EQUIPMENT | ✅ | 635ms | hard | quantitative |
| 73 | 生产效率最高的批次 | PROCESSING_BATCH_LIST | REPORT_EFFICIENCY | ❌ | 2257ms | hard | quantitative |
| 74 | 评分最高的供应商 | SUPPLIER_RANKING | SUPPLIER_EVALUATE | ❌ | 2860ms | medium | quantitative |
| 75 | 出勤率最低的员工 | ATTENDANCE_STATS | ATTENDANCE_ANOMALY | ❌ | 4274ms | hard | quantitative |
| 76 | 质检合格率最差的 | QUALITY_STATS | QUALITY_CHECK_EXECUTE | ❌ | 30353ms | hard | quantitative |
| 77 | 发货量最大的客户 | CUSTOMER_STATS | SHIPMENT_BY_DATE | ❌ | 30357ms | hard | quantitative |
| 78 | 使用频率最高的设备 | EQUIPMENT_STATS | EQUIPMENT_STATS | ✅ | 2344ms | hard | quantitative |
| 79 | 消耗最快的原料 | MATERIAL_BATCH_QUERY | MATERIAL_LOW_STOCK_ALERT | ❌ | 473ms | hard | quantitative |
| 80 | 等待时间最长的订单 | SHIPMENT_QUERY | SHIPMENT_BY_CUSTOMER | ❌ | 30366ms | hard | quantitative |
| 81 | 原料还剩多少 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 415ms | easy | question |
| 82 | 今天生产了几批 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_START | ❌ | 1161ms | medium | question |
| 83 | 哪些订单还没发 | SHIPMENT_QUERY | SHIPMENT_QUERY | ✅ | 2824ms | medium | question |
| 84 | 谁的考勤有问题 | ATTENDANCE_ANOMALY | ATTENDANCE_ANOMALY | ✅ | 2383ms | medium | question |
| 85 | 设备为什么报警 | ALERT_DIAGNOSE | ALERT_BY_EQUIPMENT | ❌ | 441ms | medium | question |
| 86 | 质检为什么不合格 | QUALITY_CHECK_QUERY | QUALITY_DISPOSITION_EXECUTE | ❌ | 30366ms | hard | question |
| 87 | 库存什么时候能到 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 2563ms | hard | question |
| 88 | 这批货发给谁 | SHIPMENT_QUERY | SHIPMENT_QUERY | ✅ | 30343ms | medium | question |
| 89 | 哪个供应商最靠谱 | SUPPLIER_RANKING | SUPPLIER_SEARCH | ❌ | 369ms | medium | question |
| 90 | 生产进度怎么样了 | PROCESSING_BATCH_LIST | REPORT_DASHBOARD_OVERVIEW | ❌ | 30357ms | easy | question |
| 91 | 把原料入库 | MATERIAL_BATCH_CREATE | MATERIAL_BATCH_CREATE | ✅ | 1131ms | easy | imperative |
| 92 | 开始生产这批 | PROCESSING_BATCH_START | PROCESSING_BATCH_START | ✅ | 30359ms | easy | imperative |
| 93 | 发货给客户A | SHIPMENT_CREATE | SHIPMENT_CREATE | ✅ | 30358ms | medium | imperative |
| 94 | 停掉那台设备 | EQUIPMENT_STOP | EQUIPMENT_STOP | ✅ | 30346ms | medium | imperative |
| 95 | 确认这个告警 | ALERT_ACKNOWLEDGE | ALERT_RESOLVE | ❌ | 30471ms | easy | imperative |
| 96 | 给我打印溯源码 | TRACE_BATCH | TRACE_PUBLIC | ❌ | 3400ms | medium | imperative |
| 97 | 登记今天的考勤 | CLOCK_IN | ATTENDANCE_STATUS | ❌ | 30363ms | medium | imperative |
| 98 | 做一下质检 | QUALITY_CHECK_EXECUTE | QUALITY_CHECK_QUERY | ❌ | 398ms | easy | imperative |
| 99 | 释放预留的原料 | MATERIAL_BATCH_RELEASE | MATERIAL_BATCH_RELEASE | ✅ | 30372ms | medium | imperative |
| 100 | 暂停当前生产 | PROCESSING_BATCH_PAUSE | SCHEDULING_SET_MANUAL | ❌ | 30350ms | easy | imperative |

## 汇总统计

| 指标 | 值 |
|------|-----|
| 总测试数 | 100 |
| 通过数 | 42 |
| 失败数 | 58 |
| 通过率 | 42.0% |
| 平均延迟 | 10759ms |

## 按难度统计

| 难度 | 通过/总数 | 通过率 |
|------|----------|--------|
| easy | 42/100 | 42.0% |
| medium | 42/100 | 42.0% |
| hard | 42/100 | 42.0% |
| extreme | 42/100 | 42.0% |

## 按类别统计

| 类别 | 通过/总数 | 通过率 |
|------|----------|--------|
| colloquial | 42/100 | 42.0% |
| compound | 42/100 | 42.0% |
| time | 42/100 | 42.0% |
| negation | 42/100 | 42.0% |
| ambiguous | 42/100 | 42.0% |
| cross-domain | 42/100 | 42.0% |
| quantitative | 42/100 | 42.0% |
| question | 42/100 | 42.0% |
| imperative | 42/100 | 42.0% |

## 失败用例分析


| 查询 | 期望 | 实际 | 难度 | 类别 |
|------|------|------|------|------|
| 那个批次咋样了 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_DETAIL | hard | colloquial |
| 东西发出去没有 | SHIPMENT_QUERY | SHIPMENT_STATUS_UPDATE | hard | colloquial |
| 库存够不够啊 | MATERIAL_LOW_STOCK_ALERT | MATERIAL_BATCH_QUERY | medium | colloquial |
| 机器还转着吗 | EQUIPMENT_LIST | EQUIPMENT_STATUS_UPDATE | hard | colloquial |
| 谁还没打卡 | ATTENDANCE_ANOMALY | CLOCK_IN | medium | colloquial |
| 客户那边催没催 | SHIPMENT_QUERY | CUSTOMER_ACTIVE | hard | colloquial |
| 我想查一下今天入库的原料批次信息 | MATERIAL_BATCH_QUERY | PROCESSING_BATCH_DETAIL | medium | compound |
| 帮我看看客户张三最近一个月的发货记录 | SHIPMENT_BY_CUSTOMER | SHIPMENT_QUERY | hard | compound |
| 系统里面有没有快要过期的原材料需要处理 | MATERIAL_EXPIRING_ALERT | MATERIAL_EXPIRED_QUERY | medium | compound |
| 找出所有设备告警并且还没有处理的 | ALERT_ACTIVE | EQUIPMENT_LIST | medium | compound |
| 查询供应商评分在4分以上的有哪些 | SUPPLIER_RANKING | SUPPLIER_EVALUATE | hard | compound |
| 给我一份完整的批次溯源报告包括原料信息 | TRACE_FULL | TRACE_BATCH | medium | compound |
| 看看今天考勤有没有异常需要处理的 | ATTENDANCE_ANOMALY | ATTENDANCE_STATUS | medium | compound |
| 把库存量低于安全线的原料都找出来 | MATERIAL_LOW_STOCK_ALERT | MATERIAL_BATCH_QUERY | medium | compound |
| 最近三天的告警 | ALERT_LIST | ALERT_ACKNOWLEDGE | medium | time |
| 今早的打卡记录 | ATTENDANCE_TODAY | ATTENDANCE_HISTORY | easy | time |
| 下周要过期的原料 | MATERIAL_EXPIRING_ALERT | MATERIAL_EXPIRED_QUERY | medium | time |
| 刚才启动的批次 | PROCESSING_BATCH_LIST | TRACE_BATCH | medium | time |
| 不在线的设备 | EQUIPMENT_LIST | EQUIPMENT_STOP | medium | negation |
| 没有溯源信息的批次 | TRACE_BATCH | PROCESSING_BATCH_TIMELINE | hard | negation |
| 评分不达标的供应商 | SUPPLIER_RANKING | SUPPLIER_EVALUATE | hard | negation |
| 尚未完成的生产任务 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_CREATE | medium | negation |
| 状态 | PROCESSING_BATCH_LIST | EQUIPMENT_STATUS_UPDATE | extreme | ambiguous |
| 详情 | MATERIAL_BATCH_QUERY | REPORT_DASHBOARD_OVERVIEW | extreme | ambiguous |
| 信息 | MATERIAL_BATCH_QUERY | CUSTOMER_SEARCH | extreme | ambiguous |
| 进度 | PROCESSING_BATCH_LIST | REPORT_DASHBOARD_OVERVIEW | hard | ambiguous |
| 情况 | PROCESSING_BATCH_LIST | QUALITY_CHECK_QUERY | extreme | ambiguous |
| 处理原料 | MATERIAL_BATCH_CONSUME | MATERIAL_BATCH_QUERY | hard | ambiguous |
| 处理告警 | ALERT_ACKNOWLEDGE | ALERT_RESOLVE | medium | ambiguous |
| 更新批次 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_CREATE | hard | ambiguous |
| 修改发货 | SHIPMENT_STATUS_UPDATE | PLAN_UPDATE | medium | ambiguous |
| 提交质检 | QUALITY_CHECK_EXECUTE | QUALITY_CHECK_QUERY | medium | ambiguous |
| 确认收货 | SHIPMENT_STATUS_UPDATE | SHIPMENT_QUERY | hard | ambiguous |
| 完成任务 | PROCESSING_BATCH_COMPLETE | SCHEDULING_SET_MANUAL | medium | ambiguous |
| 结束流程 | PROCESSING_BATCH_COMPLETE | CLOCK_OUT | hard | ambiguous |
| 原料的质检报告 | QUALITY_CHECK_QUERY | MATERIAL_BATCH_QUERY | hard | cross-domain |
| 生产用的原料 | MATERIAL_BATCH_QUERY | TRACE_BATCH | medium | cross-domain |
| 车间的考勤情况 | ATTENDANCE_DEPARTMENT | ATTENDANCE_TODAY | medium | cross-domain |
| 仓库的库存告警 | MATERIAL_LOW_STOCK_ALERT | ALERT_LIST | medium | cross-domain |
| 订单的溯源码 | TRACE_BATCH | TRACE_PUBLIC | hard | cross-domain |
| 库存最多的原料 | MATERIAL_BATCH_QUERY | MATERIAL_LOW_STOCK_ALERT | medium | quantitative |
| 生产效率最高的批次 | PROCESSING_BATCH_LIST | REPORT_EFFICIENCY | hard | quantitative |
| 评分最高的供应商 | SUPPLIER_RANKING | SUPPLIER_EVALUATE | medium | quantitative |
| 出勤率最低的员工 | ATTENDANCE_STATS | ATTENDANCE_ANOMALY | hard | quantitative |
| 质检合格率最差的 | QUALITY_STATS | QUALITY_CHECK_EXECUTE | hard | quantitative |
| 发货量最大的客户 | CUSTOMER_STATS | SHIPMENT_BY_DATE | hard | quantitative |
| 消耗最快的原料 | MATERIAL_BATCH_QUERY | MATERIAL_LOW_STOCK_ALERT | hard | quantitative |
| 等待时间最长的订单 | SHIPMENT_QUERY | SHIPMENT_BY_CUSTOMER | hard | quantitative |
| 今天生产了几批 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_START | medium | question |
| 设备为什么报警 | ALERT_DIAGNOSE | ALERT_BY_EQUIPMENT | medium | question |
| 质检为什么不合格 | QUALITY_CHECK_QUERY | QUALITY_DISPOSITION_EXECUTE | hard | question |
| 哪个供应商最靠谱 | SUPPLIER_RANKING | SUPPLIER_SEARCH | medium | question |
| 生产进度怎么样了 | PROCESSING_BATCH_LIST | REPORT_DASHBOARD_OVERVIEW | easy | question |
| 确认这个告警 | ALERT_ACKNOWLEDGE | ALERT_RESOLVE | easy | imperative |
| 给我打印溯源码 | TRACE_BATCH | TRACE_PUBLIC | medium | imperative |
| 登记今天的考勤 | CLOCK_IN | ATTENDANCE_STATUS | medium | imperative |
| 做一下质检 | QUALITY_CHECK_EXECUTE | QUALITY_CHECK_QUERY | easy | imperative |
| 暂停当前生产 | PROCESSING_BATCH_PAUSE | SCHEDULING_SET_MANUAL | easy | imperative |

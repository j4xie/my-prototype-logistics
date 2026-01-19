# ArenaRL 复杂语义测试报告

## 测试时间
2026-01-19 18:29:42

## 测试结果

| # | 查询 | 期望 | 实际 | 匹配 | 延迟 | 难度 | 类别 |
|---|------|------|------|------|------|------|------|
| 1 | 帮我看看原料还有多少 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 2459ms | medium | colloquial |
| 2 | 那个批次咋样了 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_DETAIL | ❌ | 622ms | hard | colloquial |
| 3 | 东西发出去没有 | SHIPMENT_QUERY | MATERIAL_BATCH_QUERY | ❌ | 666ms | hard | colloquial |
| 4 | 库存够不够啊 | MATERIAL_LOW_STOCK_ALERT | MATERIAL_BATCH_QUERY | ❌ | 576ms | medium | colloquial |
| 5 | 机器还转着吗 | EQUIPMENT_LIST | EQUIPMENT_STATUS_UPDATE | ❌ | 30537ms | hard | colloquial |
| 6 | 今天干了多少活 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_CREATE | ❌ | 4848ms | medium | colloquial |
| 7 | 谁还没打卡 | ATTENDANCE_ANOMALY | CLOCK_IN | ❌ | 30402ms | medium | colloquial |
| 8 | 质量过关吗 | QUALITY_CHECK_QUERY | QUALITY_CHECK_QUERY | ✅ | 419ms | medium | colloquial |
| 9 | 客户那边催没催 | SHIPMENT_QUERY | SHIPMENT_QUERY | ✅ | 1485ms | hard | colloquial |
| 10 | 原料快没了吧 | MATERIAL_LOW_STOCK_ALERT | MATERIAL_LOW_STOCK_ALERT | ✅ | 547ms | medium | colloquial |
| 11 | 我想查一下今天入库的原料批次信息 | MATERIAL_BATCH_QUERY | PROCESSING_BATCH_LIST | ❌ | 1870ms | medium | compound |
| 12 | 把这周所有的生产批次状态给我列出来 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_LIST | ✅ | 494ms | medium | compound |
| 13 | 帮我看看客户张三最近一个月的发货记录 | SHIPMENT_BY_CUSTOMER | SHIPMENT_QUERY | ❌ | 30434ms | hard | compound |
| 14 | 系统里面有没有快要过期的原材料需要处理 | MATERIAL_EXPIRING_ALERT | MATERIAL_EXPIRING_ALERT | ✅ | 465ms | medium | compound |
| 15 | 统计一下本月质检不合格的批次有多少 | QUALITY_STATS | PROCESSING_BATCH_LIST | ❌ | 2237ms | hard | compound |
| 16 | 找出所有设备告警并且还没有处理的 | ALERT_ACTIVE | SCALE_LIST_DEVICES | ❌ | 3079ms | medium | compound |
| 17 | 查询供应商评分在4分以上的有哪些 | SUPPLIER_RANKING | PRODUCT_TYPE_QUERY | ❌ | 441ms | hard | compound |
| 18 | 给我一份完整的批次溯源报告包括原料信息 | TRACE_FULL | TRACE_BATCH | ❌ | 1343ms | medium | compound |
| 19 | 看看今天考勤有没有异常需要处理的 | ATTENDANCE_ANOMALY | ATTENDANCE_STATUS | ❌ | 436ms | medium | compound |
| 20 | 把库存量低于安全线的原料都找出来 | MATERIAL_LOW_STOCK_ALERT | MATERIAL_BATCH_QUERY | ❌ | 199ms | medium | compound |
| 21 | 昨天的生产情况 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_LIST | ✅ | 2978ms | easy | time |
| 22 | 上周入库的原料 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_CREATE | ❌ | 710ms | medium | time |
| 23 | 这个月的出货统计 | SHIPMENT_STATS | REPORT_DASHBOARD_OVERVIEW | ❌ | 582ms | easy | time |
| 24 | 最近三天的告警 | ALERT_LIST | ALERT_ACKNOWLEDGE | ❌ | 30473ms | medium | time |
| 25 | 今早的打卡记录 | ATTENDANCE_TODAY | ATTENDANCE_HISTORY | ❌ | 1639ms | easy | time |
| 26 | 下周要过期的原料 | MATERIAL_EXPIRING_ALERT | MATERIAL_EXPIRED_QUERY | ❌ | 436ms | medium | time |
| 27 | 去年同期的质检数据 | QUALITY_STATS | QUALITY_STATS | ✅ | 2161ms | hard | time |
| 28 | 刚才启动的批次 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_START | ❌ | 1227ms | medium | time |
| 29 | 月底前要完成的生产 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_COMPLETE | ❌ | 1456ms | hard | time |
| 30 | 季度末的库存盘点 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 413ms | hard | time |
| 31 | 还没发货的订单 | SHIPMENT_QUERY | SHIPMENT_QUERY | ✅ | 30355ms | medium | negation |
| 32 | 未处理的告警 | ALERT_ACTIVE | ALERT_ACKNOWLEDGE | ❌ | 981ms | easy | negation |
| 33 | 没有通过质检的批次 | QUALITY_CHECK_QUERY | QUALITY_CHECK_QUERY | ✅ | 2855ms | medium | negation |
| 34 | 不在线的设备 | EQUIPMENT_LIST | EQUIPMENT_STOP | ❌ | 1343ms | medium | negation |
| 35 | 缺勤的员工 | ATTENDANCE_ANOMALY | ATTENDANCE_ANOMALY | ✅ | 1890ms | medium | negation |
| 36 | 库存不足的原料 | MATERIAL_LOW_STOCK_ALERT | MATERIAL_LOW_STOCK_ALERT | ✅ | 454ms | easy | negation |
| 37 | 没有溯源信息的批次 | TRACE_BATCH | PROCESSING_BATCH_TIMELINE | ❌ | 1389ms | hard | negation |
| 38 | 评分不达标的供应商 | SUPPLIER_RANKING | SUPPLIER_EVALUATE | ❌ | 1566ms | hard | negation |
| 39 | 还没入库的原料 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_CREATE | ❌ | 1155ms | medium | negation |
| 40 | 尚未完成的生产任务 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_COMPLETE | ❌ | 1227ms | medium | negation |
| 41 | 批次 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_LIST | ✅ | 549ms | hard | ambiguous |
| 42 | 状态 | PROCESSING_BATCH_LIST | EQUIPMENT_STATUS_UPDATE | ❌ | 30469ms | extreme | ambiguous |
| 43 | 详情 | MATERIAL_BATCH_QUERY | REPORT_DASHBOARD_OVERVIEW | ❌ | 30369ms | extreme | ambiguous |
| 44 | 记录 | SHIPMENT_QUERY | SHIPMENT_QUERY | ✅ | 2981ms | hard | ambiguous |
| 45 | 数据 | REPORT_DASHBOARD_OVERVIEW | REPORT_DASHBOARD_OVERVIEW | ✅ | 2621ms | extreme | ambiguous |
| 46 | 信息 | MATERIAL_BATCH_QUERY | CUSTOMER_SEARCH | ❌ | 2624ms | extreme | ambiguous |
| 47 | 报表 | REPORT_DASHBOARD_OVERVIEW | REPORT_DASHBOARD_OVERVIEW | ✅ | 494ms | hard | ambiguous |
| 48 | 进度 | PROCESSING_BATCH_LIST | REPORT_DASHBOARD_OVERVIEW | ❌ | 2442ms | hard | ambiguous |
| 49 | 情况 | PROCESSING_BATCH_LIST | QUALITY_CHECK_QUERY | ❌ | 395ms | extreme | ambiguous |
| 50 | 问题 | ALERT_ACTIVE | ALERT_ACTIVE | ✅ | 3278ms | extreme | ambiguous |
| 51 | 处理原料 | MATERIAL_BATCH_CONSUME | MATERIAL_BATCH_CONSUME | ✅ | 1174ms | hard | ambiguous |
| 52 | 处理告警 | ALERT_ACKNOWLEDGE | ALERT_ACKNOWLEDGE | ✅ | 943ms | medium | ambiguous |
| 53 | 更新批次 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_CREATE | ❌ | 30373ms | hard | ambiguous |
| 54 | 修改发货 | SHIPMENT_STATUS_UPDATE | SHIPMENT_UPDATE | ❌ | 1011ms | medium | ambiguous |
| 55 | 操作设备 | EQUIPMENT_START | EQUIPMENT_START | ✅ | 30346ms | hard | ambiguous |
| 56 | 提交质检 | QUALITY_CHECK_EXECUTE | QUALITY_CHECK_EXECUTE | ✅ | 897ms | medium | ambiguous |
| 57 | 确认收货 | SHIPMENT_STATUS_UPDATE | SHIPMENT_QUERY | ❌ | 1755ms | hard | ambiguous |
| 58 | 完成任务 | PROCESSING_BATCH_COMPLETE | SCHEDULING_SET_MANUAL | ❌ | 30321ms | medium | ambiguous |
| 59 | 开始工作 | CLOCK_IN | CLOCK_IN | ✅ | 107ms | hard | ambiguous |
| 60 | 结束流程 | PROCESSING_BATCH_COMPLETE | CLOCK_OUT | ❌ | 2629ms | hard | ambiguous |
| 61 | 原料的质检报告 | QUALITY_CHECK_QUERY | MATERIAL_BATCH_QUERY | ❌ | 397ms | hard | cross-domain |
| 62 | 生产用的原料 | MATERIAL_BATCH_QUERY | TRACE_BATCH | ❌ | 30345ms | medium | cross-domain |
| 63 | 发货的批次追溯 | TRACE_BATCH | PROCESSING_BATCH_LIST | ❌ | 1290ms | hard | cross-domain |
| 64 | 设备的告警历史 | ALERT_BY_EQUIPMENT | ALERT_BY_EQUIPMENT | ✅ | 395ms | medium | cross-domain |
| 65 | 客户的历史订单 | CUSTOMER_PURCHASE_HISTORY | CUSTOMER_PURCHASE_HISTORY | ✅ | 1644ms | medium | cross-domain |
| 66 | 供应商的原料批次 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 1720ms | hard | cross-domain |
| 67 | 生产线的质量统计 | QUALITY_STATS | PROCESSING_BATCH_LIST | ❌ | 552ms | hard | cross-domain |
| 68 | 车间的考勤情况 | ATTENDANCE_DEPARTMENT | ATTENDANCE_TODAY | ❌ | 478ms | medium | cross-domain |
| 69 | 仓库的库存告警 | MATERIAL_LOW_STOCK_ALERT | MATERIAL_BATCH_QUERY | ❌ | 459ms | medium | cross-domain |
| 70 | 订单的溯源码 | TRACE_BATCH | TRACE_PUBLIC | ❌ | 2743ms | hard | cross-domain |
| 71 | 库存最多的原料 | MATERIAL_BATCH_QUERY | MATERIAL_LOW_STOCK_ALERT | ❌ | 565ms | medium | quantitative |
| 72 | 告警最频繁的设备 | ALERT_BY_EQUIPMENT | ALERT_BY_EQUIPMENT | ✅ | 548ms | hard | quantitative |
| 73 | 生产效率最高的批次 | PROCESSING_BATCH_LIST | REPORT_EFFICIENCY | ❌ | 2439ms | hard | quantitative |
| 74 | 评分最高的供应商 | SUPPLIER_RANKING | SUPPLIER_EVALUATE | ❌ | 2942ms | medium | quantitative |
| 75 | 出勤率最低的员工 | ATTENDANCE_STATS | ATTENDANCE_ANOMALY | ❌ | 3791ms | hard | quantitative |
| 76 | 质检合格率最差的 | QUALITY_STATS | QUALITY_CHECK_EXECUTE | ❌ | 30568ms | hard | quantitative |
| 77 | 发货量最大的客户 | CUSTOMER_STATS | SHIPMENT_BY_CUSTOMER | ❌ | 30341ms | hard | quantitative |
| 78 | 使用频率最高的设备 | EQUIPMENT_STATS | EQUIPMENT_STATS | ✅ | 2211ms | hard | quantitative |
| 79 | 消耗最快的原料 | MATERIAL_BATCH_QUERY | MATERIAL_LOW_STOCK_ALERT | ❌ | 381ms | hard | quantitative |
| 80 | 等待时间最长的订单 | SHIPMENT_QUERY | SHIPMENT_BY_CUSTOMER | ❌ | 30349ms | hard | quantitative |
| 81 | 原料还剩多少 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 390ms | easy | question |
| 82 | 今天生产了几批 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_START | ❌ | 1896ms | medium | question |
| 83 | 哪些订单还没发 | SHIPMENT_QUERY | SHIPMENT_QUERY | ✅ | 1380ms | medium | question |
| 84 | 谁的考勤有问题 | ATTENDANCE_ANOMALY | ATTENDANCE_ANOMALY | ✅ | 2596ms | medium | question |
| 85 | 设备为什么报警 | ALERT_DIAGNOSE | ALERT_BY_EQUIPMENT | ❌ | 397ms | medium | question |
| 86 | 质检为什么不合格 | QUALITY_CHECK_QUERY | QUALITY_DISPOSITION_EXECUTE | ❌ | 30355ms | hard | question |
| 87 | 库存什么时候能到 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 2572ms | hard | question |
| 88 | 这批货发给谁 | SHIPMENT_QUERY | SHIPMENT_QUERY | ✅ | 30321ms | medium | question |
| 89 | 哪个供应商最靠谱 | SUPPLIER_RANKING | PRODUCT_TYPE_QUERY | ❌ | 371ms | medium | question |
| 90 | 生产进度怎么样了 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_LIST | ✅ | 390ms | easy | question |
| 91 | 把原料入库 | MATERIAL_BATCH_CREATE | MATERIAL_BATCH_CREATE | ✅ | 741ms | easy | imperative |
| 92 | 开始生产这批 | PROCESSING_BATCH_START | PROCESSING_BATCH_START | ✅ | 728ms | easy | imperative |
| 93 | 发货给客户A | SHIPMENT_CREATE | SHIPMENT_BY_CUSTOMER | ❌ | 30366ms | medium | imperative |
| 94 | 停掉那台设备 | EQUIPMENT_STOP | EQUIPMENT_STOP | ✅ | 30318ms | medium | imperative |
| 95 | 确认这个告警 | ALERT_ACKNOWLEDGE | ALERT_ACKNOWLEDGE | ✅ | 30370ms | easy | imperative |
| 96 | 给我打印溯源码 | TRACE_BATCH | TRACE_PUBLIC | ❌ | 2762ms | medium | imperative |
| 97 | 登记今天的考勤 | CLOCK_IN | ATTENDANCE_STATUS | ❌ | 30373ms | medium | imperative |
| 98 | 做一下质检 | QUALITY_CHECK_EXECUTE | QUALITY_CHECK_EXECUTE | ✅ | 1027ms | easy | imperative |
| 99 | 释放预留的原料 | MATERIAL_BATCH_RELEASE | MATERIAL_BATCH_RELEASE | ✅ | 30424ms | medium | imperative |
| 100 | 暂停当前生产 | PROCESSING_BATCH_PAUSE | PROCESSING_BATCH_PAUSE | ✅ | 1004ms | easy | imperative |

## 汇总统计

| 指标 | 值 |
|------|-----|
| 总测试数 | 100 |
| 通过数 | 41 |
| 失败数 | 59 |
| 通过率 | 41.0% |
| 平均延迟 | 7475ms |

## 按难度统计

| 难度 | 通过/总数 | 通过率 |
|------|----------|--------|
| easy | 41/100 | 41.0% |
| medium | 41/100 | 41.0% |
| hard | 41/100 | 41.0% |
| extreme | 41/100 | 41.0% |

## 按类别统计

| 类别 | 通过/总数 | 通过率 |
|------|----------|--------|
| colloquial | 41/100 | 41.0% |
| compound | 41/100 | 41.0% |
| time | 41/100 | 41.0% |
| negation | 41/100 | 41.0% |
| ambiguous | 41/100 | 41.0% |
| cross-domain | 41/100 | 41.0% |
| quantitative | 41/100 | 41.0% |
| question | 41/100 | 41.0% |
| imperative | 41/100 | 41.0% |

## 失败用例分析


| 查询 | 期望 | 实际 | 难度 | 类别 |
|------|------|------|------|------|
| 那个批次咋样了 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_DETAIL | hard | colloquial |
| 东西发出去没有 | SHIPMENT_QUERY | MATERIAL_BATCH_QUERY | hard | colloquial |
| 库存够不够啊 | MATERIAL_LOW_STOCK_ALERT | MATERIAL_BATCH_QUERY | medium | colloquial |
| 机器还转着吗 | EQUIPMENT_LIST | EQUIPMENT_STATUS_UPDATE | hard | colloquial |
| 今天干了多少活 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_CREATE | medium | colloquial |
| 谁还没打卡 | ATTENDANCE_ANOMALY | CLOCK_IN | medium | colloquial |
| 我想查一下今天入库的原料批次信息 | MATERIAL_BATCH_QUERY | PROCESSING_BATCH_LIST | medium | compound |
| 帮我看看客户张三最近一个月的发货记录 | SHIPMENT_BY_CUSTOMER | SHIPMENT_QUERY | hard | compound |
| 统计一下本月质检不合格的批次有多少 | QUALITY_STATS | PROCESSING_BATCH_LIST | hard | compound |
| 找出所有设备告警并且还没有处理的 | ALERT_ACTIVE | SCALE_LIST_DEVICES | medium | compound |
| 查询供应商评分在4分以上的有哪些 | SUPPLIER_RANKING | PRODUCT_TYPE_QUERY | hard | compound |
| 给我一份完整的批次溯源报告包括原料信息 | TRACE_FULL | TRACE_BATCH | medium | compound |
| 看看今天考勤有没有异常需要处理的 | ATTENDANCE_ANOMALY | ATTENDANCE_STATUS | medium | compound |
| 把库存量低于安全线的原料都找出来 | MATERIAL_LOW_STOCK_ALERT | MATERIAL_BATCH_QUERY | medium | compound |
| 上周入库的原料 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_CREATE | medium | time |
| 这个月的出货统计 | SHIPMENT_STATS | REPORT_DASHBOARD_OVERVIEW | easy | time |
| 最近三天的告警 | ALERT_LIST | ALERT_ACKNOWLEDGE | medium | time |
| 今早的打卡记录 | ATTENDANCE_TODAY | ATTENDANCE_HISTORY | easy | time |
| 下周要过期的原料 | MATERIAL_EXPIRING_ALERT | MATERIAL_EXPIRED_QUERY | medium | time |
| 刚才启动的批次 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_START | medium | time |
| 月底前要完成的生产 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_COMPLETE | hard | time |
| 未处理的告警 | ALERT_ACTIVE | ALERT_ACKNOWLEDGE | easy | negation |
| 不在线的设备 | EQUIPMENT_LIST | EQUIPMENT_STOP | medium | negation |
| 没有溯源信息的批次 | TRACE_BATCH | PROCESSING_BATCH_TIMELINE | hard | negation |
| 评分不达标的供应商 | SUPPLIER_RANKING | SUPPLIER_EVALUATE | hard | negation |
| 还没入库的原料 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_CREATE | medium | negation |
| 尚未完成的生产任务 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_COMPLETE | medium | negation |
| 状态 | PROCESSING_BATCH_LIST | EQUIPMENT_STATUS_UPDATE | extreme | ambiguous |

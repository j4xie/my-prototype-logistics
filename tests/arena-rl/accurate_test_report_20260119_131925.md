# ArenaRL 准确业务测试报告

## 测试时间
2026-01-19 13:19:25

## 测试结果

| # | 查询 | 期望 | 实际 | 匹配 | 延迟 |
|---|------|------|------|------|------|
| 1 | 查询原料批次 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 600ms |
| 2 | 原材料批次MB001 | MATERIAL_BATCH_QUERY | TRACE_BATCH | ❌ | 4786ms |
| 3 | 查看原料库存 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 502ms |
| 4 | 原料信息 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 185ms |
| 5 | 批次详情 | MATERIAL_BATCH_QUERY | PROCESSING_BATCH_DETAIL | ❌ | 1206ms |
| 6 | 原料入库 | MATERIAL_BATCH_CREATE | MATERIAL_BATCH_CREATE | ✅ | 1188ms |
| 7 | 添加新原料 | MATERIAL_BATCH_CREATE | MATERIAL_UPDATE | ❌ | 2534ms |
| 8 | 过期原料 | MATERIAL_EXPIRED_QUERY | MATERIAL_BATCH_QUERY | ❌ | 538ms |
| 9 | 快过期的原料 | MATERIAL_EXPIRING_ALERT | MATERIAL_EXPIRING_ALERT | ✅ | 505ms |
| 10 | 库存不足的原料 | MATERIAL_LOW_STOCK_ALERT | MATERIAL_LOW_STOCK_ALERT | ✅ | 1522ms |
| 11 | 消耗原料 | MATERIAL_BATCH_CONSUME | MATERIAL_BATCH_QUERY | ❌ | 760ms |
| 12 | 使用原料 | MATERIAL_BATCH_USE | MATERIAL_BATCH_USE | ✅ | 1379ms |
| 13 | 预留原料 | MATERIAL_BATCH_RESERVE | MATERIAL_BATCH_RESERVE | ✅ | 1454ms |
| 14 | 释放原料 | MATERIAL_BATCH_RELEASE | MATERIAL_BATCH_QUERY | ❌ | 559ms |
| 15 | 调整库存 | MATERIAL_ADJUST_QUANTITY | MATERIAL_ADJUST_QUANTITY | ✅ | 4873ms |
| 16 | 先进先出推荐 | MATERIAL_FIFO_RECOMMEND | MATERIAL_FIFO_RECOMMEND | ✅ | 159ms |
| 17 | 生产批次列表 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_LIST | ✅ | 549ms |
| 18 | 正在生产的批次 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_START | ❌ | 1770ms |
| 19 | 今天的生产批次 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_START | ❌ | 1383ms |
| 20 | 生产状态 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_LIST | ✅ | 424ms |
| 21 | 开始生产 | PROCESSING_BATCH_START | PROCESSING_BATCH_START | ✅ | 1887ms |
| 22 | 启动批次 | PROCESSING_BATCH_START | PROCESSING_BATCH_START | ✅ | 1366ms |
| 23 | 完成批次 | PROCESSING_BATCH_COMPLETE | PROCESSING_BATCH_COMPLETE | ✅ | 1699ms |
| 24 | 结束生产 | PROCESSING_BATCH_COMPLETE | SCHEDULING_SET_MANUAL | ❌ | 420ms |
| 25 | 暂停生产 | PROCESSING_BATCH_PAUSE | SCHEDULING_SET_MANUAL | ❌ | 472ms |
| 26 | 恢复生产 | PROCESSING_BATCH_RESUME | PROCESSING_BATCH_RESUME | ✅ | 1421ms |
| 27 | 批次时间线 | PROCESSING_BATCH_TIMELINE | PROCESSING_BATCH_START | ❌ | 3035ms |
| 28 | 生产进度 | PROCESSING_BATCH_TIMELINE | PROCESSING_BATCH_LIST | ❌ | 3031ms |
| 29 | 出货记录 | SHIPMENT_QUERY | SHIPMENT_QUERY | ✅ | 485ms |
| 30 | 发货列表 | SHIPMENT_QUERY | SHIPMENT_QUERY | ✅ | 483ms |
| 31 | 最近的发货 | SHIPMENT_QUERY | SHIPMENT_CREATE | ❌ | 1491ms |
| 32 | 创建发货单 | SHIPMENT_CREATE | SHIPMENT_CREATE | ✅ | 1355ms |
| 33 | 安排出货 | SHIPMENT_CREATE | SHIPMENT_CREATE | ✅ | 1121ms |
| 34 | 更新发货状态 | SHIPMENT_UPDATE | SHIPMENT_STATUS_UPDATE | ❌ | 1381ms |
| 35 | 发货状态更新 | SHIPMENT_STATUS_UPDATE | SHIPMENT_STATUS_UPDATE | ✅ | 1353ms |
| 36 | 出货统计 | SHIPMENT_STATS | ERROR | ❌ | 111ms |
| 37 | 客户的发货 | SHIPMENT_BY_CUSTOMER | ERROR | ❌ | 104ms |
| 38 | 按日期发货 | SHIPMENT_BY_DATE | ERROR | ❌ | 212ms |
| 39 | 追溯批次 | TRACE_BATCH | ERROR | ❌ | 146ms |
| 40 | 批次溯源 | TRACE_BATCH | ERROR | ❌ | 130ms |
| 41 | 溯源信息 | TRACE_BATCH | ERROR | ❌ | 136ms |
| 42 | 完整溯源 | TRACE_FULL | ERROR | ❌ | 136ms |
| 43 | 公开溯源 | TRACE_PUBLIC | ERROR | ❌ | 139ms |
| 44 | 执行质检 | QUALITY_CHECK_EXECUTE | ERROR | ❌ | 147ms |
| 45 | 质量检查 | QUALITY_CHECK_EXECUTE | ERROR | ❌ | 141ms |
| 46 | 查询质检结果 | QUALITY_CHECK_QUERY | ERROR | ❌ | 122ms |
| 47 | 质检记录 | QUALITY_CHECK_QUERY | ERROR | ❌ | 131ms |
| 48 | 关键检验项 | QUALITY_CRITICAL_ITEMS | ERROR | ❌ | 93ms |
| 49 | 质量统计 | QUALITY_STATS | ERROR | ❌ | 95ms |
| 50 | 处置评估 | QUALITY_DISPOSITION_EVALUATE | ERROR | ❌ | 137ms |
| 51 | 执行处置 | QUALITY_DISPOSITION_EXECUTE | ERROR | ❌ | 61ms |
| 52 | 告警列表 | ALERT_LIST | ERROR | ❌ | 73ms |
| 53 | 活跃告警 | ALERT_ACTIVE | ERROR | ❌ | 74ms |
| 54 | 设备告警 | ALERT_BY_EQUIPMENT | ERROR | ❌ | 83ms |
| 55 | 按级别告警 | ALERT_BY_LEVEL | ERROR | ❌ | 73ms |
| 56 | 确认告警 | ALERT_ACKNOWLEDGE | ERROR | ❌ | 66ms |
| 57 | 解决告警 | ALERT_RESOLVE | ERROR | ❌ | 63ms |
| 58 | 告警诊断 | ALERT_DIAGNOSE | ERROR | ❌ | 81ms |
| 59 | 告警统计 | ALERT_STATS | ERROR | ❌ | 60ms |
| 60 | 设备列表 | EQUIPMENT_LIST | ERROR | ❌ | 61ms |
| 61 | 设备详情 | EQUIPMENT_DETAIL | ERROR | ❌ | 57ms |
| 62 | 设备统计 | EQUIPMENT_STATS | ERROR | ❌ | 76ms |
| 63 | 启动设备 | EQUIPMENT_START | ERROR | ❌ | 126ms |
| 64 | 停止设备 | EQUIPMENT_STOP | ERROR | ❌ | 55ms |
| 65 | 设备告警列表 | EQUIPMENT_ALERT_LIST | ERROR | ❌ | 64ms |
| 66 | 设备维护 | EQUIPMENT_MAINTENANCE | ERROR | ❌ | 64ms |
| 67 | 今日打卡 | ATTENDANCE_TODAY | ERROR | ❌ | 66ms |
| 68 | 打卡状态 | ATTENDANCE_STATUS | ERROR | ❌ | 85ms |
| 69 | 考勤历史 | ATTENDANCE_HISTORY | ERROR | ❌ | 80ms |
| 70 | 月度考勤 | ATTENDANCE_MONTHLY | ERROR | ❌ | 58ms |
| 71 | 部门考勤 | ATTENDANCE_DEPARTMENT | ERROR | ❌ | 75ms |
| 72 | 考勤异常 | ATTENDANCE_ANOMALY | ERROR | ❌ | 56ms |
| 73 | 考勤统计 | ATTENDANCE_STATS | ERROR | ❌ | 58ms |
| 74 | 上班打卡 | CLOCK_IN | ERROR | ❌ | 61ms |
| 75 | 下班打卡 | CLOCK_OUT | ERROR | ❌ | 64ms |
| 76 | 客户列表 | CUSTOMER_LIST | ERROR | ❌ | 66ms |
| 77 | 搜索客户 | CUSTOMER_SEARCH | ERROR | ❌ | 65ms |
| 78 | 活跃客户 | CUSTOMER_ACTIVE | ERROR | ❌ | 63ms |
| 79 | 按类型客户 | CUSTOMER_BY_TYPE | ERROR | ❌ | 74ms |
| 80 | 客户购买历史 | CUSTOMER_PURCHASE_HISTORY | ERROR | ❌ | 67ms |
| 81 | 客户统计 | CUSTOMER_STATS | ERROR | ❌ | 73ms |
| 82 | 供应商列表 | SUPPLIER_LIST | ERROR | ❌ | 70ms |
| 83 | 搜索供应商 | SUPPLIER_SEARCH | ERROR | ❌ | 75ms |
| 84 | 活跃供应商 | SUPPLIER_ACTIVE | ERROR | ❌ | 75ms |
| 85 | 按品类供应商 | SUPPLIER_BY_CATEGORY | ERROR | ❌ | 70ms |
| 86 | 评估供应商 | SUPPLIER_EVALUATE | ERROR | ❌ | 60ms |
| 87 | 供应商排名 | SUPPLIER_RANKING | ERROR | ❌ | 63ms |
| 88 | 批次 | PROCESSING_BATCH_LIST | ERROR | ❌ | 72ms |
| 89 | 记录 | SHIPMENT_QUERY | ERROR | ❌ | 98ms |
| 90 | 统计 | QUALITY_STATS | ERROR | ❌ | 65ms |
| 91 | 列表 | MATERIAL_BATCH_QUERY | ERROR | ❌ | 62ms |
| 92 | 查询 | MATERIAL_BATCH_QUERY | ERROR | ❌ | 61ms |

## 汇总

| 指标 | 值 |
|------|-----|
| 总测试数 | 92 |
| 通过数 | 21 |
| 通过率 | 22.8% |
| 平均延迟 | 573ms |

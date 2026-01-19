# ArenaRL 准确业务测试报告

## 测试时间
2026-01-19 16:04:01

## 测试结果

| # | 查询 | 期望 | 实际 | 匹配 | 延迟 |
|---|------|------|------|------|------|
| 1 | 查询原料批次 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 439ms |
| 2 | 原材料批次MB001 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 2282ms |
| 3 | 查看原料库存 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 488ms |
| 4 | 原料信息 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | ✅ | 121ms |
| 5 | 批次详情 | MATERIAL_BATCH_QUERY | PROCESSING_BATCH_DETAIL | ❌ | 516ms |
| 6 | 原料入库 | MATERIAL_BATCH_CREATE | ERROR | ❌ | 2864ms |
| 7 | 添加新原料 | MATERIAL_BATCH_CREATE | ERROR | ❌ | 47ms |
| 8 | 过期原料 | MATERIAL_EXPIRED_QUERY | ERROR | ❌ | 43ms |
| 9 | 快过期的原料 | MATERIAL_EXPIRING_ALERT | ERROR | ❌ | 46ms |
| 10 | 库存不足的原料 | MATERIAL_LOW_STOCK_ALERT | ERROR | ❌ | 42ms |
| 11 | 消耗原料 | MATERIAL_BATCH_CONSUME | ERROR | ❌ | 44ms |
| 12 | 使用原料 | MATERIAL_BATCH_USE | ERROR | ❌ | 44ms |
| 13 | 预留原料 | MATERIAL_BATCH_RESERVE | ERROR | ❌ | 42ms |
| 14 | 释放原料 | MATERIAL_BATCH_RELEASE | ERROR | ❌ | 43ms |
| 15 | 调整库存 | MATERIAL_ADJUST_QUANTITY | ERROR | ❌ | 43ms |
| 16 | 先进先出推荐 | MATERIAL_FIFO_RECOMMEND | ERROR | ❌ | 45ms |
| 17 | 生产批次列表 | PROCESSING_BATCH_LIST | ERROR | ❌ | 42ms |
| 18 | 正在生产的批次 | PROCESSING_BATCH_LIST | ERROR | ❌ | 43ms |
| 19 | 今天的生产批次 | PROCESSING_BATCH_LIST | ERROR | ❌ | 47ms |
| 20 | 生产状态 | PROCESSING_BATCH_LIST | ERROR | ❌ | 41ms |
| 21 | 开始生产 | PROCESSING_BATCH_START | ERROR | ❌ | 48ms |
| 22 | 启动批次 | PROCESSING_BATCH_START | ERROR | ❌ | 47ms |
| 23 | 完成批次 | PROCESSING_BATCH_COMPLETE | ERROR | ❌ | 50ms |
| 24 | 结束生产 | PROCESSING_BATCH_COMPLETE | ERROR | ❌ | 51ms |
| 25 | 暂停生产 | PROCESSING_BATCH_PAUSE | ERROR | ❌ | 45ms |
| 26 | 恢复生产 | PROCESSING_BATCH_RESUME | ERROR | ❌ | 48ms |
| 27 | 批次时间线 | PROCESSING_BATCH_TIMELINE | ERROR | ❌ | 48ms |
| 28 | 生产进度 | PROCESSING_BATCH_TIMELINE | ERROR | ❌ | 46ms |
| 29 | 出货记录 | SHIPMENT_QUERY | ERROR | ❌ | 46ms |
| 30 | 发货列表 | SHIPMENT_QUERY | ERROR | ❌ | 47ms |
| 31 | 最近的发货 | SHIPMENT_QUERY | ERROR | ❌ | 162ms |
| 32 | 创建发货单 | SHIPMENT_CREATE | ERROR | ❌ | 54ms |
| 33 | 安排出货 | SHIPMENT_CREATE | ERROR | ❌ | 109ms |
| 34 | 更新发货状态 | SHIPMENT_UPDATE | ERROR | ❌ | 53ms |
| 35 | 发货状态更新 | SHIPMENT_STATUS_UPDATE | ERROR | ❌ | 59ms |
| 36 | 出货统计 | SHIPMENT_STATS | ERROR | ❌ | 61ms |
| 37 | 客户的发货 | SHIPMENT_BY_CUSTOMER | ERROR | ❌ | 80ms |
| 38 | 按日期发货 | SHIPMENT_BY_DATE | ERROR | ❌ | 59ms |
| 39 | 追溯批次 | TRACE_BATCH | ERROR | ❌ | 58ms |
| 40 | 批次溯源 | TRACE_BATCH | ERROR | ❌ | 62ms |
| 41 | 溯源信息 | TRACE_BATCH | ERROR | ❌ | 45ms |
| 42 | 完整溯源 | TRACE_FULL | ERROR | ❌ | 66ms |
| 43 | 公开溯源 | TRACE_PUBLIC | ERROR | ❌ | 55ms |
| 44 | 执行质检 | QUALITY_CHECK_EXECUTE | ERROR | ❌ | 43ms |
| 45 | 质量检查 | QUALITY_CHECK_EXECUTE | ERROR | ❌ | 53ms |
| 46 | 查询质检结果 | QUALITY_CHECK_QUERY | ERROR | ❌ | 211ms |
| 47 | 质检记录 | QUALITY_CHECK_QUERY | ERROR | ❌ | 51ms |
| 48 | 关键检验项 | QUALITY_CRITICAL_ITEMS | ERROR | ❌ | 47ms |
| 49 | 质量统计 | QUALITY_STATS | ERROR | ❌ | 50ms |
| 50 | 处置评估 | QUALITY_DISPOSITION_EVALUATE | ERROR | ❌ | 45ms |
| 51 | 执行处置 | QUALITY_DISPOSITION_EXECUTE | ERROR | ❌ | 51ms |
| 52 | 告警列表 | ALERT_LIST | ERROR | ❌ | 56ms |
| 53 | 活跃告警 | ALERT_ACTIVE | ERROR | ❌ | 47ms |
| 54 | 设备告警 | ALERT_BY_EQUIPMENT | ERROR | ❌ | 58ms |
| 55 | 按级别告警 | ALERT_BY_LEVEL | ERROR | ❌ | 52ms |
| 56 | 确认告警 | ALERT_ACKNOWLEDGE | ERROR | ❌ | 55ms |
| 57 | 解决告警 | ALERT_RESOLVE | ERROR | ❌ | 58ms |
| 58 | 告警诊断 | ALERT_DIAGNOSE | ERROR | ❌ | 317ms |
| 59 | 告警统计 | ALERT_STATS | ERROR | ❌ | 50ms |
| 60 | 设备列表 | EQUIPMENT_LIST | ERROR | ❌ | 61ms |
| 61 | 设备详情 | EQUIPMENT_DETAIL | ERROR | ❌ | 50ms |
| 62 | 设备统计 | EQUIPMENT_STATS | ERROR | ❌ | 46ms |
| 63 | 启动设备 | EQUIPMENT_START | ERROR | ❌ | 53ms |
| 64 | 停止设备 | EQUIPMENT_STOP | ERROR | ❌ | 47ms |
| 65 | 设备告警列表 | EQUIPMENT_ALERT_LIST | ERROR | ❌ | 62ms |
| 66 | 设备维护 | EQUIPMENT_MAINTENANCE | ERROR | ❌ | 51ms |
| 67 | 今日打卡 | ATTENDANCE_TODAY | ERROR | ❌ | 45ms |
| 68 | 打卡状态 | ATTENDANCE_STATUS | ERROR | ❌ | 61ms |
| 69 | 考勤历史 | ATTENDANCE_HISTORY | ERROR | ❌ | 48ms |
| 70 | 月度考勤 | ATTENDANCE_MONTHLY | ERROR | ❌ | 50ms |
| 71 | 部门考勤 | ATTENDANCE_DEPARTMENT | ERROR | ❌ | 56ms |
| 72 | 考勤异常 | ATTENDANCE_ANOMALY | ERROR | ❌ | 44ms |
| 73 | 考勤统计 | ATTENDANCE_STATS | ERROR | ❌ | 46ms |
| 74 | 上班打卡 | CLOCK_IN | ERROR | ❌ | 50ms |
| 75 | 下班打卡 | CLOCK_OUT | ERROR | ❌ | 44ms |
| 76 | 客户列表 | CUSTOMER_LIST | ERROR | ❌ | 55ms |
| 77 | 搜索客户 | CUSTOMER_SEARCH | ERROR | ❌ | 44ms |
| 78 | 活跃客户 | CUSTOMER_ACTIVE | ERROR | ❌ | 47ms |
| 79 | 按类型客户 | CUSTOMER_BY_TYPE | ERROR | ❌ | 49ms |
| 80 | 客户购买历史 | CUSTOMER_PURCHASE_HISTORY | ERROR | ❌ | 47ms |
| 81 | 客户统计 | CUSTOMER_STATS | ERROR | ❌ | 51ms |
| 82 | 供应商列表 | SUPPLIER_LIST | ERROR | ❌ | 53ms |
| 83 | 搜索供应商 | SUPPLIER_SEARCH | ERROR | ❌ | 47ms |
| 84 | 活跃供应商 | SUPPLIER_ACTIVE | ERROR | ❌ | 43ms |
| 85 | 按品类供应商 | SUPPLIER_BY_CATEGORY | ERROR | ❌ | 55ms |
| 86 | 评估供应商 | SUPPLIER_EVALUATE | ERROR | ❌ | 50ms |
| 87 | 供应商排名 | SUPPLIER_RANKING | ERROR | ❌ | 52ms |
| 88 | 批次 | PROCESSING_BATCH_LIST | ERROR | ❌ | 353ms |
| 89 | 记录 | SHIPMENT_QUERY | ERROR | ❌ | 59ms |
| 90 | 统计 | QUALITY_STATS | ERROR | ❌ | 50ms |
| 91 | 列表 | MATERIAL_BATCH_QUERY | ERROR | ❌ | 55ms |
| 92 | 查询 | MATERIAL_BATCH_QUERY | ERROR | ❌ | 52ms |

## 汇总

| 指标 | 值 |
|------|-----|
| 总测试数 | 92 |
| 通过数 | 4 |
| 通过率 | 4.3% |
| 平均延迟 | 129ms |

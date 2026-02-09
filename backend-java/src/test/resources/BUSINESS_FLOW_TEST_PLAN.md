# 完整业务流程测试计划

## 概述

本测试计划覆盖白垩纪食品溯源系统的9大核心业务流程，确保从设备对接到最终追溯的完整链路可靠运行。

---

## 一、设备集成流程测试

### 1.1 电子秤设备集成

```
流程: 设备注册 → 协议检测 → 数据采集 → 重量记录 → 生产批次关联
```

**测试场景:**

| 序号 | 场景 | 输入 | 预期输出 |
|------|------|------|----------|
| 1.1.1 | 注册新电子秤设备 | 设备信息(IP, 端口, 协议类型) | 设备ID, 状态=REGISTERED |
| 1.1.2 | 协议自动检测(ASCII) | 原始数据帧 "ST,GS,  12.345,kg" | 协议类型=ASCII_FIXED |
| 1.1.3 | 协议自动检测(HEX) | 二进制帧 AA55... | 协议类型=HEX_FIXED |
| 1.1.4 | 协议自动检测(MODBUS) | Modbus帧 01 03 00 00... | 协议类型=MODBUS_RTU |
| 1.1.5 | 重量数据解析-正常 | 稳定状态数据帧 | weight=12.345, unit=kg, stable=true |
| 1.1.6 | 重量数据解析-不稳定 | 不稳定状态数据帧 | stable=false, 不记录到批次 |
| 1.1.7 | 重量关联生产批次 | 重量数据 + 批次ID | 批次重量更新, 记录操作日志 |
| 1.1.8 | 设备离线检测 | 超时无响应 | 状态=OFFLINE, 触发告警 |
| 1.1.9 | 设备重连恢复 | 重新连接成功 | 状态=ONLINE, 清除告警 |

**测试类:**
```java
@SpringBootTest
@DisplayName("电子秤设备集成流程测试")
class ScaleDeviceIntegrationFlowTest {
    // 1. testRegisterScaleDevice_Success
    // 2. testAutoDetectProtocol_ASCII
    // 3. testAutoDetectProtocol_HEX
    // 4. testAutoDetectProtocol_MODBUS
    // 5. testParseWeightData_Stable
    // 6. testParseWeightData_Unstable_NotRecorded
    // 7. testLinkWeightToProductionBatch
    // 8. testDeviceOfflineDetection_TriggerAlert
    // 9. testDeviceReconnect_ClearAlert
}
```

### 1.2 ISAPI摄像头集成

```
流程: 摄像头注册 → 视频流获取 → 图片抓拍 → 质检图片关联
```

**测试场景:**

| 序号 | 场景 | 输入 | 预期输出 |
|------|------|------|----------|
| 1.2.1 | 注册ISAPI摄像头 | IP, 端口, 认证信息 | 设备ID, 连接状态 |
| 1.2.2 | 获取实时视频流地址 | 设备ID | RTSP URL |
| 1.2.3 | 抓拍图片 | 设备ID, 抓拍参数 | 图片URL |
| 1.2.4 | 图片关联质检记录 | 图片URL + 质检ID | 质检记录更新 |

**测试类:**
```java
@SpringBootTest
@DisplayName("ISAPI摄像头集成流程测试")
class IsapiCameraIntegrationFlowTest {
    // 1. testRegisterIsapiCamera_Success
    // 2. testGetRtspStreamUrl
    // 3. testCaptureSnapshot
    // 4. testLinkSnapshotToQualityCheck
}
```

---

## 二、原材料管理流程测试

### 2.1 原材料入库流程

```
流程: 供应商选择 → 原料类型选择 → 创建批次 → 入库称重 → 库存更新
```

**测试场景:**

| 序号 | 场景 | 输入 | 预期输出 |
|------|------|------|----------|
| 2.1.1 | 创建原材料批次 | 供应商ID, 原料类型, 计划数量 | 批次号(自动生成) |
| 2.1.2 | 入库称重记录 | 批次ID, 实际重量 | 库存数量更新 |
| 2.1.3 | 批次状态流转 | CREATED → RECEIVED | 状态变更, 记录时间戳 |
| 2.1.4 | 库存自动更新 | 入库完成 | 库存增加, 记录变动 |
| 2.1.5 | 批量入库 | 多个批次同时入库 | 所有批次正确更新 |

### 2.2 原材料消耗流程

```
流程: 生产领料 → 扣减库存 → 关联生产批次 → 更新可用量
```

**测试场景:**

| 序号 | 场景 | 输入 | 预期输出 |
|------|------|------|----------|
| 2.2.1 | 生产领料申请 | 原料批次, 消耗数量, 生产批次 | 消耗记录创建 |
| 2.2.2 | 库存扣减 | 消耗数量 | 库存减少, 记录变动 |
| 2.2.3 | 库存不足拒绝 | 消耗量 > 库存量 | 拒绝操作, 返回错误 |
| 2.2.4 | 消耗关联追溯 | 消耗记录 | 原料批次→生产批次链路建立 |

**测试类:**
```java
@SpringBootTest
@DisplayName("原材料管理流程测试")
class MaterialManagementFlowTest {
    // 入库
    // 1. testCreateMaterialBatch_Success
    // 2. testReceiveMaterialWithWeight
    // 3. testBatchStatusTransition_Created_To_Received
    // 4. testInventoryAutoUpdate_OnReceive
    // 5. testBulkMaterialReceive

    // 消耗
    // 6. testMaterialConsumption_Success
    // 7. testInventoryDeduction_OnConsumption
    // 8. testConsumption_InsufficientInventory_Reject
    // 9. testConsumption_TraceabilityLink_Created
}
```

---

## 三、生产流程测试

### 3.1 生产计划流程

```
流程: 创建计划 → 审批 → 生成排程 → 分配资源 → 开始生产
```

**测试场景:**

| 序号 | 场景 | 输入 | 预期输出 |
|------|------|------|----------|
| 3.1.1 | 创建生产计划 | 产品类型, 计划数量, 计划日期 | 计划ID, 状态=DRAFT |
| 3.1.2 | 计划审批通过 | 计划ID, 审批人 | 状态=APPROVED |
| 3.1.3 | 自动生成排程 | 已审批计划 | 排程记录, 时间槽分配 |
| 3.1.4 | 原料需求计算 | 计划产量 + 转换率 | 所需原料清单及数量 |
| 3.1.5 | 原料自动匹配 | 原料需求 | 推荐批次列表(FIFO) |

### 3.2 生产执行流程

```
流程: 创建生产批次 → 开始生产 → 记录过程 → 完成生产 → 入库成品
```

**测试场景:**

| 序号 | 场景 | 输入 | 预期输出 |
|------|------|------|----------|
| 3.2.1 | 创建生产批次 | 计划ID, 产品类型, 计划产量 | 批次号, 状态=PENDING |
| 3.2.2 | 开始生产 | 批次ID, 操作员 | 状态=IN_PROGRESS, 开始时间 |
| 3.2.3 | 记录过程数据 | 温度, 时间, 设备参数 | 过程记录保存 |
| 3.2.4 | 完成生产 | 批次ID, 实际产量 | 状态=COMPLETED, 结束时间 |
| 3.2.5 | 成品入库 | 批次ID, 入库数量 | 成品库存增加 |
| 3.2.6 | 产量统计 | 完成批次 | 计划完成率更新 |

### 3.3 紧急插单流程

```
流程: 紧急订单 → 查找可用时段 → 插入排程 → 调整后续计划
```

**测试场景:**

| 序号 | 场景 | 输入 | 预期输出 |
|------|------|------|----------|
| 3.3.1 | 查询可用插单时段 | 未来N天 | 可用时间槽列表 |
| 3.3.2 | 执行紧急插单 | 时间槽, 产品, 数量 | 排程更新, 后续计划调整 |
| 3.3.3 | 插单冲突检测 | 时间槽已满 | 拒绝或推荐替代时段 |

**测试类:**
```java
@SpringBootTest
@DisplayName("生产流程测试")
class ProductionFlowTest {
    // 计划
    // 1. testCreateProductionPlan_Success
    // 2. testApprovePlan_Success
    // 3. testAutoGenerateSchedule
    // 4. testCalculateMaterialRequirements
    // 5. testAutoMatchMaterialBatches_FIFO

    // 执行
    // 6. testCreateProductionBatch_Success
    // 7. testStartProduction_StatusChange
    // 8. testRecordProcessData
    // 9. testCompleteProduction_Success
    // 10. testFinishedGoodsInventory_Update
    // 11. testProductionStatistics_Update

    // 插单
    // 12. testQueryAvailableSlots
    // 13. testUrgentInsert_Success
    // 14. testUrgentInsert_ConflictDetection
}
```

---

## 四、质量检验流程测试

### 4.1 质检配置流程

```
流程: 创建检验项 → 配置标准值 → 关联产品类型 → 启用配置
```

**测试场景:**

| 序号 | 场景 | 输入 | 预期输出 |
|------|------|------|----------|
| 4.1.1 | 创建质检项 | 名称, 类别, 标准范围 | 检验项ID |
| 4.1.2 | 按类别查询检验项 | 类别(MATERIAL/SENSORY/PHYSICAL) | 检验项列表 |
| 4.1.3 | 关联产品类型 | 检验项ID, 产品类型ID | 配置关联 |

### 4.2 质检执行流程

```
流程: 创建质检记录 → 录入检验值 → 自动判定 → 处理不合格 → 生成报告
```

**测试场景:**

| 序号 | 场景 | 输入 | 预期输出 |
|------|------|------|----------|
| 4.2.1 | 创建质检记录 | 批次ID, 检验类型 | 质检记录ID |
| 4.2.2 | 录入检验值-合格 | 检验值在标准范围内 | 结果=PASS |
| 4.2.3 | 录入检验值-不合格 | 检验值超出标准范围 | 结果=FAIL, 触发告警 |
| 4.2.4 | 批次质量判定 | 所有检验项结果 | 批次整体判定 |
| 4.2.5 | 不合格品处置申请 | 不合格批次 | 处置申请创建 |
| 4.2.6 | 不合格品处置审批 | 处置申请ID | 审批状态更新 |

**测试类:**
```java
@SpringBootTest
@DisplayName("质量检验流程测试")
class QualityInspectionFlowTest {
    // 配置
    // 1. testCreateQualityCheckItem_Success
    // 2. testQueryItemsByCategory
    // 3. testLinkItemToProductType

    // 执行
    // 4. testCreateQualityRecord_Success
    // 5. testRecordInspectionValue_Pass
    // 6. testRecordInspectionValue_Fail_TriggerAlert
    // 7. testBatchQualityJudgment
    // 8. testCreateDisposalRequest_ForFailedBatch
    // 9. testApproveDisposalRequest
}
```

---

## 五、出货与追溯流程测试

### 5.1 出货流程

```
流程: 创建出货单 → 选择批次 → 扫码出库 → 生成追溯码 → 完成出货
```

**测试场景:**

| 序号 | 场景 | 输入 | 预期输出 |
|------|------|------|----------|
| 5.1.1 | 创建出货记录 | 客户, 产品, 数量 | 出货单号 |
| 5.1.2 | 关联生产批次 | 出货ID, 批次ID列表 | 批次关联 |
| 5.1.3 | 生成追溯码 | 出货记录 | 唯一追溯码/二维码 |
| 5.1.4 | 更新出货状态 | PENDING → SHIPPED | 状态变更, 出库时间 |
| 5.1.5 | 扣减成品库存 | 出货数量 | 库存减少 |

### 5.2 消费者追溯流程

```
流程: 扫码查询 → 获取批次信息 → 展示追溯链 → 返回完整信息
```

**测试场景:**

| 序号 | 场景 | 输入 | 预期输出 |
|------|------|------|----------|
| 5.2.1 | 公开追溯查询 | 批次号/追溯码 | 追溯信息(无需登录) |
| 5.2.2 | 追溯链完整性 | 生产批次 | 原料来源→生产过程→质检→出货 |
| 5.2.3 | 追溯信息包含项 | 批次号 | 生产日期, 原料批次, 质检结果, 工厂信息 |
| 5.2.4 | 无效追溯码 | 不存在的批次号 | 友好错误提示 |

**测试类:**
```java
@SpringBootTest
@DisplayName("出货与追溯流程测试")
class ShipmentAndTraceabilityFlowTest {
    // 出货
    // 1. testCreateShipment_Success
    // 2. testLinkBatchesToShipment
    // 3. testGenerateTraceCode
    // 4. testUpdateShipmentStatus_ToShipped
    // 5. testDeductFinishedGoodsInventory

    // 追溯
    // 6. testPublicTraceQuery_Success
    // 7. testTraceChainCompleteness
    // 8. testTraceInfoContents
    // 9. testInvalidTraceCode_FriendlyError
}
```

---

## 六、AI意图识别流程测试

### 6.1 意图识别流程

```
流程: 用户输入 → 精确匹配 → 正则匹配 → 关键词匹配 → 语义匹配 → LLM兜底 → 执行操作
```

**测试场景:**

| 序号 | 场景 | 输入 | 预期输出 |
|------|------|------|----------|
| 6.1.1 | 精确匹配 | "查询原料库存" | 命中MATERIAL_BATCH_QUERY, 匹配层=EXACT |
| 6.1.2 | 正则匹配 | "批次MB-F001-001状态" | 命中TRACE_BATCH, 提取参数 |
| 6.1.3 | 关键词匹配 | "原料还有多少" | 命中MATERIAL_BATCH_QUERY, 匹配层=KEYWORD |
| 6.1.4 | 语义缓存命中 | 已处理过的相似问题 | 直接返回缓存结果 |
| 6.1.5 | LLM兜底识别 | 复杂自然语言 | LLM推断意图, 匹配层=LLM |
| 6.1.6 | 无法识别 | 无关问题 | UNKNOWN_INTENT, 友好提示 |

### 6.2 意图执行流程

```
流程: 意图识别 → 参数提取 → 调用Handler → 返回结果 → 记录日志
```

**测试场景:**

| 序号 | 场景 | 输入 | 预期输出 |
|------|------|------|----------|
| 6.2.1 | 查询类意图执行 | MATERIAL_BATCH_QUERY | 返回原料批次列表 |
| 6.2.2 | 操作类意图执行 | UPDATE_BATCH_QUANTITY | 执行更新, 返回结果 |
| 6.2.3 | 需要确认的操作 | 删除/修改敏感数据 | 返回确认提示 |
| 6.2.4 | 执行失败处理 | 数据不存在 | 友好错误信息 |

### 6.3 自学习流程

```
流程: 用户反馈 → 记录样本 → 训练更新 → 缓存刷新
```

**测试场景:**

| 序号 | 场景 | 输入 | 预期输出 |
|------|------|------|----------|
| 6.3.1 | 正向反馈记录 | 用户确认正确 | 训练样本+1 |
| 6.3.2 | 负向反馈记录 | 用户标记错误 | 记录错误样本 |
| 6.3.3 | 触发自学习 | 样本数达阈值 | 更新关键词权重 |

**测试类:**
```java
@SpringBootTest
@DisplayName("AI意图识别流程测试")
class AiIntentRecognitionFlowTest {
    // 识别
    // 1. testExactMatch_Success
    // 2. testRegexMatch_WithParameterExtraction
    // 3. testKeywordMatch_Success
    // 4. testSemanticCacheHit
    // 5. testLlmFallback
    // 6. testUnknownIntent_FriendlyMessage

    // 执行
    // 7. testQueryIntentExecution
    // 8. testOperationIntentExecution
    // 9. testConfirmationRequired_SensitiveOperation
    // 10. testExecutionFailure_FriendlyError

    // 自学习
    // 11. testPositiveFeedback_RecordSample
    // 12. testNegativeFeedback_RecordError
    // 13. testSelfLearning_TriggerUpdate
}
```

---

## 七、告警系统流程测试

### 7.1 告警触发流程

```
流程: 事件发生 → 规则匹配 → 生成告警 → 发送通知 → 记录日志
```

**测试场景:**

| 序号 | 场景 | 输入 | 预期输出 |
|------|------|------|----------|
| 7.1.1 | 设备离线告警 | 设备超时 | 告警类型=DEVICE_OFFLINE |
| 7.1.2 | 质检不合格告警 | 质检结果=FAIL | 告警类型=QUALITY_FAIL |
| 7.1.3 | 库存预警 | 库存低于安全阈值 | 告警类型=LOW_INVENTORY |
| 7.1.4 | 设备异常告警 | 传感器数据异常 | 告警类型=DEVICE_ABNORMAL |
| 7.1.5 | 告警级别判定 | 不同严重程度 | 级别=INFO/WARNING/CRITICAL |

### 7.2 告警处理流程

```
流程: 接收告警 → 确认处理 → 记录措施 → 关闭告警
```

**测试场景:**

| 序号 | 场景 | 输入 | 预期输出 |
|------|------|------|----------|
| 7.2.1 | 确认告警 | 告警ID, 处理人 | 状态=ACKNOWLEDGED |
| 7.2.2 | 记录处理措施 | 处理描述 | 措施记录保存 |
| 7.2.3 | 关闭告警 | 处理完成 | 状态=RESOLVED |
| 7.2.4 | 告警统计 | 时间范围 | 各类型告警数量 |

**测试类:**
```java
@SpringBootTest
@DisplayName("告警系统流程测试")
class AlertSystemFlowTest {
    // 触发
    // 1. testDeviceOfflineAlert_Triggered
    // 2. testQualityFailAlert_Triggered
    // 3. testLowInventoryAlert_Triggered
    // 4. testDeviceAbnormalAlert_Triggered
    // 5. testAlertSeverityDetermination

    // 处理
    // 6. testAcknowledgeAlert_Success
    // 7. testRecordResolutionMeasures
    // 8. testResolveAlert_Success
    // 9. testAlertStatistics
}
```

---

## 八、设备协同流程测试

### 8.1 多设备数据同步

```
流程: 电子秤称重 → 摄像头抓拍 → 数据关联 → 统一记录
```

**测试场景:**

| 序号 | 场景 | 输入 | 预期输出 |
|------|------|------|----------|
| 8.1.1 | 称重触发抓拍 | 电子秤稳定数据 | 自动触发摄像头抓拍 |
| 8.1.2 | 数据时间关联 | 称重数据+图片 | 同一时间戳关联 |
| 8.1.3 | 多设备状态同步 | 设备状态变更 | 所有关联设备状态更新 |

### 8.2 工位设备管理

```
流程: 工位配置 → 设备分配 → 状态监控 → 数据汇总
```

**测试场景:**

| 序号 | 场景 | 输入 | 预期输出 |
|------|------|------|----------|
| 8.2.1 | 创建工位 | 工位信息 | 工位ID |
| 8.2.2 | 分配设备到工位 | 工位ID, 设备列表 | 设备关联工位 |
| 8.2.3 | 工位状态监控 | 工位ID | 所有设备状态汇总 |
| 8.2.4 | 工位数据统计 | 工位ID, 时间范围 | 产量/效率统计 |

**测试类:**
```java
@SpringBootTest
@DisplayName("设备协同流程测试")
class DeviceCoordinationFlowTest {
    // 数据同步
    // 1. testWeighingTriggerCapture
    // 2. testDataTimestampCorrelation
    // 3. testMultiDeviceStatusSync

    // 工位管理
    // 4. testCreateWorkstation_Success
    // 5. testAssignDevicesToWorkstation
    // 6. testWorkstationStatusMonitoring
    // 7. testWorkstationDataStatistics
}
```

---

## 九、人员考勤流程测试

### 9.1 考勤打卡流程

```
流程: 上班打卡 → 状态查询 → 下班打卡 → 生成记录
```

**测试场景:**

| 序号 | 场景 | 输入 | 预期输出 |
|------|------|------|----------|
| 9.1.1 | 上班打卡 | 用户ID, 打卡时间 | 打卡记录, 状态=CLOCKED_IN |
| 9.1.2 | 打卡状态查询 | 用户ID | 当前打卡状态 |
| 9.1.3 | 下班打卡 | 用户ID, 打卡时间 | 状态=CLOCKED_OUT, 计算工时 |
| 9.1.4 | 今日考勤记录 | 用户ID | 今日打卡详情 |
| 9.1.5 | 考勤历史查询 | 用户ID, 日期范围 | 考勤记录列表 |
| 9.1.6 | 迟到判定 | 打卡时间晚于规定时间 | 标记为迟到 |
| 9.1.7 | 早退判定 | 打卡时间早于规定时间 | 标记为早退 |

**测试类:**
```java
@SpringBootTest
@DisplayName("人员考勤流程测试")
class AttendanceFlowTest {
    // 1. testClockIn_Success
    // 2. testQueryClockStatus
    // 3. testClockOut_CalculateWorkHours
    // 4. testTodayAttendanceRecord
    // 5. testAttendanceHistory_Query
    // 6. testLateDetection
    // 7. testEarlyLeaveDetection
}
```

---

## 十、端到端集成流程测试

### 10.1 完整生产追溯链

```
完整流程: 原料入库 → 生产计划 → 生产执行(设备协同) → 质量检验 → 成品出货 → 消费者追溯
```

**测试场景:**

| 序号 | 场景 | 预期结果 |
|------|------|----------|
| 10.1.1 | 完整追溯链构建 | 从原料到成品的完整链路可追溯 |
| 10.1.2 | 追溯信息完整性 | 包含所有关键节点信息 |
| 10.1.3 | 数据一致性验证 | 各环节数据保持一致 |

**测试类:**
```java
@SpringBootTest
@DisplayName("端到端集成流程测试")
class EndToEndIntegrationFlowTest {
    // 1. testCompleteProductionTraceabilityChain
    // 2. testTraceabilityInfoCompleteness
    // 3. testDataConsistencyAcrossStages
}
```

---

## 测试执行计划

### Phase 1: 基础设备测试 (优先级: P0)
- 电子秤集成流程 (9个场景)
- ISAPI摄像头集成流程 (4个场景)
- 设备协同流程 (7个场景)

### Phase 2: 核心业务测试 (优先级: P0)
- 原材料管理流程 (9个场景)
- 生产流程测试 (14个场景)
- 质量检验流程 (9个场景)

### Phase 3: 出货追溯测试 (优先级: P1)
- 出货流程 (5个场景)
- 追溯流程 (4个场景)

### Phase 4: 智能功能测试 (优先级: P1)
- AI意图识别流程 (13个场景)
- 告警系统流程 (9个场景)

### Phase 5: 辅助功能测试 (优先级: P2)
- 人员考勤流程 (7个场景)
- 端到端集成测试 (3个场景)

---

## 测试数据准备

### 工厂数据
```json
{
  "factoryId": "F001",
  "factoryName": "测试工厂",
  "adminUserId": 22
}
```

### 设备数据
```json
{
  "scale": { "deviceId": "SCALE-001", "protocol": "ASCII_FIXED" },
  "camera": { "deviceId": "CAM-001", "type": "ISAPI" }
}
```

### 产品数据
```json
{
  "productTypeId": "PT-F001-001",
  "productName": "带鱼罐头",
  "materialTypeId": "RMT-F001-001"
}
```

---

## 总计

| 模块 | 测试场景数 | 测试方法数 |
|------|-----------|-----------|
| 电子秤集成 | 9 | 9 |
| ISAPI摄像头 | 4 | 4 |
| 原材料管理 | 9 | 9 |
| 生产流程 | 14 | 14 |
| 质量检验 | 9 | 9 |
| 出货追溯 | 9 | 9 |
| AI意图识别 | 13 | 13 |
| 告警系统 | 9 | 9 |
| 设备协同 | 7 | 7 |
| 人员考勤 | 7 | 7 |
| 端到端集成 | 3 | 3 |
| **总计** | **93** | **93** |

---

## 备注

1. 所有测试使用 `@SpringBootTest` 进行集成测试
2. 使用 `@Transactional` 确保测试数据隔离
3. 使用 `@DisplayName` 提供清晰的测试描述
4. 关键流程使用 `@Nested` 分组组织测试
5. API测试使用 `MockMvc` 或 `TestRestTemplate`

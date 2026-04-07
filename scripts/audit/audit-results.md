# factoryId 隔离审计报告

**生成时间**: 2026-04-07T21:48:55.113Z
**审计脚本**: scripts/audit/tool-factory-isolation-audit.mjs
**扫描目录**: backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/

## 总览

- **Total Tools 扫描数**: 338
- 🔴 **HIGH 风险**: 8
- 🟡 **MEDIUM 风险**: 17
- 🟢 **LOW 风险**: 305
- ⚪ **NON_BUSINESS（非业务 Tool）**: 8

## 按 Domain 分组

| Domain | Total | HIGH | MEDIUM | LOW | NON_BIZ |
|--------|-------|------|--------|-----|---------|
| finance | 11 | **2** | 0 | 9 | 0 |
| governance | 3 | **2** | 0 | 1 | 0 |
| camera | 11 | **1** | 5 | 5 | 0 |
| rd | 3 | **1** | 0 | 2 | 0 |
| system | 23 | **1** | 2 | 20 | 0 |
| transfer | 5 | **1** | 0 | 4 | 0 |
| material | 27 | 0 | 2 | 25 | 0 |
| dataop | 19 | 0 | 1 | 18 | 0 |
| crm | 24 | 0 | 1 | 23 | 0 |
| scale | 13 | 0 | 2 | 11 | 0 |
| shipment | 16 | 0 | 2 | 14 | 0 |
| report | 34 | 0 | 1 | 33 | 0 |
| workreport | 4 | 0 | 1 | 3 | 0 |
| alert | 9 | 0 | 0 | 9 | 0 |
| hr | 14 | 0 | 0 | 14 | 0 |
| quality | 12 | 0 | 0 | 12 | 0 |
| config | 3 | 0 | 0 | 3 | 0 |
| dahua | 3 | 0 | 0 | 3 | 0 |
| equipment | 15 | 0 | 0 | 15 | 0 |
| foodknowledge | 1 | 0 | 0 | 1 | 0 |
| form | 1 | 0 | 0 | 1 | 0 |
| decoration | 3 | 0 | 0 | 3 | 0 |
| isapi | 3 | 0 | 0 | 3 | 0 |
| pagedesign | 4 | 0 | 0 | 4 | 0 |
| sales | 5 | 0 | 0 | 5 | 0 |
| processing | 17 | 0 | 0 | 17 | 0 |
| purchase | 6 | 0 | 0 | 6 | 0 |
| restaurant | 27 | 0 | 0 | 27 | 0 |
| returnorder | 5 | 0 | 0 | 5 | 0 |
| scheduling | 3 | 0 | 0 | 3 | 0 |
| sop | 3 | 0 | 0 | 3 | 0 |
| user | 3 | 0 | 0 | 3 | 0 |
| root | 5 | 0 | 0 | 0 | 5 |
| dictionary | 3 | 0 | 0 | 0 | 3 |

## 🔴 HIGH 风险清单（立即修复）

| # | Domain | File | 原因 |
|---|--------|------|------|
| 1 | camera | `CameraSubscribeTool.java` | 存在 3 条可疑模式（findAll/findById/硬编码/裸 SQL） |
| 2 | finance | `FinancePptExportTool.java` | doExecute body 中完全没有使用 factoryId（签名接收但从未使用） |
| 3 | finance | `InvoiceApproveTool.java` | doExecute body 中完全没有使用 factoryId（签名接收但从未使用） |
| 4 | rd | `SampleApproveTool.java` | doExecute body 中完全没有使用 factoryId（签名接收但从未使用） |
| 5 | system | `SendWechatNotificationTool.java` | doExecute body 中完全没有使用 factoryId（签名接收但从未使用） |
| 6 | governance | `SkillComposeTool.java` | doExecute body 中完全没有使用 factoryId（签名接收但从未使用） |
| 7 | governance | `SkillManageTool.java` | doExecute body 中完全没有使用 factoryId（签名接收但从未使用） |
| 8 | transfer | `TransferDetailTool.java` | doExecute body 中完全没有使用 factoryId（签名接收但从未使用） |

## 🟡 MEDIUM 风险清单（人工复核）

| # | Domain | File | 可疑模式数 | 示例 |
|---|--------|------|-----------|------|
| 1 | material | `BatchConsumptionAdjustTool.java` | 1 | productionBatchRepository.findByBatchNumber(batchNumber) — no factoryId arg |
| 2 | material | `BatchConsumptionQueryTool.java` | 1 | productionBatchRepository.findByBatchNumber(batchNumber) — no factoryId arg |
| 3 | camera | `CameraDetailTool.java` | 1 | deviceService.getDevice(deviceId) — no factoryId arg |
| 4 | camera | `CameraStatusTool.java` | 1 | subscriptionService.getActiveSubscriptionCount() — no factoryId arg |
| 5 | camera | `CameraStreamsTool.java` | 2 | deviceService.getStreamUrls(deviceId) — no factoryId arg |
| 6 | camera | `CameraSyncTool.java` | 1 | deviceService.getDevice(deviceId) — no factoryId arg |
| 7 | camera | `CameraTestConnectionTool.java` | 1 | deviceService.getDevice(deviceId) — no factoryId arg |
| 8 | dataop | `ColdChainQueryTool.java` | 1 | iotDeviceDataRepository.findByDeviceIdAndTimeRange(warehouseId, startTime, endTi |
| 9 | system | `ContextContinueTool.java` | 1 | conversationMemoryService.getContext(sessionId) — no factoryId arg |
| 10 | crm | `OrderQueryTool.java` | 1 | workOrderService.getByOrderNumber(orderId) — no factoryId arg |
| 11 | system | `PaginationNextTool.java` | 1 | conversationMemoryService.getContext(sessionId) — no factoryId arg |
| 12 | scale | `ScaleAddModelTool.java` | 1 | scaleBrandModelRepository.findByBrandCodeAndModelCode(brandCode, modelCode) — no |
| 13 | scale | `ScaleDeviceDetailTool.java` | 2 | findById() without factoryId guard: .findById(device.getScaleProtocolId() |
| 14 | shipment | `ShipmentDeleteTool.java` | 1 | shipmentRecordService.getByShipmentNumber(shipmentId) — no factoryId arg |
| 15 | report | `SkuGrossMarginTool.java` | 1 | productionBatchRepository.findByBatchNumber(batchNumber) — no factoryId arg |
| 16 | shipment | `TracePublicTool.java` | 1 | traceabilityService.getPublicTrace(batchNumber) — no factoryId arg |
| 17 | workreport | `WorkReportCheckinTool.java` | 1 | batchWorkSessionRepository.countByCheckInTimeBetween(start, end) — no factoryId  |

## 详情（HIGH + MEDIUM）

### [HIGH] CameraSubscribeTool.java
- **路径**: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/camera/CameraSubscribeTool.java`
- **Domain**: camera
- **原因**: 存在 3 条可疑模式（findAll/findById/硬编码/裸 SQL）
- **签名**: `protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {`
- **factoryId 引用次数**: 2
- **可疑模式**:
  - deviceService.getDevice(deviceId) — no factoryId arg
  - subscriptionService.getActiveSubscriptionCount() — no factoryId arg
  - subscriptionService.getActiveSubscriptionIds() — no factoryId arg

### [HIGH] FinancePptExportTool.java
- **路径**: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/finance/FinancePptExportTool.java`
- **Domain**: finance
- **原因**: doExecute body 中完全没有使用 factoryId（签名接收但从未使用）
- **签名**: `protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {`
- **factoryId 引用次数**: 0

### [HIGH] InvoiceApproveTool.java
- **路径**: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/finance/InvoiceApproveTool.java`
- **Domain**: finance
- **原因**: doExecute body 中完全没有使用 factoryId（签名接收但从未使用）
- **签名**: `protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {`
- **factoryId 引用次数**: 0

### [HIGH] SampleApproveTool.java
- **路径**: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/rd/SampleApproveTool.java`
- **Domain**: rd
- **原因**: doExecute body 中完全没有使用 factoryId（签名接收但从未使用）
- **签名**: `protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {`
- **factoryId 引用次数**: 0

### [HIGH] SendWechatNotificationTool.java
- **路径**: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/system/SendWechatNotificationTool.java`
- **Domain**: system
- **原因**: doExecute body 中完全没有使用 factoryId（签名接收但从未使用）
- **签名**: `protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {`
- **factoryId 引用次数**: 0

### [HIGH] SkillComposeTool.java
- **路径**: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/governance/SkillComposeTool.java`
- **Domain**: governance
- **原因**: doExecute body 中完全没有使用 factoryId（签名接收但从未使用）
- **签名**: `protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {`
- **factoryId 引用次数**: 0

### [HIGH] SkillManageTool.java
- **路径**: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/governance/SkillManageTool.java`
- **Domain**: governance
- **原因**: doExecute body 中完全没有使用 factoryId（签名接收但从未使用）
- **签名**: `protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {`
- **factoryId 引用次数**: 0

### [HIGH] TransferDetailTool.java
- **路径**: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/transfer/TransferDetailTool.java`
- **Domain**: transfer
- **原因**: doExecute body 中完全没有使用 factoryId（签名接收但从未使用）
- **签名**: `protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {`
- **factoryId 引用次数**: 0

### [MEDIUM] BatchConsumptionAdjustTool.java
- **路径**: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/material/BatchConsumptionAdjustTool.java`
- **Domain**: material
- **原因**: 存在 1 条可疑模式需人工复核
- **签名**: `protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {`
- **factoryId 引用次数**: 2
- **可疑模式**:
  - productionBatchRepository.findByBatchNumber(batchNumber) — no factoryId arg

### [MEDIUM] BatchConsumptionQueryTool.java
- **路径**: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/material/BatchConsumptionQueryTool.java`
- **Domain**: material
- **原因**: 存在 1 条可疑模式需人工复核
- **签名**: `protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {`
- **factoryId 引用次数**: 1
- **可疑模式**:
  - productionBatchRepository.findByBatchNumber(batchNumber) — no factoryId arg

### [MEDIUM] CameraDetailTool.java
- **路径**: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/camera/CameraDetailTool.java`
- **Domain**: camera
- **原因**: 存在 1 条可疑模式需人工复核
- **签名**: `protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {`
- **factoryId 引用次数**: 1
- **可疑模式**:
  - deviceService.getDevice(deviceId) — no factoryId arg

### [MEDIUM] CameraStatusTool.java
- **路径**: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/camera/CameraStatusTool.java`
- **Domain**: camera
- **原因**: 存在 1 条可疑模式需人工复核
- **签名**: `protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {`
- **factoryId 引用次数**: 3
- **可疑模式**:
  - subscriptionService.getActiveSubscriptionCount() — no factoryId arg

### [MEDIUM] CameraStreamsTool.java
- **路径**: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/camera/CameraStreamsTool.java`
- **Domain**: camera
- **原因**: 存在 2 条可疑模式需人工复核
- **签名**: `protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {`
- **factoryId 引用次数**: 1
- **可疑模式**:
  - deviceService.getStreamUrls(deviceId) — no factoryId arg
  - deviceService.getDevice(deviceId) — no factoryId arg

### [MEDIUM] CameraSyncTool.java
- **路径**: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/camera/CameraSyncTool.java`
- **Domain**: camera
- **原因**: 存在 1 条可疑模式需人工复核
- **签名**: `protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {`
- **factoryId 引用次数**: 1
- **可疑模式**:
  - deviceService.getDevice(deviceId) — no factoryId arg

### [MEDIUM] CameraTestConnectionTool.java
- **路径**: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/camera/CameraTestConnectionTool.java`
- **Domain**: camera
- **原因**: 存在 1 条可疑模式需人工复核
- **签名**: `protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {`
- **factoryId 引用次数**: 1
- **可疑模式**:
  - deviceService.getDevice(deviceId) — no factoryId arg

### [MEDIUM] ColdChainQueryTool.java
- **路径**: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/dataop/ColdChainQueryTool.java`
- **Domain**: dataop
- **原因**: 存在 1 条可疑模式需人工复核
- **签名**: `protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {`
- **factoryId 引用次数**: 3
- **可疑模式**:
  - iotDeviceDataRepository.findByDeviceIdAndTimeRange(warehouseId, startTime, endTime) — no factoryId arg

### [MEDIUM] ContextContinueTool.java
- **路径**: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/system/ContextContinueTool.java`
- **Domain**: system
- **原因**: 存在 1 条可疑模式需人工复核
- **签名**: `protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {`
- **factoryId 引用次数**: 1
- **可疑模式**:
  - conversationMemoryService.getContext(sessionId) — no factoryId arg

### [MEDIUM] OrderQueryTool.java
- **路径**: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/crm/OrderQueryTool.java`
- **Domain**: crm
- **原因**: 存在 1 条可疑模式需人工复核
- **签名**: `protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {`
- **factoryId 引用次数**: 3
- **可疑模式**:
  - workOrderService.getByOrderNumber(orderId) — no factoryId arg

### [MEDIUM] PaginationNextTool.java
- **路径**: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/system/PaginationNextTool.java`
- **Domain**: system
- **原因**: 存在 1 条可疑模式需人工复核
- **签名**: `protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {`
- **factoryId 引用次数**: 1
- **可疑模式**:
  - conversationMemoryService.getContext(sessionId) — no factoryId arg

### [MEDIUM] ScaleAddModelTool.java
- **路径**: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/scale/ScaleAddModelTool.java`
- **Domain**: scale
- **原因**: 存在 1 条可疑模式需人工复核
- **签名**: `protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {`
- **factoryId 引用次数**: 1
- **可疑模式**:
  - scaleBrandModelRepository.findByBrandCodeAndModelCode(brandCode, modelCode) — no factoryId arg

### [MEDIUM] ScaleDeviceDetailTool.java
- **路径**: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/scale/ScaleDeviceDetailTool.java`
- **Domain**: scale
- **原因**: 存在 2 条可疑模式需人工复核
- **签名**: `protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {`
- **factoryId 引用次数**: 4
- **可疑模式**:
  - findById() without factoryId guard: .findById(device.getScaleProtocolId()
  - findById() without factoryId guard: .findById(device.getScaleBrandModelId()

### [MEDIUM] ShipmentDeleteTool.java
- **路径**: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/shipment/ShipmentDeleteTool.java`
- **Domain**: shipment
- **原因**: 存在 1 条可疑模式需人工复核
- **签名**: `protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {`
- **factoryId 引用次数**: 2
- **可疑模式**:
  - shipmentRecordService.getByShipmentNumber(shipmentId) — no factoryId arg

### [MEDIUM] SkuGrossMarginTool.java
- **路径**: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/report/SkuGrossMarginTool.java`
- **Domain**: report
- **原因**: 存在 1 条可疑模式需人工复核
- **签名**: `protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {`
- **factoryId 引用次数**: 1
- **可疑模式**:
  - productionBatchRepository.findByBatchNumber(batchNumber) — no factoryId arg

### [MEDIUM] TracePublicTool.java
- **路径**: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/shipment/TracePublicTool.java`
- **Domain**: shipment
- **原因**: 存在 1 条可疑模式需人工复核
- **签名**: `protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {`
- **factoryId 引用次数**: 2
- **可疑模式**:
  - traceabilityService.getPublicTrace(batchNumber) — no factoryId arg

### [MEDIUM] WorkReportCheckinTool.java
- **路径**: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/workreport/WorkReportCheckinTool.java`
- **Domain**: workreport
- **原因**: 存在 1 条可疑模式需人工复核
- **签名**: `protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {`
- **factoryId 引用次数**: 2
- **可疑模式**:
  - batchWorkSessionRepository.countByCheckInTimeBetween(start, end) — no factoryId arg

## ⚠️ 非 BusinessTool 但引用了 factoryId（建议人工 review）

| # | Domain | File | factoryId 引用次数 |
|---|--------|------|-------------------|
| 1 | root | `CreateIntentTool.java` | 2 |
| 2 | dictionary | `DictionaryAddTool.java` | 7 |
| 3 | dictionary | `DictionaryBatchImportTool.java` | 6 |
| 4 | dictionary | `DictionaryListTool.java` | 5 |
| 5 | root | `TestIntentMatchingTool.java` | 7 |
| 6 | root | `UpdateIntentTool.java` | 2 |

---

## 建议后续动作

1. **HIGH 风险**: 立即逐项修复并提交 PR，建议双人 review。
2. **MEDIUM 风险**: 人工复核每一条可疑模式，修复确认的真实漏洞。
3. **跨工厂 E2E 回归测试**: 建议每个 Repository 的 by-factory finder 加单元测试，确保跨工厂查询返回空。
4. **定期审计**: 建议 CI 增加 `node scripts/audit/tool-factory-isolation-audit.mjs` 作为门禁，发现 HIGH 立即阻塞合并。

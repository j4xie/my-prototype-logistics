# 澄清问题对话框测试指南

## 📋 测试目标

验证 IntentExecutionTestScreen 与 useIntentExecution Hook 的完整集成，确保在执行意图时能够:
1. ✅ 自动拦截 `NEED_MORE_INFO` 响应
2. ✅ 显示 ClarificationDialog 收集缺失参数
3. ✅ 合并用户答案后自动重试执行
4. ✅ 显示最终执行结果

---

## 🔍 支持 NEED_MORE_INFO 的 Handler

根据后端代码分析，以下 Handler 实现了 NEED_MORE_INFO 逻辑:

| Handler | Category | 支持的意图数量 | 测试优先级 |
|---------|----------|---------------|----------|
| **QualityIntentHandler** | QUALITY | 4+ | ⭐⭐⭐ 高 |
| **MaterialIntentHandler** | MATERIAL | 7+ | ⭐⭐⭐ 高 |
| **ShipmentIntentHandler** | SHIPMENT | 7+ | ⭐⭐⭐ 高 |
| **DataOperationIntentHandler** | DATA_OP | 多个 | ⭐⭐ 中 |
| **UserIntentHandler** | USER | 2+ | ⭐⭐ 中 |
| **CameraIntentHandler** | CAMERA | 1+ | ⭐ 低 |
| **SystemIntentHandler** | SYSTEM | 1+ | ⭐ 低 |
| **ConfigIntentHandler** | CONFIG | 1+ | ⭐ 低 |
| **MetaIntentHandler** | META | 1+ | ⭐ 低 |

---

## 📊 测试矩阵

### 1. 质检类 (QualityIntentHandler)

#### 1.1 执行质检 (QUALITY_CHECK_EXECUTE)
```bash
意图代码: QUALITY_CHECK_EXECUTE
触发关键词: "执行质检", "提交质检", "质检记录"
```

**测试用例**:
```typescript
用户输入: "执行质检"
预期响应: NEED_MORE_INFO
缺失参数: productionBatchId (生产批次ID)
```

**澄清问题**:
```
Q: 请提供生产批次ID (productionBatchId)
```

**补充参数示例**:
```json
{
  "productionBatchId": "123"  // 需要是有效的生产批次ID
}
```

#### 1.2 处置评估 (QUALITY_DISPOSITION_EVALUATE)
```bash
意图代码: QUALITY_DISPOSITION_EVALUATE
触发关键词: "处置建议", "处置评估", "应该怎么处置"
```

**测试用例**:
```typescript
用户输入: "给我处置建议"
预期响应: NEED_MORE_INFO
缺失参数: productionBatchId
```

**补充参数示例**:
```json
{
  "productionBatchId": "123"
}
```

#### 1.3 执行处置 (QUALITY_DISPOSITION_EXECUTE)
```bash
意图代码: QUALITY_DISPOSITION_EXECUTE
触发关键词: "执行处置", "返工", "报废", "放行"
```

**测试用例**:
```typescript
用户输入: "执行处置"
预期响应: NEED_MORE_INFO
缺失参数: productionBatchId, actionCode
```

**澄清问题**:
```
Q: 请提供生产批次ID和处置动作。
   支持的动作: RELEASE(放行), CONDITIONAL_RELEASE(条件放行), REWORK(返工), SCRAP(报废), HOLD(待定)
```

**补充参数示例**:
```json
{
  "productionBatchId": "123",
  "actionCode": "RELEASE",  // 或 REWORK, SCRAP, HOLD, CONDITIONAL_RELEASE
  "reason": "质量合格"       // 可选
}
```

---

### 2. 原料类 (MaterialIntentHandler)

#### 2.1 原料批次查询 (MATERIAL_BATCH_QUERY)
```bash
意图代码: MATERIAL_BATCH_QUERY
触发关键词: "查询原料", "原料库存", "查看批次"
```

**测试用例**:
```typescript
用户输入: "查询原料库存"
预期响应: NEED_MORE_INFO (如果未提供 batchId 或 materialTypeId)
缺失参数: batchId 或 materialTypeId
```

**澄清问题**:
```
Q: 请提供批次ID (batchId) 或原材料类型ID (materialTypeId)
```

**补充参数示例**:
```json
{
  "batchId": "MB-F001-001"
}
// 或
{
  "materialTypeId": "RMT-F001-001"
}
```

#### 2.2 使用原料 (MATERIAL_BATCH_USE)
```bash
意图代码: MATERIAL_BATCH_USE
触发关键词: "使用原料", "领用原料", "出库原料"
```

**测试用例**:
```typescript
用户输入: "使用原料"
预期响应: NEED_MORE_INFO
缺失参数: batchId, quantity
```

**补充参数示例**:
```json
{
  "batchId": "MB-F001-001",
  "quantity": "100"
}
```

#### 2.3 预留原料 (MATERIAL_BATCH_RESERVE)
```bash
意图代码: MATERIAL_BATCH_RESERVE
触发关键词: "预留原料", "预订原料", "锁定原料"
```

**测试用例**:
```typescript
用户输入: "预留原料"
预期响应: NEED_MORE_INFO
缺失参数: batchId, quantity
```

**补充参数示例**:
```json
{
  "batchId": "MB-F001-001",
  "quantity": "50"
}
```

#### 2.4 释放预留 (MATERIAL_BATCH_RELEASE)
```bash
意图代码: MATERIAL_BATCH_RELEASE
触发关键词: "释放原料", "取消预留", "解锁原料"
```

**测试用例**:
```typescript
用户输入: "释放原料"
预期响应: NEED_MORE_INFO
缺失参数: batchId, quantity
```

#### 2.5 消耗预留 (MATERIAL_BATCH_CONSUME)
```bash
意图代码: MATERIAL_BATCH_CONSUME
触发关键词: "消耗预留", "确认消耗", "预留转消耗"
```

**测试用例**:
```typescript
用户输入: "消耗预留"
预期响应: NEED_MORE_INFO
缺失参数: batchId, quantity
```

#### 2.6 FIFO 推荐 (MATERIAL_FIFO_RECOMMEND)
```bash
触发关键词: "先进先出", "FIFO推荐"
```

**测试用例**:
```typescript
用户输入: "给我FIFO推荐"
预期响应: NEED_MORE_INFO
缺失参数: materialTypeId, quantity
```

**补充参数示例**:
```json
{
  "materialTypeId": "RMT-F001-001",
  "quantity": "200"
}
```

#### 2.7 调整数量 (MATERIAL_ADJUST_QUANTITY)
```bash
意图代码: MATERIAL_ADJUST_QUANTITY
触发关键词: "调整库存", "修改数量", "库存调整"
```

**测试用例**:
```typescript
用户输入: "调整库存"
预期响应: NEED_MORE_INFO
缺失参数: batchId, newQuantity, reason
```

**补充参数示例**:
```json
{
  "batchId": "MB-F001-001",
  "newQuantity": "150",
  "reason": "盘点调整"
}
```

---

### 3. 出货/溯源类 (ShipmentIntentHandler)

#### 3.1 创建出货 (SHIPMENT_CREATE)
```bash
意图代码: SHIPMENT_CREATE
触发关键词: "创建出货", "新建出货", "发货", "出货登记"
```

**测试用例**:
```typescript
用户输入: "创建出货"
预期响应: NEED_MORE_INFO
缺失参数: customerId, productName, quantity, unit
```

**澄清问题**:
```
Q: 请提供出货信息。
   必填: customerId, productName, quantity, unit
   可选: unitPrice, shipmentDate, deliveryAddress, logisticsCompany, trackingNumber
```

**补充参数示例**:
```json
{
  "customerId": "CUST-001",
  "productName": "冷冻带鱼",
  "quantity": "1000",
  "unit": "kg",
  "unitPrice": "25.5",
  "deliveryAddress": "上海市浦东新区"
}
```

#### 3.2 更新出货 (SHIPMENT_UPDATE)
```bash
意图代码: SHIPMENT_UPDATE
触发关键词: "修改出货", "更新出货", "编辑出货"
```

**测试用例**:
```typescript
用户输入: "更新出货"
预期响应: NEED_MORE_INFO
缺失参数: shipmentId
```

**补充参数示例**:
```json
{
  "shipmentId": "SHP-001",
  "productName": "更新后的产品名称",  // 可选
  "quantity": "1200"                  // 可选
}
```

#### 3.3 更新出货状态 (SHIPMENT_STATUS_UPDATE)
```bash
意图代码: SHIPMENT_STATUS_UPDATE
触发关键词: "出货状态", "确认送达", "确认发货"
```

**测试用例**:
```typescript
用户输入: "更新出货状态"
预期响应: NEED_MORE_INFO
缺失参数: shipmentId, newStatus
```

**澄清问题**:
```
Q: 请提供出货单号和新状态。
   有效状态: pending(待发货), shipped(已发货), delivered(已送达), returned(已退回)
```

**补充参数示例**:
```json
{
  "shipmentId": "SHP-001",
  "newStatus": "shipped"  // pending / shipped / delivered / returned
}
```

#### 3.4 客户出货查询 (SHIPMENT_BY_CUSTOMER)
```bash
意图代码: SHIPMENT_BY_CUSTOMER
触发关键词: "客户出货", "客户发货记录"
```

**测试用例**:
```typescript
用户输入: "查询客户出货记录"
预期响应: NEED_MORE_INFO
缺失参数: customerId
```

**补充参数示例**:
```json
{
  "customerId": "CUST-001"
}
```

#### 3.5 日期范围出货查询 (SHIPMENT_BY_DATE_RANGE)
```bash
意图代码: SHIPMENT_BY_DATE_RANGE
触发关键词: "查看出货记录", "出货历史"
```

**测试用例**:
```typescript
用户输入: "查看出货记录"
预期响应: NEED_MORE_INFO
缺失参数: startDate, endDate
```

**澄清问题**:
```
Q: 请提供查询日期范围 (startDate, endDate)，格式: yyyy-MM-dd
```

**补充参数示例**:
```json
{
  "startDate": "2026-01-01",
  "endDate": "2026-01-06"
}
```

#### 3.6 批次溯源 (TRACE_BATCH)
```bash
意图代码: TRACE_BATCH
触发关键词: "批次溯源", "查询批次", "追溯批次"
```

**测试用例**:
```typescript
用户输入: "查询批次详情"
预期响应: NEED_MORE_INFO
缺失参数: batchNumber
```

**补充参数示例**:
```json
{
  "batchNumber": "BATCH-001"
}
```

#### 3.7 完整溯源 (TRACE_FULL)
```bash
意图代码: TRACE_FULL
触发关键词: "完整溯源", "全链路追溯", "完整追溯"
```

**测试用例**:
```typescript
用户输入: "完整溯源"
预期响应: NEED_MORE_INFO
缺失参数: batchNumber
```

#### 3.8 公开溯源 (TRACE_PUBLIC)
```bash
意图代码: TRACE_PUBLIC
触发关键词: "公开溯源", "扫码溯源", "消费者溯源"
```

**测试用例**:
```typescript
用户输入: "公开溯源"
预期响应: NEED_MORE_INFO
缺失参数: batchNumber
```

---

## 🧪 在 IntentExecutionTestScreen 中测试

### 测试流程

1. **打开测试屏幕**:
   ```
   ProfileScreen → 点击 "意图执行测试" 按钮
   ```

2. **选择预设场景** (或输入自定义指令):
   - 批次溯源查询: "查询批次详情"
   - 质检记录查询: "查看质检记录"
   - 原料库存查询: "查询原料库存"
   - 出货记录查询: "查看出货记录"
   - 设备状态查询: "查询设备状态"

3. **观察澄清对话框**:
   - ✅ 对话框应自动弹出
   - ✅ 显示清晰的澄清问题
   - ✅ 如有 MissingParameter，显示参数输入框

4. **填写缺失参数**:
   - 在输入框中填写所需参数值
   - 点击"提交"按钮

5. **验证自动重试**:
   - ✅ Hook 应自动合并答案
   - ✅ Hook 应自动重新调用 executeIntent
   - ✅ 日志显示 "重试请求" 消息

6. **检查最终结果**:
   - ✅ 成功: 显示 SUCCESS 状态和数据
   - ✅ 失败: 显示错误消息
   - ✅ 仍需更多信息: 再次显示对话框

---

## 📝 测试检查清单

### 基础功能测试

- [ ] 澄清对话框能正确显示
- [ ] 澄清问题文本清晰易懂
- [ ] MissingParameter 列表正确渲染
- [ ] 用户可以输入参数值
- [ ] 提交按钮功能正常
- [ ] 取消按钮能关闭对话框

### 自动重试测试

- [ ] 提交后对话框自动关闭
- [ ] Hook 自动合并用户答案到 parameters
- [ ] Hook 自动重新调用 executeIntent
- [ ] 重试日志正确显示
- [ ] 重试次数限制生效 (默认 3 次)
- [ ] 达到最大重试次数后提示用户

### 回调测试

- [ ] onSuccess 在成功时触发
- [ ] onError 在失败时触发
- [ ] onClarificationNeeded 在需要澄清时触发
- [ ] 回调参数正确传递

### Edge Cases 测试

- [ ] 用户取消对话框 - Hook 应重置状态
- [ ] 用户提交空值 - 应有表单验证
- [ ] 网络错误 - 应显示错误提示
- [ ] 连续多次需要澄清 - 对话框应依次显示
- [ ] 意图未找到 - 应显示友好错误

---

## 🐛 已知问题

### 1. 意图识别准确性
- **问题**: 某些关键词可能匹配错误的意图
- **解决**: 检查 AI intent configurations 的 keywords 配置

### 2. 参数格式验证
- **问题**: 后端可能对参数格式有要求 (如日期格式 yyyy-MM-dd)
- **解决**: 前端对话框需要添加格式验证

### 3. Token 过期
- **问题**: 测试过程中 Token 可能过期导致 401 错误
- **解决**: 重新登录获取新 Token

---

## 📊 测试覆盖率目标

| Handler | 已测试意图 | 总意图数 | 覆盖率 |
|---------|-----------|---------|-------|
| QualityIntentHandler | 0/4 | 4 | 0% |
| MaterialIntentHandler | 0/7 | 7 | 0% |
| ShipmentIntentHandler | 0/8 | 8 | 0% |
| **总计** | **0/19** | **19** | **0%** |

**目标**: 达到至少 80% 的测试覆盖率

---

## 🚀 下一步

1. ✅ 创建 IntentExecutionTestScreen - **已完成**
2. ✅ 添加到导航配置 - **已完成**
3. ✅ 在 ProfileScreen 添加入口 - **已完成**
4. ⏳ **正在进行**: 使用真实服务器测试各个 handler
5. 📋 **待办**: 记录测试结果和发现的问题
6. 📋 **待办**: 根据测试结果优化对话框 UI/UX
7. 📋 **待办**: 添加参数格式验证
8. 📋 **待办**: 优化错误提示文案

---

## 📖 相关文档

- [ClarificationDialog 组件文档](./src/components/ai/CLARIFICATION_DIALOG_INTEGRATION_GUIDE.md)
- [useIntentExecution Hook 源码](./src/hooks/useIntentExecution.tsx)
- [IntentExecutionTestScreen 源码](./src/screens/test/IntentExecutionTestScreen.tsx)
- [后端 LLM Intent Fallback 实现](../../backend-java/src/main/java/com/cretas/aims/service/impl/LlmIntentFallbackClientImpl.java)
- [澄清问题功能实施总结](../../CLARIFICATION_QUESTIONS_IMPLEMENTATION.md)

---

**最后更新**: 2026-01-06
**测试状态**: 准备就绪 ✅
**下一步行动**: 开始在真实服务器上测试 ⏳

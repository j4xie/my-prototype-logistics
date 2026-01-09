# AI-Opt-3 参数提取机制调查结果

## 调查日期
2026-01-06

## 调查背景
测试 ShipmentIntentHandler 的 TRACE_BATCH 意图时发现：
- ✅ "BATCH-2024-001" → 提取成功
- ✅ "PB-F001-001" → 提取成功
- ❌ "001" → 提取失败 (NEED_MORE_INFO)

源代码检查显示 handleTraceBatch() 方法中**没有 extractBatchNumber() 方法**，但复杂格式仍能提取成功。

---

## 完整执行链路

### 1. IntentExecutorServiceImpl.executeWithHandler()
```java
// Line 330-351
private IntentExecuteResponse executeWithHandler(IntentHandler handler, ...) {
    if (handler.supportsSemanticsMode()) {  // ShipmentIntentHandler返回true
        IntentSemantics semantics = semanticsParser.parse(request, intent, factoryId);
        return handler.handleWithSemantics(factoryId, semantics, intent, userId, userRole);
    }
    // 回退到传统模式
    return handler.handle(factoryId, request, intent, userId, userRole);
}
```

### 2. IntentSemanticsParserImpl.parse()
```java
// Line 110-121
public IntentSemantics parse(IntentExecuteRequest request, ...) {
    IntentSemantics semantics = parseFromContext(request, intentConfig);
    if (needsAIParsing(request, semantics)) {
        // TODO: 调用AI服务补充解析
    }
    return semantics;
}
```

### 3. IntentSemanticsParserImpl.parseFromContext()
```java
// Line 124-164
public IntentSemantics parseFromContext(IntentExecuteRequest request, ...) {
    Map<String, Object> effectiveContext = new HashMap<>();
    if (context != null) effectiveContext.putAll(context);

    // 关键：合并 userInput 到 effectiveContext
    if (request.getUserInput() != null && !request.getUserInput().isEmpty()) {
        effectiveContext.put("userInput", request.getUserInput());
    }

    semantics.setRawContext(effectiveContext);

    // 从 effectiveContext 提取约束（包括 userInput）
    extractConstraints(semantics, effectiveContext);

    return semantics;
}
```

### 4. IntentSemanticsParserImpl.extractFromUserInput()
```java
// Line 261-274 - 批次号提取核心逻辑
private void extractFromUserInput(IntentSemantics semantics,
                                  List<Constraint> constraints,
                                  String userInput) {
    // 批次号提取正则
    Pattern batchPattern = Pattern.compile(
        "(MB-[A-Z0-9]+-\\d+|BATCH-[A-Z0-9-]+|PB-[A-Z0-9]+-\\d+)",
        Pattern.CASE_INSENSITIVE
    );
    Matcher batchMatcher = batchPattern.matcher(userInput);
    if (batchMatcher.find()) {
        String batchNumber = batchMatcher.group(1).toUpperCase();
        constraints.add(Constraint.set("batchNumber", batchNumber));
        semantics.setObjectId(batchNumber);        // ← 设置到objectId
        semantics.setObjectIdentifier(batchNumber); // ← 设置到objectIdentifier
    }
}
```

**支持的批次号格式：**
- `MB-[A-Z0-9]+-\d+` → 如 "MB-F001-001"
- `BATCH-[A-Z0-9-]+` → 如 "BATCH-2024-001"
- `PB-[A-Z0-9]+-\d+` → 如 "PB-F001-001"

**不支持：**
- 纯数字格式如 "001"
- 无前缀格式

### 5. IntentHandler.handleWithSemantics() (默认实现)
```java
// Line 65-99 - 接口的默认方法
default IntentExecuteResponse handleWithSemantics(String factoryId,
                                                  IntentSemantics semantics, ...) {
    Map<String, Object> mergedContext = new HashMap<>();
    if (semantics.getRawContext() != null) {
        mergedContext.putAll(semantics.getRawContext());
    }

    // 将 constraints 转换到 context
    if (semantics.getConstraints() != null) {
        for (Constraint c : semantics.getConstraints()) {
            if (c.getField() != null && c.getValue() != null) {
                mergedContext.put(c.getField(), c.getValue()); // ← batchNumber放入context
            }
        }
    }

    // 添加 objectId
    if (semantics.getObjectId() != null) {
        mergedContext.put("batchId", semantics.getObjectId());
        mergedContext.put("objectId", semantics.getObjectId());
    }

    // 添加 objectIdentifier
    if (semantics.getObjectIdentifier() != null) {
        mergedContext.put("batchNumber", semantics.getObjectIdentifier()); // ← 关键映射
    }

    IntentExecuteRequest request = IntentExecuteRequest.builder()
        .userInput(userInput)
        .context(mergedContext)  // ← context中已包含batchNumber
        .build();

    return handle(factoryId, request, intentConfig, userId, userRole);
}
```

### 6. ShipmentIntentHandler.handleTraceBatch()
```java
// Line 636-651
private IntentExecuteResponse handleTraceBatch(String factoryId,
                                               IntentExecuteRequest request, ...) {
    String batchNumber = null;
    if (request.getContext() != null) {
        batchNumber = getStringFromContext(request.getContext(), "batchNumber");
        // ↑ 从context获取batchNumber（已由语义模式填充）
    }

    if (batchNumber == null) {
        return NEED_MORE_INFO("请提供批次号 (batchNumber)");
    }

    // 查询溯源信息...
}
```

---

## 测试结果解释

| 测试输入 | 正则匹配 | objectId | context.batchNumber | 最终结果 |
|---------|---------|----------|-------------------|---------|
| "查询批次001" | ❌ 不匹配 | null | null | NEED_MORE_INFO |
| "BATCH-2024-001" | ✅ `BATCH-[A-Z0-9-]+` | "BATCH-2024-001" | "BATCH-2024-001" | FAILED (DB无此批次) |
| "PB-F001-001" | ✅ `PB-[A-Z0-9]+-\d+` | "PB-F001-001" | "PB-F001-001" | FAILED (DB无此批次) |

---

## 关键发现

### 1. extractBatchNumber() 方法不存在
- ✅ **预期位置**: ShipmentIntentHandler.java
- ❌ **实际位置**: IntentSemanticsParserImpl.java (extractFromUserInput方法)
- ✅ **部署状态**: JAR包中包含完整逻辑

### 2. 语义模式是参数提取的真正执行者
- ShipmentIntentHandler设置了 `supportsSemanticsMode() = true`
- 但**没有覆盖** handleWithSemantics() 方法
- 使用 IntentHandler 接口的**默认实现**
- 默认实现将 semantics 的 objectIdentifier → context.batchNumber

### 3. Handler层不需要显式提取代码
- 语义模式已经在上游完成提取
- Handler只需从 `request.getContext()` 读取
- 这是**设计架构的变化**，不是代码缺失

### 4. 正则模式限制
- 当前模式**要求前缀** (MB-, BATCH-, PB-)
- 纯数字批次号无法提取
- 需要扩展正则支持更多格式

---

## AI-Opt-3 实际实现状态

### ❌ 原计划（误解）
```
Handler层添加 extractBatchNumber() 方法直接从 userInput 提取
```

### ✅ 实际架构
```
IntentSemanticsParserImpl (统一提取)
    ↓ parse()
    ↓ extractFromUserInput()
    ↓ 设置 semantics.objectId
IntentHandler.handleWithSemantics() (默认实现)
    ↓ 合并 semantics → context
    ↓ objectIdentifier → context.batchNumber
Handler.handle()
    ↓ 从 context 读取参数
```

---

## 遗留问题

### 1. 纯数字批次号不支持
**问题**: "001" 无法提取
**原因**: 正则要求前缀 (MB-, BATCH-, PB-)
**影响**: 可能导致部分合法批次号被拒绝

**建议修复**:
```java
// 在 extractFromUserInput() 中添加纯数字模式
Pattern numericBatchPattern = Pattern.compile(
    "(?:批次|batch)\\s*[：:]?\\s*(\\d{3,})",  // "批次001", "批次：12345"
    Pattern.CASE_INSENSITIVE
);
```

### 2. SHIPMENT_QUERY 没有类似机制
**问题**: 未确认 orderNumber 提取是否也通过语义模式
**建议**: 检查 extractFromUserInput() 是否包含订单号模式

### 3. QualityIntentHandler 状态提取
**问题**: 质量状态（合格/不合格）提取机制未验证
**建议**: 确认 IntentSemanticsParserImpl 中的状态值映射是否生效

---

## 测试验证计划

### ✅ 已完成
- [x] TRACE_BATCH 复杂格式提取 (BATCH-xxx, PB-xxx)
- [x] SHIPMENT_QUERY 基本功能
- [x] 语义模式执行流程确认

### ⏭️ 待测试
- [ ] UserIntentHandler (用户禁用/启用)
- [ ] 语义缓存功能 (1小时TTL)
- [ ] QualityIntentHandler 状态映射

---

## 结论

**AI-Opt-3 实际上已经实现，但实现方式与预期不同：**

1. ✅ **参数提取功能已存在** - 在 IntentSemanticsParserImpl 中
2. ✅ **支持语义模式** - ShipmentIntentHandler 已启用
3. ✅ **降级解析已工作** - 复杂格式批次号成功提取
4. ⚠️ **正则模式受限** - 纯数字批次号不支持
5. ✅ **部署状态正常** - JAR包包含完整逻辑

**测试结果符合代码逻辑，不是部署问题。**

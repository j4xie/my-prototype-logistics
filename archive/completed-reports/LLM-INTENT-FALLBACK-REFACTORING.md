# LlmIntentFallbackClientImpl 重构总结

## 重构目标

将硬编码的意图创建逻辑替换为 Tool Calling 架构，让 LLM 自主决定是否创建新意图。

## 重构内容

### 1. 添加依赖

**文件**: `LlmIntentFallbackClientImpl.java`

**新增导入**:
```java
import com.cretas.aims.ai.dto.ChatCompletionRequest;
import com.cretas.aims.ai.dto.ChatCompletionResponse;
import com.cretas.aims.ai.dto.ChatMessage;
import com.cretas.aims.ai.dto.Tool;
import com.cretas.aims.ai.dto.ToolCall;
import com.cretas.aims.ai.tool.ToolExecutor;
import com.cretas.aims.ai.tool.ToolRegistry;
```

**新增字段**:
```java
private final ToolRegistry toolRegistry;
```

### 2. 重构硬编码逻辑

#### 位置 1: `parseDirectClassifyResponse()` 方法（第435-460行）

**旧逻辑（已删除）**:
- 硬编码判断是否创建意图建议
- 直接调用 `tryCreateIntentSuggestion()`

**新逻辑**:
```java
if (autoCreateIntentEnabled && factoryId != null && shouldUseToolCalling()) {
    // 使用 Tool Calling 让 LLM 决定
    return tryCreateIntentViaToolCalling(...);
} else if (autoCreateIntentEnabled && factoryId != null) {
    // 降级到旧逻辑（仅当 Tool Calling 不可用时）
    // 保留原有硬编码逻辑作为 fallback
}
```

#### 位置 2: `parseClassifyResponse()` 方法（第715-742行）

同样的重构策略，支持 Python 服务路径。

### 3. 新增方法

#### `shouldUseToolCalling()` - 检查是否应使用 Tool Calling

```java
private boolean shouldUseToolCalling() {
    return toolRegistry != null
            && dashScopeClient != null
            && dashScopeClient.isAvailable()
            && toolRegistry.hasExecutor("create_new_intent");
}
```

#### `tryCreateIntentViaToolCalling()` - Tool Calling 主流程

**工作流程**:
1. 构建系统提示词（说明当前意图不匹配情况）
2. 从 ToolRegistry 获取所有工具定义
3. 调用 `DashScopeClient.chatCompletion()` 带上 `tools` 参数
4. 检查响应中的 `tool_calls`
5. 如果有 tool_calls，执行对应的 ToolExecutor
6. 返回执行结果

**特点**:
- LLM 自主决定是否调用工具（`toolChoice="auto"`）
- 使用低温度（`lowTemperature`）确保输出稳定
- 详细日志记录每个步骤

#### `buildToolCallingSystemPrompt()` - 构建提示词

系统提示词包含：
- 当前情况说明（用户输入、首次分类结果、推理说明）
- 已有意图列表
- 任务说明（判断是否需要创建新意图）
- 决策标准（创建/不创建的条件）

#### `extractToolCalls()` - 提取工具调用

从 `ChatCompletionResponse` 中安全提取 `tool_calls`。

#### `buildToolExecutionContext()` - 构建执行上下文

构建工具执行所需的上下文（factoryId 等）。

### 4. 配置开关

保留所有现有配置：
- `cretas.ai.intent.auto-create.enabled` - 是否启用自动创建
- `cretas.ai.intent.auto-create.min-confidence` - 最小置信度阈值
- `cretas.ai.intent.auto-create.factory-auto-approve` - 工厂级自动审批

**新增日志**:
```
Tool Calling mode ENABLED - will use create_new_intent tool instead of hardcoded logic
```

### 5. 降级策略

当 Tool Calling 不可用时，自动降级到旧逻辑：
- ToolRegistry 未注册
- DashScopeClient 不可用
- create_new_intent 工具未注册

降级时记录警告日志：
```
[Legacy Mode] Tool Calling unavailable, using hardcoded logic
```

## 架构优势

### 旧架构（硬编码）
```
用户输入 → LLM 分类 → 意图不匹配 → Java 硬编码判断 → 创建意图建议
```

### 新架构（Tool Calling）
```
用户输入 → LLM 分类 → 意图不匹配 →
  → 询问 LLM 是否创建新意图（带工具列表）→
    → LLM 返回 tool_call →
      → 执行 CreateIntentTool →
        → 返回结果
```

**优势**:
1. **LLM 决策**: 由 LLM 自主判断是否应该创建新意图，而不是硬编码规则
2. **可扩展性**: 未来可以添加更多工具（如 update_intent, delete_intent），无需修改主流程
3. **灵活性**: 提示词可以随时调整决策标准，无需修改代码
4. **可观测性**: 详细的日志记录每个决策步骤

## 测试建议

### 单元测试
1. 测试 `shouldUseToolCalling()` 各种条件组合
2. 测试 `extractToolCalls()` 提取逻辑
3. Mock ToolRegistry 和 DashScopeClient

### 集成测试
1. 意图不匹配时，LLM 决定创建新意图
2. 意图不匹配时，LLM 决定不创建（如模糊输入）
3. Tool Calling 失败时，降级到旧逻辑
4. 验证创建的意图配置正确性

### 场景测试
1. **正常场景**: "我想查询碳排放数据" → LLM 调用 create_new_intent
2. **拒绝场景**: "asdfgh" → LLM 不调用任何工具
3. **降级场景**: ToolRegistry 未启动 → 使用旧逻辑

## 依赖关系

```
LlmIntentFallbackClientImpl
  ├─ ToolRegistry (已实现)
  │   └─ ToolExecutor (接口)
  │       └─ CreateIntentTool (已实现)
  ├─ DashScopeClient (已实现)
  │   └─ ChatCompletionRequest/Response (已实现)
  └─ AIIntentService (已实现)
```

所有依赖都已实现，代码可以直接使用。

## 部署注意事项

1. **配置开关**: 默认启用 Tool Calling，可通过 ToolRegistry 可用性自动降级
2. **日志级别**: 建议设置 `com.cretas.aims.service.impl.LlmIntentFallbackClientImpl=DEBUG` 观察 Tool Calling 流程
3. **监控指标**:
   - Tool Calling 调用次数
   - 成功/失败率
   - 降级次数

## 后续优化

### ReAct Loop（可选）
当前版本：工具执行结果不返回给 LLM

未来版本：可以实现 ReAct loop，将工具结果返回给 LLM，让 LLM 根据结果决定下一步操作。

实现步骤：
1. 执行工具后，将结果构建为 `ChatMessage.tool(result, toolCallId)`
2. 将原始消息 + 工具调用 + 工具结果 重新发送给 LLM
3. LLM 可以继续调用其他工具或返回最终回复

### 多轮工具调用
支持 LLM 在一次对话中调用多个工具（如先查询现有意图，再决定是否创建新意图）。

## 兼容性

- **向后兼容**: 旧逻辑完全保留作为 fallback
- **配置兼容**: 所有现有配置项保持不变
- **API 兼容**: 外部接口无变化

## 文件清单

- `LlmIntentFallbackClientImpl.java` (已修改，约200行新增代码)
- `ToolRegistry.java` (已存在)
- `CreateIntentTool.java` (已存在)
- `DashScopeClient.java` (已存在)
- `Tool.java`, `ToolCall.java`, `ChatMessage.java` (已存在)

重构完成，可以开始测试。

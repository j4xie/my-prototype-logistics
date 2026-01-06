# 澄清问题生成功能实现文档

## 概述

为后端LLM客户端实现了缺失参数澄清问题生成功能，当意图识别成功但缺少执行所需的参数时，自动生成1-3个自然友好的问题引导用户补充信息。

## 修改文件

### 1. LlmIntentFallbackClient.java（接口）

**路径**: `/Users/jietaoxie/my-prototype-logistics/backend-java/src/main/java/com/cretas/aims/service/LlmIntentFallbackClient.java`

**新增方法**:
```java
List<String> generateClarificationQuestionsForMissingParams(
    String userInput,
    AIIntentConfig intent,
    List<String> missingParameters,
    String factoryId
);
```

**方法说明**:
- 当意图已识别但缺少必需参数时调用
- 生成1-3个自然友好的问题
- 参数：
  - `userInput`: 用户原始输入
  - `intent`: 已匹配的意图配置
  - `missingParameters`: 缺失参数列表（如 `["batchId", "quantity"]`）
  - `factoryId`: 工厂ID
- 返回：澄清问题列表（最多3个）

### 2. LlmIntentFallbackClientImpl.java（实现类）

**路径**: `/Users/jietaoxie/my-prototype-logistics/backend-java/src/main/java/com/cretas/aims/service/impl/LlmIntentFallbackClientImpl.java`

#### 新增公共方法

**generateClarificationQuestionsForMissingParams()**
- 主入口方法，实现接口
- 工作流程：
  1. 参数校验
  2. 构建提示词
  3. 调用LLM生成问题（优先DashScope，降级Python服务）
  4. 解析LLM返回的问题列表
  5. 失败时降级到模板生成

#### 新增私有方法

##### 1. `buildClarificationPrompt()`

构建LLM提示词，包含：
- 用户意图说明
- 用户原始输入
- 缺失参数列表（技术名+友好名）
- 生成要求（口语化、无技术术语、1-3个问题）
- 示例输出

```java
private String buildClarificationPrompt(
    String userInput,
    AIIntentConfig intent,
    List<String> missingParameters
)
```

##### 2. `parseClarificationQuestions()`

解析LLM返回的问题文本：
- 按行分割
- 移除编号（数字、中文、符号）
- 过滤空行和过短内容
- 最多返回3个问题

```java
private List<String> parseClarificationQuestions(String responseText)
```

支持的格式：
- `问题1？\n问题2？`
- `1. 问题1？\n2. 问题2？`
- `一、问题1？\n二、问题2？`
- `- 问题1？\n- 问题2？`

##### 3. `generateTemplateClarificationQuestions()`

降级方案：LLM调用失败时使用模板生成问题

```java
private List<String> generateTemplateClarificationQuestions(
    AIIntentConfig intent,
    List<String> missingParameters
)
```

生成策略：
- **1个参数**：生成简单问题 `"请问{参数}是什么？"`
- **多个参数**：
  - 汇总问题：`"请提供以下信息：参数1、参数2、参数3"`
  - 单独问题（最多2个）：`"具体来说，{参数}是多少？"`

##### 4. `getParameterFriendlyName()`

参数名到友好名称的映射：

```java
private String getParameterFriendlyName(String parameterName)
```

**映射表**：
| 技术参数名 | 友好名称 |
|-----------|---------|
| batchId | 批次编号 |
| quantity | 数量 |
| materialTypeId | 材料类型 |
| supplierId | 供应商 |
| productionDate | 生产日期 |
| warehouseId | 仓库 |
| operator | 操作人 |
| reason | 原因 |
| status | 状态 |
| deviceId | 设备 |
| ...等30+参数 |

##### 5. `extractResponseText()`

从Python服务的JSON响应中提取文本内容：

```java
private String extractResponseText(String responseJson)
```

支持的响应格式：
- `{"data": {"response": "文本"}}`
- `{"data": {"text": "文本"}}`
- 纯文本

### 3. 单元测试

**路径**: `/Users/jietaoxie/my-prototype-logistics/backend-java/src/test/java/com/cretas/aims/service/impl/LlmIntentFallbackClientImplClarificationTest.java`

**测试覆盖**：
1. ✅ 参数名映射测试
2. ✅ 模板生成（单参数）
3. ✅ 模板生成（多参数）
4. ✅ 问题解析（标准格式）
5. ✅ 问题解析（带编号）
6. ✅ 问题解析（空输入）
7. ✅ 问题解析（超过3个问题）
8. ✅ 提示词构建

## 使用示例

### 场景1：批次更新缺少参数

```java
AIIntentConfig intent = AIIntentConfig.builder()
    .intentCode("UPDATE_BATCH")
    .intentName("批次更新")
    .build();

List<String> missingParams = Arrays.asList("batchId", "quantity");

List<String> questions = client.generateClarificationQuestionsForMissingParams(
    "更新批次数量",
    intent,
    missingParams,
    "F001"
);

// 输出示例（LLM生成）：
// ["请问是哪个批次的材料？", "需要更新多少数量？"]

// 或降级输出（模板生成）：
// ["请提供以下信息：批次编号、数量", "具体来说，批次编号是多少？"]
```

### 场景2：设备操作缺少单个参数

```java
List<String> missingParams = Arrays.asList("deviceId");

List<String> questions = client.generateClarificationQuestionsForMissingParams(
    "读取设备重量",
    scaleIntent,
    missingParams,
    "F001"
);

// 输出示例：
// ["请问设备是什么？"]
```

## 设计特点

### 1. 双层降级策略

```
LLM生成（DashScope） → Python服务 → 模板生成
```

- 优先使用DashScope直接调用（快速、稳定）
- 降级到Python AI服务
- 最终降级到简单模板（100%可用）

### 2. 友好名称映射

- 技术参数名（如 `batchId`）自动转换为用户友好名称（如"批次编号"）
- 30+常用参数预定义映射
- 未知参数返回原值

### 3. 智能问题解析

- 自动移除编号（`1.`, `一、`, `-` 等）
- 过滤无效内容（空行、过短文本）
- 限制最多3个问题（避免信息过载）

### 4. 口语化提示词

- 明确要求"口语化，避免技术术语"
- 提供示例输出
- 可合并多个参数为一个问题

## 技术规范

### 代码质量

✅ 遵循项目规范：
- 详细的JavaDoc注释
- 明确的日志记录（INFO/DEBUG/ERROR）
- 优雅的异常处理（降级方案）
- 统一的代码风格

### 日志输出

```
INFO: Generating clarification questions for missing params: intent=UPDATE_BATCH, missing=[batchId, quantity]
DEBUG: Using DashScope direct for clarification questions
INFO: Successfully generated 2 clarification questions via LLM
WARN: LLM returned empty questions, falling back to template
INFO: Using template to generate clarification questions (fallback mode)
ERROR: Failed to generate clarification questions via LLM: {error}
```

### 性能考虑

- 使用已有的HTTP连接池（OkHttp）
- 缓存不可变的映射表（getParameterFriendlyName）
- 早期返回（空参数检查）
- 限制问题数量（最多3个）

## 集成建议

### 在IntentHandler中使用

```java
public class SomeIntentHandler {

    @Autowired
    private LlmIntentFallbackClient llmClient;

    public void handleIntent(IntentExecuteRequest request) {
        // 1. 检查缺失参数
        List<String> missingParams = validateAndGetMissingParams(request);

        if (!missingParams.isEmpty()) {
            // 2. 生成澄清问题
            List<String> questions = llmClient.generateClarificationQuestionsForMissingParams(
                request.getUserInput(),
                request.getIntent(),
                missingParams,
                request.getFactoryId()
            );

            // 3. 返回澄清响应
            return IntentExecuteResponse.needsClarification(questions);
        }

        // 4. 正常执行
        return executeIntent(request);
    }
}
```

### 前端展示建议

```typescript
// 显示澄清问题
if (response.needsClarification) {
  Alert.alert(
    "需要更多信息",
    response.clarificationQuestions.join("\n"),
    [
      { text: "取消", style: "cancel" },
      { text: "补充信息", onPress: () => showInputForm(response.missingParams) }
    ]
  );
}
```

## 扩展点

### 1. 添加新的参数映射

在 `getParameterFriendlyName()` 中添加：
```java
nameMapping.put("newParamName", "新参数的友好名称");
```

### 2. 自定义提示词模板

修改 `buildClarificationPrompt()` 以支持特定领域的问题生成。

### 3. 多语言支持

扩展 `getParameterFriendlyName()` 支持多语言：
```java
nameMapping.put("batchId", i18n.get("param.batchId", locale));
```

## 测试验证

运行单元测试：
```bash
cd backend-java
mvn test -Dtest=LlmIntentFallbackClientImplClarificationTest
```

## 注意事项

1. **参数名规范**：确保传入的 `missingParameters` 使用camelCase命名
2. **空值处理**：空参数列表会立即返回空列表，不调用LLM
3. **降级可靠**：即使LLM和Python服务都失败，模板生成保证100%可用
4. **问题数量**：严格限制最多3个问题，避免信息过载

## 版本历史

- **v1.0.0** (2026-01-06): 初始实现
  - 新增接口方法
  - 实现LLM生成逻辑
  - 实现模板降级方案
  - 完整单元测试覆盖

## 作者

- Cretas Team
- Claude Sonnet 4.5 (Implementation Assistance)

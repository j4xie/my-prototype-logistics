# LLM Function Calling API 参考文档

## 文档信息

| 属性 | 值 |
|------|-----|
| 文档版本 | v1.0.0 |
| 创建日期 | 2026-01-06 |
| API 版本 | v1 |
| 目标读者 | 后端开发人员、前端开发人员 |

---

## 目录

1. [核心接口](#1-核心接口)
2. [已实现的 Tools](#2-已实现的-tools)
3. [Tool Definition Schema](#3-tool-definition-schema)
4. [Tool Call Schema](#4-tool-call-schema)
5. [执行上下文](#5-执行上下文)
6. [返回值格式](#6-返回值格式)
7. [错误码](#7-错误码)

---

## 1. 核心接口

### 1.1 ToolExecutor 接口

**完整定义**:
```java
package com.cretas.aims.ai.tool;

public interface ToolExecutor {
    /**
     * 工具名称（唯一标识）
     */
    String getToolName();

    /**
     * 工具描述（LLM 用于判断何时调用）
     */
    String getDescription();

    /**
     * 参数定义（JSON Schema 格式）
     */
    Map<String, Object> getParametersSchema();

    /**
     * 执行工具
     *
     * @param toolCall LLM 返回的工具调用对象
     * @param context 执行上下文（factoryId, userId, userRole）
     * @return 执行结果（JSON 字符串）
     */
    String execute(ToolCall toolCall, Map<String, Object> context) throws Exception;

    /**
     * 是否启用（默认: true）
     */
    default boolean isEnabled() { return true; }

    /**
     * 是否需要权限检查（默认: false）
     */
    default boolean requiresPermission() { return false; }

    /**
     * 检查用户权限（默认: 所有角色有权限）
     */
    default boolean hasPermission(String userRole) { return true; }
}
```

### 1.2 AbstractTool 抽象类

**核心方法**:

| 方法 | 返回类型 | 说明 |
|------|----------|------|
| `parseArguments(ToolCall)` | `Map<String, Object>` | 解析工具调用参数 |
| `getRequiredParam(Map, String)` | `String` | 获取必需参数 |
| `getOptionalParam(Map, String, String)` | `String` | 获取可选参数 |
| `buildSuccessResult(Object)` | `String` | 构建成功结果 JSON |
| `buildErrorResult(String)` | `String` | 构建错误结果 JSON |
| `getFactoryId(Map)` | `String` | 从上下文获取工厂ID |
| `getUserId(Map)` | `Long` | 从上下文获取用户ID |
| `getUserRole(Map)` | `String` | 从上下文获取用户角色 |
| `validateContext(Map)` | `void` | 验证上下文必需字段 |
| `logExecutionStart(...)` | `void` | 记录执行开始 |
| `logExecutionSuccess(...)` | `void` | 记录执行成功 |
| `logExecutionFailure(...)` | `void` | 记录执行失败 |

### 1.3 ToolRegistry 接口

**公开方法**:

```java
package com.cretas.aims.ai.tool;

@Component
public class ToolRegistry {
    /**
     * 根据工具名称获取执行器
     */
    public Optional<ToolExecutor> getExecutor(String toolName);

    /**
     * 检查工具是否存在
     */
    public boolean hasExecutor(String toolName);

    /**
     * 获取所有工具名称
     */
    public List<String> getAllToolNames();

    /**
     * 获取所有工具定义（用于 LLM API）
     */
    public List<Tool> getAllToolDefinitions();

    /**
     * 获取指定角色可用的工具定义
     */
    public List<Tool> getToolDefinitionsForRole(String userRole);

    /**
     * 获取已注册工具数量
     */
    public int getToolCount();
}
```

---

## 2. 已实现的 Tools

### 2.1 CreateIntentTool (创建意图配置工具)

**基本信息**:
- **Tool Name**: `create_new_intent`
- **权限要求**: 超级管理员 / 工厂管理员
- **版本**: v1.0.0

**描述**:
当用户请求无法匹配现有意图时，LLM 可调用此工具自动创建新的意图配置。创建的意图默认为 inactive 状态，需要人工审核激活。

**参数定义**:

| 参数名 | 类型 | 必需 | 说明 | 示例 |
|--------|------|------|------|------|
| `intentCode` | string | ✅ | 意图唯一代码，格式：[类别]_[动作]_[对象] | `QUERY_MATERIAL_BATCH` |
| `intentName` | string | ✅ | 意图的中文名称 | `查询原料批次` |
| `category` | string | ✅ | 意图类别（见下方枚举） | `QUERY` |
| `keywords` | array<string> | ✅ | 触发关键词列表（2-10个） | `["查询", "原料", "批次"]` |
| `description` | string | ❌ | 意图详细描述 | `查询原料批次的详细信息` |
| `semanticDomain` | string | ❌ | 语义域（领域） | `物料` |
| `semanticAction` | string | ❌ | 语义动作 | `查询` |
| `semanticObject` | string | ❌ | 语义对象 | `批次` |
| `sensitivityLevel` | string | ❌ | 敏感级别（默认: MEDIUM） | `MEDIUM` |

**Category 枚举值**:
```
QUERY          - 查询类
DATA_OP        - 数据操作类
FORM           - 表单生成类
REPORT         - 报表类
MATERIAL       - 原料管理类
PRODUCTION     - 生产管理类
QUALITY        - 质量管理类
SHIPMENT       - 出货管理类
EQUIPMENT      - 设备管理类
ATTENDANCE     - 考勤管理类
SYSTEM         - 系统管理类
```

**Sensitivity Level 枚举值**:
```
LOW       - 低敏感度
MEDIUM    - 中等敏感度（默认）
HIGH      - 高敏感度
CRITICAL  - 关键敏感度
```

**返回值示例**:

成功:
```json
{
  "success": true,
  "data": {
    "intentCode": "QUERY_MATERIAL_BATCH",
    "intentName": "查询原料批次",
    "category": "QUERY",
    "active": false,
    "message": "意图配置已创建，状态为待审核。管理员激活后即可使用。"
  }
}
```

失败:
```json
{
  "success": false,
  "error": "参数验证失败: keywords参数不能为空"
}
```

**使用示例**:

```json
{
  "id": "call_abc123",
  "type": "function",
  "function": {
    "name": "create_new_intent",
    "arguments": "{\"intentCode\":\"QUERY_MATERIAL_BATCH\",\"intentName\":\"查询原料批次\",\"category\":\"QUERY\",\"keywords\":[\"查询\",\"原料\",\"批次\"]}"
  }
}
```

**权限控制**:
- `requiresPermission`: `true`
- 允许角色: `super_admin`, `factory_super_admin`, `platform_admin`

**注意事项**:
1. 创建的意图默认为 inactive 状态
2. 需要管理员在后台激活后才能使用
3. intentCode 必须全局唯一
4. keywords 至少包含 2 个关键词

---

### 2.2 QueryEntitySchemaTool (查询实体Schema工具)

**基本信息**:
- **Tool Name**: `query_entity_schema`
- **权限要求**: 无（所有用户可用）
- **版本**: v1.0.0

**描述**:
查询指定实体的 Schema 信息，包括所有字段名称、类型、是否必填等。用于辅助生成数据查询、数据操作、表单生成等意图。

**参数定义**:

| 参数名 | 类型 | 必需 | 说明 | 示例 |
|--------|------|------|------|------|
| `entityName` | string | ✅ | 实体名称（支持中文、英文、下划线格式） | `原料批次` / `MaterialBatch` / `material_batch` |

**支持的实体列表**:

| 中文名称 | 英文名称 | 说明 |
|----------|----------|------|
| 原料批次 | MaterialBatch | 原材料批次信息 |
| 生产批次 | ProcessingBatch | 生产加工批次 |
| 产品类型 | ProductType | 产品类型定义 |
| 生产计划 | ProductionPlan | 生产计划 |
| 质检记录 | QualityCheckRecord | 质量检测记录 |
| 出货记录 | ShipmentRecord | 产品出货记录 |
| 设备 | Equipment | 设备信息 |
| 考勤 | AttendanceRecord | 员工考勤记录 |

**返回值示例**:

成功:
```json
{
  "success": true,
  "data": {
    "entityName": "MaterialBatch",
    "javaClass": "com.cretas.aims.entity.MaterialBatch",
    "fieldCount": 15,
    "fields": [
      {
        "name": "id",
        "javaType": "Long",
        "persistent": "basic",
        "collection": false
      },
      {
        "name": "batchNumber",
        "javaType": "String",
        "persistent": "basic",
        "collection": false
      },
      {
        "name": "materialTypeName",
        "javaType": "String",
        "persistent": "basic",
        "collection": false
      },
      {
        "name": "quantity",
        "javaType": "Double",
        "persistent": "basic",
        "collection": false
      }
    ]
  }
}
```

失败:
```json
{
  "success": false,
  "error": "未识别的实体名称: UnknownEntity"
}
```

**使用示例**:

```json
{
  "id": "call_xyz789",
  "type": "function",
  "function": {
    "name": "query_entity_schema",
    "arguments": "{\"entityName\":\"原料批次\"}"
  }
}
```

**权限控制**:
- `requiresPermission`: `false`
- 所有用户可用

**注意事项**:
1. 实体名称支持中文、英文、下划线格式
2. 仅返回 JPA 管理的实体
3. 不包含关联实体的详细信息

---

## 3. Tool Definition Schema

### 3.1 Tool 对象结构

```typescript
interface Tool {
  type: "function";
  function: FunctionDefinition;
}

interface FunctionDefinition {
  name: string;                    // 工具名称（唯一标识）
  description: string;             // 工具描述（LLM 用于判断何时调用）
  parameters: JSONSchema;          // 参数定义（JSON Schema 格式）
  strict?: boolean;                // 是否严格模式（可选）
}
```

### 3.2 JSON Schema 格式

**基本结构**:
```json
{
  "type": "object",
  "properties": {
    "paramName": {
      "type": "string",
      "description": "参数描述"
    }
  },
  "required": ["paramName"]
}
```

**支持的类型**:

| JSON Schema Type | Java Type | 示例 |
|------------------|-----------|------|
| `string` | String | `"hello"` |
| `number` | Integer, Long, Double | `123`, `123.45` |
| `boolean` | Boolean | `true`, `false` |
| `array` | List | `["a", "b", "c"]` |
| `object` | Map | `{"key": "value"}` |

**常用约束**:

**字符串约束**:
```json
{
  "type": "string",
  "minLength": 1,
  "maxLength": 100,
  "pattern": "^[A-Z0-9_]+$",
  "enum": ["OPTION_A", "OPTION_B"]
}
```

**数值约束**:
```json
{
  "type": "number",
  "minimum": 0,
  "maximum": 100,
  "multipleOf": 0.01
}
```

**数组约束**:
```json
{
  "type": "array",
  "items": {
    "type": "string"
  },
  "minItems": 1,
  "maxItems": 10,
  "uniqueItems": true
}
```

---

## 4. Tool Call Schema

### 4.1 ToolCall 对象结构

```typescript
interface ToolCall {
  id: string;                      // 工具调用的唯一标识
  type: "function";
  function: FunctionCall;
}

interface FunctionCall {
  name: string;                    // 函数名（必须匹配 Tool.name）
  arguments: string;               // 参数 JSON 字符串
}
```

### 4.2 示例

```json
{
  "id": "call_abc123xyz",
  "type": "function",
  "function": {
    "name": "create_new_intent",
    "arguments": "{\"intentCode\":\"QUERY_MATERIAL\",\"intentName\":\"查询原料\",\"category\":\"QUERY\",\"keywords\":[\"查询\",\"原料\"]}"
  }
}
```

---

## 5. 执行上下文

### 5.1 Context 结构

所有 Tool 执行时都会传入 `context` 对象，包含以下字段：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `factoryId` | String | ✅ | 工厂ID（多租户隔离） |
| `userId` | Long | ✅ | 用户ID |
| `userRole` | String | ❌ | 用户角色 |
| `username` | String | ❌ | 用户名 |
| `timestamp` | Long | ❌ | 请求时间戳 |

### 5.2 示例

```java
Map<String, Object> context = new HashMap<>();
context.put("factoryId", "F001");
context.put("userId", 22L);
context.put("userRole", "factory_super_admin");
context.put("username", "admin");
context.put("timestamp", System.currentTimeMillis());
```

### 5.3 获取上下文信息

```java
// 在 AbstractTool 子类中
String factoryId = getFactoryId(context);
Long userId = getUserId(context);
String userRole = getUserRole(context);
```

---

## 6. 返回值格式

### 6.1 标准返回格式

**成功响应**:
```json
{
  "success": true,
  "data": {
    // 业务数据
  }
}
```

**失败响应**:
```json
{
  "success": false,
  "error": "错误消息"
}
```

### 6.2 构建返回值

**使用 AbstractTool 的方法**:

```java
// 成功
Map<String, Object> data = new HashMap<>();
data.put("result", "success");
return buildSuccessResult(data);

// 失败
return buildErrorResult("操作失败: 原因说明");
```

### 6.3 返回值最佳实践

1. **简洁性**: 只返回必要的数据
2. **结构化**: 使用清晰的 JSON 结构
3. **可读性**: 字段名称清晰易懂
4. **完整性**: 包含足够的信息供 LLM 理解

**好的返回值**:
```json
{
  "success": true,
  "data": {
    "batchNumber": "MB20260106001",
    "materialType": "优质面粉",
    "quantity": 1000.0,
    "unit": "kg",
    "status": "合格"
  }
}
```

**不好的返回值**:
```json
{
  "success": true,
  "data": {
    "obj": "[MaterialBatch@1a2b3c4d]"  // ❌ 对象 toString()
  }
}
```

---

## 7. 错误码

### 7.1 系统级错误

| 错误码 | 说明 | HTTP 状态码 |
|--------|------|-------------|
| `TOOL_NOT_FOUND` | 工具不存在 | 404 |
| `TOOL_DISABLED` | 工具已禁用 | 403 |
| `PERMISSION_DENIED` | 权限不足 | 403 |
| `INVALID_ARGUMENTS` | 参数验证失败 | 400 |
| `CONTEXT_INVALID` | 上下文验证失败 | 400 |
| `EXECUTION_FAILED` | 执行失败 | 500 |
| `TIMEOUT` | 执行超时 | 408 |

### 7.2 业务级错误

Tool 可以自定义业务错误，通过 `buildErrorResult()` 返回：

```java
// 业务不存在
return buildErrorResult("未找到批次号为 MB123 的原料批次");

// 业务规则冲突
return buildErrorResult("批次已过期，无法执行质检");

// 参数验证失败
return buildErrorResult("参数验证失败: batchNumber 格式不正确");
```

---

## 8. 完整调用示例

### 8.1 从前端触发 Tool Calling

**API 请求**:
```bash
POST /api/mobile/F001/ai-intents/execute
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "userInput": "帮我创建一个查询原料批次的新意图"
}
```

**LLM 识别需要调用 Tool**:
```json
{
  "tool_calls": [
    {
      "id": "call_123",
      "type": "function",
      "function": {
        "name": "create_new_intent",
        "arguments": "{\"intentCode\":\"QUERY_MATERIAL_BATCH\",\"intentName\":\"查询原料批次\",\"category\":\"QUERY\",\"keywords\":[\"查询\",\"原料\",\"批次\"]}"
      }
    }
  ]
}
```

**后端执行 Tool**:
```java
// 1. ToolRegistry 查找执行器
Optional<ToolExecutor> executorOpt = toolRegistry.getExecutor("create_new_intent");

// 2. 检查权限
if (executor.requiresPermission() && !executor.hasPermission(userRole)) {
    // 返回权限不足错误
}

// 3. 执行 Tool
String result = executor.execute(toolCall, context);
```

**Tool 返回结果**:
```json
{
  "success": true,
  "data": {
    "intentCode": "QUERY_MATERIAL_BATCH",
    "intentName": "查询原料批次",
    "category": "QUERY",
    "active": false,
    "message": "意图配置已创建，状态为待审核。管理员激活后即可使用。"
  }
}
```

**LLM 根据结果生成最终响应**:
```json
{
  "status": "COMPLETED",
  "message": "已成功创建新意图「查询原料批次」，意图代码为 QUERY_MATERIAL_BATCH。该意图目前处于待审核状态，需要管理员激活后才能使用。"
}
```

### 8.2 工具链调用示例

**用户请求**: "查询所有批次的详细信息"

**LLM 执行流程**:

1. **调用 Tool 1**: `list_material_batches`
   ```json
   {
     "function": {
       "name": "list_material_batches",
       "arguments": "{}"
     }
   }
   ```

   **返回**:
   ```json
   {
     "success": true,
     "data": {
       "batchNumbers": ["MB001", "MB002", "MB003"]
     }
   }
   ```

2. **调用 Tool 2**: `query_material_batch_detail` (循环3次)
   ```json
   {
     "function": {
       "name": "query_material_batch_detail",
       "arguments": "{\"batchNumber\":\"MB001\"}"
     }
   }
   ```

   **返回**:
   ```json
   {
     "success": true,
     "data": {
       "batchNumber": "MB001",
       "materialType": "优质面粉",
       "quantity": 1000.0
     }
   }
   ```

3. **LLM 汇总结果**:
   ```
   已为您查询到3个批次的详细信息：

   1. MB001 - 优质面粉，库存1000kg
   2. MB002 - 白砂糖，库存500kg
   3. MB003 - 纯牛奶，库存300L
   ```

---

## 9. 性能指标

### 9.1 预期性能

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 工具查找耗时 | < 1ms | `ToolRegistry.getExecutor()` |
| 参数解析耗时 | < 5ms | `AbstractTool.parseArguments()` |
| 简单 Tool 执行 | < 50ms | 无数据库查询的 Tool |
| 复杂 Tool 执行 | < 500ms | 包含数据库查询的 Tool |
| 工具链总耗时 | < 2s | 3-5个 Tool 顺序调用 |

### 9.2 超时配置

```properties
# Tool 执行超时（默认: 30秒）
tool.execution.timeout=30000

# LLM API 调用超时（默认: 60秒）
llm.api.timeout=60000
```

---

## 10. 版本兼容性

### 10.1 API 版本

| 版本 | 发布日期 | 状态 | 兼容性 |
|------|----------|------|--------|
| v1.0.0 | 2026-01-06 | 当前版本 | - |

### 10.2 变更日志

**v1.0.0 (2026-01-06)**:
- 初始版本发布
- 实现 `CreateIntentTool`
- 实现 `QueryEntitySchemaTool`
- 提供 `AbstractTool` 基类
- 提供 `ToolRegistry` 注册中心

---

## 11. 参考链接

- [架构文档](./LLM-FUNCTION-CALLING-ARCHITECTURE.md)
- [用户指南](./LLM-FUNCTION-CALLING-USER-GUIDE.md)
- [部署指南](./LLM-FUNCTION-CALLING-DEPLOYMENT.md)
- [迁移指南](./MIGRATION-GUIDE.md)
- [JSON Schema 规范](https://json-schema.org/)

---

**文档所有者**: Cretas Backend Team
**最后更新**: 2026-01-06
**状态**: 生产环境已部署

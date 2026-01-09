# LLM Function Calling 架构分析与实施计划

> **项目**: 白垩纪食品溯源系统 - AI 意图识别自动化升级
> **创建日期**: 2026-01-06
> **文档类型**: 技术分析与实施规划
> **状态**: 规划阶段

---

## 一、项目背景与目标

### 1.1 当前痛点

**位置**: `LlmIntentFallbackClientImpl.java` 第 421-436 行

**问题描述**:
系统在无法识别用户意图时，使用硬编码逻辑尝试创建新意图建议。这种方式存在以下局限：

1. **决策逻辑固化**: 何时创建意图、如何提取参数，都由程序员预先定义，无法根据实际情况灵活调整
2. **扩展性差**: 未来如果要添加更多自动化操作（如更新关键词、合并相似意图），需要修改代码
3. **智能化不足**: LLM 只负责分类，没有真正发挥其推理和决策能力
4. **维护成本高**: 每次调整逻辑都需要修改 Java 代码并重新部署

### 1.2 改进目标

**核心目标**: 让 LLM 从"被动分类器"升级为"主动智能体（Agent）"

**具体目标**:
1. **自主决策**: LLM 根据上下文判断是否需要创建新意图，而非总是依赖硬编码规则
2. **结构化输出**: 使用 Function Calling 获得标准化的 JSON 参数，避免解析自然语言输出
3. **扩展性**: 建立工具框架，未来可轻松添加更多工具（更新意图、查询统计等）
4. **可追溯**: 记录 LLM 的工具调用历史，便于分析和优化

### 1.3 技术选型依据

**为什么选择 Function Calling？**

| 对比维度 | Prompt Engineering | Function Calling (选中) |
|----------|-------------------|------------------------|
| 输出稳定性 | 依赖 LLM 遵循提示词格式 | API 层面保证结构化输出 |
| 参数验证 | 需自行解析和校验 | 自动按 JSON Schema 校验 |
| LLM 自主性 | 仅生成文本建议 | 可决定是否调用工具及参数 |
| 扩展性 | 修改 Prompt 维护困难 | 增加工具只需新增类 |
| 调试难度 | 输出格式不一致时难定位 | 工具调用日志清晰 |

**为什么基于通义千问 Qwen-Plus？**
- 已集成到系统中（`DashScopeClient`）
- 支持 OpenAI-compatible Function Calling API
- 成本和性能平衡较好

---

## 二、系统现状分析

### 2.1 现有架构梳理

#### 2.1.1 意图执行流程

**核心组件**: `IntentExecutorServiceImpl` (1143 行，系统最核心的编排器)

**完整流程**:
1. **意图识别**: 调用 `AIIntentService.recognizeIntentWithConfidence()` 匹配用户输入
2. **语义缓存查询**: 检查是否有相似查询的缓存结果，提升性能
3. **LLM Fallback**: 如果本地匹配失败，调用 `LlmIntentFallbackClientImpl` 使用 LLM 分类
4. **Schema 验证**: 检查 LLM 返回的意图代码是否合法
5. **置信度检查**: 如果置信度过低，返回澄清请求（Clarification Request）
6. **权限校验**: 检查用户角色是否有权限执行该意图
7. **审批检查**: 高敏感操作需走审批流程
8. **Drools 规则验证**: 调用业务规则引擎验证操作的合法性
9. **Handler 路由**: 根据意图分类（category）路由到具体的 Handler
10. **执行**: 调用 Handler 的 `handle()` 或 `handleWithSemantics()` 方法
11. **结果缓存**: 将执行结果缓存到语义缓存中

**关键发现**: 系统已有完善的编排流程，Function Calling 应在 **步骤 3（LLM Fallback）** 中集成。

#### 2.1.2 Handler 注册机制

**核心设计模式**: 策略模式 (Strategy Pattern)

**工作原理**:
- 所有 Handler 实现统一接口 `IntentHandler`
- Spring 容器启动时，通过依赖注入收集所有 Handler Bean
- `@PostConstruct` 初始化方法中，遍历 Handler 并注册到 `handlerMap`
- Key 为分类（category），Value 为 Handler 实例

**示例分类**:
- `FORM`: 表单生成/修改 Handler
- `DATA_OP`: 数据操作 Handler（增删改查）
- `MATERIAL`: 原材料管理 Handler
- `QUERY`: 查询类 Handler
- `REPORT`: 报表生成 Handler

**启示**: 工具执行框架应复用这套注册机制，保持架构一致性。

#### 2.1.3 LLM Fallback 现状

**组件**: `LlmIntentFallbackClientImpl`

**工作流程**:
1. **构建提示词**: 将所有可用意图的代码、名称、关键词拼接成系统提示词
2. **调用 DashScope API**: 使用 Qwen-Plus 模型进行分类
3. **解析响应**: 提取 LLM 返回的 `intent_code`、`reasoning`（推理过程）、`confidence`（置信度）
4. **匹配本地配置**: 根据 `intent_code` 查找对应的 `AIIntentConfig`
5. **硬编码处理未匹配情况** (第 421-436 行):
   - 如果启用自动创建功能且 `intent_code` 不是 "UNKNOWN"
   - 调用 `tryCreateIntentSuggestion()` 方法
   - 记录到数据库（`ai_intent_learning` 表）

**核心问题**: 第 5 步的逻辑完全由程序员定义，LLM 无法自主决策。

#### 2.1.4 DashScope 客户端现状

**组件**: `DashScopeClient`

**当前功能**:
- 封装通义千问 API 调用
- 支持普通对话补全（`chatCompletion` 方法）
- 处理流式响应（SSE）

**缺失功能**:
- 不支持 `tools` 参数（工具定义列表）
- 不支持 `tool_choice` 参数（工具选择策略）
- 响应解析不包含 `tool_calls` 字段

**改造方向**: 需扩展以支持 Function Calling API。

### 2.2 技术依赖现状

| 组件 | 当前版本/配置 | Function Calling 需求 | 改造难度 |
|------|--------------|---------------------|---------|
| Java | 11 | 支持 | ✅ 无需改动 |
| Spring Boot | 2.7.15 | 支持依赖注入 | ✅ 无需改动 |
| 通义千问 API | Qwen-Plus | 支持 Function Calling | ✅ 已支持 |
| Jackson | 2.x | JSON 解析 | ✅ 无需改动 |
| AIIntentService | 已有 | 提供意图 CRUD | ✅ 直接使用 |
| DashScopeClient | 自研 | 需扩展 API 调用 | ⚠️ 需改造 |
| LlmIntentFallbackClientImpl | 自研 | 需重构核心逻辑 | ⚠️ 需改造 |

### 2.3 潜在风险识别

**技术风险**:
1. **API 兼容性**: 通义千问的 Function Calling 格式可能与 OpenAI 有细微差异
2. **性能开销**: Function Calling 需要多次 API 调用（LLM → 工具执行 → 返回结果 → LLM）
3. **并发问题**: 工具执行时可能涉及数据库写操作，需考虑并发控制

**业务风险**:
1. **误创建**: LLM 可能误判需要创建新意图，导致大量无效配置
2. **权限绕过**: 如果工具权限设计不当，可能绕过正常的权限校验流程
3. **审核流程**: 自动创建的意图需要审核流程，否则可能引入恶意配置

**应对策略**:
- 技术风险: 充分测试 API 兼容性，添加超时控制和重试机制
- 业务风险: 初期设置 `active=false` 强制人工审核，记录详细的创建日志

---

## 三、目标架构设计

### 3.1 整体架构图

```
用户输入 "我想查看设备维护历史"
          ↓
┌─────────────────────────────────────────────────────────┐
│ IntentExecutorServiceImpl (不变)                         │
│   1. 本地意图匹配                                         │
│   2. 语义缓存查询                                         │
└─────────────────────────────────────────────────────────┘
          ↓ (未匹配)
┌─────────────────────────────────────────────────────────┐
│ LlmIntentFallbackClientImpl (改造)                       │
│   1. 构建提示词 (包含所有可用意图)                         │
│   2. 获取可用工具列表 (ToolRegistry)                      │
│   3. 调用 DashScopeClient.chatCompletionWithTools()      │
└─────────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────┐
│ DashScopeClient (扩展 Function Calling)                 │
│   Request: messages + tools + tool_choice               │
│   Response: tool_calls (可选) + content                 │
└─────────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────┐
│ 通义千问 Qwen-Plus API                                    │
│   - 理解用户意图                                          │
│   - 决定: 是否需要调用工具                                 │
│   - 返回: intent_code 或 tool_calls                      │
└─────────────────────────────────────────────────────────┘
          ↓ (如果返回 tool_calls)
┌─────────────────────────────────────────────────────────┐
│ ToolRegistry (新增)                                      │
│   - 根据 tool_name 查找 ToolExecutor                     │
│   - 类似 IntentExecutorServiceImpl.handlerMap            │
└─────────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────┐
│ CreateIntentTool (新增)                                  │
│   1. 解析 LLM 返回的参数 JSON                             │
│   2. 构建 AIIntentConfig 对象                            │
│   3. 调用 AIIntentService.createIntent()                │
│   4. 返回执行结果给 LLM                                   │
└─────────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────┐
│ AIIntentService (已有，不变)                              │
│   - createIntent() 方法创建意图配置                       │
│   - 保存到 ai_intent_config 表                           │
│   - 初始状态: active=false (待审核)                       │
└─────────────────────────────────────────────────────────┘
```

### 3.2 核心组件职责划分

#### 3.2.1 工具执行框架

**组件 1: ToolExecutor (接口)**
- **职责**: 定义工具执行器的标准接口，类似 `IntentHandler`
- **核心方法**:
  - `getToolName()`: 返回工具唯一标识（如 `create_new_intent`）
  - `getDescription()`: 返回工具描述（LLM 用于判断何时调用）
  - `getParametersSchema()`: 返回参数定义（JSON Schema 格式）
  - `execute()`: 执行工具调用，接收 `ToolCall` 和上下文
  - `isEnabled()`: 工具是否启用
  - `requiresPermission()`: 是否需要权限校验
  - `hasPermission()`: 检查用户角色权限

**组件 2: ToolRegistry (注册中心)**
- **职责**: 管理所有可用工具，类似 `IntentExecutorServiceImpl` 的 `handlerMap`
- **核心功能**:
  - 启动时通过 Spring 依赖注入收集所有 `ToolExecutor` 实现
  - `@PostConstruct` 初始化方法注册到 `Map<String, ToolExecutor>`
  - 提供 `getExecutor(toolName)` 查询方法
  - 提供 `getAllToolDefinitions()` 生成工具列表（供 LLM 调用）
  - 支持按角色过滤工具（`getToolDefinitionsForRole()`）

**组件 3: AbstractTool (抽象基类)**
- **职责**: 为具体工具提供通用功能
- **核心功能**:
  - 参数解析辅助方法（JSON 字符串 → Map）
  - 统一的异常处理和日志记录
  - 权限校验辅助方法
  - 默认的 `isEnabled()` 和 `requiresPermission()` 实现

#### 3.2.2 具体工具实现

**CreateIntentTool (创建意图工具)**
- **工具名称**: `create_new_intent`
- **触发场景**: 用户提出的需求无法匹配现有意图
- **参数定义**:
  - `intent_code` (必填): 意图代码，如 `QUERY_EQUIPMENT_HISTORY`
  - `intent_name` (必填): 意图名称，如 "查询设备维护历史"
  - `description` (选填): 详细描述
  - `keywords` (必填): 关键词数组，如 ["设备", "维护", "历史"]
  - `category` (必填): 意图分类，枚举值如 QUERY, DATA_OP, FORM, REPORT
- **执行逻辑**:
  1. 从 `ToolCall.function.arguments` 解析参数 JSON
  2. 从执行上下文获取 `factoryId` 和 `userId`
  3. 构建 `AIIntentConfig` 对象，设置 `active=false`
  4. 调用 `AIIntentService.createIntent()` 保存到数据库
  5. 返回 JSON 格式的执行结果（成功/失败）
- **权限要求**: 需要 `factory_super_admin` 或更高权限
- **审核机制**: 创建后需管理员在后台审核并启用

#### 3.2.3 LLM 客户端扩展

**DashScopeClient 扩展点**
- **新增方法**: `chatCompletionWithTools(messages, tools, toolChoice)`
- **参数扩展**:
  - `tools`: 工具定义列表（从 `ToolRegistry` 获取）
  - `tool_choice`: 工具选择策略
    - `"auto"`: LLM 自主决定（推荐）
    - `"none"`: 强制不使用工具
    - `"required"`: 强制使用工具
    - `{"type":"function","function":{"name":"xxx"}}`: 指定工具
- **响应处理**:
  - 检查 `finish_reason` 是否为 `"tool_calls"`
  - 解析 `message.tool_calls` 数组
  - 每个 `tool_call` 包含: `id`, `type`, `function.name`, `function.arguments`

**LlmIntentFallbackClientImpl 重构**
- **删除**: 第 421-436 行的硬编码逻辑
- **新增逻辑**:
  1. 当本地匹配失败时，构建包含工具定义的 LLM 请求
  2. 调用 `chatCompletionWithTools()` 获取响应
  3. 如果响应包含 `tool_calls`:
     - 遍历每个工具调用
     - 从 `ToolRegistry` 获取对应的 `ToolExecutor`
     - 执行工具并记录结果
  4. （可选）将工具执行结果返回给 LLM 继续对话（ReAct 循环）

### 3.3 数据流分析

**场景: 用户输入"我想查看设备维护历史"**

**步骤 1: 本地意图匹配** (现有流程，不变)
- 查询 `ai_intent_config` 表
- 关键词匹配: "设备" + "维护" + "历史"
- 结果: 未找到匹配（假设系统没有此意图）

**步骤 2: LLM Fallback** (改造点)
- 构建提示词: "以下是系统支持的意图列表: [QUERY_MATERIAL, UPDATE_BATCH, ...]，用户输入: 我想查看设备维护历史"
- 获取工具列表: `ToolRegistry.getToolDefinitionsForRole("factory_admin")`
- 返回: `[{type:"function", function:{name:"create_new_intent", description:"...", parameters:{...}}}]`

**步骤 3: LLM 推理** (通义千问 API)
- LLM 分析: "用户想查询设备维护历史，但现有意图列表中没有匹配项"
- LLM 决策: "应该创建一个新意图"
- LLM 返回:
  ```
  {
    "finish_reason": "tool_calls",
    "message": {
      "role": "assistant",
      "tool_calls": [{
        "id": "call_abc123",
        "type": "function",
        "function": {
          "name": "create_new_intent",
          "arguments": "{\"intent_code\":\"QUERY_EQUIPMENT_HISTORY\",\"intent_name\":\"查询设备维护历史\",\"keywords\":[\"设备\",\"维护\",\"历史\"],\"category\":\"QUERY\"}"
        }
      }]
    }
  }
  ```

**步骤 4: 工具路由** (新增)
- `ToolRegistry.getExecutor("create_new_intent")`
- 返回: `CreateIntentTool` 实例

**步骤 5: 工具执行** (新增)
- 解析参数: `{"intent_code":"QUERY_EQUIPMENT_HISTORY", ...}`
- 构建配置对象: `AIIntentConfig` with `active=false`
- 调用服务: `AIIntentService.createIntent(config)`
- 数据库操作: INSERT INTO `ai_intent_config` ...
- 返回结果: `{"success": true, "intent_code": "QUERY_EQUIPMENT_HISTORY", "message": "意图已创建，待管理员审核"}`

**步骤 6: 返回用户** (现有流程)
- 告知用户: "您的需求已记录，系统将在管理员审核后支持此功能"

### 3.4 与现有系统的集成点

**集成点 1: 意图执行流程**
- 位置: `IntentExecutorServiceImpl.execute()` 方法
- 时机: 在 LLM Fallback 步骤
- 方式: 无需修改 `IntentExecutorServiceImpl`，只修改 `LlmIntentFallbackClientImpl`

**集成点 2: Handler 注册模式**
- 参考: `IntentExecutorServiceImpl` 的 `@PostConstruct` 注册逻辑
- 复用: 相同的 Spring 依赖注入机制

**集成点 3: 意图配置管理**
- 服务: `AIIntentService` (已有)
- 方法: `createIntent(AIIntentConfig)` (已有)
- 表: `ai_intent_config` (已有)

**集成点 4: 权限校验**
- 服务: `AIIntentService.hasPermission(factoryId, intentCode, userRole)`
- 时机: 工具执行前校验

**集成点 5: 审核流程**
- 管理后台: 已有意图配置管理界面
- 新增: 显示 `active=false` 的待审核意图
- 操作: 管理员点击"启用"按钮，调用 `setIntentActive(intentCode, true)`

---

## 四、详细实施计划

### 4.1 分阶段实施策略

#### Phase 1: 基础框架搭建 (2-3 天)

**目标**: 建立工具执行框架，支持工具注册和调用

**任务清单**:
1. **创建 DTO 类** (0.5 天)
   - `Tool.java`: 工具定义结构
   - `ToolCall.java`: 工具调用结构
   - 扩展 `ChatCompletionRequest` 增加 `tools` 和 `toolChoice` 字段
   - 扩展 `ChatCompletionResponse.Message` 增加 `toolCalls` 字段

2. **创建工具框架** (1 天)
   - `ToolExecutor` 接口: 定义工具执行标准
   - `AbstractTool` 抽象类: 提供通用功能
   - `ToolRegistry` 注册中心: 管理工具实例

3. **扩展 DashScope 客户端** (0.5 天)
   - 新增 `chatCompletionWithTools()` 方法
   - 处理 `tool_calls` 响应字段
   - 添加单元测试验证 API 兼容性

4. **集成到系统** (1 天)
   - 在 `LlmIntentFallbackClientImpl` 中注入 `ToolRegistry`
   - 添加工具调用分支逻辑（先保留原有逻辑作为 fallback）
   - 添加日志记录工具调用过程

**验收标准**:
- ToolRegistry 启动时成功注册工具（日志输出）
- DashScopeClient 可正常解析带 `tool_calls` 的响应
- 可手动触发工具调用流程（通过单元测试）

#### Phase 2: 实现 CreateIntentTool (1-2 天)

**目标**: 实现第一个具体工具，替换硬编码逻辑

**任务清单**:
1. **实现工具类** (0.5 天)
   - 继承 `AbstractTool`
   - 定义参数 Schema (JSON Schema 格式)
   - 实现 `execute()` 方法调用 `AIIntentService`

2. **权限和校验** (0.5 天)
   - 实现 `requiresPermission()` 和 `hasPermission()`
   - 添加参数合法性校验（intent_code 格式、category 枚举）
   - 防重复检查（避免创建已存在的意图）

3. **集成到 LLM Fallback** (0.5 天)
   - 在提示词中说明工具用途
   - 修改 `recognizeIntent()` 方法，删除硬编码逻辑
   - 处理工具执行结果并返回给用户

4. **日志和监控** (0.5 天)
   - 记录每次工具调用到日志
   - 统计工具调用成功率
   - 添加异常处理和降级逻辑

**验收标准**:
- 用户输入未知意图时，LLM 自动调用 `create_new_intent`
- 工具执行成功，数据库中新增一条 `active=false` 的意图配置
- 原有硬编码逻辑已完全移除

#### Phase 3: 测试与优化 (1-2 天)

**目标**: 保证功能稳定可靠，性能符合预期

**任务清单**:
1. **单元测试** (0.5 天)
   - ToolRegistry 注册逻辑测试
   - CreateIntentTool 参数解析测试
   - DashScopeClient Function Calling 测试

2. **集成测试** (0.5 天)
   - 模拟 LLM 返回 `tool_calls` 的场景
   - 端到端测试: 用户输入 → 工具调用 → 意图创建
   - 异常场景测试: 参数错误、权限不足、数据库异常

3. **性能测试** (0.5 天)
   - 对比 Function Calling 前后的响应时间
   - 工具执行时间监控
   - 并发场景测试

4. **安全测试** (0.5 天)
   - 权限绕过测试
   - SQL 注入风险检查
   - 恶意参数注入测试

**验收标准**:
- 单元测试覆盖率 > 80%
- 集成测试通过所有关键场景
- 响应时间增加 < 500ms
- 无安全漏洞

#### Phase 4: 上线与监控 (1 天)

**目标**: 安全发布到生产环境，建立监控机制

**任务清单**:
1. **灰度发布** (0.5 天)
   - 配置开关: 只对特定工厂启用 Function Calling
   - 金丝雀部署: 10% 流量 → 50% 流量 → 100% 流量
   - 准备回滚方案: 可快速切回硬编码逻辑

2. **监控告警** (0.5 天)
   - 添加工具调用成功率指标
   - 添加工具执行耗时监控
   - 设置告警阈值: 失败率 > 10% 或 耗时 > 2s

3. **文档更新** (0.5 天)
   - 更新系统架构文档
   - 编写工具开发指南
   - 更新运维手册

**验收标准**:
- 生产环境稳定运行 24 小时无严重问题
- 监控指标正常，无异常告警
- 文档完整，团队成员理解新架构

### 4.2 里程碑与交付物

| 阶段 | 预计工期 | 交付物 | 关键指标 |
|------|---------|--------|---------|
| Phase 1 | 2-3 天 | 工具框架代码 + 扩展 DashScope | ToolRegistry 正常注册 |
| Phase 2 | 1-2 天 | CreateIntentTool + 重构 LLM Fallback | 硬编码逻辑完全移除 |
| Phase 3 | 1-2 天 | 测试报告 + 性能报告 | 测试覆盖率 > 80% |
| Phase 4 | 1 天 | 生产环境部署 + 监控大盘 | 稳定运行 24h |
| **总计** | **5-8 天** | 完整的 Function Calling 系统 | LLM 自主创建意图 |

### 4.3 风险应对计划

**风险 1: API 格式不兼容**
- **描述**: 通义千问 Function Calling 格式与 OpenAI 有差异
- **影响**: 高 (阻塞开发)
- **应对**:
  - Phase 1 立即进行 API 兼容性测试
  - 准备适配层代码，必要时包装通义千问 API
  - 备选方案: 使用 Prompt Engineering 模拟 Function Calling

**风险 2: LLM 误判**
- **描述**: LLM 可能在不该创建意图时调用工具
- **影响**: 中 (产生垃圾数据)
- **应对**:
  - 设置 `active=false` 强制人工审核
  - 在提示词中明确工具调用的严格条件
  - 定期分析工具调用日志，优化提示词

**风险 3: 性能下降**
- **描述**: Function Calling 增加 API 调用次数，响应变慢
- **影响**: 中 (用户体验下降)
- **应对**:
  - 设置超时时间，避免长时间等待
  - 优先使用语义缓存，减少 LLM 调用
  - 异步处理工具调用，先返回中间状态

**风险 4: 权限绕过**
- **描述**: 工具执行时可能绕过正常权限校验
- **影响**: 高 (安全风险)
- **应对**:
  - 每个工具执行前强制调用 `hasPermission()`
  - 审计工具调用日志，记录用户身份
  - 安全测试覆盖所有权限场景

### 4.4 回滚方案

**触发条件**:
- 生产环境稳定性指标低于 95%
- 工具调用失败率 > 20%
- 出现严重安全漏洞

**回滚步骤**:
1. **配置开关降级** (5 分钟)
   - 在 `application.properties` 中设置 `ai.function-calling.enabled=false`
   - 系统自动切回硬编码逻辑（保留原有代码）

2. **数据清理** (可选)
   - 删除 `active=false` 的待审核意图
   - 保留 `active=true` 的已审核意图

3. **流量切回** (10 分钟)
   - 负载均衡切回旧版本实例
   - 监控旧版本稳定性

4. **问题修复** (1-2 天)
   - 分析失败原因
   - 修复 Bug 并补充测试
   - 重新发布

---

## 五、关键技术细节

### 5.1 JSON Schema 设计

**CreateIntentTool 参数定义**:

```
类型: object
必填字段: ["intent_code", "intent_name", "keywords", "category"]
可选字段: ["description", "sensitivity_level", "allowed_roles"]

字段说明:
- intent_code:
  - 类型: string
  - 格式: 大写字母 + 下划线，如 QUERY_EQUIPMENT_HISTORY
  - 限制: 长度 5-50 字符

- intent_name:
  - 类型: string
  - 限制: 长度 2-100 字符
  - 示例: "查询设备维护历史"

- keywords:
  - 类型: array[string]
  - 限制: 至少 1 个，最多 20 个
  - 示例: ["设备", "维护", "历史", "记录"]

- category:
  - 类型: string
  - 枚举: ["QUERY", "DATA_OP", "FORM", "REPORT", "SYSTEM"]
  - 说明: 对应不同的 Handler

- description:
  - 类型: string (可选)
  - 限制: 最多 500 字符

- sensitivity_level:
  - 类型: string (可选)
  - 枚举: ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
  - 默认: "MEDIUM"

- allowed_roles:
  - 类型: array[string] (可选)
  - 枚举值: ["super_admin", "factory_super_admin", "factory_admin", ...]
  - 默认: ["factory_super_admin"]
```

### 5.2 提示词工程

**系统提示词结构**:

```
角色定义:
你是一个智能意图识别助手，负责分析用户输入并匹配到合适的系统功能。

可用意图列表:
[意图代码列表和描述]

工具使用指南:
当用户的需求无法匹配现有意图时，你可以调用 create_new_intent 工具创建新意图。
注意事项:
1. 仅在确认需求合理且无现有意图可匹配时创建
2. 意图代码需遵循命名规范
3. 关键词需准确反映用户表达

响应格式:
- 如果匹配到意图: 返回 intent_code 和 reasoning
- 如果需要创建意图: 调用 create_new_intent 工具
- 如果需求不明确: 返回 CLARIFICATION_NEEDED
```

**用户输入拼接**:

```
用户输入: {userInput}
工厂ID: {factoryId}
用户角色: {userRole}
```

### 5.3 ReAct 循环设计 (可选高级功能)

**基础版本 (Phase 2)**:
- LLM 决策 → 工具调用 → 返回结果给用户
- 无多轮对话

**高级版本 (未来扩展)**:

```
循环流程:
1. LLM 推理 (Reasoning): 分析当前情况
2. LLM 行动 (Action): 决定调用哪个工具
3. 工具执行 (Observation): 执行工具并返回结果
4. LLM 反思 (Reflection): 判断是否需要继续
5. 如果需要: 回到步骤 1，最多 3 轮

终止条件:
- LLM 返回 finish_reason: "stop" (不再调用工具)
- 达到最大迭代次数 (MAX_ITERATIONS = 3)
- 工具执行失败
```

**数据结构**:

```
对话历史:
[
  {role: "user", content: "我想查看设备维护历史"},
  {role: "assistant", content: null, tool_calls: [{...}]},
  {role: "tool", tool_call_id: "call_123", content: "{\"success\": true}"},
  {role: "assistant", content: "已为您创建新意图，待审核"}
]
```

### 5.4 错误处理策略

**分类处理**:

| 错误类型 | 处理策略 | 用户反馈 |
|---------|---------|---------|
| LLM API 超时 | 重试 1 次，失败则降级到硬编码 | "系统繁忙，请稍后重试" |
| 工具执行异常 | 记录日志，返回错误给 LLM | "操作失败，请联系管理员" |
| 参数格式错误 | 返回 Schema 验证错误 | "参数不合法，请检查输入" |
| 权限不足 | 拒绝执行 | "您没有权限执行此操作" |
| 数据库异常 | 事务回滚 | "系统错误，请稍后重试" |

**降级逻辑**:

```
判断条件:
if (functionCallingEnabled && toolRegistry.getToolCount() > 0) {
    // 使用 Function Calling
} else {
    // 降级到硬编码逻辑
    log.warn("Function Calling 不可用，降级到硬编码逻辑");
}
```

---

## 六、测试策略

### 6.1 单元测试

**ToolRegistry 测试**:
- 测试工具注册逻辑
- 测试工具查询 (存在/不存在)
- 测试按角色过滤工具
- 测试并发访问安全性

**CreateIntentTool 测试**:
- 测试参数解析 (正常/异常)
- 测试权限校验
- 测试意图创建 (成功/失败)
- 测试防重复检查

**DashScopeClient 测试**:
- 测试 Function Calling 请求构建
- 测试响应解析 (有/无 tool_calls)
- 测试 API 兼容性

### 6.2 集成测试

**场景 1: 正常创建意图**
- 输入: "我想查看设备维护历史"
- 期望: LLM 调用 `create_new_intent`
- 验证: 数据库新增一条 `active=false` 的配置

**场景 2: 重复意图**
- 输入: "查询原材料库存" (已存在意图)
- 期望: LLM 匹配到现有意图，不调用工具
- 验证: 无新增数据库记录

**场景 3: 权限不足**
- 输入: 以 `workshop_worker` 角色尝试创建意图
- 期望: 工具执行失败，返回权限错误
- 验证: 数据库无变化

**场景 4: LLM 降级**
- 输入: Function Calling 被禁用
- 期望: 自动切换到硬编码逻辑
- 验证: 功能仍可用

### 6.3 性能测试

**指标**:
- 响应时间: P50, P95, P99
- 吞吐量: QPS (Queries Per Second)
- 资源消耗: CPU, 内存, 数据库连接

**基准对比**:
| 场景 | 硬编码逻辑 | Function Calling | 增量 |
|------|-----------|-----------------|------|
| 本地匹配 | 50ms | 50ms | 0ms |
| LLM Fallback | 800ms | 1200ms | +400ms |
| 工具执行 | N/A | 300ms | +300ms |
| 总计 | 850ms | 1550ms | +700ms |

**优化方向**:
- 语义缓存命中率 > 60%
- 工具执行异步化
- LLM API 调用并发控制

### 6.4 安全测试

**测试点**:
1. **SQL 注入**: 尝试在 `intent_code` 中注入 SQL
2. **权限绕过**: 尝试通过工具调用绕过权限校验
3. **参数溢出**: 测试超长字符串、超大数组
4. **恶意 JSON**: 测试畸形 JSON 参数
5. **并发冲突**: 同时创建相同 `intent_code` 的意图

---

## 七、后续演进路线

### 7.1 Phase 5: 更多工具 (1-2 周)

**计划新增工具**:

**1. update_intent_keywords (更新意图关键词)**
- **场景**: 用户反馈某个意图识别不准，需要优化关键词
- **参数**: `intent_code`, `add_keywords`, `remove_keywords`
- **权限**: `factory_super_admin`

**2. merge_similar_intents (合并相似意图)**
- **场景**: 系统中有多个相似意图，造成识别混淆
- **参数**: `primary_intent_code`, `secondary_intent_codes`
- **权限**: `super_admin`

**3. query_intent_usage_stats (查询意图使用统计)**
- **场景**: LLM 需要了解哪些意图最常用，辅助决策
- **参数**: `time_range`, `factory_id`
- **权限**: 无需特殊权限

**4. suggest_intent_optimization (建议意图优化)**
- **场景**: 分析用户输入模式，建议关键词优化
- **参数**: `intent_code`
- **权限**: `factory_admin`

### 7.2 Phase 6: Agent 架构升级 (2-3 周)

**目标**: 从单步工具调用升级为多步推理

**核心功能**:
1. **多轮对话**: LLM 可连续调用多个工具，每次根据前一步结果决策
2. **工具链**: 定义工具之间的依赖关系，自动编排调用顺序
3. **状态管理**: 维护对话状态，支持长程任务
4. **中断恢复**: 用户可随时中断，系统保存状态并恢复

**示例场景**:
```
用户: "帮我分析本月的生产效率问题"

LLM 推理:
1. 需要查询生产数据 → 调用 query_production_stats
2. 数据显示某条生产线效率低 → 调用 query_equipment_alerts
3. 发现设备有未处理的告警 → 调用 create_maintenance_task
4. 生成分析报告 → 调用 generate_report
```

### 7.3 Phase 7: 可视化与监控 (1 周)

**管理后台新增功能**:

1. **工具调用日志**
   - 展示每次工具调用的时间、用户、参数、结果
   - 支持按工具名称、时间范围、结果状态筛选

2. **意图自学习看板**
   - 统计自动创建的意图数量
   - 审核通过率、启用率
   - Top 10 高频新意图

3. **LLM 性能监控**
   - Function Calling 成功率趋势图
   - 平均响应时间
   - 工具执行耗时分布

4. **提示词实验室**
   - 在线调试提示词
   - A/B 测试不同提示词效果
   - 评估 LLM 决策准确率

### 7.4 Phase 8: 跨工厂意图共享 (1-2 周)

**目标**: 建立意图知识库，新工厂可复用已有意图

**功能**:
1. **意图市场**: 平台级意图配置，所有工厂可订阅
2. **智能推荐**: 分析工厂业务类型，推荐适用的意图
3. **版本管理**: 意图配置支持版本迭代，工厂可选择升级
4. **社区贡献**: 工厂可将自定义意图贡献到市场

---

## 八、总结与建议

### 8.1 核心价值

**技术价值**:
- **架构升级**: 从硬编码逻辑升级为 LLM Agent 架构
- **扩展性增强**: 新增工具只需实现接口，无需修改核心逻辑
- **可维护性提升**: 工具逻辑与业务逻辑解耦，职责清晰

**业务价值**:
- **自学习能力**: 系统能根据用户反馈自动扩展功能
- **用户体验**: 减少"系统不支持"的挫败感
- **运营效率**: 减少人工配置意图的工作量

### 8.2 关键成功因素

1. **提示词工程**: 准确引导 LLM 何时调用工具
2. **审核机制**: 防止自动创建的意图引入风险
3. **性能优化**: 保证 Function Calling 不拖累响应时间
4. **监控完善**: 及时发现和修复问题

### 8.3 下一步行动

**立即开始 (本周)**:
- 完成 Phase 1: 基础框架搭建
- 进行 API 兼容性测试
- 确定提示词初稿

**近期完成 (2 周内)**:
- 完成 Phase 2-4: CreateIntentTool 开发与上线
- 收集用户反馈
- 优化提示词和工具参数

**中期规划 (1 个月内)**:
- 开发更多工具（Phase 5）
- 建立监控体系（Phase 7）

**长期愿景 (3 个月内)**:
- 升级为完整 Agent 架构（Phase 6）
- 建立跨工厂意图共享机制（Phase 8）

---

**文档版本**: v1.0
**最后更新**: 2026-01-06
**状态**: 等待评审和批准

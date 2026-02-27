# AI Chat 响应速度瓶颈分析与优化方案

**研究主题**: 分析项目当前 AI Chat 响应速度瓶颈并提出优化方案
**日期**: 2026-02-26
**模式**: Full | 语言: Chinese | 代码验证: ENABLED

---

## Executive Summary

当前 AI Chat (`/api/mobile/ai/chat`) 的响应延迟主要由 **DashScope API 同步阻塞调用** 和 **模型选择不当** 两个因素造成。即使简单的 "hello" 也需要 9.2s，核心原因是：

1. **同步阻塞**: `GenericAIChatController` 等待 DashScope 生成完整响应后才返回，客户端看到的是 "全量等待" 而非 "逐字输出"
2. **模型过重**: 所有查询（含简单问候）均使用 `qwen3.5-plus`（大模型），而非 `qwen-turbo`/`qwen3.5-flash`（轻量快速模型）
3. **无 Prompt Caching**: DashScope 支持 prompt caching（相同 system prompt 复用），当前未启用

**关键结论**: 实现 SSE 流式输出后，用户感知延迟 (TTFT) 可从 4.5-56s 降至 **1-4s**，改善幅度 70-95%。

---

## 1. 测试数据基线

| # | 查询 | 类型 | 字符数 | Thinking | 响应时间 | 输出估算 |
|---|------|------|--------|---------|---------|---------|
| 1 | "hello" | 简单 | 5 | OFF | 9.2s | ~100 tokens |
| 2 | "2+2" | 简单 | 7 | OFF | 4.5s | ~20 tokens |
| 3 | "Show me today production count" | 简单+系统提示 | 30+55 | OFF | 20.3s | ~300 tokens |
| 4 | 生产效率分析 (256 chars) | 复杂 | 256 | ON | 55.5s | ~800 tokens |
| 5 | 仓库优化方案 (275 chars) | 复杂 | 275 | ON | 56.4s | ~800 tokens |

**平均**: 简单 11.3s | 复杂 56.0s | 复杂/简单比 = 4.9x

---

## 2. 当前架构分析（代码验证）

### 2.1 请求流程 (`GenericAIChatController.java`)

```
客户端 HTTP POST → GenericAIChatController.chat()
  ├── convertMessages() — 消息格式转换
  ├── shouldEnableThinking() — 自动检测 thinking 模式
  ├── dashScopeClient.chatCompletion() — ⚡ 同步阻塞调用
  │   ├── OkHttp POST → DashScope API
  │   ├── response.body().string() — 等待完整响应
  │   └── objectMapper.readValue() — JSON 反序列化
  └── return ApiResponse — 一次性返回全部内容
```

**关键发现**:
- `chatCompletion()` (第64行) 使用 **同步 `response.body().string()`** — 必须等到 DashScope 生成所有 token 后才能返回
- `chatCompletionStreaming()` (第201行) **仅用于 thinking 模式内部**，而且也是收集所有 chunk 到 StringBuilder 后再返回，并非真正的端到端流式
- 对客户端来说，无论 thinking ON/OFF，都是 "等→等→等→一次性显示全部"

### 2.2 超时配置 (`DashScopeConfig.java`)

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `timeout` | 60s | 普通调用超时 |
| `thinkingTimeout` | 120s | thinking 模式超时 |
| `model` | `qwen3.5-plus` | 默认模型（所有查询） |
| `maxTokens` | 2000 | 默认最大输出 |
| `temperature` | 0.7 | 默认温度 |

### 2.3 已有的 SSE 实现（可复用）

`SmartBIUploadController.java` 已有完整的 SseEmitter 实现（第266-306行）：
```java
SseEmitter emitter = new SseEmitter(600000L);
new Thread(() -> {
    sendEvent(emitter, ...);
    emitter.complete();
}).start();
```
这套模式可以直接复用到 AI Chat 流式输出。

---

## 3. 响应时间分解

### 3.1 DashScope API 延迟组成

```
总响应时间 = 网络延迟(~100ms) + TTFT(模型首字延迟) + 生成时间(tokens × TPS⁻¹)
```

| 组件 | qwen3.5-plus | qwen-turbo / qwen3.5-flash |
|------|-------------|---------------------------|
| TTFT (首字延迟) | 2-5s | 0.3-1s |
| TPS (每秒 token) | 15-25 tps | 40-80 tps |
| 网络 (上海→DashScope) | ~100ms | ~100ms |

### 3.2 测试数据反推

| 查询 | 总时间 | 估算TTFT | 估算生成时间 | 估算输出tokens |
|------|--------|---------|------------|--------------|
| "hello" | 9.2s | ~3s | ~6s | ~100-150 (greeting) |
| "2+2" | 4.5s | ~3s | ~1.5s | ~20-30 (short answer) |
| "production count" | 20.3s | ~3s | ~17s | ~300-400 (with explanation) |
| 生产效率分析 | 55.5s | ~5s (thinking) | ~50s | ~800-1000 (detailed analysis) |
| 仓库优化方案 | 56.4s | ~5s (thinking) | ~51s | ~800-1000 (detailed analysis) |

**关键洞察**: "hello" 9.2s 中约 3s 是 TTFT，6s 是生成。如果用流式输出，用户在 3s 后就开始看到文字，而非等到 9.2s。

---

## 4. TTFT 预估（加入流式输出后）

### 4.1 方案 A: 仅加 SSE 流式输出（不换模型）

| 查询 | 当前总等待 | SSE后TTFT | 感知改善 |
|------|----------|----------|---------|
| "hello" | 9.2s | **~3s** | -67% |
| "2+2" | 4.5s | **~3s** | -33% |
| "production count" | 20.3s | **~3s** | -85% |
| 生产效率分析 | 55.5s | **~5s** | -91% |
| 仓库优化方案 | 56.4s | **~5s** | -91% |

### 4.2 方案 B: SSE + 简单查询换轻量模型

| 查询 | 当前总等待 | 换模型+SSE后TTFT | 感知改善 |
|------|----------|----------------|---------|
| "hello" | 9.2s | **~0.5s** | -95% |
| "2+2" | 4.5s | **~0.5s** | -89% |
| "production count" | 20.3s | **~1s** | -95% |
| 生产效率分析 | 55.5s | **~5s** | -91% |
| 仓库优化方案 | 56.4s | **~5s** | -91% |

### 4.3 方案 C: SSE + 换模型 + Prompt Caching

| 查询 | 当前总等待 | 全优化后TTFT | 感知改善 |
|------|----------|------------|---------|
| "hello" | 9.2s | **~0.3s** | -97% |
| "2+2" | 4.5s | **~0.3s** | -93% |
| "production count" | 20.3s | **~0.5s** | -98% |
| 生产效率分析 | 55.5s | **~3s** | -95% |
| 仓库优化方案 | 56.4s | **~3s** | -95% |

---

## 5. 优化方案（按优先级排序）

### P0: SSE 流式输出（高影响、中等工作量）

**改动范围**: 3 个文件

| 文件 | 改动 |
|------|------|
| `GenericAIChatController.java` | 新增 `/chat/stream` 端点，返回 `SseEmitter` |
| `DashScopeClient.java` | 新增 `chatCompletionStream(request, Consumer<String> onChunk)` 方法 |
| 客户端 (RN/Web) | `EventSource` 接收 SSE 事件 |

**实现思路**:
```java
// GenericAIChatController.java — 新增
@PostMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public SseEmitter chatStream(@RequestBody GenericChatRequest request) {
    SseEmitter emitter = new SseEmitter(120000L);

    CompletableFuture.runAsync(() -> {
        try {
            // 构建请求（同现有 chat() 方法）
            ChatCompletionRequest aiRequest = buildRequest(request);
            aiRequest.setStream(true);  // 开启流式

            // 流式调用，逐 chunk 转发
            dashScopeClient.chatCompletionStream(aiRequest, chunk -> {
                emitter.send(SseEmitter.event().data(chunk));
            });

            emitter.send(SseEmitter.event().name("done").data("[DONE]"));
            emitter.complete();
        } catch (Exception e) {
            emitter.completeWithError(e);
        }
    });

    return emitter;
}
```

**DashScope 已经返回 SSE 格式** — `chatCompletionStreaming()` 第231-258行已经在解析 `data: ` 前缀的 SSE chunk，只需把 `content.append()` 改为 `onChunk.accept()` 即可转发。

**预期效果**: TTFT 从 4.5-56s → 1-5s

### P1: 简单查询智能路由到轻量模型（高影响、低工作量）

**改动范围**: 1 个文件 (`GenericAIChatController.java`)

**思路**: 复用已有的 `shouldEnableThinking()` 逻辑，不需要 thinking 的查询用 `qwen-turbo` 或 `qwen3.5-flash`：

```java
// GenericAIChatController.java — 修改 chat() 方法
boolean enableThinking = DashScopeClient.shouldEnableThinking(lastUserMsg);
String model;
if (request.getModel() != null) {
    model = request.getModel();  // 客户端指定优先
} else if (enableThinking) {
    model = defaultModel;  // qwen3.5-plus (复杂查询)
} else {
    model = "qwen-turbo";  // 轻量模型 (简单查询)
}
```

**预期效果**: 简单查询 TTFT 从 3s → 0.5-1s

### P2: 降低简单查询的 maxTokens（低工作量、中等影响）

**改动范围**: 1 个文件 (`GenericAIChatController.java`)

```java
int maxTokens;
if (request.getMaxTokens() != null) {
    maxTokens = request.getMaxTokens();
} else if (enableThinking) {
    maxTokens = 2000;  // 复杂查询需要长输出
} else {
    maxTokens = 500;   // 简单查询不需要长篇大论
}
```

生成的 token 越少，响应越快。"hello" 不需要 2000 token 的回复。

### P3: DashScope Prompt Caching（中等影响、低工作量）

DashScope API 支持 prompt caching — 相同的 system prompt 不需要重复处理。需要在请求头添加：

```
X-DashScope-Plugin: enable_search=false
```

或在 request body 中添加 `enable_search: false` + 确保 system prompt 固定格式复用。

### P4: HTTP 连接优化（低影响、低工作量）

检查 OkHttp 连接池配置，确保 HTTP/2 + keep-alive：

```java
OkHttpClient httpClient = new OkHttpClient.Builder()
    .connectionPool(new ConnectionPool(5, 30, TimeUnit.SECONDS))
    .protocols(Arrays.asList(Protocol.HTTP_2, Protocol.HTTP_1_1))
    .build();
```

---

## 6. "hello 为什么要 9 秒" — 详细分解

```
9.2s 分解:
├── 网络延迟 (Java→DashScope): ~100ms
├── DashScope 排队/调度: ~500ms (共享资源)
├── 模型 TTFT (qwen3.5-plus): ~2-3s ← 最大瓶颈
├── 生成 ~100 tokens @ 20tps: ~5s ← 第二大因素
├── 网络延迟 (DashScope→Java): ~100ms
└── Java 反序列化 + 响应: ~50ms
```

**为什么 "2+2" 比 "hello" 快？**
- "2+2" 输出很短 (~20 tokens: "2+2=4")
- "hello" 模型倾向于生成礼貌性回复 (~100-150 tokens)
- 差异主要在生成时间: 1s vs 5-6s

**为什么 "production count" 要 20s？**
- 有 system prompt ("You are a helpful assistant for a food factory") 增加输入 token
- 模型没有实际数据，会生成一段解释性文字 (~300-400 tokens)
- 生成时间: ~300 tokens / 20tps = ~15s

---

## 7. 实施路线图

| 阶段 | 优化项 | 工作量 | TTFT 目标 | 预估改善 |
|------|--------|--------|----------|---------|
| **Week 1** | P1: 模型路由 | 0.5天 | 简单→1-2s | -60% |
| **Week 1** | P2: maxTokens 优化 | 0.5天 | 配合P1 | -20% |
| **Week 2** | P0: SSE 流式输出 | 2-3天 | 全部→1-5s TTFT | -70-95% |
| **Week 3** | P3: Prompt Caching | 0.5天 | 进一步降低 | -10-20% |
| **Week 3** | P4: 连接优化 | 0.5天 | 微调 | -5% |

**推荐先做 P1+P2**（1天工作量，立竿见影），再做 P0（SSE 流式，工作量大但效果最好）。

---

## 8. 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| qwen-turbo 质量不够 | 中 | 简单查询回复质量下降 | 先 A/B 测试，保留 fallback |
| SSE 兼容性 | 低 | 部分客户端不支持 | 保留同步 `/chat` 端点 |
| DashScope API 变更 | 低 | 接口不兼容 | 使用 OpenAI 兼容格式 |
| 模型路由误判 | 中 | 复杂查询用了轻量模型 | 保守策略：只有明确简单才降级 |

---

## 9. Confidence Assessment

| 结论 | 信心度 | 依据 |
|------|--------|------|
| SSE 流式能大幅降低感知延迟 | ★★★★★ | 代码已有 streaming 解析，只需转发 |
| 模型路由能降低简单查询延迟 | ★★★★☆ | DashScope 官方数据，需实测确认 |
| TTFT 预估 1-5s | ★★★☆☆ | 基于官方 benchmark，实际受负载影响 |
| P0+P1 组合可将 "hello" 降至 <1s | ★★★★☆ | qwen-turbo TTFT ~0.3-0.5s + streaming |

---

### Process Note
- Mode: Full
- Researchers deployed: 3 (code architecture, DashScope API, streaming/SSE)
- Codebase grounding: ENABLED (verified against 5 source files)
- Total sources: 5 codebase files + DashScope documentation
- Key disagreements: 0
- Phases completed: Research → Analysis → Integration
- Fact-check: Manual verification against codebase (code claims ✅)
- Healer: All structural checks passed ✅

### Healer Notes: All checks passed ✅

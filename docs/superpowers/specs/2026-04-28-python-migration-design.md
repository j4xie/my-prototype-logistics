# Python Migration Design
# 将 AI / 分析 / Tool-Skill 系统从 Java 迁移到 Python

**日期**: 2026-04-28  
**状态**: 已批准，待实施

---

## 背景与动机

当前架构中 Java 同时承担业务流程和 AI 推理两个职责，导致：

- 所有 LLM 调用走 Java DashScopeClient 直连单一 provider，无 fallback
- SmartBI 分析逻辑分散在 Java 和 Python 两侧，双写、双维护
- Tool-Skill 意图系统的 AI 推理（prompt、LLM 调用）和业务逻辑混在 3726 行 Java 代码里
- prompt 改动需要重新编译部署 Java
- Python 已有成熟的 llm_router（4 provider fallback 链、熔断器）未被充分利用

**核心原则**：Python 承接所有 AI 推理；Java 保留核心业务流程（采购/生产/出货/销售/质检/财务）、事务边界、RBAC。

---

## 目标架构

```
客户端（移动端 / Web-Admin）
        │
        ▼
   Nginx 网关（139）
   ├── /api/smartbi/        → Python:8083  (SmartBI，Phase 2)
   ├── /api/llm/            → Python:8083  (LLM 服务，Phase 1)
   ├── /api/ai/             → Python:8083  (Tool-Skill，Phase 3)
   └── /api/mobile/*        → Java:10010   (核心业务，永久保留)
        │
        ▼
┌──────────────────────────────────────────────────────┐
│             Python FastAPI :8083                      │
│                                                       │
│  ┌───────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │ LLM 服务  │  │ Tool-Skill   │  │   SmartBI     │ │
│  │/api/llm/  │  │ 意图+编排    │  │   全量        │ │
│  │llm_router │  │ /api/ai/     │  │               │ │
│  └───────────┘  └──────┬───────┘  └───────────────┘ │
│                         │ 调用工具执行                 │
│  ┌──────────────────────────────────────────────┐    │
│  │  共享：JWT验证 / factory_id / llm_router     │    │
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  SQLAlchemy → PostgreSQL（cretas_db + smartbi_db）   │
└──────────────────────────────────────────────────────┘
        │ POST /api/internal/tools/{name}/execute
        ▼（过渡期）
┌──────────────────────────────────────────────────────┐
│             Java Spring Boot :10010                   │
│  核心业务：采购 / 生产 / 出货 / 销售 / 质检 / 财务    │
│  Tool 执行 API（内部，仅 Python 调用）               │
│  Auth / JWT / RBAC（继续对外暴露）                   │
└──────────────────────────────────────────────────────┘
```

---

## Phase 1：LLM 客户端迁移

### 目标
用 Python 的 `llm_router.py`（已有 4-provider fallback 链）替代 Java 的 `DashScopeClient.java`（单 provider 直连）。

### 新增 Python 端点（`/api/llm/`）

| 端点 | 方法 | 用途 | 对应 Java |
|------|------|------|----------|
| `/api/llm/chat` | POST | 同步 chat completion | `DashScopeClient.chat()` |
| `/api/llm/chat-stream` | POST | SSE 流式输出 | `DashScopeClient.chatCompletionStream()` |
| `/api/llm/tool-call` | POST | Function calling | `DashScopeClient.chatCompletionWithTools()` |
| `/api/llm/intent-classify` | POST | 意图兜底分类 | `LlmIntentFallbackClientImpl` LLM 调用部分 |
| `/api/llm/vision` | POST | 图像识别/OCR | `DashScopeVisionClient` |

### Java 变更
- `DashScopeClient.java`（689 行）→ 删除，替换为 `PythonLLMClient.java`（~80 行薄代理）
- `DashScopeVisionClient.java` → 调用 Python `/api/llm/vision`
- `LlmIntentFallbackClientImpl` 中的 LLM 调用部分 → 调用 Python `/api/llm/intent-classify`
- 所有调用方（38 个文件）的接口签名不变，只换底层实现

### 收益
- 所有 LLM 调用自动获得 4-provider fallback（现在只有 DashScope 单点）
- prompt 调整只需重启 Python
- `llm_metrics.py` 统一记录所有调用

---

## Phase 2：SmartBI 全量迁移

### 目标
Python 完全承接 SmartBI，Java SmartBI 代码全删。

### Python 新增能力

| 功能 | 现在 | 迁移后 |
|------|------|--------|
| JWT 鉴权 | Java `@RequirePermission` | Python JWT middleware（移除 PUBLIC_PREFIXES 豁免） |
| factory_id 验证 | Java Spring Security | Python 从 JWT token 提取，与 Form 参数对比 |
| 图表模板匹配 | Java `matchBestTemplate()`（300 行） | Python 移植（规则等价） |
| 上传二步确认 | Java state machine | Python 状态机（SQLAlchemy 持久化） |
| 分析缓存 | Java Caffeine + `smart_bi_analysis_cache` | Python Redis + 已有缓存层 |
| 数据源注册 | Java 上传后同步更新 | Python 上传成功时直接写入 |

### Nginx 变更（139 服务器）
```nginx
# 新增：SmartBI 直达 Python
location ~ ^/api/mobile/[^/]+/smart-bi/ {
    proxy_pass http://47.100.235.168:8083;
    proxy_set_header Authorization $http_authorization;
    proxy_read_timeout 300s;
    client_max_body_size 300m;
}
```

### Java 删除
- `SmartBIUploadController.java`
- `SmartBIAnalysisController.java`
- `SmartBIDashboardController.java`
- `PythonSmartBIClient.java`（689 行）
- 相关 Service impl 和 DTO

---

## Phase 3：Tool-Skill 意图系统迁移

### 目标
Python 承接意图识别 + 工具编排，Java 保留工具执行（doExecute 调业务 Service）。

### 架构

```
用户输入
   ↓
Python 意图识别（/api/ai/intent）
  ├── EXACT / PHRASE 匹配（纯字符串）
  ├── SEMANTIC 向量检索（调 Python Embedding 服务）
  ├── BERT 分类（已有 /api/classifier/classify）
  └── LLM fallback（调 /api/llm/intent-classify）
   ↓
Python 工具选择 + 编排（/api/ai/execute）
  ├── 单工具：POST /api/internal/tools/{name}/execute → Java
  └── 多工具：顺序/并行调用 Java，Python 聚合结果
   ↓
Java 工具执行（内部 API，不对外暴露）
  ├── @Transactional 保证
  ├── 业务 Service 调用
  └── 返回结构化结果
   ↓
Python 聚合 → 返回用户
```

### Java 新增（过渡期）
```java
// 内部工具执行 API，仅接受来自 Python 的调用
@RestController
@RequestMapping("/api/internal/tools")
public class InternalToolExecutionController {
    @PostMapping("/{toolName}/execute")
    public Map<String, Object> execute(
        @PathVariable String toolName,
        @RequestBody ToolExecutionRequest request,
        @RequestHeader("X-Internal-Secret") String secret
    ) {
        // 验证 X-Internal-Secret
        // 调用 toolRegistry.getExecutor(toolName).execute(...)
    }
}
```

### Python 新增模块（`backend/python/cretas/`）

```
cretas/
├── api/
│   ├── intent.py        # /api/ai/intent — 意图识别
│   └── execute.py       # /api/ai/execute — 工具编排
├── intent/
│   ├── exact_matcher.py         # 精确/短语匹配
│   ├── semantic_matcher.py      # 向量检索
│   └── llm_classifier.py       # LLM fallback
├── tools/
│   ├── registry.py              # 从 Java 同步工具注册表
│   └── executor.py              # 调 Java /api/internal/tools/
└── orchestrator.py              # 单工具 / 多工具编排
```

### LlmIntentFallbackClientImpl 拆分
- AI 推理部分（40%，~1490 行）→ Python `llm_classifier.py`
- 业务逻辑部分（60%，~2236 行）→ 重构留在 Java，简化为 `IntentBusinessService`（处理意图审批、工具过滤、权限）

### 工具注册表同步
Python 通过 `GET /api/internal/tools/registry` 从 Java 获取工具列表（名称、描述、schema、领域标签），Python 用于语义检索和 LLM function calling。

---

## Phase 4：Embedding 服务迁移

### 目标
Java gRPC Embedding 服务（9090）→ Python HTTP 服务。

### 变更
- 新增 Python 端点：`POST /api/embedding/encode`、`POST /api/embedding/similarity`
- Java `GrpcEmbeddingClient.java` → `PythonEmbeddingClient.java`（HTTP 调用）
- 废弃 `cretas-embedding.service` systemd 服务
- 向量模型直接在 Python 加载（sentence-transformers）

---

## 不迁移的部分（Java 永久保留）

| 模块 | 原因 |
|------|------|
| 核心业务 CRUD（采购/生产/出货/销售/质检/财务） | 工作良好，无迁移价值 |
| 337 个工具的 doExecute() | Spring @Transactional 级联，成本高风险大 |
| Spring Security / JWT / RBAC（对外） | 成熟稳定，Python 复用其 token |
| 事件驱动（@EventListener + 事务感知） | Python 无等价方案 |
| Flyway 数据库迁移 | 保留，Python 用 Alembic 管理 smartbi_db |

---

## 实施顺序与依赖

```
Phase 1（LLM 客户端）
    ↓ 依赖
Phase 3（Tool-Skill 意图系统，Phase 1 完成后才有统一 LLM 调用）
    ↓ 并行
Phase 2（SmartBI，与 Phase 3 并行，互不依赖）
    ↓
Phase 4（Embedding，最后，Phase 3 的语义匹配依赖它）
```

---

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| Java 工具执行 API 成为新瓶颈 | 工具执行本身 50-200ms，HTTP 跳转 +50ms，可接受 |
| Python 意图识别准确率下降 | Phase 3 先跑 A/B：Java 和 Python 并行，对比准确率再切流量 |
| SmartBI 鉴权漏洞 | Phase 2 鉴权先于功能，单独验证后才切 nginx |
| LLM fallback 延迟增加 | llm_router 已有熔断器，最坏增加 50ms HTTP 跳转 |
| cretas_db 双写问题 | Phase 3 过渡期 Python 只读 cretas_db，写操作全走 Java API |

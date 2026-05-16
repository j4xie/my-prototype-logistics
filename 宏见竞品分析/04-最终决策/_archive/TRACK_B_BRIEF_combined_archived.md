# Track B — AI 钉钉 + 抄码品 + PDF 扫码 RN (Chat 3)

> **本文件是 self-contained brief**: 你 (接收方 chat) 不需要任何额外的 conversation context, 读完这份文件即可立即上手干活。所有路径都是绝对路径; 所有参考文档都标了 §节号; 所有客户原话都有引用来源。

---

## §1 项目 onboarding (你必须先读)

### 1.1 Cretas 是什么

**Cretas 食品溯源系统** (白垩纪) 是一套食品工厂 + 中央厨房的全栈业务系统:

| 组件 | 技术栈 | 端口 |
|---|---|---|
| 后端 | Java 21 + Spring Boot 3.2.12 + PostgreSQL + JPA Hibernate 6 | 10010 (prod) / 10011 (test) |
| 前端 | React Native (Expo 53+) + TypeScript + React Navigation 7 | 3010 (dev) |
| AI 服务 | Python FastAPI + LLM (Aliyun A/B / ZhipuAI / DeepSeek 4-provider 路由) | 8083 (prod) / 8084 (test) |
| 向量嵌入 | Java gRPC + ONNX | 9090 |
| DB | PostgreSQL 主库 `cretas_prod_db` / SmartBI 库 `smartbi_prod_db` | 5432 |

**项目状态**: Phase 3 核心完成 (~82-85%)。337+ AI Tool / 16 Skill / 51 测试意图。

### 1.2 你的客户场景

**客户**: **六扇门 (F006)** — 卤制品工厂, 沪上小有名气的卤味连锁品牌。

**deadline**: ASAP 1.5 个月 (约 6 周) 交付 P0 修复 + 战略级新功能。客户是六扇门, 优先级最高。

**你的角色**: 4 个并行 chat 中的 **Track B** (Chat 3), 负责:
- **C-AI-1 钉钉机器人 PoC** (6d) — 六扇门战略级需求 (第二次会议提了 N 次)
- **W-ABA-1 抄码品识别** (2d) — 卤制品行业刚需 (牛肉每箱重量不一)
- **Bug 修: PDF 扫码 RN 端串通** (4d) — 仓管员 UX 闭环

**总工时**: 12 人天名义 / Claude 加速 ~7-8 工作日。

### 1.3 跟其他 Chat 的关系

| Track | Chat | 焦点 | 跟你的依赖 |
|---|---|---|---|
| **A** | Chat 2 | Canvas 死代码修复 | 不依赖 |
| **B** (你) | Chat 3 | AI 钉钉 + 抄码 + PDF 扫码 | — |
| **C** | Chat 4 | 通用 Attachment + 打印 + 三价 + RBAC | **Day 11 后 import 通用 attachment** (拍照附件) |
| **D** | Chat 5 | BOM + 工序 + 生产 bug | 不依赖 |

**Organizer**: Chat 1 — 协调 + PR review + 合并。你完成一项 PR 一次, 等 organizer review + merge。

---

## §2 任务范围与工时

### 2.1 三个项目的优先级 + 客户驱动

| 编号 | 名称 | 工时 | 客户原话来源 | 优先级 |
|---|---|---|---|---|
| **C-AI-1** | 钉钉机器人 PoC (Webhook 双向接入 AIChat) | **6d** | 六扇门第二次会议 (多处) | **P0 战略级** |
| **W-ABA-1** | 抄码品识别 (raw_material_types 扩展) | **2d** | 六扇门第三次 part1 §1.2 抄码品 | **P0 业务级** |
| **Bug 修** | PDF 扫码 RN 端 → 入库 (PR #413 后端已 ship) | **4d** | 六扇门第三次 part2 §2 PDF 扫码闭环 | **P0 流程级** |

**Claude 加速预期**: 名义 12d → 实际 ~7-8 工作日 (1.5-1.7x)。

### 2.2 为什么这 3 项被打包给同一个 chat

- 钉钉机器人 = AIChat 链路的新入口, 你必须对现有 AIChat 链路熟悉
- 抄码品涉及 material 模块 + AI Tool 扩展 (`material_mark_abaca` Tool 新加), 跟钉钉路由有关
- PDF 扫码 RN 是采购入库流程闭环, 跟抄码品入库场景**强相关** (抄码品入库就走 PDF 扫码 → 称重 → 多次称重日志)

### 2.3 战略价值

- **钉钉机器人**: 六扇门客户原话:*"我们出了微信就是钉钉在用嘛, 日常跟系统去交互, 用钉钉也比较方便"* — 钉钉是六扇门战略入口, 客户希望从钉钉群直接 @ 机器人查库存/查订单/触发 AI 分析
- **抄码品**: 卤制品行业天然属性 (牛肉/猪肉每箱重量不一), 不做这个客户无法采购下单
- **PDF 扫码**: 客户原话:*"做仓管的他年纪都比较大文化素质很低"* — 老员工 UX, 扫一下 PDF → 跳到入库页 → 录 2 字段 → 完成。这是六扇门核心入库流程

---

## §3 文件 Ownership (你能改 vs 不能改)

### 3.1 你拥有的目录/文件 (随便改)

| 路径 | 用途 | 状态 |
|---|---|---|
| `backend/java/cretas-api/src/main/java/com/cretas/aims/service/dingtalk/` | **NEW** 钉钉模块 (你新建) | 不存在, 你建 |
| `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/integration/DingtalkWebhookLog.java` | **NEW** 钉钉日志实体 | 不存在, 你建 |
| `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/integration/DingTalkWebhookController.java` | **NEW** 钉钉 Controller | 不存在, 你建 |
| `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/material/MaterialMarkAbacaTool.java` | **NEW** 标记抄码品 Tool | 不存在, 你建 |
| `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/material/AbacaWeightLogTool.java` | **NEW** 称重日志 Tool | 不存在, 你建 |
| `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/warehouse/AbacaQuantityLog.java` | **NEW** 抄码称重日志实体 | 不存在, 你建 |
| `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/RawMaterialType.java` | **EXTEND** 加 3 个抄码字段 | 已存在, 你扩 |
| `backend/java/cretas-api/src/main/resources/db/migration/V20260516_01__abaca_dingtalk.sql` | **NEW** Flyway migration | 不存在, 你建 |
| `frontend/CretasFoodTrace/src/screens/shared/LabelScanScreen.tsx` | **EXTEND** 扫码后路由 (现有 OCR 标签扫描扩展为支持 PDF QR 跳转入库) | 已存在 (240+ 行), 你扩 |
| `frontend/CretasFoodTrace/src/screens/warehouse/shared/WHScanOperationScreen.tsx` | **EXTEND** 入库 2 字段页 | 已存在, 你扩 |

### 3.2 你不能改的 (共享只读, 改必先 ping organizer)

- `backend/.../entity/BaseEntity.java` (全局基类, 改了影响所有 entity)
- `backend/.../service/impl/IntentExecutorServiceImpl.java` (AIChat 编排核心, 改了影响所有意图)
- `frontend/.../services/api/aiApiClient.ts` (AIChat SSE 客户端, 改了影响所有 AI 调用)
- `CLAUDE.md` 项目规范文件
- Track A/C/D 的目录:
  - Track A: `frontend/.../screens/lowcode/` + `backend/.../service/impl/DecorationServiceImpl.java` + `ai/tool/impl/pagedesign/` + `ai/tool/impl/decoration/`
  - Track C: `backend/.../entity/Attachment.java` + `backend/.../service/attachment/` + `frontend/.../screens/smartbi/` + `ai/tool/impl/finance/RBACAuditTool.java`
  - Track D: `backend/.../entity/bom/` + `backend/.../service/workprocess/` + `frontend/.../screens/management/MaterialSpecManagementScreen.tsx`

### 3.3 Git 策略

每个 track 独立 worktree + 独立 branch:

```bash
# 在主仓库目录运行
git worktree add ../my-prototype-logistics-track-b -b feature/asap-track-b-c-ai-1 main
cd ../my-prototype-logistics-track-b
```

Branch 命名: `feature/asap-track-b-{编号}` (如 `feature/asap-track-b-c-ai-1` / `feature/asap-track-b-w-aba-1` / `feature/asap-track-b-pdf-scan`)。

完成一项 PR 一次, 不要堆大爆炸 PR。

---

## §4 Day-by-Day 执行计划

### Day 1-6: C-AI-1 钉钉机器人 PoC

#### Day 1: 钉钉开放平台调研 + AIChat 链路熟悉

**晨 (3h)**: 钉钉开放平台注册
- 访问 https://open-dev.dingtalk.com/
- 用六扇门企业账号 (organizer 会提供 dingtalk_corp_id) 注册一个 **应用机器人** (内部应用类型)
- 拿到 `appKey` / `appSecret` / `corpId` — 这三个值写入 `backend/.../.env.test` 后用
- 拿到 webhook outgoing endpoint URL (我们的 Cretas 后端要暴露给钉钉) + 配置 webhook URL 为 `https://test.cretaceousfuture.com/api/dingtalk/webhook/inbound` (后面 nginx 路由)
- 阅读钉钉 webhook 协议 (Outgoing Webhook 的 HMAC SHA256 签名机制 + 消息格式)

**下午 (5h)**: 阅 AIChat 链路 (你不能改这条链路但必须懂)
- 必读: `宏见竞品分析/03-审计过程/AUDIT_Z_AICHAT_E2E.md` (8 步流程审计表)
- 关键文件:
  - 后端 SSE Controller: `backend/.../controller/AIIntentConfigController.java:254` — `POST /api/mobile/{factoryId}/ai-intents/execute/stream`
  - 后端 SSE 服务: `backend/.../service/execution/SseStreamingService.java:130`
  - 后端 Orchestrator: `backend/.../service/execution/IntentExecutionOrchestrator.java:161`
  - 后端意图识别: `backend/.../service/impl/AIIntentServiceImpl.java:288`
- 你的钉钉模块 = AIChat 的**另一个入口** (前端 React Native AIChatScreen 是入口 A, 钉钉群是入口 B), 复用所有 Tool/Skill/SSE 编排

**Day 1 产出**:
- 钉钉应用机器人注册完成, 拿到 appKey/appSecret
- `docs/track-b/dingtalk-poc-notes.md` (你的笔记, 不需要 commit)

#### Day 2: 钉钉日志实体 + Flyway migration + Inbound Controller

**晨 (4h)**: 新建 entity + DDL
- 新建 `backend/.../entity/integration/DingtalkWebhookLog.java` (DDL 与 entity 完整 spec 在 `01-客户档案/SCHEMA_DESIGN.md` §2.4, 直接 copy + 适配 imports)
  - 关键字段: `id` (BIGSERIAL PK), `factoryId`, `direction` (INBOUND/OUTBOUND), `messageType`, `dingtalkCorpId`, `dingtalkChatId`, `dingtalkUserId`, `dingtalkUserName`, `dingtalkMessageId`, `webhookUrl`, `messageContent` (TEXT), `messagePayload` (JSONB), `isSensitive`, `userId`, `aiAuditLogId`, `intentCode`, `sessionId`, `status` (PENDING/SENT/DELIVERED/FAILED/IGNORED), `errorMessage`, `retryCount`, `nextRetryAt`, `receivedAt`, `deliveredAt`, `createdAt`, `updatedAt`
  - **不继承 BaseEntity** — 审计日志只读, 不软删
  - JSONB 用 `@Type(JsonBinaryType.class)` 处理 (项目已有依赖 `hypersistence-utils-hibernate-63`)
- 新建 Flyway migration `backend/.../db/migration/V20260516_01__abaca_dingtalk.sql` — 含 DingtalkWebhookLog 表 DDL + abaca 字段扩展 (W-ABA-1 一起放进去, 减少 migration 数)
  - DDL 完整 copy from `SCHEMA_DESIGN.md` §2.4
- 新建 `backend/.../repository/DingtalkWebhookLogRepository.java` (extends JpaRepository<DingtalkWebhookLog, Long>)
  - 需要的 query: `findBySessionId` / `findByStatusAndNextRetryAtBefore` (重试用)

**下午 (4h)**: 新建 Controller
- 新建 `backend/.../controller/integration/DingTalkWebhookController.java`
- 实现 `POST /api/dingtalk/webhook/inbound` (公开端点, **不走 JWT auth**, 但**必须 HMAC SHA256 校验签名**)
  - 请求体: `{ "msgtype": "text", "text": {"content": "..." }, "senderNick": "...", "senderId": "...", "senderCorpId": "...", "conversationId": "...", "msgId": "..." }`
  - 签名校验: 从 header 取 `timestamp` + `sign`, 用 appSecret 计算 HMAC SHA256, 对不上返回 401
  - 校验通过: 写 Redis 队列 `dingtalk:inbound:{factoryId}` (用现有 `CacheService.java`) + 立即返回 200
- 阻塞 ack 不超过 3s (钉钉超时), 实际处理走异步

**Day 2 产出**:
- DingtalkWebhookLog entity + Repository
- Flyway migration V20260516_01 (含钉钉日志表 + abaca 字段)
- DingTalkWebhookController (Inbound endpoint + 签名校验)

#### Day 3: 适配 webhook payload → 调 AIChat 流式

**晨 (4h)**: Inbound 异步消费器
- 新建 `backend/.../service/dingtalk/DingTalkInboundConsumer.java`
- `@Scheduled(fixedDelay = 5000)` 每 5s 消费 Redis 队列
- 取出消息后:
  1. 写 `dingtalk_webhook_logs` (direction=INBOUND, status=PENDING)
  2. 根据 `senderId` 在 `users` 表查到 Cretas userId (基于 `dingtalk_user_id` 双向绑定字段, 这个字段也要在 V20260516_01 给 users 表加一列 `dingtalk_user_id VARCHAR(100)`)
  3. 把 message text + factoryId + userId 转成 `IntentExecuteRequest`
  4. 调 `aiIntentService.recognizeIntentWithConfidence` → `intentExecutorService.execute(request)` (**注意: 用 non-streaming 版本**, 不要用 SSE; 钉钉群是单次问答场景, 不需要逐 token 推送)
  5. 拿到 `IntentExecuteResponse` 后, 走 §Day 4 出方向

**下午 (4h)**: 单元测试
- `DingTalkWebhookControllerTest.java` — 测签名校验通过 / 失败 / Redis 入队
- `DingTalkInboundConsumerTest.java` — 测消费 → 路由到 AIIntentService → 写日志

**Day 3 产出**:
- Inbound 消费器 (消息从钉钉到 AIChat 完整链路)
- 2 个单测

#### Day 4: 双向 — AIChat 结果 → 回钉钉 + AIInsightCard 推送

**晨 (4h)**: Outbound Service
- 新建 `backend/.../service/dingtalk/DingTalkSendService.java`
- `sendToGroup(corpId, chatId, message)` 方法
- 调用钉钉群 webhook URL (使用 outgoing webhook 的 access_token 模式)
- 写 `dingtalk_webhook_logs` (direction=OUTBOUND, status=PENDING) → 发送成功 status=SENT → 收到钉钉回执 status=DELIVERED
- 失败: status=FAILED + nextRetryAt = now + 60s * 2^retryCount (指数退避, 最多 10 次)
- 限流: 钉钉群 20条/分钟, 用 Redis token bucket (`CacheService`) 限速

**下午 (4h)**: 接 AIInsightCard 推送
- 新增 Tool: `backend/.../ai/tool/impl/system/DingTalkSendMessageTool.java` (绑定 intent `DINGTALK_SEND_MESSAGE`)
- 新增 Tool: `backend/.../ai/tool/impl/system/DingTalkAlertPushTool.java` (绑定 intent `DINGTALK_ALERT_PUSH`)
- 这些 Tool 通过 SkillExecutor 被现有 Skill (如 `inventory-analysis`) 触发, 自动把异常告警推到钉钉群
- Tool 实现里调 `dingTalkSendService.sendToGroup(...)`

**Day 4 产出**:
- DingTalkSendService (出方向 + 重试 + 限流)
- 2 个新 Tool (Send + Alert Push)
- 接入 AIInsightCard 触发链路

#### Day 5: 错误处理 + 重试 + 集成测试

**晨 (4h)**: 重试 Cron + 日志查询 endpoint
- 新建 `DingTalkRetryScheduler.java` (`@Scheduled(fixedRate = 30000)` 每 30s 扫一次 FAILED 且 nextRetryAt < now 的日志, 重试发送)
- 实现剩余 4 个 API endpoint (per `SCHEMA_DESIGN.md` §2.4 API 契约表):
  - `POST /api/mobile/{factoryId}/dingtalk/send` (主动推送)
  - `GET /api/mobile/{factoryId}/dingtalk/logs` (审计日志查询, 权限 `ai:audit:view`)
  - `GET /api/mobile/{factoryId}/dingtalk/logs/{id}`
  - `POST /api/mobile/{factoryId}/dingtalk/logs/{id}/retry`

**下午 (4h)**: 集成测试
- 启动本地后端 (`mvn spring-boot:run`, 不要 `java -jar` — 见 CLAUDE.md §server-operations 注 11)
- 用 Postman 模拟钉钉发 webhook → 验证 inbound 消费 → AIChat 路由 → outbound 回复
- 验证 AIInsightCard 触发 → 自动推送到钉钉群
- 失败场景: 钉钉群不可达 → 重试 3 次 → 最终 FAILED

**Day 5 产出**:
- 重试调度器 + 4 个剩余 API endpoint
- 集成测试通过 (本地)

#### Day 6: E2E + PR

**晨 (4h)**: 部署到 test 环境
- 用 `./scripts/deploy/deploy-backend.sh --env test` 部署 (CLAUDE.md §server-operations §"部署规范" — **必须用脚本, 不要手动 rsync**)
- 配置钉钉应用的 outgoing webhook URL 为 `https://test.cretaceousfuture.com/api/dingtalk/webhook/inbound`
- 在六扇门钉钉测试群里 @ 机器人:*"查询今天的生产任务"* → 验证回复
- 验证 AIInsightCard → 钉钉群异常告警

**下午 (4h)**: PR
- PR 标题: `[Track-B] C-AI-1 钉钉机器人 PoC (Webhook 双向接入 AIChat)`
- PR body 写:
  - 涉及文件清单 (entity / repo / controller / service / scheduler / tool / migration)
  - 测试方式 (本地 Postman + test 环境真实钉钉群)
  - 风险点 (钉钉签名密钥不能 leak / 重试 10 次后放弃可能漏告警 / 高并发未压测)
  - Phase 2 留待: rate limit production-grade / 多租户钉钉配置管理 / 钉钉 Card 富消息渲染
- ping organizer review

**Day 6 产出**:
- PR 提交并通过 review
- test 环境真实跑通

### Day 7-8: W-ABA-1 抄码品识别

#### Day 7: raw_material_types 扩展 + 数据初始化

**晨 (4h)**: Entity 扩展 + Tool 新增
- 编辑 `backend/.../entity/RawMaterialType.java` 加 3 个字段:
  ```java
  @Column(name = "is_abaca_packaging", nullable = false)
  private Boolean isAbacaPackaging = false;

  @Column(name = "abaca_unit_per_box", length = 20)
  private String abacaUnitPerBox;  // 如 "约 10-15kg/箱"

  @Column(name = "abaca_default_unit", length = 20)
  private String abacaDefaultUnit;  // 如 "kg" / "g"
  ```
- DDL 已在 Day 2 的 V20260516_01 包含 (`ALTER TABLE raw_material_types ADD COLUMN ...`)
- 新建 `backend/.../entity/warehouse/AbacaQuantityLog.java` (完整 spec 在 `SCHEMA_DESIGN.md` §2.1 entity, 直接 copy)
- 新建 3 个 Tool (per `SCHEMA_DESIGN.md` §2.1 AIChat Tool 建议):
  - `MaterialMarkAbacaTool.java` (intent `MATERIAL_MARK_ABACA`) — 标记原料为抄码品, supportsPreview() = true
  - `AbacaWeightLogTool.java` (intent `ABACA_WEIGHT_LOG`) — 记录单箱称重
  - `AbacaWeightSummaryTool.java` (intent `ABACA_WEIGHT_SUMMARY`) — 查询批次称重汇总

**下午 (4h)**: 数据初始化 + Service
- 新建 `AbacaQuantityLogRepository.java` + `AbacaQuantityLogService.java` (单/批量新增 + 复核双签 + 软删)
- 新建 Controller `MaterialAbacaController.java` 实现 6 个 endpoint (per SCHEMA_DESIGN.md §2.1 API 契约):
  - `GET /api/mobile/{factoryId}/material/abaca-log?batchId={id}`
  - `GET /api/mobile/{factoryId}/material/abaca-log/{id}`
  - `POST /api/mobile/{factoryId}/material/abaca-log`
  - `POST /api/mobile/{factoryId}/material/abaca-log/batch`
  - `PUT /api/mobile/{factoryId}/material/abaca-log/{id}/verify`
  - `DELETE /api/mobile/{factoryId}/material/abaca-log/{id}`
- 在 V20260516_01 migration 末尾**加 seed**: 把六扇门 F006 工厂里**牛肉/猪肉/鸭肉**3 种 raw_material_type 标记 `is_abaca_packaging = TRUE` (organizer 会提供具体 material code, 假设是 `RAW_BEEF` / `RAW_PORK` / `RAW_DUCK`)
- 注册 3 个 intent 到 `ai_intent_config` 表 (per CLAUDE.md §ai-intent-tool-skill-architecture.md "添加新 Tool 的步骤" §2)

**Day 7 产出**:
- raw_material_types 加 3 字段 (entity + DDL)
- abaca_quantity_log 表 + entity + repo + service + controller (6 endpoint)
- 3 个 Tool 注册到 ToolRegistry
- 3 个 intent 写入 ai_intent_config

#### Day 8: 前端 — 采购单创建时 if 抄码=true → 隐藏箱数 + PR

**晨 (4h)**: 前端采购单适配
- 找到采购单创建页 (`frontend/.../screens/procurement/CreatePurchaseOrderScreen.tsx` 或类似)
- 用 grep `'抄码'` 找已有抄码逻辑 (Track A/B/C/D 之前可能已经在某处零散处理), 必要时统一
- **规则: spec exact match `=== '抄码'` (不用 includes, 避免误报)**
  - 客户原话:*"有些规格其实是抄码的, 每箱的规格是不一样的"*
  - 关联 memory: `reference_abaca_term.md` (Whisper 易转写"超码"; spec exact match `=== '抄码'` 含 trim)
- 逻辑:
  - 用户选择原料 → fetch RawMaterialType → 检查 `isAbacaPackaging`
  - 如果 `isAbacaPackaging === true`: 采购单创建表单**隐藏箱数字段** (UI 显示 "本品为抄码品, 入库时按实际称重")
  - 如果 `规格` 字段值 `=== '抄码'` (字符串精确匹配, 兼容旧数据没有 isAbacaPackaging 时): 也隐藏箱数

**下午 (4h)**: 联调 + PR
- 本地启动 RN (`npm start` in `frontend/CretasFoodTrace`)
- 联调本地后端 + 前端
- PR 标题: `[Track-B] W-ABA-1 抄码品识别 (raw_material_types 扩展 + UI 隐藏箱数)`
- PR body:
  - 涉及文件: entity / migration / repo / service / controller / tool / RN 采购页 / RN 原料编辑页 (允许 admin 标记 isAbacaPackaging)
  - 测试: 创建抄码品采购单 → 箱数不显示; 创建普通原料 → 箱数正常显示
  - 风险: 旧数据 isAbacaPackaging 默认 FALSE, 不影响存量原料; UI 用 `=== '抄码'` 兜底防漏标
- ping organizer review

**Day 8 产出**:
- W-ABA-1 PR 提交并通过 review

### Day 9-12: Bug 修 — PDF 扫码 RN 端串通

#### Day 9: 阅 PR #413 后端 + 协议设计

**晨 (4h)**: 阅后端 PDF + QR 协议
- 必读: `backend/.../service/inventory/impl/PurchaseOrderPdfServiceImpl.java`
- 关键代码段 (line 110-138):
  ```java
  // Code128 一维条码 — 扫码枪 / 仓管员手机摄像头识别
  Barcode128 code128 = new Barcode128();
  code128.setCode(barcodeValue);  // barcodeValue = order.getOrderNumber()
  ...
  // QR 二维码 (供 RN App 扫码识别, v2 启用)
  BarcodeQRCode qrCode = new BarcodeQRCode(barcodeValue, 1, 1, null);
  ```
- **协议**: PDF 上 QR 内容 = **采购订单号** (如 `PO-20260514-001`), **不是 JSON 也不是 URL**, 纯文本订单号
- 仓管员扫 QR → RN 拿到字符串 → 调 `GET /api/mobile/{factoryId}/purchase-orders/by-number/{orderNumber}` → 返回订单详情 + 关联的 material_batches
- 如果同一个采购单已经分多次收货, 跳到**新建收货单**页面 (订单已 fetch 自动 prefill)

**下午 (4h)**: 看现有 RN 扫码流
- 必读: `frontend/.../screens/shared/LabelScanScreen.tsx` (1-240 行)
  - 现状: 这是**标签 OCR 扫描** (拍照 → API 验证标签), 不是 QR 扫描
  - 你需要**扩展**它支持 QR mode: 增加 `scanMode: 'OCR' | 'QR'` 参数, QR mode 用 `expo-barcode-scanner` 或 `expo-camera` 的 BarcodeScannerView
- 必读: `frontend/.../screens/warehouse/shared/WHScanOperationScreen.tsx` (这是仓管员扫码入口, 你要扩展)
- 必读: 现有的入库单页面 (用 grep 找 `InboundOrder` 或 `ReceiptOrder` 相关 Screen)

**Day 9 产出**:
- PR #413 后端 PDF QR 协议笔记
- RN 现有扫码流分析笔记
- 决定: LabelScanScreen 扩展 vs 新建 PDFScanScreen
  - 推荐: **LabelScanScreen 加 scanMode 参数**, 复用已有摄像头权限 + UI 框架, 不引入新 Screen

#### Day 10: RN 扫码 PDF QR → 解析 → 跳入库页

**全天 (8h)**: LabelScanScreen 扩展 + 路由
- 给 `LabelScanScreen` 加 `scanMode: 'OCR' | 'QR'` (默认 `'OCR'` 保持向后兼容)
- QR mode 用 `expo-camera` 的 `<CameraView onBarcodeScanned={...} barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128'] }} />`
  - **同时支持 QR 和 Code128** (PDF 上两种都有, 客户扫哪个都行)
- 扫到内容:
  1. 调 `GET /api/mobile/{factoryId}/purchase-orders/by-number/{orderNumber}` (Track C 的采购单 controller, 已存在; 如果接口不存在, ping organizer 找 Track C 加)
  2. 拿到订单 + 关联的供应商 / 货品明细
  3. `navigation.navigate('WHReceiptCreate', { purchaseOrderId, prefilledItems })`
- 在 navigation stack 注册 `WHReceiptCreate` route (位置: `frontend/.../navigation/WarehouseStack.tsx` 或类似)

**Day 10 产出**:
- LabelScanScreen 加 QR mode (240 行 → ~340 行)
- 扫码 → 调 API → 跳路由完整链路打通

#### Day 11: 入库页只 2 字段 (数量 + 日期)

**全天 (8h)**: 新建 / 改造入库收货页
- 找到现有的入库收货 Screen (grep `WHReceiptCreate` 或 `ReceiptCreate`), 评估是否需要新建
- **设计原则** (六扇门第三次会议 part 2):*"做仓管的年纪都比较大文化素质很低... 仓管员任务很简单就是核对数量核对商品日期这两个"*
- UI:
  ```
  [扫码进入]
  ┌────────────────────────────────┐
  │ 采购订单: PO-20260514-001       │
  │ 供应商: 北京黑飞熊有限公司       │
  │ ──────────────────────────────  │
  │ 货品 1: 牛肉 / 规格: 抄码        │
  │   收货数量: [____________] kg   │  ← 抄码品: 用户输入实际重量 (kg)
  │   商品日期: [2026-05-14   ▼]   │
  │ ──────────────────────────────  │
  │ 货品 2: 大葱 / 规格: 5kg/箱     │
  │   收货数量: [____________] 箱   │  ← 普通品: 用户输入箱数
  │   商品日期: [2026-05-14   ▼]   │
  │ ──────────────────────────────  │
  │ [签名] [拍照附件] [提交]         │
  └────────────────────────────────┘
  ```
- **仅 2 个必填字段** (数量 + 日期), 其他全部 prefill 自订单
- 抄码品 (isAbacaPackaging=true): 数量单位用原料默认单位 (`abacaDefaultUnit`), 提交后**对每个抄码品自动创建 1 条 abaca_quantity_log** (boxIndex=1, actualWeight=用户输入值)
  - 如果一个抄码品要分多次称重, 后续可在抄码品详情页继续 append (Day 7 的 batch API)
- 提交 API: 调现有的 `POST /api/mobile/{factoryId}/inbound/receipts` (如果不存在, 用 `POST /api/mobile/{factoryId}/material/batches`)

**Day 11 产出**:
- 入库收货 Screen (新建或扩展) — 仅 2 字段
- 抄码品/普通品分支自动处理

#### Day 12: 拍照集成 (依赖 Track C) + PR

**晨 (4h)**: 拍照附件接入
- **强依赖**: Track C 的通用 Attachment 系统 (Day 5+ 应该已 ready)
- 检查 organizer 状态: ping 一句"Track C attachment 接口 ready 吗?"
- 如果 ready: import `attachment` 组件, 在入库页加 "拍照附件" 按钮 → 触发拍照 → 上传到 Attachment service → 关联到 receipt
- 如果未 ready: PR 提交时把"拍照附件"标 TODO, 留 Phase 2 接入 (告诉 organizer 在 STATUS 里)

**下午 (4h)**: PR
- PR 标题: `[Track-B] Bug 修 PDF 扫码 RN 端 (扫 QR → 入库页 → 2 字段提交)`
- PR body:
  - 涉及文件: LabelScanScreen (+QR mode) / WHReceiptCreate (新建/扩展) / 路由配置
  - 测试: 模拟扫 PR #413 生成的 PDF QR → 跳入库页 → 输入数量+日期 → 提交 → 验证后端创建 material_batches + abaca_quantity_log (如果是抄码品)
  - 风险:
    - 摄像头权限申请: iOS 必须在 Info.plist 加 NSCameraUsageDescription
    - 多次扫码: 同一 PDF 扫 2 次不应重复创建批次 (后端要去重: 同 orderNumber + 同日期 + 同操作员 24h 内幂等)
    - 离线场景: 仓库网络不稳, 提交失败要排队重试 (Phase 2 留待)
  - Phase 2 留待: 拍照附件 (等 Track C) / 离线队列 / 仓管员人脸识别签字

**Day 12 产出**:
- Bug 修 PDF 扫码 PR 提交
- 完整 Day 1-12 总结发给 organizer

---

## §5 关键参考文档清单

| 文档绝对路径 | 用途 | 必读 § |
|---|---|---|
| `C:\Users\Steve\my-prototype-logistics\宏见竞品分析\01-客户档案\SCHEMA_DESIGN.md` | 9 张表完整 DDL + Entity + API spec | **§2.1 抄码品 / §2.4 钉钉日志** |
| `C:\Users\Steve\my-prototype-logistics\宏见竞品分析\01-客户档案\六扇门第二次.md` | 客户钉钉机器人战略需求 | 全文 (~860 行) |
| `C:\Users\Steve\my-prototype-logistics\宏见竞品分析\01-客户档案\六扇门第三次-May7-part1.md` | 客户抄码品需求原话 | §1.2 抄码品识别 |
| `C:\Users\Steve\my-prototype-logistics\宏见竞品分析\01-客户档案\六扇门第三次-May7-part2.md` | 客户 PDF 扫码闭环 + 仓管员 UX 哲学 | §2 PDF 扫码 + §3 RBAC 角色分离 |
| `C:\Users\Steve\my-prototype-logistics\宏见竞品分析\03-审计过程\AUDIT_Z_AICHAT_E2E.md` | AIChat 8 步流程审计 (你的钉钉机器人是 AIChat 的另一个入口) | 全文 (~94 行) |
| `C:\Users\Steve\my-prototype-logistics\宏见竞品分析\04-最终决策\DISPATCH_OVERVIEW.md` | 4 track 协调总览 | §2 文件 Ownership / §4 STATUS / §5 PR |
| `C:\Users\Steve\my-prototype-logistics\CLAUDE.md` | Cretas 项目规范 (字段命名 / API / JWT / 部署) | §Architecture / §Key Patterns |
| `C:\Users\Steve\my-prototype-logistics\.claude\rules\ai-intent-tool-skill-architecture.md` | Tool-Skill 架构 (你新加 Tool 必读) | "添加新 Tool 的步骤" |
| `C:\Users\Steve\my-prototype-logistics\.claude\rules\database-entity-sync.md` | Entity ↔ DDL 同步规范 | BaseEntity 必需字段 / PG 注意事项 |
| `C:\Users\Steve\my-prototype-logistics\.claude\rules\field-naming-convention.md` | camelCase (Entity/TS) vs snake_case (DB) | 全文 |
| `C:\Users\Steve\my-prototype-logistics\.claude\rules\server-operations.md` | 部署 + systemd + 双环境规范 | 部署规范 + 双环境最佳实践 |
| `C:\Users\Steve\my-prototype-logistics\.claude\rules\concurrent-edit-safety.md` | 并发编辑安全 (你的 chat 跟 Track A/C/D 并行, 必看) | Rule 5b 安全 commit + Rule 5 commit 前 git status |
| `C:\Users\Steve\my-prototype-logistics\.claude\rules\CREDENTIAL-MANAGEMENT.md` | 凭证 (钉钉 appSecret 怎么存) | 必需环境变量 |
| `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\java\com\cretas\aims\service\inventory\impl\PurchaseOrderPdfServiceImpl.java` | PR #413 后端 PDF + QR 实现 | line 100-140 |
| `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\screens\shared\LabelScanScreen.tsx` | 现有 OCR 扫描 Screen (你要扩展) | 全文 |
| `C:\Users\Steve\my-prototype-logistics\.claude\rules\python-services-architecture.md` | Python 服务架构 (你的 LLM 调用通过 Java 调 Python, 仅了解) | 端口 + 路由前缀 |

**memory references**:
- `reference_abaca_term.md` — 抄码=食品行业称重商品标记 (Whisper 易转写"超码")
- `reference_f006_liutengmen_prod_accounts.md` — 六扇门 F006 16 个 prod 测试账号
- `feedback_test_before_prod_smartbi.md` — 改 Python/env/systemd 一律 `--env test` 先 (你的钉钉机器人也按这个走)
- `feedback_active_e2e_replaces_passive_soak.md` — 每阶段 cutover → smoke → active E2E 15-30min

---

## §6 接口契约 (跟其他 chat 协调的)

### 6.1 钉钉 webhook payload schema (Inbound)

钉钉发来的请求 body 示例:

```json
{
  "msgtype": "text",
  "text": { "content": "查询今天的生产任务" },
  "msgId": "msg_1234567890",
  "createAt": 1714723200000,
  "conversationType": "2",
  "conversationId": "cidXXXXXX==",
  "conversationTitle": "六扇门生产群",
  "senderId": "$:LWCP_v1:$XXXXX",
  "senderNick": "张三",
  "senderCorpId": "ding12345abc",
  "atUsers": [
    { "dingtalkId": "robotId", "staffId": "" }
  ]
}
```

**关键 headers** (用于签名校验):
- `timestamp`: 钉钉服务器毫秒时间戳
- `sign`: HMAC SHA256(appSecret, timestamp + "\n" + appSecret) base64

签名校验算法 (Java 伪代码):
```java
String stringToSign = timestamp + "\n" + appSecret;
Mac mac = Mac.getInstance("HmacSHA256");
mac.init(new SecretKeySpec(appSecret.getBytes(), "HmacSHA256"));
String expectedSign = Base64.getEncoder().encodeToString(mac.doFinal(stringToSign.getBytes()));
if (!expectedSign.equals(receivedSign)) throw new SecurityException("钉钉签名验证失败");
```

### 6.2 钉钉响应回写 schema (Outbound)

发回钉钉群的消息格式 (文本):

```json
{
  "msgtype": "text",
  "text": { "content": "今日生产任务: PO-20260514-001 牛肉 100kg (进行中)..." },
  "at": { "atUserIds": ["原 sender_id"] }
}
```

Markdown 格式 (推荐, AIChat 结果富文本):

```json
{
  "msgtype": "markdown",
  "markdown": {
    "title": "生产任务查询",
    "text": "### 今日生产任务\n- PO-001 牛肉 100kg ✅ 进行中\n- PO-002 大葱 50kg ⏳ 待开始"
  }
}
```

### 6.3 抄码品扩展不影响现有 API

`RawMaterialType` 加的 3 个字段是 **additive change** (新增可空字段), 现有所有读 `RawMaterialType` 的 API:
- 新字段默认值: `isAbacaPackaging=false` / `abacaUnitPerBox=null` / `abacaDefaultUnit=null`
- 老 RN 前端不读这 3 个字段时, JSON 多出几个字段被忽略, 不影响功能
- **backward compat 完整**: Track A/C/D 不需要任何改动

### 6.4 PDF QR 协议 (来自 PR #413)

QR 二维码内容 = **采购订单号字符串** (如 `PO-20260514-001`), 纯文本, 不是 JSON 也不是 URL。

理由: 仓管员手机扫码识别一个简单字符串最稳定, RN 解析无歧义, 后端用 orderNumber 反查 PO 一次即拿到所有信息。

### 6.5 跟 Track C attachment 的接口 (Day 11+ 接入)

Track C 的 Attachment 系统 API 假设 (per `SCHEMA_DESIGN.md` §2.3):
- `POST /api/mobile/{factoryId}/attachments/upload` — 上传文件, body 多部分 form-data
- `POST /api/mobile/{factoryId}/attachments/link` — 把 attachment 关联到业务实体, body `{ attachmentId, entityType: "INBOUND_RECEIPT", entityId, uploadSource: "MOBILE" }`

入库收货页拍照按钮触发:
```typescript
// Pseudo
const photo = await launchCamera();
const { attachmentId } = await uploadAttachment(photo);
await linkAttachment({ attachmentId, entityType: 'INBOUND_RECEIPT', entityId: receiptId, uploadSource: 'MOBILE' });
```

**Day 11 前**确认 Track C attachment 接口是否 ready, 没 ready 就 ping organizer。

---

## §7 PR / Status Update 流程

### 7.1 每日 Status 同步

每天结束时, 在 `C:\Users\Steve\my-prototype-logistics\宏见竞品分析\04-最终决策\STATUS\TRACK_B_STATUS.md` 追加 1 段:

```markdown
## Day N (YYYY-MM-DD)
- 完成: 钉钉应用注册 / 阅 AIChat 链路
- 进行中: DingtalkWebhookLog entity 草稿
- Blocker: 无 (或: 需要 organizer 提供六扇门钉钉 corpId)
- 明日计划: 完成 entity + Flyway migration + Controller 公开端点
```

如果文件夹 `STATUS/` 不存在, 第一天创建。

### 7.2 PR 流程

完成一项 → 推 PR 到 main:
1. **PR 标题**: `[Track-B] N# 编号 项目名` (例: `[Track-B] C-AI-1 钉钉机器人 PoC`)
2. **PR body 必含**:
   - 涉及文件清单 (列出所有新建/修改的文件路径)
   - 测试方式 (本地 + test 环境验证步骤)
   - 风险点 (已知 limitation)
   - Phase 2 留待 (砍出去的 scope)
3. **不要 squash 自己的 commit** — organizer review 时要看每个增量
4. **不要 force push** 到 main, 等 organizer admin merge

### 7.3 碰到 Blocker

立即在 STATUS 写 + ping organizer chat (Chat 1):
- "Track B Day X 卡在 Y, 需要协调 Z"
- 不要自己改其他 track 的目录解决

### 7.4 commit 规范 (并发安全)

每次 commit 必须用 `git commit -- <file1> <file2>` 形式锁定文件范围 (per `.claude/rules/concurrent-edit-safety.md` Rule 5b):

```bash
# ❌ 不安全
git add backend/foo.java backend/bar.java
git commit -m "feat: my change"

# ✅ 安全 — 只 commit 列出的文件, 即使别 chat staged 了其他文件
git commit -m "feat: my change" -- backend/foo.java backend/bar.java
```

如果项目根有 `scripts/safe-commit.sh`, 优先用它 (pre/post 自动 verify)。

---

## §8 不要做的事

1. **不要改其他 track 的目录**
   - Track A: `frontend/.../screens/lowcode/` + `backend/.../service/impl/DecorationServiceImpl.java` + `ai/tool/impl/pagedesign|decoration/`
   - Track C: `backend/.../entity/Attachment.java` + `backend/.../service/attachment/` + `frontend/.../screens/smartbi/` + `ai/tool/impl/finance/RBACAuditTool.java`
   - Track D: `backend/.../entity/bom/` + `backend/.../service/workprocess/` + `frontend/.../screens/management/MaterialSpecManagementScreen.tsx`

2. **不要 refactor AIChat 整体架构**
   - 你只是给 AIChat 加一个**入口** (钉钉 webhook), 不动 SseStreamingService / IntentExecutionOrchestrator / AIIntentService
   - 钉钉调用走**non-streaming** 路径 (`POST /execute`), 不要试图把 SSE 推到钉钉 (钉钉不支持 SSE)

3. **钉钉机器人是 PoC, 不做生产化**
   - 不做: production-grade rate limit (用简单 Redis token bucket 够了)
   - 不做: 多租户钉钉配置管理 (假设六扇门只 1 个钉钉 corp)
   - 不做: 钉钉 Card 富消息渲染 (Phase 2)
   - 不做: 钉钉用户 → Cretas user SSO 双向绑定 UI (假设 organizer 直接 INSERT 一条绑定记录)
   - 不做: 钉钉群限流容错 (超过 20/min 直接 drop, 不重排)

4. **不要硬编码钉钉 appSecret 在代码里**
   - per `.claude/rules/CREDENTIAL-MANAGEMENT.md`, 一律走环境变量 `DINGTALK_APP_KEY` / `DINGTALK_APP_SECRET` / `DINGTALK_CORP_ID`
   - test 环境的 secret 写在 `/www/wwwroot/cretas/.env.test` (organizer 会设)
   - prod 环境的 secret 写在 `/www/wwwroot/cretas/.env.prod`

5. **不要直接部署到 prod**
   - 默认 test-only deploy (per `feedback_default_test_only_deploy.md` HARD rule)
   - test 环境跑通 + 客户验证 + organizer 批准后, 才上 prod

6. **不要在 brief 没说的地方过度设计**
   - 如果某个 spec 不清, ping organizer 问, 不要自己拍脑袋扩展

---

## §9 验收清单 (12 天结束时必须满足)

### C-AI-1 钉钉机器人 PoC

- [ ] 钉钉应用机器人在六扇门 dingtalk 注册成功
- [ ] test 环境暴露 `/api/dingtalk/webhook/inbound` 公开端点 (HMAC 签名校验)
- [ ] 在六扇门钉钉测试群里 @ 机器人发"查询今天的生产任务" → 5s 内收到 AIChat 回复
- [ ] AIInsightCard 触发 (如库存告警) 自动推送到钉钉群
- [ ] 失败重试机制 work (网络抖动后 60s 内自动重发)
- [ ] 审计日志 endpoint 可查 (admin 能看历史消息)

### W-ABA-1 抄码品识别

- [ ] `raw_material_types` 表加 `is_abaca_packaging` / `abaca_unit_per_box` / `abaca_default_unit` 3 字段
- [ ] `abaca_quantity_log` 表新建, 含全部约束 (FK + CHECK)
- [ ] 3 个 Tool (`material_mark_abaca` / `abaca_weight_log` / `abaca_weight_summary`) 启动日志确认注册到 ToolRegistry
- [ ] 6 个 abaca-log API endpoint 全通 (GET list / GET 详情 / POST 单 / POST batch / PUT verify / DELETE)
- [ ] RN 采购单页面: 选择抄码品 → 箱数字段隐藏 (UI 提示 "本品为抄码品, 入库时按实际称重")
- [ ] 六扇门 F006 工厂的牛肉/猪肉/鸭肉 3 种原料已标记 isAbacaPackaging=true (seed data)

### Bug 修 PDF 扫码 RN

- [ ] RN LabelScanScreen 支持 QR mode (摄像头权限 + barcode scanner)
- [ ] 扫 PR #413 生成的 PDF QR → 拿到 orderNumber → 调 API 拿订单 → 跳入库收货页
- [ ] 入库收货页**仅 2 个必填字段** (收货数量 + 商品日期), 其他全部 prefill
- [ ] 抄码品: 数量字段 = 实际重量 (kg), 提交后自动写 abaca_quantity_log
- [ ] 普通品: 数量字段 = 箱数, 提交后写 material_batches
- [ ] 提交按钮工作: 后端创建 material_batches + (抄码品时) abaca_quantity_log
- [ ] 拍照附件接入 (依赖 Track C, 若 Track C 未 ready 则标 TODO Phase 2)

### 跨项目共同验收

- [ ] 所有 PR 通过 organizer review + merge 到 main
- [ ] test 环境部署成功, 健康检查通过 (`curl http://47.100.235.168:10011/api/mobile/health`)
- [ ] STATUS/TRACK_B_STATUS.md 12 天完整记录

---

## §10 客户场景对照 (你的工作怎么对应客户原话)

### 10.1 钉钉机器人 = 六扇门战略级需求

客户原话 (六扇门第二次会议):
- *"我们现在自己呢是用的一搭就是钉钉的一搭, 搭了一个简单的模块化的一个系统在用"* (line 17)
- *"比如说我们把它打到钉钉上, 然后我们所有员工在钉钉上跟他去交互, 嗯, 这样可能在这个交互过程中对他也是一个训练吧"* (line 85)
- *"我们现在出了微信就是钉钉在用嘛, 日常跟系统去交互, 用钉钉也比较方便"* (line 273)
- *"钉钉本身有应用机器人嘛, 然后应用机器人呢, 你可以给他开权限, 就是基本上那个系统里所有权限都能有"* (line 301)

**你的工作**: 让客户能从钉钉群 @ 机器人 → 拿到 AIChat 的能力 → 不用打开 RN App。这是六扇门战略入口, 不做这个客户上线就抗拒。

### 10.2 抄码品 = 卤制品行业刚需

客户原话 (六扇门第三次会议 part 1):
- *"有些规格其实是抄码的, 每箱的规格是不一样的"* (line 174)
- *"那你到采购这边箱数就不显示箱数了吗"* (line 64)
- *"哦这个箱数现在还写不了嘞"* (line 78, 客户测试时发现箱数 UI 没隐藏的痛点)

**你的工作**: 把"抄码"作为原料属性记录到数据库, 采购单创建时如果原料是抄码品则 UI 隐藏箱数字段, 入库时改成"按实际称重逐箱录入"。这是六扇门**第一个**采购单就要用的逻辑, 不做没法卖牛肉。

### 10.3 PDF 扫码 = 老员工 UX 哲学

客户原话 (六扇门第三次会议 part 2):
- *"做仓管的他年纪都比较大文化素质很低的"* (line 189)
- *"对于那个仓管员来说他的任务很简单就是我核对数量核对那个商品的日期这两个"* (line 186)
- *"其他的话就尽量少让那个仓管员去参与什么什么价格类的不要让他们去参与"* (line 188)
- *"采购入库啊扫描扫描那个上面调音码然后开始入库入库完以后双方签字拍张照然后就提交"* (line 180)

**你的工作**: 仓管员在 RN App 上扫一下 PDF (送货员带来的) → 跳到入库页 → 看着已 prefill 的订单只录"数量+日期"两个字段 → 拍照 → 提交。零学习曲线, 零文字输入压力, 让 50 岁文盲也能用。

---

## §11 元注意事项 (临走之前看一眼)

1. **每天结束时一定 push 到 origin** — 即使没做完, 也 commit + push (per `feedback_chat_must_push_before_clear.md` HARD rule)。本 chat 如果突然 /clear 或断线, organizer 可以从 origin 拉回你的 worktree commit。

2. **commit 前一定 `git status` 一次** — 检查 staging 区有没有别 chat 的文件 (per Rule 5)。每 commit 必须用 `git commit -- F1 F2` 锁定范围。

3. **不要用 `as any` 类型断言** — `.claude/rules/typescript-type-safety.md` 禁止, 用类型守卫。

4. **不要返回假数据降级** — `.claude/rules/api-response-handling.md` 核心原则, 错误必须显式抛出。

5. **字段命名严格 camelCase (Entity/TS) ↔ snake_case (DB)** — `.claude/rules/field-naming-convention.md`。

6. **JWT Token 必须 SecureStore 存储** — `.claude/rules/jwt-token-handling.md`。

7. **PostgreSQL 严格 GROUP BY** — `.claude/rules/database-entity-sync.md`, 所有 SELECT 非聚合列必须出现在 GROUP BY。

8. **遇到 PG `IS NULL` 参数类型推断错** — 用 `CAST(:param AS string)`, 不是 `:param IS NULL`。

9. **改 Python/env/systemd/Flyway/Entity/Hibernate** — 默认 test 环境验证 (`--env test`), 不要直接 prod (per `feedback_default_test_only_deploy.md` HARD)。

10. **本地启动 Java 后端用 `mvn spring-boot:run`** — 不要 `java -jar` (会 mmap 锁 fat jar 阻断 deploy)。

11. **client 端任何永久 URL** — 钉钉 webhook URL 必须用专属子域 (`api.cretaceousfuture.com` 或 `dingtalk.cretaceousfuture.com`), 不要直接给钉钉绑 IP (per `feedback_immutable_client_url_dedicated_subdomain.md` HARD)。

---

## §12 总结一句话

**你 (Chat 3 / Track B) 的工作 = 让六扇门客户能从钉钉群里 @ AI 机器人 (Day 1-6), 让卤制品工厂能采购抄码品 (Day 7-8), 让仓管员扫码 PDF 直接入库录 2 字段 (Day 9-12)。三个项目都是 P0, 12 天交付。**

读完这份 brief, 立即:
1. `git checkout main && git pull origin main`
2. `git worktree add ../my-prototype-logistics-track-b -b feature/asap-track-b-c-ai-1 main`
3. `cd ../my-prototype-logistics-track-b`
4. 开始 Day 1 (钉钉应用注册 + 阅 AIChat 链路)

干吧。

# Track B1 — 每日 STATUS

> **本文件**: Chat 3 (Track B1) 每天追加 1 段进度
> **Organizer 阅读**: Chat 1 每天读 + 协调跨 track 冲突

---

## Day 0 — 派发 (2026-05-14 18:14:12)

- 状态: 📤 **已派发 Brief, 等 Chat 3 启动**
- Brief 文件: `04-最终决策/TRACK_B1_BRIEF.md` (6d 工时)
- 收到 brief 后: Chat 3 应立即:
  1. 创建 git worktree + branch `feature/asap-track-b1`
  2. 读完 Brief §1-§11
  3. 启动 Day 1 任务
  4. 当天结束在本文件追加 Day 1 进度

---

<!-- Chat 3 启动后在下面追加 Day 1, Day 2, ... -->

## Day 1 — 启动 + 调研 (2026-05-14)

- ✅ **完成**:
  - 创建 worktree `../my-prototype-logistics-track-b1`, branch `feature/asap-track-b1-c-ai-1`, base HEAD `52f1b622d` (origin/main 同步)
  - 读完 Brief §1-§12 全文
  - 读完 `AUDIT_Z_AICHAT_E2E.md` 全文 (8步流程 + AIChat 4处架构正确局部漏接的状态)
  - 读完 `DISPATCH_OVERVIEW.md` (6 track 拆分, file ownership 表)
  - 读完 `SCHEMA_DESIGN.md §2.4` (`dingtalk_webhook_logs` DDL + JPA entity + API 契约 + INBOUND 异步流程图)
  - 扫了关键 AIChat 代码: `IntentExecutorServiceImpl` (Facade), `AIIntentConfigController.java:204` (`POST /execute` non-streaming 入口), `IntentExecuteRequest.java` (Builder), `CacheService.java` (Redis + 内存兜底)
  - 确认现有 `hypersistence-utils-hibernate-63` 依赖 (JsonBinaryType 已被 MaterialBatch 等 entity 使用 — 我可直接用)
  - 确认 V20260516_01 文件名无冲突 (现存最大 migration 是 V20260429_01)
  - 确认 `entity/integration/` 包不存在 (我新建)
- 🟡 **进行中**: 无 (Day 1 已完结, 切 Day 2)
- ❌ **Blocker handed off to Organizer**:
  - F006 钉钉 appKey / appSecret / corpId / 测试群 chatId — **Steve 已确认 Day 5/6 之前提供**, 期间我用占位 env var (`DINGTALK_APP_KEY=__PLACEHOLDER__`) 写代码 + HMAC stub 写单测
- ✅ **决策确认**:
  - **Inbound polling 间隔**: 5s (`@Scheduled(fixedDelay=5000)`), 而非 SCHEMA §2.4 line 917 的 "5min cron" — 后者对 chat UX 不可接受。Steve sign-off
  - **AIChat 调用**: 走 `IntentExecutorService.execute()` (non-streaming), 不复用 SSE — 钉钉群单次问答场景, 不需逐 token
- 📋 **明日计划 (Day 2)**:
  1. 新建 `entity/integration/DingTalkWebhookLog.java` (按 SCHEMA §2.4 spec, 含 Direction/Status enum + @PrePersist/@PreUpdate)
  2. 新建 `repository/DingtalkWebhookLogRepository.java` (含 `findBySessionId`, `findByStatusAndNextRetryAtBefore` query)
  3. 新建 Flyway migration `V20260516_01__abaca_dingtalk.sql` (dingtalk_webhook_logs 完整 DDL + 索引 + users 表加 `dingtalk_user_id` 列 + 文件末尾 留 abaca 注释占位给 B2)
  4. 新建 `controller/integration/DingTalkWebhookController.java` (`POST /api/dingtalk/webhook/inbound`, HMAC SHA256 校验, Redis 队列入队, ≤3s ack)
  5. ping organizer (Chat 1) + Track B2 同步: V20260516_01 头部已建, B2 可在 §abaca 区段追加

---

## Day 2 — 实体 + Migration + Inbound Controller (2026-05-14)

- ✅ **完成** (commit `5def64a2e`, 7 files, +613 lines):
  - `entity/integration/DingTalkWebhookLog.java` — JPA entity per SCHEMA §2.4, JSONB payload (`JsonBinaryType`), Direction/Status enum, `@PrePersist`/`@PreUpdate`, 5 `@Builder.Default` warnings fixed
  - `repository/DingTalkWebhookLogRepository.java` — `findByDingtalkMessageId` (dedup), `findBySessionIdOrderByReceivedAtAsc` (多轮), `findRetriable` (Day 5 retry sweep)
  - `db/flyway/V20260516_01__abaca_dingtalk.sql` — `dingtalk_webhook_logs` 完整 DDL + 6 索引 (factory_time/session/user/status_retry/ai_audit/payload GIN) + 3 CHECK; `users.dingtalk_user_id` 列 + 唯一索引 (供双向绑定); 文件末尾留 abaca 注释占位给 B2
  - `dto/dingtalk/DingTalkInboundPayload.java` — Outgoing-Webhook 入参 schema (msgtype/text/msgId/senderId/...)
  - `service/dingtalk/DingTalkSignatureService.java` — HMAC SHA256 校验, 1h 重放窗口, constant-time compare, **fails closed** 当 appSecret 未配置 (env `DINGTALK_APP_SECRET` 占位)
  - `service/dingtalk/DingTalkInboundQueue.java` — Redis FIFO (LPUSH/RPOP) + 内存 deque fallback (Redis 不可用时)
  - `controller/integration/DingTalkWebhookController.java` — `POST /api/dingtalk/webhook/inbound`; path **不在 JwtAuthInterceptor 拦截范围** (`WebMvcConfig:48` 只拦 `/api/mobile/**` / `/api/platform/**` / `/api/admin/**` / `/api/internal/**`) → 自动 public; HMAC 校验失败 → 401, 缺 msgId → 400, 队列失败 → 503; 成功 ack ≤3s, AIChat 调用走异步队列
  - **`mvnw compile` BUILD SUCCESS** (1m25s, 2346 source files)
  - Pre-commit hook 抓出 Flyway 路径错误: 项目用 `db/flyway/` 不是 `db/migration/` (一次性修正后过 hook)
- 🟡 **进行中**: 无 (Day 2 已完结, 切 Day 3)
- ❌ **Blocker handed off**:
  - 等 Steve 提供 F006 钉钉 appKey/appSecret/corpId/测试群 chatId (Day 5/6 之前即可)
  - **ping for Track B2 / organizer**: `V20260516_01__abaca_dingtalk.sql` 已建于 `db/flyway/`, 末尾留 `-- 下面由 Track B2 (Chat 6) 追加: abaca 字段...` 注释占位, B2 可在他们的 PR 里追加 DDL 不冲突
  - **未推 push** — 待 Steve 批准 (per `feedback_pause_before_deploy_or_push.md`)
- 📋 **明日计划 (Day 3)**:
  1. `service/dingtalk/DingTalkInboundConsumer.java` — `@Scheduled(fixedDelay=5000)` 消费 Redis 队列
  2. 消费逻辑: 写 INBOUND 日志 → 根据 `senderId` 在 `users.dingtalk_user_id` 解析 Cretas userId → 构造 `IntentExecuteRequest` (Builder) → 调 `intentExecutorService.execute()` (non-streaming) → 拿到 `IntentExecuteResponse` 暂存等 Day 4 outbound
  3. `DingTalkWebhookControllerTest.java` — 签名通过/失败/缺 msgId/队列失败 4 个 case
  4. `DingTalkSignatureServiceTest.java` — HMAC 计算正确性 / 时间戳漂移 / appSecret 空 / 常量时间比较
  5. `DingTalkInboundConsumerTest.java` — mock AIIntentService, 验证消费 → 路由 → 写日志

---

## Day 2 follow-up — shared migration split (commit `2ffe01dff`)

- `V20260516_01__abaca_dingtalk.sql` 改回 B1-only; B2 用独立 `V20260516_02__abaca.sql`
- 原因: Flyway checksum 每文件计算; B1 部署后 B2 追加 → 下次部署 checksum mismatch 阻塞 (需 `flyway repair` 手工恢复). 6 chat 并行 sprint 上协调"B1 不部署到 test, 等 B2" 太脆弱
- Steve approved
- 已 push origin `feature/asap-track-b1-c-ai-1`

---

## Day 3 — Inbound consumer + AIChat 路由 + 22 单测 (2026-05-14)

- ✅ **完成** (commit `c4daa2278`, 6 files, +778 lines):
  - `repository/DingTalkUserBindingRepository.java` — `findBoundUser(dingtalkUserId)` 走 native query, 返回 `DingTalkBoundUser` projection (userId/factoryId/roleCode/username). 独立 repo, 不动 `UserRepository` (避免修改高流量共享文件)
  - `service/dingtalk/DingTalkResponseFormatter.java` — `IntentExecuteResponse → 钉钉群文本回复`. fallback: `formattedText` > clarificationQuestions[0] > status-specific defaults (NOT_RECOGNIZED/NO_PERMISSION/FAILED) > message > "已完成"
  - `service/dingtalk/DingTalkInboundConsumer.java` — `@Scheduled(fixedDelayString="${dingtalk.inbound-poll-ms:5000}")` 每 5s 消费 1 batch (10 msgs/tick). 流程: dedupe via msgId → INBOUND PENDING → empty content 转 IGNORED → resolve user → 未绑定 写 INBOUND FAILED + OUTBOUND placeholder reply → 绑定 调用 `intentExecutorService.execute()` (non-streaming) → 成功 写 INBOUND DELIVERED + OUTBOUND PENDING with formattedText → AI 异常 写 INBOUND FAILED + OUTBOUND error reply
  - `test/.../DingTalkSignatureServiceTest.java` (10): valid/wrong/missing ts+sign/non-numeric ts/stale 1h/future 1h/unset secret/whitespace secret/deterministic
  - `test/.../DingTalkWebhookControllerTest.java` (6): 200 happy / 401 sig fail / 400 missing msgId / 400 blank msgId / 503 enqueue fail / 200 null factoryId
  - `test/.../DingTalkInboundConsumerTest.java` (6): happy 3-save / duplicate drop / empty IGNORED / unbound placeholder / AI exception / no-formattedText fallback
  - **`mvnw test` 22/22 PASS** (~2m03s)
- 🟡 **进行中**: 无
- 📝 **遇到的坑**:
  - 1) ArgumentCaptor 存的是同对象引用; production 代码 mutate 同一 entity 然后再 save → captor 全部 snapshot 显示最终状态 → test fail. 修法: Answer 里 deepCopy 入 snapshot list
  - 2) 用户配置: 已写好 `UNBOUND_USER_REPLY` 静态文案, 不需要 LLM 调用
- 📋 **Day 4 计划** (已开始): 出方向 `DingTalkSendService` + Tool + 限流

---

## Day 4 — 出方向 SendService + 限流 + 2 Tool (2026-05-14, commit `859a18e63`)

- ✅ **完成** (9 files, +1016 lines):
  - `service/dingtalk/DingTalkRateLimiter.java` — Fixed-window per-chat (Redis INCR + 90s EXPIRE + 内存兜底). 默认 20/min via `${dingtalk.rate-limit-per-minute:20}`
  - `service/dingtalk/DingTalkSendService.java` — `java.net.http.HttpClient` POST to DingTalk group webhook, 10s timeout. 状态机:
    - SENT on HTTP 200 + errcode=0
    - PENDING 保留 (限流时, Day 5 retry scheduler picks up)
    - FAILED + exp backoff (`60s × 2^retryCount` capped 1h, 重试 10 次)
    - IGNORED 重试 10 次后放弃 (DB CHECK 也 cap 10)
    - URL 签名 (`sign = URLEncode(Base64(HmacSHA256(secret, ts+"\n"+secret)))`) 当 `DINGTALK_OUTBOUND_WEBHOOK_SECRET` 配置时启用
    - 未配置 URL → NOT_CONFIGURED 返回, log 留 PENDING (无数据丢失)
  - `ai/tool/impl/system/DingTalkSendMessageTool.java` — Intent `DINGTALK_SEND_MESSAGE`. 必填 chatId/content, 可选 atUserId/messageType. 写 OUTBOUND PENDING + 调 send().
  - `ai/tool/impl/system/DingTalkAlertPushTool.java` — Intent `DINGTALK_ALERT_PUSH`. 必填 chatId/message, 可选 severity (INFO/WARN/CRITICAL default WARN) + source (Skill/Tool 名). Body 前缀 `[SEVERITY] [SOURCE]`. Used by AIInsightCard + threshold Skills.
  - 接 InboundConsumer: `writeOutboundReply` 后 inline `sendService.send(outbound)` 派发
  - 测试 (19 新增): DingTalkRateLimiterTest (3), DingTalkSendServiceTest (10), DingTalkToolsTest (6)
  - **`mvnw test -Dtest=DingTalk* ` 42/42 PASS** (~1m43s)
- 🟡 **进行中**: 无
- 📝 **遇到的坑**:
  - 1) Mockito strict mode: 全局 stub `save() → arg` 跨多个 test 用不到 → UnnecessaryStubbing 错误. 修: `lenient().when(...)`
  - 2) `ToolCall` 结构是 `{id, type, function: {name, arguments}}`, 不能直接 setField on top. 改用 `ToolCall.of(id, name, args)`
  - 3) AbstractTool.execute 必须 `userId` + `userRole` 在 context. 给 ctx() helper 加上
  - 4) buildSuccessResult 的输出结构是 `{success, data: {message, data: {...}}}` 双层 — test 取 sendResult 要 navigate `parsed.data.data`
- 📋 **Day 5 计划**:
  1. `DingTalkRetryScheduler` `@Scheduled(fixedRate=30000)` — 扫 FAILED + `nextRetryAt < now`, 重试 sendService.send()
  2. 4 admin endpoint: `POST /api/mobile/{factoryId}/dingtalk/send`, `GET /dingtalk/logs`, `GET /dingtalk/logs/{id}`, `POST /dingtalk/logs/{id}/retry` (权限 `ai:dingtalk:send` / `ai:audit:view`)
  3. 集成测试 (Postman 模拟钉钉) — 但需要本地后端跑起来, 可能放 Day 6 前

---

## Day 5 — Retry scheduler + 4 admin endpoint (2026-05-14, commit `529611399`)

- ✅ **完成** (4 files, +350 lines):
  - `service/dingtalk/DingTalkRetryScheduler.java` — `@Scheduled(fixedRateString="${dingtalk.retry-interval-ms:30000}")` 每 30s 扫 50 行 FAILED+`nextRetryAt<now` OUTBOUND, 重置 status=PENDING 再 dispatch send. 包了 try-catch 在 retryDue() — scheduler 不能挂.
  - `dto/dingtalk/DingTalkSendRequest.java` — `@NotBlank chatId/content` + 可选 atUserId/messageType
  - `controller/integration/DingTalkAdminController.java` — `/api/mobile/{factoryId}/dingtalk/*` 4 endpoints (自动走 `JwtAuthInterceptor` 因为 path 匹配 `/api/mobile/**`):
    - `POST /send` (perm `ai:dingtalk:send`)
    - `GET /logs?page=&size=` (perm `ai:audit:view`, page size 上限 200)
    - `GET /logs/{id}` (perm `ai:audit:view`, factoryId mismatch → 404)
    - `POST /logs/{id}/retry` (perm `ai:dingtalk:send`, 仅 OUTBOUND 可重试, INBOUND → 400)
  - `test/.../DingTalkRetrySchedulerTest.java` (4): noop empty / N due → reset+send / INBOUND skipped / scheduler swallows exceptions
  - **`mvnw test -Dtest=DingTalk* ` 46/46 PASS** (~1m19s)
- 🟡 **进行中**: 无 (Day 5 已完结)
- 📝 **遇到的坑**:
  - `ApiResponse.fail()` 不存在 — 项目用 `ApiResponse.error(String)` (signature inconsistent w/ many libs)
- 📋 **Day 6 (BLOCKED on Steve's credentials)**:
  - 需要 Steve 提供:
    - `DINGTALK_APP_KEY` (F006 钉钉应用)
    - `DINGTALK_APP_SECRET` (用于 inbound 签名校验)
    - `DINGTALK_CORP_ID` (六扇门企业 id)
    - `DINGTALK_OUTBOUND_WEBHOOK_URL` (群机器人 URL, 形如 `https://oapi.dingtalk.com/robot/send?access_token=XXX`)
    - `DINGTALK_OUTBOUND_WEBHOOK_SECRET` (群机器人独立 secret, 与 APP_SECRET 不同)
    - F006 测试群 conversationId (用于配置默认推送目标, 可选)
    - F006 钉钉用户 senderId(s) → Cretas userId 映射 (用于 `UPDATE users SET dingtalk_user_id=... WHERE id IN (..)`)
  - 部署: `./scripts/deploy/deploy-backend.sh --env test` (per CLAUDE.md, 默认 test-only)
  - 配置: 在六扇门 dingtalk 应用 console 设置 Outgoing Webhook URL = `https://test.cretaceousfuture.com/api/dingtalk/webhook/inbound?factoryId=F006`
  - 验证: F006 测试群 @ 机器人 "查询今天的生产任务" → 5s 内回复
  - 验证 AIInsightCard 流: 触发库存告警 → DingTalkAlertPushTool → 钉钉群推送
  - 失败重试: 暂时 kill 钉钉群 webhook URL → status=FAILED → 30s 后 scheduler 重试 → 恢复 URL → 重试成功 → status=SENT
  - 审计: `curl /api/mobile/F006/dingtalk/logs` 看历史 (需 ai:audit:view 权限)
  - 开 PR 单一 PR (per Brief §7.2): `[Track-B1] C-AI-1 钉钉机器人 PoC`

---

## Day 5 总结 (session-level)

**5 commits 推送 origin, 46/46 单测绿**:
| Day | SHA | 文件 | LOC | 单测 |
|-----|-----|------|-----|------|
| 2 | `5def64a2e` | 7 | +613 | 0 |
| 2.fix | `2ffe01dff` | 1 | +7/-4 | 0 |
| 3 | `c4daa2278` | 6 | +778 | 22 |
| 4 | `859a18e63` | 9 | +1016/-1 | 42 |
| 5 | `529611399` | 4 | +350 | 46 |
| **总计** | — | **27** | **+2764/-5** | **46/46** ✅ |

**Day 6 唯一卡点**: Steve 提供钉钉凭证 + 完成 dingtalk 应用 console 配置.
**所有代码已可部署**: deploy 脚本一键 + 凭证写入 `.env.test` 即可。




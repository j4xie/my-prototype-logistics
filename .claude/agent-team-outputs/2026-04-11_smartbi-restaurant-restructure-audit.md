# Agent Team Report: SmartBI 餐饮重构计划 Pre-Execution Audit

**Date**: 2026-04-11
**Mode**: Full (superpowers:requesting-code-review + agent-team Full mode)
**Language**: Chinese
**Codebase Grounding**: ENABLED
**Fact-check**: ON
**Target**: `docs/superpowers/plans/2026-04-11-smartbi-restaurant-restructure.md` (5450 → 5649 lines, 41 task sections)

---

## Executive Summary

审查 SmartBI 餐饮模块 7 周重构计划. 采用 4 phase pipeline (3 parallel researchers → Analyst → Critic → 主会话三重验证). **Analyst 判黄灯 5 个 P0, Critic 翻盘说全是幻觉**. 主会话亲自 Grep/Read 代码后确认: **Analyst 的 3 个"编译级 blocker"全部是伪 blocker** (Researcher A 搜错文件路径或方法名), **数据保真度方向是反的** (plan fixture 正确, demo HTML 有 data labeling bug). 审查过程反而挖出 5 个 Plan 之外的真问题, 全部已修复, plan 升级为绿灯可执行, 7 周估算不变.

---

## Phase 1: Parallel Research (3 researchers)

### Researcher A — Code Reality Check
- 声称发现 3 个编译级 blocker: Domain enum 不存在 / buildPromptWithContext 不存在 / ForecastService 不存在
- 验证 15/20 plan 声明 ✅
- **全部 3 个 blocker 都被主会话二次验证为伪 blocker** (见 Final Verification 部分)

### Researcher B — Long-term Architecture Review
- 12 个可持续性挑战, 其中 4 个真实有效:
  1. Principle #2 (Python 纯计算库) 在 cross-section context 场景下自相矛盾 → P1 (Task 1.6 实装时解决)
  2. Redis 故障级联无降级 → ✅ 已修 Task 4.2
  3. PythonSmartBIClient domain 硬编码 → ✅ 已修 Task 2.1 加 domain-agnostic `callSection()`
  4. 多设备隔离缺失 → ✅ 已修 Task 4.2 加 deviceId to Redis key
- 不成立: 12 薄 tool 违反复用原则 (AbstractRestaurantDiagnosticTool 已是合理抽象)
- 未来可做: Observability / Circuit Breaker / GDPR (P1 级, 不阻塞执行)

### Researcher C — Coverage Audit
- 20/20 demo 功能点覆盖 ✅
- 零 scope creep ✅
- **声称发现 data fidelity 违约**: Demo A ¥49,724 vs Plan fixture ¥731,048 → **主会话验证后发现方向反了**
- 真实发现: Demo HTML 把"当月亏损 ¥49,724"错标为"2 月营业额 ¥49,724" → ✅ 已修 HTML 并重新部署

---

## Phase 2: Analyst Synthesis

**Verdict**: 黄灯 — 5 P0 必修:
1. 3 个编译级 blocker (后证全伪)
2. 数据保真度违约 (后证方向反)
3. Principle #5 无法兑现 (部分对 — Plan Task 2.1 确实缺 domain-agnostic 方法)
4. Principle #2 自相矛盾 (部分对)
5. Redis 故障级联无降级 (对)

---

## Phase 3: Critic Challenge

**独立验证 3 个 blocker + 数据保真度**:
- Blocker 1 Domain enum: ✅ **存在**于 `aims/config/IntentKnowledgeBase.java:200-216` (后主会话二次验证: 实际位置是 line 7545 `public enum Domain`, 14 values with RESTAURANT at 7577)
- Blocker 2 buildPromptWithContext: ⚠️ Name 不同但**功能已存在**在 `DashScopeClient.classifyIntent`
- Blocker 3 ForecastService: ✅ **存在**于 `backend/python/smartbi/services/forecast_service.py:31`
- Data fidelity: **方向反了** — playbook YAML `cost_rigidity_high.yaml:9` 有真实数据"139万→73万" = ¥1,390,000→¥731,048, 与 plan fixture 一致, **demo HTML 的 ¥49,724 才是错的** (实际是当月亏损)

**Critic 结论**: 绿灯, 3 个真 P1 follow-up (cross-section context design, Principle #3 措辞, Task 1.6 组合型 section 测试)

---

## Phase 4: Main Thread Final Verification

**亲自 Grep/Read 三重验证 Critic 的翻盘**:

### Verification 1: Domain enum
```
Command: grep -n "public enum Domain" backend/java/cretas-api/.../config/IntentKnowledgeBase.java
Result:  7545:    public enum Domain {
```
**Read file line 7545-7596**: 确认定义了 14 个 Domain 值, 包括 `RESTAURANT("餐饮", "RESTAURANT")` at line 7577. **Analyst 错, Critic 对**.

### Verification 2: ForecastService
```
Command: find backend/python -name "forecast_service.py"
Result:  backend/python/smartbi/services/forecast_service.py
Grep:    31:class ForecastService:
         37:    def forecast(
```
**Analyst 错, Critic 对**.

### Verification 3: classifyIntentWithConversation
```
Command: grep -n "classifyIntent" LlmIntentFallbackClientImpl.java
Result:  328: classifyIntent (public, 6 params)
         347: classifyIntent (overload with originalInput)
         375: classifyIntentWithConversation  ← existing conversation support
         503: classifyIntentDirect
```
**方法已存在, Plan 应该 enhance 不是创建**. Analyst 错了, Critic 对了一半 (method name 错).

### Verification 4: Data fidelity direction
```
Command: grep playbooks/cost_rigidity_high.yaml
Result:  Line 9:   邓总火锅 2026-02 数据: 营收 -47.4% (139万→73万)
         Line 148: revenue_2feb: 731047.52
         Line 160: 当月亏损 ¥49,724, 激进目标可完全弥补亏损
```
**Plan fixture ¥731,048 正确** (real data from playbook). **Demo HTML ¥49,724 错误** (把亏损额标成营业额). Analyst 方向完全反, Critic 判断对.

---

## Phase 5: Plan Fixes Applied

### Fix 1: Demo HTML 数据标签 bug (chat-a)
- File: `docs/demos/smartbi-restaurant-chat-a-deng.html:719-735` + `:1001-1005`
- 把营业额从 ¥49,724 改为真实 ¥731,048
- 新增 "当月亏损 ¥49,724" 作为独立 stat
- 数据来源声明同步更新
- 部署: scp 到 139 `/www/wwwroot/showcase/cretaceousfuture/demo-hg/index.html` ✅

### Fix 2: Plan Task 4.4 命名更正
- 添加 "Pre-execution audit update" 块
- 从"新增 buildPromptWithContext" → "扩展现有 classifyIntentWithConversation (line 375)"
- 文件路径从 `client/impl/` → `service/impl/`

### Fix 3: Plan Task 2.1 domain-agnostic + circuit breaker
- 新增 `callSection(domain, sectionName, request)` 通用方法
- 保留 `callRestaurantSection()` 作为 backward-compat wrapper
- 加 circuit breaker (5 次失败 → 30 秒 open) + retry (2x with backoff) + 5s timeout
- 新增 `SectionCircuitBreaker.java` component 设计

### Fix 4: Plan Task 4.2 Redis 降级 + 多设备隔离
- Redis key 从 `conv:{factoryId}:{userId}` → `conv:{factoryId}:{userId}:{deviceId}`
- `loadRecent` 加 try/catch, Redis 异常 → 返回 empty list, fail-open
- `appendTurn` 加 try/catch, Redis 异常 → log warn, 不阻塞
- 所有 Redis 操作都有异常保护

### Fix 5: Plan Task 5.4 加 DataProvenanceCard
- 新增第 8 种卡片 `DataProvenanceCard.vue`
- 覆盖 Demo A Turn 9 + Demo B Turn 11 数据来源声明
- 三段式: ✓ 真实 / △ 推算 / ✗ 数据缺口

---

## Risk Assessment (Updated)

| 风险 | Pre-Audit | Post-Audit | 变化 |
|------|-----------|-----------|------|
| 编译级 blocker 阻断 P2-P3 | Priority 25 | Priority 0 | ❌ 伪问题, 不存在 |
| Demo 数据保真度违约 | Priority 25 | Priority 0 | ✅ 已修 HTML bug |
| Principle #5 无法兑现 | Priority 20 | Priority 8 | ✅ Task 2.1 加 domain-agnostic client |
| Python cross-section context | Priority 20 | Priority 12 | 🟡 Task 1.6 实装时解决 |
| Redis 故障级联 | Priority 15 | Priority 4 | ✅ Task 4.2 加 fail-open 降级 |
| 多设备 context 冲突 | Priority 12 | Priority 2 | ✅ Task 4.2 加 deviceId key |
| Observability 零覆盖 | Priority 9 | Priority 9 | 🟡 留到 P2 末期 |
| DeepSeek 超时无 fallback | Priority 12 | Priority 10 | 🟡 P1 Task 1.5 实装时加 timeout |

---

## Process Note

- Mode: Full
- Researchers deployed: 3 (A code reality, B architecture, C coverage)
- Browser explorer: OFF
- Total sources: 20+ code files verified
- Key disagreements: Analyst vs Critic 在 5 个 P0 上完全相反, **主会话通过 4 次独立 Read/Grep 验证解决**
- Phases completed: Research → Analysis → Critique → Main Thread Verification → Plan Fixes
- Fact-check: Performed inline (not separate agent) because main thread needed to resolve Analyst/Critic disagreement
- Healer: Not needed — main thread verification replaced healing
- Plan fixes: 5 applied (1 HTML bug + 4 plan doc enhancements)

---

## Lessons Learned (saved to memory)

1. **子 agent 的代码搜索不能盲信**: 3 个 "blocker" 全是幻觉, 根因是 Researcher A 搜错路径 (查 `client/impl/` 但类在 `config/`), 用过时的方法名, 或 Python 搜索盲区. **"不存在"的结论必须主会话独立验证**.
2. **Demo HTML 也可能有 bug**: 自己写的 demo 把亏损额标为营业额. Pre-execution audit 反而发现了这个 bug — 审查不白费.
3. **Analyst + Critic 的完全分歧本身就是信号**: 两个 opus agent 在同一事实上意见相反 = 原始证据没有被充分验证 = 主会话必须亲自看代码. Critic 翻盘并不意味着 Critic 一定对, 主会话仍要三重验证.

---

## Final Verdict

🟢 **Green Light — Ready to Execute**

5 个真问题修好, 3 个伪 blocker 排除, 7 周估算稳定, 长期稳定性原则都有物理验证点. Plan 升级为 v2, 建议选择 Subagent-Driven 执行路径.

# Chat B 启动 prompt — 数据织网 Sub-Project B 实施

**用法**: 复制下面整个 "Prompt to paste" 区块到一个**新 Claude Code chat** (在同一仓库 root: `C:\Users\Steve\my-prototype-logistics`).

⚠️ **启动条件**: A chat 必须已经完成 Day 1-3 (ALIAS 搬家 + capability/ 模块骨架 + RequiresSpec dataclass commit), B 才能启动. 否则 B 没契约可填.

**最早启动时间**: A chat 启动后第 4 天 (并行模式).

---

## Prompt to paste

```
我要实施 数据织网 (Data Fabric) Sub-Project B: 实体解析 + 形态路由.

## 背景

设计文档已完成 2 轮独立审计, 实施 ready. 关键文档:
- `数据织网/00-实施Ready总结.md` — 全局背景
- `数据织网/03-B-实体解析与形态路由.md` v1.2 (2208 行) — B spec 权威源
- `数据织网/02-A-能力驱动渲染.md` v1.4 — A 的契约 (B 必须填)
- `数据织网/01-总览路线图.md` v1.2 — 总体规划

B 的工作量 6-9 周, 是数据织网最复杂的 sub-project. 与 A chat 并行, 但 Day 1 之后才启动 (等 A 的 ALIAS 搬家完成).

## 立即开始

请按 03-B spec §10 的 5-phase 实施计划开干.

### Phase 0 (Day 0-3, 4 天) — 标记数据集准备

这一步可以**完全并行 A**, 不依赖 A 任何输出. 直接开做:

1. 从 prod 抽 250 真实店名 + 250 真实菜名 (从 dim_store 149 行 / dim_product 2703 行)
2. 程序生成 250 + 250 扰动 (简繁/空白/语序/缩写, 一吃/二吃 变体)
3. 人名 200 对全合成 (dim_staff 真实是 0 行)
4. 双盲标注: 2 人独立标 yes/no/maybe + 第三人裁决
5. 60/20/20 split with random seed 20260425 (M-1 修复)
6. 输出: `entity_resolution_labels` 表 1200 行 + 一致率 Cohen's kappa 报告

### Phase 1 (Day 4-14, 11 天) — B1 Baseline

⚠️ **必须等 A 已 commit 以下契约才能开始**:
- `smartbi/canonical/aliases.py` (`ALIAS_TO_ATTR` 字典 + `to_canonical()` 函数)
- `smartbi/capability/contract.py` (`RequiresSpec` dataclass)
- `smartbi/capability/api.py` 的 `/api/smartbi/capability/{factory_id}` endpoint (B 的 writers 完成时调 invalidate)

实施顺序见 03-B §10 Phase 1 (Day 4-14).

## 实施约束

1. **遵循 CLAUDE.md + .claude/rules/** 中所有规则 (同 chat-A-starter.md 的列表).

2. **关键设计决策** (03-B v1.2 已落实, 不再讨论):
   - Multi-Agent 渐进 (B1 baseline 2 agent → 量化阈值 holdout ≥ 88% 才 ship; < 88% 进 B2 升级)
   - STAFF 实体半自动 (同 store 第一次自动 INSERT mapper_method='auto_new'; 跨 store 重名 mapper_method='cross_store_pending' 进 admin 队列)
   - Sheet Merger 用 simple `merge_status` 列 (不依赖 C, B 自包含)
   - LLM 子预算: shape_detector 5K + entity_resolution_arbitrator 30K + agent_insights 200K basic tier
   - LLM 现有 agent_insights 预算保持 200K basic / 800K enterprise (Week 5 prod 已用, 不能砍)

3. **subagent 并行策略**:
   - 5 个 agent 各自 subagent (DeterministicAgent / EmbeddingAgent / ContextualAgent / TransitiveAgent / LLMArbitrator)
   - Shape Detector + Router 一个 subagent
   - 4 个 Silver writer 各自 subagent (ProductSummary / Review / Finance / Inventory)
   - Sheet Merger 一个 subagent
   - 测试 + admin UI 各 subagent

4. **smoke gate**: 完成 7 项 M2 验证才 ship (见 03-B spec §10 Phase 5 + §11.5):
   - 跨上传识别同店 (≥ 88% holdout)
   - 跨上传识别同菜变体
   - 评论 xlsx 路由到 ReviewWriter
   - 财务 xlsx 路由到 FinanceWriter
   - Admin UI 低置信度配对裁决
   - Holdout 准确率: 店 ≥ 88% / 菜 ≥ 88% / 人 ≥ 80%
   - 并发回归: 同 factory 2 upload 并发 dim 无重复

5. **关键依赖时序**:
   - A 的 ALIAS_TO_ATTR / RequiresSpec / capability API → B 用其填契约
   - C 不依赖 B 完成 (C 在 B 的 entity_id 稳定后才启动, 大约 B Phase 4 开始之后)

6. **commit 节奏**:
   - Day 0-3: 标注数据集 commit (1 个)
   - Day 14: B1 baseline + Sheet Merger + 并发完成 (1 个 milestone commit)
   - Day 16: B1 dev set 验证报告 + 决策走/不走 B2 (1 个 commit)
   - Day 30 (条件): B2 升级完成
   - Day 46: 4 MVP 模板 + 4 Silver writer 完成
   - Day 53: M2 全过, prod 灰度

## 注意事项

- B 已知未决 (03-B v1.2 §13) 12 项 — 实施时遇到立即 ask user.
- B1 holdout < 88% → 必须进 B2 升级 (不允许跳过). < 75% → 急停, 重新设计 baseline.
- LLM 调用必须走 budget_tracker.consume_with_feature(...) (修 S-13), 防 feature 间互相饿死.
- 4 个 Silver writer 的 RLS migration 必须完整 (修 S-6), CI 自动检查所有 dim_*/fact_*/agg_* FORCE RLS.
- B 完成时 A chat 已经在跑灰度 (F001+RES_3101_009), B 上 prod 时复用同名单.

## 立即开始

第一步: 跑 Phase 0 标注数据准备. 第一天的输出是: 数据抽样脚本 + 1200 行 entity_resolution_labels 表 schema migration + 双盲标注流程文档.
```

---

## Chat B 实施期间, 用户 (你) 需要做什么

1. **Day 3 (Phase 0 完成)**: review 标注一致率 (Cohen's kappa). 如果 < 0.7 → SOP 不清晰需重做.

2. **Day 14 (Phase 1 完成)**: review B1 baseline + Sheet Merger + 并发模型. 跑 dev set.

3. **Day 16 (Phase 2 决策点)**: 看 B1 dev set 准确率, 拍是否走 B2 升级.
   - ≥ 90% → ship B1, 跳过 B2 (省 14 天)
   - 88-90% → 边缘, 你拍
   - < 88% → 必须进 B2

4. **Day 30 (Phase 3 完成, 条件)**: B2 升级 dev set 准确率.

5. **Day 46 (Phase 4 完成)**: 4 MVP 模板 + 4 writer review.

6. **Day 53**: M2 7 项 smoke 报告, 你拍是否 ship prod.

## 实施期间常见问题

| 问题 | 应对 |
|---|---|
| 标注一致率 < 90% | 修 SOP 加示例 + 第三人裁决标准 |
| B1 dev 准确率 88-90% 边缘 | 跑 holdout 看是否稳定, 不稳定走 B2 |
| LLM 调用 rate limit | 复用 agent_budget_daily feature_breakdown, 单 feature 超 cap 自动 block |
| Sheet Merger 时间推断错 | priority 3 fallback 到 NULL, 不再硬编码 upload_at (修 C-6) |
| 4 个 writer 并发跑同 factory race | with_factory_serialization 包裹 (advisory_xact_lock + asyncio.Lock) |

---

## 完成交付物

B 实施完成时, 你应该有:
- ✅ `smartbi/canonical/entity_resolution/` 模块 (5 agents + orchestrator)
- ✅ `smartbi/canonical/shape_detector.py` + `shape_router.py`
- ✅ `smartbi/canonical/sheet_merger.py` + merge_status migration
- ✅ `smartbi/canonical/writers/` 模块 (BaseWriter + 4 新 writer + BillFlowWriter 适配)
- ✅ 4 张新表 RLS migration: agg_product_period / dim_review_summary / fact_review_event / fact_finance_voucher / dim_finance_subject / fact_inventory_snapshot / dim_ingredient_threshold / entity_resolution_history / entity_resolution_admin_queue / entity_resolution_labels (10 张表)
- ✅ Admin UI 低置信度配对裁决页 + 标注队列管理
- ✅ 4 MVP 模板: product_summary_top_n / review_sentiment_summary / monthly_revenue_expense / inventory_alert
- ✅ E2E 7 项 smoke 全绿
- ✅ Test 环境 24h soak + Prod 灰度

---

**重要**: C chat 必须等 B 完成 (entity_id 稳定 + ProductSummaryWriter 上 prod) 才能启动. 见 `chat-C-starter.md` (待写, 实施时再做).

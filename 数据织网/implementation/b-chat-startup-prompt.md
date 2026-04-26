# B Chat 启动 Prompt — 数据织网 Sub-Project B (Day 2 起步)

**版本**: v2 (Apr 26 2026 EOD, A 100% prod ship + B Day 1 已 commit `f893a266e`)
**用法**: 把下面 `---` 之间的内容整段复制到新 Chat 作为第一条消息发给 Claude。
**何时启动**: A chat 已散场, B Day 1 starter 已 ship. 现在 B chat 接手 Day 2 起.

**A 进展 (B chat 启动时已就位 — 这些都已 commit + push)**:
- A spec **100% prod live** (Apr 26): backend capability/ + 35 templates tagged + FE 17 cards wrap + admin audit + 灰度 gate (CAPABILITY_ROLLOUT_FACTORIES env var)
- A monitor cron 装在 prod 47.100.235.168: `*/15` capability-watch + `0 9` capability-soak-report (logs at /var/log/capability-watch.log + /var/log/capability-soak.log)
- UAT 真上传验证 + 4 gap fix design at `数据织网/implementation/post-A-uat-findings.md`
- **B Day 1 commit `f893a266e`** (你接手前的 starter):
  - aliases.py 106→173 aliases, 26→41 canonical fields (+15 B-stage)
  - migrations/V20260426_01__entity_resolution_b_baseline.sql (3 RLS tables: labels + admin_queue + history)
  - scripts/b_spec/generate_labeling_dataset.py (1200-pair candidate generator)
  - 26/26 单测仍 PASS (A 不破坏)

---

# 数据织网 Sub-Project B 实施 — 接续 Day 2

我是新 chat, 接续之前 chat 完成的 A 全 ship + B Day 1 starter. A chat 已散场.

## 必读 (按顺序读, 不要跳)

请用 Read 工具按顺序读以下文件, **不要 paraphrase, 完整读取**:

1. `数据织网/00-实施Ready总结.md` — 全局背景 (PM 对齐用)
2. `数据织网/01-总览路线图.md` v1.2 — 总规划 (B 在 §4.2)
3. `数据织网/03-B-实体解析与形态路由.md` v1.2 — **B spec 权威源** (2208 行), 必须按它来
4. `数据织网/02-A-能力驱动渲染.md` v1.6 SHIPPED — A 已 ship 状态 + 与 B 的契约接口
5. `数据织网/implementation/post-A-uat-findings.md` — A UAT findings + **4 gap 修复设计** (重要 — B 解决 Gap 1+2 中的大部分)
6. `backend/python/smartbi/canonical/aliases.py` — 26 + 15 = **41 canonical fields** (B Day 1 已扩)
7. `backend/python/smartbi/database/migrations/V20260426_01__entity_resolution_b_baseline.sql` — B Day 1 schema (未 apply, 你决定何时部 test/prod)
8. `backend/python/scripts/b_spec/generate_labeling_dataset.py` — B Day 1 sample generator
9. `backend/python/smartbi/canonical/dim_resolver.py` — 现有 entity resolution 基线 (B1 升级起点)
10. `backend/python/smartbi/capability/contract.py` — A 的 RequiresSpec dataclass (B 给新模板填 requires 用)
11. `.claude/rules/concurrent-edit-safety.md` — **关键!** 多 chat 并发常态, 必须严格遵守
12. `.claude/rules/ai-intent-tool-skill-architecture.md` — Tool/Skill 架构 (B 的 ShapeRouter 可用 Tool 模式)
13. `CLAUDE.md` — 项目根 README (顶部 100 行了解架构)

## 当前状态 (你接手的起点 = B Day 2)

### B Day 1 已 commit (你可以直接用)

| Item | Commit | 你能用什么 |
|---|---|---|
| ALIAS B-stage 字段 | `f893a266e` | `from smartbi.canonical.aliases import ALIAS_TO_ATTR, to_canonical` (现 41 canonical) |
| Schema migration | `f893a266e` | 文件就位, 等你 apply 到 test (smartbi_db) + prod (smartbi_prod_db) 时机 |
| Sample generator | `f893a266e` | `cd backend/python && python scripts/b_spec/generate_labeling_dataset.py` (需 superuser DSN) |

### A 已 ship 的 (你可以依赖)

| Commit | 内容 | 你能用什么 |
|---|---|---|
| `d51200a96` Day 2 | contract.py | `from smartbi.capability.contract import RequiresSpec` (新 template 填 requires 用) |
| `709da1ca4` Day 3 | calculator.py + tests | 不直接消费 |
| `1b87c952b` Day 4 | endpoint + 13 templates | 参考 — B 加新 templates 跟同样 pattern |
| `e80fc66f1` Day 10 | admin audit + lint | manifest 一致性自动检查 (B 加新 cards 时不会漂移) |
| `971a24a09` Phase 4 | GRADUAL_ROLLOUT_FACTORIES | env var 控制灰度, B M2 ship 时同步配置 |
| `8f36c6fd2` + `84647edee` | P0 + P0-followup hooks | upload 完成自动 invalidate capability cache. B 不需重做. |

### 14 deferred templates (`requires=None`) — B 必填

A spec lint 软警告显 14 个 templates 标 `requires=None` 因为字段不在原 26 canonical. **现在 B Day 1 加了这些字段**, 你需修以下模板的 `requires`:

| Template (file) | 现 requires | 应改为 |
|---|---|---|
| reviews_sentiment_summary | None | `RequiresSpec(all=['review_text'], any=['rating', 'review_date'])` |
| payment_method_mix | None | `RequiresSpec(all=['payment_channel'], any=['payment_amount'])` |
| stored_value_card_consumption | None | `RequiresSpec(all=['card_no'], any=['card_balance', 'card_recharge'])` |
| refund_analysis | None | `RequiresSpec(all=['refund_amount'])` (refund_amount 已在 v1.5 ALIAS, 不需扩) |
| reverse_checkout_stats | None (POS-specific) | 留 None (这两字段 仍 POS-specific 不在 canonical) |
| groupon_channel_breakdown | None (POS prefix-match) | 留 None (POS-specific) |
| purchase_inventory_inflow | None (B-stage) | `RequiresSpec(all=['inventory_item'], any=['stock_qty'])` |
| member_deep_analytics | None (会员卡) | `RequiresSpec(all=['card_no'])` |
| kitchen_dispatch_heatmap | None (传菜) | `RequiresSpec(all=['dispatch_time'], any=['kitchen_station'])` |
| dashboard_inventory_alert (manifest) | manifest description note | manifest description 改为正式 wrap |
| dashboard_top_dishes (manifest) | TemplateGrid | 留 (TemplateGrid handles) |

**做法**: B Day 2-3 期间统一 PR 修这 ~9 个模板. CARD_MANIFEST 同步加 description "TemplateGrid" 注解或正式 wrap.

### A chat 已散场 (你不需怕冲突)

A chat 在 Apr 26 EOD 散场 (commit `f893a266e` 之后无 A 工作). 你接手时:
- A 后端代码 frozen (除非 prod observation 抓出 bug 需要 hotfix)
- A 监控 cron 在跑
- B 工作可放心展开, 无 A 并发冲突

但**仍可能有其他 chat** (depth-aiq / canvas-dynamic / Bug G 等) 在跑. 标准 concurrent edit safety 仍适用:
- `git status --short <file>` BEFORE every edit
- `git add <specific>` not `git add .`
- `git status --short` BEFORE every commit
- 必要时 `git add -p` 选择性 stage hunks

## 待做 (B Day 2-13+, 按 03-B spec §11 实施分阶段)

### Phase 1: B-baseline (Day 2-14, ~2 周)

**Day 2**: BaseWriter 接口 + BillFlowWriter 适配
- `smartbi/canonical/silver_writers/base.py` — BaseWriter 接口 + WriteSummary dataclass + `_resolve_store/_resolve_product/_resolve_staff` 协议 (per spec §4.0)
- `smartbi/canonical/silver_writers/bill_flow_writer.py` — BillFlowWriter 适配类, 包装现有 `scripts/backfill_silver.py` CLI (per spec §4.0.1, 修 C-3)
- 加 `__init__(self, pool, orchestrator)` 注入 (spec S-NEW-10)
- 单测覆盖 BillFlowWriter dispatch 现有 backfill 路径

**Day 3**: 2-agent baseline + Orchestrator skeleton
- `smartbi/canonical/entity_resolution/orchestrator.py` — EntityResolutionOrchestrator + ResolutionInput/Output + OrchestrationContext (spec §2.2 含 C-1 修 + C-2 history 写入)
- `smartbi/canonical/entity_resolution/agents/deterministic.py` — 升级 alias_normalizer.py (简繁 + 空白 + UPPER 等)
- `smartbi/canonical/entity_resolution/agents/embedding.py` — Qwen text-embedding-v3 + LRU cache (max 50K, spec S-1) + 余弦匹配
- 单测 mock pool + 100 fixtures 验证 orchestrator 决策流程

**Day 4**: ShapeDetector + ShapeRouter + 形态枚举
- `smartbi/canonical/shape_detector.py` — 7 形态 (账单流水 / 商品汇总 / 评论 / 财务 / 库存 / 排班 / 会员), LLM-augmented (qwen-plus, 低置信度入 admin queue)
- `smartbi/canonical/shape_router.py` — 路由到对应 Silver writer
- 单测覆盖 7 形态 + 1 unknown 兜底

**Day 5-7**: 标注流程实操
- 跑 `generate_labeling_dataset.py` → 1200 pairs CSV
- Apply migration V20260426_01 到 test env (smartbi_db)
- 进 admin UI / CSV 双盲标注 (用户找 2 名内部标注者)
- 一致率 > 90% 进 holdout, < 90% 重做规则

**Day 8-9**: 4 个新 Silver writer (条件 Day 4-5 完成后)
- ProductSummaryWriter (商品汇总 → agg_product_period 新表, executemany 批量, spec §4.0.2 修 S-4)
- ReviewWriter (评论 → dim_review_summary, spec §4.2)
- FinanceWriter (财务凭证 → fact_finance_voucher, spec §4.3)
- InventoryWriter (库存 → fact_inventory_snapshot, spec §4.4)

**Day 10-12**: 跑 B1 holdout + 决策
- 店名 ≥ 88% / 菜名 ≥ 88% / 人名 ≥ 80% → ✅ ship; 任一 < 88%/<80% → 进 B2

**Day 13-14**: M2 7 项 smoke + ship B-baseline 到 test, prod 等灰度

### Phase 2: B2 升级 (条件触发, Day 15-30, 1-1.5 周)

仅 Phase 1 holdout 不达标时跑.
- ContextualAgent (店名 + 城市 + 区 上下文 embedding)
- TransitiveAgent (闭包传递)
- LLMArbitrator (qwen-plus 仅低置信度)
- B2 holdout: 92% / 92% / 85% 才 ship

### Phase 3: 4 MVP 模板 + Sheet Merger + 并发 (Day 31-46)

- 4 MVP 模板 (1 个/形态), 每个 3-4 天 (per roadmap §5)
- Sheet Merger (`merge_status` 列, spec §5)
- 并发模型 (advisory_xact_lock + asyncio.Lock + cache 失效, spec §7)

### Phase 4: M2 全过 + ship B (Day 47-53)

7 项 smoke gate (per roadmap §7 M2):
1. 跨上传同店识别 ≥ 88%
2. 菜名 (一吃)/(二吃) 归一
3. 评论 → ReviewWriter
4. 财务 → FinanceWriter
5. Admin 低置信度队列
6. 并发回归 (advisory lock)
7. holdout 准确率达标

## 关键设计决策 (已落实, **不再讨论**)

| # | 决策 | 03-B spec 章节 |
|---|---|---|
| Multi-Agent 渐进 | B1 baseline 2 agent → 不达标进 B2 (5 agent) | §2.1 |
| STAFF 半自动 | 同 store 第一次自动 INSERT, 跨店重名进 admin | §2.4.0 (用户拍 C-5) |
| Sheet Merger | 用 simple `merge_status` 列, **不依赖 C** | §5.1 (用户拍 C-v2-2) |
| BillFlowWriter | 适配现有 backfill_silver.py 不重写 | §4.0.1 (修 C-3) |
| LLM 预算细分 | 每 feature 单独 cap 在 agent_budget_daily | §2.5 (修 S-13) |
| Embedding 缓存 | LRU max 50K, worker=1 约束文档化 | §2.3 (修 S-1) |
| ProductSummary 写入 | executemany 批量 (1.3M rows < 5 分钟) | §4.0.2 (修 S-4) |

## 实施约束 (与 A chat 完全相同)

1. **遵循 .claude/rules/** 全部规则:
   - `concurrent-edit-safety.md` — 必读. commit 前必 `git status --short` + 选择性 stage. 经验来自 Apr 11 + Apr 24 事故 + A chat 全程实战.
   - `api-response-handling.md` — `{success, data, message}` 统一格式
   - `python-services-architecture.md` — Python 仅 8083 端口
   - `database-entity-sync.md` — PostgreSQL, FORCE RLS 所有 dim_*/fact_*/agg_*
   - `field-naming-convention.md` — entity camelCase, DB snake_case, JSON camelCase
   - `server-operations.md` — 双环境 prod 10010+8083 / test 10011+8084, **重大改动先 test 后 prod**
   - `CREDENTIAL-MANAGEMENT.md` — 凭证从 .env 不 hardcode

2. **Subagent 并行策略** (在 B chat 内部用):
   - Multi-Agent 实体解析 (5 个 agent 完全可并行)
   - 4 个 Silver writer 完全独立
   - 标注 SOP 跟工程并行
   - 测试

3. **Commit 节奏** (按 03-B §11 milestone):
   - Day 2: BaseWriter + BillFlowWriter 适配
   - Day 3: 2-agent + Orchestrator skeleton
   - Day 4: ShapeDetector + Router
   - Day 7: 标注 SOP 完成
   - Day 9: 4 writer
   - Day 12: B1 holdout 结果 + B2 决策
   - Day 14: B-baseline ship test
   - Day 30 (条件): B2 升级
   - Day 46: 4 MVP 模板 + Sheet Merger
   - Day 53: M2 全过, ship prod 灰度

4. **Smoke Gate (M2 7 项)** — 见 spec §11 + 上面 Phase 4 列表

5. **遇到问题立即 ask user, 不擅自决定**:
   - spec 有错或不一致
   - 03-B v1.2 §13 已知未决 11 项 (BU1-12) — implementer 责任
   - prod 改动前的最终确认

## 第一步立即做

读完 13 个必读文件后, **立即执行**:

1. 验证 B Day 1 已 commit 工作 (你依赖):
   - `cd backend/python && python -X utf8 -c "from smartbi.canonical.aliases import ALIAS_TO_ATTR; canonicals = set(ALIAS_TO_ATTR.values()); print('aliases:', len(ALIAS_TO_ATTR), '| canonical:', len(canonicals))"` 应输出 173 / 41
   - `git log --oneline -3 数据织网/02-A-能力驱动渲染.md` 应见 v1.6 SHIPPED commit
   - `cd backend/python && python -m pytest tests/test_contract.py tests/test_capability_calculator_unit.py tests/test_template_status.py 2>&1 | tail -3` 应 26/26 PASS

2. 决定 migration apply 时机:
   - 推荐 Day 2 末 apply 到 test (smartbi_db), prod 等 B M2 ship 同步:
     ```
     ssh root@47.100.235.168 "PGPASSWORD=smartbi_secure_password_2025 psql -h localhost -U smartbi_user -d smartbi_db -f /www/wwwroot/cretas/code/backend/python/smartbi/database/migrations/V20260426_01__entity_resolution_b_baseline.sql"
     ```
   - Apply 前确认 prod schema 正常 (3 表不冲突现有 schema)

3. 开始 Day 2:
   - 派 subagent #1: BaseWriter 接口 (smartbi/canonical/silver_writers/base.py)
   - 派 subagent #2: BillFlowWriter 适配 (smartbi/canonical/silver_writers/bill_flow_writer.py)
   - 主 chat: 协调 + 单测覆盖

4. 阶段性 commit (Day 2 末):
   - `feat(数据织网 B): Day 2 — BaseWriter 接口 + BillFlowWriter 适配 backfill_silver`

## 与用户的沟通

- 用 **简短中文** 报告进度, 不要长 markdown
- 关键 milestone 暂停问 user (Day 4 ShapeDetector ready / Day 7 标注完成 / Day 12 holdout 结果 / Day 14 ship test 前 / Day 53 ship prod 前)
- spec 有疑问立即问, 不假设
- prod 改动前必须 user 明确同意

## 不要做的事

- ❌ 不要重写 spec — 03-B v1.2 是权威源
- ❌ 不要修 A 已 ship 的代码 (除非真 bug + user 确认)
- ❌ 不要在 prod 上做未测试的改动 (server-operations.md 强制 test 先行)
- ❌ 不要 push 到 origin — 等 user 明确说"push" 才推 (本 prompt 假设 user 还会人工 confirm)
- ❌ 不要重做 A 的工作 (ALIAS / RequiresSpec / Calculator / endpoint / FE / monitor cron 都已 live)
- ❌ 不要做 03-B spec out-of-scope 的事 (cell-level provenance 是 C 范围, federated query 是 D 范围)
- ❌ 不要"顺便修" A 的 14 deferred 模板, 等你 Day 2-3 工作做完后**统一 PR** (避免 scope creep)

## 紧急联络 / 与 A chat 协调

A chat 已散场, 但 A spec 实际**仍 live in prod**. 如果你:
- 改 ALIAS_TO_ATTR (你会改, B 加新形态字段) → 验证不破坏 A 的 26 canonical fields + 26 单测仍 PASS
- 改 capability/* 模块 → 不该, B 不动 A 后端
- 改 14 deferred 模板的 requires → OK, A lint test 会自动验证
- 看 prod observation log → `tail /var/log/capability-watch.log` on 47 (read-only OK)

如果 prod observation 抓出 A 的 bug:
- Hotfix in this chat OK (你在做 B 但 A bug 紧急修也合理)
- Memory 要更, 标 "B chat hotfixed A bug ..."

## 推荐节奏

- 1 周内 跑完 Day 2-7 (BaseWriter + 2 agent + ShapeDetector + 标注实操)
- 第 2 周 Day 8-14 (4 writer + B1 holdout + ship test)
- 第 3 周 (条件) Day 15-30 B2 或继续 Day 31+
- 第 4-7 周 (M2 ship) 4 MVP 模板 + Sheet Merger + 并发 + 7 项 smoke

总 4-7 周 (vs spec 估 6-9w, 因为 baseline shape 已被 A 打好 + B Day 1 已 commit + 标注 SOP scripts 已 ready).

---

**现在请开始**: 读完 13 个必读文件, 然后立即执行"第一步立即做"的 3 个步骤 (verify + apply migration 决策 + Day 2 BaseWriter subagent).

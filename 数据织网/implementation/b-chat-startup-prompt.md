# B Chat 启动 Prompt — 数据织网 Sub-Project B

**用法**: 把下面 `---` 之间的内容整段复制到新 Chat 作为第一条消息发给 Claude。

**何时启动**: A Chat (本 chat) 已完成 Day 4. A 的契约层 (ALIAS + RequiresSpec) 已稳定 commit, B 可以并行启动了。

**A 进展 (B 启动时已就位)**:
- `aliases.py` 26 canonical 字段 (Day 1, 在 commit `a18f4c393` 因并发顺走)
- `RequiresSpec` dataclass + tests (Day 2, commit `d51200a96`)
- `CapabilityCalculator` 全实现 + tests (Day 3, commit `709da1ca4`)
- API endpoint + 13 模板 tagged + main.py wiring (Day 4, commit `1b87c952b`)
- conftest pandas lazy fix (`d13a2d588`)
- A Phase 2 (剩 17 模板) 在 A chat 同步进行中, **B 不需要等**

---

# 数据织网 Sub-Project B 实施 — 启动 Day 0

我是新 chat, 启动 Sub-Project B (实体解析 + 形态路由). A Chat 在另一窗口同步推进 Phase 2/3, 我们并行不冲突。

## 必读 (按顺序读, 不要跳)

请用 Read 工具按顺序读以下文件, **不要 paraphrase, 完整读取**:

1. `数据织网/00-实施Ready总结.md` — 全局背景 (PM 对齐用)
2. `数据织网/01-总览路线图.md` v1.2 — 总规划 (B 在 §4.2)
3. `数据织网/03-B-实体解析与形态路由.md` v1.2 — **B spec 权威源** (2208 行), 必须按它来
4. `数据织网/02-A-能力驱动渲染.md` §11 (移交需求) — Sheet Merger 时间推断接口约定
5. `backend/python/smartbi/canonical/aliases.py` — A 已搬好的 ALIAS dict (26 canonical, B 阶段需扩展 ~10-15 个)
6. `backend/python/smartbi/capability/contract.py` — RequiresSpec dataclass (B 给新模板填 `requires` 用)
7. `backend/python/smartbi/canonical/dim_resolver.py` — 现有 entity resolution 基线 (B1 升级起点)
8. `.claude/rules/concurrent-edit-safety.md` — **关键!** A chat 在并行改文件, B 必须严格遵守
9. `.claude/rules/ai-intent-tool-skill-architecture.md` — Tool/Skill 架构 (B 的 ShapeRouter 可用 Tool 模式)
10. `CLAUDE.md` — 项目根 README (顶部 100 行了解架构)

## 当前状态 (你接手的起点)

### A Chat 已 commit 的 (你可以依赖)

| commit | 内容 | 你能用什么 |
|---|---|---|
| `a18f4c393` (并发顺走) | aliases.py 26 fields | `from smartbi.canonical.aliases import ALIAS_TO_ATTR, to_canonical` |
| `d51200a96` Day 2 | contract.py | `from smartbi.capability.contract import RequiresSpec` (新 template 填 requires 用) |
| `709da1ca4` Day 3 | calculator.py + tests + 索引 migration | 不直接消费 (B 写完后 A capability 自动暴露字段) |
| `1b87c952b` Day 4 | template_status.py + 13 模板 tagged + endpoint | `compute_template_status` / `suggest_unlocks` 算法可参考 |
| `d13a2d588` | conftest pandas lazy | 不再需要 `--noconftest` |

### A Chat 同时在做 (并行, **不要碰**)

- A Phase 2: 给剩 17 模板加 `requires` (top_n_by_dim / category_distribution / anomaly_detection 等)
- A Phase 3 (后续): Vue composable + CapabilityGate
- A 灰度部署到 test env

**冲突区**: A 在改 `backend/python/smartbi/services/materialized_analytics/templates/*.py`. B 也会创建 NEW template files, 但**只能新建**, 不要改 A 正在标的 17 个文件 (top_n_by_dim, category_distribution, anomaly_detection, pareto_analysis, dish_slow_movers, dish_category_breakdown, member_consumption, table_type_comparison, dish_time_slot_matrix, dish_by_table_type, combo_usage_rate, reverse_checkout_stats, store_customer_stratification, business_overview_summary, member_deep_analytics, kitchen_dispatch_heatmap, period_comparison_trend, dish_store_drill, monthly_anomaly, purchase_inventory_inflow, groupon_channel_breakdown).

如果 B 后期需要改这 17 个文件中的某一个 (例如要加 ALIAS 扩展后的 requires 字段) → **必须**先在 chat 里跟用户确认 A chat 状态, 等 A 提交完 Phase 2 commit 再动。

## 待做 (B 全程, 按 03-B spec §11 实施分阶段)

按 03-B v1.2 spec 的工作量分解:

**Phase 1: ALIAS 扩展 + 标注数据集启动 (Week 1, ~5 天)**
- ALIAS_TO_ATTR 加 ~10-15 个 B 形态字段: `product_summary` 已加 (Day 0 audit) ✓, 还缺 `review_text` / `rating` / `voucher_code` / `payment_channel` / `inventory_item` / `stock_qty` / `period` 等
- 标注数据集准备 (500+500+200 对店名/菜名/人名)
- 标注 SOP (双盲, 60/20/20 split)
- `entity_resolution_labels` 表 schema

**Phase 2: B1 baseline 2-agent + Shape Detector (Week 2-3, 1.5-2 周)**
- DeterministicAgent (升级 alias_normalizer)
- EmbeddingAgent (Qwen text-embedding-v3 + LRU 缓存)
- EntityResolutionOrchestrator (跨 agent 状态传递)
- ShapeDetector (LLM + rule hybrid, 7 形态)
- BaseWriter 接口 + BillFlowWriter 适配 (包装现有 backfill_silver.py)
- 跑 B1 holdout: 店名 ≥ 88% / 菜名 ≥ 88% / 人名 ≥ 80% → ✅ ship; < 88% → 进 B2

**Phase 3: B2 升级 (条件触发, Week 4, 1-1.5 周)**
- ContextualAgent (上下文 embedding)
- TransitiveAgent (闭包传递)
- LLMArbitrator (qwen-plus 仅低置信度)
- 跑 B2 holdout: ≥ 92% / 92% / 85% 才 ship

**Phase 4: 4 个新 Silver writer + 4 MVP 模板 (Week 5-7)**
- ProductSummaryWriter (商品汇总, executemany 批量)
- ReviewWriter (评论, dim_review_summary)
- FinanceWriter (财务凭证, fact_finance_voucher)
- InventoryWriter (库存盘点, fact_inventory_snapshot)
- 4 MVP 模板 (1 个/形态), 每个 3-4 天工作量
- 全部填 A 的 `requires` 契约

**Phase 5: Sheet Merger + 并发模型 (Week 7-8)**
- `merge_status` schema migration
- SheetMergeAnalyzer (在 field_definitions detection 之后跑)
- 时间推断 3-priority (行内日期 → sheet 名 → metadata)
- advisory_xact_lock + asyncio.Lock + cache 失效
- entity_resolution_admin_queue 表 + admin UI

**Phase 6: M2 Smoke + ship (Week 8-9, 7 项 smoke)**
- 跨上传同店识别 ≥ 88%
- 菜名 (一吃)/(二吃) 归一
- 评论 → ReviewWriter
- 财务 → FinanceWriter
- Admin 低置信度队列
- 并发回归 (advisory lock)
- holdout 准确率达标

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

1. **遵循 .claude/rules/** 全部规则, 特别是:
   - `concurrent-edit-safety.md` — A chat 同时活, **千万**注意:
     - 修共享文件 (templates/, main.py, .gitignore) 前先 `git status --short`
     - 大 commit 用 foreground 不用 background
     - **commit 前再 `git status --short`** 验证 scope (Apr 11 事故同模式)
     - 用 `git add <specific>` 不用 `git add .`
     - 必要时 `git add -p` 选择性 stage hunks
   - `api-response-handling.md` — `{success, data, message}` 统一格式
   - `python-services-architecture.md` — Python 仅 8083 端口, 不分新端口
   - `database-entity-sync.md` — PostgreSQL, FORCE RLS 所有 dim_*/fact_*/agg_* 表
   - `field-naming-convention.md` — entity camelCase, DB snake_case, JSON camelCase
   - `server-operations.md` — 双环境 prod 10010+8083 / test 10011+8084, **重大改动先 test 后 prod**
   - `CREDENTIAL-MANAGEMENT.md` — 凭证从 .env 不 hardcode

2. **Subagent 并行策略** (在 B chat 内部用):
   - Multi-Agent 实体解析 (5 个 agent 可并行)
   - 4 个 Silver writer 完全独立, 可并行
   - 标注 SOP 跟工程并行
   - 测试

3. **Commit 节奏** (按 03-B §11 milestone):
   - Day 5 commit: ALIAS 扩展 + 标注 schema
   - Day 14 commit: B1 baseline + Shape Detector
   - Day 16 commit: B1 holdout 结果 + B2 决策
   - Day 30 commit (条件): B2 升级
   - Day 45 commit: 4 writer + 4 MVP 模板
   - Day 53 commit: M2 全过, ship B

4. **Smoke Gate (M2 7 项)**:
   - 见 01-roadmap §7 M2

5. **遇到问题立即 ask user**:
   - spec 有错或不一致
   - 03-B v1.2 §13 已知未决 11 项 (BU1-12) — implementer 责任
   - prod 改动前的最终确认

## 第一步立即做

读完 10 个必读文件后, **立即执行**:

1. 验证 A chat 已交付的 (B 依赖):
   - `cd backend/python && python -c "from smartbi.canonical.aliases import ALIAS_TO_ATTR; print(len(ALIAS_TO_ATTR))"` 应输出 106 (Day 0)
   - `python -c "from smartbi.capability.contract import RequiresSpec; r = RequiresSpec(all=['x']); print(r.is_satisfied_by({'x'}))"` 应 True
   - `git log --oneline | grep "数据织网" | head -5` 应见 Day 2/3/4 + conftest fix

2. 开始 Phase 1 Day 1:
   - 读 03-B spec §3 (Shape Detector) + §4 (Silver Writer) + §6 (标注 SOP)
   - 派 subagent #1: 写 ALIAS 扩展 (review/finance/inventory 字段)
   - 派 subagent #2: 写 `entity_resolution_labels` 表 schema migration
   - 派 subagent #3: 写标注数据集准备脚本 (从 prod dim_product / dim_store 抽样 + 扰动生成)

3. 阶段性 commit (Day 1 末):
   - `feat(数据织网 B): Day 1 — ALIAS 扩展 + 标注 schema`
   - **commit 前必须** `git status --short` 验证 staged 区只有你的工作 (Apr 24 事故教训)

## 与用户的沟通

- 用 **简短中文** 报告进度, 不要长 markdown
- 关键 milestone 暂停问 user (B1 holdout 后 / B2 升级前 / M2 ship 前)
- spec 有疑问立即问, 不假设
- prod 改动前必须 user 明确同意

## 不要做的事

- ❌ 不要重写 spec — 03-B v1.2 是权威源, 实施按它来
- ❌ 不要修改 A chat 正在标的 17 个 templates (列表见上)
- ❌ 不要在 prod 上做未测试的改动 (server-operations.md 强制 test 先行)
- ❌ 不要 push 到 origin — 等 user 明确说"push" 才推
- ❌ 不要重做 A 的工作 (ALIAS / RequiresSpec / Calculator 已 ship, B 直接复用)
- ❌ 不要做 03-B spec out-of-scope 的事 (例如 cell-level provenance 是 C 范围)

## 紧急联络

如果遇到:
- spec 写错 / Bug 阻塞 / prod 数据 surprise → 先停下来报告 user
- A 与 B 冲突 (同时改同一文件 / commit 顺走) → 立即 `git status` + 报告

---

**现在请开始**: 读完 10 个必读文件, 然后立即执行"第一步立即做"的 3 个 subagent + 主 chat 协调.

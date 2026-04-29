# UAT findings + 4 gap fix design (post Apr 26 A spec ship)

**Date**: 2026-04-26
**Trigger**: Real-data UAT with `东门口2月商品销量报表.csv` (560KB, 3461 rows) on test env (factory_admin1 / F001).

---

## Part 1: UAT findings

### What worked ✅

1. **Upload pipeline E2E**: FE `/smart-bi/upload` → 4-step wizard → file selected → 70% upload → 100% → backend parse (~37s) → Step 2 reached
2. **Auto field detection**: 19 columns recognized + auto-typed (文本/数字)
3. **Domain auto-detect**: SALES type auto-classified by `domain_detector` (RESTAURANT, dim_hits=5, measure_hits=2)
4. **Materializer**: 6/35 templates applicable, persisted (combo_usage_rate ✓, others SKIP)
5. **Capability endpoint via nginx proxy**: 200 with full JSON
6. **Cross-tenant guard**: 403 (factory_admin1 → /capability/F002)
7. **Admin audit page**: rendered 26 fields + 28 cards manifest + 5 page groups, all satisfied for F001
8. **Capability cache invalidate hook (P0+P0-followup)**:
   - Async Python path (excel_async.py _async_worker_impl) — committed 8f36c6fd2
   - Java→Python reclassify path (materialized_analytics.py /reclassify) — committed 84647edee
   - Verified live on test env: `[reclassify] upload 3986: invalidated capability cache for factory=F001`

### What was incomplete (now fixed)

**P0-followup gap** (caught by UAT, fixed Apr 26 commit `84647edee`):
- Original P0 commit `8f36c6fd2` only covered Python async path (excel_async.py)
- Real upload via FE went through Java backend → POST /reclassify (not Python's async path)
- Hook didn't fire on real customer flow → silent 5min TTL stale window
- Fix: added identical hook in materialized_analytics.py reclassify_upload endpoint
- Now both upload paths covered

### What still bypasses the hooks (acceptable — TTL fallback)

| Path | Trigger | Behavior |
|---|---|---|
| Bulk Java cleanup `SmartBiPgExcelUploadRepository.@Query DELETE` | Time-based old data purge | TTL expires within 5min, acceptable |
| Field re-mapping admin endpoint | Future feature | Add hook when feature ships |

---

## Part 2: 4 Gap fix design (B/C/D scope)

These gaps ARE in the spec roadmap (B/C/D) but NOT in A. Here's HOW each would be fixed.

### Gap 1: 跨店识别 (cross-upload store name normalization)

**Problem**: 桂满陇 has 100+ stores. Upload shows "桂满陇(陆家嘴正大广场店)" vs "桂满陇陆家嘴店" vs "桂满陇 陆家嘴" vs "lujiazui店". System currently treats as 4 different stores → wrong KPIs.

**Where the fix lives**: **Sub-Project B** (实体解析). Specifically:
- `backend/python/smartbi/canonical/entity_resolution/orchestrator.py` (B-baseline)
- B1 baseline uses 2 agents: DeterministicAgent (alias_normalizer升级) + EmbeddingAgent (Qwen text-embedding-v3 + 余弦)
- B2 升级 (条件触发, 准确率 < 88% holdout 时): + ContextualAgent (店名+城市+区 上下文 embedding) + TransitiveAgent (闭包) + LLMArbitrator

**Implementation steps**:
1. 抽 500 对真店名 (从 prod dim_store + 大众点评数据生成扰动)
2. 双盲标注, 60/20/20 split
3. B1 baseline 跑 holdout, ≥ 88% ship; < 88% 进 B2
4. 整合到 `dim_resolver.py` (现有 UPSERT path)
5. Admin 裁决 UI (低置信度配对队列)

**工作量**: B1 baseline 1.5-2 周; B2 +1-1.5 周. spec 03-B §2 详.

**与 A 的关系**: 不动 A. B 完成后客户上传 N 个文件后, dim_store 自动归一. A 的 capability 不变 (仍按字段集计算).

---

### Gap 2: 跨形态融合 (multi-shape data fusion)

**Problem**: 客户上传 商品销量 + 评论 + 财务 三种文件. 当前各自单独看, 无 "评分高但卖差的菜" 类跨形态分析.

**Where the fix lives**: **Sub-Project B (Shape Detector + Router)** + **D (Federated Query)**:
- B 部分 (`smartbi/canonical/shape_detector.py`): LLM-driven, 7 形态 (账单流水/商品汇总/评论/财务/库存/排班/会员)
- B 部分 (`smartbi/canonical/silver_writers/`): 5 个新 Silver writer (ProductSummaryWriter / ReviewWriter / FinanceWriter / InventoryWriter / ScheduleWriter)
- D 部分 (`smartbi/federated/query_planner.py`): auto-join 跨表 via entity_id (B 产物)

**Implementation steps**:
1. **B Shape Detector**: 现有 RestaurantRuleDetector 升级为 LLM-augmented (qwen-plus). 不识别置信度 < 0.7 进 admin 裁决.
2. **B 5 个 Writer**: 每个对应一个新 Silver 表 (e.g. dim_review_summary 评论 / fact_finance_voucher 财务). Schema 含 entity_id (来自 B Entity Resolution).
3. **B 4 MVP 模板** (1 个/形态): 解锁基础分析. 不依赖 D.
4. **D 完成后**: cross-shape 模板可写 (e.g. "评分高但卖差的菜" join dim_review_summary × agg_product_period via product_id)

**工作量**: B 形态识别 + 5 writer + 4 MVP 模板 = 2-3 周; D 跨形态模板 = 1-2 周. spec 03-B §3-4 + 05-D §3 详.

**与 A 的关系**: B 上线新形态后, A 的 `requires` schema 必须扩展 (e.g. 加 `review_text`, `payment_channel`, `inventory_item` canonical 字段). 我已写 14 deferred templates 留 placeholder, B 实施时填上.

---

### Gap 3: 配方 → 毛利推导 (recipe-driven margin cascade)

**Problem**: 客户上传 BOM 配方表 (e.g. 招牌青花椒鱼 = 1.5kg鱼 + ¥35/kg 鱼 + 其他配料 = 配方成本). 当前不会自动应用到 sales records 算 净毛利.

**Where the fix lives**: **Sub-Project C (Field Provenance + Inheritance Cascade)**.
- `smartbi/provenance/field_provenance` 表 (cell-level lineage)
- `smartbi/provenance/cascade_engine.py` (5 类继承)

**Implementation steps**:
1. **C 字段血统**: BOM 上传时, ingredient + cost 写入 `field_provenance` (entity_type=product, field=ingredient_cost, source_upload_id=BOM_upload, valid_from=upload_date, confidence=manual_user=1.0)
2. **C 继承 cascade**: 销售记录 (fact_pos_item) 触发时, query field_provenance 取该 product 的 ingredient_cost (按 valid_from 时间过滤), 自动算 gross_profit = sales - cost
3. **C Trust UI**: KPI 卡显示 "📊 毛利率 38% [来自 BOM 上传 + 销售记录 join, confidence 0.92]"
4. **Conflict resolution**: 多 BOM 上传同 product 不同 cost → 优先级表 (用户手动 > 系统默认 > 行业平均). 30% 差异自动弹审.

**工作量**: C 4.5-6 周 含 §11.5 现有数据回填 (1.31M fact_pos_item 行). spec 04-C §4 详.

**与 A 的关系**: A 的 `requires` 加 `ingredient_cost` canonical (B-stage 同时定义); C 上线后 KPI 卡显示 confidence 标签 (UI 改造).

---

### Gap 4: NL 任意问答 (free-form NL → SQL)

**Problem**: 客户问 "昨天哪道菜亏钱了" / "评分高但卖差的菜". 现需要预设模板 (35 个). 没模板就答不出.

**Where the fix lives**: **Sub-Project D (Federated Query Engine)**.
- `smartbi/federated/query_planner.py` (LLM-augmented Query Planner)
- `smartbi/federated/sql_generator.py` (Logical → Physical SQL)
- `smartbi/federated/confidence_cascade.py` (consume C's ProvenanceValue)

**Implementation steps**:
1. **D Query Planner**: NL 问题 → LLM (qwen-plus 默认, qwen-max 仅复杂 case) → LogicalQueryPlan (measures / dimensions / filters / time_grain)
2. **D SQL Generator**: LogicalQueryPlan → 选粗 agg 表优先, 缺则回退 fact + auto-join via entity_id (B) + time-axis 对齐
3. **D Template DSL**: 现有 35 模板 → 高频前 20 迁移到 declarative DSL (剩余继续 SQL 兜底)
4. **D Confidence Cascade**: 综合 C 的 ProvenanceValue → 输出 confidence + Trust UI
5. **D NL 问答入口**: 复用现有 AIQuery.vue, swap implementation 从 "查模板缓存 fallback LLM 直答" → "Query Planner pipeline"

**工作量**: D 2.5-3 周. spec 05-D §2-4 详.

**与 A 的关系**:
- D 复用 A 的 `requires` 契约 (Template DSL 类的 requires 字段就是 A 的 RequiresSpec list)
- D 跨表 join 后输出可能命中 A 的 `unlock_suggestions` 反向触发 — e.g. 用户问 "评分" 时回答 "需上传评论文件" 而不是空答

---

## Part 3: 路线图 (recommended next 8 weeks)

```
Week 1-3:   B-baseline (entity resolution 2-agent + Shape Detector +
            Multi-shape MVP 1 模板/形态 = 4 模板) → ship M2 baseline
                  ↓
Week 3:     M2 holdout 测试. 准确率 ≥ 88% → ship; < 88% → Week 4-5 B2 升级
                  ↓
Week 4-7:   C 字段血统 + 继承 cascade + §11.5 1.31M 行回填 → ship M3
                  ↓
Week 7-8:   D Query Planner + SQL Gen + 高频 20 模板 DSL 迁移 → ship M4
```

**Critical path 单工程师**: 8 周 (vs 现有完整版 spec 估 13-18 周, 但本 path 跳了部分模板 + 标注 SOP 的重投入)

**关键决策点 (用户必拍)**:
- B-baseline 阈值 = 88% (per spec)
- C 数据回填 30% 差异阈值 (factory-level 可调)
- D LLM 月预算上限 (默认 ¥10K/月 per 100 tenants, spec §9.4)

---

## Part 4: 客户体验进化路径 (你向客户推荐的话术)

| 阶段 | 客户能做的 | 客户看到的体验 |
|---|---|---|
| **现在 (A ship)** | 上传任何文件 → 不见误导 0 数据, 看见 placeholder + CTA 引导 | "上传商品销量报表 即可解锁 6 个分析" |
| **+B (M2)** | 上传 N 个文件 → 自动认同店/同菜/同人; 上传评论/财务/库存 → 自动路由 | "你的 5 家'桂满陇'店已自动合并; 同菜 (一吃)/(二吃) 已归一" |
| **+C (M3)** | 上传 BOM → 销售自动算毛利; 多源同字段冲突 → 优先级解决 + 弹审 | "客单价 ¥147 [来自账单流水, 100% confidence]"; "本月毛利率 38% [来自 BOM × 销售 join]" |
| **+D (M4)** | NL 任意问答 ("昨天哪道菜亏钱了") | 系统自动 plan + join + 答; "我也不知道, 但建议: 上传 X 文件" |

---

## Part 5: 给 B chat / C chat / D chat 的传递

- A 已 ship 的 ALIAS_TO_ATTR (26 fields) — B 扩展到 ~40 (+ review_text/rating/payment_channel/voucher_code/inventory_item/stock_qty/period 等)
- A 已 ship 的 RequiresSpec — B/C/D 加新模板时直接用
- A 已 ship 的 capability_calculator — B/C/D 加新表后只需写 ALIAS, 不动 calculator
- A 已 ship 的 admin audit page — 后续观察 deferred templates 数量, B/C 上线后陆续填实
- 14 deferred 模板 (`requires=None`) — B/C 完成对应字段后必填:
  - reviews_sentiment_summary → B 加 review_text/rating
  - payment_method_mix → B 加 payment_channel
  - stored_value_card_consumption → B 加 SVC fields
  - refund_analysis → 已有 refund_amount canonical, B 实施时改 None → RequiresSpec(...)
  - inventory_alert / 等 → 待 B 加 inventory_item/stock_qty

---

**结论**: A 已可使用. 修复 4 gap 需 B/C/D 接力 (~8 周 critical path). 推荐 B chat 立即启动 (handoff prompt at `数据织网/implementation/b-chat-startup-prompt.md`).

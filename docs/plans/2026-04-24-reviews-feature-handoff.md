# qhj SmartBI — P2 Guardrail + Reviews Ingestion Handoff (Apr 24 2026 late session)

**状态**: 5 commits `c0b4a64d4` → `28b389b8f` 全部 push origin + prod live. Test env 真数据 end-to-end 验证完成(upload 3975 / 12,903 评论行 materialize 正常).

**分支**: `e2e/v1-framework` (HEAD `28b389b8f`)

---

## 本次交付

### 1. P2 LLM 数字幻觉 guardrail (`f7228ad51`)
- **风险场景**: 观察 prod 上 LLM 答 `"Top5 门店合计 3.4 亿元"`,实际 Top5 合计 34M,10× 夸大
- **双层防御**:
  1. Prompt 硬约束 — 5 个分析师 `system_prompt` (general-analysis / drill-down / root-cause / benchmark / multi-insight) 都附加 `NUMERIC_GUARD_CLAUSE`: 禁止乘法/外推,禁止 "亿" 单位除非聚合段明确出现 ≥1 亿
  2. 后置正则 sanity check — `detect_numeric_hallucination(answer, agg_lines)` 扫 `\d+亿` / `\d+千万`,若超过 agg_lines 最大值 × 2 则标记
- **Wire format**: streaming `done` SSE 事件新增 `warning` 字段(null 为正常,字符串为告警). FE `AIQuery.vue` 在 `el-alert type=warning` 渲染
- **单测**: 14 cases `test_llm_guard.py`(3.4亿 on 36M caught / 1.2亿 on 150M passes / 千万过阈 / 空 agg 跳过 / 多违反全列)

### 2. 回归 smoke 矩阵 (`af7897a74`)
- `p2-guardrail-smoke.mjs` — 18 tests(login / AIQuery / 预设 / autocomplete / LLM 真调 / warning wire)
- `p2-guardrail-full.mjs` — 94 tests:18 模板路由 + 15 父 follow-up + 45 pill follow-up + 8 预设 + LLM fallback + health
- Fresh `chromium.launch()` 独立 profile,无 MCP browser 工具,和其他 chat Playwright 并行零冲突

### 3. 2 个路由 bug 修复 (`05b14c356`)
- **R13** `哪个菜品类别卖得多` → dish_sales_top_n ⇒ dish_category_breakdown
  - group-2 加 `卖/多/最多` + 重排在 dish_sales_top_n 之前
- **R17** `营收结构报表` → profit_loss_statement ⇒ revenue_management_report
  - `营收结构` 从 profit_loss 的 group-1 移除(语义上是 breakdown,归 revenue_management)
  - profit_loss 保留 利润/毛利/净利/损益/应收/实收/到账率/毛利率

### 4. Reviews 摄入全链路 (`eb10e2ff2` + `28b389b8f`)

**Template (`reviews_sentiment_summary.py`)**:
- `_STORE_CANDIDATES` 加 `具体门店` (大众点评导出标准列)
- 新增 `菜品标签` Top 15 抽取(explode + count)+ `最常提及菜品` / `最常提及菜品次数` kpi
- KPI 中文化: `评价总数 / 平均星级 / 投诉率 / 最低评分门店 / 好评榜达标门店数 / 必吃榜候选门店数 / 黑珍珠候选门店数`
- `sample_queries` 从 6 扩到 12: 加 `客户评价怎么样 / 用户评价分析 / 哪些菜评价最多 / 差评分析 / 门店评分排名 / 评分最高的门店`

**RAG keyword 规则 (`query_router.py`)**:
- reviews_sentiment_summary group-2 加 `怎么样/如何/情况/排名/最多`

**语义映射器 (`semantic_mapper.py`)**:
- **根因修复**: `_classify_by_priority_regex` 不再把中文原名强改为英文 standard name. 4 处 priority pattern 返回 `col`(原中文名)而非 `amount_score`/`id_name`/`category_name`. 保留时间 `time_period` 待 follow-up
- Field classifier 加 `星级/口味分/环境分/服务分` 到 `_MEASURE_KEYWORDS` 做 defensive 分类

**Test env 端到端验证 (upload 3975)**:
- xlsx `评价下载2025.07.01-2025.09.30_1328220_1773721054386.xlsx` (4MB, 12,904 行, 30 列) 经 FE 上传 → Java → Python → DB
- field_definitions 正确保留中文: `星级分`(measure=t) / `口味分`/`环境分`/`服务分`(measure=t) / `评价门店`/`菜品标签`/`评价详情`/`投诉状态`/`平台`/...
- reviews_sentiment_summary materialize 成功: `评价总数=12903, 平均星级=4.83, 最常提及菜品=味道好`
- 查询 `客户评价怎么样` 返回正确的 12,903 条 + 4.83 均值 + 星级分布(79.64% 5星 / 18.78% 4星)

---

## Prod 状态

| 环境 | Python | Web-admin | DB state |
|---|---|---|---|
| Prod (admin.cretaceousfuture.com) | 8083 @ `28b389b8f` | 8086 @ `eb10e2ff2` | `smart_bi_template_embeddings` 240 行(含 12 条 reviews 样本),qhj upload 4169 re-materialized |
| Test | 8084 @ `28b389b8f` | 8097 @ 同 | 242 行 embeddings + upload 3975 (review xlsx 验证) + 3970 (POS) |

**回滚手册**: `git revert 28b389b8f..f7228ad51` + `deploy-smartbi-python.sh --env prod` + `TRUNCATE smart_bi_template_embeddings` + `systemctl restart cretas-python`

---

## 下 session 开工 backlog(按优先级)

### P0 — Template 缓存 fast-path 对评论查询失效
**问题**: test upload 3975 的 reviews_sentiment_summary 已 materialize 成功(DB 可见 cache row),但 FE 查询 `客户评价怎么样` 走 LLM 路径(12s)而非 template cache(200ms). prod 4169 没 review upload 暂时无法测,但 test 3975 确实可复现.

**调查方向**:
```python
# chat.py:1053-1058 — match_template_hybrid 调用
matched_code = await match_template_hybrid(user_q, pool)  # returns what for "客户评价怎么样" + upload=3975?
# chat.py:1066-1070 — cache 加载
cached_results = await load_materialization_results(pool, upload_id, factory_id=factory_id)
# 对 review-type 是否有 factory_id 过滤问题?
```

**检查步骤**:
1. 加一行 `logger.info(f"[stream] matched_code={matched_code}, cached_keys={list(cached_by_code.keys())}")` 在 chat.py:1069
2. Deploy test + 发 `客户评价怎么样` + grep log
3. 如果 matched_code is None: RAG 问题(可能 hybrid_match 的 similarity 阈值没覆盖 review 样本)
4. 如果 cached_by_code 不含 reviews_sentiment_summary: persistence 过滤问题(factory_id scope?)

**预期影响**: 评论查询延迟从 12s 降到 200ms,用户体验大幅提升. 同时降低 LLM 成本.

### P1 — Slice 3: Cross-upload 联合分析
**需求**: 用户希望 `店铺 A 营收 vs 评分` 之类的复合查询. POS 在 upload 3970 / 4169(不同店),评论在 upload 3975.

**3 个设计选项**:
- **A. Pre-join at upload time**: 上传评论时检测同 factory 已有 POS upload,join 到 fact_store_with_reviews 表. 查询快,但新 schema
- **B. Template-time join**: 模板 compute() 动态发现同 factory 其他 uploads 加载. 查询慢,无 schema 改动
- **C. Agent-level composition**: 保持独立模板,Agent orchestrator 并行跑多个模板后 LLM 合成. 已有 Week 5 Agent layer 做这个, 只需加 review-aware prompt 触发

**推荐 C** — 利用现有基建,最低风险. `AgentOrchestrator.compose_executive_insight()` 加 review-related query 识别,触发时并行 run store_performance + reviews_sentiment_summary,再 LLM 合成.

### P1 — Slice 4: Multi-merchant 字段识别抽象
**现状**: reviews_sentiment_summary `_STORE_CANDIDATES` 硬编码 `("具体门店", "评价门店", "门店名称", "店铺名称")`. 其他商家导出格式可能不同.

**方案**: 改模式匹配
```python
def _find_by_pattern(cols, patterns):
    for p in patterns:
        for c in cols:
            if re.search(p, c): return c
    return None

_STORE_PATTERN = (r'.*(门店|店铺|门市|分店).*',)
_STAR_PATTERN = (r'.*(星级|评分|分数).*',)
```

需覆盖: 大众点评 / 美团 / 抖音 / 小红书 / 不同时期导出格式变体.

### P2 — 新模板(handoff 里提过)
1. **turnover(翻台率)** — 需要 `桌位 + 时段 + 账单数` 三字段. qhj POS 已有.
2. **reviews_external(第三方评论 API)** — 接入美团/大众开放平台 (需商家授权 + OAuth + webhook + hourly poll). 参考 handoff 美团 API 实现.
3. **single_store_detail(单店深度)** — 聚合该店的 revenue / 评分 / 员工 / 菜品 / 异常事件 等多维度.

### P2 — 路由测试修复
2 个 unit test 预存在 failure(不是本 session 引入):
- `test_table_type_query`: 期望 `包厢跟大厅...` → table_type_comparison,实际 dish_by_table_type
- `test_generic_trend_query`: 期望 `营业额的月度走势...` → monthly_trend,实际 period_comparison_trend

两个都是路由排序问题,非本 session scope,但值得清理.

---

## 关键文件索引

### 本 session touched
```
backend/python/smartbi/
├── api/
│   └── chat.py                         # 5 system_prompts + NUMERIC_GUARD_CLAUSE + warning field
├── services/
│   ├── llm_guard.py                    # NEW — detect_numeric_hallucination + CLAUSE constant
│   ├── semantic_mapper.py              # preserve original Chinese (4 priority patterns)
│   ├── field_classifier.py             # + 星级/口味分/环境分/服务分 measure keywords
│   ├── materialized_analytics/
│   │   ├── query_router.py             # R13/R17 fixes + review keyword widen
│   │   └── templates/
│   │       ├── reviews_sentiment_summary.py  # 具体门店 + 菜品标签 + 中文 KPI + 12 sample_queries
│   │       ├── profit_loss_statement.py      # drop 营收结构 from sample
│   │       ├── revenue_management_report.py  # add 营收结构报表 / 收入结构
│   │       └── test_reviews_sentiment_live.py # NEW — 6 live tests on real xlsx
│   └── tests/
│       └── test_llm_guard.py           # NEW — 14 guardrail unit tests

web-admin/src/views/smart-bi/AIQuery.vue      # warning el-alert + ChatMessage.warning type

tests/e2e-comprehensive/
├── p2-guardrail-smoke.mjs              # NEW — 18 tests
├── p2-guardrail-full.mjs               # NEW — 94-test matrix
└── reviews-upload-e2e.mjs              # NEW — xlsx upload flow
```

### 参考既有
- `backend/python/smartbi/agent/orchestrator.py` — Slice 3 基建参考
- `backend/python/smartbi/services/materialized_analytics/materializer.py` — 理解 materialize 流程
- `backend/python/smartbi/services/materialized_analytics/persistence.py::load_materialization_results` — cache lookup,调查 P0 fast-path issue 入口

---

## 快速上手命令

```bash
# 当前状态
cd C:/Users/Steve/my-prototype-logistics
git status               # branch e2e/v1-framework, HEAD 28b389b8f
git log --oneline c0b4a64d4..HEAD  # 5 本次 commit

# 部署
./scripts/deploy/deploy-smartbi-python.sh --env prod
./scripts/deploy/deploy-web-admin.sh --env prod     # 需要输 YES-PROD

# TRUNCATE embeddings (sample_queries 改动后必须)
ssh root@47.100.235.168 "sudo -u postgres psql -d smartbi_prod_db -c 'TRUNCATE smart_bi_template_embeddings;' && systemctl restart cretas-python"

# 重 materialize (template compute 改动后)
# 浏览器 console (已登录 prod):
# fetch('/smartbi-api/api/smartbi/analytics/materialize/4169', {method:'POST', headers:{'Authorization':'Bearer '+localStorage.getItem('cretas_access_token')}})

# Smoke verify prod
TARGET_URL=https://admin.cretaceousfuture.com node tests/e2e-comprehensive/p2-guardrail-full.mjs

# Test env reviews 端到端
node tests/e2e-comprehensive/reviews-upload-e2e.mjs  # 需要 test Java 10011 + Python 8084 都健康
```

## 用户可立即使用的

前往 `admin.cretaceousfuture.com` → 智能数据分析 → "上传新文件" → 选:
- `smartbi维度分析/大众点评/真实餐饮连锁数据/青花椒/评价下载2025.07.01-2025.09.30.xlsx`
- 或 Q4 `评价下载2025.10.01-2025.12.31.xlsx`

系统自动识别为评论数据,materialize,用户问 `客户评价怎么样/评分最高的门店/哪些菜评价最多/差评分析` 等即可得到基于真实评论的分析(目前走 LLM 路径 ~12s 延迟,下 session fast-path 优化后 ~200ms).

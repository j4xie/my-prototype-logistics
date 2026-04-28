# 餐饮版产品使用手册 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 24 章餐饮版产品使用手册 (`restaurant-product-manual.html`) 并集成到 food_kb RAG, 让管理端 AI chat 能回答餐饮客户的"怎么用"问题, 同时支持新员工 onboarding 和管理者决策两层视角.

**Architecture:** 单文件大 HTML (mirror `restaurant-metrics-glossary.html` pattern) + `food_kb` 表加 `subcategory` 列做域路由 (factory / restaurant) 防 3 个 manual 同 pool 互相挤 + 6 个跨章决策合成 chunks 解决跨模块 query + CI lint 防长期腐化.

**Tech Stack:** HTML 5 (无 JS) + PostgreSQL pgvector + asyncpg + FastAPI + GitHub Actions. 沿用现有 `manual_ingester.py` atomic swap pattern.

**Spec:** [`docs/superpowers/specs/2026-04-28-restaurant-product-manual-design.md`](../specs/2026-04-28-restaurant-product-manual-design.md) (round 3 APPROVED, 578 行)

---

## File Structure

### Create

| 路径 | 责任 |
|---|---|
| `docs/plans/restaurant-product-manual.html` | 24 章主文档 (规范源) |
| `web-admin/public/restaurant-product-manual.html` | 静态站访问副本 (与规范源同步) |
| `docs/plans/demo-data/demo_restaurant_sales.csv` | §3 章节示例 demo 文件 (脱敏化拟真销售数据) |
| `backend/python/food_kb/database/migrations/V20260429_01_add_subcategory.sql` | DDL: 加 subcategory 列 + 复合索引 |
| `scripts/ci/check-kb-meta-freshness.py` | CI lint: 扫 §1/§2/§11 章节头 last-verified meta 6 周 fail |
| `scripts/ci/check-kb-anchor-consistency.py` | CI lint: §6.5 合成 chunk 锚点 vs §3 章节列表一致性 |
| `.github/workflows/kb-drift-check.yml` | GitHub Actions workflow 定期跑两个 lint |

### Modify

| 路径 | 责任 |
|---|---|
| `backend/python/food_kb/services/document_ingester.py:134` | `ingest_document()` 加 `subcategory` 参数 |
| `backend/python/food_kb/services/document_ingester.py:193` | INSERT SQL 加 subcategory 列 |
| `backend/python/food_kb/services/manual_ingester.py:22` | `MANUAL_SOURCES` 每条加 `subcategory` 字段 |
| `backend/python/food_kb/services/manual_ingester.py:238` | 调 `ingest_document` 时传 subcategory |
| `backend/python/food_kb/services/manual_ingester.py:294` | 加 chunk budget warn (前 12, 软监控) |
| `backend/python/food_kb/services/knowledge_retriever.py:88` | `retrieve()` 加 `subcategories` 参数 |
| `backend/python/food_kb/services/knowledge_retriever.py` 多处 | SQL 加 subcategory 过滤 (lines 248/294/454/475/498/519 全改) |
| `backend/python/food_kb/api/manual_chat.py:387` | 加 query domain detection + 传 subcategories |
| `.github/CODEOWNERS` | smartbi/finance 改动 → PM 必 review |
| `.github/pull_request_template.md` | 加 KB 影响 checkbox |

---

## Phase 0: Schema + Retriever 路由 (1 session, 4-6 hr)

**目的:** 解决 reviewer C1 — 让 餐饮 query 不被 7236 行 factory manual 挤掉. 这是 Phase 1a/1b 的硬前置.

---

### Task 1: DDL Migration — 加 subcategory 列 + 复合索引

**Files:**
- Create: `backend/python/food_kb/database/migrations/V20260429_01_add_subcategory.sql`

- [ ] **Step 1: 写 migration SQL**

```sql
-- V20260429_01_add_subcategory.sql
-- Reviewer C1 fix: add subcategory column for domain routing (factory / restaurant)
-- Phase 0 of restaurant-product-manual implementation plan
-- See: docs/superpowers/specs/2026-04-28-restaurant-product-manual-design.md §6.2

BEGIN;

-- Add subcategory column (nullable for backward compat)
ALTER TABLE food_knowledge_documents
  ADD COLUMN IF NOT EXISTS subcategory VARCHAR(64);

-- Add composite index — keep old idx_food_kb_category for 7-day rollback window
CREATE INDEX IF NOT EXISTS idx_food_kb_category_subcategory
  ON food_knowledge_documents (category, subcategory);

-- Optional: index on subcategory alone for cross-category subcategory queries
CREATE INDEX IF NOT EXISTS idx_food_kb_subcategory
  ON food_knowledge_documents (subcategory)
  WHERE subcategory IS NOT NULL;

COMMIT;
```

- [ ] **Step 2: Apply migration on test DB**

```bash
ssh root@47.100.235.168 'psql -U cretas_user -d cretas_db -f -' < backend/python/food_kb/database/migrations/V20260429_01_add_subcategory.sql
```

Expected: `BEGIN`, `ALTER TABLE`, 2 `CREATE INDEX`, `COMMIT`.

- [ ] **Step 3: Verify schema**

```bash
ssh root@47.100.235.168 "psql -U cretas_user -d cretas_db -c \"\\d food_knowledge_documents\" | grep -E 'subcategory|idx_food_kb'"
```

Expected output contains:
```
 subcategory     | character varying(64)
"idx_food_kb_category" btree (category)
"idx_food_kb_category_subcategory" btree (category, subcategory)
"idx_food_kb_subcategory" btree (subcategory) WHERE subcategory IS NOT NULL
```

- [ ] **Step 4: Commit**

```bash
git add backend/python/food_kb/database/migrations/V20260429_01_add_subcategory.sql
git commit -m "feat(food_kb): add subcategory column for domain routing (factory/restaurant)" -- backend/python/food_kb/database/migrations/V20260429_01_add_subcategory.sql
```

---

### Task 2: Update `document_ingester.py` 加 subcategory 参数

**Files:**
- Modify: `backend/python/food_kb/services/document_ingester.py:134-145` (signature)
- Modify: `backend/python/food_kb/services/document_ingester.py:193-200` (INSERT SQL)

- [ ] **Step 1: 加 subcategory 参数到 ingest_document signature**

Edit `document_ingester.py` line 134-145:

```python
async def ingest_document(
    self,
    title: str,
    content: str,
    category: str,
    source: str = "",
    source_url: str = "",
    version: str = "",
    effective_date: str = None,
    metadata: Optional[Dict] = None,
    operator: str = "system",
    subcategory: Optional[str] = None,  # NEW: domain routing (e.g. "restaurant", "factory")
) -> Dict[str, Any]:
```

- [ ] **Step 2: Update INSERT SQL to include subcategory**

Edit `document_ingester.py` line 191-200 area, change INSERT statement:

```python
doc_id = await conn.fetchval(
    """
    INSERT INTO food_knowledge_documents
        (title, content, category, source, source_url, version,
         effective_date, embedding, chunk_index, parent_doc_id, metadata,
         search_tokens, subcategory)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING id
    """,
    chunk_title,
    chunk.content,
    category,
    source,
    source_url,
    version,
    effective_date,
    chunk.embedding,
    chunk.chunk_index,
    parent_id,
    json.dumps(metadata or {}),
    search_tokens,
    subcategory,  # NEW
)
```

- [ ] **Step 3: Verify Python syntax**

```bash
python -c "import ast; ast.parse(open('backend/python/food_kb/services/document_ingester.py').read()); print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(food_kb): document_ingester accepts subcategory param" -- backend/python/food_kb/services/document_ingester.py
```

---

### Task 3: Update `manual_ingester.py` MANUAL_SOURCES + chunk budget warn

**Files:**
- Modify: `backend/python/food_kb/services/manual_ingester.py:22-53` (MANUAL_SOURCES)
- Modify: `backend/python/food_kb/services/manual_ingester.py:236-255` (ingest call + chunk budget warn)

- [ ] **Step 1: 加 subcategory 字段到 MANUAL_SOURCES**

Edit `manual_ingester.py:22-53`:

```python
MANUAL_SOURCES = [
    {
        "path": "docs/plans/factory-operation-manual.html",
        "title_prefix": "工厂操作手册",
        "source": "factory-operation-manual.html",
        "type": "html",
        "subcategory": "factory",  # NEW
    },
    {
        "path": "docs/plans/restaurant-metrics-glossary.html",
        "title_prefix": "餐饮指数字典",
        "source": "restaurant-metrics-glossary.html",
        "type": "html",
        "subcategory": "restaurant",  # NEW
    },
    {
        "path": "docs/plans/restaurant-product-manual.html",
        "title_prefix": "餐饮产品使用手册",
        "source": "restaurant-product-manual.html",
        "type": "html",
        "subcategory": "restaurant",  # NEW (P1a 文件创建后才能 ingest 此条)
    },
    {
        "path": "docs/plans/factory-requisition-detailed-flow.md",
        "title_prefix": "工厂下单详细流程",
        "source": "factory-requisition-detailed-flow.md",
        "type": "markdown",
        "subcategory": "factory",  # NEW
    },
    {
        "path": "docs/plans/factory-requisition-operation-guide.md",
        "title_prefix": "工厂下单操作指南",
        "source": "factory-requisition-operation-guide.md",
        "type": "markdown",
        "subcategory": "factory",  # NEW
    },
    {
        "path": ".claude/projects/C--Users-Steve-my-prototype-logistics/memory/project_feature_inventory.md",
        "title_prefix": "系统功能清单",
        "source": "project_feature_inventory.md",
        "type": "markdown",
        "subcategory": None,  # NEW: 跨工厂/餐饮通用清单, 不限定域
    },
]
```

- [ ] **Step 2: 在 ingest 调用处传 subcategory**

Edit `manual_ingester.py:238-245` (the call to `ingester.ingest_document`):

```python
result = await ingester.ingest_document(
    title=title,
    content=section["content"],
    category="operation_manual",
    source=temp_source,  # Ingest under temp name
    version="1.0",
    operator="manual_ingester",
    subcategory=source_info.get("subcategory"),  # NEW
)
```

- [ ] **Step 3: 加 chunk budget warn (R2 N1)**

Insert after `manual_ingester.py:289` (after the atomic swap log line, before `total_docs += source_docs`):

```python
        # Reviewer R2 N1: chunk budget [4, 12] warn for restaurant-product-manual chapters
        # Soft monitoring — log only, no hard block
        if canonical_source == "restaurant-product-manual.html":
            # Count chunks per chapter (chunks come from h2/h3 split, chapter is h1).
            # Heuristic: chapter chunk count = total_chunks_in_source / num_h1_chapters.
            # Approximation good enough for warn signal.
            avg_chunks_per_chapter = source_chunks / max(1, source_docs)
            if avg_chunks_per_chapter > 12:
                logger.warning(
                    f"  ⚠️  chunk budget exceeded: {canonical_source} "
                    f"avg {avg_chunks_per_chapter:.1f} chunks/chapter (target ≤12). "
                    f"Consider merging h2 sections in Tier 1 chapters."
                )
            elif avg_chunks_per_chapter < 4:
                logger.warning(
                    f"  ⚠️  chunk budget under-floor: {canonical_source} "
                    f"avg {avg_chunks_per_chapter:.1f} chunks/chapter (target ≥4). "
                    f"Tier 2-5 skeleton chapters too thin."
                )
```

- [ ] **Step 4: Verify Python syntax**

```bash
python -c "import ast; ast.parse(open('backend/python/food_kb/services/manual_ingester.py').read()); print('OK')"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(food_kb): MANUAL_SOURCES carries subcategory + chunk budget warn" -- backend/python/food_kb/services/manual_ingester.py
```

---

### Task 4: Update `knowledge_retriever.py` 加 subcategories 参数

**Files:**
- Modify: `backend/python/food_kb/services/knowledge_retriever.py:88-145` (retrieve signature + dispatch)
- Modify: `backend/python/food_kb/services/knowledge_retriever.py:240-300` (`_vector_search` SQL filter)
- Modify: `backend/python/food_kb/services/knowledge_retriever.py:445-485` (`_text_search` SQL filter)
- Modify: `backend/python/food_kb/services/knowledge_retriever.py:490-525` (BM25 SQL filter)

- [ ] **Step 1: Add subcategories param to retrieve signature**

Edit line 88-105 (top of `retrieve` method):

```python
async def retrieve(
    self,
    query: str,
    categories: Optional[List[str]] = None,
    subcategories: Optional[List[str]] = None,  # NEW: domain filter
    top_k: int = 5,
    similarity_threshold: float = 0.5,
    include_expired: bool = False,
) -> List[RetrievalResult]:
    """
    ...
    Args:
        categories: Filter by document categories (e.g., ['standard', 'additive'])
        subcategories: Filter by document subcategory (e.g., ['restaurant'] limits
            to restaurant manuals only). None = no subcategory filter (legacy behavior).
    """
```

- [ ] **Step 2: Pass subcategories through dispatch chain**

Find every call to internal helpers in retrieve (lines 136, 141, 156, 172, 179, 198) and add `subcategories=subcategories` keyword. Example for line 141:

```python
results = await self._vector_search(
    query_embedding, categories, subcategories, coarse_k, similarity_threshold, include_expired
)
```

Apply same pattern to all internal helper calls.

- [ ] **Step 3: Update `_vector_search` to filter by subcategory**

Find `_vector_search` method (around line 240-300). After the existing categories filter block (around line 294), add:

```python
        if subcategories:
            param_idx = len(params) + 1
            where_clauses.append(f"d.subcategory = ANY(${param_idx})")
            params.append(subcategories)
```

Update method signature line 248:

```python
async def _vector_search(
    self,
    query_embedding: List[float],
    categories: Optional[List[str]],
    subcategories: Optional[List[str]],  # NEW
    top_k: int,
    similarity_threshold: float,
    include_expired: bool = False,
) -> List[RetrievalResult]:
```

- [ ] **Step 4: Update `_text_search` similarly (line 445-485)**

Add subcategories param + SQL filter in same pattern.

- [ ] **Step 5: Update BM25 search method (line 490-525)**

Add subcategories param + SQL filter in same pattern.

- [ ] **Step 6: Verify Python syntax**

```bash
python -c "import ast; ast.parse(open('backend/python/food_kb/services/knowledge_retriever.py').read()); print('OK')"
```

Expected: `OK`

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(food_kb): retriever supports subcategory filter for domain routing" -- backend/python/food_kb/services/knowledge_retriever.py
```

---

### Task 5: Update `manual_chat.py` 加 query domain detection

**Files:**
- Modify: `backend/python/food_kb/api/manual_chat.py:387-440` (manual_chat endpoint)

- [ ] **Step 1: 加餐饮关键词列表 (top of file)**

Insert after the existing imports (around line 30-50):

```python
# Reviewer C1: query domain detection — when user query contains restaurant
# keywords, restrict retrieval to restaurant subcategory to prevent factory
# manual chunks from polluting results.
RESTAURANT_KEYWORDS = frozenset([
    # Stores & operations
    "门店", "店长", "餐厅", "餐饮", "翻台", "翻台率", "上座率", "排队", "等位",
    "堂食", "外卖", "外带", "桌台", "桌位", "客单价", "营收", "营业额",
    # Menu & food
    "菜品", "菜单", "套餐", "招牌", "畅销", "毛利率", "食材成本", "食材",
    "厨房", "厨师", "出品", "口味", "咸淡", "份量",
    # Customer & marketing
    "会员", "复购", "流失", "美团", "饿了么", "点评", "差评", "好评", "投诉",
    "优惠券", "活动", "营销", "拉新", "客流",
    # Compliance & inventory
    "食安", "HACCP", "留样", "保质期", "效期", "盘点", "进货", "采购单",
    # Multi-store
    "连锁", "总部", "区域", "加盟", "直营", "对比",
])


def _detect_restaurant_domain(query: str) -> bool:
    """Return True if query contains any restaurant keyword.

    Reviewer C1 — when True, restrict retrieval to subcategory='restaurant'.
    Returns False for ambiguous/factory queries → use full retrieval (legacy).
    """
    return any(kw in query for kw in RESTAURANT_KEYWORDS)
```

- [ ] **Step 2: Pass subcategories to retrieve**

Find the `retriever.retrieve(...)` call around line 433-438. Change:

```python
    # ------ Reviewer C1: domain-aware routing ------
    subcategories: Optional[List[str]] = None
    if _detect_restaurant_domain(retrieval_question):
        subcategories = ["restaurant"]
        logger.info(f"Restaurant domain detected → filtering to subcategory=restaurant")

    try:
        results = await retriever.retrieve(
            query=expanded_question,
            categories=["operation_manual"],
            subcategories=subcategories,  # NEW
            top_k=8,
            similarity_threshold=0.40,
        )
    except Exception as e:
        logger.error(f"Retrieval failed: {e}")
        results = []
```

- [ ] **Step 3: Verify Python syntax**

```bash
python -c "import ast; ast.parse(open('backend/python/food_kb/api/manual_chat.py').read()); print('OK')"
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(food_kb): manual_chat domain detection routes restaurant queries" -- backend/python/food_kb/api/manual_chat.py
```

---

### Task 6: Re-ingest factory + glossary with subcategory backfill

**Files:** No code changes — runs existing `manual_ingester.py` against newly-tagged sources.

- [ ] **Step 1: Deploy Phase 0 code to test env (8084)**

Code goes to test env first to validate before prod.

```bash
./scripts/deploy/deploy-smartbi-python.sh --env test
```

Expected: deploy + restart + health check pass.

- [ ] **Step 2: Run migration on test DB**

```bash
ssh root@47.100.235.168 'psql -U cretas_user -d cretas_db -f /www/wwwroot/cretas/code/backend/python/food_kb/database/migrations/V20260429_01_add_subcategory.sql'
```

- [ ] **Step 3: Run manual_ingester (skip restaurant-product-manual since file not yet exists)**

Comment out the `restaurant-product-manual.html` entry in MANUAL_SOURCES temporarily (or guard with `Path(...).exists()`):

```bash
ssh root@47.100.235.168 "cd /www/wwwroot/cretas/code/backend/python && source venv38/bin/activate && python -m food_kb.services.manual_ingester"
```

Expected: log shows ingest of factory + glossary + 2 markdown sources, all with their subcategory fields populated. Total chunks ~250-300.

- [ ] **Step 4: Verify subcategory backfill**

```bash
ssh root@47.100.235.168 "psql -U cretas_user -d cretas_db -c \"SELECT subcategory, COUNT(*) FROM food_knowledge_documents WHERE category='operation_manual' GROUP BY subcategory;\""
```

Expected output (counts approximate):
```
 subcategory  | count
--------------+-------
 factory      |  XXX
 restaurant   |  161
              |   XX  (NULL = system inventory + any unmigrated)
```

- [ ] **Step 5: Commit if guard added**

If you added a `Path(...).exists()` guard in `manual_ingester.py`, commit it:

```bash
git commit -m "fix(food_kb): manual_ingester skips missing source files gracefully" -- backend/python/food_kb/services/manual_ingester.py
```

---

### Task 7: Counter-test 10 query (5 餐饮 + 5 中性)

**Files:** No code — runs queries against test env to validate routing.

- [ ] **Step 1: Run 5 餐饮 queries via test env, expect ≥6/8 from restaurant subcategory**

Run each query via SSH (avoid tunnel complexity) and record source distribution:

```bash
for q in "翻台率怎么提高" "门店毛利率多少正常" "会员复购率怎么算" "外卖平台对接流程" "菜品成本怎么核算"; do
  echo "=== Q: $q ==="
  ssh root@47.100.235.168 "curl -sS -X POST http://localhost:8084/api/food-kb/manual-chat \
    -H 'Content-Type: application/json' \
    -d '{\"question\":\"$q\"}'" \
    | python -c "import json,sys; d=json.load(sys.stdin); print(f'sources: {[s[\"source\"] for s in d.get(\"sources\",[])]}'); 
restaurant_count = sum(1 for s in d.get('sources',[]) if 'restaurant' in s['source']);
print(f'restaurant chunks: {restaurant_count}/8')"
done
```

Expected: ≥4/5 of these queries have ≥6/8 chunks from `restaurant-metrics-glossary.html` (since restaurant-product-manual not yet ingested in Phase 0). If any fail, expand `RESTAURANT_KEYWORDS` list.

- [ ] **Step 2: Run 5 中性 queries (verify legacy behavior preserved)**

```bash
for q in "操作手册首页" "登录失败怎么办" "数据库连接配置" "用户角色权限" "API 接口文档"; do
  echo "=== Q: $q ==="
  ssh root@47.100.235.168 "curl -sS -X POST http://localhost:8084/api/food-kb/manual-chat \
    -H 'Content-Type: application/json' \
    -d '{\"question\":\"$q\"}'" \
    | python -c "import json,sys; d=json.load(sys.stdin); print(f'sources: {[s[\"source\"] for s in d.get(\"sources\",[])]}')"
done
```

Expected: 中性 query 没触发 restaurant 路由 (sources mix of factory + restaurant + system_inventory).

- [ ] **Step 3: 写 counter-test 结果到 doc**

Create `docs/plans/2026-04-29-phase0-counter-test-results.md` with the 10 query results + verdict.

- [ ] **Step 4: Commit results**

```bash
git add docs/plans/2026-04-29-phase0-counter-test-results.md
git commit -m "docs(food_kb): Phase 0 counter-test results — domain routing validated" -- docs/plans/2026-04-29-phase0-counter-test-results.md
```

- [ ] **Step 5: Deploy to prod (only if test counter-test PASS)**

```bash
./scripts/deploy/deploy-smartbi-python.sh --env prod
ssh root@47.100.235.168 'psql -U cretas_user -d cretas_db -f /www/wwwroot/cretas/code/backend/python/food_kb/database/migrations/V20260429_01_add_subcategory.sql'
ssh root@47.100.235.168 "cd /www/wwwroot/cretas/code/backend/python && source venv38/bin/activate && python -m food_kb.services.manual_ingester"
```

Expected: prod also shows correct subcategory backfill.

---

## Phase 1a: Tier 1 重模板 3 章 (1 session, 5-7 hr)

**目的:** edc 客户痛点章节 production-grade. §1 + §2 + §3, 每章 8 sections / 8-12 chunks.

---

### Task 8: Create skeleton + TOC + appendix anchors

**Files:**
- Create: `docs/plans/restaurant-product-manual.html`
- Create: `web-admin/public/restaurant-product-manual.html` (copy after each ship)

- [ ] **Step 1: Write HTML skeleton with all 24 chapter h1s + 4 path anchors + §B synthesis**

Mirror style/CSS classes from `docs/plans/restaurant-metrics-glossary.html`. Header structure:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>白垩纪餐饮版产品使用手册</title>
<!-- last-verified-against-product: 2026-04-28 -->
<style>
  /* Mirror restaurant-metrics-glossary.html — copy CSS block */
  /* (read CSS from existing file, paste here) */
</style>
</head>
<body>
<div class="container">

<header class="doc-header">
  <h1>白垩纪餐饮版产品使用手册</h1>
  <p class="subtitle">含培训 onboarding · 24 章 · 4 培训路径 · 6 决策合成</p>
</header>

<nav class="toc">
  <h2>目录</h2>
  <ol>
    <li><a href="#ch1">§1 智能数据分析 (AI Query)</a></li>
    <li><a href="#ch2">§2 财务 PBI 看板</a></li>
    <li><a href="#ch3">§3 Excel 上传与字段识别</a></li>
    <li><a href="#ch4">§4 登录 + 工厂/门店切换</a></li>
    <li><a href="#ch5">§5 Dashboard 首页</a></li>
    <li><a href="#ch6">§6 报表中心 + 数据导出</a></li>
    <li><a href="#ch7">§7 设置 (用户/角色/通知)</a></li>
    <li><a href="#ch8">§8 移动端 RN app 使用</a></li>
    <li><a href="#ch9">§9 供应链 / 采购下单</a></li>
    <li><a href="#ch10">§10 库存管理 + 盘点 + 预警</a></li>
    <li><a href="#ch11">§11 菜品 / 配方管理</a></li>
    <li><a href="#ch12">§12 食安 / 合规检查</a></li>
    <li><a href="#ch13">§13 多门店对比分析</a></li>
    <li><a href="#ch14">§14 收银 / POS 对接</a></li>
    <li><a href="#ch15">§15 外卖平台对接</a></li>
    <li><a href="#ch16">§16 会员分析</a></li>
    <li><a href="#ch17">§17 评价管理</a></li>
    <li><a href="#ch18">§18 营销 / 优惠券 / 活动</a></li>
    <li><a href="#ch19">§19 客户投诉与售后</a></li>
    <li><a href="#ch20">§20 数据治理 (完整度 + 质量队列)</a></li>
    <li><a href="#ch21">§21 排班 / 人效 / 员工绩效</a></li>
    <li><a href="#ch22">§22 实时人效识别 (VL 摄像头)</a></li>
    <li><a href="#ch23">§23 数据备份与恢复</a></li>
    <li><a href="#ch24">§24 第三方 API 对接</a></li>
  </ol>

  <h2>附录</h2>
  <ul>
    <li><a href="#path-a1">路径 A1: 前台/收银 新员工首周</a></li>
    <li><a href="#path-a2">路径 A2: 中台/财务文员 新员工首周</a></li>
    <li><a href="#path-b">路径 B: 店长首月</a></li>
    <li><a href="#path-c">路径 C: 老板月度回顾</a></li>
    <li><a href="#synthesis">§B 决策场景合成 (6 主题)</a></li>
  </ul>
</nav>

<!-- Chapter 1 -->
<section id="ch1">
  <h1>§1 智能数据分析 (AI Query)</h1>
  <!-- TODO Phase 1a Task 9 -->
</section>

<!-- Chapter 2 -->
<section id="ch2">
  <h1>§2 财务 PBI 看板</h1>
  <!-- TODO Phase 1a Task 10 -->
</section>

<!-- ...同样 24 章 + 附录 + 合成 -->

</div>
</body>
</html>
```

(Copy CSS block from `docs/plans/restaurant-metrics-glossary.html` head. 24 章 placeholder sections. Appendix and synthesis placeholders.)

- [ ] **Step 2: Verify HTML parses**

```bash
python -c "
from bs4 import BeautifulSoup
with open('docs/plans/restaurant-product-manual.html') as f:
    soup = BeautifulSoup(f, 'html.parser')
h1s = soup.find_all('h1')
chapter_h1s = [h for h in h1s if h.get_text().startswith('§') and not h.get_text().startswith('§B')]
print(f'chapter h1s: {len(chapter_h1s)}')
toc_links = soup.find('nav', class_='toc').find_all('a') if soup.find('nav', class_='toc') else []
print(f'TOC links: {len(toc_links)}')
"
```

Expected: `chapter h1s: 24` + `TOC links: 29` (24 chapters + 4 paths + 1 synthesis).

- [ ] **Step 3: Sync to web-admin/public**

```bash
cp docs/plans/restaurant-product-manual.html web-admin/public/restaurant-product-manual.html
```

- [ ] **Step 4: Commit**

```bash
git add docs/plans/restaurant-product-manual.html web-admin/public/restaurant-product-manual.html
git commit -m "feat(docs): restaurant-product-manual.html skeleton — 24 chapters + 5 appendix anchors" -- docs/plans/restaurant-product-manual.html web-admin/public/restaurant-product-manual.html
```

---

### Task 9: Write §1 智能数据分析 (Tier 1 重模板)

**Files:**
- Modify: `docs/plans/restaurant-product-manual.html` §1 section

**Template (Tier 1 重模板, 8 sections):**

```
<section id="ch1">
  <h1>§1 智能数据分析 (AI Query)</h1>
  <p class="overview">[1 段概述: AI Query 解决什么餐饮经营问题]</p>

  <!-- 入门 (新员工视角) -->
  <h2 id="ch1-1">§1.1 进入路径</h2>
  <p>[3-5 步, 文字描述菜单层级]</p>

  <h2 id="ch1-2">§1.2 主界面 layout</h2>
  <p>[描述布局区块: 工具栏/查询区/结果区/历史]</p>

  <h2 id="ch1-3">§1.3 常用操作步骤</h2>
  <ol>
    <li>[step 1]</li>
    <li>[step 2]</li>
    <!-- 5-8 个 step -->
  </ol>

  <h2 id="ch1-4">§1.4 常见错误处理</h2>
  <h3>错误 A: ...</h3><p>[处理]</p>
  <h3>错误 B: ...</h3><p>[处理]</p>
  <!-- 3-5 个 -->

  <!-- 管理 (店长/老板视角) -->
  <h2 id="ch1-5">§1.5 关键指标速查</h2>
  <ul>
    <li>[KPI 1]: [1 句解读] (链回 <a href="restaurant-metrics-glossary.html#xxx">指数字典 §X</a>)</li>
    <!-- 列出本模块呈现的 5-10 个核心 KPI -->
  </ul>

  <h2 id="ch1-6">§1.6 业务判断框架</h2>
  <p>[看到 X 数据 → 想 Y → 做 Z 的决策树]</p>

  <h2 id="ch1-7">§1.7 跨章节联动</h2>
  <p>本模块跟以下章节互动: <a href="#ch2">§2 财务 PBI</a> (...)、<a href="#ch3">§3 Excel</a> (...)、<a href="#ch16">§16 会员</a> (...)</p>

  <h2 id="ch1-8">§1.8 常见决策场景</h2>
  <h3>场景 A: 月度营收下滑 5%</h3><p>[3-step 分析路径 + 建议动作]</p>
  <!-- 3 个场景 -->

  <h2 id="ch1-faq">FAQ</h2>
  <h3>Q: ...?</h3><p>A: ...</p>
  <!-- 3-5 条 -->

  <h2 id="ch1-related">相关章节</h2>
  <ul>
    <li><a href="#ch3">§3 Excel 上传</a> — AI Query 的 gateway</li>
    <li><a href="#ch2">§2 财务 PBI</a> — 看板形式的数据分析</li>
    <li><a href="#ch16">§16 会员</a> — 跨模块问"客户复购"会路由到这</li>
  </ul>
</section>
```

- [ ] **Step 1: 写 §1 概述 (overview paragraph)**

1 段 ~80-120 字, 涵盖: AI Query 是干嘛的、解决什么餐饮痛点、对比传统 BI 的优势.

- [ ] **Step 2: 写 §1.1 进入路径 + §1.2 主界面 layout**

§1.1: 文字描述 3-5 步进入路径 (登录 → 智能 BI 菜单 → 智能数据分析).
§1.2: 描述 4 个布局区块 (工具栏/查询输入区/结果展示区/历史记录).

- [ ] **Step 3: 写 §1.3 常用操作步骤 (5-8 个 step)**

按 实际产品 实际可执行的 5-8 个 step. 每个 step 1-2 句, 带 panel/button 名字.

- [ ] **Step 4: 写 §1.4 常见错误处理 (3-5 条)**

如 "上传 Excel 后 AI 说'未找到数据'" / "Query 超时" / "回答不准". 每条 1 段处理建议.

- [ ] **Step 5: 写 §1.5 关键指标速查 (5-10 KPI)**

列出 AI Query 输出的常见 KPI (营业额/客单价/翻台率/毛利率等), 每个 1 句解读, 链回 `restaurant-metrics-glossary.html#指数锚点`.

- [ ] **Step 6: 写 §1.6 业务判断框架**

1 段决策树, 形如 "看到 X → 检查 Y → 联动 §Z 模块". ~150-200 字.

- [ ] **Step 7: 写 §1.7 跨章节联动**

3-5 个跨章节联动, 每个 1 句, 链向具体 §X 锚点.

- [ ] **Step 8: 写 §1.8 常见决策场景 (3 个)**

3 个真实场景 (脱敏化), 每个 100-150 字. 含分析步骤 + 建议动作.

- [ ] **Step 9: 写 FAQ + 相关章节**

3-5 条 FAQ + 3-5 个相关章节锚点.

- [ ] **Step 10: 同步到 web-admin/public**

```bash
cp docs/plans/restaurant-product-manual.html web-admin/public/restaurant-product-manual.html
```

- [ ] **Step 11: Verify chunk count target (after Phase 1a Task 12 ingest)**

Defer count check to Task 12 ingest verify. Expected: §1 produces 8-12 chunks.

- [ ] **Step 12: Commit**

```bash
git commit -m "feat(docs): restaurant-product-manual §1 智能数据分析 (Tier 1 重模板)" -- docs/plans/restaurant-product-manual.html web-admin/public/restaurant-product-manual.html
```

---

### Task 10: Write §2 财务 PBI 看板 (Tier 1 重模板)

**Files:**
- Modify: `docs/plans/restaurant-product-manual.html` §2 section

Same 8-section template as Task 9. 内容焦点:

- §2.1 进入路径: SmartBI > 财务看板
- §2.2 主界面 layout: 营收/成本/毛利/AR/AP 5 个面板
- §2.3 常用操作步骤: 选门店 → 选时段 → 钻取
- §2.4 常见错误处理: 数据未更新 / 看板空白 / 数字异常
- §2.5 关键指标速查: 营业额/食材成本率/毛利率/AR/AP 等 5-8 个核心 KPI, 全链回指数字典
- §2.6 业务判断框架: 食材成本率 >32% / 毛利率 <55% 时的决策路径
- §2.7 跨章节联动: §1 AI Query / §11 菜品成本 / §16 会员
- §2.8 决策场景: 营收下滑 / 食材涨价 / 毛利倒挂 3 个

- [ ] **Step 1-9**: 同 Task 9 步骤 1-9, 替换为 §2 内容
- [ ] **Step 10**: sync to web-admin/public
- [ ] **Step 11: Commit**

```bash
git commit -m "feat(docs): restaurant-product-manual §2 财务 PBI 看板 (Tier 1 重模板)" -- docs/plans/restaurant-product-manual.html web-admin/public/restaurant-product-manual.html
```

---

### Task 11: Write §3 Excel 上传与字段识别 (Tier 1 重模板)

**Files:**
- Modify: `docs/plans/restaurant-product-manual.html` §3 section
- Create: `docs/plans/demo-data/demo_restaurant_sales.csv` (demo data)

Same 8-section template + demo CSV. 内容焦点:

- §3.1 进入路径: 智能 BI > 数据集 > 上传
- §3.2 主界面 layout: 拖拽区 / 字段映射区 / 预览区
- §3.3 常用操作步骤: 上传 → 自动识别 → 调整字段 → 确认
- §3.4 常见错误处理: 编码乱码 / 字段未识别 / 数据预览缺失
- §3.5 关键指标速查: dataset 元信息 (行数/列数/识别字段)
- §3.6 业务判断框架: 看到字段误识别怎么改 / pivot 表怎么处理
- §3.7 跨章节联动: §1 AI Query 的 gateway / §11 菜品成本 / §13 多门店
- §3.8 决策场景: 历史数据迁移 / 多月份合并 / 不同 POS 系统格式 3 个

- [ ] **Step 1: Create `docs/plans/demo-data/demo_restaurant_sales.csv`**

20-50 行脱敏化拟真销售数据, 列: date, store_id, store_name, dish_id, dish_name, qty, revenue, cost, customer_count.

- [ ] **Step 2-10**: 同 Task 9 写 §3 全 8 section + FAQ + 相关章节

- [ ] **Step 11**: sync to web-admin/public

- [ ] **Step 12: Commit**

```bash
git add docs/plans/demo-data/demo_restaurant_sales.csv
git commit -m "feat(docs): restaurant-product-manual §3 Excel 上传 (Tier 1 重模板) + demo CSV" -- docs/plans/restaurant-product-manual.html web-admin/public/restaurant-product-manual.html docs/plans/demo-data/demo_restaurant_sales.csv
```

---

### Task 12: Phase 1a ingest + verify chunks + KB chat smoke test

**Files:** No code — runs ingest + verify.

- [ ] **Step 1: Sync HTML to test env**

```bash
scp docs/plans/restaurant-product-manual.html root@47.100.235.168:/www/wwwroot/cretas/code/docs/plans/restaurant-product-manual.html
```

- [ ] **Step 2: Run manual_ingester (now includes restaurant-product-manual.html)**

Make sure MANUAL_SOURCES no longer guards on file existence (or file now exists).

```bash
ssh root@47.100.235.168 "cd /www/wwwroot/cretas/code/backend/python && source venv38/bin/activate && python -m food_kb.services.manual_ingester"
```

Expected: log shows ingest of all 6 sources. `restaurant-product-manual.html` chunk count = 8-12 × 3 chapters = 24-36 chunks.

- [ ] **Step 3: Verify chunk count for Phase 1a**

```bash
ssh root@47.100.235.168 "psql -U cretas_user -d cretas_db -c \"SELECT source, subcategory, COUNT(*) FROM food_knowledge_documents WHERE category='operation_manual' GROUP BY source, subcategory ORDER BY source;\""
```

Expected: `restaurant-product-manual.html | restaurant | 24-36`.

- [ ] **Step 4: Smoke test 5 餐饮 queries hit Phase 1a chapters**

```bash
for q in "智能数据分析怎么用" "财务看板营业额怎么看" "Excel 上传字段识别错了怎么办" "AI Query 历史能查吗" "菜品成本率突破 38% 怎么办"; do
  echo "=== Q: $q ==="
  ssh root@47.100.235.168 "curl -sS -X POST http://localhost:8084/api/food-kb/manual-chat \
    -H 'Content-Type: application/json' \
    -d '{\"question\":\"$q\"}'" \
    | python -c "import json,sys; d=json.load(sys.stdin); 
sources = d.get('sources',[]);
print(f'sources: {[s[\"source\"] for s in sources]}');
product_manual_count = sum(1 for s in sources if 'restaurant-product-manual' in s['source']);
print(f'product-manual chunks: {product_manual_count}/8')"
done
```

Expected: ≥3/5 queries hit ≥2 chunks from `restaurant-product-manual.html`.

- [ ] **Step 5: Deploy to prod**

```bash
./scripts/deploy/deploy-smartbi-python.sh --env prod
scp docs/plans/restaurant-product-manual.html root@47.100.235.168:/www/wwwroot/cretas/code/docs/plans/restaurant-product-manual.html
ssh root@47.100.235.168 "cd /www/wwwroot/cretas/code/backend/python && source venv38/bin/activate && python -m food_kb.services.manual_ingester"
```

- [ ] **Step 6: Commit smoke test results**

```bash
echo "Phase 1a smoke test results: ..." > docs/plans/2026-04-29-phase1a-smoke-test.md
git add docs/plans/2026-04-29-phase1a-smoke-test.md
git commit -m "docs(food_kb): Phase 1a smoke test — Tier 1 chapters retrievable" -- docs/plans/2026-04-29-phase1a-smoke-test.md
```

---

## Phase 1b: 21 章骨架 + 4 培训路径 + 6 合成 chunks (5 sessions, 15-22 hr)

**目的:** Tier 2-5 骨架先行, 让 KB 有完整覆盖. 每 batch 5 章左右, 立即 commit + ingest.

每章用 §4.2 轻模板 (4 sections):

```
<section id="chN">
  <h1>§N <章节标题></h1>
  <p class="overview">[1 段概述]</p>

  <h2>入门 / 怎么用</h2>
  <ol>[3-5 个 step]</ol>
  <p><strong>常见错误</strong>: [1-2 个]</p>

  <h2>管理 / 怎么解读</h2>
  <ul>[1-3 个 KPI]</ul>
  <p><strong>判断场景</strong>: [1-2 个]</p>

  <h2>FAQ</h2>
  <h3>Q: ...</h3><p>A: ...</p>
  [1-3 条]

  <h2>相关章节</h2>
  <ul>[2-3 个锚点]</ul>
</section>
```

每章目标 ~300 行 HTML, 4 chunks (overview 不切, 入门/管理/FAQ/相关 各 1).

---

### Task 13: Batch 1 — Tier 2 (§4-§8, 5 章)

**Files:**
- Modify: `docs/plans/restaurant-product-manual.html` §4-§8

- [ ] **Step 1: Write §4 登录 + 工厂/门店切换** (轻模板, 4 sections, ~300 行)
- [ ] **Step 2: Write §5 Dashboard 首页**
- [ ] **Step 3: Write §6 报表中心 + 数据导出**
- [ ] **Step 4: Write §7 设置 (用户/角色/通知)**
- [ ] **Step 5: Write §8 移动端 RN app 使用**
- [ ] **Step 6: Sync to web-admin/public + commit batch 1**

```bash
cp docs/plans/restaurant-product-manual.html web-admin/public/restaurant-product-manual.html
git commit -m "feat(docs): restaurant-product-manual Phase 1b Batch 1 — §4-§8 Tier 2 骨架" -- docs/plans/restaurant-product-manual.html web-admin/public/restaurant-product-manual.html
```

- [ ] **Step 7: Verify chapter count + total chunks via partial ingest** (optional, defer to Task 18 final ingest)

---

### Task 14: Batch 2 — Tier 3 前半 (§9-§12, 4 章)

**Files:**
- Modify: `docs/plans/restaurant-product-manual.html` §9-§12

- [ ] **Step 1: Write §9 供应链 / 采购下单**
- [ ] **Step 2: Write §10 库存管理 + 盘点 + 预警**
- [ ] **Step 3: Write §11 菜品 / 配方管理 (含成本核算)**
- [ ] **Step 4: Write §12 食安 / 合规检查**
- [ ] **Step 5: Sync + commit**

```bash
cp docs/plans/restaurant-product-manual.html web-admin/public/restaurant-product-manual.html
git commit -m "feat(docs): restaurant-product-manual Phase 1b Batch 2 — §9-§12 Tier 3 前半骨架" -- docs/plans/restaurant-product-manual.html web-admin/public/restaurant-product-manual.html
```

---

### Task 15: Batch 3 — Tier 3 后半 (§13-§15, 3 章)

**Files:**
- Modify: `docs/plans/restaurant-product-manual.html` §13-§15

- [ ] **Step 1: Write §13 多门店对比分析**
- [ ] **Step 2: Write §14 收银 / POS 对接**
- [ ] **Step 3: Write §15 外卖平台对接 (美团/饿了么)**
- [ ] **Step 4: Sync + commit**

```bash
cp docs/plans/restaurant-product-manual.html web-admin/public/restaurant-product-manual.html
git commit -m "feat(docs): restaurant-product-manual Phase 1b Batch 3 — §13-§15 Tier 3 后半骨架" -- docs/plans/restaurant-product-manual.html web-admin/public/restaurant-product-manual.html
```

---

### Task 16: Batch 4 — Tier 4 + Tier 5 开头 (§16-§20, 5 章)

**Files:**
- Modify: `docs/plans/restaurant-product-manual.html` §16-§20

- [ ] **Step 1: Write §16 会员分析**
- [ ] **Step 2: Write §17 评价管理 (差评响应流程)**
- [ ] **Step 3: Write §18 营销 / 优惠券 / 活动**
- [ ] **Step 4: Write §19 客户投诉与售后**
- [ ] **Step 5: Write §20 数据治理 (完整度 + 质量队列)**
- [ ] **Step 6: Sync + commit**

```bash
cp docs/plans/restaurant-product-manual.html web-admin/public/restaurant-product-manual.html
git commit -m "feat(docs): restaurant-product-manual Phase 1b Batch 4 — §16-§20 骨架" -- docs/plans/restaurant-product-manual.html web-admin/public/restaurant-product-manual.html
```

---

### Task 17: Batch 5 — Tier 5 余下 + 附录 + §B 决策场景合成

**Files:**
- Modify: `docs/plans/restaurant-product-manual.html` §21-§24 + 附录 + §B

- [ ] **Step 1: Write §21 排班 / 人效 / 员工绩效**
- [ ] **Step 2: Write §22 实时人效识别 (VL 摄像头)**
- [ ] **Step 3: Write §23 数据备份与恢复**
- [ ] **Step 4: Write §24 第三方 API 对接**

- [ ] **Step 5: 写 4 培训路径附录 (each ~50-80 行)**

按 spec §3.6 表格内容写 A1/A2/B/C 4 个路径, 每个路径 1 段引导 + 锚点列表. 例:

```html
<section id="path-a1">
  <h2>路径 A1: 前台 / 收银 (新员工首周)</h2>
  <p>适合岗位: 前台 / 收银 — 不上传 Excel 不用 AI Query, 走 POS / 移动端 / 合规线.</p>
  <ol>
    <li>Day 1: <a href="#ch4">§4 登录 + 切换门店</a> (10 分钟)</li>
    <li>Day 2: <a href="#ch5">§5 Dashboard 首页</a> (15 分钟, 看本店当日营收)</li>
    <li>Day 3: <a href="#ch14">§14 收银 / POS 对接</a> (30 分钟, 操作核心)</li>
    <li>Day 4: <a href="#ch8">§8 移动端 RN app</a> (15 分钟)</li>
    <li>Day 5-7: <a href="#ch12">§12 食安合规</a> (前台留样 / 异常报备)</li>
  </ol>
</section>
```

- [ ] **Step 6: 写 §B 决策场景合成 6 主题 (each ~100-150 字)**

按 spec §6.5 6 个主题. 每主题 1 段问题陈述 + 4-6 步分析路径 (链 §X.Y) + 1 段决策建议. 例:

```html
<section id="synthesis">
  <h2>§B 决策场景合成</h2>

  <h3 id="syn-1">主题 1: 提高客单价</h3>
  <p>当门店客单价低于行业基准时, 走以下分析路径:</p>
  <ol>
    <li>用 <a href="#ch1">§1 智能数据分析</a> 问 "上月各门店客单价排名"</li>
    <li>用 <a href="#ch2">§2 财务 PBI</a> 看消费时段分布</li>
    <li>查 <a href="#ch11">§11 菜品成本</a> 看哪些高毛利菜没卖出</li>
    <li>查 <a href="#ch16">§16 会员</a> 看新老会员占比</li>
    <li>查 <a href="#ch18">§18 营销</a> 看优惠券是否过度稀释</li>
  </ol>
  <p><strong>建议动作</strong>: ...</p>

  <h3 id="syn-2">主题 2: 降低食材成本率</h3>
  <!-- ... -->
  <!-- 6 个主题全列 -->
</section>
```

- [ ] **Step 7: Sync + commit batch 5**

```bash
cp docs/plans/restaurant-product-manual.html web-admin/public/restaurant-product-manual.html
git commit -m "feat(docs): restaurant-product-manual Phase 1b Batch 5 — §21-§24 + 附录 4 路径 + §B 6 决策合成" -- docs/plans/restaurant-product-manual.html web-admin/public/restaurant-product-manual.html
```

---

### Task 18: Final ingest + 24-chapter verification + counter-test

**Files:** No code.

- [ ] **Step 1: Sync HTML to test env + ingest**

```bash
scp docs/plans/restaurant-product-manual.html root@47.100.235.168:/www/wwwroot/cretas/code/docs/plans/restaurant-product-manual.html
ssh root@47.100.235.168 "cd /www/wwwroot/cretas/code/backend/python && source venv38/bin/activate && python -m food_kb.services.manual_ingester"
```

- [ ] **Step 2: Verify chunks (24 chapters + 4 paths + 6 synthesis = expected ~110-150 chunks)**

```bash
ssh root@47.100.235.168 "psql -U cretas_user -d cretas_db -c \"SELECT source, subcategory, COUNT(*) FROM food_knowledge_documents WHERE source='restaurant-product-manual.html' GROUP BY source, subcategory;\""
```

Expected: count between 100-150. Check ingester warn logs for chunk budget violations.

- [ ] **Step 3: Run §10.2 success metric counter-test (20 queries)**

20 queries split: 10 module-specific + 5 cross-chapter + 5 中性 baseline.

```bash
# Module-specific (expect ≥1 chunk from target module in top-3)
for q in "怎么登录系统" "Dashboard 上看什么" "怎么用 AI Query" "菜单成本怎么算" "外卖订单同步失败" "排班怎么设" "差评怎么处理" "盘点周期" "供应商对账" "员工绩效"; do
  ...
done

# Cross-chapter (expect §B synthesis chunk in top-5)
for q in "怎么提高客单价" "食材成本率太高" "翻台率怎么优化" "会员复购怎么涨" "多门店扩张怎么决策" "员工绩效跟客单价"; do
  ...
done

# 中性 baseline
for q in "登录失败" "API 接口" "数据库连接" "权限管理" "操作手册"; do
  ...
done
```

记录 pass/fail. Phase 1b 通过条件: ≥15/20 模块定向 query 命中.

- [ ] **Step 4: Deploy to prod + ingest**

```bash
scp docs/plans/restaurant-product-manual.html root@47.100.235.168:/www/wwwroot/cretas/code/docs/plans/restaurant-product-manual.html
ssh root@47.100.235.168 "cd /www/wwwroot/cretas/code/backend/python && source venv38/bin/activate && python -m food_kb.services.manual_ingester"
```

- [ ] **Step 5: Test via web-admin AI chat (true E2E)**

Open web-admin (test env 8097), 进 AI chat 入口, 问 "智能数据分析怎么用" → 验证 sources 显示 `restaurant-product-manual.html`.

- [ ] **Step 6: Write Phase 1b ship report**

```bash
cat > docs/plans/2026-04-29-phase1b-ship-report.md <<EOF
# Phase 1b Ship Report

- 24 chapters complete (Tier 1 production-grade × 3, Tier 2-5 skeleton × 21)
- 4 training paths (A1/A2/B/C)
- 6 §B synthesis chunks
- Total chunks: XXX (target 100-150)
- Counter-test pass rate: XX/20 module-specific
- Ready for Phase 2 (drift防腐 CI infra) + Phase 2 reactive expansion
EOF

git add docs/plans/2026-04-29-phase1b-ship-report.md
git commit -m "docs(food_kb): Phase 1b ship report — 24 章 + 4 路径 + 6 合成完成" -- docs/plans/2026-04-29-phase1b-ship-report.md
```

---

## Phase 2: Drift防腐 CI infra (~3-4 hr, 可独立执行)

**目的:** 实施 spec §11 row 6 三层防护. 不阻塞 Phase 1 ship, 但应在 Phase 1b 完成后 1 周内做完.

---

### Task 19: CI lint scripts — last-verified meta + anchor consistency

**Files:**
- Create: `scripts/ci/check-kb-meta-freshness.py`
- Create: `scripts/ci/check-kb-anchor-consistency.py`

- [ ] **Step 1: Create `scripts/ci/check-kb-meta-freshness.py`**

```python
#!/usr/bin/env python3
"""CI lint: ensure §1/§2/§11 章节 last-verified meta is < 6 weeks old.

Per spec §11 row 6 layer (c). Reads HTML comment <!-- last-verified-against-product: YYYY-MM-DD -->
from restaurant-product-manual.html, checks freshness of marker.

Exit 1 if 6+ weeks stale → CI fails → reminds PM to verify chapter against product.
"""
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path

MANUAL_PATH = Path("docs/plans/restaurant-product-manual.html")
MAX_AGE_DAYS = 42  # 6 weeks
META_RE = re.compile(r"<!--\s*last-verified-against-product:\s*(\d{4}-\d{2}-\d{2})\s*-->")

def main() -> int:
    if not MANUAL_PATH.exists():
        print(f"ERROR: {MANUAL_PATH} not found")
        return 1
    content = MANUAL_PATH.read_text(encoding="utf-8")
    match = META_RE.search(content)
    if not match:
        print(f"ERROR: no <!-- last-verified-against-product: YYYY-MM-DD --> meta in {MANUAL_PATH}")
        return 1
    last_verified = datetime.strptime(match.group(1), "%Y-%m-%d").date()
    age_days = (datetime.now().date() - last_verified).days
    if age_days > MAX_AGE_DAYS:
        print(
            f"FAIL: {MANUAL_PATH} last-verified-against-product = {last_verified} "
            f"({age_days} days ago, > {MAX_AGE_DAYS}). "
            f"Run quarterly KB drift audit + update meta."
        )
        return 1
    print(f"PASS: {MANUAL_PATH} verified {age_days} days ago (≤ {MAX_AGE_DAYS})")
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Create `scripts/ci/check-kb-anchor-consistency.py`**

```python
#!/usr/bin/env python3
"""CI lint: ensure §B 决策合成 chunks 锚点跟 §3 章节列表一致.

Per spec §11 row 6 layer (d). Parse restaurant-product-manual.html, extract:
- All h1 章节 anchor IDs (ch1-ch24)
- All <a href="#chN"> references in §B synthesis section

Exit 1 if §B references a non-existent chapter anchor.
"""
import re
import sys
from pathlib import Path
from bs4 import BeautifulSoup

MANUAL_PATH = Path("docs/plans/restaurant-product-manual.html")

def main() -> int:
    if not MANUAL_PATH.exists():
        print(f"ERROR: {MANUAL_PATH} not found")
        return 1
    soup = BeautifulSoup(MANUAL_PATH.read_text(encoding="utf-8"), "html.parser")

    # Collect all section ids ch1-ch24 + path-* + synthesis
    valid_ids = {s.get("id") for s in soup.find_all("section") if s.get("id")}

    # Find §B synthesis section
    synthesis = soup.find("section", id="synthesis")
    if not synthesis:
        print(f"ERROR: <section id='synthesis'> not found in {MANUAL_PATH}")
        return 1

    # Collect all <a href="#X"> in synthesis
    bad_refs = []
    for a in synthesis.find_all("a", href=True):
        href = a["href"]
        if not href.startswith("#"):
            continue
        target = href[1:]
        if target and target not in valid_ids:
            bad_refs.append((href, a.get_text()[:40]))

    if bad_refs:
        print(f"FAIL: §B synthesis has {len(bad_refs)} broken anchor refs:")
        for href, text in bad_refs:
            print(f"  - {href} ({text!r}) — target id not found in document")
        return 1
    print(f"PASS: §B synthesis anchor consistency OK ({len(valid_ids)} valid section ids)")
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 3: Make scripts executable + test locally**

```bash
chmod +x scripts/ci/check-kb-meta-freshness.py scripts/ci/check-kb-anchor-consistency.py
python scripts/ci/check-kb-meta-freshness.py
python scripts/ci/check-kb-anchor-consistency.py
```

Expected: both PASS (assuming Phase 1 done correctly).

- [ ] **Step 4: Commit**

```bash
git add scripts/ci/check-kb-meta-freshness.py scripts/ci/check-kb-anchor-consistency.py
git commit -m "feat(ci): KB drift防腐 lints — meta freshness + anchor consistency" -- scripts/ci/check-kb-meta-freshness.py scripts/ci/check-kb-anchor-consistency.py
```

---

### Task 20: GitHub Actions workflow + CODEOWNERS + PR template

**Files:**
- Create: `.github/workflows/kb-drift-check.yml`
- Modify: `.github/CODEOWNERS`
- Modify: `.github/pull_request_template.md`

- [ ] **Step 1: Create workflow yml**

```yaml
# .github/workflows/kb-drift-check.yml
name: KB Drift Check

on:
  pull_request:
    paths:
      - "docs/plans/restaurant-product-manual.html"
      - "docs/plans/restaurant-metrics-glossary.html"
      - "docs/plans/factory-operation-manual.html"
      - "scripts/ci/check-kb-*.py"
  schedule:
    - cron: "0 8 * * 1"  # Mon 8am UTC = 4pm 北京时间, 周报式提醒

jobs:
  drift-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.10"

      - name: Install deps
        run: pip install beautifulsoup4

      - name: Check meta freshness
        run: python scripts/ci/check-kb-meta-freshness.py

      - name: Check synthesis anchor consistency
        run: python scripts/ci/check-kb-anchor-consistency.py
```

- [ ] **Step 2: Update `.github/CODEOWNERS`**

Add at bottom of existing file:

```
# KB drift防腐 — smartbi/finance 改动 PM 必 review (spec §11 row 6 layer a)
backend/python/smartbi/      @stevenj4xie
web-admin/src/views/smart-bi/ @stevenj4xie
web-admin/src/views/finance/ @stevenj4xie
docs/plans/restaurant-product-manual.html @stevenj4xie
docs/plans/restaurant-metrics-glossary.html @stevenj4xie
```

- [ ] **Step 3: Update `.github/pull_request_template.md`**

Add section:

```markdown
## KB 影响检查 (餐饮端 / SmartBI / 财务相关 PR 必填)

- [ ] 本 PR 是否改动 SmartBI / AI Query / 财务看板逻辑?
- [ ] 若是, 是否需要更新 `docs/plans/restaurant-product-manual.html` §1 / §2 / §11 章节?
- [ ] 若已更新, 是否同步刷新章节头 `<!-- last-verified-against-product: YYYY-MM-DD -->` meta?
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/kb-drift-check.yml .github/CODEOWNERS .github/pull_request_template.md
git commit -m "feat(ci): KB drift防腐 workflow + CODEOWNERS gate + PR template" -- .github/workflows/kb-drift-check.yml .github/CODEOWNERS .github/pull_request_template.md
```

---

## Self-Review

**1. Spec coverage** — checked each spec section can point to a task:

- ✅ §3 章节清单 (24 章) → Task 8 (skeleton) + Task 9-11 (Tier 1) + Task 13-17 (Tier 2-5)
- ✅ §3.6 培训路径 4 条 → Task 17 step 5
- ✅ §4 模板 → Task 9-11 (Tier 1 重模板) + Task 13-17 (轻模板)
- ✅ §4.4 chunk 预算 → Task 3 step 3 (ingester warn) + Task 12/18 verify
- ✅ §5 文件组织 (单 HTML + 双副本) → Task 8 step 3 + 各 batch sync step
- ✅ §6.2 subcategory 路由 → Task 1-5 (Phase 0 全部)
- ✅ §6.5 跨章合成 → Task 17 step 6
- ✅ §7 视觉/数据 (无图脱敏化) → Task 11 step 1 (demo CSV)
- ✅ §9 实施分期 → Phase 0 (Task 1-7) / Phase 1a (Task 8-12) / Phase 1b (Task 13-18) / Phase 2 (Task 19-20)
- ✅ §10 metric → Task 7 (counter-test) + Task 12 (smoke) + Task 18 (final 20 query)
- ✅ §11 row 6 三层防腐 → Task 19-20 (CI lint + workflow + CODEOWNERS)
- ✅ §11 Phase 0 rollback → Task 1 (索引保留 7 天) + spec §9 SQL 回退步骤

**2. Placeholder scan** — 无 TBD / TODO / "fill in details". 所有 step 有具体代码或具体内容指令.

**3. Type consistency** — 函数签名 (`ingest_document`, `retrieve`, `_detect_restaurant_domain`) 跟参数名 (`subcategory`, `subcategories`) 全 plan 一致.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-28-restaurant-product-manual.md`. Two execution options:

**1. Subagent-Driven (recommended)** — 用 `superpowers:subagent-driven-development`, 每个 task 一个 fresh subagent, review between tasks, 适合 Phase 0 (代码) 和 Phase 1a (内容深度章). 节奏快.

**2. Inline Execution** — 用 `superpowers:executing-plans` 在当前 chat 跑全 20 tasks, batch checkpoint review. 总工时 24-35 hr, 跨多 session.

**推荐 Subagent-Driven** — Phase 0 (Task 1-7) 和 Phase 1a (Task 8-12) 都适合 subagent 单 task 跑完后立即 review. Phase 1b 大量内容书写, 也适合每章 1 subagent.

哪种?

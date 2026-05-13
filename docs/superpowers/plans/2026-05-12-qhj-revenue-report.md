# 青花椒 收入管理报表 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build end-to-end pipeline that ingests 二维火 POS reports (zip/xlsx/csv) and renders to a customer-specific 收入管理报表.xlsx matching青花椒's template, exposed via SmartBI Vue sub-menu + AI Chat Tool.

**Architecture:** Bronze → Silver → Gold → Template-compute → openpyxl renderer → streaming xlsx + Redis smart cache. All business logic in Python; Java holds only a thin AI Tool wrapper. New code is additive to existing SmartBI infrastructure.

**Tech Stack:** Python (FastAPI / asyncpg / openpyxl / pytest), Java (Spring Boot Tool layer), Vue 3 + Element Plus + TypeScript, PostgreSQL (smartbi_db / smartbi_prod_db with RLS), Redis (cache + LRU), Playwright (E2E).

**Spec reference:** `docs/qa-specs/2026-05-12-qhj-revenue-report-design.md` (commit `184fd7340`). Every task in this plan references its spec section by `§X.Y`.

**Phases:**
- A — DB schema (3 migrations) + field aliases
- B — Bronze utilities (zip / filename / router / encoding fix)
- C — Silver writers (3 new + 1 extension)
- D — Gold materializer + backfill script
- E — Template compute (4 blocks)
- F — xlsx renderer + Prometheus metrics
- G — API endpoints (6) + CORS
- H — Java Tool + Flyway intent + MealPeriodNormalizer
- I — Vue page + components + router/menu
- J — Deploy + smoke + intent enablement

---

## Phase A — Schema + Field Aliases

### Task A1: Python migration V20260513_01 — meal_period + agg_daily_order_type_meal

**Spec ref:** §6.6 (schema), §6.7 (Gold table usage), §6 (RLS pattern from existing migrations).

**Files:**
- Create: `backend/python/smartbi/database/migrations/V20260513_01__qhj_revenue_silver_gold.sql`
- Test: `backend/python/smartbi/tests/test_revenue_report_migration_01.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/python/smartbi/tests/test_revenue_report_migration_01.py
import pytest
import asyncpg
from pathlib import Path

MIGRATION_FILE = Path(__file__).parent.parent / "database" / "migrations" / "V20260513_01__qhj_revenue_silver_gold.sql"

@pytest.mark.asyncio
async def test_migration_creates_meal_period_column(pg_test_db):
    await pg_test_db.execute(MIGRATION_FILE.read_text())
    
    col = await pg_test_db.fetchval("""
        SELECT data_type FROM information_schema.columns
        WHERE table_name='fact_pos_transaction' AND column_name='meal_period'
    """)
    assert col == "character varying"

@pytest.mark.asyncio
async def test_migration_creates_agg_table_with_rls(pg_test_db):
    await pg_test_db.execute(MIGRATION_FILE.read_text())
    
    forced = await pg_test_db.fetchval("""
        SELECT relrowsecurity FROM pg_class WHERE relname='agg_daily_order_type_meal'
    """)
    assert forced is True

@pytest.mark.asyncio
async def test_migration_creates_index(pg_test_db):
    await pg_test_db.execute(MIGRATION_FILE.read_text())
    
    idx = await pg_test_db.fetchval("""
        SELECT indexname FROM pg_indexes
        WHERE tablename='agg_daily_order_type_meal'
          AND indexname='idx_agg_daily_omt_factory_date_store_meal'
    """)
    assert idx is not None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_migration_01.py -v`
Expected: FAIL — migration file does not exist

- [ ] **Step 3: Write the migration**

```sql
-- backend/python/smartbi/database/migrations/V20260513_01__qhj_revenue_silver_gold.sql
-- QHJ 收入管理报表 - meal_period 列 + 新 Gold 聚合表

ALTER TABLE fact_pos_transaction
  ADD COLUMN IF NOT EXISTS meal_period VARCHAR(50);

ALTER TABLE fact_pos_transaction
  DROP CONSTRAINT IF EXISTS chk_meal_period;
ALTER TABLE fact_pos_transaction
  ADD CONSTRAINT chk_meal_period
    CHECK (meal_period IS NULL OR meal_period IN
      ('早餐','午餐','下午茶','晚餐','其他','午市','晚市','未分类'));

CREATE TABLE IF NOT EXISTS agg_daily_order_type_meal (
    factory_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    store_id BIGINT NOT NULL,
    order_type VARCHAR(50) NOT NULL DEFAULT '未分类',
    meal_period VARCHAR(50) NOT NULL DEFAULT '未分类',
    gross_amount NUMERIC(18,2),
    actual_receive NUMERIC(18,2),
    bill_count INT,
    customer_count INT,
    version BIGINT NOT NULL DEFAULT 1,
    computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (factory_id, date, store_id, order_type, meal_period),
    CONSTRAINT fk_agg_daily_omt_store
      FOREIGN KEY (store_id) REFERENCES dim_store(store_id) ON DELETE CASCADE
);

ALTER TABLE agg_daily_order_type_meal ENABLE ROW LEVEL SECURITY;
ALTER TABLE agg_daily_order_type_meal FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON agg_daily_order_type_meal;
CREATE POLICY tenant_isolation ON agg_daily_order_type_meal FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));

CREATE INDEX IF NOT EXISTS idx_agg_daily_omt_factory_date_store_meal
  ON agg_daily_order_type_meal (factory_id, date, store_id, meal_period);

COMMENT ON TABLE agg_daily_order_type_meal IS
  'Gold layer: daily revenue aggregated by store × order_type × meal_period. '
  'Source: fact_pos_transaction. Materializer: materialize_daily_order_type_meal().';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_migration_01.py -v`
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi/database/migrations/V20260513_01__qhj_revenue_silver_gold.sql \
        backend/python/smartbi/tests/test_revenue_report_migration_01.py
git commit -m "feat(smartbi): add meal_period column + agg_daily_order_type_meal Gold table (V20260513_01)" \
  -- backend/python/smartbi/database/migrations/V20260513_01__qhj_revenue_silver_gold.sql \
     backend/python/smartbi/tests/test_revenue_report_migration_01.py
```

---

### Task A2: Python migration V20260513_02 — upload dedup content_hash

**Spec ref:** §5.4, §6.8.

**Files:**
- Create: `backend/python/smartbi/database/migrations/V20260513_02__upload_dedup.sql`
- Test: `backend/python/smartbi/tests/test_revenue_report_migration_02.py`

- [ ] **Step 1: Write the failing test**

```python
import pytest
from pathlib import Path

MIGRATION_FILE = Path(__file__).parent.parent / "database" / "migrations" / "V20260513_02__upload_dedup.sql"

@pytest.mark.asyncio
async def test_content_hash_column_added(pg_test_db):
    await pg_test_db.execute(MIGRATION_FILE.read_text())
    col = await pg_test_db.fetchval("""
        SELECT data_type FROM information_schema.columns
        WHERE table_name='smart_bi_pg_excel_uploads' AND column_name='content_hash'
    """)
    assert col == "character varying"

@pytest.mark.asyncio
async def test_unique_index_partial(pg_test_db):
    await pg_test_db.execute(MIGRATION_FILE.read_text())
    idx = await pg_test_db.fetchval("""
        SELECT indexdef FROM pg_indexes
        WHERE indexname='uq_upload_factory_hash'
    """)
    assert idx is not None
    assert "content_hash IS NOT NULL" in idx
```

- [ ] **Step 2: Run test, verify fails**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_migration_02.py -v`
Expected: FAIL (migration not found)

- [ ] **Step 3: Write migration**

```sql
-- backend/python/smartbi/database/migrations/V20260513_02__upload_dedup.sql
ALTER TABLE smart_bi_pg_excel_uploads
  ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS uq_upload_factory_hash
  ON smart_bi_pg_excel_uploads (factory_id, content_hash)
  WHERE content_hash IS NOT NULL;

COMMENT ON COLUMN smart_bi_pg_excel_uploads.content_hash IS
  'sha256(file_bytes); UNIQUE per factory; 重传同文件返 409 + existing upload_id';
```

- [ ] **Step 4: Run, verify pass**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_migration_02.py -v`
Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi/database/migrations/V20260513_02__upload_dedup.sql \
        backend/python/smartbi/tests/test_revenue_report_migration_02.py
git commit -m "feat(smartbi): add content_hash column for upload dedup (V20260513_02)" \
  -- backend/python/smartbi/database/migrations/V20260513_02__upload_dedup.sql \
     backend/python/smartbi/tests/test_revenue_report_migration_02.py
```

---

### Task A3: Python migration V20260513_03 — smart_bi_report_audit_log

**Spec ref:** §6.9.

**Files:**
- Create: `backend/python/smartbi/database/migrations/V20260513_03__report_audit_log.sql`
- Test: `backend/python/smartbi/tests/test_revenue_report_migration_03.py`

- [ ] **Step 1: Write failing test**

```python
import pytest
from pathlib import Path

MIGRATION_FILE = Path(__file__).parent.parent / "database" / "migrations" / "V20260513_03__report_audit_log.sql"

@pytest.mark.asyncio
async def test_audit_log_table_created(pg_test_db):
    await pg_test_db.execute(MIGRATION_FILE.read_text())
    cols = await pg_test_db.fetch("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name='smart_bi_report_audit_log' ORDER BY ordinal_position
    """)
    names = [r["column_name"] for r in cols]
    assert "factory_id" in names
    assert "params_snapshot" in names
    assert "cache_hit" in names
    assert "gold_materialized_at" in names

@pytest.mark.asyncio
async def test_audit_log_rls_enabled(pg_test_db):
    await pg_test_db.execute(MIGRATION_FILE.read_text())
    forced = await pg_test_db.fetchval("""
        SELECT relforcerowsecurity FROM pg_class
        WHERE relname='smart_bi_report_audit_log'
    """)
    assert forced is True
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_migration_03.py -v`
Expected: FAIL

- [ ] **Step 3: Write migration** (use full DDL from spec §6.9)

```sql
-- backend/python/smartbi/database/migrations/V20260513_03__report_audit_log.sql
CREATE TABLE IF NOT EXISTS smart_bi_report_audit_log (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    generated_by VARCHAR(100) NOT NULL,
    generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    params_snapshot JSONB NOT NULL,
    params_hash VARCHAR(64) NOT NULL,
    cache_key VARCHAR(255),
    cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
    file_size_bytes INT,
    duration_ms INT,
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    gold_materialized_at TIMESTAMP
);

ALTER TABLE smart_bi_report_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_bi_report_audit_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON smart_bi_report_audit_log;
CREATE POLICY tenant_isolation ON smart_bi_report_audit_log FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));

CREATE INDEX IF NOT EXISTS idx_audit_log_factory_generated
  ON smart_bi_report_audit_log (factory_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_params_hash
  ON smart_bi_report_audit_log (factory_id, params_hash);
```

- [ ] **Step 4: Run, verify pass**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_migration_03.py -v`
Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi/database/migrations/V20260513_03__report_audit_log.sql \
        backend/python/smartbi/tests/test_revenue_report_migration_03.py
git commit -m "feat(smartbi): add smart_bi_report_audit_log table w/ RLS (V20260513_03)" \
  -- backend/python/smartbi/database/migrations/V20260513_03__report_audit_log.sql \
     backend/python/smartbi/tests/test_revenue_report_migration_03.py
```

---

### Task A4: report_registry.yaml + field_aliases.yaml `2dfire:` patch

**Spec ref:** §5.1 (router decision tree), §5.2 (alias补丁), Appendix A.

**Files:**
- Create: `backend/python/smartbi/knowledge/restaurant/pos/report_registry.yaml`
- Modify: `backend/python/smartbi/knowledge/restaurant/pos/field_aliases.yaml` (extend `2dfire:` block)
- Test: `backend/python/smartbi/tests/test_revenue_report_yaml.py`

- [ ] **Step 1: Write failing test**

```python
import yaml
from pathlib import Path

KNOWLEDGE_DIR = Path(__file__).parent.parent / "knowledge" / "restaurant" / "pos"

def test_report_registry_loads():
    data = yaml.safe_load((KNOWLEDGE_DIR / "report_registry.yaml").read_text(encoding="utf-8"))
    assert "2dfire" in data
    keywords = [e["keyword"] for e in data["2dfire"]["filename_keywords"]]
    assert "营业概况报表" in keywords
    assert "堂食外卖占比表" in keywords
    assert "详细日报表" in keywords

def test_field_aliases_2dfire_has_new_fields():
    data = yaml.safe_load((KNOWLEDGE_DIR / "field_aliases.yaml").read_text(encoding="utf-8"))
    mappings = data["2dfire"]["field_mappings"]
    assert "order_type" in mappings
    assert "meal_period" in mappings
    assert "revenue_ratio" in mappings
    assert "avg_order_spend" in mappings
    assert "avg_diner_spend" in mappings
    assert "store_name" in mappings
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_yaml.py -v`
Expected: FAIL (missing keys)

- [ ] **Step 3: Create report_registry.yaml**

```yaml
# backend/python/smartbi/knowledge/restaurant/pos/report_registry.yaml
2dfire:
  filename_keywords:
    - keyword: "营业概况报表"
      writer: daily_summary_writer
      grain: "store × day"
    - keyword: "堂食外卖占比表"
      writer: meal_split_writer
      grain: "store × period × order_type"
    - keyword: "区域销售报表"
      writer: region_summary_writer
      grain: "region × period"
    - keyword: "详细日报表"
      writer: bill_flow_writer
      grain: "transaction"
    - keyword: "订单付款方式汇总"
      writer: bill_flow_writer
      grain: "transaction"
    - keyword: "商品销售明细表"
      writer: product_summary_writer
      grain: "product × period"
```

- [ ] **Step 4: Patch field_aliases.yaml — extend `2dfire:` `field_mappings:` block**

Use Edit tool to add (within the existing `2dfire:` block under `field_mappings:`):

```yaml
    order_type: ["订单类型", "堂食/外卖"]
    meal_period: ["班次", "市段", "午晚市"]
    revenue_ratio: ["营业额占比", "营业额占比(%)"]
    avg_order_spend: ["单均消费"]
    avg_diner_spend: ["人均消费"]
    store_name: ["门店名称", "店铺名称"]
```

- [ ] **Step 5: Run, verify pass**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_yaml.py -v`
Expected: 2 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/python/smartbi/knowledge/restaurant/pos/report_registry.yaml \
        backend/python/smartbi/knowledge/restaurant/pos/field_aliases.yaml \
        backend/python/smartbi/tests/test_revenue_report_yaml.py
git commit -m "feat(smartbi): add report_registry.yaml + extend 2dfire field aliases" \
  -- backend/python/smartbi/knowledge/restaurant/pos/report_registry.yaml \
     backend/python/smartbi/knowledge/restaurant/pos/field_aliases.yaml \
     backend/python/smartbi/tests/test_revenue_report_yaml.py
```

---

## Phase B — Bronze Utilities

### Task B1: `_filename_stripper.py` — 剥前缀

**Spec ref:** §5.1 step ①.

**Files:**
- Create: `backend/python/smartbi/ingestion/_filename_stripper.py`
- Test: `backend/python/smartbi/tests/test_revenue_report_filename_stripper.py`

- [ ] **Step 1: Write failing tests**

```python
from smartbi.ingestion._filename_stripper import strip_pos_prefix

def test_strips_17digit_hash_prefix():
    assert strip_pos_prefix("20260422101444628_8e07f831c81_营业概况报表.csv") == "营业概况报表.csv"

def test_keeps_filename_without_prefix():
    assert strip_pos_prefix("营业概况报表.csv") == "营业概况报表.csv"

def test_strips_only_one_prefix():
    assert strip_pos_prefix("20260422101444628_abc_20250101120000000_def_x.csv") == "20250101120000000_def_x.csv"

def test_handles_zip_extension():
    assert strip_pos_prefix("20260422101444628_abc_详细日报表.zip") == "详细日报表.zip"
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_filename_stripper.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```python
# backend/python/smartbi/ingestion/_filename_stripper.py
"""Strip 二维火 POS export filename prefix like '20260422101444628_8e07f831c81_'."""
import re

_PREFIX_RE = re.compile(r"^\d{17}_[a-f0-9]+_")

def strip_pos_prefix(filename: str) -> str:
    """Remove '17-digit_hash_' prefix; return original if not matched."""
    return _PREFIX_RE.sub("", filename, count=1)
```

- [ ] **Step 4: Run, verify pass**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_filename_stripper.py -v`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi/ingestion/_filename_stripper.py backend/python/smartbi/tests/test_revenue_report_filename_stripper.py
git commit -m "feat(smartbi): add _filename_stripper for 二维火 POS exports" -- backend/python/smartbi/ingestion/_filename_stripper.py backend/python/smartbi/tests/test_revenue_report_filename_stripper.py
```

---

### Task B2: `_zip_handler.py` — 递归解压

**Spec ref:** §5.1 step ②.

**Files:**
- Create: `backend/python/smartbi/ingestion/_zip_handler.py`
- Test: `backend/python/smartbi/tests/test_revenue_report_zip_handler.py`

- [ ] **Step 1: Write failing test**

```python
import io
import zipfile
from smartbi.ingestion._zip_handler import extract_inner_files

def test_extracts_flat_zip():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("a.csv", b"col1,col2\n1,2")
        zf.writestr("b.csv", b"col3,col4\n3,4")
    files = list(extract_inner_files(buf.getvalue()))
    assert len(files) == 2

def test_extracts_nested_zip():
    inner = io.BytesIO()
    with zipfile.ZipFile(inner, "w") as zf:
        zf.writestr("inner.csv", b"data")
    outer = io.BytesIO()
    with zipfile.ZipFile(outer, "w") as zf:
        zf.writestr("nested.zip", inner.getvalue())
    files = list(extract_inner_files(outer.getvalue()))
    assert any(name == "inner.csv" for name, _ in files)

def test_skips_non_data_files():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("readme.txt", b"ignored")
        zf.writestr("data.csv", b"col,val\n1,2")
    files = list(extract_inner_files(buf.getvalue()))
    names = [n for n, _ in files]
    assert "data.csv" in names and "readme.txt" not in names
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_zip_handler.py -v`
Expected: FAIL

- [ ] **Step 3: Implement**

```python
# backend/python/smartbi/ingestion/_zip_handler.py
"""Recursive zip extractor. Yields (filename, bytes) for each data file."""
import io
import zipfile
from typing import Iterator

_DATA_SUFFIXES = {".csv", ".xlsx", ".xls"}


def extract_inner_files(zip_bytes: bytes) -> Iterator[tuple[str, bytes]]:
    """Yield (filename, content_bytes) for every CSV/XLSX inside (recursively)."""
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            name = info.filename
            suffix = "." + name.rsplit(".", 1)[-1].lower() if "." in name else ""
            content = zf.read(info)
            if suffix == ".zip":
                yield from extract_inner_files(content)
            elif suffix in _DATA_SUFFIXES:
                yield (name, content)
```

- [ ] **Step 4: Run, verify pass**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_zip_handler.py -v`
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi/ingestion/_zip_handler.py backend/python/smartbi/tests/test_revenue_report_zip_handler.py
git commit -m "feat(smartbi): add _zip_handler for nested zip extraction" -- backend/python/smartbi/ingestion/_zip_handler.py backend/python/smartbi/tests/test_revenue_report_zip_handler.py
```

---

### Task B3: `excel_async.py` CSV encoding fix (UTF-8 BOM + `\r`-only)

**Spec ref:** §5 (2dfire CSV format).

**Files:**
- Modify: `backend/python/smartbi/api/excel_async.py` (every `pd.read_csv` call site)
- Test: `backend/python/smartbi/tests/test_revenue_report_csv_encoding.py`

- [ ] **Step 1: Write helper test that proves the working pattern**

```python
import io
import pandas as pd

def test_pandas_handles_utf8_bom_and_cr_only():
    bom = b"\xef\xbb\xbf"
    body = bom + "门店名称,营业额\r青花椒南方百联店,123.45\r青花椒徐汇店,67.89".encode("utf-8")
    df = pd.read_csv(io.BytesIO(body), encoding="utf-8-sig", engine="python")
    assert list(df.columns) == ["门店名称", "营业额"]
    assert len(df) == 2
    assert df.iloc[0]["门店名称"] == "青花椒南方百联店"
```

- [ ] **Step 2: Run, verify pass (establishes target pandas pattern)**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_csv_encoding.py::test_pandas_handles_utf8_bom_and_cr_only -v`
Expected: PASS

- [ ] **Step 3: Patch every `pd.read_csv` call in `backend/python/smartbi/api/excel_async.py`**

For each call, add `encoding="utf-8-sig"` (first try) and `engine="python"`. Preserve any existing gbk fallback as second-try.

Example diff:
```python
# Before
pd.read_csv(path, chunksize=5000)
# After
pd.read_csv(path, chunksize=5000, encoding="utf-8-sig", engine="python")
```

- [ ] **Step 4: Add regression test exercising excel_async with 2dfire-style bytes**

```python
import tempfile
import pytest

@pytest.mark.asyncio
async def test_excel_async_parses_2dfire_csv():
    from smartbi.api.excel_async import _detect_header_and_load  # use actual exported helper
    bom = b"\xef\xbb\xbf"
    body = bom + "门店,实收\r店A,100\r店B,200".encode("utf-8")
    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
        f.write(body)
        path = f.name
    df = await _detect_header_and_load(path)
    assert "门店" in df.columns
    assert len(df) == 2
```

- [ ] **Step 5: Run all encoding tests, verify pass**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_csv_encoding.py -v`
Expected: 2 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/python/smartbi/api/excel_async.py backend/python/smartbi/tests/test_revenue_report_csv_encoding.py
git commit -m "fix(smartbi): excel_async pd.read_csv UTF-8 BOM + carriage-return-only support" -- backend/python/smartbi/api/excel_async.py backend/python/smartbi/tests/test_revenue_report_csv_encoding.py
```

---

### Task B4: `dim_resolver.resolve_store()` `.strip()` patch

**Spec ref:** §5.3, audit P.

**Files:**
- Modify: `backend/python/smartbi/canonical/dim_resolver.py` (function `resolve_store`)
- Test: `backend/python/smartbi/tests/test_revenue_report_dim_resolver.py`

- [ ] **Step 1: Write failing test**

```python
import pytest
from smartbi.canonical.dim_resolver import resolve_store

@pytest.mark.asyncio
async def test_resolve_store_strips_whitespace(pg_test_db, factory_ctx):
    a = await resolve_store(pg_test_db, factory_ctx, "青花椒南方百联店")
    b = await resolve_store(pg_test_db, factory_ctx, "青花椒南方百联店 ")
    c = await resolve_store(pg_test_db, factory_ctx, " 青花椒南方百联店")
    assert a == b == c

@pytest.mark.asyncio
async def test_resolve_store_keeps_closed_prefix(pg_test_db, factory_ctx):
    sid = await resolve_store(pg_test_db, factory_ctx, "（闭店）青花椒上滨国际店")
    row = await pg_test_db.fetchrow("SELECT name FROM dim_store WHERE store_id = $1", sid)
    assert row["name"] == "（闭店）青花椒上滨国际店"

@pytest.mark.asyncio
async def test_resolve_store_empty_after_strip_raises(pg_test_db, factory_ctx):
    with pytest.raises(ValueError):
        await resolve_store(pg_test_db, factory_ctx, "   ")
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_dim_resolver.py -v`
Expected: FAIL — duplicates created OR ValueError not raised

- [ ] **Step 3: Patch `resolve_store()` in `dim_resolver.py`**

Find the function start and insert at the top of its body:

```python
async def resolve_store(conn, factory_id: str, name: str) -> int:
    # Patch: normalize whitespace to prevent duplicate dim_store rows
    name = (name or "").strip()
    if not name:
        raise ValueError("Store name cannot be empty after strip")
    # ... existing logic
```

- [ ] **Step 4: Run, verify pass**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_dim_resolver.py -v`
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi/canonical/dim_resolver.py backend/python/smartbi/tests/test_revenue_report_dim_resolver.py
git commit -m "fix(smartbi): dim_resolver strip() to prevent duplicate dim_store rows" -- backend/python/smartbi/canonical/dim_resolver.py backend/python/smartbi/tests/test_revenue_report_dim_resolver.py
```

---

### Task B5: `pos_router.py` main routing

**Spec ref:** §5.1 (decision tree).

**Files:**
- Create: `backend/python/smartbi/ingestion/pos_router.py`
- Test: `backend/python/smartbi/tests/test_revenue_report_pos_router.py`

- [ ] **Step 1: Write failing tests**

```python
import io, zipfile, pytest
from smartbi.ingestion.pos_router import route_file, UnknownReportTypeError

def test_route_by_filename_with_prefix():
    results = list(route_file("20260422101444628_abc_营业概况报表.csv", b"col1,col2\n1,2"))
    assert results[0][0].writer == "daily_summary_writer"
    assert results[0][0].report_type == "daily_summary"

def test_route_meal_split():
    results = list(route_file("堂食外卖占比表.csv", b"col1,col2\n1,2"))
    assert results[0][0].writer == "meal_split_writer"

def test_route_via_zip_extracts_inner():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("营业概况报表.csv", b"col1,col2\n1,2")
    results = list(route_file("20260422101444628_abc_营业概况报表.zip", buf.getvalue()))
    assert results[0][0].writer == "daily_summary_writer"

def test_route_unknown_raises_with_preview():
    with pytest.raises(UnknownReportTypeError) as exc:
        list(route_file("mystery_report.csv", b"abc,def\n1,2"))
    assert "abc" in exc.value.preview_headers[0]
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_pos_router.py -v`
Expected: FAIL

- [ ] **Step 3: Implement**

```python
# backend/python/smartbi/ingestion/pos_router.py
"""二维火 POS file router: filename + (header sniff fallback) → writer dispatch."""
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator
import yaml

from smartbi.ingestion._filename_stripper import strip_pos_prefix
from smartbi.ingestion._zip_handler import extract_inner_files

_REGISTRY_PATH = (Path(__file__).parent.parent
                  / "knowledge" / "restaurant" / "pos" / "report_registry.yaml")
_REGISTRY = yaml.safe_load(_REGISTRY_PATH.read_text(encoding="utf-8"))["2dfire"]["filename_keywords"]


@dataclass
class RouteDecision:
    report_type: str
    writer: str
    grain: str


class UnknownReportTypeError(Exception):
    def __init__(self, filename: str, preview_headers: list[str]):
        super().__init__(f"Cannot identify report type for {filename}")
        self.filename = filename
        self.preview_headers = preview_headers


def _route_by_filename(filename: str) -> RouteDecision | None:
    stripped = strip_pos_prefix(filename)
    for entry in _REGISTRY:
        if entry["keyword"] in stripped:
            type_short = entry["writer"].replace("_writer", "")
            return RouteDecision(
                report_type=type_short,
                writer=entry["writer"],
                grain=entry.get("grain", ""),
            )
    return None


def route_file(filename: str, content: bytes) -> Iterator[tuple[RouteDecision, bytes]]:
    """Route a single upload. Yields (decision, inner_bytes); .zip yields N."""
    if filename.lower().endswith(".zip"):
        for inner_name, inner_body in extract_inner_files(content):
            decision = _route_by_filename(inner_name)
            if decision is None:
                preview = inner_body.decode("utf-8", errors="replace")[:200].splitlines()[:3]
                raise UnknownReportTypeError(inner_name, preview)
            yield (decision, inner_body)
        return
    
    decision = _route_by_filename(filename)
    if decision is None:
        preview = content.decode("utf-8", errors="replace")[:200].splitlines()[:3]
        raise UnknownReportTypeError(filename, preview)
    yield (decision, content)
```

- [ ] **Step 4: Run, verify pass**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_pos_router.py -v`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi/ingestion/pos_router.py backend/python/smartbi/tests/test_revenue_report_pos_router.py
git commit -m "feat(smartbi): add pos_router for 二维火 filename-based dispatch" -- backend/python/smartbi/ingestion/pos_router.py backend/python/smartbi/tests/test_revenue_report_pos_router.py
```

---

## Phase C — Silver Writers

### Task C1: `daily_summary_writer.py` (营业概况报表 → fact_pos_transaction)

**Spec ref:** §4.2 file list, §5.5 (meal_period via writer .strip()), §6.7 (fact_pos_transaction is source for Gold).

**Files:**
- Create: `backend/python/smartbi/canonical/silver_writers/daily_summary_writer.py`
- Test: `backend/python/smartbi/tests/test_revenue_report_writer_daily_summary.py`

**Note:** 二维火 "营业概况报表" is daily store-level pre-aggregated. We persist its day-level rows into `fact_pos_transaction` as **synthetic bills** with `bill_count` column (NOT individual orders). For Gold-layer downstream aggregation, this is sufficient. Block 4 (客单人数) requires real bill grain → that comes from `bill_flow_writer` (详细日报表), not this writer.

- [ ] **Step 1: Write failing test**

```python
import io, pandas as pd, pytest
from smartbi.canonical.silver_writers.daily_summary_writer import write

@pytest.fixture
def daily_summary_csv():
    bom = b"\xef\xbb\xbf"
    rows = "门店名称,日期,营业额,实收额,客流量,堂食营业额,外卖营业额,班次\r" \
           "青花椒南方百联店,2025-10-01,5000.00,4800.00,80,3200.00,1800.00,午市\r" \
           "青花椒南方百联店,2025-10-01,4200.00,4100.00,75,2900.00,1300.00,晚市"
    return bom + rows.encode("utf-8")

@pytest.mark.asyncio
async def test_daily_summary_writer_inserts_rows(pg_test_db, factory_ctx, daily_summary_csv):
    df = pd.read_csv(io.BytesIO(daily_summary_csv), encoding="utf-8-sig", engine="python")
    await write(pg_test_db, factory_ctx, df, source_meta={"filename": "营业概况报表.csv"})

    rows = await pg_test_db.fetch("""
        SELECT * FROM fact_pos_transaction
        WHERE factory_id = $1 AND date = '2025-10-01'
        ORDER BY meal_period
    """, factory_ctx)
    assert len(rows) == 2
    assert {r["meal_period"] for r in rows} == {"午市", "晚市"}
    assert sum(float(r["actual_receive"]) for r in rows) == 4800.00 + 4100.00

@pytest.mark.asyncio
async def test_daily_summary_writer_normalizes_store_name(pg_test_db, factory_ctx):
    """Trailing whitespace on store name must not create duplicate dim_store rows."""
    bom = b"\xef\xbb\xbf"
    body = bom + "门店名称,日期,营业额,实收额,客流量,堂食营业额,外卖营业额,班次\r" \
                 "青花椒南方百联店 ,2025-10-02,1000,900,20,700,300,午市".encode("utf-8")
    df = pd.read_csv(io.BytesIO(body), encoding="utf-8-sig", engine="python")
    await write(pg_test_db, factory_ctx, df, source_meta={"filename": "营业概况报表.csv"})
    count = await pg_test_db.fetchval(
        "SELECT COUNT(*) FROM dim_store WHERE factory_id = $1 AND name = '青花椒南方百联店'",
        factory_ctx
    )
    assert count == 1
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_writer_daily_summary.py -v`
Expected: FAIL (writer missing)

- [ ] **Step 3: Implement writer**

```python
# backend/python/smartbi/canonical/silver_writers/daily_summary_writer.py
"""Writer for 二维火 '营业概况报表' (compatible 月报表).

Source grain: store × day × meal_period × order_type-aware splits.
Target table: fact_pos_transaction (synthetic bill rows — one per CSV row).
For real per-bill grain (needed by Block 4), use bill_flow_writer instead.
"""
from datetime import datetime
import pandas as pd

from smartbi.canonical.dim_resolver import resolve_store


async def write(conn, factory_id: str, df: pd.DataFrame, source_meta: dict) -> int:
    """Returns number of rows inserted."""
    inserted = 0
    for _, row in df.iterrows():
        store_name = str(row.get("门店名称", "")).strip()
        if not store_name:
            continue
        store_id = await resolve_store(conn, factory_id, store_name)

        date_val = pd.to_datetime(row["日期"]).date()
        meal_period = str(row.get("班次", "未分类")).strip() or "未分类"

        # Aggregate split into 2 synthetic rows: 堂食 + 外卖, sharing the date+meal_period.
        gross_total = float(row.get("营业额", 0) or 0)
        actual_total = float(row.get("实收额", 0) or 0)
        customer_total = int(row.get("客流量", 0) or 0)
        dine_in_gross = float(row.get("堂食营业额", 0) or 0)
        takeout_gross = float(row.get("外卖营业额", 0) or 0)

        # Distribute actual_receive proportionally to gross split (best-effort).
        if gross_total > 0:
            dine_in_actual = actual_total * (dine_in_gross / gross_total)
            takeout_actual = actual_total * (takeout_gross / gross_total)
        else:
            dine_in_actual = takeout_actual = 0

        for order_type, g, a in (("堂食", dine_in_gross, dine_in_actual),
                                 ("外卖", takeout_gross, takeout_actual)):
            if g <= 0 and a <= 0:
                continue
            await conn.execute("""
                INSERT INTO fact_pos_transaction
                    (factory_id, date, store_id, order_type, meal_period,
                     gross_amount, actual_receive, customer_count,
                     source_type, source_bill_no)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '2dfire_daily', $9)
            """, factory_id, date_val, store_id, order_type, meal_period,
                 g, a, customer_total,
                 f"daily:{date_val}:{store_id}:{meal_period}:{order_type}")
            inserted += 1
    return inserted
```

- [ ] **Step 4: Run, verify pass**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_writer_daily_summary.py -v`
Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi/canonical/silver_writers/daily_summary_writer.py backend/python/smartbi/tests/test_revenue_report_writer_daily_summary.py
git commit -m "feat(smartbi): add daily_summary_writer for 二维火 营业概况报表" -- backend/python/smartbi/canonical/silver_writers/daily_summary_writer.py backend/python/smartbi/tests/test_revenue_report_writer_daily_summary.py
```

---

### Task C2: `meal_split_writer.py` (堂食外卖占比表)

**Spec ref:** §4.2, §6.4 (Block 3 source).

**Files:**
- Create: `backend/python/smartbi/canonical/silver_writers/meal_split_writer.py`
- Test: `backend/python/smartbi/tests/test_revenue_report_writer_meal_split.py`

**Note:** 二维火 "堂食外卖占比表" is single-period (date_from/date_to encoded in CSV header), pre-aggregated. We write to `fact_pos_transaction` with **one synthetic bill per (store, order_type)** for the whole period. The `date` column gets the period's `date_to` (latest day).

- [ ] **Step 1: Write failing test**

```python
import io, pandas as pd, pytest
from smartbi.canonical.silver_writers.meal_split_writer import write

@pytest.fixture
def meal_split_csv():
    """Real 二维火 format: header row has period info; row 4 is column header; rows 5+ are data."""
    bom = b"\xef\xbb\xbf"
    body = (",,,,,,,,,,堂食外卖占比表,,,,,,,,,,,\r"
            "门店名称:青花椒砂锅鱼,,,,,,,,,,,,,,,,,,,,,\r"
            '查询条件:时间范围:["2025-01-01","2025-12-31"],,,,,,,,,,,,,,,,,,,,,\r'
            "门店名称,营业额,实收额,订单数,客流量,单均消费,人均消费,营业额,营业额占比(%),实收额,订单数,客流量,单均消费,人均消费,营业额,营业额占比(%),实收额,订单数,客流量,单均消费,人均消费,\r"
            "青花椒南方百联店,7515520.63,6086134.73,43616,73325,139.54,83.00,5241611.12,69.74,4822779.32,19922,49564,242.08,97.30,2273909.51,30.26,1263355.41,23694,23761,53.32,53.17,").encode("utf-8")
    return bom + body[3:]  # bom in first place only

@pytest.mark.asyncio
async def test_meal_split_writer_extracts_period_and_writes(pg_test_db, factory_ctx, meal_split_csv):
    # Loader must skip the 3 title rows. Caller is excel_async; this test treats df as already-parsed.
    df = pd.read_csv(io.BytesIO(meal_split_csv), encoding="utf-8-sig", engine="python", skiprows=3)
    await write(pg_test_db, factory_ctx, df, source_meta={"filename": "堂食外卖占比表.csv",
                                                          "date_from": "2025-01-01",
                                                          "date_to": "2025-12-31"})
    rows = await pg_test_db.fetch(
        "SELECT order_type, actual_receive, customer_count FROM fact_pos_transaction "
        "WHERE factory_id=$1 AND source_type='2dfire_meal_split' ORDER BY order_type",
        factory_ctx)
    assert len(rows) == 2
    order_types = {r["order_type"] for r in rows}
    assert order_types == {"堂食", "外卖"}
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_writer_meal_split.py -v`
Expected: FAIL

- [ ] **Step 3: Implement writer**

```python
# backend/python/smartbi/canonical/silver_writers/meal_split_writer.py
"""Writer for 二维火 '堂食外卖占比表' (period-level dine-in/takeout split)."""
from datetime import date
import pandas as pd

from smartbi.canonical.dim_resolver import resolve_store


# Column positions in the 22-col 堂食外卖占比表 (after skipping 3 title rows).
# 0=门店名称; 1-7=汇总; 8-14=堂食; 15-21=外卖
_DINE_IN_COL_OFFSET = 7
_TAKEOUT_COL_OFFSET = 14


async def write(conn, factory_id: str, df: pd.DataFrame, source_meta: dict) -> int:
    period_end = pd.to_datetime(source_meta.get("date_to") or date.today()).date()
    inserted = 0
    for _, row in df.iterrows():
        store_name = str(row.iloc[0] or "").strip()
        if not store_name or store_name.startswith("查询") or store_name.startswith("门店名称:"):
            continue
        try:
            store_id = await resolve_store(conn, factory_id, store_name)
        except ValueError:
            continue

        for order_type, base_col in (("堂食", _DINE_IN_COL_OFFSET),
                                     ("外卖", _TAKEOUT_COL_OFFSET)):
            try:
                gross   = float(row.iloc[base_col + 1] or 0)
                actual  = float(row.iloc[base_col + 3] or 0)
                bills   = int(float(row.iloc[base_col + 4] or 0))
                clients = int(float(row.iloc[base_col + 5] or 0))
            except (ValueError, TypeError, IndexError):
                continue
            if gross <= 0 and actual <= 0:
                continue
            await conn.execute("""
                INSERT INTO fact_pos_transaction
                    (factory_id, date, store_id, order_type, meal_period,
                     gross_amount, actual_receive, customer_count,
                     source_type, source_bill_no)
                VALUES ($1, $2, $3, $4, '未分类', $5, $6, $7,
                        '2dfire_meal_split', $8)
            """, factory_id, period_end, store_id, order_type,
                 gross, actual, clients,
                 f"meal_split:{period_end}:{store_id}:{order_type}")
            inserted += 1
    return inserted
```

- [ ] **Step 4: Run, verify pass**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_writer_meal_split.py -v`
Expected: 1 test PASS

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi/canonical/silver_writers/meal_split_writer.py backend/python/smartbi/tests/test_revenue_report_writer_meal_split.py
git commit -m "feat(smartbi): add meal_split_writer for 二维火 堂食外卖占比表" -- backend/python/smartbi/canonical/silver_writers/meal_split_writer.py backend/python/smartbi/tests/test_revenue_report_writer_meal_split.py
```

---

### Task C3: `region_summary_writer.py` (区域销售报表) — minimal stub

**Spec ref:** §4.2.

**Note:** 区域销售报表 is region × period grain. Our Block 1-4 templates do NOT query a `agg_region` table (out of MVP scope). This writer is a **stub that captures rows for future Gold layer**. It logs raw events to `raw_events` only — no Silver insert yet. Phase 2 candidate.

**Files:**
- Create: `backend/python/smartbi/canonical/silver_writers/region_summary_writer.py`
- Test: `backend/python/smartbi/tests/test_revenue_report_writer_region_summary.py`

- [ ] **Step 1: Write failing test**

```python
import io, pandas as pd, pytest
from smartbi.canonical.silver_writers.region_summary_writer import write

@pytest.mark.asyncio
async def test_region_summary_writer_is_noop_with_log(pg_test_db, factory_ctx, caplog):
    df = pd.DataFrame({"区域": ["上海"], "营业额": [10000]})
    result = await write(pg_test_db, factory_ctx, df, source_meta={"filename": "区域销售报表.csv"})
    assert result == 0  # No Silver inserts for now
    assert "region_summary" in caplog.text.lower() or "stub" in caplog.text.lower()
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_writer_region_summary.py -v`
Expected: FAIL

- [ ] **Step 3: Implement stub**

```python
# backend/python/smartbi/canonical/silver_writers/region_summary_writer.py
"""Stub writer for 二维火 '区域销售报表'.

MVP scope: log-only. No Silver-layer aggregation table for region × period yet.
Phase 2: add agg_region Gold table + populate from this writer.
"""
import logging

logger = logging.getLogger(__name__)


async def write(conn, factory_id: str, df, source_meta: dict) -> int:
    logger.info(
        "region_summary_writer stub: factory=%s, rows=%d, filename=%s (no Silver insert, Phase 2 candidate)",
        factory_id, len(df), source_meta.get("filename", "")
    )
    return 0
```

- [ ] **Step 4: Run, verify pass**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_writer_region_summary.py -v`
Expected: 1 test PASS

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi/canonical/silver_writers/region_summary_writer.py backend/python/smartbi/tests/test_revenue_report_writer_region_summary.py
git commit -m "feat(smartbi): add region_summary_writer stub (Phase 2 candidate)" -- backend/python/smartbi/canonical/silver_writers/region_summary_writer.py backend/python/smartbi/tests/test_revenue_report_writer_region_summary.py
```

---

### Task C4: Extend `bill_flow_writer.py` — populate `meal_period`

**Spec ref:** §5.5 (writer is responsible for `meal_period` `.strip()` populate, no semantic mapping).

**Files:**
- Modify: `backend/python/smartbi/canonical/silver_writers/bill_flow_writer.py`
- Test: `backend/python/smartbi/tests/test_revenue_report_writer_bill_flow_meal_period.py`

- [ ] **Step 1: Write failing test**

```python
import io, pandas as pd, pytest
from smartbi.canonical.silver_writers.bill_flow_writer import BillFlowWriter

@pytest.mark.asyncio
async def test_bill_flow_writer_populates_meal_period_from_班次(pg_test_db, factory_ctx):
    """详细日报表 has '班次' column; writer must populate fact_pos_transaction.meal_period."""
    bom = b"\xef\xbb\xbf"
    body = bom + (
        "门店名称,账单号,开单时间,班次,订单类型,营业额,实收额,客流量\r"
        "青花椒南方百联店,B001,2025-10-01 12:30:00,午市,堂食,300.00,290.00,3\r"
        "青花椒南方百联店,B002,2025-10-01 19:00:00,晚市,外卖,180.00,180.00,1"
    ).encode("utf-8")
    df = pd.read_csv(io.BytesIO(body), encoding="utf-8-sig", engine="python")

    writer = BillFlowWriter()
    await writer.write(pg_test_db, factory_ctx, df, source_meta={"filename": "详细日报表.csv"})

    rows = await pg_test_db.fetch(
        "SELECT source_bill_no, meal_period, order_type FROM fact_pos_transaction "
        "WHERE factory_id = $1 ORDER BY source_bill_no", factory_ctx)
    assert len(rows) == 2
    assert {r["meal_period"] for r in rows} == {"午市", "晚市"}
    assert {r["order_type"] for r in rows} == {"堂食", "外卖"}

@pytest.mark.asyncio
async def test_bill_flow_writer_strips_meal_period_whitespace(pg_test_db, factory_ctx):
    """meal_period field gets .strip() per spec §5.5."""
    bom = b"\xef\xbb\xbf"
    body = bom + (
        "门店名称,账单号,开单时间,班次,订单类型,营业额,实收额,客流量\r"
        "青花椒南方百联店,B003,2025-10-02 12:00:00, 午市 ,堂食,200,190,2"
    ).encode("utf-8")
    df = pd.read_csv(io.BytesIO(body), encoding="utf-8-sig", engine="python")
    writer = BillFlowWriter()
    await writer.write(pg_test_db, factory_ctx, df, source_meta={"filename": "详细日报表.csv"})
    mp = await pg_test_db.fetchval(
        "SELECT meal_period FROM fact_pos_transaction WHERE source_bill_no = 'B003'")
    assert mp == "午市"  # stripped
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_writer_bill_flow_meal_period.py -v`
Expected: FAIL (meal_period not populated)

- [ ] **Step 3: Patch `bill_flow_writer.py`**

Locate the row-write logic (where `INSERT INTO fact_pos_transaction` is built). Add `meal_period` extraction:

```python
# Inside the per-row loop:
meal_period_raw = row.get("班次") or row.get("市段") or row.get("午晚市") or "未分类"
meal_period = str(meal_period_raw).strip() or "未分类"

# In the INSERT statement, add `meal_period` column + value at the right index.
# Existing columns map e.g. (factory_id, date, store_id, order_type, ...)
# Now becomes: (factory_id, date, store_id, order_type, meal_period, ...)
```

Apply the change carefully to both the SQL `INSERT` column list and the executemany / values tuple.

- [ ] **Step 4: Run, verify pass**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_writer_bill_flow_meal_period.py -v`
Expected: 2 tests PASS

- [ ] **Step 5: Run existing bill_flow tests, verify no regression**

Run: `cd backend/python && pytest smartbi/tests/ -k bill_flow -v`
Expected: All prior bill_flow tests still PASS

- [ ] **Step 6: Commit**

```bash
git add backend/python/smartbi/canonical/silver_writers/bill_flow_writer.py backend/python/smartbi/tests/test_revenue_report_writer_bill_flow_meal_period.py
git commit -m "feat(smartbi): bill_flow_writer populates meal_period from 班次 column" -- backend/python/smartbi/canonical/silver_writers/bill_flow_writer.py backend/python/smartbi/tests/test_revenue_report_writer_bill_flow_meal_period.py
```

---

## Phase D — Gold Materializer + Backfill

### Task D1: `materialize_daily_order_type_meal()` function

**Spec ref:** §6.7 (full SQL upsert body).

**Files:**
- Modify: `backend/python/smartbi/services/materialized_analytics/materializer.py`
- Test: `backend/python/smartbi/tests/test_revenue_report_materializer.py`

- [ ] **Step 1: Write failing test**

```python
import pytest
from datetime import date
from smartbi.services.materialized_analytics.materializer import materialize_daily_order_type_meal

@pytest.mark.asyncio
async def test_materializer_aggregates_fact_pos_transaction(pg_test_db, factory_ctx, sample_fact_pos_data):
    """sample_fact_pos_data fixture inserts 10 rows across 2 days × 2 stores × 2 order_types."""
    affected = await materialize_daily_order_type_meal(
        pg_test_db, factory_ctx,
        date_min=date(2025, 10, 1), date_max=date(2025, 10, 7)
    )
    assert affected > 0

    rows = await pg_test_db.fetch(
        "SELECT * FROM agg_daily_order_type_meal WHERE factory_id=$1 ORDER BY date, store_id, order_type",
        factory_ctx)
    assert len(rows) >= 4  # 2 stores × 2 order_types minimum
    for r in rows:
        assert r["bill_count"] > 0
        assert r["computed_at"] is not None

@pytest.mark.asyncio
async def test_materializer_is_idempotent_with_version_bump(pg_test_db, factory_ctx, sample_fact_pos_data):
    """Re-running updates rows + bumps version + refreshes computed_at."""
    await materialize_daily_order_type_meal(pg_test_db, factory_ctx,
                                            date(2025, 10, 1), date(2025, 10, 7))
    first_versions = await pg_test_db.fetch(
        "SELECT version FROM agg_daily_order_type_meal WHERE factory_id=$1", factory_ctx)
    
    await materialize_daily_order_type_meal(pg_test_db, factory_ctx,
                                            date(2025, 10, 1), date(2025, 10, 7))
    second_versions = await pg_test_db.fetch(
        "SELECT version FROM agg_daily_order_type_meal WHERE factory_id=$1", factory_ctx)
    
    assert all(s["version"] > f["version"] for f, s in zip(first_versions, second_versions))
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_materializer.py -v`
Expected: FAIL

- [ ] **Step 3: Implement materializer function** (full SQL from spec §6.7)

In `backend/python/smartbi/services/materialized_analytics/materializer.py`, add:

```python
from datetime import date


_AGG_DAILY_OMT_UPSERT_SQL = """
INSERT INTO agg_daily_order_type_meal AS a (
    factory_id, date, store_id, order_type, meal_period,
    gross_amount, actual_receive, bill_count, customer_count,
    version, computed_at
)
SELECT
    t.factory_id,
    t.date,
    t.store_id,
    COALESCE(TRIM(t.order_type), '未分类') AS order_type,
    COALESCE(TRIM(t.meal_period), '未分类') AS meal_period,
    SUM(COALESCE(t.gross_amount,   0)) AS gross_amount,
    SUM(COALESCE(t.actual_receive, 0)) AS actual_receive,
    COUNT(*)                            AS bill_count,
    SUM(COALESCE(t.customer_count, 0))  AS customer_count,
    1, NOW()
FROM fact_pos_transaction t
WHERE t.factory_id = $1
  AND t.date BETWEEN $2 AND $3
GROUP BY t.factory_id, t.date, t.store_id,
         COALESCE(TRIM(t.order_type), '未分类'),
         COALESCE(TRIM(t.meal_period), '未分类')
ON CONFLICT (factory_id, date, store_id, order_type, meal_period)
DO UPDATE SET
    gross_amount   = EXCLUDED.gross_amount,
    actual_receive = EXCLUDED.actual_receive,
    bill_count     = EXCLUDED.bill_count,
    customer_count = EXCLUDED.customer_count,
    version        = a.version + 1,
    computed_at    = NOW();
"""


async def materialize_daily_order_type_meal(
    conn,
    factory_id: str,
    date_min: date,
    date_max: date,
) -> int:
    """Upsert agg_daily_order_type_meal from fact_pos_transaction.
    Returns affected row count.
    """
    result = await conn.execute(_AGG_DAILY_OMT_UPSERT_SQL,
                                factory_id, date_min, date_max)
    return int(result.split()[-1])
```

- [ ] **Step 4: Run, verify pass**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_materializer.py -v`
Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi/services/materialized_analytics/materializer.py backend/python/smartbi/tests/test_revenue_report_materializer.py
git commit -m "feat(smartbi): add materialize_daily_order_type_meal Gold function" -- backend/python/smartbi/services/materialized_analytics/materializer.py backend/python/smartbi/tests/test_revenue_report_materializer.py
```

---

### Task D2: Hook materializer into UploadCompleteTrigger + add backfill script

**Spec ref:** §6.7 (Trigger 接入 + 回填).

**Files:**
- Modify: `backend/python/smartbi/services/materialized_analytics/hooks.py` (extend `materialize_all`)
- Create: `scripts/backfill_agg_order_type_meal.py`
- Test: `backend/python/smartbi/tests/test_revenue_report_materializer_hooks.py`

- [ ] **Step 1: Write failing test**

```python
import pytest
from datetime import date
from smartbi.services.materialized_analytics.hooks import _trigger_materialization

@pytest.mark.asyncio
async def test_upload_trigger_materializes_order_type_meal(pg_test_db, factory_ctx, sample_upload_with_pos_data):
    """When upload completes, agg_daily_order_type_meal should be populated."""
    await _trigger_materialization(sample_upload_with_pos_data, factory_ctx)
    count = await pg_test_db.fetchval(
        "SELECT COUNT(*) FROM agg_daily_order_type_meal WHERE factory_id = $1", factory_ctx)
    assert count > 0
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_materializer_hooks.py -v`
Expected: FAIL

- [ ] **Step 3: Extend hooks.py**

In `backend/python/smartbi/services/materialized_analytics/hooks.py`, find `materialize_all()` or the body of `_trigger_materialization()` and add one line:

```python
from smartbi.services.materialized_analytics.materializer import (
    materialize_daily_order_type_meal,  # NEW
    # ... existing imports
)

# Inside materialize_all() or _trigger_materialization() body, after existing
# materialize_daily / materialize_product calls, add:
await materialize_daily_order_type_meal(conn, factory_id, date_min, date_max)
```

- [ ] **Step 4: Run, verify pass**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_materializer_hooks.py -v`
Expected: 1 test PASS

- [ ] **Step 5: Create backfill script**

```python
# scripts/backfill_agg_order_type_meal.py
"""Backfill agg_daily_order_type_meal from fact_pos_transaction for a given factory + range.

Usage:
  python scripts/backfill_agg_order_type_meal.py \
    --factory R_QINGHUAJIAO_REAL \
    --date-from 2025-01-01 --date-to 2025-12-31 \
    --env prod
"""
import argparse
import asyncio
from datetime import datetime
import asyncpg

from smartbi.config import get_pg_dsn
from smartbi.services.materialized_analytics.materializer import (
    materialize_daily_order_type_meal,
)


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--factory", required=True)
    parser.add_argument("--date-from", required=True)
    parser.add_argument("--date-to", required=True)
    parser.add_argument("--env", choices=["test", "prod"], default="test")
    args = parser.parse_args()

    dsn = get_pg_dsn(env=args.env)
    date_from = datetime.strptime(args.date_from, "%Y-%m-%d").date()
    date_to = datetime.strptime(args.date_to, "%Y-%m-%d").date()

    conn = await asyncpg.connect(dsn)
    try:
        await conn.execute("SELECT set_config('app.factory_id', $1, false)", args.factory)
        affected = await materialize_daily_order_type_meal(
            conn, args.factory, date_from, date_to
        )
        print(f"Backfilled {affected} rows for factory={args.factory} "
              f"range={date_from}..{date_to} env={args.env}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 6: Commit**

```bash
git add backend/python/smartbi/services/materialized_analytics/hooks.py backend/python/smartbi/tests/test_revenue_report_materializer_hooks.py scripts/backfill_agg_order_type_meal.py
git commit -m "feat(smartbi): hook agg_daily_order_type_meal into upload trigger + backfill script" -- backend/python/smartbi/services/materialized_analytics/hooks.py backend/python/smartbi/tests/test_revenue_report_materializer_hooks.py scripts/backfill_agg_order_type_meal.py
```

---

## Phase E — Template Compute

### Task E1: Template entry + RevenueReportParams dataclass

**Spec ref:** §6.1 (入参), §6.2 (入口), §11.2 (include_yoy hardcoded False).

**Files:**
- Create: `backend/python/smartbi/canonical/templates/qhj_revenue_report.py`
- Test: `backend/python/smartbi/tests/test_revenue_report_template_entry.py`

- [ ] **Step 1: Write failing test**

```python
import pytest
from datetime import date
from smartbi.canonical.templates.qhj_revenue_report import (
    RevenueReportParams, compute_qhj_revenue_report,
)

def test_params_defaults():
    p = RevenueReportParams(
        factory_id="R_QINGHUAJIAO_REAL",
        store_ids=[1, 2],
        date_from=date(2025, 10, 1),
        date_to=date(2025, 10, 7),
    )
    assert p.meal_periods is None
    assert p.include_yoy is False

@pytest.mark.asyncio
async def test_compute_returns_template_result_with_4_blocks(pg_test_db_with_gold_data, factory_ctx):
    params = RevenueReportParams(
        factory_id=factory_ctx, store_ids=[1, 2],
        date_from=date(2025, 10, 1), date_to=date(2025, 10, 7),
    )
    result = await compute_qhj_revenue_report(pg_test_db_with_gold_data, params)
    assert result.code == "qhj_revenue_report"
    assert "block1_yoy" in result.data
    assert "block2_mom" in result.data
    assert "block3_meal_split" in result.data
    assert "block4_diner_dist" in result.data
    assert result.data["meta"]["yoy_available"] is False
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_template_entry.py -v`
Expected: FAIL

- [ ] **Step 3: Implement entry (block fns are stubs returning empty for now; filled in E2-E5)**

```python
# backend/python/smartbi/canonical/templates/qhj_revenue_report.py
"""QHJ revenue report compute template — 4-block output.

Block 1: 可比同比 (YoY, deferred Phase 2 — returns NULL columns)
Block 2: 环比 (period over previous-period)
Block 3: 堂食外卖占比
Block 4: 客单人数分析 (per-store)
"""
import asyncio
from dataclasses import dataclass, field
from datetime import date
from typing import Optional

from smartbi.canonical.templates.base import TemplateResult


@dataclass
class RevenueReportParams:
    factory_id: str
    store_ids: list[int]
    date_from: date
    date_to: date
    meal_periods: Optional[list[str]] = None
    include_yoy: bool = False  # First phase: hardcoded False; Phase 2 will populate via 2024 data


async def compute_qhj_revenue_report(pool, params: RevenueReportParams) -> TemplateResult:
    block4_sem = asyncio.Semaphore(3)
    async with pool.acquire() as conn:
        block1, block2, block3, block4 = await asyncio.gather(
            _compute_block1_yoy(conn, params),
            _compute_block2_mom(conn, params),
            _compute_block3_meal_split(conn, params),
            _compute_block4_diner_dist(pool, params, block4_sem),
        )
    return TemplateResult(
        code="qhj_revenue_report",
        title="收入管理报表",
        data={
            "block1_yoy": block1,
            "block2_mom": block2,
            "block3_meal_split": block3,
            "block4_diner_dist": block4,
            "meta": {
                "date_from": params.date_from.isoformat(),
                "date_to": params.date_to.isoformat(),
                "yoy_available": params.include_yoy,
                "yoy_note": "需要 2024 同期数据" if not params.include_yoy else None,
            },
        },
        applies=True,
    )


async def _compute_block1_yoy(conn, params):  # filled in Task E2
    return []


async def _compute_block2_mom(conn, params):  # filled in Task E3
    return []


async def _compute_block3_meal_split(conn, params):  # filled in Task E4
    return []


async def _compute_block4_diner_dist(pool, params, sem):  # filled in Task E5
    return []
```

- [ ] **Step 4: Run, verify pass**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_template_entry.py -v`
Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi/canonical/templates/qhj_revenue_report.py backend/python/smartbi/tests/test_revenue_report_template_entry.py
git commit -m "feat(smartbi): add qhj_revenue_report template entry + RevenueReportParams" -- backend/python/smartbi/canonical/templates/qhj_revenue_report.py backend/python/smartbi/tests/test_revenue_report_template_entry.py
```

---

### Task E2-E4: Block 1, 2, 3 SQL (combined — shared SQL skeleton)

**Spec ref:** §6.3 (Block 1/2 shared SQL), §6.4 (Block 3 SQL).

**Files:**
- Modify: `backend/python/smartbi/canonical/templates/qhj_revenue_report.py` (fill `_compute_block1_yoy/_compute_block2_mom/_compute_block3_meal_split`)
- Test: `backend/python/smartbi/tests/test_revenue_report_template_blocks_1_2_3.py`

- [ ] **Step 1: Write failing tests** — see spec §6.3-§6.4 for SQL semantics

```python
import pytest
from datetime import date
from smartbi.canonical.templates.qhj_revenue_report import (
    RevenueReportParams, _compute_block1_yoy, _compute_block2_mom, _compute_block3_meal_split,
)

@pytest.fixture
async def populated_gold(pg_test_db_with_gold_data, factory_ctx):
    """Fixture inserts agg_daily_order_type_meal rows for known store + date range."""
    yield pg_test_db_with_gold_data, factory_ctx

@pytest.mark.asyncio
async def test_block1_yoy_returns_null_yoy_columns_when_disabled(populated_gold):
    conn, factory_ctx = populated_gold
    params = RevenueReportParams(
        factory_id=factory_ctx, store_ids=[1, 2],
        date_from=date(2025, 10, 1), date_to=date(2025, 10, 7),
        include_yoy=False,
    )
    rows = await _compute_block1_yoy(conn, params)
    assert len(rows) > 0
    for r in rows:
        assert r.get("prev_total") is None
        assert r.get("total_ratio") is None
        assert r["total"] is not None

@pytest.mark.asyncio
async def test_block2_mom_computes_previous_period(populated_gold):
    conn, factory_ctx = populated_gold
    params = RevenueReportParams(
        factory_id=factory_ctx, store_ids=[1, 2],
        date_from=date(2025, 10, 8), date_to=date(2025, 10, 14),
    )
    rows = await _compute_block2_mom(conn, params)
    for r in rows:
        # If previous period had data, ratio non-NULL
        if r["prev_total"] and r["prev_total"] > 0:
            assert r["total_ratio"] is not None

@pytest.mark.asyncio
async def test_block3_meal_split_returns_dine_in_takeout_ratios(populated_gold):
    conn, factory_ctx = populated_gold
    params = RevenueReportParams(
        factory_id=factory_ctx, store_ids=[1],
        date_from=date(2025, 10, 1), date_to=date(2025, 10, 7),
    )
    rows = await _compute_block3_meal_split(conn, params)
    assert len(rows) >= 1
    r = rows[0]
    assert "dine_in_revenue" in r
    assert "takeout_revenue" in r
    assert "dine_in_bills" in r
    assert "takeout_bills" in r

@pytest.mark.asyncio
async def test_block_leftjoin_includes_zero_revenue_stores(populated_gold):
    """Stores with no orders in the period still appear with 0/NULL values."""
    conn, factory_ctx = populated_gold
    params = RevenueReportParams(
        factory_id=factory_ctx, store_ids=[1, 2, 999],  # 999 = empty store
        date_from=date(2025, 10, 1), date_to=date(2025, 10, 7),
    )
    rows = await _compute_block3_meal_split(conn, params)
    store_ids_returned = {r["store_id"] for r in rows}
    assert 999 in store_ids_returned
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_template_blocks_1_2_3.py -v`
Expected: FAIL (block fns return empty list)

- [ ] **Step 3: Implement blocks 1/2/3** — use spec §6.3 and §6.4 SQL verbatim

Implement in `qhj_revenue_report.py`:

```python
async def _compute_block1_yoy(conn, params: RevenueReportParams) -> list[dict]:
    if params.include_yoy:
        prev_from = params.date_from.replace(year=params.date_from.year - 1)
        prev_to = params.date_to.replace(year=params.date_to.year - 1)
    else:
        prev_from = prev_to = None  # signals "skip prev query"

    return await _run_period_compare(conn, params, prev_from, prev_to, label="yoy")


async def _compute_block2_mom(conn, params: RevenueReportParams) -> list[dict]:
    span = (params.date_to - params.date_from).days + 1
    from datetime import timedelta
    prev_to = params.date_from - timedelta(days=1)
    prev_from = prev_to - timedelta(days=span - 1)
    return await _run_period_compare(conn, params, prev_from, prev_to, label="mom")


async def _run_period_compare(conn, params, prev_from, prev_to, label: str) -> list[dict]:
    meal_periods = params.meal_periods or []
    sql_current = """
    SELECT s.store_id, s.name AS store_name,
      COALESCE(SUM(a.actual_receive), 0) AS total,
      COALESCE(SUM(CASE WHEN TRIM(a.order_type)='堂食' THEN a.actual_receive END), 0) AS dine_in,
      COALESCE(SUM(CASE WHEN TRIM(a.order_type)='外卖' THEN a.actual_receive END), 0) AS takeout
    FROM dim_store s
    LEFT JOIN agg_daily_order_type_meal a
      ON a.factory_id = $1 AND a.store_id = s.store_id
     AND a.date BETWEEN $2 AND $3
     AND (CARDINALITY($4::text[]) = 0 OR a.meal_period = ANY($4))
    WHERE s.factory_id = $1 AND s.store_id = ANY($5)
    GROUP BY s.store_id, s.name
    ORDER BY s.name
    """
    cur = await conn.fetch(sql_current, params.factory_id,
                           params.date_from, params.date_to,
                           meal_periods, params.store_ids)

    if prev_from is None:
        return [{**dict(r), "prev_total": None, "prev_dine_in": None, "prev_takeout": None,
                 "total_ratio": None, "dine_in_ratio": None, "takeout_ratio": None}
                for r in cur]

    prev = await conn.fetch(sql_current, params.factory_id, prev_from, prev_to,
                            meal_periods, params.store_ids)
    prev_map = {r["store_id"]: r for r in prev}
    
    def ratio(a, b):
        return round(float(a - b) * 100 / float(b), 2) if b else None
    
    result = []
    for r in cur:
        p = prev_map.get(r["store_id"])
        result.append({
            **dict(r),
            "prev_total":   float(p["total"])   if p else None,
            "prev_dine_in": float(p["dine_in"]) if p else None,
            "prev_takeout": float(p["takeout"]) if p else None,
            "total_ratio":   ratio(r["total"],   p["total"])   if p else None,
            "dine_in_ratio": ratio(r["dine_in"], p["dine_in"]) if p else None,
            "takeout_ratio": ratio(r["takeout"], p["takeout"]) if p else None,
        })
    return result


async def _compute_block3_meal_split(conn, params: RevenueReportParams) -> list[dict]:
    meal_periods = params.meal_periods or []
    sql = """
    SELECT s.store_id, s.name AS store_name,
      COALESCE(SUM(CASE WHEN TRIM(a.order_type)='堂食' THEN a.actual_receive ELSE 0 END), 0) AS dine_in_revenue,
      COALESCE(SUM(CASE WHEN TRIM(a.order_type)='外卖' THEN a.actual_receive ELSE 0 END), 0) AS takeout_revenue,
      COALESCE(SUM(CASE WHEN TRIM(a.order_type)='堂食' THEN a.bill_count    ELSE 0 END), 0) AS dine_in_bills,
      COALESCE(SUM(CASE WHEN TRIM(a.order_type)='外卖' THEN a.bill_count    ELSE 0 END), 0) AS takeout_bills
    FROM dim_store s
    LEFT JOIN agg_daily_order_type_meal a
      ON a.factory_id = $1 AND a.store_id = s.store_id
     AND a.date BETWEEN $2 AND $3
     AND (CARDINALITY($4::text[]) = 0 OR a.meal_period = ANY($4))
    WHERE s.factory_id = $1 AND s.store_id = ANY($5)
    GROUP BY s.store_id, s.name
    ORDER BY s.name
    """
    rows = await conn.fetch(sql, params.factory_id,
                            params.date_from, params.date_to,
                            meal_periods, params.store_ids)
    result = []
    for r in rows:
        total_rev = float(r["dine_in_revenue"]) + float(r["takeout_revenue"])
        total_bills = int(r["dine_in_bills"]) + int(r["takeout_bills"])
        result.append({
            **dict(r),
            "revenue_ratio": (float(r["dine_in_revenue"]) / total_rev) if total_rev else None,
            "bill_ratio":    (int(r["dine_in_bills"])    / total_bills) if total_bills else None,
        })
    return result
```

- [ ] **Step 4: Run, verify pass**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_template_blocks_1_2_3.py -v`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi/canonical/templates/qhj_revenue_report.py backend/python/smartbi/tests/test_revenue_report_template_blocks_1_2_3.py
git commit -m "feat(smartbi): Block 1/2/3 SQL (yoy/mom/meal_split) for QHJ revenue report" -- backend/python/smartbi/canonical/templates/qhj_revenue_report.py backend/python/smartbi/tests/test_revenue_report_template_blocks_1_2_3.py
```

---

### Task E5: Block 4 SQL (客单人数 per-store + semaphore)

**Spec ref:** §6.5 (full SQL).

**Files:**
- Modify: `backend/python/smartbi/canonical/templates/qhj_revenue_report.py` (fill `_compute_block4_diner_dist`)
- Test: `backend/python/smartbi/tests/test_revenue_report_template_block_4.py`

- [ ] **Step 1: Write failing test**

```python
import asyncio, pytest
from datetime import date
from smartbi.canonical.templates.qhj_revenue_report import (
    RevenueReportParams, _compute_block4_diner_dist,
)

@pytest.mark.asyncio
async def test_block4_groups_by_customer_count_per_store(populated_silver_with_items, pg_pool, factory_ctx):
    """populated_silver_with_items inserts bills with customer_count 1..6 + items."""
    params = RevenueReportParams(
        factory_id=factory_ctx, store_ids=[1, 2],
        date_from=date(2025, 10, 1), date_to=date(2025, 10, 7),
    )
    sem = asyncio.Semaphore(3)
    result = await _compute_block4_diner_dist(pg_pool, params, sem)
    
    assert len(result) == 2  # one block per store
    for store_block in result:
        assert "store_name" in store_block
        assert "distribution" in store_block
        diner_counts = [d["diner_count"] for d in store_block["distribution"]]
        assert all(dc >= 1 for dc in diner_counts)  # customer_count > 0 filter

@pytest.mark.asyncio
async def test_block4_filters_null_and_zero_customer_count(populated_silver_with_items, pg_pool, factory_ctx):
    """customer_count IS NULL OR = 0 rows are filtered out per spec §6.5."""
    params = RevenueReportParams(
        factory_id=factory_ctx, store_ids=[1],
        date_from=date(2025, 10, 1), date_to=date(2025, 10, 7),
    )
    sem = asyncio.Semaphore(3)
    result = await _compute_block4_diner_dist(pg_pool, params, sem)
    for store_block in result:
        for d in store_block["distribution"]:
            assert d["diner_count"] > 0

@pytest.mark.asyncio
async def test_block4_dual_per_diner_metrics(populated_silver_with_items, pg_pool, factory_ctx):
    """Spec §6.5 / §11.1: outputs both revenue_per_diner AND revenue_per_item."""
    params = RevenueReportParams(
        factory_id=factory_ctx, store_ids=[1],
        date_from=date(2025, 10, 1), date_to=date(2025, 10, 7),
    )
    sem = asyncio.Semaphore(3)
    result = await _compute_block4_diner_dist(pg_pool, params, sem)
    for store_block in result:
        for d in store_block["distribution"]:
            assert "revenue_per_diner" in d
            assert "revenue_per_item" in d
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_template_block_4.py -v`
Expected: FAIL (returns empty)

- [ ] **Step 3: Implement Block 4** (full SQL from spec §6.5)

```python
async def _compute_block4_diner_dist(pool, params: RevenueReportParams, sem: asyncio.Semaphore) -> list[dict]:
    """For each store, dispatch a separate per-store query under semaphore (pool max=5)."""
    async def _one_store(store_id: int) -> dict:
        async with sem:
            async with pool.acquire() as conn:
                await conn.execute("SELECT set_config('app.factory_id', $1, false)", params.factory_id)
                store_name = await conn.fetchval(
                    "SELECT name FROM dim_store WHERE factory_id=$1 AND store_id=$2",
                    params.factory_id, store_id)
                sql = """
                WITH bill_items AS (
                  SELECT t.id AS txn_id, t.customer_count, t.actual_receive,
                         (SELECT COALESCE(SUM(i.qty), 0)
                          FROM fact_pos_item i WHERE i.transaction_id = t.id) AS items_per_bill
                  FROM fact_pos_transaction t
                  WHERE t.factory_id = $1 AND t.store_id = $2
                    AND t.date BETWEEN $3 AND $4
                    AND t.customer_count IS NOT NULL AND t.customer_count > 0
                    AND (CARDINALITY($5::text[]) = 0 OR TRIM(t.meal_period) = ANY($5))
                ),
                totals AS (
                  SELECT COUNT(*) AS total_bills,
                         SUM(actual_receive) AS total_revenue
                  FROM bill_items
                )
                SELECT
                  bi.customer_count AS diner_count,
                  COUNT(*) AS bill_count,
                  ROUND(COUNT(*)::numeric / NULLIF(t.total_bills, 0), 3) AS bill_ratio,
                  SUM(bi.items_per_bill) AS total_items,
                  ROUND(SUM(bi.items_per_bill) / NULLIF(COUNT(*), 0), 1) AS avg_items_per_bill,
                  SUM(bi.actual_receive) AS revenue,
                  ROUND(SUM(bi.actual_receive) /
                        NULLIF(bi.customer_count * COUNT(*), 0), 0) AS revenue_per_diner,
                  ROUND(SUM(bi.actual_receive) /
                        NULLIF(SUM(bi.items_per_bill), 0), 0) AS revenue_per_item,
                  ROUND(SUM(bi.actual_receive) /
                        NULLIF(t.total_revenue, 0), 3) AS revenue_ratio
                FROM bill_items bi CROSS JOIN totals t
                GROUP BY bi.customer_count, t.total_bills, t.total_revenue
                ORDER BY bi.customer_count
                """
                rows = await conn.fetch(sql, params.factory_id, store_id,
                                        params.date_from, params.date_to,
                                        params.meal_periods or [])
                return {
                    "store_id": store_id,
                    "store_name": store_name or f"store_{store_id}",
                    "date_range": f"{params.date_from} ~ {params.date_to}",
                    "distribution": [dict(r) for r in rows],
                }

    return await asyncio.gather(*[_one_store(sid) for sid in params.store_ids])
```

- [ ] **Step 4: Run, verify pass**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_template_block_4.py -v`
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi/canonical/templates/qhj_revenue_report.py backend/python/smartbi/tests/test_revenue_report_template_block_4.py
git commit -m "feat(smartbi): Block 4 客单人数分析 per-store concurrent compute" -- backend/python/smartbi/canonical/templates/qhj_revenue_report.py backend/python/smartbi/tests/test_revenue_report_template_block_4.py
```

---

## Phase F — xlsx Renderer + Prometheus Metrics

### Task F1: Pure-code openpyxl renderer

**Spec ref:** §7.1-§7.2 (pure-code build, multi-tenant registry).

**Files:**
- Create: `backend/python/smartbi/services/excel_renderers/__init__.py` (registry)
- Create: `backend/python/smartbi/services/excel_renderers/qhj_revenue_v1.py`
- Create: `backend/python/smartbi/services/excel_renderers/_labels.py`
- Test: `backend/python/smartbi/tests/test_revenue_report_renderer.py`

- [ ] **Step 1: Write failing test**

```python
import io
from openpyxl import load_workbook
import pytest
from smartbi.services.excel_renderers.qhj_revenue_v1 import render
from smartbi.services.excel_renderers._labels import LABELS

@pytest.fixture
def sample_report_data():
    return {
        "block1_yoy": [
            {"store_name": "青花椒南方百联店", "total": 10000, "dine_in": 7000, "takeout": 3000,
             "prev_total": None, "prev_dine_in": None, "prev_takeout": None,
             "total_ratio": None, "dine_in_ratio": None, "takeout_ratio": None},
        ],
        "block2_mom": [
            {"store_name": "青花椒南方百联店", "total": 10000, "dine_in": 7000, "takeout": 3000,
             "prev_total": 8000, "prev_dine_in": 5000, "prev_takeout": 3000,
             "total_ratio": 25.0, "dine_in_ratio": 40.0, "takeout_ratio": 0.0},
        ],
        "block3_meal_split": [
            {"store_id": 1, "store_name": "青花椒南方百联店",
             "dine_in_revenue": 7000, "takeout_revenue": 3000,
             "dine_in_bills": 50, "takeout_bills": 20,
             "revenue_ratio": 0.7, "bill_ratio": 0.714},
        ],
        "block4_diner_dist": [{
            "store_id": 1, "store_name": "青花椒南方百联店",
            "date_range": "2025-10-01 ~ 2025-10-07",
            "distribution": [
                {"diner_count": 1, "bill_count": 5, "bill_ratio": 0.1,
                 "total_items": 12, "avg_items_per_bill": 2.4,
                 "revenue": 500, "revenue_per_diner": 100, "revenue_per_item": 42,
                 "revenue_ratio": 0.05},
                {"diner_count": 2, "bill_count": 30, "bill_ratio": 0.6,
                 "total_items": 90, "avg_items_per_bill": 3.0,
                 "revenue": 4500, "revenue_per_diner": 75, "revenue_per_item": 50,
                 "revenue_ratio": 0.45},
            ],
        }],
        "meta": {"date_from": "2025-10-01", "date_to": "2025-10-07",
                 "yoy_available": False, "yoy_note": "需要 2024 数据"},
    }

def test_render_returns_bytesio_with_xlsx(sample_report_data):
    buf = render(sample_report_data, labels=LABELS["zh-CN"])
    assert isinstance(buf, io.BytesIO)
    wb = load_workbook(buf)
    assert "收入管理报表" in wb.sheetnames

def test_render_block1_writes_store_row(sample_report_data):
    buf = render(sample_report_data, labels=LABELS["zh-CN"])
    wb = load_workbook(buf)
    ws = wb.active
    # Find a cell containing 店 name; Block 1 should be near top
    found = False
    for row in ws.iter_rows(values_only=True):
        if any(cell == "青花椒南方百联店" for cell in row if cell):
            found = True
            break
    assert found

def test_render_block4_supports_multi_store(sample_report_data):
    sample_report_data["block4_diner_dist"].append({
        "store_id": 2, "store_name": "青花椒徐汇店",
        "date_range": "2025-10-01 ~ 2025-10-07",
        "distribution": [{"diner_count": 1, "bill_count": 2, "bill_ratio": 0.5,
                          "total_items": 6, "avg_items_per_bill": 3.0,
                          "revenue": 200, "revenue_per_diner": 100,
                          "revenue_per_item": 33, "revenue_ratio": 0.5}],
    })
    buf = render(sample_report_data, labels=LABELS["zh-CN"])
    wb = load_workbook(buf)
    ws = wb.active
    text = "\n".join(str(c.value) for row in ws.iter_rows() for c in row if c.value)
    assert "青花椒徐汇店" in text  # Second store block stacked below first
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_renderer.py -v`
Expected: FAIL

- [ ] **Step 3: Write `_labels.py`**

```python
# backend/python/smartbi/services/excel_renderers/_labels.py
"""i18n label dict for revenue report renderer. Externalized per spec §7.1."""

LABELS = {
    "zh-CN": {
        "title":             "收入管理报表",
        "block1_title":      "可比同比",
        "block2_title":      "环比",
        "block3_title":      "堂食外卖占比",
        "block4_title":      "客单人数分析",
        "store_name":        "门店名称",
        "total_summary":     "汇总实际收入",
        "dine_in":           "堂食",
        "takeout":           "外卖",
        "current":           "本期",
        "prev_yoy":          "去年同期",
        "prev_mom":          "环比",
        "ratio_yoy":         "同比率",
        "ratio_mom":         "环比率",
        "actual_revenue":    "实际收入",
        "no_data":           "—",
        "no_yoy_data":       "需要 2024 数据",
        "diner_count":       "客单人数",
        "bill_count":        "客单量",
        "bill_ratio":        "客单占比",
        "total_items":       "点单份数",
        "avg_items":         "人均点单数量",
        "revenue":           "实收额",
        "revenue_per_diner": "实际人均",
        "revenue_per_item":  "份均消费",
        "revenue_ratio":     "营业额占比",
        "total_row":         "总计",
    },
}
```

- [ ] **Step 4: Write `qhj_revenue_v1.py` renderer**

```python
# backend/python/smartbi/services/excel_renderers/qhj_revenue_v1.py
"""Pure-code openpyxl renderer for QHJ 收入管理报表 v1.

Builds workbook from scratch (no template-load) per spec §7.1.
"""
from io import BytesIO
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill

_HEADER_FONT = Font(name="微软雅黑", size=10, bold=True)
_BODY_FONT = Font(name="微软雅黑", size=10)
_BORDER = Border(left=Side(style="thin"), right=Side(style="thin"),
                 top=Side(style="thin"), bottom=Side(style="thin"))
_HEADER_FILL = PatternFill("solid", fgColor="DDEBF7")
_CENTER = Alignment(horizontal="center", vertical="center")

_MONEY_FMT = "#,##0.00"
_RATIO_FMT = "0.00%"
_INT_FMT = "#,##0"


def render(report_data: dict, labels: dict) -> BytesIO:
    wb = Workbook()
    ws = wb.active
    ws.title = labels["title"]

    cursor = 3
    cursor = _write_compare_block(ws, cursor, report_data["block1_yoy"], labels,
                                  block_title=labels["block1_title"],
                                  prev_label=labels["prev_yoy"],
                                  ratio_label=labels["ratio_yoy"],
                                  no_data_note=labels["no_yoy_data"] if not report_data["meta"]["yoy_available"] else None)
    cursor += 2
    cursor = _write_compare_block(ws, cursor, report_data["block2_mom"], labels,
                                  block_title=labels["block2_title"],
                                  prev_label=labels["prev_mom"],
                                  ratio_label=labels["ratio_mom"])
    cursor += 2
    cursor = _write_block3(ws, cursor, report_data["block3_meal_split"], labels)
    cursor += 2
    cursor = _write_block4(ws, cursor, report_data["block4_diner_dist"], labels)

    for col_letter, width in (("B", 28), ("C", 14), ("D", 14), ("E", 14), ("F", 10),
                              ("G", 14), ("H", 14), ("I", 14), ("J", 10),
                              ("K", 14), ("L", 14), ("M", 14), ("N", 10)):
        ws.column_dimensions[col_letter].width = width

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def _set_header(cell, text):
    cell.value = text
    cell.font = _HEADER_FONT
    cell.alignment = _CENTER
    cell.fill = _HEADER_FILL
    cell.border = _BORDER


def _write_compare_block(ws, start_row, rows, labels, block_title, prev_label, ratio_label,
                         no_data_note: str | None = None) -> int:
    # Row 1: title + merged labels
    ws.cell(start_row, 2, block_title).font = _HEADER_FONT
    ws.merge_cells(start_row=start_row, end_row=start_row, start_column=3, end_column=5)
    _set_header(ws.cell(start_row, 3), labels["total_summary"])
    ws.merge_cells(start_row=start_row, end_row=start_row, start_column=6, end_column=8)
    _set_header(ws.cell(start_row, 6), labels["dine_in"])
    ws.merge_cells(start_row=start_row, end_row=start_row, start_column=9, end_column=11)
    _set_header(ws.cell(start_row, 9), labels["takeout"])

    # Row 2: column headers
    headers_row = start_row + 1
    headers = [labels["store_name"],
               labels["current"], prev_label, ratio_label,
               labels["current"], prev_label, ratio_label,
               labels["current"], prev_label, ratio_label]
    for col, label in enumerate(headers, start=2):
        _set_header(ws.cell(headers_row, col), label)

    # Data rows
    for i, row in enumerate(rows):
        r = headers_row + 1 + i
        ws.cell(r, 2, row["store_name"]).font = _BODY_FONT
        for col, (val, fmt) in enumerate([
            (row["total"],         _MONEY_FMT),
            (row.get("prev_total"), _MONEY_FMT),
            (row.get("total_ratio"), _RATIO_FMT),
            (row["dine_in"],       _MONEY_FMT),
            (row.get("prev_dine_in"), _MONEY_FMT),
            (row.get("dine_in_ratio"), _RATIO_FMT),
            (row["takeout"],       _MONEY_FMT),
            (row.get("prev_takeout"), _MONEY_FMT),
            (row.get("takeout_ratio"), _RATIO_FMT),
        ], start=3):
            c = ws.cell(r, col)
            if val is None:
                c.value = labels["no_data"]
                if no_data_note and fmt == _MONEY_FMT:
                    c.value = labels["no_data"]  # Plain "—"
            else:
                # Ratio columns: backend returns 0-100 (percent); convert to 0-1 for "0.00%" format
                if fmt == _RATIO_FMT:
                    c.value = float(val) / 100
                else:
                    c.value = val
                c.number_format = fmt
            c.font = _BODY_FONT
            c.border = _BORDER

    return headers_row + 1 + len(rows)


def _write_block3(ws, start_row, rows, labels) -> int:
    ws.cell(start_row, 2, labels["block3_title"]).font = _HEADER_FONT
    header_row = start_row + 1
    headers = [labels["store_name"],
               f'{labels["actual_revenue"]}{labels["dine_in"]}',
               f'{labels["actual_revenue"]}{labels["takeout"]}',
               labels["revenue_ratio"],
               f'{labels["bill_count"]}{labels["dine_in"]}',
               f'{labels["bill_count"]}{labels["takeout"]}',
               labels["bill_ratio"]]
    for col, label in enumerate(headers, start=2):
        _set_header(ws.cell(header_row, col), label)
    for i, row in enumerate(rows):
        r = header_row + 1 + i
        ws.cell(r, 2, row["store_name"]).font = _BODY_FONT
        cells = [
            (row["dine_in_revenue"], _MONEY_FMT),
            (row["takeout_revenue"], _MONEY_FMT),
            (row.get("revenue_ratio"), _RATIO_FMT),
            (row["dine_in_bills"], _INT_FMT),
            (row["takeout_bills"], _INT_FMT),
            (row.get("bill_ratio"), _RATIO_FMT),
        ]
        for col, (val, fmt) in enumerate(cells, start=3):
            c = ws.cell(r, col)
            if val is None:
                c.value = labels["no_data"]
            else:
                c.value = val
                c.number_format = fmt
            c.font = _BODY_FONT
            c.border = _BORDER
    return header_row + 1 + len(rows)


def _write_block4(ws, start_row, store_blocks, labels) -> int:
    cursor = start_row
    for block in store_blocks:
        ws.cell(cursor, 2, f'{block["store_name"]}  {block["date_range"]}').font = _HEADER_FONT
        header_row = cursor + 1
        headers = [labels["diner_count"], labels["bill_count"], labels["bill_ratio"],
                   labels["total_items"], labels["avg_items"], labels["revenue"],
                   labels["revenue_per_diner"], labels["revenue_per_item"], labels["revenue_ratio"]]
        for col, label in enumerate(headers, start=2):
            _set_header(ws.cell(header_row, col), label)
        for i, d in enumerate(block["distribution"]):
            r = header_row + 1 + i
            for col, (val, fmt) in enumerate([
                (d["diner_count"], _INT_FMT),
                (d["bill_count"], _INT_FMT),
                (d.get("bill_ratio"), _RATIO_FMT),
                (d["total_items"], _INT_FMT),
                (d.get("avg_items_per_bill"), "#,##0.0"),
                (d["revenue"], _MONEY_FMT),
                (d.get("revenue_per_diner"), _INT_FMT),
                (d.get("revenue_per_item"), _INT_FMT),
                (d.get("revenue_ratio"), _RATIO_FMT),
            ], start=2):
                c = ws.cell(r, col)
                if val is None:
                    c.value = labels["no_data"]
                else:
                    c.value = val
                    c.number_format = fmt
                c.font = _BODY_FONT
                c.border = _BORDER
        # Total row
        total_row = header_row + 1 + len(block["distribution"])
        ws.cell(total_row, 2, labels["total_row"]).font = _HEADER_FONT
        ws.cell(total_row, 3, sum(d["bill_count"] for d in block["distribution"])).number_format = _INT_FMT
        ws.cell(total_row, 7, sum(float(d["revenue"]) for d in block["distribution"])).number_format = _MONEY_FMT
        cursor = total_row + 2
    return cursor
```

- [ ] **Step 5: Write `__init__.py` registry**

```python
# backend/python/smartbi/services/excel_renderers/__init__.py
"""Renderer registry. Multi-tenant: each customer/template combo registers here."""
from smartbi.services.excel_renderers.qhj_revenue_v1 import render as _qhj_v1

RENDERERS = {
    "qhj_revenue_v1": _qhj_v1,
}
```

- [ ] **Step 6: Run, verify pass**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_renderer.py -v`
Expected: 3 tests PASS

- [ ] **Step 7: Commit**

```bash
git add backend/python/smartbi/services/excel_renderers/ backend/python/smartbi/tests/test_revenue_report_renderer.py
git commit -m "feat(smartbi): pure-code openpyxl renderer for QHJ revenue report v1" -- backend/python/smartbi/services/excel_renderers/__init__.py backend/python/smartbi/services/excel_renderers/qhj_revenue_v1.py backend/python/smartbi/services/excel_renderers/_labels.py backend/python/smartbi/tests/test_revenue_report_renderer.py
```

---

### Task F2: Prometheus metrics module

**Spec ref:** §10.4, §11.3 (cache_hit semantics).

**Files:**
- Create: `backend/python/smartbi/services/excel_renderers/_metrics.py`
- Test: `backend/python/smartbi/tests/test_revenue_report_metrics.py`

- [ ] **Step 1: Write failing test**

```python
from smartbi.services.excel_renderers._metrics import (
    REPORT_GEN_SECONDS, REPORT_GEN_FILE_BYTES, REPORT_GEN_ERRORS,
    REPORT_CACHE_HIT, REPORT_CACHE_MISS,
)

def test_metrics_are_prometheus_objects():
    REPORT_GEN_SECONDS.labels(report_type="qhj_revenue_v1", status="ok").observe(1.5)
    REPORT_GEN_FILE_BYTES.labels(report_type="qhj_revenue_v1").observe(28456)
    REPORT_GEN_ERRORS.labels(type="OpenpyxlError").inc()
    REPORT_CACHE_HIT.labels(report_type="qhj_revenue_v1").inc()
    REPORT_CACHE_MISS.labels(report_type="qhj_revenue_v1").inc()
    # If no exception, all metric objects properly defined.

def test_metric_names_match_spec():
    assert REPORT_GEN_SECONDS._name == "smartbi_report_gen_seconds"
    assert REPORT_CACHE_HIT._name == "smartbi_report_cache_hit"
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_metrics.py -v`
Expected: FAIL

- [ ] **Step 3: Implement**

```python
# backend/python/smartbi/services/excel_renderers/_metrics.py
"""Prometheus metrics for revenue report generation. Per spec §10.4 + §11.3."""
from prometheus_client import Histogram, Counter

REPORT_GEN_SECONDS = Histogram(
    "smartbi_report_gen_seconds",
    "Xlsx report generation time (cache miss path only)",
    labelnames=["report_type", "status"],
    buckets=(0.5, 1, 2, 5, 10, 30, 60),
)
REPORT_GEN_FILE_BYTES = Histogram(
    "smartbi_report_file_bytes",
    "Generated xlsx file size in bytes",
    labelnames=["report_type"],
    buckets=(50_000, 200_000, 1_000_000, 5_000_000, 20_000_000),
)
REPORT_GEN_ERRORS = Counter(
    "smartbi_report_gen_errors_total",
    "Xlsx report generation failures",
    labelnames=["type"],
)
REPORT_CACHE_HIT = Counter(
    "smartbi_report_cache_hit_total",
    "Redis cache hits for revenue report",
    labelnames=["report_type"],
)
REPORT_CACHE_MISS = Counter(
    "smartbi_report_cache_miss_total",
    "Redis cache misses for revenue report",
    labelnames=["report_type"],
)
```

- [ ] **Step 4: Run, verify pass**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_metrics.py -v`
Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi/services/excel_renderers/_metrics.py backend/python/smartbi/tests/test_revenue_report_metrics.py
git commit -m "feat(smartbi): add Prometheus metrics for revenue report (gen/cache/errors)" -- backend/python/smartbi/services/excel_renderers/_metrics.py backend/python/smartbi/tests/test_revenue_report_metrics.py
```

---

## Phase G — API Endpoints + CORS

### Task G1: `_generate_with_cache` helper + Redis client

**Spec ref:** §7.3 (cache strategy), §10.7 (`_generate_with_cache` helper), §11.3 (cache_hit semantics).

**Files:**
- Create: `backend/python/smartbi/api/_revenue_report_helpers.py`
- Test: `backend/python/smartbi/tests/test_revenue_report_helpers.py`

- [ ] **Step 1: Write failing test**

```python
import pytest, hashlib, json
from datetime import date
from smartbi.api._revenue_report_helpers import (
    compute_cache_key, _generate_with_cache,
)
from smartbi.canonical.templates.qhj_revenue_report import RevenueReportParams

def test_cache_key_includes_factory_params_hash_and_gold_ts():
    params = RevenueReportParams(
        factory_id="R_QINGHUAJIAO_REAL", store_ids=[1, 2],
        date_from=date(2025, 10, 1), date_to=date(2025, 10, 7),
    )
    key = compute_cache_key(params, gold_ts="2025-10-07T18:00:00")
    assert key.startswith("revenue_report:R_QINGHUAJIAO_REAL:")
    assert key.endswith(":2025-10-07T18:00:00")

@pytest.mark.asyncio
async def test_generate_with_cache_returns_buffer_and_summary(pg_pool, fake_redis, factory_ctx, populated_gold_data):
    params = RevenueReportParams(
        factory_id=factory_ctx, store_ids=[1, 2],
        date_from=date(2025, 10, 1), date_to=date(2025, 10, 7),
    )
    cache_key, summary, buf = await _generate_with_cache(
        pg_pool, fake_redis, params, user_id="test_user"
    )
    assert summary["cache_hit"] is False
    assert summary["store_count"] == 2
    assert buf.read(2) == b"PK"  # xlsx zip signature

@pytest.mark.asyncio
async def test_generate_with_cache_second_call_is_cache_hit(pg_pool, fake_redis, factory_ctx, populated_gold_data):
    params = RevenueReportParams(
        factory_id=factory_ctx, store_ids=[1, 2],
        date_from=date(2025, 10, 1), date_to=date(2025, 10, 7),
    )
    await _generate_with_cache(pg_pool, fake_redis, params, user_id="test_user")
    _, summary2, _ = await _generate_with_cache(pg_pool, fake_redis, params, user_id="test_user")
    assert summary2["cache_hit"] is True
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_helpers.py -v`
Expected: FAIL

- [ ] **Step 3: Implement helper**

```python
# backend/python/smartbi/api/_revenue_report_helpers.py
"""Shared helper for /prepare + /generate endpoints. Smart cache + audit log + materialization check."""
import hashlib, json, time
from dataclasses import asdict
from datetime import datetime, timedelta
from io import BytesIO
from typing import Optional

from smartbi.canonical.concurrency import with_factory_serialization
from smartbi.canonical.templates.qhj_revenue_report import (
    RevenueReportParams, compute_qhj_revenue_report,
)
from smartbi.services.excel_renderers import RENDERERS
from smartbi.services.excel_renderers._labels import LABELS
from smartbi.services.excel_renderers._metrics import (
    REPORT_GEN_SECONDS, REPORT_GEN_FILE_BYTES, REPORT_GEN_ERRORS,
    REPORT_CACHE_HIT, REPORT_CACHE_MISS,
)
from smartbi.services.materialized_analytics.materializer import (
    materialize_daily_order_type_meal,
)

CACHE_TTL = 24 * 3600


def compute_cache_key(params: RevenueReportParams, gold_ts: str) -> str:
    body = json.dumps({
        "store_ids": sorted(params.store_ids),
        "date_from": params.date_from.isoformat(),
        "date_to": params.date_to.isoformat(),
        "meal_periods": sorted(params.meal_periods or []),
        "include_yoy": params.include_yoy,
    }, sort_keys=True).encode()
    h = hashlib.sha256(body).hexdigest()
    return f"revenue_report:{params.factory_id}:{h}:{gold_ts}"


async def _ensure_gold_freshness(conn, params: RevenueReportParams, timeout_sec: int = 5):
    """Returns (gold_ts: ISO str, is_stale: bool)."""
    gold_max = await conn.fetchval("""
        SELECT MAX(computed_at) FROM agg_daily_order_type_meal
        WHERE factory_id = $1 AND date BETWEEN $2 AND $3
    """, params.factory_id, params.date_from, params.date_to)
    if gold_max is None:
        # Trigger on-demand materialization
        await materialize_daily_order_type_meal(
            conn, params.factory_id, params.date_from, params.date_to)
        gold_max = datetime.now()
        return gold_max.isoformat(), False
    return gold_max.isoformat(), False  # Phase 2: detect lag and set is_stale=True


async def _generate_with_cache(pool, redis_client, params: RevenueReportParams,
                               user_id: str) -> tuple[str, dict, BytesIO]:
    """Returns (cache_key, summary_dict, BytesIO of xlsx)."""
    t0 = time.time()
    
    async with pool.acquire() as conn:
        await conn.execute("SELECT set_config('app.factory_id', $1, false)", params.factory_id)
        gold_ts, is_stale = await _ensure_gold_freshness(conn, params)
    
    cache_key = compute_cache_key(params, gold_ts)
    
    cached = await redis_client.get(cache_key)
    if cached:
        REPORT_CACHE_HIT.labels(report_type="qhj_revenue_v1").inc()
        summary = {
            "store_count": len(params.store_ids),
            "date_range": f"{params.date_from} - {params.date_to}",
            "gold_materialized_at": gold_ts,
            "file_size_bytes": len(cached),
            "cache_hit": True,
            "is_stale": is_stale,
        }
        await _log_audit(pool, params, user_id, cache_key, summary,
                         duration_ms=int((time.time() - t0) * 1000), status="ok")
        return cache_key, summary, BytesIO(cached)
    
    REPORT_CACHE_MISS.labels(report_type="qhj_revenue_v1").inc()
    
    async def _work():
        async with pool.acquire() as conn:
            await conn.execute("SELECT set_config('app.factory_id', $1, false)", params.factory_id)
            template_result = await compute_qhj_revenue_report(pool, params)
        renderer = RENDERERS["qhj_revenue_v1"]
        return renderer(template_result.data, labels=LABELS["zh-CN"])
    
    try:
        buf = await with_factory_serialization(params.factory_id, pool, _work)
    except Exception as e:
        REPORT_GEN_ERRORS.labels(type=type(e).__name__).inc()
        await _log_audit(pool, params, user_id, cache_key, {},
                         duration_ms=int((time.time() - t0) * 1000),
                         status="error", error=str(e))
        raise
    
    file_bytes = buf.getvalue()
    REPORT_GEN_FILE_BYTES.labels(report_type="qhj_revenue_v1").observe(len(file_bytes))
    REPORT_GEN_SECONDS.labels(report_type="qhj_revenue_v1", status="ok").observe(time.time() - t0)
    
    await redis_client.set(cache_key, file_bytes, ex=CACHE_TTL)
    
    summary = {
        "store_count": len(params.store_ids),
        "date_range": f"{params.date_from} - {params.date_to}",
        "gold_materialized_at": gold_ts,
        "file_size_bytes": len(file_bytes),
        "cache_hit": False,
        "is_stale": is_stale,
    }
    await _log_audit(pool, params, user_id, cache_key, summary,
                     duration_ms=int((time.time() - t0) * 1000), status="ok")
    return cache_key, summary, BytesIO(file_bytes)


async def _log_audit(pool, params, user_id, cache_key, summary,
                     duration_ms, status, error: Optional[str] = None):
    async with pool.acquire() as conn:
        await conn.execute("SELECT set_config('app.factory_id', $1, false)", params.factory_id)
        params_snapshot = {
            "store_ids": params.store_ids,
            "date_from": params.date_from.isoformat(),
            "date_to": params.date_to.isoformat(),
            "meal_periods": params.meal_periods,
            "include_yoy": params.include_yoy,
        }
        params_hash = hashlib.sha256(json.dumps(params_snapshot, sort_keys=True).encode()).hexdigest()
        await conn.execute("""
            INSERT INTO smart_bi_report_audit_log
                (factory_id, report_type, generated_by, params_snapshot, params_hash,
                 cache_key, cache_hit, file_size_bytes, duration_ms, status, error_message,
                 gold_materialized_at)
            VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12)
        """, params.factory_id, "qhj_revenue_v1", user_id,
             json.dumps(params_snapshot), params_hash, cache_key,
             summary.get("cache_hit", False),
             summary.get("file_size_bytes"), duration_ms, status, error,
             summary.get("gold_materialized_at"))
```

- [ ] **Step 4: Run, verify pass**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_helpers.py -v`
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi/api/_revenue_report_helpers.py backend/python/smartbi/tests/test_revenue_report_helpers.py
git commit -m "feat(smartbi): add _generate_with_cache helper w/ smart cache + audit log" -- backend/python/smartbi/api/_revenue_report_helpers.py backend/python/smartbi/tests/test_revenue_report_helpers.py
```

---

### Task G2: 6 endpoints in `revenue_report.py` (`/upload`, `/prepare`, `/generate`, `/download`, `/stores`, `/audit-log`)

**Spec ref:** §8 (endpoint listing), §8.2 (`/upload` lock placement), §8.3 (store resolver), §10.7 (contracts), §11.4 (stale data headers).

**Files:**
- Create: `backend/python/smartbi/api/revenue_report.py`
- Modify: `backend/python/smartbi/main.py` (register router + CORS expose_headers)
- Test: `backend/python/smartbi/tests/test_revenue_report_api.py`

**Note:** This is the largest task. Implementation follows spec §8.1-§8.4 + §10.7 endpoint shapes verbatim. Tests use FastAPI TestClient + fake Redis.

- [ ] **Step 1: Write failing endpoint tests**

```python
import io, json
import pytest
from httpx import AsyncClient
from smartbi.main import app

FACTORY = "R_QINGHUAJIAO_REAL"

@pytest.fixture
async def authed_client(authed_user_token):
    async with AsyncClient(app=app, base_url="http://test",
                           headers={"Authorization": f"Bearer {authed_user_token}"}) as ac:
        yield ac

@pytest.mark.asyncio
async def test_upload_multifile_routes_by_filename(authed_client, sample_pos_csvs):
    files = [("files", (name, content, "text/csv")) for name, content in sample_pos_csvs]
    resp = await authed_client.post(f"/api/smartbi/{FACTORY}/revenue-report/upload", files=files)
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert "batch_id" in body["data"]
    assert all("status" in f for f in body["data"]["files"])

@pytest.mark.asyncio
async def test_prepare_returns_download_url_and_summary(authed_client, populated_gold_data):
    payload = {"store_names": [], "date_from": "2025-10-01", "date_to": "2025-10-07", "meal_periods": []}
    resp = await authed_client.post(f"/api/smartbi/{FACTORY}/revenue-report/prepare", json=payload)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "download_url" in data
    assert "summary" in data
    assert data["summary"]["store_count"] >= 0

@pytest.mark.asyncio
async def test_generate_streams_xlsx_with_headers(authed_client, populated_gold_data):
    payload = {"store_names": [], "date_from": "2025-10-01", "date_to": "2025-10-07"}
    resp = await authed_client.post(f"/api/smartbi/{FACTORY}/revenue-report/generate", json=payload)
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/vnd.openxmlformats")
    assert "X-Cache-Hit" in resp.headers
    assert "X-Gold-Materialized-At" in resp.headers
    assert resp.content[:2] == b"PK"

@pytest.mark.asyncio
async def test_stores_endpoint_excludes_closed(authed_client, factory_ctx_with_stores):
    resp = await authed_client.get(f"/api/smartbi/{FACTORY}/revenue-report/stores?exclude_closed=true")
    assert resp.status_code == 200
    names = [s["name"] for s in resp.json()["data"]]
    assert not any("（闭店）" in n for n in names)

@pytest.mark.asyncio
async def test_audit_log_returns_recent_reports(authed_client, populated_audit_log):
    resp = await authed_client.get(f"/api/smartbi/{FACTORY}/revenue-report/audit-log?limit=5")
    assert resp.status_code == 200
    rows = resp.json()["data"]
    assert len(rows) <= 5
    assert all("generated_at" in r for r in rows)

@pytest.mark.asyncio
async def test_fuzzy_store_ambiguous_returns_400(authed_client, factory_ctx_with_stores):
    payload = {"store_names": ["颛桥"], "date_from": "2025-10-01", "date_to": "2025-10-07"}
    resp = await authed_client.post(f"/api/smartbi/{FACTORY}/revenue-report/prepare", json=payload)
    assert resp.status_code == 400
    assert "candidates" in resp.json()["data"]

@pytest.mark.asyncio
async def test_cross_factory_jwt_returns_403(authed_client_factory_a):
    resp = await authed_client_factory_a.post(
        f"/api/smartbi/R_OTHER_FACTORY/revenue-report/prepare",
        json={"store_names": [], "date_from": "2025-10-01", "date_to": "2025-10-07"})
    assert resp.status_code == 403
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_api.py -v`
Expected: FAIL (router not registered)

- [ ] **Step 3: Implement `revenue_report.py` endpoints**

```python
# backend/python/smartbi/api/revenue_report.py
"""6 endpoints for QHJ revenue report. Per spec §8 + §10.7."""
import asyncio, hashlib, re, uuid
from datetime import date
from io import BytesIO
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from smartbi.canonical.templates.qhj_revenue_report import RevenueReportParams
from smartbi.canonical.concurrency import with_factory_serialization
from smartbi.api._revenue_report_helpers import _generate_with_cache, compute_cache_key
from smartbi.ingestion.pos_router import route_file, UnknownReportTypeError
from smartbi.services.materialized_analytics.hooks import schedule_materialization

router = APIRouter(prefix="/api/smartbi/{factory_id}/revenue-report")


class GenerateRequest(BaseModel):
    store_names: list[str] = []
    date_from: date
    date_to: date
    meal_periods: list[str] = []


def _check_factory(factory_id: str, request: Request):
    jwt_factory = getattr(request.state, "factory_id", None)
    if jwt_factory != factory_id:
        raise HTTPException(403, "factory_id mismatch")


async def _resolve_store_ids(conn, factory_id: str, names: list[str]) -> list[int]:
    if not names:
        rows = await conn.fetch("""
            SELECT store_id FROM dim_store
            WHERE factory_id = $1 AND name NOT LIKE '（闭店）%' AND name NOT LIKE '(闭店)%'
        """, factory_id)
        return [r["store_id"] for r in rows]
    
    resolved = []
    for name in names:
        rows = await conn.fetch("""
            SELECT store_id, name FROM dim_store
            WHERE factory_id = $1 AND name ILIKE '%' || $2 || '%'
        """, factory_id, name)
        if len(rows) == 0:
            raise HTTPException(400, detail={
                "message": f"未找到门店: {name}",
                "data": {"ambiguous_name": name, "candidates": []},
            })
        elif len(rows) == 1:
            resolved.append(rows[0]["store_id"])
        else:
            raise HTTPException(400, detail={
                "message": f"门店名 '{name}' 匹配多个，请使用完整名",
                "data": {
                    "ambiguous_name": name,
                    "candidates": [{"store_id": r["store_id"], "name": r["name"]} for r in rows],
                },
            })
    return resolved


@router.post("/upload")
async def upload_pos_files(
    factory_id: str,
    request: Request,
    files: list[UploadFile] = File(...),
    pool = Depends(lambda: app.state.pg_pool),  # adapt to actual DI
):
    _check_factory(factory_id, request)
    batch_id = uuid.uuid4()
    results = []
    
    for upload_file in files:
        content = await upload_file.read()
        content_hash = hashlib.sha256(content).hexdigest()
        
        async with pool.acquire() as conn:
            await conn.execute("SELECT set_config('app.factory_id', $1, false)", factory_id)
            exists = await conn.fetchval(
                "SELECT id FROM smart_bi_pg_excel_uploads "
                "WHERE factory_id=$1 AND content_hash=$2", factory_id, content_hash)
            if exists:
                results.append({"filename": upload_file.filename, "status": "duplicate"})
                continue
        
        try:
            parsed_routes = list(route_file(upload_file.filename, content))
        except UnknownReportTypeError as e:
            results.append({"filename": upload_file.filename, "status": "unknown",
                            "preview_headers": e.preview_headers})
            continue
        
        async def _persist():
            async with pool.acquire() as conn:
                await conn.execute("SELECT set_config('app.factory_id', $1, false)", factory_id)
                for decision, inner_bytes in parsed_routes:
                    # Dynamically dispatch to writer module
                    from importlib import import_module
                    mod = import_module(f"smartbi.canonical.silver_writers.{decision.writer}")
                    import pandas as pd, io
                    df = pd.read_csv(io.BytesIO(inner_bytes),
                                     encoding="utf-8-sig", engine="python")
                    write_fn = getattr(mod, "write", None) or getattr(mod, "BillFlowWriter")().write
                    await write_fn(conn, factory_id, df, source_meta={
                        "filename": upload_file.filename,
                        "batch_id": str(batch_id),
                    })
                await conn.execute("""
                    INSERT INTO smart_bi_pg_excel_uploads
                        (factory_id, file_name, content_hash, uploaded_at)
                    VALUES ($1, $2, $3, NOW())
                """, factory_id, upload_file.filename, content_hash)
        
        await with_factory_serialization(factory_id, pool, _persist)
        results.append({
            "filename": upload_file.filename,
            "status": "ok",
            "report_type": parsed_routes[0][0].report_type,
        })
    
    schedule_materialization(batch_id, factory_id)
    return {"success": True, "data": {"batch_id": str(batch_id), "files": results},
            "message": "上传完成"}


@router.post("/prepare")
async def prepare_revenue_report(factory_id: str, body: GenerateRequest, request: Request,
                                  pool = Depends(...), redis = Depends(...)):
    _check_factory(factory_id, request)
    async with pool.acquire() as conn:
        await conn.execute("SELECT set_config('app.factory_id', $1, false)", factory_id)
        store_ids = await _resolve_store_ids(conn, factory_id, body.store_names)
    
    params = RevenueReportParams(
        factory_id=factory_id, store_ids=store_ids,
        date_from=body.date_from, date_to=body.date_to,
        meal_periods=body.meal_periods or None,
    )
    user_id = request.state.user_id
    cache_key, summary, _ = await _generate_with_cache(pool, redis, params, user_id)
    return {
        "success": True,
        "data": {
            "cache_key": cache_key,
            "download_url": f"/api/smartbi/{factory_id}/revenue-report/download/{cache_key}",
            "summary": summary,
        }
    }


@router.post("/generate")
async def generate_revenue_report(factory_id: str, body: GenerateRequest, request: Request,
                                   pool = Depends(...), redis = Depends(...)):
    _check_factory(factory_id, request)
    async with pool.acquire() as conn:
        await conn.execute("SELECT set_config('app.factory_id', $1, false)", factory_id)
        store_ids = await _resolve_store_ids(conn, factory_id, body.store_names)
    
    params = RevenueReportParams(
        factory_id=factory_id, store_ids=store_ids,
        date_from=body.date_from, date_to=body.date_to,
        meal_periods=body.meal_periods or None,
    )
    user_id = request.state.user_id
    cache_key, summary, buf = await _generate_with_cache(pool, redis, params, user_id)
    
    filename = f"收入管理报表_{body.date_from}_{body.date_to}.xlsx"
    safe_filename = re.sub(r"[\r\n\x00/\\]", "_", filename)
    encoded = quote(safe_filename)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded}",
            "X-Cache-Hit": "true" if summary["cache_hit"] else "false",
            "X-Gold-Materialized-At": summary["gold_materialized_at"],
            "X-Store-Count": str(summary["store_count"]),
            "X-Is-Stale": "true" if summary.get("is_stale") else "false",
        },
    )


@router.get("/download/{cache_key:path}")
async def download_cached(factory_id: str, cache_key: str, request: Request,
                          pool = Depends(...), redis = Depends(...)):
    _check_factory(factory_id, request)
    if not cache_key.startswith(f"revenue_report:{factory_id}:"):
        raise HTTPException(403, "cache_key 不属于本 factory")
    cached = await redis.get(cache_key)
    if not cached:
        # Cache evicted; lookup params from audit log + regenerate
        async with pool.acquire() as conn:
            await conn.execute("SELECT set_config('app.factory_id', $1, false)", factory_id)
            row = await conn.fetchrow("""
                SELECT params_snapshot FROM smart_bi_report_audit_log
                WHERE factory_id=$1 AND cache_key=$2 AND status='ok'
                ORDER BY generated_at DESC LIMIT 1
            """, factory_id, cache_key)
        if not row:
            raise HTTPException(404, "Cache key not found")
        ps = row["params_snapshot"]
        params = RevenueReportParams(
            factory_id=factory_id,
            store_ids=ps["store_ids"],
            date_from=date.fromisoformat(ps["date_from"]),
            date_to=date.fromisoformat(ps["date_to"]),
            meal_periods=ps.get("meal_periods"),
        )
        _, _, buf = await _generate_with_cache(pool, redis, params, request.state.user_id)
        return StreamingResponse(buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    return StreamingResponse(BytesIO(cached),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


@router.get("/stores")
async def list_stores(factory_id: str, request: Request, exclude_closed: bool = True,
                      pool = Depends(...)):
    _check_factory(factory_id, request)
    async with pool.acquire() as conn:
        await conn.execute("SELECT set_config('app.factory_id', $1, false)", factory_id)
        sql = "SELECT store_id, name FROM dim_store WHERE factory_id = $1"
        if exclude_closed:
            sql += " AND name NOT LIKE '（闭店）%' AND name NOT LIKE '(闭店)%' AND name NOT LIKE '（停用）%'"
        sql += " ORDER BY name"
        rows = await conn.fetch(sql, factory_id)
    return {"success": True, "data": [dict(r) for r in rows]}


@router.get("/audit-log")
async def list_audit_log(factory_id: str, request: Request, limit: int = 20,
                          pool = Depends(...)):
    _check_factory(factory_id, request)
    async with pool.acquire() as conn:
        await conn.execute("SELECT set_config('app.factory_id', $1, false)", factory_id)
        rows = await conn.fetch("""
            SELECT id, generated_by, generated_at, params_snapshot, file_size_bytes,
                   status, cache_hit, duration_ms
            FROM smart_bi_report_audit_log
            WHERE factory_id = $1 AND report_type = 'qhj_revenue_v1'
            ORDER BY generated_at DESC LIMIT $2
        """, factory_id, limit)
    return {"success": True, "data": [dict(r) for r in rows]}
```

- [ ] **Step 4: Register router + CORS expose_headers in `main.py`**

In `backend/python/smartbi/main.py`:
- Add `from smartbi.api.revenue_report import router as revenue_report_router`
- Add `app.include_router(revenue_report_router)`
- Find existing `CORSMiddleware` registration and append to `expose_headers`:

```python
app.add_middleware(
    CORSMiddleware,
    # ... existing args ...
    expose_headers=[
        # ... existing list ...
        "X-Cache-Hit",
        "X-Gold-Materialized-At",
        "X-Store-Count",
        "X-Is-Stale",
    ],
)
```

- [ ] **Step 5: Run, verify pass**

Run: `cd backend/python && pytest smartbi/tests/test_revenue_report_api.py -v`
Expected: 7 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/python/smartbi/api/revenue_report.py backend/python/smartbi/main.py backend/python/smartbi/tests/test_revenue_report_api.py
git commit -m "feat(smartbi): add 6 revenue-report endpoints + CORS expose_headers" -- backend/python/smartbi/api/revenue_report.py backend/python/smartbi/main.py backend/python/smartbi/tests/test_revenue_report_api.py
```

---

## Phase H — Java AI Tool

### Task H1: `MealPeriodNormalizer.java`

**Spec ref:** §5.5 (Java owns 下午茶→午市 mapping), §8.4 (Tool internal normalization).

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/MealPeriodNormalizer.java`
- Create: `backend/java/cretas-api/src/test/java/com/cretas/aims/ai/tool/impl/restaurant/MealPeriodNormalizerTest.java`

- [ ] **Step 1: Write failing test**

```java
package com.cretas.aims.ai.tool.impl.restaurant;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class MealPeriodNormalizerTest {
    @Test void mapsXiawuchaToLunch() {
        assertEquals(List.of("午市"), MealPeriodNormalizer.normalize(List.of("下午茶")));
    }
    @Test void mapsYexiaoToDinner() {
        assertEquals(List.of("晚市"), MealPeriodNormalizer.normalize(List.of("夜宵")));
    }
    @Test void passesThroughKnownEnums() {
        assertEquals(List.of("午市", "晚市"), MealPeriodNormalizer.normalize(List.of("午市", "晚市")));
    }
    @Test void rejectsUnknown() {
        assertThrows(IllegalArgumentException.class,
            () -> MealPeriodNormalizer.normalize(List.of("夜市")));
    }
    @Test void emptyListReturnsEmpty() {
        assertEquals(List.of(), MealPeriodNormalizer.normalize(List.of()));
    }
}
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend/java/cretas-api && mvn test -Dtest=MealPeriodNormalizerTest`
Expected: FAIL (class not found)

- [ ] **Step 3: Implement**

```java
// backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/MealPeriodNormalizer.java
package com.cretas.aims.ai.tool.impl.restaurant;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Normalizes natural-language meal period names from LLM input
 * to the enum values stored in fact_pos_transaction.meal_period.
 *
 * Per spec §5.5: Tool internalizes mapping; Python layer is passive.
 */
public final class MealPeriodNormalizer {
    private static final Map<String, String> MAP = Map.of(
        "午市",   "午市",
        "晚市",   "晚市",
        "下午茶", "午市",
        "夜宵",   "晚市",
        "晚宵",   "晚市"
    );

    private MealPeriodNormalizer() {}

    public static List<String> normalize(List<String> input) {
        return input.stream()
            .map(s -> {
                String trimmed = s == null ? "" : s.trim();
                String mapped = MAP.get(trimmed);
                if (mapped == null) {
                    throw new IllegalArgumentException(
                        "Unknown meal period: " + s + " (allowed: " + MAP.keySet() + ")");
                }
                return mapped;
            })
            .distinct()
            .collect(Collectors.toList());
    }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd backend/java/cretas-api && mvn test -Dtest=MealPeriodNormalizerTest`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/MealPeriodNormalizer.java backend/java/cretas-api/src/test/java/com/cretas/aims/ai/tool/impl/restaurant/MealPeriodNormalizerTest.java
git commit -m "feat(java): add MealPeriodNormalizer for LLM input normalization" -- backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/MealPeriodNormalizer.java backend/java/cretas-api/src/test/java/com/cretas/aims/ai/tool/impl/restaurant/MealPeriodNormalizerTest.java
```

---

### Task H2: `PythonSmartBIClient.callRevenueReport()` method

**Spec ref:** §4.2, §8.4 (mirror `FinancialChartGenerateTool` pattern).

**Files:**
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/client/PythonSmartBIClient.java`
- Test: `backend/java/cretas-api/src/test/java/com/cretas/aims/client/PythonSmartBIClientRevenueReportTest.java`

- [ ] **Step 1: Write failing test**

```java
package com.cretas.aims.client;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class PythonSmartBIClientRevenueReportTest {
    @Autowired private PythonSmartBIClient client;

    @Test void callRevenueReportSendsPostAndParsesResponse() {
        Map<String, Object> body = Map.of(
            "store_names", java.util.List.of(),
            "date_from", "2025-10-01",
            "date_to", "2025-10-07"
        );
        Map<String, Object> response = client.callRevenueReport(
            "/api/smartbi/R_QINGHUAJIAO_REAL/revenue-report/prepare", body);
        assertNotNull(response);
        assertTrue((Boolean) response.get("success"));
    }
}
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend/java/cretas-api && mvn test -Dtest=PythonSmartBIClientRevenueReportTest`
Expected: FAIL (method missing)

- [ ] **Step 3: Add method to `PythonSmartBIClient.java`**

```java
// In PythonSmartBIClient.java, add new public method:
public Map<String, Object> callRevenueReport(String endpoint, Map<String, Object> body) {
    String url = config.getFullUrl(endpoint);
    return executeWithRetry(() -> {
        @SuppressWarnings("unchecked")
        Map<String, Object> result = restTemplate.postForObject(url, body, Map.class);
        return result;
    });
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd backend/java/cretas-api && mvn test -Dtest=PythonSmartBIClientRevenueReportTest`
Expected: PASS (or skipped if Python smartbi service not running in CI — set conditional)

- [ ] **Step 5: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/client/PythonSmartBIClient.java backend/java/cretas-api/src/test/java/com/cretas/aims/client/PythonSmartBIClientRevenueReportTest.java
git commit -m "feat(java): PythonSmartBIClient.callRevenueReport() HTTP wrapper" -- backend/java/cretas-api/src/main/java/com/cretas/aims/client/PythonSmartBIClient.java backend/java/cretas-api/src/test/java/com/cretas/aims/client/PythonSmartBIClientRevenueReportTest.java
```

---

### Task H3: `RevenueReportGenerateTool.java` + Flyway intent

**Spec ref:** §8.4 (full Java code), §8.5 (Flyway migration).

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/RevenueReportGenerateTool.java`
- Create: `backend/java/cretas-api/src/main/resources/db/flyway/V20260513_01__revenue_report_intent.sql`
- Test: `backend/java/cretas-api/src/test/java/com/cretas/aims/ai/tool/impl/restaurant/RevenueReportGenerateToolTest.java`

- [ ] **Step 1: Write failing test**

```java
package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.client.PythonSmartBIClient;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class RevenueReportGenerateToolTest {
    @Test void toolNameAndSchemaMatchSpec() {
        RevenueReportGenerateTool tool = new RevenueReportGenerateTool();
        assertEquals("revenue_report_generate", tool.getToolName());
        assertTrue(tool.getRequiredParameters().containsAll(List.of("date_from", "date_to")));
        Map<String, Object> schema = tool.getParametersSchema();
        Map<String, Object> props = (Map<String, Object>) schema.get("properties");
        assertNotNull(props.get("date_from"));
        assertNotNull(props.get("store_names"));
        assertNotNull(props.get("meal_periods"));
    }

    @Test void doExecuteWithMockedPythonReturnsSuccessMessage() throws Exception {
        PythonSmartBIClient mockClient = Mockito.mock(PythonSmartBIClient.class);
        Mockito.when(mockClient.callRevenueReport(Mockito.anyString(), Mockito.anyMap()))
            .thenReturn(Map.of("success", true, "data", Map.of(
                "download_url", "/api/smartbi/R_X/revenue-report/download/abc",
                "summary", Map.of("store_count", 3, "file_size_bytes", 28456, "cache_hit", false)
            )));
        RevenueReportGenerateTool tool = new RevenueReportGenerateTool();
        // Inject mock manually (Spring would normally do it)
        java.lang.reflect.Field f = RevenueReportGenerateTool.class.getDeclaredField("pythonClient");
        f.setAccessible(true); f.set(tool, mockClient);
        
        Map<String, Object> result = tool.doExecute("R_QINGHUAJIAO_REAL",
            Map.of("date_from", "2025-10-01", "date_to", "2025-10-07"), Map.of());
        assertTrue(((String) result.get("message")).contains("已生成"));
        assertNotNull(((Map) result.get("data")).get("download_url"));
    }

    @Test void doExecuteOnHttpErrorReturnsErrorResult() throws Exception {
        PythonSmartBIClient mockClient = Mockito.mock(PythonSmartBIClient.class);
        Mockito.when(mockClient.callRevenueReport(Mockito.anyString(), Mockito.anyMap()))
            .thenThrow(new org.springframework.web.client.HttpClientErrorException(
                org.springframework.http.HttpStatus.BAD_REQUEST, "store ambiguous"));
        RevenueReportGenerateTool tool = new RevenueReportGenerateTool();
        java.lang.reflect.Field f = RevenueReportGenerateTool.class.getDeclaredField("pythonClient");
        f.setAccessible(true); f.set(tool, mockClient);
        Map<String, Object> result = tool.doExecute("R_QHJ",
            Map.of("date_from", "2025-10-01", "date_to", "2025-10-07"), Map.of());
        assertTrue(((String) result.get("message")).contains("失败"));
    }
}
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend/java/cretas-api && mvn test -Dtest=RevenueReportGenerateToolTest`
Expected: FAIL

- [ ] **Step 3: Implement Tool** (full body from spec §8.4)

```java
// backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/RevenueReportGenerateTool.java
package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.client.PythonSmartBIClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;

import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class RevenueReportGenerateTool extends AbstractBusinessTool {

    @Autowired
    private PythonSmartBIClient pythonClient;

    @Override public String getToolName() { return "revenue_report_generate"; }

    @Override public String getDescription() {
        return "生成餐饮收入管理报表（同比环比/堂食外卖占比/客单人数分析三大维度）。" +
               "参数: date_from/date_to 必填 YYYY-MM-DD（LLM 须先 resolve '上周'/'本月' 等短语）；" +
               "store_names 可选，省略=全部门店；" +
               "meal_periods 可选 enum ['午市','晚市']（'下午茶'→'午市', '夜宵'→'晚市' 由 Tool 内化）。";
    }

    @Override public Map<String, Object> getParametersSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "date_from", Map.of(
                    "type", "string",
                    "format", "date",
                    "description", "本期开始日期 YYYY-MM-DD (LLM 必须先 resolve '上周'/'本月' 等短语)"
                ),
                "date_to", Map.of(
                    "type", "string",
                    "format", "date",
                    "description", "本期结束日期 YYYY-MM-DD (含)"
                ),
                "store_names", Map.of(
                    "type", "array",
                    "items", Map.of("type", "string"),
                    "description", "门店名列表 (支持模糊匹配); 省略 = 全部门店"
                ),
                "meal_periods", Map.of(
                    "type", "array",
                    "items", Map.of("type", "string", "enum", List.of("午市", "晚市")),
                    "description", "班次过滤; 省略 = 全班次。Tool 内化映射: '下午茶'->'午市', '夜宵'->'晚市'"
                )
            ),
            "required", List.of("date_from", "date_to")
        );
    }

    @Override protected List<String> getRequiredParameters() {
        return List.of("date_from", "date_to");
    }

    @Override
    @SuppressWarnings("unchecked")
    protected Map<String, Object> doExecute(
            String factoryId,
            Map<String, Object> params,
            Map<String, Object> context) throws Exception {

        List<String> mealPeriodsRaw = (List<String>) params.getOrDefault("meal_periods", List.of());
        List<String> mealPeriods;
        try {
            mealPeriods = MealPeriodNormalizer.normalize(mealPeriodsRaw);
        } catch (IllegalArgumentException e) {
            return buildErrorResult("班次参数错误: " + e.getMessage());
        }

        Map<String, Object> request = Map.of(
            "store_names", params.getOrDefault("store_names", List.of()),
            "date_from", params.get("date_from"),
            "date_to", params.get("date_to"),
            "meal_periods", mealPeriods
        );

        try {
            Map<String, Object> response = pythonClient.callRevenueReport(
                "/api/smartbi/" + factoryId + "/revenue-report/prepare", request);
            Map<String, Object> data = (Map<String, Object>) response.get("data");
            Map<String, Object> summary = (Map<String, Object>) data.get("summary");

            String message = String.format(
                "已生成 %s ~ %s 收入管理报表（%d 门店, %.1f KB%s）",
                params.get("date_from"), params.get("date_to"),
                summary.get("store_count"),
                ((Number) summary.get("file_size_bytes")).doubleValue() / 1024,
                Boolean.TRUE.equals(summary.get("cache_hit")) ? "，缓存命中" : ""
            );
            return buildSimpleResult(message, Map.of(
                "download_url", data.get("download_url"),
                "summary", summary
            ));
        } catch (HttpClientErrorException e) {
            log.warn("Revenue report generation failed: {}", e.getMessage());
            return buildErrorResult("生成失败: " + e.getMessage());
        }
    }
}
```

- [ ] **Step 4: Write Flyway migration**

```sql
-- backend/java/cretas-api/src/main/resources/db/flyway/V20260513_01__revenue_report_intent.sql
-- 青花椒 收入管理报表 AI Tool intent registration.
-- is_active=false initially; flip to true after deploy + smoke test (per spec §11.6).

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category, sensitivity_level,
    quota_cost, cache_ttl_minutes, keywords, tool_name, is_active, priority
) VALUES (
    UUID(),
    'REVENUE_REPORT_GENERATE',
    '收入管理报表生成',
    'ANALYSIS',
    'LOW',
    3,
    0,
    '["收入管理报表","收入报表","营业收入","门店收入分析","堂食外卖占比","客单人数分析","环比报表","同比报表"]',
    'revenue_report_generate',
    false,
    70
);
```

- [ ] **Step 5: Run, verify pass**

Run: `cd backend/java/cretas-api && mvn test -Dtest=RevenueReportGenerateToolTest`
Expected: 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/RevenueReportGenerateTool.java backend/java/cretas-api/src/main/resources/db/flyway/V20260513_01__revenue_report_intent.sql backend/java/cretas-api/src/test/java/com/cretas/aims/ai/tool/impl/restaurant/RevenueReportGenerateToolTest.java
git commit -m "feat(java): add RevenueReportGenerateTool + Flyway intent registration" -- backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/RevenueReportGenerateTool.java backend/java/cretas-api/src/main/resources/db/flyway/V20260513_01__revenue_report_intent.sql backend/java/cretas-api/src/test/java/com/cretas/aims/ai/tool/impl/restaurant/RevenueReportGenerateToolTest.java
```

---

## Phase I — Vue Frontend

### Task I1: Extend `SmartBIUploader.vue` with `multiple` prop

**Spec ref:** §9.1 + audit X (SmartBIUploader.vue is extensible).

**Files:**
- Modify: `web-admin/src/components/smartbi/SmartBIUploader.vue`

- [ ] **Step 1: Add `multiple` prop + accept array fileList**

In `SmartBIUploader.vue` `<script setup>` props definition:

```typescript
const props = defineProps<{
  // ...existing props
  multiple?: boolean
}>()

const fileLimit = computed(() => props.multiple ? 0 : 1)  // 0 = unlimited
```

In template, change `<el-upload>`:
```vue
<el-upload
  :multiple="multiple"
  :limit="fileLimit"
  :file-list="fileList"
  ...
```

- [ ] **Step 2: Commit (no new test — existing tests must still pass)**

```bash
git add web-admin/src/components/smartbi/SmartBIUploader.vue
git commit -m "feat(web-admin): SmartBIUploader accept multiple files via prop" -- web-admin/src/components/smartbi/SmartBIUploader.vue
```

---

### Task I2: `MultiFileUploadArea.vue` reusable component + API client

**Spec ref:** §9.1 (file list), §9.2 (sequential uploadFileAsync), §10.7 (`/upload` request/response).

**Files:**
- Create: `web-admin/src/components/smartbi/MultiFileUploadArea.vue`
- Create: `web-admin/src/api/smartbi/revenue-report.ts`

- [ ] **Step 1: Create API client**

```typescript
// web-admin/src/api/smartbi/revenue-report.ts
import { request } from '@/api/request'
import { getSmartBIBasePath } from './common'

const BASE = () => `${getSmartBIBasePath()}/revenue-report`

export interface UploadResult {
  filename: string
  status: 'ok' | 'duplicate' | 'unknown'
  report_type?: string
  rows_ingested?: number
  message?: string
  preview_headers?: string[]
}

export interface RevenueReportParams {
  store_names: string[]
  date_from: string
  date_to: string
  meal_periods: string[]
}

export interface GenerateSummary {
  store_count: number
  date_range: string
  gold_materialized_at: string
  file_size_bytes: number
  cache_hit: boolean
  is_stale: boolean
}

export async function uploadPosFiles(files: File[]): Promise<UploadResult[]> {
  const fd = new FormData()
  files.forEach(f => fd.append('files', f))
  const res = await request.post(`${BASE()}/upload`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 600_000,
  })
  return res.data.files
}

export async function preview(params: RevenueReportParams) {
  return request.post(`${BASE()}/prepare`, params)
}

export async function generateAndDownload(params: RevenueReportParams) {
  const res = await request.post(`${BASE()}/generate`, params, {
    responseType: 'blob',
  })
  return {
    blob: res.data,
    cacheHit: res.headers['x-cache-hit'] === 'true',
    goldMaterializedAt: res.headers['x-gold-materialized-at'] || '',
    storeCount: parseInt(res.headers['x-store-count'] || '0'),
    isStale: res.headers['x-is-stale'] === 'true',
  }
}

export async function listStores(): Promise<{ store_id: number; name: string }[]> {
  const res = await request.get(`${BASE()}/stores`, { params: { exclude_closed: true } })
  return res.data
}

export async function getAuditLog(limit = 20) {
  return request.get(`${BASE()}/audit-log`, { params: { limit } })
}
```

- [ ] **Step 2: Create MultiFileUploadArea.vue**

```vue
<!-- web-admin/src/components/smartbi/MultiFileUploadArea.vue -->
<template>
  <div class="multi-file-upload-area">
    <el-upload
      drag multiple
      :auto-upload="false"
      accept=".zip,.xlsx,.xls,.csv"
      :on-change="onFilesPicked"
      :file-list="fileList"
      :on-remove="onRemove"
    >
      <el-icon class="el-icon--upload"><upload-filled /></el-icon>
      <div class="el-upload__text">
        拖拽多个二维火 POS 文件到此处<br/>
        支持 zip / xlsx / xls / csv，单文件 ≤ 200 MB
      </div>
      <template #tip>
        <div class="el-upload__tip">
          建议同时上传: 营业概况报表 / 堂食外卖占比表 / 详细日报表 / 商品销售明细表
        </div>
      </template>
    </el-upload>

    <el-button type="primary" :loading="uploading" :disabled="uploading || fileList.length === 0"
               @click="doUpload" v-if="fileList.length">
      开始上传 ({{ fileList.length }} 个文件)
    </el-button>

    <el-table v-if="results.length" :data="results" size="small">
      <el-table-column prop="filename" label="文件名" />
      <el-table-column prop="report_type" label="识别为" />
      <el-table-column prop="rows_ingested" label="行数" />
      <el-table-column label="状态">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, UploadFilled } from 'element-plus'
import { uploadPosFiles, type UploadResult } from '@/api/smartbi/revenue-report'

const emit = defineEmits<{ (e: 'upload-complete', results: UploadResult[]): void }>()

const fileList = ref<any[]>([])
const uploading = ref(false)
const results = ref<UploadResult[]>([])

function onFilesPicked(file: any) {
  fileList.value.push(file)
}
function onRemove(file: any) {
  fileList.value = fileList.value.filter(f => f.uid !== file.uid)
}
function statusTagType(s: string) {
  return s === 'ok' ? 'success' : s === 'duplicate' ? 'warning' : 'danger'
}

async function doUpload() {
  if (uploading.value) return
  uploading.value = true
  try {
    const files = fileList.value.map(f => f.raw).filter(Boolean)
    const res = await uploadPosFiles(files)
    results.value = res
    emit('upload-complete', res)
    ElMessage.success(`上传完成: ${res.filter(r => r.status === 'ok').length} 个成功`)
  } catch (e: any) {
    ElMessage.error(`上传失败: ${e.message || e}`)
  } finally {
    uploading.value = false
  }
}
</script>
```

- [ ] **Step 3: Commit**

```bash
git add web-admin/src/api/smartbi/revenue-report.ts web-admin/src/components/smartbi/MultiFileUploadArea.vue
git commit -m "feat(web-admin): add revenue-report API client + MultiFileUploadArea component" -- web-admin/src/api/smartbi/revenue-report.ts web-admin/src/components/smartbi/MultiFileUploadArea.vue
```

---

### Task I3: `RevenueReport.vue` main page + router + sidebar

**Spec ref:** §9 (full file structure + conventions), §11.4 (stale data UI).

**Files:**
- Create: `web-admin/src/views/smart-bi/RevenueReport.vue`
- Modify: `web-admin/src/router/modules/smartbi.ts` (add route)
- Modify: `web-admin/src/components/layout/AppSidebar.vue` (add menu entry)

- [ ] **Step 1: Create RevenueReport.vue** — single SFC ~600 LOC following spec §9 conventions

```vue
<!-- web-admin/src/views/smart-bi/RevenueReport.vue -->
<template>
  <div class="revenue-report-page">
    <el-page-header @back="$router.back()" content="收入管理报表" />
    
    <el-alert v-if="isStale" type="warning" closable show-icon>
      ⚠️ 数据延迟，最新截至 {{ goldMaterializedAt }}，可能不含最近一次上传
    </el-alert>
    
    <el-tabs v-model="activeTab">
      <el-tab-pane label="上传 & 生成" name="generate">
        <MultiFileUploadArea @upload-complete="onUploadComplete" />
        <el-divider />
        
        <el-form :model="genParams" label-width="100px">
          <el-form-item label="日期范围" required>
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              :shortcuts="dateShortcuts"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              @change="onDateChange"
            />
          </el-form-item>
          <el-form-item label="门店">
            <el-select v-model="genParams.store_names" multiple filterable
                       collapse-tags collapse-tags-tooltip
                       placeholder="不选 = 全部门店" style="width: 100%">
              <el-option v-for="s in stores" :key="s.store_id" :label="s.name" :value="s.name" />
            </el-select>
          </el-form-item>
          <el-form-item label="班次">
            <el-checkbox-group v-model="genParams.meal_periods">
              <el-checkbox label="午市" />
              <el-checkbox label="晚市" />
            </el-checkbox-group>
          </el-form-item>
          <el-form-item>
            <el-button @click="onPreview" :loading="generating" :disabled="generating">预览数据</el-button>
            <el-button type="primary" @click="onDownload" :loading="generating" :disabled="generating">下载 Excel</el-button>
            <span v-if="elapsedTime > 0" style="margin-left:12px;color:#909399">
              已等待 {{ elapsedTime }} 秒...
            </span>
          </el-form-item>
        </el-form>
        
        <div v-if="previewData" class="preview-container">
          <h3>① 可比同比{{ previewData.meta.yoy_note ? `（${previewData.meta.yoy_note}）` : '' }}</h3>
          <el-table :data="previewData.block1_yoy" border>
            <el-table-column prop="store_name" label="门店" />
            <el-table-column label="汇总实际收入" align="center">
              <el-table-column prop="total" label="本期" :formatter="fmtMoney" />
              <el-table-column prop="prev_total" label="去年同期" :formatter="fmtMoneyOrNa" />
              <el-table-column prop="total_ratio" label="同比率" :formatter="fmtPct" />
            </el-table-column>
            <el-table-column label="堂食" align="center">
              <el-table-column prop="dine_in" label="本期" :formatter="fmtMoney" />
              <el-table-column prop="prev_dine_in" label="去年同期" :formatter="fmtMoneyOrNa" />
              <el-table-column prop="dine_in_ratio" label="同比率" :formatter="fmtPct" />
            </el-table-column>
            <el-table-column label="外卖" align="center">
              <el-table-column prop="takeout" label="本期" :formatter="fmtMoney" />
              <el-table-column prop="prev_takeout" label="去年同期" :formatter="fmtMoneyOrNa" />
              <el-table-column prop="takeout_ratio" label="同比率" :formatter="fmtPct" />
            </el-table-column>
          </el-table>
          
          <h3>② 环比</h3>
          <el-table :data="previewData.block2_mom" border>
            <!-- Same structure as block1, swap labels -->
          </el-table>
          
          <h3>③ 堂食外卖占比</h3>
          <el-table :data="previewData.block3_meal_split" border>
            <el-table-column prop="store_name" label="门店" />
            <el-table-column prop="dine_in_revenue" label="实际收入堂食" :formatter="fmtMoney" />
            <el-table-column prop="takeout_revenue" label="实际收入外卖" :formatter="fmtMoney" />
            <el-table-column prop="revenue_ratio" label="收入比例" :formatter="fmtPct" />
            <el-table-column prop="dine_in_bills" label="客单量堂食" />
            <el-table-column prop="takeout_bills" label="客单量外卖" />
            <el-table-column prop="bill_ratio" label="客单比例" :formatter="fmtPct" />
          </el-table>
          
          <h3>④ 客单人数分析</h3>
          <div v-for="store in previewData.block4_diner_dist" :key="store.store_id">
            <h4>{{ store.store_name }} ({{ store.date_range }})</h4>
            <el-table :data="store.distribution" border>
              <el-table-column prop="diner_count" label="客单人数" />
              <el-table-column prop="bill_count" label="客单量" />
              <el-table-column prop="bill_ratio" label="客单占比" :formatter="fmtPct" />
              <el-table-column prop="total_items" label="点单份数" />
              <el-table-column prop="avg_items_per_bill" label="人均点单数量" />
              <el-table-column prop="revenue" label="实收额" :formatter="fmtMoney" />
              <el-table-column prop="revenue_per_diner" label="实际人均 (实收/客流)" :formatter="fmtMoney" />
              <el-table-column prop="revenue_per_item" label="份均消费 (实收/份数)" :formatter="fmtMoney" />
              <el-table-column prop="revenue_ratio" label="营业额占比" :formatter="fmtPct" />
            </el-table>
          </div>
          
          <div class="data-freshness" style="margin-top:16px;color:#909399;font-size:12px">
            数据截至: {{ previewData.meta.gold_materialized_at || goldMaterializedAt }}
          </div>
        </div>
      </el-tab-pane>
      
      <el-tab-pane label="历史记录" name="audit">
        <el-table :data="auditRows" v-loading="auditLoading">
          <el-table-column prop="generated_at" label="生成时间" />
          <el-table-column prop="generated_by" label="操作人" />
          <el-table-column prop="file_size_bytes" label="文件大小 (KB)"
                           :formatter="(r: any) => (r.file_size_bytes / 1024).toFixed(1)" />
          <el-table-column prop="cache_hit" label="缓存命中" />
          <el-table-column prop="duration_ms" label="耗时 (ms)" />
          <el-table-column prop="status" label="状态" />
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import {
  listStores, preview, generateAndDownload, getAuditLog,
  type RevenueReportParams,
} from '@/api/smartbi/revenue-report'
import MultiFileUploadArea from '@/components/smartbi/MultiFileUploadArea.vue'

const authStore = useAuthStore()
const activeTab = ref<'generate' | 'audit'>('generate')
const stores = ref<{ store_id: number; name: string }[]>([])
const dateRange = ref<[string, string] | null>(null)
const genParams = ref<RevenueReportParams>({
  store_names: [], date_from: '', date_to: '', meal_periods: [],
})
const generating = ref(false)
const elapsedTime = ref(0)
let elapsedTimer: number | null = null

const previewData = ref<any>(null)
const isStale = ref(false)
const goldMaterializedAt = ref('')
const auditRows = ref<any[]>([])
const auditLoading = ref(false)

const dateShortcuts = [
  { text: '上周', value: () => {
      const end = new Date(); end.setDate(end.getDate() - end.getDay())
      const start = new Date(end); start.setDate(start.getDate() - 6)
      return [start, end]
    }
  },
  { text: '本月', value: () => {
      const end = new Date()
      const start = new Date(end.getFullYear(), end.getMonth(), 1)
      return [start, end]
    }
  },
  { text: '上月', value: () => {
      const end = new Date(new Date().getFullYear(), new Date().getMonth(), 0)
      const start = new Date(end.getFullYear(), end.getMonth(), 1)
      return [start, end]
    }
  },
  { text: '近 30 天', value: () => {
      const end = new Date()
      const start = new Date(); start.setDate(start.getDate() - 30)
      return [start, end]
    }
  },
]

const STORAGE_KEY = `revenue-report-filters-${authStore.factoryId}`

onMounted(async () => {
  // Restore filter state
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) Object.assign(genParams.value, JSON.parse(saved))
  } catch {}
  
  stores.value = await listStores()
  await loadAuditLog()
})

watch(genParams, (v) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
}, { deep: true })

function onDateChange(v: [string, string] | null) {
  if (v) {
    genParams.value.date_from = v[0]
    genParams.value.date_to = v[1]
  }
}
function onUploadComplete() {
  ElMessage.info('上传完成，数据正在物化，约 5-30 秒后可生成报表')
}

function startElapsed() {
  elapsedTime.value = 0
  elapsedTimer = window.setInterval(() => { elapsedTime.value++ }, 1000)
}
function stopElapsed() {
  if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null }
}

async function onPreview() {
  if (generating.value) return
  if (!genParams.value.date_from) { ElMessage.warning('请选择日期范围'); return }
  generating.value = true; startElapsed()
  try {
    const res = await preview(genParams.value)
    previewData.value = res.data
    goldMaterializedAt.value = res.data.summary?.gold_materialized_at || ''
    isStale.value = res.data.summary?.is_stale || false
    ElMessage.info(`数据截至 ${goldMaterializedAt.value}`)
  } catch (e: any) {
    ElMessage.error(`预览失败: ${e.message || e}`)
  } finally { generating.value = false; stopElapsed() }
}

async function onDownload() {
  if (generating.value) return
  if (!genParams.value.date_from) { ElMessage.warning('请选择日期范围'); return }
  generating.value = true; startElapsed()
  try {
    const result = await generateAndDownload(genParams.value)
    const isFirefox = navigator.userAgent.toLowerCase().includes('firefox')
    const filename = isFirefox
      ? `revenue_report_${genParams.value.date_from}_${genParams.value.date_to}.xlsx`
      : `收入管理报表_${genParams.value.date_from}_${genParams.value.date_to}.xlsx`
    const url = URL.createObjectURL(new Blob([result.blob], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }))
    const a = document.createElement('a')
    a.href = url; a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    
    isStale.value = result.isStale
    goldMaterializedAt.value = result.goldMaterializedAt
    ElMessage.success(`下载完成${result.cacheHit ? '（缓存命中）' : ''}`)
    await loadAuditLog()
  } catch (e: any) {
    ElMessage.error(`下载失败: ${e.message || e}`)
  } finally { generating.value = false; stopElapsed() }
}

async function loadAuditLog() {
  auditLoading.value = true
  try {
    const res = await getAuditLog(20)
    auditRows.value = res.data
  } finally { auditLoading.value = false }
}

function fmtMoney(_: any, __: any, v: any) { return v == null ? '—' : Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }
function fmtMoneyOrNa(_: any, __: any, v: any) { return v == null ? '—' : fmtMoney(null, null, v) }
function fmtPct(_: any, __: any, v: any) { return v == null ? '—' : `${(v * 100).toFixed(2)}%` }
</script>
```

- [ ] **Step 2: Register route in `router/modules/smartbi.ts`**

Add to children array:
```typescript
{
  path: 'revenue-report',
  name: 'SmartBIRevenueReport',
  component: () => import('@/views/smart-bi/RevenueReport.vue'),
  meta: {
    title: '收入管理报表',
    requiresAuth: true,
    module: 'analytics',
    hideForFactoryTypes: ['FACTORY'],  // 仅 RESTAURANT 类工厂可见
  }
}
```

- [ ] **Step 3: Add menu entry in `AppSidebar.vue` SmartBI children**

```typescript
{
  path: '/smart-bi/revenue-report',
  title: '收入管理报表',
  icon: 'Money',
  module: 'analytics',
  hideForFactoryTypes: ['FACTORY'],
}
```

- [ ] **Step 4: Commit**

```bash
git add web-admin/src/views/smart-bi/RevenueReport.vue web-admin/src/router/modules/smartbi.ts web-admin/src/components/layout/AppSidebar.vue
git commit -m "feat(web-admin): add RevenueReport page + router + sidebar menu (RESTAURANT only)" -- web-admin/src/views/smart-bi/RevenueReport.vue web-admin/src/router/modules/smartbi.ts web-admin/src/components/layout/AppSidebar.vue
```

---

### Task I4: Playwright E2E spec

**Spec ref:** §10.2 (E2E test).

**Files:**
- Create: `web-admin/revenue-report.spec.ts` (Playwright project root, mirrors existing convention)

- [ ] **Step 1: Write E2E test**

```typescript
// web-admin/revenue-report.spec.ts
import { test, expect } from '@playwright/test'
import path from 'path'

test('青花椒 revenue report end-to-end', async ({ page }) => {
  await page.goto(process.env.WEB_ADMIN_URL || 'http://localhost:5173')
  
  // Login as 青花椒 user (test env)
  await page.fill('[data-test=username]', process.env.QHJ_USER || 'qhj_test_user')
  await page.fill('[data-test=password]', process.env.QHJ_PASSWORD || '')
  await page.click('[data-test=login-btn]')
  
  // Navigate to revenue report
  await page.click('text=智能分析')
  await page.click('text=收入管理报表')
  await expect(page.locator('h1, h2, [data-test=page-title]')).toContainText('收入管理报表')
  
  // Upload sample files
  const filePath = path.join(__dirname, 'test-fixtures', 'qhj_daily_summary.csv')
  await page.setInputFiles('input[type=file]', filePath)
  await page.click('text=开始上传')
  await expect(page.locator('text=上传完成')).toBeVisible({ timeout: 60_000 })
  
  // Set date range, click preview
  await page.click('[data-test=date-shortcut-上周]')
  await page.click('text=预览数据')
  await expect(page.locator('text=可比同比')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('text=堂食外卖占比')).toBeVisible()
  
  // Download
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('text=下载 Excel'),
  ])
  expect(download.suggestedFilename()).toContain('.xlsx')
  
  // Verify history tab shows the generation
  await page.click('text=历史记录')
  await expect(page.locator('table tr').nth(1)).toBeVisible()
})
```

- [ ] **Step 2: Commit**

```bash
git add web-admin/revenue-report.spec.ts
git commit -m "test(web-admin): add Playwright E2E for QHJ revenue report" -- web-admin/revenue-report.spec.ts
```

---

## Phase J — Deploy + Smoke + Intent Enablement

### Task J1: Test environment deploy

**Spec ref:** §10.3, §10.5 Day 1-3.

**Steps (run on Steve's machine, NOT automatable):**

- [ ] **Step 1: Sync, deploy Python (applies migrations via Step 3.5)**

```bash
cd /c/Users/Steve/my-prototype-logistics
git pull origin main
./scripts/deploy/deploy-smartbi-python.sh --env test
```

Expected: migrations V20260513_01/02/03 applied to smartbi_db; Python service restarted.

- [ ] **Step 2: Deploy Java backend**

```bash
./scripts/deploy/deploy-backend.sh --env test
```

Expected: Flyway applies V20260513_01__revenue_report_intent.sql (with is_active=false); Java service restart.

- [ ] **Step 3: Deploy web-admin to 139**

```bash
./scripts/deploy/deploy-web-admin.sh --env test
```

Expected: Vue dist deployed; route `/smart-bi/revenue-report` accessible.

- [ ] **Step 4: Smoke /stores endpoint**

```bash
curl -X GET "http://47.100.235.168:8084/api/smartbi/R_QINGHUAJIAO_REAL/revenue-report/stores?exclude_closed=true" \
  -H "Authorization: Bearer $JWT"
```

Expected: 200 OK + non-empty list of stores.

- [ ] **Step 5: Smoke /upload with a single small CSV**

```bash
curl -X POST "http://47.100.235.168:8084/api/smartbi/R_QINGHUAJIAO_REAL/revenue-report/upload" \
  -H "Authorization: Bearer $JWT" \
  -F "files=@tests/fixtures/qhj_pos/daily_summary_sample.csv"
```

Expected: 200 OK + `{success: true, data: {batch_id, files: [{status: 'ok'}]}}`.

- [ ] **Step 6: Backfill Gold table for past data**

```bash
ssh root@47.100.235.168
cd /www/wwwroot/cretas/code/backend/python
source venv38/bin/activate
python scripts/backfill_agg_order_type_meal.py \
  --factory R_QINGHUAJIAO_REAL \
  --date-from 2025-01-01 --date-to 2025-12-31 \
  --env test
```

Expected: "Backfilled N rows..." message.

- [ ] **Step 7: Smoke /generate**

```bash
curl -X POST "http://47.100.235.168:8084/api/smartbi/R_QINGHUAJIAO_REAL/revenue-report/generate" \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"store_names":[],"date_from":"2025-10-01","date_to":"2025-10-07","meal_periods":[]}' \
  -o /tmp/test-revenue.xlsx
```

Expected: xlsx file downloaded; open in Excel, verify 4 blocks present.

- [ ] **Step 8: Smoke web-admin UI flow** (manual)

1. Log in as 青花椒 test user
2. Navigate to SmartBI → 收入管理报表
3. Upload 1-2 small CSV files
4. Pick "上周" date shortcut
5. Click "预览数据" → 4 tables render
6. Click "下载 Excel" → xlsx downloads
7. Check "历史记录" tab → see new audit entry

---

### Task J2: Enable intent in test env

**Spec ref:** §11.6.

- [ ] **Step 1: Enable intent SQL**

```bash
ssh root@47.100.235.168 'PGPASSWORD=$DB_PASSWORD psql -h localhost -U cretas -d cretas_db -c "UPDATE ai_intent_configs SET is_active = true WHERE intent_code = '"'"'REVENUE_REPORT_GENERATE'"'"';"'
```

- [ ] **Step 2: Smoke LLM Chat invocation**

Open the AI Chat panel in web-admin, send: "生成上周收入管理报表"

Expected: LLM matches intent → Java Tool calls Python /prepare → Tool returns message + download_url → user clicks link → xlsx downloads.

- [ ] **Step 3: Verify audit log captures Chat-triggered generation**

```sql
SELECT generated_by, generated_at, params_snapshot
FROM smart_bi_report_audit_log
WHERE factory_id = 'R_QINGHUAJIAO_REAL' AND report_type = 'qhj_revenue_v1'
ORDER BY generated_at DESC LIMIT 5;
```

Expected: row with `generated_by = <chat user id>`.

---

### Task J3: Production deploy + 24h soak + enable intent in prod

**Spec ref:** §10.5 Day 6-7.

- [ ] **Step 1: Apply production deploys**

```bash
./scripts/deploy/deploy-smartbi-python.sh --env prod
./scripts/deploy/deploy-backend.sh --env prod
./scripts/deploy/deploy-web-admin.sh --env prod
```

Expected: All 3 services rebuilt + restarted; migrations applied to smartbi_prod_db + cretas_prod_db.

- [ ] **Step 2: Backfill prod Gold**

```bash
ssh root@47.100.235.168 'cd /www/wwwroot/cretas/code/backend/python && source venv38/bin/activate && python scripts/backfill_agg_order_type_meal.py --factory R_QINGHUAJIAO_REAL --date-from 2025-01-01 --date-to 2025-12-31 --env prod'
```

- [ ] **Step 3: Smoke prod endpoints** (same as J1 steps 4-7, but pointed at `:10010` Java + `:8083` Python)

- [ ] **Step 4: Allow 24 hours soak with intent disabled in prod**

- [ ] **Step 5: After 24h healthy → enable intent in prod**

```bash
ssh root@47.100.235.168 'PGPASSWORD=$DB_PASSWORD psql -h localhost -U cretas -d cretas_prod_db -c "UPDATE ai_intent_configs SET is_active = true WHERE intent_code = '"'"'REVENUE_REPORT_GENERATE'"'"';"'
```

- [ ] **Step 6: Customer announcement**

Notify 青花椒 customer (via project communication channel) that the feature is live. Share quick-use video / doc.

- [ ] **Step 7: Monitor 7 days**

Watch Prometheus metrics + audit log. Triage any customer-reported issues.

---

## Plan Verification Checklist

- [ ] All 5 BLOCKERs from spec §11.x resolved in tasks (B1→A1+D1, B2→A4+C4, B3→H3, B4→D1, B5→G2)
- [ ] All 7 MAJORs addressed (M1→E5, M2→I3, M3→E1, M4→G2, M5→G1, M6→I3, M7→C1 fixtures)
- [ ] Test coverage: each new module has a paired test file
- [ ] Migration order: Python V01-03 before Java V01; Java intent rows is_active=false initially
- [ ] Test → prod deploy gap respected (J1 test, J3 prod with 24h soak between)
- [ ] Rollback path: deploy --rollback for code; Flyway forward-only (additive schema)
- [ ] CORS expose_headers added (G2 Step 4)
- [ ] Concurrent-edit-safety: all commits use `git commit ... -- <file>` form

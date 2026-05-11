# T6.6 Phase B ETL Infrastructure — Design Spec

**Status**: ⛔ DRAFT — Design spec only. No code, no migrations, no DDL apply.
**Spec date**: 2026-05-11
**Author**: chat3 (T6.6 ETL infra design draft, post-`/clear` context)
**Branch**: TBD — organizer assigns after review (see §8 Predecessors)
**Audience**: T6.6 Phase B ETL impl chats (Sub-ETL-* dispatch follow-up); Steve (Open Question sign-off)
**Scope budget**: Q1 amendment §4 Steps 1+2+3 (ETL infrastructure layer only, ~6.5 person-days). Excludes Steps 4+5+6 (service refactor + goldens + test infra, gated on Q4/Q5).

---

## 0. TL;DR

This spec is the **infrastructure-layer design** for T6.6 Phase B real-DB ETL — Q1 amendment (PR #223) §4 Steps 1+2+3. It does **not** design the production / quality service ports themselves (Steps 4+5+6, gated on Open Questions Q4 + Q5).

**Three deliverables** when impl-dispatched:

1. **Step 1 — Excel/CSV → canonical CSV normalizer** (~3 person-days). Pure-Python pipeline at `scripts/etl/normalize-restaurant-chains.py`. Writes `data/imports/restaurant-chains/<chain>/<report>/<period>.csv` + `data/imports/_index.json` audit catalog. No DB writes.
2. **Step 2 — Silver/Gold loader** (~3 person-days). `scripts/etl/import-restaurant-chain.py`. Idempotent UPSERT into existing `dim_*` + `fact_*` Silver tables; triggers Gold materialization. Three V*.sql migrations to fill schema gaps if needed (see §2).
3. **Step 3 — factory_id seed migration** (~0.5 person-day). Single V*.sql migration that INSERTs the 14 chain catalog rows per Q1 §4.3 table.

**Total: ~6.5 person-days**, dispatchable in **3 parallel chats** (Sub-ETL-1, Sub-ETL-2, Sub-ETL-3) with a clean dependency edge: Sub-ETL-3 (catalog seed) merges first → Sub-ETL-1 (CSV normalize, no DB) parallel → Sub-ETL-2 (loader) waits on Sub-ETL-3 + Sub-ETL-1 sample output.

**Key design decisions baked in (informed by audit PR #298 + Q1 amendment PR #223 + existing schema):**

- **No new tenant abstraction.** `factory_id` (VARCHAR(50)) IS the tenant identifier in smartbi_prod_db (per existing dim_store / fact_pos_item RLS pattern). The dispatch's "restaurant_tenant_id" framing is rejected — see Open Question Q-ETL-1.
- **Chain catalog table is OPTIONAL.** Existing `dim_store` carries store-within-chain. A new `restaurant_chain_catalog` table is a thin metadata layer (chain_name_zh, cuisine, source_root_path) — see §1.2 + Open Question Q-ETL-2 for keep/skip decision.
- **No FK to `factories` table.** `smartbi_prod_db` does not host `factories` (lives in `cretas_prod_db` per `V20260501_02__c_factory_provenance_config.sql` line 9-10). The 14 new factory_ids are smartbi-side seed only; cretas-side `factories` row creation is a separate question (Open Question Q-ETL-4).
- **Wastage / recipe / stocktaking facts STAY MISSING.** Q1 §3.1 documents the gap. Filling these is Q5 scope (quality endpoint redefinition), NOT ETL infra scope.
- **ETL idempotence via natural keys** — re-running same source CSV is safe (`ON CONFLICT DO UPDATE` on `(factory_id, source_bill_no)` for facts, `(factory_id, name)` for dims). Per existing `dim_store` UPSERT pattern (`2026_04_28_silver_dimensions.sql` line 22-30).

⛔ **HOLD blocks** (per dispatch §⛔ + Q1 §10 + audit PR #298):
- This is **design spec only** — no code edits, no DB DDL, no deploys.
- Phase B kickoff still gated on T6.5 Phase C close + active-E2E (or 30d soak) per MO PR #249 §⛔ pre-flight.
- ETL infra **can** dispatch in parallel with T6.5 Phase C close per Q1 §5 trigger condition. Steve sign-off on §5 Open Questions required first.
- Q4 (production semantics for restaurant tenant) + Q5 (quality redefinition) **NOT in scope** of this spec — they gate Steps 4+5+6, not Steps 1+2+3.

---

## 1. Schema Design

### 1.1 Tenant identifier (factory_id)

**Decision**: `factory_id VARCHAR(50) NOT NULL` is the sole tenant identifier in smartbi_prod_db. **No new `restaurant_tenant_id` column / table introduced.**

**Rationale** (responding to dispatch's "factory_id ↔ restaurant_tenant_id 1:1 OR 1:N?" framing):

- Existing smartbi tables (`dim_store`, `dim_product`, `dim_ingredient`, `fact_pos_item`, `fact_pos_transaction`, `fact_restaurant_requisition`, `agg_restaurant_*`) all use `factory_id VARCHAR(50)` with RLS policy `factory_id = current_setting('app.factory_id', true)`.
- Q1 amendment §4.3 enumerates 14 factory_ids per chain (`R_ILTEATRO_REAL`, `R_SHANGMA_HG_REAL`, ...). No "tenant" concept above factory_id is introduced.
- A chain has multiple stores (门店名称 column in source data); the **store** is captured by `dim_store.name`, scoped by `factory_id`. This is already 1-chain-to-N-stores via existing schema — no new table needed for that relationship.
- Adding a `restaurant_tenant_id` would create a parallel ID space requiring backfill across ~15 tables, RLS policy rewrites, and breaks Java side parity (`@Param("factoryId")` everywhere). Cost ~5 person-days for zero semantic gain.

**See Open Question Q-ETL-1** for explicit Steve sign-off — recommended answer is "no new abstraction, factory_id IS tenant".

**factory_id ↔ chain mapping**: **1 chain = 1 factory_id** (1:1). Multiple stores within a chain → `dim_store` rows, all scoped to that one factory_id. Multi-month / multi-year data for the same chain → multiple `fact_*` rows with different `business_date`, all scoped to same factory_id.

**Special case** — 青花椒: existing `RES_3101_009` (Apr-25 qhj demo seed, synthetic top-136 menu) and the new `R_QINGHUAJIAO_REAL` (real Excel-import data) are **two distinct factory_ids**. They live in the same smartbi_prod_db but are isolated tenants. Per Q1 §4.3 footnote: *"this is a separate real-data factory"*.

### 1.2 Chain metadata catalog (`restaurant_chain_catalog`) — OPTIONAL

**Decision**: introduce a thin chain-metadata table. Keep narrow — only metadata that is NOT derivable from `dim_store` / `fact_*` rows.

```sql
CREATE TABLE IF NOT EXISTS restaurant_chain_catalog (
    factory_id        VARCHAR(50) PRIMARY KEY,        -- 1:1 with factory_id (no new ID space)
    chain_name_zh     VARCHAR(200) NOT NULL,          -- e.g. '青花椒', '上马火锅'
    chain_name_roman  VARCHAR(100) NOT NULL,          -- e.g. 'QINGHUAJIAO', 'SHANGMA_HG'
    cuisine           VARCHAR(50),                    -- e.g. 'Sichuan', 'HotPot', 'Western'
    source_kind       VARCHAR(20) NOT NULL,           -- 'REAL' (Excel-import) | 'DEMO' (qhj synthetic) | 'TEST' (F999 / F001)
    source_root_path  VARCHAR(500),                   -- e.g. 'smartbi维度分析/大众点评/真实餐饮连锁数据/青花椒/'
    notes             TEXT,
    created_at        TIMESTAMP DEFAULT NOW(),
    updated_at        TIMESTAMP DEFAULT NOW()
);

-- NO RLS on this table — it's a control-plane catalog readable by all factory contexts.
-- (Application code should never JOIN dim_store to this catalog by factory_id; if it does,
-- RLS on dim_store already blocks cross-tenant leakage.)

-- Index for filtering by source_kind (admin UI: "list all REAL chains"):
CREATE INDEX IF NOT EXISTS idx_chain_catalog_source_kind
    ON restaurant_chain_catalog (source_kind);
```

**Why this table is small**:
- It does NOT replicate store-level fields (store names, addresses, brands) — those live in `dim_store`.
- It does NOT reference `factories` (that table is in `cretas_prod_db`, cross-DB FK not feasible).
- It is a **smartbi-side annotation** for ETL provenance + admin/diagnostic queries ("which chains are real-data vs synthetic?").

**Skip-table alternative** — record source_kind / cuisine / source_root_path inside `dim_store.notes` JSONB blob and discover chain list via `SELECT DISTINCT factory_id FROM dim_store`. Saves one migration file. Trade-off: harder to enumerate chains independent of fact data; harder to mark a chain as REAL without scanning dim_store.

**Recommendation**: ship the catalog table. ~30 LOC migration, removes ambiguity, gives a clean target for Step 3 seed.

**See Open Question Q-ETL-2** for skip vs ship decision.

### 1.3 Index strategy

For **Step 2 loader idempotence** (UPSERT key constraints already exist on dim/fact tables per `2026_04_28_silver_dimensions.sql` + `2026_04_29_silver_facts.sql` — verified §1.5 below). No new index migrations needed for ETL infra.

For **chain catalog admin queries**:
- PRIMARY KEY on `factory_id` (built-in).
- Secondary index on `source_kind` (above) — filter REAL vs DEMO vs TEST.

For **fact_pos_item ETL UPSERT** (existing schema review needed — see §1.5 verify task):
- Existing UPSERT key per Q1 §4.2: `(factory_id, source_type='excel', store_id, source_bill_no)`. **Verify** this constraint exists in `2026_04_29_silver_facts.sql`. If not, this is the one new constraint needed in Step 2.

### 1.4 14 real-chain factory_id enumeration

Per Q1 amendment §4.3 table (verbatim — Steve confirms in Open Question Q-ETL-3):

| # | Chain (Chinese) | Cuisine | factory_id | Source root path |
|---|---|---|---|---|
| 1 | IL TEATRO 西餐 | Western | `R_ILTEATRO_REAL` | `IL TEATRO（西餐厅）2月_商品销量报表.xls` |
| 2 | 上马火锅 | HotPot | `R_SHANGMA_HG_REAL` | `上马火锅（火锅）2月商品销量报表.xls` |
| 3 | 锦川火锅 | HotPot | `R_JINCHUAN_HG_REAL` | `锦川火锅5个月/` |
| 4 | 唏嘛香 牛肉面 | Noodles | `R_XIMAXIANG_REAL` | `唏嘛香（牛肉面）2月销量报表.xls` |
| 5 | 御九井 日料 | Japanese | `R_YUJIUJING_REAL` | `御九井（日料）2月_商品销量报表.xls` |
| 6 | 永和豆浆 快餐 | FastFood | `R_YONGHE_REAL` | `永和豆浆（快餐）2月_商品销量报表.xls` |
| 7 | 鑫巴蜀 | Sichuan | `R_XINBASHU_REAL` | `鑫巴蜀5个月/` |
| 8 | 青花椒 | Sichuan | `R_QINGHUAJIAO_REAL` | `青花椒/` + `青花椒25年/` |
| 9 | 东门口 | Local | `R_DONGMENKOU_REAL` | `东门口2月*.csv` + `东门口25年/` |
| 10 | 鸿德记 | — | `R_HONGDEJI_REAL` | `鸿德记5个月/` |
| 11 | 今日牛事 | Beef | `R_JINRINIUSHI_REAL` | `今日牛事5个月/` |
| 12 | 有滋有味 | — | `R_YOUZIYOUWEI_REAL` | `有滋有味5个月/` |
| 13 | 邻家宴 | — | `R_LINJIAYAN_REAL` | `邻家宴5个月/` |
| 14 | 火锅 (generic profit) | HotPot | `R_HUOGUO_GENERIC_REAL` *(or merge into #2)* | `火锅2月利润表.xls` |

**Special inputs not yet assigned**:
- `20260306094202727_e72f865f5e1_商品销量报表.xlsx` (top-level generic dianping export) — origin chain unknown. Recommend quarantine in Step 1 (Q1 §4.1: "Quarantine malformed rows to `data/imports/_quarantine/`").

**Naming convention rationale** (per Q1 §4.3):
- Prefix `R_` = real-data restaurant (mirrors existing `R_GML_DEMO` / `R_XMX_FRESH` Phase 2A demo prefix; `R_` semantics already in use).
- Body = chain name romanized (uppercase, underscore for spaces).
- Suffix `_REAL` distinguishes from `_DEMO` / `_FRESH` / no-suffix synthetic factory_ids.

### 1.5 Existing schema audit (Step 2 prerequisites)

**Verified 2026-05-12 via Sub-ETL-2a Day 0 audit (PR #332)** — 3/4 ⚠️ rows mis-described originally; corrected below:

| Table | Existing UPSERT key (VERIFIED) | Status |
|---|---|---|
| `dim_store` | `UNIQUE (factory_id, name)` | ✅ Confirmed `2026_04_28_silver_dimensions.sql` line 56 |
| `dim_product` | `UNIQUE (factory_id, normalized_name)` | ✅ Confirmed `2026_04_28_silver_dimensions.sql` line 84 |
| `dim_ingredient` | `UNIQUE (source_pk)` + `UNIQUE (normalized_name)` (NOT raw `name`) | ✅ VERIFIED — two uniques on different keys; ON CONFLICT works on either |
| `fact_pos_item` | **NO natural-key UNIQUE** — dedup-by-CASCADE by design | ✅ VERIFIED — Steve sign-off 2026-05-12 Option A: keep schema, DELETE-then-INSERT pattern in Sub-ETL-2b/2c (no ALTER ADD UNIQUE) |
| `fact_pos_transaction` | `UNIQUE (factory_id, source_type, store_id, source_bill_no)` | ✅ VERIFIED — exact match `2026_04_29_silver_facts.sql:54` |
| `fact_restaurant_requisition` | `UNIQUE (factory_id, source_pk)` (NOT `source_bill_no` — column doesn't exist) | ✅ VERIFIED |

**No ALTER migrations needed.** Existing constraints support ETL UPSERT for 5 of 6 tables. `fact_pos_item` uses DELETE-INSERT pattern (Steve verbal sign-off Option A 2026-05-12). `V20260815_03__t6_6_etl_constraint_fixups.sql` is **removed from Sub-ETL-2 batch** — would have been an empty migration per audit findings.

### 1.6 Wastage / recipe / stocktaking — INTENTIONALLY DEFERRED

Per Q1 §3.1, these three fact tables are MISSING from Excel source data:
- `fact_restaurant_wastage` — Excel has no wastage column.
- `fact_restaurant_recipe_line` — Excel has no BOM info.
- `fact_restaurant_stocktaking` — Excel has no stocktaking events.

**ETL infra scope DOES NOT fill these.** They are Q5 (quality redefinition) scope:
- If Q5 picks "wastageRate from `fact_restaurant_wastage` if populated, else NULL", this stays empty for all 14 REAL chains.
- If Q5 picks "wastageRate proxied from sales-vs-purchase delta", a derivation rule lives in the production/quality service code, not ETL infra.

ETL infra explicitly **does not create empty rows** in these tables for the 14 chains — emptiness is the truth of the source data.

---

## 2. Migration Framework

### 2.1 Files

Three V*.sql migrations follow `V<YYYYMMDD>_<NN>__<description>.sql` convention per `server-operations.md` HARD RULE. Date `20260815` is a placeholder per Q1 §5 ETA (~mid-July to mid-August 2026); update to actual dispatch date.

```
backend/python/smartbi/database/migrations/
├── V20260815_01__t6_6_etl_chain_catalog.sql        (~30 LOC, NEW table)
├── V20260815_02__t6_6_etl_constraint_fixups.sql    (~50 LOC, conditional UPSERT key adds — Sub-ETL-2 Day 0 audit gates whether this file ships)
└── V20260815_03__t6_6_etl_seed_14_real_chains.sql  (~60 LOC, INSERTs into chain catalog only)
```

**Note**: NO `factory_id` rows in `dim_*` / `fact_*` are seeded by migrations. Those rows are created by the Step 2 Python loader running on canonical CSVs from Step 1. Migrations only seed the **chain catalog metadata**; data rows are loader output.

### 2.2 Migration #1 skeleton — chain catalog table

```sql
-- V20260815_01__t6_6_etl_chain_catalog.sql
-- T6.6 Phase B Q1 amendment §4.3 — restaurant chain catalog (control-plane metadata).
-- Spec: docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md §1.2
-- NOT a marching order. Apply via apply-smartbi-migrations.sh per server-operations.md HARD RULE.

CREATE TABLE IF NOT EXISTS restaurant_chain_catalog (
    factory_id        VARCHAR(50) PRIMARY KEY,
    chain_name_zh     VARCHAR(200) NOT NULL,
    chain_name_roman  VARCHAR(100) NOT NULL,
    cuisine           VARCHAR(50),
    source_kind       VARCHAR(20) NOT NULL,
    source_root_path  VARCHAR(500),
    notes             TEXT,
    created_at        TIMESTAMP DEFAULT NOW(),
    updated_at        TIMESTAMP DEFAULT NOW(),
    CONSTRAINT chk_chain_source_kind
        CHECK (source_kind IN ('REAL', 'DEMO', 'TEST'))
);

CREATE INDEX IF NOT EXISTS idx_chain_catalog_source_kind
    ON restaurant_chain_catalog (source_kind);

-- Auto-touch updated_at (reuse silver_touch_updated_at function from
-- 2026_04_28_silver_dimensions.sql — verify it exists in target DB before this runs).
DROP TRIGGER IF EXISTS trg_chain_catalog_touch ON restaurant_chain_catalog;
CREATE TRIGGER trg_chain_catalog_touch
    BEFORE UPDATE ON restaurant_chain_catalog
    FOR EACH ROW EXECUTE FUNCTION silver_touch_updated_at();

-- NO RLS — this is control-plane metadata, readable across factory contexts.
```

### 2.3 Migration #2 skeleton — constraint fixups (conditional)

```sql
-- V20260815_02__t6_6_etl_constraint_fixups.sql
-- Conditional UPSERT key adds for ETL idempotence. Ship ONLY rows that audit (Sub-ETL-2 Day 0)
-- finds missing in current schema. If all keys present, this file is empty (just BEGIN/COMMIT).
-- Spec: docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md §1.5

-- Example (only if audit confirms missing):
-- ALTER TABLE fact_pos_item ADD CONSTRAINT uq_fact_pos_item_natural
--     UNIQUE (factory_id, source_type, store_id, source_bill_no, line_no);
-- ALTER TABLE fact_restaurant_requisition ADD CONSTRAINT uq_fact_req_natural
--     UNIQUE (factory_id, source_bill_no);

-- Sub-ETL-2 Day 0: grep existing migrations + run `\d <table>` against test DB.
-- Fill or empty this file based on findings.
```

### 2.4 Migration #3 skeleton — seed 14 chains

```sql
-- V20260815_03__t6_6_etl_seed_14_real_chains.sql
-- Seed restaurant_chain_catalog with 14 real-data chains per Q1 amendment §4.3.
-- Spec: docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md §1.4
-- Idempotent via ON CONFLICT DO NOTHING — re-runnable.
-- Rollback: DELETE FROM restaurant_chain_catalog WHERE source_kind = 'REAL';

INSERT INTO restaurant_chain_catalog (factory_id, chain_name_zh, chain_name_roman, cuisine, source_kind, source_root_path, notes)
VALUES
  ('R_ILTEATRO_REAL',       'IL TEATRO 西餐', 'ILTEATRO',     'Western',  'REAL', 'IL TEATRO（西餐厅）2月_商品销量报表.xls', 'T6.6 Phase B real-DB import'),
  ('R_SHANGMA_HG_REAL',     '上马火锅',       'SHANGMA_HG',   'HotPot',   'REAL', '上马火锅（火锅）2月商品销量报表.xls',     'T6.6 Phase B real-DB import'),
  ('R_JINCHUAN_HG_REAL',    '锦川火锅',       'JINCHUAN_HG',  'HotPot',   'REAL', '锦川火锅5个月/',                          'T6.6 Phase B real-DB import (5-month series)'),
  ('R_XIMAXIANG_REAL',      '唏嘛香 牛肉面',  'XIMAXIANG',    'Noodles',  'REAL', '唏嘛香（牛肉面）2月销量报表.xls',          'T6.6 Phase B real-DB import'),
  ('R_YUJIUJING_REAL',      '御九井 日料',    'YUJIUJING',    'Japanese', 'REAL', '御九井（日料）2月_商品销量报表.xls',        'T6.6 Phase B real-DB import'),
  ('R_YONGHE_REAL',         '永和豆浆',       'YONGHE',       'FastFood', 'REAL', '永和豆浆（快餐）2月_商品销量报表.xls',      'T6.6 Phase B real-DB import'),
  ('R_XINBASHU_REAL',       '鑫巴蜀',         'XINBASHU',     'Sichuan',  'REAL', '鑫巴蜀5个月/',                            'T6.6 Phase B real-DB import (5-month series)'),
  ('R_QINGHUAJIAO_REAL',    '青花椒',         'QINGHUAJIAO',  'Sichuan',  'REAL', '青花椒/ + 青花椒25年/',                   'T6.6 Phase B real-DB import; distinct from RES_3101_009 demo seed'),
  ('R_DONGMENKOU_REAL',     '东门口',         'DONGMENKOU',   'Local',    'REAL', '东门口2月*.csv + 东门口25年/',             'T6.6 Phase B real-DB import (CSV + 2025 history)'),
  ('R_HONGDEJI_REAL',       '鸿德记',         'HONGDEJI',     NULL,       'REAL', '鸿德记5个月/',                            'T6.6 Phase B real-DB import (5-month series)'),
  ('R_JINRINIUSHI_REAL',    '今日牛事',       'JINRINIUSHI',  'Beef',     'REAL', '今日牛事5个月/',                          'T6.6 Phase B real-DB import (5-month series)'),
  ('R_YOUZIYOUWEI_REAL',    '有滋有味',       'YOUZIYOUWEI',  NULL,       'REAL', '有滋有味5个月/',                          'T6.6 Phase B real-DB import (5-month series)'),
  ('R_LINJIAYAN_REAL',      '邻家宴',         'LINJIAYAN',    NULL,       'REAL', '邻家宴5个月/',                            'T6.6 Phase B real-DB import (5-month series)'),
  ('R_HUOGUO_GENERIC_REAL', '火锅 (generic)', 'HUOGUO_GENERIC','HotPot',  'REAL', '火锅2月利润表.xls',                       'T6.6 Phase B real-DB import; merge candidate with R_SHANGMA_HG_REAL — see Q-ETL-3')
ON CONFLICT (factory_id) DO NOTHING;
```

### 2.5 Integration with `apply-smartbi-migrations.sh`

Per `server-operations.md` HARD RULE: all smartbi schema changes apply through the runner. ETL impl chats:

1. Create V*.sql files (above).
2. Test apply via `./scripts/migrations/apply-smartbi-migrations.sh --env test --dry-run` (BEGIN/ROLLBACK no-op verify).
3. Real apply via `./scripts/deploy/deploy-smartbi-python.sh --env test` (Step 3.5 of deploy invokes runner).
4. Production apply via `./scripts/deploy/deploy-smartbi-python.sh --env prod` after test-env smoke OK.

The runner enforces tracker insert (`smartbi_migrations` table, PK = filename) per `2026-05-07-smartbi-migration-runner-spec.md`. Re-applying same checksum is a no-op (skip); checksum mismatch aborts deploy.

**No bespoke runner needed.** Existing infrastructure handles ETL migrations identically to Phase 2A migrations.

---

## 3. Backfill Script Skeleton (Python)

### 3.1 Layout

```
scripts/etl/                              ← NEW directory (does not exist per audit §4.1)
├── __init__.py
├── normalize_restaurant_chains.py        ← Sub-ETL-1 deliverable (Step 1)
├── import_restaurant_chain.py            ← Sub-ETL-2 deliverable (Step 2)
├── README.md                             ← Operator runbook (Sub-ETL-2 Day 0 stub OK)
└── _lib/
    ├── __init__.py
    ├── format_detect.py                  ← .xls / .xlsx / .csv dispatcher
    ├── column_mapping.py                 ← Chinese → English snake_case canonical map
    ├── quarantine.py                     ← Failure handling (write to data/imports/_quarantine/)
    └── upsert_helpers.py                 ← Idempotent INSERT ... ON CONFLICT helpers per fact/dim
```

**Why `scripts/etl/` not `backend/python/smartbi/etl/`**:

- Operational scripts (one-shot data loaders), not request-handling FastAPI code.
- Mirrors existing `scripts/migrations/` operational layout.
- Avoids polluting smartbi module with non-runtime code.
- See Open Question Q-ETL-5 for explicit Steve sign-off.

### 3.2 Step 1 skeleton — normalize_restaurant_chains.py

```python
"""
T6.6 Phase B Step 1 — Excel/CSV → canonical CSV normalizer.

Spec: docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md §3
Q1 amendment: docs/superpowers/specs/2026-05-09-t6-6-q1-real-db-amendment.md §4.1

Reads source data from `smartbi维度分析/大众点评/真实餐饮连锁数据/`.
Writes canonical CSVs to `data/imports/restaurant-chains/<chain>/<report>/<period>.csv`.
Writes `data/imports/_index.json` audit catalog.
Quarantines malformed rows to `data/imports/_quarantine/<chain>/<report>/<period>__line<N>__<reason>.csv`.

NO DB writes. NO network calls. Pure file pipeline.
"""

from __future__ import annotations
import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

# Per Rule 5 (python-java-port.md): use SELECT *-style schema-flex; here, use **kwargs / dict
# for column mapping flexibility. Per Rule 6: explicit None-check on inputs.
# Per Rule 11 / 12: not applicable (no Decimal serialization, no datetime emit at this layer).

# DO NOT IMPORT: backend.python.smartbi.* — keep ETL operational scripts decoupled from
# request-handling FastAPI module. Import only stdlib + xlrd + openpyxl.

SOURCE_ROOT = Path("smartbi维度分析/大众点评/真实餐饮连锁数据")
OUTPUT_ROOT = Path("data/imports/restaurant-chains")
QUARANTINE_ROOT = Path("data/imports/_quarantine")
INDEX_PATH = Path("data/imports/_index.json")


@dataclass
class ChainSource:
    """One chain's source-data manifest (driven by Q1 §4.3 catalog)."""
    factory_id: str           # e.g. 'R_ILTEATRO_REAL'
    chain_name_zh: str        # e.g. 'IL TEATRO 西餐'
    source_paths: list[Path]  # 1..N paths under SOURCE_ROOT


def discover_chain_sources(catalog: dict) -> list[ChainSource]:
    """Read restaurant_chain_catalog seed (or static dict mirror) → enumerate ChainSource list.
    
    For Step 1, catalog can be a static dict mirroring V20260815_03 INSERT rows.
    For Step 2, query smartbi_prod_db.restaurant_chain_catalog.
    """
    raise NotImplementedError("Sub-ETL-1 Day 1: define static catalog dict OR read seed SQL.")


def normalize_xls(path: Path) -> Iterable[dict]:
    """Read legacy .xls (BIFF8) via xlrd 1.2.0. Yield row dicts with canonical column names."""
    raise NotImplementedError("Sub-ETL-1 Day 1: xlrd reader + column mapping.")


def normalize_xlsx(path: Path) -> Iterable[dict]:
    """Read modern .xlsx via openpyxl. Yield row dicts."""
    raise NotImplementedError("Sub-ETL-1 Day 1: openpyxl reader + column mapping.")


def normalize_csv(path: Path) -> Iterable[dict]:
    """Read CSV (UTF-8 BOM, comma-delimited, 4-line header). Yield row dicts."""
    raise NotImplementedError("Sub-ETL-1 Day 1: csv reader + skip metadata banner rows.")


def quarantine_row(chain: str, report: str, period: str, line: int, reason: str, raw: dict) -> None:
    """Write malformed row to quarantine with line+reason. NEVER silently drop."""
    raise NotImplementedError("Sub-ETL-1 Day 2: quarantine writer.")


def write_canonical_csv(chain: str, report: str, period: str, rows: Iterable[dict]) -> int:
    """Write rows to data/imports/restaurant-chains/<chain>/<report>/<period>.csv. Return row count."""
    raise NotImplementedError("Sub-ETL-1 Day 2: canonical CSV writer.")


def write_index(catalog: list[dict]) -> None:
    """Update data/imports/_index.json with per-chain × per-report × per-period × row-count."""
    raise NotImplementedError("Sub-ETL-1 Day 3: index emitter.")


def main() -> int:
    """Entry point. Returns 0 on success, 1 on any quarantine write."""
    raise NotImplementedError(
        "Sub-ETL-1 Day 1-3: orchestrate discover → per-source format detect → "
        "normalize → write canonical → quarantine on failure → write index."
    )


if __name__ == "__main__":
    import sys
    sys.exit(main())
```

### 3.3 Step 2 skeleton — import_restaurant_chain.py

```python
"""
T6.6 Phase B Step 2 — Silver/Gold loader.

Spec: docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md §3
Q1 amendment: docs/superpowers/specs/2026-05-09-t6-6-q1-real-db-amendment.md §4.2

Reads canonical CSVs from data/imports/restaurant-chains/<chain>/<report>/<period>.csv.
UPSERTs into smartbi_prod_db dim_* + fact_* per existing schema.
Triggers Gold materialization via existing `2026_05_05_gold_aggregations.sql` mat-views.

Idempotent: re-running on same source CSV is safe (UPSERT keys per §1.5).
RLS-aware: connection sets `app.factory_id` GUC before INSERT to satisfy tenant_isolation policy.

Per Rule 5 / 6 / 11 / 12 (python-java-port.md):
- Rule 5: use SELECT * helper queries — but this is INSERT-heavy, less applicable.
- Rule 6: precondition-assert factory_id non-None at function boundary.
- Rule 11/12: not applicable at ETL layer (no datetime/Decimal emit to JSON).
"""

from __future__ import annotations
import argparse
import csv
import logging
from pathlib import Path
from typing import Iterable

import asyncpg


async def connect_factory_scoped(db_dsn: str, factory_id: str) -> asyncpg.Connection:
    """Open DB conn and SET LOCAL app.factory_id GUC so RLS policies allow INSERT."""
    if not factory_id:
        raise ValueError("factory_id required for tenant-scoped connection")
    conn = await asyncpg.connect(db_dsn)
    await conn.execute("SET app.factory_id = $1", factory_id)
    return conn


async def upsert_dim_store(conn, factory_id: str, name: str, **kwargs) -> int:
    """UPSERT dim_store, return store_id. Idempotent via UNIQUE (factory_id, name)."""
    raise NotImplementedError(
        "Sub-ETL-2 Day 1: per existing UPSERT pattern in 2026_04_28_silver_dimensions.sql line 22-30."
    )


async def upsert_dim_product(conn, factory_id: str, name: str, normalized_name: str, **kwargs) -> int:
    """UPSERT dim_product, return product_id."""
    raise NotImplementedError("Sub-ETL-2 Day 1: per existing UPSERT pattern.")


async def upsert_dim_ingredient(conn, factory_id: str, name: str, **kwargs) -> int:
    """UPSERT dim_ingredient, return ingredient_id."""
    raise NotImplementedError("Sub-ETL-2 Day 1: confirm uq key per §1.5 verify task.")


async def insert_fact_pos_item(conn, factory_id: str, store_id: int, product_id: int, **kwargs) -> None:
    """INSERT fact_pos_item with ON CONFLICT DO NOTHING on natural key."""
    raise NotImplementedError(
        "Sub-ETL-2 Day 2: per Q1 §4.2 natural key (factory_id, source_type='excel', "
        "store_id, source_bill_no, line_no). Add UQ in V20260815_02 if missing."
    )


async def insert_fact_restaurant_requisition(conn, factory_id: str, store_id: int, **kwargs) -> None:
    """INSERT fact_restaurant_requisition with ON CONFLICT DO NOTHING."""
    raise NotImplementedError("Sub-ETL-2 Day 2: purchase data path.")


async def trigger_gold_materialization(conn, factory_id: str) -> None:
    """Refresh agg_restaurant_* materialized views for this factory.
    
    Existing mat views from 2026_05_05_gold_aggregations.sql cover daily / totals / product_cost.
    Q5 (quality redefinition) MAY require new agg views — defer to Sub-A/Sub-B impl, not ETL.
    """
    raise NotImplementedError("Sub-ETL-2 Day 3: REFRESH MATERIALIZED VIEW <agg_*>.")


async def import_chain(factory_id: str, source_dir: Path, db_dsn: str) -> dict:
    """Top-level: load all canonical CSVs for one chain into Silver, trigger Gold.
    
    Returns stats dict: {dim_store_upserts, dim_product_upserts, fact_inserts, ...}.
    """
    raise NotImplementedError(
        "Sub-ETL-2 Day 1-3: orchestrate connect_factory_scoped → "
        "scan source_dir for canonical CSVs → upsert dims → insert facts → "
        "trigger gold → return stats."
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--factory-id", required=True, help="e.g. R_ILTEATRO_REAL")
    parser.add_argument("--source-dir", required=True, help="data/imports/restaurant-chains/<chain>/")
    parser.add_argument("--db-dsn", required=True, help="postgresql://user:pass@host/smartbi_prod_db")
    parser.add_argument("--dry-run", action="store_true", help="ROLLBACK after each chain")
    args = parser.parse_args()
    raise NotImplementedError("Sub-ETL-2 Day 1: main entry assembling import_chain async run.")


if __name__ == "__main__":
    import sys
    sys.exit(main())
```

### 3.4 Step 3 skeleton — seed migration is THE deliverable

Step 3 is purely SQL (the migration in §2.4 above). No Python script needed.

**Sub-ETL-3 effort**: ~0.5 person-day = (a) write migration §2.4 verbatim from Q1 §4.3 table; (b) Steve sign-off Q-ETL-3 (factory_id naming) + Q-ETL-2 (catalog table keep/skip); (c) test apply to test env via `apply-smartbi-migrations.sh --env test --dry-run`; (d) reviewer audit.

---

## 4. Q4 / Q5 Boundary — Strict ETL Infra Scope

### 4.1 What ETL infra DOES (Steps 1+2+3, this spec)

- Convert Excel/CSV → canonical CSV (Step 1, no DB).
- Load canonical CSV → smartbi_prod_db Silver tables (Step 2, idempotent UPSERT).
- Trigger Gold materialization (Step 2, refresh existing mat views).
- Seed restaurant_chain_catalog with 14 factory_ids (Step 3, SQL migration).

### 4.2 What ETL infra DOES NOT do (Steps 4+5+6, gated on Q4 + Q5)

- Define `getOEEOverview()` output shape for restaurant tenant (Q4).
- Define `getDefectAnalysis()` mapping `defectRate → returnRate` etc. (Q5).
- Write `analysis_production.py` / `analysis_quality.py` Python service files (Sub-A / Sub-B per MO PR #249).
- Record Java parity goldens at F999 (Step 5 per Q1 §4.5 — informational only post Q1).
- Build byte-shape parity test harness (Step 6 per Q1 §4.6).
- Decide `R_HUOGUO_GENERIC_REAL` merge vs split (Q-ETL-3 below).
- Decide customer-facing routing of new chains (Q1 §8 Q3 — internal showcase only by default).
- Add nginx regex routing for the 14 new factory_ids (Sub-F per MO PR #249, organizer-owned post-cutover).
- Create `factories` row in cretas_prod_db (Q-ETL-4 — separate decision).

### 4.3 Why this boundary matters

Per audit PR #298 §6.2: ETL infra is **independent of Q4 + Q5** (which gate Sub-A / Sub-B endpoint impl). Dispatching ETL chats now, without waiting on Q4 / Q5, is the spec-compliant path:

> *"Parallelizable with T6.5 Phase C close: dispatch 3 ETL infrastructure chats (~6.5 person-days total) — independent of T6.5 timing per Q1 §5."*

If ETL infra chats accidentally bake Q4 / Q5 assumptions (e.g., "load wastage data because quality endpoint will need it"), they:
1. Block on undecided design questions.
2. Risk wrong-direction work if Q4 / Q5 resolve differently (e.g., Q4 picks "tenant-gate to FACTORY only" → restaurant-tenant production data load is wasted).

**ETL chats MUST refuse to scope-creep into Q4 / Q5**. Output shape decisions live in Sub-A / Sub-B impl, not ETL.

---

## 5. Open Questions for Steve

| # | Question | Recommended default | Why blocks impl? |
|---|---|---|---|
| **Q-ETL-1** | Tenant identifier: keep `factory_id` as sole tenant ID (1:1 with chain)? Or introduce a separate `restaurant_tenant_id` (parallel ID space)? | **Keep factory_id. NO new abstraction.** Per §1.1 — adding a parallel ID requires ~5pd schema rewrite for zero semantic gain. The dispatch's "1:1 OR 1:N?" framing is rejected: chain ↔ factory_id is 1:1; chain ↔ stores is 1:N via existing `dim_store`. | Soft — Sub-ETL-2 design uses factory_id everywhere; no schema rewrite needed in default. Hard if Steve picks "introduce restaurant_tenant_id". |
| **Q-ETL-2** | `restaurant_chain_catalog` table — ship per §1.2 / §2.2 design, OR skip and store metadata in `dim_store.notes` JSONB? | **Ship the catalog table.** ~30 LOC migration, clean target for Step 3 seed, supports admin queries ("list REAL chains"). Skip-alternative pollutes dim_store and makes chain enumeration scan-heavy. | Soft — both work. Catalog gives clean separation. |
| **Q-ETL-3** | factory_id naming — accept Q1 §4.3 14-row table verbatim (`R_<CHAIN_ROMAN>_REAL`)? Specifically: (a) `R_HUOGUO_GENERIC_REAL` separate vs merge into `R_SHANGMA_HG_REAL`? (b) Roman names with diacritics / cuisine suffix variations (`R_SHANGMA_HG_REAL` vs `R_SHANGMA_REAL`)? | **(a) Keep separate** — `R_HUOGUO_GENERIC_REAL` as 14th chain; merging into `R_SHANGMA_HG_REAL` would conflate generic-profit-report data with sales report data. **(b) Keep `_HG` cuisine suffix on hot-pot chains** to avoid collisions if more 火锅 chains arrive later. Use Q1 §4.3 table verbatim. | Hard if Steve renames any factory_id — V20260815_03 seed must mirror exactly. Soft if accept defaults. |
| **Q-ETL-4** | cretas_prod_db `factories` table — does each new `R_<CHAIN>_REAL` factory_id need a corresponding row in `cretas_prod_db.factories`? | **NO for Phase B.** Smartbi-side seed is sufficient for `/analysis/production` + `/analysis/quality` data sourcing. cretas-side `factories` row would be needed if these chains expose customer-facing endpoints (login, order management, etc.) — which Q1 §8 Q3 default says NO (internal showcase only). Defer to a separate cretas-side decision. | Soft — ETL infra doesn't touch cretas_prod_db. Hard if Steve later picks "expose 14 chains as customer tenants" (then per Q1 §8 Q3, opens separate scope). |
| **Q-ETL-5** | Script location — `scripts/etl/` (operational, mirrors `scripts/migrations/`) or `backend/python/smartbi/etl/` (module-namespace)? | **`scripts/etl/`** per §3.1. Operational scripts ≠ FastAPI request code. Mirrors existing `scripts/migrations/` pattern. | Soft — both work. `scripts/etl/` keeps smartbi module clean. |
| **Q-ETL-6** | Quarantine handling — fail loud (exit 1 on any quarantine) per Phase 2A standard, OR best-effort (warn + continue, return success unless 100% quarantine)? | **Fail loud.** Per Phase 2A "no defensive fallback" rule and audit-trail requirement. Operator must triage quarantine before re-run. Best-effort risks silent data drift. | Soft — Sub-ETL-1 design picks one. Affects re-run ergonomics. |
| **Q-ETL-7** | ETL idempotence key for fact_pos_item — `(factory_id, source_type, store_id, source_bill_no, line_no)` per Q1 §4.2, OR coarser `(factory_id, source_type, source_bill_no)` (without store_id + line_no)? | **Q1 §4.2 verbatim** — `(factory_id, source_type='excel', store_id, source_bill_no, line_no)`. Coarser key risks collision when same chain has multiple stores using same bill numbering scheme. Sub-ETL-2 Day 0 verifies which UQ key actually exists in current schema. | Hard if existing schema lacks any UQ — V20260815_02 must add it. Soft if matches Q1 §4.2. |
| **Q-ETL-8** | 25年 sub-dirs (青花椒 / 东门口) — load as continuation of `R_QINGHUAJIAO_REAL` / `R_DONGMENKOU_REAL` (additional `business_date` rows in 2025 range), per Q1 §8 Q2 default, OR separate `R_QINGHUAJIAO_2025_REAL` factory_id? | **Continuation per Q1 default.** Same factory_id, multiple business_date periods. Sub-ETL-1 Day 1 walks both top-level + 25年 sub-dir for these two chains. | Soft — both work. Continuation gives unified time-series for trend analysis. |
| **Q-ETL-9** | `xlrd==1.2.0` (deprecated lib) for legacy .xls — pin in `requirements-dev.txt` (ETL-only dev dep), OR pre-convert all .xls → .xlsx upfront in Sub-ETL-1 then drop xlrd? | **Pre-convert + commit `xlsx_converted/` dir** (one-time ~1h). Drops xlrd runtime+dev dep entirely. Aligns with Q1 §2.4 already-partial pre-conversion. | Soft — both work. Pre-convert = simpler ops. xlrd-pin = honors current state. |
| **Q-ETL-10** | Migration date placeholder — `V20260815_*` (Q1 ETA mid-Aug) vs use actual dispatch date when impl chat fires? | **Use actual dispatch date.** `V20260815_*` is placeholder. Sub-ETL-3 chat renames to current date on dispatch. | Soft — naming hygiene. |

**Steve sign-off needed on at minimum Q-ETL-1 (tenant abstraction), Q-ETL-2 (catalog table ship), Q-ETL-3 (factory_id naming) before Sub-ETL-3 fires.** Q-ETL-4 through Q-ETL-10 can use defaults at chat dispatch.

---

## 6. Implementation 8-Batch Breakdown

Per dispatch §6 ("8-batch breakdown per chat for actual ETL execute follow-up"), splitting Q1 §4 Steps 1+2+3 into ~8 parallel-dispatchable units. Total ~6.5 person-days budget.

| # | Sub-ETL-N | Step | Scope | Effort | Dependencies |
|---|---|---|---|---|---|
| 1 | **Sub-ETL-3a** | 3 | V20260815_01 chain catalog table migration (§2.2). Apply to test env via runner. | 0.2pd | None (Steve Q-ETL-2 + Q-ETL-1 sign-off) |
| 2 | **Sub-ETL-3b** | 3 | V20260815_03 seed 14 chains migration (§2.4). | 0.3pd | Sub-ETL-3a merge (catalog table exists) + Steve Q-ETL-3 sign-off |
| 3 | **Sub-ETL-1a** | 1 | `_lib/format_detect.py` + `_lib/column_mapping.py` (Chinese→English). Foundation modules. | 0.5pd | None (parallel with 3a/3b) |
| 4 | **Sub-ETL-1b** | 1 | `_lib/quarantine.py` + canonical CSV writer + `_index.json` emitter. | 1.0pd | Sub-ETL-1a (depends on column mapping) |
| 5 | **Sub-ETL-1c** | 1 | `normalize_restaurant_chains.py` orchestrator. End-to-end Excel→canonical CSV for all 14 chains. | 1.5pd | Sub-ETL-1a + Sub-ETL-1b |
| 6 | **Sub-ETL-2a** | 2 | V20260815_02 constraint fixups (§2.3 — conditional, may be empty if §1.5 audit passes). | 0.3pd | Sub-ETL-2 Day 0 audit (parallel) |
| 7 | **Sub-ETL-2b** | 2 | `_lib/upsert_helpers.py` per dim/fact. RLS-aware connect helper. | 0.7pd | Sub-ETL-3a merge (chain catalog exists for FK reference) + Sub-ETL-2a merge |
| 8 | **Sub-ETL-2c** | 2 | `import_restaurant_chain.py` orchestrator. Per-chain run + Gold materialization trigger. End-to-end for 1 sample chain (e.g., `R_ILTEATRO_REAL`). | 2.0pd | Sub-ETL-1c output (canonical CSVs) + Sub-ETL-2b (helpers) + Sub-ETL-3b (catalog seeded) |

**Total: 6.5pd** (matches Q1 §4 Steps 1+2+3 estimate).

**Critical-path** (longest serial chain): Sub-ETL-3a → Sub-ETL-3b → Sub-ETL-2c = ~2.5pd serial.

**Parallelism**: Sub-ETL-1a + Sub-ETL-2a + Sub-ETL-3a in week 1; Sub-ETL-1b + Sub-ETL-1c + Sub-ETL-3b + Sub-ETL-2b in parallel; Sub-ETL-2c serial last.

**Verification gates per sub-batch** (per `python-java-port.md` Phase 2A pattern + `verification-before-completion` skill):

- Each sub-batch ships with reviewer audit cycle (per `feedback_subagent_driven_audit_pattern.md`).
- Sub-ETL-2c gate: end-to-end test on `R_ILTEATRO_REAL` — canonical CSV in, dim/fact rows out, Gold view refreshed, RLS isolation verified (cross-tenant query returns 0 rows).
- Per `concurrent-edit-safety.md` Rule 5b: `git commit -- <paths>` only mode for all ETL chat commits.

**Out-of-scope for ETL chats** (do NOT do):

- Sub-A / Sub-B impl (`analysis_production.py` / `analysis_quality.py`) — gated on Q4 / Q5.
- nginx route adds for new factory_ids — Sub-F (organizer-owned, post-cutover).
- Java service file edits — KEEP per Q1 §1 final paragraph.
- F999 / F001 changes — per existing seed migrations, untouched by ETL.
- Customer-facing routing of new chains — Q1 §8 Q3 default = internal only.

---

## 7. Cross-references

| Doc | PR / Path | Relation |
|---|---|---|
| Q1 real-DB amendment | PR #223 / `docs/superpowers/specs/2026-05-09-t6-6-q1-real-db-amendment.md` | Authoritative for data source decision; this spec implements §4 Steps 1+2+3 only |
| T6.6 Phase B execute MO | PR #249 / `docs/superpowers/dispatch/2026-08-15-t6-6-phase-b-execute-marching-order.md` | Authoritative for sub-batch protocol; ETL infra is pre-MO scope (per §⛔ pre-flight gate #1 + audit §6.2) |
| T6.6 Phase B pre-flight audit | PR #298 / `docs/qa-audits/2026-05-11-t6-6-phase-b-pre-flight-blockers.md` | Triggered this spec; §6.2 recommended dispatching 3 ETL chats |
| T6.6 Phase A design | PR #196 / `docs/superpowers/specs/2026-05-09-t6-6-phase-a-design.md` | Phase A = `/query` design; orthogonal to ETL infra |
| Production-port detail | PR #199 / `docs/superpowers/specs/2026-05-09-t6-6-production-port-detail.md` | Body voided by Q1; useful Java method-mirror reference |
| Quality-port detail | PR #203 / `docs/superpowers/specs/2026-05-09-t6-6-quality-port-detail.md` | Body voided by Q1; useful Java method-mirror reference |
| smartbi migration runner spec | `docs/superpowers/specs/2026-05-07-smartbi-migration-runner-spec.md` | ETL migrations apply via this runner per HARD RULE |
| Existing silver dimensions | `backend/python/smartbi/database/migrations/2026_04_28_silver_dimensions.sql` | UPSERT pattern reference (lines 22-30 + per-table CONSTRAINT examples) |
| Existing silver facts | `backend/python/smartbi/database/migrations/2026_04_29_silver_facts.sql` | fact_pos_item / fact_pos_transaction / fact_restaurant_requisition schema — Sub-ETL-2 Day 0 audit target |
| Existing gold aggregations | `backend/python/smartbi/database/migrations/2026_05_05_gold_aggregations.sql` | Gold mat views; Sub-ETL-2c triggers REFRESH |
| Server operations HARD RULE | `.claude/rules/server-operations.md` § "Smartbi 数据库 schema 变更" | All ETL migrations apply through runner; hot-fix escape hatch documented |
| python-java-port.md Rules 1-12 | `.claude/rules/python-java-port.md` | Apply to Sub-A / Sub-B impl (NOT ETL infra; Decimal/datetime emit doesn't happen at ETL layer) |
| Concurrent edit safety | `.claude/rules/concurrent-edit-safety.md` | ETL chats use Rule 5b safe-commit pattern |
| qhj demo seed (existing chain pattern) | `backend/python/smartbi/database/migrations/2026_04_25_qhj_demo_seed_v5.sql` | Reference for INSERT shape; `RES_3101_009` is qhj demo (synthetic), distinct from new `R_QINGHUAJIAO_REAL` |
| factories table location | `backend/python/smartbi/database/migrations/V20260501_02__c_factory_provenance_config.sql` line 9-10 | Confirms smartbi_db has NO factories table; cross-DB FK not feasible |

---

## 8. Predecessors Chain (for PR body when this spec ships)

When organizer dispatches to commit/push this spec:

- PR #196 (T6.6 Phase A design) — merged
- PR #199 (production-port detail) — merged; body voided by Q1
- PR #203 (quality-port detail) — merged; body voided by Q1
- PR #220 (cross-PR consistency audit) — merged
- PR #223 (Q1 real-DB sign-off) — merged; **this spec implements §4 Steps 1+2+3**
- PR #249 (T6.6 Phase B execute MO, DRAFT/HOLD) — merged; **this spec is pre-MO ETL scope**
- PR #298 (Phase B pre-flight audit) — merged; **§6.2 recommended this spec**

This spec is the third in the T6.6 Phase B planning chain (after #223 + #298). It enables 3 parallel impl chats (Sub-ETL-1 / Sub-ETL-2 / Sub-ETL-3 per §6) that can dispatch independently of T6.5 Phase C close.

---

## 9. ⛔ HOLD Blocks

- ⛔ **This is a design spec only.** No code edits, no migrations applied, no DDL run, no deploys, no nginx changes.
- ⛔ **Steve sign-off required** on at minimum Q-ETL-1 (tenant abstraction), Q-ETL-2 (catalog table ship), Q-ETL-3 (factory_id naming) before Sub-ETL-3 dispatches.
- ⛔ **ETL infra MUST NOT scope-creep into Q4 / Q5.** Production / quality output-shape decisions live in Sub-A / Sub-B impl, gated on Steve Q4 / Q5 resolution per Q1 §8 + audit PR #298 §6.1.
- ⛔ **Sub-A / Sub-B impl chats remain HOLD** per MO PR #249 §⛔ pre-flight (T6.5 Phase C close + soak gate). ETL infra dispatch does NOT bypass that gate.
- ⛔ **`safe-commit.sh` paths-only mode** per `concurrent-edit-safety.md` Rule 5b for all ETL chat commits. The repo has multiple active worktrees touching `backend/python/` (per audit PR #298 gate #8).
- ⛔ **STOP-and-ping organizer** before this spec's PR push per dispatch §⛔ HOLD final line.
- ⛔ **No Java side changes.** Java `ProductionAnalysisServiceImpl` / `QualityAnalysisServiceImpl` stay mock per Q1 §1 (Dashboard composite still binds them).
- ⛔ **No customer-facing nginx routing** for new factory_ids — Q1 §8 Q3 default = internal showcase only.

---

## 10. Sign-off

Before Sub-ETL-3 dispatches:

- [x] Steve — Q-ETL-1 (tenant abstraction) decision recorded — **factory_id (VARCHAR(50)) as sole tenant ID** (reject `restaurant_tenant_id` new abstraction, save ~5pd). Verbal AskUserQuestion 2026-05-12. Evidence: PR #325 body §3 + V20260511_01 applied prod.
- [x] Steve — Q-ETL-2 (catalog table ship) decision recorded — **Ship `restaurant_chain_catalog`** (thin metadata table). Verbal AskUserQuestion 2026-05-12. Evidence: PR #325 body §3 + V20260511_01 table created prod 2026-05-11 14:31:59.
- [x] Steve — Q-ETL-3 (factory_id naming) decision recorded — **`R_<CHAIN_ROMAN>_REAL` verbatim Q1 §4.3**. Verbal AskUserQuestion 2026-05-12. Evidence: PR #325 body §3 + 14 rows in `smartbi_prod_db.restaurant_chain_catalog WHERE source_kind='REAL'`.
- [ ] Engineering organizer (timing acceptable; ~6.5pd ETL chats can dispatch parallel with T6.5 Phase C close per Q1 §5)
- [ ] T6.5 Phase C lead (no scope-creep into T6.5; Sub-ETL-* worktrees do not collide with T6.5 worktrees)
- [ ] Reviewer audit cycle (per `feedback_subagent_driven_audit_pattern.md`) — 4 cycles recommended on this spec before impl-dispatch

Sign-off recorded in PR description when this spec merges main.

---

**End of T6.6 Phase B ETL Infrastructure Design Spec.**

*Author: chat3 (post-`/clear`, 2026-05-11). Worktree: per organizer assignment. Branch: per organizer assignment.*
*Triggered by: dispatch from organizer chat — "T6.6 Phase B ETL infra design spec draft (Q1 §4 Step 1+2+3, infra-only)".*
*Predecessors: Q1 amendment PR #223 + Phase B execute MO PR #249 + Phase B pre-flight audit PR #298.*
*Per HARD memories `feedback_pause_before_deploy_or_push.md` + `feedback_dispatch_on_technical_readiness.md`: STOP-and-ping organizer BEFORE push.*

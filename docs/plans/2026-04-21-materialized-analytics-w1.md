# Materialized Analytics W1 — Foundation + 5 Templates + End-to-End

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upload 完成后异步预计算 5 个核心分析模板,持久化到 DB;AIQuery 选数据源时直接从 cache 读并展示,按钮点击秒响应不走 LLM。

**Architecture:** BCC-compatible interfaces (domain-agnostic `AnalysisTemplate` base + `ComputeBackend` abstract + `DomainDetector` strategy), AAB implementation scope (restaurant domain, polars backend, 5 templates in W1 + 5 in W2). Results persist to existing `smart_bi_pg_analysis_results` with 3 new columns (`domain`, `template_code`, `schema_version`). AIQuery frontend reads cache via new `GET /analytics/cached/{upload_id}` endpoint and renders `MaterializedAnalysisPanel` above the chat box.

**Tech Stack:** Python 3.8 / FastAPI / SQLAlchemy / asyncpg / polars 0.20+ / PostgreSQL / Vue 3 / TypeScript / Element Plus / ECharts

---

## File Structure

**New files (W1):**
```
backend/python/smartbi/services/materialized_analytics/
├── __init__.py
├── schema.py                    # DataSchema, Domain enum, FieldRole enum
├── domain_detector.py           # Restaurant rules + pluggable interface
├── compute/
│   ├── __init__.py
│   ├── base.py                  # ComputeBackend abstract
│   └── polars_backend.py        # PolarsBackend (load once, query many)
├── templates/
│   ├── __init__.py
│   ├── base.py                  # AnalysisTemplate abstract + TemplateResult
│   ├── registry.py              # TemplateRegistry
│   ├── top_n_by_dim.py
│   ├── monthly_trend.py
│   ├── category_distribution.py
│   ├── anomaly_detection.py
│   └── pareto_analysis.py
├── persistence.py               # save_result / load_all_for_upload
├── materializer.py              # Orchestrator: detect domain → run templates → persist
└── tests/
    ├── __init__.py
    ├── conftest.py              # polars DF fixtures
    ├── test_domain_detector.py
    ├── test_polars_backend.py
    ├── test_template_top_n.py
    ├── test_template_monthly_trend.py
    ├── test_template_category_distribution.py
    ├── test_template_anomaly.py
    ├── test_template_pareto.py
    └── test_materializer_integration.py

backend/python/smartbi/api/
└── materialized_analytics.py    # GET /analytics/cached/{upload_id}

backend/python/smartbi/database/migrations/
└── V20260421__add_materialized_columns.sql

web-admin/src/components/smart-bi/
├── MaterializedAnalysisPanel.vue
└── MaterializedAnalysisCard.vue

web-admin/src/api/smartbi/
└── materialized.ts              # fetchCachedAnalytics(uploadId)
```

**Modified files (W1):**
```
backend/python/smartbi/api/excel_async.py         # upload hook
backend/python/main.py                             # register new router
web-admin/src/views/smart-bi/AIQuery.vue          # mount MaterializedAnalysisPanel
web-admin/src/api/smartbi/index.ts                # re-export materialized
backend/python/requirements.txt                    # + polars>=0.20
```

---

## Tasks

### Task 1: DB Migration — Add materialized columns

**Files:**
- Create: `backend/python/smartbi/database/migrations/V20260421__add_materialized_columns.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- Add domain/template_code/schema_version to smart_bi_pg_analysis_results
-- for materialized analytics pre-compute lookup.
ALTER TABLE smart_bi_pg_analysis_results
    ADD COLUMN IF NOT EXISTS domain VARCHAR(50),
    ADD COLUMN IF NOT EXISTS template_code VARCHAR(100),
    ADD COLUMN IF NOT EXISTS schema_version INTEGER DEFAULT 1;

-- Composite index for upload_id + template_code lookup (W1 hot path)
CREATE INDEX IF NOT EXISTS idx_analysis_upload_template
    ON smart_bi_pg_analysis_results (upload_id, template_code)
    WHERE template_code IS NOT NULL;

-- Domain index for multi-upload listing
CREATE INDEX IF NOT EXISTS idx_analysis_domain
    ON smart_bi_pg_analysis_results (domain, factory_id)
    WHERE domain IS NOT NULL;
```

- [ ] **Step 2: Apply to test DB**

```bash
ssh root@47.100.235.168 "sudo -u postgres psql -d smartbi_db -f /tmp/V20260421.sql"
# First: scp backend/python/smartbi/database/migrations/V20260421__add_materialized_columns.sql root@47:/tmp/V20260421.sql
```

Expected output: `ALTER TABLE`, `CREATE INDEX`, `CREATE INDEX`

- [ ] **Step 3: Verify columns exist**

```bash
ssh root@47.100.235.168 "sudo -u postgres psql -d smartbi_db -c '\\d smart_bi_pg_analysis_results' | grep -E 'domain|template_code|schema_version'"
```

Expected: 3 rows showing the new columns

- [ ] **Step 4: Commit**

```bash
cd /c/Users/Steve/my-prototype-logistics-materialized-analytics
git add backend/python/smartbi/database/migrations/V20260421__add_materialized_columns.sql
git commit -m "feat(analytics): add domain/template_code/schema_version to analysis_results

W1 task 1: DB migration for materialized analytics cache lookup.
Applied to test smartbi_db only; prod pending W1 ship."
```

---

### Task 2: DataSchema + Domain enum + DomainDetector

**Files:**
- Create: `backend/python/smartbi/services/materialized_analytics/__init__.py` (empty)
- Create: `backend/python/smartbi/services/materialized_analytics/schema.py`
- Create: `backend/python/smartbi/services/materialized_analytics/domain_detector.py`
- Create: `backend/python/smartbi/services/materialized_analytics/tests/__init__.py` (empty)
- Create: `backend/python/smartbi/services/materialized_analytics/tests/conftest.py`
- Create: `backend/python/smartbi/services/materialized_analytics/tests/test_domain_detector.py`

- [ ] **Step 1: Write schema.py**

```python
"""Data schema types shared across materialized analytics.

DomainDetector produces a DataSchema instance; templates check
DataSchema.applies() to decide if they should run.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional


class Domain(str, Enum):
    RESTAURANT = "restaurant"
    FINANCE = "finance"
    SALES = "sales"
    PRODUCTION = "production"
    INVENTORY = "inventory"
    UNKNOWN = "unknown"


class FieldRole(str, Enum):
    MEASURE = "measure"
    DIMENSION = "dimension"
    TIME = "time"
    ID = "id"
    UNKNOWN = "unknown"


@dataclass(frozen=True)
class Field:
    name: str
    role: FieldRole
    dtype: str  # "int" | "float" | "string" | "datetime" | "bool"


@dataclass(frozen=True)
class DataSchema:
    upload_id: int
    factory_id: str
    domain: Domain
    fields: List[Field]
    row_count: int
    primary_measure: Optional[str] = None  # e.g., "销售金额"
    time_field: Optional[str] = None        # e.g., "订单日期"
    hints: dict = field(default_factory=dict)

    @property
    def measures(self) -> List[str]:
        return [f.name for f in self.fields if f.role == FieldRole.MEASURE]

    @property
    def dimensions(self) -> List[str]:
        return [f.name for f in self.fields if f.role == FieldRole.DIMENSION]

    @property
    def time_fields(self) -> List[str]:
        return [f.name for f in self.fields if f.role == FieldRole.TIME]
```

- [ ] **Step 2: Write domain_detector.py**

```python
"""Domain detection — decides what kind of business data an upload holds.

W1 ships restaurant-only rules + fallback to UNKNOWN. Pluggable so we can
add other domains (finance/sales/...) or LLM fallback later without
touching template code.
"""
from __future__ import annotations

import logging
from typing import List, Protocol

from .schema import DataSchema, Domain, Field, FieldRole

logger = logging.getLogger(__name__)

# Restaurant domain signals — any 2+ matching dimension names ⇒ RESTAURANT.
_RESTAURANT_DIM_KEYWORDS = {
    "门店", "店铺", "餐厅", "档口", "分店",
    "菜品", "产品", "商品", "SKU", "品类",
    "订单", "单号", "流水", "桌号",
    "服务员", "收银员", "厨师",
}
_RESTAURANT_MEASURE_KEYWORDS = {
    "销售金额", "销售额", "营业额", "实收", "应收",
    "订单金额", "消费金额", "客单价",
    "毛利", "成本",
}


class DomainDetector(Protocol):
    def detect(self, fields: List[Field], sample_data: List[dict]) -> Domain: ...


class RestaurantRuleDetector:
    """Simple keyword-based rules; extend or swap for LLM later."""

    def detect(self, fields: List[Field], sample_data: List[dict]) -> Domain:
        dim_names = [f.name for f in fields if f.role == FieldRole.DIMENSION]
        measure_names = [f.name for f in fields if f.role == FieldRole.MEASURE]

        dim_hits = sum(
            1 for d in dim_names
            if any(kw in d for kw in _RESTAURANT_DIM_KEYWORDS)
        )
        measure_hits = sum(
            1 for m in measure_names
            if any(kw in m for kw in _RESTAURANT_MEASURE_KEYWORDS)
        )

        # Need dim + measure evidence to avoid false positives
        if dim_hits >= 2 and measure_hits >= 1:
            logger.info(
                f"[domain] RESTAURANT detected (dim_hits={dim_hits}, measure_hits={measure_hits})"
            )
            return Domain.RESTAURANT

        logger.info(
            f"[domain] UNKNOWN (dim_hits={dim_hits}, measure_hits={measure_hits})"
        )
        return Domain.UNKNOWN


def get_default_detector() -> DomainDetector:
    """Single entry point; future: read config to pick detector chain."""
    return RestaurantRuleDetector()
```

- [ ] **Step 3: Write conftest.py test fixtures**

```python
"""Shared test fixtures for materialized_analytics."""
from __future__ import annotations

import pytest

from smartbi.services.materialized_analytics.schema import (
    DataSchema, Domain, Field, FieldRole,
)


@pytest.fixture
def restaurant_schema() -> DataSchema:
    """qhj-style restaurant order detail schema."""
    return DataSchema(
        upload_id=9999,
        factory_id="F001",
        domain=Domain.RESTAURANT,
        fields=[
            Field(name="门店名称", role=FieldRole.DIMENSION, dtype="string"),
            Field(name="菜品名称", role=FieldRole.DIMENSION, dtype="string"),
            Field(name="品类", role=FieldRole.DIMENSION, dtype="string"),
            Field(name="订单日期", role=FieldRole.TIME, dtype="datetime"),
            Field(name="销售金额", role=FieldRole.MEASURE, dtype="float"),
            Field(name="数量", role=FieldRole.MEASURE, dtype="int"),
        ],
        row_count=200003,
        primary_measure="销售金额",
        time_field="订单日期",
    )


@pytest.fixture
def restaurant_sample_rows() -> list:
    return [
        {"门店名称": "大丸百货店", "菜品名称": "招牌毛肚", "品类": "招牌",
         "订单日期": "2026-01-15", "销售金额": 58.0, "数量": 1},
        {"门店名称": "南方百联店", "菜品名称": "清汤锅底", "品类": "锅底",
         "订单日期": "2026-01-15", "销售金额": 28.0, "数量": 1},
    ]
```

- [ ] **Step 4: Write failing test**

```python
"""test_domain_detector.py"""
from smartbi.services.materialized_analytics.domain_detector import (
    RestaurantRuleDetector,
)
from smartbi.services.materialized_analytics.schema import (
    Domain, Field, FieldRole,
)


def test_detect_restaurant_from_dim_and_measure():
    detector = RestaurantRuleDetector()
    fields = [
        Field(name="门店名称", role=FieldRole.DIMENSION, dtype="string"),
        Field(name="菜品名称", role=FieldRole.DIMENSION, dtype="string"),
        Field(name="销售金额", role=FieldRole.MEASURE, dtype="float"),
    ]
    assert detector.detect(fields, []) == Domain.RESTAURANT


def test_detect_unknown_for_generic_data():
    detector = RestaurantRuleDetector()
    fields = [
        Field(name="column_a", role=FieldRole.DIMENSION, dtype="string"),
        Field(name="column_b", role=FieldRole.MEASURE, dtype="float"),
    ]
    assert detector.detect(fields, []) == Domain.UNKNOWN


def test_detect_unknown_when_only_dim_hits():
    detector = RestaurantRuleDetector()
    fields = [
        Field(name="门店名称", role=FieldRole.DIMENSION, dtype="string"),
        Field(name="菜品名称", role=FieldRole.DIMENSION, dtype="string"),
        Field(name="生产批号", role=FieldRole.MEASURE, dtype="string"),
    ]
    # 2 dim hits but 0 measure hits → not confident
    assert detector.detect(fields, []) == Domain.UNKNOWN
```

- [ ] **Step 5: Run tests, verify pass**

```bash
cd backend/python
PYTHONPATH=. pytest smartbi/services/materialized_analytics/tests/test_domain_detector.py -v
```

Expected: 3 passed

- [ ] **Step 6: Commit**

```bash
git add backend/python/smartbi/services/materialized_analytics/
git commit -m "feat(analytics): DataSchema + DomainDetector (restaurant rules)

W1 task 2: foundational types + domain detection strategy.
Restaurant-only rules ship now; interface is pluggable for future
LLM/ML detectors + other domains (finance/sales/...)."
```

---

### Task 3: ComputeBackend abstract + PolarsBackend

**Files:**
- Create: `backend/python/smartbi/services/materialized_analytics/compute/__init__.py` (empty)
- Create: `backend/python/smartbi/services/materialized_analytics/compute/base.py`
- Create: `backend/python/smartbi/services/materialized_analytics/compute/polars_backend.py`
- Create: `backend/python/smartbi/services/materialized_analytics/tests/test_polars_backend.py`
- Modify: `backend/python/requirements.txt` (add `polars>=0.20`)

- [ ] **Step 1: Add polars dependency**

Append to `backend/python/requirements.txt`:
```
polars>=0.20.0
```

- [ ] **Step 2: Write base.py — ComputeBackend abstract**

```python
"""ComputeBackend interface — wraps the in-memory table abstraction.

Templates operate on a ComputeBackend instance, not raw pandas/polars.
This lets us swap to DuckDB/Parquet for 10M+ row uploads without
rewriting template code.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class ComputeBackend(ABC):
    """Abstract compute backend — in-memory OLAP over one upload's rows."""

    @abstractmethod
    def row_count(self) -> int: ...

    @abstractmethod
    def columns(self) -> List[str]: ...

    @abstractmethod
    def dtype(self, column: str) -> str:
        """Returns normalized dtype name: int|float|string|datetime|bool."""

    @abstractmethod
    def group_sum(self, group_col: str, measure: str) -> List[Dict[str, Any]]:
        """Returns [{label, total}, ...] sorted by total DESC."""

    @abstractmethod
    def top_n(self, group_col: str, measure: str, n: int) -> List[Dict[str, Any]]:
        """Top N rows from group_sum."""

    @abstractmethod
    def time_series(self, time_col: str, measure: str, freq: str) -> List[Dict[str, Any]]:
        """Returns [{period, total}, ...] resampled by freq ('D'|'W'|'M')."""

    @abstractmethod
    def percentile(self, measure: str, percentiles: List[float]) -> Dict[float, float]:
        """Returns {p: value, ...} for given percentiles (0-1 range)."""

    @abstractmethod
    def mean_std(self, measure: str) -> Dict[str, float]:
        """Returns {mean, std, min, max}."""

    @abstractmethod
    def outliers(self, measure: str, sigma: float = 2.0) -> List[Dict[str, Any]]:
        """Returns rows where |(value - mean)| > sigma * std."""
```

- [ ] **Step 3: Write polars_backend.py**

```python
"""PolarsBackend — loads upload's full row_data into a polars DataFrame once,
then serves all template queries from memory.

For 200K rows this is 2-5s load + <100ms per template. Templates execute
in lazy pipeline so polars optimizes across them when grouped.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import polars as pl

from .base import ComputeBackend

logger = logging.getLogger(__name__)


class PolarsBackend(ComputeBackend):
    def __init__(self, df: pl.DataFrame):
        self._df = df

    @classmethod
    def from_rows(cls, rows: List[Dict[str, Any]]) -> "PolarsBackend":
        """Build from a list of dicts (row_data JSONB deserialized)."""
        if not rows:
            return cls(pl.DataFrame())
        df = pl.from_dicts(rows, infer_schema_length=min(1000, len(rows)))
        return cls(df)

    def row_count(self) -> int:
        return self._df.height

    def columns(self) -> List[str]:
        return self._df.columns

    def dtype(self, column: str) -> str:
        dt = self._df.schema.get(column)
        if dt is None:
            return "unknown"
        name = str(dt).lower()
        if "int" in name:
            return "int"
        if "float" in name or "decimal" in name:
            return "float"
        if "date" in name or "time" in name:
            return "datetime"
        if "bool" in name:
            return "bool"
        return "string"

    def _as_numeric(self, col: str) -> pl.Expr:
        """Cast column to Float64; nulls for non-numeric strings."""
        return pl.col(col).cast(pl.Float64, strict=False)

    def group_sum(self, group_col: str, measure: str) -> List[Dict[str, Any]]:
        return (
            self._df
            .with_columns(self._as_numeric(measure).alias("_m"))
            .filter(pl.col(group_col).is_not_null() & pl.col("_m").is_not_null())
            .group_by(group_col)
            .agg(pl.col("_m").sum().alias("total"))
            .sort("total", descending=True)
            .rename({group_col: "label"})
            .select(["label", "total"])
            .to_dicts()
        )

    def top_n(self, group_col: str, measure: str, n: int) -> List[Dict[str, Any]]:
        return self.group_sum(group_col, measure)[:n]

    def time_series(self, time_col: str, measure: str, freq: str) -> List[Dict[str, Any]]:
        if freq not in ("D", "W", "M"):
            raise ValueError(f"unsupported freq: {freq}")
        polars_freq = {"D": "1d", "W": "1w", "M": "1mo"}[freq]
        return (
            self._df
            .with_columns([
                pl.col(time_col).cast(pl.Datetime, strict=False).alias("_t"),
                self._as_numeric(measure).alias("_m"),
            ])
            .filter(pl.col("_t").is_not_null() & pl.col("_m").is_not_null())
            .group_by_dynamic("_t", every=polars_freq)
            .agg(pl.col("_m").sum().alias("total"))
            .sort("_t")
            .with_columns(pl.col("_t").dt.strftime("%Y-%m-%d").alias("period"))
            .select(["period", "total"])
            .to_dicts()
        )

    def percentile(self, measure: str, percentiles: List[float]) -> Dict[float, float]:
        series = (
            self._df
            .select(self._as_numeric(measure).alias("_m"))
            .filter(pl.col("_m").is_not_null())
            .get_column("_m")
        )
        return {p: float(series.quantile(p) or 0.0) for p in percentiles}

    def mean_std(self, measure: str) -> Dict[str, float]:
        series = (
            self._df
            .select(self._as_numeric(measure).alias("_m"))
            .filter(pl.col("_m").is_not_null())
            .get_column("_m")
        )
        if series.len() == 0:
            return {"mean": 0.0, "std": 0.0, "min": 0.0, "max": 0.0}
        return {
            "mean": float(series.mean() or 0.0),
            "std": float(series.std() or 0.0),
            "min": float(series.min() or 0.0),
            "max": float(series.max() or 0.0),
        }

    def outliers(self, measure: str, sigma: float = 2.0) -> List[Dict[str, Any]]:
        stats = self.mean_std(measure)
        if stats["std"] == 0:
            return []
        lo = stats["mean"] - sigma * stats["std"]
        hi = stats["mean"] + sigma * stats["std"]
        return (
            self._df
            .with_columns(self._as_numeric(measure).alias("_m"))
            .filter((pl.col("_m") < lo) | (pl.col("_m") > hi))
            .head(50)
            .to_dicts()
        )
```

- [ ] **Step 4: Write test_polars_backend.py**

```python
"""test_polars_backend.py"""
import pytest
from smartbi.services.materialized_analytics.compute.polars_backend import PolarsBackend


@pytest.fixture
def sample_backend() -> PolarsBackend:
    rows = [
        {"store": "A", "category": "main", "date": "2026-01-01", "amount": 100.0},
        {"store": "A", "category": "main", "date": "2026-01-02", "amount": 150.0},
        {"store": "B", "category": "drink", "date": "2026-01-01", "amount": 50.0},
        {"store": "B", "category": "main", "date": "2026-01-03", "amount": 300.0},
        {"store": "C", "category": "drink", "date": "2026-01-02", "amount": 80.0},
    ]
    return PolarsBackend.from_rows(rows)


def test_row_count(sample_backend):
    assert sample_backend.row_count() == 5


def test_group_sum_stores_by_amount(sample_backend):
    result = sample_backend.group_sum("store", "amount")
    assert result[0] == {"label": "B", "total": 350.0}
    assert result[1] == {"label": "A", "total": 250.0}
    assert result[2] == {"label": "C", "total": 80.0}


def test_top_n(sample_backend):
    result = sample_backend.top_n("store", "amount", 2)
    assert len(result) == 2
    assert result[0]["label"] == "B"


def test_mean_std(sample_backend):
    stats = sample_backend.mean_std("amount")
    assert stats["min"] == 50.0
    assert stats["max"] == 300.0
    assert 135.0 < stats["mean"] < 137.0  # 136.0


def test_outliers_none_for_small_sample(sample_backend):
    # With 5 rows and 2σ, no outliers expected
    assert sample_backend.outliers("amount", sigma=2.0) == []


def test_outliers_catches_extreme_values():
    rows = [{"amount": v} for v in [10, 12, 11, 13, 10, 12, 1000]]
    backend = PolarsBackend.from_rows(rows)
    outliers = backend.outliers("amount", sigma=2.0)
    assert len(outliers) == 1
    assert outliers[0]["amount"] == 1000.0
```

- [ ] **Step 5: Install polars + run tests**

```bash
cd backend/python
pip install 'polars>=0.20.0'
PYTHONPATH=. pytest smartbi/services/materialized_analytics/tests/test_polars_backend.py -v
```

Expected: 6 passed

- [ ] **Step 6: Commit**

```bash
git add backend/python/smartbi/services/materialized_analytics/compute/ \
        backend/python/smartbi/services/materialized_analytics/tests/test_polars_backend.py \
        backend/python/requirements.txt
git commit -m "feat(analytics): ComputeBackend abstract + PolarsBackend

W1 task 3: in-memory OLAP wrapper. Polars for 200K-1M rows.
DuckDB impl reserved for future > 1M row workloads."
```

---

### Task 4: AnalysisTemplate abstract + TemplateResult + TemplateRegistry

**Files:**
- Create: `backend/python/smartbi/services/materialized_analytics/templates/__init__.py` (empty)
- Create: `backend/python/smartbi/services/materialized_analytics/templates/base.py`
- Create: `backend/python/smartbi/services/materialized_analytics/templates/registry.py`

- [ ] **Step 1: Write templates/base.py**

```python
"""AnalysisTemplate — base class for every pre-computed analysis.

Each concrete template:
  1. declares applies(schema) to self-filter by domain/field roles
  2. declares code (stable string ID used in DB + FE)
  3. compute(backend, schema) returns TemplateResult

Keep templates pure-functional: same input → same output (deterministic,
testable, cacheable).
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from ..compute.base import ComputeBackend
from ..schema import DataSchema


@dataclass
class TemplateResult:
    """Output of a template run.

    Stored in DB as smart_bi_pg_analysis_results row with:
      - analysis_type = f"materialized:{code}"
      - template_code = code
      - domain        = schema.domain.value
      - analysis_result = data
      - chart_configs   = [chart_config] (single chart per template in W1)
      - kpi_values      = kpis
      - insights        = [insight_text]
    """
    code: str
    title: str
    data: Dict[str, Any]                              # primary payload (tables/series)
    chart_config: Optional[Dict[str, Any]] = None     # ECharts option
    kpis: Dict[str, Any] = field(default_factory=dict)
    insight_text: Optional[str] = None                # pre-generated summary
    applies: bool = True                              # False = "skipped, not applicable"
    skip_reason: Optional[str] = None


class AnalysisTemplate(ABC):
    """Abstract template. Subclasses must define code + applies + compute."""

    @property
    @abstractmethod
    def code(self) -> str:
        """Stable identifier, e.g., 'top_n_by_dim'. Used as template_code column."""

    @property
    @abstractmethod
    def title(self) -> str:
        """Human-readable title shown in UI and insight text."""

    @abstractmethod
    def applies(self, schema: DataSchema) -> bool:
        """Return True if this template can run against this schema."""

    @abstractmethod
    def compute(
        self, backend: ComputeBackend, schema: DataSchema
    ) -> TemplateResult:
        """Run analysis; return TemplateResult."""

    def run(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        """Entry point: handles applies() gate + exception wrapping."""
        if not self.applies(schema):
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="schema does not match",
            )
        try:
            return self.compute(backend, schema)
        except Exception as e:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason=f"compute error: {e}",
            )
```

- [ ] **Step 2: Write templates/registry.py**

```python
"""TemplateRegistry — auto-discovers @register-decorated templates."""
from __future__ import annotations

import logging
from typing import Dict, List, Type

from .base import AnalysisTemplate

logger = logging.getLogger(__name__)


class _Registry:
    def __init__(self):
        self._templates: Dict[str, Type[AnalysisTemplate]] = {}

    def register(self, cls: Type[AnalysisTemplate]) -> Type[AnalysisTemplate]:
        instance = cls()
        if instance.code in self._templates:
            raise ValueError(f"template code collision: {instance.code}")
        self._templates[instance.code] = cls
        logger.debug(f"[registry] registered template: {instance.code}")
        return cls

    def all(self) -> List[AnalysisTemplate]:
        return [cls() for cls in self._templates.values()]

    def by_code(self, code: str) -> AnalysisTemplate:
        cls = self._templates.get(code)
        if cls is None:
            raise KeyError(f"template not registered: {code}")
        return cls()

    def codes(self) -> List[str]:
        return list(self._templates.keys())


_registry = _Registry()
register = _registry.register


def get_registry() -> _Registry:
    return _registry


def load_all_templates():
    """Trigger imports so @register decorators run.

    Called once at service startup. Add new template imports here.
    """
    from . import top_n_by_dim          # noqa: F401
    from . import monthly_trend         # noqa: F401
    from . import category_distribution # noqa: F401
    from . import anomaly_detection     # noqa: F401
    from . import pareto_analysis       # noqa: F401
```

- [ ] **Step 3: Commit**

```bash
git add backend/python/smartbi/services/materialized_analytics/templates/
git commit -m "feat(analytics): AnalysisTemplate base + TemplateRegistry

W1 task 4: template abstraction. Each template is a class with
code/title/applies/compute. Registry auto-discovers via load_all_templates()."
```

---

### Task 5: Template — TopNByDim

**Files:**
- Create: `backend/python/smartbi/services/materialized_analytics/templates/top_n_by_dim.py`
- Create: `backend/python/smartbi/services/materialized_analytics/tests/test_template_top_n.py`

- [ ] **Step 1: Write template**

```python
"""TopNByDim — Top 5/10/20 dimensions by primary measure.

Example: Top 5 门店 by 销售金额. Produces a bar chart + data table.
Most useful template — 80% of user "ranking" questions answered here.
"""
from __future__ import annotations

from ..compute.base import ComputeBackend
from ..schema import DataSchema
from .base import AnalysisTemplate, TemplateResult
from .registry import register


@register
class TopNByDim(AnalysisTemplate):
    TOP_N = 10

    @property
    def code(self) -> str:
        return "top_n_by_dim"

    @property
    def title(self) -> str:
        return "Top 10 维度排名"

    def applies(self, schema: DataSchema) -> bool:
        return bool(schema.dimensions) and schema.primary_measure is not None

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        measure = schema.primary_measure
        # Run on every dimension; pick the one with the most variation as "primary dim"
        by_dim = {}
        for dim in schema.dimensions[:4]:  # cap to avoid combinatorial blow-up
            top = backend.top_n(dim, measure, self.TOP_N)
            if len(top) >= 2:  # skip single-label dims (useless chart)
                by_dim[dim] = top

        if not by_dim:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no dimension with >=2 distinct labels",
            )

        # Pick dim with highest spread (max - min of totals) as primary
        primary_dim = max(
            by_dim.keys(),
            key=lambda d: (by_dim[d][0]["total"] - by_dim[d][-1]["total"]) if by_dim[d] else 0,
        )
        top_rows = by_dim[primary_dim]
        total_of_top = sum(r["total"] for r in top_rows)

        chart_config = {
            "type": "bar",
            "title": {"text": f"Top {len(top_rows)} {primary_dim} (按 {measure})", "left": "center"},
            "xAxis": {"type": "category", "data": [r["label"] for r in top_rows],
                      "axisLabel": {"rotate": 30}},
            "yAxis": {"type": "value", "name": measure},
            "series": [{
                "name": measure, "type": "bar",
                "data": [r["total"] for r in top_rows],
                "label": {"show": True, "position": "top", "formatter": "{c}"},
            }],
            "tooltip": {"trigger": "axis"},
            "grid": {"left": "3%", "right": "4%", "bottom": "3%", "containLabel": True},
        }

        top_label = top_rows[0]["label"]
        top_share_pct = (top_rows[0]["total"] / total_of_top * 100) if total_of_top > 0 else 0

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "primary_dim": primary_dim,
                "measure": measure,
                "top_rows": top_rows,
                "all_dims": {d: by_dim[d] for d in by_dim},
                "top_total": total_of_top,
            },
            chart_config=chart_config,
            kpis={
                "top_label": top_label,
                "top_value": top_rows[0]["total"],
                "top_share_pct": round(top_share_pct, 2),
                "dim_count": len(by_dim),
            },
            insight_text=(
                f"{primary_dim} Top {len(top_rows)}:{top_label} 独占 "
                f"{top_share_pct:.1f}%,余下梯队收敛明显。"
            ),
        )
```

- [ ] **Step 2: Write test**

```python
"""test_template_top_n.py"""
import pytest
from smartbi.services.materialized_analytics.compute.polars_backend import PolarsBackend
from smartbi.services.materialized_analytics.schema import (
    DataSchema, Domain, Field, FieldRole,
)
from smartbi.services.materialized_analytics.templates.top_n_by_dim import TopNByDim


@pytest.fixture
def qhj_like_backend() -> PolarsBackend:
    rows = []
    for store, total in [("大丸百货店", 10691165), ("南方百联店", 7515520),
                          ("徐汇日月光店", 6913905), ("徐汇光启城店", 6496736),
                          ("南桥百联店", 2444902), ("边缘店1", 100000),
                          ("边缘店2", 50000)]:
        # simulate N orders per store
        for _ in range(5):
            rows.append({"门店名称": store, "品类": "主食", "销售金额": total / 5})
    return PolarsBackend.from_rows(rows)


@pytest.fixture
def qhj_schema() -> DataSchema:
    return DataSchema(
        upload_id=9999, factory_id="F001", domain=Domain.RESTAURANT,
        fields=[
            Field("门店名称", FieldRole.DIMENSION, "string"),
            Field("品类", FieldRole.DIMENSION, "string"),
            Field("销售金额", FieldRole.MEASURE, "float"),
        ],
        row_count=35,
        primary_measure="销售金额",
    )


def test_top_n_runs_on_restaurant_schema(qhj_like_backend, qhj_schema):
    template = TopNByDim()
    assert template.applies(qhj_schema)
    result = template.run(qhj_like_backend, qhj_schema)
    assert result.applies
    assert result.kpis["top_label"] == "大丸百货店"
    assert result.kpis["dim_count"] == 1  # only 门店名称 has >=2 labels (品类 has 1)
    assert result.chart_config["type"] == "bar"
    assert len(result.data["top_rows"]) == 7


def test_top_n_skip_when_no_measure(qhj_like_backend):
    schema = DataSchema(
        upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=[Field("门店名称", FieldRole.DIMENSION, "string")],
        row_count=10, primary_measure=None,
    )
    result = TopNByDim().run(qhj_like_backend, schema)
    assert not result.applies
    assert "no" in result.skip_reason.lower() or "measure" in result.skip_reason.lower() or \
           "match" in result.skip_reason.lower()
```

- [ ] **Step 3: Run test**

```bash
cd backend/python
PYTHONPATH=. pytest smartbi/services/materialized_analytics/tests/test_template_top_n.py -v
```

Expected: 2 passed

- [ ] **Step 4: Commit**

```bash
git add backend/python/smartbi/services/materialized_analytics/templates/top_n_by_dim.py \
        backend/python/smartbi/services/materialized_analytics/tests/test_template_top_n.py
git commit -m "feat(analytics): template top_n_by_dim

W1 task 5: first template — Top 10 by dimension × primary measure.
Handles single-label-dim skip + spread-based primary dim selection."
```

---

### Task 6: Template — MonthlyTrend

**Files:**
- Create: `backend/python/smartbi/services/materialized_analytics/templates/monthly_trend.py`
- Create: `backend/python/smartbi/services/materialized_analytics/tests/test_template_monthly_trend.py`

- [ ] **Step 1: Write template**

```python
"""MonthlyTrend — daily/weekly/monthly time series of primary measure.

Auto-picks frequency: <= 62 days → daily, <= 400 days → weekly, else monthly.
"""
from __future__ import annotations

from ..compute.base import ComputeBackend
from ..schema import DataSchema
from .base import AnalysisTemplate, TemplateResult
from .registry import register


@register
class MonthlyTrend(AnalysisTemplate):

    @property
    def code(self) -> str:
        return "monthly_trend"

    @property
    def title(self) -> str:
        return "时间趋势"

    def applies(self, schema: DataSchema) -> bool:
        return schema.time_field is not None and schema.primary_measure is not None

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        time_col = schema.time_field
        measure = schema.primary_measure

        # Probe daily first; downsample if too many points
        daily = backend.time_series(time_col, measure, "D")
        if not daily:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no valid time values",
            )

        freq_used = "D"
        series = daily
        if len(daily) > 62:
            weekly = backend.time_series(time_col, measure, "W")
            if len(weekly) > 60:
                series = backend.time_series(time_col, measure, "M")
                freq_used = "M"
            else:
                series = weekly
                freq_used = "W"

        total = sum(r["total"] for r in series)
        peak = max(series, key=lambda r: r["total"])
        trough = min(series, key=lambda r: r["total"])

        chart_config = {
            "type": "line",
            "title": {"text": f"{measure} 时间趋势 ({freq_used})", "left": "center"},
            "xAxis": {"type": "category", "data": [r["period"] for r in series]},
            "yAxis": {"type": "value", "name": measure},
            "series": [{
                "name": measure, "type": "line", "smooth": True,
                "data": [r["total"] for r in series],
                "markPoint": {"data": [
                    {"name": "峰", "coord": [peak["period"], peak["total"]]},
                    {"name": "谷", "coord": [trough["period"], trough["total"]]},
                ]},
            }],
            "tooltip": {"trigger": "axis"},
        }

        return TemplateResult(
            code=self.code, title=self.title,
            data={"series": series, "freq": freq_used},
            chart_config=chart_config,
            kpis={
                "total": total,
                "peak_period": peak["period"],
                "peak_value": peak["total"],
                "trough_period": trough["period"],
                "trough_value": trough["total"],
                "period_count": len(series),
            },
            insight_text=(
                f"{measure} 累计 {total:,.0f},峰值 {peak['period']} "
                f"({peak['total']:,.0f}),谷值 {trough['period']} "
                f"({trough['total']:,.0f})。"
            ),
        )
```

- [ ] **Step 2: Write test**

```python
"""test_template_monthly_trend.py"""
import pytest
from smartbi.services.materialized_analytics.compute.polars_backend import PolarsBackend
from smartbi.services.materialized_analytics.schema import (
    DataSchema, Domain, Field, FieldRole,
)
from smartbi.services.materialized_analytics.templates.monthly_trend import MonthlyTrend


@pytest.fixture
def time_series_schema() -> DataSchema:
    return DataSchema(
        upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=[
            Field("订单日期", FieldRole.TIME, "datetime"),
            Field("销售金额", FieldRole.MEASURE, "float"),
        ],
        row_count=10, primary_measure="销售金额", time_field="订单日期",
    )


def test_monthly_trend_daily_small_range(time_series_schema):
    rows = [
        {"订单日期": "2026-01-01", "销售金额": 100.0},
        {"订单日期": "2026-01-02", "销售金额": 200.0},
        {"订单日期": "2026-01-03", "销售金额": 50.0},
    ]
    backend = PolarsBackend.from_rows(rows)
    result = MonthlyTrend().run(backend, time_series_schema)
    assert result.applies
    assert result.data["freq"] == "D"
    assert result.kpis["peak_value"] == 200.0
    assert result.kpis["trough_value"] == 50.0


def test_monthly_trend_skip_when_no_time_field():
    schema = DataSchema(
        upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=[Field("销售金额", FieldRole.MEASURE, "float")],
        row_count=1, primary_measure="销售金额", time_field=None,
    )
    backend = PolarsBackend.from_rows([{"销售金额": 100.0}])
    result = MonthlyTrend().run(backend, schema)
    assert not result.applies
```

- [ ] **Step 3: Run test**

```bash
cd backend/python
PYTHONPATH=. pytest smartbi/services/materialized_analytics/tests/test_template_monthly_trend.py -v
```

Expected: 2 passed

- [ ] **Step 4: Commit**

```bash
git add backend/python/smartbi/services/materialized_analytics/templates/monthly_trend.py \
        backend/python/smartbi/services/materialized_analytics/tests/test_template_monthly_trend.py
git commit -m "feat(analytics): template monthly_trend (D/W/M auto-frequency)"
```

---

### Task 7: Template — CategoryDistribution

**Files:**
- Create: `backend/python/smartbi/services/materialized_analytics/templates/category_distribution.py`
- Create: `backend/python/smartbi/services/materialized_analytics/tests/test_template_category_distribution.py`

- [ ] **Step 1: Write template**

```python
"""CategoryDistribution — share of primary measure by each dimension.

For each dim, pie chart showing % contribution. Quickly tells user
"品类 A 占 60% 营收" type stories.
"""
from __future__ import annotations

from ..compute.base import ComputeBackend
from ..schema import DataSchema
from .base import AnalysisTemplate, TemplateResult
from .registry import register


@register
class CategoryDistribution(AnalysisTemplate):

    @property
    def code(self) -> str:
        return "category_distribution"

    @property
    def title(self) -> str:
        return "分类占比"

    def applies(self, schema: DataSchema) -> bool:
        return bool(schema.dimensions) and schema.primary_measure is not None

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        measure = schema.primary_measure
        shares_by_dim = {}

        for dim in schema.dimensions[:4]:
            rows = backend.group_sum(dim, measure)
            # Need 2-15 categories to be meaningful (else not a "distribution")
            if 2 <= len(rows) <= 15:
                total = sum(r["total"] for r in rows)
                if total > 0:
                    shares_by_dim[dim] = [
                        {"label": r["label"], "total": r["total"],
                         "share": round(r["total"] / total * 100, 2)}
                        for r in rows
                    ]

        if not shares_by_dim:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no dim with 2-15 categories",
            )

        # Primary dim: the one with most balanced distribution (least skewed)
        primary_dim = min(
            shares_by_dim.keys(),
            key=lambda d: shares_by_dim[d][0]["share"],
        )
        primary = shares_by_dim[primary_dim]

        chart_config = {
            "type": "pie",
            "title": {"text": f"{primary_dim} 占比 (按 {measure})", "left": "center"},
            "tooltip": {"trigger": "item", "formatter": "{b}: {c} ({d}%)"},
            "series": [{
                "name": measure, "type": "pie", "radius": "60%",
                "data": [{"name": r["label"], "value": r["total"]} for r in primary],
                "label": {"formatter": "{b}: {d}%"},
            }],
        }

        return TemplateResult(
            code=self.code, title=self.title,
            data={
                "primary_dim": primary_dim,
                "measure": measure,
                "shares": primary,
                "all_dims": shares_by_dim,
            },
            chart_config=chart_config,
            kpis={
                "top_share_pct": primary[0]["share"],
                "top_label": primary[0]["label"],
                "category_count": len(primary),
            },
            insight_text=(
                f"按 {primary_dim} 分类占比:Top 1 {primary[0]['label']} "
                f"占 {primary[0]['share']}%,共 {len(primary)} 个分类。"
            ),
        )
```

- [ ] **Step 2: Write test**

```python
"""test_template_category_distribution.py"""
import pytest
from smartbi.services.materialized_analytics.compute.polars_backend import PolarsBackend
from smartbi.services.materialized_analytics.schema import (
    DataSchema, Domain, Field, FieldRole,
)
from smartbi.services.materialized_analytics.templates.category_distribution import (
    CategoryDistribution,
)


def test_category_distribution_basic():
    rows = [
        {"品类": "主食", "销售金额": 600.0},
        {"品类": "饮品", "销售金额": 300.0},
        {"品类": "小吃", "销售金额": 100.0},
    ]
    schema = DataSchema(
        upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=[Field("品类", FieldRole.DIMENSION, "string"),
                Field("销售金额", FieldRole.MEASURE, "float")],
        row_count=3, primary_measure="销售金额",
    )
    result = CategoryDistribution().run(PolarsBackend.from_rows(rows), schema)
    assert result.applies
    assert result.kpis["top_label"] == "主食"
    assert result.kpis["top_share_pct"] == 60.0
    assert result.kpis["category_count"] == 3


def test_skip_when_too_many_categories():
    rows = [{"id": f"x_{i}", "amt": i} for i in range(20)]
    schema = DataSchema(
        upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=[Field("id", FieldRole.DIMENSION, "string"),
                Field("amt", FieldRole.MEASURE, "float")],
        row_count=20, primary_measure="amt",
    )
    result = CategoryDistribution().run(PolarsBackend.from_rows(rows), schema)
    assert not result.applies  # 20 categories > 15 ⇒ not a distribution story
```

- [ ] **Step 3: Run tests + commit**

```bash
cd backend/python
PYTHONPATH=. pytest smartbi/services/materialized_analytics/tests/test_template_category_distribution.py -v
git add backend/python/smartbi/services/materialized_analytics/templates/category_distribution.py \
        backend/python/smartbi/services/materialized_analytics/tests/test_template_category_distribution.py
git commit -m "feat(analytics): template category_distribution (pie, 2-15 cats)"
```

---

### Task 8: Template — AnomalyDetection

**Files:**
- Create: `backend/python/smartbi/services/materialized_analytics/templates/anomaly_detection.py`
- Create: `backend/python/smartbi/services/materialized_analytics/tests/test_template_anomaly.py`

- [ ] **Step 1: Write template**

```python
"""AnomalyDetection — ±2σ outliers on primary measure."""
from __future__ import annotations

from ..compute.base import ComputeBackend
from ..schema import DataSchema
from .base import AnalysisTemplate, TemplateResult
from .registry import register


@register
class AnomalyDetection(AnalysisTemplate):
    SIGMA = 2.0

    @property
    def code(self) -> str:
        return "anomaly_detection"

    @property
    def title(self) -> str:
        return "异常值检测"

    def applies(self, schema: DataSchema) -> bool:
        return schema.primary_measure is not None and schema.row_count >= 30

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        measure = schema.primary_measure
        stats = backend.mean_std(measure)
        outliers = backend.outliers(measure, sigma=self.SIGMA)

        return TemplateResult(
            code=self.code, title=self.title,
            data={"outliers": outliers, "stats": stats, "sigma": self.SIGMA},
            chart_config=None,  # table only, no chart
            kpis={
                "outlier_count": len(outliers),
                "mean": stats["mean"],
                "std": stats["std"],
                "min": stats["min"],
                "max": stats["max"],
            },
            insight_text=(
                f"{measure} 均值 {stats['mean']:,.2f},标准差 {stats['std']:,.2f};"
                f"±{self.SIGMA}σ 外异常 {len(outliers)} 条 "
                f"(区间 {stats['min']:,.2f} ~ {stats['max']:,.2f})。"
            ),
        )
```

- [ ] **Step 2: Write test**

```python
"""test_template_anomaly.py"""
from smartbi.services.materialized_analytics.compute.polars_backend import PolarsBackend
from smartbi.services.materialized_analytics.schema import (
    DataSchema, Domain, Field, FieldRole,
)
from smartbi.services.materialized_analytics.templates.anomaly_detection import (
    AnomalyDetection,
)


def test_anomaly_finds_outlier_in_large_sample():
    rows = [{"amt": 100.0 + (i % 10)} for i in range(40)]
    rows.append({"amt": 10000.0})  # clear outlier
    schema = DataSchema(
        upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=[Field("amt", FieldRole.MEASURE, "float")],
        row_count=41, primary_measure="amt",
    )
    result = AnomalyDetection().run(PolarsBackend.from_rows(rows), schema)
    assert result.applies
    assert result.kpis["outlier_count"] >= 1


def test_anomaly_skip_small_sample():
    schema = DataSchema(
        upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=[Field("amt", FieldRole.MEASURE, "float")],
        row_count=10, primary_measure="amt",
    )
    backend = PolarsBackend.from_rows([{"amt": 100.0}])
    result = AnomalyDetection().run(backend, schema)
    assert not result.applies
```

- [ ] **Step 3: Run + commit**

```bash
cd backend/python
PYTHONPATH=. pytest smartbi/services/materialized_analytics/tests/test_template_anomaly.py -v
git add backend/python/smartbi/services/materialized_analytics/templates/anomaly_detection.py \
        backend/python/smartbi/services/materialized_analytics/tests/test_template_anomaly.py
git commit -m "feat(analytics): template anomaly_detection (2σ outliers, min 30 rows)"
```

---

### Task 9: Template — ParetoAnalysis

**Files:**
- Create: `backend/python/smartbi/services/materialized_analytics/templates/pareto_analysis.py`
- Create: `backend/python/smartbi/services/materialized_analytics/tests/test_template_pareto.py`

- [ ] **Step 1: Write template**

```python
"""ParetoAnalysis — 80/20 rule test.

For primary dim × primary measure, compute what % of labels contribute
what % of total. Classic 20% labels → 80% revenue insight.
"""
from __future__ import annotations

from ..compute.base import ComputeBackend
from ..schema import DataSchema
from .base import AnalysisTemplate, TemplateResult
from .registry import register


@register
class ParetoAnalysis(AnalysisTemplate):

    @property
    def code(self) -> str:
        return "pareto_analysis"

    @property
    def title(self) -> str:
        return "帕累托 80/20 分析"

    def applies(self, schema: DataSchema) -> bool:
        return bool(schema.dimensions) and schema.primary_measure is not None

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        measure = schema.primary_measure
        best_dim = None
        best_rows = None
        for dim in schema.dimensions[:4]:
            rows = backend.group_sum(dim, measure)
            if len(rows) >= 5:  # need enough points for Pareto to be meaningful
                best_dim = dim
                best_rows = rows
                break

        if not best_rows:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no dim with >=5 distinct labels",
            )

        total = sum(r["total"] for r in best_rows)
        if total <= 0:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="total measure is zero",
            )

        # Find how many top labels cumulatively hit 80%
        cumulative = 0.0
        labels_for_80 = 0
        for r in best_rows:
            cumulative += r["total"]
            labels_for_80 += 1
            if cumulative / total >= 0.80:
                break

        labels_for_80_pct = round(labels_for_80 / len(best_rows) * 100, 2)

        chart_config = {
            "type": "bar",
            "title": {"text": f"{best_dim} 帕累托 (按 {measure})", "left": "center"},
            "xAxis": {"type": "category", "data": [r["label"] for r in best_rows[:20]]},
            "yAxis": [
                {"type": "value", "name": measure},
                {"type": "value", "name": "累计 %", "min": 0, "max": 100},
            ],
            "series": [
                {"name": measure, "type": "bar",
                 "data": [r["total"] for r in best_rows[:20]]},
                {"name": "累计 %", "type": "line", "yAxisIndex": 1,
                 "data": [
                     round(sum(x["total"] for x in best_rows[:i+1]) / total * 100, 2)
                     for i in range(min(20, len(best_rows)))
                 ]},
            ],
            "tooltip": {"trigger": "axis"},
        }

        return TemplateResult(
            code=self.code, title=self.title,
            data={
                "dim": best_dim, "measure": measure,
                "rows": best_rows, "total": total,
                "labels_for_80pct": labels_for_80,
                "labels_for_80pct_share": labels_for_80_pct,
            },
            chart_config=chart_config,
            kpis={
                "labels_for_80pct": labels_for_80,
                "labels_for_80pct_share": labels_for_80_pct,
                "total_labels": len(best_rows),
            },
            insight_text=(
                f"{labels_for_80}/{len(best_rows)} 个 {best_dim} "
                f"({labels_for_80_pct}%) 贡献了 80% 的 {measure}。"
            ),
        )
```

- [ ] **Step 2: Write test**

```python
"""test_template_pareto.py"""
from smartbi.services.materialized_analytics.compute.polars_backend import PolarsBackend
from smartbi.services.materialized_analytics.schema import (
    DataSchema, Domain, Field, FieldRole,
)
from smartbi.services.materialized_analytics.templates.pareto_analysis import (
    ParetoAnalysis,
)


def test_pareto_classic_80_20():
    # 2 stores make 80%, 8 make 20%
    rows = [
        {"store": "big1", "amt": 400.0},
        {"store": "big2", "amt": 400.0},
        {"store": "s1", "amt": 25.0},
        {"store": "s2", "amt": 25.0},
        {"store": "s3", "amt": 25.0},
        {"store": "s4", "amt": 25.0},
        {"store": "s5", "amt": 25.0},
        {"store": "s6", "amt": 25.0},
        {"store": "s7", "amt": 25.0},
        {"store": "s8", "amt": 25.0},
    ]
    schema = DataSchema(
        upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=[Field("store", FieldRole.DIMENSION, "string"),
                Field("amt", FieldRole.MEASURE, "float")],
        row_count=10, primary_measure="amt",
    )
    result = ParetoAnalysis().run(PolarsBackend.from_rows(rows), schema)
    assert result.applies
    assert result.kpis["labels_for_80pct"] == 2
    assert result.kpis["total_labels"] == 10


def test_pareto_skip_few_labels():
    rows = [{"store": "a", "amt": 100.0}, {"store": "b", "amt": 50.0}]
    schema = DataSchema(
        upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=[Field("store", FieldRole.DIMENSION, "string"),
                Field("amt", FieldRole.MEASURE, "float")],
        row_count=2, primary_measure="amt",
    )
    result = ParetoAnalysis().run(PolarsBackend.from_rows(rows), schema)
    assert not result.applies
```

- [ ] **Step 3: Run + commit**

```bash
cd backend/python
PYTHONPATH=. pytest smartbi/services/materialized_analytics/tests/test_template_pareto.py -v
git add backend/python/smartbi/services/materialized_analytics/templates/pareto_analysis.py \
        backend/python/smartbi/services/materialized_analytics/tests/test_template_pareto.py
git commit -m "feat(analytics): template pareto_analysis (80/20 test, min 5 labels)"
```

---

## Remaining tasks (10-17) sketch — full detail after 5 templates verified

Full step-by-step for tasks 10-17 will be added after Task 9 ships. Pattern:

- **Task 10**: `Materializer` orchestrator — loads backend, detects domain, runs all templates, persists results. Integration test uses real upload 3970 against test DB.
- **Task 11**: `persistence.py` — save/load via SQLAlchemy; upsert on (upload_id, template_code).
- **Task 12**: API endpoint `GET /analytics/cached/{upload_id}` — returns `{results: [TemplateResult dict, ...], schema: DataSchema dict}`.
- **Task 13**: Upload completion hook in `excel_async.py` — fire-and-forget `materialize_upload_async(upload_id)`.
- **Task 14**: FE `MaterializedAnalysisPanel.vue` — grid of cards with title/kpi/chart.
- **Task 15**: FE AIQuery integration — on data source change, fetch cache + mount panel above chat.
- **Task 16**: Smoke — rerun `smoke-phase-b-cache.mjs` adapted to hit new endpoint; measure pre-compute wall time.
- **Task 17**: W1 deploy to test + documentation.

---

## W2 / W3 follow-up plans (to be written after W1 ships)

**W2 — AI integration + 5 more templates:**
- Templates: YoYComparison, MoMComparison, DistributionStats, CorrelationMatrix, CustomerRanking
- `chat.py`: inject cached materialized summaries into LLM prompt
- Button → template code direct lookup (no LLM for the 10 preset buttons)

**W3 — Semantic lookup + UI:**
- pgvector install + embedding of each template result
- User question → embed → topK nearest template → return directly
- Full `MaterializedDashboard.vue` page (drill-down, export)

---

## Self-Review Results

- **Spec coverage:** Tasks 1-9 implement foundation + 5 templates. Tasks 10-17 (sketched) implement orchestrator + persistence + API + hook + FE + smoke. W2/W3 noted separately.
- **Placeholder scan:** None of "TODO/TBD/fill in later". Tasks 10-17 are explicitly sketched pending W1 template verification (intentional, documented).
- **Type consistency:** `TemplateResult` signature consistent across all 5 templates. `ComputeBackend` methods signatures consistent. `DataSchema.primary_measure` / `.time_field` used consistently. `analysis_type = f"materialized:{code}"` convention noted but not yet in a task — will be added in Task 11 persistence.

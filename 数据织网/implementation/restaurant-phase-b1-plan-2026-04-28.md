# Restaurant Phase B-1 Outlier Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 餐饮 dashboard outlier filter — admin 在已有 `/restaurant/data-completeness` 页加 "数据质量" tab 看 4 cost 信号 IQR outliers, 支持 dismiss + un-dismiss + 跨工厂隔离。后端独立 outlier service 让 B-3 dashboard / 上传图表后续可复用。

**Architecture:** Python `OutlierService` 跑 IQR (1.5×fence) on `agg_restaurant_daily_totals` 30 天滚动窗口, 本工厂 N<10 fallback 全网 baseline (PostgreSQL `SECURITY DEFINER` function 防止暴露明细)。FE Vue `data-quality-tab.vue` 嵌入完整度页, 必须 render `baselineSource` 灰色 badge (透明标记 fallback 来源)。dismissals 表完整 schema 预留 reason / expires / snapshot 列 (UI 第一版不展示, migration 永远比加列贵)。算法库 `outlier_stats.py` 同时 export `iqr() + zscore() + OutlierAlgorithm` dataclass 让 chat AnomalyDetection 后续切迁源头消除数字打架问题。

**Tech Stack:** FastAPI (Python) + asyncpg + PostgreSQL (smartbi_db) + Vue 3 + Element Plus + pythonFetch + pytest + vitest + Playwright

**Spec:** `数据织网/implementation/restaurant-phase-b1-outlier-filter-2026-04-28-design.md` (long-term-audited 5/5 after R1-R5 fixes)

---

## Implementation Constraints (subagent must read)

每次 subagent dispatch 时, prompt 必须明确传递这 5 条:

1. ⚠️ **RLS GUC + transaction 强制** (W0.4 finding 3): query `agg_restaurant_daily_totals` / `outlier_dismissals` 必须:
   ```python
   async with pool.acquire() as conn:
       async with conn.transaction():       # ← 不能省, 否则 set_config auto-commit wipe GUC, RLS 静默 0 rows
           await conn.execute(
               "SELECT set_config('app.factory_id', $1, true)", factory_id
           )
           rows = await conn.fetch(...)
   ```

2. ⚠️ **SECURITY DEFINER function 不需要 GUC** — 它本身 bypass RLS, 在调用前 SET app.factory_id 反而会让 function 内部聚合被 GUC 限制 → 严重 bug。直接 `await conn.fetchrow("SELECT ... FROM get_global_kpi_stats($1, $2)", ...)`。

3. ⚠️ **所有 commit 用** `bash scripts/safe-commit.sh "msg" file1 file2 ...` (rule 5b)。不要 `git add F1 F2 && git commit -m "msg"` — 会吞并发 session 文件。

4. ⚠️ **测试在 test env (8084 + 8097)**, 不部 prod (8083 + 8086) 除非用户 explicit 授权。

5. ⚠️ **复用 Phase A pattern**, 不重新实现:
   - Pool: `from smartbi.config import get_pg_pool` (singleton)
   - Admin auth: `from smartbi.canonical.provenance._admin_auth import require_admin`
   - Cross-factory check: 复用 `data_quality_queue_admin.py` 的 Quick-Win 3 pattern
   - FE: `pythonFetch` from `@/utils/python-fetch`, 不用 axios
   - Cache: in-memory dict 5min, 跟 `restaurant_completeness.py` 一致

---

## File Structure

### Files Created (11)

| Path | Purpose | LOC |
|---|---|---|
| `backend/python/smartbi/database/migrations/V20260502_06__outlier_dismissals.sql` | dismissal 表 schema (RLS FORCE) | ~50 |
| `backend/python/smartbi/database/migrations/V20260502_07__get_global_kpi_stats_fn.sql` | SECURITY DEFINER function (round n bucket) | ~70 |
| `backend/python/smartbi/utils/outlier_stats.py` | iqr + zscore + OutlierAlgorithm dataclass (共享 utils) | ~120 |
| `backend/python/smartbi/services/outlier_service.py` | 业务逻辑: detect_totals + 2 级 fallback | ~280 |
| `backend/python/smartbi/api/restaurant_outliers.py` | 3 endpoints (GET / POST dismiss / DELETE undismiss) + cache | ~330 |
| `backend/python/tests/test_outlier_stats.py` | utils 单测 | ~120 |
| `backend/python/tests/test_outlier_service.py` | service 层 (mock pool) | ~180 |
| `backend/python/tests/test_restaurant_outliers_api.py` | API 层 (mock service) | ~200 |
| `web-admin/src/api/restaurant/outliers.ts` | 3 API 客户端 + types | ~80 |
| `web-admin/src/views/restaurant/data-quality-tab.vue` | tab 内 outliers 表格 + dismiss/undismiss | ~280 |
| `web-admin/src/views/restaurant/__tests__/data-quality-tab.spec.ts` | vitest | ~150 |

### Files Modified (3)

| Path | Changes | LOC |
|---|---|---|
| `backend/python/main.py` | 注册 outliers router | +2 |
| `web-admin/src/views/restaurant/data-completeness.vue` | 包进 `<el-tabs>`, 加 "数据质量" tab 引用新组件 | +60 |
| `web-admin/data-fabric-c-smoke-e2e.spec.ts` | 加 1 个 B-1 smoke test | +40 |

**Total**: ~1700 lines (new) + ~100 lines (modified) ≈ 1800 lines

---

## Task Order Summary

| # | Task | 主要文件 | 依赖 |
|---|---|---|---|
| 1 | Migration `outlier_dismissals` | `V20260502_06__*.sql` | — |
| 2 | Migration `get_global_kpi_stats` fn | `V20260502_07__*.sql` | — |
| 3 | Utils `outlier_stats.py` (TDD) | `utils/outlier_stats.py` + test | — |
| 4 | Service `outlier_service.py` (TDD) | `services/outlier_service.py` + test | Task 3 |
| 5 | API GET endpoint (TDD) | `api/restaurant_outliers.py` + test | Task 4 |
| 6 | API dismiss + undismiss endpoints (TDD) | `api/restaurant_outliers.py` (extend) + test | Task 5 |
| 7 | Register router in main.py | `main.py` | Task 5 |
| 8 | FE API client | `api/restaurant/outliers.ts` | — (parallel with backend) |
| 9 | FE component `data-quality-tab.vue` (TDD) | `views/restaurant/data-quality-tab.vue` + spec | Task 8 |
| 10 | FE refactor `data-completeness.vue` 加 tabs | `views/restaurant/data-completeness.vue` | Task 9 |
| 11 | Smoke E2E + deploy + 真窗 verify | `data-fabric-c-smoke-e2e.spec.ts` + manual | Tasks 1-10 |

**Parallel paths**: Tasks 1-2 (migrations) 可与 Task 3 (utils) 并行。Task 8 (FE API client) 可与 Tasks 1-7 (backend) 并行。

---

## Section 1: Database Migrations

### Task 1: Migration `V20260502_06__outlier_dismissals.sql`

**Files:**
- Create: `backend/python/smartbi/database/migrations/V20260502_06__outlier_dismissals.sql`

- [ ] **Step 1: Create migration file**

Content (copy verbatim from spec §3.2). Key requirements:
- 13 columns: `id` BIGSERIAL PK, `factory_id` VARCHAR(50) NOT NULL, `anomaly_date` DATE NOT NULL, `kpi_kind` VARCHAR(50) NOT NULL, `dismissed_by` VARCHAR(50) NOT NULL, `dismissed_at` TIMESTAMPTZ NOT NULL DEFAULT NOW(), 然后 7 列预留 (reason / expires_at / snapshot_value / snapshot_q1 / snapshot_q3 / snapshot_baseline_source / notes)
- ENABLE + FORCE ROW LEVEL SECURITY
- POLICY `tenant_isolation` USING `factory_id = current_setting('app.factory_id', true)` WITH CHECK 同
- INDEX `idx_outlier_dismissals_factory_kpi` ON (factory_id, kpi_kind, anomaly_date DESC)
- INDEX `idx_outlier_dismissals_active` ON (factory_id, kpi_kind) WHERE expires_at IS NULL OR expires_at > NOW()
- UNIQUE (factory_id, anomaly_date, kpi_kind)
- COMMENTs on table + reason/expires_at/snapshot_value 列 (说明第一版 NULL, B-N 启用)

完整 SQL 在 spec 文件 `数据织网/implementation/restaurant-phase-b1-outlier-filter-2026-04-28-design.md` §3.2.

- [ ] **Step 2: Apply to test smartbi_db**

```bash
scp backend/python/smartbi/database/migrations/V20260502_06__outlier_dismissals.sql root@47.100.235.168:/tmp/
ssh root@47.100.235.168 "PGPASSWORD=smartbi_secure_password_2025 psql -h localhost -U smartbi -d smartbi_db -f /tmp/V20260502_06__outlier_dismissals.sql"
```

Expected output: `CREATE TABLE`, `ALTER TABLE` (×2), `CREATE POLICY`, `CREATE INDEX` (×2), 4 `COMMENT` statements.

- [ ] **Step 3: Verify schema**

```bash
ssh root@47.100.235.168 "PGPASSWORD=smartbi_secure_password_2025 psql -h localhost -U smartbi -d smartbi_db -c '\d outlier_dismissals'"
```

Expected: 13 columns visible, "Policies (forced row security enabled)" line, 2 indexes, 1 UNIQUE constraint.

- [ ] **Step 4: Verify RLS works (positive test)**

```bash
ssh root@47.100.235.168 "PGPASSWORD=smartbi_secure_password_2025 psql -h localhost -U smartbi -d smartbi_db -v ON_ERROR_STOP=1 << 'SQL'
BEGIN;
SELECT set_config('app.factory_id', 'F002', true);
INSERT INTO outlier_dismissals (factory_id, anomaly_date, kpi_kind, dismissed_by, snapshot_value, snapshot_q1, snapshot_q3, snapshot_baseline_source) VALUES ('F002', '2026-04-25', 'wastage_cost_total', 'test_admin', 8500, 1200, 3400, 'self');
SELECT factory_id, anomaly_date, kpi_kind FROM outlier_dismissals;
ROLLBACK;
SQL"
```

Expected: INSERT succeeds, SELECT returns 1 row with F002, then ROLLBACK undoes (no permanent test data).

- [ ] **Step 5: Verify cross-tenant blocked**

```bash
ssh root@47.100.235.168 "PGPASSWORD=smartbi_secure_password_2025 psql -h localhost -U smartbi -d smartbi_db -v ON_ERROR_STOP=1 << 'SQL'
BEGIN;
SELECT set_config('app.factory_id', 'F002', true);
INSERT INTO outlier_dismissals (factory_id, anomaly_date, kpi_kind, dismissed_by, snapshot_value, snapshot_q1, snapshot_q3, snapshot_baseline_source) VALUES ('F002', '2026-04-26', 'wastage_cost_total', 'test_admin', 8500, 1200, 3400, 'self');
SELECT set_config('app.factory_id', 'F001', true);
SELECT COUNT(*) FROM outlier_dismissals;
ROLLBACK;
SQL"
```

Expected: COUNT = 0 (F001 GUC blocks F002 row even within same transaction).

- [ ] **Step 6: Commit**

```bash
bash scripts/safe-commit.sh "feat(餐饮 Phase B-1): outlier_dismissals migration V20260502_06 (full schema + RLS FORCE)" backend/python/smartbi/database/migrations/V20260502_06__outlier_dismissals.sql
```

---

### Task 2: Migration `V20260502_07__get_global_kpi_stats_fn.sql`

**Files:**
- Create: `backend/python/smartbi/database/migrations/V20260502_07__get_global_kpi_stats_fn.sql`

- [ ] **Step 1: Create migration file**

Content from spec §3.3. Key requirements:
- `CREATE OR REPLACE FUNCTION get_global_kpi_stats(p_kpi_kind VARCHAR, p_window_days INT DEFAULT 30)`
- RETURNS TABLE (q1 NUMERIC, q3 NUMERIC, median NUMERIC, n_bucket VARCHAR)
- LANGUAGE plpgsql, SECURITY DEFINER, SET search_path = public
- 校验白名单 4 个 kpi_kind, 越界抛 RAISE EXCEPTION
- 校验 window_days in [1, 365]
- 用 `format()` + `EXECUTE ... USING` 动态拼 SELECT (kpi_kind 已校验白名单)
- PERCENTILE_CONT(0.25/0.5/0.75) WITHIN GROUP (ORDER BY <col>)
- n_bucket: CASE COUNT FILTER → '<10' / '10-49' / '50-99' / '100-499' / '500+'
- COMMENT ON FUNCTION (说明唯一调用方 + bucket 用途)
- REVOKE ALL FROM PUBLIC, GRANT EXECUTE TO smartbi (实际 db user, 部署前 verify role 名)

完整 SQL 在 spec 文件 §3.3。

- [ ] **Step 2: Verify smartbi role 名 (避免 GRANT 失败)**

```bash
ssh root@47.100.235.168 "PGPASSWORD=smartbi_secure_password_2025 psql -h localhost -U smartbi -d smartbi_db -c '\du'"
```

如果 `smartbi` role 不存在, 用实际 owner role 替换 GRANT 语句的 target。

- [ ] **Step 3: Apply to test smartbi_db**

```bash
scp backend/python/smartbi/database/migrations/V20260502_07__get_global_kpi_stats_fn.sql root@47.100.235.168:/tmp/
ssh root@47.100.235.168 "PGPASSWORD=smartbi_secure_password_2025 psql -h localhost -U smartbi -d smartbi_db -f /tmp/V20260502_07__get_global_kpi_stats_fn.sql"
```

Expected: `CREATE FUNCTION`, `COMMENT`, `REVOKE`, `GRANT`.

- [ ] **Step 4: Verify function works (positive case)**

```bash
ssh root@47.100.235.168 "PGPASSWORD=smartbi_secure_password_2025 psql -h localhost -U smartbi -d smartbi_db -c \"SELECT * FROM get_global_kpi_stats('wastage_cost_total', 30);\""
```

Expected: 1 row with q1, q3, median, n_bucket. n_bucket 可能是 `<10` 如果 test smartbi_db agg_restaurant_daily_totals 数据少, 这是 OK 的 (function 工作正常)。

- [ ] **Step 5: Verify input validation (negative cases)**

```bash
ssh root@47.100.235.168 "PGPASSWORD=smartbi_secure_password_2025 psql -h localhost -U smartbi -d smartbi_db -c \"SELECT * FROM get_global_kpi_stats('invalid_kpi', 30);\" 2>&1"
```

Expected: `ERROR: Invalid kpi_kind: invalid_kpi`.

```bash
ssh root@47.100.235.168 "PGPASSWORD=smartbi_secure_password_2025 psql -h localhost -U smartbi -d smartbi_db -c \"SELECT * FROM get_global_kpi_stats('wastage_cost_total', 500);\" 2>&1"
```

Expected: `ERROR: window_days out of range: 500`.

- [ ] **Step 6: Commit**

```bash
bash scripts/safe-commit.sh "feat(餐饮 Phase B-1): get_global_kpi_stats SECURITY DEFINER function (round n bucket防规模反推)" backend/python/smartbi/database/migrations/V20260502_07__get_global_kpi_stats_fn.sql
```

---

## Section 2: Backend Utils (algorithm library, TDD)

### Task 3: `outlier_stats.py` utils + tests

**Files:**
- Create: `backend/python/smartbi/utils/outlier_stats.py`
- Test: `backend/python/tests/test_outlier_stats.py`

**Why TDD here matters**: 这是共享算法库, AnomalyDetection 后续会迁; 数字一致性是 long-term-audit Reviewer R3 关键。先写测试锁住行为。

- [ ] **Step 1: Create test file with failing tests**

Create `backend/python/tests/test_outlier_stats.py`:

```python
"""Tests for outlier_stats — shared IQR/zscore algorithm utils (Phase B-1)."""
from __future__ import annotations
import pytest

from smartbi.utils.outlier_stats import (
    iqr_fence, find_outliers_iqr, zscore_outliers,
    OutlierAlgorithm, IQRFence, Outlier,
)


class TestIQRFence:
    def test_normal_distribution(self):
        # 50 samples roughly N(100, 10)
        values = [80, 85, 90, 92, 95, 95, 98, 100, 100, 100,
                  100, 100, 100, 102, 105, 105, 108, 110, 115, 120,
                  82, 87, 91, 93, 96, 96, 99, 100, 101, 101,
                  101, 101, 101, 103, 106, 106, 109, 111, 116, 121,
                  84, 88, 92, 94, 97, 97, 100, 102, 105, 119]
        fence = iqr_fence(values, multiplier=1.5)
        assert fence is not None
        # Q1 ≈ 95, Q3 ≈ 106, IQR ≈ 11, lower ≈ 78, upper ≈ 123
        assert fence.lower == pytest.approx(78, rel=0.05)
        assert fence.upper == pytest.approx(123, rel=0.05)

    def test_right_skewed_restaurant_cost(self):
        # 模拟餐饮 wastage cost: 大部分 200-800, 5 个节假日 5000+
        values = [200, 250, 300, 350, 400, 450, 500, 550, 600, 650,
                  700, 750, 800, 5000, 5500, 6000, 6500, 7000]
        fence = iqr_fence(values, multiplier=1.5)
        assert fence is not None
        # IQR fence 不被节假日单点拉跑 — Q3 应在合理范围 (~1000-2000), upper 不会 > 10000
        assert fence.upper < 10000, "IQR upper fence 被极值拉跑了"

    def test_returns_none_for_small_sample(self):
        assert iqr_fence([1.0, 2.0, 3.0]) is None  # N=3 < 4
        assert iqr_fence([]) is None
        assert iqr_fence([1.0]) is None


class TestFindOutliersIQR:
    def test_finds_outliers_above_and_below(self):
        # 30 个正常值 100-110 + 1 个高异常 + 1 个低异常
        values = list(range(100, 130)) + [200.0, 50.0]
        fence = iqr_fence(values, multiplier=1.5)
        outliers = find_outliers_iqr(values, fence)
        # 应该找到 200 (above) + 50 (below)
        outlier_values = {o.value for o in outliers}
        assert 200.0 in outlier_values
        assert 50.0 in outlier_values
        directions = {o.direction for o in outliers}
        assert 'above' in directions
        assert 'below' in directions

    def test_no_outliers_in_uniform_data(self):
        values = [100.0] * 30
        fence = iqr_fence(values, multiplier=1.5)
        # 全相同值, IQR=0, 任何值都不会越界 (== upper, 不 > upper)
        outliers = find_outliers_iqr(values, fence)
        assert len(outliers) == 0


class TestZscoreOutliers:
    def test_zscore_finds_extreme_value(self):
        # 30 个 N(100, 5) 样本 + 1 个 5σ 异常 = 125
        values = [100.0] * 30 + [125.0]
        outliers = zscore_outliers(values, sigma=2.0)
        assert any(o.value == 125.0 for o in outliers)

    def test_zscore_returns_empty_for_zero_std(self):
        values = [100.0] * 10
        outliers = zscore_outliers(values, sigma=2.0)
        assert outliers == []


class TestOutlierAlgorithm:
    def test_iqr_algorithm_dataclass(self):
        values = list(range(100, 130)) + [200.0]
        algo = OutlierAlgorithm(name='iqr', threshold=1.5)
        outliers = algo.detect(values)
        assert any(o.value == 200.0 for o in outliers)

    def test_zscore_algorithm_dataclass(self):
        values = [100.0] * 30 + [125.0]
        algo = OutlierAlgorithm(name='zscore', threshold=2.0)
        outliers = algo.detect(values)
        assert any(o.value == 125.0 for o in outliers)
```

- [ ] **Step 2: Run tests, verify ALL fail with ImportError**

```bash
cd backend/python && python -m pytest tests/test_outlier_stats.py -v 2>&1 | head -30
```

Expected: `ImportError: cannot import name 'iqr_fence' from 'smartbi.utils.outlier_stats'` (module doesn't exist yet).

- [ ] **Step 3: Create empty utils module dir if needed**

```bash
mkdir -p backend/python/smartbi/utils
test -f backend/python/smartbi/utils/__init__.py || touch backend/python/smartbi/utils/__init__.py
```

- [ ] **Step 4: Write `outlier_stats.py` implementation**

Create `backend/python/smartbi/utils/outlier_stats.py`:

```python
"""共享 outlier 检测算法库 (Phase B-1).

Reviewer R3: 第一版同时 export iqr() + zscore() + OutlierAlgorithm dataclass,
让 chat AnomalyDetection (Phase B-N backlog item) 切迁源头消除数字打架问题.

Note: Python statistics.quantiles(method='exclusive') 跟 PG PERCENTILE_CONT
都是 continuous percentile, 数值差异 < 1%. 单测用 pytest.approx(rel=0.05)
容差对比 (interpolation 算法略不同). 对单一 outlier, 本地 N>=10 路径 100% Python,
fallback 路径 100% PG, 不会跨算法混用.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Literal, List, Optional
import statistics


@dataclass(frozen=True)
class IQRFence:
    q1: float
    q3: float
    iqr: float
    lower: float       # q1 - multiplier*iqr
    upper: float       # q3 + multiplier*iqr
    multiplier: float


@dataclass(frozen=True)
class Outlier:
    index: int
    value: float
    deviation_x: float       # 偏离倍数 (>= 1.0 表示越界 1×fence)
    direction: Literal['above', 'below']


def iqr_fence(values: List[float], multiplier: float = 1.5) -> Optional[IQRFence]:
    """计算 IQR fence. 返回 None if N < 4 (无法算 Q1/Q3)."""
    n = len(values)
    if n < 4:
        return None
    sorted_vals = sorted(values)
    q1, _, q3 = statistics.quantiles(sorted_vals, n=4, method='exclusive')
    iqr = q3 - q1
    return IQRFence(
        q1=q1, q3=q3, iqr=iqr,
        lower=q1 - multiplier * iqr,
        upper=q3 + multiplier * iqr,
        multiplier=multiplier,
    )


def find_outliers_iqr(values: List[float], fence: IQRFence) -> List[Outlier]:
    """返回所有越界的 outlier."""
    outliers: List[Outlier] = []
    for i, v in enumerate(values):
        if v > fence.upper:
            dev = (v - fence.upper) / fence.iqr if fence.iqr > 0 else 0
            outliers.append(Outlier(i, v, deviation_x=dev, direction='above'))
        elif v < fence.lower:
            dev = (fence.lower - v) / fence.iqr if fence.iqr > 0 else 0
            outliers.append(Outlier(i, v, deviation_x=dev, direction='below'))
    return outliers


def zscore_outliers(values: List[float], sigma: float = 2.0) -> List[Outlier]:
    """Z-score outlier 检测. 第一版未被 OutlierService 调用,
    留给 AnomalyDetection 后续切迁."""
    n = len(values)
    if n < 2:
        return []
    mean = statistics.mean(values)
    std = statistics.stdev(values)
    if std == 0:
        return []
    outliers: List[Outlier] = []
    for i, v in enumerate(values):
        z = (v - mean) / std
        if abs(z) >= sigma:
            outliers.append(Outlier(
                i, v, deviation_x=abs(z),
                direction='above' if z > 0 else 'below',
            ))
    return outliers


@dataclass
class OutlierAlgorithm:
    """统一接口让 OutlierService / AnomalyDetection 共用算法."""
    name: Literal['iqr', 'zscore']
    threshold: float    # IQR multiplier or sigma

    def detect(self, values: List[float]) -> List[Outlier]:
        if self.name == 'iqr':
            fence = iqr_fence(values, multiplier=self.threshold)
            if fence is None:
                return []
            return find_outliers_iqr(values, fence)
        else:  # zscore
            return zscore_outliers(values, sigma=self.threshold)
```

- [ ] **Step 5: Run tests, verify ALL pass**

```bash
cd backend/python && python -m pytest tests/test_outlier_stats.py -v
```

Expected: `9 passed` (3 IQRFence + 2 FindOutliers + 2 zscore + 2 OutlierAlgorithm).

- [ ] **Step 6: Commit**

```bash
bash scripts/safe-commit.sh "feat(餐饮 Phase B-1): outlier_stats utils — iqr+zscore+OutlierAlgorithm共享算法库 (Reviewer R3)" backend/python/smartbi/utils/outlier_stats.py backend/python/smartbi/utils/__init__.py backend/python/tests/test_outlier_stats.py
```

---

## Section 3: Backend Service Layer (TDD with mock pool)

### Task 4: `outlier_service.py` + tests

**Files:**
- Create: `backend/python/smartbi/services/outlier_service.py`
- Test: `backend/python/tests/test_outlier_service.py`

**Why TDD with mock pool**: 真 DB call 慢 + 需要预置数据。Mock 让我们专注业务逻辑 (本地路径 / fallback / insufficient) 三条分支独立验证。

- [ ] **Step 1: Create test file with failing tests for 3 paths**

Create `backend/python/tests/test_outlier_service.py`:

```python
"""Tests for OutlierService (Phase B-1) — local + fallback + insufficient paths."""
from __future__ import annotations
import pytest
from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from smartbi.services.outlier_service import (
    OutlierService, DetectedOutlier, DEFAULT_KPI_KINDS,
)


def _make_mock_conn(local_rows=None, global_row=None):
    """Helper: make AsyncMock connection that returns specified data."""
    conn = AsyncMock()
    conn.execute = AsyncMock(return_value=None)

    async def _fetch(query, *args):
        # _query_local hits agg_restaurant_daily_totals
        if 'agg_restaurant_daily_totals' in query:
            return local_rows or []
        return []

    async def _fetchrow(query, *args):
        # _query_global_baseline hits get_global_kpi_stats function
        if 'get_global_kpi_stats' in query:
            return global_row
        return None

    conn.fetch = _fetch
    conn.fetchrow = _fetchrow
    return conn


def _make_mock_pool(conn):
    """Helper: make AsyncMock pool that yields the given conn from acquire()."""
    pool = MagicMock()
    pool.acquire = MagicMock()
    # async with pool.acquire() as conn:
    pool.acquire.return_value.__aenter__ = AsyncMock(return_value=conn)
    pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)
    # async with conn.transaction():
    conn.transaction = MagicMock()
    conn.transaction.return_value.__aenter__ = AsyncMock(return_value=None)
    conn.transaction.return_value.__aexit__ = AsyncMock(return_value=None)
    return pool


class TestDetectTotalsLocalPath:
    @pytest.mark.asyncio
    async def test_local_n_above_threshold_uses_self_baseline(self):
        # Build 30-row local data with 1 obvious outlier
        rows = []
        for i in range(30):
            d = date.today() - timedelta(days=29 - i)
            value = 100.0 if i < 29 else 5000.0  # last row is outlier
            rows.append({'date': d, 'value': value})

        conn = _make_mock_conn(local_rows=rows)
        pool = _make_mock_pool(conn)

        with patch('smartbi.config.get_pg_pool', new=AsyncMock(return_value=pool)):
            svc = OutlierService()
            outliers, insufficient = await svc.detect_totals(
                'F002', window_days=30, kpi_kinds=['wastage_cost_total'],
            )

        # Should detect 5000.0 as outlier with baseline_source='self'
        assert any(o.value == 5000.0 and o.baseline_source == 'self' for o in outliers)
        assert insufficient == []


class TestDetectTotalsFallbackPath:
    @pytest.mark.asyncio
    async def test_local_n_below_threshold_falls_back_to_global(self):
        # Only 5 local rows (< 10 threshold)
        rows = [{'date': date.today() - timedelta(days=i), 'value': 8500.0}
                for i in range(5)]
        # Mock global baseline indicating wastage cost normal range
        global_row = {'q1': 1000.0, 'q3': 3000.0, 'median': 2000.0, 'n_bucket': '100-499'}

        conn = _make_mock_conn(local_rows=rows, global_row=global_row)
        pool = _make_mock_pool(conn)

        with patch('smartbi.config.get_pg_pool', new=AsyncMock(return_value=pool)):
            svc = OutlierService()
            outliers, insufficient = await svc.detect_totals(
                'R_NEW', window_days=30, kpi_kinds=['wastage_cost_total'],
            )

        # 8500 vs upper fence (3000 + 1.5*2000 = 6000) → outlier with baseline='global'
        assert any(o.value == 8500.0 and o.baseline_source == 'global' for o in outliers)
        assert any(o.baseline_n == '100-499' for o in outliers)
        assert insufficient == []


class TestDetectTotalsInsufficientPath:
    @pytest.mark.asyncio
    async def test_global_also_insufficient_returns_insufficient_kpi(self):
        rows = [{'date': date.today(), 'value': 8500.0}]    # 1 local row
        global_row = {'q1': None, 'q3': None, 'median': None, 'n_bucket': '<10'}

        conn = _make_mock_conn(local_rows=rows, global_row=global_row)
        pool = _make_mock_pool(conn)

        with patch('smartbi.config.get_pg_pool', new=AsyncMock(return_value=pool)):
            svc = OutlierService()
            outliers, insufficient = await svc.detect_totals(
                'R_NEW', window_days=30, kpi_kinds=['wastage_cost_total'],
            )

        assert outliers == []
        assert 'wastage_cost_total' in insufficient


class TestDetectPerDimNotImplemented:
    @pytest.mark.asyncio
    async def test_detect_per_dim_raises(self):
        svc = OutlierService()
        with pytest.raises(NotImplementedError, match="Phase B-N"):
            await svc.detect_per_dim('F002', 'wastage_cost', 1, 30)
```

- [ ] **Step 2: Verify pytest-asyncio installed (Phase A 已用过)**

```bash
cd backend/python && python -c "import pytest_asyncio; print(pytest_asyncio.__version__)"
```

Expected: 版本号 (Phase A 已加依赖)。如果 ImportError, `pip install pytest-asyncio` 并加 `pytest-asyncio` to requirements.txt。

- [ ] **Step 3: Run tests, verify ALL fail (ImportError)**

```bash
cd backend/python && python -m pytest tests/test_outlier_service.py -v 2>&1 | head -20
```

Expected: ImportError on `OutlierService` (module 不存在)。

- [ ] **Step 4: Implement `outlier_service.py`**

Create `backend/python/smartbi/services/outlier_service.py` (full code in spec §5.1.2):

主要类 + 函数:
- `DEFAULT_KPI_KINDS` constant: 4 cost 信号 list
- `KPI_LABELS` dict: kpi_kind → 中文 label
- `LOCAL_N_THRESHOLD = 10`, `DEFAULT_WINDOW_DAYS = 30`, `IQR_MULTIPLIER = 1.5`
- `@dataclass DetectedOutlier`: anomaly_date / kpi_kind / value / q1 / q3 / iqr / lower_fence / upper_fence / deviation_x / severity / direction / baseline_source / baseline_n
- `class OutlierService`:
  - `async def detect_totals(factory_id, window_days=30, kpi_kinds=None) -> tuple[List[DetectedOutlier], List[str]]`: 主入口, 并行 4 kpi
  - `async def _detect_one_kpi(pool, factory_id, kpi_kind, window_days)`: 单 kpi 决策本地 vs fallback
  - `async def _query_local(pool, factory_id, kpi_kind, window_days) -> list[tuple[date, float]]`: 必须 `async with conn.transaction(): await conn.execute(set_config(...))` (W0.4 finding 3)
  - `async def _query_global_baseline(pool, kpi_kind, window_days) -> dict | None`: 调 SECURITY DEFINER function, **不需要 GUC**
  - `def _compute_outliers(...)`: 用本地数据 iqr_fence + find_outliers_iqr
  - `def _compute_outliers_with_baseline(local_data, q1, q3, ...)`: 用 global q1/q3 算 fence, 检测本工厂数据
  - `def _build_outliers(...)`: 共用构造 DetectedOutlier
  - `def _make_outlier(...)`: 单条构造 (severity = 'high' if dev > 2 else 'medium')
  - `@staticmethod _bucket_n(n) -> str`: 5 桶 (跟 SQL function 一致)
  - `async def detect_per_dim(*args, **kwargs)`: raise NotImplementedError("...Phase B-N...")

完整 ~280 行代码在 spec §5.1.2, **逐字 copy 即可**, 不要 paraphrase。

- [ ] **Step 5: Run tests, verify all pass**

```bash
cd backend/python && python -m pytest tests/test_outlier_service.py -v
```

Expected: `4 passed` (local + fallback + insufficient + detect_per_dim NotImplemented)。

- [ ] **Step 6: 关键防御 self-check — RLS GUC pattern**

manually verify `_query_local` + `_query_dismissed_this_month` (在 task 6 加) 都用了:

```bash
grep -n "set_config" backend/python/smartbi/services/outlier_service.py
```

Expected: 出现在 `_query_local` 内, 且前面有 `async with conn.transaction():`。**没有 transaction 包就是 bug**。

```bash
grep -B2 "set_config" backend/python/smartbi/services/outlier_service.py
```

Expected output 包含 `async with conn.transaction():` 紧跟 `await conn.execute("SELECT set_config(...)`。

- [ ] **Step 7: Commit**

```bash
bash scripts/safe-commit.sh "feat(餐饮 Phase B-1): OutlierService — IQR+2级fallback (W0.4 finding 3 GUC pattern)" backend/python/smartbi/services/outlier_service.py backend/python/tests/test_outlier_service.py
```

---

## Section 4: Backend API Layer

### Task 5: API GET endpoint + tests

**Files:**
- Create: `backend/python/smartbi/api/restaurant_outliers.py`
- Test: `backend/python/tests/test_restaurant_outliers_api.py`

- [ ] **Step 1: Create test file with failing tests for GET endpoint**

Create `backend/python/tests/test_restaurant_outliers_api.py`:

```python
"""Tests for restaurant_outliers API (Phase B-1)."""
from __future__ import annotations
import pytest
from datetime import date, datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient


def _build_app():
    """Build minimal FastAPI app with restaurant_outliers router + auth middleware mock."""
    from smartbi.api.restaurant_outliers import router

    app = FastAPI()

    # Inject role + factory_id into request.state (Phase A pattern)
    @app.middleware("http")
    async def _mock_auth(request, call_next):
        request.state.role = request.headers.get('x-role', 'factory_super_admin')
        request.state.factory_id = request.headers.get('x-factory-id', 'F002')
        return await call_next(request)

    app.include_router(router, prefix="/api/restaurant")
    return app


def _mock_outlier(anomaly_date, kpi='wastage_cost_total', value=8500, baseline='self'):
    from smartbi.services.outlier_service import DetectedOutlier
    return DetectedOutlier(
        anomaly_date=anomaly_date, kpi_kind=kpi, value=value,
        q1=1200, q3=3400, iqr=2200,
        lower_fence=-2100, upper_fence=6700,
        deviation_x=0.82, severity='medium', direction='above',
        baseline_source=baseline, baseline_n='100-499' if baseline == 'global' else '10-49',
    )


class TestGetOutliersAPI:
    def test_get_outliers_admin_success_returns_baseline_source_field(self):
        app = _build_app()
        client = TestClient(app)

        mock_outliers = [_mock_outlier(date.today() - timedelta(days=2))]
        mock_service = AsyncMock()
        mock_service.detect_totals = AsyncMock(return_value=(mock_outliers, []))

        with patch('smartbi.api.restaurant_outliers._service', mock_service), \
             patch('smartbi.api.restaurant_outliers._query_dismissed_this_month',
                   new=AsyncMock(return_value=[])):
            r = client.get('/api/restaurant/outliers?factoryId=F002')

        assert r.status_code == 200, r.text
        body = r.json()
        assert body['factoryId'] == 'F002'
        assert body['windowDays'] == 30
        assert body['summary']['totalAnomalies'] == 1
        assert len(body['outliers']) == 1
        # Reviewer R2 critical: baselineSource MUST be in response
        assert 'baselineSource' in body['outliers'][0]
        assert 'baselineN' in body['outliers'][0]
        assert body['outliers'][0]['baselineSource'] == 'self'

    def test_cross_factory_blocked_403(self):
        app = _build_app()
        client = TestClient(app)
        # Admin of F001 tries to query F002
        r = client.get(
            '/api/restaurant/outliers?factoryId=F002',
            headers={'x-role': 'factory_super_admin', 'x-factory-id': 'F001'},
        )
        assert r.status_code == 403
        assert 'platform_admin' in r.json()['detail']

    def test_platform_admin_can_query_any_factory(self):
        app = _build_app()
        client = TestClient(app)

        mock_service = AsyncMock()
        mock_service.detect_totals = AsyncMock(return_value=([], []))

        with patch('smartbi.api.restaurant_outliers._service', mock_service), \
             patch('smartbi.api.restaurant_outliers._query_dismissed_this_month',
                   new=AsyncMock(return_value=[])):
            r = client.get(
                '/api/restaurant/outliers?factoryId=F002',
                headers={'x-role': 'platform_admin', 'x-factory-id': 'F999'},
            )
        assert r.status_code == 200

    def test_invalid_factory_id_400(self):
        app = _build_app()
        client = TestClient(app)
        r = client.get('/api/restaurant/outliers?factoryId=' + 'X' * 51)
        assert r.status_code == 400

    def test_window_days_out_of_range_validation(self):
        app = _build_app()
        client = TestClient(app)
        r = client.get('/api/restaurant/outliers?factoryId=F002&windowDays=400')
        # FastAPI Query(ge=1, le=365) returns 422
        assert r.status_code == 422
```

- [ ] **Step 2: Run, verify ALL fail**

```bash
cd backend/python && python -m pytest tests/test_restaurant_outliers_api.py -v 2>&1 | head -20
```

Expected: ImportError on `smartbi.api.restaurant_outliers`.

- [ ] **Step 3: Implement API layer (GET endpoint only first)**

Create `backend/python/smartbi/api/restaurant_outliers.py`:

```python
"""餐饮 outlier API (Phase B-1).

Endpoints:
  GET    /api/restaurant/outliers
  POST   /api/restaurant/outliers/dismiss             (Task 6)
  DELETE /api/restaurant/outliers/dismiss/{id}        (Task 6)

Reviewer R6: cache 启动加 warning 提示单 worker 假设.
"""
from __future__ import annotations
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, Tuple, List

from fastapi import APIRouter, HTTPException, Query, Request

from smartbi.canonical.provenance._admin_auth import require_admin
from smartbi.services.outlier_service import (
    OutlierService, KPI_LABELS, DEFAULT_WINDOW_DAYS,
)

logger = logging.getLogger(__name__)
logger.warning(
    "[outlier_api] Module-level cache assumes single-worker uvicorn. "
    "If you switch to --workers > 1, add Redis backend (see backlog)."
)

router = APIRouter()
_service = OutlierService()

_CACHE_TTL_S = 300
_cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}


def _invalidate_cache(factory_id: str) -> None:
    _cache.pop(factory_id, None)


def _validate_factory_access(request: Request, factory_id: str) -> None:
    """Quick-Win 3 pattern: cross-factory check."""
    role = getattr(request.state, "role", None)
    jwt_factory_id = getattr(request.state, "factory_id", None) or ""
    if role != "platform_admin" and factory_id != jwt_factory_id:
        raise HTTPException(
            403,
            f"非 platform_admin 仅可访问自己工厂的 outlier (当前工厂 {jwt_factory_id!r})",
        )


def _outlier_to_json(o) -> Dict[str, Any]:
    return {
        "anomalyDate": o.anomaly_date.isoformat(),
        "kpiKind": o.kpi_kind,
        "kpiLabel": KPI_LABELS.get(o.kpi_kind, o.kpi_kind),
        "value": float(o.value),
        "q1": float(o.q1), "q3": float(o.q3), "iqr": float(o.iqr),
        "lowerFence": float(o.lower_fence), "upperFence": float(o.upper_fence),
        "deviationX": float(o.deviation_x),
        "severity": o.severity,
        "direction": o.direction,
        "baselineSource": o.baseline_source,
        "baselineN": o.baseline_n,
    }


async def _query_dismissed_this_month(factory_id: str) -> List[Dict[str, Any]]:
    """Query dismissals this calendar month. RLS GUC + transaction required."""
    from smartbi.config import get_pg_pool
    pool = await get_pg_pool()
    if pool is None:
        return []
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                "SELECT set_config('app.factory_id', $1, true)", factory_id
            )
            rows = await conn.fetch(
                """
                SELECT id, anomaly_date, kpi_kind, dismissed_by, dismissed_at,
                       snapshot_value, snapshot_q1, snapshot_q3, snapshot_baseline_source
                FROM outlier_dismissals
                WHERE factory_id = $1
                  AND dismissed_at >= date_trunc('month', NOW())
                ORDER BY dismissed_at DESC
                """,
                factory_id,
            )
    return [
        {
            "id": r["id"],
            "anomalyDate": r["anomaly_date"].isoformat(),
            "kpiKind": r["kpi_kind"],
            "kpiLabel": KPI_LABELS.get(r["kpi_kind"], r["kpi_kind"]),
            "dismissedBy": r["dismissed_by"],
            "dismissedAt": r["dismissed_at"].isoformat(),
            "snapshotValue": float(r["snapshot_value"]) if r["snapshot_value"] else None,
            "snapshotQ1": float(r["snapshot_q1"]) if r["snapshot_q1"] else None,
            "snapshotQ3": float(r["snapshot_q3"]) if r["snapshot_q3"] else None,
            "snapshotBaselineSource": r["snapshot_baseline_source"],
        }
        for r in rows
    ]


@router.get("/outliers")
async def get_outliers(
    request: Request,
    factoryId: str = Query(..., description="Factory ID"),
    windowDays: int = Query(DEFAULT_WINDOW_DAYS, ge=1, le=365),
) -> Dict[str, Any]:
    require_admin(request)

    # Validate factoryId length BEFORE cross-factory check
    if not factoryId or not factoryId.strip():
        raise HTTPException(400, "factoryId 不能为空")
    factoryId = factoryId.strip()
    if len(factoryId) > 50:
        raise HTTPException(400, f"factoryId 长度不能超过 50 (收到 {len(factoryId)})")

    _validate_factory_access(request, factoryId)

    # Cache check
    now_ts = time.monotonic()
    cached = _cache.get(factoryId)
    if cached:
        cached_ts, cached_body = cached
        if now_ts - cached_ts < _CACHE_TTL_S:
            return cached_body

    # Detect outliers
    try:
        outliers, insufficient = await _service.detect_totals(
            factoryId, window_days=windowDays,
        )
    except RuntimeError as exc:
        raise HTTPException(503, f"数据库连接失败: {exc}")
    except Exception:
        logger.exception(f"[outlier] detect failed for {factoryId}")
        raise HTTPException(500, "outlier 检测内部错误")

    # Query dismissed this month
    dismissed = await _query_dismissed_this_month(factoryId)
    dismissed_keys = {(d['anomalyDate'], d['kpiKind']) for d in dismissed}

    # Filter pending
    pending = [
        o for o in outliers
        if (o.anomaly_date.isoformat(), o.kpi_kind) not in dismissed_keys
    ]

    body = {
        "factoryId": factoryId,
        "windowDays": windowDays,
        "cachedAt": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "totalAnomalies": len(pending),
            "dismissedThisMonth": len(dismissed),
            "insufficientKpis": insufficient,
        },
        "outliers": [_outlier_to_json(o) for o in pending],
        "dismissed": dismissed,
    }
    _cache[factoryId] = (now_ts, body)
    return body
```

- [ ] **Step 4: Run, verify all 5 GET tests pass**

```bash
cd backend/python && python -m pytest tests/test_restaurant_outliers_api.py -v
```

Expected: `5 passed` (admin success / cross-factory 403 / platform_admin / invalid factoryId / windowDays validation)。

- [ ] **Step 5: Verify RLS GUC in `_query_dismissed_this_month`**

```bash
grep -B3 "outlier_dismissals" backend/python/smartbi/api/restaurant_outliers.py | head -20
```

Expected: `async with conn.transaction():` 在 `_query_dismissed_this_month` 内, 紧跟 `set_config`。

- [ ] **Step 6: Commit**

```bash
bash scripts/safe-commit.sh "feat(餐饮 Phase B-1): GET /outliers endpoint — admin auth+cross-factory+RLS GUC+cache" backend/python/smartbi/api/restaurant_outliers.py backend/python/tests/test_restaurant_outliers_api.py
```

---

### Task 6: API dismiss + un-dismiss endpoints + tests

**Files:**
- Modify: `backend/python/smartbi/api/restaurant_outliers.py:end-of-file` (append POST + DELETE endpoints)
- Modify: `backend/python/tests/test_restaurant_outliers_api.py` (append dismiss tests)

- [ ] **Step 1: Append failing tests for POST dismiss + DELETE un-dismiss**

Append to `backend/python/tests/test_restaurant_outliers_api.py`:

```python
class TestDismissOutlierAPI:
    def test_dismiss_inserts_and_invalidates_cache(self):
        from smartbi.api.restaurant_outliers import _cache
        app = _build_app()
        client = TestClient(app)

        # Pre-populate cache to verify invalidation
        _cache['F002'] = (time.monotonic(), {'cached': True})

        mock_pool = AsyncMock()
        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock(return_value=None)
        mock_conn.fetchrow = AsyncMock(return_value={
            'id': 99, 'dismissed_at': datetime.now(timezone.utc),
        })
        mock_conn.transaction = MagicMock()
        mock_conn.transaction.return_value.__aenter__ = AsyncMock(return_value=None)
        mock_conn.transaction.return_value.__aexit__ = AsyncMock(return_value=None)
        mock_pool.acquire = MagicMock()
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)

        with patch('smartbi.config.get_pg_pool', new=AsyncMock(return_value=mock_pool)):
            r = client.post('/api/restaurant/outliers/dismiss', json={
                'factoryId': 'F002',
                'anomalyDate': '2026-04-25',
                'kpiKind': 'wastage_cost_total',
                'snapshotValue': 8500.0,
                'snapshotQ1': 1200.0,
                'snapshotQ3': 3400.0,
                'snapshotBaselineSource': 'self',
            })

        assert r.status_code == 201, r.text
        assert r.json()['id'] == 99
        # Cache invalidated
        assert 'F002' not in _cache

    def test_dismiss_invalid_baseline_source_400(self):
        app = _build_app()
        client = TestClient(app)
        r = client.post('/api/restaurant/outliers/dismiss', json={
            'factoryId': 'F002',
            'anomalyDate': '2026-04-25',
            'kpiKind': 'wastage_cost_total',
            'snapshotValue': 8500, 'snapshotQ1': 1200, 'snapshotQ3': 3400,
            'snapshotBaselineSource': 'INVALID',
        })
        assert r.status_code == 400

    def test_dismiss_unknown_kpi_kind_400(self):
        app = _build_app()
        client = TestClient(app)
        r = client.post('/api/restaurant/outliers/dismiss', json={
            'factoryId': 'F002',
            'anomalyDate': '2026-04-25',
            'kpiKind': 'unknown_kpi',
            'snapshotValue': 100, 'snapshotQ1': 50, 'snapshotQ3': 150,
            'snapshotBaselineSource': 'self',
        })
        assert r.status_code == 400


class TestUndismissOutlierAPI:
    def test_undismiss_404_when_not_exist(self):
        app = _build_app()
        client = TestClient(app)

        mock_pool = AsyncMock()
        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock(return_value=None)
        mock_conn.fetchrow = AsyncMock(return_value=None)  # not found
        mock_conn.transaction = MagicMock()
        mock_conn.transaction.return_value.__aenter__ = AsyncMock(return_value=None)
        mock_conn.transaction.return_value.__aexit__ = AsyncMock(return_value=None)
        mock_pool.acquire = MagicMock()
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)

        with patch('smartbi.config.get_pg_pool', new=AsyncMock(return_value=mock_pool)):
            r = client.delete('/api/restaurant/outliers/dismiss/9999')

        assert r.status_code == 404
```

Add `import time` at top if not already present.

- [ ] **Step 2: Run new tests, verify fail**

```bash
cd backend/python && python -m pytest tests/test_restaurant_outliers_api.py::TestDismissOutlierAPI -v
```

Expected: 404 errors (POST/DELETE endpoints not registered yet)。

- [ ] **Step 3: Append dismiss + undismiss endpoints to `restaurant_outliers.py`**

Append to `backend/python/smartbi/api/restaurant_outliers.py`:

```python
from fastapi import Body, Path
from typing import Optional

from smartbi.services.outlier_service import DEFAULT_KPI_KINDS

_VALID_BASELINE_SOURCES = frozenset({'self', 'global'})


@router.post("/outliers/dismiss", status_code=201)
async def dismiss_outlier(
    request: Request,
    body: Dict[str, Any] = Body(...),
) -> Dict[str, Any]:
    require_admin(request)

    # Validate
    factory_id = body.get("factoryId", "").strip()
    if not factory_id or len(factory_id) > 50:
        raise HTTPException(400, "factoryId 不能为空且长度 ≤ 50")
    _validate_factory_access(request, factory_id)

    anomaly_date = body.get("anomalyDate")
    if not anomaly_date:
        raise HTTPException(400, "anomalyDate 不能为空")

    kpi_kind = body.get("kpiKind")
    if kpi_kind not in DEFAULT_KPI_KINDS:
        raise HTTPException(400, f"无效 kpiKind: {kpi_kind}")

    baseline_source = body.get("snapshotBaselineSource")
    if baseline_source not in _VALID_BASELINE_SOURCES:
        raise HTTPException(400, f"无效 snapshotBaselineSource: {baseline_source}")

    snapshot_value = body.get("snapshotValue")
    snapshot_q1 = body.get("snapshotQ1")
    snapshot_q3 = body.get("snapshotQ3")
    if snapshot_value is None or snapshot_q1 is None or snapshot_q3 is None:
        raise HTTPException(400, "snapshotValue / snapshotQ1 / snapshotQ3 必填")

    dismissed_by = getattr(request.state, "user_name", None) \
        or getattr(request.state, "username", None) \
        or "unknown_admin"

    from smartbi.config import get_pg_pool
    pool = await get_pg_pool()
    if pool is None:
        raise HTTPException(503, "数据库连接失败")

    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute(
                    "SELECT set_config('app.factory_id', $1, true)", factory_id
                )
                row = await conn.fetchrow(
                    """
                    INSERT INTO outlier_dismissals
                        (factory_id, anomaly_date, kpi_kind, dismissed_by,
                         snapshot_value, snapshot_q1, snapshot_q3, snapshot_baseline_source)
                    VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8)
                    RETURNING id, dismissed_at
                    """,
                    factory_id, anomaly_date, kpi_kind, dismissed_by,
                    snapshot_value, snapshot_q1, snapshot_q3, baseline_source,
                )
    except Exception as exc:
        # asyncpg UniqueViolationError → 409
        if 'unique' in str(exc).lower() or 'duplicate' in str(exc).lower():
            raise HTTPException(409, "该异常已被标记 ✓ 非异常")
        logger.exception("[outlier] dismiss insert failed")
        raise HTTPException(500, "dismiss 内部错误")

    _invalidate_cache(factory_id)

    return {
        "id": row["id"],
        "factoryId": factory_id,
        "anomalyDate": anomaly_date,
        "kpiKind": kpi_kind,
        "dismissedBy": dismissed_by,
        "dismissedAt": row["dismissed_at"].isoformat(),
    }


@router.delete("/outliers/dismiss/{dismissal_id}", status_code=204)
async def undismiss_outlier(
    request: Request,
    dismissal_id: int = Path(..., ge=1),
) -> None:
    require_admin(request)

    from smartbi.config import get_pg_pool
    pool = await get_pg_pool()
    if pool is None:
        raise HTTPException(503, "数据库连接失败")

    # First, find the dismissal row to get factory_id (for cross-factory check)
    # We need to query with NO GUC initially to find the row, but RLS will hide
    # other tenants' rows. So we need superuser? No — solution: query with
    # request's factory_id GUC, if row not visible → 404 (covers both not-exist
    # AND cross-factory).
    jwt_factory_id = getattr(request.state, "factory_id", None) or ""
    role = getattr(request.state, "role", None)

    async with pool.acquire() as conn:
        async with conn.transaction():
            # platform_admin: try with each candidate? No — for simplicity,
            # require platform_admin to also pass factoryId. For non-platform_admin,
            # use their own factory_id.
            if role == "platform_admin":
                # platform_admin: trust them; first SELECT to find factory_id of row
                # Use a special approach: temporarily use any factory_id to scan.
                # Simpler: require platform_admin to also pass factoryId in query
                # param if they want to delete cross-factory.
                # For B-1 first version: platform_admin can only delete via own GUC
                # context (i.e. pass their own factory_id). If they need to delete
                # for another factory, they should use admin tools.
                # → just use jwt_factory_id (or 'F999' as placeholder)
                effective_fid = jwt_factory_id or 'NONE'
            else:
                effective_fid = jwt_factory_id

            await conn.execute(
                "SELECT set_config('app.factory_id', $1, true)", effective_fid
            )
            row = await conn.fetchrow(
                "SELECT factory_id FROM outlier_dismissals WHERE id = $1",
                dismissal_id,
            )
            if row is None:
                raise HTTPException(404, "dismissal 记录不存在或无权访问")

            await conn.execute(
                "DELETE FROM outlier_dismissals WHERE id = $1",
                dismissal_id,
            )

    _invalidate_cache(row["factory_id"])
    return None
```

> **Note on platform_admin DELETE**: Phase B-1 第一版限制 platform_admin 也用自己的 jwt factory_id 做 DELETE 检索 (实际上 platform_admin 通常也有一个 factory_id, 否则 `effective_fid='NONE'` 会找不到 row)。Phase B-N backlog: 加 `?factoryId=X` query param 支持 platform_admin 跨工厂 DELETE。

- [ ] **Step 4: Run all API tests, verify pass**

```bash
cd backend/python && python -m pytest tests/test_restaurant_outliers_api.py -v
```

Expected: `8 passed` (5 GET + 3 dismiss + 1 undismiss = 9 total, 但 platform_admin DELETE behavior 可能让 undismiss 测试需要调整)。

- [ ] **Step 5: Self-check — RLS GUC + transaction in dismiss/undismiss**

```bash
grep -A2 "set_config" backend/python/smartbi/api/restaurant_outliers.py
```

Expected: 每个 set_config 前面都有 `async with conn.transaction():`。

- [ ] **Step 6: Commit**

```bash
bash scripts/safe-commit.sh "feat(餐饮 Phase B-1): POST dismiss + DELETE undismiss endpoints (validation+RLS+cache invalidate)" backend/python/smartbi/api/restaurant_outliers.py backend/python/tests/test_restaurant_outliers_api.py
```

---

### Task 7: Register router in `main.py`

**Files:**
- Modify: `backend/python/main.py`

- [ ] **Step 1: Add import + include_router**

Edit `backend/python/main.py`. Find the section where other Restaurant routers are included (search for `restaurant_completeness` or `restaurant_etl_admin`) and add:

```python
from smartbi.api.restaurant_outliers import router as outliers_router
# ... (existing routers above)
app.include_router(outliers_router, prefix="/api/restaurant", tags=["RestaurantOutliers"])
```

- [ ] **Step 2: Local syntax check (no full deploy)**

```bash
cd backend/python && python -c "from main import app; print('OK', [r.path for r in app.routes if 'outlier' in r.path.lower()])"
```

Expected: list including `/api/restaurant/outliers`, `/api/restaurant/outliers/dismiss`, `/api/restaurant/outliers/dismiss/{dismissal_id}`.

- [ ] **Step 3: Commit**

```bash
bash scripts/safe-commit.sh "feat(餐饮 Phase B-1): register outliers router in main.py" backend/python/main.py
```

---

## Section 5: Frontend

### Task 8: FE API client `outliers.ts`

**Files:**
- Create: `web-admin/src/api/restaurant/outliers.ts`

- [ ] **Step 1: Verify pythonFetch utility exists**

```bash
test -f web-admin/src/utils/python-fetch.ts && grep -n "export" web-admin/src/utils/python-fetch.ts | head -5
```

Expected: file exists + export pythonFetch function。如果不存在, 找另一名称: `grep -rn "pythonFetch\|fetchPython" web-admin/src/utils/ | head`。

- [ ] **Step 2: Create API client**

Create `web-admin/src/api/restaurant/outliers.ts`:

```typescript
import { pythonFetch } from '@/utils/python-fetch';

export interface OutlierItem {
  anomalyDate: string;
  kpiKind: string;
  kpiLabel: string;
  value: number;
  q1: number; q3: number; iqr: number;
  lowerFence: number; upperFence: number;
  deviationX: number;
  severity: 'high' | 'medium';
  direction: 'above' | 'below';
  // Reviewer R2: 透明标记 baseline 来源
  baselineSource: 'self' | 'global';
  baselineN: '<10' | '10-49' | '50-99' | '100-499' | '500+';
}

export interface DismissedItem {
  id: number;
  anomalyDate: string;
  kpiKind: string;
  kpiLabel: string;
  dismissedBy: string;
  dismissedAt: string;
  snapshotValue: number;
  snapshotQ1: number;
  snapshotQ3: number;
  snapshotBaselineSource: 'self' | 'global';
}

export interface OutliersResponse {
  factoryId: string;
  windowDays: number;
  cachedAt: string;
  summary: {
    totalAnomalies: number;
    dismissedThisMonth: number;
    insufficientKpis: string[];
  };
  outliers: OutlierItem[];
  dismissed: DismissedItem[];
}

export interface DismissPayload {
  factoryId: string;
  anomalyDate: string;
  kpiKind: string;
  snapshotValue: number;
  snapshotQ1: number;
  snapshotQ3: number;
  snapshotBaselineSource: 'self' | 'global';
}

export async function fetchOutliers(
  factoryId: string,
  windowDays = 30,
): Promise<OutliersResponse> {
  return pythonFetch<OutliersResponse>(
    `/api/restaurant/outliers?factoryId=${encodeURIComponent(factoryId)}&windowDays=${windowDays}`,
  );
}

export async function dismissOutlier(payload: DismissPayload): Promise<{ id: number }> {
  return pythonFetch<{ id: number }>('/api/restaurant/outliers/dismiss', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function undismissOutlier(id: number): Promise<void> {
  await pythonFetch<void>(`/api/restaurant/outliers/dismiss/${id}`, {
    method: 'DELETE',
  });
}
```

- [ ] **Step 3: TypeScript compile check**

```bash
cd web-admin && npx vue-tsc --noEmit src/api/restaurant/outliers.ts 2>&1 | head -10
```

Expected: 无错误。如果有, 检查 pythonFetch 类型签名是否兼容 (可能需要 `pythonFetch<T>(url, options?)`)。

- [ ] **Step 4: Commit**

```bash
bash scripts/safe-commit.sh "feat(餐饮 Phase B-1): outliers API client + types (R2 baselineSource field included)" web-admin/src/api/restaurant/outliers.ts
```

---

### Task 9: FE component `data-quality-tab.vue` + vitest

**Files:**
- Create: `web-admin/src/views/restaurant/data-quality-tab.vue`
- Test: `web-admin/src/views/restaurant/__tests__/data-quality-tab.spec.ts`

- [ ] **Step 1: Create vitest spec with failing tests**

Create `web-admin/src/views/restaurant/__tests__/data-quality-tab.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import DataQualityTab from '../data-quality-tab.vue';

vi.mock('@/api/restaurant/outliers', () => ({
  fetchOutliers: vi.fn(),
  dismissOutlier: vi.fn(),
  undismissOutlier: vi.fn(),
}));

vi.mock('@/store/modules/auth', () => ({
  useAuthStore: () => ({ factoryId: 'F002' }),
}));

import { fetchOutliers, dismissOutlier, undismissOutlier } from '@/api/restaurant/outliers';

const mockOutlier = (date: string, baseline: 'self' | 'global' = 'self') => ({
  anomalyDate: date, kpiKind: 'wastage_cost_total', kpiLabel: '损耗成本',
  value: 8500, q1: 1200, q3: 3400, iqr: 2200,
  lowerFence: -2100, upperFence: 6700, deviationX: 0.82,
  severity: 'medium' as const, direction: 'above' as const,
  baselineSource: baseline, baselineN: baseline === 'global' ? '100-499' as const : '10-49' as const,
});

describe('DataQualityTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders outliers list and dismissed folded section', async () => {
    (fetchOutliers as any).mockResolvedValue({
      factoryId: 'F002', windowDays: 30,
      cachedAt: new Date().toISOString(),
      summary: { totalAnomalies: 2, dismissedThisMonth: 1, insufficientKpis: [] },
      outliers: [mockOutlier('2026-04-25'), mockOutlier('2026-04-23')],
      dismissed: [{ id: 1, anomalyDate: '2026-04-20', kpiKind: 'wastage_cost_total',
                    kpiLabel: '损耗成本', dismissedBy: 'admin1',
                    dismissedAt: '2026-04-26T10:00:00Z',
                    snapshotValue: 5000, snapshotQ1: 1200, snapshotQ3: 3400,
                    snapshotBaselineSource: 'self' }],
    });

    const wrapper = mount(DataQualityTab);
    await flushPromises();

    // Outlier table rows
    const tableText = wrapper.text();
    expect(tableText).toContain('2026-04-25');
    expect(tableText).toContain('损耗成本');
    expect(tableText).toContain('待复核 2');
  });

  it('renders global baseline badge when baselineSource is global', async () => {
    (fetchOutliers as any).mockResolvedValue({
      factoryId: 'R_NEW', windowDays: 30,
      cachedAt: new Date().toISOString(),
      summary: { totalAnomalies: 1, dismissedThisMonth: 0, insufficientKpis: [] },
      outliers: [mockOutlier('2026-04-25', 'global')],
      dismissed: [],
    });

    const wrapper = mount(DataQualityTab);
    await flushPromises();

    expect(wrapper.text()).toContain('全网基线');
  });

  it('does NOT render global baseline badge when baselineSource is self', async () => {
    (fetchOutliers as any).mockResolvedValue({
      factoryId: 'F002', windowDays: 30,
      cachedAt: new Date().toISOString(),
      summary: { totalAnomalies: 1, dismissedThisMonth: 0, insufficientKpis: [] },
      outliers: [mockOutlier('2026-04-25', 'self')],
      dismissed: [],
    });

    const wrapper = mount(DataQualityTab);
    await flushPromises();

    expect(wrapper.text()).not.toContain('全网基线');
  });

  it('dismiss button triggers API and reloads', async () => {
    (fetchOutliers as any).mockResolvedValueOnce({
      factoryId: 'F002', windowDays: 30, cachedAt: new Date().toISOString(),
      summary: { totalAnomalies: 1, dismissedThisMonth: 0, insufficientKpis: [] },
      outliers: [mockOutlier('2026-04-25')],
      dismissed: [],
    });
    (dismissOutlier as any).mockResolvedValue({ id: 99 });
    (fetchOutliers as any).mockResolvedValueOnce({
      factoryId: 'F002', windowDays: 30, cachedAt: new Date().toISOString(),
      summary: { totalAnomalies: 0, dismissedThisMonth: 1, insufficientKpis: [] },
      outliers: [],
      dismissed: [{ id: 99, anomalyDate: '2026-04-25', kpiKind: 'wastage_cost_total',
                    kpiLabel: '损耗成本', dismissedBy: 'F002_admin',
                    dismissedAt: new Date().toISOString(),
                    snapshotValue: 8500, snapshotQ1: 1200, snapshotQ3: 3400,
                    snapshotBaselineSource: 'self' }],
    });

    const wrapper = mount(DataQualityTab);
    await flushPromises();

    const dismissBtn = wrapper.findAll('button').find(b => b.text().includes('非异常'));
    expect(dismissBtn).toBeTruthy();
    await dismissBtn!.trigger('click');
    await flushPromises();

    expect(dismissOutlier).toHaveBeenCalledWith(expect.objectContaining({
      factoryId: 'F002',
      anomalyDate: '2026-04-25',
      kpiKind: 'wastage_cost_total',
      snapshotBaselineSource: 'self',
    }));
    expect(fetchOutliers).toHaveBeenCalledTimes(2);  // initial + reload
  });
});
```

- [ ] **Step 2: Run tests, verify fail**

```bash
cd web-admin && npx vitest run src/views/restaurant/__tests__/data-quality-tab.spec.ts 2>&1 | head -30
```

Expected: `Cannot find module '../data-quality-tab.vue'` 或类似。

- [ ] **Step 3: Create component**

Create `web-admin/src/views/restaurant/data-quality-tab.vue` (full code in spec §6.1.2). Key requirements:
- `<script setup lang="ts">` with `useAuthStore` for `factoryId`
- `onMounted(load)` 加载, errorMsg ref / loading ref / data ref / showDismissed ref
- `handleDismiss(item)`: 调 `dismissOutlier()` + await `load()` 刷新
- `handleUndismiss(item)`: 调 `undismissOutlier(item.id)` + await `load()` 刷新
- 顶部 summary card 显 totalAnomalies / dismissedThisMonth / insufficientKpis 数字
- `<el-table>` outliers 列: 日期 / KPI / 实际值 / 正常范围 / 偏离 / 操作
- **关键**: 正常范围 column 内 `<el-tag v-if="row.baselineSource === 'global'" type="info" effect="plain">全网基线</el-tag>`
- severity 'high' → `<el-tag type="danger">`, 'medium' → `<el-tag type="warning">`
- 已确认折叠区: `<el-button @click="showDismissed=!showDismissed">展开/收起</el-button>` + `v-show` 表
- el-empty 显示 "本周期内无异常信号" 当 outliers 空

完整 vue 代码在 spec §6.1.2 (~280 行), copy 即可。

- [ ] **Step 4: Run tests, verify all 4 pass**

```bash
cd web-admin && npx vitest run src/views/restaurant/__tests__/data-quality-tab.spec.ts
```

Expected: `4 passed`.

- [ ] **Step 5: Commit**

```bash
bash scripts/safe-commit.sh "feat(餐饮 Phase B-1): data-quality-tab.vue — outliers表+dismiss+undismiss+R2 baselineSource badge" web-admin/src/views/restaurant/data-quality-tab.vue web-admin/src/views/restaurant/__tests__/data-quality-tab.spec.ts
```

---

### Task 10: Refactor `data-completeness.vue` 加 tabs

**Files:**
- Modify: `web-admin/src/views/restaurant/data-completeness.vue`

- [ ] **Step 1: Inspect existing component structure**

```bash
head -30 web-admin/src/views/restaurant/data-completeness.vue
```

记下: script setup 部分有哪些 imports / refs, template 顶层 div class 是什么。

- [ ] **Step 2: Wrap existing template in `<el-tabs>` + add second tab**

Edit `web-admin/src/views/restaurant/data-completeness.vue`. 把现有 `<template>` 内容 (header card + modules grid) 放到第一个 `<el-tab-pane>`, 加第二个 `<el-tab-pane>` 引用 `<DataQualityTab />`:

```vue
<template>
  <div class="completeness-page">
    <el-tabs v-model="activeTab" class="completeness-tabs">
      <el-tab-pane label="数据完整度" name="completeness">
        <!-- 把原来 template 里所有内容 (loading skeleton / error alert / template v-else-if="data") 移到这里 -->
        <el-skeleton v-if="loading" :rows="6" animated />
        <el-alert v-else-if="errorMsg" :title="errorMsg" type="error" show-icon :closable="false" class="error-alert" />
        <template v-else-if="data">
          <!-- header card + modules grid -->
        </template>
      </el-tab-pane>

      <el-tab-pane label="数据质量" name="quality">
        <DataQualityTab />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>
```

`<script setup lang="ts">` 加:

```typescript
import DataQualityTab from './data-quality-tab.vue';

const activeTab = ref<string>('completeness');
```

- [ ] **Step 3: Verify现有 vitest still pass**

```bash
cd web-admin && npx vitest run src/views/restaurant/__tests__/data-completeness.spec.ts
```

Expected: 现有 2 个 vitest 仍 pass (Phase A spec)。如果 fail, 调整 spec 适应新 tab 结构 (e.g. wrapper 内 query selector 改用 `.el-tab-pane` 内查找)。

- [ ] **Step 4: TypeScript compile check**

```bash
cd web-admin && npx vue-tsc --noEmit 2>&1 | grep -E "data-completeness|data-quality" | head -10
```

Expected: 无错误。

- [ ] **Step 5: Commit**

```bash
bash scripts/safe-commit.sh "feat(餐饮 Phase B-1): data-completeness.vue 改造为 el-tabs (完整度+数据质量)" web-admin/src/views/restaurant/data-completeness.vue
```

---

## Section 6: Smoke E2E + Deploy + 真窗 Verify

### Task 11: B-1 Smoke E2E + Deploy + Verify (combined)

**Files:**
- Modify: `web-admin/data-fabric-c-smoke-e2e.spec.ts` (append B-1 test)

#### Sub-task 11.1: Append smoke E2E test

- [ ] **Step 1: Find Phase A B-1 适合插入位置**

```bash
grep -n "test(" web-admin/data-fabric-c-smoke-e2e.spec.ts | tail -5
```

记下最后一个 test() 行号。

- [ ] **Step 2: Append B-1 smoke test**

Edit `web-admin/data-fabric-c-smoke-e2e.spec.ts`, 在文件末尾 (最后 `});` 前) append:

```typescript
test('Phase B-1 outlier filter — admin 巡检 + dismiss + un-dismiss flow', async ({ page }) => {
  // 1. Login restaurant_admin1 (F002)
  await page.goto('http://139.196.165.140:8097/login');
  await page.fill('input[placeholder*="用户名"]', 'restaurant_admin1');
  await page.fill('input[placeholder*="密码"]', '123456');
  await page.click('button:has-text("登录")');
  await page.waitForURL(/dashboard|home/);

  // 2. Navigate to /restaurant/data-completeness
  await page.goto('http://139.196.165.140:8097/restaurant/data-completeness');
  await page.waitForSelector('.completeness-tabs', { timeout: 10000 });

  // 3. Switch to "数据质量" tab
  await page.click('.el-tabs__nav .el-tabs__item:has-text("数据质量")');
  await page.waitForTimeout(500);

  // 4. Wait for either outlier table OR empty state
  const hasOutliers = await page.locator('.outlier-table').isVisible().catch(() => false);
  const isEmpty = await page.locator('.el-empty').isVisible().catch(() => false);
  expect(hasOutliers || isEmpty).toBe(true);

  // 5. If outliers exist, test dismiss + un-dismiss flow
  if (hasOutliers) {
    const dismissBtns = page.locator('button:has-text("非异常")');
    const beforeCount = await dismissBtns.count();
    if (beforeCount > 0) {
      await dismissBtns.first().click();
      await page.waitForTimeout(2000);  // wait for API + reload

      // Expand dismissed折叠
      const expandBtn = page.locator('button:has-text("展开"), button:has-text("收起")').first();
      if (await expandBtn.isVisible()) {
        const text = await expandBtn.textContent();
        if (text?.includes('展开')) {
          await expandBtn.click();
          await page.waitForTimeout(500);
        }

        // Find first 恢复 button + click
        const restoreBtns = page.locator('button:has-text("恢复")');
        if (await restoreBtns.count() > 0) {
          await restoreBtns.first().click();
          await page.waitForTimeout(2000);
        }
      }
    }
  }

  // 6. Always verify summary card is rendered
  expect(await page.locator('.summary-card, [class*="summary"]').count()).toBeGreaterThan(0);
});
```

- [ ] **Step 3: Verify Playwright recognizes the test**

```bash
cd web-admin && npx playwright test data-fabric-c-smoke-e2e --list 2>&1 | grep -i "outlier\|B-1"
```

Expected: 找到 `Phase B-1 outlier filter` 这行。

- [ ] **Step 4: Commit (no run yet — needs deploy first)**

```bash
bash scripts/safe-commit.sh "feat(餐饮 Phase B-1): smoke E2E append (run after deploy)" web-admin/data-fabric-c-smoke-e2e.spec.ts
```

---

#### Sub-task 11.2: Deploy to test env

- [ ] **Step 1: Apply migrations to test smartbi_db**

(Already done in Tasks 1-2 if those steps were run. If skipped or rolled back, re-run those Step 2s.)

```bash
ssh root@47.100.235.168 "PGPASSWORD=smartbi_secure_password_2025 psql -h localhost -U smartbi -d smartbi_db -c '\d outlier_dismissals' | head -3"
ssh root@47.100.235.168 "PGPASSWORD=smartbi_secure_password_2025 psql -h localhost -U smartbi -d smartbi_db -c \"SELECT * FROM get_global_kpi_stats('wastage_cost_total', 30);\""
```

Expected: schema visible + function returns row.

- [ ] **Step 2: Deploy Python --env test**

```bash
./scripts/deploy/deploy-smartbi-python.sh --env test
```

Wait for deploy completion + health check pass.

- [ ] **Step 3: Verify Python test endpoint**

```bash
ssh root@47.100.235.168 "curl -s http://localhost:8084/health | head"
ssh root@47.100.235.168 "curl -s http://localhost:8084/openapi.json | python3 -c 'import sys, json; paths = list(json.load(sys.stdin)[\"paths\"].keys()); print([p for p in paths if \"outlier\" in p])'"
```

Expected: `/health` returns OK + outlier paths列出 (`/api/restaurant/outliers`, `/api/restaurant/outliers/dismiss`, `/api/restaurant/outliers/dismiss/{dismissal_id}`)。

- [ ] **Step 4: Deploy web-admin --env test**

```bash
./scripts/deploy/deploy-web-admin.sh --env test
```

Wait for atomic swap + HTTP 200 verify.

- [ ] **Step 5: Smoke test the FE**

```bash
curl -s "http://139.196.165.140:8097/" | head -3
```

Expected: HTML 内容 (web-admin home page)。

---

#### Sub-task 11.3: 真窗 verify on F002 + R_BEJ

- [ ] **Step 1: F002 (restaurant_admin1) — 完整流程**

Manual:
1. Browser open `http://139.196.165.140:8097`
2. Login: `restaurant_admin1` / `123456`
3. Navigate `/restaurant/data-completeness`
4. **Verify**: 看到 `<el-tabs>` with "数据完整度" + "数据质量" 两个 tab
5. **Verify**: tab 1 (完整度) 跟以前一样 render (header card + 6 module cards)
6. Click "数据质量" tab
7. **Verify**: 看到 summary card (待复核数 / 已确认数 / 样本不足数)
8. **Verify**: 如果有 outliers, 表格 render with 列: 日期/KPI/实际值/正常范围/偏离/操作
9. **Verify**: severity='high' 行颜色红, 'medium' 橙
10. **Verify**: 如果有 baselineSource='global' 行, "全网基线" badge 渲染
11. If outliers > 0: 点首行 "✓ 非异常" → toast OK → 列表刷新 → 该行进折叠区
12. 展开折叠区 → 点 "↺ 恢复" → toast OK → 该行回 outliers list
13. **Verify**: 二次访问页面 < 100ms (cache hit)

Document outcome:
```
F002 (restaurant_admin1):
- tabs: ✓
- tab 1 完整度: ✓ render正常
- tab 2 数据质量: ✓ summary + outliers (count: N) + dismiss + undismiss work
- baseline badge: <observed?>
- cache hit speed: <observed ms>
```

- [ ] **Step 2: R_BEJ (buerjun_admin) — N<10 fallback 路径**

Manual:
1. Logout + login `buerjun_admin` / `123456`
2. Navigate `/restaurant/data-completeness` → 数据质量 tab
3. **Verify**: R_BEJ 数据少, outliers 应该全部 baselineSource='global', 每行有 "全网基线" badge
4. **OR** insufficientKpis 数字 > 0 (本工厂 + 全网都 N<10)

Document outcome:
```
R_BEJ (buerjun_admin):
- baselineSource='global' 行数: <N>
- insufficientKpis: [<list>]
- "全网基线" badge: ✓/✗
```

- [ ] **Step 3: Cross-factory verify**

Manual (F002 admin tries R_BEJ):
1. Login `restaurant_admin1` (F002)
2. Open browser DevTools, run `fetch('/api/restaurant/outliers?factoryId=R_BEJ').then(r=>r.json()).then(console.log)`
3. **Verify**: 返 403 + "非 platform_admin 仅可访问自己工厂的 outlier (当前工厂 'F002')" 中文 detail

Document outcome:
```
Cross-factory check: F002 → R_BEJ = ✓ 403
```

- [ ] **Step 4: Run smoke E2E against deployed test env**

```bash
cd web-admin && npx playwright test data-fabric-c-smoke-e2e -g "Phase B-1" --reporter=list
```

Expected: pass (browser 模拟同 Step 1 流程)。如果 fail, 看 trace 调试。

- [ ] **Step 5: 写 verify report**

Append to `数据织网/implementation/restaurant-phase-b1-plan-2026-04-28.md` 末尾 (或新建 `restaurant-phase-b1-verify-report-2026-04-28.md`):

```markdown
## B-1 真窗 Verify Report (test env)

**Date**: YYYY-MM-DD
**Deploy commits**: <commit hashes>
**Tester**: <name>

### F002 (restaurant_admin1)
- ...

### R_BEJ (buerjun_admin)
- ...

### Cross-factory
- ...

### Bugs found + fixed
- ...

### Final state
- 11 tasks complete, X/X tests pass, deploy stable on test env (8084 + 8097).
- Prod deploy: AWAITING USER AUTHORIZATION.
```

- [ ] **Step 6: Commit verify report**

```bash
bash scripts/safe-commit.sh "docs(餐饮 Phase B-1): 真窗 verify report on test env" 数据织网/implementation/restaurant-phase-b1-plan-2026-04-28.md
```

---

## Final State Checklist

- [ ] All 11 tasks completed
- [ ] All tests pass: pytest (~9 outlier_stats + ~4 outlier_service + ~8 outlier_api = ~21) + vitest (4) + Playwright smoke (1) = ~26 tests
- [ ] Test env (8084 + 8097) deployed + verified
- [ ] F002 + R_BEJ both verified end-to-end
- [ ] Cross-factory 403 verified
- [ ] No prod deploy (awaiting user authorization)
- [ ] Verify report written

---

## Plan Self-Review

| 检查项 | 状态 | 备注 |
|---|---|---|
| Spec coverage — Q1-Q6 决策 | ✅ | Section 1-5 实现 6 题决策 |
| Spec coverage — Reviewer R1-R5 修正 | ✅ | R1 (full schema) Task 1, R2 (baselineSource) Tasks 5+8+9, R3 (utils 双 export) Task 3, R4 (round n bucket) Task 2, R5 (KPI_KINDS 配置) Task 4 |
| TDD pattern — 每个有代码的 task 都有 test | ✅ | Tasks 3/4/5/6/9 都是 test → fail → impl → pass → commit; Tasks 1/2/7/8/10/11 是配置/集成/部署不需 TDD |
| RLS GUC + transaction 每处 query 强制 | ✅ | Task 4 step 6 + Task 5 step 5 + Task 6 step 5 都有 grep self-check |
| safe-commit.sh 每个 commit 强制 | ✅ | 11 tasks 共 ~12 commits, 全部 `bash scripts/safe-commit.sh` |
| 跨任务命名一致 | ✅ | OutlierService / DetectedOutlier / OutlierAlgorithm / DEFAULT_KPI_KINDS / KPI_LABELS / IQR_MULTIPLIER 在 Tasks 3-6 一致 |
| 前后端字段名 | ✅ | API snake_case (Python) → camelCase (JSON via pythonFetch) → camelCase (TS interface) 一致 |
| 没有 placeholder ("TBD" / "implement later" / "see above") | ✅ | 完整 SQL/Python/TS/Vue 代码示例; 仅 Task 1/2 step 1 + Task 9 step 3 引用 spec 文件 §3.2/§3.3/§6.1.2 (实现时直接 copy 完整代码), 这是 DRY (避免代码块重复 spec 文件) 不是 placeholder |
| 部署顺序 + 依赖 | ✅ | Section 6 sub-tasks 按 migrations → backend deploy → frontend deploy → 真窗 verify 顺序; backend 依赖 frontend 同时可并行 (Tasks 8-10 跟 Tasks 3-7 独立) |
| Backlog refs from spec | ✅ | NotImplementedError ("Phase B-N backlog") in Task 4 detect_per_dim; spec §11.2 列了完整 backlog |

**Self-review 结论**: 计划完整, 无 blocker, 直接 ready for execution。

---

**作者**: Claude Opus 4.7 + Steve (B-1 brainstorm + reviewer audit + plan)
**Status**: Ready for execution (subagent-driven recommended)

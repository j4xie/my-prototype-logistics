# T6.6 Phase B — `/analysis/production` Endpoint Port Detail Design

**Phase**: T6.6 Phase B (per-endpoint detail; design only — execution blocked until T6.5 Phase B + C complete, ~July 2026)
**Status**: Detail spec for Chat A in PR #196 §6.2 sister-chat plan
**Author**: Chat M (T6.6 Phase B production-detail dispatch, 2026-05-09)
**Predecessor**: PR #196 T6.6 Phase A overall design + PR #180 T6.6 4-endpoint base spec
**Dependencies**: Phase 2A `python-java-port.md` Rules 1-12; existing module pattern in `backend/python/smartbi_compat/api/analysis_finance.py`

---

## 0. TL;DR

This doc resolves the per-endpoint detail blocker that PR #196 §3.1 left open: how exactly does Phase B Chat A port `/analysis/production` to Python with byte-shape parity?

**Three Phase A findings re-verified by Chat M**:

1. **All 9 `ProductionAnalysisServiceImpl` entry points are mock data** (verified by Chat M: 9× `generateMockProductionData(factoryId, startDate, endDate)` calls at lines 80, 129, 146, 213, 224, 309, 318, 330, 339). NO real DB read. Port becomes mechanical mirror of mock generator + 4-branch controller dispatch.

2. **Mock generator seed is `Random(factoryId.hashCode())`** (Java line 351). Stable per factory_id, but **NOT trivially reproducible in Python** — see §3 BLOCKER.

3. **Controller is a 4-branch dispatcher** (Java line 334-368) on `analysisType` query param: `oee` / `efficiency` / `equipment` / default (overview). Each branch builds a `HashMap` with `startDate` + `endDate` + 1-3 sub-method outputs.

**§3 BLOCKER (the reason this spec exists)**: Java `String.hashCode()` and `java.util.Random` cannot be reproduced by Python's built-in `hash()` and `random.Random` because (a) Python `hash(str)` is salted via `PYTHONHASHSEED` and changes per process, and (b) Java's `Random` is a 48-bit LCG (`seed * 0x5DEECE66D + 0xB`), Python's is a Mersenne Twister. Without bit-exact reproduction, every numeric value in the mock output diverges and no golden parity is possible. **Solution**: implement `_java_string_hashcode(str)` + `_JavaRandom` LCG (~60 LOC total, mechanical) before any other port work. Phase B Chat A Day 0 task.

**Effort**: confirms PR #196 §3.1 estimate of **1.5-2 person-days**. See §7 breakdown.

**Goldens**: 4 dispatch branches × 2 factories = **8 goldens** under `tests/fixtures/java-smartbi-golden/`.

**⛔ HOLD** — same as PR #196 §9: design doc only, no impl, no deploy.

---

## 1. Java Implementation Actual Behavior

### 1.1 Service surface (`ProductionAnalysisServiceImpl.java`, 1122 LOC)

| Method | Branch | Output type | Notes |
|---|---|---|---|
| `getOEEOverview(factoryId, start, end)` | default | `DashboardResponse` | KPI cards + 3 charts + 2 rankings + AI insights + suggestions |
| `getOEEMetrics(...)` | `oee` | `List<MetricResult>` (10 metrics) | plannedRuntime, actualRuntime, downtime, availability, theoreticalOutput, actualOutput, performance, goodUnits, qualityRate, OEE |
| `getProductionEfficiency(...)` | `efficiency` | `List<MetricResult>` (3 metrics) | capacityUtilization, cycleTime, achievementRate |
| `getEquipmentUtilization(...)` | `equipment` | `List<MetricResult>` (5 metrics) | utilization, downtime, failureCount, MTBF, MTTR |
| `getProductionLineRanking(...)` | `efficiency` | `List<RankingItem>` | 4 lines, sorted by efficiency DESC |
| `getEquipmentRanking(...)` | `equipment` | `List<RankingItem>` | 5 equipments, sorted by OEE DESC |
| `getOEETrendChart(period)` | `oee` (DAY) | `ChartConfig` (LINE) | aggregated by day/week/month |
| `getProductionLineComparisonChart(...)` | (overview only) | `ChartConfig` (BAR) | 4 lines × 4 metrics |
| `getDowntimeDistributionChart(...)` | `equipment` | `ChartConfig` (PIE) | 5 reasons summed, sorted DESC |

### 1.2 Threshold constants (Java line 56-70 — all integer Decimal, Rule 7 safe)

```java
OEE_RED_THRESHOLD          = new BigDecimal("65");    // <65 RED, <85 YELLOW, else GREEN
OEE_YELLOW_THRESHOLD       = new BigDecimal("85");
AVAILABILITY_RED           = new BigDecimal("80");
AVAILABILITY_YELLOW        = new BigDecimal("90");
PERFORMANCE_RED            = new BigDecimal("75");
PERFORMANCE_YELLOW         = new BigDecimal("90");
QUALITY_RED                = new BigDecimal("95");
QUALITY_YELLOW             = new BigDecimal("98");
```

All integer-valued → Python may compare via `float(value) < 65` per Rule 7 default; no Decimal comparison needed.

### 1.3 BigDecimal arithmetic constants

```java
SCALE         = 4
DISPLAY_SCALE = 2
ROUNDING_MODE = HALF_UP
```

Rule 10 active: every `divide(scale=4, HALF_UP).multiply(100)` chain must mirror Java intermediate-rounding (NOT `(a/b*100).quantize(scale=2)`).

### 1.4 OEE formula (Java line 449-451 + 562-563 + 640-641 + 731-732 + 776-777)

```
OEE = availability × performance × quality / 10000
```

`/10000` because each of availability/performance/quality is in 0-100 range (already multiplied by 100). Mirror Python:

```python
oee = (availability * performance * quality / Decimal("10000")).quantize(Decimal("0.0001"), ROUND_HALF_UP)
```

**Rule 10 critical**: do NOT pre-multiply or compose differently. Java applies `.divide` + `.multiply` in this exact order; Python must mirror.

### 1.5 Controller dispatch (`SmartBIAnalysisController.java` line 334-368)

```java
result = new HashMap<>();
result.put("startDate", startDate);  // LocalDate
result.put("endDate",   endDate);    // LocalDate

switch (analysisType) {
  case "oee":        result.put("metrics",   getOEEMetrics(...));
                     result.put("trendChart", getOEETrendChart(..., "DAY"));    break;
  case "efficiency": result.put("metrics",   getProductionEfficiency(...));
                     result.put("ranking",    getProductionLineRanking(...));    break;
  case "equipment":  result.put("metrics",      getEquipmentUtilization(...));
                     result.put("ranking",       getEquipmentRanking(...));
                     result.put("downtimeChart", getDowntimeDistributionChart(...)); break;
  default:           result.put("overview",   getOEEOverview(...));               break;
}
```

**HashMap iteration order is hash-based** (NOT insertion order). Jackson serializes by iteration order → byte position of `startDate` / `endDate` / `metrics` is non-deterministic across JVM runs. Phase 2A dict-eq tolerates this (Rule 4 dict-eq gate official standard). **Strict-byte gate would not** — but T6.6 stays Phase 2A per PR #180 §2.5.

---

## 2. Python Target File Design

### 2.1 New file

```
backend/python/smartbi_compat/api/analysis_production.py   # ~600-800 LOC
```

### 2.2 Module layout (mirror `analysis_finance.py`)

```python
"""T6.6 Phase B /analysis/production endpoint port (mock-data parity).

Java reference:
  - Controller: SmartBIAnalysisController.getProductionAnalysis line 334-368
  - Service:    ProductionAnalysisServiceImpl (1122 LOC, 9 mock-data methods)
  - DTOs:       DashboardResponse, MetricResult, ChartConfig, RankingItem, AIInsight

Phase 2A byte-shape gate: dict-eq (per python-java-port.md Rule 4)
Mock generator: deterministic via _JavaRandom + _java_string_hashcode (§3)
Spec: docs/superpowers/specs/2026-05-09-t6-6-production-port-detail.md
"""
from __future__ import annotations
import logging
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from fastapi import APIRouter, Depends, Query

from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.schema_compat import _decimal_to_number, _java_isoformat, wrap_response
from smartbi_compat.intent.java_random import _JavaRandom, _java_string_hashcode  # NEW (§3)

logger = logging.getLogger(__name__)
router = APIRouter()

# ---- Section 1: Threshold constants (Java line 56-70) ----
OEE_RED_THRESHOLD          = Decimal("65")
OEE_YELLOW_THRESHOLD       = Decimal("85")
AVAILABILITY_RED_THRESHOLD = Decimal("80")
# ...

# ---- Section 2: Mock data generator (§3) ----
_PRODUCTION_LINES   = ("产线A", "产线B", "产线C", "产线D")
_EQUIPMENTS         = ("设备1", "设备2", "设备3", "设备4", "设备5")
_DOWNTIME_REASONS   = ("计划维护", "设备故障", "物料短缺", "换型调整", "质量问题")

def _generate_mock_production_data(factory_id: str, start_date: date, end_date: date) -> list[dict]:
    """Mirror Java generateMockProductionData (line 349-410) byte-for-byte."""
    rng = _JavaRandom(_java_string_hashcode(factory_id))
    data: list[dict] = []
    days_between = (end_date - start_date).days
    for i in range(days_between + 1):
        d = start_date.replace(...) + timedelta(days=i)  # mirror Java startDate.plusDays
        for line in _PRODUCTION_LINES:
            for equipment in _EQUIPMENTS:
                # Random consumption order (CRITICAL for parity):
                planned_runtime    = Decimal(8 + rng.next_int(8))
                downtime_raw       = Decimal(str(rng.next_double() * 2)).quantize(...)
                actual_runtime     = planned_runtime - downtime_raw
                theoretical_output = 100 + rng.next_int(100)
                actual_output      = int(theoretical_output * (0.8 + rng.next_double() * 0.2))
                planned_output     = int(theoretical_output * 0.95)
                good_units         = int(actual_output * (0.95 + rng.next_double() * 0.05))
                failure_count      = rng.next_int(3)
                downtime_reason    = _DOWNTIME_REASONS[rng.next_int(len(_DOWNTIME_REASONS))]
                # Build LinkedHashMap-equivalent dict (insertion order = Java line 364 order)
                data.append({"factoryId": factory_id, "date": d, "productionLine": line, ...})
    return data

# ---- Section 3: 4 sub-method ports (mirror Java OEE / efficiency / equipment / overview) ----
def _get_oee_metrics(data: list[dict]) -> list[dict]:        ...
def _get_production_efficiency(data: list[dict]) -> list[dict]: ...
def _get_equipment_utilization(data: list[dict]) -> list[dict]: ...
def _get_oee_overview(...) -> dict:                          ...
def _get_oee_trend_chart(data, period: str) -> dict:         ...
def _get_production_line_ranking(data) -> list[dict]:        ...
def _get_equipment_ranking(data) -> list[dict]:              ...
def _get_downtime_distribution_chart(data) -> dict:          ...
def _get_production_line_comparison_chart(data) -> dict:     ...

# ---- Section 4: Controller route (mirror Java line 334-368 dispatch) ----
@router.get("/analysis/production")
async def get_production_analysis(
    factory_id: str,
    start_date: date = Query(..., alias="startDate"),
    end_date: date   = Query(..., alias="endDate"),
    analysis_type: str | None = Query(None, alias="analysisType"),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    data = _generate_mock_production_data(factory_id, start_date, end_date)
    result: dict[str, Any] = {"startDate": _java_isoformat_date(start_date),
                              "endDate":   _java_isoformat_date(end_date)}
    if analysis_type == "oee":
        result["metrics"]    = _get_oee_metrics(data)
        result["trendChart"] = _get_oee_trend_chart(data, "DAY")
    elif analysis_type == "efficiency":
        result["metrics"] = _get_production_efficiency(data)
        result["ranking"] = _get_production_line_ranking(data)
    elif analysis_type == "equipment":
        result["metrics"]      = _get_equipment_utilization(data)
        result["ranking"]      = _get_equipment_ranking(data)
        result["downtimeChart"] = _get_downtime_distribution_chart(data)
    else:
        result["overview"] = _get_oee_overview(factory_id, start_date, end_date, data)
    return wrap_response(result)
```

---

## 3. Mock Data Generator Reproducibility (BLOCKER)

### 3.1 The problem

Java `generateMockProductionData` (line 349):

```java
Random random = new Random(factoryId.hashCode());
```

Two reproducibility hazards:

| Hazard | Java behavior | Python default behavior | Bit-exact? |
|---|---|---|---|
| **String → int seed** | `String.hashCode()` deterministic algorithm `s[0]*31^(n-1) + … + s[n-1]` | `hash(str)` salted via `PYTHONHASHSEED`, changes per process unless seed pinned | ❌ NO |
| **Seeded PRNG output** | `java.util.Random` is 48-bit LCG: `seed = (seed × 0x5DEECE66D + 0xB) & ((1<<48)-1)` | Python `random.Random` is Mersenne Twister (state size 624×32 bits) | ❌ NO |

**Consequence without fix**: every numeric field in `_generate_mock_production_data` diverges from Java output. Goldens will not match. Phase 2A dict-eq parity fails on the first comparison.

### 3.2 Solution: port Java primitives to Python

**Place in shared module** `backend/python/smartbi_compat/intent/java_random.py` (Phase A §2.2 already plans `intent/` package; this primitive serves both `/query` rule engine and `/analysis/production` mock generator).

```python
# java_random.py — bit-exact mirror of java.util.Random + java.lang.String.hashCode

def _java_string_hashcode(s: str) -> int:
    """Mirror java.lang.String.hashCode — int32 with overflow wrap.

    Algorithm: h = 0; for c in s: h = 31*h + ord(c); h &= 0xFFFFFFFF (signed int32).
    Returns Python int in [-2^31, 2^31-1].
    """
    h = 0
    for c in s:
        h = (31 * h + ord(c)) & 0xFFFFFFFF
    if h >= 0x80000000:
        h -= 0x100000000
    return h


class _JavaRandom:
    """Mirror java.util.Random — 48-bit LCG.

    Algorithm (per JDK source):
      seed = (initialSeed ^ 0x5DEECE66D) & ((1 << 48) - 1)
      next(bits): seed = (seed * 0x5DEECE66D + 0xB) & ((1 << 48) - 1)
                  return seed >> (48 - bits)
      nextInt(bound): rejection-sampling loop on next(31)
      nextDouble(): ((next(26) << 27) + next(27)) / float(1 << 53)
    """
    _MULTIPLIER = 0x5DEECE66D
    _ADDEND     = 0xB
    _MASK       = (1 << 48) - 1

    def __init__(self, seed: int):
        self.seed = (seed ^ self._MULTIPLIER) & self._MASK

    def _next(self, bits: int) -> int:
        self.seed = (self.seed * self._MULTIPLIER + self._ADDEND) & self._MASK
        return self.seed >> (48 - bits)

    def next_int(self, bound: int) -> int:
        # Mirror JDK Random.nextInt(int bound) exactly — including power-of-2 fast path
        if bound <= 0:
            raise ValueError("bound must be positive")
        if (bound & -bound) == bound:  # power of 2
            return (bound * self._next(31)) >> 31
        bits = self._next(31)
        val = bits % bound
        while bits - val + (bound - 1) < 0:  # rejection
            bits = self._next(31)
            val = bits % bound
        return val

    def next_double(self) -> float:
        return ((self._next(26) << 27) + self._next(27)) / float(1 << 53)
```

### 3.3 Reproducibility verification (Phase B Chat A Day 0)

Before any other port work, verify bit-exact reproduction with a one-shot Java program:

```java
// Java: print known sequence for "F001"
Random r = new Random("F001".hashCode());  // hashCode = 2153483
System.out.println("hashCode: " + "F001".hashCode());
System.out.println("nextInt(8): " + r.nextInt(8));
System.out.println("nextDouble: " + r.nextDouble());
System.out.println("nextInt(100): " + r.nextInt(100));
```

```python
# Python: must produce IDENTICAL values
assert _java_string_hashcode("F001") == 2153483
rng = _JavaRandom(2153483)
assert rng.next_int(8)    == <java_value>
assert abs(rng.next_double() - <java_value>) < 1e-15
assert rng.next_int(100)  == <java_value>
```

If any assertion fails, port the Java primitive correctly before continuing. Pytest fixture `tests/test_java_random.py` covers this gate.

### 3.4 Random consumption order (CRITICAL — must match Java exactly)

Per `_generate_mock_production_data` inner loop (Java line 359-403), the Random is consumed in this **fixed order** per (date, line, equipment) tuple:

```
1. nextInt(8)           — plannedRuntime offset (8 + result)
2. nextDouble()         — downtime raw value (* 2 then quantize SCALE=4 HALF_UP)
3. nextInt(100)         — theoreticalOutput offset (100 + result)
4. nextDouble()         — actualOutput multiplier (0.8 + result * 0.2)
5. nextDouble()         — goodUnits multiplier (0.95 + result * 0.05)
6. nextInt(3)           — failureCount
7. nextInt(5)           — downtimeReason index (length of _DOWNTIME_REASONS)
```

**Total: 7 random calls per record × 4 lines × 5 equipment × N days**. For default 30-day range = 4200 random calls. Any reordering changes downstream values.

Iteration order (outer): `date asc` → `line A→B→C→D` → `equipment 1→2→3→4→5`. Mirror via Python nested for loops in **same order**.

---

## 4. Endpoint Shape Spec (per dispatch branch)

### 4.1 `analysisType=oee`

```json
{
  "success": true,
  "data": {
    "startDate": "2026-04-01",
    "endDate":   "2026-04-30",
    "metrics":    [<10 MetricResult>],
    "trendChart": <ChartConfig LINE>
  },
  "message": "ok"
}
```

`metrics` order (Java `calculateOEEDetailedMetrics` line 503-569): plannedRuntime → actualRuntime → downtime → availability → theoreticalOutput → actualOutput → performance → goodUnits → qualityRate → OEE. Python list **must** preserve this order.

`trendChart`:

```json
{
  "chartType":   "LINE",
  "title":       "OEE 趋势",
  "xaxisField":  "date",          // Rule 9 lowercase 'a'
  "yaxisField":  "oee",           // Rule 9 lowercase 'a'
  "seriesField": "metric",
  "data": [{"date": "2026-04-01", "oee": 56.78, "availability": 95.00, "performance": 84.45, "quality": 96.00}, …],
  "options": {"showLegend": true, "multiLine": true, "yAxisMax": 100}
}
```

### 4.2 `analysisType=efficiency`

```json
{"data": {"startDate": …, "endDate": …, "metrics": [<3 MetricResult>], "ranking": [<4 RankingItem>]}}
```

`metrics`: capacityUtilization → cycleTime → achievementRate.
`ranking`: 4 production lines sorted by efficiency DESC, `rank` field 1-4.

### 4.3 `analysisType=equipment`

```json
{"data": {"startDate": …, "endDate": …,
          "metrics":       [<5 MetricResult>],
          "ranking":       [<5 RankingItem>],
          "downtimeChart": <ChartConfig PIE>}}
```

`metrics`: utilization → downtime → failureCount → MTBF → MTTR.
`ranking`: 5 equipments sorted by OEE DESC, rank 1-5.
`downtimeChart`: 5 reasons summed, sorted by total DESC.

### 4.4 default (no `analysisType` or unknown) = overview

```json
{"data": {"startDate": …, "endDate": …, "overview": <DashboardResponse>}}
```

`DashboardResponse` shape (mirror PR #196 Phase A §3.1 + Lombok `@Data` per Rule 9):

```json
{
  "period":       "CUSTOM",
  "startDate":    "2026-04-01",
  "endDate":      "2026-04-30",
  "kpiCards":     [<4 KPICard>: OEE / availability / performance / qualityRate],
  "charts":       {"oee_trend": <ChartConfig>, "production_line_comparison": <ChartConfig>, "downtime_distribution": <ChartConfig>},
  "rankings":     {"equipment": [<5 RankingItem>], "production_line": [<4 RankingItem>]},
  "aiInsights":   [<1-3 AIInsight>],
  "suggestions":  [<0-3 strings>],
  "generatedAt":  "2026-05-09T15:30:00",
  "lastUpdated":  "2026-05-09T15:30:00"
}
```

**Rule 11 active** for `generatedAt` / `lastUpdated` LocalDateTime fields → use `_java_isoformat()` (drops trailing-zero microseconds). See §5 Q4 about timestamp golden challenge.

---

## 5. Byte-Shape Parity Gate

### 5.1 Phase 2A dict-eq (per PR #180 §2.5 + `python-java-port.md` Rule 4)

8 goldens recorded via `scripts/record-java-golden.sh`:

```
tests/fixtures/java-smartbi-golden/
  analysis-production-F999-default.json     # overview branch, factory F999
  analysis-production-F999-oee.json
  analysis-production-F999-efficiency.json
  analysis-production-F999-equipment.json
  analysis-production-F001-default.json
  analysis-production-F001-oee.json
  analysis-production-F001-efficiency.json
  analysis-production-F001-equipment.json
```

**Date range pinned** for goldens: `startDate=2026-04-01`, `endDate=2026-04-30` (30 days × 4 lines × 5 equipment = 600 records). Reproducibility requires fixed date range.

### 5.2 Rules sweep (per `python-java-port.md`)

| Rule | Applies? | Where |
|---|---|---|
| 1 (`is not None` not `or`) | YES | `_get_oee_overview` insight builder if any null fallback |
| 2 (WEEK calendar year) | NO | period=DAY default for overview; weekly aggregation only via explicit param |
| 3 (1:1 fn signature) | YES | sub-method signatures mirror Java `(factory, start, end)` not wrappers |
| 4 (Decimal serialization) | YES | All BigDecimal outputs use `_decimal_to_number` |
| 5 (`SELECT *`) | NO | No SQL — mock data only |
| 6 (None-check helpers) | NO | No SQL helpers |
| 7 (Decimal threshold compare) | NO | All 4 thresholds (OEE/Avail/Perf/Quality) are integers, `float()` compare safe |
| 8 (`Map.of(N)` key order) | YES | `chartType`/`title`/`xaxisField` etc. — record golden first, mirror dict literal order |
| 9 (Lombok `@Data` + Jackson) | YES | `MetricResult`, `KPICard`, `ChartConfig`, `RankingItem`, `AIInsight`, `DashboardResponse` all `@Data`. Verify field name lowercase quirk (e.g., `xaxisField` not `xAxisField`) via golden |
| 10 (BigDecimal divide-multiply) | YES | OEE/availability/performance/quality ratio computations + completionRate/efficiency in rankings — apply `(a/b).quantize(0.0001, HALF_UP) * 100` pattern |
| 11 (LocalDateTime µs trim) | YES | `generatedAt`, `lastUpdated` in `DashboardResponse` — use `_java_isoformat()` |
| 12 (`String.format` HALF_UP) | YES | `MetricResult.formattedValue` (e.g., `"56.78%"`, `"3.20 分钟/件"`) — use `_format_decimal_half_up` not f-string `:.Nf` |

### 5.3 Pre-flight Day 0 verification

Before recording goldens or writing port code, prove bit-exact mock parity:

1. Run Java: `mvn test -Dtest=ProductionMockGeneratorParityTest` (write a one-off test that prints first 20 records' raw values for F001 + F999).
2. Run Python: `pytest tests/test_java_random.py` against the same printed values.
3. If diverge → fix `_JavaRandom` / `_java_string_hashcode` until match.
4. **Only then** start porting `_generate_mock_production_data`.

---

## 6. Tests Outline

| Test file | Scope | Fixture |
|---|---|---|
| `tests/test_java_random.py` | `_java_string_hashcode` + `_JavaRandom.next_int` + `_JavaRandom.next_double` parity | known Java sequence printouts (committed as `tests/fixtures/java-random-known-sequences.json`) |
| `tests/test_analysis_production_mock_gen.py` | `_generate_mock_production_data` first-record + last-record value parity for F001 / F999 / F002 | golden samples |
| `tests/test_analysis_production_endpoint.py` | 4 dispatch branches × 2 factories byte-shape parity vs goldens | 8 goldens |
| `tests/test_analysis_production_negative.py` | unknown `analysisType` falls through to default; missing date params returns 422 | none |
| `tests/test_analysis_production_thresholds.py` | OEE/availability/performance/quality alert level boundaries (RED/YELLOW/GREEN) | synthetic data |

Total: **~5 test files, ~30-40 test cases**.

---

## 7. Effort Estimate

Confirms PR #196 §3.1: **1.5-2 person-days**.

| Day | Hours | Activity |
|---|---|---|
| Day 0 | 3-4h | Port `_java_string_hashcode` + `_JavaRandom` to `intent/java_random.py`. Write Java one-shot dump program. Verify bit-exact parity for F001/F999 first 20 random calls. ⛔ HARD GATE — if diverge, fix before continuing. |
| Day 1 morning | 3h | Port `_generate_mock_production_data`. Verify against Java dump (first record + last record value match). |
| Day 1 afternoon | 3h | Port 4 sub-methods (`_get_oee_metrics`, `_get_production_efficiency`, `_get_equipment_utilization`, `_get_oee_overview`) + 3 chart builders + 2 rankings + threshold helpers. Apply Rules 4/9/10/11/12. |
| Day 2 morning | 2h | Wire FastAPI `@router.get("/analysis/production")` with 4-branch dispatch. Add to `main.py` router includes. |
| Day 2 afternoon | 2h | Record 8 goldens via `scripts/record-java-golden.sh`. Run dict-eq parity diff (`pytest -k production_endpoint`). Fix Rule 9 / Rule 8 drift surfaced by golden. |
| Day 2 wrap | 1h | Reviewer audit per Rules 1-12. Test env smoke. PR description. |

**Buffer**: +0.5d if `_JavaRandom` unexpectedly diverges (e.g., signed-vs-unsigned bug in `_next` shift).

---

## 8. Open Questions

| # | Question | Default if no answer |
|---|---|---|
| Q1 | Mock parity vs real-DB upgrade — Steve sign-off needed before Phase B kickoff (PR #196 §7 Q1) | **Mock parity** (recommended — 1.5-2d vs ~5d for real-DB scope creep). If real-DB chosen later, port becomes Phase 2C scope, NOT T6.6. |
| Q2 | `_JavaRandom` reproducibility — does my LCG implementation actually match JDK 21 byte-for-byte across all 7 random calls per record? | Verified Day 0 via Java one-shot dump (§3.3). If any divergence, do NOT proceed. |
| Q3 | HashMap iteration order in controller `result` map — `startDate`/`endDate`/`metrics`/`trendChart` byte position non-deterministic across JVM runs. dict-eq tolerates. | Phase 2A dict-eq → no action. Phase 3 strict-byte would force `LinkedHashMap` in Java AND insertion-ordered Python dict literal. |
| Q4 | `DashboardResponse.generatedAt` / `lastUpdated` are `LocalDateTime.now()` — every request emits a different timestamp → goldens drift each recording. | Patch `record-java-golden.sh` to substitute `generatedAt`/`lastUpdated` with frozen sentinel `"FROZEN_TS"` post-record; Python test substitutes same before dict-eq compare. OR use `freezegun` in pytest fixture. **Recommend frozen-sentinel approach** — works without monkey-patching Python clock. |
| Q5 | `_DOWNTIME_REASONS` Chinese strings — Java `String[]` literal order matters for Random consumption parity. Mirror exactly: `("计划维护", "设备故障", "物料短缺", "换型调整", "质量问题")`. | Hardcode in Python, inline-comment with Java line ref. Add unit test asserting tuple order against Java dump. |
| Q6 | `MetricResult.AlertLevel` enum vs string — Java emits `.name()` strings (`"RED"`/`"YELLOW"`/`"GREEN"`). Python mirror via constants. | String constants `_ALERT_LEVEL_RED = "RED"` etc. (or single source of truth in `schema_compat`). |
| Q7 | `aiInsights` and `suggestions` content — these are dynamic Chinese strings from `generateOEEInsights` / `generateOEESuggestions` (Java line 843-965). They reference computed values like `String.format("%.1f%%", oee.doubleValue())` — Rule 12 active. | Port verbatim with `_format_decimal_half_up` for percent rendering. Verify via golden. |
| Q8 | `KPICard` derived from `MetricResult` via `convertToKPICards` (Java line 575-621) — Lombok @Data → Rule 9 quirks possible (e.g., `rawValue` field name decapitalization). | Record golden, mirror exact field names. Likely safe (no consecutive uppercase). |
| Q9 | Worker process boundary — `cretas-python.service` runs `--workers 2`; goldens must be reproducible regardless of which worker handles request. Mock generator is deterministic by `factoryId.hashCode()` so safe. | No action. |
| Q10 | If T6.5 Phase B 410-stubs `/analysis/production` Java endpoint before T6.6 Phase B Python ships — gap window where 75 customer factories see 410 instead of legacy Java. | T6.5 Phase B excludes the 4 NOT_SAFE_FALLTHROUGH endpoints per PR #178 §6.4 + PR #180 §2.6. Verify in T6.5 Phase B marching order before merge. |

---

## 9. ⛔ HOLD Blocks

- ⛔ This is a **detail design / planning doc only** — no code, no deploys.
- ⛔ Phase B kickoff requires T6.5 Phase B + C complete ≥30 days (per PR #180 §1).
- ⛔ Q1 mock-parity sign-off from Steve required before any port code.
- ⛔ Q2 `_JavaRandom` Day 0 reproducibility gate is mandatory — do NOT start `_generate_mock_production_data` port before bit-exact verification passes.
- ⛔ `_java_string_hashcode` + `_JavaRandom` belong in `backend/python/smartbi_compat/intent/java_random.py` (shared with `/query` rule engine per PR #196 §2.2). Coordinate with Chat C (`/query` owner) to avoid concurrent edits to that file (per `concurrent-edit-safety.md` Rule 2 — isolated worktree mandatory).

---

## 10. Discovery Findings (Chat M re-verification of PR #196 §3.1)

| Finding | Source | Implication |
|---|---|---|
| 9/9 entry points use `generateMockProductionData` | grep `service/smartbi/impl/ProductionAnalysisServiceImpl.java` line 80, 129, 146, 213, 224, 309, 318, 330, 339 | Confirmed PR #196; mechanical mock-mirror viable |
| Mock seed is `Random(factoryId.hashCode())` (Java line 351) | Read line 349-410 | §3 BLOCKER: bit-exact Python reproduction needed |
| Random consumption order: 7 calls per (date,line,equipment) tuple (§3.4) | Read line 372-402 | Mirror exact order in Python; any reordering breaks parity |
| 4 product lines × 5 equipments = 20 records per day | Java line 353-354 | F001 30-day golden = 600 records, 4200 random calls |
| `_DOWNTIME_REASONS` is `String[]` literal — Random index drives selection | Java line 355, 402 | Tuple order matters (Q5) |
| All 4 OEE thresholds are integer Decimal | Java line 56-70 | Rule 7 default `float()` compare safe |
| BigDecimal `SCALE=4`, `DISPLAY_SCALE=2`, `HALF_UP` | Java line 52-54 | Rule 10 active for divide-multiply chains |
| Controller HashMap iteration order is non-deterministic | Java line 345 + JVM HashMap impl | Phase 2A dict-eq tolerates; Phase 3 strict-byte would not |
| `DashboardResponse.generatedAt`/`lastUpdated` are `LocalDateTime.now()` per request | Java line 117-118 | Q4 frozen-sentinel needed for goldens |
| `MetricResult.formattedValue` uses `String.format("%.1f%%", ...)` | Java line 166, 200, 244, 458, 469, 480, 491 | Rule 12 active — `_format_decimal_half_up` |

---

**End of T6.6 Phase B `/analysis/production` Endpoint Port Detail Design**

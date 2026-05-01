# Phase 2A `/analysis/region` per-type 真实现 — Design Spec

**作者**: Chat 5 (`phase2a/spec-region`)
**日期**: 2026-05-01
**状态**: Spec-only PR (impl 待 Wave 1 PR-As 落地后另起 chat)
**Sister specs**:
- Tier 2 双胞胎: Chat 4 department spec `docs/superpowers/specs/2026-05-01-phase2a-analysis-department-design.md` (待 merge)
- Wave 1 finance: receivable PR #33, budget PR #34
- Tier 1 finance: cost PR #25, profit PR #21+22, payable PR #18

**Endpoint scope**: 单一 endpoint `GET /api/mobile/{factoryId}/smart-bi/analysis/region`,composite path 4 sub-service。

---

## 1. 背景 + 范围锁定

### 1.1 Endpoint contract

```
GET /api/mobile/{factory_id}/smart-bi/analysis/region
  ?startDate=YYYY-MM-DD
  &endDate=YYYY-MM-DD
  &region=<ignored-by-composite>
```

Java reference: `SmartBIAnalysisController.getRegionAnalysis` (行 181-218)。Java JWT 鉴权 + factoryId 路径参数(已经被 `verify_jwt_and_factory` 强制 enforce)。

### 1.2 输出 shape (composite path,prod)

```python
{
    "ranking": [...],            # List[RankingItem]  按 totalAmount desc
    "targetCompletion": [...],   # List[MetricResult] 按 changePercent desc
    "heatmap": {...},            # ChartConfig (chartType=MAP)
    "opportunityScores": [...],  # List[RegionOpportunityScore] 按 totalScore desc
    "dateRange": {...},          # DateRange envelope
    "generatedAt": "..."         # LocalDateTime, volatile (strip on dict-eq)
}
```

来源: `SmartBIServiceImpl.getComprehensiveAnalysis` 行 593-598 `case "region"`。

### 1.3 Composite-only 决策 (跟 department spec §1.3 同模式)

Java controller 行 192-194:
```java
if (smartBIService != null) {
    Map<String, Object> result = smartBIService.getComprehensiveAnalysis(
        factoryId, startDate, endDate, "region");
    return ResponseEntity.ok(ApiResponse.success(result));
}
```

`SmartBIService` 是 Spring `@Service` bean,DI 永不 null。后续 per-type fallback 分支 (行 197-211) 是 dead code。

**决策**: 仅 port composite path。Per-type fallback `{detail, provinceRanking}` / `{ranking, opportunityScores, heatmap, treemap, allRegions}` shape **out of scope**。

**Lineage**: 此决策模式由 Chat 4 department spec §1.3 在 Tier 2 sister 系列建立,本 spec 直接继承。后续 Tier 2 sister chat (quality, procurement) 应该都遵循此 dead-code-skip 模式。

### 1.4 In scope (本 spec 锁定)

| 项 | 来源 |
|---|---|
| 4 sub-service: `getRegionRanking` / `getRegionTargetCompletion` / `getGeographicHeatmapData` / `getRegionOpportunityScores` | composite path,Java impl 行 54-94 / 269-314 / 318-381 / 385-464 |
| 1 SQL helper `_query_region_full` | 模仿 Chat 4 `_query_department_full` 命名 (Rule 5 SELECT *) |
| Inline alert const `_REGION_TARGET_COMPLETION_RED/YELLOW = Decimal("60")/Decimal("85")` | Javadoc 行 183 实锤,不复用 alert_thresholds.py 的 80 |
| 13 helper fn: 2 aggregation + 5 score + 2 heatmap + 1 period window + 5 alerting/formatting (`_calculate_completion_rate`, `_determine_target_completion_alert`, `_determine_direction`, `_format_amount`, `_generate_opportunity_recommendation`) | 见 §3.4-3.10 |
| 1 dispatcher fn `_get_region_analysis(factory_id, range_)` | 跟 sales/department 同签名模式 |
| 1 route handler 注册到 main.py:1117 后 | 跟 analysis_sales.py:1689 同模式 |

### 1.5 Out of scope (per Java prod path)

| 项 | 理由 |
|---|---|
| Per-type fallback `{detail, provinceRanking}` / `{ranking, opportunityScores, heatmap, treemap, allRegions}` | smartBIService==null dead code (§1.3) |
| `region` query param 行为 | composite path 完全忽略 (Java line 192-194 short-circuit) |
| `getRegionTrendChart` (line 229-265) | 不在 composite 输出 |
| `getRegionProvinceTreemap` (line 469-554) | 不在 composite 输出 |
| `getRegionDetail` (line 172-224) | 不在 composite 输出 |
| `getProvinceRanking` / `getCityRanking` (line 97-167) | 不在 composite 输出 |
| `getAllRegions` / `getProvincesByRegion` / `getCitiesByProvince` | 辅助 getter,不在 composite 输出 |
| `normalizeRegionName` (fuzzy region matching) | 仅 getProvinceRanking 用到,composite 不调用 |

Wave 4+ 若需独立 endpoint 暴露这些功能,另起 spec。

### 1.6 Side effects

无写入。仅 readonly DB 查询 (`smart_bi_sales_data`)。无外部 API 调用,无缓存写入,无 audit log。

---

## 2. 架构 + 文件 delta

### 2.1 新建文件

```
backend/python/smartbi_compat/api/analysis_region.py   (~600 LOC PR-A impl)
tests/python/smartbi_compat/test_analysis_region_contract.py    (~150 LOC PR-A)
tests/python/smartbi_compat/test_analysis_region_arithmetic.py  (~400 LOC PR-B)
tests/fixtures/java-smartbi-golden/analysis-region-F999.json    (PR-A prereq)
tests/fixtures/java-smartbi-golden/analysis-region-F001.json    (PR-A prereq)
```

### 2.2 修改文件

```
backend/python/main.py
  - line 1112 后加: from smartbi_compat.api import analysis_region
  - line 1117 后加: app.include_router(analysis_region.router, tags=["SmartBI Compat: Analysis Region"])
```

仅 2 行 delta。无其他修改。

### 2.3 模块内部结构 (analysis_region.py)

```
analysis_region.py
├── imports
│   ├── from smartbi_compat.api.analysis_finance import _decimal_to_number, _to_decimal,
│   │       _new_date_range_dict, _utc_now_iso
│   │   # ^ _new_date_range_dict (analysis_finance.py:70) and _utc_now_iso
│   │   #   (analysis_finance.py:1100) are the canonical helpers used by
│   │   #   ALL Phase 2A composite endpoints — DO NOT redefine locally.
│   ├── from smartbi_compat.api.analysis_sales import _calculate_mom_growth,
│   │       _to_thread, _get_sync_engine
│   │   # ^ _to_thread (analysis_sales.py:50) is the Python 3.8 venv38 shim
│   │   #   for asyncio.to_thread (which Python 3.8.17 lacks).
│   │   #   _get_sync_engine + _to_thread is the SQLAlchemy sync-engine
│   │   #   pattern used by analysis_sales for smart_bi_sales_data queries.
│   │   #   Region MUST use the same pattern (same table) — see §3.3.
│   │   # ⚠ _calculate_completion_rate from analysis_sales is INTENTIONALLY
│   │   #   NOT imported — its arithmetic order `(actual/target*100).quantize(4)`
│   │   #   produces DIFFERENT bytes than region Java's
│   │   #   `actual.divide(target,4).multiply(100)`. Region defines its own
│   │   #   `_calculate_completion_rate` locally — see §3.7 for the LOCK.
│   ├── from sqlalchemy import text  # for SQL text() construct
│   ├── from smartbi_compat.date_range import DateRange
│   ├── from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
│   └── from smartbi_compat.schema_compat import wrap_response
├── 常量
│   ├── _REGION_TARGET_COMPLETION_RED = Decimal("60")
│   ├── _REGION_TARGET_COMPLETION_YELLOW = Decimal("85")
│   ├── _HEATMAP_HIGH = Decimal("0.7")
│   └── _HEATMAP_MEDIUM = Decimal("0.3")
├── @dataclass RegionAggregation
├── SQL helpers
│   └── _query_region_full(factory_id, start, end) -> list[dict]
├── Aggregation helpers
│   ├── _aggregate_by_region(rows) -> dict[str, RegionAggregation]
│   └── _aggregate_by_province(rows) -> dict[str, RegionAggregation]
├── Score helpers
│   ├── _calculate_growth_score(curr, prev) -> Decimal
│   ├── _calculate_base_score(region_sales, total_sales) -> Decimal
│   ├── _calculate_margin_score(gross_margin) -> Decimal
│   ├── _calculate_penetration_score(customer_count, order_count) -> Decimal
│   └── _calculate_total_score(g, b, m, p) -> Decimal
├── Heatmap helpers
│   ├── _normalize_province_name(p) -> str
│   └── _determine_color_level(heat_value) -> str
├── Period window
│   └── _previous_period_window(start, end) -> tuple[date, date]
├── Alerting + formatting helpers (5)
│   ├── _calculate_completion_rate(actual, target) -> Decimal  # R-T13 — LOCAL, NOT imported
│   ├── _determine_target_completion_alert(rate) -> str
│   ├── _determine_direction(value, baseline) -> str
│   ├── _format_amount(amount) -> str
│   └── _generate_opportunity_recommendation(region, scores...) -> str
├── Sub-services (4)
│   ├── _build_region_ranking(rows) -> list[dict]
│   ├── _build_region_target_completion(rows) -> list[dict]
│   ├── _build_geographic_heatmap(rows) -> dict
│   └── _build_opportunity_scores(rows, prev_rows) -> list[dict]
├── Dispatcher
│   └── _get_region_analysis(factory_id, range_) -> dict
└── Route handler
    └── @router.get("/api/mobile/{factory_id}/smart-bi/analysis/region")
```

### 2.4 数据流

```
HTTP GET /api/mobile/{factory_id}/smart-bi/analysis/region?startDate=...&endDate=...&region=...
  │
  ├─ verify_jwt_and_factory → AuthContext
  ├─ region query param 接收但 ignored
  ├─ DateRange.custom(start, end)
  ↓
_get_region_analysis(factory_id, range_)
  ├─ rows = await _query_region_full(factory_id, start, end)         # SELECT *
  ├─ ranking = _build_region_ranking(rows)                            # in-memory aggregation
  ├─ target_completion = _build_region_target_completion(rows)        # 复用 rows
  ├─ heatmap = _build_geographic_heatmap(rows)                        # 复用 rows
  ├─ prev_start, prev_end = _previous_period_window(start, end)
  ├─ prev_rows = await _query_region_full(factory_id, prev_start, prev_end)  # 第二次查询
  ├─ opportunity_scores = _build_opportunity_scores(rows, prev_rows)
  ├─ date_range = _new_date_range_dict(range_)
  ├─ generated_at = datetime.now().isoformat() + tz suffix
  └─ return {ranking, targetCompletion, heatmap, opportunityScores, dateRange, generatedAt}
       (top-level Map.of(N) order TBD-via-golden — Java HashMap hash-bucket 顺序)
```

**优化决策**: Java 在 4 个 sub-service 内各自调用一次 `salesDataRepository.findByFactoryIdAndOrderDateBetween` (4 次重复查询)。Python dispatcher 复用同一份 `rows`,仅 opportunityScores 的上期数据另开一次查询。Total: 2 次 DB 查询。**不影响 byte-shape parity** — 输出 shape 跟 Java 完全一致。

---

## 3. Java 引用 + 算法对照

### 3.1 总览

| Sub-service | Java 行号 | 输出 type | 关键算法 |
|---|---|---|---|
| `getRegionRanking` | RegionAnalysisServiceImpl.java:54-94 | `List<RankingItem>` | aggregateByRegion → sort by totalAmount desc → completionRate + alertLevel |
| `getRegionTargetCompletion` | :269-314 | `List<MetricResult>` | aggregateByRegion → completionRate → metric_code "REGION_TARGET_"+region → sort by changePercent desc |
| `getGeographicHeatmapData` | :318-381 | `ChartConfig{type=MAP}` | aggregateByProvince → maxAmount → heatValue per province → normalizeProvinceName + colorLevel |
| `getRegionOpportunityScores` | :385-464 | `List<RegionOpportunityScore>` | current+prev aggregation → 4-dim score (g/b/m/p) → totalScore weighted (.30/.25/.25/.20) → opportunityLevel |

### 3.2 RegionAggregation (impl 行 1175-1208)

Java private inner class:

```java
private static class RegionAggregation {
    BigDecimal totalAmount = ZERO;
    BigDecimal totalCost = ZERO;
    BigDecimal totalTarget = ZERO;
    BigDecimal grossMargin = ZERO;     // init ZERO not null
    int orderCount = 0;
    int customerCount = 0;
    Set<String> customers = new HashSet<>();

    void addSale(SmartBiSalesData sale) {
        if (sale.getAmount() != null) totalAmount = totalAmount.add(sale.getAmount());
        if (sale.getCost() != null) totalCost = totalCost.add(sale.getCost());
        if (sale.getMonthlyTarget() != null) totalTarget = totalTarget.add(sale.getMonthlyTarget());
        orderCount++;
        if (sale.getCustomerName() != null && !sale.getCustomerName().isEmpty()) {
            customers.add(sale.getCustomerName());
        }
        customerCount = customers.size();   // incremental sync
    }

    void calculateGrossMargin() {
        if (totalAmount.compareTo(ZERO) > 0) {
            BigDecimal grossProfit = totalAmount.subtract(totalCost);
            grossMargin = grossProfit.divide(totalAmount, 4, HALF_UP).multiply(new BigDecimal("100"));
        }
        // else: grossMargin stays ZERO (NOT null) — R-T11 lock
    }
}
```

**Python mirror** (Rule 1 显式 None-check):

```python
@dataclass
class RegionAggregation:
    total_amount: Decimal = field(default_factory=lambda: Decimal("0"))
    total_cost: Decimal = field(default_factory=lambda: Decimal("0"))
    total_target: Decimal = field(default_factory=lambda: Decimal("0"))
    gross_margin: Decimal = field(default_factory=lambda: Decimal("0"))
    order_count: int = 0
    customer_count: int = 0
    customers: set[str] = field(default_factory=set)

    def add_sale(self, row: dict) -> None:
        # Rule 1: explicit `is not None` not Python `or` (Decimal("0") truthy trap)
        if row.get("amount") is not None:
            self.total_amount += _to_decimal(row["amount"])
        if row.get("cost") is not None:
            self.total_cost += _to_decimal(row["cost"])
        if row.get("monthly_target") is not None:
            self.total_target += _to_decimal(row["monthly_target"])
        self.order_count += 1
        cn = row.get("customer_name")
        # Java line 1195: `!= null && !cn.isEmpty()` — Python explicit None + len check
        if cn is not None and cn != "":
            self.customers.add(cn)
        self.customer_count = len(self.customers)  # incremental sync (Java line 1198)

    def calculate_gross_margin(self) -> None:
        if self.total_amount > Decimal("0"):
            gross_profit = self.total_amount - self.total_cost
            self.gross_margin = (
                (gross_profit / self.total_amount).quantize(
                    Decimal("0.0001"), ROUND_HALF_UP
                )
                * Decimal("100")
            )
        # else: self.gross_margin stays Decimal("0") — R-T11 lock
```

**R-T6 lock**: `customer_count = len(self.customers)` 在每次 `add_sale` 内调一次,跟 Java `customerCount = customers.size()` 同语义。Python `len()` 是 O(1) for set,无性能负担。

**R-T11 lock**: `total_amount==0` 时 `gross_margin` 保持 `Decimal("0")`,**不 None**。后续 `_calculate_margin_score(Decimal("0"))` 返 0,符合 Java 行为。

### 3.3 SQL helper

**Pattern**: SQLAlchemy sync engine + `_to_thread` shim (mirror `analysis_sales.py:244-272`),
NOT raw asyncpg pool (which `analysis_finance.py` uses for finance tables).
Reasoning: `smart_bi_sales_data` is the same table sales endpoints use; aligning
on the same access pattern lets region/sales/quality/procurement share fixtures
and helper conventions.

```python
_REGION_FULL_SQL = text("""
    SELECT *
    FROM smart_bi_sales_data
    WHERE factory_id = :factory_id
      AND order_date BETWEEN :start_date AND :end_date
      AND deleted_at IS NULL
    ORDER BY id ASC
""")


async def _query_region_full(
    factory_id: str,
    start_date: date,
    end_date: date,
) -> list[dict]:
    """Mirror Java SmartBiSalesDataRepository.findByFactoryIdAndOrderDateBetween.

    Rule 5: SELECT * for sister-chat extensibility (region/quality/procurement
    might want different columns later).

    Rule 6: Reject None inputs explicitly. SQLAlchemy will silently coerce
    None → NULL, BETWEEN NULL AND NULL → 0 rows, callers see "empty data"
    without error.

    Rule 5 ORDER BY: Java JPA repository method has NO explicit ORDER BY,
    PostgreSQL default row order undefined. Java in-memory aggregation uses
    LinkedHashMap which preserves insertion order, so SQL fetch order
    influences which (region, province, city) bucket appears first when
    multiple rows share same key. To match Java byte-shape, Python MUST
    add explicit ORDER BY id ASC (assumes Java JPA fetches in id order
    on PG default — verify via F001 golden).

    R-T10 (verify-via-golden): if F001 golden reveals a different fetch
    order pattern (e.g. order_date asc id asc), update SQL accordingly.

    Python 3.8 compat: uses _to_thread shim (NOT bare asyncio.to_thread).
    """
    if start_date is None or end_date is None:
        raise ValueError(
            f"_query_region_full: start_date/end_date required "
            f"(got {start_date}, {end_date})"
        )

    def _exec():
        engine = _get_sync_engine()
        with engine.connect() as conn:
            rows = conn.execute(_REGION_FULL_SQL, {
                "factory_id": factory_id,
                "start_date": start_date,
                "end_date": end_date,
            }).fetchall()
            # SQLAlchemy 2.x: row._mapping yields dict-like view of named columns
            return [dict(row._mapping) for row in rows]

    return await _to_thread(_exec)
```

### 3.4 Aggregation

```python
def _aggregate_by_region(rows: list[dict]) -> dict[str, RegionAggregation]:
    """Mirror RegionAnalysisServiceImpl.aggregateByRegion (line 655-674).

    Python dict (3.7+) preserves insertion order ≡ Java LinkedHashMap.
    R-T8 lock: null/empty region → '未分类' bucket (Java line 661-663).
    """
    aggregations: dict[str, RegionAggregation] = {}
    for row in rows:
        region = row.get("region")
        if region is None or region == "":
            region = "未分类"
        agg = aggregations.setdefault(region, RegionAggregation())
        agg.add_sale(row)
    for agg in aggregations.values():
        agg.calculate_gross_margin()
    return aggregations


def _aggregate_by_province(rows: list[dict]) -> dict[str, RegionAggregation]:
    """Mirror impl line 679-697. Same as _aggregate_by_region but key=province."""
    aggregations: dict[str, RegionAggregation] = {}
    for row in rows:
        province = row.get("province")
        if province is None or province == "":
            province = "未分类"
        agg = aggregations.setdefault(province, RegionAggregation())
        agg.add_sale(row)
    for agg in aggregations.values():
        agg.calculate_gross_margin()
    return aggregations
```

### 3.5 Score helpers (R-T1 ~ R-T5 LOCK)

```python
def _calculate_growth_score(current: Decimal, previous: Decimal) -> Decimal:
    """Mirror impl line 1025-1030.

    R-T4 LOCK: growthRate = calculateMomGrowth(curr, prev) (per
    MetricCalculatorServiceImpl line 425-438):
      - prev=null OR prev=0 AND curr>0 → return 100
      - prev=null OR prev=0 AND curr<=0/null → return 0
      - curr=null (prev nonzero) → return -100
      - normal: (curr-prev)/abs(prev)*100, scale=4 then setScale(2, HALF_UP)
    Then: score = growthRate + 50, clamp [0, 100].
    Boundary: growth = +50 → score 100, growth = -50 → score 0.
    """
    growth_rate = _calculate_mom_growth(current, previous)
    score = growth_rate + Decimal("50")
    return max(Decimal("0"), min(Decimal("100"), score))


def _calculate_base_score(region_sales: Decimal, total_sales: Decimal) -> Decimal:
    """Mirror impl line 1035-1042.

    R-T3 LOCK: ratio = (region/total) * 100, score = ratio * 3, .min(100).
    Subtle: 33.33% share → 99.99 (NOT 100), only 33.34%+ caps at 100.
    Java uses BigDecimal divide(SCALE=4, HALF_UP) before multiply,
    same scale as Python Decimal quantize.
    """
    if total_sales == Decimal("0"):
        return Decimal("0")
    ratio = (region_sales / total_sales).quantize(
        Decimal("0.0001"), ROUND_HALF_UP
    ) * Decimal("100")
    return min(Decimal("100"), ratio * Decimal("3"))


def _calculate_margin_score(gross_margin: Decimal | None) -> Decimal:
    """Mirror impl line 1047-1053.

    R-T2 LOCK: grossMargin already × 100 (percentage units, see
    RegionAggregation.calculate_gross_margin).
    score = grossMargin * Decimal("3.33"), clamp [0, 100].
    Subtle: 30% margin → score = 30 * 3.33 = 99.9 (NOT 100).
    Use Decimal("3.33") EXACT, never float — Java BigDecimal("3.33") is exact.
    """
    if gross_margin is None:
        return Decimal("0")
    score = gross_margin * Decimal("3.33")
    return max(Decimal("0"), min(Decimal("100"), score))


def _calculate_penetration_score(customer_count: int, order_count: int) -> Decimal:
    """Mirror impl line 1058-1062 — Java integer arithmetic.

    R-T1 LOCK: Java `customerCount * 10 + orderCount / 10` is INTEGER DIVISION.
    Python naive port `customer_count * 10 + order_count / 10` would do FLOAT
    division and produce float 0.x where Java gets integer 0.

    Java integer `/` for non-negative operands ≡ Python `//` (floor div).
    Customer_count and order_count are always ≥ 0 (counters), so // is safe.

    Defensive int() coercion: row dict types not guaranteed (DB driver might
    return numeric str for orderCount despite Pydantic typing). int() guards
    against silent // semantic break on string/Decimal input.

    score_int = customer_count * 10 + order_count // 10
    return min(100, score_int)
    """
    score_int = int(customer_count) * 10 + int(order_count) // 10
    return min(Decimal("100"), Decimal(score_int))


def _calculate_total_score(
    g: Decimal | None,
    b: Decimal | None,
    m: Decimal | None,
    p: Decimal | None,
) -> Decimal:
    """Mirror RegionOpportunityScore.calculateTotalScore (DTO line 134-145).

    Rule 1: explicit `is not None` (Decimal("0") is falsy in Python — bare
    `g or Decimal("0")` would replace 0 with 0 which is fine, but `g or X`
    where X != 0 would silently substitute on score=0 edge case).

    Weights: g*0.30 + b*0.25 + m*0.25 + p*0.20. Sum=1.00.
    """
    g = g if g is not None else Decimal("0")
    b = b if b is not None else Decimal("0")
    m = m if m is not None else Decimal("0")
    p = p if p is not None else Decimal("0")
    return (
        g * Decimal("0.30")
        + b * Decimal("0.25")
        + m * Decimal("0.25")
        + p * Decimal("0.20")
    )


def _determine_opportunity_level(total_score: Decimal | None) -> str:
    """Mirror RegionOpportunityScore.determineOpportunityLevel (DTO line 99-111).

    score >= 70 → HIGH, 40 <= score < 70 → MEDIUM, score < 40 → LOW.
    null → LOW.

    Note Java uses `totalScore.doubleValue()` then `>= 70` (float compare).
    Python uses Decimal compare directly — boundary cases unaffected since
    thresholds 70 and 40 are integers, but Rule 7 requires Decimal compare
    when threshold value not integer (here it IS integer, so float() also
    safe — but use Decimal for consistency with Rule 7 default stance).
    """
    if total_score is None:
        return "LOW"
    if total_score >= Decimal("70"):
        return "HIGH"
    if total_score >= Decimal("40"):
        return "MEDIUM"
    return "LOW"


def _previous_period_window(start: date, end: date) -> tuple[date, date]:
    """Mirror impl line 398-400.

    R-T5 LOCK: adjacent mirrored period (NOT YoY).
        days_between = (end - start).days
        prev_start = start - timedelta(days=days_between + 1)
        prev_end = start - timedelta(days=1)

    Example: start=2024-01-15, end=2024-01-20 (5 days span)
      days_between = 5
      prev_start = 2024-01-09 (start - 6 days)
      prev_end = 2024-01-14 (start - 1 day)

    Edge: start == end (single-day period, days_between=0)
      prev_start = start - 1 day
      prev_end = start - 1 day
      → single day window, prev_start <= prev_end ✓

    Edge: across year boundary handled by date arithmetic.
    """
    days_between = (end - start).days
    prev_start = start - timedelta(days=days_between + 1)
    prev_end = start - timedelta(days=1)
    return prev_start, prev_end
```

### 3.6 Heatmap helpers (R-T7, R-T9 LOCK)

```python
import re

# R-T7 LOCK: ORDER MATTERS — 自治区/特别行政区 BEFORE 壮族/回族/维吾尔
# Java line 1144-1150 uses sequential .replaceAll on regex anchored at end ($).
_PROVINCE_NORMALIZE_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"省$"), ""),
    (re.compile(r"市$"), ""),
    (re.compile(r"自治区$"), ""),
    (re.compile(r"特别行政区$"), ""),
    (re.compile(r"壮族$"), ""),
    (re.compile(r"回族$"), ""),
    (re.compile(r"维吾尔$"), ""),
]


def _normalize_province_name(province: str | None) -> str:
    """Mirror impl line 1138-1151.

    Examples (order-dependent):
      "广西壮族自治区" → 自治区 first → "广西壮族" → 壮族 next → "广西"
      "新疆维吾尔自治区" → 自治区 → "新疆维吾尔" → 维吾尔 → "新疆"
      "宁夏回族自治区" → 自治区 → "宁夏回族" → 回族 → "宁夏"
      "北京市" → 市 → "北京"
      "香港特别行政区" → 特别行政区 → "香港"

    R-T7 LOCK: applying patterns in any other order produces wrong result.
    """
    if province is None:
        return "未知"
    p = province
    for pattern, replacement in _PROVINCE_NORMALIZE_PATTERNS:
        p = pattern.sub(replacement, p)
    return p


def _determine_color_level(heat_value: Decimal | None) -> str:
    """Mirror impl line 1156-1168.

    R-T9 LOCK: thresholds 0.7 and 0.3 are NON-INTEGER → MUST use Decimal
    compare per Rule 7. Java uses `heatValue.doubleValue() >= 0.7` (float
    compare); Python Decimal compare avoids float precision drift at
    boundary cases (0.7000000001 etc.).

    Note: heat_value comes from BigDecimal divide(SCALE=4, HALF_UP), so the
    actual value is rounded to 4 decimals — boundary case 0.6999... cannot
    occur, but defensive Decimal compare locks future behavior.
    """
    if heat_value is None:
        return "LOW"
    if heat_value >= _HEATMAP_HIGH:    # Decimal("0.7")
        return "HIGH"
    if heat_value >= _HEATMAP_MEDIUM:  # Decimal("0.3")
        return "MEDIUM"
    return "LOW"
```

### 3.7 Sub-service: getRegionRanking

Java (impl 行 54-94):

```java
public List<RankingItem> getRegionRanking(String factoryId, LocalDate startDate, LocalDate endDate) {
    List<SmartBiSalesData> salesData = salesDataRepository.findByFactoryIdAndOrderDateBetween(...);
    if (salesData.isEmpty()) return Collections.emptyList();
    Map<String, RegionAggregation> regionAggregations = aggregateByRegion(salesData);
    List<Map.Entry<...>> sortedEntries = regionAggregations.entrySet().stream()
        .sorted((e1, e2) -> e2.getValue().totalAmount.compareTo(e1.getValue().totalAmount))
        .collect(Collectors.toList());
    int rank = 1;
    for (entry : sortedEntries) {
        BigDecimal completionRate = calculateCompletionRate(agg.totalAmount, agg.totalTarget);
        String alertLevel = metricCalculatorService.determineAlertLevel(TARGET_COMPLETION, completionRate);
        rankings.add(RankingItem.builder()
            .rank(rank++).name(region)
            .value(agg.totalAmount.setScale(2, HALF_UP))
            .target(agg.totalTarget.setScale(2, HALF_UP))
            .completionRate(completionRate.setScale(2, HALF_UP))
            .alertLevel(alertLevel)
            .build());
    }
    return rankings;
}
```

Python:

```python
def _build_region_ranking(rows: list[dict]) -> list[dict]:
    """Mirror getRegionRanking (impl line 54-94).

    Empty rows → empty list.
    Sort by total_amount desc.
    rank starts at 1, monotonic.
    """
    if not rows:
        return []
    aggregations = _aggregate_by_region(rows)
    sorted_entries = sorted(
        aggregations.items(),
        key=lambda kv: kv[1].total_amount,
        reverse=True,
    )
    rankings: list[dict] = []
    for rank, (region, agg) in enumerate(sorted_entries, start=1):
        completion_rate = _calculate_completion_rate(agg.total_amount, agg.total_target)
        alert_level = _determine_target_completion_alert(completion_rate)
        # RankingItem field order from Lombok @Data declaration order:
        # rank, name, value, target, completionRate, alertLevel
        # KEY-ORDER-TBD-VIA-GOLDEN if Lombok behavior differs
        rankings.append({
            "rank": rank,
            "name": region,
            "value": _decimal_to_number(
                agg.total_amount.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "target": _decimal_to_number(
                agg.total_target.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "completionRate": _decimal_to_number(
                completion_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "alertLevel": alert_level,
        })
    return rankings


def _calculate_completion_rate(
    actual: Decimal, target: Decimal | None
) -> Decimal:
    """Mirror RegionAnalysisServiceImpl.java:756-761 EXACTLY.

    Java code:
        return actual.divide(target, SCALE, ROUNDING_MODE)
                     .multiply(new BigDecimal("100"));
    where SCALE=4, ROUNDING_MODE=HALF_UP.

    Arithmetic order matters! Region's Java does division-then-quantize-then-multiply,
    NOT (department's pattern) multiply-then-divide-then-quantize. These produce
    DIFFERENT bytes on edge cases:
      actual=Decimal("33.333"), target=Decimal("9.7"):
        - Region (this fn): (33.333/9.7).quantize(4) * 100 = 3.4364 * 100 = 343.6400
        - Department:       (33.333 * 100 / 9.7).quantize(4) = 343.6392

    DO NOT import _calculate_completion_rate from analysis_sales — that helper
    uses department-style ordering `(actual/target*100).quantize(4)` which
    rounds at the very end, producing 343.6392 — wrong for region.

    R-T13 (cross-spec divergence lock): analysis_sales has a same-named
    helper that DIVERGES from region Java. The two coexist intentionally
    because their respective Java services have different arithmetic orders.
    Lint may flag this as "duplicate helper" — DO NOT consolidate.

    R-T11-related: target=None or target=Decimal("0") returns Decimal("0")
    matching Java BigDecimal.ZERO short-circuit (line 757-759).
    """
    if target is None or target == Decimal("0"):
        return Decimal("0")
    # Match Java exactly: divide first (quantizing to scale=4 HALF_UP at the
    # division step), then multiply by 100. The multiply preserves scale=4
    # since BigDecimal("100") has scale=0.
    return (actual / target).quantize(
        Decimal("0.0001"), ROUND_HALF_UP
    ) * Decimal("100")


def _determine_target_completion_alert(rate: Decimal | None) -> str:
    """Mirror MetricCalculatorServiceImpl.determineAlertLevel TARGET_COMPLETION
    case (line 449-461).

    Java impl confirms (NOT just Javadoc):
      value == null  → YELLOW
      v < 60         → RED
      60 <= v < 85   → YELLOW
      v >= 85        → GREEN  (i.e. exact 85 is GREEN, not YELLOW)

    Inline const NOT alert_thresholds.py 80 — Java impl line 459-461 uses 60/85.

    Note: in region context, _calculate_completion_rate returns Decimal("0")
    on target=0 (not None), so null path is unreachable from current call sites.
    Null guard kept for defensive parity + Rule 1 compliance.
    """
    if rate is None:
        return "YELLOW"
    if rate < _REGION_TARGET_COMPLETION_RED:        # < 60
        return "RED"
    if rate < _REGION_TARGET_COMPLETION_YELLOW:     # 60 <= rate < 85
        return "YELLOW"
    return "GREEN"                                  # >= 85
```

### 3.8 Sub-service: getRegionTargetCompletion

Java (impl 行 269-314):

```java
public List<MetricResult> getRegionTargetCompletion(...) {
    Map<String, RegionAggregation> regionAggregations = aggregateByRegion(salesData);
    List<MetricResult> results = new ArrayList<>();
    for (entry : regionAggregations.entrySet()) {
        BigDecimal completionRate = calculateCompletionRate(agg.totalAmount, agg.totalTarget);
        String alertLevel = metricCalculatorService.determineAlertLevel(TARGET_COMPLETION, completionRate);
        results.add(MetricResult.builder()
            .metricCode("REGION_TARGET_" + region)
            .metricName(region + " 目标完成")
            .value(agg.totalAmount.setScale(2, HALF_UP))
            .formattedValue(formatAmount(agg.totalAmount))
            .unit("元")
            .changePercent(completionRate.setScale(2, HALF_UP))
            .changeDirection(determineDirection(completionRate, new BigDecimal("100")))
            .alertLevel(alertLevel)
            .dimensionValue(region)
            .description("目标: " + formatAmount(agg.totalTarget))
            .build());
    }
    results.sort((r1, r2) -> r2.getChangePercent().compareTo(r1.getChangePercent()));
    return results;
}
```

Python:

```python
def _build_region_target_completion(rows: list[dict]) -> list[dict]:
    """Mirror getRegionTargetCompletion (impl line 269-314).

    Note: NOT same shape as ranking. Returns MetricResult, not RankingItem.
    metric_code = "REGION_TARGET_" + region (literal prefix).
    Sort by changePercent (= completionRate) desc — different from ranking
    which sorts by totalAmount.
    """
    if not rows:
        return []
    aggregations = _aggregate_by_region(rows)
    results: list[dict] = []
    for region, agg in aggregations.items():
        completion_rate = _calculate_completion_rate(agg.total_amount, agg.total_target)
        alert_level = _determine_target_completion_alert(completion_rate)
        change_direction = _determine_direction(completion_rate, Decimal("100"))
        # MetricResult field order from Lombok @Data — KEY-ORDER-TBD-VIA-GOLDEN
        results.append({
            "metricCode": f"REGION_TARGET_{region}",
            "metricName": f"{region} 目标完成",
            "value": _decimal_to_number(
                agg.total_amount.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "formattedValue": _format_amount(agg.total_amount),
            "unit": "元",
            "changePercent": _decimal_to_number(
                completion_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "changeDirection": change_direction,
            "alertLevel": alert_level,
            "dimensionValue": region,
            "description": f"目标: {_format_amount(agg.total_target)}",
        })
    # Sort by changePercent desc.
    # Java line 308-310 has a defensive null guard because MetricResult.changePercent
    # CAN be null in other call sites; in this code path it's always set (line 717-719
    # above unconditionally sets changePercent from completion_rate). Python skips
    # the dead null guard. Note: changePercent here is _decimal_to_number-converted
    # (int or float, not Decimal), so Rule 1's Decimal-falsy concern doesn't apply.
    results.sort(key=lambda r: r["changePercent"], reverse=True)
    return results


def _determine_direction(value: Decimal, baseline: Decimal) -> str:
    """Mirror impl line 1121-1133.

    None → STABLE. value > baseline → UP, < → DOWN, == → STABLE.
    """
    if value is None or baseline is None:
        return "STABLE"
    if value > baseline:
        return "UP"
    if value < baseline:
        return "DOWN"
    return "STABLE"


def _format_amount(amount: Decimal | None) -> str:
    """Mirror impl line 1111-1116.

    Java: String.format("%,.2f", amount.doubleValue())
    Python: f"{val:,.2f}"

    KNOWN CAVEAT: Java result is JVM Locale-dependent. Production Linux JVM
    default Locale is en_US → comma thousand separator → matches Python
    f-string ',' format specifier. If server JVM Locale changes, Java would
    produce different output (e.g. de_DE: "1.234.567,89") — Python would
    diverge silently. Out of scope for this port; if Locale changes, file
    new spec.
    """
    if amount is None:
        return "0.00"
    return f"{amount:,.2f}"
```

### 3.9 Sub-service: getGeographicHeatmapData (Map.of(N) Rule 8)

Java (impl 行 318-381):

```java
public ChartConfig getGeographicHeatmapData(...) {
    if (salesData.isEmpty()) {
        return ChartConfig.builder()
            .chartType("MAP").title("销售地理分布")
            .data(Collections.emptyList())
            .build();   // NO options field set
    }
    Map<String, RegionAggregation> provinceAggregations = aggregateByProvince(salesData);
    BigDecimal maxAmount = provinceAggregations.values().stream()
        .map(a -> a.totalAmount).max(BigDecimal::compareTo).orElse(BigDecimal.ONE);
    List<Map<String, Object>> mapData = new ArrayList<>();
    for (entry : provinceAggregations.entrySet()) {
        BigDecimal heatValue = maxAmount.compareTo(ZERO) > 0
            ? agg.totalAmount.divide(maxAmount, 4, HALF_UP)
            : ZERO;
        Map<String, Object> item = new LinkedHashMap<>();   // explicit insertion order
        item.put("province", normalizeProvinceName(province));
        item.put("value", agg.totalAmount.setScale(2, HALF_UP));
        item.put("heatValue", heatValue.setScale(4, HALF_UP));
        item.put("orderCount", agg.orderCount);
        item.put("customerCount", agg.customerCount);
        item.put("colorLevel", determineColorLevel(heatValue));
        mapData.add(item);
    }
    return ChartConfig.builder()
        .chartType("MAP").title("销售地理分布")
        .xAxisField("province").yAxisField("value")
        .data(mapData)
        .options(Map.of(
            "mapType", "china",
            "showLabel", true,
            "roam", true,
            "visualMap", Map.of("min", 0, "max", maxAmount.setScale(2, HALF_UP), "calculable", true)
        ))
        .build();
}
```

Python:

```python
def _build_geographic_heatmap(rows: list[dict]) -> dict:
    """Mirror getGeographicHeatmapData (impl line 318-381).

    Empty rows → ChartConfig with chartType=MAP, title, data=[], NO other
    fields. Lombok @Data Jackson skips null fields — Python must omit
    options/xAxisField/yAxisField keys to match.

    Non-empty rows → full ChartConfig with options Map.of(4) + nested
    visualMap Map.of(3). Per Rule 8, both Map.of orders are
    KEY-ORDER-TBD-VIA-GOLDEN — record F999/F001 BEFORE finalizing dict
    literal in impl plan.
    """
    if not rows:
        # Empty case: ChartConfig with only 3 fields set (chartType, title, data)
        # KEY-ORDER-TBD-VIA-GOLDEN — Lombok @Data declaration order assumed
        return {
            "chartType": "MAP",
            "title": "销售地理分布",
            "data": [],
        }
    province_aggs = _aggregate_by_province(rows)
    # Java orElse(BigDecimal.ONE) — empty stream falls to 1, but we know
    # province_aggs is non-empty here (rows non-empty + aggregateByProvince
    # always produces at least one bucket including '未分类')
    max_amount = max(
        (agg.total_amount for agg in province_aggs.values()),
        default=Decimal("1"),
    )
    map_data: list[dict] = []
    for province, agg in province_aggs.items():
        heat_value = (
            (agg.total_amount / max_amount).quantize(
                Decimal("0.0001"), ROUND_HALF_UP
            )
            if max_amount > Decimal("0")
            else Decimal("0")
        )
        # Item field order: explicit LinkedHashMap insertion in Java line 353-360
        # → province, value, heatValue, orderCount, customerCount, colorLevel.
        # Python dict literal in this exact order ≡ Java LinkedHashMap.
        map_data.append({
            "province": _normalize_province_name(province),
            "value": _decimal_to_number(
                agg.total_amount.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "heatValue": _decimal_to_number(
                heat_value.quantize(Decimal("0.0001"), ROUND_HALF_UP)
            ),
            "orderCount": agg.order_count,
            "customerCount": agg.customer_count,
            "colorLevel": _determine_color_level(heat_value),
        })

    # KEY-ORDER-TBD-VIA-GOLDEN — Java Map.of(4) Jackson hash order
    # Source order: (mapType, showLabel, roam, visualMap)
    # Actual JSON order: TBD post-record. Impl chat MUST update literal.
    options = {
        "mapType": "china",
        "showLabel": True,
        "roam": True,
        "visualMap": {
            # KEY-ORDER-TBD-VIA-GOLDEN — Java Map.of(3) Jackson hash order
            # Source order: (min, max, calculable)
            "min": 0,
            "max": _decimal_to_number(
                max_amount.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "calculable": True,
        },
    }

    # ChartConfig top-level Lombok @Data declaration order — TBD-via-golden
    # if differs from: chartType, title, xAxisField, yAxisField, data, options
    return {
        "chartType": "MAP",
        "title": "销售地理分布",
        "xAxisField": "province",
        "yAxisField": "value",
        "data": map_data,
        "options": options,
    }
```

### 3.10 Sub-service: getRegionOpportunityScores

Java (impl 行 385-464):

```java
public List<RegionOpportunityScore> getRegionOpportunityScores(...) {
    List<SmartBiSalesData> currentData = repo.findByFactoryIdAndOrderDateBetween(factoryId, startDate, endDate);
    if (currentData.isEmpty()) return Collections.emptyList();
    long daysBetween = ChronoUnit.DAYS.between(startDate, endDate);
    LocalDate previousStartDate = startDate.minusDays(daysBetween + 1);
    LocalDate previousEndDate = startDate.minusDays(1);
    List<SmartBiSalesData> previousData = repo.findByFactoryIdAndOrderDateBetween(factoryId, previousStartDate, previousEndDate);
    Map<String, RegionAggregation> currentAggs = aggregateByRegion(currentData);
    Map<String, RegionAggregation> previousAggs = aggregateByRegion(previousData);
    BigDecimal totalCurrentSales = currentAggs.values().stream()
        .map(a -> a.totalAmount).reduce(ZERO, BigDecimal::add);
    List<RegionOpportunityScore> scores = new ArrayList<>();
    for (entry : currentAggs.entrySet()) {
        RegionAggregation prevAgg = previousAggs.get(region);
        BigDecimal previousSales = prevAgg != null ? prevAgg.totalAmount : ZERO;
        BigDecimal growthScore = calculateGrowthScore(currentAgg.totalAmount, previousSales);
        BigDecimal baseScore = calculateBaseScore(currentAgg.totalAmount, totalCurrentSales);
        BigDecimal marginScore = calculateMarginScore(currentAgg.grossMargin);
        BigDecimal penetrationScore = calculatePenetrationScore(currentAgg.customerCount, currentAgg.orderCount);
        BigDecimal totalScore = RegionOpportunityScore.calculateTotalScore(growthScore, baseScore, marginScore, penetrationScore);
        BigDecimal growthRate = metricCalculatorService.calculateMomGrowth(currentAgg.totalAmount, previousSales);
        String recommendation = generateOpportunityRecommendation(...);
        scores.add(RegionOpportunityScore.builder()...build());
    }
    scores.sort((s1, s2) -> s2.getTotalScore().compareTo(s1.getTotalScore()));
    return scores;
}
```

Python:

```python
def _build_opportunity_scores(
    rows: list[dict],
    prev_rows: list[dict],
) -> list[dict]:
    """Mirror getRegionOpportunityScores (impl line 385-464).

    Empty current rows → empty list (Java line 393-395).
    prev_rows may be empty (single-day window or insufficient history) —
    each region's previous_sales falls to Decimal("0") via aggregations.get
    miss path.
    """
    if not rows:
        return []
    current_aggs = _aggregate_by_region(rows)
    previous_aggs = _aggregate_by_region(prev_rows) if prev_rows else {}
    # Total current sales for base score denominator (Java line 412-415)
    total_current_sales = sum(
        (agg.total_amount for agg in current_aggs.values()),
        Decimal("0"),
    )
    scores: list[dict] = []
    for region, current_agg in current_aggs.items():
        previous_agg = previous_aggs.get(region)
        # Rule 1: explicit `is not None` (Decimal("0") is falsy)
        previous_sales = (
            previous_agg.total_amount if previous_agg is not None else Decimal("0")
        )
        growth_score = _calculate_growth_score(
            current_agg.total_amount, previous_sales
        )
        base_score = _calculate_base_score(
            current_agg.total_amount, total_current_sales
        )
        margin_score = _calculate_margin_score(current_agg.gross_margin)
        penetration_score = _calculate_penetration_score(
            current_agg.customer_count, current_agg.order_count
        )
        total_score = _calculate_total_score(
            growth_score, base_score, margin_score, penetration_score
        )
        growth_rate = _calculate_mom_growth(
            current_agg.total_amount, previous_sales
        )
        recommendation = _generate_opportunity_recommendation(
            region, total_score, growth_score, base_score,
            margin_score, penetration_score
        )
        # R-T12 LOCK: RegionOpportunityScore Lombok @Data declaration order
        # (RegionOpportunityScore.java:29-94) — recommendation (line 64) BEFORE
        # opportunityLevel (line 69), currentSales (74), previousSales (79),
        # growthRate (84), grossMargin (89), customerCount (94).
        # Java Jackson serializes Lombok @Data in field declaration order.
        # Python dict literal MUST mirror this exact order, NOT alphabetical
        # or "natural" grouping. Verify via golden — see §8.2.
        scores.append({
            "region": region,
            "totalScore": _decimal_to_number(
                total_score.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "growthScore": _decimal_to_number(
                growth_score.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "baseScore": _decimal_to_number(
                base_score.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "marginScore": _decimal_to_number(
                margin_score.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "penetrationScore": _decimal_to_number(
                penetration_score.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "recommendation": recommendation,                      # line 64 — BEFORE opportunityLevel
            "opportunityLevel": _determine_opportunity_level(total_score),  # line 69
            "currentSales": _decimal_to_number(
                current_agg.total_amount.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "previousSales": _decimal_to_number(
                previous_sales.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "growthRate": _decimal_to_number(
                growth_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "grossMargin": _decimal_to_number(
                current_agg.gross_margin.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "customerCount": current_agg.customer_count,
        })
    # totalScore is always set (computed via _calculate_total_score), no None
    # case. Direct numeric compare on _decimal_to_number-converted value.
    scores.sort(key=lambda s: s["totalScore"], reverse=True)
    return scores


def _generate_opportunity_recommendation(
    region: str,
    total_score: Decimal,
    growth_score: Decimal,
    base_score: Decimal,
    margin_score: Decimal,
    penetration_score: Decimal,
) -> str:
    """Mirror generateOpportunityRecommendation (impl line 1067-1106).

    Templated Chinese text based on opportunityLevel + strongest/weakest dim.
    """
    level = _determine_opportunity_level(total_score)
    parts: list[str] = []
    if level == "HIGH":
        parts.append(f"{region}是高潜力区域，")
    elif level == "MEDIUM":
        parts.append(f"{region}具有一定发展潜力，")
    else:  # LOW
        parts.append(f"{region}目前发展潜力有限，")
    # LinkedHashMap insertion order: 增长率, 销售基数, 毛利率, 市场渗透
    dims = {
        "增长率": growth_score,
        "销售基数": base_score,
        "毛利率": margin_score,
        "市场渗透": penetration_score,
    }
    # Java `entries.stream().max/min(comparingByValue())` — first-seen-wins on tie
    # via stream stable sort (insertion order = LinkedHashMap iteration).
    # Python max/min default to first match on tie too — same behavior.
    strongest = max(dims, key=dims.get)
    weakest = min(dims, key=dims.get)
    parts.append(f"优势在于{strongest}，")
    parts.append(f"建议重点提升{weakest}。")
    return "".join(parts)
```

### 3.11 Dispatcher

```python
async def _get_region_analysis(
    factory_id: str,
    range_: DateRange,
) -> dict:
    """Mirror SmartBIServiceImpl.getComprehensiveAnalysis 'region' case (line 593-598).

    4 sub-services + dateRange + generatedAt envelope.

    DB optimization: Java repeats findByFactoryIdAndOrderDateBetween 4x
    (once per sub-service). Python issues 1 query for current period reused
    across ranking/targetCompletion/heatmap/opportunityScores-current, plus
    1 query for opportunityScores previous period. Total: 2 queries.
    Output byte-shape unaffected.
    """
    rows = await _query_region_full(factory_id, range_.start, range_.end)
    ranking = _build_region_ranking(rows)
    target_completion = _build_region_target_completion(rows)
    heatmap = _build_geographic_heatmap(rows)

    # _previous_period_window guarantees prev_start < prev_end mathematically
    # (daysBetween >= 0 by HTTP contract startDate <= endDate; prev_start =
    # start - daysBetween - 1 always strictly earlier than prev_end = start - 1).
    # Java line 398-400 has no guard — Python mirrors directly.
    prev_start, prev_end = _previous_period_window(range_.start, range_.end)
    prev_rows = await _query_region_full(factory_id, prev_start, prev_end)
    opportunity_scores = _build_opportunity_scores(rows, prev_rows)

    # KEY-ORDER-TBD-VIA-GOLDEN — Java SmartBIServiceImpl line 575
    # `Map<String, Object> result = new HashMap<>();` is HashMap not
    # LinkedHashMap. Java HashMap iteration is hash-bucket order, NOT
    # insertion order. Source insertion order: ranking, targetCompletion,
    # heatmap, opportunityScores, dateRange, generatedAt. Actual Jackson
    # output order TBD via golden record.
    return {
        "ranking": ranking,
        "targetCompletion": target_completion,
        "heatmap": heatmap,
        "opportunityScores": opportunity_scores,
        "dateRange": _new_date_range_dict(range_),
        # _utc_now_iso imported from analysis_finance — canonical helper
        # used by ALL Phase 2A composite endpoints (finance, sales,
        # department). Format: ISO LocalDateTime no-tz with 9-digit nanos
        # to mirror Java LocalDateTime.now() Jackson output. Always stripped
        # by _strip_volatile in dict-eq tests, so format only matters for
        # potential future strict-byte gate.
        "generatedAt": _utc_now_iso(),
    }
```

### 3.12 Route handler

```python
@router.get("/api/mobile/{factory_id}/smart-bi/analysis/region")
async def get_region_analysis(
    factory_id: str,
    startDate: date = Query(..., alias="startDate"),
    endDate: date = Query(..., alias="endDate"),
    region: Optional[str] = None,
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Java reference: SmartBIAnalysisController.getRegionAnalysis line 181-218.

    `region` query param accepted but IGNORED — Java line 192-194
    short-circuits to getComprehensiveAnalysis when smartBIService non-null
    (always true in prod via Spring DI).

    Returns 6-key composite Map wrapped in standard envelope.
    """
    range_ = DateRange.custom(startDate, endDate)
    result = await _get_region_analysis(auth.factory_id, range_)
    return wrap_response(result)
```

---

## 4. F999 + F001 byte-shape gate

### 4.1 Recording (HARD prereq before impl plan)

```bash
# Record F999 (test env Java 10011, empty data) — JWT_SECRET from .env.test
./scripts/record-java-golden.sh \
    F999 0001 region "startDate=2024-01-01&endDate=2024-12-31" \
    > tests/fixtures/java-smartbi-golden/analysis-region-F999.json

# Record F001 (prod env Java 10010, real data) — JWT_SECRET from .env.prod
./scripts/record-java-golden.sh \
    F001 fac001 region "startDate=2024-01-01&endDate=2024-12-31" \
    > tests/fixtures/java-smartbi-golden/analysis-region-F001.json
```

**Recording must happen BEFORE impl plan finalizes** — golden files reveal:
1. Top-level 6-key HashMap Jackson output order
2. `heatmap.options` Map.of(4) Jackson hash order
3. `heatmap.options.visualMap` Map.of(3) Jackson hash order
4. `RankingItem` / `MetricResult` / `RegionOpportunityScore` / `ChartConfig` Lombok @Data declaration order (assumed stable, golden verifies)
5. `generatedAt` exact format (timezone suffix? microseconds? milliseconds?)
6. `dateRange` envelope shape (start/end format, additional fields?)

### 4.2 Gate semantics

**Phase 2A 全域统一**: dict-equality compare (NOT strict-byte). Tolerates:
- Numeric `0` vs `0.0` equivalence (Java `BigDecimal.ZERO` 输出 `0` 或 `0.00` per setScale)
- Python int vs Java integer wrapping
- `_decimal_to_number` helper covers most cases

**Strip before compare**:
- `generatedAt` (volatile timestamp)
- (No other volatile fields in this endpoint)

**Strict-byte gate (Phase 3+)**: Out of scope for this spec. Future strict-byte gate will require canonical comparison handling.

### 4.3 Test harness (test_analysis_region_contract.py PR-A)

```python
import json
from pathlib import Path
import pytest
from unittest.mock import patch
from smartbi_compat.api.analysis_region import _get_region_analysis
from smartbi_compat.date_range import DateRange


GOLDEN_DIR = Path(__file__).parent.parent.parent.parent / "tests" / "fixtures" / "java-smartbi-golden"


def _strip_volatile(obj: dict) -> dict:
    """Remove generatedAt for dict-eq compare."""
    result = dict(obj)
    result.pop("generatedAt", None)
    return result


@pytest.mark.asyncio
async def test_dict_eq_against_F999_golden(monkeypatch):
    """F999 = test env, empty/synthetic data. Lock byte-shape parity."""
    golden_path = GOLDEN_DIR / "analysis-region-F999.json"
    golden = json.loads(golden_path.read_text())

    # Mock _query_region_full with rows that produce F999 golden's data
    # (impl chat constructs these based on F999 dataset inspection)
    fake_current_rows = [...]  # F999 dataset projection
    fake_prev_rows = [...]
    expected_start = date(2024, 1, 1)  # matches the range below

    async def fake_query(factory_id, start, end):
        # Discriminate by start-date equality, NOT by period span.
        # _previous_period_window for a 365-day range produces a 365-day
        # prev range (also days >= 60), so a duration heuristic always
        # picks the same branch. Use start-date equality instead.
        return fake_current_rows if start == expected_start else fake_prev_rows

    monkeypatch.setattr(
        "smartbi_compat.api.analysis_region._query_region_full",
        fake_query,
    )

    range_ = DateRange.custom(date(2024, 1, 1), date(2024, 12, 31))
    result = await _get_region_analysis("F999", range_)

    assert _strip_volatile(result) == _strip_volatile(golden)
```

---

## 5. 测试策略

### 5.1 PR-A: Foundation + contract (~150 LOC)

`tests/python/smartbi_compat/test_analysis_region_contract.py`:

```python
class TestRouteHandler:
    def test_get_region_analysis_route_registered(self, client):
        """Verify FastAPI router registers /api/mobile/{factoryId}/smart-bi/analysis/region."""

    def test_region_query_param_accepted_but_ignored(self, client, auth_token):
        """region=华东 vs no region → identical response (per Java line 192-194 short-circuit)."""

    def test_jwt_required_403_without_token(self, client):
        """No bearer token → 403."""

    def test_factory_mismatch_403(self, client, auth_token):
        """JWT factoryId != path factoryId → 403."""


class TestComposite4FieldShape:
    @pytest.mark.asyncio
    async def test_envelope_6_keys_present(self, monkeypatch):
        """Verify keys: ranking, targetCompletion, heatmap, opportunityScores, dateRange, generatedAt."""

    @pytest.mark.asyncio
    async def test_dict_eq_against_F999_golden(self, monkeypatch):
        """F999 dict-eq with generatedAt stripped."""

    @pytest.mark.asyncio
    async def test_dict_eq_against_F001_golden(self, monkeypatch):
        """F001 real-data dict-eq with generatedAt stripped."""


class TestEmptyData:
    @pytest.mark.asyncio
    async def test_empty_rows_returns_empty_lists(self, monkeypatch):
        """ranking=[], targetCompletion=[], opportunityScores=[]."""

    @pytest.mark.asyncio
    async def test_empty_rows_heatmap_shape(self, monkeypatch):
        """heatmap = {chartType:'MAP', title:..., data:[]} — 3 fields only, no options."""

    @pytest.mark.asyncio
    async def test_empty_prev_rows_opportunity_scores_use_zero(self, monkeypatch):
        """current rows non-empty, prev rows empty → previous_sales=0 per region."""
```

### 5.2 PR-B: Arithmetic depth (~400 LOC, 4 test class, ~30 tests total)

`tests/python/smartbi_compat/test_analysis_region_arithmetic.py`:

```python
class TestRegionRanking:
    """Sub-service 1: ranking sort + completion + alert."""

    def test_completion_rate_formula_actual_div_target_pct(self):
        """rate = actual/target * 100, scale 2 HALF_UP."""

    def test_alert_level_red_below_60(self):
        """rate=59.99 → RED."""

    def test_alert_level_yellow_60_to_85(self):
        """rate=60 → YELLOW; rate=84.99 → YELLOW."""

    def test_alert_level_green_at_or_above_85(self):
        """rate=85 → GREEN; rate=100 → GREEN."""

    def test_target_zero_returns_zero_completion(self):
        """target=0 → completionRate=0 (Java line 757-759 div-by-zero guard)."""

    def test_sort_by_total_amount_desc(self):
        """First entry has highest amount, last has lowest."""

    def test_unclassified_bucket_for_null_region(self):
        """Rows with region=None → '未分类' bucket aggregated together."""

    def test_rank_starts_at_1_and_monotonic(self):
        """rank values: 1, 2, 3, ... (no skips, no zero)."""


class TestRegionTargetCompletion:
    """Sub-service 2: MetricResult shape + sort by completion desc."""

    def test_metric_code_format_REGION_TARGET_prefix(self):
        """metricCode = 'REGION_TARGET_华东'."""

    def test_metric_name_format_region_suffix(self):
        """metricName = '华东 目标完成'."""

    def test_change_direction_up_when_completion_above_100(self):
        """rate=120 → UP."""

    def test_change_direction_down_when_completion_below_100(self):
        """rate=80 → DOWN."""

    def test_change_direction_stable_at_exactly_100(self):
        """rate=100 → STABLE."""

    def test_format_amount_thousand_separator(self):
        """1234567.89 → '1,234,567.89'."""

    def test_sort_by_change_percent_desc(self):
        """First entry has highest completion, last has lowest."""

    def test_dimension_value_equals_region_name(self):
        """dimensionValue field == region key."""


class TestGeographicHeatmap:
    """Sub-service 3: province aggregation + normalize + colorLevel."""

    def test_normalize_province_guangxi_zhuang_autonomous(self):
        """'广西壮族自治区' → '广西' (order: 自治区 first, then 壮族)."""

    def test_normalize_province_xinjiang_uyghur_autonomous(self):
        """'新疆维吾尔自治区' → '新疆'."""

    def test_normalize_province_ningxia_hui_autonomous(self):
        """'宁夏回族自治区' → '宁夏'."""

    def test_normalize_province_beijing_city_suffix(self):
        """'北京市' → '北京'."""

    def test_normalize_province_hongkong_special(self):
        """'香港特别行政区' → '香港'."""

    def test_normalize_province_none_returns_unknown(self):
        """None → '未知'."""

    def test_color_level_high_at_or_above_0_7(self):
        """heatValue=0.7 → HIGH; 0.71 → HIGH."""

    def test_color_level_medium_0_3_to_0_7(self):
        """heatValue=0.3 → MEDIUM; 0.69 → MEDIUM."""

    def test_color_level_low_below_0_3(self):
        """heatValue=0.29 → LOW; 0 → LOW."""

    def test_aggregate_by_province_unclassified_bucket(self):
        """Null/empty province → '未分类'."""

    def test_max_zero_heat_value_is_zero(self):
        """All amounts=0 → heatValue=0 for every province."""

    def test_heatmap_options_map_of_4_keys(self):
        """options has exactly: mapType, showLabel, roam, visualMap."""

    def test_heatmap_visual_map_map_of_3_keys(self):
        """visualMap has exactly: min, max, calculable."""


class TestRegionOpportunityScores:
    """Sub-service 4: 4-dim scoring + total + level."""

    def test_growth_score_clamp_to_zero_when_minus_50(self):
        """growth=-50 → score=0."""

    def test_growth_score_50_when_growth_zero(self):
        """growth=0 → score=50."""

    def test_growth_score_clamp_to_100_when_plus_50(self):
        """growth=+50 → score=100."""

    def test_growth_score_prev_zero_curr_positive_returns_100(self):
        """prev=0, curr>0 → MoM=100, score=min(150, 100)=100."""

    def test_base_score_3x_multiplier(self):
        """region=10, total=100 → ratio=10%, score=10*3=30."""

    def test_base_score_clamp_to_100_at_33_34_pct(self):
        """region=33.34, total=100 → score=min(100.02, 100)=100."""

    def test_base_score_below_clamp_at_33_33_pct(self):
        """region=33.33, total=100 → score=99.99 (NOT 100)."""

    def test_base_score_total_zero_returns_zero(self):
        """total_sales=0 → base_score=0."""

    def test_margin_score_3_33_decimal_exact(self):
        """grossMargin=30 → score=99.9 (NOT 100)."""

    def test_margin_score_clamp_to_100_at_30_04_pct(self):
        """grossMargin=30.04 → score=min(100, 30.04*3.33=100.0332)=100.

        Note: 30.03 does NOT clamp (30.03 × 3.33 = 99.9999, < 100).
        Boundary is 30.0301...; 30.04 is the smallest 2-decimal value that clamps.
        """

    def test_margin_score_none_returns_zero(self):
        """grossMargin=None → score=0."""

    def test_penetration_score_int_division(self):
        """customers=5, orders=99 → score=5*10 + 99//10 = 50+9 = 59 (NOT 59.9)."""

    def test_penetration_score_str_input_coerced_via_int(self):
        """customers='5', orders='99' → int() coerced → 59."""

    def test_penetration_score_clamp_to_100(self):
        """customers=20, orders=0 → score=200, clamped to 100."""

    def test_total_score_weights_sum_to_one(self):
        """g=100, b=100, m=100, p=100 → total = 30+25+25+20 = 100."""

    def test_total_score_zero_when_all_dims_zero(self):
        """All dims=0 → total=0."""

    def test_opportunity_level_high_at_70(self):
        """totalScore=70 → HIGH; 69.99 → MEDIUM."""

    def test_opportunity_level_medium_40_to_70(self):
        """totalScore=40 → MEDIUM; 39.99 → LOW."""

    def test_opportunity_level_low_below_40(self):
        """totalScore=39.99 → LOW."""

    def test_previous_period_window_5_day_span(self):
        """start=2024-01-15, end=2024-01-20 → prev=(01-09, 01-14)."""

    def test_previous_period_window_single_day(self):
        """start=end=2024-01-15 → prev=(01-14, 01-14)."""

    def test_previous_period_window_year_boundary(self):
        """start=2024-01-05, end=2024-01-10 → prev=(2023-12-30, 2024-01-04)."""

    def test_calculate_mom_growth_prev_zero_curr_positive_returns_100(self):
        """prev=0, curr=100 → 100."""

    def test_calculate_mom_growth_prev_zero_curr_zero_returns_zero(self):
        """prev=0, curr=0 → 0."""

    def test_calculate_mom_growth_prev_nonzero_curr_null_returns_minus_100(self):
        """prev=100, curr=None → -100."""

    def test_recommendation_high_level_template(self):
        """level=HIGH → '<region>是高潜力区域,优势在于<x>,建议重点提升<y>。'."""

    def test_recommendation_strongest_weakest_dim_selection(self):
        """Picks max dim as 优势 and min dim as 重点提升 from 4 dims."""

    def test_sort_by_total_score_desc(self):
        """First entry has highest score, last has lowest."""

    def test_customer_count_set_dedupes(self):
        """Same customer name twice → customer_count=1, not 2."""
```

### 5.3 Mock pattern

```python
async def fake_query_region_full(factory_id, start, end):
    """Test fixture: synthesizes rows for specific arithmetic branches."""
    if (end - start).days < 5:
        return []  # empty for prev period scenarios
    return [
        {
            "id": "001",
            "factory_id": factory_id,
            "region": "华东", "province": "上海市", "city": "上海",
            "amount": Decimal("1000"), "cost": Decimal("700"),
            "monthly_target": Decimal("1500"),
            "customer_name": "C1",
            "order_date": date(2024, 6, 1),
        },
        # ... more synthesized rows
    ]


@pytest.fixture
def mock_query_region(monkeypatch):
    monkeypatch.setattr(
        "smartbi_compat.api.analysis_region._query_region_full",
        fake_query_region_full,
    )
```

### 5.4 Smoke compare (impl chat to execute)

```bash
# Step 1: re-record F001 region golden (overwrites stored fixture)
./scripts/record-java-golden.sh F001 fac001 region \
    "startDate=2024-01-01&endDate=2024-12-31" \
    > /tmp/region-F001-fresh.json

# Step 2: diff with checked-in golden
diff <(jq 'del(.generatedAt) | .' tests/fixtures/java-smartbi-golden/analysis-region-F001.json) \
     <(jq 'del(.generatedAt) | .' /tmp/region-F001-fresh.json)
# Expected: empty diff (only generatedAt should change between runs)
```

---

## 6. Byte gate 语义

### 6.1 dict-eq vs strict-byte

Phase 2A 全域统一使用 dict-eq compare,跟 cost / profit / payable / receivable / budget / department spec 同标准。

**dict-eq 容忍**:
- `0` (Python int) vs `0.0` (Java BigDecimal output) — Python `0 == 0.0` True
- `1234.56` (Python float) vs `1234.56` (Java BigDecimal setScale(2)) — `_decimal_to_number` 保证 Python 输出 int if integral else float
- 字符串字段不容忍差异

**dict-eq 不容忍**:
- key 缺失 / 多 key
- 嵌套 dict 内 key 顺序差异 (实际上 dict-eq 不依赖 key 顺序,但 strict-byte gate Phase 3+ 会要求)

**strip 字段**:
- `generatedAt` (timestamp,volatile)

### 6.2 Decimal serialization (Rule 4)

所有 `BigDecimal` 字段通过 `_decimal_to_number` (定义在 `analysis_finance.py`):

```python
def _decimal_to_number(v: Decimal) -> Any:
    if v == v.to_integral_value():
        return int(v)
    return float(v)
```

输出: `Decimal("0.00")` → `0` (int),`Decimal("1234.56")` → `1234.56` (float)。Java Jackson 输出: `BigDecimal("0.00")` → `0` (一些场景) 或 `0.00` (其他)。dict-eq 容忍此差异。

### 6.3 Map.of(N) Jackson hash order (Rule 8)

**未 record golden 前禁止 finalize dict literal**。本 spec 标记所有 Map.of(N) 输出为 `KEY-ORDER-TBD-VIA-GOLDEN`,impl chat MUST 录制 F999 + F001 后才能写最终 dict 顺序。

**已知 Map.of(N) 站点**:
1. `heatmap.options` — Map.of(4) keys: `mapType, showLabel, roam, visualMap`
2. `heatmap.options.visualMap` — Map.of(3) keys: `min, max, calculable`

**HashMap 站点 (NOT Map.of)**:
1. Top-level dispatcher result — Java `new HashMap<>()` (SmartBIServiceImpl line 575) — hash-bucket order, NOT insertion. 6 keys: `ranking, targetCompletion, heatmap, opportunityScores, dateRange, generatedAt`. TBD-via-golden.

**LinkedHashMap 站点 (insertion order, Python dict 直接 mirror)**:
1. `_aggregate_by_region` → `_aggregate_by_province` 内部 LinkedHashMap — Python `dict.setdefault` 保 insertion order ≡ Java
2. heatmap data item — Java `new LinkedHashMap<>()` (line 353) — explicit insertion. Python dict literal in same source order matches.
3. opportunity recommendation dims map — `LinkedHashMap` insertion (增长率, 销售基数, 毛利率, 市场渗透)

---

## 7. PR 切片 + 顺序

### 7.1 Spec PR (本 PR)

**Branch**: `phase2a/spec-region`
**Base**: `origin/main` (5d284d38d Rule 8 land)
**Files**: 仅 `docs/superpowers/specs/2026-05-01-phase2a-analysis-region-design.md` (本文件)
**估时**: 2-3h spec write + 1h 4-cycle audit + ship
**Merge prereq**: 4-cycle audit pass (self / spec-reviewer / cross-spec / final-impl-reviewer)

### 7.2 PR-A: Foundation + contract tests

**Branch**: `phase2a/region-foundation`
**Base**: `origin/main` (含本 spec PR + Wave 1 PR-As)
**Files**:
- `backend/python/smartbi_compat/api/analysis_region.py` (~600 LOC)
- `backend/python/main.py` (+2 lines: import + include_router at line 1117)
- `tests/python/smartbi_compat/test_analysis_region_contract.py` (~150 LOC)
- `tests/fixtures/java-smartbi-golden/analysis-region-F999.json` (recorded)
- `tests/fixtures/java-smartbi-golden/analysis-region-F001.json` (recorded)

**估时**: 4-6h impl + test write
**HARD prereq**: F999 + F001 goldens recorded BEFORE plan finalization (cf §4.1)

**Acceptance**:
- All region tests pass on local Python 3.8 (server venv38 — see `feedback_python_version_compat_deployment.md`)
- F999 + F001 dict-eq pass with generatedAt stripped
- **`_query_region_full` MUST use `_to_thread` shim** (imported from `analysis_sales`),NOT bare `asyncio.to_thread` — Python 3.8.17 lacks `asyncio.to_thread`,production will `AttributeError` at runtime even though local mocked tests pass (mocks bypass the shim entirely)
- R-T12 verification: F999/F001 golden inspection confirms `opportunityScores[0]` key order matches Python dict literal in §3.10
- Test env (Java 10011) deploy → smoke compare on real F001 data
- Lint clean (project-standard linter)

### 7.3 PR-B: Arithmetic depth tests

**Branch**: `phase2a/region-arithmetic`
**Base**: `origin/main` (含 PR-A)
**Files**:
- `tests/python/smartbi_compat/test_analysis_region_arithmetic.py` (~400 LOC, 4 test class × ~7 tests = ~28 tests)

**估时**: 3-4h test write
**Goal**: Lock R-T1 ~ R-T13 trap 全部测试覆盖 (含 R-T5 period window + R-T13 completion-rate arithmetic divergence)。Each lock has at least one dedicated test with explicit boundary value.

**Critical R-T13 test note**: The arithmetic-order divergence between region's `(actual/target).quantize(4)*100` and department's `(actual*100/target).quantize(4)` is invisible for round numbers (e.g., actual=80, target=100 → both produce 80.0000). PR-B test for R-T13 MUST use non-round inputs that expose the order difference, e.g., `actual=Decimal("33.333"), target=Decimal("9.7") → expected=Decimal("343.6400")` (region order), NOT `Decimal("343.6392")` (department/sales order). If the test produces the latter, the impl chat accidentally imported `analysis_sales._calculate_completion_rate` instead of defining the local copy — fix immediately.

### 7.4 Subsequent waves (out of scope)

- Wave 4 quality spec (Tier 2,4 sub-service composite,继承本 spec + department 模板)
- Wave 4 procurement spec (Tier 2,同上)

---

## 8. Open risks + mitigations

### 8.1 Lock-in risks (spec 强制 mirror,无 risk)

| ID | 描述 | 锁定位置 |
|---|---|---|
| R-T1 | `_calculate_penetration_score` int division (`order_count // 10`) | §3.5 |
| R-T2 | `_calculate_margin_score` Decimal("3.33") exact multiplier | §3.5 |
| R-T3 | `_calculate_base_score` `* 3` clamp at 33.34% | §3.5 |
| R-T4 | `_calculate_growth_score` ±50 shift + clamp | §3.5 |
| R-T6 | `RegionAggregation.customer_count = len(customers)` incremental sync | §3.2 |
| R-T7 | `_normalize_province_name` 7-step regex order (自治区 before 壮族) | §3.6 |
| R-T8 | '未分类' bucket for null/empty region | §3.4 |
| R-T11 | `gross_margin` stays Decimal("0") on amount=0 (NOT None) | §3.2 |
| R-T5 | `_previous_period_window` 邻接窗口 `start - days_between - 1` — Java `ChronoUnit.DAYS.between(start, end)` ≡ Python `(end - start).days` for `date` objects (both exclusive day count). Pure date arithmetic, deterministic, golden-independent. Promoted from verify-via-golden (cycle 4) since formula is fully verifiable from Java source. | §3.5 |
| R-T13 | `_calculate_completion_rate` arithmetic order `(actual/target).quantize(4) * 100` matches Region Java line 760, NOT department's `(actual*100/target).quantize(4)`. Region defines locally, does NOT import from analysis_sales (which uses sales-Java order producing different bytes). | §3.7 |

### 8.2 Verify-via-golden risks (impl chat MUST 实际录 golden 验证)

| ID | 描述 | 验证步骤 |
|---|---|---|
| R-T9 | Heatmap `colorLevel` 0.7/0.3 阈值,Decimal vs Java `doubleValue()` 边界 | F001 含 heatValue 接近 0.7 / 0.3 的 row 时验证 |
| R-T10 | SQL `ORDER BY id ASC` 是否真匹配 Java JPA 默认 fetch order | F001 多 row 同 region 时验证 LinkedHashMap insertion order |
| R-T12 | `RegionOpportunityScore` Lombok @Data 字段顺序 — Java DTO 行 64 `recommendation` BEFORE 行 69 `opportunityLevel`,Python dict 已按 Java 顺序写但需 golden 验证 Lombok 实际 Jackson 输出顺序 (Lombok 默认应该是 declaration order,但若有 `@JsonPropertyOrder` 或 Jackson global config 可能差异) | F999/F001 golden 中 `opportunityScores[0]` 各 key 顺序 char-by-char 验证 |

### 8.3 Already-known caveats (Java 既有行为,Python mirror 不修)

1. **`formatAmount` Locale-dependent**: Java `String.format("%,.2f", ...)` 依赖 JVM default Locale。生产 Linux JVM = en_US,Python `f"{val:,.2f}"` 匹配。Locale 改变会偏差 (Java 既有 bug),Python 锁住 mirror。

2. **`aggregateByRegion` ignores precomputed columns**: 行级 `gross_margin` 和 `profit` 列存在但被忽略,Python 同样从 `total_amount - total_cost` 重算。属于 Tier 2 I-3 mirror lock。

3. **`getComprehensiveAnalysis` 用 HashMap not LinkedHashMap**: Java line 575 `new HashMap<>()` 输出顺序由 hash-bucket 决定,跟字段 insertion 顺序无关。Rule 8 适用,golden 反推。

4. **4 sub-services 重复 DB 查询**: Java 在每个 sub-service 内 `findByFactoryIdAndOrderDateBetween`,4 次重复查询。Python 优化为 2 次 (current + previous),不影响 byte-shape。

### 8.4 Spec-level open questions (impl 阶段 resolve)

1. **顶层 6-key HashMap key 顺序**: 必须 record golden 反推。Source 顺序 `ranking, targetCompletion, heatmap, opportunityScores, dateRange, generatedAt` 大概率不是 Jackson 输出顺序。

2. **`generatedAt` 时区格式**: Java `LocalDateTime.now()` 无时区信息,Jackson 输出取决于配置。Sister specs 用 `+08:00` 后缀但需 golden 验证 region 端是否一致。如不一致,改用 `LocalDateTime` 无时区格式。

3. **ChartConfig empty case shape**: 空数据时 Java 返 `ChartConfig{chartType, title, data}` 仅 3 字段。Lombok @Data + Jackson skip-null 是否真的 skip 掉 `xAxisField/yAxisField/options`?需 golden 反推。Spec 假设 skip,但 impl chat 必须 record 验证。

### 8.5 Risk mitigation 总策略 (impl chat HARD prereq)

1. 录 F999 + F001 goldens BEFORE plan
2. 反推 4 个 Map.of/HashMap key 顺序: top-level 6-key, heatmap options Map.of(4), visualMap Map.of(3),(以及任何嵌套 — golden 暴露)
3. Plan 按 golden 顺序写 dict literal (KEY-ORDER-TBD-VIA-GOLDEN 标记替换)
4. 全部 mocked tests 通过后才 deploy test env (Python 3.8 兼容,server venv38)
5. F001 真窗 smoke compare 通过才 ship PR-A

---

## 9. References

### 9.1 Cross-spec lineage

- **Chat 4 department spec** `docs/superpowers/specs/2026-05-01-phase2a-analysis-department-design.md` (branch `phase2a/spec-department` 待 merge):
  - §1.3: Composite-only dead-code-skip 决策模式 (smartBIService==null 永不触发)
  - §3.4-3.5: Tier 2 lock-in 模式 (T1 60/85 inline 常量 NOT alert_thresholds.py 80,I-3 precomputed 列忽略,Rule 5 SELECT *)
  - §6: PR-A foundation + PR-B arithmetic 切片模板

  **本 spec 直接继承上述 3 个模式**。Tier 2 sister chat (quality, procurement) 也应该继承,避免重复挖坑。

- **Chat 3 finance sub-endpoints PR #32** (commit `ccdeb4b1b`,2026-05-01):
  - 引入 Map.of(N) golden 反推 pattern
  - Rule 8 audit lineage 起点

- **Chat 2 cost spec PR #25** (`docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-cost-design.md`):
  - Tier 1 → Tier 2 spec 模板进化基础
  - PR-A foundation + PR-B arithmetic 切片首例

- **Wave 1 sister specs (待 impl)**:
  - receivable PR #33 (commit `1b02aea83`)
  - budget PR #34 (commit `354505352`)

  本 spec impl chat 启动条件: Wave 1 PR-As 全部 land 后再启动 (避免 SQL helper 命名冲突 / 共享 fixture 文件冲突)。

### 9.2 Rules cite (`.claude/rules/python-java-port.md`,5d284d38d 已 land main)

- **Rule 1** (Null fallback `is not None` 三元): `_calculate_total_score` 4 个 None-guard,`_normalize_province_name` None case,`_aggregate_by_region` null/empty region check,`RegionAggregation.add_sale` 全部字段 None-check,opportunity scores `previous_sales` if-None
- **Rule 2** (WEEK calendar year): N/A (composite path 不含 trend chart period 输出)
- **Rule 3** (函数签名 1:1 mirror): 4 sub-service `_build_*(rows)` 跟 Java `(factoryId, start, end)` 不同 — 这是 dispatcher 优化 (单查询复用 rows),非 wrapper。`_get_region_analysis(factory_id, range_)` 是 dispatcher 例外 (跟 sales/department 同模式)
- **Rule 4** (`_decimal_to_number`): heatmap `value`/`heatValue`/`options.visualMap.max`,opportunity score 各 Decimal 字段,ranking + targetCompletion 全部 Decimal 字段
- **Rule 5** (SELECT *): `_query_region_full`
- **Rule 6** (输入 None-check): `_query_region_full` 拒绝 start/end None
- **Rule 7** (Decimal 阈值 vs float): R-T9 heatmap 0.7/0.3 用 Decimal 比较,**不**用 float()。`_determine_opportunity_level` 70/40 是整数,float() 也安全但用 Decimal 保持一致
- **Rule 8** (Map.of(N) Jackson hash order): heatmap Map.of(4) + visualMap Map.of(3),top-level HashMap → KEY-ORDER-TBD-VIA-GOLDEN

### 9.3 Code refs

| 路径 | 行号 | 用途 |
|---|---|---|
| `backend/java/cretas-api/.../impl/RegionAnalysisServiceImpl.java` | 1-1209 | Primary truth |
| `backend/java/cretas-api/.../service/smartbi/RegionAnalysisService.java` | 1-190 | Interface |
| `backend/java/cretas-api/.../impl/SmartBIServiceImpl.java` | 570-616 | Composite dispatcher (`getComprehensiveAnalysis`) |
| `backend/java/cretas-api/.../controller/SmartBIAnalysisController.java` | 179-218 | Route |
| `backend/java/cretas-api/.../impl/MetricCalculatorServiceImpl.java` | 425-438 | `calculateMomGrowth` semantics |
| `backend/java/cretas-api/.../service/smartbi/MetricCalculatorService.java` | 183-184 | Alert threshold Javadoc (TARGET_COMPLETION 60/85) |
| `backend/java/cretas-api/.../dto/smartbi/RegionOpportunityScore.java` | 99-145 | DTO `calculateTotalScore` + `determineOpportunityLevel` |
| `backend/java/cretas-api/.../entity/smartbi/SmartBiSalesData.java` | 1-200 | Column schema (region/province/city/customer_name/amount/cost/...) |
| `backend/python/smartbi_compat/api/analysis_sales.py` | 1689-1709 | Route handler 模板 |
| `backend/python/smartbi_compat/api/analysis_finance.py` | _decimal_to_number 等 | Helper 复用源 |
| `backend/python/main.py` | 1111-1117 | Router 注册位置 |

### 9.4 Tier 2 lineage statement

**Tier 2 spec template 由 Chat 4 department spec (2026-05-01,branch `phase2a/spec-department` 待 merge,impl chat 启动前必须用 `git diff origin/main...phase2a/spec-department` 与最终 merged 版本对照,确认 §1.3/§3.4-3.5/§6 模板继承未漂移)** 在 finance Wave 1 + sales 系列基础上建立。本 region spec 在其上增加 region 专属 13 个 trap:
- **9 lock-in** (强制 mirror, §8.1): R-T1, R-T2, R-T3, R-T4, R-T5, R-T6, R-T7, R-T8, R-T11
- **3 verify-via-golden** (§8.2): R-T9, R-T10, R-T12
- **1 cross-spec divergence lock** (R-T13 §8.1): `_calculate_completion_rate` arithmetic order intentionally diverges from analysis_sales / department because region Java has its own arithmetic. **Critical** — sister chat audit must NOT consolidate this duplicate helper.

后续 Tier 2 sister chat (quality, procurement) 应该:
1. 从本 spec 复制 §1 (composite-only 决策) + §6 (byte gate 语义) + §7 (PR 切片) 模板
2. 替换 §2-§5 为各自 sub-service 算法
3. 列出各自 trap inventory (R-Q1.../R-P1...) 区分 lock-in vs verify-via-golden
4. 引用 Chat 4 department spec + 本 region spec 作为 Tier 2 lineage

**重复挖坑预防**: 8 个 lock-in trap (R-T1/T2/T3/T4/T6/T7/T8/T11) 几乎全部源自 Java 整数除法 / Decimal 精确 / Set 增量同步 / null vs empty / regex 顺序 / 阈值 inline 这类 Tier 2 sister 都会踩的语言习惯差异。后续 sister chat 应该一来就把这些 lock 进 §3 pseudo-code,不要等 cycle 1-3 audit 才发现。

---

**Spec end. Total length: ~1180 LOC. Awaiting 4-cycle audit + user review.**

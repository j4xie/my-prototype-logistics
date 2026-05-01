# Phase 2A `/analysis/finance?analysisType=receivable` per-type port — design

> Java→Python byte-shape parity port. 1 主 helper + 4 sub-services + 2 utilities, mirror `FinanceAnalysisServiceImpl` (lines 583-827). Replaces existing stub `_get_receivable_aging_chart` @ `analysis_finance.py:1262`.
>
> **当前 main**: `aa6741c53` (PR #31 phase2a backlog map merged)
> **本 spec PR base**: `phase2a/spec-receivable` from `origin/main`
> **Sister chat in-flight**: `phase2a/finance-sub-endpoints` (本地 worktree, 未 push) — 不要碰

---

## Inherited audit constraints

Spec **必须** 遵守 `.claude/rules/python-java-port.md` 全部 7 rules. 受 receivable 影响的关键 rules:

| Rule | 受影响场景 |
|---|---|
| **Rule 1** Null fallback `is not None` 三元 | `receivable_amount`/`collection_amount`/`agingDays`/`customer_name` 全部 — 严禁 `or` falsy fallback (Python `Decimal("0")` 是 falsy) |
| **Rule 3** 函数签名 1:1 mirror Java | `_get_receivable_metrics(factory_id, end_date)` 跟 sister `_get_payable_metrics` 同款 (line 1296), 不要包 wrapper |
| **Rule 4** `_decimal_to_number` 序列化 | 所有 `value` 字段 (5 metrics + agingChart amount/percentage + ranking value + trendChart 4 fields) |
| **Rule 5** 共享 SQL helpers `SELECT *` | 复用 `_query_finance_data` (line 687, RecordType=AR), 不重新写 SQL |
| **Rule 6** Helper 输入边界 None-check | `_query_finance_data` 已有 precondition. 4 sub-helpers 不需自加 |
| **Rule 7** 浮点阈值 Decimal 比较 | Receivable 阈值全是整数 (60/80/30/15/50/25/20.0/10.0 都是 integer-valued) → `float()` cast 跟 Java `doubleValue()` 一致, OK |

Rule 2 (WEEK ISO-year) 不适用 — receivable trendChart 仅按 month 桶 (Java line 795 `yyyy-MM`).

---

## 1. 背景 + 范围锁定

### 1.1 当前状态 (main)

- 4 sister per-type 已 ship: composite (PR #13) / payable (#18) / profit (#21+#22) / cost (#25+#28)
- `_get_finance_analysis` route (analysis_finance.py:1510) 已分支 4 case: `null/payable/profit/cost`. 其他 type 走 501 stub (line 1546-1548).
- `_get_receivable_aging_chart` (analysis_finance.py:1262) 是 **stub** 返 placeholder, 仅被 composite path (`_get_comprehensive_finance_analysis` line 1418) 调用.
- Java spec source: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/FinanceAnalysisServiceImpl.java` lines 583-827, 1492-1524, 1590-1603.

### 1.2 这一 chat 范围 (PR-A foundation, spec only)

- 新增 1 主 helper `_get_receivable_analysis(factory_id, start_date, end_date)`
- 新增 4 sub-helpers (1:1 mirror Java):
  - `_get_receivable_metrics(factory_id, end_date)` — Java line 627
  - `_get_receivable_aging_chart(factory_id, end_date)` — Java line 586 (替换 stub @ line 1262)
  - `_get_overdue_customer_ranking(factory_id, end_date)` — Java line 734
  - `_get_receivable_trend_chart(factory_id, start_date, end_date)` — Java line 786
- 新增 2 internal utilities:
  - `_calculate_aging_buckets(ar_data)` — Java line 1492
  - `_get_aging_bucket_alert_level(bucket)` — Java line 1590
- Route 改造: `_get_finance_analysis` (line 1510) 加 `if analysisType == "receivable":` 分支, 移除 line 1546 现有 501 case
- Goldens: F999 (空 6-key) + F001 (真窗, 不进 CI)
- Contract tests: `TestReceivableContract` (F999 + F001 byte-shape gate, 6-key envelope) + composite side-effect test

### 1.3 Side effects (透明升级, 非 out-of-scope)

Composite path `_get_comprehensive_finance_analysis` (line 1418) 调 `_get_receivable_aging_chart`. 当前调 stub 返 placeholder shape; PR-A 后调真实 impl 返 real shape.

**关键约束**: stub 跟 real impl 必须 **shape 完全相同** (`agingBucket / amount / percentage / alertLevel` per item, 4 items 顺序固定). 现有 stub 已经返这个 shape (placeholder values=0), real impl 替换后 key 列同, 只是 value 数值变. F999 composite byte-shape gate 必须保持 PASS.

加 1 contract test 验证: composite path with `analysisType=null` 在 receivable real impl 后 6-key composite envelope shape 不变.

### 1.4 PR-B 范围 (后续 chat 实施, 本 spec 只列大纲)

**测试 budget**: 跟 cost (9 PR-B tests) / profit (17 PR-B tests) 同量级, **目标 ~16-20 PR-B tests** (parametrized clusters, 不是 50+ 逐 case). 下面边界是分类引导;
plan 阶段把每 cluster 折叠成 parametrized test 包圆.

Arithmetic depth tests, 在 plan 阶段拆 ~14 tasks (~16-20 实际 test functions):

- aging buckets 边界 case: agingDays = 0 / 30 / 31 / 60 / 61 / 90 / 91 / -1 (8 boundary, Java `<= 30/<= 60/<= 90/else`)
- outstanding ≤ 0 skip case (3: =0, <0, both null)
- null agingDays Java fallback to 0 → bucket = AGING_BUCKET_0_30 (1)
- 5 metrics 公式 depth (collectionRate / aging30/60/90 ratios / arBalance, 各 2-3 case)
- alertLevel 阈值边界 (Java `>` strict — boundary value 落 lower level):
  - collectionRate: `59.99→RED, 60.0→RED (因为<60 是 RED, 60.0 不<60), 60.01→YELLOW, 79.99→YELLOW, 80.0→YELLOW (Java <80 YELLOW), 80.01→GREEN` (注意 Java line 1641-1643 用 `if v<60 RED; if v<80 YELLOW; else GREEN`)
  - AGING_30: `24.99→GREEN, 25.0→GREEN (Java >25 strict), 25.01→YELLOW, 49.99→YELLOW, 50.0→YELLOW, 50.01→RED`
  - AGING_60: `14.99→GREEN, 15.0→GREEN, 15.01→YELLOW, 29.99→YELLOW, 30.0→YELLOW, 30.01→RED`
  - AGING_90: `9.99→GREEN, 10.0→GREEN, 10.01→YELLOW, 19.99→YELLOW, 20.0→YELLOW, 20.01→RED`
- overdueRanking sort (top-10 cap, customer max agingDays alertLevel: `>90 RED, >60 YELLOW, else GREEN`)
- trendChart monthly bucketing (yyyy-MM 格式, 跨年 boundary, balance = receivable - collection)

### 1.5 显式不在范围

- ❌ Java legacy receivable service 删除 (Phase 3.A)
- ❌ Receivable trendChart period override (Java 锁定 month, 不接受 query param)
- ❌ Per-type CSV/PDF export (上层 Java 处理)
- ❌ Receivable subtype Phase 3 改造 (例: 多币种, 客户 ABC 分类)

---

## 2. 架构 + 文件 delta

### 2.1 文件级修改 (`backend/python/smartbi_compat/api/analysis_finance.py`)

| 修改类型 | 位置 | 内容 |
|---|---|---|
| 新增主 helper | 紧跟 `_get_payable_analysis` (line 1485) 之后 | `_get_receivable_analysis(factory_id, start_date, end_date)` |
| 新增 sub-helper | 在主 helper 上方 (按 mirror Java 顺序) | `_get_receivable_metrics`, `_get_receivable_aging_chart` (替换 stub), `_get_overdue_customer_ranking`, `_get_receivable_trend_chart` |
| 替换 stub | line 1262 现有 `_get_receivable_aging_chart` | 替换为 real impl (注: 主 helper 调它, composite path `_get_comprehensive_finance_analysis` 也调它) |
| 新增 utility | 紧跟 `_get_period_key` (line 453) | `_calculate_aging_buckets(ar_data)`, `_get_aging_bucket_alert_level(bucket)` |
| 新增模块常量 | 文件顶部 (`# === Receivable constants ===` 块) | 4 bucket 字面量 + `AGING_BUCKETS_ORDER` list + `_AGING_BUCKET_ALERT_LEVELS` map + threshold 常量 (`AGING_90_RED_THRESHOLD=20.0`, `AGING_90_YELLOW_THRESHOLD=10.0`) — **全部集中在文件顶部** (跟现有 SCALE/DISPLAY_SCALE/ROUNDING_MODE 常量一致), §3.7 utility helper 只引用不重定义 |
| 新增模块 import | 文件顶部 | `from dateutil.relativedelta import relativedelta` (1 处, 不要 inline import). **`python-dateutil>=2.8.0` 已在 `requirements.txt`** ✓, 不需新增 dep |
| Route 分支 | `_get_finance_analysis` (line 1510-1548) | 在 `if analysisType == "cost":` 后加 `if analysisType == "receivable":`, 调 `_get_receivable_analysis(factory_id, start_date, end_date)` 返 dict |

### 2.2 关键架构决策

**A. 1-year SQL window for metrics/agingChart/overdueRanking**

3 个 sub-service 都用 `endDate.minusYears(1) → endDate` 数据窗 (Java line 631 / 590 / 738), **不是** [start_date, end_date]. 只 trendChart 用 [start_date, end_date].

主 helper 必须传 4 次不同的时间参数:
```python
async def _get_receivable_analysis(factory_id, start_date, end_date):
    metrics = await _get_receivable_metrics(factory_id, end_date)
    aging_chart = await _get_receivable_aging_chart(factory_id, end_date)
    overdue_ranking = await _get_overdue_customer_ranking(factory_id, end_date)
    trend_chart = await _get_receivable_trend_chart(factory_id, start_date, end_date)
    return {
        "startDate": start_date.isoformat(),
        "endDate": end_date.isoformat(),
        "metrics": metrics,
        "agingChart": aging_chart,
        "overdueRanking": overdue_ranking,
        "trendChart": trend_chart,
    }
```

**B. Decimal 精度 mirror Java**

- Java `SCALE = 4`, `DISPLAY_SCALE = 2`, `ROUNDING_MODE = HALF_UP`
- Python: 复用 cost spec 已落地的 `_decimal_to_number` helper + `Decimal(...).quantize(Decimal('0.01'), ROUND_HALF_UP)` for display
- 金额 metric 用 DISPLAY_SCALE=2 (line 651, 690 等); 中间计算 SCALE=4 (line 660)

**C. Aging bucket 顺序锁定**

Java `Arrays.asList(0_30, 31_60, 61_90, OVER_90)` (line 600). Python 必须用 list 显式枚举顺序, **不能依赖 dict 迭代** (asyncpg row dict 顺序不保证):
```python
AGING_BUCKETS_ORDER = ["0-30天", "31-60天", "61-90天", "90天以上"]
```

**D. Outstanding > 0 filter (calculate_aging_buckets)**

Java line 1505 显式 skip outstanding ≤ 0:
```java
if (outstanding.compareTo(BigDecimal.ZERO) <= 0) continue;
```

Python 必须 1:1 mirror:
```python
if outstanding <= Decimal("0"):
    continue
```

**E. NULL handling Rule 1 严守**

- Java line 1500: `data.getAgingDays() != null ? data.getAgingDays() : 0` — Python `aging_days = row.get('aging_days') if row.get('aging_days') is not None else 0`
- Java line 638-639: `Objects::nonNull` filter on stream — Python `if r.get('receivable_amount') is not None`
- Java line 743 ranking guard: `data.getCustomerName() == null || data.getAgingDays() == null || data.getAgingDays() <= 0` — Python 三个 condition 全 mirror

### 2.3 与 cost / profit / payable 的差异点

| 维度 | Cost | Profit | Payable | **Receivable** |
|---|---|---|---|---|
| 主 helper 时间参数 | `(start, end)` | `(start, end)` | `(end_date)` only | `(start, end)` (trendChart 需 start) |
| Sub-helper 时间窗 | 全部 [start, end] | 全部 [start, end] | 仅 endDate | metrics/aging/ranking 用 **1 年窗**; trend [start, end] |
| Sub 数 | 2 | 2 | 2 | **4** |
| 响应 envelope key 数 | 4 | 4 | 4 | **6** |
| Aging 概念 | 无 | 无 | 有 (Java 端镜像) | **有** (Python 端 1:1 port) |
| AlertLevel 来源 | 阈值表 (metricCalculatorService) | 同 cost | 硬编码 map | 硬编码 map + 4 阈值表 |
| Ranking 概念 | 无 | 无 | 无 | top-10 by overdue, `_new_ranking_item_dict` |
| Trend chart shape | LINE 单 series | LINE 单 series | 无 trend | LINE_BAR 双 series + balance line |
| F999 zero-guards | 4 | 4 | 0 (无 ratio) | **5** (collectionRate + 3 aging ratios + agingChart percentage) |
| 工厂函数复用 | `_new_metric_result_dict`, `_new_chart_config_dict` | 同 cost | 同 cost | 同 cost + `_new_ranking_item_dict` (line 151) |

---

## 3. Java 引用 + 算法对照

### 3.1 Java reference 位置 (mvn 路径)

```
backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/
├── FinanceAnalysisService.java               # interface
│   ├── line  37: AGING_BUCKET_0_30 = "0-30天"
│   ├── line  39: AGING_BUCKET_31_60 = "31-60天"
│   ├── line  41: AGING_BUCKET_61_90 = "61-90天"
│   ├── line  43: AGING_BUCKET_OVER_90 = "90天以上"
│   ├── line 162: getReceivableAgingChart signature
│   ├── line 179: getReceivableMetrics signature
│   ├── line 191: getOverdueCustomerRanking signature
│   └── line 203: getReceivableTrendChart signature
├── MetricCalculatorService.java              # metric code constants
│   ├── line  61: AR_BALANCE
│   ├── line  63: COLLECTION_RATE
│   ├── line  65: AGING_30_RATIO
│   ├── line  66: AGING_60_RATIO
│   └── line  67: AGING_90_RATIO
├── impl/FinanceAnalysisServiceImpl.java      # body
│   ├── line  104: AGING_90_RED_THRESHOLD = 20.0
│   ├── line  105: AGING_90_YELLOW_THRESHOLD = 10.0
│   ├── line  586-624: getReceivableAgingChart
│   ├── line  627-732: getReceivableMetrics
│   ├── line  734-783: getOverdueCustomerRanking
│   ├── line  786-827: getReceivableTrendChart
│   ├── line 1492-1524: calculateAgingBuckets
│   ├── line 1590-1603: getAgingBucketAlertLevel
│   └── line 1639-1644: determineCollectionRateAlertLevel
└── impl/MetricCalculatorServiceImpl.java     # threshold table
    ├── line 485-488: AGING_60_RATIO thresholds (>30 RED, >15 YELLOW, else GREEN)
    └── line 491-494: AGING_30_RATIO thresholds (>50 RED, >25 YELLOW, else GREEN)
```

### 3.2 `_get_receivable_metrics` 算法 (mirror Java line 627-732)

```python
async def _get_receivable_metrics(
    factory_id: str, end_date: date,
) -> list[dict]:
    """5 metrics: AR_BALANCE / COLLECTION_RATE / AGING_30_RATIO / AGING_60_RATIO / AGING_90_RATIO.

    Mirror Java FinanceAnalysisServiceImpl.getReceivableMetrics (line 627-732).
    Data window: [end_date - 1 year, end_date].
    """
    # Java line 630-631 — 1-year window
    # Java line 631 / 591 / 738 use LocalDate.minusYears(1) (calendar-aware, leap-year safe).
    # Python: use dateutil.relativedelta(years=1) (imported at file top per §2.1).
    # NOT timedelta(days=365) — would produce off-by-one on leap-year boundaries.
    start_window = end_date - relativedelta(years=1)  # NOTE: Java date.minusYears(1) ≠ -365; verify edge case
    ar_data = await _query_finance_data(
        factory_id, "AR", start_window, end_date,
    )

    # Java line 636-639 — totalReceivable, filter null
    total_receivable = sum(
        (_to_decimal(r["receivable_amount"]) for r in ar_data
         if r.get("receivable_amount") is not None),
        Decimal("0"),
    )
    # Java line 641-644 — totalCollection
    total_collection = sum(
        (_to_decimal(r["collection_amount"]) for r in ar_data
         if r.get("collection_amount") is not None),
        Decimal("0"),
    )

    metrics: list[dict] = []

    # ===== Metric 1: AR_BALANCE (Java line 647-656) =====
    ar_balance = total_receivable - total_collection
    # Use sister factory _new_metric_result_dict (analysis_finance.py:524) for byte-shape parity
    metrics.append(_new_metric_result_dict(
        metric_code="AR_BALANCE",
        metric_name="应收余额",
        value=_decimal_to_number(ar_balance.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        formatted_value=_format_currency(ar_balance),  # _format_currency @ line 406, no `¥` prefix
        unit="元",
        alert_level="GREEN",  # hardcoded line 654
        description="尚未收回的应收账款总额",
    ))

    # ===== Metric 2: COLLECTION_RATE (Java line 658-670) =====
    # Zero-guard: line 659
    collection_rate = (
        total_collection / total_receivable * Decimal("100")
        if total_receivable > Decimal("0")
        else Decimal("0")
    )
    metrics.append(_new_metric_result_dict(
        metric_code="COLLECTION_RATE",
        metric_name="回款率",
        value=_decimal_to_number(collection_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        formatted_value=str(collection_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)) + "%",
        unit="%",
        alert_level=_determine_collection_rate_alert(collection_rate),
        description="已回款金额占应收总额的比例",
    ))

    # ===== Aging buckets (Java line 673-679) =====
    aging_buckets = _calculate_aging_buckets(ar_data)
    over30 = (
        aging_buckets[AGING_BUCKET_31_60]
        + aging_buckets[AGING_BUCKET_61_90]
        + aging_buckets[AGING_BUCKET_OVER_90]
    )
    over60 = aging_buckets[AGING_BUCKET_61_90] + aging_buckets[AGING_BUCKET_OVER_90]
    over90 = aging_buckets[AGING_BUCKET_OVER_90]
    total_for_ratio = sum(aging_buckets.values(), Decimal("0"))

    # ===== Metric 3-5: AGING_30/60/90_RATIO (Java line 683-728) =====
    # Zero-guards: line 684, 698, 712. Descriptions verified @ Java line 694, 708, 727.
    for ratio_value, code, name, desc, threshold_func in [
        (over30, "AGING_30_RATIO", "30天以上账龄占比", "账龄超过30天的应收款占比", _aging_30_alert),
        (over60, "AGING_60_RATIO", "60天以上账龄占比", "账龄超过60天的应收款占比", _aging_60_alert),
        (over90, "AGING_90_RATIO", "90天以上账龄占比", "账龄超过90天的高风险应收款占比", _aging_90_alert),
    ]:
        ratio = (
            ratio_value / total_for_ratio * Decimal("100")
            if total_for_ratio > Decimal("0")
            else Decimal("0")
        )
        metrics.append(_new_metric_result_dict(
            metric_code=code,
            metric_name=name,
            value=_decimal_to_number(ratio.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            formatted_value=str(ratio.quantize(Decimal("0.01"), ROUND_HALF_UP)) + "%",
            unit="%",
            alert_level=threshold_func(ratio),
            description=desc,
        ))

    return metrics
```

> **Threshold edge cases** (Java uses `>` strict comparison, not `>=`):
> - `25.0` → GREEN (Java `if v > 25` false), `25.01` → YELLOW
> - `50.0` → YELLOW (`if v > 50` false), `50.01` → RED
> - Same pattern for collectionRate (60/80), aging60 (15/30), aging90 (10/20)
> - Boundary value AT threshold falls into LOWER alertLevel (PR-B test must verify this).

**Threshold helpers** (mirror Java MetricCalculatorServiceImpl line 485-494 + FinanceAnalysisServiceImpl line 1639-1644 + 715-719):

```python
def _determine_collection_rate_alert(rate: Decimal) -> str:
    # Java line 1639-1644
    v = float(rate)
    if v < 60: return "RED"
    if v < 80: return "YELLOW"
    return "GREEN"

def _aging_30_alert(ratio: Decimal) -> str:
    # Java MetricCalculatorServiceImpl line 491-494
    v = float(ratio)
    if v > 50: return "RED"
    if v > 25: return "YELLOW"
    return "GREEN"

def _aging_60_alert(ratio: Decimal) -> str:
    # Java MetricCalculatorServiceImpl line 485-488
    v = float(ratio)
    if v > 30: return "RED"
    if v > 15: return "YELLOW"
    return "GREEN"

def _aging_90_alert(ratio: Decimal) -> str:
    # Java line 715-719 (uses constants AGING_90_RED_THRESHOLD=20.0, AGING_90_YELLOW_THRESHOLD=10.0)
    v = float(ratio)
    if v > 20.0: return "RED"
    if v > 10.0: return "YELLOW"
    return "GREEN"
```

> **Rule 7 reminder**: 阈值是整数 (60/80/30/15/50/25/20.0/10.0), `float()` cast 跟 Java doubleValue() 一致, OK. 不需 `Decimal` 比较.

### 3.3 `_get_receivable_aging_chart` 算法 (mirror Java line 586-624)

```python
async def _get_receivable_aging_chart(
    factory_id: str, end_date: date,
) -> dict:
    """4-bucket bar chart. Replaces existing stub @ line 1262.

    Mirror Java getReceivableAgingChart (line 586-624). 1-year window.
    """
    # Java line 631 / 591 / 738 use LocalDate.minusYears(1) (calendar-aware, leap-year safe).
    # Python: use dateutil.relativedelta(years=1) (imported at file top per §2.1).
    # NOT timedelta(days=365) — would produce off-by-one on leap-year boundaries.
    start_window = end_date - relativedelta(years=1)  # Java line 591
    ar_data = await _query_finance_data(factory_id, "AR", start_window, end_date)

    aging_buckets = _calculate_aging_buckets(ar_data)
    total_ar = sum(aging_buckets.values(), Decimal("0"))

    chart_data: list[dict] = []
    for bucket in AGING_BUCKETS_ORDER:  # Java line 600 fixed order
        amount = aging_buckets.get(bucket, Decimal("0"))
        # Zero-guard line 605
        percentage = (
            amount / total_ar * Decimal("100")
            if total_ar > Decimal("0")
            else Decimal("0")
        )
        chart_data.append({
            "agingBucket": bucket,
            "amount": _decimal_to_number(amount.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "percentage": _decimal_to_number(percentage.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "alertLevel": _get_aging_bucket_alert_level(bucket),
        })

    # Use sister factory _new_chart_config_dict (analysis_finance.py:177) for byte-shape parity.
    # ⚠ Kwarg names are LOWERCASE `xaxis_field`/`yaxis_field` (factory emits "xaxisField"/"yaxisField"
    # per Lombok-Jackson demangling of getXAxisField → "xaxisField"). Verified against F999 golden.
    return _new_chart_config_dict(
        chart_type="BAR",  # Java line 619
        title="应收账款账龄分布",  # Java line 620 (verified)
        series_field=None,  # Java AggingChart 不设 series; factory emits seriesField=null
        data=chart_data,
        # Java line 614-616 — fixed options (LinkedHashMap, key order: colors, showAlert)
        options={
            "colors": ["#91cc75", "#fac858", "#ee6666", "#c23531"],
            "showAlert": True,
        },
        xaxis_field="agingBucket",  # Java line 621 (lowercase per factory)
        yaxis_field="amount",  # Java line 622
    )
```

### 3.4 `_get_overdue_customer_ranking` 算法 (mirror Java line 734-783)

```python
async def _get_overdue_customer_ranking(
    factory_id: str, end_date: date,
) -> list[dict]:
    """Top-10 customers by overdue amount. Mirror Java line 734-783.
    1-year window, customer-level aggregation, RankingItem 4-key shape.
    """
    # Java line 631 / 591 / 738 use LocalDate.minusYears(1) (calendar-aware, leap-year safe).
    # Python: use dateutil.relativedelta(years=1) (imported at file top per §2.1).
    # NOT timedelta(days=365) — would produce off-by-one on leap-year boundaries.
    start_window = end_date - relativedelta(years=1)
    ar_data = await _query_finance_data(factory_id, "AR", start_window, end_date)

    # Java line 741-756 — per-customer aggregation
    # values[0] = sum of overdue outstanding, values[1] = max agingDays
    customer_overdue: dict[str, list[Decimal]] = {}  # OrderedDict mirror LinkedHashMap
    for row in ar_data:
        customer_name = row.get("customer_name")
        aging_days = row.get("aging_days")
        # Java line 743 — 3-condition guard
        if customer_name is None or aging_days is None or aging_days <= 0:
            continue
        receivable = (
            _to_decimal(row["receivable_amount"])
            if row.get("receivable_amount") is not None
            else Decimal("0")
        )
        collection = (
            _to_decimal(row["collection_amount"])
            if row.get("collection_amount") is not None
            else Decimal("0")
        )
        outstanding = receivable - collection
        # Java line 751 — outstanding > 0 only
        if outstanding <= Decimal("0"):
            continue
        if customer_name not in customer_overdue:
            customer_overdue[customer_name] = [Decimal("0"), 0]  # [total, max_aging]
        customer_overdue[customer_name][0] += outstanding
        # Java line 754 — max
        customer_overdue[customer_name][1] = max(
            customer_overdue[customer_name][1], int(aging_days),
        )

    # Java line 760-763 — sort by overdue desc, top-10
    sorted_customers = sorted(
        customer_overdue.items(),
        key=lambda kv: kv[1][0],
        reverse=True,
    )[:10]

    rankings: list[dict] = []
    for rank, (customer, (total, max_aging)) in enumerate(sorted_customers, start=1):
        # Java line 767-772 — alertLevel by max aging
        if max_aging > 90:
            alert = "RED"
        elif max_aging > 60:
            alert = "YELLOW"
        else:
            alert = "GREEN"
        # Use sister factory _new_ranking_item_dict (analysis_finance.py:151) for byte-shape parity
        rankings.append(_new_ranking_item_dict(
            rank=rank,
            name=customer,
            value=_decimal_to_number(total.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            alert_level=alert,
        ))

    return rankings
```

> **Implementation note**: `customer_overdue` value is `[Decimal, int]` mixed-type list (Python). Java line 752 uses `BigDecimal[]` with `BigDecimal.valueOf(Math.max(...))` for both slots. **Algorithmically equivalent** — Python int operations + sort by Decimal value. Asyncpg INT4 column → Python int directly; if column type ever changes to NUMERIC, cast `int(aging_days)` defensively (already done in §3.6 for `_calculate_aging_buckets`).

### 3.5 `_get_receivable_trend_chart` 算法 (mirror Java line 786-827)

```python
async def _get_receivable_trend_chart(
    factory_id: str, start_date: date, end_date: date,
) -> dict:
    """Monthly LINE_BAR chart. Mirror Java getReceivableTrendChart (line 786-827).
    Uses [start_date, end_date] range, NOT 1-year window.
    """
    ar_data = await _query_finance_data(factory_id, "AR", start_date, end_date)

    # Java line 793 — TreeMap = sorted by key (yyyy-MM string sort = chronological)
    monthly_data: dict[str, list[Decimal]] = {}
    for row in ar_data:
        # Defensive null-check (Rule 1) — skip rows missing record_date (asyncpg returns
        # SELECT * row dict; record_date should always be present, but guard anyway).
        record_date = row.get("record_date")
        if record_date is None:
            continue
        month_key = record_date.strftime("%Y-%m")  # mirror Java line 795 yyyy-MM
        if month_key not in monthly_data:
            monthly_data[month_key] = [Decimal("0"), Decimal("0")]  # [receivable, collection]
        receivable = (
            _to_decimal(row["receivable_amount"])
            if row.get("receivable_amount") is not None
            else Decimal("0")
        )
        collection = (
            _to_decimal(row["collection_amount"])
            if row.get("collection_amount") is not None
            else Decimal("0")
        )
        monthly_data[month_key][0] += receivable
        monthly_data[month_key][1] += collection

    # Sort by month key (Java TreeMap natural ordering)
    chart_data: list[dict] = []
    for month_key in sorted(monthly_data.keys()):
        receivable, collection = monthly_data[month_key]
        chart_data.append({
            "period": month_key,
            "receivable": _decimal_to_number(receivable.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "collection": _decimal_to_number(collection.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "balance": _decimal_to_number((receivable - collection).quantize(Decimal("0.01"), ROUND_HALF_UP)),
        })

    # Java line 812-817 — options.series
    options = {
        "series": [
            {"name": "应收金额", "type": "bar"},
            {"name": "回款金额", "type": "bar"},
            {"name": "应收余额", "type": "line"},
        ],
    }

    # Use sister factory _new_chart_config_dict (analysis_finance.py:177) for parity.
    # Kwarg names lowercase per factory signature; verified against F999 golden.
    return _new_chart_config_dict(
        chart_type="LINE_BAR",  # Java line 820
        title="应收账款趋势",  # Java line 821
        series_field=None,  # Java trendChart options has series, not field; seriesField=null
        data=chart_data,
        options=options,
        xaxis_field="period",  # Java line 822 (lowercase per factory)
        yaxis_field="balance",  # Java line 823
    )
```

### 3.6 `_calculate_aging_buckets` utility (mirror Java line 1492-1524)

> **Constants location**: 下面 4 bucket 字面量 + `AGING_BUCKETS_ORDER` list **必须** 在文件顶部 declared (per §2.1 行 5). 这里只是引用展示, **impl 时不要在 §3.6 / §3.7 重新定义**.

```python
# === Module top section "# === Receivable constants ===" — declared once ===
AGING_BUCKET_0_30 = "0-30天"
AGING_BUCKET_31_60 = "31-60天"
AGING_BUCKET_61_90 = "61-90天"
AGING_BUCKET_OVER_90 = "90天以上"
AGING_BUCKETS_ORDER = [AGING_BUCKET_0_30, AGING_BUCKET_31_60, AGING_BUCKET_61_90, AGING_BUCKET_OVER_90]


def _calculate_aging_buckets(ar_data: list[dict]) -> dict[str, Decimal]:
    """4-bucket aggregation. Mirror Java calculateAgingBuckets (line 1492-1524).

    Skip rows where outstanding (receivable - collection) <= 0.
    Null agingDays → treat as 0 → AGING_BUCKET_0_30.
    """
    buckets = {b: Decimal("0") for b in AGING_BUCKETS_ORDER}  # init 4 buckets to 0

    for row in ar_data:
        # Java line 1500 — null fallback to 0
        aging_days = (
            int(row["aging_days"])
            if row.get("aging_days") is not None
            else 0
        )
        # Java line 1501-1503 — outstanding = receivable - collection (with null guards)
        receivable = (
            _to_decimal(row["receivable_amount"])
            if row.get("receivable_amount") is not None
            else Decimal("0")
        )
        collection = (
            _to_decimal(row["collection_amount"])
            if row.get("collection_amount") is not None
            else Decimal("0")
        )
        outstanding = receivable - collection
        # Java line 1505 — skip if non-positive
        if outstanding <= Decimal("0"):
            continue

        # Java line 1510-1518 — bucket assignment
        if aging_days <= 30:
            bucket = AGING_BUCKET_0_30
        elif aging_days <= 60:
            bucket = AGING_BUCKET_31_60
        elif aging_days <= 90:
            bucket = AGING_BUCKET_61_90
        else:
            bucket = AGING_BUCKET_OVER_90
        buckets[bucket] += outstanding

    return buckets
```

### 3.7 `_get_aging_bucket_alert_level` utility (mirror Java line 1590-1603)

> **Constants location**: `_AGING_BUCKET_ALERT_LEVELS` map **必须** 在文件顶部 (§2.1 行 5 锁定的 `# === Receivable constants ===` 块内). impl 时不要 in-section re-define.

```python
# === Already in module top constants block (§2.1 行 5) ===
_AGING_BUCKET_ALERT_LEVELS = {
    AGING_BUCKET_0_30: "GREEN",
    AGING_BUCKET_31_60: "YELLOW",
    AGING_BUCKET_61_90: "YELLOW",
    AGING_BUCKET_OVER_90: "RED",
}


def _get_aging_bucket_alert_level(bucket: str) -> str:
    """Hardcoded map. Mirror Java line 1590-1603."""
    return _AGING_BUCKET_ALERT_LEVELS.get(bucket, "GREEN")
```

### 3.8 Route 改造 — `get_finance_analysis` (analysis_finance.py:1510)

**关键约束** (跟 sister branches 一致):
- 用 `auth.factory_id` (从 JWT/header) 不要用 path-param `factory_id` — RLS 防 cross-tenant spoof
- 用 `wrap_response(result)` 包裹返回值 (跟 line 1529/1533/1537/1541 sister 一致), 不是 `ApiResponse.success`
- 现有 line 1543-1548 是 `wrap_response(success=False, code=501, ...)` — 保留给 budget, **不是** "_build_501_envelope" function

```python
@router.get("/api/mobile/{factory_id}/smart-bi/analysis/finance")
async def get_finance_analysis(
    factory_id: str,  # path param — only used for routing (not data access)
    startDate: date = Query(..., alias="startDate"),
    endDate: date = Query(..., alias="endDate"),
    analysisType: Optional[str] = Query(None, alias="analysisType"),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    range_ = DateRange.custom(startDate, endDate)

    if not analysisType:
        result = await _get_comprehensive_finance_analysis(auth.factory_id, range_)
        return wrap_response(result)
    if analysisType == "payable":
        result = await _get_payable_analysis(auth.factory_id, startDate, endDate)
        return wrap_response(result)
    if analysisType == "profit":
        result = await _get_profit_analysis(auth.factory_id, startDate, endDate)
        return wrap_response(result)
    if analysisType == "cost":
        result = await _get_cost_analysis(auth.factory_id, startDate, endDate)
        return wrap_response(result)
    # NEW: receivable branch (insert AFTER cost, BEFORE 501 fallback)
    if analysisType == "receivable":
        result = await _get_receivable_analysis(auth.factory_id, startDate, endDate)
        return wrap_response(result)
    # remaining 501 fallback for budget (existing line 1543-1548, unchanged)
    return wrap_response(
        data=None,
        success=False,
        code=501,
        message=f"analysisType={analysisType} 尚未 port 至 Python，请暂用 Java endpoint 或等待 phase2a/t-finance-perX 副轨完成",
    )
```

---

## 4. F999 byte-shape gate

### 4.1 F999 期望 (空 cretas_db)

**Compare mode**: dict-eq (跟 Phase 2A foundation 一致), key 顺序无关. 不要 strict-byte.

**响应 envelope key 顺序约定**:

> ⚠️ Java `HashMap` (controller line 241 `result = new HashMap<>()`) → Jackson 序列化 key 顺序 **不保证 deterministic**, 同 JVM run 内可能稳定但跨 run 可能变. Sister `_get_payable_analysis` (line 1485) F999 实测 Java 返回 key 顺序 `[endDate, metrics, agingChart, startDate]` (HashMap re-order, startDate 反而排最后).
>
> Python 端按 spec 顺序 emit (`startDate, endDate, metrics, agingChart, overdueRanking, trendChart`). dict-eq compare 下 key 顺序无关, F999 PASS. **如果未来切 strict-byte gate, 需要 record Java golden 锁定实际顺序** (在 §8 risks 列出).

**Numeric serialization 约定**:
- Python `_decimal_to_number(Decimal('0.00'))` 返 `int(0)` = `0`
- Java Jackson `BigDecimal('0.00')` 序列化为 JSON `0.00` (number)
- dict-eq treats `0 == 0.00 == 0.0` numerically → PASS
- 表格里 `"value": 0` 是 Python serialization, Java raw curl 可能显 `0.00`

**期望 data block** (Python output, 跟 Java HashMap 结果 dict-eq compare):

> ✅ **已 record**: `tests/fixtures/java-smartbi-golden/analysis-finance-F999-receivable.json` 已存在 (Apr 30 record). 下面 JSON 是从实际 golden 提取的 envelope shape, **必须 match exactly**:

```json
{
  "endDate": "2025-12-31",
  "overdueRanking": [],
  "metrics": [
    {"metricCode": "AR_BALANCE", "metricName": "应收余额", "value": 0, "formattedValue": "0.00", "unit": "元", "changePercent": null, "changeDirection": null, "changeValue": null, "alertLevel": "GREEN", "dimensionValue": null, "description": "尚未收回的应收账款总额"},
    {"metricCode": "COLLECTION_RATE", "metricName": "回款率", "value": 0, "formattedValue": "0.00%", "unit": "%", "changePercent": null, "changeDirection": null, "changeValue": null, "alertLevel": "RED", "dimensionValue": null, "description": "已回款金额占应收总额的比例"},
    {"metricCode": "AGING_30_RATIO", "metricName": "30天以上账龄占比", "value": 0, "formattedValue": "0.00%", "unit": "%", "changePercent": null, "changeDirection": null, "changeValue": null, "alertLevel": "GREEN", "dimensionValue": null, "description": "账龄超过30天的应收款占比"},
    {"metricCode": "AGING_60_RATIO", "metricName": "60天以上账龄占比", "value": 0, "formattedValue": "0.00%", "unit": "%", "changePercent": null, "changeDirection": null, "changeValue": null, "alertLevel": "GREEN", "dimensionValue": null, "description": "账龄超过60天的应收款占比"},
    {"metricCode": "AGING_90_RATIO", "metricName": "90天以上账龄占比", "value": 0, "formattedValue": "0.00%", "unit": "%", "changePercent": null, "changeDirection": null, "changeValue": null, "alertLevel": "GREEN", "dimensionValue": null, "description": "账龄超过90天的高风险应收款占比"}
  ],
  "agingChart": {
    "chartType": "BAR",
    "title": "应收账款账龄分布",
    "seriesField": null,
    "data": [
      {"agingBucket": "0-30天", "amount": 0, "percentage": 0, "alertLevel": "GREEN"},
      {"agingBucket": "31-60天", "amount": 0, "percentage": 0, "alertLevel": "YELLOW"},
      {"agingBucket": "61-90天", "amount": 0, "percentage": 0, "alertLevel": "YELLOW"},
      {"agingBucket": "90天以上", "amount": 0, "percentage": 0, "alertLevel": "RED"}
    ],
    "options": {
      "colors": ["#91cc75", "#fac858", "#ee6666", "#c23531"],
      "showAlert": true
    },
    "xaxisField": "agingBucket",
    "yaxisField": "amount"
  },
  "trendChart": {
    "chartType": "LINE_BAR",
    "title": "应收账款趋势",
    "seriesField": null,
    "data": [],
    "options": {
      "series": [
        {"name": "应收金额", "type": "bar"},
        {"name": "回款金额", "type": "bar"},
        {"name": "应收余额", "type": "line"}
      ]
    },
    "xaxisField": "period",
    "yaxisField": "balance"
  },
  "startDate": "2025-01-01"
}
```

**关键约束 (verify 自实际 golden)**:
- **Top envelope key 顺序**: `[endDate, overdueRanking, metrics, agingChart, trendChart, startDate]` — Jackson HashMap re-orders, **startDate 反而排最后** (跟 sister payable 一致). dict-eq compare 下 key 顺序无关.
- **Metric 项是 11 keys** (不是 7): `metricCode/metricName/value/formattedValue/unit/changePercent/changeDirection/changeValue/alertLevel/dimensionValue/description`. `_new_metric_result_dict` 自动 emit 全 11 fields, `changePercent/changeDirection/changeValue/dimensionValue` 为 null (Java line 627-732 的 builder 不 set 它们, Lombok @Data 让 Jackson serialize null).
- **agingChart/trendChart 项是 7 keys**: `chartType/title/seriesField/data/options/xaxisField/yaxisField`. **xaxisField/yaxisField 是 lowercase** (Lombok-Jackson demangle `getXAxisField` → `"xaxisField"`).
- COLLECTION_RATE alertLevel = "RED" (因为 0 < 60% threshold)
- agingChart 4 个 bucket 即使 amount=0 也按 hardcoded alertLevel map 返 GREEN/YELLOW/YELLOW/RED, 不是全 GREEN
- 30/60/90 ratio alertLevel = "GREEN" (因为 0 ≤ 25/15/10 threshold)

### 4.2 Composite path side effect (transparent upgrade)

`_get_comprehensive_finance_analysis` (line 1418) 当前调 stub `_get_receivable_aging_chart` 返:
```json
{"chartType": "BAR", "title": "应收账款账龄分布", "data": [{"agingBucket": "0-30天", ...placeholder}, ...]}
```

PR-A 后调 real impl, **shape 完全相同** (`agingBucket / amount / percentage / alertLevel` 4 key), 只是 amount/percentage 数值变 real. F999 composite byte-shape gate 保持 PASS.

加 1 contract test:
```python
def test_F999_composite_with_real_receivable_aging(self, client):
    """Composite path with real _get_receivable_aging_chart (post PR-A) maintains 6-key envelope."""
    # call /finance with analysisType=null (composite path)
    # assert response.data 仍是 6-key (overview + ...)
    # 内部 receivableAging key 数值是 real (来自 real impl), 但 shape 不变
```

---

## 5. 测试策略

### 5.1 Contract test 类 (PR-A)

**复用约定**:
- `_query_finance_data` (line 687) 已 wrap `_filter_to_latest_upload`. 4 sub-helpers 调用它取数据后**不再需要 re-filter**.
- Mock pattern 锁定: monkeypatch `_query_finance_data` 不要 mock `_filter_to_latest_upload` (绕过外层 helper 反而引入 schema risk).


`tests/python/smartbi_compat/test_analysis_finance_contract.py` 新增类 `TestAnalysisFinanceReceivable`:

```python
class TestAnalysisFinanceReceivable:
    """F999 byte-shape gate for receivable per-type path (analysisType=receivable)."""

    @pytest.fixture
    def f999_receivable_url(self):
        return "/api/mobile/F999/smart-bi/analysis/finance?startDate=2024-01-01&endDate=2024-12-31&analysisType=receivable"

    def test_F999_receivable_byte_shape(self, client, monkeypatch):
        """Full byte-shape compare on data block.
        Mocks _query_finance_data to return [] (F999 has no AR data).
        """
        async def fake_query(factory_id, record_type, start, end):
            return []
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_finance._query_finance_data",
            fake_query,
        )
        response = client.get(...)
        assert response.status_code == 200
        actual = response.json()["data"]
        # 跟 fixture 比 dict-eq
        expected = json.loads(open("tests/fixtures/java-smartbi-golden/analysis-finance-F999-receivable.json").read())
        assert _strip_volatile(actual) == _strip_volatile(expected)

    def test_F001_receivable_byte_shape(self, client):
        """F001 真窗 — manual record, NOT in CI."""
        # marked @pytest.mark.skip("manual smoke")
```

加 composite side effect test:

```python
def test_F999_composite_real_receivable_no_break(self, client, monkeypatch):
    """Post PR-A, composite path's receivableAging is real (not stub).
    6-key envelope shape unchanged + per-item 4-key shape locked.
    """
    async def fake_query(factory_id, record_type, start, end):
        return []  # mock all _query_finance_data calls (composite calls multiple sub-helpers)
    monkeypatch.setattr(
        "smartbi_compat.api.analysis_finance._query_finance_data",
        fake_query,
    )
    response = client.get("/api/mobile/F999/smart-bi/analysis/finance?startDate=2024-01-01&endDate=2024-12-31")
    assert response.status_code == 200
    data = response.json()["data"]
    # Composite envelope shape unchanged (mirror Java getComprehensiveAnalysis)
    # — 6 keys: startDate/endDate/overview/...
    assert set(data.keys()) >= {"startDate", "endDate"}
    # ⭐ receivableAging key shape locked (was stub returning placeholder, now real impl)
    items = data.get("receivableAging", {}).get("data", [])
    assert len(items) == 4
    for item in items:
        assert set(item.keys()) == {"agingBucket", "amount", "percentage", "alertLevel"}
    # bucket order locked
    assert [i["agingBucket"] for i in items] == ["0-30天", "31-60天", "61-90天", "90天以上"]
    # alertLevel hardcoded map (regardless of amount)
    assert [i["alertLevel"] for i in items] == ["GREEN", "YELLOW", "YELLOW", "RED"]
```

### 5.2 Unit test 类 (PR-B, plan 阶段拆)

`tests/python/smartbi_compat/test_receivable_arithmetic.py` (新文件, ~40 tests):

- `TestCalculateAgingBuckets`: 8 boundary case (agingDays = 0/30/31/60/61/90/91/-1) + 3 outstanding skip (=0/<0/null) + 1 null agingDays + 1 empty arData
- `TestReceivableMetricsArithmetic`: 5 metrics 各 2-3 case (zero/normal/maxout)
- `TestReceivableMetricsThresholds`: 4 阈值 × 6 边界 = 24 case
- `TestOverdueCustomerRankingSort`: top-10 cap, max-aging alertLevel, customer dedup
- `TestTrendChartMonthlyBucketing`: yyyy-MM format, 跨年 boundary, balance 公式

### 5.3 Mock pattern (复用 cost/profit/payable)

```python
async def fake_query(factory_id, record_type, start, end):
    return [...]  # 合成 row dict

monkeypatch.setattr(
    "smartbi_compat.api.analysis_finance._query_finance_data",
    fake_query,
)
```

### 5.4 F001 真窗 (不进 CI)

- 手动 against test 环境 (8084) record once
- 存 `tests/fixtures/java-smartbi-golden/analysis-finance-F001-receivable.json`
- 标 `@pytest.mark.skip("manual smoke against test env")`

---

## 6. Byte gate 语义

- F999 byte-shape gate = **dict-eq compare** (跟 Phase 2A foundation 一致, 不是 strict-byte)
- Volatile keys stripped (timingMs / generatedAt etc.)
- Decimal serialization 用 `_decimal_to_number` (`Decimal('0.00')` → `0`, `Decimal('0.50')` → `0.5`)
- 不要 strict byte compare (Jackson key 顺序在 HashMap 路径不保证)

---

## 7. PR 切片 + 顺序

### PR-A — receivable foundation

- impl 1 主 helper + 4 sub-helpers + 2 utilities + 5 module 常量 + route 1 分支
- replace stub `_get_receivable_aging_chart` @ line 1262
- F999 receivable byte-shape gate
- F001 receivable byte-shape gate (manual record)
- composite side effect test (F999 composite path 不 break)
- ~5-10 smoke tests

### PR-B — receivable arithmetic depth

- ~40 tests (per-bucket boundary / outstanding skip / null handling / 5 metrics depth / 4 阈值 × 6 边界 / ranking sort / trend bucketing)

### 顺序

PR-A spec ship 后 → 后续 chat 跑 plan + impl PR-A → ship PR-A → 后续 chat 跑 PR-B → ship PR-B.

**依赖**: 等 sister chat `phase2a/finance-sub-endpoints` PR merge 之后再启动 PR-A impl (避免 analysis_finance.py 同 file 并发 edit). spec PR 本身无 file 冲突.

---

## 8. Open risks + mitigations

| Risk | Mitigation |
|---|---|
| Java HashMap key 顺序不保证 (response envelope) | F999 golden 录多次比较选稳定; 测试 dict-eq compare 不 strict-byte |
| Java `Map.of(...)` 在 trendChart options.series 元素内 key 顺序 (`name`/`type`) | `Map.of(K1,V1,K2,V2)` 是 immutable map, Jackson 序列化 key 顺序在 Java 17+ 通常稳定 (insertion-order via internal entry array). Python emit `{"name":..., "type":...}` insertion-order. **dict-eq compare 下 key 顺序无关 → PASS**. 如需 strict-byte gate, 必须 record golden 锁定 (Phase 2A backlog) |
| 路由 handler `factory_id` path-param 跟 `auth.factory_id` 不一致 → cross-tenant spoof | **必须** 用 `auth.factory_id` 传入 sub-helper, path-param 仅用于 routing. Spec §3.8 已锁定. PR-A impl 严守, code review 必查 |
| **Rule 1 `or` falsy trap on `Decimal('0')`** | sister chats 反复踩 (3 次 audit history): `r.get('receivable_amount') or default` 在 `Decimal('0')` 行变 default, 而 Java `r.getReceivableAmount() != null` 返 0. **Spec §3.2/§3.4/§3.6 全部已用 `is not None` 三元** — impl 严守. 反例 grep `\bor\b.*get\(` 必筛 |
| customer_overdue dedup LinkedHashMap iteration 顺序 | Java 17+ `LinkedHashMap` insertion-order; Python 3.7+ dict 也 insertion-order — 1:1 一致, 不是 risk. 列出仅为 reviewer round 4 spot-check 时不再重新争论 |
| Java line refs (§3.1) 跟 main HEAD 漂移 | Spec 写时锁 line refs 是 main HEAD `aa6741c53` 的 `FinanceAnalysisServiceImpl.java`. PR-A plan 第一 task: pre-impl 重新 grep 8 个 Java line refs, 漂移则更新 spec 后 plan 再生成 (跟 cost C-3 fix 同 pattern) |
| `endDate.minusYears(1)` 闰年边界 | **必须用 `dateutil.relativedelta(years=1)`** (calendar-aware, 2024-02-29→2023-02-28); **禁止 `timedelta(days=365)`** (会产生 off-by-one boundary). Spec §3.2/3.3/3.4 已锁定此选择 |
| `_query_finance_data` SQL 1-year 窗 vs trend [start, end] 用同一 helper | 1-year 窗 是 Python 端调用计算的, helper SQL 不变. 跟 cost spec 复用 |
| F999 没真实数据 → ranking/trend data=[] | 期望 `overdueRanking: []`, `trendChart.data: []`, options 仍带完整 series (Java side-effect 不 short-circuit) |
| 现有 stub `_get_receivable_aging_chart` 被 composite path 调用 — 替换时确保 signature 一致 | composite 调用就是 `(factory_id, end_date)` — 跟 PR-A 主 helper 调用 sub 一致 |
| trendChart `record_date` 字段名跟 SQL 列名 (`record_date`) 一致 | `_query_finance_data` 返 row dict 用 SQL 列名 (snake_case), Python format/strftime 用 date 对象 |
| Customer name None → ranking 跳 (Java line 743) | Python `customer_name is None` check 跟 Rule 1 一致 |
| Aging days 类型 (int vs Long vs str from DB) | asyncpg INT4 → Python int; 必要时 `int(row['aging_days'])` cast |
| Jackson `BigDecimal` → JSON number (Java) vs FastAPI `Decimal` → JSON string (Python default) | 复用 cost spec 已落地 `_decimal_to_number` helper |

---

## 9. References

- Java reference: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/FinanceAnalysisServiceImpl.java` lines 583-827, 1492-1524, 1590-1603
- Sister specs (4 audit-pass + ship):
  - `docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-cost-design.md` (template)
  - `docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-profit-design.md`
  - PR #18 payable / PR #21+#22 profit / PR #25+#28 cost
- Phase 2A backlog: `docs/superpowers/plans/2026-05-01-phase2a-remaining-endpoints-backlog.md` (PR #31)
- Rules: `.claude/rules/python-java-port.md` (7 rules — 严守 1, 4, 7)
- API contract: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java` lines 244-274

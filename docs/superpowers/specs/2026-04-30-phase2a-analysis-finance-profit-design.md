# Phase 2A `/analysis/finance` profit per-type 真实现 — Design Spec

**Date**: 2026-04-30
**Branch**: `phase2a/t-finance-profit`
**Worktree**: `.worktrees/phase2a-finance-profit`
**Predecessors**:
- PR #13 — finance foundation + composite (`4dc4f2e3d`)
- PR #18 — payable per-type real impl (`b058a0bc3`)
**Sister chats unblocked by this spec**:
- `phase2a/t-finance-cost` — cost per-type real impl
- `phase2a/t-finance-receivable` — receivable per-type real impl (currently 4-call composite)
- `phase2a/t-finance-budget` — budget per-type real impl

---

## 1. 背景 + 范围锁定

### 1.1 当前状态（main）

`/api/mobile/{factory}/smart-bi/analysis/finance` 在 Python 实现：
- **Composite 路径**（无 `analysisType`）：4 个 sub-service stub 拼装。`_get_profit_metrics` 是硬编码 5-metric stub（全零值 + N/A）。
- **Payable per-type**（`analysisType=payable`）：real impl，2 个 metric + agingChart。
- **其他 per-type**（profit / cost / receivable / budget）：返回 501 占位。

### 1.2 这一 chat 范围

实施 **profit per-type 真实现**，含两个 PR 顺序合 main：

**PR-A — profit foundation**：
- profit per-type real impl（metrics + trendChart）
- 共享 `_get_profit_metrics` 升级到 real impl（composite 路径自动受益）
- 单一参数化 SQL `_query_finance_data`（替代 sister chats 各自写一份的反模式）
- `scripts/record-java-golden.sh` 通用录制脚本
- Golden 文件标准化（重录 + 重命名）
- F999 byte-shape gate + composite gate 仍通过

**PR-B — 算术深度 + sales fallback**：
- `SmartBiSalesData` 销售数据 fallback 路径（finance_data 空时）
- 9 个算术分支单元测试（grossMargin clamp / netMargin null / ROI 除零等）
- 7 个 trendChart 算术 + period 聚合测试

### 1.3 显式不在范围

- cost / receivable / budget per-type real impl（sister chats）
- T6 nginx cutover（独立 phase，prod 流量目前仍走 Java）
- byte gate 升级到 strict-byte（见 §6 现状说明，作为 backlog）
- F002 / F001 真窗 contract test（用 post-deploy smoke 替代，见 §5）
- AI insights / 食品知识库 / Tool-Skill 路由（永久留 Java）

---

## 2. 架构 + 文件 delta

### 2.1 文件级修改

```
PR-A:
  scripts/record-java-golden.sh                                            [NEW, 通用]
  tests/fixtures/java-smartbi-golden/
    ├─ analysis-finance-F999-composite.json                              [REWRITE 真 Java]
    ├─ analysis-finance-F999-profit.json                                 [RENAME from analysis-finance-type-profit-F999 + REWRITE 真 Java]
    ├─ analysis-finance-F001-profit.json                                 [RENAME from analysis-finance-type-profit-F001 + REWRITE 真 Java]
    └─ analysis-finance-F{999,001}-{cost,receivable}.json                [RENAME from analysis-finance-type-* (纯 git mv，sister 起点)]
  backend/python/smartbi_compat/api/analysis_finance.py                   [EDIT]
    + _query_finance_data(factory, record_type: str, start, end)
    + _get_profit_metrics()                          stub → real impl
    + _get_profit_trend_chart()                      NEW
    + _build_profit_chart_from_finance_data()        NEW (private helper)
    + _get_profit_analysis()                         NEW per-type assembler
    + _new_yaxis_entry() / _new_series_entry()       NEW Map.of-mirroring factories
    + _determine_gross_margin_alert() / _determine_roi_alert()  NEW
    + route handler analysisType=profit 分支          NEW
  tests/python/smartbi_compat/test_analysis_finance_contract.py           [EDIT]
    + class TestAnalysisFinanceProfit (2 tests)

PR-B:
  backend/python/smartbi_compat/api/analysis_finance.py                   [EDIT]
    + _query_finance_sales_fallback()                NEW
    + _aggregate_profit_by_period_sales()            NEW
    ~ _get_profit_metrics() 启用 sales fallback 分支
    ~ _get_profit_trend_chart() 启用 sales fallback 分支
  tests/python/smartbi_compat/test_analysis_finance_contract.py           [EDIT]
    + class TestProfitMetricsArithmetic (10 tests)
    + class TestProfitMetricsSalesFallback (3 tests)
    + class TestProfitTrendChartArithmetic (4 tests)
```

### 2.2 关键架构决策

1. **共享 `_get_profit_metrics`**：composite + per-type 调同一函数。空 tenant byte gate 在 dict-eq 语义下自动通过（`json.load` 把 `0` / `0.0` / `0.00` 统一为 numeric equiv）。
2. **单一参数化 SQL `_query_finance_data`**：sister chats 直接复用（cost / budget / 等），避免 N 个 record-type-specialized 函数泛滥。`_query_finance_payable_data`（payable PR 已 merge）保留不动作为兼容存量。
3. **F001 真窗不进 contract test**：CI 没 F001 真实 DB 数据。改为 `record-java-golden.sh --compare` 部署后手动 smoke。
4. **PR-B 算术深度全 mock @ 函数边界**：`monkeypatch.setattr` 替换 `_query_finance_data` 返回合成 row。零 DB 依赖、零 fixture seed SQL、与 payable 测试 pattern 一致。
5. **Golden 命名标准化**：`analysis-finance-{F999|F001}-{type}.json`，raw response（无 `_meta` envelope）。Sister chats 同样 convention。

---

## 3. Java 引用 + 算法对照

### 3.1 Java reference 位置

| 函数 | 位置 |
|---|---|
| Controller | `SmartBIAnalysisController.java:222-274`（line 244-246 是 profit 分支） |
| Composite | `SmartBIServiceImpl.java:600-605` (`case "finance":`) |
| `getProfitMetrics` | `FinanceAnalysisServiceImpl.java:352-495` |
| `getProfitTrendChart` | `FinanceAnalysisServiceImpl.java:220-274` |
| `buildProfitChartFromFinanceData` | `FinanceAnalysisServiceImpl.java:279-349` |
| `aggregateProfitByPeriod` (sales fallback) | `FinanceAnalysisServiceImpl.java:1423-1447` |
| `getPeriodKey` | `FinanceAnalysisServiceImpl.java:1472-1487` |
| `determineGrossMarginAlertLevel` | `FinanceAnalysisServiceImpl.java:1619-1624` |
| `determineRoiAlertLevel` | `FinanceAnalysisServiceImpl.java:1629-1634` |
| `formatCurrency` | `FinanceAnalysisServiceImpl.java:1608-1614` |
| Constants | `FinanceAnalysisServiceImpl.java:81-83`（SCALE=4 / DISPLAY_SCALE=2 / HALF_UP） |
| `RecordType` enum | `entity/smartbi/enums/RecordType.java`（COST / AR / AP / BUDGET / REVENUE） |

### 3.2 `_get_profit_metrics` 算法（1:1 mirror）

```python
async def _get_profit_metrics(factory_id: str, range_: DateRange) -> list[dict]:
    revenue_records = await _query_finance_data(factory_id, "REVENUE", range_.start_date, range_.end_date)
    cost_records    = await _query_finance_data(factory_id, "COST",    range_.start_date, range_.end_date)
    has_finance_data = bool(revenue_records or cost_records)

    if has_finance_data:
        # Java line 367-388
        total_revenue = sum(
            (_to_decimal(r["actual_amount"]) for r in revenue_records
             if r.get("category") and "收入" in r["category"] and r.get("actual_amount") is not None),
            Decimal("0"),
        )
        total_cost = sum(
            (abs(_to_decimal(r.get("total_cost") or r.get("actual_amount")))
             for r in cost_records
             if (r.get("total_cost") is not None) or (r.get("actual_amount") is not None)),
            Decimal("0"),
        )
        net_profit = sum(
            (_to_decimal(r["actual_amount"]) for r in revenue_records
             if r.get("category") and "净利" in r["category"] and r.get("actual_amount") is not None),
            Decimal("0"),
        )
        # Java reduce(BigDecimal.ZERO, +) 在空 stream 返 ZERO（不是 null）。
        # 主路径下 net_profit 永远不是 None — 即便没有"净利"分类的 record 也是 Decimal("0")。
        # 只有 fallback 路径（line 404）才显式 netProfit = null。
    else:
        # PR-A: 走 stub-equivalent zero 路径（fallback NOT yet implemented）
        # PR-B: 启用 sales fallback (_query_finance_sales_fallback)
        total_revenue = Decimal("0")
        total_cost    = Decimal("0")
        net_profit    = None  # ⚠️ Java fallback line 404 显式 null（非 ZERO）

    # Java line 409-416
    gross_profit = total_revenue - total_cost
    gross_margin_raw = (
        (gross_profit / total_revenue * Decimal("100")).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        if total_revenue > Decimal("0") else Decimal("0")
    )
    gross_margin = (
        None if (gross_margin_raw > Decimal("100") or gross_margin_raw < Decimal("-100"))
        else gross_margin_raw
    )

    # Java line 446-453
    if net_profit is not None and total_revenue > Decimal("0"):
        net_margin_raw = (net_profit / total_revenue * Decimal("100")).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP)
    else:
        net_margin_raw = None
    net_margin = (
        None if (net_margin_raw is not None
                 and (net_margin_raw > Decimal("100") or net_margin_raw < Decimal("-100")))
        else net_margin_raw
    )

    # Java line 481-483
    roi = (
        (gross_profit / total_cost * Decimal("100")).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        if total_cost > Decimal("0") else Decimal("0")
    )

    # Alert levels (Java line 1619-1634)
    gross_margin_alert = (
        _determine_gross_margin_alert(gross_margin) if gross_margin is not None else "RED"
    )
    net_profit_alert = (
        "GREEN" if net_profit is None else ("GREEN" if net_profit >= Decimal("0") else "RED")
    )
    roi_alert = _determine_roi_alert(roi)

    # 返回 5 个 MetricResult dict（用 _decimal_to_number for byte parity）
    return [
        _new_metric_result_dict(
            metric_code="GROSS_PROFIT",
            metric_name="毛利额",
            value=_decimal_to_number(gross_profit.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            formatted_value=_format_currency(gross_profit),
            unit="元",
            alert_level="GREEN",
            description="销售收入减去销售成本",
        ),
        _new_metric_result_dict(
            metric_code="GROSS_MARGIN",
            metric_name="毛利率",
            value=(_decimal_to_number(gross_margin.quantize(Decimal("0.01"), ROUND_HALF_UP))
                   if gross_margin is not None else None),
            formatted_value=(f"{gross_margin.quantize(Decimal('0.01'), ROUND_HALF_UP)}%"
                             if gross_margin is not None else "N/A"),
            unit="%",
            alert_level=gross_margin_alert,
            description="毛利额占销售收入的比例",
        ),
        _new_metric_result_dict(
            metric_code="NET_PROFIT",
            metric_name="净利润",
            value=(_decimal_to_number(net_profit.quantize(Decimal("0.01"), ROUND_HALF_UP))
                   if net_profit is not None else None),
            formatted_value=(_format_currency(net_profit) if net_profit is not None else "N/A"),
            unit="元",
            alert_level=net_profit_alert,
            description="毛利减去各项费用后的利润",
        ),
        _new_metric_result_dict(
            metric_code="NET_MARGIN",
            metric_name="净利率",
            value=(_decimal_to_number(net_margin.quantize(Decimal("0.01"), ROUND_HALF_UP))
                   if net_margin is not None else None),
            formatted_value=(f"{net_margin.quantize(Decimal('0.01'), ROUND_HALF_UP)}%"
                             if net_margin is not None else "N/A"),
            unit="%",
            alert_level="GREEN",
            description="净利润占销售收入的比例",
        ),
        _new_metric_result_dict(
            metric_code="ROI",
            metric_name="投入产出比",
            value=_decimal_to_number(roi.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            formatted_value=f"{roi.quantize(Decimal('0.01'), ROUND_HALF_UP)}%",
            unit="%",
            alert_level=roi_alert,
            description="毛利额与成本的比率",
        ),
    ]


def _determine_gross_margin_alert(gross_margin: Decimal) -> str:
    """Java line 1619-1624. v < 15 RED / v < 25 YELLOW / else GREEN"""
    v = float(gross_margin)
    if v < 15: return "RED"
    if v < 25: return "YELLOW"
    return "GREEN"


def _determine_roi_alert(roi: Decimal) -> str:
    """Java line 1629-1634. v < 0 RED / v < 20 YELLOW / else GREEN"""
    v = float(roi)
    if v < 0: return "RED"
    if v < 20: return "YELLOW"
    return "GREEN"
```

### 3.3 `_get_profit_trend_chart` 算法（1:1 mirror）

```python
async def _get_profit_trend_chart(
    factory_id: str, start_date: date, end_date: date, period: str = "MONTH"
) -> dict:
    revenue_data = await _query_finance_data(factory_id, "REVENUE", start_date, end_date)
    cost_data    = await _query_finance_data(factory_id, "COST",    start_date, end_date)

    if revenue_data or cost_data:
        chart_data = _build_profit_chart_from_finance_data(revenue_data, cost_data, period)
    else:
        # PR-A: empty
        # PR-B: sales fallback (4-key point: period, grossProfit, netProfit, grossMargin)
        chart_data = []

    # Java line 252-263 LinkedHashMap → Python insertion order
    options = {
        "yAxis": [
            _new_yaxis_entry(name="金额", position="left"),
            _new_yaxis_entry(name="毛利率(%)", position="right"),
        ],
        "series": [
            _new_series_entry(type_="bar",  yaxis_index=0, name="营业收入"),
            _new_series_entry(type_="bar",  yaxis_index=0, name="营业成本"),
            _new_series_entry(type_="bar",  yaxis_index=0, name="毛利额"),
            _new_series_entry(type_="line", yaxis_index=0, name="净利润"),
            _new_series_entry(type_="line", yaxis_index=1, name="毛利率"),
        ],
    }

    return _new_chart_config_dict(
        chart_type="LINE_BAR",
        title="利润趋势分析",
        series_field="metric",
        data=chart_data,
        options=options,
        xaxis_field="period",
        yaxis_field="grossProfit",
    )


def _new_yaxis_entry(name: str, position: str) -> dict:
    """Mirror Java Map.of("name", X, "position", Y).
    Observed Jackson order = ["name", "position"] (matches put-order for n=2)."""
    return {"name": name, "position": position}


def _new_series_entry(type_: str, yaxis_index: int, name: str) -> dict:
    """Mirror Java Map.of("name", X, "type", Y, "yAxisIndex", Z).
    Observed Jackson order = ["type", "yAxisIndex", "name"] (NOT put-order — Map.of(3) hash)."""
    return {"type": type_, "yAxisIndex": yaxis_index, "name": name}


def _build_profit_chart_from_finance_data(
    revenue_rows: list[dict], cost_rows: list[dict], period: str
) -> list[dict]:
    """Java line 279-349 1:1 mirror.

    Period aggregation via TreeMap → Python sorted(set).
    Each chart point: 6 keys via dict insertion order:
      [period, revenue, cost, grossProfit, netProfit, grossMargin]
    """
    revenue_by_period: dict[str, Decimal] = {}
    net_profit_by_period: dict[str, Decimal] = {}
    cost_by_period: dict[str, Decimal] = {}

    for r in revenue_rows:
        if r.get("actual_amount") is None:
            continue
        key = _get_period_key(r["record_date"], period)
        cat = r.get("category") or ""
        if "收入" in cat:
            revenue_by_period[key] = revenue_by_period.get(key, Decimal("0")) + _to_decimal(r["actual_amount"])
        if "净利" in cat:
            net_profit_by_period[key] = net_profit_by_period.get(key, Decimal("0")) + _to_decimal(r["actual_amount"])

    for c in cost_rows:
        if c.get("total_cost") is None and c.get("actual_amount") is None:
            continue
        key = _get_period_key(c["record_date"], period)
        raw = c.get("total_cost") if c.get("total_cost") is not None else c.get("actual_amount")
        cost_by_period[key] = cost_by_period.get(key, Decimal("0")) + abs(_to_decimal(raw))

    all_periods = sorted(set(revenue_by_period.keys()) | set(cost_by_period.keys()))
    chart_data = []
    for pk in all_periods:
        revenue = revenue_by_period.get(pk, Decimal("0"))
        cost = cost_by_period.get(pk, Decimal("0"))
        gross_profit = revenue - cost
        gross_margin_raw = (
            (gross_profit / revenue * Decimal("100")).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            if revenue > Decimal("0") else Decimal("0")
        )
        gross_margin = (
            None if (gross_margin_raw > Decimal("100") or gross_margin_raw < Decimal("-100"))
            else gross_margin_raw
        )
        net_profit = net_profit_by_period.get(pk, gross_profit)

        # 6-key point, Java LinkedHashMap → Python dict insertion order
        chart_data.append({
            "period": pk,
            "revenue": _decimal_to_number(revenue.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "cost": _decimal_to_number(cost.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "grossProfit": _decimal_to_number(gross_profit.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "netProfit": _decimal_to_number(net_profit.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "grossMargin": (_decimal_to_number(gross_margin.quantize(Decimal("0.01"), ROUND_HALF_UP))
                            if gross_margin is not None else None),
        })
    return chart_data


def _get_period_key(d: date, period: str) -> str:
    """Java line 1472-1487. Period key formats:
      DAY     -> yyyy-MM-dd
      WEEK    -> yyyy-Www
      MONTH   -> yyyy-MM
      QUARTER -> yyyy-Qn
      default -> yyyy-MM
    """
    if period == "DAY":
        return d.strftime("%Y-%m-%d")
    if period == "WEEK":
        # ISO week-of-year, 2-digit zero-pad
        iso_year, iso_week, _ = d.isocalendar()
        return f"{iso_year}-W{iso_week:02d}"
    if period == "MONTH":
        return d.strftime("%Y-%m")
    if period == "QUARTER":
        return f"{d.year}-Q{(d.month - 1) // 3 + 1}"
    return d.strftime("%Y-%m")
```

### 3.4 SQL 查询参数化

```python
async def _query_finance_data(
    factory_id: str, record_type: str, start_date: date, end_date: date
) -> list[dict]:
    """单一参数化查询 smart_bi_finance_data，sister chats 复用。

    Java reference: financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
        factoryId, RecordType.{REVENUE|COST|AR|AP|BUDGET}, start, end)

    返回 dict 含 actual_amount / total_cost / material_cost / labor_cost /
    overhead_cost / category / record_date / upload_id 等。SELECT * 全字段，
    上层调用者按需取。

    末尾走 _filter_to_latest_upload (Java line 89-101)。
    """
    pool = None
    try:
        from smartbi.config import get_pg_pool
        pool = await get_pg_pool()
    except Exception as e:
        logger.warning("[finance_data] pool acquisition failed factory=%s rt=%s: %s",
                       factory_id, record_type, e)
        return []
    if pool is None:
        return []

    sql = """
        SELECT id, factory_id, upload_id, record_date, record_type,
               department, category, customer_name, supplier_name,
               material_cost, labor_cost, overhead_cost, total_cost,
               receivable_amount, collection_amount, aging_days,
               payable_amount, payment_amount,
               budget_amount, actual_amount, variance_amount,
               due_date, created_at, updated_at
        FROM smart_bi_finance_data
        WHERE factory_id = $1
          AND record_type = $2
          AND record_date BETWEEN $3 AND $4
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, factory_id, record_type, start_date, end_date)
    raw_rows = [dict(r) for r in rows]
    return _filter_to_latest_upload(raw_rows)
```

`_query_finance_payable_data` 保留不动（兼容存量）。

### 3.5 PR-B sales fallback

```python
async def _query_finance_sales_fallback(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Java line 392-393: salesDataRepository.findByFactoryIdAndOrderDateBetween(factory, start, end)

    返回 [{amount, cost, order_date, ...}] for fallback path。
    """
    pool = await get_pg_pool()
    if pool is None: return []
    sql = """
        SELECT id, factory_id, order_date, customer_name, product_name,
               salesperson, region, quantity, amount, cost, ...
        FROM smart_bi_sales_data
        WHERE factory_id = $1 AND order_date BETWEEN $2 AND $3
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, factory_id, start_date, end_date)
    return [dict(r) for r in rows]


# _get_profit_metrics 启用 fallback：
if not has_finance_data:
    sales_rows = await _query_finance_sales_fallback(factory_id, start_date, end_date)
    total_revenue = sum((_to_decimal(r["amount"]) for r in sales_rows
                         if r.get("amount") is not None), Decimal("0"))
    total_cost    = sum((abs(_to_decimal(r["cost"])) for r in sales_rows
                         if r.get("cost") is not None), Decimal("0"))
    net_profit    = None  # Java line 404 显式 null（trendChart 才用 grossProfit*0.70）


def _aggregate_profit_by_period_sales(
    sales_rows: list[dict], period: str
) -> list[dict]:
    """Java line 1423-1447. 4 BigDecimal/period: [grossProfit, netProfit (=gross*0.70), grossMargin, revenue].

    Returns 4-key chart points (period / grossProfit / netProfit / grossMargin),
    NOT 6-key like main path.
    """
    by_period: dict[str, dict[str, Decimal]] = {}
    for r in sales_rows:
        key = _get_period_key(r["order_date"], period)
        slot = by_period.setdefault(key, {"profit": Decimal("0"), "revenue": Decimal("0")})
        revenue = _to_decimal(r.get("amount") or 0)
        cost    = _to_decimal(r.get("cost")   or 0)
        slot["profit"]  += revenue - cost
        slot["revenue"] += revenue

    out = []
    for key in sorted(by_period.keys()):
        slot = by_period[key]
        gross = slot["profit"]
        net   = (gross * Decimal("0.70")).quantize(Decimal("0.01"), ROUND_HALF_UP)
        gm    = ((gross / slot["revenue"] * Decimal("100")).quantize(Decimal("0.0001"), ROUND_HALF_UP)
                 if slot["revenue"] > Decimal("0") else Decimal("0"))
        out.append({
            "period": key,
            "grossProfit": _decimal_to_number(gross.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "netProfit":   _decimal_to_number(net),
            "grossMargin": _decimal_to_number(gm.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        })
    return out
```

### 3.6 Per-type assembler + 路由

```python
async def _get_profit_analysis(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Java reference: SmartBIAnalysisController.getFinanceAnalysis line 240-246.

    Java HashMap put order: startDate / endDate / metrics / trendChart
    Recorded F999 Jackson order (HashMap hash, NOT put-order):
      [endDate, metrics, trendChart, startDate]
    """
    range_ = DateRange.custom(start_date, end_date)
    metrics    = await _get_profit_metrics(factory_id, range_)
    trend_chart = await _get_profit_trend_chart(factory_id, start_date, end_date, "MONTH")
    return {
        "endDate":    end_date.isoformat(),
        "metrics":    metrics,
        "trendChart": trend_chart,
        "startDate":  start_date.isoformat(),
    }


# 路由 handler 增加分支：
if analysisType == "profit":
    result = await _get_profit_analysis(auth.factory_id, startDate, endDate)
    return wrap_response(result)
```

---

## 4. F999 byte-shape gate

### 4.1 Profit per-type 期望响应（已录 golden）

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "endDate": "2025-12-31",
    "metrics": [
      {"metricCode": "GROSS_PROFIT", "metricName": "毛利额",
       "value": 0.00, "formattedValue": "0.00", "unit": "元",
       "changePercent": null, "changeDirection": null, "changeValue": null,
       "alertLevel": "GREEN", "dimensionValue": null,
       "description": "销售收入减去销售成本"},
      {"metricCode": "GROSS_MARGIN", "metricName": "毛利率",
       "value": 0.00, "formattedValue": "0.00%", "unit": "%",
       "changePercent": null, "...": "...", "alertLevel": "RED",
       "description": "毛利额占销售收入的比例"},
      {"metricCode": "NET_PROFIT", "metricName": "净利润",
       "value": null, "formattedValue": "N/A", "unit": "元",
       "alertLevel": "GREEN", "description": "毛利减去各项费用后的利润"},
      {"metricCode": "NET_MARGIN", "metricName": "净利率",
       "value": null, "formattedValue": "N/A", "unit": "%",
       "alertLevel": "GREEN", "description": "净利润占销售收入的比例"},
      {"metricCode": "ROI", "metricName": "投入产出比",
       "value": 0.00, "formattedValue": "0.00%", "unit": "%",
       "alertLevel": "YELLOW", "description": "毛利额与成本的比率"}
    ],
    "trendChart": {
      "chartType": "LINE_BAR",
      "title": "利润趋势分析",
      "seriesField": "metric",
      "data": [],
      "options": {
        "yAxis": [
          {"name": "金额", "position": "left"},
          {"name": "毛利率(%)", "position": "right"}
        ],
        "series": [
          {"type": "bar",  "yAxisIndex": 0, "name": "营业收入"},
          {"type": "bar",  "yAxisIndex": 0, "name": "营业成本"},
          {"type": "bar",  "yAxisIndex": 0, "name": "毛利额"},
          {"type": "line", "yAxisIndex": 0, "name": "净利润"},
          {"type": "line", "yAxisIndex": 1, "name": "毛利率"}
        ]
      },
      "xaxisField": "period",
      "yaxisField": "grossProfit"
    },
    "startDate": "2025-01-01"
  },
  "success": true,
  "timestamp": "<volatile>"
}
```

### 4.2 Composite 期望响应（real impl swap 后仍通过）

`profitMetrics` 数组与 §4.1 `metrics` 结构一致。Top-level `data` 顺序：

```
[overview, costStructure, dateRange, generatedAt, profitMetrics, receivableAging]
```

需要重录：现有 golden raw 显示 `value: 0.0`（单位精度），但 live Java 端 emit `0.00` raw（双位精度）— 两者 dict-eq 下都通过，但 ground truth 对齐有价值（strict-byte 升级时再回头免重录）。

---

## 5. 测试策略

### 5.1 Contract test 类（PR-A）

**`TestAnalysisFinanceProfit`** — F999 byte-shape gate

```python
class TestAnalysisFinanceProfit:
    def test_f999_profit_data_keys_match_golden(self, client, monkeypatch):
        # mock _query_finance_data → []
        # assert list(resp.json()['data'].keys()) == [endDate, metrics, trendChart, startDate]

    def test_f999_profit_byte_shape(self, client, monkeypatch):
        # mock _query_finance_data → []
        # full dict-eq compare against analysis-finance-F999-profit.json
```

**Composite gate 既有不动**，PR-A 完成后自动验证 real impl swap 不破坏 composite。

### 5.2 Unit test 类（PR-B）

**`TestProfitMetricsArithmetic`** — 算术分支（10 tests）

| Test | Branch covered |
|---|---|
| `test_revenue_gt_cost_positive_gross_profit` | 正常 grossProfit > 0 |
| `test_revenue_lt_cost_negative_gross_profit` | grossProfit < 0 |
| `test_gross_margin_above_100_clamps_to_null` | grossMargin > 100% → null |
| `test_gross_margin_below_neg100_clamps_to_null` | grossMargin < -100% → null |
| `test_net_profit_present_computes_net_margin` | netMargin 计算分支 |
| `test_net_profit_absent_net_margin_null` | netMargin null 分支 |
| `test_total_cost_zero_roi_zero` | ROI 除零防御 |
| `test_total_cost_positive_roi_computes` | ROI 正常计算 |
| `test_alert_level_gross_margin_thresholds` | <15 RED / <25 YELLOW / else GREEN |
| `test_alert_level_roi_thresholds` | <0 RED / <20 YELLOW / else GREEN |

**`TestProfitMetricsSalesFallback`** — fallback 路径（3 tests）

| Test | Branch |
|---|---|
| `test_no_finance_with_sales_uses_fallback` | finance 空 + sales 非空 |
| `test_fallback_net_profit_stays_null_in_metrics` | metrics fallback netProfit None |
| `test_fallback_net_profit_computed_in_trendchart` | trendChart fallback gross*0.70 |

**`TestProfitTrendChartArithmetic`** — chart + period（4 tests）

| Test | Branch |
|---|---|
| `test_empty_data_returns_empty_chartdata` | 空 → `data=[]` 但 options 完整 |
| `test_multi_month_aggregates_by_period_key` | period 聚合正确性 |
| `test_negative_revenue_minus_cost_emits_negative_gross` | 负 grossProfit |
| `test_period_key_format_yyyy_mm` | MONTH/WEEK/QUARTER format |

### 5.3 Mock pattern（payable test 既有 pattern 复用）

```python
async def fake_query(factory_id, record_type, start, end):
    if record_type == "REVENUE":
        return [{"actual_amount": Decimal("100000"), "category": "营业收入",
                 "record_date": date(2025, 6, 1), "upload_id": 1}]
    if record_type == "COST":
        return [{"total_cost": Decimal("60000"), "actual_amount": None,
                 "record_date": date(2025, 6, 1), "upload_id": 1}]
    return []

monkeypatch.setattr(
    "smartbi_compat.api.analysis_finance._query_finance_data",
    fake_query,
)
```

### 5.4 F001 真窗（不进 CI）

`scripts/record-java-golden.sh --compare`：
1. SSH tunnel 到 47.100.235.168 + 录 Java 10011 真值
2. 同时 hit Python 8084 部署后端点
3. dict-eq diff，输出差异 file（如全等：exit 0）

PR-A 部署后手动跑一次 F001 verify。Sister chats 部署后同款 smoke。

---

## 6. Byte gate 语义说明

**当前实现**（既有）：

```python
py_data    = _strip_volatile(resp.json()["data"])
golden_data = _strip_volatile(json.load(...)["data"])
assert py_data == golden_data
```

`json.load` 把 `0` / `0.0` / `0.00` 全部解成 Python `int(0)` 或 `float(0.0)`，且 Python `0 == 0.0` 为 True。所以这是 **数值等价 gate**：
- ✅ 抓 shape drift（缺/多 key）
- ✅ 抓非数值类型 drift（字符串、列表、bool）
- ✅ 抓 key order drift（top-level data，via 单独 keys-list test）
- ❌ **不抓** 数值字面量精度差异（`0` vs `0.00` 视为相等）
- ❌ **不抓** 内层 dict key order drift（dict eq 内容比较，order 无关）

**对前端的潜在影响**：TS `=== 0` 严格相等会区分 `0` vs `0.0`。Phase 2A 后期硬化应升级 strict-byte gate（compare canonical JSON strings）。**这一 chat 不做**，作为 backlog。

Sister chats 不应假设 strict-byte 已实现。

---

## 7. PR 切片 + 顺序

### PR-A — profit foundation

**Title**: `Phase 2A: /analysis/finance profit per-type real impl + record-helper + golden standardization`

**Scope**:
- §2.1 PR-A 文件清单
- §3.2 `_get_profit_metrics` real impl（无 fallback 分支启用）
- §3.3 `_get_profit_trend_chart` 含 `_build_profit_chart_from_finance_data`（无 fallback）
- §3.4 `_query_finance_data` 单一参数化 SQL
- §3.6 `_get_profit_analysis` + 路由 handler
- §5.1 `TestAnalysisFinanceProfit` (2 tests) + composite gate 既有跑通
- `scripts/record-java-golden.sh`
- Golden 重录 + 重命名

**LOC 预估**: ~400 (impl 270 + tests 80 + golden 50 + script 30)

**CI gate**: 全 pytest 225+2 = 227 通过（基于 main HEAD `b058a0bc3` 225）

### PR-B — 算术深度 + sales fallback

**Title**: `Phase 2A: /analysis/finance profit sales fallback + arithmetic depth tests`

**Scope**:
- §3.5 `_query_finance_sales_fallback` + `_aggregate_profit_by_period_sales`
- `_get_profit_metrics` + `_get_profit_trend_chart` 启用 fallback 分支
- §5.2 三个 unit test 类（17 tests）

**LOC 预估**: ~280 (impl 80 + tests 200)

**CI gate**: 全 pytest 227+17 = 244 通过

### 顺序

```
1. spec doc commit + push (本 step)
2. user 审 spec → 给 OK
3. writing-plans skill 出 PR-A plan
4. subagent-driven-development 执行 PR-A → push → PR → squash merge
5. pull main → writing-plans skill 出 PR-B plan
6. subagent-driven-development 执行 PR-B → push → PR → squash merge
7. cleanup worktree
```

PR-A 与 PR-B 同 chat、同 worktree、同 branch family（sequential rebase），不并行。

---

## 8. Open risks + mitigations

| 风险 | Mitigation |
|---|---|
| Real impl swap 后 composite gate 失败（Decimal 精度差异） | dict-eq 容忍 `0/0.0/0.00`；先跑 baseline 确认；失败则 debug 而非回滚 |
| `Map.of(3)` Jackson 顺序在 Java 版本升级时变化 | Golden 已录死；Java 升级 → 失败 → 重录（明确流程） |
| `_query_finance_data` SELECT * 字段变化（新加列） | 上层 only 取已知 key；新列出现不破坏（dict.get 容忍） |
| Sister chats 复制 sales fallback pattern 时漏 `.abs()` | 文档 + sister chat handoff prompt 明示 |
| record-java-golden.sh `--compare` 模式后置（非 CI） | 部署后手动跑；脚本入仓但不进 pipeline |
| F002 / qhj_prod 餐饮租户 finance Excel 没填 → Python 永远 0 | PR-B sales fallback 即为修；T6 cutover 前必须 PR-B 完成 |

---

## 9. References

- Sister spec (foundation): `docs/superpowers/specs/2026-04-29-phase2a-analysis-finance-foundation-design.md`
- Sister spec (payable PR #18): merged `b058a0bc3`
- Java reference root: `backend/java/cretas-api/src/main/java/com/cretas/aims/`
- Existing F999 profit golden (will rename): `tests/fixtures/java-smartbi-golden/analysis-finance-type-profit-F999.json`
- Existing F999 composite golden (will re-record): `tests/fixtures/java-smartbi-golden/analysis-finance-F999-composite.json`
- Live Java backend: `47.100.235.168:10011` (test env, JWT secret in `/www/wwwroot/cretas/.env.test`)

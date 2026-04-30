# Phase 2A `/analysis/finance` cost per-type 真实现 — Design Spec

**Date**: 2026-04-30
**Branch**: `phase2a/t-finance-cost`
**Worktree**: `.worktrees/phase2a-finance-cost`

**Predecessors**:
- PR #13 — finance foundation + composite (`4dc4f2e3d`)
- PR #18 — payable per-type real impl (`b058a0bc3`)
- PR-A profit per-type（pending merge，提供 `_query_finance_data` + `record-java-golden.sh` + `_decimal_to_number`）

**Sister chats unblocked by this spec**:
- `phase2a/t-finance-receivable` — receivable per-type real impl
- `phase2a/t-finance-budget` — budget per-type real impl

**Inherited audit constraints**:
- 全部参见 [`.claude/rules/python-java-port.md`](../../../.claude/rules/python-java-port.md)
- Rule 1（Null fallback `is not None`）/ Rule 2（Calendar year）/ Rule 3（签名 mirror）/ Rule 4（Decimal 序列化）/ Rule 5（SELECT *）/ Rule 6（None-check）/ Rule 7（Decimal 阈值比较）

---

## 1. 背景 + 范围锁定

### 1.1 当前状态（main）

`/api/mobile/{factory}/smart-bi/analysis/finance` 的 cost per-type 路径（`analysisType=cost`）当前返回 501 占位。Composite 路径已用 `_get_cost_structure_chart` stub。`getCostTrendChart` Java 端已有，Python 端缺失。

### 1.2 这一 chat 范围

实施 **cost per-type 真实现**，含两个 PR 顺序合 main（与 profit chat 同模板）：

**PR-A — cost foundation**：
- cost per-type real impl（structureChart + trendChart）
- 共享 `_get_cost_structure_chart` 升级到 real impl（composite 路径自动受益）
- 复用 profit chat 的 `_query_finance_data`（依赖 profit PR-A merge）
- 复用 `record-java-golden.sh` + golden 命名 convention
- F999 byte-shape gate 新增 + composite gate 仍通过

**PR-B — cost arithmetic depth**：
- 9 个算术分支单元测试（structureChart 5 + trendChart 4）
- `_create_pie_data_item` 边界（total=0 / 负值 .abs() defensive / percentage 舍入）
- `_aggregate_cost_by_period` 多周期聚合 + period key format

### 1.3 显式不在范围

- receivable / budget per-type real impl（sister chats）
- T6 nginx cutover（独立 phase）
- byte gate 升级到 strict-byte（Phase 2A backlog）
- F002 / F001 真窗 contract test（用 `record-java-golden.sh --compare` post-deploy smoke 替代）
- AI insights / Tool-Skill 路由（永久留 Java）

---

## 2. 架构 + 文件 delta

### 2.1 文件级修改

```
PR-A:
  tests/fixtures/java-smartbi-golden/
    └─ analysis-finance-F999-cost.json                                   [RENAME from analysis-finance-type-cost-F999 (verify-only)]
  backend/python/smartbi_compat/api/analysis_finance.py                   [EDIT]
    + _get_cost_structure_chart()                    stub → real impl (composite + per-type 共享)
    + _get_cost_trend_chart()                        NEW
    + _aggregate_cost_by_period()                    NEW (TreeMap → sorted Python dict)
    + _create_pie_data_item()                        NEW (LinkedHashMap [category, value, percentage])
    + _new_cost_series_entry()                       NEW (Map.of(2) {name, stack} factory)
    + _get_cost_analysis()                           NEW per-type assembler
    + route handler analysisType=cost 分支            NEW
    ~ COST_CATEGORY_MATERIAL/LABOR/OVERHEAD 常量      NEW (从 Java 取值: "原材料"/"人工"/"制造费用")
  tests/python/smartbi_compat/test_analysis_finance_contract.py           [EDIT]
    + class TestAnalysisFinanceCost (2 tests F999 byte gate)
    ~ test_f999_unimplemented_analysisType_returns_501: drop "cost" from iter list
       (PR-A makes cost return 200; remaining 501s = receivable/budget)

PR-B:
  tests/python/smartbi_compat/test_analysis_finance_contract.py           [EDIT]
    + class TestCostStructureArithmetic (5 tests)
    + class TestCostTrendArithmetic (4 tests)
```

### 2.2 关键架构决策

1. **共享 `_get_cost_structure_chart`**：composite + per-type 调同一函数（与 profit `_get_profit_metrics` 同模式）
2. **复用 profit chat 的 `_query_finance_data`** —— 依赖 profit PR-A merge；cost worktree 当前基于 origin/main HEAD `2d8a8a272`，待 profit merge 后 rebase
3. **复用 `record-java-golden.sh`** —— profit PR-A 已落地通用 CLI；cost 直接调用，零修改
4. **F999 cost golden 已录** —— 仅 rename + verify（不重录除非 mismatch）
5. **算术深度全 mock @ 函数边界** —— `monkeypatch.setattr` `_query_finance_data` 返合成 row（与 profit / payable 同模式）
6. **No sales fallback** —— Java cost 只查 finance_data，不像 profit 有 sales fallback；F999 empty → 直接 empty data

### 2.3 与 profit 的差异点

| 维度 | Profit | Cost |
|---|---|---|
| Sub-services 数 | 2 (metrics + trendChart) | 2 (structureChart + trendChart) |
| Per-type response keys | `[endDate, metrics, trendChart, startDate]` | `[endDate, trendChart, startDate, structureChart]` |
| Sales fallback | 有（PR-B 加） | **无** |
| 算术分支测试数 | 17 (PR-B) | 9 (PR-B) |
| Map.of factory 类型 | yAxis(2) + series(3) 两个 | series(2) 一个（cost 没 yAxis 嵌套） |
| LOC 估 | ~700 (PR-A 400 + PR-B 280) | ~370 (PR-A 250 + PR-B 120) |

---

## 3. Java 引用 + 算法对照

### 3.1 Java reference 位置

| 函数 | 位置 |
|---|---|
| Controller cost 分支 | `SmartBIAnalysisController.java:247-249` |
| `getCostStructureChart` | `FinanceAnalysisServiceImpl.java:499-540` |
| `getCostTrendChart` | `FinanceAnalysisServiceImpl.java:542-581` |
| `aggregateCostByPeriod` | `FinanceAnalysisServiceImpl.java:1452-1467` |
| `createPieDataItem` | `FinanceAnalysisServiceImpl.java:1566-1573` |
| `getPeriodKey` | `FinanceAnalysisServiceImpl.java:1472-1487` |
| Constants | `FinanceAnalysisServiceImpl.java:81-83` (SCALE=4, DISPLAY_SCALE=2, HALF_UP) |
| `COST_CATEGORY_*` 常量 | 同文件，搜 `COST_CATEGORY_MATERIAL` |
| Composite path（cost 共享 sub-service） | `SmartBIServiceImpl.java:603` (`result.put("costStructure", ...)`) |

### 3.2 `_get_cost_structure_chart` 算法（1:1 mirror）

参见 `.claude/rules/python-java-port.md` Rule 1（`is not None`）+ Rule 4（Decimal）。

```python
async def _get_cost_structure_chart(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Java FinanceAnalysisServiceImpl.getCostStructureChart line 499-540 1:1 mirror.

    Composite + per-type 共享。F999 empty → totalCost=0 → empty data list。
    """
    cost_records = await _query_finance_data(factory_id, "COST", start_date, end_date)

    # Java line 507-516: aggregate three cost categories with .abs() defensive
    material_cost = sum(
        (abs(_to_decimal(r["material_cost"])) for r in cost_records
         if r.get("material_cost") is not None),
        Decimal("0"),
    )
    labor_cost = sum(
        (abs(_to_decimal(r["labor_cost"])) for r in cost_records
         if r.get("labor_cost") is not None),
        Decimal("0"),
    )
    overhead_cost = sum(
        (abs(_to_decimal(r["overhead_cost"])) for r in cost_records
         if r.get("overhead_cost") is not None),
        Decimal("0"),
    )

    total_cost = material_cost + labor_cost + overhead_cost

    # Java line 521-526: data items only if total > 0; empty list otherwise
    chart_data: list[dict] = []
    if total_cost > Decimal("0"):
        chart_data.append(_create_pie_data_item(COST_CATEGORY_MATERIAL, material_cost, total_cost))
        chart_data.append(_create_pie_data_item(COST_CATEGORY_LABOR,    labor_cost,    total_cost))
        chart_data.append(_create_pie_data_item(COST_CATEGORY_OVERHEAD, overhead_cost, total_cost))

    # Java line 528-530 LinkedHashMap → Python insertion order
    options = {
        "showPercentage": True,
        "colors": ["#5470c6", "#91cc75", "#fac858"],
    }

    return _new_chart_config_dict(
        chart_type="PIE",
        title="成本结构分析",
        series_field=None,
        data=chart_data,
        options=options,
        xaxis_field="category",
        yaxis_field="value",
    )


# 常量（Java 端搜 COST_CATEGORY_MATERIAL 取值）
COST_CATEGORY_MATERIAL = "原材料"
COST_CATEGORY_LABOR    = "人工"
COST_CATEGORY_OVERHEAD = "制造费用"


def _create_pie_data_item(category: str, value: Decimal, total: Decimal) -> dict:
    """Java FinanceAnalysisServiceImpl.createPieDataItem line 1566-1573 1:1 mirror.

    LinkedHashMap key 顺序: [category, value, percentage]
    percentage = (value/total * 100).setScale(2, HALF_UP) if total > 0 else BigDecimal.ZERO
    """
    if total > Decimal("0"):
        # Java line 1571: divide(total, SCALE=4, HALF_UP).multiply(100).setScale(2, HALF_UP)
        percentage = (
            (value / total).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            * Decimal("100")
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    else:
        percentage = Decimal("0")

    # 应用 Rule 4: Decimal → number for FastAPI JSON parity
    return {
        "category": category,
        "value": _decimal_to_number(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        "percentage": _decimal_to_number(percentage),
    }
```

### 3.3 `_get_cost_trend_chart` 算法（1:1 mirror）

```python
async def _get_cost_trend_chart(
    factory_id: str, start_date: date, end_date: date, period: str = "MONTH"
) -> dict:
    """Java FinanceAnalysisServiceImpl.getCostTrendChart line 542-581 1:1 mirror.

    Per-type 唯一调用方（composite 路径不调）。空数据 → empty chart_data，
    options 完整保留。
    """
    cost_records = await _query_finance_data(factory_id, "COST", start_date, end_date)

    aggregated = _aggregate_cost_by_period(cost_records, period)

    # Java line 553-562 LinkedHashMap chart point: [period, materialCost, laborCost, overheadCost, totalCost]
    chart_data = []
    for period_key in sorted(aggregated.keys()):  # TreeMap → sorted Python
        values = aggregated[period_key]  # [material, labor, overhead, total]
        chart_data.append({
            "period":       period_key,
            "materialCost": _decimal_to_number(values[0].quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "laborCost":    _decimal_to_number(values[1].quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "overheadCost": _decimal_to_number(values[2].quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "totalCost":    _decimal_to_number(values[3].quantize(Decimal("0.01"), ROUND_HALF_UP)),
        })

    # Java line 564-570: LinkedHashMap[stack, series] outer; series items Map.of(2) {name, stack}
    options = {
        "stack": True,
        "series": [
            _new_cost_series_entry(name=COST_CATEGORY_MATERIAL, stack="cost"),
            _new_cost_series_entry(name=COST_CATEGORY_LABOR,    stack="cost"),
            _new_cost_series_entry(name=COST_CATEGORY_OVERHEAD, stack="cost"),
        ],
    }

    return _new_chart_config_dict(
        chart_type="BAR",
        title="成本趋势分析",
        series_field="costType",
        data=chart_data,
        options=options,
        xaxis_field="period",
        yaxis_field="totalCost",
    )


def _new_cost_series_entry(name: str, stack: str) -> dict:
    """Mirror Java Map.of("name", X, "stack", Y) — Map.of(2) put-order ≈ hash-order on n=2.

    Observed F999 golden order = [name, stack] ← matches put-order for 2-entry Map.of.
    """
    return {"name": name, "stack": stack}


def _aggregate_cost_by_period(
    cost_records: list[dict], period: str
) -> dict[str, list[Decimal]]:
    """Java FinanceAnalysisServiceImpl.aggregateCostByPeriod line 1452-1467 1:1 mirror.

    TreeMap → Python dict (后续 sorted() 排序)。每 period 4 个 BigDecimal:
    [material, labor, overhead, total]，全部 .abs() defensive.
    """
    result: dict[str, list[Decimal]] = {}
    for c in cost_records:
        key = _get_period_key(c["record_date"], period)
        slot = result.setdefault(key, [Decimal("0")] * 4)
        # Rule 1: is not None 三元，禁 or
        if c.get("material_cost") is not None:
            slot[0] += abs(_to_decimal(c["material_cost"]))
        if c.get("labor_cost") is not None:
            slot[1] += abs(_to_decimal(c["labor_cost"]))
        if c.get("overhead_cost") is not None:
            slot[2] += abs(_to_decimal(c["overhead_cost"]))
        if c.get("total_cost") is not None:
            slot[3] += abs(_to_decimal(c["total_cost"]))
    return result
```

### 3.4 `_get_period_key` helper

复用 profit PR-A 中的同名函数（已落地在 `analysis_finance.py`）。Cost chat 不重新定义。

参见 [Rule 2](../../../.claude/rules/python-java-port.md#rule-2)（calendar year vs ISO year）。

### 3.5 `_get_cost_analysis` per-type assembler

```python
async def _get_cost_analysis(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Java SmartBIAnalysisController.getFinanceAnalysis cost branch line 247-249.

    Java HashMap put order: startDate / endDate / structureChart / trendChart
    Recorded F999 Jackson order (HashMap hash, NOT put-order):
      [endDate, trendChart, startDate, structureChart]
    """
    structure_chart = await _get_cost_structure_chart(factory_id, start_date, end_date)
    trend_chart     = await _get_cost_trend_chart(factory_id, start_date, end_date, "MONTH")

    return {
        "endDate":        end_date.isoformat(),
        "trendChart":     trend_chart,
        "startDate":      start_date.isoformat(),
        "structureChart": structure_chart,
    }
```

### 3.6 路由 handler 增加分支

```python
# backend/python/smartbi_compat/api/analysis_finance.py route handler 增加：
if analysisType == "cost":
    result = await _get_cost_analysis(auth.factory_id, startDate, endDate)
    return wrap_response(result)

# 其余分支保持（profit / payable 已有，receivable / budget 仍 501）
```

---

## 4. F999 byte-shape gate

### 4.1 Cost per-type 期望响应（已录 golden）

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "endDate": "2025-12-31",
    "trendChart": {
      "chartType": "BAR",
      "title": "成本趋势分析",
      "seriesField": "costType",
      "data": [],
      "options": {
        "stack": true,
        "series": [
          {"name": "原材料",   "stack": "cost"},
          {"name": "人工",     "stack": "cost"},
          {"name": "制造费用", "stack": "cost"}
        ]
      },
      "xaxisField": "period",
      "yaxisField": "totalCost"
    },
    "startDate": "2025-01-01",
    "structureChart": {
      "chartType": "PIE",
      "title": "成本结构分析",
      "seriesField": null,
      "data": [],
      "options": {
        "showPercentage": true,
        "colors": ["#5470c6", "#91cc75", "#fac858"]
      },
      "xaxisField": "category",
      "yaxisField": "value"
    }
  },
  "success": true,
  "timestamp": "<volatile>"
}
```

### 4.2 Composite path（cost structure 共享）

`_get_cost_structure_chart` real impl swap 后，composite 路径的 `costStructure` 字段同步升级。F999 empty case 输出与现有 stub 一致（empty data + 完整 options）。Composite golden 沿用 profit chat 的 verify-only 决策（不重录除非 mismatch）。

---

## 5. 测试策略

### 5.1 Contract test 类（PR-A）

```python
# tests/python/smartbi_compat/test_analysis_finance_contract.py 追加

class TestAnalysisFinanceCost:
    """F999 byte-shape gate for cost per-type path."""

    def test_f999_cost_data_keys_match_golden(self, client, monkeypatch):
        # mock _query_finance_data → []
        # assert list(resp.json()['data'].keys()) == [endDate, trendChart, startDate, structureChart]

    def test_f999_cost_byte_shape(self, client, monkeypatch):
        # mock _query_finance_data → []
        # full dict-eq compare against analysis-finance-F999-cost.json
```

**既有 `test_f999_unimplemented_analysisType_returns_501`** 更新：
loop 从 `["profit", "cost", "receivable", "budget"]` 缩到 `["receivable", "budget"]`
（profit chat 在 PR-A 已 drop "profit"；cost chat drop "cost"）。

### 5.2 Unit test 类（PR-B）

**`TestCostStructureArithmetic`** — 结构图算术（5 tests）

| Test | Branch covered |
|---|---|
| `test_total_zero_emits_empty_data` | totalCost=0 → `data=[]` 但 options 完整 |
| `test_three_categories_emit_three_pie_items` | totalCost>0 → 3 items（material/labor/overhead） |
| `test_percentage_rounding_half_up` | percentage 四舍五入 setScale(2) HALF_UP |
| `test_negative_cost_abs_defensive` | Java P0-1 Bug B：负值 .abs() 取正 |
| `test_create_pie_data_item_total_zero_percentage_zero` | createPieDataItem 边界：total=0 → percentage=0 |

**`TestCostTrendArithmetic`** — 趋势图 + period（4 tests）

| Test | Branch |
|---|---|
| `test_empty_data_returns_empty_chartdata` | 空 → `data=[]`，options 仍完整 |
| `test_multi_month_aggregates_by_period_key` | 多月聚合，sorted period 顺序 |
| `test_stacked_series_three_categories_per_period` | 每 period 5 key（period + 4 cost values） |
| `test_period_key_format_yyyy_mm` | MONTH/WEEK/QUARTER 格式 |

### 5.3 Mock pattern

```python
async def fake_query(factory_id, record_type, start, end):
    if record_type == "COST":
        return [
            {"material_cost": Decimal("60000"), "labor_cost": Decimal("30000"),
             "overhead_cost": Decimal("10000"), "total_cost": Decimal("100000"),
             "record_date": date(2025, 6, 1), "upload_id": 1},
        ]
    return []

monkeypatch.setattr(
    "smartbi_compat.api.analysis_finance._query_finance_data",
    fake_query,
)
```

### 5.4 F001 真窗（不进 CI）

`scripts/record-java-golden.sh --compare`（profit PR-A 已落地）。Cost 部署后手动跑：

```bash
./scripts/record-java-golden.sh --compare \
  --factory F001 --path /api/mobile/F001/smart-bi/analysis/finance \
  --query "startDate=2025-01-01&endDate=2025-12-31&analysisType=cost"
```

---

## 6. Byte gate 语义

参见 profit spec §6 + `.claude/rules/python-java-port.md` Rule 4。当前是 dict-eq gate（json.load 后 dict 比较），strict-byte 是 Phase 2A backlog。Sister chats 不应假设 strict-byte 已实现。

---

## 7. PR 切片 + 顺序

### PR-A — cost foundation

**Title**: `Phase 2A: /analysis/finance cost per-type real impl + composite shared upgrade`

**Scope**:
- §2.1 PR-A 文件清单
- §3.2 `_get_cost_structure_chart` real impl + `_create_pie_data_item` + `COST_CATEGORY_*` 常量
- §3.3 `_get_cost_trend_chart` + `_aggregate_cost_by_period` + `_new_cost_series_entry`
- §3.5 `_get_cost_analysis` + 路由分支
- §5.1 `TestAnalysisFinanceCost` (2 tests) + 既有 501 test 更新

**LOC 预估**: ~250 (impl 150 + tests 50 + golden rename + route 50)

**CI gate**: pytest baseline+2 (227+) 通过

**依赖**: profit PR-A merge（提供 `_query_finance_data` + `record-java-golden.sh` + `_decimal_to_number` + `_get_period_key`）

### PR-B — cost arithmetic depth

**Title**: `Phase 2A: /analysis/finance cost structure + trend arithmetic depth tests`

**Scope**:
- §5.2 `TestCostStructureArithmetic` (5 tests)
- §5.2 `TestCostTrendArithmetic` (4 tests)

**LOC 预估**: ~120 (tests only)

**CI gate**: PR-A baseline + 9 = 236 通过

### 顺序

```
1. spec doc commit + reviewer audit + push（本 step）
2. user 审 spec → OK
3. wait for profit PR-A merge to main
4. rebase phase2a/t-finance-cost onto post-profit-merge main
5. writing-plans 出 PR-A plan
6. subagent-driven-development 执行 PR-A → push → PR → squash merge
7. pull main → writing-plans 出 PR-B plan
8. subagent-driven-development 执行 PR-B → push → PR → squash merge
9. cleanup worktree
```

---

## 8. Open risks + mitigations

| 风险 | Mitigation |
|---|---|
| profit PR-A 中 `_query_finance_data` 签名变 | 这一 chat 仅写 spec/plan，impl 等 profit merge 后 rebase；signature 改了 plan 调整 1 处即可 |
| profit PR-A 不 merge / 难产 | spec/plan 仍有价值（独立 artifact）；不阻塞这一 chat 的 design 工作 |
| cost golden Jackson 顺序 Java JVM 升级时变化 | Golden 已录死（Apr 29 from live Java 10011）；Java 升级 → byte gate 失败 → record-java-golden.sh re-record |
| Composite gate 失败（shared sub-service 升级副作用） | dict-eq 容忍 `0/0.0/0.00`；F999 empty case shape 不变 |
| Sister chats 复制 `.abs()` defensive 漏 negative | 文档 `.claude/rules/python-java-port.md` Rule 1 + Rule 5 明示；reviewer agent 抓 |
| `_create_pie_data_item` percentage 舍入误差 | scale=4 中间精度 + scale=2 final（与 Java 1:1）；arithmetic test 验证 |

---

## 9. References

- Sister spec (foundation): `docs/superpowers/specs/2026-04-29-phase2a-analysis-finance-foundation-design.md`
- Sister spec (payable PR #18): merged `b058a0bc3`
- Sister spec (profit, pending merge): `docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-profit-design.md` (origin/phase2a/t-finance-profit `e624d4203`)
- Java reference root: `backend/java/cretas-api/src/main/java/com/cretas/aims/`
- Existing F999 cost golden (will rename): `tests/fixtures/java-smartbi-golden/analysis-finance-type-cost-F999.json`
- Live Java backend: `47.100.235.168:10011` (test env)
- **Audit constraints inherited from**: `.claude/rules/python-java-port.md`

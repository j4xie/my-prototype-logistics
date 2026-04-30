# Java→Python Port 规范

**最后更新**: 2026-04-30
**适用范围**: Phase 2A SmartBI analysis endpoint port + 未来 Phase 2B+ 任何 Java→Python 字节级 parity port。

---

## 背景

Phase 2A 把 50 个 Java SmartBI analysis endpoint port 到 Python，要求 byte-shape parity（dict-eq 容忍 numeric `0` vs `0.0` 等价；前端层潜在 strict-byte 仍是隐患）。

历史 audit 反复抓到的同类 bug —— 这些 bug 不是 endpoint-specific，而是 Java 语义 vs Python 习惯差异。提升到项目级 rule，避免每个 sister chat 重新 audit。

参见 audit 历史：
- profit chat audit 9 项（2026-04-30，spec commit `e624d4203`）
- payable chat 3 项 reusable findings（merged PR #18）

---

## ⛔ Rule 1: Null fallback 必须用 `is not None` 三元，禁 Python `or`

### 反 pattern（Python falsy ≠ Java null）

```python
# ❌ BAD: Python `Decimal("0") or X` 返 X（Decimal("0") 是 falsy）
total_cost = sum(
    abs(_to_decimal(r.get("total_cost") or r.get("actual_amount")))
    for r in cost_records
)
# 当 total_cost = Decimal("0") 且 actual_amount = Decimal("5000") 时，
# Python 取 5000；Java `r.getTotalCost() != null` 取 Decimal("0")。
# 累计差异在生产数据上爆炸。

# ❌ BAD: 同类型 net_profit
net_profit = sum(...) or None  # 空集合返 None ✓ 但 sum=Decimal("0") 也返 None ✗
```

### 正 pattern

```python
# ✅ GOOD: 显式 is not None 三元
total_cost = sum(
    abs(_to_decimal(
        r["total_cost"] if r.get("total_cost") is not None else r.get("actual_amount")
    ))
    for r in cost_records
    if r.get("total_cost") is not None or r.get("actual_amount") is not None
)

# ✅ GOOD: net_profit 主路径用 reduce 语义（空集合返 Decimal("0")，对齐 Java reduce(BigDecimal.ZERO, +)）
net_profit = sum(
    (_to_decimal(r["actual_amount"]) for r in revenue_records
     if r.get("category") and "净利" in r["category"]),
    Decimal("0"),  # initial value，空 generator 返这个
)
# fallback path 才显式 net_profit = None（Java line 404 行为）
```

### 何时这个 rule 适用

- 任何 Java port 涉及 `Decimal`、`int(0)`、`""`、`[]`、`False` 等 Python falsy 但 Java 非 null 的值
- 源头：审 Java 的 `!= null` 检查，**逐字翻译为 Python `is not None`**
- 不要简化为 `or`
- **不仅仅是 fallback 场景** —— 任何 Java `if (x != null)` 都翻成 Python `if x is not None:`

### 另一种常见错误模式（cost-style，I-2 fix）

即便没有 `or` fallback，也容易踩 `if r.get("col"):` 而不是 `if r.get("col") is not None:`：

```python
# ❌ BAD: Decimal("0") row 会被 dict.get truthy-check 跳过
for r in cost_records:
    if r.get("material_cost"):  # Decimal("0") 是 falsy → 整行 skip
        total += abs(_to_decimal(r["material_cost"]))

# ✅ GOOD: 显式 None-check，Decimal("0") 行参与累加
for r in cost_records:
    if r.get("material_cost") is not None:
        total += abs(_to_decimal(r["material_cost"]))
```

Java `r.getMaterialCost() != null` 在 `BigDecimal.ZERO` 时仍然 True；Python `if r.get("material_cost"):` 把 `Decimal("0")` 误判为 None。

### Why（背景 + 修复历史）

profit chat self-review 抓到 `or None`；reviewer audit 又抓到 `or` falsy on `total_cost`；cost chat reviewer audit 提示这同一根源还有 `if x:` truthy-check 形式。**三次同根源不同表象**。

---

## ⛔ Rule 2: WEEK period key 用 calendar year，不是 ISO year

### 反 pattern

```python
# ❌ BAD: ISO year 跟 Java date.getYear() 不一致
def get_period_key(d, period):
    if period == "WEEK":
        iso_year, iso_week, _ = d.isocalendar()
        return f"{iso_year}-W{iso_week:02d}"  # 跨年 boundary 跟 Java 偏差
```

### 正 pattern

```python
# ✅ GOOD: calendar year 1:1 mirror Java line 1478 (date.getYear())
def get_period_key(d, period):
    if period == "WEEK":
        _iso_year, iso_week, _iso_day = d.isocalendar()
        return f"{d.year}-W{iso_week:02d}"  # calendar year + ISO week
```

### 何时这个 rule 适用

任何 Java port 涉及 `LocalDate.getYear()` 或 `WeekFields.ISO.weekOfYear()` 边界处理。

### Why

跨年 boundary 例（2024-12-30 周一）：
- Java `date.getYear()` = 2024，ISO week = `01` → `"2024-W01"`
- Python `isocalendar()[0]` = 2025（ISO year），ISO week = 01 → `"2025-W01"`

测试数据通常不踩边界，bug 直到生产某个跨年报表才暴雷。

---

## ⛔ Rule 3: Python 函数签名 1:1 mirror Java，不要包 wrapper

### 反 pattern

```python
# ❌ BAD: 包了 DateRange wrapper，跟 Java getProfitMetrics(factoryId, startDate, endDate) 不一致
async def _get_profit_metrics(factory_id: str, range_: DateRange) -> list[dict]:
    ...
```

### 正 pattern

```python
# ✅ GOOD: 直接 mirror Java
async def _get_profit_metrics(factory_id: str, start_date: date, end_date: date) -> list[dict]:
    ...
```

### 何时这个 rule 适用

任何 Java service method port 到 Python 异步函数。

### Why

- Java 端 `LocalDate startDate, LocalDate endDate` 是 byte-shape parity 的契约一部分
- 包 wrapper 增加 caller 心智负担（每次调用要 `range_ = DateRange.custom(start, end)`）
- Sister chats 看到不一致签名会困惑（payable 是 `(factory_id, end_date)`，profit 是 `(factory_id, range_)` —— 哪个对？）
- 一致的签名让 audit / mock / test 全部对齐

`DateRange` 仍然有用 —— 但作为 envelope-level 工具（如 dashboard composite 的 `dateRange` 字段），不是 service method 参数。

---

## ⛔ Rule 4: BigDecimal 序列化用 `_decimal_to_number`

### 反 pattern

```python
# ❌ BAD: 直接返 Decimal，FastAPI JSONResponse 把 Decimal 序列化为字符串 "0.00"
return {
    "value": gross_profit.quantize(Decimal("0.01"), ROUND_HALF_UP),
}
# 输出: {"value": "0.00"}  ← Java 输出 0.00（数值），dict-eq fail
```

### 正 pattern

```python
# ✅ GOOD: 用 _decimal_to_number helper（profit chat 已落地在 analysis_finance.py）
return {
    "value": _decimal_to_number(gross_profit.quantize(Decimal("0.01"), ROUND_HALF_UP)),
}
# 输出: {"value": 0}  ← Python int，dict-eq 跟 Java 0.0 / 0.00 等价
```

### Helper 实现（参考）

```python
def _decimal_to_number(v: Decimal) -> Any:
    """Convert Decimal to int (if integral) or float, JSON-safe.

    FastAPI 默认把 Decimal 序列化为 string，跟 Java Jackson 数值序列化不 parity。
    """
    if v == v.to_integral_value():
        return int(v)
    return float(v)
```

### 何时这个 rule 适用

任何 Java port 输出 `BigDecimal` 字段（金额、率、百分比、天数等）。

### Why

- FastAPI default `Decimal → str`（精度安全但破坏 byte parity）
- Java Jackson default `BigDecimal → number`（保留 scale 但精度依赖 Java 端 setScale）
- `_decimal_to_number` 在 dict-eq gate 下 OK；strict-byte gate 下还需 canonical compare（Phase 2A backlog）

---

## ⛔ Rule 5: 共享 SQL helpers 用 `SELECT *`，不裸列字段

### 反 pattern

```python
# ❌ BAD: 显式 24 列
sql = """
    SELECT id, factory_id, upload_id, record_date, record_type,
           department, category, customer_name, supplier_name,
           material_cost, labor_cost, overhead_cost, total_cost,
           ...
    FROM smart_bi_finance_data WHERE ...
"""
```

### 正 pattern

```python
# ✅ GOOD: SELECT *，consumer 用 dict.get 容忍未来加列
sql = """
    SELECT *
    FROM smart_bi_finance_data
    WHERE factory_id = $1 AND record_type = $2 AND record_date BETWEEN $3 AND $4
"""
```

### 何时这个 rule 适用

**新建跨 sister chats 共享的 SQL helper**（如 `_query_finance_data` 给 cost / receivable / budget 复用）。

### Legacy 例外（I-1 fix）

`_query_finance_payable_data`（PR #18 已 merge，single-record-type specialized）保留 explicit columns，**不动**。理由：
- 已 merge 的代码改 SELECT * 是无谓 churn（功能相同）
- 它本来就只服务 payable，不需要扩展性
- 名字含"payable"明示其特化用途，跟通用 `_query_finance_data` 区分清楚

新 helper 用 SELECT *；老 helper 保留各自 explicit。

### Why

- Sister chats 各自需要不同列（cost 需要 material/labor/overhead；receivable 需要 receivable_amount/aging_days；payable 需要 payable_amount/payment_amount）
- 显式列表逼迫每加一个 sister 修改 SQL → 共享 helper 反 pattern
- Schema 演进（加列）不破坏共享 helper
- consumer side `dict.get("col_name")` 容忍未来加列

---

## ⛔ Rule 6: 输入边界 None-check 拒绝静默零结果

### 反 pattern

```python
# ❌ BAD: asyncpg 把 None 转 NULL，BETWEEN NULL AND NULL 返 0 行，调用方拿到空 list 一脸懵
async def _query_finance_data(factory_id, record_type, start_date, end_date):
    sql = "SELECT * FROM smart_bi_finance_data WHERE record_date BETWEEN $1 AND $2"
    return await conn.fetch(sql, start_date, end_date)  # 静默零结果
```

### 正 pattern

```python
# ✅ GOOD: 显式 precondition assertion
async def _query_finance_data(factory_id, record_type, start_date, end_date):
    if start_date is None or end_date is None:
        raise ValueError(
            f"_query_finance_data: start_date/end_date required (got {start_date}, {end_date})"
        )
    ...
```

### 何时这个 rule 适用 (I-3 fix — narrowed scope)

**新建** SQL helper / query function 必须显式 None-check。**已有** helper（如 `_query_finance_payable_data`）由 caller 保证非 None 即可，不需要回填 retroactive precondition assertion。

判断标准：
- 是 sister chat 共享的新 helper → 加 precondition
- 是某 endpoint 路径专用的 helper，且 caller 已经从 controller path-param parsing 拿到 validated 输入 → 不强制

### Why

- Java `findByFactoryIdAndRecordTypeAndRecordDateBetween(...)` 传 null 抛 NPE，Controller catch-all 返 500
- Python asyncpg 静默把 None 转 NULL，SQL `BETWEEN NULL AND NULL` 永远 false，返 0 行
- 静默零结果是最难 debug 的 bug —— 给调用方一个误以为"没数据"的假象

---

## ⛔ Rule 7: 浮点阈值比较用 `Decimal`，整数阈值才用 `float()`

### 反 pattern

```python
# ❌ BAD: 阈值 75.5，浮点边界 corner case
def determine_alert(value: Decimal) -> str:
    v = float(value)
    if v < 75.5:  # 0.1 + 0.2 = 0.30000000000000004 类问题
        return "RED"
```

### 正 pattern

```python
# ✅ GOOD: Decimal 比较
def determine_alert(value: Decimal) -> str:
    if value < Decimal("75.5"):
        return "RED"
```

### 何时这个 rule 适用

任何 alert level / threshold / 边界判断，**只要阈值不是整数**。

### Why

- profit 的阈值是整数 15 / 25 / 0 / 20 → `float(Decimal)` 跟 Java `BigDecimal.doubleValue()` 一致
- 餐饮 / 库存 / 质量等子域可能用 75.5 / 0.95 等非整数阈值 → 浮点边界 corner case 在 Python `float()` 跟 Java `doubleValue()` 之间会偶尔 divergence

### Profit chat 现状

profit `_determine_gross_margin_alert` 用 `float()`（OK，整数阈值）。Sister chats 改非整数阈值时**必须**改 Decimal 比较。

---

## 工具 + 配置 reference

### `_decimal_to_number` helper

定义位置：`backend/python/smartbi_compat/api/analysis_finance.py`（profit PR-A 落地，sister chats 直接 import）

### `record-java-golden.sh` 录制脚本

定义位置：`scripts/record-java-golden.sh`（profit PR-A 落地）

CLI: 参见 `docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-profit-design.md` §5.5

### Golden 命名 convention

`tests/fixtures/java-smartbi-golden/analysis-finance-{F999|F001}-{type}.json`

无 `_meta` envelope，raw response only。

### Test mock pattern

```python
async def fake_query(factory_id, record_type, start, end):
    # 合成 row 对应 specific 算术分支
    return [...]

monkeypatch.setattr(
    "smartbi_compat.api.analysis_finance._query_finance_data",
    fake_query,
)
```

---

## 何时新增 rule

每个 audit 抓到的**普适**问题（≥2 个 sister chat 都会踩）应该 graduate 到这个文件。Endpoint-specific 的留 spec doc。

判断标准：
- 是 Python vs Java 语言习惯差异 → rule
- 是数据库/序列化/字段命名习惯 → rule
- 是某 endpoint 的 shape 决定 → spec
- 是 Phase 2A 一次性 migration 决定 → spec（如 byte gate 是 dict-eq 而非 strict-byte）

---

## Audit 历史

| 来源 | Rule 抓到 |
|---|---|
| profit chat self-review (2026-04-30) | Rule 1（`or None` net_profit） |
| profit chat reviewer audit (2026-04-30) | Rule 1（`or` falsy total_cost）/ Rule 2 / Rule 3 / Rule 5 / Rule 6 / Rule 7 |
| payable PR #18 retrospect | Rule 4（Decimal serialization 一致性） |
| cost chat reviewer audit (2026-04-30) | Rule 1（`if x:` truthy-check 形式）/ Rule 5（legacy 例外）/ Rule 6（narrowed scope） |

后续 sister chats（receivable / budget / 9 个分析子域）应跑过 reviewer audit；新发现 graduate 到这里。

---
title: Phase 2A — /analysis/finance foundation + payable per-type 样板 (副轨)
date: 2026-04-29
status: draft
endpoint: GET /api/mobile/{factoryId}/smart-bi/analysis/finance
worktree: .worktrees/phase2a-finance (branch phase2a/t-finance, derived from origin/main)
---

# Phase 2A — /analysis/finance foundation + payable per-type 样板

## 0. 背景 (Why this exists)

Phase 2A 在做 SmartBI ~50 个 endpoint 的 Java→Python byte-shape port，nginx 切流量后 Python 成主流，Java 保留 fallback。已 ship 5/50（alerts / recommendations / query-templates list / datasource list / sales foundation+gold）。

主轨 `phase2a/t5-poc` 在做 `/analysis/sales`，`overview`/`rankings`/`trend` 子 spec 在各自副轨 chat 进行中。

**这个副轨 (`phase2a/t-finance`)** 做 `/analysis/finance` 主路由的一部分：
- 把 Java `SmartBIAnalysisController.getFinanceAnalysis` (line 222-274) byte-shape 镜像到 Python
- 范围切到 **foundation + composite (空 analysisType) + payable per-type 样板**
- 不动主轨 sales 的任何文件
- 跟 sister chat 在 `main.py` 的 `include_router` 行可能 git auto-merge

剩下的工作（profit/cost/receivable/budget per-type + 3 个独立 sub-endpoint）留给后续副轨 chat。

## 1. Scope

### In-scope (这个 chat)

| 项 | 内容 |
|---|---|
| 路由 | `GET /api/mobile/{factory_id}/smart-bi/analysis/finance` |
| 处理的 query 参数组合 | 1) `analysisType` 为空（→ composite 路径）<br>2) `analysisType=payable`（→ real impl 样板） |
| Composite 路径 | 调用 4 个 sub-service stub，组装 6-key composite (overview / profitMetrics / costStructure / receivableAging / dateRange / generatedAt) |
| Payable 路径 real impl | 2 个 sub-service real impl + SQL helper：`getPayableMetrics(factoryId, endDate)` + `getPayableAgingChart(factoryId, endDate)` |
| 测试 | F999 byte-shape contract test × 2（composite + payable）+ DTO factory unit test |
| Worktree | `.worktrees/phase2a-finance`，分支 `phase2a/t-finance`，派生 `origin/main` |

### Out-of-scope (后续副轨)

| 项 | 留给 |
|---|---|
| `analysisType=profit/cost/receivable/budget` 4 个 per-type real impl | 后续副轨（按 payable 样板抄改） |
| 3 个独立 sub-endpoint：`/analysis/finance/budget-achievement` / `yoy-mom` / `category-comparison` | 副轨 phase2a/t-finance-subroutes |
| F001 calibration goldens（real-data byte gate） | 同上副轨或专门 record chat |
| `fireGoldShadowRead` async 影子读取 | **永不做** — async fire-forget 仅 log，0 字节影响 |
| Java `getComprehensiveAnalysis` 调用链中 finance 之外的分支 | sister chat 已在做 sales / 后续副轨做 dept/region/etc |

## 2. Java reference mapping

| Python 函数 / 模块 | Java 来源 |
|---|---|
| `analysis_finance.py::get_finance_analysis` 路由 | `SmartBIAnalysisController.getFinanceAnalysis` (line 222-274) |
| `_get_comprehensive_finance_analysis` composite 装配 | `SmartBIServiceImpl.getComprehensiveAnalysis(..., "finance")` (line 600-605) — 4 keys + dateRange + generatedAt |
| `_get_finance_overview` (stub) | `FinanceAnalysisServiceImpl.getFinanceOverview` (Java line 88-189，含 fireGoldShadowRead，跳过) |
| `_get_profit_metrics` (stub) | `FinanceAnalysisServiceImpl.getProfitMetrics` |
| `_get_cost_structure_chart` (stub) | `FinanceAnalysisServiceImpl.getCostStructureChart` |
| `_get_receivable_aging_chart` (stub) | `FinanceAnalysisServiceImpl.getReceivableAgingChart(factoryId, endDate)` — 注意只用 `endDate` |
| `_get_payable_metrics` (real) | `FinanceAnalysisServiceImpl.getPayableMetrics(factoryId, date)` |
| `_get_payable_aging_chart` (real) | `FinanceAnalysisServiceImpl.getPayableAgingChart(factoryId, date)` |
| 各 DTO dict factory | `dto.smartbi.{DashboardResponse,KPICard,ChartConfig,RankingItem,AIInsight,DateRange,MetricResult}` |
| `wrap_response` envelope | `dto.common.ApiResponse.success(data)` (5-key envelope: code/message/data/timestamp/success) |

## 3. 架构

### 3.1 文件位置

```
backend/python/smartbi_compat/api/analysis_finance.py    [新增]
tests/python/smartbi_compat/test_analysis_finance_contract.py    [新增]
tests/python/smartbi_compat/test_analysis_finance_factories.py    [新增]
main.py                                                  [修改 — 加 include_router]
```

### 3.2 Imports

```python
from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.schema_compat import wrap_response   # ← origin/main 路径，NOT smartbi_compat.api.analysis
# DateRange 来源待 Phase A.0 确认（见 §10 跨轨依赖）
```

### 3.3 路由分支逻辑 (镜像 Java controller)

```
GET /api/mobile/{factory_id}/smart-bi/analysis/finance
  ?startDate=2026-01-01&endDate=2026-01-31&analysisType=<X>

verify_jwt_and_factory → AuthContext (factoryId 必须等于 path factoryId)
↓
analysisType 分支：
  ├─ None / ""             → _get_comprehensive_finance_analysis(...) → composite 6-key
  ├─ "payable"             → _get_payable_analysis(...)               → 4-key shape
  └─ "profit"/"cost"/"receivable"/"budget"
                          → 501 Not Implemented + actionHint
                            "该 analysisType 尚未 port 至 Python，请暂用 Java endpoint
                             或等待 phase2a/t-finance-perX chat 完成"
```

注意 Java 控制器有第二个分支条件 `smartBIService != null`：
- 当 `smartBIService` bean 注入成功且 `analysisType` 为空 → 走 `getComprehensiveAnalysis` 短路 (return composite)
- 当 `smartBIService` 为 null 且 `analysisType` 为空 → 走 `financeAnalysisService.getFinanceOverview` 直返单 key (`overview`)

**对 Python port 的处理**：在 prod 环境 `smartBIService` bean **总是存在**（@Autowired(required = false) 但 Spring 实际注入）。我们只镜像短路路径（composite）。若未来发现 prod 环境 bean 缺失再加 fallback。

## 4. 组件清单

### 4.1 DTO dict factories (Python 侧)

复用 sales foundation 已写的 7 个 factory（**复制 OR 引用**，依赖于 §10 跨轨决策）：

| Factory | 镜像 Java DTO | 字段数 (实测 F999) |
|---|---|---|
| `_new_dashboard_response_dict(...)` | `DashboardResponse` | 16 (含 4 个 @Deprecated getter) |
| `_new_kpi_card_dict(...)` | `KPICard` | 13 |
| `_new_chart_config_dict(...)` | `ChartConfig` | 7 (xaxisField/yaxisField **lowercase**) |
| `_new_ranking_item_dict(...)` | `RankingItem` | 6 |
| `_new_ai_insight_dict(...)` | `AIInsight` | 5 |
| `_new_date_range_dict(...)` | `DateRange` | 7 (含 derived `days`/`valid`) |

**新增 finance 专属**（sales 没有这个 DTO）：

| Factory | 镜像 Java DTO | 字段 |
|---|---|---|
| `_new_metric_result_dict(...)` | `MetricResult` | TBD — Phase A.1 读 Java 类确认字段顺序 |

注：finance 主路由的 `profitMetrics` / `payableMetrics` / `receivableMetrics` 等返回类型是 `List<MetricResult>`，需要这个 factory。

### 4.2 Helpers (复制 sales)

| 函数 | 用途 |
|---|---|
| `_to_decimal(v)` | 容忍 None/int/float/str/Decimal → Decimal，错误 fallback Decimal("0") |
| `_decimal_to_number(v)` | Decimal → int (如果整数) 或 float（FastAPI 默认序列化 Decimal 为 string，会破坏 byte parity） |
| `_format_kpi_value(v, unit)` | "元" 单位保留 2 位小数 + trailing zeros，其他 unit integer string |
| `_strip_volatile(obj)` | 递归剥 generatedAt/lastUpdated/cacheExpireAt/timestamp 用于 byte 对比 |
| `_utc_now_iso()` | ISO LocalDateTime（无时区，匹配 Java Jackson 序列化） |

### 4.3 Composite 路径 sub-services (4 个 stub)

每个返回 F999 空形状 dict，让 F999 byte gate 通过：

```python
async def _get_finance_overview(factory_id: str, range_: DateRange) -> dict:
    """STUB — foundation 阶段返回 16-field 空 DashboardResponse + 1 个 YELLOW 数据状态 insight + 1 个 suggestion。
    后续副轨 phase2a/t-finance-perX 替换为真实实现。"""
    return _new_dashboard_response_dict(
        ai_insights=[
            _new_ai_insight_dict(
                level="YELLOW",
                category="数据状态",
                message="当前时间范围内暂无财务数据",
                action_suggestion="请上传财务数据或调整时间范围",
            ),
        ],
        suggestions=["请先上传财务数据以开始分析"],
        last_updated=_utc_now_iso(),
    )

async def _get_profit_metrics(factory_id: str, range_: DateRange) -> list:
    """STUB — F999 空 → []"""
    return []

async def _get_cost_structure_chart(factory_id: str, range_: DateRange) -> dict:
    """STUB — F999 空 ChartConfig (chart_type="PIE", title="成本结构", data=[])"""
    return _new_chart_config_dict(
        chart_type="PIE",
        title="成本结构",
        data=[],
        options=None,
    )

async def _get_receivable_aging_chart(factory_id: str, end_date: date) -> dict:
    """STUB — F999 空 ChartConfig。注意只用 end_date，跟 Java 签名对齐。"""
    return _new_chart_config_dict(
        chart_type="PIE",
        title="应收账款账龄分布",
        data=[],
        options=None,
    )
```

⚠️ **Stub 的 chart_type / title 必须跟 Java 实现对齐** — Phase A.2 读 Java impl 确认（Java 实现可能在数据为空时返回的 chart_type/title 跟非空时一致；如果 Java 在空时直接返回 null，那 stub 也应返回 None）。

### 4.4 Payable 路径 real impl

```python
async def _query_finance_payable_data(pool, factory_id: str, end_date: date) -> list[dict]:
    """SQL helper — 从 finance_data 表 (record_type=PAYABLE) 或独立 ap_aging 表读取。

    Phase A.3 探索 Java FinanceAnalysisServiceImpl.getPayableMetrics / getPayableAgingChart 的实现，
    确定数据源（finance_data with RecordType.PAYABLE? 独立 accounts_payable 表? 来自 SmartBiFinanceData?）。
    """
    pass

async def _get_payable_metrics(factory_id: str, end_date: date) -> list[dict]:
    """REAL — 返回 List[MetricResult]:
       - AP_BALANCE: 应付余额
       - AP_TURNOVER_DAYS: 应付周转天数
    """
    pass

async def _get_payable_aging_chart(factory_id: str, end_date: date) -> dict:
    """REAL — 账龄分布饼图：0-30天 / 31-60天 / 61-90天 / 90天以上。
    桶常量见 FinanceAnalysisService.AGING_BUCKET_*"""
    pass
```

### 4.5 Composite + Payable 装配

```python
async def _get_comprehensive_finance_analysis(factory_id: str, range_: DateRange) -> dict:
    """Java reference: SmartBIServiceImpl.getComprehensiveAnalysis line 600-605 + 612-613.

    Java put 顺序:
      overview / profitMetrics / costStructure / receivableAging
      → result.put("dateRange", ...) / result.put("generatedAt", ...)

    Jackson 实测 key 顺序: TBD (Phase D.1 record golden 时确认)
    """
    return {
        "overview":         await _get_finance_overview(factory_id, range_),
        "profitMetrics":    await _get_profit_metrics(factory_id, range_),
        "costStructure":    await _get_cost_structure_chart(factory_id, range_),
        "receivableAging": await _get_receivable_aging_chart(factory_id, range_.end_date),
        "dateRange":        _new_date_range_dict(range_),
        "generatedAt":      _utc_now_iso(),
    }

async def _get_payable_analysis(factory_id: str, start_date: date, end_date: date) -> dict:
    """Java reference: SmartBIAnalysisController.getFinanceAnalysis line 255-258.

    Java put 顺序:
      startDate / endDate (controller line 240-241)
      metrics (line 255) / agingChart (line 256)
    """
    return {
        "startDate":   start_date.isoformat(),
        "endDate":     end_date.isoformat(),
        "metrics":     await _get_payable_metrics(factory_id, end_date),
        "agingChart":  await _get_payable_aging_chart(factory_id, end_date),
    }
```

### 4.6 Route handler

```python
@router.get("/api/mobile/{factory_id}/smart-bi/analysis/finance")
async def get_finance_analysis(
    factory_id: str,
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

    # 其他 4 个 type 留给后续副轨
    return wrap_response(
        data=None,
        success=False,
        code=501,
        message=f"analysisType={analysisType} 尚未 port，请暂用 Java endpoint 或等待 phase2a/t-finance-perX 完成",
    )
```

⚠️ **501 path 用 `wrap_response` 而不是 raise HTTPException** — 因为 Java 那边 controller 永远返回 200 + ApiResponse envelope（即便 error），所有客户端代码都按 envelope 解。Java 控制器没有 501 path（5 个 type 全处理），所以 Python 这个 501 是 port 期 Python-specific 的过渡态。**决定**：用 `wrap_response(data=None, success=False, code=501, message=...)` 保持 envelope 一致，HTTP status 仍 200（按 Java 风格），客户端通过 `success=false / code=501` 识别。nginx cutover 之前 Python 是 shadow，前端不会真的撞到这个 path。

## 5. 响应形状 (Response shapes)

### 5.1 Composite shape (analysisType 为空)

6 keys，Jackson 顺序待 record golden 时确认（Java 用 `HashMap`，put 顺序≠遍历顺序）：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "overview": { /* DashboardResponse 16 fields */ },
    "profitMetrics": [],
    "costStructure": { /* ChartConfig 7 fields */ },
    "receivableAging": { /* ChartConfig 7 fields */ },
    "dateRange": { /* DateRange 7 fields */ },
    "generatedAt": "2026-04-29T12:34:56.789"
  },
  "timestamp": "2026-04-29T12:34:56.789",
  "success": true
}
```

### 5.2 Payable shape (analysisType="payable")

4 keys + envelope，按 controller put 顺序（直接是 LinkedHashMap，应该按声明顺序）：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "startDate": "2026-01-01",
    "endDate": "2026-01-31",
    "metrics": [
      { /* MetricResult: AP_BALANCE */ },
      { /* MetricResult: AP_TURNOVER_DAYS */ }
    ],
    "agingChart": { /* ChartConfig 7 fields */ }
  },
  "timestamp": "...",
  "success": true
}
```

注：Java controller 用 `new HashMap<>()`（line 240）— Jackson 实测可能不是 startDate 第一。Phase D.1 record golden 时确认 key 顺序。

## 6. 错误处理

| 场景 | HTTP status | Body code | 处理 |
|---|---|---|---|
| Auth fail (invalid JWT) | 401 | n/a | `verify_jwt_and_factory` raise HTTPException(401)，FastAPI 标准错误体 |
| Cross-tenant (JWT.factoryId ≠ path factoryId) | 403 | n/a | 同上 raise HTTPException(403) |
| 未实现的 analysisType (profit/cost/receivable/budget) | 200 | 501 | `wrap_response(success=False, code=501, message=...)` envelope，跟 Java "always 200 + envelope" 风格一致；nginx cutover 前 Python 是 shadow，前端不会撞到 |
| DB 错误 / 内部异常 | 200 | 500 | log full stack + `wrap_response(success=False, code=500, message="财务分析查询失败")` |
| Date parse fail | 422 | n/a | FastAPI 默认错误体，无需自处理 |

## 7. 测试

### 7.1 测试文件

```
tests/python/smartbi_compat/test_analysis_finance_contract.py    [新增]
tests/python/smartbi_compat/test_analysis_finance_factories.py   [新增]
```

### 7.2 Contract test (byte-shape gate)

**镜像 sales 的 contract test 模式**：

```python
class TestFinanceContract:
    def test_f999_composite_byte_shape(self, monkeypatch, f999_factory):
        """F999 (synthetic empty tenant) composite 路径 byte gate.

        Mock SQL pool 返回 0 行；Python 应组装 6-key composite 全空形状。
        Strip volatile (generatedAt/lastUpdated/timestamp) 后跟 Java
        recorded golden byte 对齐。"""
        # ... monkeypatch _get_pg_pool to fake empty pool
        # ... call /api/mobile/F999/smart-bi/analysis/finance?startDate=...&endDate=...
        # ... assert _strip_volatile(response.json()) == _strip_volatile(golden_json)

    def test_f999_payable_byte_shape(self, monkeypatch, f999_factory):
        """同上 + ?analysisType=payable，验 4-key shape"""
        # ...

    def test_payable_seam_isolation(self, monkeypatch):
        """验证 _get_payable_metrics 和 _get_payable_aging_chart 是 seam-test 友好（可单测）"""
        # ...
```

### 7.3 Factory test (DTO unit)

```python
class TestFinanceFactories:
    def test_metric_result_dict_default_field_order(self):
        """MetricResult dict 字段顺序匹配 Java 类声明顺序"""
        # ...

    def test_dashboard_response_finance_overview_empty_state(self):
        """16-field shape, 4 deprecated getters present"""
        # ...

    # ... 7 个 factory 各 ≥ 1 个 unit test
```

### 7.4 Acceptance gate

| 命令 | 期望 |
|---|---|
| `pytest tests/python/smartbi_compat/test_analysis_finance_contract.py -v` | 全 pass，至少 2 个 byte-shape gate (composite + payable) |
| `pytest tests/python/smartbi_compat/test_analysis_finance_factories.py -v` | 全 pass，每个 factory ≥ 1 unit test |
| `pytest tests/python/smartbi_compat/` | 0 regression on existing tests（origin/main 当前数 + sales 端 161 取决于 sister chat 推没推） |
| `python -c "from smartbi_compat.api.analysis_finance import router"` | import 不报错 |

### 7.5 F001 calibration goldens — 推后

F001 (餐饮 prod tenant) 真实数据 byte gate **不在这个 chat 范围**，留给副轨 phase2a/t-finance-f001-record。原因：
- F001 finance 数据是否充分尚未验证（需要 SQL 查实际表）
- F001 byte gate 不通过会暴露 Java 端 bug 或 schema 差异，需要单独 chat focus
- Foundation chat 优先 F999 通即可 ship（gate 立住）

## 8. 阶段切分 (给 writing-plans 用)

| Phase | 内容 | 估 tasks |
|---|---|---|
| **A 准备 / 探索** | A.0 确定 DateRange 来源（见 §10）<br>A.1 读 Java MetricResult.java 确认字段<br>A.2 读 Java FinanceAnalysisServiceImpl 4 stub 方法实现，确认空数据返回形状<br>A.3 读 Java getPayableMetrics / getPayableAgingChart 实现 + SQL，确认数据源<br>A.4 verify F999 fixture pattern (复用 sales 的 conftest) | 4-5 |
| **B 文件骨架** | B.1 创建 `analysis_finance.py` 文件 + module docstring<br>B.2 imports + 7 个 DTO factory（复制 sales 写法）<br>B.3 helpers (`_to_decimal` / `_decimal_to_number` / `_format_kpi_value` / `_strip_volatile` / `_utc_now_iso`)<br>B.4 `_new_metric_result_dict` 新增 factory<br>B.5 路由 handler 骨架（含 501 path） | 4-5 |
| **C Composite 路径** | C.1 4 个 sub-service stub 实现（F999 空形）<br>C.2 `_get_comprehensive_finance_analysis` composite 装配<br>C.3 wire route handler composite 分支 | 3 |
| **D Composite F999 byte gate** | D.1 `test_analysis_finance_contract.py` composite 测试 case<br>D.2 record F999 composite golden<br>D.3 `test_analysis_finance_factories.py` factory unit tests<br>D.4 verify gate pass + 0 regress | 3-4 |
| **E Payable real impl** | E.1 `_query_finance_payable_data` SQL helper<br>E.2 `_get_payable_metrics` real impl<br>E.3 `_get_payable_aging_chart` real impl<br>E.4 `_get_payable_analysis` 装配<br>E.5 wire route handler payable 分支 | 4-5 |
| **F Payable F999 byte gate** | F.1 扩展 contract test 加 payable case<br>F.2 record F999 payable golden<br>F.3 verify gate pass | 2 |
| **G 收尾** | G.1 `main.py` 加 `include_router(analysis_finance.router)`<br>G.2 全 pytest run + 0-regress 验证<br>G.3 Spec self-review 后 commit 全部 | 2-3 |
| **合计** | | **22-27 tasks** |

## 9. 风险

| 风险 | 严重度 | 缓解 |
|---|---|---|
| **跨轨依赖 DateRange / wrap_response 路径** | 高 | §10 详细处理 |
| **MetricResult DTO 字段顺序未确认** | 中 | Phase A.1 必做 |
| **Payable SQL 数据源未明** | 中 | Phase A.3 必做 — 可能是 finance_data with RecordType.PAYABLE，可能是独立表 |
| **Java HashMap 遍历顺序 vs 真实 Jackson 实测** | 中 | record golden 时验证；类似 sales 端踩过 (Java result.put 顺序 ≠ Jackson 输出顺序) |
| **F999 fixture 不覆盖 finance 表** | 中 | Phase A.4 verify；如不覆盖，Phase A.4 加 finance 表的 synthetic 数据 |
| **Subagent driven dev 在 ~25 task 末段触顶** | 中 | Phase E.* (payable real impl) 是 stretch goal；如果 chat 在 D 完成时已超预算，**当场退化到 (a) 方案** — payable 留给副轨 |
| **fireGoldShadowRead 跳过引发遗漏** | 低 | Spec 写明跳过理由；如果未来真实环境发现差异（仅日志），加回来零字节风险 |
| **501 path Java 不存在** | 低 | Java 永远不返回 501（5 个 type 全处理）。Python 501 是过渡态。Spec 写明，nginx cutover 前不暴露给前端 |

## 10. 跨轨依赖 (与 sister chat 协调)

### 10.1 现状

主轨 sister `phase2a/t5-poc` HEAD `3a6d6aaef` 含以下 origin/main 没有的文件 / 类：

| 名称 | 位置 | 用途 |
|---|---|---|
| `class DateRange` + `DateRange.custom(...)` | `smartbi_compat/date_range.py` (sister 创建) | 日期范围对象，被 sales 主路由用 |
| `_query_sales_data` | `smartbi_compat/api/analysis.py` (sister 扩展) | sales 专属 SQL helper — **finance 不需要这个**，自己写 `_query_finance_*` |
| 6 个 DTO factory + 5 个 helper（identical 代码） | `smartbi_compat/api/analysis_sales.py` (sister 创建) | sales 文件内私有；finance 文件需要 same 代码 → **直接 copy 进 analysis_finance.py**，merge 时再 dedupe |

### 10.2 处理策略

**Phase A.0 子任务**：确定 `DateRange` 来源，3 选 1：

| 方案 | 操作 | 优劣 |
|---|---|---|
| **(α) Cherry-pick sister 的 DateRange commits** | 在 phase2a/t-finance 分支 cherry-pick sister 的 3 个 DateRange commits (`517f4692a` / `b648e7775` / `d301ff2d8`)，提供 `smartbi_compat/date_range.py` | 干净，与 sister 共享同 patch；merge 到 main 时 git 自动 dedup。**推荐** |
| **(β) 在自己 worktree 写一份 minimal DateRange** | 在 `smartbi_compat/date_range.py` 写一个最小可用的 `DateRange` 类（仅 `.custom(start, end)` + `start_date` / `end_date` 属性 + `.days` / `.valid` derived） | 自包含，不依赖 sister；但 merge 到 main 时跟 sister 的同名文件冲突 |
| **(γ) 直接在 `analysis_finance.py` 内 inline 一个 `_DateRange` 私有类** | 文件内私有 dataclass，不放 `smartbi_compat/date_range.py` | 最隔离；但跟 sales 那边代码不共享，未来 dedupe 工作量翻倍 |

**默认推 (α)**，作为 Phase A.0 第一个 task。如果 cherry-pick 因 sister 已 force-push 等原因失败，降级 (β)。

**DTO factory 复制** — sister `analysis_sales.py` 文件内的 7 个 dict factory 全是 finance 也要的：

- 这些 factory 是 sister 文件**私有的** (`def _new_dashboard_response_dict(...)` 直接定义在 `analysis_sales.py` 里，没 export)
- 我们 finance 文件**直接 copy 同样的代码**进 `analysis_finance.py`
- 长期：等 sister 把这些 factory 提到一个共享模块如 `smartbi_compat/_dto_factories.py`，再 dedupe（不在这个 chat 范围）

### 10.3 共享文件冲突点

`backend/python/main.py` — sister 加 `include_router(analysis_sales.router)`，我加 `include_router(analysis_finance.router)`。两行不重叠，git auto-merge 通过。**Commit 前 git status 检查防 husky/lint-staged 偷加（rule 5b）**。

## 11. Worktree + Git 策略

### 11.1 已完成

```bash
git worktree add .worktrees/phase2a-finance -b phase2a/t-finance origin/main
# HEAD now: 3292bd5e5 (origin/main)
```

### 11.2 Commit 规范

- 用 `--only` mode 防 scope creep：
  ```bash
  git commit -m "..." -- backend/python/smartbi_compat/api/analysis_finance.py tests/python/smartbi_compat/test_analysis_finance_contract.py
  ```
- 或 wrapper：`./scripts/safe-commit.sh "..." <paths>`
- **不 push origin** until 全 chat ship clean (per memory 的 "NOT pushed origin" 模式)

### 11.3 改共享文件前的检查

- `main.py`：commit 前 `git status --short`，确认 staged 区只有 main.py + 自己的 finance 文件，**没有 sister chat 偷加的 sales 相关文件**

## 12. 不做的 (out-of-scope 明确)

- ❌ `analysisType=profit/cost/receivable/budget` 4 个 per-type real impl
- ❌ 3 个独立 sub-endpoint（`/budget-achievement` / `/yoy-mom` / `/category-comparison`）
- ❌ `fireGoldShadowRead` 异步影子读取（Java fire-forget，0 字节影响）
- ❌ F001 calibration goldens（留副轨）
- ❌ Tool-Skill 镜像（Apr 30 reverse decision，永远留 Java）
- ❌ nginx cutover 流量切换（Phase 2A T6，所有 50 endpoint port 完后单独 chat 做）
- ❌ frontend 任何改动（这是 byte-shape port，前端无感）
- ❌ Java 端任何改动（Java 是参考实现，永远不动）

## 13. 完成定义 (Definition of Done)

- [ ] `analysis_finance.py` 文件创建，含路由 + 7 DTO factory + 5 helper + 4 stub + 2 real impl + 2 装配函数
- [ ] `test_analysis_finance_contract.py` ≥ 2 byte-shape gate pass (composite + payable)
- [ ] `test_analysis_finance_factories.py` 每个 factory ≥ 1 unit test pass
- [ ] `main.py` 加 include_router 行
- [ ] `pytest tests/python/smartbi_compat/` 0 regression
- [ ] `python -c "from smartbi_compat.api.analysis_finance import router"` 无 import 错
- [ ] Spec self-review pass，无 placeholder / 矛盾 / 模糊
- [ ] Plan 文档已写（writing-plans 阶段输出）
- [ ] Spec + plan + 实现 + 测试均 commit 在 `phase2a/t-finance` 分支
- [ ] Chat 末尾 verify report 含手动验收 checklist（不强求 deploy 到 server）

---

## Appendix A — Java reference 摘录

### A.1 Controller (line 222-274)

完整 Java 代码已在 spec brainstorming 阶段读过，关键分支已 §3.3 / §4.5 / §4.6 镜像。

### A.2 SmartBIServiceImpl.getComprehensiveAnalysis finance 分支 (line 600-605)

```java
case "finance":
    result.put("overview", financeService.getFinanceOverview(factoryId, startDate, endDate));
    result.put("profitMetrics", financeService.getProfitMetrics(factoryId, startDate, endDate));
    result.put("costStructure", financeService.getCostStructureChart(factoryId, startDate, endDate));
    result.put("receivableAging", financeService.getReceivableAgingChart(factoryId, endDate));
    break;
// 之后 (line 612-613):
result.put("dateRange", DateRange.custom(startDate, endDate));
result.put("generatedAt", LocalDateTime.now());
```

### A.3 FinanceAnalysisServiceImpl.fireGoldShadowRead (line 200-215)

完整代码已 spec § brainstorming 阶段读过；**Python 不实现**。

---

## Appendix B — 后续副轨规划 (informational, NOT in this chat)

| 副轨 chat | 范围 |
|---|---|
| phase2a/t-finance-perX (×4) | 4 个 per-type real impl: profit / cost / receivable / budget。每 chat 1-2 个 type，按 payable 样板抄改 |
| phase2a/t-finance-subroutes | 3 个独立 sub-endpoint: budget-achievement / yoy-mom / category-comparison |
| phase2a/t-finance-f001-record | F001 餐饮 tenant 真实数据 byte gate (composite + 5 per-type + 3 sub-endpoint = 9 个 F001 golden) |

后续副轨**不在此 spec 范围**，留作下一个 brainstorm 起点。

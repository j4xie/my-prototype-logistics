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
backend/python/smartbi_compat/api/analysis_finance.py                        [新增]
tests/python/smartbi_compat/test_analysis_finance_contract.py                [新增]
tests/python/smartbi_compat/test_analysis_finance_factories.py               [新增]
tests/fixtures/java-smartbi-golden/analysis-finance-F999-composite.json      [新增 — record from test env]
tests/fixtures/java-smartbi-golden/analysis-finance-F999-payable.json        [新增 — record from test env]
backend/python/main.py                                                        [修改 — 加 include_router]
```

**Golden 来源（F999）**：手动 curl test env (10011 Java 后端) 录制，命令模板见 Phase A.5。一次 curl 救一个 golden 写一个 JSON 文件。无脚本（脚本留给 F001 副轨）。

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

注意 Java 控制器有第二个分支条件 `smartBIService != null` (controller line 79: `@Autowired(required = false)`)：
- 当 `smartBIService` bean 注入成功且 `analysisType` 为空 → 走 `getComprehensiveAnalysis` 短路 (return 6-key composite)
- 当 `smartBIService` 为 null 且 `analysisType` 为空 → fall through 到 controller per-type if/else，走 `default` 分支 (line 264-267)：返回 **3-key shape `{startDate, endDate, overview}`** （单 key composite 错说了，实际是 3-key）

**对 Python port 的处理（明确分歧 / accepted divergence）**：
- 经验观察：sister chat 在做 sales / department / region 的 port 时实测 prod 环境 `smartBIService` bean 总在（同样的短路条件均触发）
- Python 选择**只镜像短路路径**（6-key composite），**不镜像 3-key fallback**
- 这是 **accepted divergence** — 文档化在此：如果 nginx cutover 之后某天 prod 环境意外 bean 缺失（feature toggle 关掉之类），Python 仍返回 6-key composite，跟 Java 不一致
- 缓解：(i) prod 永远 bean 在；(ii) Python 只 port 已观察到的实际行为；(iii) Python 服务自己没有 SmartBIService 切换开关；(iv) 真撞到的话视为 prod 配置 incident，Java 那边先修
- Phase A.5 record golden 时如果意外抓到 3-key shape (`{startDate, endDate, overview}`)，那就是 bean=null fallback；Python 不 port 它，spec 修订记录此事

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
| `_new_metric_result_dict(...)` | `MetricResult` | **~11 declared @Data fields** — Lombok 全部 emit (sister 已踩 16-field DashboardResponse 同模式)。Phase A.1 javap 确认确切字段名 + 顺序。已知字段：metricCode / metricName / value / formattedValue / unit / changePercent / changeDirection / changeValue / alertLevel / dimensionValue / description（可能 ±1）。AlertLevel enum: GREEN / YELLOW / RED |

注：finance 主路由的 `profitMetrics` / `payableMetrics` / `receivableMetrics` 等返回类型是 `List<MetricResult>`，需要这个 factory。

**所有 DTO factory 字段计数都是启发式，非权威**。Phase A.1 必须 `javap dto.smartbi.{DashboardResponse,KPICard,MetricResult,RankingItem,ChartConfig,AIInsight,DateRange}` 冻结实际字段列表。Sister chat 的 `analysis_sales.py:109-154` 是 5 个共享 DTO factory 的 canonical 实现，**直接照抄不要重新推导**（避免 sister 已经走过的 "5 vs 4 deprecated" 字段冲突）。

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

⚠️ **Stub 的具体形状未冻结** — Phase A.2 读 Java FinanceAnalysisServiceImpl 4 stub 方法实现 + Phase A.5 录 F999 composite golden 后才知道：

1. **chart_type / title** 在数据为空时是否跟非空一致？或 Java 是否返回 null/empty ChartConfig？
2. **`_get_finance_overview` empty-state 是否含 YELLOW insight + 1 suggestion**？sister 的 sales empty-state 来源是 `SalesAnalysisServiceImpl.buildEmptyDashboard` line 1145-1159（emit YELLOW + suggestion）。**finance Java 实现可能不同** — 如果 Java 直接返回 `kpiCards:[], rankings:{}, charts:{}, aiInsights:[], suggestions:[], lastUpdated:now`，那 Python stub 就照这个写，不要复制 sales 的 YELLOW pattern。
3. **`_get_profit_metrics` 空返回** 是 `[]` 还是 null？Java getProfitMetrics 应返回 List 不会 null 但要 verify。
4. **`_get_cost_structure_chart` / `_get_receivable_aging_chart`** 同上。

上面伪代码是 sales-pattern 默认值，只是 placeholder。**Phase C.1 必须先 verify 后再写。**

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

    ⚠️ KEY ORDER WARNING — sister chat 已踩过此坑 (analysis_sales.py:700-709 docstring)：
    Java 用 `new HashMap<>()` (line 575), 所以 Java result.put() 顺序 ≠ Jackson 输出顺序。
    Sister 实测 sales 6-key composite 的 put 顺序与 Jackson 输出顺序完全不同。

    Java put 顺序 (line 600-605 + 612-613):
      overview / profitMetrics / costStructure / receivableAging / dateRange / generatedAt

    Jackson 实测顺序: ❗ MUST be re-recorded against test env BEFORE writing
    this dict body. 见 Phase A.5 task: record F999 finance composite golden first,
    THEN write Python dict to match Jackson order. 不要直接复制 Java put 顺序。

    下面的 dict 字面量是 placeholder, Phase A.5 必须根据 golden re-order 后再写。
    Phase D.2 byte gate 期望使用最终 Jackson 顺序. 留 30min 缓冲修正 dict order.
    """
    # PLACEHOLDER ORDER — will be re-ordered in Phase A.5 against recorded golden
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

**镜像 sister 的 contract test 模式**（重要：必须用 importlib 加载 production main，不能直接 import router）：

```python
# Sister 范式: tests/python/smartbi_compat/test_analysis_sales_contract.py:41-66
# 用 _load_production_main() 加载 main.py 模块, 拿到挂载了所有 middleware
# (JWT / CORS / exception handlers) 的 FastAPI app, 再传给 TestClient.
#
# ⛔ 禁止: from smartbi_compat.api.analysis_finance import router
#         然后 app = FastAPI(); app.include_router(router) ← 这样 middleware 没挂上,
#         JWT auth / cross-tenant 测试会假 pass / fail.

def _load_production_main():
    """复用 sister test_analysis_sales_contract.py 的 importlib 模式."""
    import importlib.util
    from pathlib import Path
    main_path = Path(__file__).parent.parent.parent.parent / "backend" / "python" / "main.py"
    spec = importlib.util.spec_from_file_location("_production_main", main_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class TestFinanceContract:
    def setup_method(self):
        from fastapi.testclient import TestClient
        self.app = _load_production_main().app
        self.client = TestClient(self.app)

    def test_f999_composite_byte_shape(self, monkeypatch, f999_factory):
        """F999 (synthetic empty tenant) composite 路径 byte gate.

        Mock SQL pool 返回 0 行；Python 应组装 6-key composite 全空形状。
        Strip volatile (generatedAt/lastUpdated/timestamp) 后跟 Java recorded
        golden (tests/fixtures/java-smartbi-golden/analysis-finance-F999-composite.json)
        byte 对齐。"""
        # ... monkeypatch get_pg_pool to fake empty pool
        # ... self.client.get("/api/mobile/F999/smart-bi/analysis/finance?startDate=...&endDate=...")
        # ... assert _strip_volatile(response.json()) == _strip_volatile(golden_json)

    def test_f999_payable_byte_shape(self, monkeypatch, f999_factory):
        """同上 + ?analysisType=payable，验 4-key shape，对齐
        analysis-finance-F999-payable.json"""
        # ...

    def test_payable_seam_isolation(self, monkeypatch):
        """验证 _get_payable_metrics 和 _get_payable_aging_chart 是 seam-test 友好（可单测）"""
        # ...
```

**MetricResult byte-shape 含 AlertLevel enum string** — Phase A.1 javap 后, factory test 必须 verify `alertLevel` 字段输出 "GREEN" / "YELLOW" / "RED" 字符串而非 enum object repr。

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

| Phase | 内容 | 估 tasks | 必做/stretch |
|---|---|---|---|
| **A 准备 / 探索** | A.1 javap MetricResult.java + 其他 6 个 DTO 确认字段顺序<br>A.2 读 Java FinanceAnalysisServiceImpl 4 stub 方法 (overview / profitMetrics / costStructure / receivableAging) 确认空数据 Java 返回形状（特别是 aiInsights 是否有 YELLOW insight 或 `[]`）<br>A.3 读 Java getPayableMetrics / getPayableAgingChart 实现 + SQL，确认数据源（finance_data with PAYABLE? 独立 ap_aging 表? SmartBiFinanceData?）<br>A.4 verify F999 fixture pattern (复用 sister conftest)<br>A.5 **Record F999 composite golden** (`curl -H 'auth' http://10.0.0.1:10011/api/mobile/F999/smart-bi/analysis/finance?startDate=...&endDate=...` → save to `tests/fixtures/java-smartbi-golden/analysis-finance-F999-composite.json`) — **必须先于 Phase C 的 dict 写**, 防 §4.5 key order 踩坑<br>A.6 确定 DateRange 来源（见 §10），cherry-pick or β/γ 降级 | 5-6 | 必做 |
| **B 文件骨架** | B.1 创建 `analysis_finance.py` 文件 + module docstring<br>B.2 imports + 7 个 DTO factory（**复制 sister `analysis_sales.py:109-228` 的 5 个共享 factory 代码 verbatim**, 不重新推导）<br>B.3 helpers (`_to_decimal` / `_decimal_to_number` / `_format_kpi_value` / `_strip_volatile` / `_utc_now_iso`) — 同样照抄 sister<br>B.4 `_new_metric_result_dict` 新增 factory，按 A.1 javap 结果写<br>B.5 路由 handler 骨架（含 501 path） | 4-5 | 必做 |
| **C Composite 路径** | C.1 4 个 sub-service stub 实现（按 A.2 实测形状写, **不直接抄 sales YELLOW+suggestion 模式**）<br>C.2 `_get_comprehensive_finance_analysis` composite 装配，**dict key 顺序按 A.5 实测 Jackson 顺序排**, 不抄 Java put 顺序<br>C.3 wire route handler composite 分支 | 3 | 必做 |
| **D Composite F999 byte gate** | D.1 `test_analysis_finance_contract.py` composite 测试 case (用 §7.2 的 `_load_production_main()` importlib 模式, 不直接 import router)<br>D.2 verify Python 输出对齐 A.5 录的 golden（_strip_volatile 后字节相等）<br>D.3 `test_analysis_finance_factories.py` factory unit tests（每 factory ≥ 1 test, MetricResult 含 alertLevel string verify）<br>D.4 verify 0 regress on existing pytest | 3-4 | 必做 |
| **D-gate** | **如果到这里已用 ≥ 18 tasks**：当场 ship D 通的版本作为 (a) 方案 退化版（仅 foundation+composite, 无 payable real impl）。Phase E/F 留 phase2a/t-finance-payable 副轨。**chat 不超 18 task 则继续 Phase E** | gate | 决策点 |
| **E Payable real impl (stretch)** | E.1 `_query_finance_payable_data` SQL helper (按 A.3 数据源写)<br>E.2 `_get_payable_metrics` real impl<br>E.3 `_get_payable_aging_chart` real impl<br>E.4 `_get_payable_analysis` 装配<br>E.5 wire route handler payable 分支 | 4-5 | **stretch** |
| **F Payable F999 byte gate (stretch)** | F.1 record F999 payable golden (curl test env)<br>F.2 扩展 contract test 加 payable case<br>F.3 verify gate pass | 2-3 | **stretch** |
| **G 收尾** | G.1 `main.py` 加 `include_router(analysis_finance.router)`（用 `./scripts/safe-commit.sh "..." backend/python/main.py ...`）<br>G.2 全 pytest run + 0-regress 验证<br>G.3 commit 全部, 推 origin?（默认不推, 跟 sister 同 NOT-pushed 模式） | 2-3 | 必做 |
| **合计 (必做)** | A + B + C + D + G | **17-21 tasks** |  |
| **合计 (含 stretch)** | + E + F | **23-29 tasks** |  |

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

**默认推 (α)**，作为 Phase A.6 task。

**Cherry-pick 实操（重要 — sister 还没推 origin，commits 只在另一个 worktree 里）**：

```bash
# 在 .worktrees/phase2a-finance 工作目录中
# 把 sister worktree 的 phase2a/t5-poc 分支 fetch 进当前仓库的 ref
git fetch ../phase2a-t5-poc phase2a/t5-poc:refs/remotes/sister/t5-poc

# 然后 cherry-pick 指定 SHA
git cherry-pick 517f4692a b648e7775 d301ff2d8

# 如果 cherry-pick 失败 (sister 改过 history / SHA 不存在) → 降级 (β)
```

**降级 (β) 为更稳的默认**：cherry-pick 因 sister 仍在主动 commit 而 SHA 频繁变（sister 可能在你工作时新增 commit），实操可能反复失败。**因此实际推荐：直接 (β) — 手动 copy `smartbi_compat/date_range.py` from sister worktree**：

```bash
# 简单粗暴, 100% 成功:
cp ../phase2a-t5-poc/backend/python/smartbi_compat/date_range.py \
   backend/python/smartbi_compat/date_range.py
```

然后 `git add backend/python/smartbi_compat/date_range.py`. Merge 到 main 时跟 sister 同名文件冲突，用 `git checkout --theirs` 选 sister 版本即可（两份内容应该 identical）。

**如果两份内容不 identical** → sister 在 finance chat 工作期间改了 date_range.py，那是真冲突，需要 manual diff 解。Phase A.6 决定时如果 sister 已经 ship 推 origin，跳过这一步直接 import from origin。

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

### 必做 (foundation + composite, ship 退化版门槛)

- [ ] `analysis_finance.py` 文件创建，含路由 + 7 DTO factory + 5 helper + 4 composite stub + 2 装配函数（payable 装配可暂作 501 stub）
- [ ] `test_analysis_finance_contract.py` ≥ 1 byte-shape gate pass (composite F999), 用 `_load_production_main()` importlib 模式
- [ ] `test_analysis_finance_factories.py` 每个 factory ≥ 1 unit test pass
- [ ] `tests/fixtures/java-smartbi-golden/analysis-finance-F999-composite.json` 录制完成 (Phase A.5)
- [ ] `main.py` 加 include_router 行（用 `./scripts/safe-commit.sh` 防 scope creep）
- [ ] `pytest tests/python/smartbi_compat/` 0 regression
- [ ] `python -c "from smartbi_compat.api.analysis_finance import router"` 无 import 错
- [ ] Plan 文档已写（writing-plans 阶段输出）
- [ ] 全部 commit 在 `phase2a/t-finance` 分支（默认不推 origin，同 sister 模式）
- [ ] Chat 末尾 verify report 含手动验收 checklist

### Stretch (payable 样板, 如果 chat 容量够才做)

- [ ] `_get_payable_analysis` real impl (E.1-E.5)
- [ ] `tests/fixtures/java-smartbi-golden/analysis-finance-F999-payable.json` 录制
- [ ] `test_analysis_finance_contract.py` 扩展 payable byte gate pass
- [ ] 如果到 Phase D 完成时已用 ≥ 18 tasks，**主动放弃 stretch**，payable 留 phase2a/t-finance-payable 副轨

### 退化策略 (a-fallback)

如果中途撞墙（DateRange cherry-pick 失败 / SQL discovery 卡住 / 字段量超预期），ship 仅 composite 路径的版本。最低门槛：A.5 录 golden + B+C+D 必做 + G 收尾。Payable 完全推后。这就是 (a) 方案的实际形状。

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

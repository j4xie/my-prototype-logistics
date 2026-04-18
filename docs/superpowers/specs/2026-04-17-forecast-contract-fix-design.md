# SmartBI Forecast 契约修复 Design — 方案 E

**日期**: 2026-04-17
**作者**: Daisy + Agent Team (Critic 翻盘)
**审计依据**: `.claude/agent-team-outputs/2026-04-17_smartbi-forecast-architecture-audit.md`
**Scope**: Stage 1 hotfix,仅覆盖 `SALES_AMOUNT` metric
**不做**: 40 metric 全覆盖 / MetricCalculatorService 新接口 / finance 日聚合 / Python 代码改动

---

## 背景

线上 SmartBI forecast 功能 degraded 为空图已数月:
- Java 发 `{factoryId, startDate, endDate, forecastDays, metricType}` 给 Python `/api/forecast/predict`
- Python 要求 `{data: List[float], algorithm, periods, confidenceLevel}`
- 每次调用返回 422 "field required" → Java 侧 `ForecastServiceImpl.java:117-132` demote 为 WARN + 空 ForecastResult

Agent Team 审计后,Critic 通过 5 处代码验证翻盘了 Analyst 的"方案 B (Python 自查 DB)"推荐:
- `findDailySalesTrend` SQL GROUP BY **已存在**(SmartBiSalesDataRepository.java:100),不需要 JVM 内存聚合
- `_legacyForecastWithAlgorithm` 标 `@SuppressWarnings("unused")` 是**死代码**,不是活跃 anti-pattern
- "34 restaurant tool 主导 Python 自查模式"是 reference class 错配(Python 实际查的是 Excel 上传的 `smart_bi_dynamic_data`,不是 Java 业务表)
- `RestaurantForecastHandler` 接受外部传入的 `history_values`,是方案 A 变种,不是方案 B 证据
- 方案 B 真实成本 7+ 文件 × 2 语言 + 跨服务部署依赖,不是 Analyst 说的 "1 文件 1 语言"

---

## 方案 E:Java 查 + Python 纯算

**核心决定**: Java Controller/Service 层直接用已有的 SQL GROUP BY query 组装 `List<Double>` 传给 Python,Python 端保持纯数学计算不变。

**改动规模**: **单语言(Java only)单 PR 约 50-80 行** — 新增 `PythonForecastResponse` DTO、改 `PythonSmartBIClient.forecastSales` 签名、重写 `ForecastServiceImpl.forecastSalesWithPython`、新增 `buildForecastResult` helper、删除死代码 `_legacyForecastWithAlgorithm`。0 Python 改动,0 schema migration。

(对比方案 B 的 "7+ 文件 × 2 语言 + 跨服务部署依赖 + Python 侧 SecurityUtil 新建")

---

## Architecture

```
┌─ Java 调用入口(不变)
│   SmartBIPublicDemoController / SmartBIServiceImpl
│   → forecastService.forecastSales(factoryId, startDate, endDate, forecastDays)
│
├─ ForecastServiceImpl.forecastSalesWithPython (重写)
│   1. salesDataRepository.findDailySalesTrend(factoryId, startDate, endDate)
│      → List<Object[]>  [orderDate, SUM(amount), SUM(quantity)]
│   2. Extract: List<Double> data = trend.stream().map(row -> ((BigDecimal) row[1]).doubleValue()).toList()
│   3. Guard: data.size() < 3 → 早期 return empty ForecastResult + WARN
│   4. pythonClient.forecastSales(data, forecastDays, "auto")
│   5. ResponseMapper: Python predictions[] → Java ForecastPoint[]
│
├─ PythonSmartBIClient.forecastSales (改签名 — 方案 E 核心)
│   旧: forecastSales(factoryId, startDate, endDate, forecastDays)
│   新: forecastSales(List<Double> data, int forecastDays, String algorithm)
│   body: {data, algorithm, periods, confidenceLevel}
│
└─ Python 端(0 改动)
    /api/forecast/predict 契约不变 (data, algorithm, periods, confidenceLevel)
```

**不变量**:
- Python 服务不连任何 Java 业务表
- 契约至此永久对齐
- factoryId 过滤在 Java 侧通过 SecurityUtil → Repository 强制注入(保留现有多租户保护)

---

## Components

### 1. `SmartBiSalesDataRepository.findDailySalesTrend`(不动,复用)

现状(SmartBiSalesDataRepository.java:97-102):

```java
@Query("SELECT s.orderDate, SUM(s.amount), SUM(s.quantity) FROM SmartBiSalesData s " +
       "WHERE s.factoryId = :factoryId AND s.orderDate BETWEEN :start AND :end " +
       "GROUP BY s.orderDate ORDER BY s.orderDate")
List<Object[]> findDailySalesTrend(@Param("factoryId") String factoryId,
                                    @Param("start") LocalDate start,
                                    @Param("end") LocalDate end);
```

SQL 已做 GROUP BY + ORDER BY,Java 侧不需要再聚合。

### 2. `ForecastServiceImpl.forecastSalesWithPython`(重写)

改动位置: ForecastServiceImpl.java:94-133

改动后伪代码:

```java
private ForecastResult forecastSalesWithPython(String factoryId, LocalDate startDate,
                                                LocalDate endDate, int forecastDays) {
    // 1. 查历史数据
    List<Object[]> trend = salesDataRepository.findDailySalesTrend(factoryId, startDate, endDate);
    if (trend.size() < 3) {
        log.warn("销售数据不足 3 天,无法预测: factoryId={}, 数据点={}", factoryId, trend.size());
        return buildEmptyForecastResult(...);
    }

    // 2. 提取 amount 列为 List<Double>
    List<Double> data = trend.stream()
        .map(row -> ((BigDecimal) row[1]).doubleValue())
        .collect(Collectors.toList());

    // 3. 调 Python 纯算
    try {
        PythonForecastResponse resp = pythonClient.forecastWithData(data, forecastDays, "auto");

        // 4. 映射 response 到 ForecastResult
        return buildForecastResult(resp, endDate);

    } catch (IOException e) {
        log.warn("Python forecast 调用失败: {}", e.getMessage());
        return buildEmptyForecastResult(...);
    }
}

private ForecastResult buildForecastResult(PythonForecastResponse resp, LocalDate endDate) {
    List<ForecastPoint> points = new ArrayList<>();
    for (int i = 0; i < resp.predictions.size(); i++) {
        LocalDate date = endDate.plusDays(i + 1);
        points.add(ForecastPoint.builder()
            .date(date)
            .value(BigDecimal.valueOf(resp.predictions.get(i)))
            .lower(BigDecimal.valueOf(resp.lowerBound.get(i)))
            .upper(BigDecimal.valueOf(resp.upperBound.get(i)))
            .build());
    }
    return ForecastResult.builder()
        .forecastPoints(points)
        .algorithm(ForecastAlgorithm.valueOf(resp.algorithm.toUpperCase()))
        .confidence(BigDecimal.valueOf(0.95))
        .build();
}
```

### 3. `PythonSmartBIClient.forecastSales`(改签名)

改动位置: PythonSmartBIClient.java:315-334

```java
public PythonForecastResponse forecastWithData(List<Double> data, int periods, String algorithm) throws IOException {
    log.info("调用 Python forecast: dataPoints={}, periods={}, algorithm={}",
             data.size(), periods, algorithm);

    Map<String, Object> requestBody = Map.of(
        "data", data,
        "algorithm", algorithm,
        "periods", periods,
        "confidenceLevel", 0.95
    );

    Request request = new Request.Builder()
        .url(config.getForecastUrl())
        .post(RequestBody.create(JSON, objectMapper.writeValueAsString(requestBody)))
        .build();

    return executeWithRetry(request, PythonForecastResponse.class);
}
```

### 4. `PythonForecastResponse`(新 DTO — 匹配 Python 返回)

```java
@Data
public class PythonForecastResponse {
    private boolean success;
    private String algorithm;
    private Integer inputLength;
    private Integer forecastPeriods;
    private List<Double> predictions;
    private List<Double> lowerBound;
    private List<Double> upperBound;
    private Map<String, Object> parameters;
    private String selectedAlgorithm;
    private Double validationError;
    private String error;
}
```

### 5. 死代码清理

删除 `_legacyForecastWithAlgorithm`(标 @SuppressWarnings("unused") 证实未被调用)。

### 6. `forecastMetric(metricType)` — 部分支持

Stage 1 只有 `SALES_AMOUNT` 有配套 SQL(`findDailySalesTrend`),其他 39 个 metric 暂无日聚合 repo 方法。处理:

```java
public ForecastResult forecastMetric(String factoryId, String metricType,
                                      LocalDate startDate, LocalDate endDate, int forecastDays) {
    if (MetricCalculatorService.SALES_AMOUNT.equals(metricType)) {
        return forecastSales(factoryId, startDate, endDate, forecastDays);
    }
    log.warn("暂不支持该 metric 的预测: {}, 需要 Stage 2 建对应日聚合 query", metricType);
    return buildEmptyForecastResult(metricType, ForecastAlgorithm.AUTO, startDate, endDate);
}
```

不抛 `UnsupportedMetricException`(改 API 契约风险),而是返回 empty + 日志 WARN。用户看到空图但不挡调用,前端可根据 empty 判断并提示。

---

## Data Flow

```
User → Controller.forecastSales(factoryId, startDate, endDate, forecastDays)
  → ForecastServiceImpl.forecastSalesWithPython(...)
      → salesDataRepository.findDailySalesTrend(factoryId, startDate, endDate)
        [SQL: GROUP BY orderDate ORDER BY orderDate]
      → List<Object[]> trend
      → [Guard] if trend.size() < 3 → return empty + WARN
      → Extract amount column as List<Double> data
      → pythonClient.forecastWithData(data, forecastDays, "auto")
          → HTTP POST /api/forecast/predict {data, periods, algorithm, confidenceLevel}
          → Python: pure ForecastService.forecast() — numpy/scipy
          → HTTP 200 {predictions, lowerBound, upperBound, algorithm}
      → ResponseMapper: predictions[i] → ForecastPoint(date = endDate + i+1, value, lower, upper)
  → Return ForecastResult{forecastPoints, algorithm, confidence}
```

---

## Error Handling

| 条件 | 处理 |
|---|---|
| SQL 返回空(无历史数据) | 早期返回 empty ForecastResult + WARN,不调 Python |
| 历史点 < 3(Python `min_items=3` 强制要求) | 早期返回 empty + WARN "数据不足" |
| Python HTTP 5xx | 保留现有 `PythonServiceCircuitBreaker`,返回 empty + WARN |
| Python 返回 `success=false` | 返回 empty ForecastResult + WARN with `error` message |
| Python 响应字段缺失(`predictions` 为 null) | 返回 empty + ERROR |
| Java side BigDecimal 转 Double 溢出 | 极不可能(销售额 <= 10^10),不特殊处理,靠 Double 语义 |
| factoryId 越权 | Repository 层通过 `@Param` WHERE 强制,不变 |

---

## Testing

### Unit Tests(Java 侧)

1. `ForecastServiceImplTest.forecastSalesWithPython_emptyTrend_returnsEmpty`
   - Mock repository 返回 empty list → 验证 returns empty ForecastResult + 不调用 client

2. `ForecastServiceImplTest.forecastSalesWithPython_fewerThan3Points_returnsEmpty`
   - Mock repository 返回 2 个点 → 验证 returns empty + 不调 client

3. `ForecastServiceImplTest.forecastSalesWithPython_happy_path_mapsResponse`
   - Mock repository 返回 30 天数据 → Mock client 返回 {predictions: [100, 110, 120], ...}
   - 验证返回 ForecastResult.forecastPoints 长度 3 + date 对齐 endDate+1/+2/+3

4. `ForecastServiceImplTest.forecastSalesWithPython_pythonFails_returnsEmpty`
   - Mock client 抛 IOException → 验证 returns empty + WARN

5. `PythonSmartBIClientTest.forecastWithData_sendsCorrectPayload`
   - 用 MockWebServer 验证 request body `{data, algorithm, periods, confidenceLevel}` 格式正确

### Smoke Tests(Test env)

1. `POST /api/smartbi/forecast/sales?factoryId=F001&startDate=2025-02-01&endDate=2025-02-28&forecastDays=7`
   - 期望:200 响应 + `forecastPoints` 长度 7 + 每个 point 带日期/value/lower/upper
   - 验证:日期 = 2025-03-01 ~ 2025-03-07 连续

2. 观察 Python prod log 3-5 min 内无 422 / `data field required` 错误

3. 观察 Java prod log 无 `契约不匹配` WARN

### 不写的 Test(scope 外)

- 其他 metric 的 forecast(例如 TOTAL_COST) — Stage 2 范围
- 算法切换(moving_average / exponential_smoothing) — 保留 algorithm="auto"
- Response accuracy 校验 — Python 算法输出由 Python 单测保证,Java 侧不重复

---

## Deployment

按 `.claude/rules/server-operations.md` + `feedback_test_before_prod_smartbi.md`:

1. **Test first**: `./scripts/deploy/deploy-backend.sh --env test`
2. **Smoke test**: 调上述 endpoint 验证预测出图
3. **观察**: 3-5 min 监控 M1/M2/M3/M4,确认无 regression
4. **用户确认后再 prod**: `./scripts/deploy/deploy-backend.sh --env prod --mode bluegreen`

---

## Out of Scope(明确不做)

- **Stage 2 延后**: 其他 39 个 metric(`TOTAL_COST` / `GROSS_PROFIT` / `ORDER_COUNT` / ...)的 forecast 支持
- **MetricCalculatorService 新接口** `calculateDailySeries(metricCode, factoryId, startDate, endDate)` — 不建
- **Finance 表日聚合修复** — 不做,需要时再说
- **Python 代码改动** — 0 行
- **算法切换 UI** — 保留 algorithm="auto"

---

## Rollback

- 一次 revert:`git revert <commit>` 撤 Java 3-5 行改动
- 恢复 `ForecastServiceImpl.java:117-132` 的 WARN 降级逻辑即可
- 无 DB schema 改动,无 Flyway 回退需求

---

## Follow-up Signals(Stage 2 触发条件)

以下任一出现才重启 Stage 2 架构讨论:

1. 客户 demo 明确要查 `TOTAL_COST` / `GROSS_PROFIT` 的 forecast
2. 生产日志出现 >10 次/周 "暂不支持 X metric 的 forecast" 用户请求
3. 产品 PM 明确排期多 metric 预测需求

未触发则 Stage 2 永远不做 — YAGNI。

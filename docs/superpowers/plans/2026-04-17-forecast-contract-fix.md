# SmartBI Forecast 契约修复 — 实施计划 (方案 E)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 Java→Python forecast 契约不匹配,让销售预测功能从"生产空图"恢复正常(Stage 1 仅覆盖 `SALES_AMOUNT`)。

**Architecture:** Java Controller → 查已有 SQL GROUP BY(`findDailySalesTrend`)→ 组装 `List<Double>` → Python `/api/forecast/predict` 纯算 → 响应映射回 `ForecastResult`。Python 端 0 改动,Java 侧单 PR 约 50-80 行。

**Tech Stack:** Java 21 + Spring Boot 3.2.12 + Jackson + OkHttp / Lombok;测试 JUnit 5 + Mockito + MockWebServer。

**Spec:** `docs/superpowers/specs/2026-04-17-forecast-contract-fix-design.md`

**Agent Team Audit:** `.claude/agent-team-outputs/2026-04-17_smartbi-forecast-architecture-audit.md`

---

## File Structure

**新建**:
- `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/smartbi/PythonForecastResponse.java` — 匹配 Python `/api/forecast/predict` 返回结构的 Java DTO
- `backend/java/cretas-api/src/test/java/com/cretas/aims/service/smartbi/impl/ForecastServiceImplTest.java` — Service 单元测试
- `backend/java/cretas-api/src/test/java/com/cretas/aims/client/PythonSmartBIClientTest.java` — Client payload 格式测试

**修改**:
- `backend/java/cretas-api/src/main/java/com/cretas/aims/client/PythonSmartBIClient.java:303-369` — 删 `forecastSales`/`forecastMetric` 旧方法,加 `forecastWithData(List<Double>, int, String)`
- `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/ForecastServiceImpl.java:94-200,219-226,692-` — 重写 `forecastSalesWithPython`,改 `forecastMetricWithPython` 分流,删 `_legacyForecastWithAlgorithm` 及相关私有方法

**不动**:
- `backend/python/**` — 0 行改动
- `SmartBiSalesDataRepository.findDailySalesTrend` — 既有 SQL GROUP BY 直接复用
- Flyway migrations — 无 schema 改动

---

## Task 1: 新建 `PythonForecastResponse` DTO

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/smartbi/PythonForecastResponse.java`

**Why**: Python `/api/forecast/predict` 返回 `{success, algorithm, predictions[], lowerBound[], upperBound[], ...}`,Jackson 需要匹配的 Java DTO 反序列化。

- [ ] **Step 1: 创建 DTO 类**

Write file `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/smartbi/PythonForecastResponse.java`:

```java
package com.cretas.aims.dto.smartbi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Python /api/forecast/predict 响应 DTO
 *
 * 严格对应 backend/python/smartbi/api/forecast.py 中的 ForecastResponse (line 31-43)。
 * 由 PythonSmartBIClient.forecastWithData() 使用,经 ObjectMapper 反序列化。
 *
 * @since 2026-04-17 (方案 E hotfix)
 */
@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
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

- [ ] **Step 2: 编译检查**

Run:
```bash
cd backend/java/cretas-api && JAVA_HOME="C:/Program Files/Zulu/zulu-21" ./mvnw.cmd compile -q
```
Expected: 退出码 0,无新编译错误

- [ ] **Step 3: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/dto/smartbi/PythonForecastResponse.java
git commit -m "feat(forecast): add PythonForecastResponse DTO matching /api/forecast/predict"
```

---

## Task 2: `PythonSmartBIClient.forecastWithData` 新方法 + 测试

**Files:**
- Create: `backend/java/cretas-api/src/test/java/com/cretas/aims/client/PythonSmartBIClientTest.java`
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/client/PythonSmartBIClient.java` (加新方法,保留老方法待 Task 5 删)

- [ ] **Step 1: 写失败测试(payload 格式验证)**

Create `backend/java/cretas-api/src/test/java/com/cretas/aims/client/PythonSmartBIClientTest.java`:

```java
package com.cretas.aims.client;

import com.cretas.aims.config.smartbi.PythonSmartBIConfig;
import com.cretas.aims.dto.smartbi.PythonForecastResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class PythonSmartBIClientTest {

    private MockWebServer server;
    private PythonSmartBIClient client;
    private ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() throws Exception {
        server = new MockWebServer();
        server.start();
        PythonSmartBIConfig config = new PythonSmartBIConfig();
        config.setEnabled(true);
        config.setUrl(server.url("").toString().replaceAll("/$", ""));
        config.setForecastEndpoint("/api/forecast/predict");
        config.setMaxRetries(0);
        config.setTimeoutSeconds(5);
        client = new PythonSmartBIClient(config, mapper);
    }

    @AfterEach
    void tearDown() throws Exception {
        server.shutdown();
    }

    @Test
    void forecastWithData_sendsCorrectPayload() throws Exception {
        server.enqueue(new MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody("{\"success\":true,\"algorithm\":\"moving_average\",\"predictions\":[100.0,110.0,120.0],\"lowerBound\":[90.0,99.0,108.0],\"upperBound\":[110.0,121.0,132.0]}"));

        List<Double> data = List.of(50.0, 60.0, 70.0, 80.0, 90.0);
        PythonForecastResponse resp = client.forecastWithData(data, 3, "auto");

        // 验证 request payload
        RecordedRequest req = server.takeRequest();
        assertEquals("POST", req.getMethod());
        assertEquals("/api/forecast/predict", req.getPath());
        JsonNode body = mapper.readTree(req.getBody().readUtf8());
        assertEquals(5, body.get("data").size());
        assertEquals(50.0, body.get("data").get(0).asDouble());
        assertEquals(3, body.get("periods").asInt());
        assertEquals("auto", body.get("algorithm").asText());
        assertTrue(body.has("confidenceLevel"));

        // 验证 response 反序列化
        assertTrue(resp.isSuccess());
        assertEquals("moving_average", resp.getAlgorithm());
        assertEquals(3, resp.getPredictions().size());
        assertEquals(100.0, resp.getPredictions().get(0));
    }
}
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
cd backend/java/cretas-api && JAVA_HOME="C:/Program Files/Zulu/zulu-21" ./mvnw.cmd test -Dtest=PythonSmartBIClientTest -q
```
Expected: FAIL with `cannot find symbol: method forecastWithData` 或 `method forecastWithData not found`

- [ ] **Step 3: 在 `PythonSmartBIClient.java` 加 `forecastWithData` 方法**

Insert **after** line 369(即 `forecastMetric` 方法结束处),在 `// ==================== 通用请求执行 ====================` 之前:

```java
    /**
     * 方案 E (2026-04-17):Java 查历史数据后调用 Python 纯算端点。
     *
     * Python /api/forecast/predict 的 pydantic 契约要求 data 字段为 List[float],min_items=3.
     * 调用方应在 Java 侧通过 Repository SQL GROUP BY 组装 data 后再调。
     *
     * @param data       历史数据序列 (至少 3 个点,调用方预检)
     * @param periods    预测期数
     * @param algorithm  算法名 (小写,如 "auto"/"moving_average"/"linear_trend"/"exponential_smoothing")
     * @return Python 原始响应结构
     * @throws IOException 网络失败或 Python 返回非 2xx
     */
    public PythonForecastResponse forecastWithData(List<Double> data, int periods, String algorithm) throws IOException {
        log.info("调用 Python forecast (方案 E): dataPoints={}, periods={}, algorithm={}",
                data.size(), periods, algorithm);

        Map<String, Object> requestBody = new java.util.HashMap<>();
        requestBody.put("data", data);
        requestBody.put("algorithm", algorithm != null ? algorithm : "auto");
        requestBody.put("periods", periods);
        requestBody.put("confidenceLevel", 0.95);

        Request request = new Request.Builder()
                .url(config.getForecastUrl())
                .post(RequestBody.create(JSON, objectMapper.writeValueAsString(requestBody)))
                .build();

        return executeWithRetry(request, PythonForecastResponse.class);
    }
```

然后在文件顶部 import 区确认有:
```java
import com.cretas.aims.dto.smartbi.PythonForecastResponse;
```
(如果没有则加)

- [ ] **Step 4: 运行测试验证通过**

Run:
```bash
cd backend/java/cretas-api && JAVA_HOME="C:/Program Files/Zulu/zulu-21" ./mvnw.cmd test -Dtest=PythonSmartBIClientTest -q
```
Expected: `Tests run: 1, Failures: 0, Errors: 0`

- [ ] **Step 5: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/client/PythonSmartBIClient.java \
        backend/java/cretas-api/src/test/java/com/cretas/aims/client/PythonSmartBIClientTest.java
git commit -m "feat(forecast): add PythonSmartBIClient.forecastWithData (方案 E)"
```

---

## Task 3: 重写 `ForecastServiceImpl.forecastSalesWithPython` + 测试

**Files:**
- Create: `backend/java/cretas-api/src/test/java/com/cretas/aims/service/smartbi/impl/ForecastServiceImplTest.java`
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/ForecastServiceImpl.java:94-133`

- [ ] **Step 1: 写 Service 单元测试(4 个 case)**

Create `backend/java/cretas-api/src/test/java/com/cretas/aims/service/smartbi/impl/ForecastServiceImplTest.java`:

```java
package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.client.PythonSmartBIClient;
import com.cretas.aims.config.smartbi.PythonSmartBIConfig;
import com.cretas.aims.dto.smartbi.ForecastPoint;
import com.cretas.aims.dto.smartbi.ForecastResult;
import com.cretas.aims.dto.smartbi.PythonForecastResponse;
import com.cretas.aims.repository.smartbi.SmartBiSalesDataRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ForecastServiceImplTest {

    @Mock private SmartBiSalesDataRepository salesDataRepository;
    @Mock private PythonSmartBIClient pythonClient;
    @Mock private PythonSmartBIConfig pythonConfig;

    @InjectMocks
    private ForecastServiceImpl service;

    @BeforeEach
    void setUp() {
        lenient().when(pythonConfig.isEnabled()).thenReturn(true);
        lenient().when(pythonClient.isAvailable()).thenReturn(true);
    }

    @Test
    void forecastSales_emptyTrend_returnsEmptyWithoutCallingPython() throws IOException {
        when(salesDataRepository.findDailySalesTrend(anyString(), any(), any()))
                .thenReturn(List.of());

        ForecastResult result = service.forecastSales("F001",
                LocalDate.of(2025, 2, 1), LocalDate.of(2025, 2, 28), 7);

        assertNotNull(result);
        assertTrue(result.getForecastPoints() == null || result.getForecastPoints().isEmpty());
        verify(pythonClient, never()).forecastWithData(any(), anyInt(), anyString());
    }

    @Test
    void forecastSales_fewerThan3Points_returnsEmptyWithoutCallingPython() throws IOException {
        List<Object[]> trend = List.of(
                new Object[]{LocalDate.of(2025, 2, 1), new BigDecimal("100.00"), new BigDecimal("10")},
                new Object[]{LocalDate.of(2025, 2, 2), new BigDecimal("120.00"), new BigDecimal("12")}
        );
        when(salesDataRepository.findDailySalesTrend(anyString(), any(), any())).thenReturn(trend);

        ForecastResult result = service.forecastSales("F001",
                LocalDate.of(2025, 2, 1), LocalDate.of(2025, 2, 2), 7);

        assertTrue(result.getForecastPoints() == null || result.getForecastPoints().isEmpty());
        verify(pythonClient, never()).forecastWithData(any(), anyInt(), anyString());
    }

    @Test
    void forecastSales_happyPath_mapsResponseToForecastPoints() throws IOException {
        LocalDate start = LocalDate.of(2025, 2, 1);
        LocalDate end = LocalDate.of(2025, 2, 28);

        // 30 天历史 (足够 >= 3)
        List<Object[]> trend = java.util.stream.IntStream.range(0, 28)
                .<Object[]>mapToObj(i -> new Object[]{
                        start.plusDays(i),
                        new BigDecimal("100.0").add(new BigDecimal(i)),
                        new BigDecimal("10")
                })
                .toList();
        when(salesDataRepository.findDailySalesTrend(anyString(), any(), any())).thenReturn(trend);

        PythonForecastResponse mockResp = new PythonForecastResponse();
        mockResp.setSuccess(true);
        mockResp.setAlgorithm("moving_average");
        mockResp.setPredictions(List.of(130.0, 131.0, 132.0));
        mockResp.setLowerBound(List.of(120.0, 121.0, 122.0));
        mockResp.setUpperBound(List.of(140.0, 141.0, 142.0));
        when(pythonClient.forecastWithData(anyList(), eq(3), anyString())).thenReturn(mockResp);

        ForecastResult result = service.forecastSales("F001", start, end, 3);

        assertNotNull(result.getForecastPoints());
        assertEquals(3, result.getForecastPoints().size());
        // 起点 = endDate + 1
        ForecastPoint p0 = result.getForecastPoints().get(0);
        assertEquals(LocalDate.of(2025, 3, 1), p0.getDate());
        assertEquals(0, p0.getValue().compareTo(new BigDecimal("130.00")));
        assertEquals(0, p0.getLowerBound().compareTo(new BigDecimal("120.00")));
        assertEquals(0, p0.getUpperBound().compareTo(new BigDecimal("140.00")));
        // 日期连续递增
        assertEquals(LocalDate.of(2025, 3, 2), result.getForecastPoints().get(1).getDate());
        assertEquals(LocalDate.of(2025, 3, 3), result.getForecastPoints().get(2).getDate());
    }

    @Test
    void forecastSales_pythonIOException_returnsEmptyNotThrows() throws IOException {
        List<Object[]> trend = java.util.stream.IntStream.range(0, 5)
                .<Object[]>mapToObj(i -> new Object[]{
                        LocalDate.of(2025, 2, 1).plusDays(i),
                        new BigDecimal("100.00"),
                        new BigDecimal("10")
                })
                .toList();
        when(salesDataRepository.findDailySalesTrend(anyString(), any(), any())).thenReturn(trend);
        when(pythonClient.forecastWithData(anyList(), anyInt(), anyString()))
                .thenThrow(new IOException("simulated network failure"));

        ForecastResult result = service.forecastSales("F001",
                LocalDate.of(2025, 2, 1), LocalDate.of(2025, 2, 5), 3);

        assertTrue(result.getForecastPoints() == null || result.getForecastPoints().isEmpty());
    }
}
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
cd backend/java/cretas-api && JAVA_HOME="C:/Program Files/Zulu/zulu-21" ./mvnw.cmd test -Dtest=ForecastServiceImplTest -q
```
Expected: 4 个测试中至少 2 个 FAIL — happy_path 会因日期映射错误或 pythonClient 调用方式错误而失败,empty 测试可能伪通过(取决于具体实现)。核心是 happy_path 失败。

- [ ] **Step 3: 重写 `forecastSalesWithPython` 方法**

在 `ForecastServiceImpl.java` 替换第 **94-133 行**(即整个 `forecastSalesWithPython` 方法):

```java
    private ForecastResult forecastSalesWithPython(String factoryId, LocalDate startDate,
                                                    LocalDate endDate, int forecastDays) {
        if (!pythonConfig.isEnabled()) {
            throw new RuntimeException("Python SmartBI 服务未启用。预测功能完全依赖 Python 服务 (端口 8083)。");
        }
        if (!pythonClient.isAvailable()) {
            throw new RuntimeException("Python SmartBI 服务不可用。请检查服务是否在 " + pythonConfig.getUrl() + " 运行。");
        }

        // 方案 E (2026-04-17):Java 查历史 + Python 纯算
        List<Object[]> trend = salesDataRepository.findDailySalesTrend(factoryId, startDate, endDate);
        if (trend.size() < 3) {
            log.warn("销售历史数据不足 3 天, 无法预测: factoryId={}, 数据点={}", factoryId, trend.size());
            return buildEmptyForecastResult(MetricCalculatorService.SALES_AMOUNT, ForecastAlgorithm.AUTO, startDate, endDate);
        }

        // 提取 amount 列 (row[1] = SUM(amount)) 为 List<Double>
        List<Double> data = trend.stream()
                .map(row -> ((BigDecimal) row[1]).doubleValue())
                .collect(Collectors.toList());

        log.info("Python forecast 调用: factoryId={}, dataPoints={}, periods={}",
                factoryId, data.size(), forecastDays);
        try {
            PythonForecastResponse resp = pythonClient.forecastWithData(data, forecastDays, "auto");
            if (resp == null || !resp.isSuccess() || resp.getPredictions() == null || resp.getPredictions().isEmpty()) {
                log.warn("Python forecast 返回空/失败: success={}, error={}",
                        resp != null && resp.isSuccess(),
                        resp != null ? resp.getError() : "null response");
                return buildEmptyForecastResult(MetricCalculatorService.SALES_AMOUNT, ForecastAlgorithm.AUTO, startDate, endDate);
            }
            return buildForecastResultFromPython(resp, MetricCalculatorService.SALES_AMOUNT, startDate, endDate);
        } catch (java.io.IOException e) {
            log.warn("Python forecast IO 失败: factoryId={}, msg={}", factoryId, e.getMessage());
            return buildEmptyForecastResult(MetricCalculatorService.SALES_AMOUNT, ForecastAlgorithm.AUTO, startDate, endDate);
        }
    }
```

- [ ] **Step 4: 新增 `buildForecastResultFromPython` helper 方法**

在 `ForecastServiceImpl.java` 的 `buildEmptyForecastResult` 方法**前**(约第 688 行前)插入:

```java
    /**
     * 把 Python /api/forecast/predict 的响应映射为 Java ForecastResult.
     * 预测日期起点 = endDate + 1 天, 逐日递增.
     *
     * @since 2026-04-17 (方案 E)
     */
    private ForecastResult buildForecastResultFromPython(PythonForecastResponse resp,
                                                          String metricType,
                                                          LocalDate startDate,
                                                          LocalDate endDate) {
        List<Double> preds = resp.getPredictions();
        List<Double> lower = resp.getLowerBound() != null ? resp.getLowerBound() : preds;
        List<Double> upper = resp.getUpperBound() != null ? resp.getUpperBound() : preds;

        List<ForecastPoint> points = new java.util.ArrayList<>(preds.size());
        for (int i = 0; i < preds.size(); i++) {
            LocalDate date = endDate.plusDays((long) i + 1);
            BigDecimal value = BigDecimal.valueOf(preds.get(i)).setScale(2, RoundingMode.HALF_UP);
            BigDecimal lo = BigDecimal.valueOf(i < lower.size() ? lower.get(i) : preds.get(i)).setScale(2, RoundingMode.HALF_UP);
            BigDecimal up = BigDecimal.valueOf(i < upper.size() ? upper.get(i) : preds.get(i)).setScale(2, RoundingMode.HALF_UP);
            points.add(ForecastPoint.of(date, value, lo, up));
        }

        ForecastAlgorithm algo = mapPythonAlgorithm(resp.getAlgorithm());
        String period = String.format("%s 至 %s",
                startDate.format(DateTimeFormatter.ISO_LOCAL_DATE),
                endDate.format(DateTimeFormatter.ISO_LOCAL_DATE));

        return ForecastResult.builder()
                .forecastPoints(points)
                .algorithm(algo)
                .confidence(new BigDecimal("95.00"))
                .metricType(metricType)
                .periodDescription(period)
                .historicalPointCount(resp.getInputLength() != null ? resp.getInputLength() : 0)
                .forecastPointCount(points.size())
                .generatedAt(LocalDateTime.now())
                .trend(computeTrend(points))
                .growthRate(BigDecimal.ZERO)
                .build();
    }

    /**
     * Python 算法名 (小写下划线) → Java enum.
     */
    private ForecastAlgorithm mapPythonAlgorithm(String pythonName) {
        if (pythonName == null) return ForecastAlgorithm.AUTO;
        switch (pythonName.toLowerCase()) {
            case "moving_average": return ForecastAlgorithm.MOVING_AVERAGE;
            case "linear_trend": return ForecastAlgorithm.LINEAR_TREND;
            case "exponential_smoothing": return ForecastAlgorithm.EXPONENTIAL_SMOOTHING;
            default: return ForecastAlgorithm.AUTO;
        }
    }

    /**
     * 根据预测首尾点判断趋势.
     */
    private String computeTrend(List<ForecastPoint> points) {
        if (points.size() < 2) return "STABLE";
        BigDecimal first = points.get(0).getValue();
        BigDecimal last = points.get(points.size() - 1).getValue();
        int cmp = last.compareTo(first);
        if (cmp > 0) return "UP";
        if (cmp < 0) return "DOWN";
        return "STABLE";
    }
```

确保文件顶部 import 包含:
```java
import com.cretas.aims.dto.smartbi.PythonForecastResponse;
import java.time.LocalDateTime;
```

- [ ] **Step 5: 运行测试验证通过**

Run:
```bash
cd backend/java/cretas-api && JAVA_HOME="C:/Program Files/Zulu/zulu-21" ./mvnw.cmd test -Dtest=ForecastServiceImplTest -q
```
Expected: `Tests run: 4, Failures: 0, Errors: 0`

- [ ] **Step 6: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/ForecastServiceImpl.java \
        backend/java/cretas-api/src/test/java/com/cretas/aims/service/smartbi/impl/ForecastServiceImplTest.java
git commit -m "feat(forecast): rewrite forecastSalesWithPython with Java-fetches-data (方案 E)"
```

---

## Task 4: `forecastMetricWithPython` 分流 — SALES_AMOUNT 走新路径,其他返 empty+WARN

**Files:**
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/ForecastServiceImpl.java:154-200`

- [ ] **Step 1: 加测试 case**

Append to `ForecastServiceImplTest.java`(在 class 结束 `}` 前):

```java
    @Test
    void forecastMetric_salesAmountType_delegatesToForecastSales() throws IOException {
        List<Object[]> trend = java.util.stream.IntStream.range(0, 5)
                .<Object[]>mapToObj(i -> new Object[]{
                        LocalDate.of(2025, 2, 1).plusDays(i),
                        new BigDecimal("100.00"),
                        new BigDecimal("10")
                })
                .toList();
        when(salesDataRepository.findDailySalesTrend(anyString(), any(), any())).thenReturn(trend);

        PythonForecastResponse mockResp = new PythonForecastResponse();
        mockResp.setSuccess(true);
        mockResp.setAlgorithm("auto");
        mockResp.setPredictions(List.of(110.0, 120.0, 130.0));
        mockResp.setLowerBound(List.of(100.0, 110.0, 120.0));
        mockResp.setUpperBound(List.of(120.0, 130.0, 140.0));
        when(pythonClient.forecastWithData(anyList(), eq(3), anyString())).thenReturn(mockResp);

        ForecastResult r = service.forecastMetric("F001", "SALES_AMOUNT",
                LocalDate.of(2025, 2, 1), LocalDate.of(2025, 2, 5), 3);

        assertEquals(3, r.getForecastPoints().size());
    }

    @Test
    void forecastMetric_unsupportedMetric_returnsEmptyWithoutCallingPython() throws IOException {
        ForecastResult r = service.forecastMetric("F001", "TOTAL_COST",
                LocalDate.of(2025, 2, 1), LocalDate.of(2025, 2, 28), 7);

        assertNotNull(r);
        assertTrue(r.getForecastPoints() == null || r.getForecastPoints().isEmpty());
        verify(pythonClient, never()).forecastWithData(any(), anyInt(), anyString());
        verify(salesDataRepository, never()).findDailySalesTrend(anyString(), any(), any());
    }
```

- [ ] **Step 2: 运行测试验证 `forecastMetric_unsupportedMetric` 失败**

Run:
```bash
cd backend/java/cretas-api && JAVA_HOME="C:/Program Files/Zulu/zulu-21" ./mvnw.cmd test -Dtest=ForecastServiceImplTest -q
```
Expected: `forecastMetric_unsupportedMetric` FAIL(现在会调 Python 且 Python 返回不确定)

- [ ] **Step 3: 重写 `forecastMetricWithPython` 为分流**

替换 `ForecastServiceImpl.java` 第 **154-200 行**(整个 `forecastMetricWithPython` 方法):

```java
    private ForecastResult forecastMetricWithPython(String factoryId, String metricType,
                                                     LocalDate startDate, LocalDate endDate,
                                                     int forecastDays, String algorithm) {
        // 方案 E Stage 1:只有 SALES_AMOUNT 有配套 SQL GROUP BY. 其他 metric 返 empty + WARN.
        // Stage 2 延后 — 需 Repository 层为 finance/cost 等 metric 建日聚合后再开通.
        if (MetricCalculatorService.SALES_AMOUNT.equals(metricType)) {
            return forecastSalesWithPython(factoryId, startDate, endDate, forecastDays);
        }

        log.warn("暂不支持该 metric 的预测: metricType={} (Stage 2 需建对应日聚合 query)", metricType);
        ForecastAlgorithm alg;
        try {
            alg = algorithm != null ? ForecastAlgorithm.valueOf(algorithm) : ForecastAlgorithm.AUTO;
        } catch (IllegalArgumentException ex) {
            alg = ForecastAlgorithm.AUTO;
        }
        return buildEmptyForecastResult(metricType, alg, startDate, endDate);
    }
```

- [ ] **Step 4: 运行测试验证通过**

Run:
```bash
cd backend/java/cretas-api && JAVA_HOME="C:/Program Files/Zulu/zulu-21" ./mvnw.cmd test -Dtest=ForecastServiceImplTest -q
```
Expected: `Tests run: 6, Failures: 0, Errors: 0`

- [ ] **Step 5: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/ForecastServiceImpl.java \
        backend/java/cretas-api/src/test/java/com/cretas/aims/service/smartbi/impl/ForecastServiceImplTest.java
git commit -m "feat(forecast): forecastMetric 分流 — Stage 1 only SALES_AMOUNT"
```

---

## Task 5: 删除 `PythonSmartBIClient` 旧方法 `forecastSales`/`forecastMetric`

**Files:**
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/client/PythonSmartBIClient.java:303-369`

**Why**: Task 3/4 完成后 `ForecastServiceImpl` 不再调这两个旧方法。留着是未调用代码,删干净。

- [ ] **Step 1: 确认无其他 caller**

Run:
```bash
grep -rn "pythonClient\.forecastSales\|pythonClient\.forecastMetric\|\.forecastSales(\s*factoryId\|\.forecastMetric(\s*factoryId" backend/java/cretas-api/src/main/java --include="*.java"
```
Expected: 无匹配(或只匹配自己旧定义)。如有其他 caller(如 Controller 直接调 client)则停下手动处理。

- [ ] **Step 2: 删除第 303-369 行的两个旧方法**

在 `PythonSmartBIClient.java` 中删除从 `// ==================== 预测分析 ====================` 起到 `forecastMetric` 方法结束的整段(含 2 个方法 + 1 个 section 注释)。**保留** `forecastWithData` (Task 2 已加在此段之后)。

- [ ] **Step 3: 编译检查**

Run:
```bash
cd backend/java/cretas-api && JAVA_HOME="C:/Program Files/Zulu/zulu-21" ./mvnw.cmd compile -q
```
Expected: 退出码 0,无未使用 import 警告

- [ ] **Step 4: 全量单测确认不回归**

Run:
```bash
cd backend/java/cretas-api && JAVA_HOME="C:/Program Files/Zulu/zulu-21" ./mvnw.cmd test -Dtest="PythonSmartBIClientTest,ForecastServiceImplTest" -q
```
Expected: `Tests run: 7, Failures: 0`

- [ ] **Step 5: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/client/PythonSmartBIClient.java
git commit -m "chore(forecast): delete unused forecastSales/forecastMetric client methods"
```

---

## Task 6: 删除 `_legacyForecastWithAlgorithm` 死代码

**Files:**
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/ForecastServiceImpl.java` (约第 230-680 行大段)

**Why**: `@SuppressWarnings("unused")` 已自证未使用。该方法及其依赖的 `getHistoricalData`、`calculateMovingAverage`、`calculateLinearTrend`、`calculateExponentialSmoothing`、`selectBestAlgorithm` 等 Java 统计方法全是 dead code — 方案 E 完全走 Python 纯算。

- [ ] **Step 1: 列出 `_legacyForecastWithAlgorithm` 的依赖私有方法**

Run:
```bash
grep -n "private " backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/ForecastServiceImpl.java | head -30
```

记下起始于 `_legacyForecastWithAlgorithm` 以下的所有 private 方法(通常包括 `getHistoricalData`、`calculateMovingAverage`、`calculateLinearTrend`、`calculateExponentialSmoothing`、`selectBestAlgorithm`、`calculateStandardDeviation`、`buildForecastResultLegacy` 等)。

- [ ] **Step 2: 全局 grep 确认无其他活 caller**

Run:
```bash
grep -n "_legacyForecastWithAlgorithm\|getHistoricalData\|calculateMovingAverage\|calculateLinearTrend\|calculateExponentialSmoothing\|selectBestAlgorithm" backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/ForecastServiceImpl.java
```
Expected: 所有匹配都在 `_legacyForecastWithAlgorithm` 方法内部彼此调用,无外部调用。(`buildEmptyForecastResult` 仍活着,保留)

- [ ] **Step 3: 删除 `_legacyForecastWithAlgorithm` 及其私有辅助方法**

在 `ForecastServiceImpl.java` 删除:
- `_legacyForecastWithAlgorithm` 整个方法
- 仅被它调用的私有方法(按 Step 1/2 列表)

**保留** `buildEmptyForecastResult` 和 `buildForecastResultFromPython`(Task 3 新增)+ `mapPythonAlgorithm` + `computeTrend`。

- [ ] **Step 4: 清理未使用的 imports**

编译一次让 IDE/编译器标出未使用 import:
```bash
cd backend/java/cretas-api && JAVA_HOME="C:/Program Files/Zulu/zulu-21" ./mvnw.cmd compile -q 2>&1 | grep -i "never used\|不使用"
```

如果有提示(如 `SmartBiSalesData`、`DateTimeFormatter` 已不用),手动删对应 import。

- [ ] **Step 5: 全量回归**

Run:
```bash
cd backend/java/cretas-api && JAVA_HOME="C:/Program Files/Zulu/zulu-21" ./mvnw.cmd test -Dtest="ForecastServiceImplTest,PythonSmartBIClientTest" -q
```
Expected: `Tests run: 7, Failures: 0`

- [ ] **Step 6: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/ForecastServiceImpl.java
git commit -m "chore(forecast): delete _legacyForecastWithAlgorithm dead code"
```

---

## Task 7: 打包 + 部署 test 环境

**Why**: 按 `.claude/rules/server-operations.md` 的"⛔ 强制工作流":重大改动(service+client 重写)必须 test 先验证再 prod。

- [ ] **Step 1: 打包 fat jar**

Run:
```bash
cd backend/java/cretas-api && MAVEN_OPTS="-Xmx768m -XX:+UseSerialGC -XX:ReservedCodeCacheSize=128m" JAVA_HOME="C:/Program Files/Zulu/zulu-21" ./mvnw.cmd clean package -Dmaven.test.skip=true -q
```
Expected: 生成 `target/cretas-backend-system-1.0.0.jar` ~158 MB

- [ ] **Step 2: 记录 jar md5**

Run:
```bash
md5sum backend/java/cretas-api/target/cretas-backend-system-1.0.0.jar
```
Expected: 打印 hash(记录,Step 4 验证部署 jar 是否一致)

- [ ] **Step 3: push branch**

Run:
```bash
git push origin e2e/v1-framework 2>&1 | tail -3
```
Expected: `<old-sha>..<new-sha> e2e/v1-framework -> e2e/v1-framework`

- [ ] **Step 4: 部署 test**

Run:
```bash
SKIP_BUILD=1 ./scripts/deploy/deploy-backend.sh --env test 2>&1 | tail -20
```
Expected:
- `✓ MD5 验证通过`(MD5 与 Step 2 一致)
- `✅ 部署完成!`
- `防御检查] prod 同步运行 (via nginx)`

(若健康检查 180s 超时但"部署完成"显示,属于 test JVM warm-up 时间 ~90s,可接受)

- [ ] **Step 5: 等 test warm 后验证 fix 上线**

Run(约部署完 2 分钟后):
```bash
ssh root@47.100.235.168 "curl -s -o /dev/null -w 'test: %{http_code}\n' --max-time 5 http://localhost:10011/api/mobile/health; echo 'jar md5:'; md5sum /www/wwwroot/cretas/aims-0.0.1-SNAPSHOT.jar; echo '新 class 已上?'; unzip -p /www/wwwroot/cretas/aims-0.0.1-SNAPSHOT.jar BOOT-INF/classes/com/cretas/aims/dto/smartbi/PythonForecastResponse.class 2>/dev/null | wc -c"
```
Expected:
- test: 200
- jar md5 与 Step 2 一致
- PythonForecastResponse.class 大小 > 0

---

## Task 8: Smoke test 验证 forecast 恢复

- [ ] **Step 1: 调 forecast endpoint**

查 test 环境有 sales 数据的 factoryId 和可用日期段(项目 memory 提到 F001 有 sales):

```bash
ssh root@47.100.235.168 "source /www/wwwroot/cretas/.env.prod; PGPASSWORD=\$DB_PASSWORD psql -h 127.0.0.1 -U cretas_user -d cretas_db -c \"SELECT factory_id, MIN(order_date), MAX(order_date), COUNT(*) FROM smart_bi_sales_data GROUP BY factory_id ORDER BY factory_id LIMIT 10;\""
```

选一个有 >= 3 天数据的 factory_id 和日期段,用于 smoke。

- [ ] **Step 2: 直接调 Python `/api/forecast/predict` 自检契约**

Run:
```bash
ssh root@47.100.235.168 "curl -s -X POST http://localhost:8084/api/forecast/predict -H 'Content-Type: application/json' -d '{\"data\":[100.0,110.0,120.0,130.0,140.0],\"algorithm\":\"auto\",\"periods\":3,\"confidenceLevel\":0.95}' | head -c 400"
```
Expected: `{"success":true,"algorithm":"...","predictions":[...], ...}`。无 422 / field required。

- [ ] **Step 3: 观察 M1/M3 monitor 5 分钟**

不主动调 — 让 user 在 UI 触发一次预测,观察:
- **M1 Java prod errors**:不应再出现"契约不匹配 (Java 未传 data 历史序列)"
- **M3 Java test errors**:同上

若 5 分钟内没看到触发,可手动调 Java 端点(需 login + factoryId + 日期参数,因为 auth 复杂,暂以 M1/M3 静默为准):
```bash
ssh root@47.100.235.168 "tail -100 /www/wwwroot/cretas/cretas-test.log | grep -E 'forecast|Python forecast'"
```

- [ ] **Step 4: 确认 test 端部署成功后,请用户决定是否 prod**

向用户报告:
```
Test env 已部,forecast 契约修复已验证(Python 契约自检 200 OK,M1/M3 无 422 相关错误)。
按 test-first hard rule,请确认是否继续 prod(blue-green)?
```

---

## Task 9: 部署 prod(用户确认后才做)

**⚠️ 只在用户明确说"部 prod"后执行,不自动推进**。

- [ ] **Step 1: Blue-green 部署**

Run:
```bash
SKIP_BUILD=1 ./scripts/deploy/deploy-backend.sh --env prod --mode bluegreen 2>&1 | tail -20
```
Expected:
- `✓ MD5 验证通过`
- `Blue-Green 切换完成`
- `✓ 生产服务正常 (HTTP 200 via nginx)`

- [ ] **Step 2: 观察 prod 5 分钟**

Run:
```bash
ssh root@47.100.235.168 "for p in 10010 10020 10011 8083 8084; do pa=\$([ \$p -lt 9000 ] && echo '/health' || echo '/api/mobile/health'); c=\$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:\$p\$pa 2>/dev/null); echo \"\$p: \$c\"; done; echo; journalctl -u cretas-backend -u cretas-backend-green --since '5 min ago' --no-pager | grep -iE '契约不匹配|ERROR.*forecast' | tail -10 || echo '无 forecast 相关 ERROR'"
```
Expected: 5 服务 HTTP 200 + 无 "契约不匹配" + 无 forecast ERROR

- [ ] **Step 3: 完成**

向用户报告 commit hash、部署耗时、5 服务状态。建议存 memory `project_forecast_fix_apr17.md` 记录本次 fix 全程(可选)。

---

## Out of Scope(明确不做)

- **Stage 2**:其他 39 个 metric(`TOTAL_COST`/`GROSS_PROFIT`/`ORDER_COUNT`/...)的 forecast 支持 — 返 empty+WARN
- **`MetricCalculatorService.calculateDailySeries`** 新接口 — 不建
- **finance 表日聚合 `GROUP BY recordDate`** — 不做
- **Python 代码改动** — 0 行
- **算法切换 UI** — 保留 `algorithm="auto"`
- **Response accuracy 校验** — Python 侧单测保证,Java 不重复

## Rollback

若 prod 出问题:
1. `git revert HEAD~N..HEAD`(N = 本次全部 commit 数)
2. 重新打包 + `--env prod --mode bluegreen` 部回前一版 jar
3. 备份在 `/www/wwwroot/cretas/aims-0.0.1-SNAPSHOT.jar.bak.*`,deploy 脚本可 `--rollback` 自动恢复

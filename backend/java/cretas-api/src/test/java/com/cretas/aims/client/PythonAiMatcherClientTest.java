package com.cretas.aims.client;

import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.dto.intent.PythonIntentMatchRequest;
import com.cretas.aims.dto.intent.PythonIntentMatchResponse;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Phase 2B-α task T18 unit tests for {@link PythonAiMatcherClient}.
 *
 * <p>Covers three slices:
 * <ul>
 *   <li>{@code matchSendsCorrectHeadersAndBody} — POST hits the right URL,
 *       carries the X-Internal-Secret + X-Factory-Id headers, and returns
 *       the unwrapped {@link IntentMatchResult} from the success envelope.</li>
 *   <li>{@code matchFallbackReturnsEmptyResult} — Resilience4j fallback path
 *       maps any throwable to {@link IntentMatchResult#empty(String)} so
 *       upstream Java callers never see a null.</li>
 *   <li>{@code matchThrowsWhenResponseSuccessFalse} — Python returning a
 *       success=false envelope (HTTP 2xx but business error) is treated as
 *       a hard failure that the CircuitBreaker can record.</li>
 * </ul>
 */
class PythonAiMatcherClientTest {

    private RestTemplate restTemplate;
    private PythonAiMatcherClient client;

    @BeforeEach
    void setup() {
        restTemplate = mock(RestTemplate.class);
        client = new PythonAiMatcherClient(
                restTemplate,
                "http://localhost:8083",
                "test-secret"
        );
    }

    @Test
    void matchSendsCorrectHeadersAndBody() {
        PythonIntentMatchResponse fake = new PythonIntentMatchResponse();
        fake.setSuccess(true);
        fake.setData(IntentMatchResult.empty("test"));
        fake.setMessage("OK");

        when(restTemplate.exchange(
                eq("http://localhost:8083/api/ai/intent/match"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(PythonIntentMatchResponse.class)
        )).thenReturn(ResponseEntity.ok(fake));

        PythonIntentMatchRequest req = PythonIntentMatchRequest.builder()
                .query("test")
                .factoryId("F001")
                .userId("22")
                .username("admin")
                .role("factory_super_admin")
                .businessType("FACTORY")
                .build();

        IntentMatchResult result = client.match(req);

        assertNotNull(result);
        verify(restTemplate).exchange(
                eq("http://localhost:8083/api/ai/intent/match"),
                eq(HttpMethod.POST),
                argThat(entity -> {
                    HttpEntity<?> e = (HttpEntity<?>) entity;
                    return "test-secret".equals(e.getHeaders().getFirst("X-Internal-Secret"))
                            && "F001".equals(e.getHeaders().getFirst("X-Factory-Id"));
                }),
                eq(PythonIntentMatchResponse.class)
        );
    }

    @Test
    void matchFallbackReturnsEmptyResult() {
        PythonIntentMatchRequest req = PythonIntentMatchRequest.builder()
                .query("test")
                .factoryId("F001")
                .userId("22")
                .username("admin")
                .role("factory_super_admin")
                .businessType("FACTORY")
                .build();

        IntentMatchResult result = client.matchFallback(req, new RuntimeException("python down"));
        assertNotNull(result);
        assertNull(result.getBestMatch());
        assertEquals(IntentMatchResult.MatchMethod.NONE, result.getMatchMethod());
        assertEquals("test", result.getUserInput());
    }

    @Test
    void matchThrowsWhenResponseSuccessFalse() {
        PythonIntentMatchResponse errResp = new PythonIntentMatchResponse();
        errResp.setSuccess(false);
        errResp.setData(null);
        errResp.setMessage("err");
        errResp.setCode("INTERNAL_ERROR");

        when(restTemplate.exchange(anyString(), any(HttpMethod.class),
                any(HttpEntity.class), eq(PythonIntentMatchResponse.class)))
                .thenReturn(ResponseEntity.ok(errResp));

        PythonIntentMatchRequest req = PythonIntentMatchRequest.builder()
                .query("x").factoryId("F001").userId("u").username("u")
                .role("r").businessType("FACTORY").build();

        assertThrows(RuntimeException.class, () -> client.match(req));
    }

    /**
     * Phase 2B (issue #29 §6): success/fallback counters increment on each
     * call path, and the derived {@code python.ai.matcher.fallback.rate}
     * gauge equals {@code fallback / (success + fallback + error)}.
     */
    @Test
    void metricsEmitSuccessFallbackAndGauge() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        ReflectionTestUtils.setField(client, "meterRegistry", registry);
        client.initMetrics();

        PythonIntentMatchResponse fake = new PythonIntentMatchResponse();
        fake.setSuccess(true);
        fake.setData(IntentMatchResult.empty("test"));

        when(restTemplate.exchange(anyString(), any(HttpMethod.class),
                any(HttpEntity.class), eq(PythonIntentMatchResponse.class)))
                .thenReturn(ResponseEntity.ok(fake));

        PythonIntentMatchRequest req = PythonIntentMatchRequest.builder()
                .query("test").factoryId("F001").userId("22").username("admin")
                .role("factory_super_admin").businessType("FACTORY").build();

        // 3 successes via match(), 1 fallback via matchFallback() → fallback_rate = 0.25
        client.match(req);
        client.match(req);
        client.match(req);
        client.matchFallback(req, new RuntimeException("python down"));

        assertEquals(3.0, registry.counter(PythonAiMatcherClient.METRIC_CALLS,
                PythonAiMatcherClient.TAG_RESULT, PythonAiMatcherClient.RESULT_SUCCESS).count());
        assertEquals(1.0, registry.counter(PythonAiMatcherClient.METRIC_CALLS,
                PythonAiMatcherClient.TAG_RESULT, PythonAiMatcherClient.RESULT_FALLBACK).count());
        assertEquals(0.0, registry.counter(PythonAiMatcherClient.METRIC_CALLS,
                PythonAiMatcherClient.TAG_RESULT, PythonAiMatcherClient.RESULT_ERROR).count());

        Gauge fallbackRate = registry.find(PythonAiMatcherClient.METRIC_FALLBACK_RATE).gauge();
        assertNotNull(fallbackRate);
        assertEquals(0.25, fallbackRate.value(), 1e-9);
    }

    /**
     * Phase 2B: gauge returns 0.0 (not NaN) before any call so the metric
     * series is safe to scrape from boot.
     */
    @Test
    void metricsFallbackRateZeroWhenNoCalls() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        ReflectionTestUtils.setField(client, "meterRegistry", registry);
        client.initMetrics();

        Gauge fallbackRate = registry.find(PythonAiMatcherClient.METRIC_FALLBACK_RATE).gauge();
        assertNotNull(fallbackRate);
        assertEquals(0.0, fallbackRate.value(), 1e-9);
    }

    /**
     * Phase 2B: without a MeterRegistry the matcher remains fully functional —
     * existing behavior is preserved for any unit test path that doesn't
     * exercise metrics.
     */
    @Test
    void matchAndFallbackWorkWithoutRegistry() {
        PythonIntentMatchResponse fake = new PythonIntentMatchResponse();
        fake.setSuccess(true);
        fake.setData(IntentMatchResult.empty("test"));
        when(restTemplate.exchange(anyString(), any(HttpMethod.class),
                any(HttpEntity.class), eq(PythonIntentMatchResponse.class)))
                .thenReturn(ResponseEntity.ok(fake));

        PythonIntentMatchRequest req = PythonIntentMatchRequest.builder()
                .query("test").factoryId("F001").userId("22").username("admin")
                .role("factory_super_admin").businessType("FACTORY").build();

        assertNotNull(client.match(req));
        assertNotNull(client.matchFallback(req, new RuntimeException("x")));
    }
}

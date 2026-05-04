package com.cretas.aims.client;

import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.dto.intent.PythonIntentMatchRequest;
import com.cretas.aims.dto.intent.PythonIntentMatchResponse;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

/**
 * Java-side proxy for Python's <code>POST /api/ai/intent/match</code>
 * (Phase 2B-α task T18).
 *
 * <p>Wraps the HTTP call with Resilience4j {@link CircuitBreaker} (instance
 * {@code pythonAiMatcher} per application.properties) so a flapping or
 * unreachable Python service trips fast and falls back to
 * {@link IntentMatchResult#empty(String)}. Java callers therefore never see
 * a {@code null} result from this client — the fallback returns a usable
 * empty match with {@link IntentMatchResult.MatchMethod#NONE}.
 *
 * <p>Auth: sends X-Internal-Secret + X-Factory-Id headers per spec §5.2.
 * Refuses to call (throws {@link IllegalStateException}) when the secret
 * was not configured — easier to spot misconfiguration than to fall back
 * silently.
 *
 * @see PythonAiMatcherClient#match(PythonIntentMatchRequest)
 * @see PythonAiMatcherClient#matchFallback(PythonIntentMatchRequest, Throwable)
 */
@Slf4j
@Component
public class PythonAiMatcherClient {

    /** Counter name (Micrometer dot form → Prometheus {@code python_ai_matcher_calls_total}). */
    static final String METRIC_CALLS = "python.ai.matcher.calls";
    /** Tag key for {@link #METRIC_CALLS}. */
    static final String TAG_RESULT = "result";
    /** Tag value: {@link #match} returned without throwing. */
    static final String RESULT_SUCCESS = "success";
    /** Tag value: {@link #matchFallback} invoked (Resilience4j safety net). */
    static final String RESULT_FALLBACK = "fallback";
    /** Tag value: reserved for future granularity; currently never incremented. */
    static final String RESULT_ERROR = "error";
    /** Gauge name (Prometheus {@code python_ai_matcher_fallback_rate}). */
    static final String METRIC_FALLBACK_RATE = "python.ai.matcher.fallback.rate";

    private final RestTemplate restTemplate;
    private final String baseUrl;
    private final String internalSecret;

    /**
     * Phase 2B (issue #29 §6 action item): optional MeterRegistry for
     * fallback-rate observability. {@code required=false} so unit tests
     * constructing this client directly (without a Spring context) keep
     * working — increments become no-ops when the registry is absent.
     */
    @Autowired(required = false)
    private MeterRegistry meterRegistry;

    @Autowired
    public PythonAiMatcherClient(
            @Qualifier("pythonAiRestTemplate") RestTemplate restTemplate,
            @Qualifier("pythonAiBaseUrl") String baseUrl,
            @Qualifier("pythonAiInternalSecret") String internalSecret) {
        this.restTemplate = restTemplate;
        this.baseUrl = baseUrl;
        this.internalSecret = internalSecret;
    }

    /**
     * Phase 2B: pre-register call counters (with all three result tag values
     * so the series exist at {@code /actuator/prometheus} from boot) and a
     * derived fallback-rate gauge. Defensive try/catch keeps a misbehaving
     * registry from blocking the matcher.
     */
    @PostConstruct
    void initMetrics() {
        if (meterRegistry == null) {
            return;
        }
        try {
            meterRegistry.counter(METRIC_CALLS, TAG_RESULT, RESULT_SUCCESS);
            meterRegistry.counter(METRIC_CALLS, TAG_RESULT, RESULT_FALLBACK);
            meterRegistry.counter(METRIC_CALLS, TAG_RESULT, RESULT_ERROR);
            Gauge.builder(METRIC_FALLBACK_RATE, meterRegistry, reg -> {
                        double success = reg.counter(METRIC_CALLS, TAG_RESULT, RESULT_SUCCESS).count();
                        double fallback = reg.counter(METRIC_CALLS, TAG_RESULT, RESULT_FALLBACK).count();
                        double error = reg.counter(METRIC_CALLS, TAG_RESULT, RESULT_ERROR).count();
                        double total = success + fallback + error;
                        return total > 0.0 ? fallback / total : 0.0;
                    })
                    .description("PythonAiMatcherClient fallback rate: fallback / (success + fallback + error)")
                    .register(meterRegistry);
        } catch (Exception e) {
            log.debug("PythonAiMatcherClient metric init failed: {}", e.getMessage());
        }
    }

    private void recordCall(String result) {
        if (meterRegistry == null || result == null) {
            return;
        }
        try {
            meterRegistry.counter(METRIC_CALLS, TAG_RESULT, result).increment();
        } catch (Exception e) {
            log.debug("PythonAiMatcherClient metric increment ({}) failed: {}", result, e.getMessage());
        }
    }

    /**
     * POST /api/ai/intent/match. Throws on any non-success envelope or
     * transport error so the {@link CircuitBreaker} can record the failure;
     * the {@code matchFallback} method serves as the user-facing recovery.
     */
    @CircuitBreaker(name = "pythonAiMatcher", fallbackMethod = "matchFallback")
    public IntentMatchResult match(PythonIntentMatchRequest request) {
        if (internalSecret == null || internalSecret.isEmpty()) {
            throw new IllegalStateException(
                    "INTERNAL_API_SECRET not configured; cannot call Python AI matcher"
            );
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Internal-Secret", internalSecret);
        headers.set("X-Factory-Id", request.getFactoryId());

        HttpEntity<PythonIntentMatchRequest> entity = new HttpEntity<>(request, headers);
        String url = baseUrl + "/api/ai/intent/match";

        log.debug("Calling Python AI matcher: query={} factoryId={}",
                truncate(request.getQuery(), 80), request.getFactoryId());

        ResponseEntity<PythonIntentMatchResponse> response = restTemplate.exchange(
                url, HttpMethod.POST, entity, PythonIntentMatchResponse.class
        );

        PythonIntentMatchResponse body = response.getBody();
        if (body == null) {
            throw new RuntimeException("Python returned null body");
        }
        if (!body.isSuccess()) {
            String code = body.getCode() != null ? body.getCode() : "UNKNOWN";
            throw new RuntimeException(
                    "Python AI matcher returned error: code=" + code
                            + " message=" + body.getMessage()
            );
        }
        if (body.getData() == null) {
            throw new RuntimeException("Python returned success but null data");
        }
        recordCall(RESULT_SUCCESS);
        return body.getData();
    }

    /**
     * Resilience4j fallback. Signature must accept the original args plus a
     * {@link Throwable}. Returns an empty match so upstream callers don't
     * have to handle null or rethrow.
     */
    public IntentMatchResult matchFallback(PythonIntentMatchRequest request, Throwable t) {
        log.warn("Python AI matcher fallback triggered: {} (query={})",
                t.getMessage(), truncate(request.getQuery(), 80));
        recordCall(RESULT_FALLBACK);
        return IntentMatchResult.empty(request.getQuery());
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max) + "...";
    }
}

package com.cretas.aims.client;

import com.cretas.aims.config.smartbi.PythonSmartBIConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.time.LocalDate;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Week 5 Agent layer HTTP client — calls Python
 * /api/smartbi/insights/custom (AgentOrchestrator).
 *
 * Mirrors GoldFinanceClient pattern: shared OkHttp + INTERNAL_API_SECRET
 * + X-Factory-Id headers. Longer read timeout (90s) because LLM calls
 * can take 10-30s on Aliyun DashScope.
 *
 * Route only exists on the Python side when
 * SMARTBI_AGENT_LAYER_ENABLED=true — if Python has the flag off, this
 * client will get 404 and the caller falls through to empty insights.
 *
 * @since 2026-04-23
 */
@Slf4j
@Component
public class AgentInsightsClient {

    private final PythonSmartBIConfig config;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final OkHttpClient http;

    private final String internalSecret = System.getenv("INTERNAL_API_SECRET") != null
            ? System.getenv("INTERNAL_API_SECRET") : "";

    public AgentInsightsClient(PythonSmartBIConfig config) {
        this.config = config;
        this.http = new OkHttpClient.Builder()
                .connectTimeout(config.getConnectTimeout(), TimeUnit.MILLISECONDS)
                // LLM latency: budget 90s for upstream Aliyun/Zhipu cold calls.
                .readTimeout(90_000, TimeUnit.MILLISECONDS)
                .build();
    }

    @PostConstruct
    public void init() {
        log.info("AgentInsightsClient initialized; python_url={} has_secret={}",
                config.getUrl(), !internalSecret.isEmpty());
    }

    /**
     * Call Python AgentOrchestrator for a date range insight.
     *
     * @param factoryId tenant
     * @param startDate inclusive
     * @param endDate   inclusive
     * @param question  user question (nullable → Python uses default)
     * @return parsed response keyed by: answer, source, tokens,
     *         tokens_used_today, tokens_cap, elapsed_ms, chart_config
     * @throws IOException on network / non-2xx / parse failure. Caller
     *                     should log + return empty insights to UI.
     */
    public Map<String, Object> fetchInsightsCustom(
            String factoryId,
            LocalDate startDate,
            LocalDate endDate,
            String question
    ) throws IOException {
        if (factoryId == null || factoryId.isEmpty()) {
            throw new IllegalArgumentException("factoryId required");
        }
        if (startDate == null || endDate == null) {
            throw new IllegalArgumentException("startDate and endDate required");
        }
        if (startDate.isAfter(endDate)) {
            throw new IllegalArgumentException("startDate > endDate");
        }

        HttpUrl.Builder urlBuilder = HttpUrl.parse(config.getUrl() + "/api/smartbi/insights/custom")
                .newBuilder()
                .addQueryParameter("start_date", startDate.toString())
                .addQueryParameter("end_date", endDate.toString());
        if (question != null && !question.isBlank()) {
            urlBuilder.addQueryParameter("question", question);
        }

        Request.Builder reqBuilder = new Request.Builder().url(urlBuilder.build()).get();
        if (!internalSecret.isEmpty()) {
            reqBuilder.addHeader("X-Internal-Secret", internalSecret);
            reqBuilder.addHeader("X-Factory-Id", factoryId);
        }
        Request req = reqBuilder.build();

        long t0 = System.currentTimeMillis();
        try (Response resp = http.newCall(req).execute()) {
            long elapsed = System.currentTimeMillis() - t0;
            if (!resp.isSuccessful()) {
                String body = resp.body() != null ? resp.body().string() : "";
                throw new IOException(
                        "Agent insights HTTP " + resp.code() + " in " + elapsed
                                + "ms: " + body);
            }
            String body = resp.body() != null ? resp.body().string() : "{}";
            @SuppressWarnings("unchecked")
            Map<String, Object> parsed = objectMapper.readValue(body, Map.class);
            log.info("Agent insights factory={} range={}..{} source={} tokens={} elapsed={}ms",
                    factoryId, startDate, endDate,
                    parsed.get("source"), parsed.get("tokens"), elapsed);
            return parsed;
        }
    }

    /**
     * Streaming variant — calls Python SSE endpoint /insights/custom/stream
     * and returns a Response whose body is the raw SSE stream. Caller is
     * responsible for closing the Response and reading line-by-line.
     *
     * Returns null if internalSecret missing (caller should fall through).
     */
    public Response streamInsightsCustom(
            String factoryId,
            LocalDate startDate,
            LocalDate endDate,
            String question
    ) throws IOException {
        if (factoryId == null || factoryId.isEmpty()) {
            throw new IllegalArgumentException("factoryId required");
        }
        if (startDate == null || endDate == null || startDate.isAfter(endDate)) {
            throw new IllegalArgumentException("invalid date range");
        }
        if (internalSecret.isEmpty()) {
            return null;  // Caller falls through to empty/degraded
        }

        HttpUrl.Builder urlBuilder = HttpUrl.parse(config.getUrl() + "/api/smartbi/insights/custom/stream")
                .newBuilder()
                .addQueryParameter("start_date", startDate.toString())
                .addQueryParameter("end_date", endDate.toString());
        if (question != null && !question.isBlank()) {
            urlBuilder.addQueryParameter("question", question);
        }
        Request req = new Request.Builder()
                .url(urlBuilder.build())
                .get()
                .addHeader("X-Internal-Secret", internalSecret)
                .addHeader("X-Factory-Id", factoryId)
                .addHeader("Accept", "text/event-stream")
                .build();
        // Do NOT use try-with-resources here — caller owns the Response
        Response resp = http.newCall(req).execute();
        if (!resp.isSuccessful()) {
            int code = resp.code();
            // I5 fix (reviewer Apr 24): cap body at 512 chars — nginx 502 HTML
            // error pages can be multi-MB and explode log lines.
            String body = resp.body() != null ? resp.body().string() : "";
            if (body.length() > 512) body = body.substring(0, 512) + "...[truncated]";
            resp.close();
            throw new IOException("Agent insights stream HTTP " + code + ": " + body);
        }
        return resp;
    }
}

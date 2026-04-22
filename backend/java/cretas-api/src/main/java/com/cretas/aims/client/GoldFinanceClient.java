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
 * Gold finance-summary HTTP client.
 *
 * Reads from the Python Gold layer's /api/smartbi/gold/finance-summary
 * endpoint — the Silver+Gold pipeline landed in v1 Phase B v0. This
 * client is the building block for the future Java-side READ_FROM=GOLD
 * cutover in FinanceAnalysisServiceImpl: legacy path stays, Java also
 * calls Gold, logs divergence, and eventually flips.
 *
 * This class today is WIRED BUT NOT CALLED — FinanceAnalysisServiceImpl
 * hasn't been modified. Keeping it as a standalone Spring bean means
 * enabling shadow-read later is a small wire-up change, not a new
 * infrastructure task.
 *
 * Auth: reuses INTERNAL_API_SECRET + X-Factory-Id pattern that
 * PythonSmartBIClient already uses (see auth_middleware.py line 116-144).
 * Gold routes enforce tenant scope via JWT OR this internal-secret path.
 *
 * @since 2026-04-22
 */
@Slf4j
@Component
public class GoldFinanceClient {

    private final PythonSmartBIConfig config;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final OkHttpClient http;

    /**
     * Read the same env var that JwtAuthInterceptor + PythonSmartBIClient use
     * so there's exactly one secret to rotate. Empty = run without the header
     * (Gold route will then require JWT instead).
     */
    private String internalSecret = System.getenv("INTERNAL_API_SECRET") != null
            ? System.getenv("INTERNAL_API_SECRET") : "";

    public GoldFinanceClient(PythonSmartBIConfig config) {
        this.config = config;
        this.http = new OkHttpClient.Builder()
                .connectTimeout(config.getConnectTimeout(), TimeUnit.MILLISECONDS)
                .readTimeout(config.getTimeout(), TimeUnit.MILLISECONDS)
                .build();
    }

    @PostConstruct
    public void init() {
        log.info("GoldFinanceClient initialized; python_url={} enabled={} has_secret={}",
                config.getUrl(), config.isEnabled(), !internalSecret.isEmpty());
    }

    /**
     * Fetch the finance_summary dict from Python Gold layer.
     *
     * @param factoryId factory (tenant) id — must match the caller's auth scope
     * @param startDate inclusive
     * @param endDate   inclusive; must be ≥ startDate
     * @param topNStores max top-stores ranking to include (1..100)
     * @return parsed JSON as a Map keyed by Python's snake_case field names:
     *         total_revenue, bill_count, avg_bill_value, store_count, day_count,
     *         top_stores (List of {store_id, store_name, revenue, bill_count})
     * @throws IOException if Gold is unreachable, returns non-2xx, or the body
     *                    doesn't parse. Caller should log + fall through to legacy.
     */
    public Map<String, Object> fetchFinanceSummary(
            String factoryId,
            LocalDate startDate,
            LocalDate endDate,
            int topNStores
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
        if (topNStores < 1 || topNStores > 100) {
            throw new IllegalArgumentException("topNStores must be 1..100");
        }

        HttpUrl url = HttpUrl.parse(config.getUrl() + "/api/smartbi/gold/finance-summary")
                .newBuilder()
                .addQueryParameter("factory_id", factoryId)
                .addQueryParameter("start_date", startDate.toString())
                .addQueryParameter("end_date", endDate.toString())
                .addQueryParameter("top_n_stores", String.valueOf(topNStores))
                .build();

        Request.Builder reqBuilder = new Request.Builder().url(url).get();
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
                        "Gold finance-summary HTTP " + resp.code() + " in " + elapsed
                                + "ms: " + body);
            }
            String body = resp.body() != null ? resp.body().string() : "{}";
            @SuppressWarnings("unchecked")
            Map<String, Object> parsed = objectMapper.readValue(body, Map.class);
            log.debug("Gold finance-summary factory={} range={}..{} rev={} bills={} in {}ms",
                    factoryId, startDate, endDate,
                    parsed.get("total_revenue"), parsed.get("bill_count"), elapsed);
            return parsed;
        }
    }
}

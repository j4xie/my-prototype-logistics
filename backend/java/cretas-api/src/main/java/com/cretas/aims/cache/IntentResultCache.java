package com.cretas.aims.cache;

import com.cretas.aims.dto.intent.IntentMatchResult;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;

/**
 * In-process LRU cache of (query+factoryId+role+businessType) → IntentMatchResult
 * (Phase 2B-α task T19).
 *
 * <p>Used by {@code AIIntentServiceImpl} between Java stage 4 miss and the
 * outbound Python HTTP call so identical queries within a 5-minute window
 * skip both the Python round-trip and the LLM re-match. Mirrors the
 * Python-side {@code ai/cache.py IntentResultCache} so a cache hit on
 * either end yields the same byte-shape result.
 *
 * <p>Cache key: SHA-256 over UTF-8 bytes of {@code query \0 factoryId \0
 * role \0 businessType}. The 0-byte separator prevents the (unlikely)
 * "ABC" + "DEF" vs "AB" + "CDEF" collision.
 *
 * <p>Invalidation: {@code invalidateAll()} wipes everything when the
 * Java {@code IntentConfigManagementService} writes a config (because a
 * change in intent thresholds, keywords, or active flags can flip a prior
 * cached match).
 *
 * <p>Defaults injected from {@code ai.cache.max-size} (1000) and
 * {@code ai.cache.ttl-seconds} (300) — matches Python's
 * {@code AIConfig.cache_max_size} / {@code AIConfig.cache_ttl_s}.
 */
@Slf4j
@Component
public class IntentResultCache {

    /** Counter name (Micrometer dot form → Prometheus {@code intent_cache_hits_total}). */
    static final String METRIC_HITS = "intent.cache.hits";
    /** Counter name (Micrometer dot form → Prometheus {@code intent_cache_misses_total}). */
    static final String METRIC_MISSES = "intent.cache.misses";
    /** Gauge name (Prometheus {@code intent_cache_hit_rate}). */
    static final String METRIC_HIT_RATE = "intent.cache.hit.rate";

    private final Cache<String, IntentMatchResult> cache;

    /**
     * Phase 2B (issue #29 §6 action item): optional MeterRegistry for hit-rate
     * observability. {@code required=false} so unit tests constructing this
     * cache directly (without a Spring context) keep working — increments
     * become no-ops when the registry is absent.
     */
    @Autowired(required = false)
    private MeterRegistry meterRegistry;

    public IntentResultCache(
            @Value("${ai.cache.max-size:1000}") int maxSize,
            @Value("${ai.cache.ttl-seconds:300}") int ttlSeconds) {
        this.cache = Caffeine.newBuilder()
                .maximumSize(maxSize)
                .expireAfterWrite(Duration.ofSeconds(ttlSeconds))
                .recordStats()
                .build();
        log.info("IntentResultCache initialized: maxSize={}, ttl={}s", maxSize, ttlSeconds);
    }

    /**
     * Phase 2B: pre-register counters and a derived hit-rate gauge so the
     * series appear at {@code /actuator/prometheus} even before the first
     * lookup. Defensive try/catch keeps a misbehaving registry from blocking
     * cache use.
     */
    @PostConstruct
    void initMetrics() {
        if (meterRegistry == null) {
            return;
        }
        try {
            meterRegistry.counter(METRIC_HITS);
            meterRegistry.counter(METRIC_MISSES);
            Gauge.builder(METRIC_HIT_RATE, meterRegistry, reg -> {
                        double hits = reg.counter(METRIC_HITS).count();
                        double misses = reg.counter(METRIC_MISSES).count();
                        double total = hits + misses;
                        return total > 0.0 ? hits / total : 0.0;
                    })
                    .description("IntentResultCache hit rate: hits / (hits + misses)")
                    .register(meterRegistry);
        } catch (Exception e) {
            log.debug("IntentResultCache metric init failed: {}", e.getMessage());
        }
    }

    public IntentMatchResult get(String query, String factoryId, String role, String businessType) {
        IntentMatchResult result = cache.getIfPresent(makeKey(query, factoryId, role, businessType));
        if (meterRegistry != null) {
            try {
                if (result != null) {
                    meterRegistry.counter(METRIC_HITS).increment();
                } else {
                    meterRegistry.counter(METRIC_MISSES).increment();
                }
            } catch (Exception e) {
                log.debug("IntentResultCache metric increment failed: {}", e.getMessage());
            }
        }
        return result;
    }

    public void put(String query, String factoryId, String role, String businessType,
                    IntentMatchResult result) {
        cache.put(makeKey(query, factoryId, role, businessType), result);
    }

    public void invalidateAll() {
        long size = cache.estimatedSize();
        cache.invalidateAll();
        log.info("IntentResultCache invalidated: cleared ~{} entries", size);
    }

    public long size() {
        return cache.estimatedSize();
    }

    private static String makeKey(String query, String factoryId, String role, String businessType) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update(query.getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update(factoryId.getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update(role.getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update(businessType.getBytes(StandardCharsets.UTF_8));
            byte[] digest = md.digest();
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}

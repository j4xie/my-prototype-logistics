package com.cretas.aims.cache;

import com.cretas.aims.dto.intent.IntentMatchResult;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Phase 2B-α task T19 unit tests for {@link IntentResultCache}.
 *
 * <p>Covers four scenarios per plan §"Task 19" reference:
 * <ul>
 *   <li>{@code putThenGetReturnsCachedValue} — straight round-trip.</li>
 *   <li>{@code getReturnsNullForMiss} — absent key returns null (no NPE,
 *       caller can branch on null to populate the cache).</li>
 *   <li>{@code factoryIsolation} — same query under different factoryId
 *       must NOT collide (key includes factoryId in the SHA-256 digest).</li>
 *   <li>{@code invalidateAllClears} — used by IntentConfigManagementService
 *       on config write to wipe stale results across all tenants.</li>
 * </ul>
 *
 * <p>Constructed with explicit (maxSize=10, ttlSeconds=60) so tests don't
 * depend on Spring @Value injection.
 */
class IntentResultCacheTest {

    @Test
    void putThenGetReturnsCachedValue() {
        IntentResultCache cache = new IntentResultCache(10, 60);
        IntentMatchResult r = IntentMatchResult.empty("query");
        cache.put("query", "F001", "admin", "FACTORY", r);
        assertSame(r, cache.get("query", "F001", "admin", "FACTORY"));
    }

    @Test
    void getReturnsNullForMiss() {
        IntentResultCache cache = new IntentResultCache(10, 60);
        assertNull(cache.get("nope", "F001", "admin", "FACTORY"));
    }

    @Test
    void factoryIsolation() {
        IntentResultCache cache = new IntentResultCache(10, 60);
        IntentMatchResult r1 = IntentMatchResult.empty("q1");
        IntentMatchResult r2 = IntentMatchResult.empty("q2");
        cache.put("q", "F001", "admin", "FACTORY", r1);
        cache.put("q", "F002", "admin", "FACTORY", r2);
        assertSame(r1, cache.get("q", "F001", "admin", "FACTORY"));
        assertSame(r2, cache.get("q", "F002", "admin", "FACTORY"));
    }

    @Test
    void invalidateAllClears() {
        IntentResultCache cache = new IntentResultCache(10, 60);
        cache.put("q", "F001", "admin", "FACTORY", IntentMatchResult.empty("x"));
        cache.invalidateAll();
        assertNull(cache.get("q", "F001", "admin", "FACTORY"));
    }

    /**
     * Phase 2B (issue #29 §6): hit/miss counters increment on each {@code get},
     * and the derived {@code intent.cache.hit.rate} gauge equals
     * {@code hits / (hits + misses)} after a mix of hits and misses.
     */
    @Test
    void metricsEmitHitsMissesAndGauge() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        IntentResultCache cache = new IntentResultCache(10, 60);
        ReflectionTestUtils.setField(cache, "meterRegistry", registry);
        cache.initMetrics();

        IntentMatchResult r = IntentMatchResult.empty("query");
        cache.put("query", "F001", "admin", "FACTORY", r);

        // 3 hits, 2 misses → 0.6
        cache.get("query", "F001", "admin", "FACTORY");
        cache.get("query", "F001", "admin", "FACTORY");
        cache.get("query", "F001", "admin", "FACTORY");
        cache.get("missing", "F001", "admin", "FACTORY");
        cache.get("missing", "F001", "admin", "FACTORY");

        assertEquals(3.0, registry.counter(IntentResultCache.METRIC_HITS).count());
        assertEquals(2.0, registry.counter(IntentResultCache.METRIC_MISSES).count());

        Gauge hitRate = registry.find(IntentResultCache.METRIC_HIT_RATE).gauge();
        assertNotNull(hitRate);
        assertEquals(0.6, hitRate.value(), 1e-9);
    }

    /**
     * Phase 2B: gauge returns 0.0 (not NaN / divide-by-zero) before any
     * {@code get} call so the metric series is safe to scrape from boot.
     */
    @Test
    void metricsHitRateZeroWhenNoLookups() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        IntentResultCache cache = new IntentResultCache(10, 60);
        ReflectionTestUtils.setField(cache, "meterRegistry", registry);
        cache.initMetrics();

        Gauge hitRate = registry.find(IntentResultCache.METRIC_HIT_RATE).gauge();
        assertNotNull(hitRate);
        assertEquals(0.0, hitRate.value(), 1e-9);
    }

    /**
     * Phase 2B: existing behavior preserved when no MeterRegistry is wired —
     * the original (constructor-only) test path stays a no-op for metrics.
     */
    @Test
    void metricsAreNoOpWithoutRegistry() {
        IntentResultCache cache = new IntentResultCache(10, 60);
        // No registry, no initMetrics call — get() must still work.
        assertNull(cache.get("missing", "F001", "admin", "FACTORY"));
        cache.put("q", "F001", "admin", "FACTORY", IntentMatchResult.empty("x"));
        assertNotNull(cache.get("q", "F001", "admin", "FACTORY"));
    }
}

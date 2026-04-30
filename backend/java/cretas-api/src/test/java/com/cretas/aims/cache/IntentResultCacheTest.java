package com.cretas.aims.cache;

import com.cretas.aims.dto.intent.IntentMatchResult;
import org.junit.jupiter.api.Test;

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
}

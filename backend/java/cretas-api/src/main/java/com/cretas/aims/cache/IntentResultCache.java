package com.cretas.aims.cache;

import com.cretas.aims.dto.intent.IntentMatchResult;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.extern.slf4j.Slf4j;
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

    private final Cache<String, IntentMatchResult> cache;

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

    public IntentMatchResult get(String query, String factoryId, String role, String businessType) {
        return cache.getIfPresent(makeKey(query, factoryId, role, businessType));
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

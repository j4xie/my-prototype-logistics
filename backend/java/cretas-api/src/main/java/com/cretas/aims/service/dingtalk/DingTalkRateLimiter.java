package com.cretas.aims.service.dingtalk;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Fixed-window per-chat rate limiter for DingTalk outbound posts.
 *
 * <p>DingTalk imposes a 20-msgs/minute cap per group robot. Using a 60-second
 * fixed window per chatId (Redis key {@code dingtalk:rate:{chatId}:{minute}})
 * with INCR + EXPIRE; first INCR of a new minute extends TTL to 90s so the
 * bucket survives clock skew.
 *
 * <p>Fail-open semantics: when Redis is unavailable, falls back to an
 * in-process AtomicLong counter per chatId. Single-instance only — multi-
 * replica deployments require Redis to avoid 2× over-cap risk.
 *
 * <p>Burst behavior: not strictly token-bucket; allows up to {@link #limitPerMinute}
 * in a single second of a window then deny until next minute. Acceptable for
 * PoC (Phase 2 may shift to sliding window if needed).
 */
@Slf4j
@Service
public class DingTalkRateLimiter {

    @Autowired(required = false)
    private StringRedisTemplate redisTemplate;

    @Value("${dingtalk.rate-limit-per-minute:20}")
    private int limitPerMinute;

    /** In-process per-chat bucket: chatId → AtomicLong(count, windowStartMillis). */
    private final ConcurrentHashMap<String, MemBucket> memBuckets = new ConcurrentHashMap<>();

    /**
     * @return true if the message is allowed; false if rate-limited.
     */
    public boolean tryAcquire(String chatId) {
        String safeChat = chatId == null || chatId.isBlank() ? "_global" : chatId;
        long minuteBucket = Instant.now().getEpochSecond() / 60L;

        if (redisTemplate != null) {
            try {
                String key = "dingtalk:rate:" + safeChat + ":" + minuteBucket;
                Long count = redisTemplate.opsForValue().increment(key);
                if (count == null) return memTryAcquire(safeChat, minuteBucket);
                if (count == 1L) {
                    redisTemplate.expire(key, Duration.ofSeconds(90));
                }
                boolean ok = count <= limitPerMinute;
                if (!ok) {
                    log.debug("Rate-limited on chat {}: {}/{} for minute {}",
                            safeChat, count, limitPerMinute, minuteBucket);
                }
                return ok;
            } catch (Exception e) {
                log.warn("Redis rate-limit check failed, falling back to memory: {}", e.getMessage());
            }
        }
        return memTryAcquire(safeChat, minuteBucket);
    }

    private boolean memTryAcquire(String chatId, long minuteBucket) {
        MemBucket bucket = memBuckets.computeIfAbsent(chatId, k -> new MemBucket(minuteBucket));
        synchronized (bucket) {
            if (bucket.minute != minuteBucket) {
                bucket.minute = minuteBucket;
                bucket.count.set(0);
            }
            return bucket.count.incrementAndGet() <= limitPerMinute;
        }
    }

    private static class MemBucket {
        long minute;
        final AtomicLong count = new AtomicLong(0);
        MemBucket(long minute) { this.minute = minute; }
    }
}

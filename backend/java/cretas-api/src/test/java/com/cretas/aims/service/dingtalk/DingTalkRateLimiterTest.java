package com.cretas.aims.service.dingtalk;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link DingTalkRateLimiter} in-memory mode (Redis path needs
 * embedded-redis; in-process bucket adequately covers the rate-limit logic).
 */
@DisplayName("DingTalkRateLimiter — in-memory bucket")
class DingTalkRateLimiterTest {

    private DingTalkRateLimiter limiter;

    @BeforeEach
    void setUp() {
        limiter = new DingTalkRateLimiter();
        ReflectionTestUtils.setField(limiter, "limitPerMinute", 5);  // small cap for fast tests
    }

    @Test
    @DisplayName("first N <= cap calls allowed, N+1 denied")
    void capEnforced() {
        for (int i = 0; i < 5; i++) {
            assertTrue(limiter.tryAcquire("chat-A"), "call #" + (i + 1) + " should pass under cap=5");
        }
        assertFalse(limiter.tryAcquire("chat-A"), "6th call within same minute must be denied");
    }

    @Test
    @DisplayName("different chatIds have independent buckets")
    void perChatIsolation() {
        for (int i = 0; i < 5; i++) assertTrue(limiter.tryAcquire("chat-A"));
        // chat-B should still have full quota
        for (int i = 0; i < 5; i++) {
            assertTrue(limiter.tryAcquire("chat-B"), "chat-B call #" + (i + 1) + " should pass");
        }
        assertFalse(limiter.tryAcquire("chat-A"));
        assertFalse(limiter.tryAcquire("chat-B"));
    }

    @Test
    @DisplayName("null / blank chatId falls into _global bucket")
    void nullChatGroupsIntoGlobal() {
        for (int i = 0; i < 5; i++) {
            assertTrue(limiter.tryAcquire(null) || limiter.tryAcquire(""));
        }
        // After exhausting global bucket via mixed null+empty, next must be denied
        // (count semantics: each call consumes a slot)
        // Reset for cleaner check:
        DingTalkRateLimiter fresh = new DingTalkRateLimiter();
        ReflectionTestUtils.setField(fresh, "limitPerMinute", 2);
        assertTrue(fresh.tryAcquire(null));
        assertTrue(fresh.tryAcquire(""));
        assertFalse(fresh.tryAcquire(null), "null/empty should share the global bucket");
    }
}

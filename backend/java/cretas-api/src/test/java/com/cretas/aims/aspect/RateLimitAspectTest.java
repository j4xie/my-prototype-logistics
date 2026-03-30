package com.cretas.aims.aspect;

import com.cretas.aims.annotation.RateLimit;
import com.cretas.aims.annotation.RateLimit.LimitType;
import com.cretas.aims.exception.RateLimitExceededException;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.reflect.MethodSignature;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.lang.annotation.Annotation;
import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

/**
 * RateLimitAspect unit tests.
 *
 * Uses a mock ProceedingJoinPoint and a real MockHttpServletRequest
 * to test the fixed-window rate limiting logic without Spring context.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("RateLimitAspect unit tests")
class RateLimitAspectTest {

    private RateLimitAspect aspect;

    @Mock
    private ProceedingJoinPoint joinPoint;

    @Mock
    private MethodSignature methodSignature;

    private MockHttpServletRequest request;

    @BeforeEach
    void setUp() throws Throwable {
        aspect = new RateLimitAspect();

        // Set up a mock HTTP request context
        request = new MockHttpServletRequest();
        request.setRemoteAddr("192.168.1.100");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        // Wire the join point to return a real method signature
        when(joinPoint.getSignature()).thenReturn(methodSignature);
        Method dummyMethod = DummyController.class.getMethod("dummyEndpoint");
        when(methodSignature.getMethod()).thenReturn(dummyMethod);
        when(joinPoint.proceed()).thenReturn("OK");
    }

    // ── Allows requests within limit ────────────────────────────

    @Test
    @DisplayName("allows requests within the configured limit")
    void withinLimit_proceedsNormally() throws Throwable {
        RateLimit rateLimit = createRateLimit(3, 60, LimitType.GLOBAL);

        // 3 requests should all succeed
        for (int i = 0; i < 3; i++) {
            Object result = aspect.around(joinPoint, rateLimit);
            assertThat(result).isEqualTo("OK");
        }

        verify(joinPoint, times(3)).proceed();
    }

    // ── Throws when limit exceeded ──────────────────────────────

    @Test
    @DisplayName("throws RateLimitExceededException when limit exceeded")
    void exceedLimit_throwsException() throws Throwable {
        RateLimit rateLimit = createRateLimit(2, 60, LimitType.GLOBAL);

        // First 2 succeed
        aspect.around(joinPoint, rateLimit);
        aspect.around(joinPoint, rateLimit);

        // Third should throw
        assertThatThrownBy(() -> aspect.around(joinPoint, rateLimit))
                .isInstanceOf(RateLimitExceededException.class);
    }

    @Test
    @DisplayName("exception message matches annotation message")
    void exceedLimit_exceptionHasCorrectMessage() throws Throwable {
        String customMessage = "Too fast!";
        RateLimit rateLimit = createRateLimit(1, 60, LimitType.GLOBAL, customMessage);

        aspect.around(joinPoint, rateLimit);

        assertThatThrownBy(() -> aspect.around(joinPoint, rateLimit))
                .isInstanceOf(RateLimitExceededException.class)
                .hasMessage(customMessage);
    }

    // ── Different keys don't interfere ──────────────────────────

    @Test
    @DisplayName("IP-based: different IPs have independent counters")
    void ipBased_differentIps_independentCounters() throws Throwable {
        RateLimit rateLimit = createRateLimit(1, 60, LimitType.IP);

        // First IP
        request.setRemoteAddr("10.0.0.1");
        aspect.around(joinPoint, rateLimit);

        // Second IP - should succeed (different key)
        request.setRemoteAddr("10.0.0.2");
        Object result = aspect.around(joinPoint, rateLimit);
        assertThat(result).isEqualTo("OK");
    }

    @Test
    @DisplayName("GLOBAL: all requests share the same counter")
    void globalBased_allRequestsShareCounter() throws Throwable {
        RateLimit rateLimit = createRateLimit(2, 60, LimitType.GLOBAL);

        // Different IPs but GLOBAL limit
        request.setRemoteAddr("10.0.0.1");
        aspect.around(joinPoint, rateLimit);

        request.setRemoteAddr("10.0.0.2");
        aspect.around(joinPoint, rateLimit);

        // Third request from any IP should fail
        request.setRemoteAddr("10.0.0.3");
        assertThatThrownBy(() -> aspect.around(joinPoint, rateLimit))
                .isInstanceOf(RateLimitExceededException.class);
    }

    @Test
    @DisplayName("USER-based: different users have independent counters")
    void userBased_differentUsers_independentCounters() throws Throwable {
        RateLimit rateLimit = createRateLimit(1, 60, LimitType.USER);

        // User 1
        request.setAttribute("userId", 42L);
        aspect.around(joinPoint, rateLimit);

        // User 2 - should succeed (different key)
        request.setAttribute("userId", 99L);
        Object result = aspect.around(joinPoint, rateLimit);
        assertThat(result).isEqualTo("OK");
    }

    // ── Counter resets after period expires ──────────────────────

    @Test
    @DisplayName("counter resets after the period expires (Caffeine TTL)")
    void counterResets_afterPeriodExpires() throws Throwable {
        // Use a 1-second period so we can wait for expiry
        RateLimit rateLimit = createRateLimit(1, 1, LimitType.GLOBAL);

        // First request succeeds
        aspect.around(joinPoint, rateLimit);

        // Second request should fail (limit = 1)
        assertThatThrownBy(() -> aspect.around(joinPoint, rateLimit))
                .isInstanceOf(RateLimitExceededException.class);

        // Wait for the 1-second window to expire
        Thread.sleep(1200);

        // After expiry, counter is reset - should succeed again
        Object result = aspect.around(joinPoint, rateLimit);
        assertThat(result).isEqualTo("OK");
    }

    // ── X-Forwarded-For header handling ─────────────────────────

    @Test
    @DisplayName("IP extraction uses X-Forwarded-For first hop when present")
    void ipExtraction_usesXForwardedFor() throws Throwable {
        RateLimit rateLimit = createRateLimit(1, 60, LimitType.IP);

        // Set proxy header with multiple IPs
        request.addHeader("X-Forwarded-For", "203.0.113.50, 198.51.100.1");
        aspect.around(joinPoint, rateLimit);

        // Same X-Forwarded-For first hop should be rate-limited
        assertThatThrownBy(() -> aspect.around(joinPoint, rateLimit))
                .isInstanceOf(RateLimitExceededException.class);
    }

    // ── Helper: dummy controller for method signature ───────────

    @SuppressWarnings("unused")
    public static class DummyController {
        public String dummyEndpoint() {
            return "OK";
        }
    }

    // ── Helper: create RateLimit annotation proxy ───────────────

    private RateLimit createRateLimit(int count, int period, LimitType limitType) {
        return createRateLimit(count, period, limitType, "请求过于频繁，请稍后再试");
    }

    private RateLimit createRateLimit(int count, int period, LimitType limitType, String message) {
        return new RateLimit() {
            @Override
            public Class<? extends Annotation> annotationType() {
                return RateLimit.class;
            }

            @Override
            public int count() {
                return count;
            }

            @Override
            public int period() {
                return period;
            }

            @Override
            public LimitType limitType() {
                return limitType;
            }

            @Override
            public String message() {
                return message;
            }
        };
    }
}

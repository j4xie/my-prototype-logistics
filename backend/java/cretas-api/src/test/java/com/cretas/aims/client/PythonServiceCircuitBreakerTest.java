package com.cretas.aims.client;

import com.cretas.aims.client.PythonServiceCircuitBreaker.CircuitState;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * PythonServiceCircuitBreaker unit tests.
 *
 * Tests the CLOSED -> OPEN -> HALF_OPEN -> CLOSED state machine,
 * including threshold-based transitions and metric tracking.
 *
 * Uses short durations (100ms) to keep tests fast.
 */
@DisplayName("PythonServiceCircuitBreaker unit tests")
class PythonServiceCircuitBreakerTest {

    private PythonServiceCircuitBreaker breaker;

    @BeforeEach
    void setUp() throws Exception {
        breaker = new PythonServiceCircuitBreaker();
        // Inject config via reflection (normally set by @Value)
        setField("failureThreshold", 5);
        setField("openDurationMs", 100L);    // short for fast tests
        setField("halfOpenMaxCalls", 2);
        setField("successThresholdInHalfOpen", 2);
    }

    // ── Initial state ───────────────────────────────────────────

    @Test
    @DisplayName("starts in CLOSED state")
    void initialState_isClosed() {
        assertThat(breaker.getState()).isEqualTo(CircuitState.CLOSED);
    }

    @Test
    @DisplayName("CLOSED state permits calls")
    void closedState_permitsCall() {
        assertThat(breaker.isCallPermitted()).isTrue();
    }

    // ── CLOSED -> OPEN transition ───────────────────────────────

    @Test
    @DisplayName("5 consecutive failures transition to OPEN")
    void fiveConsecutiveFailures_transitionsToOpen() {
        for (int i = 0; i < 5; i++) {
            breaker.recordFailure();
        }

        assertThat(breaker.getState()).isEqualTo(CircuitState.OPEN);
    }

    @Test
    @DisplayName("4 failures stay in CLOSED")
    void fourFailures_staysInClosed() {
        for (int i = 0; i < 4; i++) {
            breaker.recordFailure();
        }

        assertThat(breaker.getState()).isEqualTo(CircuitState.CLOSED);
    }

    // ── OPEN state behavior ─────────────────────────────────────

    @Test
    @DisplayName("OPEN state rejects calls immediately")
    void openState_rejectsCalls() {
        // Trip the breaker
        for (int i = 0; i < 5; i++) {
            breaker.recordFailure();
        }

        assertThat(breaker.isCallPermitted()).isFalse();
    }

    @Test
    @DisplayName("getRemainingOpenTimeMs returns positive value when OPEN")
    void openState_hasPositiveRemainingTime() {
        for (int i = 0; i < 5; i++) {
            breaker.recordFailure();
        }

        assertThat(breaker.getRemainingOpenTimeMs()).isGreaterThan(0);
    }

    @Test
    @DisplayName("getRemainingOpenTimeMs returns 0 when CLOSED")
    void closedState_zeroRemainingTime() {
        assertThat(breaker.getRemainingOpenTimeMs()).isEqualTo(0);
    }

    // ── OPEN -> HALF_OPEN transition ────────────────────────────

    @Test
    @DisplayName("after openDurationMs, OPEN transitions to HALF_OPEN")
    void openState_afterTimeout_transitionsToHalfOpen() throws InterruptedException {
        // Trip the breaker
        for (int i = 0; i < 5; i++) {
            breaker.recordFailure();
        }
        assertThat(breaker.getState()).isEqualTo(CircuitState.OPEN);

        // Wait for the open duration to pass
        Thread.sleep(150);

        // getState() reports HALF_OPEN once timeout elapsed
        assertThat(breaker.getState()).isEqualTo(CircuitState.HALF_OPEN);
    }

    @Test
    @DisplayName("after openDurationMs, isCallPermitted returns true (triggers actual transition)")
    void openState_afterTimeout_callPermitted() throws InterruptedException {
        for (int i = 0; i < 5; i++) {
            breaker.recordFailure();
        }

        Thread.sleep(150);

        // isCallPermitted triggers the actual OPEN -> HALF_OPEN state change
        assertThat(breaker.isCallPermitted()).isTrue();
    }

    // ── HALF_OPEN -> CLOSED transition ──────────────────────────

    @Test
    @DisplayName("2 successes in HALF_OPEN transition back to CLOSED")
    void halfOpen_twoSuccesses_transitionsToClosed() throws InterruptedException {
        // Trip to OPEN
        for (int i = 0; i < 5; i++) {
            breaker.recordFailure();
        }

        // Wait for HALF_OPEN
        Thread.sleep(150);
        breaker.isCallPermitted(); // triggers OPEN -> HALF_OPEN

        // Record 2 successes (matches successThresholdInHalfOpen)
        breaker.recordSuccess();
        breaker.recordSuccess();

        assertThat(breaker.getState()).isEqualTo(CircuitState.CLOSED);
    }

    // ── HALF_OPEN -> OPEN (failure during probe) ────────────────

    @Test
    @DisplayName("failure in HALF_OPEN immediately transitions back to OPEN")
    void halfOpen_failure_transitionsBackToOpen() throws InterruptedException {
        // Trip to OPEN
        for (int i = 0; i < 5; i++) {
            breaker.recordFailure();
        }

        // Wait for HALF_OPEN
        Thread.sleep(150);
        breaker.isCallPermitted(); // triggers transition

        // One failure in HALF_OPEN -> immediately back to OPEN
        breaker.recordFailure();

        assertThat(breaker.getState()).isEqualTo(CircuitState.OPEN);
    }

    // ── Success in CLOSED resets failure counter ────────────────

    @Test
    @DisplayName("success in CLOSED resets consecutive failure counter")
    void closedState_success_resetsFailureCounter() {
        // Accumulate 4 failures (one short of threshold)
        for (int i = 0; i < 4; i++) {
            breaker.recordFailure();
        }

        // A success resets the counter
        breaker.recordSuccess();

        // Now 4 more failures should NOT trip the breaker (counter was reset)
        for (int i = 0; i < 4; i++) {
            breaker.recordFailure();
        }

        assertThat(breaker.getState()).isEqualTo(CircuitState.CLOSED);
    }

    // ── getMetrics ──────────────────────────────────────────────

    @Test
    @DisplayName("getMetrics returns correct state and counters")
    void getMetrics_returnsCorrectInfo() {
        // Record some activity
        breaker.recordSuccess();
        breaker.recordSuccess();
        breaker.recordFailure();

        Map<String, Object> metrics = breaker.getMetrics();

        assertThat(metrics.get("state")).isEqualTo("CLOSED");
        assertThat(metrics.get("consecutiveFailures")).isEqualTo(1);
        assertThat(metrics.get("totalRequests")).isEqualTo(3L);
        assertThat(metrics.get("totalFailures")).isEqualTo(1L);
        assertThat(metrics.get("totalCircuitBroken")).isEqualTo(0L);
        assertThat(metrics.get("remainingOpenTimeMs")).isEqualTo(0L);

        @SuppressWarnings("unchecked")
        Map<String, Object> config = (Map<String, Object>) metrics.get("config");
        assertThat(config.get("failureThreshold")).isEqualTo(5);
        assertThat(config.get("openDurationMs")).isEqualTo(100L);
        assertThat(config.get("halfOpenMaxCalls")).isEqualTo(2);
        assertThat(config.get("successThresholdInHalfOpen")).isEqualTo(2);
    }

    @Test
    @DisplayName("getMetrics reflects OPEN state after tripping")
    void getMetrics_afterTripping_showsOpenState() {
        for (int i = 0; i < 5; i++) {
            breaker.recordFailure();
        }

        Map<String, Object> metrics = breaker.getMetrics();

        assertThat(metrics.get("state")).isEqualTo("OPEN");
        assertThat(metrics.get("totalCircuitBroken")).isEqualTo(1L);
        assertThat((long) metrics.get("remainingOpenTimeMs")).isGreaterThan(0L);
    }

    // ── HALF_OPEN limits concurrent probes ──────────────────────

    @Test
    @DisplayName("HALF_OPEN limits probe calls to halfOpenMaxCalls")
    void halfOpen_limitsProbeCallCount() throws InterruptedException {
        // Trip to OPEN
        for (int i = 0; i < 5; i++) {
            breaker.recordFailure();
        }

        // Wait for HALF_OPEN
        Thread.sleep(150);

        // First 2 calls should be permitted (halfOpenMaxCalls = 2)
        assertThat(breaker.isCallPermitted()).isTrue();
        assertThat(breaker.isCallPermitted()).isTrue();

        // Third call should be rejected
        assertThat(breaker.isCallPermitted()).isFalse();
    }

    // ── Full cycle test ─────────────────────────────────────────

    @Test
    @DisplayName("full lifecycle: CLOSED -> OPEN -> HALF_OPEN -> CLOSED")
    void fullLifecycle() throws InterruptedException {
        // Start CLOSED
        assertThat(breaker.getState()).isEqualTo(CircuitState.CLOSED);

        // Trip to OPEN
        for (int i = 0; i < 5; i++) {
            breaker.recordFailure();
        }
        assertThat(breaker.getState()).isEqualTo(CircuitState.OPEN);

        // Wait for HALF_OPEN
        Thread.sleep(150);
        breaker.isCallPermitted();
        // State should now be HALF_OPEN (actual state change)
        assertThat(breaker.getState()).isEqualTo(CircuitState.HALF_OPEN);

        // Recover via 2 successes
        breaker.recordSuccess();
        breaker.recordSuccess();
        assertThat(breaker.getState()).isEqualTo(CircuitState.CLOSED);

        // Verify calls permitted again
        assertThat(breaker.isCallPermitted()).isTrue();
    }

    // ── Helper ──────────────────────────────────────────────────

    private void setField(String fieldName, Object value) throws Exception {
        Field field = PythonServiceCircuitBreaker.class.getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(breaker, value);
    }
}

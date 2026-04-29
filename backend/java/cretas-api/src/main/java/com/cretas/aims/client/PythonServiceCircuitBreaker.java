package com.cretas.aims.client;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Python 服务熔断器
 *
 * 实现 CLOSED → OPEN → HALF_OPEN → CLOSED 状态机，
 * 当 Python 服务连续失败达到阈值后自动熔断，避免级联超时。
 *
 * 线程安全：使用 AtomicReference + AtomicInteger 实现无锁状态管理。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-28
 */
@Slf4j
@Component
public class PythonServiceCircuitBreaker {

    public enum CircuitState {
        /** 正常状态，所有请求放行 */
        CLOSED,
        /** 熔断状态，所有请求快速失败 */
        OPEN,
        /** 半开状态，允许有限探测请求 */
        HALF_OPEN
    }

    private final AtomicReference<CircuitState> state = new AtomicReference<>(CircuitState.CLOSED);
    private final AtomicInteger consecutiveFailures = new AtomicInteger(0);
    private final AtomicInteger consecutiveSuccessesInHalfOpen = new AtomicInteger(0);
    private final AtomicInteger halfOpenCallCount = new AtomicInteger(0);
    private final AtomicLong lastStateChangeTime = new AtomicLong(System.currentTimeMillis());

    // 统计指标
    private final AtomicLong totalRequests = new AtomicLong(0);
    private final AtomicLong totalFailures = new AtomicLong(0);
    private final AtomicLong totalCircuitBroken = new AtomicLong(0);

    @Value("${python-smartbi.circuit-breaker.failure-threshold:5}")
    private int failureThreshold;

    // 2026-04-29: 30000 → 10000. Python OOM-kill 后 systemd 5s 自动重启 + 启动 ~3-5s,
    // 实际恢复时间 ~10s。30s cooldown 让客户在 Python 已恢复后仍被秒拒,UX 极差。
    @Value("${python-smartbi.circuit-breaker.open-duration-ms:10000}")
    private long openDurationMs;

    @Value("${python-smartbi.circuit-breaker.half-open-max-calls:2}")
    private int halfOpenMaxCalls;

    @Value("${python-smartbi.circuit-breaker.success-threshold-in-half-open:2}")
    private int successThresholdInHalfOpen;

    /**
     * 判断当前是否允许发起调用
     *
     * @return true 如果允许调用（CLOSED 或 HALF_OPEN 且未超过探测上限）
     */
    public boolean isCallPermitted() {
        CircuitState currentState = state.get();

        switch (currentState) {
            case CLOSED:
                return true;

            case OPEN:
                // 检查是否已超过熔断等待时间，可以转为 HALF_OPEN
                long elapsed = System.currentTimeMillis() - lastStateChangeTime.get();
                if (elapsed >= openDurationMs) {
                    if (state.compareAndSet(CircuitState.OPEN, CircuitState.HALF_OPEN)) {
                        halfOpenCallCount.set(0);
                        consecutiveSuccessesInHalfOpen.set(0);
                        lastStateChangeTime.set(System.currentTimeMillis());
                        log.warn("熔断器状态转换: OPEN → HALF_OPEN (等待 {}ms 后允许探测)", elapsed);
                    }
                    // 转换成功后允许调用（作为第一个探测）
                    return halfOpenCallCount.incrementAndGet() <= halfOpenMaxCalls;
                }
                return false;

            case HALF_OPEN:
                // 限制半开状态下的并发探测数
                return halfOpenCallCount.incrementAndGet() <= halfOpenMaxCalls;

            default:
                return false;
        }
    }

    /**
     * 记录调用成功
     *
     * CLOSED 状态：重置连续失败计数
     * HALF_OPEN 状态：累加连续成功计数，达到阈值则转为 CLOSED
     */
    public void recordSuccess() {
        totalRequests.incrementAndGet();
        CircuitState currentState = state.get();

        if (currentState == CircuitState.CLOSED) {
            consecutiveFailures.set(0);
        } else if (currentState == CircuitState.HALF_OPEN) {
            int successes = consecutiveSuccessesInHalfOpen.incrementAndGet();
            if (successes >= successThresholdInHalfOpen) {
                if (state.compareAndSet(CircuitState.HALF_OPEN, CircuitState.CLOSED)) {
                    consecutiveFailures.set(0);
                    consecutiveSuccessesInHalfOpen.set(0);
                    halfOpenCallCount.set(0);
                    lastStateChangeTime.set(System.currentTimeMillis());
                    log.warn("熔断器状态转换: HALF_OPEN → CLOSED (连续 {} 次探测成功，服务恢复)", successes);
                }
            }
        }
    }

    /**
     * 记录调用失败
     *
     * CLOSED 状态：累加连续失败计数，达到阈值则转为 OPEN
     * HALF_OPEN 状态：任何失败立即转为 OPEN
     */
    public void recordFailure() {
        totalRequests.incrementAndGet();
        totalFailures.incrementAndGet();
        CircuitState currentState = state.get();

        if (currentState == CircuitState.CLOSED) {
            int failures = consecutiveFailures.incrementAndGet();
            if (failures >= failureThreshold) {
                if (state.compareAndSet(CircuitState.CLOSED, CircuitState.OPEN)) {
                    lastStateChangeTime.set(System.currentTimeMillis());
                    totalCircuitBroken.incrementAndGet();
                    log.warn("熔断器状态转换: CLOSED → OPEN (连续 {} 次失败，熔断 {}ms)", failures, openDurationMs);
                }
            }
        } else if (currentState == CircuitState.HALF_OPEN) {
            // HALF_OPEN 下任何失败立即回到 OPEN
            if (state.compareAndSet(CircuitState.HALF_OPEN, CircuitState.OPEN)) {
                consecutiveSuccessesInHalfOpen.set(0);
                halfOpenCallCount.set(0);
                lastStateChangeTime.set(System.currentTimeMillis());
                totalCircuitBroken.incrementAndGet();
                log.warn("熔断器状态转换: HALF_OPEN → OPEN (探测失败，重新熔断 {}ms)", openDurationMs);
            }
        }
    }

    /**
     * 获取当前熔断器状态
     */
    public CircuitState getState() {
        // 检查 OPEN → HALF_OPEN 的时间转换（只读不修改状态）
        if (state.get() == CircuitState.OPEN) {
            long elapsed = System.currentTimeMillis() - lastStateChangeTime.get();
            if (elapsed >= openDurationMs) {
                return CircuitState.HALF_OPEN; // 报告逻辑状态，实际转换在 isCallPermitted 中
            }
        }
        return state.get();
    }

    /**
     * 获取剩余熔断时间（毫秒）
     *
     * @return 剩余等待时间，CLOSED/HALF_OPEN 状态返回 0
     */
    public long getRemainingOpenTimeMs() {
        if (state.get() != CircuitState.OPEN) {
            return 0;
        }
        long elapsed = System.currentTimeMillis() - lastStateChangeTime.get();
        long remaining = openDurationMs - elapsed;
        return Math.max(0, remaining);
    }

    /**
     * 获取监控指标
     *
     * @return 包含状态、计数、配置的指标 Map
     */
    public Map<String, Object> getMetrics() {
        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("state", getState().name());
        metrics.put("consecutiveFailures", consecutiveFailures.get());
        metrics.put("totalRequests", totalRequests.get());
        metrics.put("totalFailures", totalFailures.get());
        metrics.put("totalCircuitBroken", totalCircuitBroken.get());
        metrics.put("remainingOpenTimeMs", getRemainingOpenTimeMs());

        Map<String, Object> config = new LinkedHashMap<>();
        config.put("failureThreshold", failureThreshold);
        config.put("openDurationMs", openDurationMs);
        config.put("halfOpenMaxCalls", halfOpenMaxCalls);
        config.put("successThresholdInHalfOpen", successThresholdInHalfOpen);
        metrics.put("config", config);

        return metrics;
    }
}

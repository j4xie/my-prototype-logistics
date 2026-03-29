package com.cretas.aims.exception;

/**
 * Python 服务不可用异常
 *
 * 当熔断器处于 OPEN 状态时抛出，表示 Python 服务暂时不可用，
 * 调用方应立即失败而非等待超时。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-28
 */
public class PythonServiceUnavailableException extends RuntimeException {

    private final String circuitState;
    private final long retryAfterMs;

    public PythonServiceUnavailableException(String circuitState, long retryAfterMs) {
        super(String.format(
                "Python 服务暂时不可用 (熔断器状态: %s)，请 %.1f 秒后重试",
                circuitState, retryAfterMs / 1000.0));
        this.circuitState = circuitState;
        this.retryAfterMs = retryAfterMs;
    }

    public PythonServiceUnavailableException(String circuitState, long retryAfterMs, Throwable cause) {
        super(String.format(
                "Python 服务暂时不可用 (熔断器状态: %s)，请 %.1f 秒后重试",
                circuitState, retryAfterMs / 1000.0), cause);
        this.circuitState = circuitState;
        this.retryAfterMs = retryAfterMs;
    }

    public String getCircuitState() {
        return circuitState;
    }

    public long getRetryAfterMs() {
        return retryAfterMs;
    }
}

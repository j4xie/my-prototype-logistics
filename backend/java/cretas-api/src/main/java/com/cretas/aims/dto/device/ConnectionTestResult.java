package com.cretas.aims.dto.device;

import lombok.*;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Connection Test Result DTO
 *
 * Represents the result of testing a device connection.
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-05
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConnectionTestResult {

    /**
     * Device ID
     */
    private String deviceId;

    /**
     * Device type
     */
    private String deviceType;

    /**
     * Device name
     */
    private String deviceName;

    /**
     * Whether connection test succeeded
     */
    private Boolean success;

    /**
     * Response time in milliseconds
     */
    private Long responseTimeMs;

    /**
     * Test timestamp
     */
    private LocalDateTime testedAt;

    // ==================== Diagnostics ====================

    /**
     * Error code (if failed)
     */
    private String errorCode;

    /**
     * Error message (if failed)
     */
    private String errorMessage;

    /**
     * Detailed diagnostics information
     */
    private Map<String, Object> diagnostics;

    // ==================== Network Info ====================

    /**
     * IP address tested
     */
    private String ipAddress;

    /**
     * Port tested
     */
    private Integer port;

    /**
     * Protocol used for test
     */
    private String protocol;

    /**
     * Whether IP is reachable (ping test)
     */
    private Boolean ipReachable;

    /**
     * Whether port is open
     */
    private Boolean portOpen;

    /**
     * Whether authentication succeeded
     */
    private Boolean authSucceeded;

    // ==================== Factory Methods ====================

    /**
     * Create a successful connection test result
     */
    public static ConnectionTestResult success(String deviceId, String deviceType, String deviceName, long responseTimeMs) {
        return ConnectionTestResult.builder()
                .deviceId(deviceId)
                .deviceType(deviceType)
                .deviceName(deviceName)
                .success(true)
                .responseTimeMs(responseTimeMs)
                .testedAt(LocalDateTime.now())
                .ipReachable(true)
                .portOpen(true)
                .authSucceeded(true)
                .build();
    }

    /**
     * Create a failed connection test result
     */
    public static ConnectionTestResult failure(String deviceId, String deviceType, String deviceName,
                                                 String errorCode, String errorMessage) {
        return ConnectionTestResult.builder()
                .deviceId(deviceId)
                .deviceType(deviceType)
                .deviceName(deviceName)
                .success(false)
                .errorCode(errorCode)
                .errorMessage(errorMessage)
                .testedAt(LocalDateTime.now())
                .build();
    }

    /**
     * Create a timeout result
     */
    public static ConnectionTestResult timeout(String deviceId, String deviceType, String deviceName, int timeoutMs) {
        return ConnectionTestResult.builder()
                .deviceId(deviceId)
                .deviceType(deviceType)
                .deviceName(deviceName)
                .success(false)
                .errorCode("TIMEOUT")
                .errorMessage("Connection timed out after " + timeoutMs + "ms")
                .testedAt(LocalDateTime.now())
                .ipReachable(false)
                .build();
    }

    /**
     * Create an authentication failure result
     */
    public static ConnectionTestResult authFailure(String deviceId, String deviceType, String deviceName) {
        return ConnectionTestResult.builder()
                .deviceId(deviceId)
                .deviceType(deviceType)
                .deviceName(deviceName)
                .success(false)
                .errorCode("AUTH_FAILED")
                .errorMessage("Authentication failed - invalid credentials")
                .testedAt(LocalDateTime.now())
                .ipReachable(true)
                .portOpen(true)
                .authSucceeded(false)
                .build();
    }
}

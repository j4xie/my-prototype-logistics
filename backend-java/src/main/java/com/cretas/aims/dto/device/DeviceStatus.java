package com.cretas.aims.dto.device;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * Device Status DTO
 *
 * Represents the current status of a device with type-specific details.
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-05
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceStatus {

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

    // ==================== General Status ====================

    /**
     * Status code (ONLINE, OFFLINE, ERROR, IDLE, ACTIVE, MAINTENANCE, UNKNOWN)
     */
    private String status;

    /**
     * Status display label (localized)
     */
    private String statusLabel;

    /**
     * Last error message
     */
    private String lastError;

    /**
     * Status timestamp
     */
    private LocalDateTime statusAt;

    /**
     * Last heartbeat time
     */
    private LocalDateTime lastHeartbeatAt;

    /**
     * Uptime in seconds (if applicable)
     */
    private Long uptimeSeconds;

    // ==================== Scale-Specific ====================

    /**
     * Current weight reading (for scales)
     */
    private BigDecimal currentWeight;

    /**
     * Weight unit (kg, g, lb, etc.)
     */
    private String weightUnit;

    /**
     * Whether reading is stable (for scales)
     */
    private Boolean isStable;

    /**
     * Tare value (for scales)
     */
    private BigDecimal tareValue;

    /**
     * Zero reference (for scales)
     */
    private BigDecimal zeroReference;

    // ==================== Camera-Specific ====================

    /**
     * Number of channels (for multi-channel cameras)
     */
    private Integer channelCount;

    /**
     * Recording status (for cameras)
     */
    private Boolean isRecording;

    /**
     * Storage usage percentage (for NVRs)
     */
    private Double storageUsagePercent;

    /**
     * Currently active alarms (for cameras)
     */
    private Integer activeAlarms;

    // ==================== Connection Status ====================

    /**
     * Connection quality (EXCELLENT, GOOD, FAIR, POOR)
     */
    private String connectionQuality;

    /**
     * Signal strength (for wireless devices)
     */
    private Integer signalStrength;

    /**
     * Last communication error
     */
    private String lastCommunicationError;

    // ==================== Extended Status ====================

    /**
     * Additional status information map
     */
    private Map<String, Object> extendedStatus;

    // ==================== Factory Methods ====================

    /**
     * Create online status
     */
    public static DeviceStatus online(String deviceId, String deviceType, String deviceName) {
        return DeviceStatus.builder()
                .deviceId(deviceId)
                .deviceType(deviceType)
                .deviceName(deviceName)
                .status("ONLINE")
                .statusLabel("Online")
                .statusAt(LocalDateTime.now())
                .connectionQuality("GOOD")
                .build();
    }

    /**
     * Create offline status
     */
    public static DeviceStatus offline(String deviceId, String deviceType, String deviceName, String reason) {
        return DeviceStatus.builder()
                .deviceId(deviceId)
                .deviceType(deviceType)
                .deviceName(deviceName)
                .status("OFFLINE")
                .statusLabel("Offline")
                .lastError(reason)
                .statusAt(LocalDateTime.now())
                .build();
    }

    /**
     * Create error status
     */
    public static DeviceStatus error(String deviceId, String deviceType, String deviceName, String errorMessage) {
        return DeviceStatus.builder()
                .deviceId(deviceId)
                .deviceType(deviceType)
                .deviceName(deviceName)
                .status("ERROR")
                .statusLabel("Error")
                .lastError(errorMessage)
                .statusAt(LocalDateTime.now())
                .build();
    }

    /**
     * Create scale status with weight reading
     */
    public static DeviceStatus scaleReading(String deviceId, String deviceName,
                                             BigDecimal weight, String unit, boolean stable) {
        return DeviceStatus.builder()
                .deviceId(deviceId)
                .deviceType("SCALE")
                .deviceName(deviceName)
                .status("ONLINE")
                .statusLabel("Online")
                .currentWeight(weight)
                .weightUnit(unit)
                .isStable(stable)
                .statusAt(LocalDateTime.now())
                .connectionQuality("GOOD")
                .build();
    }

    /**
     * Create camera status
     */
    public static DeviceStatus cameraStatus(String deviceId, String deviceName,
                                             int channelCount, boolean recording, int activeAlarms) {
        return DeviceStatus.builder()
                .deviceId(deviceId)
                .deviceType("ISAPI")
                .deviceName(deviceName)
                .status("ONLINE")
                .statusLabel("Online")
                .channelCount(channelCount)
                .isRecording(recording)
                .activeAlarms(activeAlarms)
                .statusAt(LocalDateTime.now())
                .connectionQuality("GOOD")
                .build();
    }
}

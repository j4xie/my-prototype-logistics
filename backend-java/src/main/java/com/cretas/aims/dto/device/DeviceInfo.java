package com.cretas.aims.dto.device;

import lombok.*;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Unified Device Information DTO
 *
 * Represents device information from various sources:
 * - ISAPI devices (cameras/NVRs)
 * - IoT scales
 * - Factory equipment
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-05
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceInfo {

    /**
     * Device ID (source-specific format)
     */
    private String deviceId;

    /**
     * Device type (ISAPI, SCALE, EQUIPMENT)
     */
    private String deviceType;

    /**
     * Device code (unique within factory)
     */
    private String deviceCode;

    /**
     * Device name
     */
    private String deviceName;

    /**
     * Factory ID
     */
    private String factoryId;

    // ==================== Device Details ====================

    /**
     * Device model
     */
    private String model;

    /**
     * Device manufacturer/brand
     */
    private String manufacturer;

    /**
     * Device serial number
     */
    private String serialNumber;

    /**
     * Firmware version
     */
    private String firmwareVersion;

    // ==================== Connection Info ====================

    /**
     * IP address (for network devices)
     */
    private String ipAddress;

    /**
     * Port number
     */
    private Integer port;

    /**
     * Serial port (for serial devices)
     */
    private String serialPort;

    /**
     * Connection protocol (HTTP, HTTPS, SERIAL, MQTT, etc.)
     */
    private String protocol;

    // ==================== Location ====================

    /**
     * Location description
     */
    private String location;

    /**
     * Department ID
     */
    private String departmentId;

    /**
     * Associated equipment ID (for sub-devices)
     */
    private String parentEquipmentId;

    // ==================== Status ====================

    /**
     * Current status (ONLINE, OFFLINE, ERROR, UNKNOWN, etc.)
     */
    private String status;

    /**
     * Last error message
     */
    private String lastError;

    /**
     * Last heartbeat time
     */
    private LocalDateTime lastHeartbeatAt;

    /**
     * Last activity time
     */
    private LocalDateTime lastActivityAt;

    // ==================== Capabilities ====================

    /**
     * Device capabilities map
     */
    private Map<String, Object> capabilities;

    /**
     * Whether device supports capture (for cameras/vision devices)
     */
    private Boolean supportsCapture;

    /**
     * Whether device supports real-time streaming
     */
    private Boolean supportsStreaming;

    // ==================== Metadata ====================

    /**
     * Created timestamp
     */
    private LocalDateTime createdAt;

    /**
     * Updated timestamp
     */
    private LocalDateTime updatedAt;

    /**
     * Additional metadata
     */
    private Map<String, Object> metadata;

    // ==================== Factory Methods ====================

    /**
     * Create a basic DeviceInfo from minimal data
     */
    public static DeviceInfo basic(String deviceId, String deviceType, String deviceName, String status) {
        return DeviceInfo.builder()
                .deviceId(deviceId)
                .deviceType(deviceType)
                .deviceName(deviceName)
                .status(status)
                .build();
    }

    /**
     * Create DeviceInfo for an ISAPI device
     */
    public static DeviceInfo fromIsapi(String deviceId, String name, String ip, Integer port,
                                        String model, String status) {
        return DeviceInfo.builder()
                .deviceId(deviceId)
                .deviceType("ISAPI")
                .deviceName(name)
                .ipAddress(ip)
                .port(port)
                .model(model)
                .status(status)
                .protocol("HTTP")
                .supportsCapture(true)
                .supportsStreaming(true)
                .build();
    }

    /**
     * Create DeviceInfo for a scale device
     */
    public static DeviceInfo fromScale(Long equipmentId, String code, String name,
                                        String manufacturer, String model, String status) {
        return DeviceInfo.builder()
                .deviceId(String.valueOf(equipmentId))
                .deviceType("SCALE")
                .deviceCode(code)
                .deviceName(name)
                .manufacturer(manufacturer)
                .model(model)
                .status(status)
                .supportsCapture(false)
                .supportsStreaming(false)
                .build();
    }
}

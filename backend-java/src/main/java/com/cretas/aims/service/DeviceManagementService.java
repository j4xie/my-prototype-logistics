package com.cretas.aims.service;

import com.cretas.aims.dto.device.DeviceInfo;
import com.cretas.aims.dto.device.ConnectionTestResult;
import com.cretas.aims.dto.device.DeviceStatus;

import java.util.List;

/**
 * Unified Device Management Service Interface
 *
 * Provides a common interface for managing different types of devices:
 * - ISAPI devices (cameras)
 * - IoT scales
 * - Factory equipment
 *
 * This service delegates to specific device services based on device type.
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-05
 */
public interface DeviceManagementService {

    // ==================== Device Types ====================

    /**
     * Supported device types
     */
    String DEVICE_TYPE_ISAPI = "ISAPI";           // ISAPI cameras and NVRs (network)
    String DEVICE_TYPE_CAMERA_SDK = "CAMERA_SDK"; // SDK cameras (local USB/GigE)
    String DEVICE_TYPE_SCALE = "SCALE";           // IoT electronic scales
    String DEVICE_TYPE_EQUIPMENT = "EQUIPMENT";   // General factory equipment

    // ==================== Generic Device Info ====================

    /**
     * Get device information by ID and type
     *
     * @param deviceId   Device ID (format depends on device type)
     * @param deviceType Device type (ISAPI, SCALE, EQUIPMENT)
     * @return DeviceInfo or null if not found
     */
    DeviceInfo getDevice(String deviceId, String deviceType);

    /**
     * List all devices of a specific type for a factory
     *
     * @param factoryId  Factory ID
     * @param deviceType Device type (ISAPI, SCALE, EQUIPMENT, or null for all)
     * @return List of DeviceInfo
     */
    List<DeviceInfo> listDevices(String factoryId, String deviceType);

    /**
     * Search devices by keyword
     *
     * @param factoryId  Factory ID
     * @param deviceType Device type (optional, null for all types)
     * @param keyword    Search keyword (matches name, code, location)
     * @return List of matching DeviceInfo
     */
    List<DeviceInfo> searchDevices(String factoryId, String deviceType, String keyword);

    // ==================== Connection Management ====================

    /**
     * Test device connection
     *
     * For ISAPI: Tests HTTP/HTTPS connection to the device
     * For SCALE: Tests serial port or network connection
     * For EQUIPMENT: Returns basic status check
     *
     * @param deviceId   Device ID
     * @param deviceType Device type
     * @return ConnectionTestResult with success status and diagnostics
     */
    ConnectionTestResult testConnection(String deviceId, String deviceType);

    /**
     * Batch test connections for multiple devices
     *
     * @param factoryId  Factory ID
     * @param deviceType Device type (optional, null for all types)
     * @return List of ConnectionTestResult for all devices
     */
    List<ConnectionTestResult> batchTestConnections(String factoryId, String deviceType);

    // ==================== Device Operations ====================

    /**
     * Capture image from device (applicable to cameras and some scales with cameras)
     *
     * @param deviceId  Device ID
     * @param channelId Channel ID (for multi-channel devices, use 1 for single-channel)
     * @return Captured image as byte array, or null if not supported/failed
     */
    byte[] capture(String deviceId, int channelId);

    /**
     * Get current device status
     *
     * @param deviceId   Device ID
     * @param deviceType Device type
     * @return DeviceStatus with current status information
     */
    DeviceStatus getStatus(String deviceId, String deviceType);

    /**
     * Get status statistics for all devices in a factory
     *
     * @param factoryId  Factory ID
     * @param deviceType Device type (optional, null for all types)
     * @return Statistics map with status counts
     */
    java.util.Map<String, Long> getStatusStatistics(String factoryId, String deviceType);

    // ==================== Device Type Detection ====================

    /**
     * Detect device type from device ID
     * Uses naming conventions and database lookups
     *
     * @param deviceId Device ID
     * @return Detected device type, or null if unknown
     */
    String detectDeviceType(String deviceId);

    /**
     * Check if a device type is supported
     *
     * @param deviceType Device type to check
     * @return true if supported
     */
    boolean isDeviceTypeSupported(String deviceType);
}

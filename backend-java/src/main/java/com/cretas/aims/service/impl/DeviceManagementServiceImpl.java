package com.cretas.aims.service.impl;

import com.cretas.aims.dto.camera.CameraDeviceInfo;
import com.cretas.aims.dto.camera.CaptureImageResponse;
import com.cretas.aims.dto.device.ConnectionTestResult;
import com.cretas.aims.dto.device.DeviceInfo;
import com.cretas.aims.dto.device.DeviceStatus;
import com.cretas.aims.entity.FactoryEquipment;
import com.cretas.aims.entity.common.UnifiedDeviceType;
import com.cretas.aims.entity.isapi.IsapiDevice;
import com.cretas.aims.repository.EquipmentRepository;
import com.cretas.aims.repository.isapi.IsapiDeviceRepository;
import com.cretas.aims.service.CameraService;
import com.cretas.aims.service.DeviceManagementService;
import com.cretas.aims.service.EquipmentService;
import com.cretas.aims.service.isapi.IsapiDeviceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Unified Device Management Service Implementation
 *
 * Delegates to specific device services:
 * - IsapiDeviceService for ISAPI devices (cameras)
 * - EquipmentService for factory equipment
 * - Direct repository access for IoT scales
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-05
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DeviceManagementServiceImpl implements DeviceManagementService {

    private final IsapiDeviceService isapiDeviceService;
    private final CameraService cameraService;
    private final EquipmentService equipmentService;
    private final IsapiDeviceRepository isapiDeviceRepository;
    private final EquipmentRepository equipmentRepository;

    // Supported device types
    private static final Set<String> SUPPORTED_TYPES = Set.of(
            DEVICE_TYPE_ISAPI,
            DEVICE_TYPE_CAMERA_SDK,
            DEVICE_TYPE_SCALE,
            DEVICE_TYPE_EQUIPMENT
    );

    // ==================== Device Info ====================

    @Override
    public DeviceInfo getDevice(String deviceId, String deviceType) {
        if (deviceId == null || deviceType == null) {
            return null;
        }

        try {
            switch (deviceType.toUpperCase()) {
                case DEVICE_TYPE_ISAPI:
                    return getIsapiDeviceInfo(deviceId);

                case DEVICE_TYPE_CAMERA_SDK:
                    return getSdkCameraInfo(deviceId);

                case DEVICE_TYPE_SCALE:
                    return getScaleDeviceInfo(deviceId);

                case DEVICE_TYPE_EQUIPMENT:
                    return getEquipmentInfo(deviceId);

                default:
                    log.warn("Unknown device type: {}", deviceType);
                    return null;
            }
        } catch (Exception e) {
            log.error("Error getting device info: deviceId={}, type={}, error={}",
                    deviceId, deviceType, e.getMessage());
            return null;
        }
    }

    @Override
    public List<DeviceInfo> listDevices(String factoryId, String deviceType) {
        if (factoryId == null) {
            return Collections.emptyList();
        }

        List<DeviceInfo> result = new ArrayList<>();

        try {
            if (deviceType == null || deviceType.equalsIgnoreCase(DEVICE_TYPE_ISAPI)) {
                result.addAll(listIsapiDevices(factoryId));
            }

            if (deviceType == null || deviceType.equalsIgnoreCase(DEVICE_TYPE_CAMERA_SDK)) {
                result.addAll(listSdkCameras());
            }

            if (deviceType == null || deviceType.equalsIgnoreCase(DEVICE_TYPE_SCALE)) {
                result.addAll(listScaleDevices(factoryId));
            }

            if (deviceType == null || deviceType.equalsIgnoreCase(DEVICE_TYPE_EQUIPMENT)) {
                result.addAll(listEquipmentDevices(factoryId));
            }

            return result;

        } catch (Exception e) {
            log.error("Error listing devices: factoryId={}, type={}, error={}",
                    factoryId, deviceType, e.getMessage());
            return result;
        }
    }

    @Override
    public List<DeviceInfo> searchDevices(String factoryId, String deviceType, String keyword) {
        if (factoryId == null || keyword == null || keyword.isEmpty()) {
            return listDevices(factoryId, deviceType);
        }

        String lowerKeyword = keyword.toLowerCase();

        return listDevices(factoryId, deviceType).stream()
                .filter(device -> matchesKeyword(device, lowerKeyword))
                .collect(Collectors.toList());
    }

    // ==================== Connection Management ====================

    @Override
    public ConnectionTestResult testConnection(String deviceId, String deviceType) {
        if (deviceId == null || deviceType == null) {
            return ConnectionTestResult.failure(deviceId, deviceType, "Unknown",
                    "INVALID_PARAMS", "Device ID and type are required");
        }

        try {
            long startTime = System.currentTimeMillis();

            switch (deviceType.toUpperCase()) {
                case DEVICE_TYPE_ISAPI:
                    return testIsapiConnection(deviceId, startTime);

                case DEVICE_TYPE_CAMERA_SDK:
                    return testSdkCameraConnection(deviceId, startTime);

                case DEVICE_TYPE_SCALE:
                    return testScaleConnection(deviceId, startTime);

                case DEVICE_TYPE_EQUIPMENT:
                    return testEquipmentConnection(deviceId, startTime);

                default:
                    return ConnectionTestResult.failure(deviceId, deviceType, "Unknown",
                            "UNSUPPORTED_TYPE", "Device type not supported: " + deviceType);
            }
        } catch (Exception e) {
            log.error("Error testing connection: deviceId={}, type={}, error={}",
                    deviceId, deviceType, e.getMessage());
            return ConnectionTestResult.failure(deviceId, deviceType, "Unknown",
                    "TEST_ERROR", e.getMessage());
        }
    }

    @Override
    public List<ConnectionTestResult> batchTestConnections(String factoryId, String deviceType) {
        List<DeviceInfo> devices = listDevices(factoryId, deviceType);

        return devices.stream()
                .map(device -> testConnection(device.getDeviceId(), device.getDeviceType()))
                .collect(Collectors.toList());
    }

    // ==================== Device Operations ====================

    @Override
    public byte[] capture(String deviceId, int channelId) {
        if (deviceId == null) {
            return null;
        }

        try {
            // Detect device type and delegate to appropriate service
            String deviceType = detectDeviceType(deviceId);

            if (DEVICE_TYPE_ISAPI.equals(deviceType)) {
                // ISAPI network camera capture
                var captureResult = isapiDeviceService.capturePicture(deviceId, channelId);
                if (captureResult != null && Boolean.TRUE.equals(captureResult.getSuccess())
                        && captureResult.getPictureBase64() != null) {
                    return Base64.getDecoder().decode(captureResult.getPictureBase64());
                }
            } else if (DEVICE_TYPE_CAMERA_SDK.equals(deviceType) || deviceType == null) {
                // SDK local camera capture (also try if type unknown)
                if (cameraService.isConnected()) {
                    CaptureImageResponse sdkResult = cameraService.captureImage();
                    if (sdkResult != null && sdkResult.getImageData() != null) {
                        return sdkResult.getImageData();
                    }
                }
            }

            // Fallback: try ISAPI if detection failed
            if (deviceType == null) {
                var captureResult = isapiDeviceService.capturePicture(deviceId, channelId);
                if (captureResult != null && Boolean.TRUE.equals(captureResult.getSuccess())
                        && captureResult.getPictureBase64() != null) {
                    return Base64.getDecoder().decode(captureResult.getPictureBase64());
                }
            }

            log.warn("Capture not supported or failed for device: {}", deviceId);
            return null;

        } catch (Exception e) {
            log.error("Error capturing from device: deviceId={}, channelId={}, error={}",
                    deviceId, channelId, e.getMessage());
            return null;
        }
    }

    @Override
    public DeviceStatus getStatus(String deviceId, String deviceType) {
        if (deviceId == null || deviceType == null) {
            return DeviceStatus.offline(deviceId, deviceType, "Unknown", "Invalid parameters");
        }

        try {
            switch (deviceType.toUpperCase()) {
                case DEVICE_TYPE_ISAPI:
                    return getIsapiStatus(deviceId);

                case DEVICE_TYPE_CAMERA_SDK:
                    return getSdkCameraStatus(deviceId);

                case DEVICE_TYPE_SCALE:
                    return getScaleStatus(deviceId);

                case DEVICE_TYPE_EQUIPMENT:
                    return getEquipmentStatus(deviceId);

                default:
                    return DeviceStatus.offline(deviceId, deviceType, "Unknown",
                            "Unsupported device type");
            }
        } catch (Exception e) {
            log.error("Error getting device status: deviceId={}, type={}, error={}",
                    deviceId, deviceType, e.getMessage());
            return DeviceStatus.error(deviceId, deviceType, "Unknown", e.getMessage());
        }
    }

    @Override
    public Map<String, Long> getStatusStatistics(String factoryId, String deviceType) {
        Map<String, Long> stats = new HashMap<>();

        List<DeviceInfo> devices = listDevices(factoryId, deviceType);

        devices.stream()
                .filter(d -> d.getStatus() != null)
                .collect(Collectors.groupingBy(
                        d -> d.getStatus().toUpperCase(),
                        Collectors.counting()))
                .forEach(stats::put);

        return stats;
    }

    // ==================== Device Type Detection ====================

    @Override
    public String detectDeviceType(String deviceId) {
        if (deviceId == null) {
            return null;
        }

        // Check naming conventions first
        if (deviceId.toUpperCase().startsWith("SCALE-") ||
            deviceId.toUpperCase().contains("IOT_SCALE")) {
            return DEVICE_TYPE_SCALE;
        }

        // Check if it's a UUID (ISAPI devices use UUIDs)
        if (deviceId.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")) {
            if (isapiDeviceRepository.existsById(deviceId)) {
                return DEVICE_TYPE_ISAPI;
            }
        }

        // Check if it's a numeric ID (equipment uses Long IDs)
        try {
            Long equipmentId = Long.parseLong(deviceId);
            if (equipmentRepository.existsById(equipmentId)) {
                var equipment = equipmentRepository.findById(equipmentId);
                if (equipment.isPresent()) {
                    if (equipment.get().getUnifiedDeviceType() == UnifiedDeviceType.SCALE) {
                        return DEVICE_TYPE_SCALE;
                    }
                    return DEVICE_TYPE_EQUIPMENT;
                }
            }
        } catch (NumberFormatException ignored) {
            // Not a numeric ID
        }

        return null;
    }

    @Override
    public boolean isDeviceTypeSupported(String deviceType) {
        return deviceType != null && SUPPORTED_TYPES.contains(deviceType.toUpperCase());
    }

    // ==================== Private Helper Methods - ISAPI ====================

    private DeviceInfo getIsapiDeviceInfo(String deviceId) {
        IsapiDevice device = isapiDeviceService.getDevice(deviceId);
        if (device == null) {
            return null;
        }
        return convertIsapiToDeviceInfo(device);
    }

    private List<DeviceInfo> listIsapiDevices(String factoryId) {
        return isapiDeviceRepository.findByFactoryId(factoryId, PageRequest.of(0, 1000))
                .getContent()
                .stream()
                .map(this::convertIsapiToDeviceInfo)
                .collect(Collectors.toList());
    }

    private DeviceInfo convertIsapiToDeviceInfo(IsapiDevice device) {
        return DeviceInfo.builder()
                .deviceId(device.getId())
                .deviceType(DEVICE_TYPE_ISAPI)
                .deviceCode(device.getSerialNumber())
                .deviceName(device.getDeviceName())
                .factoryId(device.getFactoryId())
                .model(device.getDeviceModel())
                .manufacturer(device.getUnifiedDeviceType() != null ? device.getUnifiedDeviceType().name() : null)
                .serialNumber(device.getSerialNumber())
                .firmwareVersion(device.getFirmwareVersion())
                .ipAddress(device.getIpAddress())
                .port(device.getPort())
                .protocol(device.getProtocol() != null ? device.getProtocol().name() : "HTTP")
                .location(device.getLocationDescription())
                .departmentId(device.getDepartmentId())
                .parentEquipmentId(device.getEquipmentId() != null ? String.valueOf(device.getEquipmentId()) : null)
                .status(device.getStatus() != null ? device.getStatus().name() : "UNKNOWN")
                .lastError(device.getLastError())
                .lastHeartbeatAt(device.getLastHeartbeatAt())
                .lastActivityAt(device.getLastEventAt())
                .supportsCapture(true)
                .supportsStreaming(true)
                .capabilities(device.getDeviceCapabilities())
                .createdAt(device.getCreatedAt())
                .updatedAt(device.getUpdatedAt())
                .build();
    }

    private ConnectionTestResult testIsapiConnection(String deviceId, long startTime) {
        IsapiDevice device = isapiDeviceService.getDevice(deviceId);
        if (device == null) {
            return ConnectionTestResult.failure(deviceId, DEVICE_TYPE_ISAPI, "Unknown",
                    "NOT_FOUND", "Device not found");
        }

        boolean success = isapiDeviceService.testConnection(deviceId);
        long responseTime = System.currentTimeMillis() - startTime;

        if (success) {
            return ConnectionTestResult.builder()
                    .deviceId(deviceId)
                    .deviceType(DEVICE_TYPE_ISAPI)
                    .deviceName(device.getDeviceName())
                    .success(true)
                    .responseTimeMs(responseTime)
                    .ipAddress(device.getIpAddress())
                    .port(device.getPort())
                    .protocol(device.getProtocol() != null ? device.getProtocol().name() : "HTTP")
                    .ipReachable(true)
                    .portOpen(true)
                    .authSucceeded(true)
                    .testedAt(java.time.LocalDateTime.now())
                    .build();
        } else {
            return ConnectionTestResult.failure(deviceId, DEVICE_TYPE_ISAPI, device.getDeviceName(),
                    "CONNECTION_FAILED", device.getLastError());
        }
    }

    private DeviceStatus getIsapiStatus(String deviceId) {
        IsapiDevice device = isapiDeviceService.getDevice(deviceId);
        if (device == null) {
            return DeviceStatus.offline(deviceId, DEVICE_TYPE_ISAPI, "Unknown", "Device not found");
        }

        return DeviceStatus.builder()
                .deviceId(deviceId)
                .deviceType(DEVICE_TYPE_ISAPI)
                .deviceName(device.getDeviceName())
                .status(device.getStatus() != null ? device.getStatus().name() : "UNKNOWN")
                .statusLabel(getStatusLabel(device.getStatus() != null ? device.getStatus().name() : "UNKNOWN"))
                .lastError(device.getLastError())
                .statusAt(java.time.LocalDateTime.now())
                .lastHeartbeatAt(device.getLastHeartbeatAt())
                .channelCount(device.getChannelCount())
                .connectionQuality(device.getStatus() == IsapiDevice.DeviceStatus.ONLINE ? "GOOD" : "POOR")
                .build();
    }

    // ==================== Private Helper Methods - Scale ====================

    private DeviceInfo getScaleDeviceInfo(String deviceId) {
        try {
            Long id = Long.parseLong(deviceId);
            return equipmentRepository.findById(id)
                    .filter(e -> e.getUnifiedDeviceType() == UnifiedDeviceType.SCALE)
                    .map(this::convertScaleToDeviceInfo)
                    .orElse(null);
        } catch (NumberFormatException e) {
            // Try by equipment code
            return equipmentRepository.findAll().stream()
                    .filter(eq -> eq.getUnifiedDeviceType() == UnifiedDeviceType.SCALE)
                    .filter(eq -> deviceId.equalsIgnoreCase(eq.getEquipmentCode()) ||
                                  deviceId.equalsIgnoreCase(eq.getIotDeviceCode()))
                    .findFirst()
                    .map(this::convertScaleToDeviceInfo)
                    .orElse(null);
        }
    }

    private List<DeviceInfo> listScaleDevices(String factoryId) {
        return equipmentRepository.findByFactoryId(factoryId).stream()
                .filter(e -> e.getUnifiedDeviceType() == UnifiedDeviceType.SCALE)
                .map(this::convertScaleToDeviceInfo)
                .collect(Collectors.toList());
    }

    private DeviceInfo convertScaleToDeviceInfo(FactoryEquipment equipment) {
        return DeviceInfo.builder()
                .deviceId(String.valueOf(equipment.getId()))
                .deviceType(DEVICE_TYPE_SCALE)
                .deviceCode(equipment.getEquipmentCode())
                .deviceName(equipment.getEquipmentName())
                .factoryId(equipment.getFactoryId())
                .model(equipment.getModel())
                .manufacturer(equipment.getManufacturer())
                .serialNumber(equipment.getSerialNumber())
                .location(equipment.getLocation())
                .status(equipment.getStatus())
                .lastActivityAt(equipment.getLastWeightTime())
                .supportsCapture(false)
                .supportsStreaming(false)
                .createdAt(equipment.getCreatedAt())
                .updatedAt(equipment.getUpdatedAt())
                .metadata(Map.of(
                        "iotDeviceCode", equipment.getIotDeviceCode() != null ? equipment.getIotDeviceCode() : "",
                        "brandModelId", equipment.getScaleBrandModelId() != null ? equipment.getScaleBrandModelId() : "",
                        "protocolId", equipment.getScaleProtocolId() != null ? equipment.getScaleProtocolId() : ""
                ))
                .build();
    }

    private ConnectionTestResult testScaleConnection(String deviceId, long startTime) {
        DeviceInfo device = getScaleDeviceInfo(deviceId);
        if (device == null) {
            return ConnectionTestResult.failure(deviceId, DEVICE_TYPE_SCALE, "Unknown",
                    "NOT_FOUND", "Scale device not found");
        }

        // For scales, we can only check if it has recent activity
        // Real connection testing would require hardware integration
        long responseTime = System.currentTimeMillis() - startTime;

        // Check if device has recent heartbeat
        if (device.getLastActivityAt() != null &&
            device.getLastActivityAt().isAfter(java.time.LocalDateTime.now().minusMinutes(5))) {
            return ConnectionTestResult.builder()
                    .deviceId(deviceId)
                    .deviceType(DEVICE_TYPE_SCALE)
                    .deviceName(device.getDeviceName())
                    .success(true)
                    .responseTimeMs(responseTime)
                    .testedAt(java.time.LocalDateTime.now())
                    .diagnostics(Map.of(
                            "note", "Status based on last activity time",
                            "lastActivity", device.getLastActivityAt().toString()
                    ))
                    .build();
        }

        return ConnectionTestResult.builder()
                .deviceId(deviceId)
                .deviceType(DEVICE_TYPE_SCALE)
                .deviceName(device.getDeviceName())
                .success("active".equalsIgnoreCase(device.getStatus()) ||
                         "idle".equalsIgnoreCase(device.getStatus()))
                .responseTimeMs(responseTime)
                .testedAt(java.time.LocalDateTime.now())
                .diagnostics(Map.of(
                        "note", "Status based on device status field",
                        "status", device.getStatus() != null ? device.getStatus() : "unknown"
                ))
                .build();
    }

    private DeviceStatus getScaleStatus(String deviceId) {
        try {
            Long id = Long.parseLong(deviceId);
            return equipmentRepository.findById(id)
                    .filter(e -> e.getUnifiedDeviceType() == UnifiedDeviceType.SCALE)
                    .map(equipment -> DeviceStatus.builder()
                            .deviceId(deviceId)
                            .deviceType(DEVICE_TYPE_SCALE)
                            .deviceName(equipment.getEquipmentName())
                            .status(equipment.getStatus() != null ? equipment.getStatus().toUpperCase() : "UNKNOWN")
                            .statusLabel(getStatusLabel(equipment.getStatus()))
                            .statusAt(java.time.LocalDateTime.now())
                            .currentWeight(equipment.getLastWeightReading())
                            .weightUnit("kg")
                            .isStable(true)
                            .build())
                    .orElse(DeviceStatus.offline(deviceId, DEVICE_TYPE_SCALE, "Unknown", "Device not found"));
        } catch (NumberFormatException e) {
            return DeviceStatus.offline(deviceId, DEVICE_TYPE_SCALE, "Unknown", "Invalid device ID");
        }
    }

    // ==================== Private Helper Methods - Equipment ====================

    private DeviceInfo getEquipmentInfo(String deviceId) {
        try {
            Long id = Long.parseLong(deviceId);
            return equipmentRepository.findById(id)
                    .filter(e -> e.getUnifiedDeviceType() != UnifiedDeviceType.SCALE) // Exclude scales
                    .map(this::convertEquipmentToDeviceInfo)
                    .orElse(null);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private List<DeviceInfo> listEquipmentDevices(String factoryId) {
        return equipmentRepository.findByFactoryId(factoryId).stream()
                .filter(e -> e.getUnifiedDeviceType() != UnifiedDeviceType.SCALE) // Exclude scales
                .map(this::convertEquipmentToDeviceInfo)
                .collect(Collectors.toList());
    }

    private DeviceInfo convertEquipmentToDeviceInfo(FactoryEquipment equipment) {
        return DeviceInfo.builder()
                .deviceId(String.valueOf(equipment.getId()))
                .deviceType(DEVICE_TYPE_EQUIPMENT)
                .deviceCode(equipment.getEquipmentCode())
                .deviceName(equipment.getEquipmentName())
                .factoryId(equipment.getFactoryId())
                .model(equipment.getModel())
                .manufacturer(equipment.getManufacturer())
                .serialNumber(equipment.getSerialNumber())
                .location(equipment.getLocation())
                .status(equipment.getStatus())
                .supportsCapture(false)
                .supportsStreaming(false)
                .createdAt(equipment.getCreatedAt())
                .updatedAt(equipment.getUpdatedAt())
                .build();
    }

    private ConnectionTestResult testEquipmentConnection(String deviceId, long startTime) {
        DeviceInfo device = getEquipmentInfo(deviceId);
        if (device == null) {
            return ConnectionTestResult.failure(deviceId, DEVICE_TYPE_EQUIPMENT, "Unknown",
                    "NOT_FOUND", "Equipment not found");
        }

        // For general equipment, we can only check status
        long responseTime = System.currentTimeMillis() - startTime;

        boolean success = "active".equalsIgnoreCase(device.getStatus()) ||
                          "idle".equalsIgnoreCase(device.getStatus()) ||
                          "running".equalsIgnoreCase(device.getStatus());

        return ConnectionTestResult.builder()
                .deviceId(deviceId)
                .deviceType(DEVICE_TYPE_EQUIPMENT)
                .deviceName(device.getDeviceName())
                .success(success)
                .responseTimeMs(responseTime)
                .testedAt(java.time.LocalDateTime.now())
                .diagnostics(Map.of(
                        "note", "Status based on equipment status field",
                        "status", device.getStatus() != null ? device.getStatus() : "unknown"
                ))
                .build();
    }

    private DeviceStatus getEquipmentStatus(String deviceId) {
        try {
            Long id = Long.parseLong(deviceId);
            return equipmentRepository.findById(id)
                    .filter(e -> e.getUnifiedDeviceType() != UnifiedDeviceType.SCALE)
                    .map(equipment -> DeviceStatus.builder()
                            .deviceId(deviceId)
                            .deviceType(DEVICE_TYPE_EQUIPMENT)
                            .deviceName(equipment.getEquipmentName())
                            .status(equipment.getStatus() != null ? equipment.getStatus().toUpperCase() : "UNKNOWN")
                            .statusLabel(getStatusLabel(equipment.getStatus()))
                            .statusAt(java.time.LocalDateTime.now())
                            .build())
                    .orElse(DeviceStatus.offline(deviceId, DEVICE_TYPE_EQUIPMENT, "Unknown", "Equipment not found"));
        } catch (NumberFormatException e) {
            return DeviceStatus.offline(deviceId, DEVICE_TYPE_EQUIPMENT, "Unknown", "Invalid device ID");
        }
    }

    // ==================== Private Helper Methods - SDK Camera ====================

    private DeviceInfo getSdkCameraInfo(String deviceId) {
        // SDK cameras are identified by index (0, 1, 2...) or device serial number
        List<CameraDeviceInfo> cameras = cameraService.enumerateDevices();

        for (int i = 0; i < cameras.size(); i++) {
            CameraDeviceInfo cam = cameras.get(i);
            // Match by index or serial number
            if (String.valueOf(i).equals(deviceId) ||
                (cam.getSerialNumber() != null && cam.getSerialNumber().equals(deviceId))) {
                return convertSdkCameraToDeviceInfo(cam, i);
            }
        }
        return null;
    }

    private List<DeviceInfo> listSdkCameras() {
        try {
            List<CameraDeviceInfo> cameras = cameraService.enumerateDevices();
            List<DeviceInfo> result = new ArrayList<>();

            for (int i = 0; i < cameras.size(); i++) {
                result.add(convertSdkCameraToDeviceInfo(cameras.get(i), i));
            }

            return result;
        } catch (Exception e) {
            log.warn("Failed to enumerate SDK cameras: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    private DeviceInfo convertSdkCameraToDeviceInfo(CameraDeviceInfo camera, int index) {
        return DeviceInfo.builder()
                .deviceId(String.valueOf(index))
                .deviceType(DEVICE_TYPE_CAMERA_SDK)
                .deviceCode(camera.getSerialNumber())
                .deviceName(camera.getModelName() != null ? camera.getModelName() : "SDK Camera " + index)
                .model(camera.getModelName())
                .manufacturer(camera.getVendorName())
                .serialNumber(camera.getSerialNumber())
                .ipAddress(camera.getIpAddress())
                .protocol("SDK")
                .status(cameraService.isConnected() ? "ONLINE" : "OFFLINE")
                .supportsCapture(true)
                .supportsStreaming(true)
                .metadata(Map.of(
                        "interfaceType", camera.getInterfaceType() != null ? camera.getInterfaceType() : "",
                        "deviceIndex", String.valueOf(index),
                        "sdkVersion", cameraService.getSdkVersion() != null ? cameraService.getSdkVersion() : ""
                ))
                .build();
    }

    private ConnectionTestResult testSdkCameraConnection(String deviceId, long startTime) {
        DeviceInfo device = getSdkCameraInfo(deviceId);
        String deviceName = device != null ? device.getDeviceName() : "SDK Camera " + deviceId;

        try {
            // Try to connect to the camera by index
            int index = Integer.parseInt(deviceId);
            cameraService.connectCamera(index);

            long responseTime = System.currentTimeMillis() - startTime;

            if (cameraService.isConnected()) {
                return ConnectionTestResult.builder()
                        .deviceId(deviceId)
                        .deviceType(DEVICE_TYPE_CAMERA_SDK)
                        .deviceName(deviceName)
                        .success(true)
                        .responseTimeMs(responseTime)
                        .protocol("SDK")
                        .testedAt(java.time.LocalDateTime.now())
                        .diagnostics(Map.of(
                                "sdkVersion", cameraService.getSdkVersion() != null ? cameraService.getSdkVersion() : "unknown"
                        ))
                        .build();
            } else {
                return ConnectionTestResult.failure(deviceId, DEVICE_TYPE_CAMERA_SDK, deviceName,
                        "CONNECTION_FAILED", "Failed to establish SDK connection");
            }
        } catch (NumberFormatException e) {
            return ConnectionTestResult.failure(deviceId, DEVICE_TYPE_CAMERA_SDK, deviceName,
                    "INVALID_ID", "SDK camera device ID must be numeric index");
        } catch (Exception e) {
            return ConnectionTestResult.failure(deviceId, DEVICE_TYPE_CAMERA_SDK, deviceName,
                    "CONNECTION_ERROR", e.getMessage());
        }
    }

    private DeviceStatus getSdkCameraStatus(String deviceId) {
        DeviceInfo device = getSdkCameraInfo(deviceId);

        if (device == null) {
            return DeviceStatus.offline(deviceId, DEVICE_TYPE_CAMERA_SDK, "Unknown",
                    "SDK camera not found");
        }

        boolean connected = cameraService.isConnected();

        return DeviceStatus.builder()
                .deviceId(deviceId)
                .deviceType(DEVICE_TYPE_CAMERA_SDK)
                .deviceName(device.getDeviceName())
                .status(connected ? "ONLINE" : "OFFLINE")
                .statusLabel(connected ? "Connected" : "Disconnected")
                .statusAt(java.time.LocalDateTime.now())
                .connectionQuality(connected ? "GOOD" : "NONE")
                .build();
    }

    // ==================== Utility Methods ====================

    private boolean matchesKeyword(DeviceInfo device, String lowerKeyword) {
        if (device.getDeviceName() != null &&
            device.getDeviceName().toLowerCase().contains(lowerKeyword)) {
            return true;
        }
        if (device.getDeviceCode() != null &&
            device.getDeviceCode().toLowerCase().contains(lowerKeyword)) {
            return true;
        }
        if (device.getLocation() != null &&
            device.getLocation().toLowerCase().contains(lowerKeyword)) {
            return true;
        }
        if (device.getModel() != null &&
            device.getModel().toLowerCase().contains(lowerKeyword)) {
            return true;
        }
        if (device.getManufacturer() != null &&
            device.getManufacturer().toLowerCase().contains(lowerKeyword)) {
            return true;
        }
        return false;
    }

    private String getStatusLabel(String status) {
        if (status == null) {
            return "Unknown";
        }
        switch (status.toUpperCase()) {
            case "ONLINE":
            case "ACTIVE":
                return "Online";
            case "OFFLINE":
                return "Offline";
            case "IDLE":
                return "Idle";
            case "ERROR":
                return "Error";
            case "MAINTENANCE":
                return "Maintenance";
            case "RUNNING":
                return "Running";
            default:
                return status;
        }
    }
}

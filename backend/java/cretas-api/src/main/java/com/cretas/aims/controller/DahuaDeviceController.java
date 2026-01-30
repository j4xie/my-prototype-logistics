package com.cretas.aims.controller;

import com.cretas.aims.client.dahua.DahuaClient;
import com.cretas.aims.client.dahua.DahuaDiscoveryClient;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.dahua.DahuaDeviceDTO;
import com.cretas.aims.dto.dahua.DahuaProvisioningConfigDTO;
import com.cretas.aims.dto.dahua.DahuaProvisioningResultDTO;
import com.cretas.aims.dto.dahua.DiscoveredDahuaDevice;
import com.cretas.aims.dto.dahua.ImportDahuaDeviceRequest;
import com.cretas.aims.entity.dahua.DahuaDevice;
import com.cretas.aims.entity.dahua.DahuaDevice.DeviceStatus;
import com.cretas.aims.entity.dahua.DahuaDevice.DeviceType;
import com.cretas.aims.entity.dahua.DahuaDevice.Protocol;
import com.cretas.aims.repository.dahua.DahuaDeviceRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Dahua Device Controller
 * 大华摄像头/NVR/DVR 设备管理接口
 *
 * @author Cretas Team
 * @since 2026-01-23
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/dahua/devices")
@RequiredArgsConstructor
@Tag(name = "大华设备管理", description = "大华摄像头/NVR/DVR 设备管理")
public class DahuaDeviceController {

    private final DahuaDeviceRepository deviceRepository;
    private final DahuaClient dahuaClient;
    private final DahuaDiscoveryClient discoveryClient;

    // ==================== 设备发现 ====================

    @PostMapping("/discover")
    @Operation(summary = "发现局域网大华设备", description = "使用 DHDiscover 协议扫描局域网中的大华设备")
    public ApiResponse<List<DiscoveredDahuaDevice>> discoverDevices(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "5000") int timeout) {
        try {
            log.info("开始大华设备发现: factoryId={}, timeout={}ms", factoryId, timeout);
            List<DiscoveredDahuaDevice> devices = discoveryClient.discoverDevices(timeout);
            log.info("大华设备发现完成: factoryId={}, 发现 {} 台设备", factoryId, devices.size());
            return ApiResponse.success("发现 " + devices.size() + " 台设备", devices);
        } catch (Exception e) {
            log.error("大华设备发现失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            return ApiResponse.error("设备发现失败: " + e.getMessage());
        }
    }

    @PostMapping("/discover/all-interfaces")
    @Operation(summary = "在所有网络接口发现设备", description = "并行在所有网络接口上发现大华设备")
    public ApiResponse<List<DiscoveredDahuaDevice>> discoverOnAllInterfaces(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "5000") int timeout) {
        try {
            log.info("开始多接口大华设备发现: factoryId={}, timeout={}ms", factoryId, timeout);
            List<DiscoveredDahuaDevice> devices = discoveryClient.discoverOnAllInterfaces(timeout);
            log.info("多接口大华设备发现完成: factoryId={}, 发现 {} 台设备", factoryId, devices.size());
            return ApiResponse.success("发现 " + devices.size() + " 台设备", devices);
        } catch (Exception e) {
            log.error("多接口大华设备发现失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            return ApiResponse.error("设备发现失败: " + e.getMessage());
        }
    }

    @PostMapping("/probe")
    @Operation(summary = "探测单个设备", description = "尝试连接指定 IP 地址的大华设备获取信息")
    public ApiResponse<DiscoveredDahuaDevice> probeDevice(
            @PathVariable String factoryId,
            @RequestParam String ipAddress,
            @RequestParam(defaultValue = "80") int port) {
        try {
            log.info("探测大华设备: factoryId={}, ip={}:{}", factoryId, ipAddress, port);

            // 创建临时设备对象用于探测
            DahuaDevice tempDevice = DahuaDevice.builder()
                    .ipAddress(ipAddress)
                    .port(port)
                    .protocol(Protocol.HTTP)
                    .username("admin")
                    .passwordEncrypted(dahuaClient.encryptPassword("admin"))
                    .build();

            Map<String, Object> deviceInfo = dahuaClient.getDeviceInfo(tempDevice);

            if (deviceInfo == null || deviceInfo.isEmpty()) {
                return ApiResponse.error("无法获取设备信息，设备可能不在线或不是大华设备");
            }

            DiscoveredDahuaDevice discovered = DiscoveredDahuaDevice.builder()
                    .ipAddress(ipAddress)
                    .httpPort(port)
                    .model(String.valueOf(deviceInfo.getOrDefault("deviceType", "Unknown")))
                    .serialNumber(String.valueOf(deviceInfo.getOrDefault("serialNumber", "")))
                    .firmwareVersion(String.valueOf(deviceInfo.getOrDefault("softwareVersion", "")))
                    .mac(String.valueOf(deviceInfo.getOrDefault("macAddress", "")))
                    .activated(true)
                    .discoveredAt(System.currentTimeMillis())
                    .build();

            return ApiResponse.success("设备探测成功", discovered);
        } catch (Exception e) {
            log.error("探测大华设备失败: ip={}:{}, error={}", ipAddress, port, e.getMessage());
            return ApiResponse.error("设备探测失败: " + e.getMessage());
        }
    }

    // ==================== 设备 CRUD ====================

    @PostMapping
    @Operation(summary = "添加设备")
    public ApiResponse<DahuaDevice> addDevice(
            @PathVariable String factoryId,
            @Valid @RequestBody DahuaDeviceDTO dto) {
        try {
            // 检查设备是否已存在
            Optional<DahuaDevice> existing = deviceRepository.findByFactoryIdAndIpAddressAndPort(
                    factoryId, dto.getIpAddress(), dto.getPort());
            if (existing.isPresent()) {
                return ApiResponse.error("设备已存在: " + dto.getIpAddress() + ":" + dto.getPort());
            }

            // 加密密码
            String encryptedPassword = dahuaClient.encryptPassword(dto.getPassword());

            DahuaDevice device = DahuaDevice.builder()
                    .factoryId(factoryId)
                    .deviceName(dto.getDeviceName())
                    .deviceType(dto.getDeviceType() != null ? dto.getDeviceType() : DeviceType.IPC)
                    .deviceModel(dto.getDeviceModel())
                    .serialNumber(dto.getSerialNumber())
                    .macAddress(dto.getMacAddress())
                    .firmwareVersion(dto.getFirmwareVersion())
                    .ipAddress(dto.getIpAddress())
                    .port(dto.getPort() != null ? dto.getPort() : 80)
                    .rtspPort(dto.getRtspPort() != null ? dto.getRtspPort() : 554)
                    .tcpPort(dto.getTcpPort() != null ? dto.getTcpPort() : 37777)
                    .httpsPort(dto.getHttpsPort() != null ? dto.getHttpsPort() : 443)
                    .protocol(dto.getProtocol() != null ? dto.getProtocol() : Protocol.HTTP)
                    .username(dto.getUsername())
                    .passwordEncrypted(encryptedPassword)
                    .channelCount(dto.getChannelCount() != null ? dto.getChannelCount() : 1)
                    .supportsPtz(dto.getSupportsPtz() != null ? dto.getSupportsPtz() : false)
                    .supportsAudio(dto.getSupportsAudio() != null ? dto.getSupportsAudio() : false)
                    .supportsSmart(dto.getSupportsSmart() != null ? dto.getSupportsSmart() : false)
                    .status(DeviceStatus.UNKNOWN)
                    .locationDescription(dto.getLocationDescription())
                    .latitude(dto.getLatitude())
                    .longitude(dto.getLongitude())
                    .departmentId(dto.getDepartmentId())
                    .equipmentId(dto.getEquipmentId())
                    .build();

            DahuaDevice saved = deviceRepository.save(device);
            log.info("添加大华设备成功: id={}, ip={}", saved.getId(), saved.getIpAddress());
            return ApiResponse.success("设备添加成功", saved);
        } catch (Exception e) {
            log.error("添加大华设备失败: error={}", e.getMessage(), e);
            return ApiResponse.error("设备添加失败: " + e.getMessage());
        }
    }

    @PutMapping("/{deviceId}")
    @Operation(summary = "更新设备")
    public ApiResponse<DahuaDevice> updateDevice(
            @PathVariable String factoryId,
            @PathVariable String deviceId,
            @RequestBody DahuaDeviceDTO dto) {
        try {
            Optional<DahuaDevice> optDevice = deviceRepository.findById(deviceId);
            if (optDevice.isEmpty()) {
                return ApiResponse.error("设备不存在: " + deviceId);
            }

            DahuaDevice device = optDevice.get();

            // 更新字段
            if (dto.getDeviceName() != null) device.setDeviceName(dto.getDeviceName());
            if (dto.getDeviceType() != null) device.setDeviceType(dto.getDeviceType());
            if (dto.getDeviceModel() != null) device.setDeviceModel(dto.getDeviceModel());
            if (dto.getSerialNumber() != null) device.setSerialNumber(dto.getSerialNumber());
            if (dto.getMacAddress() != null) device.setMacAddress(dto.getMacAddress());
            if (dto.getFirmwareVersion() != null) device.setFirmwareVersion(dto.getFirmwareVersion());
            if (dto.getIpAddress() != null) device.setIpAddress(dto.getIpAddress());
            if (dto.getPort() != null) device.setPort(dto.getPort());
            if (dto.getRtspPort() != null) device.setRtspPort(dto.getRtspPort());
            if (dto.getTcpPort() != null) device.setTcpPort(dto.getTcpPort());
            if (dto.getHttpsPort() != null) device.setHttpsPort(dto.getHttpsPort());
            if (dto.getProtocol() != null) device.setProtocol(dto.getProtocol());
            if (dto.getUsername() != null) device.setUsername(dto.getUsername());
            if (dto.getPassword() != null && !dto.getPassword().isEmpty()) {
                device.setPasswordEncrypted(dahuaClient.encryptPassword(dto.getPassword()));
                // 清除缓存的 HTTP 客户端
                dahuaClient.removeDeviceClient(deviceId);
            }
            if (dto.getChannelCount() != null) device.setChannelCount(dto.getChannelCount());
            if (dto.getSupportsPtz() != null) device.setSupportsPtz(dto.getSupportsPtz());
            if (dto.getSupportsAudio() != null) device.setSupportsAudio(dto.getSupportsAudio());
            if (dto.getSupportsSmart() != null) device.setSupportsSmart(dto.getSupportsSmart());
            if (dto.getLocationDescription() != null) device.setLocationDescription(dto.getLocationDescription());
            if (dto.getLatitude() != null) device.setLatitude(dto.getLatitude());
            if (dto.getLongitude() != null) device.setLongitude(dto.getLongitude());
            if (dto.getDepartmentId() != null) device.setDepartmentId(dto.getDepartmentId());
            if (dto.getEquipmentId() != null) device.setEquipmentId(dto.getEquipmentId());

            DahuaDevice saved = deviceRepository.save(device);
            log.info("更新大华设备成功: id={}, ip={}", saved.getId(), saved.getIpAddress());
            return ApiResponse.success("设备更新成功", saved);
        } catch (Exception e) {
            log.error("更新大华设备失败: deviceId={}, error={}", deviceId, e.getMessage(), e);
            return ApiResponse.error("设备更新失败: " + e.getMessage());
        }
    }

    @DeleteMapping("/{deviceId}")
    @Operation(summary = "删除设备")
    public ApiResponse<Void> deleteDevice(
            @PathVariable String factoryId,
            @PathVariable String deviceId) {
        try {
            Optional<DahuaDevice> optDevice = deviceRepository.findById(deviceId);
            if (optDevice.isEmpty()) {
                return ApiResponse.error("设备不存在: " + deviceId);
            }

            // 清除缓存的 HTTP 客户端
            dahuaClient.removeDeviceClient(deviceId);

            deviceRepository.deleteById(deviceId);
            log.info("删除大华设备成功: deviceId={}", deviceId);
            return ApiResponse.successMessage("设备删除成功");
        } catch (Exception e) {
            log.error("删除大华设备失败: deviceId={}, error={}", deviceId, e.getMessage(), e);
            return ApiResponse.error("设备删除失败: " + e.getMessage());
        }
    }

    @GetMapping("/{deviceId}")
    @Operation(summary = "获取设备详情")
    public ApiResponse<DahuaDevice> getDevice(
            @PathVariable String factoryId,
            @PathVariable String deviceId) {
        try {
            Optional<DahuaDevice> optDevice = deviceRepository.findById(deviceId);
            if (optDevice.isEmpty()) {
                return ApiResponse.error("设备不存在: " + deviceId);
            }
            return ApiResponse.success(optDevice.get());
        } catch (Exception e) {
            log.error("获取大华设备失败: deviceId={}, error={}", deviceId, e.getMessage());
            return ApiResponse.error("获取设备失败: " + e.getMessage());
        }
    }

    @GetMapping
    @Operation(summary = "获取设备列表")
    public ApiResponse<Page<DahuaDevice>> listDevices(
            @PathVariable String factoryId,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page - 1, size);
        Page<DahuaDevice> devices;

        if (keyword != null && !keyword.isEmpty()) {
            devices = deviceRepository.searchByKeyword(factoryId, keyword, pageable);
        } else {
            devices = deviceRepository.findByFactoryId(factoryId, pageable);
        }

        return ApiResponse.success(devices);
    }

    // ==================== 设备导入 ====================

    @PostMapping("/import")
    @Operation(summary = "从发现结果导入设备", description = "将发现的设备导入到系统中")
    public ApiResponse<DahuaDevice> importFromDiscovery(
            @PathVariable String factoryId,
            @Valid @RequestBody ImportDahuaDeviceRequest request) {
        try {
            DiscoveredDahuaDevice discovered = request.getDiscoveredDevice();

            // 检查设备是否已存在 (按 MAC 地址)
            if (discovered.getMac() != null) {
                Optional<DahuaDevice> existing = deviceRepository.findByMacAddressIgnoreCase(discovered.getMac());
                if (existing.isPresent()) {
                    return ApiResponse.error("设备已存在 (MAC: " + discovered.getMac() + ")");
                }
            }

            // 检查 IP 是否已存在
            int port = discovered.getHttpPort() != null ? discovered.getHttpPort() : 80;
            Optional<DahuaDevice> existingByIp = deviceRepository.findByFactoryIdAndIpAddressAndPort(
                    factoryId, discovered.getIpAddress(), port);
            if (existingByIp.isPresent()) {
                return ApiResponse.error("设备IP已存在: " + discovered.getIpAddress());
            }

            // 生成设备名称
            String deviceName = request.getDeviceName();
            if (deviceName == null || deviceName.isEmpty()) {
                deviceName = (discovered.getModel() != null ? discovered.getModel() : "大华设备")
                        + " - " + discovered.getIpAddress();
            }

            // 解析设备类型
            DeviceType deviceType = parseDeviceType(discovered.getDeviceType());

            // 加密密码
            String encryptedPassword = dahuaClient.encryptPassword(request.getPassword());

            DahuaDevice device = DahuaDevice.builder()
                    .factoryId(factoryId)
                    .deviceName(deviceName)
                    .deviceType(deviceType)
                    .deviceModel(discovered.getModel())
                    .serialNumber(discovered.getSerialNumber())
                    .macAddress(discovered.getMac())
                    .firmwareVersion(discovered.getFirmwareVersion())
                    .ipAddress(discovered.getIpAddress())
                    .port(port)
                    .rtspPort(554)
                    .tcpPort(discovered.getPort() != null ? discovered.getPort() : 37777)
                    .httpsPort(443)
                    .protocol(Protocol.HTTP)
                    .username(request.getUsername())
                    .passwordEncrypted(encryptedPassword)
                    .channelCount(1)
                    .status(discovered.getActivated() != null && discovered.getActivated()
                            ? DeviceStatus.UNKNOWN : DeviceStatus.UNACTIVATED)
                    .locationDescription(request.getLocationDescription())
                    .departmentId(request.getDepartmentId())
                    .build();

            DahuaDevice saved = deviceRepository.save(device);
            log.info("导入大华设备成功: id={}, mac={}, ip={}", saved.getId(), saved.getMacAddress(), saved.getIpAddress());

            return ApiResponse.success("设备导入成功", saved);
        } catch (Exception e) {
            log.error("导入大华设备失败: error={}", e.getMessage(), e);
            return ApiResponse.error("设备导入失败: " + e.getMessage());
        }
    }

    // ==================== 连接与同步 ====================

    @PostMapping("/{deviceId}/test-connection")
    @Operation(summary = "测试设备连接")
    public ApiResponse<Boolean> testConnection(
            @PathVariable String factoryId,
            @PathVariable String deviceId) {
        try {
            Optional<DahuaDevice> optDevice = deviceRepository.findById(deviceId);
            if (optDevice.isEmpty()) {
                return ApiResponse.error("设备不存在: " + deviceId);
            }

            DahuaDevice device = optDevice.get();
            boolean connected = dahuaClient.testConnection(device);

            // 更新设备状态
            if (connected) {
                device.heartbeat();
            } else {
                device.markOffline("连接测试失败");
            }
            deviceRepository.save(device);

            if (connected) {
                return ApiResponse.success("连接成功", true);
            } else {
                return ApiResponse.success("连接失败", false);
            }
        } catch (Exception e) {
            log.error("测试大华设备连接失败: deviceId={}, error={}", deviceId, e.getMessage());
            return ApiResponse.error("连接测试失败: " + e.getMessage());
        }
    }

    @PostMapping("/{deviceId}/sync")
    @Operation(summary = "同步设备信息", description = "从设备获取最新的型号、固件版本等信息")
    public ApiResponse<Void> syncDeviceInfo(
            @PathVariable String factoryId,
            @PathVariable String deviceId) {
        try {
            Optional<DahuaDevice> optDevice = deviceRepository.findById(deviceId);
            if (optDevice.isEmpty()) {
                return ApiResponse.error("设备不存在: " + deviceId);
            }

            DahuaDevice device = optDevice.get();
            Map<String, Object> deviceInfo = dahuaClient.getDeviceInfo(device);

            if (deviceInfo == null || deviceInfo.isEmpty()) {
                device.markOffline("无法获取设备信息");
                deviceRepository.save(device);
                return ApiResponse.error("无法获取设备信息");
            }

            // 更新设备信息
            if (deviceInfo.containsKey("deviceType")) {
                device.setDeviceModel(String.valueOf(deviceInfo.get("deviceType")));
            }
            if (deviceInfo.containsKey("serialNumber")) {
                device.setSerialNumber(String.valueOf(deviceInfo.get("serialNumber")));
            }
            if (deviceInfo.containsKey("softwareVersion")) {
                device.setFirmwareVersion(String.valueOf(deviceInfo.get("softwareVersion")));
            }
            if (deviceInfo.containsKey("macAddress")) {
                device.setMacAddress(String.valueOf(deviceInfo.get("macAddress")));
            }

            device.heartbeat();
            deviceRepository.save(device);

            log.info("同步大华设备信息成功: deviceId={}", deviceId);
            return ApiResponse.successMessage("同步成功");
        } catch (Exception e) {
            log.error("同步大华设备信息失败: deviceId={}, error={}", deviceId, e.getMessage());
            return ApiResponse.error("同步失败: " + e.getMessage());
        }
    }

    // ==================== 流媒体与抓拍 ====================

    @GetMapping("/{deviceId}/streams")
    @Operation(summary = "获取流媒体地址")
    public ApiResponse<Map<String, String>> getStreamUrls(
            @PathVariable String factoryId,
            @PathVariable String deviceId,
            @RequestParam(defaultValue = "1") int channelId) {
        try {
            Optional<DahuaDevice> optDevice = deviceRepository.findById(deviceId);
            if (optDevice.isEmpty()) {
                return ApiResponse.error("设备不存在: " + deviceId);
            }

            DahuaDevice device = optDevice.get();

            // 大华 RTSP URL 格式
            // 主码流: rtsp://{user}:{password}@{ip}:{port}/cam/realmonitor?channel={channelId}&subtype=0
            // 子码流: rtsp://{user}:{password}@{ip}:{port}/cam/realmonitor?channel={channelId}&subtype=1

            String baseRtsp = String.format("rtsp://%s:%s@%s:%d",
                    device.getUsername(),
                    dahuaClient.decryptPassword(device.getPasswordEncrypted()),
                    device.getIpAddress(),
                    device.getRtspPort());

            Map<String, String> streams = new HashMap<>();
            streams.put("mainStream", baseRtsp + "/cam/realmonitor?channel=" + channelId + "&subtype=0");
            streams.put("subStream", baseRtsp + "/cam/realmonitor?channel=" + channelId + "&subtype=1");
            streams.put("channelId", String.valueOf(channelId));
            streams.put("deviceId", deviceId);

            return ApiResponse.success(streams);
        } catch (Exception e) {
            log.error("获取大华流媒体地址失败: deviceId={}, error={}", deviceId, e.getMessage());
            return ApiResponse.error("获取流媒体地址失败: " + e.getMessage());
        }
    }

    @PostMapping("/{deviceId}/capture")
    @Operation(summary = "抓拍图片")
    public ApiResponse<String> capturePicture(
            @PathVariable String factoryId,
            @PathVariable String deviceId,
            @RequestParam(defaultValue = "1") int channelId) {
        try {
            Optional<DahuaDevice> optDevice = deviceRepository.findById(deviceId);
            if (optDevice.isEmpty()) {
                return ApiResponse.error("设备不存在: " + deviceId);
            }

            DahuaDevice device = optDevice.get();
            byte[] imageData = dahuaClient.capturePicture(device, channelId - 1); // 大华通道从0开始

            if (imageData == null || imageData.length == 0) {
                return ApiResponse.error("抓拍失败: 未获取到图片数据");
            }

            String base64Image = Base64.getEncoder().encodeToString(imageData);
            return ApiResponse.success("抓拍成功", base64Image);
        } catch (Exception e) {
            log.error("大华设备抓拍失败: deviceId={}, channelId={}, error={}", deviceId, channelId, e.getMessage());
            return ApiResponse.error("抓拍失败: " + e.getMessage());
        }
    }

    @GetMapping("/{deviceId}/capture/image")
    @Operation(summary = "抓拍图片 (直接返回图片)")
    public ResponseEntity<byte[]> capturePictureAsImage(
            @PathVariable String factoryId,
            @PathVariable String deviceId,
            @RequestParam(defaultValue = "1") int channelId) {
        try {
            Optional<DahuaDevice> optDevice = deviceRepository.findById(deviceId);
            if (optDevice.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            DahuaDevice device = optDevice.get();
            byte[] imageData = dahuaClient.capturePicture(device, channelId - 1);

            if (imageData == null || imageData.length == 0) {
                return ResponseEntity.notFound().build();
            }

            return ResponseEntity.ok()
                    .contentType(MediaType.IMAGE_JPEG)
                    .body(imageData);
        } catch (Exception e) {
            log.error("大华设备抓拍图片失败: deviceId={}, error={}", deviceId, e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    // ==================== 设备配网 ====================

    @PostMapping("/provision")
    @Operation(summary = "配网设备", description = "初始化未激活的大华设备 (设置网络参数和密码)")
    public ApiResponse<DahuaProvisioningResultDTO> provisionDevice(
            @PathVariable String factoryId,
            @Valid @RequestBody DahuaProvisioningConfigDTO config) {
        try {
            log.info("开始配网大华设备: mac={}", config.getDeviceMac());

            // 注意: 大华设备配网需要使用 DHDiscover 协议或 ConfigManager SDK
            // 这里提供基础实现框架，实际配网可能需要根据具体设备型号调整

            // TODO: 实现大华设备配网逻辑
            // 1. 发送 DHDiscover.setConfig 消息设置网络参数
            // 2. 发送密码设置消息激活设备

            DahuaProvisioningResultDTO result = DahuaProvisioningResultDTO.builder()
                    .success(false)
                    .message("配网功能暂未实现，请使用大华官方工具 ConfigTool 进行设备初始化")
                    .deviceMac(config.getDeviceMac())
                    .provisionedAt(LocalDateTime.now())
                    .build();

            return ApiResponse.success("请使用大华官方工具进行配网", result);
        } catch (Exception e) {
            log.error("配网大华设备失败: mac={}, error={}", config.getDeviceMac(), e.getMessage());
            return ApiResponse.error("配网失败: " + e.getMessage());
        }
    }

    @PostMapping("/activate")
    @Operation(summary = "激活设备", description = "为未激活的大华设备设置初始密码")
    public ApiResponse<DahuaProvisioningResultDTO> activateDevice(
            @PathVariable String factoryId,
            @RequestParam String deviceMac,
            @RequestParam String password) {
        try {
            log.info("开始激活大华设备: mac={}", deviceMac);

            // 大华设备激活需要使用特定协议
            // TODO: 实现大华设备激活逻辑

            DahuaProvisioningResultDTO result = DahuaProvisioningResultDTO.builder()
                    .success(false)
                    .message("激活功能暂未实现，请使用大华官方工具 ConfigTool 进行设备激活")
                    .deviceMac(deviceMac)
                    .provisionedAt(LocalDateTime.now())
                    .build();

            return ApiResponse.success("请使用大华官方工具进行激活", result);
        } catch (Exception e) {
            log.error("激活大华设备失败: mac={}, error={}", deviceMac, e.getMessage());
            return ApiResponse.error("激活失败: " + e.getMessage());
        }
    }

    // ==================== 统计 ====================

    @GetMapping("/stats")
    @Operation(summary = "获取设备统计")
    public ApiResponse<Map<String, Object>> getStats(@PathVariable String factoryId) {
        try {
            Map<String, Object> stats = new HashMap<>();

            // 设备总数
            long total = deviceRepository.countByFactoryId(factoryId);
            stats.put("total", total);

            // 在线设备数
            long online = deviceRepository.countByFactoryIdAndStatus(factoryId, DeviceStatus.ONLINE);
            stats.put("online", online);

            // 离线设备数
            long offline = deviceRepository.countByFactoryIdAndStatus(factoryId, DeviceStatus.OFFLINE);
            stats.put("offline", offline);

            // 错误设备数
            long error = deviceRepository.countByFactoryIdAndStatus(factoryId, DeviceStatus.ERROR);
            stats.put("error", error);

            // 未激活设备数
            long unactivated = deviceRepository.countByFactoryIdAndStatus(factoryId, DeviceStatus.UNACTIVATED);
            stats.put("unactivated", unactivated);

            // 按状态分组统计
            List<Object[]> statusCounts = deviceRepository.countByStatus(factoryId);
            Map<String, Long> byStatus = new HashMap<>();
            for (Object[] row : statusCounts) {
                byStatus.put(((DeviceStatus) row[0]).name(), (Long) row[1]);
            }
            stats.put("byStatus", byStatus);

            return ApiResponse.success(stats);
        } catch (Exception e) {
            log.error("获取大华设备统计失败: factoryId={}, error={}", factoryId, e.getMessage());
            return ApiResponse.error("获取统计失败: " + e.getMessage());
        }
    }

    // ==================== 辅助方法 ====================

    /**
     * 解析设备类型字符串
     */
    private DeviceType parseDeviceType(String typeStr) {
        if (typeStr == null || typeStr.isEmpty()) {
            return DeviceType.IPC;
        }

        String upper = typeStr.toUpperCase();
        if (upper.contains("NVR")) {
            return DeviceType.NVR;
        } else if (upper.contains("DVR")) {
            return DeviceType.DVR;
        } else if (upper.contains("XVR")) {
            return DeviceType.XVR;
        }
        return DeviceType.IPC;
    }
}

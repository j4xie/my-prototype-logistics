package com.cretas.aims.service.isapi;

import com.cretas.aims.client.isapi.IsapiClient;
import com.cretas.aims.config.IsapiConfig;
import com.cretas.aims.dto.isapi.HttpHostConfigRequest;
import com.cretas.aims.dto.isapi.HttpHostConfigResponse;
import com.cretas.aims.dto.isapi.IsapiCaptureDTO;
import com.cretas.aims.dto.isapi.IsapiDeviceDTO;
import com.cretas.aims.dto.isapi.IsapiStreamDTO;
import com.cretas.aims.entity.common.UnifiedDeviceType;
import com.cretas.aims.entity.isapi.IsapiDevice;
import com.cretas.aims.entity.isapi.IsapiDevice.DeviceStatus;
import com.cretas.aims.entity.isapi.IsapiDeviceChannel;
import com.cretas.aims.repository.isapi.IsapiDeviceChannelRepository;
import com.cretas.aims.repository.isapi.IsapiDeviceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * ISAPI 设备管理服务
 *
 * @author Cretas Team
 * @since 2026-01-05
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IsapiDeviceService {

    private final IsapiDeviceRepository deviceRepository;
    private final IsapiDeviceChannelRepository channelRepository;
    private final IsapiClient isapiClient;

    // ==================== 设备 CRUD ====================

    /**
     * 添加设备
     */
    @Transactional
    public IsapiDevice addDevice(String factoryId, IsapiDeviceDTO dto) {
        // 检查重复
        Optional<IsapiDevice> existing = deviceRepository
                .findByFactoryIdAndIpAddressAndPort(factoryId, dto.getIpAddress(), dto.getPort());

        if (existing.isPresent()) {
            throw new IllegalArgumentException("设备已存在: " + dto.getIpAddress() + ":" + dto.getPort());
        }

        // 加密密码
        String encryptedPassword = isapiClient.encryptPassword(dto.getPassword());

        // 创建设备实体
        IsapiDevice device = IsapiDevice.builder()
                .factoryId(factoryId)
                .deviceName(dto.getDeviceName())
                .deviceModel(dto.getDeviceModel())
                .ipAddress(dto.getIpAddress())
                .port(dto.getPort() != null ? dto.getPort() : 80)
                .rtspPort(dto.getRtspPort() != null ? dto.getRtspPort() : 554)
                .httpsPort(dto.getHttpsPort() != null ? dto.getHttpsPort() : 443)
                .protocol(dto.getProtocol() != null ? dto.getProtocol() : IsapiDevice.Protocol.HTTP)
                .username(dto.getUsername())
                .passwordEncrypted(encryptedPassword)
                .channelCount(dto.getChannelCount() != null ? dto.getChannelCount() : 1)
                .locationDescription(dto.getLocationDescription())
                .latitude(dto.getLatitude())
                .longitude(dto.getLongitude())
                .departmentId(dto.getDepartmentId())
                .equipmentId(dto.getEquipmentId())
                .status(DeviceStatus.UNKNOWN)
                .build();

        // 设置统一设备类型
        if (dto.getDeviceType() != null) {
            device.setUnifiedDeviceType(UnifiedDeviceType.fromIsapiDeviceType(dto.getDeviceType()));
        }

        device = deviceRepository.save(device);
        log.info("添加设备: {} - {}", device.getDeviceName(), device.getIpAddress());

        // 异步测试连接并获取设备信息
        final String deviceId = device.getId();
        syncDeviceInfoAsync(deviceId);

        return device;
    }

    /**
     * 更新设备
     */
    @Transactional
    public IsapiDevice updateDevice(String deviceId, IsapiDeviceDTO dto) {
        IsapiDevice device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new IllegalArgumentException("设备不存在: " + deviceId));

        // 更新基本信息
        if (dto.getDeviceName() != null) {
            device.setDeviceName(dto.getDeviceName());
        }
        if (dto.getDeviceType() != null) {
            device.setUnifiedDeviceType(UnifiedDeviceType.fromIsapiDeviceType(dto.getDeviceType()));
        }
        if (dto.getIpAddress() != null) {
            device.setIpAddress(dto.getIpAddress());
        }
        if (dto.getPort() != null) {
            device.setPort(dto.getPort());
        }
        if (dto.getUsername() != null) {
            device.setUsername(dto.getUsername());
        }
        if (dto.getPassword() != null && !dto.getPassword().isEmpty()) {
            device.setPasswordEncrypted(isapiClient.encryptPassword(dto.getPassword()));
            // 清除缓存的客户端
            isapiClient.removeDeviceClient(deviceId);
        }
        if (dto.getLocationDescription() != null) {
            device.setLocationDescription(dto.getLocationDescription());
        }
        if (dto.getDepartmentId() != null) {
            device.setDepartmentId(dto.getDepartmentId());
        }

        return deviceRepository.save(device);
    }

    /**
     * 删除设备
     */
    @Transactional
    public void deleteDevice(String deviceId) {
        IsapiDevice device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new IllegalArgumentException("设备不存在: " + deviceId));

        // 清除客户端缓存
        isapiClient.removeDeviceClient(deviceId);

        // 软删除
        device.softDelete();
        deviceRepository.save(device);

        log.info("删除设备: {} - {}", device.getDeviceName(), device.getIpAddress());
    }

    /**
     * 获取设备详情
     */
    public IsapiDevice getDevice(String deviceId) {
        return deviceRepository.findById(deviceId)
                .orElseThrow(() -> new IllegalArgumentException("设备不存在: " + deviceId));
    }

    /**
     * 分页查询设备
     */
    public Page<IsapiDevice> listDevices(String factoryId, Pageable pageable) {
        return deviceRepository.findByFactoryId(factoryId, pageable);
    }

    /**
     * 搜索设备
     */
    public Page<IsapiDevice> searchDevices(String factoryId, String keyword, Pageable pageable) {
        return deviceRepository.searchByKeyword(factoryId, keyword, pageable);
    }

    // ==================== 设备连接与同步 ====================

    /**
     * 测试设备连接
     */
    public boolean testConnection(String deviceId) {
        IsapiDevice device = getDevice(deviceId);
        boolean success = isapiClient.testConnection(device);

        if (success) {
            device.heartbeat();
            deviceRepository.save(device);
        } else {
            device.markOffline("Connection test failed");
            deviceRepository.save(device);
        }

        return success;
    }

    /**
     * 同步设备信息 (获取型号、序列号、能力等)
     */
    @Transactional
    public void syncDeviceInfo(String deviceId) {
        IsapiDevice device = getDevice(deviceId);

        try {
            // 获取设备信息
            Map<String, Object> info = isapiClient.getDeviceInfo(device);

            if (info.containsKey("error")) {
                device.markError((String) info.get("error"));
                deviceRepository.save(device);
                return;
            }

            // 更新设备信息
            if (info.get("model") != null) {
                device.setDeviceModel((String) info.get("model"));
            }
            if (info.get("serialNumber") != null) {
                device.setSerialNumber((String) info.get("serialNumber"));
            }
            if (info.get("firmwareVersion") != null) {
                device.setFirmwareVersion((String) info.get("firmwareVersion"));
            }
            device.setDeviceCapabilities(info);
            device.heartbeat();

            deviceRepository.save(device);

            // 同步通道信息
            syncChannels(device);

            log.info("设备信息同步成功: {} - {}", device.getDeviceName(), device.getSerialNumber());

        } catch (Exception e) {
            log.error("同步设备信息失败: {} - {}", device.getIpAddress(), e.getMessage());
            device.markError(e.getMessage());
            deviceRepository.save(device);
        }
    }

    /**
     * 异步同步设备信息
     */
    @Async
    public void syncDeviceInfoAsync(String deviceId) {
        syncDeviceInfo(deviceId);
    }

    /**
     * 同步设备通道
     */
    @Transactional
    public void syncChannels(IsapiDevice device) {
        try {
            List<Map<String, Object>> channels = isapiClient.getStreamingChannels(device);

            // 更新通道数量
            device.setChannelCount(channels.size());

            // 删除旧通道
            channelRepository.deleteByDevice_Id(device.getId());

            // 创建新通道
            for (Map<String, Object> channelInfo : channels) {
                String idStr = (String) channelInfo.get("id");
                Integer channelId = idStr != null ? Integer.parseInt(idStr.replaceAll("\\D", "")) : null;

                if (channelId == null) continue;

                IsapiDeviceChannel channel = IsapiDeviceChannel.builder()
                        .device(device)
                        .factoryId(device.getFactoryId())
                        .channelId(channelId)
                        .channelName((String) channelInfo.get("channelName"))
                        .status(Boolean.TRUE.equals(channelInfo.get("enabled"))
                                ? IsapiDeviceChannel.ChannelStatus.ONLINE
                                : IsapiDeviceChannel.ChannelStatus.OFFLINE)
                        .build();

                channelRepository.save(channel);
            }

            log.info("同步通道成功: {} - {} 个通道", device.getDeviceName(), channels.size());

        } catch (Exception e) {
            log.error("同步通道失败: {}", e.getMessage());
        }
    }

    // ==================== 流媒体 ====================

    /**
     * 获取设备流地址
     */
    public List<IsapiStreamDTO> getStreamUrls(String deviceId) {
        IsapiDevice device = getDevice(deviceId);
        List<IsapiDeviceChannel> channels = channelRepository.findByDevice_IdOrderByChannelId(deviceId);

        return channels.stream().map(channel -> {
            String password = isapiClient.decryptPassword(device.getPasswordEncrypted());

            return IsapiStreamDTO.builder()
                    .deviceId(deviceId)
                    .deviceName(device.getDeviceName())
                    .channelId(channel.getChannelId())
                    .channelName(channel.getDisplayName())
                    .mainStreamUrl(channel.buildMainStreamUrl(device.getUsername(), password))
                    .subStreamUrl(channel.buildSubStreamUrl(device.getUsername(), password))
                    .available(channel.getStatus() == IsapiDeviceChannel.ChannelStatus.ONLINE)
                    .build();
        }).collect(Collectors.toList());
    }

    /**
     * 抓拍图片
     */
    public IsapiCaptureDTO capturePicture(String deviceId, int channelId) {
        IsapiDevice device = getDevice(deviceId);

        try {
            byte[] pictureData = isapiClient.capturePicture(device, channelId);

            String base64 = Base64.getEncoder().encodeToString(pictureData);

            return IsapiCaptureDTO.builder()
                    .deviceId(deviceId)
                    .deviceName(device.getDeviceName())
                    .channelId(channelId)
                    .pictureBase64(base64)
                    .format("JPEG")
                    .size((long) pictureData.length)
                    .captureTime(LocalDateTime.now())
                    .success(true)
                    .build();

        } catch (Exception e) {
            log.error("抓拍失败: {} - {}", device.getIpAddress(), e.getMessage());
            return IsapiCaptureDTO.builder()
                    .deviceId(deviceId)
                    .deviceName(device.getDeviceName())
                    .channelId(channelId)
                    .success(false)
                    .error(e.getMessage())
                    .build();
        }
    }

    // ==================== 状态管理 ====================

    /**
     * 获取设备状态统计
     */
    public Map<String, Long> getStatusStatistics(String factoryId) {
        List<Object[]> counts = deviceRepository.countByStatus(factoryId);
        Map<String, Long> result = new HashMap<>();

        for (Object[] row : counts) {
            DeviceStatus status = (DeviceStatus) row[0];
            Long count = (Long) row[1];
            result.put(status.name(), count);
        }

        return result;
    }

    /**
     * 更新心跳
     */
    @Transactional
    public void updateHeartbeat(String deviceId) {
        deviceRepository.updateHeartbeat(deviceId, LocalDateTime.now());
    }

    /**
     * 标记超时设备为离线
     */
    @Transactional
    public int markTimeoutDevicesOffline(int timeoutSeconds) {
        LocalDateTime threshold = LocalDateTime.now().minusSeconds(timeoutSeconds);
        return deviceRepository.markTimeoutDevicesOffline(threshold);
    }

    // ==================== 高级设备管理 ====================

    /**
     * 获取设备明文密码
     */
    public String getDecryptedPassword(String deviceId) {
        IsapiDevice device = getDevice(deviceId);
        return isapiClient.decryptPassword(device.getPasswordEncrypted());
    }

    /**
     * 修改设备密码
     */
    @Transactional
    public void changeDevicePassword(String deviceId, String newPassword) {
        IsapiDevice device = getDevice(deviceId);

        try {
            // 1. 构建修改密码的 XML (用户 ID 通常为 1)
            String changePasswordXml = buildChangePasswordXml(1, device.getUsername(), newPassword);

            // 2. 发送 PUT 请求修改设备密码
            String url = device.getBaseUrl() + String.format(IsapiConfig.Endpoints.USER_BY_ID, 1);
            isapiClient.executePut(device, url, changePasswordXml);

            // 3. 更新数据库中保存的加密密码
            device.setPasswordEncrypted(isapiClient.encryptPassword(newPassword));
            deviceRepository.save(device);

            // 4. 清除客户端缓存
            isapiClient.removeDeviceClient(deviceId);

            log.info("设备密码修改成功: deviceId={}", deviceId);
        } catch (Exception e) {
            log.error("修改设备密码失败: deviceId={}, error={}", deviceId, e.getMessage());
            throw new RuntimeException("修改设备密码失败: " + e.getMessage(), e);
        }
    }

    /**
     * 重启设备
     */
    public void rebootDevice(String deviceId) {
        IsapiDevice device = getDevice(deviceId);

        try {
            String url = device.getBaseUrl() + IsapiConfig.Endpoints.REBOOT;
            isapiClient.executePut(device, url, "");

            device.setStatus(DeviceStatus.CONNECTING);
            device.setLastError("Device rebooting...");
            deviceRepository.save(device);

            log.info("设备重启命令已发送: deviceId={}", deviceId);
        } catch (Exception e) {
            log.error("重启设备失败: deviceId={}, error={}", deviceId, e.getMessage());
            throw new RuntimeException("重启设备失败: " + e.getMessage(), e);
        }
    }

    /**
     * 恢复出厂设置
     */
    public void factoryResetDevice(String deviceId) {
        IsapiDevice device = getDevice(deviceId);

        try {
            String url = device.getBaseUrl() + IsapiConfig.Endpoints.FACTORY_RESET;
            isapiClient.executePut(device, url, "");

            log.warn("设备恢复出厂设置命令已发送: deviceId={}, ip={}", deviceId, device.getIpAddress());
        } catch (Exception e) {
            log.error("恢复出厂设置失败: deviceId={}, error={}", deviceId, e.getMessage());
            throw new RuntimeException("恢复出厂设置失败: " + e.getMessage(), e);
        }
    }

    /**
     * 构建修改密码的 XML
     */
    private String buildChangePasswordXml(int userId, String username, String password) {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
                "<User version=\"2.0\" xmlns=\"http://www.isapi.org/ver20/XMLSchema\">\n" +
                "  <id>" + userId + "</id>\n" +
                "  <userName>" + username + "</userName>\n" +
                "  <password>" + password + "</password>\n" +
                "</User>";
    }

    // ==================== HTTP Host 配置 ====================

    /**
     * 配置摄像头 HTTP 监听地址
     * 使摄像头将事件推送到云端服务器
     *
     * @param deviceId 设备 ID
     * @param request  配置请求
     * @return 配置结果
     */
    public HttpHostConfigResponse configureHttpHost(String deviceId, HttpHostConfigRequest request) {
        IsapiDevice device = getDevice(deviceId);
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        // 默认配置值
        String serverIp = request.getCustomServerIp() != null ? request.getCustomServerIp() : "139.196.165.140";
        int serverPort = request.getCustomServerPort() != null ? request.getCustomServerPort() : 10010;
        String callbackPath = request.getCustomCallbackPath() != null ? request.getCustomCallbackPath() : "/api/mobile/edge/events";

        boolean httpHostConfigured = false;
        boolean motionDetectionEnabled = false;
        boolean lineCrossingEnabled = false;
        boolean intrusionDetectionEnabled = false;

        try {
            // 1. 配置 HTTP Host (事件推送目标)
            String httpHostXml = buildHttpHostNotificationXml(serverIp, serverPort, callbackPath);
            String httpHostUrl = device.getBaseUrl() + "/ISAPI/Event/notification/httpHosts/1";

            try {
                isapiClient.executePut(device, httpHostUrl, httpHostXml);
                httpHostConfigured = true;
                log.info("HTTP Host 配置成功: deviceId={}, server={}:{}", deviceId, serverIp, serverPort);
            } catch (Exception e) {
                errors.add("HTTP Host 配置失败: " + e.getMessage());
                log.error("HTTP Host 配置失败: deviceId={}, error={}", deviceId, e.getMessage());
            }

            // 2. 配置移动侦测事件推送
            if (Boolean.TRUE.equals(request.getEnableMotionDetection())) {
                try {
                    configureEventNotification(device, "VMD", true);
                    motionDetectionEnabled = true;
                    log.info("移动侦测配置成功: deviceId={}", deviceId);
                } catch (Exception e) {
                    warnings.add("移动侦测配置失败: " + e.getMessage());
                    log.warn("移动侦测配置失败: deviceId={}, error={}", deviceId, e.getMessage());
                }
            }

            // 3. 配置越界检测事件推送
            if (Boolean.TRUE.equals(request.getEnableLineCrossing())) {
                try {
                    configureEventNotification(device, "linedetection", true);
                    lineCrossingEnabled = true;
                    log.info("越界检测配置成功: deviceId={}", deviceId);
                } catch (Exception e) {
                    warnings.add("越界检测配置失败 (设备可能不支持): " + e.getMessage());
                    log.warn("越界检测配置失败: deviceId={}, error={}", deviceId, e.getMessage());
                }
            }

            // 4. 配置区域入侵检测事件推送
            if (Boolean.TRUE.equals(request.getEnableIntrusionDetection())) {
                try {
                    configureEventNotification(device, "fielddetection", true);
                    intrusionDetectionEnabled = true;
                    log.info("区域入侵检测配置成功: deviceId={}", deviceId);
                } catch (Exception e) {
                    warnings.add("区域入侵检测配置失败 (设备可能不支持): " + e.getMessage());
                    log.warn("区域入侵检测配置失败: deviceId={}, error={}", deviceId, e.getMessage());
                }
            }

        } catch (Exception e) {
            errors.add("配置过程发生异常: " + e.getMessage());
            log.error("HTTP Host 配置异常: deviceId={}, error={}", deviceId, e.getMessage(), e);
        }

        boolean success = httpHostConfigured && errors.isEmpty();

        return HttpHostConfigResponse.builder()
                .deviceId(deviceId)
                .deviceName(device.getDeviceName())
                .success(success)
                .httpHostConfigured(httpHostConfigured)
                .motionDetectionEnabled(motionDetectionEnabled)
                .lineCrossingEnabled(lineCrossingEnabled)
                .intrusionDetectionEnabled(intrusionDetectionEnabled)
                .serverAddress(serverIp + ":" + serverPort)
                .callbackPath(callbackPath)
                .configuredAt(LocalDateTime.now())
                .errors(errors.isEmpty() ? null : errors)
                .warnings(warnings.isEmpty() ? null : warnings)
                .build();
    }

    /**
     * 构建 HTTP Host Notification XML
     */
    private String buildHttpHostNotificationXml(String ipAddress, int port, String url) {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
                "<HttpHostNotification version=\"2.0\" xmlns=\"http://www.isapi.org/ver20/XMLSchema\">\n" +
                "  <id>1</id>\n" +
                "  <url>" + url + "</url>\n" +
                "  <protocolType>HTTP</protocolType>\n" +
                "  <parameterFormatType>XML</parameterFormatType>\n" +
                "  <addressingFormatType>ipaddress</addressingFormatType>\n" +
                "  <ipAddress>" + ipAddress + "</ipAddress>\n" +
                "  <portNo>" + port + "</portNo>\n" +
                "  <httpAuthenticationMethod>none</httpAuthenticationMethod>\n" +
                "</HttpHostNotification>";
    }

    /**
     * 配置事件通知开关
     *
     * @param device    设备
     * @param eventType 事件类型 (VMD, linedetection, fielddetection 等)
     * @param enable    是否启用
     */
    private void configureEventNotification(IsapiDevice device, String eventType, boolean enable) throws Exception {
        // 获取当前通知配置
        String getUrl = device.getBaseUrl() + "/ISAPI/Event/notification/subscribeEvent";
        String currentConfig = isapiClient.executeGet(device, getUrl);

        // 检查是否已包含该事件类型的配置
        // 如果需要更精细的控制，可以解析 XML 并修改
        // 这里使用简化的方式：直接设置 HTTP 通知

        // 构建事件触发配置 XML
        String triggerUrl = device.getBaseUrl() + "/ISAPI/Event/triggers/" + eventType + "-1";
        String triggerXml = buildEventTriggerXml(eventType, enable);

        try {
            isapiClient.executePut(device, triggerUrl, triggerXml);
        } catch (Exception e) {
            // 某些设备可能使用不同的 API 路径
            String altUrl = device.getBaseUrl() + "/ISAPI/Smart/" + eventType + "/1";
            String altXml = buildSmartEventXml(eventType, enable);
            isapiClient.executePut(device, altUrl, altXml);
        }
    }

    /**
     * 构建事件触发配置 XML
     */
    private String buildEventTriggerXml(String eventType, boolean enable) {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
                "<EventTrigger version=\"2.0\" xmlns=\"http://www.isapi.org/ver20/XMLSchema\">\n" +
                "  <id>1</id>\n" +
                "  <eventType>" + eventType + "</eventType>\n" +
                "  <inputIOPortID>1</inputIOPortID>\n" +
                "  <EventTriggerNotificationList>\n" +
                "    <EventTriggerNotification>\n" +
                "      <id>1</id>\n" +
                "      <notificationMethod>HTTP</notificationMethod>\n" +
                "      <notificationRecurrence>recurring</notificationRecurrence>\n" +
                "    </EventTriggerNotification>\n" +
                "  </EventTriggerNotificationList>\n" +
                "</EventTrigger>";
    }

    /**
     * 构建智能事件配置 XML (用于移动侦测等)
     */
    private String buildSmartEventXml(String eventType, boolean enable) {
        String enableStr = enable ? "true" : "false";
        if ("VMD".equals(eventType)) {
            return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
                    "<MotionDetection version=\"2.0\" xmlns=\"http://www.isapi.org/ver20/XMLSchema\">\n" +
                    "  <enabled>" + enableStr + "</enabled>\n" +
                    "  <enableHighlight>" + enableStr + "</enableHighlight>\n" +
                    "  <samplingInterval>2</samplingInterval>\n" +
                    "  <startTriggerTime>500</startTriggerTime>\n" +
                    "  <endTriggerTime>500</endTriggerTime>\n" +
                    "</MotionDetection>";
        } else if ("linedetection".equals(eventType)) {
            return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
                    "<LineDetection version=\"2.0\" xmlns=\"http://www.isapi.org/ver20/XMLSchema\">\n" +
                    "  <id>1</id>\n" +
                    "  <enabled>" + enableStr + "</enabled>\n" +
                    "</LineDetection>";
        } else if ("fielddetection".equals(eventType)) {
            return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
                    "<FieldDetection version=\"2.0\" xmlns=\"http://www.isapi.org/ver20/XMLSchema\">\n" +
                    "  <id>1</id>\n" +
                    "  <enabled>" + enableStr + "</enabled>\n" +
                    "</FieldDetection>";
        }
        return "";
    }

    // ==================== DTO 转换 ====================

    /**
     * 实体转 DTO
     */
    public IsapiDeviceDTO toDTO(IsapiDevice device) {
        IsapiDeviceDTO dto = IsapiDeviceDTO.builder()
                .id(device.getId())
                .factoryId(device.getFactoryId())
                .deviceName(device.getDeviceName())
                .deviceType(device.getUnifiedDeviceType() != null ?
                        device.getUnifiedDeviceType().toIsapiDeviceType() : null)
                .deviceModel(device.getDeviceModel())
                .serialNumber(device.getSerialNumber())
                .firmwareVersion(device.getFirmwareVersion())
                .ipAddress(device.getIpAddress())
                .port(device.getPort())
                .rtspPort(device.getRtspPort())
                .httpsPort(device.getHttpsPort())
                .protocol(device.getProtocol())
                .username(device.getUsername())
                .channelCount(device.getChannelCount())
                .supportsPtz(device.getSupportsPtz())
                .supportsAudio(device.getSupportsAudio())
                .supportsSmart(device.getSupportsSmart())
                .deviceCapabilities(device.getDeviceCapabilities())
                .status(device.getStatus())
                .lastError(device.getLastError())
                .lastHeartbeatAt(device.getLastHeartbeatAt())
                .lastEventAt(device.getLastEventAt())
                .alertSubscribed(device.getAlertSubscribed())
                .subscribedEvents(device.getSubscribedEvents())
                .locationDescription(device.getLocationDescription())
                .latitude(device.getLatitude())
                .longitude(device.getLongitude())
                .departmentId(device.getDepartmentId())
                .equipmentId(device.getEquipmentId())
                .createdAt(device.getCreatedAt())
                .updatedAt(device.getUpdatedAt())
                .build();

        // 加载通道
        if (device.getChannels() != null) {
            dto.setChannels(device.getChannels().stream()
                    .map(this::channelToDTO)
                    .collect(Collectors.toList()));
        }

        return dto;
    }

    private IsapiDeviceDTO.IsapiChannelDTO channelToDTO(IsapiDeviceChannel channel) {
        return IsapiDeviceDTO.IsapiChannelDTO.builder()
                .id(channel.getId())
                .channelId(channel.getChannelId())
                .channelName(channel.getChannelName())
                .channelType(channel.getChannelType() != null ? channel.getChannelType().name() : null)
                .sourceIp(channel.getSourceIp())
                .sourcePort(channel.getSourcePort())
                .mainStreamUrl(channel.getMainStreamUrl())
                .subStreamUrl(channel.getSubStreamUrl())
                .status(channel.getStatus() != null ? channel.getStatus().name() : null)
                .recordingEnabled(channel.getRecordingEnabled())
                .smartEnabled(channel.getSmartEnabled())
                .enabledEvents(channel.getEnabledEvents())
                .build();
    }
}

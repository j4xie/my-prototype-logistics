package com.cretas.aims.service.isapi;

import com.cretas.aims.client.isapi.IsapiClient;
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

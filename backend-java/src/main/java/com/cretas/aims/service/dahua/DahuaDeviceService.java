package com.cretas.aims.service.dahua;

import com.cretas.aims.client.dahua.DahuaClient;
import com.cretas.aims.client.dahua.DahuaDiscoveryClient;
import com.cretas.aims.config.DahuaConfig;
import com.cretas.aims.dto.dahua.DahuaDeviceDTO;
import com.cretas.aims.dto.dahua.DiscoveredDahuaDevice;
import com.cretas.aims.dto.isapi.SmartAnalysisDTO;
import com.cretas.aims.entity.dahua.DahuaDevice;
import com.cretas.aims.entity.dahua.DahuaDevice.DeviceStatus;
import com.cretas.aims.entity.dahua.DahuaDevice.DeviceType;
import com.cretas.aims.entity.dahua.DahuaDeviceChannel;
import com.cretas.aims.repository.dahua.DahuaDeviceChannelRepository;
import com.cretas.aims.repository.dahua.DahuaDeviceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 大华设备管理服务
 *
 * 提供大华设备的发现、管理、配置等功能
 *
 * @author Cretas Team
 * @since 2026-01-23
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DahuaDeviceService {

    private final DahuaDeviceRepository deviceRepository;
    private final DahuaDeviceChannelRepository channelRepository;
    private final DahuaClient dahuaClient;
    private final DahuaDiscoveryClient discoveryClient;
    private final DahuaConfig dahuaConfig;

    // ==================== 设备发现 ====================

    /**
     * 发现局域网中的大华设备
     *
     * @param factoryId 工厂ID
     * @param timeoutMs 超时时间（毫秒）
     * @return 发现的设备列表
     */
    public List<DiscoveredDahuaDevice> discoverDevices(String factoryId, int timeoutMs) {
        log.info("开始发现大华设备 - 工厂ID: {}, 超时: {}ms", factoryId, timeoutMs);
        List<DiscoveredDahuaDevice> devices = discoveryClient.discoverDevices(timeoutMs);
        log.info("发现 {} 台大华设备", devices.size());
        return devices;
    }

    /**
     * 在所有网络接口上发现设备
     *
     * @param factoryId 工厂ID
     * @param timeoutMs 超时时间（毫秒）
     * @return 发现的设备列表
     */
    public List<DiscoveredDahuaDevice> discoverOnAllInterfaces(String factoryId, int timeoutMs) {
        log.info("在所有网络接口上发现大华设备 - 工厂ID: {}", factoryId);
        return discoveryClient.discoverOnAllInterfaces(timeoutMs);
    }

    // ==================== 设备 CRUD (DTO) ====================

    /**
     * 添加设备 (DTO 方式)
     *
     * @param factoryId 工厂ID
     * @param dto       设备信息
     * @return 创建的设备
     */
    @Transactional
    public DahuaDevice addDevice(String factoryId, DahuaDeviceDTO dto) {
        // 1. 检查重复 (IP + port)
        Optional<DahuaDevice> existing = deviceRepository
                .findByFactoryIdAndIpAddressAndPort(factoryId, dto.getIpAddress(), dto.getPort());

        if (existing.isPresent()) {
            throw new IllegalArgumentException("设备已存在: " + dto.getIpAddress() + ":" + dto.getPort());
        }

        // 2. 加密密码
        String encryptedPassword = dahuaClient.encryptPassword(dto.getPassword());

        // 3. 创建设备实体
        DahuaDevice device = DahuaDevice.builder()
                .factoryId(factoryId)
                .deviceName(dto.getDeviceName())
                .deviceType(dto.getDeviceType() != null ? dto.getDeviceType() : DeviceType.IPC)
                .deviceModel(dto.getDeviceModel())
                .ipAddress(dto.getIpAddress())
                .port(dto.getPort() != null ? dto.getPort() : 80)
                .rtspPort(dto.getRtspPort() != null ? dto.getRtspPort() : 554)
                .tcpPort(dto.getTcpPort() != null ? dto.getTcpPort() : 37777)
                .httpsPort(dto.getHttpsPort() != null ? dto.getHttpsPort() : 443)
                .protocol(dto.getProtocol() != null ? dto.getProtocol() : DahuaDevice.Protocol.HTTP)
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

        // 4. 保存设备
        device = deviceRepository.save(device);
        log.info("添加大华设备: {} - {}", device.getDeviceName(), device.getIpAddress());

        // 5. 异步同步设备信息
        final String deviceId = device.getId();
        syncDeviceInfoAsync(deviceId);

        return device;
    }

    /**
     * 更新设备 (DTO 方式)
     *
     * @param deviceId 设备ID
     * @param dto      设备信息
     * @return 更新后的设备
     */
    @Transactional
    public DahuaDevice updateDevice(String deviceId, DahuaDeviceDTO dto) {
        DahuaDevice device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new IllegalArgumentException("设备不存在: " + deviceId));

        // 更新基本信息
        if (dto.getDeviceName() != null) {
            device.setDeviceName(dto.getDeviceName());
        }
        if (dto.getDeviceType() != null) {
            device.setDeviceType(dto.getDeviceType());
        }
        if (dto.getIpAddress() != null) {
            device.setIpAddress(dto.getIpAddress());
        }
        if (dto.getPort() != null) {
            device.setPort(dto.getPort());
        }
        if (dto.getRtspPort() != null) {
            device.setRtspPort(dto.getRtspPort());
        }
        if (dto.getTcpPort() != null) {
            device.setTcpPort(dto.getTcpPort());
        }
        if (dto.getUsername() != null) {
            device.setUsername(dto.getUsername());
        }
        if (dto.getPassword() != null && !dto.getPassword().isEmpty()) {
            device.setPasswordEncrypted(dahuaClient.encryptPassword(dto.getPassword()));
            // 清除缓存的客户端
            dahuaClient.removeDeviceClient(deviceId);
        }
        if (dto.getLocationDescription() != null) {
            device.setLocationDescription(dto.getLocationDescription());
        }
        if (dto.getLatitude() != null) {
            device.setLatitude(dto.getLatitude());
        }
        if (dto.getLongitude() != null) {
            device.setLongitude(dto.getLongitude());
        }
        if (dto.getDepartmentId() != null) {
            device.setDepartmentId(dto.getDepartmentId());
        }
        if (dto.getEquipmentId() != null) {
            device.setEquipmentId(dto.getEquipmentId());
        }

        return deviceRepository.save(device);
    }

    /**
     * 删除设备 (软删除)
     *
     * @param deviceId 设备ID
     */
    @Transactional
    public void deleteDevice(String deviceId) {
        DahuaDevice device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new IllegalArgumentException("设备不存在: " + deviceId));

        // 清除客户端缓存
        dahuaClient.removeDeviceClient(deviceId);

        // 软删除
        device.softDelete();
        deviceRepository.save(device);

        log.info("删除大华设备: {} - {}", device.getDeviceName(), device.getIpAddress());
    }

    /**
     * 分页查询设备
     *
     * @param factoryId 工厂ID
     * @param pageable  分页参数
     * @return 设备分页列表
     */
    public Page<DahuaDevice> listDevices(String factoryId, Pageable pageable) {
        return deviceRepository.findByFactoryId(factoryId, pageable);
    }

    /**
     * 搜索设备
     *
     * @param factoryId 工厂ID
     * @param keyword   关键词
     * @param pageable  分页参数
     * @return 设备分页列表
     */
    public Page<DahuaDevice> searchDevices(String factoryId, String keyword, Pageable pageable) {
        return deviceRepository.searchByKeyword(factoryId, keyword, pageable);
    }

    /**
     * 获取设备详情
     *
     * @param deviceId 设备ID
     * @return 设备信息
     */
    public DahuaDevice getDevice(String deviceId) {
        return deviceRepository.findById(deviceId)
                .orElseThrow(() -> new IllegalArgumentException("设备不存在: " + deviceId));
    }

    // ==================== 设备管理 (保留原有方法) ====================

    /**
     * 获取工厂的所有大华设备 (列表)
     *
     * @param factoryId 工厂ID
     * @return 设备列表
     */
    public List<DahuaDevice> listDevices(String factoryId) {
        return deviceRepository.findByFactoryId(factoryId);
    }

    /**
     * 根据ID获取设备（Optional）
     *
     * @param deviceId 设备ID
     * @return 设备Optional
     */
    public Optional<DahuaDevice> getDeviceOptional(String deviceId) {
        return deviceRepository.findById(deviceId);
    }

    /**
     * 根据ID获取设备
     *
     * @param deviceId 设备ID
     * @return 设备
     * @throws IllegalArgumentException 设备不存在时抛出
     */
    public DahuaDevice getDeviceById(String deviceId) {
        return deviceRepository.findById(deviceId)
                .orElseThrow(() -> new IllegalArgumentException("设备不存在: " + deviceId));
    }

    /**
     * 添加大华设备 (实体方式)
     *
     * @param device 设备信息
     * @return 保存后的设备
     */
    @Transactional
    public DahuaDevice addDevice(DahuaDevice device) {
        log.info("添加大华设备: {} ({}:{})", device.getDeviceName(),
                device.getIpAddress(), device.getPort());

        // 加密密码
        if (device.getPasswordEncrypted() != null &&
                !device.getPasswordEncrypted().contains("=")) {
            // 如果密码未加密，进行加密
            String encrypted = dahuaClient.encryptPassword(device.getPasswordEncrypted());
            device.setPasswordEncrypted(encrypted);
        }

        return deviceRepository.save(device);
    }

    /**
     * 更新大华设备 (实体方式)
     *
     * @param device 设备信息
     * @return 更新后的设备
     */
    @Transactional
    public DahuaDevice updateDevice(DahuaDevice device) {
        log.info("更新大华设备: {}", device.getId());
        return deviceRepository.save(device);
    }

    /**
     * 测试设备连接
     *
     * @param deviceId 设备ID
     * @return 连接测试结果
     */
    public Map<String, Object> testConnection(String deviceId) {
        DahuaDevice device = getDeviceById(deviceId);
        boolean connected = dahuaClient.testConnection(device);

        if (connected) {
            device.heartbeat();
            deviceRepository.save(device);
            return Map.of(
                    "success", true,
                    "message", "连接成功",
                    "status", device.getStatus().name()
            );
        } else {
            device.markOffline("连接测试失败");
            deviceRepository.save(device);
            return Map.of(
                    "success", false,
                    "message", "连接失败: " + device.getLastError(),
                    "status", device.getStatus().name()
            );
        }
    }

    /**
     * 获取设备信息
     *
     * @param deviceId 设备ID
     * @return 设备信息
     */
    public Map<String, Object> getDeviceInfo(String deviceId) throws IOException {
        DahuaDevice device = getDeviceById(deviceId);
        return dahuaClient.getDeviceInfo(device);
    }

    // ==================== 流媒体 ====================

    /**
     * 获取设备的流媒体通道列表
     *
     * @param deviceId 设备ID
     * @return 通道列表
     */
    public List<Map<String, Object>> getStreamingChannels(String deviceId) throws IOException {
        DahuaDevice device = getDeviceById(deviceId);
        return dahuaClient.getStreamingChannels(device);
    }

    /**
     * 获取RTSP流地址
     *
     * @param deviceId  设备ID
     * @param channelId 通道ID（从0开始）
     * @param subStream 是否为子码流
     * @return RTSP流地址
     */
    public String getStreamUrl(String deviceId, int channelId, boolean subStream) {
        DahuaDevice device = getDeviceById(deviceId);
        // 大华RTSP格式: rtsp://user:pass@ip:port/cam/realmonitor?channel=1&subtype=0
        int subtype = subStream ? 1 : 0;
        return String.format("%s/cam/realmonitor?channel=%d&subtype=%d",
                device.getRtspBaseUrl(), channelId + 1, subtype);
    }

    /**
     * 抓拍图片
     *
     * @param deviceId  设备ID
     * @param channelId 通道ID（从0开始）
     * @return 图片二进制数据
     */
    public byte[] capturePicture(String deviceId, int channelId) throws IOException {
        DahuaDevice device = getDeviceById(deviceId);
        return dahuaClient.capturePicture(device, channelId);
    }

    // ==================== 智能分析 ====================

    /**
     * 获取设备智能分析能力
     *
     * @param deviceId 设备ID
     * @return 智能分析能力
     */
    public SmartAnalysisDTO.SmartCapabilities getSmartCapabilities(String deviceId) throws IOException {
        DahuaDevice device = getDeviceById(deviceId);
        return dahuaClient.getSmartCapabilities(device);
    }

    /**
     * 获取越界检测配置
     *
     * @param deviceId  设备ID
     * @param channelId 通道ID
     * @return 越界检测配置
     */
    public SmartAnalysisDTO getLineDetectionConfig(String deviceId, int channelId) throws IOException {
        DahuaDevice device = getDeviceById(deviceId);
        return dahuaClient.getLineDetection(device, channelId);
    }

    /**
     * 设置越界检测配置
     *
     * @param deviceId  设备ID
     * @param channelId 通道ID
     * @param config    配置
     */
    public void setLineDetectionConfig(String deviceId, int channelId, SmartAnalysisDTO config) throws IOException {
        DahuaDevice device = getDeviceById(deviceId);
        dahuaClient.setLineDetection(device, channelId, config);
        log.info("越界检测配置已更新 - 设备: {}, 通道: {}, 启用: {}",
                deviceId, channelId, config.getEnabled());
    }

    /**
     * 获取区域入侵检测配置
     *
     * @param deviceId  设备ID
     * @param channelId 通道ID
     * @return 区域入侵检测配置
     */
    public SmartAnalysisDTO getFieldDetectionConfig(String deviceId, int channelId) throws IOException {
        DahuaDevice device = getDeviceById(deviceId);
        return dahuaClient.getFieldDetection(device, channelId);
    }

    /**
     * 设置区域入侵检测配置
     *
     * @param deviceId  设备ID
     * @param channelId 通道ID
     * @param config    配置
     */
    public void setFieldDetectionConfig(String deviceId, int channelId, SmartAnalysisDTO config) throws IOException {
        DahuaDevice device = getDeviceById(deviceId);
        dahuaClient.setFieldDetection(device, channelId, config);
        log.info("区域入侵检测配置已更新 - 设备: {}, 通道: {}, 启用: {}",
                deviceId, channelId, config.getEnabled());
    }

    /**
     * 获取人脸检测配置
     *
     * @param deviceId  设备ID
     * @param channelId 通道ID
     * @return 人脸检测配置
     */
    public SmartAnalysisDTO getFaceDetectionConfig(String deviceId, int channelId) throws IOException {
        DahuaDevice device = getDeviceById(deviceId);
        return dahuaClient.getFaceDetection(device, channelId);
    }

    /**
     * 设置人脸检测配置
     *
     * @param deviceId  设备ID
     * @param channelId 通道ID
     * @param config    配置
     */
    public void setFaceDetectionConfig(String deviceId, int channelId, SmartAnalysisDTO config) throws IOException {
        DahuaDevice device = getDeviceById(deviceId);
        dahuaClient.setFaceDetection(device, channelId, config);
        log.info("人脸检测配置已更新 - 设备: {}, 通道: {}, 启用: {}",
                deviceId, channelId, config.getEnabled());
    }

    // ==================== 设备连接与同步 ====================

    /**
     * 测试设备连接 (返回布尔值)
     *
     * @param deviceId 设备ID
     * @return 是否连接成功
     */
    public boolean testConnectionSimple(String deviceId) {
        DahuaDevice device = getDeviceById(deviceId);
        boolean success = dahuaClient.testConnection(device);

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
     * 同步设备信息 (获取型号、序列号、固件版本、能力等)
     *
     * @param deviceId 设备ID
     */
    @Transactional
    public void syncDeviceInfo(String deviceId) {
        DahuaDevice device = getDeviceById(deviceId);

        try {
            // 1. 获取设备信息
            Map<String, Object> info = dahuaClient.getDeviceInfo(device);

            if (info.containsKey("error")) {
                device.markError(String.valueOf(info.get("error")));
                deviceRepository.save(device);
                return;
            }

            // 2. 更新设备信息
            // 大华设备信息字段: deviceType, serialNumber, hardwareVersion, softwareVersion
            if (info.get("deviceType") != null) {
                device.setDeviceModel(String.valueOf(info.get("deviceType")));
            }
            if (info.get("serialNumber") != null) {
                device.setSerialNumber(String.valueOf(info.get("serialNumber")));
            }
            if (info.get("softwareVersion") != null) {
                device.setFirmwareVersion(String.valueOf(info.get("softwareVersion")));
            }
            if (info.get("macAddress") != null) {
                device.setMacAddress(String.valueOf(info.get("macAddress")));
            }

            // 3. 获取设备能力
            try {
                Map<String, Object> capabilities = dahuaClient.getCapabilities(device);
                device.setDeviceCapabilities(capabilities);

                // 根据能力更新支持的功能
                device.setSupportsPtz(capabilities.containsKey("PTZ") ||
                        capabilities.containsKey("ptz"));
                device.setSupportsAudio(capabilities.containsKey("Audio") ||
                        capabilities.containsKey("audio"));
                device.setSupportsSmart(capabilities.containsKey("IVS") ||
                        capabilities.containsKey("VideoAnalyse"));
            } catch (Exception e) {
                log.debug("获取设备能力失败 (可能不支持): {}", e.getMessage());
            }

            // 4. 标记设备在线
            device.heartbeat();
            deviceRepository.save(device);

            // 5. 同步通道信息
            syncChannelsInternal(device);

            log.info("大华设备信息同步成功: {} - {}", device.getDeviceName(), device.getSerialNumber());

        } catch (Exception e) {
            log.error("同步大华设备信息失败: {} - {}", device.getIpAddress(), e.getMessage());
            device.markError(e.getMessage());
            deviceRepository.save(device);
        }
    }

    /**
     * 异步同步设备信息
     *
     * @param deviceId 设备ID
     */
    @Async
    public void syncDeviceInfoAsync(String deviceId) {
        syncDeviceInfo(deviceId);
    }

    /**
     * 异步同步设备通道
     *
     * @param deviceId 设备ID
     */
    @Async
    @Transactional
    public void syncChannels(String deviceId) {
        DahuaDevice device = getDeviceById(deviceId);
        syncChannelsInternal(device);
    }

    /**
     * 同步设备通道 (内部方法)
     *
     * @param device 设备实体
     */
    @Transactional
    protected void syncChannelsInternal(DahuaDevice device) {
        try {
            // 1. 获取通道列表
            List<Map<String, Object>> channels = dahuaClient.getStreamingChannels(device);

            // 2. 更新通道数量
            device.setChannelCount(channels.isEmpty() ? 1 : channels.size());
            deviceRepository.save(device);

            // 3. 删除旧通道
            channelRepository.deleteByDeviceId(device.getId());

            // 4. 创建新通道
            for (Map<String, Object> channelInfo : channels) {
                Integer channelId = null;

                // 尝试获取通道 ID
                Object channelIdObj = channelInfo.get("channelId");
                if (channelIdObj instanceof Number) {
                    channelId = ((Number) channelIdObj).intValue();
                } else if (channelIdObj != null) {
                    try {
                        channelId = Integer.parseInt(String.valueOf(channelIdObj).replaceAll("\\D", ""));
                    } catch (NumberFormatException ignored) {
                    }
                }

                if (channelId == null) continue;

                String channelName = channelInfo.get("Name") != null ?
                        String.valueOf(channelInfo.get("Name")) : "Channel " + channelId;

                DahuaDeviceChannel channel = DahuaDeviceChannel.builder()
                        .device(device)
                        .factoryId(device.getFactoryId())
                        .channelId(channelId)
                        .channelName(channelName)
                        .status(DahuaDeviceChannel.ChannelStatus.ONLINE)
                        .build();

                channelRepository.save(channel);
            }

            // 如果没有获取到通道，至少创建一个默认通道 (IPC 通常只有1个通道)
            if (channels.isEmpty() && device.getDeviceType() == DeviceType.IPC) {
                DahuaDeviceChannel defaultChannel = DahuaDeviceChannel.builder()
                        .device(device)
                        .factoryId(device.getFactoryId())
                        .channelId(1)
                        .channelName("Main Camera")
                        .channelType(DahuaDeviceChannel.ChannelType.IP)
                        .status(DahuaDeviceChannel.ChannelStatus.ONLINE)
                        .build();
                channelRepository.save(defaultChannel);
            }

            log.info("同步大华通道成功: {} - {} 个通道", device.getDeviceName(),
                    channels.isEmpty() ? 1 : channels.size());

        } catch (Exception e) {
            log.error("同步大华通道失败: {} - {}", device.getIpAddress(), e.getMessage());
        }
    }

    // ==================== 流媒体 & 抓拍 (扩展) ====================

    /**
     * 获取设备流地址 (Map 形式)
     * 大华 RTSP URL 格式: rtsp://user:pass@ip:port/cam/realmonitor?channel=N&subtype=0|1|2
     *
     * @param deviceId  设备ID
     * @param channelId 通道ID
     * @return 流地址 Map (mainStream, subStream, thirdStream)
     */
    public Map<String, String> getStreamUrls(String deviceId, int channelId) {
        DahuaDevice device = getDeviceById(deviceId);
        String password = dahuaClient.decryptPassword(device.getPasswordEncrypted());

        Map<String, String> urls = new HashMap<>();

        // 主码流 (subtype=0)
        urls.put("mainStream", String.format("rtsp://%s:%s@%s:%d/cam/realmonitor?channel=%d&subtype=0",
                device.getUsername(), password,
                device.getIpAddress(), device.getRtspPort(),
                channelId));

        // 子码流 (subtype=1)
        urls.put("subStream", String.format("rtsp://%s:%s@%s:%d/cam/realmonitor?channel=%d&subtype=1",
                device.getUsername(), password,
                device.getIpAddress(), device.getRtspPort(),
                channelId));

        // 第三码流 (subtype=2) - 大华支持三码流
        urls.put("thirdStream", String.format("rtsp://%s:%s@%s:%d/cam/realmonitor?channel=%d&subtype=2",
                device.getUsername(), password,
                device.getIpAddress(), device.getRtspPort(),
                channelId));

        return urls;
    }

    /**
     * 抓拍图片 (返回 Base64 编码)
     *
     * @param deviceId  设备ID
     * @param channelId 通道ID
     * @return Base64 编码的图片数据
     */
    public String capturePictureBase64(String deviceId, int channelId) {
        DahuaDevice device = getDeviceById(deviceId);

        try {
            byte[] pictureData = dahuaClient.capturePicture(device, channelId);
            return Base64.getEncoder().encodeToString(pictureData);
        } catch (Exception e) {
            log.error("大华设备抓拍失败: {} - {}", device.getIpAddress(), e.getMessage());
            throw new RuntimeException("抓拍失败: " + e.getMessage(), e);
        }
    }

    // ==================== 从发现导入 ====================

    /**
     * 从发现结果导入设备
     *
     * @param factoryId  工厂ID
     * @param discovered 发现的设备信息
     * @param username   用户名
     * @param password   密码
     * @return 创建的设备
     */
    @Transactional
    public DahuaDevice importFromDiscovery(String factoryId, DiscoveredDahuaDevice discovered,
                                           String username, String password) {
        // 检查 MAC 地址是否已存在
        Optional<DahuaDevice> existingByMac = deviceRepository.findByMacAddressIgnoreCase(discovered.getMac());
        if (existingByMac.isPresent()) {
            throw new IllegalArgumentException("设备已存在 (MAC: " + discovered.getMac() + ")");
        }

        // 检查 IP + Port 是否已存在
        Integer httpPort = discovered.getHttpPort() != null ? discovered.getHttpPort() : 80;
        Optional<DahuaDevice> existingByIp = deviceRepository
                .findByFactoryIdAndIpAddressAndPort(factoryId, discovered.getIpAddress(), httpPort);
        if (existingByIp.isPresent()) {
            throw new IllegalArgumentException("设备已存在 (IP: " + discovered.getIpAddress() + ")");
        }

        // 解析设备类型
        DeviceType deviceType = parseDeviceType(discovered.getDeviceType());

        // 创建 DTO 并添加设备
        DahuaDeviceDTO dto = DahuaDeviceDTO.builder()
                .deviceName(discovered.getModel() != null ? discovered.getModel() : "Dahua Device")
                .deviceType(deviceType)
                .deviceModel(discovered.getModel())
                .ipAddress(discovered.getIpAddress())
                .port(httpPort)
                .tcpPort(discovered.getPort() != null ? discovered.getPort() : 37777)
                .username(username)
                .password(password)
                .build();

        DahuaDevice device = addDevice(factoryId, dto);

        // 更新从发现获取的额外信息
        device.setMacAddress(discovered.getMac());
        device.setSerialNumber(discovered.getSerialNumber());
        device.setFirmwareVersion(discovered.getFirmwareVersion());

        if (!Boolean.TRUE.equals(discovered.getActivated())) {
            device.markUnactivated();
        }

        return deviceRepository.save(device);
    }

    /**
     * 解析设备类型字符串
     */
    private DeviceType parseDeviceType(String typeStr) {
        if (typeStr == null) {
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

    // ==================== 状态管理 ====================

    /**
     * 获取设备状态统计
     *
     * @param factoryId 工厂ID
     * @return 状态统计 Map
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
     * 获取设备明文密码
     *
     * @param deviceId 设备ID
     * @return 明文密码
     */
    public String getDecryptedPassword(String deviceId) {
        DahuaDevice device = getDeviceById(deviceId);
        return dahuaClient.decryptPassword(device.getPasswordEncrypted());
    }

    // ==================== DTO 转换 ====================

    /**
     * 实体转 DTO
     *
     * @param device 设备实体
     * @return DTO
     */
    public DahuaDeviceDTO toDTO(DahuaDevice device) {
        DahuaDeviceDTO dto = DahuaDeviceDTO.builder()
                .id(device.getId())
                .factoryId(device.getFactoryId())
                .deviceName(device.getDeviceName())
                .deviceType(device.getDeviceType())
                .deviceModel(device.getDeviceModel())
                .serialNumber(device.getSerialNumber())
                .macAddress(device.getMacAddress())
                .firmwareVersion(device.getFirmwareVersion())
                .ipAddress(device.getIpAddress())
                .port(device.getPort())
                .rtspPort(device.getRtspPort())
                .tcpPort(device.getTcpPort())
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

    /**
     * 通道实体转 DTO
     */
    private DahuaDeviceDTO.DahuaChannelDTO channelToDTO(DahuaDeviceChannel channel) {
        return DahuaDeviceDTO.DahuaChannelDTO.builder()
                .id(channel.getId())
                .channelId(channel.getChannelId())
                .channelName(channel.getChannelName())
                .channelType(channel.getChannelType() != null ? channel.getChannelType().name() : null)
                .sourceIp(channel.getSourceIp())
                .sourcePort(channel.getSourcePort())
                .mainStreamUrl(channel.getMainStreamUrl())
                .subStreamUrl(channel.getSubStreamUrl())
                .thirdStreamUrl(channel.getThirdStreamUrl())
                .status(channel.getStatus() != null ? channel.getStatus().name() : null)
                .recordingEnabled(channel.getRecordingEnabled())
                .smartEnabled(channel.getSmartEnabled())
                .enabledEvents(channel.getEnabledEvents())
                .build();
    }
}

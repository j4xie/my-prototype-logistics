package com.cretas.aims.service.dahua;

import com.cretas.aims.client.dahua.DahuaClient;
import com.cretas.aims.client.dahua.DahuaDiscoveryClient;
import com.cretas.aims.dto.dahua.DiscoveredDahuaDevice;
import com.cretas.aims.entity.dahua.DahuaDevice;
import com.cretas.aims.entity.dahua.DahuaDevice.DeviceStatus;
import com.cretas.aims.repository.dahua.DahuaDeviceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 大华设备发现服务
 *
 * 整合 UDP 发现协议和设备管理功能:
 * - 通过 DHDiscover UDP 协议发现局域网内的大华设备
 * - 过滤已注册设备，返回新发现的设备
 * - 支持 HTTP 探测单个设备
 * - 提供发现统计信息
 *
 * @author Cretas Team
 * @since 2026-01-23
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DahuaDiscoveryService {

    private final DahuaDiscoveryClient dahuaDiscoveryClient;
    private final DahuaDeviceRepository dahuaDeviceRepository;
    private final DahuaClient dahuaClient;

    /**
     * HTTP 探测端点
     */
    private static final String MAGIC_BOX_ENDPOINT = "/cgi-bin/magicBox.cgi?action=getSystemInfo";

    /**
     * HTTP 探测超时 (秒)
     */
    private static final int HTTP_PROBE_TIMEOUT_SECONDS = 5;

    /**
     * 解析响应的正则模式
     */
    private static final Pattern PATTERN_DEVICE_TYPE = Pattern.compile("deviceType=(.+)");
    private static final Pattern PATTERN_SERIAL_NUMBER = Pattern.compile("serialNumber=(.+)");
    private static final Pattern PATTERN_MAC_ADDRESS = Pattern.compile("macAddress=(.+)");
    private static final Pattern PATTERN_DEVICE_MODEL = Pattern.compile("hardwareVersion=(.+)");
    private static final Pattern PATTERN_FIRMWARE_VERSION = Pattern.compile("softwareVersion=(.+)");

    // ==================== 主要发现方法 ====================

    /**
     * 发现局域网中的大华设备
     * 自动过滤已注册的设备
     *
     * @param factoryId 工厂ID
     * @param timeoutMs 发现超时时间 (毫秒)
     * @return 新发现的设备列表 (不包含已注册设备)
     */
    public List<DiscoveredDahuaDevice> discoverDevices(String factoryId, int timeoutMs) {
        log.info("开始大华设备发现: factoryId={}, timeout={}ms", factoryId, timeoutMs);
        long startTime = System.currentTimeMillis();

        // 1. 通过 UDP 发现设备
        List<DiscoveredDahuaDevice> allDiscovered = dahuaDiscoveryClient.discoverDevices(timeoutMs);
        log.debug("UDP 发现 {} 台设备", allDiscovered.size());

        // 2. 过滤已注册的设备
        List<DiscoveredDahuaDevice> newDevices = filterRegisteredDevices(factoryId, allDiscovered);

        long elapsed = System.currentTimeMillis() - startTime;
        log.info("大华设备发现完成: 发现 {} 台, 新设备 {} 台, 耗时 {}ms",
                allDiscovered.size(), newDevices.size(), elapsed);

        return newDevices;
    }

    /**
     * 在所有网络接口上发现设备
     * 适用于多网卡环境或跨子网发现
     *
     * @param factoryId 工厂ID
     * @param timeoutMs 发现超时时间 (毫秒)
     * @return 新发现的设备列表 (不包含已注册设备)
     */
    public List<DiscoveredDahuaDevice> discoverOnAllInterfaces(String factoryId, int timeoutMs) {
        log.info("开始大华设备全接口发现: factoryId={}, timeout={}ms", factoryId, timeoutMs);
        long startTime = System.currentTimeMillis();

        // 1. 在所有网络接口上发现
        List<DiscoveredDahuaDevice> allDiscovered = dahuaDiscoveryClient.discoverOnAllInterfaces(timeoutMs);
        log.debug("全接口 UDP 发现 {} 台设备", allDiscovered.size());

        // 2. 过滤已注册的设备
        List<DiscoveredDahuaDevice> newDevices = filterRegisteredDevices(factoryId, allDiscovered);

        long elapsed = System.currentTimeMillis() - startTime;
        log.info("大华设备全接口发现完成: 发现 {} 台, 新设备 {} 台, 耗时 {}ms",
                allDiscovered.size(), newDevices.size(), elapsed);

        return newDevices;
    }

    /**
     * 在指定子网上发现设备
     *
     * @param factoryId 工厂ID
     * @param subnet    子网地址 (例如: "192.168.1.0" 或 "192.168.1")
     * @param timeoutMs 发现超时时间 (毫秒)
     * @return 新发现的设备列表
     */
    public List<DiscoveredDahuaDevice> discoverOnSubnet(String factoryId, String subnet, int timeoutMs) {
        log.info("开始大华设备子网发现: factoryId={}, subnet={}, timeout={}ms", factoryId, subnet, timeoutMs);

        List<DiscoveredDahuaDevice> allDiscovered = dahuaDiscoveryClient.discoverDevicesOnSubnet(subnet, timeoutMs);
        return filterRegisteredDevices(factoryId, allDiscovered);
    }

    // ==================== 单设备探测 ====================

    /**
     * 探测单个设备
     * 1. 先尝试 UDP 发现
     * 2. 如果 UDP 发现失败，尝试 HTTP 探测
     *
     * @param ipAddress IP 地址
     * @param port      HTTP 端口 (通常为 80)
     * @return 设备信息，如果探测失败返回 null
     */
    public DiscoveredDahuaDevice probeDevice(String ipAddress, int port) {
        log.debug("开始探测设备: {}:{}", ipAddress, port);
        long startTime = System.currentTimeMillis();

        // 1. 尝试 UDP 发现 (短超时)
        List<DiscoveredDahuaDevice> udpDevices = dahuaDiscoveryClient.discoverDevices(2000);
        Optional<DiscoveredDahuaDevice> udpFound = udpDevices.stream()
                .filter(d -> ipAddress.equals(d.getIpAddress()))
                .findFirst();

        if (udpFound.isPresent()) {
            DiscoveredDahuaDevice device = udpFound.get();
            log.debug("通过 UDP 发现设备: {} ({})", device.getModel(), device.getMac());
            return device;
        }

        // 2. UDP 未发现，尝试 HTTP 探测
        DiscoveredDahuaDevice httpDevice = probeDeviceViaHttp(ipAddress, port);
        if (httpDevice != null) {
            log.debug("通过 HTTP 探测发现设备: {}:{}", ipAddress, port);
            return httpDevice;
        }

        log.debug("探测设备失败: {}:{}, 耗时 {}ms", ipAddress, port, System.currentTimeMillis() - startTime);
        return null;
    }

    /**
     * 仅通过 HTTP 探测设备
     * 访问 /cgi-bin/magicBox.cgi?action=getSystemInfo 获取设备信息
     *
     * @param ipAddress IP 地址
     * @param port      HTTP 端口
     * @return 设备信息，如果探测失败返回 null
     */
    public DiscoveredDahuaDevice probeDeviceViaHttp(String ipAddress, int port) {
        String url = String.format("http://%s:%d%s", ipAddress, port, MAGIC_BOX_ENDPOINT);

        try {
            OkHttpClient probeClient = new OkHttpClient.Builder()
                    .connectTimeout(HTTP_PROBE_TIMEOUT_SECONDS, TimeUnit.SECONDS)
                    .readTimeout(HTTP_PROBE_TIMEOUT_SECONDS, TimeUnit.SECONDS)
                    .build();

            Request request = new Request.Builder()
                    .url(url)
                    .get()
                    .build();

            try (Response response = probeClient.newCall(request).execute()) {
                int statusCode = response.code();

                // 401 表示需要认证，但确认是大华设备
                if (statusCode == 401) {
                    String authHeader = response.header("WWW-Authenticate");
                    if (authHeader != null && authHeader.toLowerCase().contains("digest")) {
                        return DiscoveredDahuaDevice.builder()
                                .ipAddress(ipAddress)
                                .httpPort(port)
                                .port(37777) // 大华默认控制端口
                                .vendor("Dahua")
                                .activated(true) // 需要认证说明已激活
                                .discoveredAt(System.currentTimeMillis())
                                .build();
                    }
                }

                // 200 表示无需认证可访问 (通常是未激活设备)
                if (statusCode == 200) {
                    ResponseBody body = response.body();
                    if (body != null) {
                        String content = body.string();
                        return parseHttpDeviceInfo(ipAddress, port, content);
                    }
                }
            }
        } catch (IOException e) {
            log.trace("HTTP 探测失败 {}:{} - {}", ipAddress, port, e.getMessage());
        }

        return null;
    }

    // ==================== 设备注册检查 ====================

    /**
     * 检查设备是否已注册
     *
     * @param factoryId 工厂ID
     * @param device    发现的设备
     * @return true 表示设备已注册
     */
    public boolean isDeviceRegistered(String factoryId, DiscoveredDahuaDevice device) {
        if (device == null) {
            return false;
        }

        // 1. 优先通过 MAC 地址检查 (最可靠的标识)
        if (device.getMac() != null && !device.getMac().isEmpty()) {
            Optional<DahuaDevice> byMac = dahuaDeviceRepository.findByMacAddressIgnoreCase(device.getMac());
            if (byMac.isPresent()) {
                log.trace("设备已注册 (MAC: {})", device.getMac());
                return true;
            }
        }

        // 2. 通过 IP + 端口检查
        if (device.getIpAddress() != null) {
            int port = device.getHttpPort() != null ? device.getHttpPort() : 80;
            Optional<DahuaDevice> byIpPort = dahuaDeviceRepository.findByFactoryIdAndIpAddressAndPort(
                    factoryId, device.getIpAddress(), port);
            if (byIpPort.isPresent()) {
                log.trace("设备已注册 (IP+Port: {}:{})", device.getIpAddress(), port);
                return true;
            }
        }

        // 3. 通过序列号检查
        if (device.getSerialNumber() != null && !device.getSerialNumber().isEmpty()) {
            Optional<DahuaDevice> bySerial = dahuaDeviceRepository.findBySerialNumber(device.getSerialNumber());
            if (bySerial.isPresent()) {
                log.trace("设备已注册 (序列号: {})", device.getSerialNumber());
                return true;
            }
        }

        return false;
    }

    // ==================== 统计方法 ====================

    /**
     * 获取设备发现统计信息
     *
     * @param factoryId 工厂ID
     * @return 统计信息 Map
     */
    public Map<String, Object> getDiscoveryStats(String factoryId) {
        Map<String, Object> stats = new LinkedHashMap<>();

        // 基础统计
        long totalRegistered = dahuaDeviceRepository.countByFactoryId(factoryId);
        long onlineCount = dahuaDeviceRepository.countByFactoryIdAndStatus(factoryId, DeviceStatus.ONLINE);
        long offlineCount = dahuaDeviceRepository.countByFactoryIdAndStatus(factoryId, DeviceStatus.OFFLINE);
        long unactivatedCount = dahuaDeviceRepository.countByFactoryIdAndStatus(factoryId, DeviceStatus.UNACTIVATED);
        long errorCount = dahuaDeviceRepository.countByFactoryIdAndStatus(factoryId, DeviceStatus.ERROR);
        long unknownCount = dahuaDeviceRepository.countByFactoryIdAndStatus(factoryId, DeviceStatus.UNKNOWN);

        stats.put("totalRegistered", totalRegistered);
        stats.put("onlineCount", onlineCount);
        stats.put("offlineCount", offlineCount);
        stats.put("unactivatedCount", unactivatedCount);
        stats.put("errorCount", errorCount);
        stats.put("unknownCount", unknownCount);

        // 计算在线率
        if (totalRegistered > 0) {
            double onlineRate = (double) onlineCount / totalRegistered * 100;
            stats.put("onlineRate", String.format("%.1f%%", onlineRate));
        } else {
            stats.put("onlineRate", "N/A");
        }

        return stats;
    }

    /**
     * 获取按状态分组的统计信息
     *
     * @param factoryId 工厂ID
     * @return 各状态的设备数量
     */
    public Map<DeviceStatus, Long> getStatusCounts(String factoryId) {
        Map<DeviceStatus, Long> statusCounts = new EnumMap<>(DeviceStatus.class);

        // 初始化所有状态为 0
        for (DeviceStatus status : DeviceStatus.values()) {
            statusCounts.put(status, 0L);
        }

        // 从数据库获取实际统计
        List<Object[]> results = dahuaDeviceRepository.countByStatus(factoryId);
        for (Object[] row : results) {
            DeviceStatus status = (DeviceStatus) row[0];
            Long count = (Long) row[1];
            statusCounts.put(status, count);
        }

        return statusCounts;
    }

    // ==================== 辅助方法 ====================

    /**
     * 过滤已注册的设备
     *
     * @param factoryId    工厂ID
     * @param allDiscovered 所有发现的设备
     * @return 未注册的新设备列表
     */
    private List<DiscoveredDahuaDevice> filterRegisteredDevices(
            String factoryId, List<DiscoveredDahuaDevice> allDiscovered) {

        if (allDiscovered == null || allDiscovered.isEmpty()) {
            return Collections.emptyList();
        }

        // 获取该工厂所有已注册设备的 MAC 地址和 IP+Port
        List<DahuaDevice> registeredDevices = dahuaDeviceRepository.findByFactoryId(factoryId);

        Set<String> registeredMacs = registeredDevices.stream()
                .filter(d -> d.getMacAddress() != null)
                .map(d -> d.getMacAddress().replace(":", "").toLowerCase())
                .collect(Collectors.toSet());

        Set<String> registeredIpPorts = registeredDevices.stream()
                .map(d -> d.getIpAddress() + ":" + d.getPort())
                .collect(Collectors.toSet());

        Set<String> registeredSerials = registeredDevices.stream()
                .filter(d -> d.getSerialNumber() != null)
                .map(DahuaDevice::getSerialNumber)
                .collect(Collectors.toSet());

        return allDiscovered.stream()
                .filter(device -> {
                    // 检查 MAC 地址
                    if (device.getMac() != null) {
                        String normalizedMac = device.getMac().replace(":", "").toLowerCase();
                        if (registeredMacs.contains(normalizedMac)) {
                            return false;
                        }
                    }

                    // 检查 IP + Port
                    int port = device.getHttpPort() != null ? device.getHttpPort() : 80;
                    String ipPort = device.getIpAddress() + ":" + port;
                    if (registeredIpPorts.contains(ipPort)) {
                        return false;
                    }

                    // 检查序列号
                    if (device.getSerialNumber() != null && registeredSerials.contains(device.getSerialNumber())) {
                        return false;
                    }

                    return true;
                })
                .collect(Collectors.toList());
    }

    /**
     * 解析 HTTP 响应中的设备信息
     *
     * @param ipAddress IP 地址
     * @param port      HTTP 端口
     * @param response  响应内容 (key=value 格式)
     * @return 设备信息
     */
    private DiscoveredDahuaDevice parseHttpDeviceInfo(String ipAddress, int port, String response) {
        if (response == null || response.isEmpty()) {
            return null;
        }

        // 确认是大华设备响应
        String lowerResponse = response.toLowerCase();
        if (!lowerResponse.contains("dahua") && !lowerResponse.contains("serialnumber") &&
                !lowerResponse.contains("devicetype")) {
            return null;
        }

        DiscoveredDahuaDevice device = DiscoveredDahuaDevice.builder()
                .ipAddress(ipAddress)
                .httpPort(port)
                .port(37777) // 大华默认控制端口
                .vendor("Dahua")
                .discoveredAt(System.currentTimeMillis())
                .build();

        // 解析各字段
        String[] lines = response.split("\n");
        for (String line : lines) {
            line = line.trim();
            if (line.isEmpty()) continue;

            // 设备类型
            Matcher m = PATTERN_DEVICE_TYPE.matcher(line);
            if (m.find()) {
                device.setDeviceType(m.group(1).trim());
                continue;
            }

            // 序列号
            m = PATTERN_SERIAL_NUMBER.matcher(line);
            if (m.find()) {
                device.setSerialNumber(m.group(1).trim());
                continue;
            }

            // MAC 地址
            m = PATTERN_MAC_ADDRESS.matcher(line);
            if (m.find()) {
                device.setMac(m.group(1).trim());
                continue;
            }

            // 型号 (hardwareVersion)
            m = PATTERN_DEVICE_MODEL.matcher(line);
            if (m.find()) {
                device.setModel(m.group(1).trim());
                continue;
            }

            // 固件版本
            m = PATTERN_FIRMWARE_VERSION.matcher(line);
            if (m.find()) {
                device.setFirmwareVersion(m.group(1).trim());
            }
        }

        // 判断是否已激活 (通常无需认证能获取信息的设备是未激活状态)
        device.setActivated(false);

        return device;
    }

    /**
     * 快速扫描 - 使用默认超时
     *
     * @param factoryId 工厂ID
     * @return 新发现的设备列表
     */
    public List<DiscoveredDahuaDevice> quickDiscovery(String factoryId) {
        return discoverDevices(factoryId, DahuaDiscoveryClient.DEFAULT_TIMEOUT_MS);
    }

    /**
     * 深度扫描 - 使用更长超时和所有网络接口
     *
     * @param factoryId 工厂ID
     * @return 新发现的设备列表
     */
    public List<DiscoveredDahuaDevice> deepDiscovery(String factoryId) {
        return discoverOnAllInterfaces(factoryId, 15000);
    }
}

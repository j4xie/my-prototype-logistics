package com.cretas.aims.service.isapi;

import com.cretas.aims.dto.isapi.DeviceDiscoveryRequest;
import com.cretas.aims.dto.isapi.DiscoveredDeviceDTO;
import lombok.extern.slf4j.Slf4j;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * ISAPI 设备发现服务
 * 扫描局域网中的摄像机设备，支持海康威视、大华等主流厂商
 *
 * @author Cretas Team
 * @since 2026-01-08
 */
@Slf4j
@Service
public class IsapiDeviceDiscoveryService {

    private final OkHttpClient httpClient;

    // 设备识别常量
    private static final String MANUFACTURER_HIKVISION = "HIKVISION";
    private static final String MANUFACTURER_DAHUA = "DAHUA";
    private static final String MANUFACTURER_UNIVIEW = "UNIVIEW";
    private static final String MANUFACTURER_OTHER = "OTHER";

    // 设备类型常量
    private static final String DEVICE_TYPE_IPC = "IPC";
    private static final String DEVICE_TYPE_NVR = "NVR";
    private static final String DEVICE_TYPE_DVR = "DVR";
    private static final String DEVICE_TYPE_ENCODER = "ENCODER";
    private static final String DEVICE_TYPE_UNKNOWN = "UNKNOWN";

    // 探测端点
    private static final String ISAPI_DEVICE_INFO = "/ISAPI/System/deviceInfo";
    private static final String DAHUA_RPC = "/RPC2";

    // XML 解析正则
    private static final Pattern PATTERN_DEVICE_NAME = Pattern.compile("<deviceName>([^<]+)</deviceName>");
    private static final Pattern PATTERN_DEVICE_TYPE = Pattern.compile("<deviceType>([^<]+)</deviceType>");
    private static final Pattern PATTERN_MODEL = Pattern.compile("<model>([^<]+)</model>");
    private static final Pattern PATTERN_SERIAL_NUMBER = Pattern.compile("<serialNumber>([^<]+)</serialNumber>");
    private static final Pattern PATTERN_FIRMWARE_VERSION = Pattern.compile("<firmwareVersion>([^<]+)</firmwareVersion>");
    private static final Pattern PATTERN_MAC_ADDRESS = Pattern.compile("<macAddress>([^<]+)</macAddress>");

    public IsapiDeviceDiscoveryService(
            @Qualifier("isapiHttpClient") OkHttpClient httpClient) {
        this.httpClient = httpClient;
    }

    /**
     * 扫描指定网段发现设备
     *
     * @param request 发现请求参数
     * @return 发现的设备列表
     */
    public List<DiscoveredDeviceDTO> discoverDevices(DeviceDiscoveryRequest request) {
        return discoverDevices(
                request.getNetworkCIDR(),
                request.getTimeout(),
                request.getPorts(),
                request.getMaxConcurrent()
        );
    }

    /**
     * 扫描指定网段发现设备
     *
     * @param networkCIDR   网段 CIDR (如 "192.168.1.0/24")
     * @param timeout       超时时间（秒）
     * @param ports         要扫描的端口列表
     * @param maxConcurrent 最大并发数
     * @return 发现的设备列表
     */
    public List<DiscoveredDeviceDTO> discoverDevices(
            String networkCIDR,
            int timeout,
            List<Integer> ports,
            int maxConcurrent) {

        log.info("开始设备发现: network={}, timeout={}s, ports={}, concurrent={}",
                networkCIDR, timeout, ports, maxConcurrent);

        long startTime = System.currentTimeMillis();

        // 解析 CIDR 获取 IP 列表
        List<String> ipList = parseCIDR(networkCIDR);
        if (ipList.isEmpty()) {
            log.warn("无法解析网段: {}", networkCIDR);
            return Collections.emptyList();
        }

        log.info("解析得到 {} 个 IP 地址", ipList.size());

        // 创建线程池
        ExecutorService executor = Executors.newFixedThreadPool(maxConcurrent);
        int timeoutMs = timeout * 1000;

        try {
            // 第一阶段: 并发 Ping 检测在线主机
            List<String> onlineHosts = pingHosts(executor, ipList, timeoutMs);
            log.info("Ping 检测完成, {} 个主机在线", onlineHosts.size());

            if (onlineHosts.isEmpty()) {
                return Collections.emptyList();
            }

            // 第二阶段: 对在线主机扫描指定端口
            Map<String, List<Integer>> hostOpenPorts = scanPorts(executor, onlineHosts, ports, timeoutMs);
            log.info("端口扫描完成, {} 个主机有开放端口", hostOpenPorts.size());

            // 第三阶段: 对开放端口进行 HTTP 探测
            List<DiscoveredDeviceDTO> devices = probeDevices(executor, hostOpenPorts, timeoutMs);

            long elapsed = System.currentTimeMillis() - startTime;
            log.info("设备发现完成: 扫描 {} 个IP, 发现 {} 个设备, 耗时 {}ms",
                    ipList.size(), devices.size(), elapsed);

            return devices;

        } finally {
            executor.shutdown();
            try {
                if (!executor.awaitTermination(5, TimeUnit.SECONDS)) {
                    executor.shutdownNow();
                }
            } catch (InterruptedException e) {
                executor.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }
    }

    /**
     * 探测单个设备
     *
     * @param ip   IP 地址
     * @param port 端口
     * @return 设备信息，如果探测失败返回 null
     */
    public DiscoveredDeviceDTO probeDevice(String ip, int port) {
        long startTime = System.currentTimeMillis();

        // 尝试 ISAPI 协议 (海康威视)
        DiscoveredDeviceDTO result = probeIsapiDevice(ip, port);
        if (result != null) {
            result.setProbeTimeMs(System.currentTimeMillis() - startTime);
            return result;
        }

        // 尝试大华 RPC2 协议
        result = probeDahuaDevice(ip, port);
        if (result != null) {
            result.setProbeTimeMs(System.currentTimeMillis() - startTime);
            return result;
        }

        // 尝试通用 HTTP 探测
        result = probeGenericHttpDevice(ip, port);
        if (result != null) {
            result.setProbeTimeMs(System.currentTimeMillis() - startTime);
            return result;
        }

        return null;
    }

    /**
     * 识别制造商
     *
     * @param httpResponse HTTP 响应内容
     * @return 制造商标识
     */
    public String identifyManufacturer(String httpResponse) {
        if (httpResponse == null || httpResponse.isEmpty()) {
            return MANUFACTURER_OTHER;
        }

        String lowerResponse = httpResponse.toLowerCase();

        // 海康威视特征
        if (lowerResponse.contains("hikvision") ||
                lowerResponse.contains("hikdigital") ||
                lowerResponse.contains("hik-connect") ||
                (lowerResponse.contains("<devicename>") && lowerResponse.contains("<serialnumber>"))) {
            return MANUFACTURER_HIKVISION;
        }

        // 大华特征
        if (lowerResponse.contains("dahua") ||
                lowerResponse.contains("dh-") ||
                lowerResponse.contains("imou") ||
                (lowerResponse.contains("\"id\"") && lowerResponse.contains("\"session\""))) {
            return MANUFACTURER_DAHUA;
        }

        // 宇视特征
        if (lowerResponse.contains("uniview") ||
                lowerResponse.contains("unv") ||
                (lowerResponse.contains("ipc") && lowerResponse.contains("ezstation"))) {
            return MANUFACTURER_UNIVIEW;
        }

        return MANUFACTURER_OTHER;
    }

    // ==================== 私有方法 ====================

    /**
     * 解析 CIDR 获取 IP 列表
     */
    private List<String> parseCIDR(String cidr) {
        List<String> ipList = new ArrayList<>();

        try {
            if (cidr == null || !cidr.contains("/")) {
                log.warn("无效的 CIDR 格式: {}", cidr);
                return ipList;
            }

            String[] parts = cidr.split("/");
            String baseIp = parts[0];
            int prefixLength = Integer.parseInt(parts[1]);

            // 验证前缀长度
            if (prefixLength < 16 || prefixLength > 30) {
                log.warn("CIDR 前缀长度超出范围 (16-30): {}", prefixLength);
                return ipList;
            }

            // 计算子网掩码和主机数
            int hostBits = 32 - prefixLength;
            int hostCount = (1 << hostBits) - 2; // 排除网络地址和广播地址

            // 解析基础 IP
            String[] octets = baseIp.split("\\.");
            if (octets.length != 4) {
                log.warn("无效的 IP 地址: {}", baseIp);
                return ipList;
            }

            long baseIpLong = 0;
            for (int i = 0; i < 4; i++) {
                baseIpLong = (baseIpLong << 8) | Integer.parseInt(octets[i]);
            }

            // 计算网络地址
            long mask = 0xFFFFFFFFL << hostBits;
            long networkAddress = baseIpLong & mask;

            // 生成有效主机 IP 列表
            for (int i = 1; i <= hostCount; i++) {
                long hostIp = networkAddress + i;
                String ip = String.format("%d.%d.%d.%d",
                        (hostIp >> 24) & 0xFF,
                        (hostIp >> 16) & 0xFF,
                        (hostIp >> 8) & 0xFF,
                        hostIp & 0xFF);
                ipList.add(ip);
            }

            log.debug("CIDR {} 解析得到 {} 个 IP", cidr, ipList.size());

        } catch (Exception e) {
            log.error("解析 CIDR 失败: {}", cidr, e);
        }

        return ipList;
    }

    /**
     * 并发 Ping 检测主机在线状态
     */
    private List<String> pingHosts(ExecutorService executor, List<String> ipList, int timeoutMs) {
        List<Future<String>> futures = new ArrayList<>();

        for (String ip : ipList) {
            futures.add(executor.submit(() -> {
                try {
                    InetAddress address = InetAddress.getByName(ip);
                    if (address.isReachable(Math.min(timeoutMs, 3000))) {
                        return ip;
                    }
                } catch (Exception e) {
                    log.trace("Ping {} 失败: {}", ip, e.getMessage());
                }
                return null;
            }));
        }

        List<String> onlineHosts = new ArrayList<>();
        for (Future<String> future : futures) {
            try {
                String ip = future.get(timeoutMs + 1000, TimeUnit.MILLISECONDS);
                if (ip != null) {
                    onlineHosts.add(ip);
                }
            } catch (Exception e) {
                // 忽略超时和其他异常
            }
        }

        return onlineHosts;
    }

    /**
     * 扫描端口开放情况
     */
    private Map<String, List<Integer>> scanPorts(ExecutorService executor,
                                                  List<String> hosts,
                                                  List<Integer> ports,
                                                  int timeoutMs) {
        Map<String, List<Integer>> result = new ConcurrentHashMap<>();
        List<Future<?>> futures = new ArrayList<>();

        for (String host : hosts) {
            for (Integer port : ports) {
                futures.add(executor.submit(() -> {
                    if (isPortOpen(host, port, Math.min(timeoutMs, 2000))) {
                        result.computeIfAbsent(host, k -> new CopyOnWriteArrayList<>()).add(port);
                    }
                }));
            }
        }

        // 等待所有任务完成
        for (Future<?> future : futures) {
            try {
                future.get(timeoutMs + 1000, TimeUnit.MILLISECONDS);
            } catch (Exception e) {
                // 忽略
            }
        }

        return result;
    }

    /**
     * 检测端口是否开放
     */
    private boolean isPortOpen(String host, int port, int timeoutMs) {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), timeoutMs);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * 对开放端口的主机进行 HTTP 探测
     */
    private List<DiscoveredDeviceDTO> probeDevices(ExecutorService executor,
                                                   Map<String, List<Integer>> hostOpenPorts,
                                                   int timeoutMs) {
        List<Future<DiscoveredDeviceDTO>> futures = new ArrayList<>();

        for (Map.Entry<String, List<Integer>> entry : hostOpenPorts.entrySet()) {
            String host = entry.getKey();
            for (Integer port : entry.getValue()) {
                futures.add(executor.submit(() -> probeDevice(host, port)));
            }
        }

        List<DiscoveredDeviceDTO> devices = new ArrayList<>();
        for (Future<DiscoveredDeviceDTO> future : futures) {
            try {
                DiscoveredDeviceDTO device = future.get(timeoutMs + 2000, TimeUnit.MILLISECONDS);
                if (device != null) {
                    devices.add(device);
                }
            } catch (Exception e) {
                // 忽略探测失败的情况
            }
        }

        // 去重：同一 IP 只保留优先级最高的设备（ISAPI > 其他）
        return deduplicateDevices(devices);
    }

    /**
     * 去重：同一 IP 保留最高优先级的设备
     */
    private List<DiscoveredDeviceDTO> deduplicateDevices(List<DiscoveredDeviceDTO> devices) {
        Map<String, DiscoveredDeviceDTO> ipDeviceMap = new HashMap<>();

        for (DiscoveredDeviceDTO device : devices) {
            String ip = device.getIpAddress();
            DiscoveredDeviceDTO existing = ipDeviceMap.get(ip);

            if (existing == null) {
                ipDeviceMap.put(ip, device);
            } else {
                // 优先保留 ISAPI 支持的设备
                if (device.isIsapiSupported() && !existing.isIsapiSupported()) {
                    ipDeviceMap.put(ip, device);
                }
                // 优先保留已识别制造商的设备
                else if (!MANUFACTURER_OTHER.equals(device.getManufacturer()) &&
                        MANUFACTURER_OTHER.equals(existing.getManufacturer())) {
                    ipDeviceMap.put(ip, device);
                }
            }
        }

        return new ArrayList<>(ipDeviceMap.values());
    }

    /**
     * 探测 ISAPI 设备 (海康威视)
     */
    private DiscoveredDeviceDTO probeIsapiDevice(String ip, int port) {
        String url = buildUrl(ip, port, ISAPI_DEVICE_INFO);

        try {
            Request request = new Request.Builder()
                    .url(url)
                    .get()
                    .build();

            // 使用短超时客户端
            OkHttpClient probeClient = httpClient.newBuilder()
                    .connectTimeout(3, TimeUnit.SECONDS)
                    .readTimeout(5, TimeUnit.SECONDS)
                    .build();

            try (Response response = probeClient.newCall(request).execute()) {
                int statusCode = response.code();

                // 401 表示需要认证，但确认是 ISAPI 设备
                if (statusCode == 401) {
                    String authHeader = response.header("WWW-Authenticate");
                    if (authHeader != null && authHeader.toLowerCase().contains("digest")) {
                        return DiscoveredDeviceDTO.builder()
                                .ipAddress(ip)
                                .port(port)
                                .httpStatus(statusCode)
                                .manufacturer(MANUFACTURER_HIKVISION)
                                .deviceType(DEVICE_TYPE_UNKNOWN)
                                .isapiSupported(true)
                                .authRequired(true)
                                .build();
                    }
                }

                // 200 表示无需认证可访问
                if (statusCode == 200) {
                    ResponseBody body = response.body();
                    if (body != null) {
                        String content = body.string();
                        return parseIsapiDeviceInfo(ip, port, statusCode, content);
                    }
                }
            }
        } catch (IOException e) {
            log.trace("ISAPI 探测失败 {}:{} - {}", ip, port, e.getMessage());
        }

        return null;
    }

    /**
     * 解析 ISAPI 设备信息 XML
     */
    private DiscoveredDeviceDTO parseIsapiDeviceInfo(String ip, int port, int httpStatus, String xml) {
        String deviceName = null;
        String deviceType = DEVICE_TYPE_IPC;
        String deviceModel = null;
        String serialNumber = null;
        String firmwareVersion = null;
        String macAddress = null;

        // 解析设备名称
        Matcher m = PATTERN_DEVICE_NAME.matcher(xml);
        if (m.find()) {
            deviceName = m.group(1);
        }

        // 解析设备类型
        m = PATTERN_DEVICE_TYPE.matcher(xml);
        if (m.find()) {
            deviceType = mapDeviceType(m.group(1));
        }

        // 解析型号
        m = PATTERN_MODEL.matcher(xml);
        if (m.find()) {
            deviceModel = m.group(1);
        }

        // 解析序列号
        m = PATTERN_SERIAL_NUMBER.matcher(xml);
        if (m.find()) {
            serialNumber = m.group(1);
        }

        // 解析固件版本
        m = PATTERN_FIRMWARE_VERSION.matcher(xml);
        if (m.find()) {
            firmwareVersion = m.group(1);
        }

        // 解析 MAC 地址
        m = PATTERN_MAC_ADDRESS.matcher(xml);
        if (m.find()) {
            macAddress = m.group(1);
        }

        return DiscoveredDeviceDTO.builder()
                .ipAddress(ip)
                .port(port)
                .httpStatus(httpStatus)
                .deviceName(deviceName)
                .deviceType(deviceType)
                .deviceModel(deviceModel)
                .serialNumber(serialNumber)
                .firmwareVersion(firmwareVersion)
                .macAddress(macAddress)
                .manufacturer(MANUFACTURER_HIKVISION)
                .isapiSupported(true)
                .authRequired(false)
                .build();
    }

    /**
     * 探测大华设备
     */
    private DiscoveredDeviceDTO probeDahuaDevice(String ip, int port) {
        String url = buildUrl(ip, port, DAHUA_RPC);

        try {
            Request request = new Request.Builder()
                    .url(url)
                    .get()
                    .build();

            OkHttpClient probeClient = httpClient.newBuilder()
                    .connectTimeout(3, TimeUnit.SECONDS)
                    .readTimeout(5, TimeUnit.SECONDS)
                    .build();

            try (Response response = probeClient.newCall(request).execute()) {
                int statusCode = response.code();

                ResponseBody body = response.body();
                if (body != null) {
                    String content = body.string();

                    // 大华设备特征检测
                    if (content.contains("Dahua") ||
                            content.contains("session") ||
                            (statusCode == 401 && response.header("WWW-Authenticate") != null)) {

                        return DiscoveredDeviceDTO.builder()
                                .ipAddress(ip)
                                .port(port)
                                .httpStatus(statusCode)
                                .manufacturer(MANUFACTURER_DAHUA)
                                .deviceType(DEVICE_TYPE_UNKNOWN)
                                .isapiSupported(false)
                                .authRequired(statusCode == 401)
                                .build();
                    }
                }
            }
        } catch (IOException e) {
            log.trace("大华探测失败 {}:{} - {}", ip, port, e.getMessage());
        }

        return null;
    }

    /**
     * 通用 HTTP 设备探测
     */
    private DiscoveredDeviceDTO probeGenericHttpDevice(String ip, int port) {
        String url = buildUrl(ip, port, "/");

        try {
            Request request = new Request.Builder()
                    .url(url)
                    .get()
                    .build();

            OkHttpClient probeClient = httpClient.newBuilder()
                    .connectTimeout(3, TimeUnit.SECONDS)
                    .readTimeout(5, TimeUnit.SECONDS)
                    .build();

            try (Response response = probeClient.newCall(request).execute()) {
                int statusCode = response.code();

                ResponseBody body = response.body();
                String content = body != null ? body.string() : "";

                // 检测 Server 头
                String server = response.header("Server");
                String manufacturer = identifyManufacturer(content + " " + (server != null ? server : ""));

                // 检测是否是网络摄像机
                if (isCameraResponse(content, server)) {
                    return DiscoveredDeviceDTO.builder()
                            .ipAddress(ip)
                            .port(port)
                            .httpStatus(statusCode)
                            .manufacturer(manufacturer)
                            .deviceType(DEVICE_TYPE_UNKNOWN)
                            .isapiSupported(false)
                            .authRequired(statusCode == 401 || statusCode == 403)
                            .build();
                }
            }
        } catch (IOException e) {
            log.trace("HTTP 探测失败 {}:{} - {}", ip, port, e.getMessage());
        }

        return null;
    }

    /**
     * 判断是否是摄像机 HTTP 响应
     */
    private boolean isCameraResponse(String content, String server) {
        String combined = (content + " " + (server != null ? server : "")).toLowerCase();

        return combined.contains("camera") ||
                combined.contains("ipc") ||
                combined.contains("nvr") ||
                combined.contains("dvr") ||
                combined.contains("video") ||
                combined.contains("surveillance") ||
                combined.contains("rtsp") ||
                combined.contains("hikvision") ||
                combined.contains("dahua") ||
                combined.contains("uniview") ||
                combined.contains("onvif") ||
                combined.contains("isapi");
    }

    /**
     * 映射设备类型
     */
    private String mapDeviceType(String rawType) {
        if (rawType == null) {
            return DEVICE_TYPE_UNKNOWN;
        }

        String upper = rawType.toUpperCase();
        if (upper.contains("IPC") || upper.contains("IP CAMERA") || upper.contains("NETWORK CAMERA")) {
            return DEVICE_TYPE_IPC;
        } else if (upper.contains("NVR")) {
            return DEVICE_TYPE_NVR;
        } else if (upper.contains("DVR")) {
            return DEVICE_TYPE_DVR;
        } else if (upper.contains("ENCODER") || upper.contains("VIDEO SERVER")) {
            return DEVICE_TYPE_ENCODER;
        }

        return DEVICE_TYPE_UNKNOWN;
    }

    /**
     * 构建 URL
     */
    private String buildUrl(String ip, int port, String path) {
        String protocol = (port == 443) ? "https" : "http";
        return String.format("%s://%s:%d%s", protocol, ip, port, path);
    }

    // ==================== 扩展功能 ====================

    /**
     * 快速扫描单个子网（使用默认参数）
     *
     * @param networkCIDR 网段 CIDR
     * @return 发现的设备列表
     */
    public List<DiscoveredDeviceDTO> quickScan(String networkCIDR) {
        DeviceDiscoveryRequest request = DeviceDiscoveryRequest.builder()
                .networkCIDR(networkCIDR)
                .timeout(5)
                .maxConcurrent(50)
                .build();
        return discoverDevices(request);
    }

    /**
     * 深度扫描（更长超时，更多端口）
     *
     * @param networkCIDR 网段 CIDR
     * @return 发现的设备列表
     */
    public List<DiscoveredDeviceDTO> deepScan(String networkCIDR) {
        DeviceDiscoveryRequest request = DeviceDiscoveryRequest.builder()
                .networkCIDR(networkCIDR)
                .timeout(30)
                .ports(List.of(80, 443, 554, 8080, 8000, 8443, 37777, 8899, 9000))
                .maxConcurrent(30)
                .build();
        return discoverDevices(request);
    }

    /**
     * 检测单个 IP 的所有常用端口
     *
     * @param ip IP 地址
     * @return 发现的设备列表（可能包含多个端口上的服务）
     */
    public List<DiscoveredDeviceDTO> scanSingleHost(String ip) {
        List<Integer> ports = List.of(80, 443, 554, 8080, 8000, 8443, 37777);
        List<DiscoveredDeviceDTO> devices = new ArrayList<>();

        for (Integer port : ports) {
            if (isPortOpen(ip, port, 2000)) {
                DiscoveredDeviceDTO device = probeDevice(ip, port);
                if (device != null) {
                    devices.add(device);
                }
            }
        }

        return deduplicateDevices(devices);
    }

    /**
     * 获取支持的制造商列表
     */
    public List<String> getSupportedManufacturers() {
        return List.of(
                MANUFACTURER_HIKVISION,
                MANUFACTURER_DAHUA,
                MANUFACTURER_UNIVIEW,
                MANUFACTURER_OTHER
        );
    }

    /**
     * 获取默认扫描端口列表
     */
    public List<Integer> getDefaultPorts() {
        return List.of(80, 443, 554, 8080, 37777);
    }
}

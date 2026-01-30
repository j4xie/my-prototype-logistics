package com.cretas.aims.client.dahua;

import com.cretas.aims.dto.dahua.DiscoveredDahuaDevice;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

/**
 * 大华设备发现客户端
 *
 * 实现 DHDiscover 协议，使用 UDP 广播在局域网中发现大华设备
 * 协议端口: 37810
 *
 * 发现流程:
 * 1. 发送 JSON 格式的搜索请求到广播地址 (255.255.255.255:37810) 或组播地址 (239.255.255.251:37810)
 * 2. 设备收到请求后返回包含设备信息的 JSON 响应
 * 3. 解析响应并去重 (按 MAC 地址)
 *
 * @author Cretas Team
 * @since 2026-01-23
 */
@Slf4j
@Component
public class DahuaDiscoveryClient {

    /**
     * DHDiscover 协议端口
     */
    public static final int DISCOVERY_PORT = 37810;

    /**
     * 广播地址
     */
    public static final String BROADCAST_ADDRESS = "255.255.255.255";

    /**
     * 组播地址 (大华官方)
     */
    public static final String MULTICAST_ADDRESS = "239.255.255.251";

    /**
     * 默认超时时间 (毫秒)
     */
    public static final int DEFAULT_TIMEOUT_MS = 5000;

    /**
     * 接收缓冲区大小
     */
    private static final int RECEIVE_BUFFER_SIZE = 4096;

    private final ObjectMapper objectMapper;
    private final ExecutorService executorService;

    public DahuaDiscoveryClient() {
        this.objectMapper = new ObjectMapper();
        this.executorService = Executors.newCachedThreadPool(r -> {
            Thread t = new Thread(r, "dahua-discovery");
            t.setDaemon(true);
            return t;
        });
    }

    /**
     * 发现局域网中的大华设备 (使用广播)
     *
     * @param timeoutMs 超时时间 (毫秒)
     * @return 发现的设备列表
     */
    public List<DiscoveredDahuaDevice> discoverDevices(int timeoutMs) {
        return discoverDevices(BROADCAST_ADDRESS, timeoutMs);
    }

    /**
     * 发现局域网中的大华设备
     *
     * @param targetAddress 目标地址 (广播地址或组播地址)
     * @param timeoutMs     超时时间 (毫秒)
     * @return 发现的设备列表
     */
    public List<DiscoveredDahuaDevice> discoverDevices(String targetAddress, int timeoutMs) {
        Map<String, DiscoveredDahuaDevice> deviceMap = new ConcurrentHashMap<>();
        long startTime = System.currentTimeMillis();
        long endTime = startTime + timeoutMs;

        try (DatagramSocket socket = createSocket()) {
            socket.setSoTimeout(Math.min(timeoutMs, 1000)); // 单次接收超时

            // 发送发现请求
            InetAddress address = InetAddress.getByName(targetAddress);
            sendDiscoveryRequest(socket, address);

            log.info("DHDiscover: 发送设备发现请求到 {}:{}", targetAddress, DISCOVERY_PORT);

            // 持续接收响应直到超时
            byte[] receiveBuffer = new byte[RECEIVE_BUFFER_SIZE];
            while (System.currentTimeMillis() < endTime) {
                try {
                    DatagramPacket receivePacket = new DatagramPacket(receiveBuffer, receiveBuffer.length);
                    socket.receive(receivePacket);

                    String responseJson = new String(
                            receivePacket.getData(),
                            receivePacket.getOffset(),
                            receivePacket.getLength(),
                            StandardCharsets.UTF_8
                    );

                    DiscoveredDahuaDevice device = parseDiscoveryResponse(responseJson);
                    if (device != null && device.getMac() != null) {
                        // 使用 MAC 地址去重
                        String uniqueId = device.getUniqueId();
                        if (!deviceMap.containsKey(uniqueId)) {
                            device.setDiscoveredAt(System.currentTimeMillis());
                            deviceMap.put(uniqueId, device);
                            log.debug("DHDiscover: 发现设备 {} ({}) - {}",
                                    device.getModel(),
                                    device.getIpAddress(),
                                    device.getMac());
                        }
                    }
                } catch (SocketTimeoutException e) {
                    // 超时继续等待
                    continue;
                }
            }
        } catch (IOException e) {
            log.error("DHDiscover: 设备发现失败", e);
        }

        List<DiscoveredDahuaDevice> result = new ArrayList<>(deviceMap.values());
        log.info("DHDiscover: 发现 {} 台设备，耗时 {}ms",
                result.size(), System.currentTimeMillis() - startTime);
        return result;
    }

    /**
     * 在指定子网上发现设备
     *
     * @param subnet    子网地址 (例如: "192.168.1.0" 或 "192.168.1")
     * @param timeoutMs 超时时间 (毫秒)
     * @return 发现的设备列表
     */
    public List<DiscoveredDahuaDevice> discoverDevicesOnSubnet(String subnet, int timeoutMs) {
        // 计算子网广播地址
        String broadcastAddress = calculateBroadcastAddress(subnet);
        log.info("DHDiscover: 在子网 {} 上发现设备 (广播地址: {})", subnet, broadcastAddress);
        return discoverDevices(broadcastAddress, timeoutMs);
    }

    /**
     * 并行在多个网络接口上发现设备
     *
     * @param timeoutMs 超时时间 (毫秒)
     * @return 发现的设备列表 (已去重)
     */
    public List<DiscoveredDahuaDevice> discoverOnAllInterfaces(int timeoutMs) {
        Map<String, DiscoveredDahuaDevice> deviceMap = new ConcurrentHashMap<>();
        List<Future<?>> futures = new ArrayList<>();

        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface networkInterface = interfaces.nextElement();
                if (networkInterface.isLoopback() || !networkInterface.isUp()) {
                    continue;
                }

                for (InterfaceAddress interfaceAddress : networkInterface.getInterfaceAddresses()) {
                    InetAddress broadcast = interfaceAddress.getBroadcast();
                    if (broadcast != null && broadcast instanceof Inet4Address) {
                        String broadcastAddr = broadcast.getHostAddress();
                        futures.add(executorService.submit(() -> {
                            List<DiscoveredDahuaDevice> devices = discoverDevices(broadcastAddr, timeoutMs);
                            for (DiscoveredDahuaDevice device : devices) {
                                if (device.getUniqueId() != null) {
                                    deviceMap.putIfAbsent(device.getUniqueId(), device);
                                }
                            }
                        }));
                    }
                }
            }

            // 等待所有发现任务完成
            for (Future<?> future : futures) {
                try {
                    future.get(timeoutMs + 1000, TimeUnit.MILLISECONDS);
                } catch (TimeoutException | InterruptedException | ExecutionException e) {
                    log.warn("DHDiscover: 部分接口发现超时或失败", e);
                }
            }
        } catch (SocketException e) {
            log.error("DHDiscover: 获取网络接口失败", e);
        }

        return new ArrayList<>(deviceMap.values());
    }

    /**
     * 创建 UDP Socket
     */
    private DatagramSocket createSocket() throws SocketException {
        DatagramSocket socket = new DatagramSocket();
        socket.setBroadcast(true);
        socket.setReuseAddress(true);
        return socket;
    }

    /**
     * 发送设备发现请求
     *
     * @param socket  UDP Socket
     * @param address 目标地址
     */
    private void sendDiscoveryRequest(DatagramSocket socket, InetAddress address) throws IOException {
        String requestJson = buildDiscoveryRequest();
        byte[] requestData = requestJson.getBytes(StandardCharsets.UTF_8);

        DatagramPacket packet = new DatagramPacket(
                requestData,
                requestData.length,
                address,
                DISCOVERY_PORT
        );

        socket.send(packet);
    }

    /**
     * 构建设备发现请求 JSON
     *
     * 请求格式:
     * {
     *   "method": "DHDiscover.search",
     *   "params": {
     *     "mac": "",
     *     "uni": 1
     *   }
     * }
     */
    private String buildDiscoveryRequest() {
        try {
            ObjectNode root = objectMapper.createObjectNode();
            root.put("method", "DHDiscover.search");

            ObjectNode params = objectMapper.createObjectNode();
            params.put("mac", "");
            params.put("uni", 1);
            root.set("params", params);

            return objectMapper.writeValueAsString(root);
        } catch (Exception e) {
            // 使用硬编码的 JSON 作为后备
            return "{\"method\":\"DHDiscover.search\",\"params\":{\"mac\":\"\",\"uni\":1}}";
        }
    }

    /**
     * 解析设备发现响应
     *
     * 响应格式:
     * {
     *   "method": "DHDiscover.device",
     *   "params": {
     *     "DeviceType": "IPC",
     *     "SerialNo": "XXXXXXXXXXXX",
     *     "MAC": "AA:BB:CC:DD:EE:FF",
     *     "IPv4Address": {
     *       "IPAddress": "192.168.1.100",
     *       "SubnetMask": "255.255.255.0",
     *       "DefaultGateway": "192.168.1.1"
     *     },
     *     "Port": 37777,
     *     "HttpPort": 80,
     *     "Activated": true,
     *     "Model": "DH-IPC-xxx",
     *     "Vendor": "Dahua",
     *     "Version": "x.x.x"
     *   }
     * }
     */
    DiscoveredDahuaDevice parseDiscoveryResponse(String json) {
        if (json == null || json.isEmpty()) {
            return null;
        }

        try {
            JsonNode root = objectMapper.readTree(json);

            // 验证响应类型
            String method = getTextValue(root, "method");
            if (!"DHDiscover.device".equals(method)) {
                log.debug("DHDiscover: 忽略非设备响应: {}", method);
                return null;
            }

            JsonNode params = root.get("params");
            if (params == null) {
                return null;
            }

            DiscoveredDahuaDevice device = DiscoveredDahuaDevice.builder()
                    .mac(getTextValue(params, "MAC"))
                    .deviceType(getTextValue(params, "DeviceType"))
                    .serialNumber(getTextValue(params, "SerialNo"))
                    .model(getTextValue(params, "Model"))
                    .vendor(getTextValue(params, "Vendor"))
                    .firmwareVersion(getTextValue(params, "Version"))
                    .port(getIntValue(params, "Port", 37777))
                    .httpPort(getIntValue(params, "HttpPort", 80))
                    .activated(getBooleanValue(params, "Activated", true))
                    .build();

            // 解析 IPv4 地址信息
            JsonNode ipv4 = params.get("IPv4Address");
            if (ipv4 != null) {
                device.setIpAddress(getTextValue(ipv4, "IPAddress"));
                device.setSubnetMask(getTextValue(ipv4, "SubnetMask"));
                device.setGateway(getTextValue(ipv4, "DefaultGateway"));
            }

            // 如果没有 IPv4Address 节点，尝试直接读取
            if (device.getIpAddress() == null) {
                device.setIpAddress(getTextValue(params, "IPAddress"));
            }

            return device;
        } catch (Exception e) {
            log.warn("DHDiscover: 解析响应失败: {}", e.getMessage());
            log.debug("DHDiscover: 原始响应: {}", json);
            return null;
        }
    }

    /**
     * 计算子网广播地址
     *
     * @param subnet 子网地址 (例如: "192.168.1.0" 或 "192.168.1")
     * @return 广播地址
     */
    private String calculateBroadcastAddress(String subnet) {
        String[] parts = subnet.split("\\.");
        if (parts.length == 3) {
            // 格式: 192.168.1 -> 192.168.1.255
            return subnet + ".255";
        } else if (parts.length == 4) {
            // 格式: 192.168.1.0 -> 192.168.1.255
            // 假设 /24 子网
            return parts[0] + "." + parts[1] + "." + parts[2] + ".255";
        }
        // 默认使用全局广播
        return BROADCAST_ADDRESS;
    }

    // ==================== JSON 解析辅助方法 ====================

    private String getTextValue(JsonNode node, String fieldName) {
        JsonNode field = node.get(fieldName);
        return (field != null && !field.isNull()) ? field.asText() : null;
    }

    private int getIntValue(JsonNode node, String fieldName, int defaultValue) {
        JsonNode field = node.get(fieldName);
        return (field != null && !field.isNull()) ? field.asInt(defaultValue) : defaultValue;
    }

    private boolean getBooleanValue(JsonNode node, String fieldName, boolean defaultValue) {
        JsonNode field = node.get(fieldName);
        return (field != null && !field.isNull()) ? field.asBoolean(defaultValue) : defaultValue;
    }

    /**
     * 关闭客户端，释放资源
     */
    public void shutdown() {
        executorService.shutdown();
        try {
            if (!executorService.awaitTermination(5, TimeUnit.SECONDS)) {
                executorService.shutdownNow();
            }
        } catch (InterruptedException e) {
            executorService.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }
}

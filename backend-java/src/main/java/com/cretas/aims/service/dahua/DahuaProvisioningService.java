package com.cretas.aims.service.dahua;

import com.cretas.aims.client.dahua.DahuaDiscoveryClient;
import com.cretas.aims.dto.dahua.DiscoveredDahuaDevice;
import com.cretas.aims.dto.dahua.ProvisioningConfigDTO;
import com.cretas.aims.dto.dahua.ProvisioningResultDTO;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 大华设备配置服务
 *
 * 负责首次配置大华设备的网络参数和管理员密码
 * 使用 DHDiscover 协议通过 UDP 37810 端口进行配置
 *
 * 配置流程:
 * 1. 设备必须在同一局域网 (广播域)
 * 2. 发送配置 JSON 到 UDP 37810 端口
 * 3. 设备返回配置结果
 *
 * @author Cretas Team
 * @since 2026-01-23
 */
@Slf4j
@Service
public class DahuaProvisioningService {

    /**
     * DHDiscover 协议端口 (与发现使用相同端口)
     */
    public static final int PROVISIONING_PORT = 37810;

    /**
     * 广播地址
     */
    public static final String BROADCAST_ADDRESS = "255.255.255.255";

    /**
     * 默认超时时间 (毫秒)
     */
    public static final int DEFAULT_TIMEOUT_MS = 10000;

    /**
     * 接收缓冲区大小
     */
    private static final int RECEIVE_BUFFER_SIZE = 4096;

    /**
     * 重试次数
     */
    private static final int MAX_RETRIES = 3;

    private final ObjectMapper objectMapper;
    private final DahuaDiscoveryClient discoveryClient;
    private final OkHttpClient httpClient;

    @Autowired
    public DahuaProvisioningService(
            DahuaDiscoveryClient discoveryClient,
            @Qualifier("dahuaHttpClient") OkHttpClient httpClient) {
        this.discoveryClient = discoveryClient;
        this.httpClient = httpClient;
        this.objectMapper = new ObjectMapper();
    }

    /**
     * 配置设备网络设置
     *
     * 通过 UDP 广播发送配置命令到设备
     * 设备必须在同一广播域 (局域网) 内
     *
     * @param config 配置参数
     * @return 配置结果
     */
    public ProvisioningResultDTO provisionDevice(ProvisioningConfigDTO config) {
        log.info("开始配置大华设备: MAC={}, 新IP={}", config.getTargetMac(), config.getNewIpAddress());

        // 验证配置参数
        String validationError = validateConfig(config);
        if (validationError != null) {
            return ProvisioningResultDTO.failure(config.getTargetMac(), validationError, "INVALID_CONFIG");
        }

        // 首先通过发现协议确认设备存在
        DiscoveredDahuaDevice device = findDeviceByMac(config.getTargetMac());
        if (device == null) {
            return ProvisioningResultDTO.failure(
                    config.getTargetMac(),
                    "未找到目标设备，请确保设备在同一局域网内",
                    "DEVICE_NOT_FOUND"
            );
        }

        String previousIp = device.getIpAddress();
        log.info("找到目标设备: MAC={}, 当前IP={}, 型号={}",
                device.getMac(), device.getIpAddress(), device.getModel());

        // 检查设备是否需要激活
        if (Boolean.FALSE.equals(device.getActivated()) && !Boolean.TRUE.equals(config.getFirstTimeActivation())) {
            return ProvisioningResultDTO.failure(
                    config.getTargetMac(),
                    "设备未激活，请先进行首次激活",
                    "DEVICE_NOT_ACTIVATED"
            );
        }

        // 发送配置命令
        try {
            String response = sendProvisioningRequest(config);
            return parseProvisioningResponse(response, config, device, previousIp);
        } catch (Exception e) {
            log.error("配置设备失败: MAC={}, 错误={}", config.getTargetMac(), e.getMessage(), e);
            return ProvisioningResultDTO.failure(
                    config.getTargetMac(),
                    "配置失败: " + e.getMessage(),
                    "PROVISIONING_ERROR"
            );
        }
    }

    /**
     * 激活未激活的设备 (首次设置)
     *
     * 新出厂的大华设备需要首次激活才能使用
     * 激活过程会设置管理员密码
     *
     * @param deviceMac     设备 MAC 地址
     * @param adminPassword 管理员密码
     * @return 配置结果
     */
    public ProvisioningResultDTO activateDevice(String deviceMac, String adminPassword) {
        log.info("开始激活大华设备: MAC={}", deviceMac);

        // 查找设备
        DiscoveredDahuaDevice device = findDeviceByMac(deviceMac);
        if (device == null) {
            return ProvisioningResultDTO.failure(
                    deviceMac,
                    "未找到目标设备，请确保设备在同一局域网内",
                    "DEVICE_NOT_FOUND"
            );
        }

        // 检查设备是否已激活
        if (Boolean.TRUE.equals(device.getActivated())) {
            return ProvisioningResultDTO.failure(
                    deviceMac,
                    "设备已激活，无需重复激活",
                    "DEVICE_ALREADY_ACTIVATED"
            );
        }

        // 发送激活请求
        try {
            String requestJson = buildActivationRequest(deviceMac, adminPassword);
            String response = sendUdpRequest(requestJson, BROADCAST_ADDRESS, DEFAULT_TIMEOUT_MS);
            return parseActivationResponse(response, device);
        } catch (Exception e) {
            log.error("激活设备失败: MAC={}, 错误={}", deviceMac, e.getMessage(), e);
            return ProvisioningResultDTO.failure(
                    deviceMac,
                    "激活失败: " + e.getMessage(),
                    "ACTIVATION_ERROR"
            );
        }
    }

    /**
     * 修改设备密码
     *
     * 通过 HTTP API 修改已激活设备的管理员密码
     *
     * @param deviceIp        设备 IP 地址
     * @param currentPassword 当前密码
     * @param newPassword     新密码
     * @return 配置结果
     */
    public ProvisioningResultDTO setDevicePassword(String deviceIp, String currentPassword, String newPassword) {
        log.info("开始修改大华设备密码: IP={}", deviceIp);

        // 验证密码
        if (newPassword == null || newPassword.length() < 8) {
            return ProvisioningResultDTO.failure("密码长度至少8位");
        }

        try {
            // 通过 HTTP API 修改密码
            // 大华设备使用 /cgi-bin/userManager.cgi?action=modifyPassword
            String url = String.format("http://%s/cgi-bin/userManager.cgi", deviceIp);

            // 构建请求参数
            String body = String.format(
                    "action=modifyPassword&name=admin&pwd=%s&newPwd=%s&pwdType=1",
                    urlEncode(currentPassword),
                    urlEncode(newPassword)
            );

            Request request = new Request.Builder()
                    .url(url)
                    .post(RequestBody.create(body, MediaType.parse("application/x-www-form-urlencoded")))
                    .addHeader("Authorization", buildBasicAuth("admin", currentPassword))
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (response.isSuccessful()) {
                    ResponseBody responseBody = response.body();
                    String responseStr = responseBody != null ? responseBody.string() : "";

                    if (responseStr.contains("OK") || responseStr.contains("ok") || response.code() == 200) {
                        log.info("密码修改成功: IP={}", deviceIp);
                        return ProvisioningResultDTO.builder()
                                .success(true)
                                .message("密码修改成功")
                                .newIpAddress(deviceIp)
                                .provisionedAt(LocalDateTime.now())
                                .build();
                    } else {
                        return ProvisioningResultDTO.failure("密码修改失败: " + responseStr);
                    }
                } else {
                    String errorMsg = "HTTP " + response.code();
                    if (response.code() == 401) {
                        errorMsg = "当前密码错误";
                    }
                    return ProvisioningResultDTO.failure(errorMsg);
                }
            }
        } catch (Exception e) {
            log.error("修改密码失败: IP={}, 错误={}", deviceIp, e.getMessage(), e);
            return ProvisioningResultDTO.failure("修改密码失败: " + e.getMessage());
        }
    }

    /**
     * 验证设备连通性
     *
     * @param deviceIp 设备 IP
     * @param password 设备密码
     * @return 是否可连接
     */
    public boolean verifyDeviceConnection(String deviceIp, String password) {
        try {
            String url = String.format("http://%s/cgi-bin/magicBox.cgi?action=getSystemInfo", deviceIp);
            Request request = new Request.Builder()
                    .url(url)
                    .get()
                    .addHeader("Authorization", buildBasicAuth("admin", password))
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                return response.isSuccessful();
            }
        } catch (Exception e) {
            log.debug("设备连接验证失败: IP={}, 错误={}", deviceIp, e.getMessage());
            return false;
        }
    }

    // ==================== 私有方法 ====================

    /**
     * 验证配置参数
     */
    private String validateConfig(ProvisioningConfigDTO config) {
        if (config.getTargetMac() == null || config.getTargetMac().isEmpty()) {
            return "MAC地址不能为空";
        }
        if (!config.getTargetMac().matches("^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$")) {
            return "MAC地址格式错误";
        }
        if (!Boolean.TRUE.equals(config.getDhcpEnabled())) {
            if (config.getNewIpAddress() == null || config.getNewIpAddress().isEmpty()) {
                return "IP地址不能为空";
            }
            if (config.getNewSubnetMask() == null || config.getNewSubnetMask().isEmpty()) {
                return "子网掩码不能为空";
            }
            if (config.getNewGateway() == null || config.getNewGateway().isEmpty()) {
                return "网关不能为空";
            }
        }
        if (config.getAdminPassword() == null || config.getAdminPassword().isEmpty()) {
            return "管理员密码不能为空";
        }
        return null;
    }

    /**
     * 通过 MAC 地址查找设备
     */
    private DiscoveredDahuaDevice findDeviceByMac(String mac) {
        String normalizedMac = mac.toUpperCase();
        List<DiscoveredDahuaDevice> devices = discoveryClient.discoverDevices(DEFAULT_TIMEOUT_MS);

        return devices.stream()
                .filter(d -> normalizedMac.equals(d.getMac() != null ? d.getMac().toUpperCase() : null))
                .findFirst()
                .orElse(null);
    }

    /**
     * 发送配置请求
     */
    private String sendProvisioningRequest(ProvisioningConfigDTO config) throws IOException {
        String requestJson = buildProvisioningRequest(config);
        return sendUdpRequest(requestJson, BROADCAST_ADDRESS, DEFAULT_TIMEOUT_MS);
    }

    /**
     * 构建配置请求 JSON
     *
     * 请求格式:
     * {
     *   "method": "DHDiscover.setConfig",
     *   "params": {
     *     "mac": "AA:BB:CC:DD:EE:FF",
     *     "IPv4Address": {
     *       "IPAddress": "192.168.1.100",
     *       "SubnetMask": "255.255.255.0",
     *       "DefaultGateway": "192.168.1.1"
     *     },
     *     "Password": "admin123"
     *   }
     * }
     */
    private String buildProvisioningRequest(ProvisioningConfigDTO config) {
        try {
            ObjectNode root = objectMapper.createObjectNode();
            root.put("method", "DHDiscover.setConfig");

            ObjectNode params = objectMapper.createObjectNode();
            params.put("mac", config.getTargetMac().toUpperCase());

            // IPv4 地址配置
            if (!Boolean.TRUE.equals(config.getDhcpEnabled())) {
                ObjectNode ipv4 = objectMapper.createObjectNode();
                ipv4.put("IPAddress", config.getNewIpAddress());
                ipv4.put("SubnetMask", config.getNewSubnetMask());
                ipv4.put("DefaultGateway", config.getNewGateway());
                params.set("IPv4Address", ipv4);
            }

            // 密码
            params.put("Password", config.getAdminPassword());

            // 设备名称 (可选)
            if (config.getDeviceName() != null && !config.getDeviceName().isEmpty()) {
                params.put("DeviceName", config.getDeviceName());
            }

            // DHCP 设置
            if (Boolean.TRUE.equals(config.getDhcpEnabled())) {
                params.put("DhcpEnabled", true);
            }

            root.set("params", params);
            return objectMapper.writeValueAsString(root);
        } catch (Exception e) {
            log.error("构建配置请求JSON失败", e);
            throw new RuntimeException("构建配置请求失败", e);
        }
    }

    /**
     * 构建激活请求 JSON
     */
    private String buildActivationRequest(String mac, String password) {
        try {
            ObjectNode root = objectMapper.createObjectNode();
            root.put("method", "DHDiscover.activate");

            ObjectNode params = objectMapper.createObjectNode();
            params.put("mac", mac.toUpperCase());
            params.put("Password", password);

            root.set("params", params);
            return objectMapper.writeValueAsString(root);
        } catch (Exception e) {
            log.error("构建激活请求JSON失败", e);
            throw new RuntimeException("构建激活请求失败", e);
        }
    }

    /**
     * 发送 UDP 请求
     */
    private String sendUdpRequest(String requestJson, String targetAddress, int timeoutMs) throws IOException {
        byte[] requestData = requestJson.getBytes(StandardCharsets.UTF_8);
        byte[] receiveBuffer = new byte[RECEIVE_BUFFER_SIZE];

        log.debug("发送UDP配置请求: target={}, data={}", targetAddress, requestJson);

        for (int retry = 0; retry < MAX_RETRIES; retry++) {
            try (DatagramSocket socket = new DatagramSocket()) {
                socket.setBroadcast(true);
                socket.setSoTimeout(timeoutMs);

                InetAddress address = InetAddress.getByName(targetAddress);
                DatagramPacket sendPacket = new DatagramPacket(
                        requestData, requestData.length, address, PROVISIONING_PORT);
                socket.send(sendPacket);

                // 等待响应
                DatagramPacket receivePacket = new DatagramPacket(receiveBuffer, receiveBuffer.length);
                socket.receive(receivePacket);

                String response = new String(
                        receivePacket.getData(),
                        receivePacket.getOffset(),
                        receivePacket.getLength(),
                        StandardCharsets.UTF_8);

                log.debug("收到UDP响应: {}", response);
                return response;

            } catch (SocketTimeoutException e) {
                log.warn("UDP请求超时 (重试 {}/{})", retry + 1, MAX_RETRIES);
                if (retry == MAX_RETRIES - 1) {
                    throw new IOException("配置请求超时，设备可能不在同一局域网内");
                }
            }
        }

        throw new IOException("配置请求失败");
    }

    /**
     * 解析配置响应
     */
    private ProvisioningResultDTO parseProvisioningResponse(
            String response, ProvisioningConfigDTO config,
            DiscoveredDahuaDevice device, String previousIp) {
        try {
            JsonNode root = objectMapper.readTree(response);
            String method = root.has("method") ? root.get("method").asText() : "";

            // 检查是否为配置响应
            if (method.contains("setConfig") || method.contains("result")) {
                JsonNode params = root.get("params");
                if (params != null) {
                    boolean success = params.has("result") && params.get("result").asBoolean();

                    if (success || !params.has("result")) {
                        // 配置成功
                        return ProvisioningResultDTO.builder()
                                .success(true)
                                .message("设备配置成功")
                                .deviceMac(config.getTargetMac())
                                .newIpAddress(config.getNewIpAddress())
                                .previousIpAddress(previousIp)
                                .httpPort(device.getHttpPort())
                                .tcpPort(device.getPort())
                                .model(device.getModel())
                                .serialNumber(device.getSerialNumber())
                                .activated(true)
                                .provisionedAt(LocalDateTime.now())
                                .build();
                    } else {
                        String error = params.has("error") ? params.get("error").asText() : "未知错误";
                        return ProvisioningResultDTO.failure(config.getTargetMac(), error, "CONFIG_FAILED");
                    }
                }
            }

            // 无法解析响应，假设成功 (某些设备不返回明确结果)
            log.warn("无法解析配置响应，假设成功: {}", response);
            return ProvisioningResultDTO.builder()
                    .success(true)
                    .message("配置命令已发送 (等待设备重启)")
                    .deviceMac(config.getTargetMac())
                    .newIpAddress(config.getNewIpAddress())
                    .previousIpAddress(previousIp)
                    .httpPort(device.getHttpPort())
                    .tcpPort(device.getPort())
                    .provisionedAt(LocalDateTime.now())
                    .build();

        } catch (Exception e) {
            log.error("解析配置响应失败: {}", e.getMessage());
            // 解析失败但命令已发送，返回部分成功
            return ProvisioningResultDTO.builder()
                    .success(true)
                    .message("配置命令已发送，请验证设备新IP")
                    .deviceMac(config.getTargetMac())
                    .newIpAddress(config.getNewIpAddress())
                    .previousIpAddress(previousIp)
                    .provisionedAt(LocalDateTime.now())
                    .build();
        }
    }

    /**
     * 解析激活响应
     */
    private ProvisioningResultDTO parseActivationResponse(String response, DiscoveredDahuaDevice device) {
        try {
            JsonNode root = objectMapper.readTree(response);
            JsonNode params = root.get("params");

            if (params != null) {
                boolean success = params.has("result") && params.get("result").asBoolean();

                if (success) {
                    return ProvisioningResultDTO.builder()
                            .success(true)
                            .message("设备激活成功")
                            .deviceMac(device.getMac())
                            .newIpAddress(device.getIpAddress())
                            .httpPort(device.getHttpPort())
                            .tcpPort(device.getPort())
                            .model(device.getModel())
                            .serialNumber(device.getSerialNumber())
                            .activated(true)
                            .provisionedAt(LocalDateTime.now())
                            .build();
                } else {
                    String error = params.has("error") ? params.get("error").asText() : "激活失败";
                    return ProvisioningResultDTO.failure(device.getMac(), error, "ACTIVATION_FAILED");
                }
            }

            return ProvisioningResultDTO.failure(device.getMac(), "激活响应格式错误", "INVALID_RESPONSE");
        } catch (Exception e) {
            log.error("解析激活响应失败: {}", e.getMessage());
            return ProvisioningResultDTO.failure(device.getMac(), "解析响应失败: " + e.getMessage(), "PARSE_ERROR");
        }
    }

    /**
     * URL 编码
     */
    private String urlEncode(String value) {
        try {
            return java.net.URLEncoder.encode(value, StandardCharsets.UTF_8.name());
        } catch (Exception e) {
            return value;
        }
    }

    /**
     * 构建 Basic Auth 头
     */
    private String buildBasicAuth(String username, String password) {
        String credentials = username + ":" + password;
        return "Basic " + java.util.Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
    }
}

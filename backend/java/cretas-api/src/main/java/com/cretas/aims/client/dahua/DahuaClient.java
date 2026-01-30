package com.cretas.aims.client.dahua;

import com.cretas.aims.config.DahuaConfig;
import com.cretas.aims.dto.isapi.SmartAnalysisDTO;
import com.cretas.aims.dto.isapi.SmartAnalysisDTO.SmartCapabilities;
import com.cretas.aims.entity.dahua.DahuaDevice;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 大华设备 HTTP 客户端
 * 封装与大华设备的 HTTP 通信 (基于 CGI 协议)
 *
 * 大华设备响应格式特点:
 * - 部分接口返回 key=value 格式
 * - 部分接口返回 JSON 格式
 * - 解析时需要根据接口类型处理
 *
 * @author Cretas Team
 * @since 2026-01-23
 */
@Slf4j
@Component
public class DahuaClient {

    private final OkHttpClient baseHttpClient;
    private final OkHttpClient baseStreamClient;
    private final DahuaConfig config;
    private final ObjectMapper objectMapper;

    // 缓存每个设备的认证客户端
    private final Map<String, OkHttpClient> deviceClients = new ConcurrentHashMap<>();
    private final Map<String, OkHttpClient> deviceStreamClients = new ConcurrentHashMap<>();

    // 大华 CGI 响应键值对解析正则
    private static final Pattern KEY_VALUE_PATTERN = Pattern.compile("([\\w.\\[\\]]+)=(.*)");

    @Autowired
    public DahuaClient(
            @Qualifier("dahuaHttpClient") OkHttpClient baseHttpClient,
            @Qualifier("dahuaStreamClient") OkHttpClient baseStreamClient,
            DahuaConfig config) {
        this.baseHttpClient = baseHttpClient;
        this.baseStreamClient = baseStreamClient;
        this.config = config;
        this.objectMapper = new ObjectMapper();
    }

    // ==================== 设备信息 ====================

    /**
     * 获取设备信息
     * GET /cgi-bin/magicBox.cgi?action=getSystemInfo
     *
     * @param device 设备
     * @return 设备信息 Map
     */
    public Map<String, Object> getDeviceInfo(DahuaDevice device) throws IOException {
        String url = device.getBaseUrl() + DahuaConfig.Endpoints.DEVICE_INFO;
        String response = executeGet(device, url);
        return parseKeyValueResponse(response);
    }

    /**
     * 获取设备能力集
     * GET /cgi-bin/devAbility.cgi?action=getAll
     *
     * @param device 设备
     * @return 设备能力 Map
     */
    public Map<String, Object> getCapabilities(DahuaDevice device) throws IOException {
        String url = device.getBaseUrl() + DahuaConfig.Endpoints.CAPABILITIES;
        String response = executeGet(device, url);
        // 大华能力集可能是 JSON 格式
        return parseResponse(response);
    }

    /**
     * 测试设备连通性
     *
     * @param device 设备
     * @return 是否连接成功
     */
    public boolean testConnection(DahuaDevice device) {
        try {
            Map<String, Object> info = getDeviceInfo(device);
            return info != null && !info.containsKey("error");
        } catch (Exception e) {
            log.warn("大华设备连接测试失败: {} - {}", device.getIpAddress(), e.getMessage());
            return false;
        }
    }

    // ==================== 流媒体 ====================

    /**
     * 获取流媒体通道列表
     *
     * @param device 设备
     * @return 通道列表
     */
    public List<Map<String, Object>> getStreamingChannels(DahuaDevice device) throws IOException {
        String url = device.getBaseUrl() + DahuaConfig.Endpoints.CHANNELS;
        String response = executeGet(device, url);
        return parseChannelResponse(response);
    }

    /**
     * 抓拍图片
     *
     * @param device    设备
     * @param channelId 通道ID (从0开始)
     * @return 图片二进制数据
     */
    public byte[] capturePicture(DahuaDevice device, int channelId) throws IOException {
        String url = device.getBaseUrl() +
                String.format(DahuaConfig.Endpoints.SNAPSHOT, channelId);

        OkHttpClient client = getClientForDevice(device);
        Request request = new Request.Builder()
                .url(url)
                .get()
                .build();

        try (Response response = client.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                throw new IOException("抓拍失败: HTTP " + response.code());
            }

            ResponseBody body = response.body();
            if (body == null) {
                throw new IOException("抓拍返回空数据");
            }

            return body.bytes();
        }
    }

    // ==================== 告警订阅 ====================

    /**
     * 订阅告警事件流 (长连接)
     * GET /cgi-bin/eventManager.cgi?action=attach&codes=[All]
     *
     * @param device        设备
     * @param eventConsumer 事件回调
     * @return Call 对象，可用于取消订阅
     */
    public Call subscribeAlertStream(DahuaDevice device, Consumer<Map<String, Object>> eventConsumer) {
        String url = device.getBaseUrl() + DahuaConfig.Endpoints.ALERT_STREAM;
        OkHttpClient client = getStreamClientForDevice(device);

        Request request = new Request.Builder()
                .url(url)
                .get()
                .build();

        Call call = client.newCall(request);

        // 异步处理
        call.enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                log.error("大华告警订阅失败: {} - {}", device.getIpAddress(), e.getMessage());
                // 通知消费者发生错误
                Map<String, Object> errorEvent = new HashMap<>();
                errorEvent.put("error", true);
                errorEvent.put("message", e.getMessage());
                errorEvent.put("deviceId", device.getId());
                eventConsumer.accept(errorEvent);
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                if (!response.isSuccessful()) {
                    log.error("大华告警订阅返回错误: {} - HTTP {}", device.getIpAddress(), response.code());
                    return;
                }

                // 获取 boundary
                String contentType = response.header("Content-Type");
                String boundary = extractBoundary(contentType);

                log.info("已连接到大华告警流: {}", device.getIpAddress());

                // 持续读取流数据
                try (ResponseBody body = response.body()) {
                    if (body == null) return;

                    InputStream is = body.byteStream();
                    byte[] buffer = new byte[8192];
                    StringBuilder builder = new StringBuilder();

                    int bytesRead;
                    while ((bytesRead = is.read(buffer)) != -1) {
                        String chunk = new String(buffer, 0, bytesRead, StandardCharsets.UTF_8);
                        builder.append(chunk);

                        // 大华事件格式: Code=xxx;action=xxx;index=xxx
                        String content = builder.toString();
                        if (content.contains("Code=") && content.contains("\n")) {
                            List<Map<String, Object>> events = parseDahuaEvents(content);
                            for (Map<String, Object> event : events) {
                                event.put("deviceId", device.getId());
                                event.put("factoryId", device.getFactoryId());
                                eventConsumer.accept(event);
                            }

                            // 清除已处理的事件
                            int lastNewline = content.lastIndexOf("\n");
                            if (lastNewline > 0) {
                                builder = new StringBuilder(content.substring(lastNewline + 1));
                            }
                        }
                    }
                } catch (IOException e) {
                    if (!call.isCanceled()) {
                        log.error("读取大华告警流异常: {}", e.getMessage());
                    }
                }
            }
        });

        return call;
    }

    // ==================== 智能分析 ====================

    /**
     * 获取智能分析能力
     *
     * @param device 设备
     * @return 智能分析能力
     */
    public SmartCapabilities getSmartCapabilities(DahuaDevice device) throws IOException {
        try {
            String url = device.getBaseUrl() + DahuaConfig.Endpoints.SMART_CAPS;
            String response = executeGet(device, url);
            Map<String, Object> caps = parseResponse(response);

            return SmartCapabilities.builder()
                    .smartSupported(true)
                    .lineDetectionSupported(caps.containsKey("CrossLine") || caps.containsKey("crossLine"))
                    .fieldDetectionSupported(caps.containsKey("CrossRegion") || caps.containsKey("crossRegion"))
                    .faceDetectionSupported(caps.containsKey("FaceDetection") || caps.containsKey("faceDetection"))
                    .motionDetectionSupported(true) // 大多数大华设备支持
                    .audioDetectionSupported(device.getSupportsAudio())
                    .build();
        } catch (IOException e) {
            log.debug("获取大华智能分析能力失败 (设备可能不支持): {} - {}", device.getIpAddress(), e.getMessage());
            return SmartCapabilities.builder()
                    .smartSupported(false)
                    .lineDetectionSupported(false)
                    .fieldDetectionSupported(false)
                    .faceDetectionSupported(false)
                    .build();
        }
    }

    /**
     * 获取越界检测配置
     *
     * @param device    设备
     * @param channelId 通道ID
     * @return 越界检测配置
     */
    public SmartAnalysisDTO getLineDetection(DahuaDevice device, int channelId) throws IOException {
        String url = device.getBaseUrl() + String.format(DahuaConfig.Endpoints.LINE_DETECTION, channelId);
        String response = executeGet(device, url);
        return parseLineDetectionConfig(response, channelId);
    }

    /**
     * 设置越界检测配置
     *
     * @param device    设备
     * @param channelId 通道ID
     * @param config    配置
     */
    public void setLineDetection(DahuaDevice device, int channelId, SmartAnalysisDTO config) throws IOException {
        String url = device.getBaseUrl() + String.format(DahuaConfig.Endpoints.LINE_DETECTION_SET, channelId);
        String body = buildLineDetectionBody(config);
        executePost(device, url, body);
    }

    /**
     * 获取区域入侵检测配置
     *
     * @param device    设备
     * @param channelId 通道ID
     * @return 区域入侵检测配置
     */
    public SmartAnalysisDTO getFieldDetection(DahuaDevice device, int channelId) throws IOException {
        String url = device.getBaseUrl() + String.format(DahuaConfig.Endpoints.INTRUSION_DETECTION, channelId);
        String response = executeGet(device, url);
        return parseFieldDetectionConfig(response, channelId);
    }

    /**
     * 设置区域入侵检测配置
     *
     * @param device    设备
     * @param channelId 通道ID
     * @param config    配置
     */
    public void setFieldDetection(DahuaDevice device, int channelId, SmartAnalysisDTO config) throws IOException {
        String url = device.getBaseUrl() + String.format(DahuaConfig.Endpoints.INTRUSION_DETECTION_SET, channelId);
        String body = buildFieldDetectionBody(config);
        executePost(device, url, body);
    }

    /**
     * 获取人脸检测配置
     *
     * @param device    设备
     * @param channelId 通道ID
     * @return 人脸检测配置
     */
    public SmartAnalysisDTO getFaceDetection(DahuaDevice device, int channelId) throws IOException {
        String url = device.getBaseUrl() + String.format(DahuaConfig.Endpoints.FACE_DETECTION, channelId);
        String response = executeGet(device, url);
        return parseFaceDetectionConfig(response, channelId);
    }

    /**
     * 设置人脸检测配置
     *
     * @param device    设备
     * @param channelId 通道ID
     * @param config    配置
     */
    public void setFaceDetection(DahuaDevice device, int channelId, SmartAnalysisDTO config) throws IOException {
        String url = device.getBaseUrl() + String.format(DahuaConfig.Endpoints.FACE_DETECTION_SET, channelId);
        String body = buildFaceDetectionBody(config);
        executePost(device, url, body);
    }

    // ==================== HTTP 执行方法 ====================

    /**
     * 执行 GET 请求
     *
     * @param device 设备
     * @param url    请求 URL
     * @return 响应字符串
     */
    public String executeGet(DahuaDevice device, String url) throws IOException {
        OkHttpClient client = getClientForDevice(device);
        Request request = new Request.Builder()
                .url(url)
                .get()
                .build();

        try (Response response = client.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                throw new IOException("请求失败: HTTP " + response.code() + " - " + url);
            }

            ResponseBody body = response.body();
            if (body == null) {
                throw new IOException("响应体为空");
            }

            return body.string();
        }
    }

    /**
     * 执行 POST 请求
     *
     * @param device 设备
     * @param url    请求 URL
     * @param body   请求体
     * @return 响应字符串
     */
    public String executePost(DahuaDevice device, String url, String body) throws IOException {
        OkHttpClient client = getClientForDevice(device);

        RequestBody requestBody = RequestBody.create(
                body,
                MediaType.parse("application/x-www-form-urlencoded; charset=utf-8")
        );

        Request request = new Request.Builder()
                .url(url)
                .post(requestBody)
                .build();

        try (Response response = client.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                throw new IOException("请求失败: HTTP " + response.code() + " - " + url);
            }

            ResponseBody responseBody = response.body();
            if (responseBody == null) {
                return "";
            }

            return responseBody.string();
        }
    }

    /**
     * 执行 PUT 请求
     *
     * @param device 设备
     * @param url    请求 URL
     * @param body   请求体
     * @return 响应字符串
     */
    public String executePut(DahuaDevice device, String url, String body) throws IOException {
        OkHttpClient client = getClientForDevice(device);

        RequestBody requestBody = RequestBody.create(
                body,
                MediaType.parse("application/x-www-form-urlencoded; charset=utf-8")
        );

        Request request = new Request.Builder()
                .url(url)
                .put(requestBody)
                .build();

        try (Response response = client.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                throw new IOException("请求失败: HTTP " + response.code() + " - " + url);
            }

            ResponseBody responseBody = response.body();
            if (responseBody == null) {
                return "";
            }

            return responseBody.string();
        }
    }

    // ==================== 客户端管理 ====================

    /**
     * 获取设备专用的 HTTP 客户端 (带 Digest 认证)
     *
     * @param device 设备
     * @return HTTP 客户端
     */
    public OkHttpClient getClientForDevice(DahuaDevice device) {
        return deviceClients.computeIfAbsent(device.getId(), id -> {
            String password = decryptPassword(device.getPasswordEncrypted());
            DahuaDigestAuthenticator authenticator =
                    new DahuaDigestAuthenticator(device.getUsername(), password);

            return baseHttpClient.newBuilder()
                    .addInterceptor(authenticator)
                    .build();
        });
    }

    /**
     * 获取设备专用的流式 HTTP 客户端 (带 Digest 认证)
     *
     * @param device 设备
     * @return 流式 HTTP 客户端
     */
    private OkHttpClient getStreamClientForDevice(DahuaDevice device) {
        return deviceStreamClients.computeIfAbsent(device.getId(), id -> {
            String password = decryptPassword(device.getPasswordEncrypted());
            DahuaDigestAuthenticator authenticator =
                    new DahuaDigestAuthenticator(device.getUsername(), password);

            return baseStreamClient.newBuilder()
                    .addInterceptor(authenticator)
                    .build();
        });
    }

    /**
     * 移除设备的缓存客户端
     *
     * @param deviceId 设备ID
     */
    public void removeDeviceClient(String deviceId) {
        deviceClients.remove(deviceId);
        deviceStreamClients.remove(deviceId);
    }

    // ==================== 密码加解密 ====================

    /**
     * 加密密码
     *
     * @param plainPassword 明文密码
     * @return 加密后的密码
     */
    public String encryptPassword(String plainPassword) {
        try {
            SecretKeySpec key = new SecretKeySpec(
                    padKey(config.getPasswordEncryptionKey()).getBytes(StandardCharsets.UTF_8),
                    "AES");
            Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
            cipher.init(Cipher.ENCRYPT_MODE, key);
            byte[] encrypted = cipher.doFinal(plainPassword.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(encrypted);
        } catch (Exception e) {
            log.error("密码加密失败", e);
            throw new RuntimeException("密码加密失败", e);
        }
    }

    /**
     * 解密密码
     *
     * @param encryptedPassword 加密后的密码
     * @return 明文密码
     */
    public String decryptPassword(String encryptedPassword) {
        try {
            SecretKeySpec key = new SecretKeySpec(
                    padKey(config.getPasswordEncryptionKey()).getBytes(StandardCharsets.UTF_8),
                    "AES");
            Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
            cipher.init(Cipher.DECRYPT_MODE, key);
            byte[] decrypted = cipher.doFinal(Base64.getDecoder().decode(encryptedPassword));
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.error("密码解密失败", e);
            throw new RuntimeException("密码解密失败", e);
        }
    }

    /**
     * 确保密钥长度为 16 字节
     */
    private String padKey(String key) {
        if (key.length() >= 16) {
            return key.substring(0, 16);
        }
        return String.format("%-16s", key).replace(' ', '0');
    }

    // ==================== 响应解析方法 ====================

    /**
     * 解析大华 key=value 格式响应
     *
     * @param response 响应字符串
     * @return 解析后的 Map
     */
    private Map<String, Object> parseKeyValueResponse(String response) {
        Map<String, Object> result = new LinkedHashMap<>();

        if (response == null || response.isEmpty()) {
            return result;
        }

        String[] lines = response.split("\n");
        for (String line : lines) {
            line = line.trim();
            if (line.isEmpty()) continue;

            Matcher matcher = KEY_VALUE_PATTERN.matcher(line);
            if (matcher.matches()) {
                String key = matcher.group(1);
                String value = matcher.group(2).trim();
                result.put(key, parseValue(value));
            }
        }

        return result;
    }

    /**
     * 智能解析响应 (key=value 或 JSON)
     *
     * @param response 响应字符串
     * @return 解析后的 Map
     */
    private Map<String, Object> parseResponse(String response) {
        if (response == null || response.isEmpty()) {
            return Collections.emptyMap();
        }

        String trimmed = response.trim();

        // 尝试解析为 JSON
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            try {
                return objectMapper.readValue(trimmed, new TypeReference<Map<String, Object>>() {});
            } catch (Exception e) {
                log.debug("JSON解析失败，尝试key=value格式: {}", e.getMessage());
            }
        }

        // 解析为 key=value 格式
        return parseKeyValueResponse(response);
    }

    /**
     * 解析值 (尝试转换为适当的类型)
     */
    private Object parseValue(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }

        // 布尔值
        if ("true".equalsIgnoreCase(value)) return true;
        if ("false".equalsIgnoreCase(value)) return false;

        // 整数
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException ignored) {}

        // 浮点数
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException ignored) {}

        return value;
    }

    /**
     * 解析通道配置响应
     */
    private List<Map<String, Object>> parseChannelResponse(String response) {
        List<Map<String, Object>> channels = new ArrayList<>();
        Map<String, Object> parsed = parseKeyValueResponse(response);

        // 大华通道格式: table.ChannelTitle[0].Name=xxx
        Map<Integer, Map<String, Object>> channelMap = new HashMap<>();

        for (Map.Entry<String, Object> entry : parsed.entrySet()) {
            String key = entry.getKey();
            if (key.contains("ChannelTitle[")) {
                // 提取通道索引
                Pattern pattern = Pattern.compile("ChannelTitle\\[(\\d+)\\]\\.(.+)");
                Matcher matcher = pattern.matcher(key);
                if (matcher.find()) {
                    int index = Integer.parseInt(matcher.group(1));
                    String property = matcher.group(2);

                    channelMap.computeIfAbsent(index, k -> new HashMap<>())
                            .put(property, entry.getValue());
                }
            }
        }

        for (Map.Entry<Integer, Map<String, Object>> entry : channelMap.entrySet()) {
            Map<String, Object> channel = entry.getValue();
            channel.put("channelId", entry.getKey());
            channels.add(channel);
        }

        return channels;
    }

    /**
     * 解析大华事件流
     */
    private List<Map<String, Object>> parseDahuaEvents(String content) {
        List<Map<String, Object>> events = new ArrayList<>();

        // 大华事件格式: Code=xxx;action=xxx;index=xxx
        String[] lines = content.split("\n");
        for (String line : lines) {
            line = line.trim();
            if (line.isEmpty() || !line.contains("Code=")) continue;

            Map<String, Object> event = new HashMap<>();
            String[] parts = line.split(";");
            for (String part : parts) {
                String[] kv = part.split("=", 2);
                if (kv.length == 2) {
                    event.put(kv[0].trim(), kv[1].trim());
                }
            }

            if (!event.isEmpty()) {
                event.put("timestamp", System.currentTimeMillis());
                events.add(event);
            }
        }

        return events;
    }

    /**
     * 从 Content-Type 提取 boundary
     */
    private String extractBoundary(String contentType) {
        if (contentType == null) {
            return null;
        }
        for (String part : contentType.split(";")) {
            String trimmed = part.trim();
            if (trimmed.startsWith("boundary=")) {
                return trimmed.substring(9).replace("\"", "");
            }
        }
        return null;
    }

    // ==================== 智能分析配置解析/构建 ====================

    /**
     * 解析越界检测配置
     */
    private SmartAnalysisDTO parseLineDetectionConfig(String response, int channelId) {
        Map<String, Object> parsed = parseKeyValueResponse(response);

        return SmartAnalysisDTO.builder()
                .channelId(channelId)
                .detectionType(SmartAnalysisDTO.DetectionType.LINE_DETECTION)
                .enabled(Boolean.TRUE.equals(parsed.get("Enable")) ||
                        Boolean.TRUE.equals(parsed.get("enable")))
                .rules(parseDetectionRules(parsed, "CrossLine"))
                .build();
    }

    /**
     * 解析区域入侵检测配置
     */
    private SmartAnalysisDTO parseFieldDetectionConfig(String response, int channelId) {
        Map<String, Object> parsed = parseKeyValueResponse(response);

        return SmartAnalysisDTO.builder()
                .channelId(channelId)
                .detectionType(SmartAnalysisDTO.DetectionType.FIELD_DETECTION)
                .enabled(Boolean.TRUE.equals(parsed.get("Enable")) ||
                        Boolean.TRUE.equals(parsed.get("enable")))
                .rules(parseDetectionRules(parsed, "CrossRegion"))
                .build();
    }

    /**
     * 解析人脸检测配置
     */
    private SmartAnalysisDTO parseFaceDetectionConfig(String response, int channelId) {
        Map<String, Object> parsed = parseKeyValueResponse(response);

        return SmartAnalysisDTO.builder()
                .channelId(channelId)
                .detectionType(SmartAnalysisDTO.DetectionType.FACE_DETECTION)
                .enabled(Boolean.TRUE.equals(parsed.get("Enable")) ||
                        Boolean.TRUE.equals(parsed.get("enable")))
                .build();
    }

    /**
     * 解析检测规则
     */
    private List<SmartAnalysisDTO.DetectionRule> parseDetectionRules(Map<String, Object> parsed, String prefix) {
        List<SmartAnalysisDTO.DetectionRule> rules = new ArrayList<>();

        // 查找规则相关的键
        Map<Integer, Map<String, Object>> ruleMap = new HashMap<>();
        Pattern pattern = Pattern.compile(prefix + "\\[(\\d+)\\]\\.(.+)");

        for (Map.Entry<String, Object> entry : parsed.entrySet()) {
            Matcher matcher = pattern.matcher(entry.getKey());
            if (matcher.find()) {
                int index = Integer.parseInt(matcher.group(1));
                String property = matcher.group(2);
                ruleMap.computeIfAbsent(index, k -> new HashMap<>())
                        .put(property, entry.getValue());
            }
        }

        for (Map.Entry<Integer, Map<String, Object>> entry : ruleMap.entrySet()) {
            Map<String, Object> ruleData = entry.getValue();
            SmartAnalysisDTO.DetectionRule rule = SmartAnalysisDTO.DetectionRule.builder()
                    .id(entry.getKey() + 1)
                    .name(String.valueOf(ruleData.getOrDefault("Name", "Rule" + (entry.getKey() + 1))))
                    .enabled(Boolean.TRUE.equals(ruleData.get("Enable")))
                    .sensitivityLevel(parseIntValue(ruleData.get("Sensitivity"), 50))
                    .build();
            rules.add(rule);
        }

        return rules;
    }

    /**
     * 构建越界检测配置请求体
     */
    private String buildLineDetectionBody(SmartAnalysisDTO config) {
        StringBuilder sb = new StringBuilder();
        sb.append("Enable=").append(config.getEnabled() ? "true" : "false");

        if (config.getRules() != null) {
            for (int i = 0; i < config.getRules().size(); i++) {
                SmartAnalysisDTO.DetectionRule rule = config.getRules().get(i);
                String prefix = "&CrossLine[" + i + "].";
                sb.append(prefix).append("Enable=").append(rule.getEnabled() ? "true" : "false");
                if (rule.getSensitivityLevel() != null) {
                    sb.append(prefix).append("Sensitivity=").append(rule.getSensitivityLevel());
                }
                if (rule.getName() != null) {
                    sb.append(prefix).append("Name=").append(rule.getName());
                }
            }
        }

        return sb.toString();
    }

    /**
     * 构建区域入侵检测配置请求体
     */
    private String buildFieldDetectionBody(SmartAnalysisDTO config) {
        StringBuilder sb = new StringBuilder();
        sb.append("Enable=").append(config.getEnabled() ? "true" : "false");

        if (config.getRules() != null) {
            for (int i = 0; i < config.getRules().size(); i++) {
                SmartAnalysisDTO.DetectionRule rule = config.getRules().get(i);
                String prefix = "&CrossRegion[" + i + "].";
                sb.append(prefix).append("Enable=").append(rule.getEnabled() ? "true" : "false");
                if (rule.getSensitivityLevel() != null) {
                    sb.append(prefix).append("Sensitivity=").append(rule.getSensitivityLevel());
                }
                if (rule.getName() != null) {
                    sb.append(prefix).append("Name=").append(rule.getName());
                }
            }
        }

        return sb.toString();
    }

    /**
     * 构建人脸检测配置请求体
     */
    private String buildFaceDetectionBody(SmartAnalysisDTO config) {
        StringBuilder sb = new StringBuilder();
        sb.append("Enable=").append(config.getEnabled() ? "true" : "false");
        return sb.toString();
    }

    /**
     * 安全解析整数值
     */
    private int parseIntValue(Object value, int defaultValue) {
        if (value == null) return defaultValue;
        if (value instanceof Number) return ((Number) value).intValue();
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }
}

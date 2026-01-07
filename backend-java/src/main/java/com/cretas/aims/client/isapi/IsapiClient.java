package com.cretas.aims.client.isapi;

import com.cretas.aims.config.IsapiConfig;
import com.cretas.aims.dto.isapi.SmartAnalysisDTO;
import com.cretas.aims.dto.isapi.SmartAnalysisDTO.SmartCapabilities;
import com.cretas.aims.entity.isapi.IsapiDevice;
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
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

/**
 * ISAPI HTTP 客户端
 * 封装与海康威视设备的 HTTP 通信
 *
 * @author Cretas Team
 * @since 2026-01-05
 */
@Slf4j
@Component
public class IsapiClient {

    private final OkHttpClient baseHttpClient;
    private final OkHttpClient baseStreamClient;
    private final IsapiConfig config;
    private final IsapiXmlParser xmlParser;

    // 缓存每个设备的认证客户端
    private final Map<String, OkHttpClient> deviceClients = new ConcurrentHashMap<>();
    private final Map<String, OkHttpClient> deviceStreamClients = new ConcurrentHashMap<>();

    @Autowired
    public IsapiClient(
            @Qualifier("isapiHttpClient") OkHttpClient baseHttpClient,
            @Qualifier("isapiStreamClient") OkHttpClient baseStreamClient,
            IsapiConfig config) {
        this.baseHttpClient = baseHttpClient;
        this.baseStreamClient = baseStreamClient;
        this.config = config;
        this.xmlParser = new IsapiXmlParser();
    }

    // ==================== 设备信息 ====================

    /**
     * 获取设备信息
     */
    public Map<String, Object> getDeviceInfo(IsapiDevice device) throws IOException {
        String url = device.getBaseUrl() + IsapiConfig.Endpoints.DEVICE_INFO;
        String response = executeGet(device, url);
        return xmlParser.parseDeviceInfo(response);
    }

    /**
     * 获取设备能力集
     */
    public Map<String, Object> getCapabilities(IsapiDevice device) throws IOException {
        String url = device.getBaseUrl() + IsapiConfig.Endpoints.CAPABILITIES;
        String response = executeGet(device, url);
        return xmlParser.parseDeviceInfo(response);
    }

    /**
     * 测试设备连通性
     */
    public boolean testConnection(IsapiDevice device) {
        try {
            Map<String, Object> info = getDeviceInfo(device);
            return info != null && !info.containsKey("error");
        } catch (Exception e) {
            log.warn("设备连接测试失败: {} - {}", device.getIpAddress(), e.getMessage());
            return false;
        }
    }

    // ==================== 流媒体 ====================

    /**
     * 获取流媒体通道列表
     */
    public java.util.List<Map<String, Object>> getStreamingChannels(IsapiDevice device) throws IOException {
        String url = device.getBaseUrl() + IsapiConfig.Endpoints.STREAMING_CHANNELS;
        String response = executeGet(device, url);
        return xmlParser.parseStreamingChannels(response);
    }

    /**
     * 抓拍图片
     *
     * @param device    设备
     * @param channelId 通道ID
     * @return 图片二进制数据
     */
    public byte[] capturePicture(IsapiDevice device, int channelId) throws IOException {
        String url = device.getBaseUrl() +
                String.format(IsapiConfig.Endpoints.STREAMING_PICTURE, channelId);

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
     *
     * @param device        设备
     * @param eventConsumer 事件回调
     * @return Call 对象，可用于取消订阅
     */
    public Call subscribeAlertStream(IsapiDevice device, Consumer<Map<String, Object>> eventConsumer) {
        String url = device.getBaseUrl() + IsapiConfig.Endpoints.ALERT_STREAM;
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
                log.error("告警订阅失败: {} - {}", device.getIpAddress(), e.getMessage());
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
                    log.error("告警订阅返回错误: {} - HTTP {}", device.getIpAddress(), response.code());
                    return;
                }

                // 获取 boundary
                String contentType = response.header("Content-Type");
                String boundary = extractBoundary(contentType);

                if (boundary == null) {
                    log.error("无法解析 multipart boundary");
                    return;
                }

                log.info("已连接到告警流: {}, boundary={}", device.getIpAddress(), boundary);

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

                        // 检查是否有完整的事件
                        String content = builder.toString();
                        if (content.contains("--" + boundary)) {
                            // 解析事件
                            java.util.List<Map<String, Object>> events =
                                    xmlParser.parseMultipartEvents(content, boundary);

                            for (Map<String, Object> event : events) {
                                event.put("deviceId", device.getId());
                                event.put("factoryId", device.getFactoryId());
                                eventConsumer.accept(event);
                            }

                            // 保留未完成的部分
                            int lastBoundary = content.lastIndexOf("--" + boundary);
                            if (lastBoundary > 0) {
                                builder = new StringBuilder(content.substring(lastBoundary));
                            }
                        }
                    }
                } catch (IOException e) {
                    if (!call.isCanceled()) {
                        log.error("读取告警流异常: {}", e.getMessage());
                    }
                }
            }
        });

        return call;
    }

    // ==================== 智能分析 ====================

    /**
     * 获取智能分析能力
     */
    public SmartCapabilities getSmartCapabilities(IsapiDevice device) throws IOException {
        String url = device.getBaseUrl() + IsapiConfig.Endpoints.SMART_CAPABILITIES;
        try {
            String response = executeGet(device, url);
            return xmlParser.parseSmartCapabilities(response);
        } catch (IOException e) {
            // 设备可能不支持智能分析
            log.debug("获取智能分析能力失败 (设备可能不支持): {} - {}", device.getIpAddress(), e.getMessage());
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
     */
    public SmartAnalysisDTO getLineDetection(IsapiDevice device, int channelId) throws IOException {
        String url = device.getBaseUrl() + String.format(IsapiConfig.Endpoints.LINE_DETECTION, channelId);
        String response = executeGet(device, url);
        return xmlParser.parseLineDetectionConfig(response, channelId);
    }

    /**
     * 设置越界检测配置
     */
    public void setLineDetection(IsapiDevice device, int channelId, SmartAnalysisDTO config) throws IOException {
        String url = device.getBaseUrl() + String.format(IsapiConfig.Endpoints.LINE_DETECTION, channelId);
        String xml = IsapiXmlParser.buildLineDetectionXml(config);
        executePut(device, url, xml);
    }

    /**
     * 获取区域入侵检测配置
     */
    public SmartAnalysisDTO getFieldDetection(IsapiDevice device, int channelId) throws IOException {
        String url = device.getBaseUrl() + String.format(IsapiConfig.Endpoints.INTRUSION_DETECTION, channelId);
        String response = executeGet(device, url);
        return xmlParser.parseFieldDetectionConfig(response, channelId);
    }

    /**
     * 设置区域入侵检测配置
     */
    public void setFieldDetection(IsapiDevice device, int channelId, SmartAnalysisDTO config) throws IOException {
        String url = device.getBaseUrl() + String.format(IsapiConfig.Endpoints.INTRUSION_DETECTION, channelId);
        String xml = IsapiXmlParser.buildFieldDetectionXml(config);
        executePut(device, url, xml);
    }

    /**
     * 获取人脸检测配置
     */
    public SmartAnalysisDTO getFaceDetection(IsapiDevice device, int channelId) throws IOException {
        String url = device.getBaseUrl() + String.format(IsapiConfig.Endpoints.FACE_DETECTION, channelId);
        String response = executeGet(device, url);
        return xmlParser.parseFaceDetectionConfig(response, channelId);
    }

    /**
     * 设置人脸检测配置
     */
    public void setFaceDetection(IsapiDevice device, int channelId, SmartAnalysisDTO config) throws IOException {
        String url = device.getBaseUrl() + String.format(IsapiConfig.Endpoints.FACE_DETECTION, channelId);
        String xml = IsapiXmlParser.buildFaceDetectionXml(config);
        executePut(device, url, xml);
    }

    // ==================== HTTP 执行方法 ====================

    /**
     * 执行 GET 请求
     */
    public String executeGet(IsapiDevice device, String url) throws IOException {
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
     */
    public String executePost(IsapiDevice device, String url, String xmlBody) throws IOException {
        OkHttpClient client = getClientForDevice(device);

        RequestBody body = RequestBody.create(
                xmlBody,
                MediaType.parse("application/xml; charset=utf-8")
        );

        Request request = new Request.Builder()
                .url(url)
                .post(body)
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
     */
    public String executePut(IsapiDevice device, String url, String xmlBody) throws IOException {
        OkHttpClient client = getClientForDevice(device);

        RequestBody body = RequestBody.create(
                xmlBody,
                MediaType.parse("application/xml; charset=utf-8")
        );

        Request request = new Request.Builder()
                .url(url)
                .put(body)
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
     */
    private OkHttpClient getClientForDevice(IsapiDevice device) {
        return deviceClients.computeIfAbsent(device.getId(), id -> {
            String password = decryptPassword(device.getPasswordEncrypted());
            IsapiDigestAuthenticator authenticator =
                    new IsapiDigestAuthenticator(device.getUsername(), password);

            return baseHttpClient.newBuilder()
                    .addInterceptor(authenticator)
                    .build();
        });
    }

    /**
     * 获取设备专用的流式 HTTP 客户端 (带 Digest 认证)
     */
    private OkHttpClient getStreamClientForDevice(IsapiDevice device) {
        return deviceStreamClients.computeIfAbsent(device.getId(), id -> {
            String password = decryptPassword(device.getPasswordEncrypted());
            IsapiDigestAuthenticator authenticator =
                    new IsapiDigestAuthenticator(device.getUsername(), password);

            return baseStreamClient.newBuilder()
                    .addInterceptor(authenticator)
                    .build();
        });
    }

    /**
     * 移除设备的缓存客户端
     */
    public void removeDeviceClient(String deviceId) {
        deviceClients.remove(deviceId);
        deviceStreamClients.remove(deviceId);
    }

    // ==================== 密码加解密 ====================

    /**
     * 加密密码
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

    // ==================== 辅助方法 ====================

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
}

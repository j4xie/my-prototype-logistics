package com.cretas.aims.service.impl;

import com.cretas.aims.config.IFlytekConfig;
import com.cretas.aims.dto.voice.IFlytekWebSocketMessage;
import com.cretas.aims.dto.voice.VoiceRecognitionRequest;
import com.cretas.aims.dto.voice.VoiceRecognitionResponse;
import com.cretas.aims.service.IFlytekVoiceService;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.*;

/**
 * 讯飞语音识别服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class IFlytekVoiceServiceImpl implements IFlytekVoiceService {

    private final IFlytekConfig config;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * WebSocket 超时时间（秒）
     */
    private static final int WEBSOCKET_TIMEOUT = 30;

    @Override
    public VoiceRecognitionResponse recognize(VoiceRecognitionRequest request) {
        if (!config.isConfigured()) {
            log.error("讯飞语音服务未配置");
            return VoiceRecognitionResponse.error(-1, "语音服务未配置，请联系管理员");
        }

        try {
            // 生成鉴权 URL
            String authUrl = generateAuthUrl();
            log.debug("讯飞鉴权URL: {}", authUrl);

            // 执行 WebSocket 识别
            return executeWebSocketRecognition(authUrl, request);

        } catch (Exception e) {
            log.error("语音识别失败", e);
            return VoiceRecognitionResponse.error(-2, "语音识别失败: " + e.getMessage());
        }
    }

    /**
     * 生成讯飞鉴权 URL
     * 参考: https://www.xfyun.cn/doc/asr/voicedictation/API.html#_2-%E9%89%B4%E6%9D%83%E8%AE%A4%E8%AF%81
     */
    private String generateAuthUrl() throws Exception {
        // 1. 获取当前时间 RFC1123 格式
        SimpleDateFormat sdf = new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss 'GMT'", Locale.US);
        sdf.setTimeZone(TimeZone.getTimeZone("GMT"));
        String date = sdf.format(new Date());

        // 2. 解析 URL
        URI uri = new URI(config.getIatUrl());
        String host = uri.getHost();

        // 3. 构建签名原始字符串
        String signatureOrigin = "host: " + host + "\n" +
                                 "date: " + date + "\n" +
                                 "GET " + uri.getPath() + " HTTP/1.1";

        // 4. HMAC-SHA256 签名
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec secretKeySpec = new SecretKeySpec(
            config.getApiSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        mac.init(secretKeySpec);
        byte[] signatureBytes = mac.doFinal(signatureOrigin.getBytes(StandardCharsets.UTF_8));
        String signature = Base64.getEncoder().encodeToString(signatureBytes);

        // 5. 构建 authorization
        String authorizationOrigin = String.format(
            "api_key=\"%s\", algorithm=\"hmac-sha256\", headers=\"host date request-line\", signature=\"%s\"",
            config.getApiKey(), signature);
        String authorization = Base64.getEncoder().encodeToString(
            authorizationOrigin.getBytes(StandardCharsets.UTF_8));

        // 6. 构建完整 URL
        String encodedDate = URLEncoder.encode(date, StandardCharsets.UTF_8.name());
        String encodedHost = URLEncoder.encode(host, StandardCharsets.UTF_8.name());
        String encodedAuth = URLEncoder.encode(authorization, StandardCharsets.UTF_8.name());

        return config.getIatUrl() + "?" +
               "authorization=" + encodedAuth + "&" +
               "date=" + encodedDate + "&" +
               "host=" + encodedHost;
    }

    /**
     * 执行 WebSocket 语音识别
     */
    private VoiceRecognitionResponse executeWebSocketRecognition(
            String authUrl, VoiceRecognitionRequest request) throws Exception {

        CompletableFuture<VoiceRecognitionResponse> future = new CompletableFuture<>();
        StringBuilder resultText = new StringBuilder();
        List<String> sessionIds = new ArrayList<>();

        // 创建 WebSocket 客户端
        WebSocketClient client = new WebSocketClient(new URI(authUrl)) {

            @Override
            public void onOpen(ServerHandshake handshake) {
                log.debug("讯飞 WebSocket 连接已建立");

                try {
                    // 发送首帧（包含 common 和 business）
                    sendFirstFrame(this, request);

                    // 发送末帧（音频数据）
                    sendLastFrame(this, request);

                } catch (Exception e) {
                    log.error("发送音频数据失败", e);
                    future.complete(VoiceRecognitionResponse.error(-3, "发送音频失败"));
                }
            }

            @Override
            public void onMessage(String message) {
                try {
                    log.debug("收到讯飞响应: {}", message);

                    IFlytekWebSocketMessage.Response response =
                        objectMapper.readValue(message, IFlytekWebSocketMessage.Response.class);

                    if (response.getCode() != 0) {
                        log.error("讯飞识别错误: code={}, message={}",
                            response.getCode(), response.getMessage());
                        future.complete(VoiceRecognitionResponse.error(
                            response.getCode(), response.getMessage()));
                        this.close();
                        return;
                    }

                    // 收集会话 ID
                    if (response.getSid() != null && !sessionIds.contains(response.getSid())) {
                        sessionIds.add(response.getSid());
                    }

                    // 解析识别结果
                    if (response.getData() != null && response.getData().getResult() != null) {
                        String text = parseResultText(response.getData().getResult());
                        resultText.append(text);

                        // 检查是否为最终结果
                        if (response.getData().getStatus() == 2) {
                            log.info("讯飞识别完成: {}", resultText);
                            future.complete(VoiceRecognitionResponse.success(
                                resultText.toString(),
                                sessionIds.isEmpty() ? null : sessionIds.get(0),
                                true));
                            this.close();
                        }
                    }

                } catch (Exception e) {
                    log.error("解析讯飞响应失败", e);
                }
            }

            @Override
            public void onClose(int code, String reason, boolean remote) {
                log.debug("讯飞 WebSocket 连接已关闭: code={}, reason={}", code, reason);
                if (!future.isDone()) {
                    if (resultText.length() > 0) {
                        future.complete(VoiceRecognitionResponse.success(
                            resultText.toString(),
                            sessionIds.isEmpty() ? null : sessionIds.get(0),
                            true));
                    } else {
                        future.complete(VoiceRecognitionResponse.error(-4, "连接关闭: " + reason));
                    }
                }
            }

            @Override
            public void onError(Exception e) {
                log.error("讯飞 WebSocket 错误", e);
                if (!future.isDone()) {
                    future.complete(VoiceRecognitionResponse.error(-5, "连接错误: " + e.getMessage()));
                }
            }
        };

        // 连接并等待结果
        client.connect();

        try {
            return future.get(WEBSOCKET_TIMEOUT, TimeUnit.SECONDS);
        } catch (TimeoutException e) {
            client.close();
            return VoiceRecognitionResponse.error(-6, "识别超时");
        }
    }

    /**
     * 发送首帧
     */
    private void sendFirstFrame(WebSocketClient client, VoiceRecognitionRequest request) throws Exception {
        IFlytekWebSocketMessage.Request firstFrame = IFlytekWebSocketMessage.Request.builder()
            .common(IFlytekWebSocketMessage.Common.builder()
                .appId(config.getAppId())
                .build())
            .business(IFlytekWebSocketMessage.Business.builder()
                .language(request.getLanguage() != null ? request.getLanguage() : config.getLanguage())
                .domain(config.getDomain())
                .accent(config.getAccent())
                .ptt(request.getPtt() != null && request.getPtt() ? 1 : (config.isPtt() ? 1 : 0))
                .build())
            .data(IFlytekWebSocketMessage.AudioData.builder()
                .status(0)  // 首帧
                .format(request.getFormat())
                .encoding(request.getEncoding())
                .audio("")  // 首帧不发送音频
                .build())
            .build();

        String jsonMessage = objectMapper.writeValueAsString(firstFrame);
        log.debug("发送首帧: {}", jsonMessage);
        client.send(jsonMessage);
    }

    /**
     * 发送末帧（包含音频数据）
     */
    private void sendLastFrame(WebSocketClient client, VoiceRecognitionRequest request) throws Exception {
        IFlytekWebSocketMessage.Request lastFrame = IFlytekWebSocketMessage.Request.builder()
            .data(IFlytekWebSocketMessage.AudioData.builder()
                .status(2)  // 末帧
                .format(request.getFormat())
                .encoding(request.getEncoding())
                .audio(request.getAudioData())
                .build())
            .build();

        String jsonMessage = objectMapper.writeValueAsString(lastFrame);
        log.debug("发送末帧 (音频长度: {} bytes)",
            request.getAudioData() != null ? request.getAudioData().length() : 0);
        client.send(jsonMessage);
    }

    /**
     * 解析识别结果文本
     */
    private String parseResultText(IFlytekWebSocketMessage.RecognitionResult result) {
        if (result == null || result.getWs() == null) {
            return "";
        }

        StringBuilder sb = new StringBuilder();
        for (IFlytekWebSocketMessage.WordSet ws : result.getWs()) {
            if (ws.getCw() != null) {
                for (IFlytekWebSocketMessage.ChineseWord cw : ws.getCw()) {
                    if (cw.getW() != null) {
                        sb.append(cw.getW());
                    }
                }
            }
        }
        return sb.toString();
    }

    @Override
    public boolean isAvailable() {
        return config.isConfigured();
    }

    @Override
    public String getVersion() {
        return "iFlytek Voice Recognition Service v1.0.0";
    }
}

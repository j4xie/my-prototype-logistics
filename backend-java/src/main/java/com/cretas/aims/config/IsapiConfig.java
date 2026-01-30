package com.cretas.aims.config;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import okhttp3.OkHttpClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.security.cert.X509Certificate;
import java.util.concurrent.TimeUnit;

/**
 * 海康威视 ISAPI 协议配置类
 *
 * 支持功能:
 * - 设备管理 (IPC/NVR/DVR)
 * - 实时预览/抓拍
 * - 告警事件订阅 (alertStream)
 * - Digest 认证 (RFC 2617)
 *
 * 配置示例 (application.yml):
 * isapi:
 *   enabled: true
 *   connection-timeout: 10
 *   read-timeout: 30
 *   write-timeout: 10
 *   stream-timeout: 0  # 0 表示无限制 (用于 alertStream)
 *   trust-all-certs: true  # 开发环境允许自签名证书
 *   heartbeat-interval: 30  # 心跳检测间隔(秒)
 *   retry-count: 3
 *   retry-delay: 1000
 *
 * @author Cretas Team
 * @since 2026-01-05
 */
@Slf4j
@Data
@Configuration
@ConditionalOnProperty(name = "isapi.enabled", havingValue = "true", matchIfMissing = true)
public class IsapiConfig {

    @Value("${isapi.connection-timeout:10}")
    private int connectionTimeout;

    @Value("${isapi.read-timeout:30}")
    private int readTimeout;

    @Value("${isapi.write-timeout:10}")
    private int writeTimeout;

    @Value("${isapi.stream-timeout:0}")
    private int streamTimeout;

    @Value("${isapi.trust-all-certs:true}")
    private boolean trustAllCerts;

    @Value("${isapi.heartbeat-interval:30}")
    private int heartbeatInterval;

    @Value("${isapi.retry-count:3}")
    private int retryCount;

    @Value("${isapi.retry-delay:1000}")
    private int retryDelay;

    @Value("${isapi.password-encryption-key:cretas-isapi-2026}")
    private String passwordEncryptionKey;

    /**
     * 创建标准 OkHttpClient (用于普通 API 请求)
     * 注意: Digest 认证拦截器在 IsapiClient 中动态添加
     */
    @Bean(name = "isapiHttpClient")
    public OkHttpClient isapiHttpClient() {
        OkHttpClient.Builder builder = new OkHttpClient.Builder()
                .connectTimeout(connectionTimeout, TimeUnit.SECONDS)
                .readTimeout(readTimeout, TimeUnit.SECONDS)
                .writeTimeout(writeTimeout, TimeUnit.SECONDS)
                .retryOnConnectionFailure(true);

        if (trustAllCerts) {
            configureUnsafeTrust(builder);
        }

        log.info("ISAPI HTTP 客户端已配置: connectTimeout={}s, readTimeout={}s",
                connectionTimeout, readTimeout);
        return builder.build();
    }

    /**
     * 创建流式 OkHttpClient (用于 alertStream 长连接)
     * 读取超时设为 0 表示无限等待
     */
    @Bean(name = "isapiStreamClient")
    public OkHttpClient isapiStreamClient() {
        OkHttpClient.Builder builder = new OkHttpClient.Builder()
                .connectTimeout(connectionTimeout, TimeUnit.SECONDS)
                .readTimeout(streamTimeout, TimeUnit.SECONDS) // 0 = 无限
                .writeTimeout(writeTimeout, TimeUnit.SECONDS)
                .retryOnConnectionFailure(true);

        if (trustAllCerts) {
            configureUnsafeTrust(builder);
        }

        log.info("ISAPI Stream 客户端已配置: streamTimeout={}s (0=无限)", streamTimeout);
        return builder.build();
    }

    /**
     * 配置信任所有证书 (仅用于开发/测试环境)
     * 生产环境应使用正式 SSL 证书
     */
    private void configureUnsafeTrust(OkHttpClient.Builder builder) {
        try {
            TrustManager[] trustAllCerts = new TrustManager[]{
                    new X509TrustManager() {
                        @Override
                        public void checkClientTrusted(X509Certificate[] chain, String authType) {}

                        @Override
                        public void checkServerTrusted(X509Certificate[] chain, String authType) {}

                        @Override
                        public X509Certificate[] getAcceptedIssuers() {
                            return new X509Certificate[]{};
                        }
                    }
            };

            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(null, trustAllCerts, new java.security.SecureRandom());

            builder.sslSocketFactory(sslContext.getSocketFactory(),
                    (X509TrustManager) trustAllCerts[0]);
            builder.hostnameVerifier((hostname, session) -> true);

            log.warn("ISAPI: 已启用信任所有证书模式，仅适用于开发环境!");
        } catch (Exception e) {
            log.error("配置 SSL 信任失败", e);
        }
    }

    /**
     * ISAPI 常用端点路径
     */
    public static class Endpoints {
        // 系统信息
        public static final String DEVICE_INFO = "/ISAPI/System/deviceInfo";
        public static final String CAPABILITIES = "/ISAPI/System/capabilities";
        public static final String TIME = "/ISAPI/System/time";
        public static final String NETWORK_INTERFACES = "/ISAPI/System/Network/interfaces";

        // 流媒体
        public static final String STREAMING_CHANNELS = "/ISAPI/Streaming/channels";
        public static final String STREAMING_PICTURE = "/ISAPI/Streaming/channels/%d/picture";

        // 事件通知
        public static final String ALERT_STREAM = "/ISAPI/Event/notification/alertStream";
        public static final String SUBSCRIBE_EVENT = "/ISAPI/Event/notification/subscribeEvent";
        public static final String EVENT_TRIGGERS = "/ISAPI/Event/triggers";

        // PTZ 控制
        public static final String PTZ_CHANNELS = "/ISAPI/PTZCtrl/channels";
        public static final String PTZ_CONTINUOUS = "/ISAPI/PTZCtrl/channels/%d/continuous";
        public static final String PTZ_PRESETS = "/ISAPI/PTZCtrl/channels/%d/presets";

        // 智能分析
        public static final String SMART_CAPABILITIES = "/ISAPI/Smart/capabilities";
        public static final String LINE_DETECTION = "/ISAPI/Smart/LineDetection/%d";
        public static final String INTRUSION_DETECTION = "/ISAPI/Smart/FieldDetection/%d";
        public static final String FACE_DETECTION = "/ISAPI/Smart/FaceDetect/%d";

        // NVR 通道
        public static final String CONTENT_MGMT_INPUT = "/ISAPI/ContentMgmt/InputProxy/channels";

        // 录像管理 (Phase 3: NVR 历史录像分析)
        public static final String CONTENT_MGMT_SEARCH = "/ISAPI/ContentMgmt/search";
        public static final String CONTENT_MGMT_RECORD_STATUS = "/ISAPI/ContentMgmt/record/tracks";
        public static final String PLAYBACK_URI = "/ISAPI/Streaming/tracks/%d";

        // 系统管理
        public static final String REBOOT = "/ISAPI/System/reboot";
        public static final String FACTORY_RESET = "/ISAPI/System/factoryReset";

        // 用户管理
        public static final String USERS = "/ISAPI/Security/users";
        public static final String USER_BY_ID = "/ISAPI/Security/users/%d";
    }

    /**
     * ISAPI 事件类型常量
     */
    public static class EventTypes {
        public static final String VIDEO_LOSS = "videoloss";
        public static final String VIDEO_MOTION = "VMD";
        public static final String LINE_DETECTION = "linedetection";
        public static final String FIELD_DETECTION = "fielddetection";
        public static final String FACE_DETECTION = "facedetection";
        public static final String SHELTER_ALARM = "shelteralarm";
        public static final String DISK_FULL = "diskfull";
        public static final String DISK_ERROR = "diskerror";
        public static final String ILLEGAL_ACCESS = "illaccess";
        public static final String IP_CONFLICT = "ipconflict";
        public static final String NETWORK_DISCONNECT = "netabort";
    }
}

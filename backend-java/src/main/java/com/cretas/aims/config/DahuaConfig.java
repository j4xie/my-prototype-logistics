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
 * 大华设备集成配置类
 *
 * 支持功能:
 * - 设备管理 (IPC/NVR/DVR)
 * - 实时预览/抓拍
 * - 告警事件订阅 (eventManager attach)
 * - Digest 认证 (RFC 2617)
 * - UDP 设备发现 (端口 37810)
 * - TCP 控制连接 (端口 37777)
 *
 * 配置示例 (application.yml):
 * dahua:
 *   enabled: true
 *   connection-timeout: 10
 *   read-timeout: 30
 *   write-timeout: 10
 *   stream-timeout: 0  # 0 表示无限制 (用于 alertStream)
 *   trust-all-certs: true  # 开发环境允许自签名证书
 *   heartbeat-interval: 30  # 心跳检测间隔(秒)
 *   retry-count: 3
 *   retry-delay: 1000
 *   discovery-port: 37810  # UDP 发现端口
 *   control-port: 37777    # TCP 控制端口
 *
 * @author Cretas Team
 * @since 2026-01-23
 */
@Slf4j
@Data
@Configuration
@ConditionalOnProperty(name = "dahua.enabled", havingValue = "true", matchIfMissing = true)
public class DahuaConfig {

    @Value("${dahua.enabled:true}")
    private boolean enabled;

    @Value("${dahua.connection-timeout:10}")
    private int connectionTimeout;

    @Value("${dahua.read-timeout:30}")
    private int readTimeout;

    @Value("${dahua.write-timeout:10}")
    private int writeTimeout;

    @Value("${dahua.stream-timeout:0}")
    private int streamTimeout;

    @Value("${dahua.trust-all-certs:true}")
    private boolean trustAllCerts;

    @Value("${dahua.heartbeat-interval:30}")
    private int heartbeatInterval;

    @Value("${dahua.retry-count:3}")
    private int retryCount;

    @Value("${dahua.retry-delay:1000}")
    private int retryDelay;

    @Value("${dahua.password-encryption-key:cretas-dahua-2026}")
    private String passwordEncryptionKey;

    @Value("${dahua.discovery-port:37810}")
    private int discoveryPort;

    @Value("${dahua.control-port:37777}")
    private int controlPort;

    /**
     * 创建标准 OkHttpClient (用于普通 API 请求)
     * 注意: Digest 认证拦截器在 DahuaClient 中动态添加
     */
    @Bean(name = "dahuaHttpClient")
    public OkHttpClient dahuaHttpClient() {
        OkHttpClient.Builder builder = new OkHttpClient.Builder()
                .connectTimeout(connectionTimeout, TimeUnit.SECONDS)
                .readTimeout(readTimeout, TimeUnit.SECONDS)
                .writeTimeout(writeTimeout, TimeUnit.SECONDS)
                .retryOnConnectionFailure(true);

        if (trustAllCerts) {
            configureUnsafeTrust(builder);
        }

        log.info("Dahua HTTP 客户端已配置: connectTimeout={}s, readTimeout={}s",
                connectionTimeout, readTimeout);
        return builder.build();
    }

    /**
     * 创建流式 OkHttpClient (用于 eventManager attach 长连接)
     * 读取超时设为 0 表示无限等待
     */
    @Bean(name = "dahuaStreamClient")
    public OkHttpClient dahuaStreamClient() {
        OkHttpClient.Builder builder = new OkHttpClient.Builder()
                .connectTimeout(connectionTimeout, TimeUnit.SECONDS)
                .readTimeout(streamTimeout, TimeUnit.SECONDS) // 0 = 无限
                .writeTimeout(writeTimeout, TimeUnit.SECONDS)
                .retryOnConnectionFailure(true);

        if (trustAllCerts) {
            configureUnsafeTrust(builder);
        }

        log.info("Dahua Stream 客户端已配置: streamTimeout={}s (0=无限)", streamTimeout);
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

            log.warn("Dahua: 已启用信任所有证书模式，仅适用于开发环境!");
        } catch (Exception e) {
            log.error("配置 SSL 信任失败", e);
        }
    }

    /**
     * 大华设备 HTTP API 端点路径
     * 基于 CGI 协议
     */
    public static class Endpoints {
        // 系统信息
        public static final String DEVICE_INFO = "/cgi-bin/magicBox.cgi?action=getSystemInfo";
        public static final String CAPABILITIES = "/cgi-bin/devAbility.cgi?action=getAll";
        public static final String TIME = "/cgi-bin/global.cgi?action=getCurrentTime";
        public static final String NETWORK_INTERFACES = "/cgi-bin/configManager.cgi?action=getConfig&name=Network";

        // 通道配置
        public static final String CHANNELS = "/cgi-bin/configManager.cgi?action=getConfig&name=ChannelTitle";
        public static final String ENCODE_CONFIG = "/cgi-bin/configManager.cgi?action=getConfig&name=Encode";

        // 抓拍
        public static final String SNAPSHOT = "/cgi-bin/snapshot.cgi?channel=%d";
        public static final String SNAPSHOT_WITH_QUALITY = "/cgi-bin/snapshot.cgi?channel=%d&type=%d";

        // 事件通知 (长连接订阅)
        public static final String ALERT_STREAM = "/cgi-bin/eventManager.cgi?action=attach&codes=[All]";
        public static final String ALERT_STREAM_SPECIFIC = "/cgi-bin/eventManager.cgi?action=attach&codes=[%s]";
        public static final String EVENT_TRIGGERS = "/cgi-bin/configManager.cgi?action=getConfig&name=Alarm";

        // 智能分析能力
        public static final String SMART_CAPS = "/cgi-bin/devAbility.cgi?action=get&AbilityType=IVS";
        public static final String VIDEO_ANALYSE_CAPS = "/cgi-bin/devAbility.cgi?action=get&AbilityType=VideoAnalyse";

        // 智能分析规则配置
        public static final String LINE_DETECTION = "/cgi-bin/configManager.cgi?action=getConfig&name=VideoAnalyseRule[%d].CrossLine";
        public static final String LINE_DETECTION_SET = "/cgi-bin/configManager.cgi?action=setConfig&VideoAnalyseRule[%d].CrossLine";
        public static final String INTRUSION_DETECTION = "/cgi-bin/configManager.cgi?action=getConfig&name=VideoAnalyseRule[%d].CrossRegion";
        public static final String INTRUSION_DETECTION_SET = "/cgi-bin/configManager.cgi?action=setConfig&VideoAnalyseRule[%d].CrossRegion";
        public static final String FACE_DETECTION = "/cgi-bin/configManager.cgi?action=getConfig&name=FaceDetection[%d]";
        public static final String FACE_DETECTION_SET = "/cgi-bin/configManager.cgi?action=setConfig&FaceDetection[%d]";

        // PTZ 控制
        public static final String PTZ_CONTROL = "/cgi-bin/ptz.cgi?action=start&channel=%d&code=%s&arg1=%d&arg2=%d&arg3=%d";
        public static final String PTZ_STOP = "/cgi-bin/ptz.cgi?action=stop&channel=%d&code=%s";
        public static final String PTZ_PRESETS = "/cgi-bin/ptz.cgi?action=getPresets&channel=%d";
        public static final String PTZ_GOTO_PRESET = "/cgi-bin/ptz.cgi?action=start&channel=%d&code=GotoPreset&arg1=0&arg2=%d&arg3=0";

        // 录像管理
        public static final String RECORD_CONFIG = "/cgi-bin/configManager.cgi?action=getConfig&name=Record";
        public static final String RECORD_FINDER = "/cgi-bin/mediaFileFind.cgi?action=factory.create";
        public static final String RECORD_FIND_FILE = "/cgi-bin/mediaFileFind.cgi?action=findFile&object=%d";

        // 存储管理
        public static final String STORAGE_INFO = "/cgi-bin/configManager.cgi?action=getConfig&name=Storage";
        public static final String DISK_INFO = "/cgi-bin/devStorage.cgi?action=getDeviceAllInfo";

        // 系统管理
        public static final String REBOOT = "/cgi-bin/magicBox.cgi?action=reboot";
        public static final String FACTORY_RESET = "/cgi-bin/magicBox.cgi?action=factoryDefaultDirect";
        public static final String SHUTDOWN = "/cgi-bin/magicBox.cgi?action=shutdown";

        // 用户管理
        public static final String USERS = "/cgi-bin/userManager.cgi?action=getUserInfoAll";
        public static final String USER_ADD = "/cgi-bin/userManager.cgi?action=addUser";
        public static final String USER_MODIFY = "/cgi-bin/userManager.cgi?action=modifyUser";
        public static final String USER_DELETE = "/cgi-bin/userManager.cgi?action=deleteUser&name=%s";

        // 日志查询
        public static final String LOG_QUERY = "/cgi-bin/log.cgi?action=startFind&condition.StartTime=%s&condition.EndTime=%s";
    }

    /**
     * 大华设备事件类型常量
     */
    public static class EventTypes {
        // 视频事件
        public static final String VMD = "VideoMotion";
        public static final String VIDEO_BLIND = "VideoBlind";
        public static final String VIDEO_LOSS = "VideoLoss";
        public static final String VIDEO_ABNORMAL = "VideoAbnormalDetection";

        // 智能分析事件
        public static final String CROSS_LINE_DETECTION = "CrossLineDetection";
        public static final String CROSS_REGION_DETECTION = "CrossRegionDetection";
        public static final String FACE_DETECTION = "FaceDetection";
        public static final String FACE_RECOGNITION = "FaceRecognition";
        public static final String HUMAN_DETECTION = "HumanDetection";
        public static final String VEHICLE_DETECTION = "VehicleDetection";
        public static final String PLATE_DETECTION = "TrafficJunction";

        // 报警输入/输出
        public static final String ALARM_LOCAL = "AlarmLocal";
        public static final String ALARM_OUTPUT = "AlarmOutput";
        public static final String EXTERNAL_ALARM = "ExternalAlarm";

        // 设备状态事件
        public static final String DISK_FULL = "DiskFull";
        public static final String DISK_ERROR = "DiskError";
        public static final String DISK_UNFORMAT = "NoDisk";
        public static final String NET_ABORT = "NetAbort";
        public static final String IP_CONFLICT = "IPConflict";
        public static final String ILLEGAL_ACCESS = "IllegalAccess";
        public static final String STORAGE_NOT_EXIST = "StorageNotExist";
        public static final String STORAGE_FAILURE = "StorageFailure";
        public static final String STORAGE_LOW_SPACE = "StorageLowSpace";

        // 门禁事件
        public static final String ACCESS_CONTROL = "AccessControl";
        public static final String DOOR_OPEN = "DoorOpen";
        public static final String DOOR_CLOSE = "DoorClose";
        public static final String DOOR_STATUS = "DoorStatus";

        // 温度/环境事件
        public static final String TEMPERATURE_ALARM = "TemperatureAlarm";
        public static final String HUMIDITY_ALARM = "HumidityAlarm";

        // 人数统计
        public static final String NUMBER_STAT = "NumberStat";
        public static final String QUEUE_NUM_DETECTION = "QueueNumDetection";
    }

    /**
     * PTZ 控制命令码
     */
    public static class PtzCommands {
        public static final String UP = "Up";
        public static final String DOWN = "Down";
        public static final String LEFT = "Left";
        public static final String RIGHT = "Right";
        public static final String LEFT_UP = "LeftUp";
        public static final String LEFT_DOWN = "LeftDown";
        public static final String RIGHT_UP = "RightUp";
        public static final String RIGHT_DOWN = "RightDown";
        public static final String ZOOM_IN = "ZoomTele";
        public static final String ZOOM_OUT = "ZoomWide";
        public static final String FOCUS_NEAR = "FocusNear";
        public static final String FOCUS_FAR = "FocusFar";
        public static final String IRIS_LARGE = "IrisLarge";
        public static final String IRIS_SMALL = "IrisSmall";
        public static final String GOTO_PRESET = "GotoPreset";
        public static final String SET_PRESET = "SetPreset";
        public static final String CLEAR_PRESET = "ClearPreset";
    }
}

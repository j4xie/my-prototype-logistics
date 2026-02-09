package com.cretas.aims.dto.dahua;

import com.cretas.aims.entity.dahua.DahuaDevice.DeviceStatus;
import com.cretas.aims.entity.dahua.DahuaDevice.DeviceType;
import com.cretas.aims.entity.dahua.DahuaDevice.Protocol;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Pattern;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Dahua Device DTO
 * 用于大华设备 CRUD 操作的数据传输对象
 *
 * @author Cretas Team
 * @since 2026-01-23
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "大华设备 DTO")
public class DahuaDeviceDTO {

    @Schema(description = "设备ID")
    private String id;

    @Schema(description = "工厂ID")
    private String factoryId;

    // ==================== 设备基本信息 ====================

    @NotBlank(message = "设备名称不能为空")
    @Schema(description = "设备名称", required = true, example = "车间入口摄像头")
    private String deviceName;

    @NotNull(message = "设备类型不能为空")
    @Schema(description = "设备类型", required = true, example = "IPC")
    @Builder.Default
    private DeviceType deviceType = DeviceType.IPC;

    @Schema(description = "设备型号", example = "DH-IPC-HFW2831T-ZS")
    private String deviceModel;

    @Schema(description = "序列号")
    private String serialNumber;

    @Schema(description = "MAC地址", example = "AA:BB:CC:DD:EE:FF")
    private String macAddress;

    @Schema(description = "固件版本")
    private String firmwareVersion;

    // ==================== 网络配置 ====================

    @NotBlank(message = "IP地址不能为空")
    @Pattern(regexp = "^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$",
            message = "IP地址格式不正确")
    @Schema(description = "IP地址", required = true, example = "192.168.1.100")
    private String ipAddress;

    @Min(value = 1, message = "端口号必须大于0")
    @Max(value = 65535, message = "端口号不能超过65535")
    @Schema(description = "HTTP端口", example = "80")
    @Builder.Default
    private Integer port = 80;

    @Schema(description = "RTSP端口", example = "554")
    @Builder.Default
    private Integer rtspPort = 554;

    @Schema(description = "TCP控制端口 (大华私有协议)", example = "37777")
    @Builder.Default
    private Integer tcpPort = 37777;

    @Schema(description = "HTTPS端口", example = "443")
    @Builder.Default
    private Integer httpsPort = 443;

    @Schema(description = "协议类型")
    @Builder.Default
    private Protocol protocol = Protocol.HTTP;

    // ==================== 认证信息 ====================

    @NotBlank(message = "用户名不能为空")
    @Schema(description = "用户名", required = true, example = "admin")
    private String username;

    @Schema(description = "密码 (仅用于添加/更新设备)")
    private String password;

    // ==================== 设备能力 ====================

    @Schema(description = "通道数")
    @Builder.Default
    private Integer channelCount = 1;

    @Schema(description = "是否支持PTZ")
    @Builder.Default
    private Boolean supportsPtz = false;

    @Schema(description = "是否支持音频")
    @Builder.Default
    private Boolean supportsAudio = false;

    @Schema(description = "是否支持智能分析")
    @Builder.Default
    private Boolean supportsSmart = false;

    @Schema(description = "设备能力集 (JSON)")
    private Map<String, Object> deviceCapabilities;

    // ==================== 状态信息 ====================

    @Schema(description = "设备状态")
    @Builder.Default
    private DeviceStatus status = DeviceStatus.UNKNOWN;

    @Schema(description = "最近错误信息")
    private String lastError;

    @Schema(description = "最后心跳时间")
    private LocalDateTime lastHeartbeatAt;

    @Schema(description = "最后事件时间")
    private LocalDateTime lastEventAt;

    // ==================== 订阅状态 ====================

    @Schema(description = "是否已订阅告警")
    @Builder.Default
    private Boolean alertSubscribed = false;

    @Schema(description = "已订阅的事件类型")
    private List<String> subscribedEvents;

    // ==================== 位置信息 ====================

    @Schema(description = "位置描述", example = "1号车间入口")
    private String locationDescription;

    @Schema(description = "纬度")
    private Double latitude;

    @Schema(description = "经度")
    private Double longitude;

    // ==================== 关联信息 ====================

    @Schema(description = "部门ID")
    private String departmentId;

    @Schema(description = "设备ID (关联生产设备)")
    private Long equipmentId;

    // ==================== 通道列表 ====================

    @Schema(description = "通道列表")
    private List<DahuaChannelDTO> channels;

    // ==================== 审计信息 ====================

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Schema(description = "更新时间")
    private LocalDateTime updatedAt;

    /**
     * 大华设备通道 DTO
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "大华设备通道 DTO")
    public static class DahuaChannelDTO {

        @Schema(description = "通道记录ID")
        private String id;

        @Schema(description = "通道ID (从1开始)")
        private Integer channelId;

        @Schema(description = "通道名称")
        private String channelName;

        @Schema(description = "通道类型 (ANALOG, IP, VIRTUAL, COAXIAL)")
        private String channelType;

        @Schema(description = "源IP地址 (NVR关联的IPC)")
        private String sourceIp;

        @Schema(description = "源端口")
        private Integer sourcePort;

        @Schema(description = "主码流URL")
        private String mainStreamUrl;

        @Schema(description = "子码流URL")
        private String subStreamUrl;

        @Schema(description = "第三码流URL")
        private String thirdStreamUrl;

        @Schema(description = "通道状态 (ONLINE, OFFLINE, NO_VIDEO, DECODING)")
        private String status;

        @Schema(description = "是否启用录像")
        private Boolean recordingEnabled;

        @Schema(description = "是否启用智能分析")
        private Boolean smartEnabled;

        @Schema(description = "已启用的事件类型")
        private List<String> enabledEvents;
    }
}

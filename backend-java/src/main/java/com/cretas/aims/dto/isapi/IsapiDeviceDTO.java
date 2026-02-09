package com.cretas.aims.dto.isapi;

import com.cretas.aims.entity.isapi.IsapiDevice.DeviceStatus;
import com.cretas.aims.entity.isapi.IsapiDevice.DeviceType;
import com.cretas.aims.entity.isapi.IsapiDevice.Protocol;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * ISAPI 设备 DTO
 *
 * @author Cretas Team
 * @since 2026-01-05
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IsapiDeviceDTO {

    private String id;
    private String factoryId;

    // ==================== 设备基本信息 ====================

    @NotBlank(message = "设备名称不能为空")
    @Size(max = 100, message = "设备名称不能超过100字符")
    private String deviceName;

    @NotNull(message = "设备类型不能为空")
    private DeviceType deviceType;

    private String deviceModel;
    private String serialNumber;
    private String firmwareVersion;

    // ==================== 网络配置 ====================

    @NotBlank(message = "IP地址不能为空")
    @Pattern(regexp = "^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$",
            message = "IP地址格式不正确")
    private String ipAddress;

    @Min(value = 1, message = "端口号必须大于0")
    @Max(value = 65535, message = "端口号不能超过65535")
    private Integer port;

    private Integer rtspPort;
    private Integer httpsPort;
    private Protocol protocol;

    // ==================== 认证信息 ====================

    @NotBlank(message = "用户名不能为空")
    private String username;

    /**
     * 密码 (仅在创建/更新时使用，查询时不返回)
     */
    private String password;

    // ==================== 设备能力 ====================

    private Integer channelCount;
    private Boolean supportsPtz;
    private Boolean supportsAudio;
    private Boolean supportsSmart;
    private Map<String, Object> deviceCapabilities;

    // ==================== 状态信息 ====================

    private DeviceStatus status;
    private String lastError;
    private LocalDateTime lastHeartbeatAt;
    private LocalDateTime lastEventAt;

    // ==================== 订阅状态 ====================

    private Boolean alertSubscribed;
    private List<String> subscribedEvents;

    // ==================== 位置信息 ====================

    private String locationDescription;
    private Double latitude;
    private Double longitude;

    // ==================== 关联信息 ====================

    private String departmentId;
    private Long equipmentId;

    // ==================== 通道列表 ====================

    private List<IsapiChannelDTO> channels;

    // ==================== 时间戳 ====================

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /**
     * 通道 DTO
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class IsapiChannelDTO {
        private String id;
        private Integer channelId;
        private String channelName;
        private String channelType;
        private String sourceIp;
        private Integer sourcePort;
        private String mainStreamUrl;
        private String subStreamUrl;
        private String status;
        private Boolean recordingEnabled;
        private Boolean smartEnabled;
        private List<String> enabledEvents;
    }
}

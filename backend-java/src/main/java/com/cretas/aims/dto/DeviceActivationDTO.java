package com.cretas.aims.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Pattern;
import javax.validation.constraints.Positive;
import java.time.LocalDateTime;

/**
 * 设备激活DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "设备激活信息")
public class DeviceActivationDTO {

    @Schema(description = "激活记录ID", example = "1")
    private Integer id;

    @Schema(description = "工厂ID", example = "FAC001")
    private String factoryId;

    @Schema(description = "激活码", example = "ACT-2025-XXXX-XXXX", required = true)
    @NotBlank(message = "激活码不能为空")
    private String activationCode;

    @Schema(description = "设备ID", example = "DEV-001")
    private String deviceId;

    @Schema(description = "设备名称", example = "生产线平板1")
    private String deviceName;

    @Schema(description = "设备类型", example = "tablet")
    @Pattern(regexp = "^(mobile|tablet|desktop|scanner|printer|other)$",
            message = "设备类型不正确")
    private String deviceType;

    @Schema(description = "设备型号", example = "iPad Pro 11")
    private String deviceModel;

    @Schema(description = "操作系统类型", example = "iOS")
    private String osType;

    @Schema(description = "操作系统版本", example = "15.0")
    private String osVersion;

    @Schema(description = "应用版本", example = "1.0.0")
    private String appVersion;

    @Schema(description = "IP地址", example = "192.168.1.100")
    private String ipAddress;

    @Schema(description = "MAC地址", example = "00:11:22:33:44:55")
    private String macAddress;

    @Schema(description = "激活状态", example = "ACTIVATED")
    @Pattern(regexp = "^(PENDING|ACTIVATED|EXPIRED|REVOKED)$",
            message = "激活状态不正确")
    private String status;

    @Schema(description = "激活时间")
    private LocalDateTime activatedAt;

    @Schema(description = "激活人ID", example = "1")
    private Integer activatedBy;

    @Schema(description = "激活人姓名", example = "张三")
    private String activatedByName;

    @Schema(description = "过期时间")
    private LocalDateTime expiresAt;

    @Schema(description = "最大设备数限制", example = "5")
    @Positive(message = "最大设备数必须大于0")
    private Integer maxDevices;

    @Schema(description = "已使用设备数", example = "2")
    private Integer usedDevices;

    @Schema(description = "是否允许多设备", example = "true")
    private Boolean allowMultipleDevices;

    @Schema(description = "最后活跃时间")
    private LocalDateTime lastActiveAt;

    @Schema(description = "备注")
    private String notes;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Schema(description = "更新时间")
    private LocalDateTime updatedAt;

    /**
     * 激活码生成请求
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class GenerateRequest {
        @Schema(description = "工厂ID", example = "FAC001", required = true)
        @NotBlank(message = "工厂ID不能为空")
        private String factoryId;

        @Schema(description = "激活码数量", example = "10")
        @Positive(message = "数量必须大于0")
        private Integer quantity;

        @Schema(description = "有效天数", example = "30")
        @Positive(message = "有效天数必须大于0")
        private Integer validDays;

        @Schema(description = "最大设备数", example = "5")
        @Positive(message = "最大设备数必须大于0")
        private Integer maxDevices;

        @Schema(description = "允许多设备", example = "false")
        private Boolean allowMultipleDevices;

        @Schema(description = "备注")
        private String notes;
    }

    /**
     * 设备激活请求
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ActivateRequest {
        @Schema(description = "激活码", example = "ACT-2025-XXXX-XXXX", required = true)
        @NotBlank(message = "激活码不能为空")
        private String activationCode;

        @Schema(description = "设备ID", example = "DEV-001", required = true)
        @NotBlank(message = "设备ID不能为空")
        private String deviceId;

        @Schema(description = "设备名称", example = "生产线平板1")
        private String deviceName;

        @Schema(description = "设备类型", example = "tablet")
        private String deviceType;

        @Schema(description = "设备型号", example = "iPad Pro 11")
        private String deviceModel;

        @Schema(description = "操作系统", example = "iOS")
        private String osType;

        @Schema(description = "系统版本", example = "15.0")
        private String osVersion;

        @Schema(description = "应用版本", example = "1.0.0")
        private String appVersion;

        @Schema(description = "IP地址", example = "192.168.1.100")
        private String ipAddress;

        @Schema(description = "MAC地址", example = "00:11:22:33:44:55")
        private String macAddress;
    }

    /**
     * 激活统计
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ActivationStatistics {
        @Schema(description = "总激活码数", example = "100")
        private Long totalCodes;

        @Schema(description = "待激活数", example = "40")
        private Long pendingCodes;

        @Schema(description = "已激活数", example = "50")
        private Long activatedCodes;

        @Schema(description = "已过期数", example = "5")
        private Long expiredCodes;

        @Schema(description = "已撤销数", example = "5")
        private Long revokedCodes;

        @Schema(description = "总设备数", example = "45")
        private Long totalDevices;

        @Schema(description = "活跃设备数", example = "40")
        private Long activeDevices;

        @Schema(description = "本月新增激活", example = "10")
        private Long monthlyActivations;

        @Schema(description = "本周新增激活", example = "3")
        private Long weeklyActivations;

        @Schema(description = "今日新增激活", example = "1")
        private Long dailyActivations;

        @Schema(description = "激活率", example = "50.0")
        private Double activationRate;

        @Schema(description = "设备利用率", example = "89.0")
        private Double deviceUtilizationRate;
    }
}
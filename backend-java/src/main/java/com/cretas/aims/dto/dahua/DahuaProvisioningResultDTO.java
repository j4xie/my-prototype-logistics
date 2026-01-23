package com.cretas.aims.dto.dahua;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 大华设备配网结果 DTO
 *
 * @author Cretas Team
 * @since 2026-01-23
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "大华设备配网结果")
public class DahuaProvisioningResultDTO {

    @Schema(description = "是否成功")
    private Boolean success;

    @Schema(description = "结果消息")
    private String message;

    @Schema(description = "设备MAC地址")
    private String deviceMac;

    @Schema(description = "设备IP地址 (配网后)")
    private String deviceIp;

    @Schema(description = "HTTP端口")
    private Integer httpPort;

    @Schema(description = "TCP端口")
    private Integer tcpPort;

    @Schema(description = "设备型号")
    private String model;

    @Schema(description = "设备序列号")
    private String serialNumber;

    @Schema(description = "配网时间")
    private LocalDateTime provisionedAt;

    @Schema(description = "错误详情 (失败时)")
    private String errorDetail;

    /**
     * 创建成功结果
     */
    public static DahuaProvisioningResultDTO success(String deviceMac, String deviceIp) {
        return DahuaProvisioningResultDTO.builder()
                .success(true)
                .message("设备激活成功")
                .deviceMac(deviceMac)
                .deviceIp(deviceIp)
                .provisionedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 创建失败结果
     */
    public static DahuaProvisioningResultDTO failure(String deviceMac, String errorMessage) {
        return DahuaProvisioningResultDTO.builder()
                .success(false)
                .message("设备激活失败")
                .deviceMac(deviceMac)
                .errorDetail(errorMessage)
                .provisionedAt(LocalDateTime.now())
                .build();
    }
}

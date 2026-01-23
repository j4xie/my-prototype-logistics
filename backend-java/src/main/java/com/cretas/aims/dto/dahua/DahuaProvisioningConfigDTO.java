package com.cretas.aims.dto.dahua;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

/**
 * 大华设备配网 DTO
 * 用于初始化未激活的设备
 *
 * @author Cretas Team
 * @since 2026-01-23
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "大华设备配网配置")
public class DahuaProvisioningConfigDTO {

    @NotBlank(message = "设备MAC地址不能为空")
    @Schema(description = "设备MAC地址", required = true, example = "AA:BB:CC:DD:EE:FF")
    private String deviceMac;

    @NotBlank(message = "设备密码不能为空")
    @Schema(description = "初始化密码", required = true)
    private String password;

    @Schema(description = "目标IP地址 (可选，不填则使用DHCP)")
    private String targetIpAddress;

    @Schema(description = "子网掩码")
    private String subnetMask;

    @Schema(description = "网关")
    private String gateway;

    @Schema(description = "是否启用DHCP")
    @Builder.Default
    private Boolean useDhcp = true;

    @Schema(description = "HTTP端口")
    @Builder.Default
    private Integer httpPort = 80;

    @Schema(description = "TCP端口")
    @Builder.Default
    private Integer tcpPort = 37777;
}

package com.cretas.aims.dto.dahua;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Pattern;

/**
 * 大华设备配置 DTO
 *
 * 用于首次配置设备的网络参数和管理员密码
 * 配置通过 UDP 37810 端口发送到设备
 *
 * @author Cretas Team
 * @since 2026-01-23
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProvisioningConfigDTO {

    /**
     * 目标设备 MAC 地址 (格式: AA:BB:CC:DD:EE:FF)
     * 用于识别要配置的设备
     */
    @NotBlank(message = "MAC地址不能为空")
    @Pattern(regexp = "^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$", message = "MAC地址格式错误")
    private String targetMac;

    /**
     * 新 IP 地址
     * 将分配给设备的静态 IP 地址
     */
    @NotBlank(message = "IP地址不能为空")
    @Pattern(regexp = "^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$",
            message = "IP地址格式错误")
    private String newIpAddress;

    /**
     * 子网掩码
     * 例如: 255.255.255.0
     */
    @NotBlank(message = "子网掩码不能为空")
    @Pattern(regexp = "^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$",
            message = "子网掩码格式错误")
    private String newSubnetMask;

    /**
     * 默认网关
     * 例如: 192.168.1.1
     */
    @NotBlank(message = "网关不能为空")
    @Pattern(regexp = "^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$",
            message = "网关格式错误")
    private String newGateway;

    /**
     * 管理员密码
     * 用于设备首次激活或修改密码
     * 建议使用强密码 (至少8位，包含数字、字母和特殊字符)
     */
    @NotBlank(message = "管理员密码不能为空")
    private String adminPassword;

    /**
     * 设备名称 (可选)
     * 用于标识设备，便于管理
     */
    private String deviceName;

    /**
     * 当前设备密码 (可选)
     * 修改已激活设备的密码时需要提供
     */
    private String currentPassword;

    /**
     * 是否为首次激活
     * true: 设备未激活，需要首次设置密码
     * false: 设备已激活，修改配置
     */
    @Builder.Default
    private Boolean firstTimeActivation = false;

    /**
     * 是否启用 DHCP
     * true: 使用 DHCP 自动获取 IP (此时忽略静态 IP 配置)
     * false: 使用静态 IP 配置
     */
    @Builder.Default
    private Boolean dhcpEnabled = false;
}

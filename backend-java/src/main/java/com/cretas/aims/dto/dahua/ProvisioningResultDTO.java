package com.cretas.aims.dto.dahua;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 大华设备配置结果 DTO
 *
 * 返回设备配置操作的结果信息
 *
 * @author Cretas Team
 * @since 2026-01-23
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProvisioningResultDTO {

    /**
     * 配置是否成功
     */
    private boolean success;

    /**
     * 结果消息
     * 成功时为操作描述，失败时为错误原因
     */
    private String message;

    /**
     * 设备 MAC 地址
     */
    private String deviceMac;

    /**
     * 配置后的新 IP 地址
     */
    private String newIpAddress;

    /**
     * HTTP 端口 (默认 80)
     */
    private Integer httpPort;

    /**
     * TCP 控制端口 (默认 37777)
     */
    private Integer tcpPort;

    /**
     * 配置完成时间
     */
    private LocalDateTime provisionedAt;

    /**
     * 设备序列号
     */
    private String serialNumber;

    /**
     * 设备型号
     */
    private String model;

    /**
     * 设备是否已激活
     */
    private Boolean activated;

    /**
     * 错误代码 (仅在失败时)
     */
    private String errorCode;

    /**
     * 配置前的旧 IP 地址
     */
    private String previousIpAddress;

    /**
     * 创建成功结果
     */
    public static ProvisioningResultDTO success(String deviceMac, String newIpAddress, String message) {
        return ProvisioningResultDTO.builder()
                .success(true)
                .deviceMac(deviceMac)
                .newIpAddress(newIpAddress)
                .message(message)
                .provisionedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 创建失败结果
     */
    public static ProvisioningResultDTO failure(String deviceMac, String message, String errorCode) {
        return ProvisioningResultDTO.builder()
                .success(false)
                .deviceMac(deviceMac)
                .message(message)
                .errorCode(errorCode)
                .provisionedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 创建失败结果 (无错误代码)
     */
    public static ProvisioningResultDTO failure(String message) {
        return ProvisioningResultDTO.builder()
                .success(false)
                .message(message)
                .provisionedAt(LocalDateTime.now())
                .build();
    }
}

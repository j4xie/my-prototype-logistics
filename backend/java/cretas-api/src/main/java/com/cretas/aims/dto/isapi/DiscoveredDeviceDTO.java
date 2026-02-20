package com.cretas.aims.dto.isapi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 发现的设备 DTO
 * 表示网络扫描发现的设备信息
 *
 * @author Cretas Team
 * @since 2026-01-08
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DiscoveredDeviceDTO {

    /**
     * IP 地址
     */
    private String ipAddress;

    /**
     * 端口
     */
    private int port;

    /**
     * 设备类型
     * IPC, NVR, DVR, ENCODER, UNKNOWN
     */
    private String deviceType;

    /**
     * 设备型号
     */
    private String deviceModel;

    /**
     * 序列号
     */
    private String serialNumber;

    /**
     * 设备名称
     */
    private String deviceName;

    /**
     * 制造商
     * HIKVISION, DAHUA, OTHER
     */
    private String manufacturer;

    /**
     * 固件版本
     */
    private String firmwareVersion;

    /**
     * MAC 地址
     */
    private String macAddress;

    /**
     * 是否支持 ISAPI
     */
    private boolean isapiSupported;

    /**
     * 是否支持 ONVIF
     */
    private boolean onvifSupported;

    /**
     * 是否需要认证
     */
    private boolean authRequired;

    /**
     * HTTP 响应状态码
     */
    private int httpStatus;

    /**
     * 探测耗时（毫秒）
     */
    private long probeTimeMs;
}

package com.cretas.aims.dto.dahua;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 大华设备发现 DTO
 *
 * 用于存储通过 DHDiscover 协议发现的设备信息
 * DHDiscover 使用 UDP 37810 端口进行设备发现
 *
 * @author Cretas Team
 * @since 2026-01-23
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DiscoveredDahuaDevice {

    /**
     * 设备 MAC 地址 (格式: AA:BB:CC:DD:EE:FF)
     * 用作设备唯一标识符
     */
    private String mac;

    /**
     * 设备 IP 地址
     */
    private String ipAddress;

    /**
     * 子网掩码
     */
    private String subnetMask;

    /**
     * 默认网关
     */
    private String gateway;

    /**
     * TCP 控制端口 (默认 37777)
     * 用于 SDK 连接和控制命令
     */
    private Integer port;

    /**
     * HTTP 端口 (默认 80)
     * 用于 Web 管理界面和 HTTP API
     */
    private Integer httpPort;

    /**
     * 设备类型
     * 常见值: IPC (网络摄像机), NVR (网络录像机), DVR (数字录像机)
     */
    private String deviceType;

    /**
     * 设备序列号
     */
    private String serialNumber;

    /**
     * 设备型号
     * 例如: DH-IPC-HFW2831T-ZS
     */
    private String model;

    /**
     * 设备厂商
     * 通常为 "Dahua" 或 "General"
     */
    private String vendor;

    /**
     * 固件版本
     */
    private String firmwareVersion;

    /**
     * 是否已激活
     * false 表示设备需要首次初始化设置管理员密码
     * true 表示设备已完成初始化
     */
    private Boolean activated;

    /**
     * 设备发现时间戳 (毫秒)
     */
    private Long discoveredAt;

    /**
     * 生成设备的唯一标识 (基于 MAC 地址)
     */
    public String getUniqueId() {
        if (mac == null) {
            return null;
        }
        return mac.replace(":", "").toLowerCase();
    }

    /**
     * 获取设备的 HTTP 基础 URL
     */
    public String getHttpBaseUrl() {
        if (ipAddress == null) {
            return null;
        }
        int effectivePort = httpPort != null ? httpPort : 80;
        if (effectivePort == 80) {
            return "http://" + ipAddress;
        }
        return "http://" + ipAddress + ":" + effectivePort;
    }

    /**
     * 获取设备的 TCP 连接地址
     */
    public String getTcpAddress() {
        if (ipAddress == null) {
            return null;
        }
        int effectivePort = port != null ? port : 37777;
        return ipAddress + ":" + effectivePort;
    }
}

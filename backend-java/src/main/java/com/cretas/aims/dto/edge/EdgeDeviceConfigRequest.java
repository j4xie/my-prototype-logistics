package com.cretas.aims.dto.edge;

import lombok.Data;

/**
 * 边缘设备配置请求
 * App 发起，用于配置摄像头的 HTTP 监听等设置
 */
@Data
public class EdgeDeviceConfigRequest {

    /**
     * 设备 IP 地址（局域网）
     */
    private String ipAddress;

    /**
     * 设备端口
     */
    private Integer port = 80;

    /**
     * 设备用户名
     */
    private String username;

    /**
     * 设备密码
     */
    private String password;

    /**
     * 设备名称（用户自定义）
     */
    private String deviceName;

    /**
     * 位置描述
     */
    private String locationDescription;

    /**
     * 是否启用移动侦测推送
     */
    private Boolean enableMotionDetection = true;

    /**
     * 是否启用越界检测推送
     */
    private Boolean enableLineCrossing = false;

    /**
     * 是否启用区域入侵推送
     */
    private Boolean enableIntrusion = false;
}

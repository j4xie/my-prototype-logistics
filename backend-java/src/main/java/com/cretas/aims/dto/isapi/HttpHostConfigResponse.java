package com.cretas.aims.dto.isapi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * HTTP 监听配置响应 DTO
 *
 * @author Cretas Team
 * @since 2026-01-08
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HttpHostConfigResponse {

    /**
     * 设备 ID
     */
    private String deviceId;

    /**
     * 设备名称
     */
    private String deviceName;

    /**
     * 配置是否成功
     */
    private Boolean success;

    /**
     * HTTP Host 配置是否成功
     */
    private Boolean httpHostConfigured;

    /**
     * 移动侦测配置是否成功
     */
    private Boolean motionDetectionEnabled;

    /**
     * 越界检测配置是否成功
     */
    private Boolean lineCrossingEnabled;

    /**
     * 区域入侵检测配置是否成功
     */
    private Boolean intrusionDetectionEnabled;

    /**
     * 配置的服务器地址
     */
    private String serverAddress;

    /**
     * 配置的回调路径
     */
    private String callbackPath;

    /**
     * 配置时间
     */
    private LocalDateTime configuredAt;

    /**
     * 错误信息列表
     */
    private List<String> errors;

    /**
     * 警告信息列表
     */
    private List<String> warnings;
}

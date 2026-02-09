package com.cretas.aims.dto.isapi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * HTTP 监听配置请求 DTO
 * 用于配置摄像头向云端服务器推送事件
 *
 * @author Cretas Team
 * @since 2026-01-08
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HttpHostConfigRequest {

    /**
     * 是否启用移动侦测推送
     */
    @Builder.Default
    private Boolean enableMotionDetection = true;

    /**
     * 是否启用越界检测推送
     */
    @Builder.Default
    private Boolean enableLineCrossing = false;

    /**
     * 是否启用区域入侵检测推送
     */
    @Builder.Default
    private Boolean enableIntrusionDetection = false;

    /**
     * 自定义服务器 IP（可选，默认使用云端服务器）
     */
    private String customServerIp;

    /**
     * 自定义服务器端口（可选，默认使用 10010）
     */
    private Integer customServerPort;

    /**
     * 自定义回调路径（可选，默认使用 /api/mobile/edge/events）
     */
    private String customCallbackPath;
}

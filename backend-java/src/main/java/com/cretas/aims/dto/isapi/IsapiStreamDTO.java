package com.cretas.aims.dto.isapi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * ISAPI 流媒体信息 DTO
 *
 * @author Cretas Team
 * @since 2026-01-05
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IsapiStreamDTO {

    private String deviceId;
    private String deviceName;
    private Integer channelId;
    private String channelName;

    // ==================== RTSP 流地址 ====================

    /**
     * 主码流 RTSP URL
     * 格式: rtsp://username:password@ip:port/Streaming/Channels/101
     */
    private String mainStreamUrl;

    /**
     * 子码流 RTSP URL
     * 格式: rtsp://username:password@ip:port/Streaming/Channels/102
     */
    private String subStreamUrl;

    /**
     * 第三码流 RTSP URL (如果支持)
     */
    private String thirdStreamUrl;

    // ==================== 流参数 ====================

    /**
     * 视频编码 (H.264/H.265)
     */
    private String videoCodec;

    /**
     * 分辨率宽度
     */
    private Integer width;

    /**
     * 分辨率高度
     */
    private Integer height;

    /**
     * 帧率
     */
    private Integer frameRate;

    /**
     * 码率 (kbps)
     */
    private Integer bitrate;

    // ==================== 状态 ====================

    /**
     * 流是否可用
     */
    private Boolean available;

    /**
     * 错误信息
     */
    private String error;
}

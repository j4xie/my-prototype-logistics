package com.cretas.aims.dto.isapi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * ISAPI 抓拍结果 DTO
 *
 * @author Cretas Team
 * @since 2026-01-05
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IsapiCaptureDTO {

    private String deviceId;
    private String deviceName;
    private Integer channelId;
    private String channelName;

    // ==================== 图片信息 ====================

    /**
     * 图片 URL (如果保存到 OSS)
     */
    private String pictureUrl;

    /**
     * 图片 Base64 编码
     */
    private String pictureBase64;

    /**
     * 图片格式 (JPEG)
     */
    private String format;

    /**
     * 图片大小 (字节)
     */
    private Long size;

    /**
     * 图片宽度
     */
    private Integer width;

    /**
     * 图片高度
     */
    private Integer height;

    // ==================== 时间戳 ====================

    /**
     * 抓拍时间
     */
    private LocalDateTime captureTime;

    // ==================== 状态 ====================

    private Boolean success;
    private String error;
}

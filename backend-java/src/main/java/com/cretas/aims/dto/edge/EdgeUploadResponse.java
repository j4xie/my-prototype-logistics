package com.cretas.aims.dto.edge;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 边缘网关上传响应 DTO
 */
@Data
@Builder
public class EdgeUploadResponse {

    /**
     * 上传是否成功
     */
    private boolean success;

    /**
     * 消息
     */
    private String message;

    /**
     * 服务端接收时间
     */
    private LocalDateTime receivedAt;

    /**
     * 生成的事件ID（如果是告警事件）
     */
    private String eventId;

    /**
     * 图片存储URL（如果是抓拍）
     */
    private String pictureUrl;

    /**
     * AI分析任务ID（如果触发了AI分析）
     */
    private String analysisTaskId;

    /**
     * 下一次上传建议间隔（秒）
     */
    private Integer nextUploadInterval;

    public static EdgeUploadResponse ok(String message) {
        return EdgeUploadResponse.builder()
                .success(true)
                .message(message)
                .receivedAt(LocalDateTime.now())
                .build();
    }

    public static EdgeUploadResponse error(String message) {
        return EdgeUploadResponse.builder()
                .success(false)
                .message(message)
                .receivedAt(LocalDateTime.now())
                .build();
    }
}

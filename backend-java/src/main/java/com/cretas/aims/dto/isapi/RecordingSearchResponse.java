package com.cretas.aims.dto.isapi;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * NVR 录像检索响应 DTO (Phase 3)
 *
 * @author Cretas Team
 * @since 2026-01-30
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecordingSearchResponse {

    /**
     * 搜索是否成功
     */
    private boolean success;

    /**
     * 状态信息
     */
    private String message;

    /**
     * 设备ID
     */
    private String deviceId;

    /**
     * 搜索的时间范围
     */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime searchStartTime;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime searchEndTime;

    /**
     * 总记录数
     */
    private int totalMatches;

    /**
     * 返回的记录数
     */
    private int numOfMatches;

    /**
     * 是否有更多记录
     */
    private boolean moreRecords;

    /**
     * 录像列表
     */
    private List<RecordingItem> recordings;

    /**
     * 单条录像记录
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecordingItem {

        /**
         * 录像唯一标识
         */
        private String recordingId;

        /**
         * 通道ID
         */
        private int channelId;

        /**
         * 通道名称
         */
        private String channelName;

        /**
         * 录像开始时间
         */
        @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
        private LocalDateTime startTime;

        /**
         * 录像结束时间
         */
        @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
        private LocalDateTime endTime;

        /**
         * 录像时长（秒）
         */
        private long durationSeconds;

        /**
         * 录像类型
         */
        private String recordType;

        /**
         * 文件大小（字节）
         */
        private long fileSize;

        /**
         * 文件大小（人类可读）
         */
        private String fileSizeFormatted;

        /**
         * RTSP 回放地址
         */
        private String playbackUrl;

        /**
         * 元数据 URI
         */
        private String metadataUri;

        /**
         * 码流类型
         */
        private String streamType;

        /**
         * 视频编码
         */
        private String videoCodec;

        /**
         * 分辨率
         */
        private String resolution;
    }
}

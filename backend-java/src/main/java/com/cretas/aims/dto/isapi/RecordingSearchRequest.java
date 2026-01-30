package com.cretas.aims.dto.isapi;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotNull;
import java.time.LocalDateTime;
import java.util.List;

/**
 * NVR 录像检索请求 DTO (Phase 3)
 *
 * @author Cretas Team
 * @since 2026-01-30
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecordingSearchRequest {

    /**
     * 设备ID（NVR 或 IPC）
     */
    @NotNull(message = "设备ID不能为空")
    private String deviceId;

    /**
     * 通道ID列表（为空则搜索所有通道）
     */
    private List<Integer> channelIds;

    /**
     * 开始时间
     */
    @NotNull(message = "开始时间不能为空")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime startTime;

    /**
     * 结束时间
     */
    @NotNull(message = "结束时间不能为空")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime endTime;

    /**
     * 录像类型（可选）
     * - CMR: 连续录像
     * - ALARM: 报警录像
     * - MANUAL: 手动录像
     * - ALL: 所有类型
     */
    @Builder.Default
    private String recordType = "ALL";

    /**
     * 最大返回数量
     */
    @Builder.Default
    private Integer maxResults = 100;

    /**
     * 搜索偏移量（分页）
     */
    @Builder.Default
    private Integer searchOffset = 0;
}

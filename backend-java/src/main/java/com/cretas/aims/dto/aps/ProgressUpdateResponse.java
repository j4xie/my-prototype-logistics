package com.cretas.aims.dto.aps;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

/**
 * 进度更新响应 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProgressUpdateResponse {

    /**
     * 任务ID
     */
    private String taskId;

    /**
     * 更新前的进度百分比
     */
    private double previousProgress;

    /**
     * 当前进度百分比
     */
    private double currentProgress;

    /**
     * 完成概率 [0, 1]
     */
    private double completionProbability;

    /**
     * 风险等级: low/medium/high/critical
     */
    private String riskLevel;

    /**
     * 是否需要关注 (概率低于阈值)
     */
    private boolean needsAttention;

    /**
     * 预计完成时间
     */
    private LocalDateTime estimatedEndTime;

    /**
     * 预计延迟分钟数
     */
    private int estimatedDelayMinutes;

    /**
     * 消息
     */
    private String message;
}

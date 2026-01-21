package com.cretas.aims.dto.aps;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 效率历史记录 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EfficiencyHistoryDTO {

    /**
     * 记录ID
     */
    private String id;

    /**
     * 产线ID
     */
    private String lineId;

    /**
     * 产线名称
     */
    private String lineName;

    /**
     * 任务ID
     */
    private String taskId;

    /**
     * 记录时间
     */
    private LocalDateTime recordedAt;

    /**
     * 实际产出
     */
    private BigDecimal actualOutput;

    /**
     * 期望产出
     */
    private BigDecimal expectedOutput;

    /**
     * 效率比率 (实际/期望)
     */
    private BigDecimal efficiencyRatio;

    /**
     * 工人数量
     */
    private Integer workerCount;

    /**
     * 滚动效率因子 (EWMA计算)
     */
    private BigDecimal rollingEfficiency;
}

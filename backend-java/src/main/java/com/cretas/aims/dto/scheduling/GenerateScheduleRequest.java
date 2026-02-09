package com.cretas.aims.dto.scheduling;

import lombok.Data;

import javax.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;

/**
 * AI 生成调度请求
 */
@Data
public class GenerateScheduleRequest {
    @NotNull(message = "计划日期不能为空")
    private LocalDate planDate;

    // 可选：指定批次ID列表，如不指定则自动选择待生产批次
    private List<Long> batchIds;

    // 可选：优先级策略 - deadline(按截止日期), efficiency(按效率), balanced(平衡)
    private String priorityStrategy = "balanced";

    // 可选：是否考虑临时工
    private Boolean includeTemporaryWorkers = true;

    // 可选：目标完成概率阈值 (0-1)
    private Double targetProbability = 0.8;
}

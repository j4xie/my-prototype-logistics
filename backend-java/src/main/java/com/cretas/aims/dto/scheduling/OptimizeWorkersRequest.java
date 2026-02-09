package com.cretas.aims.dto.scheduling;

import lombok.Data;

import javax.validation.constraints.NotNull;
import java.util.List;

/**
 * 优化人员分配请求 (OR-Tools)
 */
@Data
public class OptimizeWorkersRequest {
    @NotNull(message = "计划ID不能为空")
    private String planId;

    // 可选：可用工人ID列表，如不指定则使用所有可用工人
    private List<Long> availableWorkerIds;

    // 可选：优化目标 - cost(最低成本), efficiency(最高效率), balanced(平衡)
    private String optimizationGoal = "balanced";

    // 可选：是否允许临时工
    private Boolean allowTemporaryWorkers = true;

    // 可选：最大求解时间(秒)
    private Integer maxSolveTimeSeconds = 30;
}

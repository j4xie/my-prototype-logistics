package com.cretas.aims.dto.scheduling;

import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * AI 工人推荐请求
 * 基于 LinUCB 算法推荐最优工人分配
 */
@Data
public class WorkerRecommendRequest {

    // 排程ID（可选，用于日志记录）
    private String scheduleId;

    // 任务特征
    // quantity: 任务量
    // deadlineHours: 截止时间（小时）
    // productType: 产品类型
    // priority: 优先级
    // complexity: 复杂度
    // workshopId: 车间ID
    private Map<String, Object> taskFeatures;

    // 候选工人ID列表
    private List<Long> candidateWorkerIds;

    // 需要的技能列表（可选）
    private List<String> requiredSkills;
}

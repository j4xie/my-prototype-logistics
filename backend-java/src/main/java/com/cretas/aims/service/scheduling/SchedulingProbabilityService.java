package com.cretas.aims.service.scheduling;

import com.cretas.aims.dto.scheduling.CompletionProbabilityResponse;
import com.cretas.aims.entity.ProductionPlan;
import java.math.BigDecimal;
import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * 调度概率预测服务接口
 *
 * 负责概率预测和风险评估，包括：
 * - 计划完成概率计算
 * - 排程完成概率计算
 * - 批次概率计算
 *
 * @author Cretas Team
 * @version 1.0.0
 */
public interface SchedulingProbabilityService {

    /**
     * 计算计划完成概率
     */
    CompletableFuture<BigDecimal> calculatePlanProbability(ProductionPlan plan);

    /**
     * 计算排程完成概率
     */
    CompletionProbabilityResponse calculateCompletionProbability(String factoryId, String scheduleId);

    /**
     * 批量计算概率
     */
    List<CompletionProbabilityResponse> calculateBatchProbabilities(String factoryId, String planId);
}

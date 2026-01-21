package com.cretas.aims.service.aps;

import com.cretas.aims.dto.aps.WeightAdjustmentResult;

import java.time.LocalDate;
import java.util.Map;

/**
 * APS 策略权重自适应调整服务
 *
 * 核心功能:
 * 1. 评估各排产策略的实际效果
 * 2. 根据效果自动调整策略权重
 * 3. 记录权重调整历史用于分析
 *
 * 策略维度:
 * - earliest_deadline: 最早交期优先 (准时完成率, 目标 > 85%)
 * - min_changeover: 最小换型时间 (换型时间占比, 目标 < 15%)
 * - capacity_match: 产能匹配 (负载均衡度CV, 目标 < 0.3)
 * - shortest_process: 最短工序优先 (吞吐量比率, 目标 >= 1.0)
 * - material_ready: 物料齐套优先 (物料等待占比, 目标 < 10%)
 * - urgency_first: 紧急订单优先 (紧急订单准时率, 目标 > 95%)
 *
 * 权重调整算法:
 * new_weight = old_weight + learning_rate × (score - 0.5)
 * 归一化确保 Σ weights = 1.0
 *
 * @author Cretas APS Team
 * @since 2026-01-21
 */
public interface StrategyWeightAdaptationService {

    // ==================== 常量定义 ====================

    /** 学习率 - 每次调整的幅度 */
    double LEARNING_RATE = 0.05;

    /** 最小权重 - 防止某策略权重过低 */
    double MIN_WEIGHT = 0.05;

    /** 最大权重 - 防止某策略权重过高 */
    double MAX_WEIGHT = 0.40;

    /** 默认评估周期天数 */
    int DEFAULT_EVALUATION_DAYS = 7;

    // ==================== 策略效果评估 ====================

    /**
     * 评估各策略的效果并返回得分
     *
     * 评估维度和目标:
     * - earliest_deadline: 准时完成率 (目标 > 85%)
     * - min_changeover: 换型时间占总时间比 (目标 < 15%)
     * - capacity_match: 产线负载均衡度CV (目标 < 0.3)
     * - shortest_process: 日吞吐量比率 (目标 >= 1.0)
     * - material_ready: 物料等待时间占比 (目标 < 10%)
     * - urgency_first: 紧急订单准时率 (目标 > 95%)
     *
     * @param factoryId 工厂ID
     * @param startDate 评估开始日期
     * @param endDate   评估结束日期
     * @return 策略名称 -> 效果得分 (0.0 - 1.0, 0.5为基准)
     */
    Map<String, Double> evaluateStrategyEffectiveness(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 使用默认评估周期评估策略效果
     *
     * @param factoryId 工厂ID
     * @return 策略名称 -> 效果得分
     */
    default Map<String, Double> evaluateStrategyEffectiveness(String factoryId) {
        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusDays(DEFAULT_EVALUATION_DAYS);
        return evaluateStrategyEffectiveness(factoryId, startDate, endDate);
    }

    // ==================== 权重调整 ====================

    /**
     * 自动调整策略权重
     *
     * 调整流程:
     * 1. 获取当前权重配置
     * 2. 评估策略效果
     * 3. 计算调整量 (learning_rate × (score - 0.5))
     * 4. 应用调整并归一化
     * 5. 保存新权重和历史记录
     *
     * @param factoryId 工厂ID
     * @return 调整结果
     */
    WeightAdjustmentResult adjustWeights(String factoryId);

    /**
     * 使用指定评估周期调整权重
     *
     * @param factoryId 工厂ID
     * @param startDate 评估开始日期
     * @param endDate   评估结束日期
     * @return 调整结果
     */
    WeightAdjustmentResult adjustWeights(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 模拟权重调整 (不实际保存)
     *
     * @param factoryId 工厂ID
     * @return 模拟的调整结果
     */
    WeightAdjustmentResult simulateWeightAdjustment(String factoryId);

    // ==================== 权重历史查询 ====================

    /**
     * 获取权重调整历史
     *
     * @param factoryId 工厂ID
     * @param days      最近N天
     * @return 调整历史列表
     */
    java.util.List<WeightAdjustmentResult> getAdjustmentHistory(String factoryId, int days);

    /**
     * 获取当前策略权重
     *
     * @param factoryId 工厂ID
     * @return 策略名称 -> 权重值
     */
    Map<String, Double> getCurrentWeights(String factoryId);

    // ==================== 手动调整 ====================

    /**
     * 手动设置策略权重
     *
     * @param factoryId 工厂ID
     * @param weights   新权重 (会自动归一化)
     * @param reason    调整原因
     * @return 调整结果
     */
    WeightAdjustmentResult setWeights(String factoryId, Map<String, Double> weights, String reason);

    /**
     * 重置为默认权重
     *
     * @param factoryId 工厂ID
     * @return 调整结果
     */
    WeightAdjustmentResult resetToDefaultWeights(String factoryId);
}

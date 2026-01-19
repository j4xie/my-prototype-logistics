package com.cretas.aims.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 调度策略干预服务接口
 * 基于抖音推荐系统"商业与生态博弈"设计
 *
 * 核心公式:
 * FinalScore = LinUCB_Score
 *            + 0.15 × 新人需培训
 *            - 0.10 × 近3天该工序做过
 *            - 0.20 × 疲劳指数
 *            + 0.30 × 紧急任务且技能匹配
 */
public interface DispatcherStrategyService {

    /**
     * 计算工人的策略干预分数
     *
     * @param factoryId 工厂ID
     * @param workerId 工人ID
     * @param taskInfo 任务信息
     * @return 策略干预加分 (可为负数)
     */
    BigDecimal calculateStrategyBoost(String factoryId, Long workerId, Map<String, Object> taskInfo);

    /**
     * 批量计算策略干预分数
     *
     * @param factoryId 工厂ID
     * @param workerIds 工人ID列表
     * @param taskInfo 任务信息
     * @return 工人ID -> 策略加分 映射
     */
    Map<Long, BigDecimal> calculateStrategyBoosts(String factoryId, List<Long> workerIds, Map<String, Object> taskInfo);

    /**
     * 应用策略干预重排序
     *
     * @param recommendations 原始推荐列表 (按LinUCB分数排序)
     * @param taskInfo 任务信息
     * @return 重排序后的推荐列表
     */
    List<LinUCBService.WorkerRecommendation> applyStrategyReranking(
            List<LinUCBService.WorkerRecommendation> recommendations,
            String factoryId,
            Map<String, Object> taskInfo);

    /**
     * 获取策略干预详情 (用于调试和解释)
     *
     * @param factoryId 工厂ID
     * @param workerId 工人ID
     * @param taskInfo 任务信息
     * @return 各项策略的加分详情
     */
    Map<String, BigDecimal> getStrategyBreakdown(String factoryId, Long workerId, Map<String, Object> taskInfo);

    // ==================== 单项策略计算 ====================

    /**
     * 计算新人培训加分
     * 给新员工学习机会
     */
    BigDecimal calculateNewWorkerBoost(String factoryId, Long workerId, Map<String, Object> taskInfo);

    /**
     * 计算重复工序降权
     * 避免同一工人总做同一工序
     */
    BigDecimal calculateRepetitionPenalty(String factoryId, Long workerId, Map<String, Object> taskInfo);

    /**
     * 计算疲劳降权
     * 连续工作多天或今日工时过长的工人降权
     */
    BigDecimal calculateFatiguePenalty(String factoryId, Long workerId);

    /**
     * 计算紧急任务加分
     * 紧急任务优先匹配高技能工人
     */
    BigDecimal calculateUrgentTaskBoost(String factoryId, Long workerId, Map<String, Object> taskInfo);

    /**
     * 计算技能培养加分
     * 给工人分配不熟悉但可学习的任务
     */
    BigDecimal calculateSkillDevelopmentBoost(String factoryId, Long workerId, Map<String, Object> taskInfo);

    /**
     * 计算工作量均衡调整
     * 避免工作量集中在少数高绩效工人
     */
    BigDecimal calculateWorkloadBalance(String factoryId, Long workerId);

    // ==================== 辅助查询 ====================

    /**
     * 获取工人入职天数
     */
    int getWorkerTenureDays(String factoryId, Long workerId);

    /**
     * 获取工人技能等级
     */
    int getWorkerSkillLevel(String factoryId, Long workerId);

    /**
     * 获取工人今日工时
     */
    double getWorkerTodayHours(String factoryId, Long workerId);

    /**
     * 获取工人连续工作天数
     */
    int getWorkerConsecutiveWorkDays(String factoryId, Long workerId);

    /**
     * 获取工人近期某工序的执行次数
     *
     * @param factoryId 工厂ID
     * @param workerId 工人ID
     * @param processType 工序类型
     * @param days 查询天数
     * @return 执行次数
     */
    int getRecentProcessCount(String factoryId, Long workerId, String processType, int days);

    /**
     * 获取工人本周任务数
     */
    int getWeeklyTaskCount(String factoryId, Long workerId);
}

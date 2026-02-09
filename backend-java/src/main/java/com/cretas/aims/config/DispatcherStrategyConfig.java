package com.cretas.aims.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * 调度策略干预配置
 * 基于抖音推荐系统"商业与生态博弈"设计
 *
 * 基础调度公式:
 * FinalScore = LinUCB_Score
 *            + 0.15 × 新人需培训
 *            - 0.10 × 近3天该工序做过
 *            - 0.20 × 疲劳指数
 *            + 0.30 × 紧急任务且技能匹配
 *
 * 分层多样性调整公式 (diversityEnabled=true 时启用):
 * FinalScore = linucbWeight × LinUCB_Score
 *            + fairnessWeight × FairnessBonus
 *            + skillMaintenanceWeight × SkillMaintenanceBonus
 *            - repetitionWeight × RepetitionPenalty
 *
 * application.yml 配置示例:
 * <pre>
 * cretas:
 *   dispatcher:
 *     strategy:
 *       enabled: true
 *       diversity-enabled: true
 *       linucb-weight: 0.60
 *       fairness-weight: 0.15
 *       skill-maintenance-weight: 0.15
 *       repetition-weight: 0.10
 *       skill-decay-days: 30
 *       fairness-period-days: 14
 * </pre>
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "cretas.dispatcher.strategy")
public class DispatcherStrategyConfig {

    /**
     * 是否启用策略干预
     */
    private boolean enabled = true;

    // ==================== 新人培训策略 ====================

    /**
     * 新人培训加权
     * 给新员工学习机会，让他们接触不同工序
     */
    private double newWorkerWeight = 0.15;

    /**
     * 新人判定天数 (入职多少天内算新人)
     */
    private int newWorkerDays = 30;

    /**
     * 新人最低技能等级阈值 (技能等级低于此值时加权)
     */
    private int newWorkerSkillThreshold = 2;

    // ==================== 公平轮换策略 ====================

    /**
     * 近期重复工序降权
     * 避免同一工人总做同一工序
     */
    private double repetitionPenalty = -0.10;

    /**
     * 重复判定天数 (多少天内做过该工序算重复)
     */
    private int repetitionDays = 3;

    /**
     * 最大同工序连续天数 (超过此天数强制降权)
     */
    private int maxConsecutiveDays = 5;

    /**
     * 连续超限严重降权
     */
    private double severePenalty = -0.25;

    // ==================== 疲劳控制策略 ====================

    /**
     * 疲劳降权系数
     * 连续工作多天的工人降权
     */
    private double fatigueWeight = -0.20;

    /**
     * 疲劳判定工时阈值 (今日工作超过此小时数触发)
     */
    private double fatigueHoursThreshold = 8.0;

    /**
     * 严重疲劳工时阈值 (超过此小时数严重降权)
     */
    private double severeFatigueHoursThreshold = 10.0;

    /**
     * 严重疲劳降权
     */
    private double severeFatigueWeight = -0.35;

    /**
     * 连续工作天数阈值 (连续工作超过此天数触发疲劳)
     */
    private int consecutiveWorkDaysThreshold = 5;

    // ==================== 紧急任务策略 ====================

    /**
     * 紧急任务技能匹配加权
     * 紧急任务优先匹配高技能工人
     */
    private double urgentTaskWeight = 0.30;

    /**
     * 紧急任务优先级阈值 (优先级高于此值视为紧急)
     */
    private int urgentPriorityThreshold = 8;

    /**
     * 紧急任务技能匹配阈值 (技能等级高于此值才加分)
     */
    private int urgentSkillThreshold = 3;

    // ==================== 技能培养策略 ====================

    /**
     * 技能培养加权
     * 给工人分配一些不熟悉但可学习的任务
     */
    private double skillDevelopmentWeight = 0.08;

    /**
     * 技能培养概率 (多大概率给工人分配不熟悉的任务)
     */
    private double skillDevelopmentProbability = 0.15;

    // ==================== 工作量均衡策略 ====================

    /**
     * 工作量均衡权重
     * 避免工作量集中在少数高绩效工人
     */
    private double workloadBalanceWeight = 0.10;

    /**
     * 高工作量阈值 (本周任务数超过此值触发)
     */
    private int highWorkloadThreshold = 10;

    /**
     * 高工作量降权
     */
    private double highWorkloadPenalty = -0.08;

    // ==================== 多样性控制策略 ====================

    /**
     * 任务多样性系数
     * 避免同一工人只做某一类任务
     */
    private double diversityLambda = 0.7;

    /**
     * 同产品类型相似度
     */
    private double sameProductTypeSimilarity = 0.4;

    /**
     * 同工序相似度
     */
    private double sameProcessSimilarity = 0.5;

    /**
     * 相近复杂度相似度
     */
    private double similarComplexitySimilarity = 0.2;

    // ==================== 分层多样性策略配置 ====================

    /**
     * 是否启用多样性调整 (默认 true)
     * 启用后使用分层多样性调整公式计算最终分数
     */
    private boolean diversityEnabled = true;

    /**
     * LinUCB 分数权重 (默认 0.6)
     * 多样性调整公式中 LinUCB 原始分数的权重
     */
    private double linucbWeight = 0.60;

    /**
     * 公平性加分权重 (默认 0.15)
     * 给近期分配较少的工人加分，促进工作机会均等
     */
    private double fairnessWeight = 0.15;

    /**
     * 技能维护加分权重 (默认 0.15)
     * 给长期未执行某工序的工人加分，防止技能遗忘
     */
    private double skillMaintenanceWeight = 0.15;

    /**
     * 重复惩罚权重 (默认 0.1)
     * 近期做过相同工序的工人扣分，促进工序轮换
     */
    private double repetitionWeight = 0.10;

    /**
     * 技能遗忘判定天数 (默认 30)
     * 超过此天数未执行的工序视为需要维护，给予加分机会
     */
    private int skillDecayDays = 30;

    /**
     * 公平性计算周期天数 (默认 14)
     * 计算工人近N天的分配数进行公平性比较
     */
    private int fairnessPeriodDays = 14;

    /**
     * 公平性基准分配数 (默认 -1 表示自动计算)
     * 设为正数时使用固定值，设为-1时使用团队平均值
     */
    private int fairnessBaselineAllocation = -1;

    /**
     * 技能维护最大加分 (默认 0.3)
     * 防止技能维护加分过高导致分配不合理
     */
    private double skillMaintenanceMaxBonus = 0.30;

    /**
     * 重复惩罚最大值 (默认 0.5)
     * 防止重复惩罚过高导致高技能工人永远无法匹配
     */
    private double repetitionMaxPenalty = 0.50;
}

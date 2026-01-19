package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * 激励方案 DTO
 *
 * 用于表示 SmartBI 系统生成的激励方案，包括：
 * - 目标对象信息
 * - 当前业绩和目标
 * - 阶梯奖励等级
 * - 激励消息
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IncentivePlan {

    /**
     * 方案ID
     */
    @Builder.Default
    private String id = UUID.randomUUID().toString();

    /**
     * 目标类型
     * salesperson: 销售员, department: 部门, region: 区域
     */
    private String targetType;

    /**
     * 目标对象ID
     */
    private String targetId;

    /**
     * 目标对象名称
     */
    private String targetName;

    /**
     * 当前业绩
     */
    private BigDecimal currentPerformance;

    /**
     * 目标值
     */
    private BigDecimal targetGoal;

    /**
     * 差距金额
     * 目标 - 当前业绩
     */
    private BigDecimal gapAmount;

    /**
     * 完成率（百分比）
     */
    private BigDecimal completionRate;

    /**
     * 阶梯奖励等级列表
     */
    @Builder.Default
    private List<IncentiveLevel> levels = new ArrayList<>();

    /**
     * 当前等级名称
     */
    private String currentLevelName;

    /**
     * 下一等级名称
     */
    private String nextLevelName;

    /**
     * 距离下一等级的差距
     */
    private BigDecimal gapToNextLevel;

    /**
     * 激励消息
     * 个性化的激励文案
     */
    private String motivationalMessage;

    /**
     * 预计奖励金额
     * 按当前业绩可获得的奖励
     */
    private BigDecimal estimatedReward;

    /**
     * 潜在奖励金额
     * 达到下一等级可获得的额外奖励
     */
    private BigDecimal potentialReward;

    /**
     * 创建时间
     */
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    /**
     * 添加激励等级
     *
     * @param level 激励等级
     * @return 当前对象（支持链式调用）
     */
    public IncentivePlan addLevel(IncentiveLevel level) {
        if (this.levels == null) {
            this.levels = new ArrayList<>();
        }
        this.levels.add(level);
        return this;
    }

    /**
     * 计算完成率
     */
    public void calculateCompletionRate() {
        if (targetGoal != null && targetGoal.compareTo(BigDecimal.ZERO) > 0 && currentPerformance != null) {
            this.completionRate = currentPerformance.divide(targetGoal, 4, RoundingMode.HALF_UP)
                    .multiply(new BigDecimal("100"));
        } else {
            this.completionRate = BigDecimal.ZERO;
        }
    }

    /**
     * 计算差距金额
     */
    public void calculateGapAmount() {
        if (targetGoal != null && currentPerformance != null) {
            this.gapAmount = targetGoal.subtract(currentPerformance);
        } else {
            this.gapAmount = BigDecimal.ZERO;
        }
    }

    /**
     * 更新当前等级信息
     * 根据当前业绩确定所在等级和下一目标等级
     */
    public void updateCurrentLevel() {
        if (levels == null || levels.isEmpty() || completionRate == null) {
            return;
        }

        IncentiveLevel current = null;
        IncentiveLevel next = null;

        for (int i = 0; i < levels.size(); i++) {
            IncentiveLevel level = levels.get(i);
            if (level.isInRange(completionRate)) {
                current = level;
                level.setCurrent(true);
                level.setAchieved(true);
                if (i + 1 < levels.size()) {
                    next = levels.get(i + 1);
                }
                break;
            } else if (completionRate.compareTo(level.getTargetFrom()) < 0) {
                // 还未达到此等级
                next = level;
                break;
            } else {
                // 已超过此等级
                level.setAchieved(true);
            }
        }

        if (current != null) {
            this.currentLevelName = current.getLevelName();
            this.estimatedReward = current.getRewardAmount();
        }

        if (next != null) {
            this.nextLevelName = next.getLevelName();
            this.gapToNextLevel = next.getTargetFrom().subtract(completionRate);
            this.potentialReward = next.getRewardAmount();
        }
    }

    /**
     * 生成激励消息
     */
    public void generateMotivationalMessage() {
        if (completionRate == null) {
            this.motivationalMessage = "继续努力，您一定可以的！";
            return;
        }

        BigDecimal rate = completionRate;
        if (rate.compareTo(new BigDecimal("100")) >= 0) {
            this.motivationalMessage = String.format(
                    "太棒了！%s 已完成目标 %.1f%%！继续保持这种势头！",
                    targetName, rate
            );
        } else if (rate.compareTo(new BigDecimal("80")) >= 0) {
            this.motivationalMessage = String.format(
                    "距离目标只差 %.0f 元，%s 加把劲就能达成！",
                    gapAmount, targetName
            );
        } else if (rate.compareTo(new BigDecimal("60")) >= 0) {
            this.motivationalMessage = String.format(
                    "%s 已完成 %.1f%%，继续努力，下一个等级的奖励在等着你！",
                    targetName, rate
            );
        } else {
            this.motivationalMessage = String.format(
                    "%s 当前完成率 %.1f%%，需要加速冲刺！每一笔订单都是向目标迈进！",
                    targetName, rate
            );
        }
    }

    /**
     * 快速创建销售员激励方案
     */
    public static IncentivePlan forSalesperson(String salespersonId, String salespersonName,
                                                BigDecimal currentPerformance, BigDecimal targetGoal) {
        IncentivePlan plan = IncentivePlan.builder()
                .targetType("salesperson")
                .targetId(salespersonId)
                .targetName(salespersonName)
                .currentPerformance(currentPerformance)
                .targetGoal(targetGoal)
                .build();
        plan.calculateCompletionRate();
        plan.calculateGapAmount();
        return plan;
    }

    /**
     * 快速创建部门激励方案
     */
    public static IncentivePlan forDepartment(String departmentId, String departmentName,
                                               BigDecimal currentPerformance, BigDecimal targetGoal) {
        IncentivePlan plan = IncentivePlan.builder()
                .targetType("department")
                .targetId(departmentId)
                .targetName(departmentName)
                .currentPerformance(currentPerformance)
                .targetGoal(targetGoal)
                .build();
        plan.calculateCompletionRate();
        plan.calculateGapAmount();
        return plan;
    }

    /**
     * 快速创建区域激励方案
     */
    public static IncentivePlan forRegion(String regionId, String regionName,
                                           BigDecimal currentPerformance, BigDecimal targetGoal) {
        IncentivePlan plan = IncentivePlan.builder()
                .targetType("region")
                .targetId(regionId)
                .targetName(regionName)
                .currentPerformance(currentPerformance)
                .targetGoal(targetGoal)
                .build();
        plan.calculateCompletionRate();
        plan.calculateGapAmount();
        return plan;
    }
}

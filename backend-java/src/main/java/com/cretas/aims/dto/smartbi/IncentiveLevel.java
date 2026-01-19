package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 激励等级 DTO
 *
 * 用于表示阶梯激励方案中的单个等级，包括：
 * - 等级名称和描述
 * - 目标区间和奖励金额
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IncentiveLevel {

    /**
     * 等级名称
     * 如：铜牌、银牌、金牌、钻石
     */
    private String levelName;

    /**
     * 等级描述
     */
    private String description;

    /**
     * 目标下限（完成率或金额）
     */
    private BigDecimal targetFrom;

    /**
     * 目标上限（完成率或金额）
     */
    private BigDecimal targetTo;

    /**
     * 奖励金额
     */
    private BigDecimal rewardAmount;

    /**
     * 奖励比例（百分比）
     * 如：超额部分按 5% 提成
     */
    private BigDecimal rewardRate;

    /**
     * 是否为当前适用等级
     */
    @Builder.Default
    private boolean current = false;

    /**
     * 是否已达成
     */
    @Builder.Default
    private boolean achieved = false;

    /**
     * 距离达成的差距
     */
    private BigDecimal gap;

    /**
     * 快速创建基于完成率的激励等级
     */
    public static IncentiveLevel ofCompletionRate(String levelName, BigDecimal from, BigDecimal to,
                                                   BigDecimal rewardAmount) {
        return IncentiveLevel.builder()
                .levelName(levelName)
                .targetFrom(from)
                .targetTo(to)
                .rewardAmount(rewardAmount)
                .description(String.format("完成率达到 %.0f%%-%.0f%%", from, to))
                .build();
    }

    /**
     * 快速创建基于销售额的激励等级
     */
    public static IncentiveLevel ofSalesAmount(String levelName, BigDecimal from, BigDecimal to,
                                                BigDecimal rewardAmount, BigDecimal rewardRate) {
        return IncentiveLevel.builder()
                .levelName(levelName)
                .targetFrom(from)
                .targetTo(to)
                .rewardAmount(rewardAmount)
                .rewardRate(rewardRate)
                .description(String.format("销售额达到 %.0f-%.0f 元", from, to))
                .build();
    }

    /**
     * 检查给定值是否在此等级范围内
     *
     * @param value 要检查的值
     * @return 如果在范围内则返回 true
     */
    public boolean isInRange(BigDecimal value) {
        if (value == null) {
            return false;
        }
        boolean aboveFrom = targetFrom == null || value.compareTo(targetFrom) >= 0;
        boolean belowTo = targetTo == null || value.compareTo(targetTo) < 0;
        return aboveFrom && belowTo;
    }
}

package com.cretas.aims.dto.restaurant;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * 损耗率统计 DTO
 *
 * <p>用于餐饮专项 BI Dashboard 的食材损耗分析。
 * 损耗来源：过期报废（expiry_date &lt; NOW() 且有剩余量）。
 * 损耗率计算公式：损耗成本 / 总采购成本 × 100%。</p>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-20
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class WastageStatistics {

    /** 时段内总损耗成本（元） */
    private BigDecimal totalWastageCost;

    /** 损耗率（%），保留2位小数。计算公式：损耗成本 / 总采购成本 × 100 */
    private BigDecimal wastageRate;

    /** 时段内总采购成本（计算损耗率的分母，元） */
    private BigDecimal totalPurchaseCost;

    /** 按食材类别细分的损耗明细列表 */
    private List<WastageByType> byType;

    /**
     * 按类别细分的损耗明细
     */
    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class WastageByType {

        /** 食材类别（如：海水鱼、蔬菜、肉类） */
        private String type;

        /** 该类别的损耗数量（已过期但未消耗的剩余量之和） */
        private BigDecimal quantity;

        /** 该类别的损耗成本（元） */
        private BigDecimal cost;

        /** 占总损耗成本的百分比（0~100，保留2位小数） */
        private Double percentage;
    }
}

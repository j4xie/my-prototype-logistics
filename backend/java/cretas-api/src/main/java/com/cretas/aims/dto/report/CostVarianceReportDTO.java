package com.cretas.aims.dto.report;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 成本差异分析报表DTO
 *
 * 对比 BOM 理论成本与实际成本，分析差异原因
 * 用于成本控制和预算管理
 *
 * 行业标准: 成本差异率 ≤ 5%
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CostVarianceReportDTO {

    /**
     * 工厂ID
     */
    private String factoryId;

    /**
     * 报告开始日期
     */
    private LocalDate startDate;

    /**
     * 报告结束日期
     */
    private LocalDate endDate;

    // ========== 汇总指标 ==========

    /**
     * 总BOM理论成本
     */
    private BigDecimal totalBomCost;

    /**
     * 总实际成本
     */
    private BigDecimal totalActualCost;

    /**
     * 总成本差异 (正值=超支, 负值=节约)
     */
    private BigDecimal totalVariance;

    /**
     * 总成本差异率 (%)
     */
    private BigDecimal totalVarianceRate;

    /**
     * 差异状态: NORMAL (≤5%), WARNING (5-10%), CRITICAL (>10%)
     */
    private String varianceStatus;

    /**
     * 分析的产品数量
     */
    private Integer productCount;

    /**
     * 分析的批次数量
     */
    private Integer batchCount;

    // ========== 成本结构分析 ==========

    /**
     * 材料成本占比 (%)
     */
    private BigDecimal materialCostRatio;

    /**
     * 人工成本占比 (%)
     */
    private BigDecimal laborCostRatio;

    /**
     * 制造费用占比 (%)
     */
    private BigDecimal overheadCostRatio;

    /**
     * 材料成本差异
     */
    private BigDecimal materialVariance;

    /**
     * 人工成本差异
     */
    private BigDecimal laborVariance;

    /**
     * 制造费用差异
     */
    private BigDecimal overheadVariance;

    // ========== 产品级差异明细 ==========

    /**
     * 按产品的成本差异列表
     */
    private List<ProductCostVariance> productVariances;

    /**
     * 成本异常产品 (差异率>5%)
     */
    private List<ProductCostVariance> anomalyProducts;

    // ========== 趋势数据 ==========

    /**
     * 每日成本趋势
     */
    private List<DailyCostTrend> dailyTrend;

    /**
     * 成本变化瀑布图数据
     */
    private List<WaterfallItem> waterfallData;

    // ========== 内部类 ==========

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProductCostVariance {
        /**
         * 产品类型ID
         */
        private String productTypeId;

        /**
         * 产品名称
         */
        private String productName;

        /**
         * 产品分类
         */
        private String productCategory;

        /**
         * 生产数量
         */
        private BigDecimal quantity;

        /**
         * BOM单位成本
         */
        private BigDecimal bomUnitCost;

        /**
         * 实际单位成本
         */
        private BigDecimal actualUnitCost;

        /**
         * 单位成本差异
         */
        private BigDecimal unitVariance;

        /**
         * 差异率 (%)
         */
        private BigDecimal varianceRate;

        /**
         * 总差异金额
         */
        private BigDecimal totalVariance;

        /**
         * 差异原因分析
         */
        private String varianceReason;

        /**
         * 批次数
         */
        private Integer batchCount;

        /**
         * 材料成本差异
         */
        private BigDecimal materialVariance;

        /**
         * 人工成本差异
         */
        private BigDecimal laborVariance;

        /**
         * 制造费用差异
         */
        private BigDecimal overheadVariance;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DailyCostTrend {
        private LocalDate date;
        private BigDecimal bomCost;
        private BigDecimal actualCost;
        private BigDecimal variance;
        private BigDecimal varianceRate;
        private Integer batchCount;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WaterfallItem {
        /**
         * 项目名称
         */
        private String name;

        /**
         * 项目类型: START, INCREASE, DECREASE, SUBTOTAL, TOTAL
         */
        private String type;

        /**
         * 金额值
         */
        private BigDecimal value;

        /**
         * 累计值
         */
        private BigDecimal cumulative;

        /**
         * 颜色提示: positive, negative, neutral
         */
        private String colorHint;
    }

    /**
     * 计算差异状态
     */
    public static String calculateStatus(BigDecimal varianceRate) {
        if (varianceRate == null) return "UNKNOWN";
        double rate = Math.abs(varianceRate.doubleValue());
        if (rate <= 5) return "NORMAL";
        if (rate <= 10) return "WARNING";
        return "CRITICAL";
    }

    /**
     * 分析差异原因
     */
    public static String analyzeVarianceReason(BigDecimal materialVar, BigDecimal laborVar, BigDecimal overheadVar) {
        if (materialVar == null && laborVar == null && overheadVar == null) {
            return "数据不足";
        }

        StringBuilder reasons = new StringBuilder();
        if (materialVar != null && materialVar.abs().doubleValue() > 0.01) {
            reasons.append(materialVar.doubleValue() > 0 ? "材料超支" : "材料节约");
        }
        if (laborVar != null && laborVar.abs().doubleValue() > 0.01) {
            if (reasons.length() > 0) reasons.append(", ");
            reasons.append(laborVar.doubleValue() > 0 ? "人工超支" : "人工节约");
        }
        if (overheadVar != null && overheadVar.abs().doubleValue() > 0.01) {
            if (reasons.length() > 0) reasons.append(", ");
            reasons.append(overheadVar.doubleValue() > 0 ? "制造费用超支" : "制造费用节约");
        }

        return reasons.length() > 0 ? reasons.toString() : "成本正常";
    }
}

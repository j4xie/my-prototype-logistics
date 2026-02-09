package com.cretas.aims.dto.ai;

import com.cretas.aims.dto.bom.BomCostSummaryDTO;
import com.cretas.aims.dto.report.ProductionByProductDTO;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 生产 AI 上下文 DTO
 *
 * 用于向 AI 分析服务提供预计算的生产统计数据，
 * 减少 LLM Token 消耗（数据聚合由后端完成）
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-13
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductionAIContext {

    /**
     * 工厂ID
     */
    private String factoryId;

    /**
     * 统计开始日期
     */
    private LocalDate startDate;

    /**
     * 统计结束日期
     */
    private LocalDate endDate;

    /**
     * 统计天数
     */
    private Integer periodDays;

    // ========== 生产统计 ==========

    /**
     * 按产品分组的生产统计（含成本信息）
     */
    private List<ProductionWithCostDTO> productionByProduct;

    /**
     * 总产量
     */
    private BigDecimal totalOutput;

    /**
     * 产品种类数
     */
    private Integer productCount;

    /**
     * 日均产量
     */
    private BigDecimal avgDailyOutput;

    // ========== 成本统计 ==========

    /**
     * 总原料成本
     */
    private BigDecimal totalMaterialCost;

    /**
     * 总人工成本
     */
    private BigDecimal totalLaborCost;

    /**
     * 总设备成本
     */
    private BigDecimal totalEquipmentCost;

    /**
     * 总成本
     */
    private BigDecimal totalCost;

    /**
     * 平均单位成本
     */
    private BigDecimal avgUnitCost;

    /**
     * 成本结构比例 (material, labor, equipment, other)
     */
    private Map<String, BigDecimal> costBreakdown;

    // ========== 排名信息 ==========

    /**
     * 产量 Top 5 产品
     */
    private List<String> topProductsByOutput;

    /**
     * 成本 Top 5 产品（总成本最高）
     */
    private List<String> topProductsByCost;

    /**
     * 成本差异 Top 5 产品（BOM vs 实际差异最大）
     */
    private List<String> topProductsByCostVariance;

    // ========== 计算时间 ==========

    /**
     * 数据计算时间
     */
    private String calculatedAt;

    /**
     * 带成本信息的生产统计
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProductionWithCostDTO {
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
         * 总产量
         */
        private BigDecimal totalQuantity;

        /**
         * 单位
         */
        private String unit;

        /**
         * BOM 理论单位成本
         */
        private BigDecimal bomUnitCost;

        /**
         * 实际平均单位成本
         */
        private BigDecimal avgActualUnitCost;

        /**
         * 成本差异（实际 - BOM）
         */
        private BigDecimal costVariance;

        /**
         * 成本差异率 %
         */
        private BigDecimal costVarianceRate;

        /**
         * 总成本
         */
        private BigDecimal totalCost;

        /**
         * 批次数
         */
        private Integer batchCount;
    }
}

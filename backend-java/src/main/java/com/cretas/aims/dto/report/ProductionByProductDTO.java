package com.cretas.aims.dto.report;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 按产品统计生产数量DTO
 *
 * 包含生产数量和成本分析数据，用于：
 * 1. 车间实时生产报表展示
 * 2. AI 成本分析上下文注入
 *
 * @author Cretas Team
 * @version 1.1.0
 * @since 2025-01-13
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductionByProductDTO {

    /**
     * 产品类型ID
     */
    private String productTypeId;

    /**
     * 产品名称
     */
    private String productName;

    /**
     * 总产量
     */
    private BigDecimal totalQuantity;

    /**
     * 单位
     */
    private String unit;

    // ========== 成本分析字段（用于 AI 上下文） ==========

    /**
     * 产品分类（成品/原料/包辅材等）
     */
    private String productCategory;

    /**
     * BOM 理论单位成本
     */
    private BigDecimal bomUnitCost;

    /**
     * 实际平均单位成本
     */
    private BigDecimal avgActualCost;

    /**
     * 成本差异（实际 - BOM）
     */
    private BigDecimal costVariance;

    /**
     * 成本差异率 %（正值表示超支）
     */
    private BigDecimal costVarianceRate;

    /**
     * 批次数量
     */
    private Integer batchCount;

    /**
     * 总成本
     */
    private BigDecimal totalCost;

    /**
     * 简化构造器（兼容原有代码）
     */
    public ProductionByProductDTO(String productTypeId, String productName,
                                  BigDecimal totalQuantity, String unit) {
        this.productTypeId = productTypeId;
        this.productName = productName;
        this.totalQuantity = totalQuantity;
        this.unit = unit;
    }
}

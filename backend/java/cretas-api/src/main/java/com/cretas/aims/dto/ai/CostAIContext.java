package com.cretas.aims.dto.ai;

import com.cretas.aims.dto.bom.BomCostSummaryDTO;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * 成本 AI 上下文 DTO
 *
 * 用于向 AI 分析服务提供产品的 BOM 理论成本与实际成本对比数据，
 * 支持成本差异分析和异常检测
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-13
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CostAIContext {

    /**
     * 工厂ID
     */
    private String factoryId;

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

    // ========== BOM 理论成本 ==========

    /**
     * BOM 成本汇总
     */
    private BomCostSummaryDTO bomCostSummary;

    /**
     * BOM 总成本（单位产品）
     */
    private BigDecimal bomTotalCost;

    /**
     * BOM 原料成本占比 %
     */
    private BigDecimal bomMaterialCostRatio;

    /**
     * BOM 人工成本占比 %
     */
    private BigDecimal bomLaborCostRatio;

    /**
     * BOM 均摊成本占比 %
     */
    private BigDecimal bomOverheadCostRatio;

    // ========== 实际成本统计 ==========

    /**
     * 统计批次数
     */
    private Integer batchCount;

    /**
     * 总产量
     */
    private BigDecimal totalQuantity;

    /**
     * 实际平均单位成本
     */
    private BigDecimal avgActualUnitCost;

    /**
     * 实际原料成本平均占比 %
     */
    private BigDecimal actualMaterialCostRatio;

    /**
     * 实际人工成本平均占比 %
     */
    private BigDecimal actualLaborCostRatio;

    /**
     * 实际设备成本平均占比 %
     */
    private BigDecimal actualEquipmentCostRatio;

    /**
     * 实际其他成本平均占比 %
     */
    private BigDecimal actualOtherCostRatio;

    // ========== 成本差异分析 ==========

    /**
     * 成本差异（实际 - BOM）
     */
    private BigDecimal costVariance;

    /**
     * 成本差异率 %（正值表示超支）
     */
    private BigDecimal costVarianceRate;

    /**
     * 差异状态：NORMAL, WARNING, CRITICAL
     */
    private String varianceStatus;

    /**
     * 主要差异来源分析
     */
    private List<CostVarianceDetail> varianceDetails;

    // ========== 历史趋势 ==========

    /**
     * 最近 N 个批次的成本趋势
     */
    private List<BatchCostTrend> recentBatchTrends;

    /**
     * 成本是否呈上升趋势
     */
    private Boolean isCostIncreasing;

    /**
     * 数据计算时间
     */
    private String calculatedAt;

    /**
     * 成本差异明细
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CostVarianceDetail {
        /**
         * 成本类型：MATERIAL, LABOR, EQUIPMENT, OVERHEAD
         */
        private String costType;

        /**
         * 成本类型名称
         */
        private String costTypeName;

        /**
         * BOM 标准值
         */
        private BigDecimal bomValue;

        /**
         * 实际平均值
         */
        private BigDecimal actualValue;

        /**
         * 差异值
         */
        private BigDecimal variance;

        /**
         * 差异率 %
         */
        private BigDecimal varianceRate;

        /**
         * 是否为主要差异来源
         */
        private Boolean isPrimarySource;
    }

    /**
     * 批次成本趋势
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BatchCostTrend {
        /**
         * 批次号
         */
        private String batchNumber;

        /**
         * 批次日期
         */
        private String batchDate;

        /**
         * 单位成本
         */
        private BigDecimal unitCost;

        /**
         * 与 BOM 的差异率 %
         */
        private BigDecimal varianceRate;
    }
}

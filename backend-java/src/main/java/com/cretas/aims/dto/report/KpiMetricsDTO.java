package com.cretas.aims.dto.report;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 完整 KPI 指标集DTO
 *
 * 整合制造业核心 KPI 指标：
 * - 生产效率指标
 * - 质量指标
 * - 成本指标
 * - 交付指标
 * - 设备指标
 * - 人员指标
 *
 * 基于 2025 行业最佳实践标准
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KpiMetricsDTO {

    /**
     * 工厂ID
     */
    private String factoryId;

    /**
     * 报告日期
     */
    private LocalDate reportDate;

    /**
     * 数据更新时间
     */
    private LocalDateTime updatedAt;

    // ========== 生产效率指标 ==========

    /**
     * OEE 设备综合效率 (%)
     * 目标: ≥85%
     */
    private BigDecimal oee;

    /**
     * 产量完成率 (%)
     * 实际产量 / 计划产量
     */
    private BigDecimal outputCompletionRate;

    /**
     * 产能利用率 (%)
     * 实际产能 / 最大产能
     */
    private BigDecimal capacityUtilization;

    /**
     * 平均生产周期 (小时)
     */
    private BigDecimal avgCycleTime;

    /**
     * 单位时间产出 (件/小时 或 kg/小时)
     */
    private BigDecimal throughput;

    // ========== 质量指标 ==========

    /**
     * FPY 一次通过率 (%)
     * 首次检验合格数 / 总检验数
     * 目标: ≥96%
     */
    private BigDecimal fpy;

    /**
     * 综合合格率 (%)
     * 包含返工后合格
     */
    private BigDecimal overallQualityRate;

    /**
     * 报废率 (%)
     * 目标: ≤2%
     */
    private BigDecimal scrapRate;

    /**
     * 返工率 (%)
     */
    private BigDecimal reworkRate;

    /**
     * 客户投诉率 (PPM)
     */
    private BigDecimal customerComplaintRate;

    // ========== 成本指标 ==========

    /**
     * 单位成本 (元)
     */
    private BigDecimal unitCost;

    /**
     * BOM成本差异率 (%)
     * 目标: ≤5%
     */
    private BigDecimal bomVarianceRate;

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
     * 废品损失率 (%)
     */
    private BigDecimal scrapLossRate;

    // ========== 交付指标 ==========

    /**
     * OTIF 准时足量交付率 (%)
     * 目标: ≥95%
     */
    private BigDecimal otif;

    /**
     * 准时交付率 (%)
     */
    private BigDecimal onTimeDeliveryRate;

    /**
     * 足量交付率 (%)
     */
    private BigDecimal inFullDeliveryRate;

    /**
     * 平均交付周期 (天)
     */
    private BigDecimal avgLeadTime;

    /**
     * 订单完成率 (%)
     */
    private BigDecimal orderFulfillmentRate;

    // ========== 设备指标 ==========

    /**
     * 设备可用性 (%)
     */
    private BigDecimal equipmentAvailability;

    /**
     * MTBF 平均故障间隔时间 (小时)
     * 目标: 最大化
     */
    private BigDecimal mtbf;

    /**
     * MTTR 平均修复时间 (小时)
     * 目标: 最小化
     */
    private BigDecimal mttr;

    /**
     * 计划维护完成率 (%)
     */
    private BigDecimal pmCompletionRate;

    /**
     * 设备故障次数
     */
    private Integer breakdownCount;

    // ========== 人员指标 ==========

    /**
     * 人均产出 (件/人 或 kg/人)
     */
    private BigDecimal outputPerWorker;

    /**
     * 出勤率 (%)
     */
    private BigDecimal attendanceRate;

    /**
     * 加班率 (%)
     */
    private BigDecimal overtimeRate;

    /**
     * 培训完成率 (%)
     */
    private BigDecimal trainingCompletionRate;

    /**
     * 安全事故数
     */
    private Integer safetyIncidents;

    // ========== 库存指标 ==========

    /**
     * 库存周转率 (次/月)
     */
    private BigDecimal inventoryTurnover;

    /**
     * 库存准确率 (%)
     */
    private BigDecimal inventoryAccuracy;

    /**
     * 原料库存天数
     */
    private BigDecimal rawMaterialDays;

    /**
     * 成品库存天数
     */
    private BigDecimal finishedGoodsDays;

    // ========== 综合评分 ==========

    /**
     * 综合 KPI 评分 (0-100)
     */
    private BigDecimal overallScore;

    /**
     * 评分等级: A, B, C, D
     */
    private String scoreGrade;

    /**
     * 与上期对比变化 (%)
     */
    private BigDecimal periodChange;

    /**
     * 计算综合评分
     * 基于各项指标的加权平均
     */
    public static BigDecimal calculateOverallScore(KpiMetricsDTO kpi) {
        double score = 0;
        int weight = 0;

        // OEE (权重 20)
        if (kpi.getOee() != null) {
            score += kpi.getOee().doubleValue() * 0.2;
            weight += 20;
        }

        // FPY (权重 15)
        if (kpi.getFpy() != null) {
            score += kpi.getFpy().doubleValue() * 0.15;
            weight += 15;
        }

        // OTIF (权重 15)
        if (kpi.getOtif() != null) {
            score += kpi.getOtif().doubleValue() * 0.15;
            weight += 15;
        }

        // 产能利用率 (权重 15)
        if (kpi.getCapacityUtilization() != null) {
            score += kpi.getCapacityUtilization().doubleValue() * 0.15;
            weight += 15;
        }

        // 成本差异率 (权重 15, 反向计算)
        if (kpi.getBomVarianceRate() != null) {
            double costScore = Math.max(0, 100 - Math.abs(kpi.getBomVarianceRate().doubleValue()) * 10);
            score += costScore * 0.15;
            weight += 15;
        }

        // 设备可用性 (权重 10)
        if (kpi.getEquipmentAvailability() != null) {
            score += kpi.getEquipmentAvailability().doubleValue() * 0.1;
            weight += 10;
        }

        // 人均产出比 (权重 10) - 需要基准数据，暂用 80% 为满分
        if (kpi.getOutputPerWorker() != null) {
            score += 80 * 0.1;
            weight += 10;
        }

        if (weight == 0) return BigDecimal.ZERO;
        return BigDecimal.valueOf(score * 100 / weight).setScale(2, BigDecimal.ROUND_HALF_UP);
    }

    /**
     * 计算评分等级
     */
    public static String calculateGrade(BigDecimal score) {
        if (score == null) return "N/A";
        double val = score.doubleValue();
        if (val >= 90) return "A";
        if (val >= 80) return "B";
        if (val >= 70) return "C";
        return "D";
    }
}

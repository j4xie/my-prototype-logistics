package com.cretas.aims.dto.report;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * OEE (Overall Equipment Effectiveness) 设备综合效率报表DTO
 *
 * OEE = 可用性 × 表现性 × 质量率
 * - 可用性 (Availability): 实际运行时间 / 计划运行时间
 * - 表现性 (Performance): (实际产量 × 理想周期时间) / 运行时间
 * - 质量率 (Quality): 良品数 / 总产量
 *
 * 行业标准: 世界级OEE ≥ 85%
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OeeReportDTO {

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

    // ========== OEE 核心指标 ==========

    /**
     * 综合OEE值 (0-100%)
     */
    private BigDecimal oeeValue;

    /**
     * OEE等级评价 (A: ≥85%, B: 75-85%, C: 65-75%, D: <65%)
     */
    private String oeeGrade;

    /**
     * 可用性 (Availability) 百分比
     */
    private BigDecimal availability;

    /**
     * 表现性 (Performance) 百分比
     */
    private BigDecimal performance;

    /**
     * 质量率 (Quality) 百分比
     */
    private BigDecimal quality;

    // ========== 时间相关指标 ==========

    /**
     * 计划运行时间 (分钟)
     */
    private Long plannedProductionTime;

    /**
     * 实际运行时间 (分钟)
     */
    private Long actualRunTime;

    /**
     * 停机时间 (分钟)
     */
    private Long downtime;

    /**
     * 计划停机时间 (分钟) - 如换模、保养
     */
    private Long plannedDowntime;

    /**
     * 非计划停机时间 (分钟) - 如故障、缺料
     */
    private Long unplannedDowntime;

    // ========== 产量相关指标 ==========

    /**
     * 理论产能 (单位: 件/分钟 或 kg/小时)
     */
    private BigDecimal idealCycleTime;

    /**
     * 实际总产量
     */
    private BigDecimal totalOutput;

    /**
     * 合格品数量
     */
    private BigDecimal goodOutput;

    /**
     * 不合格品数量
     */
    private BigDecimal defectOutput;

    /**
     * 报废数量
     */
    private BigDecimal scrapOutput;

    // ========== 损失分析 ==========

    /**
     * 可用性损失 (%)
     */
    private BigDecimal availabilityLoss;

    /**
     * 性能损失 (%)
     */
    private BigDecimal performanceLoss;

    /**
     * 质量损失 (%)
     */
    private BigDecimal qualityLoss;

    /**
     * 六大损失详情
     */
    private List<LossDetail> lossDetails;

    // ========== 趋势数据 ==========

    /**
     * 每日OEE趋势
     */
    private List<DailyOee> dailyTrend;

    /**
     * 按设备的OEE统计
     */
    private List<EquipmentOee> equipmentOeeList;

    // ========== 内部类 ==========

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LossDetail {
        /**
         * 损失类型: BREAKDOWN, SETUP, IDLING, SPEED, DEFECT, STARTUP
         */
        private String lossType;

        /**
         * 损失名称
         */
        private String lossName;

        /**
         * 损失时间 (分钟)
         */
        private Long lossMinutes;

        /**
         * 损失占比 (%)
         */
        private BigDecimal lossPercentage;

        /**
         * 损失金额 (估算)
         */
        private BigDecimal lossCost;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DailyOee {
        private LocalDate date;
        private BigDecimal oee;
        private BigDecimal availability;
        private BigDecimal performance;
        private BigDecimal quality;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EquipmentOee {
        private String equipmentId;
        private String equipmentName;
        private BigDecimal oee;
        private BigDecimal availability;
        private BigDecimal performance;
        private BigDecimal quality;
        private Long runTimeMinutes;
        private Long downtimeMinutes;
    }

    /**
     * 计算OEE等级
     */
    public static String calculateGrade(BigDecimal oee) {
        if (oee == null) return "N/A";
        double val = oee.doubleValue();
        if (val >= 85) return "A";
        if (val >= 75) return "B";
        if (val >= 65) return "C";
        return "D";
    }
}

package com.cretas.aims.dto.report;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 仪表盘统计数据传输对象
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class DashboardStatisticsDTO {
    // 生产统计
    private ProductionStatistics productionStats;
    // 库存统计
    private InventoryStatistics inventoryStats;
    // 财务统计
    private FinanceStatistics financeStats;
    // 人员统计
    private PersonnelStatistics personnelStats;
    // 设备统计
    private EquipmentStatistics equipmentStats;
    // 质量统计
    private QualityStatistics qualityStats;
    // 近期趋势
    private TrendStatistics trendStats;
    // 告警信息
    private List<AlertInfo> alerts;

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class ProductionStatistics {
        private Integer totalPlans;
        private Integer activePlans;
        private Integer completedPlans;
        private BigDecimal totalOutput;
        private BigDecimal monthlyOutput;
        private Double completionRate;
        private Double efficiency;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class InventoryStatistics {
        private Integer totalMaterials;
        private Integer totalBatches;
        private BigDecimal totalValue;
        private Integer expiringBatches;
        private Integer expiredBatches;
        private Integer lowStockItems;
        private BigDecimal turnoverRate;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class FinanceStatistics {
        private BigDecimal totalRevenue;
        private BigDecimal totalCost;
        private BigDecimal totalProfit;
        private BigDecimal monthlyRevenue;
        private BigDecimal monthlyCost;
        private BigDecimal monthlyProfit;
        private Double profitMargin;
        private BigDecimal accountsReceivable;
        private BigDecimal accountsPayable;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class PersonnelStatistics {
        private Integer totalEmployees;
        private Integer activeEmployees;
        private Integer departmentCount;
        private BigDecimal totalSalary;
        private BigDecimal averageSalary;
        private Double attendanceRate;
        private Integer todayPresent;
        private Integer todayAbsent;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class EquipmentStatistics {
        private Integer totalEquipment;
        private Integer runningEquipment;
        private Integer idleEquipment;
        private Integer maintenanceEquipment;
        private Double utilizationRate;
        private Double availability;
        private Integer needsMaintenance;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class QualityStatistics {
        private BigDecimal totalProduction;
        private BigDecimal qualifiedProduction;
        private BigDecimal defectiveProduction;
        private Double qualityRate;
        private Integer qualityIssues;
        private Integer resolvedIssues;
        private Double firstPassRate;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class TrendStatistics {
        private List<DailyTrend> dailyProduction;
        private List<DailyTrend> dailyRevenue;
        private List<DailyTrend> dailyCost;
        private List<DailyTrend> dailyQuality;
        private Map<String, BigDecimal> monthlyComparison;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class DailyTrend {
        private LocalDate date;
        private BigDecimal value;
        private Double changeRate;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class AlertInfo {
        private String type;
        private String level;
        private String message;
        private String targetId;
        private String targetName;
        private LocalDate date;
    }
}

package com.cretas.aims.controller;

import com.cretas.aims.service.DashboardService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 仪表板控制器
 *
 * API路径: /api/mobile/{factoryId}/processing/dashboard
 * 总计6个仪表板API端点:
 * 1. GET /overview           - 获取生产概览（今日/本周/本月统计）
 * 2. GET /production         - 获取生产统计（批次分布、产品类型统计、每日趋势）
 * 3. GET /equipment          - 获取设备统计（状态分布、部门分布、设备概要）
 * 4. GET /quality            - 获取质量统计（本周/本月/本季度质检数据）
 * 5. GET /alerts             - 获取告警统计（本周/本月告警数据）
 * 6. GET /trends             - 获取趋势分析（生产/质量趋势）
 *
 * 前端对应:
 * - HomeScreen (QuickStatsPanel) - 调用 overview
 * - ProcessingDashboard - 调用 production, equipment, quality
 *
 * @author Claude (AI Assistant)
 * @date 2025-11-18
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/processing/dashboard")
@CrossOrigin(origins = "*", maxAge = 3600)
public class DashboardController {

    @Autowired
    private DashboardService dashboardService;

    // ========== 1. 生产概览 ==========

    /**
     * 获取生产概览
     *
     * GET /api/mobile/{factoryId}/processing/dashboard/overview?period=today
     *
     * @param factoryId 工厂ID
     * @param period 时间周期: today, week, month (默认: today)
     * @return 生产概览数据
     *
     * 返回数据结构:
     * {
     *   "success": true,
     *   "code": 200,
     *   "message": "获取生产概览成功",
     *   "data": {
     *     "period": "today",
     *     "summary": {
     *       "totalBatches": 15,
     *       "activeBatches": 5,
     *       "completedBatches": 10,
     *       "qualityInspections": 8,
     *       "activeAlerts": 2,
     *       "onDutyWorkers": 25,
     *       "totalWorkers": 50
     *     },
     *     "kpi": {
     *       "productionEfficiency": 85.5,
     *       "qualityPassRate": 95.2,
     *       "equipmentUtilization": 78.3
     *     },
     *     "alerts": {
     *       "active": 2,
     *       "status": "normal"
     *     }
     *   },
     *   "timestamp": "2025-11-18T14:30:00"
     * }
     */
    @GetMapping("/overview")
    public ResponseEntity<ApiResponse<DashboardOverviewData>> getDashboardOverview(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "today") String period) {
        try {
            DashboardOverviewData data = dashboardService.getDashboardOverview(factoryId, period);
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "获取生产概览成功", data));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "获取生产概览失败: " + e.getMessage(), null));
        }
    }

    // ========== 2. 生产统计 ==========

    /**
     * 获取生产统计
     *
     * GET /api/mobile/{factoryId}/processing/dashboard/production?startDate=2025-01-01&endDate=2025-11-18&department=生产部
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期 (可选)
     * @param endDate 结束日期 (可选)
     * @param department 部门 (可选)
     * @return 生产统计数据
     *
     * 返回数据结构:
     * {
     *   "success": true,
     *   "data": {
     *     "batchStatusDistribution": [
     *       { "status": "pending", "count": 5, "totalQuantity": 1200 },
     *       { "status": "in_progress", "count": 3, "totalQuantity": 800 },
     *       { "status": "completed", "count": 10, "totalQuantity": 3500 }
     *     ],
     *     "productTypeStats": [
     *       { "productType": "冷冻虾仁", "count": 8, "totalQuantity": 2500, "avgQuantity": 312.5 },
     *       { "productType": "冷冻鱼片", "count": 5, "totalQuantity": 1500, "avgQuantity": 300 }
     *     ],
     *     "dailyTrends": [
     *       { "date": "2025-11-10", "batches": 2, "quantity": 500, "completed": 2 },
     *       { "date": "2025-11-11", "batches": 3, "quantity": 800, "completed": 1 }
     *     ]
     *   }
     * }
     */
    @GetMapping("/production")
    public ResponseEntity<ApiResponse<ProductionStatisticsData>> getProductionStatistics(
            @PathVariable String factoryId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) String department) {
        try {
            ProductionStatisticsData data = dashboardService.getProductionStatistics(
                    factoryId, startDate, endDate, department);
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "获取生产统计成功", data));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "获取生产统计失败: " + e.getMessage(), null));
        }
    }

    // ========== 3. 设备统计 ==========

    /**
     * 获取设备统计
     *
     * GET /api/mobile/{factoryId}/processing/dashboard/equipment
     *
     * @param factoryId 工厂ID
     * @return 设备统计数据
     *
     * 返回数据结构:
     * {
     *   "success": true,
     *   "data": {
     *     "statusDistribution": [
     *       { "status": "running", "count": 15 },
     *       { "status": "idle", "count": 8 },
     *       { "status": "maintenance", "count": 2 }
     *     ],
     *     "departmentDistribution": [
     *       { "department": "生产部", "count": 12 },
     *       { "department": "包装部", "count": 8 }
     *     ],
     *     "summary": {
     *       "totalEquipment": 25,
     *       "activeEquipment": 15,
     *       "utilizationRate": 60.0,
     *       "recentAlerts": 3
     *     }
     *   }
     * }
     */
    @GetMapping("/equipment")
    public ResponseEntity<ApiResponse<EquipmentDashboardData>> getEquipmentDashboard(
            @PathVariable String factoryId) {
        try {
            EquipmentDashboardData data = dashboardService.getEquipmentDashboard(factoryId);
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "获取设备统计成功", data));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "获取设备统计失败: " + e.getMessage(), null));
        }
    }

    // ========== 4. 质量统计 ==========

    /**
     * 获取质量统计
     *
     * GET /api/mobile/{factoryId}/processing/dashboard/quality?period=month
     *
     * @param factoryId 工厂ID
     * @param period 时间周期: week, month, quarter (默认: month)
     * @return 质量统计数据
     */
    @GetMapping("/quality")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getQualityDashboard(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "month") String period) {
        try {
            Map<String, Object> data = dashboardService.getQualityDashboard(factoryId, period);
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "获取质量统计成功", data));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "获取质量统计失败: " + e.getMessage(), null));
        }
    }

    // ========== 5. 告警统计 ==========

    /**
     * 获取告警统计
     *
     * GET /api/mobile/{factoryId}/processing/dashboard/alerts?period=week
     *
     * @param factoryId 工厂ID
     * @param period 时间周期: week, month (默认: week)
     * @return 告警统计数据
     */
    @GetMapping("/alerts")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getAlertsDashboard(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "week") String period) {
        try {
            Map<String, Object> data = dashboardService.getAlertsDashboard(factoryId, period);
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "获取告警统计成功", data));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "获取告警统计失败: " + e.getMessage(), null));
        }
    }

    // ========== 6. 趋势分析 ==========

    /**
     * 获取趋势分析
     *
     * GET /api/mobile/{factoryId}/processing/dashboard/trends?period=month&metric=production
     *
     * @param factoryId 工厂ID
     * @param period 时间周期: week, month, quarter (默认: month)
     * @param metric 指标类型: production, quality (默认: production)
     * @return 趋势分析数据
     */
    @GetMapping("/trends")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getTrendAnalysis(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "month") String period,
            @RequestParam(defaultValue = "production") String metric) {
        try {
            Map<String, Object> data = dashboardService.getTrendAnalysis(factoryId, period, metric);
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "获取趋势分析成功", data));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "获取趋势分析失败: " + e.getMessage(), null));
        }
    }

    // ========================================
    // DTO Classes
    // ========================================

    /**
     * 生产概览数据
     */
    public static class DashboardOverviewData {
        private String period;
        private SummaryData summary;
        private KpiData kpi;
        private AlertData alerts;

        // Constructors
        public DashboardOverviewData() {}

        public DashboardOverviewData(String period, SummaryData summary, KpiData kpi, AlertData alerts) {
            this.period = period;
            this.summary = summary;
            this.kpi = kpi;
            this.alerts = alerts;
        }

        // Getters and Setters
        public String getPeriod() { return period; }
        public void setPeriod(String period) { this.period = period; }

        public SummaryData getSummary() { return summary; }
        public void setSummary(SummaryData summary) { this.summary = summary; }

        public KpiData getKpi() { return kpi; }
        public void setKpi(KpiData kpi) { this.kpi = kpi; }

        public AlertData getAlerts() { return alerts; }
        public void setAlerts(AlertData alerts) { this.alerts = alerts; }
    }

    public static class SummaryData {
        private int totalBatches;
        private int activeBatches;
        private int completedBatches;
        private int qualityInspections;
        private int activeAlerts;
        private int onDutyWorkers;
        private int totalWorkers;

        // Constructors
        public SummaryData() {}

        public SummaryData(int totalBatches, int activeBatches, int completedBatches,
                           int qualityInspections, int activeAlerts, int onDutyWorkers, int totalWorkers) {
            this.totalBatches = totalBatches;
            this.activeBatches = activeBatches;
            this.completedBatches = completedBatches;
            this.qualityInspections = qualityInspections;
            this.activeAlerts = activeAlerts;
            this.onDutyWorkers = onDutyWorkers;
            this.totalWorkers = totalWorkers;
        }

        // Getters and Setters
        public int getTotalBatches() { return totalBatches; }
        public void setTotalBatches(int totalBatches) { this.totalBatches = totalBatches; }

        public int getActiveBatches() { return activeBatches; }
        public void setActiveBatches(int activeBatches) { this.activeBatches = activeBatches; }

        public int getCompletedBatches() { return completedBatches; }
        public void setCompletedBatches(int completedBatches) { this.completedBatches = completedBatches; }

        public int getQualityInspections() { return qualityInspections; }
        public void setQualityInspections(int qualityInspections) { this.qualityInspections = qualityInspections; }

        public int getActiveAlerts() { return activeAlerts; }
        public void setActiveAlerts(int activeAlerts) { this.activeAlerts = activeAlerts; }

        public int getOnDutyWorkers() { return onDutyWorkers; }
        public void setOnDutyWorkers(int onDutyWorkers) { this.onDutyWorkers = onDutyWorkers; }

        public int getTotalWorkers() { return totalWorkers; }
        public void setTotalWorkers(int totalWorkers) { this.totalWorkers = totalWorkers; }
    }

    public static class KpiData {
        private double productionEfficiency;
        private double qualityPassRate;
        private double equipmentUtilization;

        // Constructors
        public KpiData() {}

        public KpiData(double productionEfficiency, double qualityPassRate, double equipmentUtilization) {
            this.productionEfficiency = productionEfficiency;
            this.qualityPassRate = qualityPassRate;
            this.equipmentUtilization = equipmentUtilization;
        }

        // Getters and Setters
        public double getProductionEfficiency() { return productionEfficiency; }
        public void setProductionEfficiency(double productionEfficiency) { this.productionEfficiency = productionEfficiency; }

        public double getQualityPassRate() { return qualityPassRate; }
        public void setQualityPassRate(double qualityPassRate) { this.qualityPassRate = qualityPassRate; }

        public double getEquipmentUtilization() { return equipmentUtilization; }
        public void setEquipmentUtilization(double equipmentUtilization) { this.equipmentUtilization = equipmentUtilization; }
    }

    public static class AlertData {
        private int active;
        private String status;

        // Constructors
        public AlertData() {}

        public AlertData(int active, String status) {
            this.active = active;
            this.status = status;
        }

        // Getters and Setters
        public int getActive() { return active; }
        public void setActive(int active) { this.active = active; }

        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
    }

    /**
     * 生产统计数据
     */
    public static class ProductionStatisticsData {
        private List<BatchStatusStat> batchStatusDistribution;
        private List<ProductTypeStat> productTypeStats;
        private List<DailyTrendStat> dailyTrends;

        // Constructors
        public ProductionStatisticsData() {}

        public ProductionStatisticsData(List<BatchStatusStat> batchStatusDistribution,
                                        List<ProductTypeStat> productTypeStats,
                                        List<DailyTrendStat> dailyTrends) {
            this.batchStatusDistribution = batchStatusDistribution;
            this.productTypeStats = productTypeStats;
            this.dailyTrends = dailyTrends;
        }

        // Getters and Setters
        public List<BatchStatusStat> getBatchStatusDistribution() { return batchStatusDistribution; }
        public void setBatchStatusDistribution(List<BatchStatusStat> batchStatusDistribution) {
            this.batchStatusDistribution = batchStatusDistribution;
        }

        public List<ProductTypeStat> getProductTypeStats() { return productTypeStats; }
        public void setProductTypeStats(List<ProductTypeStat> productTypeStats) {
            this.productTypeStats = productTypeStats;
        }

        public List<DailyTrendStat> getDailyTrends() { return dailyTrends; }
        public void setDailyTrends(List<DailyTrendStat> dailyTrends) { this.dailyTrends = dailyTrends; }
    }

    public static class BatchStatusStat {
        private String status;
        private int count;
        private double totalQuantity;

        public BatchStatusStat() {}
        public BatchStatusStat(String status, int count, double totalQuantity) {
            this.status = status;
            this.count = count;
            this.totalQuantity = totalQuantity;
        }

        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }

        public int getCount() { return count; }
        public void setCount(int count) { this.count = count; }

        public double getTotalQuantity() { return totalQuantity; }
        public void setTotalQuantity(double totalQuantity) { this.totalQuantity = totalQuantity; }
    }

    public static class ProductTypeStat {
        private String productType;
        private int count;
        private double totalQuantity;
        private double avgQuantity;

        public ProductTypeStat() {}
        public ProductTypeStat(String productType, int count, double totalQuantity, double avgQuantity) {
            this.productType = productType;
            this.count = count;
            this.totalQuantity = totalQuantity;
            this.avgQuantity = avgQuantity;
        }

        public String getProductType() { return productType; }
        public void setProductType(String productType) { this.productType = productType; }

        public int getCount() { return count; }
        public void setCount(int count) { this.count = count; }

        public double getTotalQuantity() { return totalQuantity; }
        public void setTotalQuantity(double totalQuantity) { this.totalQuantity = totalQuantity; }

        public double getAvgQuantity() { return avgQuantity; }
        public void setAvgQuantity(double avgQuantity) { this.avgQuantity = avgQuantity; }
    }

    public static class DailyTrendStat {
        private String date;
        private int batches;
        private double quantity;
        private int completed;

        public DailyTrendStat() {}
        public DailyTrendStat(String date, int batches, double quantity, int completed) {
            this.date = date;
            this.batches = batches;
            this.quantity = quantity;
            this.completed = completed;
        }

        public String getDate() { return date; }
        public void setDate(String date) { this.date = date; }

        public int getBatches() { return batches; }
        public void setBatches(int batches) { this.batches = batches; }

        public double getQuantity() { return quantity; }
        public void setQuantity(double quantity) { this.quantity = quantity; }

        public int getCompleted() { return completed; }
        public void setCompleted(int completed) { this.completed = completed; }
    }

    /**
     * 设备统计数据
     */
    public static class EquipmentDashboardData {
        private List<StatusDistribution> statusDistribution;
        private List<DepartmentDistribution> departmentDistribution;
        private EquipmentSummary summary;

        public EquipmentDashboardData() {}

        public EquipmentDashboardData(List<StatusDistribution> statusDistribution,
                                      List<DepartmentDistribution> departmentDistribution,
                                      EquipmentSummary summary) {
            this.statusDistribution = statusDistribution;
            this.departmentDistribution = departmentDistribution;
            this.summary = summary;
        }

        public List<StatusDistribution> getStatusDistribution() { return statusDistribution; }
        public void setStatusDistribution(List<StatusDistribution> statusDistribution) {
            this.statusDistribution = statusDistribution;
        }

        public List<DepartmentDistribution> getDepartmentDistribution() { return departmentDistribution; }
        public void setDepartmentDistribution(List<DepartmentDistribution> departmentDistribution) {
            this.departmentDistribution = departmentDistribution;
        }

        public EquipmentSummary getSummary() { return summary; }
        public void setSummary(EquipmentSummary summary) { this.summary = summary; }
    }

    public static class StatusDistribution {
        private String status;
        private int count;

        public StatusDistribution() {}
        public StatusDistribution(String status, int count) {
            this.status = status;
            this.count = count;
        }

        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }

        public int getCount() { return count; }
        public void setCount(int count) { this.count = count; }
    }

    public static class DepartmentDistribution {
        private String department;
        private int count;

        public DepartmentDistribution() {}
        public DepartmentDistribution(String department, int count) {
            this.department = department;
            this.count = count;
        }

        public String getDepartment() { return department; }
        public void setDepartment(String department) { this.department = department; }

        public int getCount() { return count; }
        public void setCount(int count) { this.count = count; }
    }

    public static class EquipmentSummary {
        private int totalEquipment;
        private int activeEquipment;
        private double utilizationRate;
        private int recentAlerts;

        public EquipmentSummary() {}
        public EquipmentSummary(int totalEquipment, int activeEquipment, double utilizationRate, int recentAlerts) {
            this.totalEquipment = totalEquipment;
            this.activeEquipment = activeEquipment;
            this.utilizationRate = utilizationRate;
            this.recentAlerts = recentAlerts;
        }

        public int getTotalEquipment() { return totalEquipment; }
        public void setTotalEquipment(int totalEquipment) { this.totalEquipment = totalEquipment; }

        public int getActiveEquipment() { return activeEquipment; }
        public void setActiveEquipment(int activeEquipment) { this.activeEquipment = activeEquipment; }

        public double getUtilizationRate() { return utilizationRate; }
        public void setUtilizationRate(double utilizationRate) { this.utilizationRate = utilizationRate; }

        public int getRecentAlerts() { return recentAlerts; }
        public void setRecentAlerts(int recentAlerts) { this.recentAlerts = recentAlerts; }
    }

    /**
     * API响应包装类
     */
    public static class ApiResponse<T> {
        private boolean success;
        private int code;
        private String message;
        private T data;
        private LocalDateTime timestamp;

        public ApiResponse() {
            this.timestamp = LocalDateTime.now();
        }

        public ApiResponse(boolean success, int code, String message, T data) {
            this.success = success;
            this.code = code;
            this.message = message;
            this.data = data;
            this.timestamp = LocalDateTime.now();
        }

        public boolean isSuccess() { return success; }
        public void setSuccess(boolean success) { this.success = success; }

        public int getCode() { return code; }
        public void setCode(int code) { this.code = code; }

        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }

        public T getData() { return data; }
        public void setData(T data) { this.data = data; }

        public LocalDateTime getTimestamp() { return timestamp; }
        public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }
    }
}

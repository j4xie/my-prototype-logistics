package com.cretas.aims.controller;

import com.cretas.aims.service.ReportsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 报表控制器
 *
 * API路径: /api/mobile/{factoryId}/processing/reports
 * 总计1个核心报表API端点:
 * 1. GET /cost-analysis/time-range - 时间范围成本分析
 *
 * 前端对应:
 * - CostAnalysisDashboard - 调用成本分析API
 * - DataExportScreen - 使用报表数据导出
 *
 * @author Claude (AI Assistant)
 * @date 2025-11-18
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/processing/reports")
@CrossOrigin(origins = "*", maxAge = 3600)
public class ReportsController {

    @Autowired
    private ReportsService reportsService;

    // ========== 成本分析报表 ==========

    /**
     * 获取时间范围成本分析
     *
     * GET /api/mobile/{factoryId}/processing/reports/cost-analysis/time-range?startDate=2025-01-01&endDate=2025-11-18&groupBy=day
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期 (格式: yyyy-MM-dd)
     * @param endDate 结束日期 (格式: yyyy-MM-dd)
     * @param groupBy 分组方式: day, week, month (可选, 默认: day)
     * @return 成本分析数据
     *
     * 返回数据结构:
     * {
     *   "success": true,
     *   "code": 200,
     *   "message": "获取成本分析成功",
     *   "data": {
     *     "timeRange": {
     *       "startDate": "2025-01-01",
     *       "endDate": "2025-11-18",
     *       "groupBy": "day"
     *     },
     *     "summary": {
     *       "totalBatches": 120,
     *       "totalCost": 450000.00,
     *       "averageCostPerBatch": 3750.00,
     *       "totalQuantity": 35000.00,
     *       "averageCostPerKg": 12.86
     *     },
     *     "costBreakdown": {
     *       "materialCost": 300000.00,
     *       "laborCost": 100000.00,
     *       "overheadCost": 50000.00,
     *       "materialPercentage": 66.67,
     *       "laborPercentage": 22.22,
     *       "overheadPercentage": 11.11
     *     },
     *     "timeSeriesData": [
     *       {
     *         "date": "2025-01-01",
     *         "batches": 5,
     *         "totalCost": 18750.00,
     *         "quantity": 1500.00
     *       },
     *       {
     *         "date": "2025-01-02",
     *         "batches": 4,
     *         "totalCost": 15000.00,
     *         "quantity": 1200.00
     *       }
     *     ],
     *     "topCostBatches": [
     *       {
     *         "batchId": "batch-001",
     *         "batchNumber": "B20250101-001",
     *         "productType": "冷冻虾仁",
     *         "totalCost": 8500.00,
     *         "date": "2025-01-01"
     *       }
     *     ]
     *   },
     *   "timestamp": "2025-11-18T14:30:00"
     * }
     */
    @GetMapping("/cost-analysis/time-range")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getTimeRangeCostAnalysis(
            @PathVariable String factoryId,
            @RequestParam String startDate,
            @RequestParam String endDate,
            @RequestParam(defaultValue = "day") String groupBy) {
        try {
            Map<String, Object> analysisData = reportsService.getTimeRangeCostAnalysis(
                    factoryId, startDate, endDate, groupBy);
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "获取成本分析成功", analysisData));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ApiResponse<>(false, 400, "请求参数错误: " + e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "获取成本分析失败: " + e.getMessage(), null));
        }
    }

    // ========================================
    // API响应包装类
    // ========================================

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

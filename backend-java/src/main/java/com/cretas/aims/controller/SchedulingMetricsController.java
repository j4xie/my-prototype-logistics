package com.cretas.aims.controller;

import com.cretas.aims.dto.metrics.SchedulingMetricsDTO.*;
import com.cretas.aims.service.SchedulingMetricsService;
import com.cretas.aims.util.ErrorSanitizer;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 排班指标监控API控制器
 *
 * 提供排班系统性能指标查询接口，包括:
 * - 总览指标 (分配数、效率、准确率等)
 * - 趋势分析 (按日统计)
 * - 预测准确率分析 (按工艺类型分解)
 * - 多样性指标 (轮换建议、技能覆盖)
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/metrics/scheduling")
@RequiredArgsConstructor
@Tag(name = "排班指标监控", description = "排班系统性能指标查询API，包括总览、趋势、预测准确率和多样性指标")
public class SchedulingMetricsController {

    private final SchedulingMetricsService schedulingMetricsService;

    /**
     * 获取排班总览指标
     *
     * GET /api/mobile/{factoryId}/metrics/scheduling/overview
     */
    @Operation(
            summary = "获取排班总览指标",
            description = "返回排班系统的综合指标，包括总分配数、平均效率、预测准确率、活跃工人数、任务多样性分数、接受率和完成率"
    )
    @GetMapping("/overview")
    public ResponseEntity<Map<String, Object>> getSchedulingOverview(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "统计天数", example = "30")
            @RequestParam(defaultValue = "30") int days) {

        Map<String, Object> response = new HashMap<>();

        try {
            log.info("获取排班总览指标: factoryId={}, days={}", factoryId, days);

            SchedulingOverview overview = schedulingMetricsService.getSchedulingOverview(factoryId, days);

            response.put("success", true);
            response.put("data", overview);
            response.put("message", "获取成功");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("获取排班总览指标失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            response.put("success", false);
            response.put("message", "获取失败: " + ErrorSanitizer.sanitize(e));
            return ResponseEntity.internalServerError().body(response);
        }
    }

    /**
     * 获取排班趋势数据
     *
     * GET /api/mobile/{factoryId}/metrics/scheduling/trends?days=30
     */
    @Operation(
            summary = "获取排班趋势数据",
            description = "返回指定天数内的每日排班指标趋势，包括分配数、平均效率、预测误差、活跃工人数等"
    )
    @GetMapping("/trends")
    public ResponseEntity<Map<String, Object>> getSchedulingTrends(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "查询天数", example = "30")
            @RequestParam(defaultValue = "30") int days) {

        Map<String, Object> response = new HashMap<>();

        try {
            log.info("获取排班趋势: factoryId={}, days={}", factoryId, days);

            // 限制最大查询天数
            int limitedDays = Math.min(days, 90);

            List<SchedulingTrend> trends = schedulingMetricsService.getSchedulingTrends(factoryId, limitedDays);

            response.put("success", true);
            response.put("data", trends);
            response.put("total", trends.size());
            response.put("message", "获取成功");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("获取排班趋势失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            response.put("success", false);
            response.put("message", "获取失败: " + ErrorSanitizer.sanitize(e));
            return ResponseEntity.internalServerError().body(response);
        }
    }

    /**
     * 获取预测准确率详情
     *
     * GET /api/mobile/{factoryId}/metrics/scheduling/prediction?days=30
     */
    @Operation(
            summary = "获取预测准确率详情",
            description = "返回预测准确率的详细分析，包括整体准确率、按工艺类型分解、准确率趋势、预测误差统计"
    )
    @GetMapping("/prediction")
    public ResponseEntity<Map<String, Object>> getPredictionAccuracy(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "统计天数", example = "30")
            @RequestParam(defaultValue = "30") int days) {

        Map<String, Object> response = new HashMap<>();

        try {
            log.info("获取预测准确率: factoryId={}, days={}", factoryId, days);

            // 限制最大查询天数
            int limitedDays = Math.min(days, 90);

            PredictionAccuracyDTO accuracy = schedulingMetricsService.getPredictionAccuracy(factoryId, limitedDays);

            response.put("success", true);
            response.put("data", accuracy);
            response.put("message", "获取成功");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("获取预测准确率失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            response.put("success", false);
            response.put("message", "获取失败: " + ErrorSanitizer.sanitize(e));
            return ResponseEntity.internalServerError().body(response);
        }
    }

    /**
     * 获取多样性指标
     *
     * GET /api/mobile/{factoryId}/metrics/scheduling/diversity
     */
    @Operation(
            summary = "获取多样性指标",
            description = "返回任务分配多样性指标，包括工厂整体多样性分数、需要轮换的工人数、技能覆盖率、工序覆盖统计、轮换建议"
    )
    @GetMapping("/diversity")
    public ResponseEntity<Map<String, Object>> getDiversityMetrics(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "分析天数", example = "14")
            @RequestParam(defaultValue = "14") int days) {

        Map<String, Object> response = new HashMap<>();

        try {
            log.info("获取多样性指标: factoryId={}, days={}", factoryId, days);

            // 限制分析天数范围
            int limitedDays = Math.max(7, Math.min(days, 30));

            DiversityMetricsDTO metrics = schedulingMetricsService.getDiversityMetrics(factoryId, limitedDays);

            response.put("success", true);
            response.put("data", metrics);
            response.put("message", "获取成功");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("获取多样性指标失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            response.put("success", false);
            response.put("message", "获取失败: " + ErrorSanitizer.sanitize(e));
            return ResponseEntity.internalServerError().body(response);
        }
    }

    /**
     * 获取所有排班指标 (综合接口)
     *
     * GET /api/mobile/{factoryId}/metrics/scheduling/all
     */
    @Operation(
            summary = "获取所有排班指标",
            description = "一次性返回所有排班指标，包括总览、趋势、预测准确率和多样性指标"
    )
    @GetMapping("/all")
    public ResponseEntity<Map<String, Object>> getAllMetrics(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "统计天数", example = "30")
            @RequestParam(defaultValue = "30") int days) {

        Map<String, Object> response = new HashMap<>();

        try {
            log.info("获取所有排班指标: factoryId={}, days={}", factoryId, days);

            int limitedDays = Math.min(days, 90);

            Map<String, Object> data = new HashMap<>();
            data.put("overview", schedulingMetricsService.getSchedulingOverview(factoryId, limitedDays));
            data.put("trends", schedulingMetricsService.getSchedulingTrends(factoryId, limitedDays));
            data.put("prediction", schedulingMetricsService.getPredictionAccuracy(factoryId, limitedDays));
            data.put("diversity", schedulingMetricsService.getDiversityMetrics(factoryId, Math.min(limitedDays, 30)));

            response.put("success", true);
            response.put("data", data);
            response.put("message", "获取成功");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("获取所有排班指标失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            response.put("success", false);
            response.put("message", "获取失败: " + ErrorSanitizer.sanitize(e));
            return ResponseEntity.internalServerError().body(response);
        }
    }
}

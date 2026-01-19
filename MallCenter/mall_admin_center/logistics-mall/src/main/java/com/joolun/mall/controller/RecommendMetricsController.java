package com.joolun.mall.controller;

import com.joolun.common.core.domain.R;
import com.joolun.mall.service.RecommendMetricsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 推荐系统指标监控 API
 * 提供 A/B 测试对比、多样性评分、留存率等监控数据
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/recommend/metrics")
@Tag(name = "推荐系统监控", description = "推荐系统指标监控API")
public class RecommendMetricsController {

    private final RecommendMetricsService recommendMetricsService;

    /**
     * 获取实时指标
     */
    @GetMapping("/realtime")
    @Operation(summary = "获取实时指标")
    public R<Map<String, Object>> getRealtimeMetrics() {
        try {
            Map<String, Object> metrics = recommendMetricsService.getRealtimeMetrics();
            return R.ok(metrics);
        } catch (Exception e) {
            log.error("获取实时指标失败", e);
            return R.fail("获取实时指标失败");
        }
    }

    /**
     * 获取指标报告
     */
    @GetMapping("/report")
    @Operation(summary = "获取指标报告")
    public R<Map<String, Object>> getMetricsReport(
            @RequestParam(defaultValue = "7") int days) {
        try {
            Map<String, Object> report = recommendMetricsService.getMetricsReport(days);
            return R.ok(report);
        } catch (Exception e) {
            log.error("获取指标报告失败", e);
            return R.fail("获取指标报告失败");
        }
    }

    /**
     * 获取来源分析
     */
    @GetMapping("/source")
    @Operation(summary = "获取来源分析")
    public R<Map<String, Object>> getSourceAnalysis(
            @RequestParam(defaultValue = "7") int days) {
        try {
            Map<String, Object> analysis = recommendMetricsService.getSourceAnalysis(days);
            return R.ok(analysis);
        } catch (Exception e) {
            log.error("获取来源分析失败", e);
            return R.fail("获取来源分析失败");
        }
    }

    /**
     * 获取 A/B 测试对比数据
     */
    @GetMapping("/ab-comparison")
    @Operation(summary = "获取A/B测试对比")
    public R<Map<String, Object>> getABTestComparison(
            @RequestParam(defaultValue = "exp_vector_search") String experimentName,
            @RequestParam(defaultValue = "7") int days) {
        try {
            Map<String, Object> comparison = recommendMetricsService.getABTestComparison(experimentName, days);
            return R.ok(comparison);
        } catch (Exception e) {
            log.error("获取A/B测试对比失败", e);
            return R.fail("获取A/B测试对比失败");
        }
    }

    /**
     * 获取推荐多样性评分
     */
    @GetMapping("/diversity")
    @Operation(summary = "获取推荐多样性评分")
    public R<Map<String, Object>> getDiversityScore(
            @RequestParam(defaultValue = "7") int days) {
        try {
            Map<String, Object> diversityScore = recommendMetricsService.getDiversityScore(days);
            return R.ok(diversityScore);
        } catch (Exception e) {
            log.error("获取多样性评分失败", e);
            return R.fail("获取多样性评分失败");
        }
    }

    /**
     * 获取用户留存率
     */
    @GetMapping("/retention")
    @Operation(summary = "获取用户留存率")
    public R<Map<String, Object>> getRetentionRate(
            @RequestParam(defaultValue = "7") int days) {
        try {
            Map<String, Object> retention = recommendMetricsService.getRetentionRate(days);
            return R.ok(retention);
        } catch (Exception e) {
            log.error("获取留存率失败", e);
            return R.fail("获取留存率失败");
        }
    }

    /**
     * 获取点击深度分析
     */
    @GetMapping("/click-depth")
    @Operation(summary = "获取点击深度分析")
    public R<Map<String, Object>> getClickDepthAnalysis(
            @RequestParam(defaultValue = "7") int days) {
        try {
            Map<String, Object> clickDepth = recommendMetricsService.getClickDepthAnalysis(days);
            return R.ok(clickDepth);
        } catch (Exception e) {
            log.error("获取点击深度分析失败", e);
            return R.fail("获取点击深度分析失败");
        }
    }
}

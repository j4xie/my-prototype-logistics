package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.intent.ErrorAttributionStatistics;
import com.cretas.aims.util.ErrorSanitizer;
import com.cretas.aims.entity.intent.IntentOptimizationSuggestion;
import com.cretas.aims.repository.ErrorAttributionStatisticsRepository;
import com.cretas.aims.repository.IntentMatchRecordRepository;
import com.cretas.aims.repository.IntentOptimizationSuggestionRepository;
import com.cretas.aims.repository.config.AIIntentConfigRepository;
import com.cretas.aims.scheduler.ErrorAttributionAnalysisScheduler;
import com.cretas.aims.service.ErrorAttributionAnalysisService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 意图识别分析 Controller
 *
 * 提供意图匹配统计、错误归因分析、优化建议等 API
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/intent-analysis")
@RequiredArgsConstructor
@Tag(name = "意图识别分析", description = "意图识别分析 API，提供统计数据、趋势分析、错误模式识别、优化建议、报告生成等功能")
public class IntentAnalysisController {

    private final ErrorAttributionAnalysisService analysisService;
    private final ErrorAttributionAnalysisScheduler analysisScheduler;
    private final ErrorAttributionStatisticsRepository statisticsRepository;
    private final IntentMatchRecordRepository matchRecordRepository;
    private final IntentOptimizationSuggestionRepository suggestionRepository;
    private final AIIntentConfigRepository intentConfigRepository;

    // ==================== 统计数据 ====================

    /**
     * 获取每日统计数据列表
     */
    @Operation(summary = "获取每日统计数据列表", description = "获取指定天数内的意图识别每日统计数据，包括匹配率、LLM回退次数等")
    @GetMapping("/statistics")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getStatistics(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @Parameter(description = "统计天数", example = "30") @RequestParam(defaultValue = "30") int days) {

        try {
            LocalDate startDate = LocalDate.now().minusDays(days);
            List<ErrorAttributionStatistics> stats =
                    statisticsRepository.findRecentStatistics(factoryId, startDate);

            Map<String, Object> result = new HashMap<>();
            result.put("statistics", stats);
            result.put("days", days);
            result.put("count", stats.size());

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("获取统计数据失败: factoryId={}", factoryId, e);
            return ResponseEntity.ok(ApiResponse.error("获取统计数据失败: " + ErrorSanitizer.sanitize(e)));
        }
    }

    /**
     * 获取指定日期的统计详情
     */
    @Operation(summary = "获取指定日期统计详情", description = "获取某一天的意图识别详细统计数据")
    @GetMapping("/statistics/{date}")
    public ResponseEntity<ApiResponse<ErrorAttributionStatistics>> getStatisticsByDate(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @Parameter(description = "统计日期", example = "2026-01-02") @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {

        try {
            ErrorAttributionStatistics stats =
                    statisticsRepository.findByFactoryIdAndStatDate(factoryId, date)
                            .orElse(null);

            if (stats == null) {
                return ResponseEntity.ok(ApiResponse.error("未找到该日期的统计数据"));
            }

            return ResponseEntity.ok(ApiResponse.success(stats));
        } catch (Exception e) {
            log.error("获取统计详情失败: factoryId={}, date={}", factoryId, date, e);
            return ResponseEntity.ok(ApiResponse.error("获取统计详情失败: " + ErrorSanitizer.sanitize(e)));
        }
    }

    // ==================== 趋势分析 ====================

    /**
     * 获取匹配成功率趋势
     */
    @Operation(summary = "获取匹配成功率趋势", description = "获取指定天数内的意图匹配成功率变化趋势")
    @GetMapping("/trends/match-rate")
    public ResponseEntity<ApiResponse<Map<LocalDate, Double>>> getMatchRateTrend(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @Parameter(description = "统计天数", example = "30") @RequestParam(defaultValue = "30") int days) {

        try {
            Map<LocalDate, Double> trend = analysisService.analyzeMatchRateTrend(factoryId, days);
            return ResponseEntity.ok(ApiResponse.success(trend));
        } catch (Exception e) {
            log.error("获取匹配率趋势失败: factoryId={}", factoryId, e);
            return ResponseEntity.ok(ApiResponse.error("获取趋势数据失败: " + ErrorSanitizer.sanitize(e)));
        }
    }

    /**
     * 获取LLM Fallback使用趋势
     */
    @Operation(summary = "获取LLM Fallback使用趋势", description = "获取指定天数内LLM回退处理的使用次数趋势")
    @GetMapping("/trends/llm-fallback")
    public ResponseEntity<ApiResponse<Map<LocalDate, Integer>>> getLlmFallbackTrend(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @Parameter(description = "统计天数", example = "30") @RequestParam(defaultValue = "30") int days) {

        try {
            Map<LocalDate, Integer> trend = analysisService.analyzeLlmFallbackTrend(factoryId, days);
            return ResponseEntity.ok(ApiResponse.success(trend));
        } catch (Exception e) {
            log.error("获取LLM Fallback趋势失败: factoryId={}", factoryId, e);
            return ResponseEntity.ok(ApiResponse.error("获取趋势数据失败: " + ErrorSanitizer.sanitize(e)));
        }
    }

    /**
     * 获取错误归因分布趋势
     */
    @Operation(summary = "获取错误归因分布趋势", description = "获取指定天数内各类错误归因的分布变化趋势")
    @GetMapping("/trends/error-attribution")
    public ResponseEntity<ApiResponse<Map<LocalDate, Map<String, Integer>>>> getErrorAttributionTrend(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @Parameter(description = "统计天数", example = "30") @RequestParam(defaultValue = "30") int days) {

        try {
            Map<LocalDate, Map<String, Integer>> trend =
                    analysisService.analyzeErrorAttributionTrend(factoryId, days);
            return ResponseEntity.ok(ApiResponse.success(trend));
        } catch (Exception e) {
            log.error("获取错误归因趋势失败: factoryId={}", factoryId, e);
            return ResponseEntity.ok(ApiResponse.error("获取趋势数据失败: " + ErrorSanitizer.sanitize(e)));
        }
    }

    // ==================== 错误模式识别 ====================

    /**
     * 获取高频失败模式
     */
    @Operation(summary = "获取高频失败模式", description = "识别并返回意图识别失败的高频模式，用于规则优化参考")
    @GetMapping("/patterns/failures")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getFailurePatterns(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @Parameter(description = "分析天数", example = "7") @RequestParam(defaultValue = "7") int days,
            @Parameter(description = "最小出现频次", example = "3") @RequestParam(defaultValue = "3") int minFrequency) {

        try {
            List<Map<String, Object>> patterns =
                    analysisService.identifyFailurePatterns(factoryId, days, minFrequency);
            return ResponseEntity.ok(ApiResponse.success(patterns));
        } catch (Exception e) {
            log.error("获取失败模式失败: factoryId={}", factoryId, e);
            return ResponseEntity.ok(ApiResponse.error("获取失败模式失败: " + ErrorSanitizer.sanitize(e)));
        }
    }

    /**
     * 获取歧义意图列表
     */
    @Operation(summary = "获取歧义意图列表", description = "识别存在歧义的意图匹配，用于规则冲突分析")
    @GetMapping("/patterns/ambiguous")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getAmbiguousIntents(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @Parameter(description = "分析天数", example = "7") @RequestParam(defaultValue = "7") int days) {

        try {
            List<Map<String, Object>> intents =
                    analysisService.identifyAmbiguousIntents(factoryId, days);
            return ResponseEntity.ok(ApiResponse.success(intents));
        } catch (Exception e) {
            log.error("获取歧义意图失败: factoryId={}", factoryId, e);
            return ResponseEntity.ok(ApiResponse.error("获取歧义意图失败: " + ErrorSanitizer.sanitize(e)));
        }
    }

    /**
     * 获取缺失规则模式
     */
    @Operation(summary = "获取缺失规则模式", description = "识别频繁需要LLM回退处理的意图模式，提示可能需要添加新规则")
    @GetMapping("/patterns/missing-rules")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getMissingRulePatterns(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @Parameter(description = "分析天数", example = "7") @RequestParam(defaultValue = "7") int days,
            @Parameter(description = "最小出现次数", example = "5") @RequestParam(defaultValue = "5") int minCount) {

        try {
            List<Map<String, Object>> patterns =
                    analysisService.identifyMissingRulePatterns(factoryId, days, minCount);
            return ResponseEntity.ok(ApiResponse.success(patterns));
        } catch (Exception e) {
            log.error("获取缺失规则模式失败: factoryId={}", factoryId, e);
            return ResponseEntity.ok(ApiResponse.error("获取缺失规则模式失败: " + ErrorSanitizer.sanitize(e)));
        }
    }

    // ==================== 优化建议 ====================

    /**
     * 获取优化建议列表
     */
    @Operation(summary = "获取优化建议列表", description = "分页获取系统生成的意图规则优化建议，支持按状态筛选")
    @GetMapping("/suggestions")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSuggestions(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @Parameter(description = "建议状态: PENDING/APPLIED/REJECTED", example = "PENDING") @RequestParam(required = false) String status,
            @Parameter(description = "页码，从0开始", example = "0") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "每页数量", example = "20") @RequestParam(defaultValue = "20") int size) {

        try {
            Page<IntentOptimizationSuggestion> suggestions;
            PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));

            if (status != null && !status.isEmpty()) {
                IntentOptimizationSuggestion.SuggestionStatus suggestionStatus =
                        IntentOptimizationSuggestion.SuggestionStatus.valueOf(status.toUpperCase());
                suggestions = suggestionRepository.findByFactoryIdAndStatus(
                        factoryId, suggestionStatus, pageRequest);
            } else {
                suggestions = suggestionRepository.findByFactoryId(factoryId, pageRequest);
            }

            Map<String, Object> result = new HashMap<>();
            result.put("content", suggestions.getContent());
            result.put("totalElements", suggestions.getTotalElements());
            result.put("totalPages", suggestions.getTotalPages());
            result.put("page", page);
            result.put("size", size);

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("获取优化建议失败: factoryId={}", factoryId, e);
            return ResponseEntity.ok(ApiResponse.error("获取优化建议失败: " + ErrorSanitizer.sanitize(e)));
        }
    }

    /**
     * 获取高影响力待处理建议
     */
    @Operation(summary = "获取高影响力待处理建议", description = "获取预估影响力超过阈值的待处理优化建议，优先级较高")
    @GetMapping("/suggestions/high-impact")
    public ResponseEntity<ApiResponse<List<IntentOptimizationSuggestion>>> getHighImpactSuggestions(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @Parameter(description = "最小影响力阈值(0-1)", example = "0.05") @RequestParam(defaultValue = "0.05") double minImpact,
            @Parameter(description = "返回数量上限", example = "10") @RequestParam(defaultValue = "10") int limit) {

        try {
            List<IntentOptimizationSuggestion> suggestions =
                    suggestionRepository.findHighImpactPendingSuggestions(factoryId, BigDecimal.valueOf(minImpact),
                            PageRequest.of(0, limit));
            return ResponseEntity.ok(ApiResponse.success(suggestions));
        } catch (Exception e) {
            log.error("获取高影响力建议失败: factoryId={}", factoryId, e);
            return ResponseEntity.ok(ApiResponse.error("获取高影响力建议失败: " + ErrorSanitizer.sanitize(e)));
        }
    }

    /**
     * 采纳建议
     */
    @Operation(summary = "采纳建议", description = "标记某条优化建议为已采纳状态，并记录操作人")
    @PostMapping("/suggestions/{suggestionId}/apply")
    public ResponseEntity<ApiResponse<Void>> applySuggestion(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @Parameter(description = "建议ID", example = "sug-001") @PathVariable String suggestionId,
            @Parameter(description = "操作人ID", example = "22") @RequestParam Long operatorId) {

        try {
            int updated = suggestionRepository.applySuggestion(suggestionId, LocalDateTime.now(), operatorId);
            if (updated > 0) {
                log.info("建议已采纳: suggestionId={}, operatorId={}", suggestionId, operatorId);
                return ResponseEntity.ok(ApiResponse.successMessage("建议已采纳"));
            } else {
                return ResponseEntity.ok(ApiResponse.error("建议不存在或状态已变更"));
            }
        } catch (Exception e) {
            log.error("采纳建议失败: suggestionId={}", suggestionId, e);
            return ResponseEntity.ok(ApiResponse.error("采纳建议失败: " + ErrorSanitizer.sanitize(e)));
        }
    }

    /**
     * 拒绝建议
     */
    @Operation(summary = "拒绝建议", description = "标记某条优化建议为已拒绝状态，并记录拒绝原因")
    @PostMapping("/suggestions/{suggestionId}/reject")
    public ResponseEntity<ApiResponse<Void>> rejectSuggestion(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @Parameter(description = "建议ID", example = "sug-001") @PathVariable String suggestionId,
            @Parameter(description = "拒绝原因", example = "业务场景已变更") @RequestParam String reason) {

        try {
            int updated = suggestionRepository.rejectSuggestion(suggestionId, reason);
            if (updated > 0) {
                log.info("建议已拒绝: suggestionId={}, reason={}", suggestionId, reason);
                return ResponseEntity.ok(ApiResponse.successMessage("建议已拒绝"));
            } else {
                return ResponseEntity.ok(ApiResponse.error("建议不存在或状态已变更"));
            }
        } catch (Exception e) {
            log.error("拒绝建议失败: suggestionId={}", suggestionId, e);
            return ResponseEntity.ok(ApiResponse.error("拒绝建议失败: " + ErrorSanitizer.sanitize(e)));
        }
    }

    // ==================== 创建新意图建议 (自学习核心功能) ====================

    /**
     * 获取创建新意图建议列表
     */
    @Operation(summary = "获取创建新意图建议列表",
            description = "分页获取 LLM 识别的需要创建新意图的建议，支持按状态筛选。这是自学习机制的核心功能。")
    @GetMapping("/suggestions/create-intent")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getCreateIntentSuggestions(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @Parameter(description = "建议状态: PENDING/APPLIED/REJECTED", example = "PENDING")
            @RequestParam(defaultValue = "PENDING") String status,
            @Parameter(description = "页码，从0开始", example = "0") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "每页数量", example = "20") @RequestParam(defaultValue = "20") int size) {

        try {
            IntentOptimizationSuggestion.SuggestionStatus suggestionStatus =
                    IntentOptimizationSuggestion.SuggestionStatus.valueOf(status.toUpperCase());
            PageRequest pageRequest = PageRequest.of(page, size);

            Page<IntentOptimizationSuggestion> suggestions =
                    suggestionRepository.findCreateIntentSuggestions(factoryId, suggestionStatus, pageRequest);

            Map<String, Object> result = new HashMap<>();
            result.put("content", suggestions.getContent());
            result.put("totalElements", suggestions.getTotalElements());
            result.put("totalPages", suggestions.getTotalPages());
            result.put("page", page);
            result.put("size", size);

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("获取创建新意图建议失败: factoryId={}", factoryId, e);
            return ResponseEntity.ok(ApiResponse.error("获取建议列表失败: " + ErrorSanitizer.sanitize(e)));
        }
    }

    /**
     * 获取创建新意图建议详情
     */
    @Operation(summary = "获取创建新意图建议详情",
            description = "获取单个创建新意图建议的详细信息，包括 LLM 建议的意图代码、名称、关键词等")
    @GetMapping("/suggestions/create-intent/{suggestionId}")
    public ResponseEntity<ApiResponse<IntentOptimizationSuggestion>> getCreateIntentSuggestionDetail(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @Parameter(description = "建议ID", example = "sug-001") @PathVariable String suggestionId) {

        try {
            IntentOptimizationSuggestion suggestion = suggestionRepository.findById(suggestionId).orElse(null);

            if (suggestion == null) {
                return ResponseEntity.ok(ApiResponse.error("建议不存在"));
            }

            if (!suggestion.getFactoryId().equals(factoryId)) {
                return ResponseEntity.ok(ApiResponse.error("无权访问该建议"));
            }

            if (!suggestion.isCreateIntent()) {
                return ResponseEntity.ok(ApiResponse.error("该建议不是创建新意图类型"));
            }

            return ResponseEntity.ok(ApiResponse.success(suggestion));
        } catch (Exception e) {
            log.error("获取建议详情失败: suggestionId={}", suggestionId, e);
            return ResponseEntity.ok(ApiResponse.error("获取建议详情失败: " + ErrorSanitizer.sanitize(e)));
        }
    }

    /**
     * 审批并创建新意图
     */
    @Operation(summary = "审批并创建新意图",
            description = "审批通过创建新意图建议，系统将自动创建对应的 AIIntentConfig。这是自学习机制的核心功能。")
    @PostMapping("/suggestions/{suggestionId}/approve-create-intent")
    public ResponseEntity<ApiResponse<Map<String, Object>>> approveCreateIntent(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @Parameter(description = "建议ID", example = "sug-001") @PathVariable String suggestionId,
            @Parameter(description = "操作人ID", example = "22") @RequestParam Long operatorId,
            @Parameter(description = "自定义意图代码 (可选，默认使用建议值)")
            @RequestParam(required = false) String customIntentCode,
            @Parameter(description = "自定义意图名称 (可选，默认使用建议值)")
            @RequestParam(required = false) String customIntentName,
            @Parameter(description = "自定义关键词JSON数组 (可选，默认使用建议值)")
            @RequestParam(required = false) String customKeywords) {

        try {
            // 1. 加载建议
            IntentOptimizationSuggestion suggestion = suggestionRepository.findById(suggestionId).orElse(null);

            if (suggestion == null) {
                return ResponseEntity.ok(ApiResponse.error("建议不存在"));
            }

            if (!suggestion.getFactoryId().equals(factoryId)) {
                return ResponseEntity.ok(ApiResponse.error("无权访问该建议"));
            }

            if (!suggestion.isCreateIntent()) {
                return ResponseEntity.ok(ApiResponse.error("该建议不是创建新意图类型"));
            }

            if (suggestion.getStatus() != IntentOptimizationSuggestion.SuggestionStatus.PENDING) {
                return ResponseEntity.ok(ApiResponse.error("建议状态已变更，无法审批"));
            }

            // 2. 确定最终使用的意图代码和名称
            String finalIntentCode = customIntentCode != null && !customIntentCode.isEmpty()
                    ? customIntentCode : suggestion.getSuggestedIntentCode();
            String finalIntentName = customIntentName != null && !customIntentName.isEmpty()
                    ? customIntentName : suggestion.getSuggestedIntentName();
            String finalKeywords = customKeywords != null && !customKeywords.isEmpty()
                    ? customKeywords : suggestion.getSuggestedKeywords();

            // 3. 检查意图代码是否已存在
            boolean exists = intentConfigRepository.findByFactoryIdAndIntentCode(factoryId, finalIntentCode).isPresent();
            if (exists) {
                return ResponseEntity.ok(ApiResponse.error("意图代码已存在: " + finalIntentCode));
            }

            // 4. 创建新的 AIIntentConfig
            AIIntentConfig newIntent = AIIntentConfig.builder()
                    .factoryId(factoryId)
                    .intentCode(finalIntentCode)
                    .intentName(finalIntentName)
                    .keywords(finalKeywords)
                    .intentCategory(suggestion.getSuggestedCategory())
                    .priority(50) // 默认中等优先级
                    .isActive(true)
                    .description("由自学习机制自动创建，基于 LLM 识别。原因: " + suggestion.getLlmReasoning())
                    .build();

            AIIntentConfig savedIntent = intentConfigRepository.save(newIntent);

            // 5. 更新建议状态
            suggestion.apply(operatorId);
            suggestion.setCreatedIntentId(savedIntent.getId());
            suggestionRepository.save(suggestion);

            log.info("创建新意图成功: factoryId={}, intentCode={}, suggestionId={}, operatorId={}",
                    factoryId, finalIntentCode, suggestionId, operatorId);

            // 6. 返回结果
            Map<String, Object> result = new HashMap<>();
            result.put("intent", savedIntent);
            result.put("suggestion", suggestion);
            result.put("message", "新意图创建成功: " + finalIntentCode);

            return ResponseEntity.ok(ApiResponse.success("新意图创建成功", result));
        } catch (Exception e) {
            log.error("审批创建新意图失败: suggestionId={}", suggestionId, e);
            return ResponseEntity.ok(ApiResponse.error("审批失败: " + ErrorSanitizer.sanitize(e)));
        }
    }

    // ==================== 报告生成 ====================

    /**
     * 生成周度分析报告
     */
    @Operation(summary = "生成周度分析报告", description = "生成过去一周的意图识别分析报告，包含统计汇总、趋势分析、问题识别等")
    @GetMapping("/reports/weekly")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getWeeklyReport(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId) {

        try {
            Map<String, Object> report = analysisService.generateWeeklyReport(factoryId);
            return ResponseEntity.ok(ApiResponse.success(report));
        } catch (Exception e) {
            log.error("生成周报失败: factoryId={}", factoryId, e);
            return ResponseEntity.ok(ApiResponse.error("生成周报失败: " + ErrorSanitizer.sanitize(e)));
        }
    }

    /**
     * 获取仪表盘概览数据
     */
    @Operation(summary = "获取仪表盘概览数据", description = "获取意图识别分析仪表盘的综合数据，包含今日统计、7天趋势、待处理建议等")
    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getDashboard(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId) {

        try {
            Map<String, Object> dashboard = new HashMap<>();

            // 今日统计
            LocalDate today = LocalDate.now();
            LocalDateTime startOfDay = today.atStartOfDay();
            LocalDateTime endOfDay = today.plusDays(1).atStartOfDay();

            long todayTotal = matchRecordRepository.countTotalRequests(factoryId, startOfDay, endOfDay);
            long todayMatched = matchRecordRepository.countMatchedRequests(factoryId, startOfDay, endOfDay);
            long todayLlm = matchRecordRepository.countLlmFallbackRequests(factoryId, startOfDay, endOfDay);

            Map<String, Object> todayStats = new HashMap<>();
            todayStats.put("totalRequests", todayTotal);
            todayStats.put("matchedRequests", todayMatched);
            todayStats.put("llmFallbackCount", todayLlm);
            todayStats.put("matchRate", todayTotal > 0 ? (double) todayMatched / todayTotal : 0.0);
            dashboard.put("today", todayStats);

            // 7天趋势
            Map<LocalDate, Double> weekTrend = analysisService.analyzeMatchRateTrend(factoryId, 7);
            dashboard.put("weeklyTrend", weekTrend);

            // 待处理建议数量 - 转换 List<Object[]> 为 Map
            List<Object[]> statusCounts = suggestionRepository.countByStatus(factoryId);
            Map<String, Long> suggestionStats = new HashMap<>();
            for (Object[] row : statusCounts) {
                if (row[0] != null && row[1] != null) {
                    String status = row[0].toString();
                    Long count = ((Number) row[1]).longValue();
                    suggestionStats.put(status, count);
                }
            }
            dashboard.put("suggestionStats", suggestionStats);

            // 高影响力建议 Top 5
            List<IntentOptimizationSuggestion> topSuggestions =
                    suggestionRepository.findHighImpactPendingSuggestions(factoryId, new java.math.BigDecimal("0.03"),
                            PageRequest.of(0, 5));
            dashboard.put("topSuggestions", topSuggestions);

            // 调度器状态
            dashboard.put("schedulerStatus", analysisScheduler.getSchedulerStatus());

            return ResponseEntity.ok(ApiResponse.success(dashboard));
        } catch (Exception e) {
            log.error("获取仪表盘数据失败: factoryId={}", factoryId, e);
            return ResponseEntity.ok(ApiResponse.error("获取仪表盘数据失败: " + ErrorSanitizer.sanitize(e)));
        }
    }

    // ==================== 管理操作 ====================

    /**
     * 手动触发统计聚合
     */
    @Operation(summary = "手动触发统计聚合", description = "管理员手动触发指定日期的意图识别统计聚合任务")
    @PostMapping("/admin/aggregate")
    public ResponseEntity<ApiResponse<ErrorAttributionStatistics>> triggerAggregation(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @Parameter(description = "聚合日期", example = "2026-01-01") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {

        try {
            ErrorAttributionStatistics stats = analysisScheduler.triggerAggregation(factoryId, date);
            return ResponseEntity.ok(ApiResponse.success("统计聚合完成", stats));
        } catch (Exception e) {
            log.error("手动触发聚合失败: factoryId={}, date={}", factoryId, date, e);
            return ResponseEntity.ok(ApiResponse.error("触发聚合失败: " + ErrorSanitizer.sanitize(e)));
        }
    }

    /**
     * 手动生成优化建议
     */
    @Operation(summary = "手动生成优化建议", description = "管理员手动触发基于近期数据的优化建议生成任务")
    @PostMapping("/admin/generate-suggestions")
    public ResponseEntity<ApiResponse<List<IntentOptimizationSuggestion>>> triggerSuggestionGeneration(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @Parameter(description = "分析天数", example = "7") @RequestParam(defaultValue = "7") int days) {

        try {
            List<IntentOptimizationSuggestion> suggestions =
                    analysisScheduler.triggerSuggestionGeneration(factoryId, days);
            return ResponseEntity.ok(ApiResponse.success(
                    "生成 " + suggestions.size() + " 条优化建议", suggestions));
        } catch (Exception e) {
            log.error("手动生成建议失败: factoryId={}", factoryId, e);
            return ResponseEntity.ok(ApiResponse.error("生成建议失败: " + ErrorSanitizer.sanitize(e)));
        }
    }

    /**
     * 获取调度器状态
     */
    @Operation(summary = "获取调度器状态", description = "获取后台定时任务调度器的运行状态信息")
    @GetMapping("/admin/scheduler-status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSchedulerStatus(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId) {

        try {
            return ResponseEntity.ok(ApiResponse.success(analysisScheduler.getSchedulerStatus()));
        } catch (Exception e) {
            log.error("获取调度器状态失败", e);
            return ResponseEntity.ok(ApiResponse.error("获取调度器状态失败: " + ErrorSanitizer.sanitize(e)));
        }
    }

    // ==================== 平台级意图晋升 ====================

    /**
     * 请求将工厂级意图晋升为平台级
     */
    @Operation(summary = "请求晋升为平台级意图",
            description = "工厂管理员申请将工厂级意图晋升为平台级共享意图，需要平台管理员审批")
    @PostMapping("/intents/{intentCode}/request-promotion")
    public ResponseEntity<ApiResponse<Map<String, Object>>> requestPromotion(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @Parameter(description = "意图代码", example = "CUSTOM_INTENT_001") @PathVariable String intentCode,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    description = "晋升请求",
                    content = @Content(schema = @Schema(implementation = PromotionRequest.class)))
            @RequestBody PromotionRequest request) {

        try {
            // 1. 验证意图存在且属于当前工厂
            Optional<AIIntentConfig> intentOpt = intentConfigRepository
                    .findByFactoryIdAndIntentCode(factoryId, intentCode);

            if (intentOpt.isEmpty()) {
                return ResponseEntity.ok(ApiResponse.error("意图不存在或不属于当前工厂"));
            }

            AIIntentConfig intent = intentOpt.get();

            // 2. 检查是否已经是平台级
            if (intent.getFactoryId() == null || "PLATFORM".equalsIgnoreCase(intent.getFactoryId())) {
                return ResponseEntity.ok(ApiResponse.error("该意图已经是平台级意图"));
            }

            // 3. 检查是否已有待审批的晋升请求
            List<IntentOptimizationSuggestion> existingRequests = suggestionRepository
                    .findByFactoryIdAndIntentCodeAndSuggestionTypeAndStatus(
                            factoryId, intentCode,
                            IntentOptimizationSuggestion.SuggestionType.PROMOTE_TO_PLATFORM,
                            IntentOptimizationSuggestion.SuggestionStatus.PENDING);

            if (!existingRequests.isEmpty()) {
                return ResponseEntity.ok(ApiResponse.error("该意图已有待审批的晋升请求"));
            }

            // 4. 创建晋升建议
            IntentOptimizationSuggestion suggestion = IntentOptimizationSuggestion.createPromotionSuggestion(
                    factoryId,
                    intentCode,
                    intent.getIntentName(),
                    request.getReason(),
                    request.getRequestedBy()
            );
            suggestionRepository.save(suggestion);

            Map<String, Object> result = new HashMap<>();
            result.put("suggestionId", suggestion.getId());
            result.put("status", "PENDING");
            result.put("message", "晋升请求已提交，等待平台管理员审批");

            log.info("工厂 [{}] 申请将意图 [{}] 晋升为平台级", factoryId, intentCode);
            return ResponseEntity.ok(ApiResponse.success("晋升请求已提交", result));

        } catch (Exception e) {
            log.error("请求晋升失败: factoryId={}, intentCode={}", factoryId, intentCode, e);
            return ResponseEntity.ok(ApiResponse.error("请求晋升失败: " + ErrorSanitizer.sanitize(e)));
        }
    }

    /**
     * 获取待审批的晋升请求列表 (平台管理员)
     */
    @Operation(summary = "获取待审批的晋升请求",
            description = "平台管理员查看所有待审批的意图晋升请求")
    @GetMapping("/platform/pending-promotions")
    public ResponseEntity<ApiResponse<List<IntentOptimizationSuggestion>>> getPendingPromotions(
            @Parameter(description = "工厂ID (用于路由，平台管理员可传PLATFORM)", example = "PLATFORM")
            @PathVariable String factoryId) {

        try {
            List<IntentOptimizationSuggestion> pendingPromotions = suggestionRepository
                    .findBySuggestionTypeAndStatus(
                            IntentOptimizationSuggestion.SuggestionType.PROMOTE_TO_PLATFORM,
                            IntentOptimizationSuggestion.SuggestionStatus.PENDING);

            return ResponseEntity.ok(ApiResponse.success(pendingPromotions));
        } catch (Exception e) {
            log.error("获取待审批晋升请求失败", e);
            return ResponseEntity.ok(ApiResponse.error("获取失败: " + ErrorSanitizer.sanitize(e)));
        }
    }

    /**
     * 审批意图晋升请求 (平台管理员)
     */
    @Operation(summary = "审批意图晋升请求",
            description = "平台管理员审批工厂级意图晋升为平台级的请求")
    @PostMapping("/platform/promotions/{suggestionId}/approve")
    public ResponseEntity<ApiResponse<Map<String, Object>>> approvePromotion(
            @Parameter(description = "工厂ID (用于路由，平台管理员可传PLATFORM)", example = "PLATFORM")
            @PathVariable String factoryId,
            @Parameter(description = "建议ID") @PathVariable String suggestionId,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    description = "审批信息",
                    content = @Content(schema = @Schema(implementation = ApprovalRequest.class)))
            @RequestBody ApprovalRequest request) {

        try {
            // 1. 查找建议
            Optional<IntentOptimizationSuggestion> suggestionOpt = suggestionRepository.findById(suggestionId);
            if (suggestionOpt.isEmpty()) {
                return ResponseEntity.ok(ApiResponse.error("晋升请求不存在"));
            }

            IntentOptimizationSuggestion suggestion = suggestionOpt.get();

            // 2. 验证类型和状态
            if (!suggestion.isPromoteToPlatform()) {
                return ResponseEntity.ok(ApiResponse.error("该建议不是晋升请求"));
            }
            if (suggestion.getStatus() != IntentOptimizationSuggestion.SuggestionStatus.PENDING) {
                return ResponseEntity.ok(ApiResponse.error("该请求已被处理"));
            }

            Map<String, Object> result = new HashMap<>();

            if (request.isApproved()) {
                // 3a. 审批通过 - 将意图晋升为平台级
                Optional<AIIntentConfig> intentOpt = intentConfigRepository
                        .findByFactoryIdAndIntentCode(suggestion.getFactoryId(), suggestion.getIntentCode());

                if (intentOpt.isEmpty()) {
                    return ResponseEntity.ok(ApiResponse.error("原意图已不存在"));
                }

                AIIntentConfig intent = intentOpt.get();

                // 备份原工厂ID，然后设为平台级
                String originalFactoryId = intent.getFactoryId();
                intent.setFactoryId(null); // null 表示平台级
                intent.setDescription(intent.getDescription() + " [由工厂 " + originalFactoryId + " 晋升]");
                intentConfigRepository.save(intent);

                // 更新建议状态
                suggestion.setStatus(IntentOptimizationSuggestion.SuggestionStatus.APPLIED);
                suggestion.setApprovalNotes("平台管理员审批通过: " + request.getNotes());
                suggestionRepository.save(suggestion);

                result.put("status", "APPROVED");
                result.put("intent", intent);
                result.put("message", "意图已晋升为平台级");

                log.info("意图 [{}] 从工厂 [{}] 晋升为平台级", suggestion.getIntentCode(), originalFactoryId);

            } else {
                // 3b. 审批拒绝
                suggestion.setStatus(IntentOptimizationSuggestion.SuggestionStatus.REJECTED);
                suggestion.setApprovalNotes("平台管理员拒绝: " + request.getNotes());
                suggestionRepository.save(suggestion);

                result.put("status", "REJECTED");
                result.put("message", "晋升请求已拒绝");

                log.info("意图 [{}] 晋升请求被拒绝", suggestion.getIntentCode());
            }

            return ResponseEntity.ok(ApiResponse.success(result));

        } catch (Exception e) {
            log.error("审批晋升请求失败: suggestionId={}", suggestionId, e);
            return ResponseEntity.ok(ApiResponse.error("审批失败: " + ErrorSanitizer.sanitize(e)));
        }
    }

    // ==================== 内部 DTO ====================

    @Data
    @Schema(description = "晋升请求")
    public static class PromotionRequest {
        @Schema(description = "晋升原因", example = "该意图具有通用性，其他工厂也可能需要")
        private String reason;

        @Schema(description = "申请人", example = "factory_admin1")
        private String requestedBy;
    }

    @Data
    @Schema(description = "审批请求")
    public static class ApprovalRequest {
        @Schema(description = "是否批准", example = "true")
        private boolean approved;

        @Schema(description = "审批备注", example = "同意晋升，该意图具有通用价值")
        private String notes;
    }
}

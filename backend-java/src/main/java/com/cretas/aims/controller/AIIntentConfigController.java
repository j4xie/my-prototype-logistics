package com.cretas.aims.controller;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.intent.CleanupRequest;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.intent.KeywordEffectiveness;
import com.cretas.aims.utils.JwtUtil;
import com.cretas.aims.service.AIIntentService;
import com.cretas.aims.service.IntentExecutorService;
import com.cretas.aims.service.KeywordEffectivenessService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

/**
 * AI意图配置控制器
 *
 * 提供AI意图识别配置的管理API:
 * - 意图配置的CRUD操作
 * - 意图识别测试
 * - 分类和权限查询
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/ai-intents")
@RequiredArgsConstructor
@Tag(name = "AI意图配置", description = "AI意图识别配置管理API")
public class AIIntentConfigController {

    private final AIIntentService aiIntentService;
    private final IntentExecutorService intentExecutorService;
    private final KeywordEffectivenessService keywordEffectivenessService;
    private final JwtUtil jwtUtil;

    // ==================== 意图查询 ====================

    @GetMapping
    @Operation(summary = "获取所有意图配置", description = "获取所有启用的AI意图配置列表")
    public ResponseEntity<ApiResponse<List<AIIntentConfig>>> getAllIntents(
            @Parameter(description = "工厂ID") @PathVariable String factoryId) {

        List<AIIntentConfig> intents = aiIntentService.getAllIntents();
        return ResponseEntity.ok(ApiResponse.success(intents));
    }

    @GetMapping("/category/{category}")
    @Operation(summary = "按分类获取意图", description = "根据分类获取意图配置列表")
    public ResponseEntity<ApiResponse<List<AIIntentConfig>>> getIntentsByCategory(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "意图分类 (ANALYSIS, DATA_OP, FORM, SCHEDULE, SYSTEM)")
            @PathVariable String category) {

        List<AIIntentConfig> intents = aiIntentService.getIntentsByCategory(category);
        return ResponseEntity.ok(ApiResponse.success(intents));
    }

    @GetMapping("/categories")
    @Operation(summary = "获取所有分类", description = "获取所有可用的意图分类列表")
    public ResponseEntity<ApiResponse<List<String>>> getAllCategories(
            @Parameter(description = "工厂ID") @PathVariable String factoryId) {

        List<String> categories = aiIntentService.getAllCategories();
        return ResponseEntity.ok(ApiResponse.success(categories));
    }

    @GetMapping("/sensitivity/{level}")
    @Operation(summary = "按敏感度获取意图", description = "根据敏感度级别获取意图配置")
    public ResponseEntity<ApiResponse<List<AIIntentConfig>>> getIntentsBySensitivity(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "敏感度级别 (LOW, MEDIUM, HIGH, CRITICAL)")
            @PathVariable String level) {

        List<AIIntentConfig> intents = aiIntentService.getIntentsBySensitivity(level);
        return ResponseEntity.ok(ApiResponse.success(intents));
    }

    @GetMapping("/keyword-stats")
    @Operation(summary = "获取关键词效果统计", description = "获取指定意图的关键词效果统计数据")
    public ResponseEntity<ApiResponse<List<KeywordEffectiveness>>> getKeywordStats(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "意图代码") @RequestParam(required = false) String intentCode,
            @Parameter(description = "效果阈值") @RequestParam(required = false, defaultValue = "0") java.math.BigDecimal threshold) {

        List<KeywordEffectiveness> stats = keywordEffectivenessService.getEffectiveKeywords(
                factoryId, intentCode, threshold);
        return ResponseEntity.ok(ApiResponse.success(stats));
    }

    @GetMapping("/keyword-stats/count")
    @Operation(summary = "获取关键词数量", description = "获取指定意图的关键词数量")
    public ResponseEntity<ApiResponse<Long>> getKeywordCount(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "意图代码") @RequestParam(required = false) String intentCode) {

        long count = keywordEffectivenessService.countKeywords(factoryId, intentCode);
        return ResponseEntity.ok(ApiResponse.success(count));
    }

    @PostMapping("/keywords/cleanup")
    @Operation(summary = "清理低效关键词", description = "清理效果评分低于阈值的关键词")
    public ResponseEntity<ApiResponse<Integer>> cleanupLowEffectivenessKeywords(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @RequestBody CleanupRequest request) {

        int cleaned = keywordEffectivenessService.cleanupLowEffectivenessKeywords(
                factoryId, request.getThreshold(), request.getMinNegative());
        log.info("Cleaned {} low-effectiveness keywords for factory {}", cleaned, factoryId);
        return ResponseEntity.ok(ApiResponse.success("清理完成，共删除 " + cleaned + " 个低效关键词", cleaned));
    }

    @GetMapping("/{intentCode}")
    @Operation(summary = "获取单个意图", description = "根据意图代码获取意图配置详情")
    public ResponseEntity<ApiResponse<AIIntentConfig>> getIntent(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "意图代码") @PathVariable String intentCode) {

        return aiIntentService.getIntentByCode(intentCode)
                .map(i -> ResponseEntity.ok(ApiResponse.success(i)))
                .orElse(ResponseEntity.ok(ApiResponse.error("意图配置不存在: " + intentCode)));
    }

    // ==================== 意图识别 ====================

    @PostMapping("/recognize")
    @Operation(summary = "测试意图识别", description = "输入文本测试意图识别结果")
    public ResponseEntity<ApiResponse<IntentRecognitionResult>> recognizeIntent(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @RequestBody IntentRecognitionRequest request) {

        log.debug("Recognizing intent for input: {}", request.getUserInput());

        Optional<AIIntentConfig> matchedIntent = aiIntentService.recognizeIntent(request.getUserInput());

        IntentRecognitionResult result = new IntentRecognitionResult();
        result.setUserInput(request.getUserInput());
        result.setMatched(matchedIntent.isPresent());

        if (matchedIntent.isPresent()) {
            AIIntentConfig intent = matchedIntent.get();
            result.setIntentCode(intent.getIntentCode());
            result.setIntentName(intent.getIntentName());
            result.setCategory(intent.getIntentCategory());
            result.setSensitivityLevel(intent.getSensitivityLevel());
            result.setQuotaCost(intent.getQuotaCost());
            result.setRequiresApproval(intent.needsApproval());
        }

        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/recognize-all")
    @Operation(summary = "识别所有匹配意图", description = "获取所有可能匹配的意图列表")
    public ResponseEntity<ApiResponse<List<AIIntentConfig>>> recognizeAllIntents(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @RequestBody IntentRecognitionRequest request) {

        List<AIIntentConfig> matchedIntents = aiIntentService.recognizeAllIntents(request.getUserInput());
        return ResponseEntity.ok(ApiResponse.success(matchedIntents));
    }

    // ==================== 意图执行 ====================

    @PostMapping("/execute")
    @Operation(summary = "执行AI意图", description = "识别用户输入的意图并执行对应操作")
    public ResponseEntity<ApiResponse<IntentExecuteResponse>> executeIntent(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @RequestBody IntentExecuteRequest request,
            @RequestHeader("Authorization") String authorization) {

        // 从JWT获取用户信息
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtUtil.getUserIdFromToken(token);
        String userRole = jwtUtil.getRoleFromToken(token);

        log.info("执行AI意图: factoryId={}, userInput={}, userId={}, role={}",
                factoryId,
                request.getUserInput().length() > 30 ?
                        request.getUserInput().substring(0, 30) + "..." : request.getUserInput(),
                userId, userRole);

        IntentExecuteResponse response = intentExecutorService.execute(factoryId, request, userId, userRole);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/preview")
    @Operation(summary = "预览AI意图执行结果", description = "识别意图并预览执行结果，不实际执行")
    public ResponseEntity<ApiResponse<IntentExecuteResponse>> previewIntent(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @RequestBody IntentExecuteRequest request,
            @RequestHeader("Authorization") String authorization) {

        String token = authorization.replace("Bearer ", "");
        Long userId = jwtUtil.getUserIdFromToken(token);
        String userRole = jwtUtil.getRoleFromToken(token);

        log.info("预览AI意图: factoryId={}, userInput={}", factoryId, request.getUserInput());

        IntentExecuteResponse response = intentExecutorService.preview(factoryId, request, userId, userRole);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/confirm/{confirmToken}")
    @Operation(summary = "确认执行预览的意图", description = "确认执行之前预览的意图操作")
    public ResponseEntity<ApiResponse<IntentExecuteResponse>> confirmIntent(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "确认Token") @PathVariable String confirmToken,
            @RequestHeader("Authorization") String authorization) {

        String token = authorization.replace("Bearer ", "");
        Long userId = jwtUtil.getUserIdFromToken(token);
        String userRole = jwtUtil.getRoleFromToken(token);

        log.info("确认执行AI意图: factoryId={}, confirmToken={}", factoryId, confirmToken);

        IntentExecuteResponse response = intentExecutorService.confirm(factoryId, confirmToken, userId, userRole);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    // ==================== 权限查询 ====================

    @GetMapping("/{intentCode}/permission")
    @Operation(summary = "检查意图权限", description = "检查指定角色是否有权限执行意图")
    public ResponseEntity<ApiResponse<PermissionCheckResult>> checkPermission(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "意图代码") @PathVariable String intentCode,
            @Parameter(description = "用户角色") @RequestParam String userRole) {

        boolean hasPermission = aiIntentService.hasPermission(intentCode, userRole);
        boolean requiresApproval = aiIntentService.requiresApproval(intentCode);
        int quotaCost = aiIntentService.getQuotaCost(intentCode);

        PermissionCheckResult result = new PermissionCheckResult();
        result.setIntentCode(intentCode);
        result.setUserRole(userRole);
        result.setHasPermission(hasPermission);
        result.setRequiresApproval(requiresApproval);
        result.setQuotaCost(quotaCost);

        return ResponseEntity.ok(ApiResponse.success(result));
    }

    // ==================== 意图管理 ====================

    @PostMapping
    @Operation(summary = "创建意图配置", description = "创建新的AI意图配置")
    public ResponseEntity<ApiResponse<AIIntentConfig>> createIntent(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @RequestBody AIIntentConfig intentConfig) {

        AIIntentConfig created = aiIntentService.createIntent(intentConfig);
        log.info("Created AI intent: {} for factory context: {}", intentConfig.getIntentCode(), factoryId);
        return ResponseEntity.ok(ApiResponse.success("意图配置创建成功", created));
    }

    @PutMapping("/{intentCode}")
    @Operation(summary = "更新意图配置", description = "更新现有的AI意图配置")
    public ResponseEntity<ApiResponse<AIIntentConfig>> updateIntent(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "意图代码") @PathVariable String intentCode,
            @RequestBody AIIntentConfig intentConfig) {

        intentConfig.setIntentCode(intentCode);
        AIIntentConfig updated = aiIntentService.updateIntent(intentConfig);
        log.info("Updated AI intent: {}", intentCode);
        return ResponseEntity.ok(ApiResponse.success("意图配置更新成功", updated));
    }

    @PatchMapping("/{intentCode}/active")
    @Operation(summary = "启用/禁用意图", description = "切换意图的启用状态")
    public ResponseEntity<ApiResponse<Void>> setIntentActive(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "意图代码") @PathVariable String intentCode,
            @RequestBody ActiveStatusRequest request) {

        aiIntentService.setIntentActive(intentCode, request.isActive());
        String action = request.isActive() ? "启用" : "禁用";
        log.info("{} AI intent: {}", action, intentCode);
        return ResponseEntity.ok(ApiResponse.successMessage("意图已" + action));
    }

    @DeleteMapping("/{intentCode}")
    @Operation(summary = "删除意图配置", description = "软删除意图配置")
    public ResponseEntity<ApiResponse<Void>> deleteIntent(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "意图代码") @PathVariable String intentCode) {

        aiIntentService.deleteIntent(intentCode);
        log.info("Deleted AI intent: {}", intentCode);
        return ResponseEntity.ok(ApiResponse.successMessage("意图配置删除成功"));
    }

    // ==================== 反馈记录 ====================

    @PostMapping("/feedback/positive")
    @Operation(summary = "记录正向反馈", description = "当用户确认意图匹配正确时调用，用于关键词效果追踪")
    public ResponseEntity<ApiResponse<Void>> recordPositiveFeedback(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @RequestBody PositiveFeedbackRequest request) {

        log.info("记录正向反馈: factoryId={}, intentCode={}, keywords={}",
                factoryId, request.getIntentCode(), request.getMatchedKeywords());

        aiIntentService.recordPositiveFeedback(
                factoryId,
                request.getIntentCode(),
                request.getMatchedKeywords());

        return ResponseEntity.ok(ApiResponse.successMessage("正向反馈已记录"));
    }

    @PostMapping("/feedback/negative")
    @Operation(summary = "记录负向反馈", description = "当用户拒绝匹配结果并选择其他意图时调用")
    public ResponseEntity<ApiResponse<Void>> recordNegativeFeedback(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @RequestBody NegativeFeedbackRequest request) {

        log.info("记录负向反馈: factoryId={}, rejected={}, selected={}, keywords={}",
                factoryId, request.getRejectedIntentCode(),
                request.getSelectedIntentCode(), request.getMatchedKeywords());

        aiIntentService.recordNegativeFeedback(
                factoryId,
                request.getRejectedIntentCode(),
                request.getSelectedIntentCode(),
                request.getMatchedKeywords());

        return ResponseEntity.ok(ApiResponse.successMessage("负向反馈已记录"));
    }

    // ==================== 缓存管理 ====================

    @PostMapping("/cache/refresh")
    @Operation(summary = "刷新意图缓存", description = "清除并重新加载意图配置缓存")
    public ResponseEntity<ApiResponse<Void>> refreshCache(
            @Parameter(description = "工厂ID") @PathVariable String factoryId) {

        aiIntentService.refreshCache();
        log.info("Refreshed AI intent cache");
        return ResponseEntity.ok(ApiResponse.successMessage("意图缓存已刷新"));
    }

    @PostMapping("/cache/clear")
    @Operation(summary = "清除意图缓存", description = "清除意图配置缓存")
    public ResponseEntity<ApiResponse<Void>> clearCache(
            @Parameter(description = "工厂ID") @PathVariable String factoryId) {

        aiIntentService.clearCache();
        log.info("Cleared AI intent cache");
        return ResponseEntity.ok(ApiResponse.successMessage("意图缓存已清除"));
    }

    // ==================== DTO Classes ====================

    /**
     * 意图识别请求
     */
    @lombok.Data
    public static class IntentRecognitionRequest {
        private String userInput;
    }

    /**
     * 意图识别结果
     */
    @lombok.Data
    public static class IntentRecognitionResult {
        private String userInput;
        private boolean matched;
        private String intentCode;
        private String intentName;
        private String category;
        private String sensitivityLevel;
        private Integer quotaCost;
        private Boolean requiresApproval;
    }

    /**
     * 权限检查结果
     */
    @lombok.Data
    public static class PermissionCheckResult {
        private String intentCode;
        private String userRole;
        private boolean hasPermission;
        private boolean requiresApproval;
        private int quotaCost;
    }

    /**
     * 启用状态请求
     */
    @lombok.Data
    public static class ActiveStatusRequest {
        private boolean active;
    }

    /**
     * 正向反馈请求
     */
    @lombok.Data
    public static class PositiveFeedbackRequest {
        /** 意图代码 */
        private String intentCode;
        /** 匹配到的关键词列表 */
        private java.util.List<String> matchedKeywords;
    }

    /**
     * 负向反馈请求
     */
    @lombok.Data
    public static class NegativeFeedbackRequest {
        /** 被拒绝的意图代码 */
        private String rejectedIntentCode;
        /** 用户选择的正确意图代码 */
        private String selectedIntentCode;
        /** 原匹配到的关键词列表 */
        private java.util.List<String> matchedKeywords;
    }
}

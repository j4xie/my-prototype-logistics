package com.cretas.aims.controller.admin;

import com.cretas.aims.ai.discriminator.DiscriminatorResult;
import com.cretas.aims.ai.discriminator.FlanT5Config;
import com.cretas.aims.ai.discriminator.FlanT5DiscriminatorService;
import com.cretas.aims.ai.discriminator.InputValidator;
import com.cretas.aims.ai.discriminator.JudgeAutoTuner;
import com.cretas.aims.dto.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Admin controller for JudgeRLVR Discriminator management.
 *
 * <p>Provides endpoints for:
 * <ul>
 *   <li>Testing discriminator judgments</li>
 *   <li>Viewing metrics and statistics</li>
 *   <li>Adjusting configuration parameters</li>
 *   <li>Cache management</li>
 * </ul>
 *
 * @author Cretas AI Team
 * @since 1.0.0
 */
@Slf4j
@RestController
@RequestMapping("/api/admin/discriminator")
@RequiredArgsConstructor
@Tag(name = "Discriminator Admin", description = "JudgeRLVR 判别器管理接口")
public class DiscriminatorController {

    private final FlanT5DiscriminatorService discriminatorService;
    private final FlanT5Config config;
    private final JudgeAutoTuner autoTuner;

    // ==================== Test Endpoints ====================

    /**
     * Test single judgment
     */
    @PostMapping("/judge")
    @Operation(summary = "测试单个判别", description = "判断用户输入是否匹配指定意图")
    public ResponseEntity<ApiResponse<DiscriminatorResult>> judge(
            @RequestBody JudgeRequest request
    ) {
        log.info("Testing judgment: input='{}', intent='{}'",
                request.getUserInput(), request.getIntentCode());

        DiscriminatorResult result = discriminatorService.judge(
                request.getUserInput(),
                request.getIntentCode()
        );

        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * Batch judgment test
     */
    @PostMapping("/batch-judge")
    @Operation(summary = "批量判别测试", description = "批量判断用户输入对多个意图的匹配度")
    public ResponseEntity<ApiResponse<Map<String, Double>>> batchJudge(
            @RequestBody BatchJudgeRequest request
    ) {
        log.info("Testing batch judgment: input='{}', intents={}",
                request.getUserInput(), request.getIntentCodes().size());

        Map<String, Double> scores = discriminatorService.batchJudge(
                request.getUserInput(),
                request.getIntentCodes()
        );

        return ResponseEntity.ok(ApiResponse.success(scores));
    }

    /**
     * Test pruning
     */
    @PostMapping("/prune")
    @Operation(summary = "测试剪枝", description = "测试候选剪枝逻辑")
    public ResponseEntity<ApiResponse<List<String>>> testPrune(
            @RequestBody PruneRequest request
    ) {
        log.info("Testing pruning: input='{}', candidates={}, isWriteOp={}",
                request.getUserInput(), request.getCandidates().size(),
                request.isWriteOperation());

        List<String> pruned = discriminatorService.judgeAndPrune(
                request.getUserInput(),
                request.getCandidates(),
                request.isWriteOperation()
        );

        return ResponseEntity.ok(ApiResponse.success(pruned));
    }

    /**
     * Validate user input
     */
    @PostMapping("/validate")
    @Operation(summary = "验证输入", description = "验证用户输入质量，检测模糊、无关、写操作等")
    public ResponseEntity<ApiResponse<InputValidator.ValidationResult>> validateInput(
            @RequestBody ValidateRequest request
    ) {
        log.info("Validating input: '{}'", request.getUserInput());

        InputValidator.ValidationResult result = discriminatorService.validateInput(
                request.getUserInput()
        );

        return ResponseEntity.ok(ApiResponse.success(result));
    }

    // ==================== Metrics Endpoints ====================

    /**
     * Get discriminator metrics
     */
    @GetMapping("/metrics")
    @Operation(summary = "获取判别器指标", description = "获取判别器运行指标")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getMetrics() {
        Map<String, Object> metrics = new HashMap<>();
        metrics.put("discriminator", discriminatorService.getMetrics());
        metrics.put("autoTuner", autoTuner.getMetrics());
        return ResponseEntity.ok(ApiResponse.success(metrics));
    }

    /**
     * Get intent-level statistics
     */
    @GetMapping("/intent-stats")
    @Operation(summary = "获取意图统计", description = "获取按意图分组的统计数据")
    public ResponseEntity<ApiResponse<Map<String, JudgeAutoTuner.IntentStats>>> getIntentStats() {
        return ResponseEntity.ok(ApiResponse.success(autoTuner.getAllIntentStats()));
    }

    /**
     * Get current configuration
     */
    @GetMapping("/config")
    @Operation(summary = "获取配置", description = "获取当前判别器配置")
    public ResponseEntity<ApiResponse<FlanT5Config>> getConfig() {
        return ResponseEntity.ok(ApiResponse.success(config));
    }

    // ==================== Configuration Endpoints ====================

    /**
     * Update pruning threshold
     */
    @PutMapping("/config/prune-threshold")
    @Operation(summary = "更新剪枝阈值", description = "动态调整剪枝阈值")
    public ResponseEntity<ApiResponse<String>> updatePruneThreshold(
            @RequestParam double threshold
    ) {
        if (threshold < 0 || threshold > 1) {
            return ResponseEntity.badRequest().body(
                    ApiResponse.error("阈值必须在 0-1 之间"));
        }

        double oldThreshold = config.getPruneThreshold();
        config.setPruneThreshold(threshold);

        log.info("Updated prune threshold: {} -> {}", oldThreshold, threshold);
        return ResponseEntity.ok(ApiResponse.success(
                String.format("剪枝阈值已更新: %.2f -> %.2f", oldThreshold, threshold)));
    }

    /**
     * Toggle discriminator enabled status
     */
    @PutMapping("/config/enabled")
    @Operation(summary = "启用/禁用判别器", description = "切换判别器启用状态")
    public ResponseEntity<ApiResponse<String>> toggleEnabled(
            @RequestParam boolean enabled
    ) {
        config.setEnabled(enabled);
        log.info("Discriminator enabled status changed to: {}", enabled);
        return ResponseEntity.ok(ApiResponse.success(
                enabled ? "判别器已启用" : "判别器已禁用"));
    }

    // ==================== Management Endpoints ====================

    /**
     * Clear discriminator cache
     */
    @PostMapping("/cache/clear")
    @Operation(summary = "清除缓存", description = "清除判别结果缓存")
    public ResponseEntity<ApiResponse<String>> clearCache() {
        discriminatorService.clearCache();
        return ResponseEntity.ok(ApiResponse.success("缓存已清除"));
    }

    /**
     * Reset metrics counters
     */
    @PostMapping("/metrics/reset")
    @Operation(summary = "重置指标", description = "重置判别器指标计数器")
    public ResponseEntity<ApiResponse<String>> resetMetrics() {
        discriminatorService.resetMetrics();
        return ResponseEntity.ok(ApiResponse.success("指标已重置"));
    }

    /**
     * Reset auto-tuner statistics
     */
    @PostMapping("/auto-tuner/reset")
    @Operation(summary = "重置自动调参", description = "重置自动调参统计数据")
    public ResponseEntity<ApiResponse<String>> resetAutoTuner() {
        autoTuner.reset();
        return ResponseEntity.ok(ApiResponse.success("自动调参已重置"));
    }

    /**
     * Refresh intent descriptions
     */
    @PostMapping("/intent-descriptions/refresh")
    @Operation(summary = "刷新意图描述", description = "从数据库重新加载意图描述")
    public ResponseEntity<ApiResponse<String>> refreshIntentDescriptions() {
        discriminatorService.refreshIntentDescriptions();
        return ResponseEntity.ok(ApiResponse.success("意图描述已刷新"));
    }

    // ==================== Request DTOs ====================

    @Data
    public static class JudgeRequest {
        private String userInput;
        private String intentCode;
    }

    @Data
    public static class BatchJudgeRequest {
        private String userInput;
        private List<String> intentCodes;
    }

    @Data
    public static class PruneRequest {
        private String userInput;
        private List<String> candidates;
        private boolean writeOperation;
    }

    @Data
    public static class ValidateRequest {
        private String userInput;
    }
}

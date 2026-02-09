package com.cretas.aims.controller;

import com.cretas.aims.ai.synthetic.SyntheticDataService;
import com.cretas.aims.ai.synthetic.SyntheticDataService.IntentSampleStat;
import com.cretas.aims.ai.synthetic.SyntheticDataService.SyntheticDataStats;
import com.cretas.aims.ai.synthetic.SyntheticDataService.SyntheticGenerationResult;
import com.cretas.aims.service.MixedTrainingDataService;
import com.cretas.aims.dto.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 合成数据管理 API
 * 用于测试和管理 EnvScaler 合成数据生成
 *
 * @author Cretas Team
 * @since 2026-01-22
 */
@Slf4j
@RestController
@RequestMapping("/api/admin/synthetic")
@Tag(name = "合成数据管理", description = "EnvScaler 合成数据生成和管理")
@RequiredArgsConstructor
public class SyntheticDataController {

    private final SyntheticDataService syntheticDataService;
    private final MixedTrainingDataService mixedTrainingDataService;

    /**
     * 为指定意图生成合成数据
     */
    @PostMapping("/generate/{factoryId}/{intentCode}")
    @Operation(summary = "为指定意图生成合成数据")
    public ApiResponse<SyntheticGenerationResult> generateForIntent(
            @PathVariable String factoryId,
            @PathVariable String intentCode,
            @RequestParam(defaultValue = "10") int targetCount) {

        log.info("API 触发合成数据生成: factory={}, intent={}, target={}",
                factoryId, intentCode, targetCount);

        SyntheticGenerationResult result = syntheticDataService.generateForIntent(
                intentCode, factoryId, targetCount);

        return ApiResponse.success(result);
    }

    /**
     * 为工厂所有意图生成合成数据
     */
    @PostMapping("/generate-all/{factoryId}")
    @Operation(summary = "为工厂所有意图生成合成数据")
    public ApiResponse<List<SyntheticGenerationResult>> generateForAllIntents(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "10") int samplesPerIntent) {

        log.info("API 触发全量合成数据生成: factory={}, perIntent={}",
                factoryId, samplesPerIntent);

        List<SyntheticGenerationResult> results = syntheticDataService.generateForAllIntents(
                factoryId, samplesPerIntent);

        return ApiResponse.success(results);
    }

    /**
     * 获取合成数据统计
     */
    @GetMapping("/stats/{factoryId}")
    @Operation(summary = "获取合成数据统计")
    public ApiResponse<SyntheticDataStats> getStats(@PathVariable String factoryId) {
        SyntheticDataStats stats = syntheticDataService.getStats(factoryId);
        return ApiResponse.success(stats);
    }

    /**
     * 检查合成数据比例限制
     */
    @GetMapping("/ratio-check/{factoryId}")
    @Operation(summary = "检查合成数据比例")
    public ApiResponse<Boolean> checkRatioLimit(@PathVariable String factoryId) {
        boolean canGenerate = syntheticDataService.checkRatioLimit(factoryId);
        return ApiResponse.success(canGenerate);
    }

    // ==================== P0/P1 修复: GRAPE 分数重新计算和低频意图扩充 ====================

    /**
     * 重新计算所有合成样本的 GRAPE 分数
     * P0 修复: 修复 GRAPE 评分机制后需要重新计算已有样本
     */
    @PostMapping("/recalculate-grape/{factoryId}")
    @Operation(summary = "重新计算 GRAPE 分数",
               description = "修复 GRAPE 评分机制后，重新计算所有合成样本的分数")
    public ApiResponse<RecalculateResult> recalculateGrapeScores(@PathVariable String factoryId) {
        log.info("API 触发 GRAPE 分数重新计算: factory={}", factoryId);

        int updated = syntheticDataService.recalculateGrapeScores(factoryId);

        return ApiResponse.success(RecalculateResult.builder()
                .factoryId(factoryId)
                .updatedCount(updated)
                .timestamp(java.time.LocalDateTime.now())
                .build());
    }

    /**
     * 修复合成样本使其可用于训练
     * 设置 isCorrect=true 和 confidence（如果缺失）
     */
    @PostMapping("/fix-for-training/{factoryId}")
    @Operation(summary = "修复合成样本",
               description = "设置 isCorrect=true 和 confidence，使合成样本可用于混合训练")
    public ApiResponse<RecalculateResult> fixSyntheticSamplesForTraining(@PathVariable String factoryId) {
        log.info("API 触发合成样本修复: factory={}", factoryId);

        int fixed = syntheticDataService.fixSyntheticSamplesForTraining(factoryId);

        return ApiResponse.success(RecalculateResult.builder()
                .factoryId(factoryId)
                .updatedCount(fixed)
                .timestamp(java.time.LocalDateTime.now())
                .build());
    }

    /**
     * 为低频意图生成合成数据
     * P1 修复: 扩充真实样本少且无合成样本覆盖的意图
     */
    @PostMapping("/generate-low-frequency/{factoryId}")
    @Operation(summary = "为低频意图生成合成数据",
               description = "为真实样本少于阈值且无合成样本的意图生成训练数据")
    public ApiResponse<List<SyntheticGenerationResult>> generateForLowFrequencyIntents(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "10") int minRealSamples,
            @RequestParam(defaultValue = "20") int targetSynthetic) {

        log.info("API 触发低频意图合成数据生成: factory={}, minReal={}, target={}",
                factoryId, minRealSamples, targetSynthetic);

        List<SyntheticGenerationResult> results = syntheticDataService.generateForLowFrequencyIntents(
                factoryId, minRealSamples, targetSynthetic);

        return ApiResponse.success(results);
    }

    /**
     * 获取意图样本统计 (用于分析低频意图)
     */
    @GetMapping("/intent-stats/{factoryId}")
    @Operation(summary = "获取意图样本统计",
               description = "查看各意图的真实和合成样本数量")
    public ApiResponse<List<IntentSampleStat>> getIntentSampleStats(@PathVariable String factoryId) {
        log.info("API 获取意图样本统计: factory={}", factoryId);

        List<IntentSampleStat> stats = syntheticDataService.getIntentSampleStats(factoryId);

        return ApiResponse.success(stats);
    }

    // ==================== 闭环测试: 混合训练数据 ====================

    /**
     * 获取混合训练数据统计 (闭环验证)
     * 验证合成数据是否被正确纳入训练集
     */
    @GetMapping("/mixed-training/{factoryId}")
    @Operation(summary = "获取混合训练数据统计",
               description = "验证合成数据是否被正确纳入训练集 (闭环测试)")
    public ApiResponse<java.util.Map<String, Object>> getMixedTrainingStats(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "0.6") double minConfidence) {

        log.info("API 获取混合训练数据统计: factory={}, minConfidence={}", factoryId, minConfidence);

        java.util.Map<String, Object> stats = mixedTrainingDataService.getMixedTrainingStats(
                factoryId, java.math.BigDecimal.valueOf(minConfidence));

        return ApiResponse.success(stats);
    }

    // ==================== DTO ====================

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class RecalculateResult {
        private String factoryId;
        private int updatedCount;
        private java.time.LocalDateTime timestamp;
    }

}

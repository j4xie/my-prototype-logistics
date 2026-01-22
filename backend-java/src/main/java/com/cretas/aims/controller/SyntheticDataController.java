package com.cretas.aims.controller;

import com.cretas.aims.ai.synthetic.SyntheticDataService;
import com.cretas.aims.ai.synthetic.SyntheticDataService.SyntheticDataStats;
import com.cretas.aims.ai.synthetic.SyntheticDataService.SyntheticGenerationResult;
import com.cretas.aims.dto.ApiResponse;
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
}

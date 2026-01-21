package com.joolun.mall.controller;

import com.joolun.common.core.domain.R;
import com.joolun.mall.service.CTRPredictionService;
import com.joolun.mall.service.FeedbackProcessorService;
import com.joolun.mall.service.SimulatedFeedbackService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 反馈管理 API
 * 提供模拟反馈生成、CTR模型训练和反馈处理等功能
 *
 * @author Recommendation Enhancement
 * @since 2026-01-20
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/recommend/feedback")
@Tag(name = "反馈管理", description = "反馈管理API - 模拟反馈生成、CTR模型训练、反馈处理")
public class FeedbackController {

    private final SimulatedFeedbackService simulatedFeedbackService;
    private final FeedbackProcessorService feedbackProcessorService;
    private final CTRPredictionService ctrPredictionService;

    /**
     * 生成模拟反馈
     * 基于用户画像和聚类信息生成模拟的点击/购买反馈
     *
     * @param days 处理的天数范围，默认7天
     * @return 处理统计信息
     */
    @PostMapping("/simulate")
    @Operation(summary = "生成模拟反馈", description = "基于用户画像和聚类信息生成模拟的点击/购买反馈，用于训练CTR模型")
    public R<Map<String, Object>> generateSimulatedFeedback(
            @Parameter(description = "处理的天数范围") @RequestParam(defaultValue = "7") int days) {
        log.info("生成模拟反馈请求, days={}", days);
        try {
            Map<String, Object> result = simulatedFeedbackService.generateSimulatedFeedback(days);
            log.info("模拟反馈生成完成: {}", result);
            return R.ok(result);
        } catch (Exception e) {
            log.error("生成模拟反馈失败", e);
            return R.fail("生成模拟反馈失败: " + e.getMessage());
        }
    }

    /**
     * 训练CTR模型
     * 从反馈数据训练CTR预测模型
     *
     * @return 训练统计信息
     */
    @PostMapping("/train-ctr")
    @Operation(summary = "训练CTR模型", description = "从反馈数据训练CTR预测模型")
    public R<Map<String, Object>> trainCTRModel() {
        log.info("CTR模型训练请求");
        try {
            Map<String, Object> result = simulatedFeedbackService.trainCTRModelFromFeedback();
            log.info("CTR模型训练完成: {}", result);
            return R.ok(result);
        } catch (Exception e) {
            log.error("CTR模型训练失败", e);
            return R.fail("CTR模型训练失败: " + e.getMessage());
        }
    }

    /**
     * 获取CTR模型统计信息
     * 包含模型参数、训练样本数、特征重要性等
     *
     * @return CTR模型统计信息
     */
    @GetMapping("/ctr-stats")
    @Operation(summary = "获取CTR模型统计", description = "获取CTR模型的统计信息，包含训练样本数、正样本率、特征重要性等")
    public R<Map<String, Object>> getCTRModelStats() {
        log.info("获取CTR模型统计请求");
        try {
            Map<String, Object> stats = ctrPredictionService.getModelStats();
            return R.ok(stats);
        } catch (Exception e) {
            log.error("获取CTR模型统计失败", e);
            return R.fail("获取CTR模型统计失败: " + e.getMessage());
        }
    }

    /**
     * 手动处理反馈
     * 处理真实用户反馈，将点击/购买事件关联到推荐日志
     *
     * @return 处理统计信息
     */
    @PostMapping("/process")
    @Operation(summary = "手动处理反馈", description = "处理真实用户反馈，将点击/购买事件关联到推荐日志并更新CTR模型")
    public R<Map<String, Object>> processFeedback() {
        log.info("手动处理反馈请求");
        try {
            Map<String, Object> result = feedbackProcessorService.processRealFeedback();
            log.info("反馈处理完成: {}", result);
            return R.ok(result);
        } catch (Exception e) {
            log.error("处理反馈失败", e);
            return R.fail("处理反馈失败: " + e.getMessage());
        }
    }

    /**
     * 获取反馈处理统计信息
     * 包含总处理数、真实反馈数、模拟反馈数等
     *
     * @return 反馈处理统计信息
     */
    @GetMapping("/stats")
    @Operation(summary = "获取反馈处理统计", description = "获取反馈处理的整体统计信息")
    public R<Map<String, Object>> getFeedbackStats() {
        log.info("获取反馈处理统计请求");
        try {
            Map<String, Object> stats = feedbackProcessorService.getProcessingStats();
            return R.ok(stats);
        } catch (Exception e) {
            log.error("获取反馈处理统计失败", e);
            return R.fail("获取反馈处理统计失败: " + e.getMessage());
        }
    }
}

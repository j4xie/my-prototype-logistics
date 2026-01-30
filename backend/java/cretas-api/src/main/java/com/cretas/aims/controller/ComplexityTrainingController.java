package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.service.ComplexityClassifier;
import com.cretas.aims.service.ComplexityTrainingService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * 复杂度分类器训练 API
 *
 * 提供训练接口和测试接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Slf4j
@RestController
@RequestMapping("/api/ai/complexity")
public class ComplexityTrainingController {

    @Autowired
    private ComplexityTrainingService trainingService;

    @Autowired
    private ComplexityClassifier classifier;

    /**
     * 触发训练
     *
     * @param samplesPerLevel 每个等级的样本数 (默认 20)
     */
    @PostMapping("/train")
    public ApiResponse<Map<String, Object>> train(
            @RequestParam(defaultValue = "20") int samplesPerLevel) {

        log.info("收到训练请求，samplesPerLevel={}", samplesPerLevel);

        try {
            // 使用当前工作目录下的 config 目录
            String modelPath = "config/complexity_classifier.json";
            trainingService.trainAndSave(samplesPerLevel, modelPath);

            // 重新加载分类器
            classifier.reload();

            Map<String, Object> result = new HashMap<>();
            result.put("status", "success");
            result.put("samplesPerLevel", samplesPerLevel);
            result.put("totalSamples", samplesPerLevel * 5);
            result.put("modelPath", modelPath);
            result.put("classifierReady", classifier.isTrained());

            return ApiResponse.success(result);
        } catch (Exception e) {
            log.error("训练失败", e);
            return ApiResponse.error("训练失败: " + e.getMessage());
        }
    }

    /**
     * 测试分类器
     *
     * @param text 测试文本
     */
    @PostMapping("/test")
    public ApiResponse<Map<String, Object>> test(@RequestParam String text) {
        if (!classifier.isTrained()) {
            return ApiResponse.error("分类器未训练，请先调用 /train 接口");
        }

        try {
            var mode = classifier.predict(text);
            var score = classifier.predictScore(text);
            var probs = classifier.predictProbabilities(text);

            Map<String, Object> result = new HashMap<>();
            result.put("input", text);
            result.put("mode", mode.name());
            result.put("modeDisplayName", mode.getDisplayName());
            result.put("score", score);

            Map<String, Double> probsMap = new HashMap<>();
            for (int i = 0; i < probs.length; i++) {
                probsMap.put("level" + (i + 1), Math.round(probs[i] * 1000) / 1000.0);
            }
            result.put("probabilities", probsMap);

            return ApiResponse.success(result);
        } catch (Exception e) {
            log.error("测试失败", e);
            return ApiResponse.error("测试失败: " + e.getMessage());
        }
    }

    /**
     * 获取分类器状态
     */
    @GetMapping("/status")
    public ApiResponse<Map<String, Object>> status() {
        Map<String, Object> result = new HashMap<>();
        result.put("trained", classifier.isTrained());
        return ApiResponse.success(result);
    }

    /**
     * 从预定义数据文件训练
     * 使用 Claude 生成的高质量训练数据
     */
    @PostMapping("/train-from-file")
    public ApiResponse<Map<String, Object>> trainFromFile() {
        log.info("从预定义数据文件训练分类器...");

        try {
            // 加载训练数据并训练
            var samples = trainingService.loadTrainingDataFromFile("config/training_data.json");
            var model = trainingService.train(samples);

            // 保存模型
            String modelPath = "config/complexity_classifier.json";
            trainingService.saveModel(model, modelPath);

            // 重新加载分类器
            classifier.reload();

            Map<String, Object> result = new HashMap<>();
            result.put("status", "success");
            result.put("totalSamples", samples.size());
            result.put("modelPath", modelPath);
            result.put("classifierReady", classifier.isTrained());

            return ApiResponse.success(result);
        } catch (Exception e) {
            log.error("从文件训练失败", e);
            return ApiResponse.error("训练失败: " + e.getMessage());
        }
    }
}

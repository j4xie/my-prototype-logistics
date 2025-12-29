package com.cretas.aims.controller;

import com.cretas.aims.entity.ml.LinUCBModel;
import com.cretas.aims.service.LinUCBService;
import com.cretas.aims.service.LinUCBService.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.math.BigDecimal;
import java.util.*;

/**
 * LinUCB人员分配算法API控制器
 *
 * 提供工人推荐、模型管理、反馈收集等端点
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/scheduling/linucb")
@RequiredArgsConstructor
public class LinUCBController {

    private final LinUCBService linUCBService;

    // ==================== 工人推荐 ====================

    /**
     * 获取AI推荐的工人分配列表
     *
     * POST /api/mobile/{factoryId}/scheduling/linucb/recommend-workers
     *
     * Request Body:
     * {
     *   "taskFeatures": {
     *     "quantity": 500,
     *     "deadlineHours": 8,
     *     "productType": "frozen_fish",
     *     "priority": 8,
     *     "complexity": 3,
     *     "workshopId": "WS001"
     *   },
     *   "candidateWorkerIds": [1, 2, 3, 4, 5]
     * }
     */
    @PostMapping("/recommend-workers")
    public ResponseEntity<Map<String, Object>> recommendWorkers(
            @PathVariable String factoryId,
            @RequestBody Map<String, Object> request) {

        Map<String, Object> response = new HashMap<>();

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> taskFeatures = (Map<String, Object>) request.get("taskFeatures");
            @SuppressWarnings("unchecked")
            List<Number> candidateIds = (List<Number>) request.get("candidateWorkerIds");

            if (taskFeatures == null || candidateIds == null || candidateIds.isEmpty()) {
                response.put("success", false);
                response.put("message", "缺少必要参数: taskFeatures 或 candidateWorkerIds");
                return ResponseEntity.badRequest().body(response);
            }

            // 提取任务特征
            double[] taskFeatureArray = linUCBService.extractTaskFeatures(taskFeatures);

            // 转换工人ID列表
            List<Long> workerIds = new ArrayList<>();
            for (Number id : candidateIds) {
                workerIds.add(id.longValue());
            }

            // 获取推荐
            List<WorkerRecommendation> recommendations =
                    linUCBService.recommendWorkers(factoryId, taskFeatureArray, workerIds);

            response.put("success", true);
            response.put("data", recommendations);
            response.put("message", "获取推荐成功");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("获取工人推荐失败: {}", e.getMessage(), e);
            response.put("success", false);
            response.put("message", "获取推荐失败: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    /**
     * 计算单个工人的UCB分数
     *
     * POST /api/mobile/{factoryId}/scheduling/linucb/compute-ucb
     */
    @PostMapping("/compute-ucb")
    public ResponseEntity<Map<String, Object>> computeUCB(
            @PathVariable String factoryId,
            @RequestBody Map<String, Object> request) {

        Map<String, Object> response = new HashMap<>();

        try {
            Long workerId = ((Number) request.get("workerId")).longValue();
            @SuppressWarnings("unchecked")
            List<Number> contextList = (List<Number>) request.get("context");

            if (workerId == null || contextList == null) {
                response.put("success", false);
                response.put("message", "缺少必要参数: workerId 或 context");
                return ResponseEntity.badRequest().body(response);
            }

            // 转换上下文向量
            double[] context = new double[contextList.size()];
            for (int i = 0; i < contextList.size(); i++) {
                context[i] = contextList.get(i).doubleValue();
            }

            BigDecimal ucbScore = linUCBService.computeUCB(factoryId, workerId, context);

            response.put("success", true);
            response.put("data", Map.of(
                    "workerId", workerId,
                    "ucbScore", ucbScore
            ));

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("计算UCB分数失败: {}", e.getMessage(), e);
            response.put("success", false);
            response.put("message", "计算失败: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    // ==================== 反馈记录 ====================

    /**
     * 记录工人分配（分配时调用）
     *
     * POST /api/mobile/{factoryId}/scheduling/linucb/record-allocation
     */
    @PostMapping("/record-allocation")
    public ResponseEntity<Map<String, Object>> recordAllocation(
            @PathVariable String factoryId,
            @RequestBody Map<String, Object> request,
            HttpServletRequest httpRequest) {

        Map<String, Object> response = new HashMap<>();

        try {
            String taskId = (String) request.get("taskId");
            String taskType = (String) request.get("taskType");
            Long workerId = ((Number) request.get("workerId")).longValue();
            String workerCode = (String) request.get("workerCode");

            @SuppressWarnings("unchecked")
            Map<String, Object> taskFeatures = (Map<String, Object>) request.get("taskFeatures");
            @SuppressWarnings("unchecked")
            Map<String, Object> workerFeatures = (Map<String, Object>) request.get("workerFeatures");

            BigDecimal predictedScore = request.get("predictedScore") != null ?
                    new BigDecimal(request.get("predictedScore").toString()) : null;
            BigDecimal plannedQuantity = request.get("plannedQuantity") != null ?
                    new BigDecimal(request.get("plannedQuantity").toString()) : null;
            BigDecimal plannedHours = request.get("plannedHours") != null ?
                    new BigDecimal(request.get("plannedHours").toString()) : null;

            // 提取并合并特征
            double[] taskFeatureArray = linUCBService.extractTaskFeatures(
                    taskFeatures != null ? taskFeatures : new HashMap<>());
            double[] workerFeatureArray = linUCBService.extractWorkerFeatures(
                    workerFeatures != null ? workerFeatures : new HashMap<>());
            double[] context = linUCBService.combineFeatures(taskFeatureArray, workerFeatureArray);

            // 记录分配
            String feedbackId = linUCBService.recordAllocation(
                    factoryId, taskId, taskType, workerId, workerCode,
                    context, predictedScore, plannedQuantity, plannedHours);

            response.put("success", true);
            response.put("data", Map.of("feedbackId", feedbackId));
            response.put("message", "分配记录成功");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("记录分配失败: {}", e.getMessage(), e);
            response.put("success", false);
            response.put("message", "记录失败: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    /**
     * 完成分配反馈（任务完成时调用）
     *
     * POST /api/mobile/{factoryId}/scheduling/linucb/complete-feedback
     */
    @PostMapping("/complete-feedback")
    public ResponseEntity<Map<String, Object>> completeFeedback(
            @PathVariable String factoryId,
            @RequestBody Map<String, Object> request) {

        Map<String, Object> response = new HashMap<>();

        try {
            String feedbackId = (String) request.get("feedbackId");
            BigDecimal actualQuantity = new BigDecimal(request.get("actualQuantity").toString());
            BigDecimal actualHours = new BigDecimal(request.get("actualHours").toString());
            BigDecimal qualityScore = request.get("qualityScore") != null ?
                    new BigDecimal(request.get("qualityScore").toString()) : BigDecimal.ONE;

            BigDecimal reward = linUCBService.completeFeedback(
                    feedbackId, actualQuantity, actualHours, qualityScore);

            response.put("success", true);
            response.put("data", Map.of(
                    "feedbackId", feedbackId,
                    "reward", reward
            ));
            response.put("message", "反馈完成");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("完成反馈失败: {}", e.getMessage(), e);
            response.put("success", false);
            response.put("message", "操作失败: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    // ==================== 模型管理 ====================

    /**
     * 获取工人的LinUCB模型
     *
     * GET /api/mobile/{factoryId}/scheduling/linucb/models/{workerId}
     */
    @GetMapping("/models/{workerId}")
    public ResponseEntity<Map<String, Object>> getModel(
            @PathVariable String factoryId,
            @PathVariable Long workerId) {

        Map<String, Object> response = new HashMap<>();

        try {
            LinUCBModel model = linUCBService.getOrCreateModel(factoryId, workerId);

            Map<String, Object> modelData = new HashMap<>();
            modelData.put("id", model.getId());
            modelData.put("workerId", model.getWorkerId());
            modelData.put("featureDim", model.getFeatureDim());
            modelData.put("updateCount", model.getUpdateCount());
            modelData.put("lastReward", model.getLastReward());
            modelData.put("avgReward", model.getAvgReward());
            modelData.put("lastUpdatedAt", model.getLastUpdatedAt());

            response.put("success", true);
            response.put("data", modelData);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("获取模型失败: {}", e.getMessage(), e);
            response.put("success", false);
            response.put("message", "获取失败: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    /**
     * 获取工厂所有模型列表
     *
     * GET /api/mobile/{factoryId}/scheduling/linucb/models
     */
    @GetMapping("/models")
    public ResponseEntity<Map<String, Object>> getAllModels(@PathVariable String factoryId) {

        Map<String, Object> response = new HashMap<>();

        try {
            List<LinUCBModel> models = linUCBService.getFactoryModels(factoryId);

            List<Map<String, Object>> modelList = new ArrayList<>();
            for (LinUCBModel model : models) {
                Map<String, Object> m = new HashMap<>();
                m.put("id", model.getId());
                m.put("workerId", model.getWorkerId());
                m.put("updateCount", model.getUpdateCount());
                m.put("avgReward", model.getAvgReward());
                m.put("lastUpdatedAt", model.getLastUpdatedAt());
                modelList.add(m);
            }

            response.put("success", true);
            response.put("data", modelList);
            response.put("total", models.size());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("获取模型列表失败: {}", e.getMessage(), e);
            response.put("success", false);
            response.put("message", "获取失败: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    /**
     * 重置工人模型
     *
     * DELETE /api/mobile/{factoryId}/scheduling/linucb/models/{workerId}
     */
    @DeleteMapping("/models/{workerId}")
    public ResponseEntity<Map<String, Object>> resetModel(
            @PathVariable String factoryId,
            @PathVariable Long workerId) {

        Map<String, Object> response = new HashMap<>();

        try {
            linUCBService.resetModel(factoryId, workerId);

            response.put("success", true);
            response.put("message", "模型已重置");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("重置模型失败: {}", e.getMessage(), e);
            response.put("success", false);
            response.put("message", "重置失败: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    /**
     * 重置工厂所有模型
     *
     * DELETE /api/mobile/{factoryId}/scheduling/linucb/models
     */
    @DeleteMapping("/models")
    public ResponseEntity<Map<String, Object>> resetAllModels(@PathVariable String factoryId) {

        Map<String, Object> response = new HashMap<>();

        try {
            linUCBService.resetAllModels(factoryId);

            response.put("success", true);
            response.put("message", "所有模型已重置");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("重置所有模型失败: {}", e.getMessage(), e);
            response.put("success", false);
            response.put("message", "重置失败: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    // ==================== 模型训练 ====================

    /**
     * 触发模型批量更新（处理未处理的反馈）
     *
     * POST /api/mobile/{factoryId}/scheduling/linucb/train
     */
    @PostMapping("/train")
    public ResponseEntity<Map<String, Object>> trainModels(@PathVariable String factoryId) {

        Map<String, Object> response = new HashMap<>();

        try {
            int processedCount = linUCBService.processUnprocessedFeedbacks(factoryId);

            response.put("success", true);
            response.put("data", Map.of("processedFeedbacks", processedCount));
            response.put("message", "训练完成，处理了 " + processedCount + " 条反馈");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("模型训练失败: {}", e.getMessage(), e);
            response.put("success", false);
            response.put("message", "训练失败: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    // ==================== 统计分析 ====================

    /**
     * 获取工人AI评分排行榜
     *
     * GET /api/mobile/{factoryId}/scheduling/linucb/worker-ranking
     */
    @GetMapping("/worker-ranking")
    public ResponseEntity<Map<String, Object>> getWorkerRanking(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "10") int limit) {

        Map<String, Object> response = new HashMap<>();

        try {
            List<WorkerPerformanceRank> ranking =
                    linUCBService.getWorkerPerformanceRanking(factoryId, limit);

            response.put("success", true);
            response.put("data", ranking);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("获取排行榜失败: {}", e.getMessage(), e);
            response.put("success", false);
            response.put("message", "获取失败: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    /**
     * 获取模型训练统计
     *
     * GET /api/mobile/{factoryId}/scheduling/linucb/training-stats
     */
    @GetMapping("/training-stats")
    public ResponseEntity<Map<String, Object>> getTrainingStats(@PathVariable String factoryId) {

        Map<String, Object> response = new HashMap<>();

        try {
            ModelTrainingStats stats = linUCBService.getTrainingStats(factoryId);

            response.put("success", true);
            response.put("data", stats);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("获取训练统计失败: {}", e.getMessage(), e);
            response.put("success", false);
            response.put("message", "获取失败: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }
}

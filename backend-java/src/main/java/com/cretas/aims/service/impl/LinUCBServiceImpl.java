package com.cretas.aims.service.impl;

import com.cretas.aims.entity.User;
import com.cretas.aims.entity.ml.LinUCBModel;
import com.cretas.aims.entity.ml.WorkerAllocationFeedback;
import com.cretas.aims.exception.EntityNotFoundException;
import com.cretas.aims.repository.LinUCBModelRepository;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.repository.WorkerAllocationFeedbackRepository;
import com.cretas.aims.service.DispatcherStrategyService;
import com.cretas.aims.service.FeatureEngineeringService;
import com.cretas.aims.service.LinUCBService;
import com.cretas.aims.service.TaskDiversityService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * LinUCB人员分配算法服务实现
 *
 * 核心算法:
 * UCB(a) = θ_a^T * x + α * sqrt(x^T * A_a^(-1) * x)
 *
 * 其中:
 * - θ_a = A_a^(-1) * b_a (工人a的参数向量)
 * - x 是上下文特征向量 (12维)
 * - α 是探索参数 (默认0.5)
 * - A_a 是累积的特征外积矩阵
 * - b_a 是累积的奖励加权特征向量
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LinUCBServiceImpl implements LinUCBService {

    private final LinUCBModelRepository modelRepository;
    private final WorkerAllocationFeedbackRepository feedbackRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final FeatureEngineeringService featureEngineeringService;
    private final DispatcherStrategyService dispatcherStrategyService;
    private final TaskDiversityService taskDiversityService;

    // LinUCB 超参数
    private static final double ALPHA = 0.5;           // 探索参数
    private static final int FEATURE_DIM = 16;         // 特征维度 (Phase 4: 从12扩展到16)
    private static final double REGULARIZATION = 1.0;  // 正则化参数 (A初始化为I*λ)

    // ==================== 核心推荐算法 ====================

    @Override
    public List<WorkerRecommendation> recommendWorkers(
            String factoryId,
            double[] taskFeatures,
            List<Long> candidateWorkerIds) {

        if (candidateWorkerIds == null || candidateWorkerIds.isEmpty()) {
            return Collections.emptyList();
        }

        List<WorkerRecommendation> recommendations = new ArrayList<>();

        // 获取候选工人信息
        List<User> workers = userRepository.findAllById(candidateWorkerIds);
        Map<Long, User> workerMap = workers.stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        // 批量获取模型
        List<LinUCBModel> models = modelRepository.findByFactoryIdAndWorkerIdIn(factoryId, candidateWorkerIds);
        Map<Long, LinUCBModel> modelMap = models.stream()
                .collect(Collectors.toMap(LinUCBModel::getWorkerId, m -> m));

        for (Long workerId : candidateWorkerIds) {
            User worker = workerMap.get(workerId);
            if (worker == null) continue;

            // 使用统一特征工程服务提取工人特征
            double[] workerFeatures = featureEngineeringService.extractWorkerFeatures(factoryId, workerId);

            // 合并特征
            double[] context = featureEngineeringService.combineFeatures(taskFeatures, workerFeatures);

            // 计算UCB
            LinUCBModel model = modelMap.get(workerId);
            if (model == null) {
                model = createInitialModel(factoryId, workerId);
            }

            double[] theta = computeTheta(model);
            double expectedReward = dotProduct(theta, context);
            double confidenceWidth = computeConfidenceWidth(model, context);
            double ucb = expectedReward + ALPHA * confidenceWidth;

            // 创建推荐结果
            WorkerRecommendation rec = new WorkerRecommendation();
            rec.setWorkerId(workerId);
            rec.setWorkerCode(worker.getEmployeeCode());
            rec.setWorkerName(worker.getFullName());
            rec.setUcbScore(BigDecimal.valueOf(ucb).setScale(4, RoundingMode.HALF_UP));
            rec.setExpectedEfficiency(BigDecimal.valueOf(expectedReward).setScale(4, RoundingMode.HALF_UP));
            rec.setConfidenceWidth(BigDecimal.valueOf(confidenceWidth).setScale(4, RoundingMode.HALF_UP));
            rec.setRecommendation(generateRecommendationText(ucb, expectedReward, confidenceWidth, model));

            recommendations.add(rec);
        }

        // 按UCB分数降序排序
        recommendations.sort((a, b) -> b.getUcbScore().compareTo(a.getUcbScore()));

        // 应用调度策略干预重排序 (新人培训/公平轮换/疲劳控制/紧急任务加权)
        try {
            Map<String, Object> taskInfo = buildTaskInfoFromFeatures(taskFeatures);
            recommendations = dispatcherStrategyService.applyStrategyReranking(
                    recommendations, factoryId, taskInfo);
            log.debug("策略干预重排序完成: {} 个工人", recommendations.size());
        } catch (Exception e) {
            log.warn("策略干预重排序失败，使用原始排序: {}", e.getMessage());
        }

        return recommendations;
    }

    /**
     * 从任务特征数组构建任务信息Map
     */
    private Map<String, Object> buildTaskInfoFromFeatures(double[] taskFeatures) {
        Map<String, Object> taskInfo = new HashMap<>();
        if (taskFeatures != null && taskFeatures.length >= 6) {
            taskInfo.put("quantity", taskFeatures[0]);
            taskInfo.put("deadlineHours", taskFeatures[1]);
            taskInfo.put("complexity", (int) taskFeatures[2]);
            taskInfo.put("priority", (int) taskFeatures[3]);
            // taskFeatures[4] = productTypeEncoded
            // taskFeatures[5] = workshopEncoded
        }
        return taskInfo;
    }

    @Override
    public List<WorkerRecommendation> getRecommendationsWithDiversity(
            String factoryId,
            Map<String, Object> taskInfo,
            List<Long> candidateWorkerIds,
            boolean enableDiversity) {

        if (candidateWorkerIds == null || candidateWorkerIds.isEmpty()) {
            return Collections.emptyList();
        }

        // 1. 提取任务特征并获取基础推荐
        double[] taskFeatures = extractTaskFeatures(taskInfo);
        List<WorkerRecommendation> baseRecs = recommendWorkers(factoryId, taskFeatures, candidateWorkerIds);

        if (!enableDiversity || baseRecs.isEmpty()) {
            log.debug("多样性调整已禁用或无推荐结果，返回原始推荐列表");
            return baseRecs;
        }

        // 2. 提取任务类型
        String taskType = extractTaskType(taskInfo);

        // 3. 对每个推荐应用多样性调整
        for (WorkerRecommendation rec : baseRecs) {
            double originalScore = rec.getUcbScore() != null ? rec.getUcbScore().doubleValue() : 0.0;

            // 调用TaskDiversityService计算调整后分数
            double adjustedScore = taskDiversityService.calculateDiversityAdjustedScore(
                    factoryId, rec.getWorkerId(), taskType, originalScore);

            // 计算分数变化
            double scoreDelta = adjustedScore - originalScore;

            // 更新推荐说明
            String originalReason = rec.getRecommendation() != null ? rec.getRecommendation() : "";
            if (Math.abs(scoreDelta) > 0.05) {
                if (scoreDelta > 0) {
                    rec.setRecommendation(originalReason +
                            String.format("多样性加分(+%.2f): 公平性/技能维护优先; ", scoreDelta));
                } else {
                    rec.setRecommendation(originalReason +
                            String.format("多样性降权(%.2f): 近期重复任务惩罚; ", scoreDelta));
                }
            }

            // 更新分数
            rec.setUcbScore(BigDecimal.valueOf(adjustedScore).setScale(4, RoundingMode.HALF_UP));
        }

        // 4. 按调整后分数重新排序
        List<WorkerRecommendation> sortedRecs = baseRecs.stream()
                .sorted((a, b) -> b.getUcbScore().compareTo(a.getUcbScore()))
                .collect(Collectors.toList());

        log.info("多样性调整完成: factoryId={}, taskType={}, 候选工人数={}", factoryId, taskType, sortedRecs.size());

        return sortedRecs;
    }

    /**
     * 从任务信息中提取任务类型
     * 按优先级查找: taskType -> processType -> stageType
     */
    private String extractTaskType(Map<String, Object> taskInfo) {
        if (taskInfo == null) {
            return null;
        }

        Object taskType = taskInfo.get("taskType");
        if (taskType != null && !taskType.toString().isEmpty()) {
            return taskType.toString();
        }

        Object processType = taskInfo.get("processType");
        if (processType != null && !processType.toString().isEmpty()) {
            return processType.toString();
        }

        Object stageType = taskInfo.get("stageType");
        if (stageType != null && !stageType.toString().isEmpty()) {
            return stageType.toString();
        }

        return null;
    }

    @Override
    public BigDecimal computeUCB(String factoryId, Long workerId, double[] context) {
        LinUCBModel model = getOrCreateModel(factoryId, workerId);

        double[] theta = computeTheta(model);
        double expectedReward = dotProduct(theta, context);
        double confidenceWidth = computeConfidenceWidth(model, context);
        double ucb = expectedReward + ALPHA * confidenceWidth;

        return BigDecimal.valueOf(ucb).setScale(4, RoundingMode.HALF_UP);
    }

    // ==================== 模型更新 ====================

    @Override
    @Transactional
    public void updateModel(String factoryId, Long workerId, double[] context, double reward) {
        LinUCBModel model = getOrCreateModel(factoryId, workerId);

        try {
            // 解析现有矩阵
            double[][] A = parseMatrix(model.getMatrixA());
            double[] b = parseVector(model.getVectorB());

            // 更新 A = A + x * x^T
            double[][] outerProduct = outerProduct(context, context);
            A = matrixAdd(A, outerProduct);

            // 更新 b = b + reward * x
            double[] rewardWeighted = vectorScale(context, reward);
            b = vectorAdd(b, rewardWeighted);

            // 计算 A^(-1) 使用 Sherman-Morrison 公式 (更高效)
            double[][] AInverse = invertMatrix(A);

            // 更新模型
            model.setMatrixA(serializeMatrix(A));
            model.setMatrixAInverse(serializeMatrix(AInverse));
            model.setVectorB(serializeVector(b));
            model.incrementUpdateCount();
            model.updateAvgReward(BigDecimal.valueOf(reward));
            model.setLastUpdatedAt(LocalDateTime.now());

            modelRepository.save(model);

            log.debug("Updated LinUCB model for worker {} in factory {}, reward: {}",
                    workerId, factoryId, reward);

        } catch (Exception e) {
            log.error("Failed to update LinUCB model for worker {} in factory {}: {}",
                    workerId, factoryId, e.getMessage());
            throw new RuntimeException("模型更新失败", e);
        }
    }

    @Override
    @Transactional
    public int processUnprocessedFeedbacks(String factoryId) {
        List<WorkerAllocationFeedback> feedbacks = feedbackRepository.findUnprocessedFeedbacks(factoryId);

        if (feedbacks.isEmpty()) {
            return 0;
        }

        int processed = 0;
        List<String> processedIds = new ArrayList<>();

        for (WorkerAllocationFeedback feedback : feedbacks) {
            try {
                // 解析上下文特征
                double[] context = parseVector(feedback.getContextFeatures());
                double reward = feedback.getReward() != null ?
                        feedback.getReward().doubleValue() : 0.5;

                // 更新模型
                updateModel(factoryId, feedback.getWorkerId(), context, reward);

                processedIds.add(feedback.getId());
                processed++;

            } catch (Exception e) {
                log.warn("Failed to process feedback {}: {}", feedback.getId(), e.getMessage());
            }
        }

        // 批量标记为已处理
        if (!processedIds.isEmpty()) {
            feedbackRepository.markAsProcessed(processedIds, LocalDateTime.now());
        }

        log.info("Processed {} feedbacks for factory {}", processed, factoryId);
        return processed;
    }

    // ==================== 模型管理 ====================

    @Override
    public LinUCBModel getOrCreateModel(String factoryId, Long workerId) {
        return modelRepository.findByFactoryIdAndWorkerId(factoryId, workerId)
                .orElseGet(() -> createAndSaveInitialModel(factoryId, workerId));
    }

    @Override
    public List<LinUCBModel> getFactoryModels(String factoryId) {
        return modelRepository.findByFactoryId(factoryId);
    }

    @Override
    @Transactional
    public void resetModel(String factoryId, Long workerId) {
        modelRepository.deleteByFactoryIdAndWorkerId(factoryId, workerId);
        log.info("Reset LinUCB model for worker {} in factory {}", workerId, factoryId);
    }

    @Override
    @Transactional
    public void resetAllModels(String factoryId) {
        modelRepository.deleteByFactoryId(factoryId);
        log.info("Reset all LinUCB models for factory {}", factoryId);
    }

    // ==================== 反馈记录 ====================

    @Override
    @Transactional
    public String recordAllocation(
            String factoryId,
            String taskId,
            String taskType,
            Long workerId,
            String workerCode,
            double[] context,
            BigDecimal predictedScore,
            BigDecimal plannedQuantity,
            BigDecimal plannedHours) {

        WorkerAllocationFeedback feedback = WorkerAllocationFeedback.builder()
                .factoryId(factoryId)
                .taskId(taskId)
                .taskType(taskType)
                .workerId(workerId)
                .workerCode(workerCode)
                .contextFeatures(serializeVector(context))
                .predictedScore(predictedScore)
                .plannedQuantity(plannedQuantity)
                .plannedHours(plannedHours)
                .assignedAt(LocalDateTime.now())
                .isProcessed(false)
                .build();

        feedbackRepository.save(feedback);
        return feedback.getId();
    }

    @Override
    @Transactional
    public BigDecimal completeFeedback(
            String feedbackId,
            BigDecimal actualQuantity,
            BigDecimal actualHours,
            BigDecimal qualityScore) {

        WorkerAllocationFeedback feedback = feedbackRepository.findById(feedbackId)
                .orElseThrow(() -> new EntityNotFoundException("WorkerAllocationFeedback", feedbackId));

        // 计算效率
        BigDecimal efficiency = BigDecimal.ONE;
        if (feedback.getPlannedQuantity() != null &&
            feedback.getPlannedQuantity().compareTo(BigDecimal.ZERO) > 0) {
            efficiency = actualQuantity.divide(feedback.getPlannedQuantity(), 4, RoundingMode.HALF_UP);
            // 限制在 0-1.2 范围
            if (efficiency.compareTo(BigDecimal.valueOf(1.2)) > 0) {
                efficiency = BigDecimal.valueOf(1.2);
            }
        }

        // 判断是否超时
        boolean isOvertime = false;
        if (feedback.getPlannedHours() != null && actualHours != null) {
            isOvertime = actualHours.compareTo(feedback.getPlannedHours()) > 0;
        }

        // 更新反馈
        feedback.setActualQuantity(actualQuantity);
        feedback.setActualHours(actualHours);
        feedback.setActualEfficiency(efficiency);
        feedback.setActualQuality(qualityScore);
        feedback.setIsOvertime(isOvertime);
        feedback.setCompletedAt(LocalDateTime.now());

        // 计算综合奖励
        BigDecimal reward = feedback.calculateReward();

        feedbackRepository.save(feedback);

        log.debug("Completed feedback {}: efficiency={}, quality={}, reward={}",
                feedbackId, efficiency, qualityScore, reward);

        return reward;
    }

    @Override
    @Transactional
    public BigDecimal completeFeedbackWithImmediateUpdate(
            String feedbackId,
            BigDecimal actualQuantity,
            BigDecimal actualHours,
            BigDecimal qualityScore) {

        // 1. 完成反馈记录
        BigDecimal reward = completeFeedback(feedbackId, actualQuantity, actualHours, qualityScore);

        // 2. 立即更新模型 (实时反馈闭环)
        WorkerAllocationFeedback feedback = feedbackRepository.findById(feedbackId)
                .orElse(null);

        if (feedback != null && feedback.getContextFeatures() != null) {
            try {
                double[] context = parseVector(feedback.getContextFeatures());
                double rewardValue = reward != null ? reward.doubleValue() : 0.5;

                // 立即更新模型
                updateModel(feedback.getFactoryId(), feedback.getWorkerId(), context, rewardValue);

                // 标记为已处理
                feedback.setIsProcessed(true);
                feedback.setProcessedAt(LocalDateTime.now());
                feedbackRepository.save(feedback);

                log.info("实时更新LinUCB模型: workerId={}, reward={}", feedback.getWorkerId(), reward);

            } catch (Exception e) {
                log.warn("实时模型更新失败，将在批量处理时更新: feedbackId={}, error={}",
                        feedbackId, e.getMessage());
                // 失败时不影响反馈记录，后续批量处理会补充更新
            }
        }

        return reward;
    }

    // ==================== 统计分析 ====================

    @Override
    public List<WorkerPerformanceRank> getWorkerPerformanceRanking(String factoryId, int limit) {
        List<LinUCBModel> models = modelRepository.findTopModelsByAvgReward(factoryId);

        List<WorkerPerformanceRank> ranking = new ArrayList<>();
        int rank = 1;

        for (LinUCBModel model : models) {
            if (rank > limit) break;

            User worker = userRepository.findById(model.getWorkerId()).orElse(null);
            if (worker == null) continue;

            Double avgEfficiency = feedbackRepository.calculateAvgEfficiency(factoryId, model.getWorkerId());
            Double avgQuality = feedbackRepository.calculateAvgQuality(factoryId, model.getWorkerId());
            long taskCount = feedbackRepository.countCompletedTasks(factoryId, model.getWorkerId());

            WorkerPerformanceRank perf = new WorkerPerformanceRank();
            perf.setRank(rank++);
            perf.setWorkerId(model.getWorkerId());
            perf.setWorkerCode(worker.getEmployeeCode());
            perf.setWorkerName(worker.getFullName());
            perf.setAvgReward(model.getAvgReward());
            perf.setAvgEfficiency(avgEfficiency != null ?
                    BigDecimal.valueOf(avgEfficiency).setScale(4, RoundingMode.HALF_UP) : null);
            perf.setAvgQuality(avgQuality != null ?
                    BigDecimal.valueOf(avgQuality).setScale(4, RoundingMode.HALF_UP) : null);
            perf.setTaskCount((int) taskCount);

            ranking.add(perf);
        }

        return ranking;
    }

    @Override
    public ModelTrainingStats getTrainingStats(String factoryId) {
        List<LinUCBModel> models = modelRepository.findByFactoryId(factoryId);

        ModelTrainingStats stats = new ModelTrainingStats();
        stats.setTotalModels(models.size());
        stats.setActiveModels((int) models.stream()
                .filter(m -> m.getUpdateCount() != null && m.getUpdateCount() > 0)
                .count());
        stats.setTotalUpdates(models.stream()
                .mapToLong(m -> m.getUpdateCount() != null ? m.getUpdateCount() : 0)
                .sum());
        stats.setUnprocessedFeedbacks(feedbackRepository.countUnprocessedFeedbacks(factoryId));

        // 计算平均奖励
        OptionalDouble avgReward = models.stream()
                .filter(m -> m.getAvgReward() != null)
                .mapToDouble(m -> m.getAvgReward().doubleValue())
                .average();
        stats.setAvgReward(avgReward.isPresent() ?
                BigDecimal.valueOf(avgReward.getAsDouble()).setScale(4, RoundingMode.HALF_UP) : null);

        // 最后训练时间
        Optional<LocalDateTime> lastUpdate = models.stream()
                .map(LinUCBModel::getLastUpdatedAt)
                .filter(Objects::nonNull)
                .max(LocalDateTime::compareTo);
        stats.setLastTrainingTime(lastUpdate.map(t ->
                t.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))).orElse(null));

        return stats;
    }

    // ==================== 特征工程 (委托给统一服务) ====================

    @Override
    public double[] extractTaskFeatures(Map<String, Object> taskInfo) {
        // 委托给统一的特征工程服务
        // 注意: 这里没有 factoryId，使用 null，服务内部会使用 taskInfo 中的值
        return featureEngineeringService.extractTaskFeatures(null, taskInfo);
    }

    @Override
    public double[] extractWorkerFeatures(Map<String, Object> workerInfo) {
        // 委托给统一的特征工程服务
        return featureEngineeringService.extractWorkerFeatures(workerInfo);
    }

    @Override
    public double[] combineFeatures(double[] taskFeatures, double[] workerFeatures) {
        // 委托给统一的特征工程服务
        return featureEngineeringService.combineFeatures(taskFeatures, workerFeatures);
    }

    // ==================== 私有辅助方法 ====================

    private LinUCBModel createInitialModel(String factoryId, Long workerId) {
        LinUCBModel model = new LinUCBModel();
        model.setFactoryId(factoryId);
        model.setWorkerId(workerId);
        model.setFeatureDim(FEATURE_DIM);

        // 初始化 A = λI (单位矩阵乘以正则化参数)
        double[][] A = new double[FEATURE_DIM][FEATURE_DIM];
        for (int i = 0; i < FEATURE_DIM; i++) {
            A[i][i] = REGULARIZATION;
        }
        model.setMatrixA(serializeMatrix(A));

        // A^(-1) = I/λ
        double[][] AInverse = new double[FEATURE_DIM][FEATURE_DIM];
        for (int i = 0; i < FEATURE_DIM; i++) {
            AInverse[i][i] = 1.0 / REGULARIZATION;
        }
        model.setMatrixAInverse(serializeMatrix(AInverse));

        // 初始化 b = 0
        double[] b = new double[FEATURE_DIM];
        model.setVectorB(serializeVector(b));

        model.setUpdateCount(0);
        model.setTotalReward(BigDecimal.ZERO);

        return model;
    }

    private LinUCBModel createAndSaveInitialModel(String factoryId, Long workerId) {
        LinUCBModel model = createInitialModel(factoryId, workerId);
        return modelRepository.save(model);
    }

    private double[] computeTheta(LinUCBModel model) {
        double[][] AInverse = parseMatrix(model.getMatrixAInverse());
        double[] b = parseVector(model.getVectorB());
        return matrixVectorMultiply(AInverse, b);
    }

    private double computeConfidenceWidth(LinUCBModel model, double[] context) {
        double[][] AInverse = parseMatrix(model.getMatrixAInverse());
        double[] temp = matrixVectorMultiply(AInverse, context);
        return Math.sqrt(dotProduct(context, temp));
    }

    private String generateRecommendationText(double ucb, double expected, double confidence, LinUCBModel model) {
        StringBuilder sb = new StringBuilder();

        if (model.getUpdateCount() == null || model.getUpdateCount() < 5) {
            sb.append("新工人，建议尝试分配以收集数据；");
        } else if (confidence > 0.3) {
            sb.append("该工人历史数据较少，分配可获得更多信息；");
        }

        if (expected > 0.8) {
            sb.append("预期效率高；");
        } else if (expected < 0.5) {
            sb.append("预期效率偏低，谨慎分配；");
        }

        if (sb.length() == 0) {
            sb.append("综合评分适中");
        }

        return sb.toString().trim();
    }

    // extractWorkerFeaturesFromUser 已迁移至 FeatureEngineeringServiceImpl

    // ==================== 矩阵运算 ====================

    private double dotProduct(double[] a, double[] b) {
        double sum = 0;
        for (int i = 0; i < a.length; i++) {
            sum += a[i] * b[i];
        }
        return sum;
    }

    private double[][] outerProduct(double[] a, double[] b) {
        int n = a.length;
        double[][] result = new double[n][n];
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < n; j++) {
                result[i][j] = a[i] * b[j];
            }
        }
        return result;
    }

    private double[][] matrixAdd(double[][] A, double[][] B) {
        int n = A.length;
        double[][] result = new double[n][n];
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < n; j++) {
                result[i][j] = A[i][j] + B[i][j];
            }
        }
        return result;
    }

    private double[] vectorAdd(double[] a, double[] b) {
        int n = a.length;
        double[] result = new double[n];
        for (int i = 0; i < n; i++) {
            result[i] = a[i] + b[i];
        }
        return result;
    }

    private double[] vectorScale(double[] a, double scalar) {
        int n = a.length;
        double[] result = new double[n];
        for (int i = 0; i < n; i++) {
            result[i] = a[i] * scalar;
        }
        return result;
    }

    private double[] matrixVectorMultiply(double[][] A, double[] b) {
        int n = A.length;
        double[] result = new double[n];
        for (int i = 0; i < n; i++) {
            result[i] = dotProduct(A[i], b);
        }
        return result;
    }

    /**
     * 矩阵求逆 (使用高斯-约旦消元法)
     */
    private double[][] invertMatrix(double[][] matrix) {
        int n = matrix.length;
        double[][] augmented = new double[n][2 * n];

        // 创建增广矩阵 [A|I]
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < n; j++) {
                augmented[i][j] = matrix[i][j];
            }
            augmented[i][n + i] = 1;
        }

        // 高斯-约旦消元
        for (int i = 0; i < n; i++) {
            // 寻找主元
            int maxRow = i;
            for (int k = i + 1; k < n; k++) {
                if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
                    maxRow = k;
                }
            }

            // 交换行
            double[] temp = augmented[i];
            augmented[i] = augmented[maxRow];
            augmented[maxRow] = temp;

            // 检查奇异矩阵
            if (Math.abs(augmented[i][i]) < 1e-10) {
                // 添加小扰动避免奇异
                augmented[i][i] = 1e-10;
            }

            // 归一化主元行
            double pivot = augmented[i][i];
            for (int j = 0; j < 2 * n; j++) {
                augmented[i][j] /= pivot;
            }

            // 消元其他行
            for (int k = 0; k < n; k++) {
                if (k != i) {
                    double factor = augmented[k][i];
                    for (int j = 0; j < 2 * n; j++) {
                        augmented[k][j] -= factor * augmented[i][j];
                    }
                }
            }
        }

        // 提取逆矩阵
        double[][] inverse = new double[n][n];
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < n; j++) {
                inverse[i][j] = augmented[i][n + j];
            }
        }

        return inverse;
    }

    // ==================== 序列化/反序列化 ====================

    private String serializeMatrix(double[][] matrix) {
        try {
            return objectMapper.writeValueAsString(matrix);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("矩阵序列化失败", e);
        }
    }

    private double[][] parseMatrix(String json) {
        try {
            return objectMapper.readValue(json, double[][].class);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("矩阵解析失败", e);
        }
    }

    private String serializeVector(double[] vector) {
        try {
            return objectMapper.writeValueAsString(vector);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("向量序列化失败", e);
        }
    }

    private double[] parseVector(String json) {
        try {
            return objectMapper.readValue(json, double[].class);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("向量解析失败", e);
        }
    }

    // ==================== 工具方法 ====================

    private double normalize(double value, double min, double max) {
        if (max <= min) return 0.5;
        double normalized = (value - min) / (max - min);
        return Math.max(0, Math.min(1, normalized));
    }

    private double encodeString(String str) {
        if (str == null || str.isEmpty()) return 0.5;
        // 使用hash值归一化到0-1
        int hash = Math.abs(str.hashCode());
        return (hash % 1000) / 1000.0;
    }

    private double getDouble(Map<String, Object> map, String key, double defaultValue) {
        Object value = map.get(key);
        if (value == null) return defaultValue;
        if (value instanceof Number) return ((Number) value).doubleValue();
        try {
            return Double.parseDouble(value.toString());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    private String getString(Map<String, Object> map, String key, String defaultValue) {
        Object value = map.get(key);
        return value != null ? value.toString() : defaultValue;
    }

    private boolean getBoolean(Map<String, Object> map, String key, boolean defaultValue) {
        Object value = map.get(key);
        if (value == null) return defaultValue;
        if (value instanceof Boolean) return (Boolean) value;
        return Boolean.parseBoolean(value.toString());
    }
}

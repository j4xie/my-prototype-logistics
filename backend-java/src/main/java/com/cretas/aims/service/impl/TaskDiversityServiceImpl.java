package com.cretas.aims.service.impl;

import com.cretas.aims.config.DispatcherStrategyConfig;
import com.cretas.aims.entity.ml.WorkerAllocationFeedback;
import com.cretas.aims.repository.WorkerAllocationFeedbackRepository;
import com.cretas.aims.service.LinUCBService;
import com.cretas.aims.service.TaskDiversityService;
import com.cretas.aims.service.scheduling.FairMABService;
import com.cretas.aims.service.scheduling.TempWorkerService;
import com.cretas.aims.service.scheduling.SkuComplexityService;
import com.cretas.aims.service.scheduling.FactorySchedulingConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 任务多样性控制服务实现
 * 基于MMR算法确保工人任务分配的多样性
 *
 * 核心思想:
 * 1. 避免同一工人连续多天做同一工序
 * 2. 给工人分配不熟悉但可学习的任务
 * 3. 提升任务分配的公平性
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TaskDiversityServiceImpl implements TaskDiversityService {

    private final DispatcherStrategyConfig config;
    private final WorkerAllocationFeedbackRepository feedbackRepository;
    private final FairMABService fairMABService;
    private final TempWorkerService tempWorkerService;
    private final SkuComplexityService skuComplexityService;
    private final FactorySchedulingConfigService factoryConfigService;

    // 默认分析天数
    private static final int DEFAULT_ANALYSIS_DAYS = 14;

    // 需要轮换的阈值 (连续做同一工序超过此天数)
    private static final int ROTATION_THRESHOLD_DAYS = 3;

    // 多样性不足的阈值 (单一工序占比超过此比例)
    private static final double LOW_DIVERSITY_THRESHOLD = 0.6;

    @Override
    public double calculateTaskHistorySimilarity(String factoryId, Long workerId,
                                                  Map<String, Object> taskInfo, int days) {
        String currentProcessType = extractProcessType(taskInfo);
        String currentProductType = extractProductType(taskInfo);
        Integer currentComplexity = extractComplexity(taskInfo);

        if (currentProcessType == null) {
            return 0.0;
        }

        // 获取工人历史任务
        LocalDateTime startDate = LocalDate.now().minusDays(days).atStartOfDay();
        List<WorkerAllocationFeedback> history = feedbackRepository.findByFactoryIdAndWorkerId(factoryId, workerId)
                .stream()
                .filter(f -> f.getAssignedAt() != null && f.getAssignedAt().isAfter(startDate))
                .collect(Collectors.toList());

        if (history.isEmpty()) {
            return 0.0; // 无历史记录，无重复
        }

        double maxSimilarity = 0.0;

        for (WorkerAllocationFeedback past : history) {
            double similarity = 0.0;

            // 1. 工序相似度 (权重 0.5)
            if (currentProcessType.equals(past.getTaskType())) {
                similarity += config.getSameProcessSimilarity();
            }

            // 2. 产品类型相似度 (权重 0.3) - 从taskFeatures中提取
            String pastProductType = extractProductTypeFromFeedback(past);
            if (currentProductType != null && currentProductType.equals(pastProductType)) {
                similarity += config.getSameProductTypeSimilarity();
            }

            // 3. 复杂度相似度 (权重 0.2)
            Integer pastComplexity = extractComplexityFromFeedback(past);
            if (currentComplexity != null && pastComplexity != null &&
                Math.abs(currentComplexity - pastComplexity) <= 1) {
                similarity += config.getSimilarComplexitySimilarity();
            }

            maxSimilarity = Math.max(maxSimilarity, similarity);
        }

        return Math.min(1.0, maxSimilarity);
    }

    @Override
    public List<LinUCBService.WorkerRecommendation> applyDiversityReranking(
            List<LinUCBService.WorkerRecommendation> recommendations,
            String factoryId,
            Map<String, Object> taskInfo,
            double lambda) {

        if (recommendations == null || recommendations.isEmpty() || recommendations.size() <= 1) {
            return recommendations;
        }

        // 计算每个工人的历史相似度
        Map<Long, Double> historySimilarity = new HashMap<>();
        for (LinUCBService.WorkerRecommendation rec : recommendations) {
            double similarity = calculateTaskHistorySimilarity(factoryId, rec.getWorkerId(), taskInfo, 7);
            historySimilarity.put(rec.getWorkerId(), similarity);
        }

        // 应用MMR公式重排序
        List<ScoredRecommendation> scored = recommendations.stream()
                .map(rec -> {
                    double relevance = rec.getUcbScore() != null ? rec.getUcbScore().doubleValue() : 0.0;
                    double similarity = historySimilarity.getOrDefault(rec.getWorkerId(), 0.0);

                    // MMR = λ × Score - (1-λ) × Similarity
                    double mmrScore = lambda * relevance - (1 - lambda) * similarity;

                    return new ScoredRecommendation(rec, mmrScore, similarity);
                })
                .sorted((a, b) -> Double.compare(b.mmrScore, a.mmrScore))
                .collect(Collectors.toList());

        // 更新推荐说明
        for (ScoredRecommendation sr : scored) {
            LinUCBService.WorkerRecommendation rec = sr.recommendation;
            String originalReason = rec.getRecommendation() != null ? rec.getRecommendation() : "";

            if (sr.historySimilarity > 0.3) {
                rec.setRecommendation(originalReason + "近期做过类似任务，多样性降权; ");
            }

            rec.setUcbScore(BigDecimal.valueOf(sr.mmrScore).setScale(4, RoundingMode.HALF_UP));
        }

        log.info("任务多样性重排序完成: {} 个工人, λ={}", recommendations.size(), lambda);

        return scored.stream()
                .map(sr -> sr.recommendation)
                .collect(Collectors.toList());
    }

    @Override
    public TaskDiversityAnalysis getWorkerTaskDiversityAnalysis(String factoryId, Long workerId, int days) {
        TaskDiversityAnalysis analysis = new TaskDiversityAnalysis();
        analysis.setWorkerId(workerId);

        LocalDateTime startDate = LocalDate.now().minusDays(days).atStartOfDay();
        List<WorkerAllocationFeedback> history = feedbackRepository.findByFactoryIdAndWorkerId(factoryId, workerId)
                .stream()
                .filter(f -> f.getAssignedAt() != null && f.getAssignedAt().isAfter(startDate))
                .collect(Collectors.toList());

        if (history.isEmpty()) {
            analysis.setTotalTasks(0);
            analysis.setUniqueProcessTypes(0);
            analysis.setDiversityScore(0.0);
            analysis.setNeedsRotation(false);
            return analysis;
        }

        // 统计工序分布 - 优先使用 stageType，如果为空则使用 taskType
        Map<String, Integer> processDistribution = new HashMap<>();
        for (WorkerAllocationFeedback f : history) {
            String processType;
            if (f.getStageType() != null) {
                processType = f.getStageType().name();
            } else if (f.getTaskType() != null) {
                processType = f.getTaskType();
            } else {
                processType = "UNKNOWN";
            }
            processDistribution.merge(processType, 1, Integer::sum);
        }

        analysis.setTotalTasks(history.size());
        analysis.setUniqueProcessTypes(processDistribution.size());
        analysis.setProcessTypeDistribution(processDistribution);

        // 找出主导工序
        Map.Entry<String, Integer> dominant = processDistribution.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .orElse(null);

        if (dominant != null) {
            analysis.setDominantProcessType(dominant.getKey());
            analysis.setDominantProcessRatio((double) dominant.getValue() / history.size());
        }

        // 计算多样性分数 (基于熵)
        double entropy = 0.0;
        for (Integer count : processDistribution.values()) {
            if (count > 0) {
                double p = (double) count / history.size();
                entropy -= p * Math.log(p);
            }
        }
        // 归一化: 最大熵 = log(工序数)
        double maxEntropy = Math.log(Math.max(1, processDistribution.size()));
        analysis.setDiversityScore(maxEntropy > 0 ? entropy / maxEntropy : 0.0);

        // 判断是否需要轮换
        analysis.setNeedsRotation(
                analysis.getDominantProcessRatio() > LOW_DIVERSITY_THRESHOLD ||
                shouldRotateTask(factoryId, workerId, analysis.getDominantProcessType())
        );

        return analysis;
    }

    @Override
    public boolean shouldRotateTask(String factoryId, Long workerId, String processType) {
        if (processType == null) {
            return false;
        }

        // 检查连续做同一工序的天数
        LocalDateTime startDate = LocalDate.now().minusDays(ROTATION_THRESHOLD_DAYS + 1).atStartOfDay();
        List<WorkerAllocationFeedback> recentTasks = feedbackRepository.findByFactoryIdAndWorkerId(factoryId, workerId)
                .stream()
                .filter(f -> f.getAssignedAt() != null && f.getAssignedAt().isAfter(startDate))
                .sorted(Comparator.comparing(WorkerAllocationFeedback::getAssignedAt).reversed())
                .collect(Collectors.toList());

        if (recentTasks.isEmpty()) {
            return false;
        }

        // 统计连续天数
        int consecutiveDays = 0;
        LocalDate lastDate = null;

        for (WorkerAllocationFeedback task : recentTasks) {
            if (!processType.equals(task.getTaskType())) {
                break; // 遇到不同工序就停止
            }

            LocalDate taskDate = task.getAssignedAt().toLocalDate();
            if (lastDate == null || !taskDate.equals(lastDate)) {
                consecutiveDays++;
                lastDate = taskDate;
            }
        }

        return consecutiveDays >= ROTATION_THRESHOLD_DAYS;
    }

    @Override
    public List<String> recommendSkillDevelopmentTasks(String factoryId, Long workerId, int limit) {
        // 获取工人的历史任务类型
        TaskDiversityAnalysis analysis = getWorkerTaskDiversityAnalysis(factoryId, workerId, 30);
        Set<String> knownProcessTypes = analysis.getProcessTypeDistribution() != null ?
                analysis.getProcessTypeDistribution().keySet() : Collections.emptySet();

        // 获取工厂所有工序类型
        Set<String> allProcessTypes = getAllFactoryProcessTypes(factoryId);

        // 找出工人未做过或很少做的工序
        List<String> recommendations = new ArrayList<>();
        for (String processType : allProcessTypes) {
            if (!knownProcessTypes.contains(processType)) {
                recommendations.add(processType);
            }
        }

        // 如果没有完全未做过的，推荐做得少的
        if (recommendations.size() < limit && analysis.getProcessTypeDistribution() != null) {
            List<String> rareProcesses = analysis.getProcessTypeDistribution().entrySet().stream()
                    .sorted(Map.Entry.comparingByValue())
                    .map(Map.Entry::getKey)
                    .filter(p -> !recommendations.contains(p))
                    .limit(limit - recommendations.size())
                    .collect(Collectors.toList());
            recommendations.addAll(rareProcesses);
        }

        return recommendations.stream().limit(limit).collect(Collectors.toList());
    }

    // ==================== 公平性与技能维护方法 ====================

    @Override
    public double calculateFairnessBonus(String factoryId, Long workerId, int days) {
        LocalDateTime startTime = LocalDate.now().minusDays(days).atStartOfDay();

        // 获取所有工人在该时间段内的分配数
        List<Object[]> allocationsByWorker = feedbackRepository.countAllocationsByWorkerInPeriod(factoryId, startTime);

        if (allocationsByWorker.isEmpty()) {
            return 0.0;
        }

        // 计算平均分配数
        double totalAllocations = 0;
        int workerCount = allocationsByWorker.size();
        Long workerAllocationCount = 0L;

        for (Object[] row : allocationsByWorker) {
            Long wId = (Long) row[0];
            Long count = (Long) row[1];
            totalAllocations += count;

            if (wId.equals(workerId)) {
                workerAllocationCount = count;
            }
        }

        double averageAllocations = totalAllocations / workerCount;

        // 如果工人没有分配记录，给予最大公平性加分
        if (workerAllocationCount == 0) {
            return 1.0;
        }

        // FairnessBonus = max(0, (平均分配数 - 该工人分配数) / 平均分配数)
        double fairnessBonus = Math.max(0, (averageAllocations - workerAllocationCount) / averageAllocations);

        log.debug("计算公平性加分: factoryId={}, workerId={}, workerAllocations={}, avgAllocations={}, bonus={}",
                factoryId, workerId, workerAllocationCount, averageAllocations, fairnessBonus);

        return Math.min(1.0, fairnessBonus);
    }

    @Override
    public double calculateSkillMaintenanceBonus(String factoryId, Long workerId, String taskType) {
        return calculateSkillMaintenanceBonus(factoryId, workerId, taskType, config.getSkillDecayDays());
    }

    /**
     * 计算技能维护加分（使用指定的技能遗忘天数）
     */
    public double calculateSkillMaintenanceBonus(String factoryId, Long workerId, String taskType, int skillDecayDays) {
        if (taskType == null || taskType.isEmpty()) {
            return 0.0;
        }

        // 使用默认值如果未指定
        if (skillDecayDays <= 0) {
            skillDecayDays = config.getSkillDecayDays();
        }

        // 查找工人最后一次执行该工序的时间
        LocalDateTime lastExecution = feedbackRepository.findLastTaskDateByWorkerAndType(factoryId, workerId, taskType);

        if (lastExecution == null) {
            // 从未执行过该工序，返回最大技能维护加分
            return 1.0;
        }

        // 计算距今天数
        long daysSinceLast = java.time.temporal.ChronoUnit.DAYS.between(lastExecution.toLocalDate(), LocalDate.now());

        // SkillMaintenanceBonus = min(1.0, days_since_last / skillDecayDays)
        double skillMaintenanceBonus = Math.min(1.0, (double) daysSinceLast / skillDecayDays);

        log.debug("计算技能维护加分: factoryId={}, workerId={}, taskType={}, daysSinceLast={}, skillDecayDays={}, bonus={}",
                factoryId, workerId, taskType, daysSinceLast, skillDecayDays, skillMaintenanceBonus);

        return skillMaintenanceBonus;
    }

    @Override
    public double calculateRepetitionPenalty(String factoryId, Long workerId, String taskType) {
        return calculateRepetitionPenalty(factoryId, workerId, taskType, config.getRepetitionDays());
    }

    /**
     * 计算重复惩罚（使用指定的重复判定天数）
     */
    public double calculateRepetitionPenalty(String factoryId, Long workerId, String taskType, int repetitionDays) {
        if (taskType == null || taskType.isEmpty()) {
            return 0.0;
        }

        // 使用默认值如果未指定
        if (repetitionDays <= 0) {
            repetitionDays = config.getRepetitionDays();
        }

        LocalDateTime startTime = LocalDate.now().minusDays(repetitionDays).atStartOfDay();

        // 检查工人是否在最近N天内执行过该工序
        boolean didTaskRecently = feedbackRepository.existsByWorkerAndTaskTypeInPeriod(
                factoryId, workerId, taskType, startTime);

        double penalty = didTaskRecently ? 0.5 : 0.0;

        log.debug("计算重复惩罚: factoryId={}, workerId={}, taskType={}, repetitionDays={}, didRecently={}, penalty={}",
                factoryId, workerId, taskType, repetitionDays, didTaskRecently, penalty);

        return penalty;
    }

    @Override
    public double calculateDiversityAdjustedScore(String factoryId, Long workerId, String taskType, double linucbScore) {
        // 获取工人专属动态配置
        FactorySchedulingConfigService.EffectiveConfig effective =
                factoryConfigService.getEffectiveConfig(factoryId, workerId);

        // 检查是否需要强制排除（连续做同一工序超过阈值）
        ForceRotationCheck rotationCheck = checkForceRotation(factoryId, workerId, taskType,
                effective.getMaxConsecutiveDays());

        if (rotationCheck.shouldExclude) {
            log.warn("强制排除: workerId={} 已连续 {} 天做工序 {}",
                    workerId, rotationCheck.consecutiveDays, taskType);
            return -1.0;
        }

        // 使用动态权重
        double linucbWeight = effective.getLinucbWeight();
        double fairnessWeight = effective.getFairnessWeight();
        double skillMaintenanceWeight = effective.getSkillMaintenanceWeight();
        double repetitionWeight = effective.getRepetitionWeight();

        // 计算各项指标 - 使用 Fair-MAB 公平性计算
        double fairnessBonus = fairMABService.calculateFairnessBonus(factoryId, workerId);
        double skillMaintenanceBonus = calculateSkillMaintenanceBonus(factoryId, workerId, taskType,
                effective.getSkillDecayDays());
        double repetitionPenalty = calculateRepetitionPenalty(factoryId, workerId, taskType,
                effective.getRepetitionDays());

        // 临时工学习机会加成
        double learningBonus = 0.0;
        if (effective.isTempWorker()) {
            TempWorkerService.TempWorkerAdjustment adjustment =
                    tempWorkerService.calculateAdjustment(factoryId, workerId);
            learningBonus = adjustment.getLearningBonus();
            // 临时工调整 LinUCB 权重
            linucbWeight *= adjustment.getLinucbFactor();
            fairnessWeight *= adjustment.getFairnessFactor();
        }

        // SKU 复杂度加成（如果适用）
        double skuComplexityBonus = effective.getSkuComplexityBonus();

        // 连续做同一工序的严重惩罚（未到强制排除阈值，但接近）
        double severePenalty = 0.0;
        if (rotationCheck.consecutiveDays >= effective.getRepetitionDays()) {
            severePenalty = config.getSeverePenalty() *
                    (rotationCheck.consecutiveDays / (double) effective.getMaxConsecutiveDays());
            log.debug("应用连续工序严重惩罚: workerId={}, consecutiveDays={}, severePenalty={}",
                    workerId, rotationCheck.consecutiveDays, severePenalty);
        }

        // 最终分数
        double finalScore = linucbWeight * linucbScore
                + fairnessWeight * fairnessBonus
                + skillMaintenanceWeight * skillMaintenanceBonus
                - repetitionWeight * repetitionPenalty
                + learningBonus
                + skuComplexityBonus
                + severePenalty;

        log.debug("Worker {} score: linucb={:.4f}, fairness={:.4f}, skill={:.4f}, repetition={:.4f}, " +
                        "learning={:.4f}, skuBonus={:.4f}, severePenalty={:.4f}, final={:.4f}",
                workerId, linucbScore, fairnessBonus, skillMaintenanceBonus, repetitionPenalty,
                learningBonus, skuComplexityBonus, severePenalty, finalScore);

        return finalScore;
    }

    /**
     * 检查是否需要强制轮换
     * 当工人连续做同一工序超过配置的最大天数时，强制排除
     */
    public ForceRotationCheck checkForceRotation(String factoryId, Long workerId, String taskType, int maxConsecutiveDays) {
        ForceRotationCheck result = new ForceRotationCheck();
        result.taskType = taskType;

        if (taskType == null || taskType.isEmpty()) {
            return result;
        }

        // 如果传入0或负数，使用默认配置
        if (maxConsecutiveDays <= 0) {
            maxConsecutiveDays = config.getMaxConsecutiveDays();
        }
        LocalDateTime startDate = LocalDate.now().minusDays(maxConsecutiveDays + 1).atStartOfDay();

        // 获取工人最近的任务记录
        List<WorkerAllocationFeedback> recentTasks = feedbackRepository.findByFactoryIdAndWorkerId(factoryId, workerId)
                .stream()
                .filter(f -> f.getAssignedAt() != null && f.getAssignedAt().isAfter(startDate))
                .filter(f -> f.getStageType() != null) // 使用 stageType 而非 taskType
                .sorted(Comparator.comparing(WorkerAllocationFeedback::getAssignedAt).reversed())
                .collect(Collectors.toList());

        if (recentTasks.isEmpty()) {
            return result;
        }

        // 统计连续做同一工序的天数
        int consecutiveDays = 0;
        LocalDate lastDate = null;

        for (WorkerAllocationFeedback task : recentTasks) {
            String stageType = task.getStageType() != null ? task.getStageType().name() : null;
            if (!taskType.equals(stageType)) {
                break;
            }

            LocalDate taskDate = task.getAssignedAt().toLocalDate();
            if (lastDate == null || !taskDate.equals(lastDate)) {
                consecutiveDays++;
                lastDate = taskDate;
            }
        }

        result.consecutiveDays = consecutiveDays;
        result.shouldExclude = consecutiveDays >= maxConsecutiveDays;

        return result;
    }

    /**
     * 计算技能衰减风险加分
     * 如果某技能即将衰减（接近30天未使用），给予额外加分以鼓励使用
     */
    public double calculateSkillDecayRiskBonus(String factoryId, Long workerId, String taskType) {
        if (taskType == null || taskType.isEmpty()) {
            return 0.0;
        }

        LocalDateTime lastExecution = feedbackRepository.findLastTaskDateByWorkerAndType(factoryId, workerId, taskType);

        if (lastExecution == null) {
            // 从未执行过，不适用衰减逻辑（这是技能发展，不是技能维护）
            return 0.0;
        }

        long daysSinceLast = java.time.temporal.ChronoUnit.DAYS.between(lastExecution.toLocalDate(), LocalDate.now());
        int skillDecayDays = config.getSkillDecayDays();

        // 如果距离上次执行超过20天（即将衰减），给予额外加分
        // 加分公式: 超过20天后，每天增加0.02的加分，最高0.2
        if (daysSinceLast >= skillDecayDays * 0.67) { // 20天 / 30天
            double decayRiskBonus = Math.min(0.2, (daysSinceLast - skillDecayDays * 0.67) * 0.02);
            log.debug("技能衰减风险加分: workerId={}, taskType={}, daysSinceLast={}, bonus={}",
                    workerId, taskType, daysSinceLast, decayRiskBonus);
            return decayRiskBonus;
        }

        return 0.0;
    }

    /**
     * 强制轮换检查结果
     */
    public static class ForceRotationCheck {
        public String taskType;
        public int consecutiveDays = 0;
        public boolean shouldExclude = false;
    }

    @Override
    public List<Long> getWorkersNeedingSkillMaintenance(String factoryId, String taskType) {
        if (taskType == null || taskType.isEmpty()) {
            return Collections.emptyList();
        }

        // 获取工厂所有有分配记录的工人
        List<Long> allWorkers = feedbackRepository.findAllDistinctWorkerIdsByFactoryId(factoryId);

        if (allWorkers.isEmpty()) {
            return Collections.emptyList();
        }

        // 获取30天内执行过该工序的工人
        LocalDateTime startTime = LocalDate.now().minusDays(30).atStartOfDay();
        List<Long> workersWhoDidTaskRecently = feedbackRepository.findWorkersWhoDidTaskTypeInPeriod(
                factoryId, taskType, startTime);

        // 找出30天内未执行该工序的工人
        Set<Long> recentWorkers = new HashSet<>(workersWhoDidTaskRecently);
        List<Long> workersNeedingMaintenance = allWorkers.stream()
                .filter(workerId -> !recentWorkers.contains(workerId))
                .collect(Collectors.toList());

        log.info("获取需要技能维护的工人: factoryId={}, taskType={}, totalWorkers={}, needMaintenance={}",
                factoryId, taskType, allWorkers.size(), workersNeedingMaintenance.size());

        return workersNeedingMaintenance;
    }

    // ==================== 私有方法 ====================

    private String extractProcessType(Map<String, Object> taskInfo) {
        Object value = taskInfo.get("processType");
        if (value == null) {
            value = taskInfo.get("stageType");
        }
        if (value == null) {
            value = taskInfo.get("taskType");
        }
        return value != null ? value.toString() : null;
    }

    private String extractProductType(Map<String, Object> taskInfo) {
        Object value = taskInfo.get("productType");
        return value != null ? value.toString() : null;
    }

    private Integer extractComplexity(Map<String, Object> taskInfo) {
        Object value = taskInfo.get("complexity");
        if (value instanceof Integer) {
            return (Integer) value;
        } else if (value != null) {
            try {
                return Integer.parseInt(value.toString());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private String extractProductTypeFromFeedback(WorkerAllocationFeedback feedback) {
        // TODO: 从feedback的taskFeatures JSON中提取productType
        return null;
    }

    private Integer extractComplexityFromFeedback(WorkerAllocationFeedback feedback) {
        // TODO: 从feedback的taskFeatures JSON中提取complexity
        return null;
    }

    private Set<String> getAllFactoryProcessTypes(String factoryId) {
        // 常见的食品加工工序类型
        return new HashSet<>(Arrays.asList(
                "SLICING",      // 切片
                "MARINATING",   // 腌制
                "PACKAGING",    // 包装
                "INSPECTION",   // 检验
                "FREEZING",     // 冷冻
                "THAWING",      // 解冻
                "WEIGHING",     // 称重
                "SORTING",      // 分拣
                "CLEANING"      // 清洗
        ));
    }

    // ==================== 任务分配后更新方法 ====================

    /**
     * 任务分配完成后的更新操作
     * 更新 Fair-MAB 虚拟队列和临时工绩效统计
     *
     * @param factoryId   工厂ID
     * @param workerId    工人ID
     * @param wasAssigned 是否被分配了任务
     * @param efficiency  效率（如果任务完成）
     * @param completed   是否完成任务
     */
    public void onTaskAssignmentComplete(String factoryId, Long workerId, boolean wasAssigned,
                                          Double efficiency, boolean completed) {
        try {
            // 更新 Fair-MAB 虚拟队列
            fairMABService.updateVirtualQueue(factoryId, workerId, wasAssigned);
            log.debug("更新虚拟队列: factoryId={}, workerId={}, wasAssigned={}", factoryId, workerId, wasAssigned);

            // 如果是临时工，更新绩效统计
            if (tempWorkerService.isTempWorker(factoryId, workerId)) {
                double actualEfficiency = efficiency != null ? efficiency : 0.0;
                tempWorkerService.updatePerformanceStats(factoryId, workerId, actualEfficiency, completed);
                log.debug("更新临时工绩效: factoryId={}, workerId={}, efficiency={}, completed={}",
                        factoryId, workerId, actualEfficiency, completed);
            }
        } catch (Exception e) {
            log.error("任务分配后更新失败: factoryId={}, workerId={}, error={}",
                    factoryId, workerId, e.getMessage(), e);
        }
    }

    /**
     * 批量更新任务分配后状态
     *
     * @param factoryId      工厂ID
     * @param assignedWorker 被分配任务的工人ID
     * @param candidates     所有候选工人ID列表
     */
    public void onBatchTaskAssignment(String factoryId, Long assignedWorker, List<Long> candidates) {
        for (Long workerId : candidates) {
            boolean wasAssigned = workerId.equals(assignedWorker);
            fairMABService.updateVirtualQueue(factoryId, workerId, wasAssigned);
        }
        log.info("批量更新虚拟队列完成: factoryId={}, assignedWorker={}, candidateCount={}",
                factoryId, assignedWorker, candidates.size());
    }

    /**
     * 向后兼容的强制轮换检查方法
     */
    public ForceRotationCheck checkForceRotation(String factoryId, Long workerId, String taskType) {
        return checkForceRotation(factoryId, workerId, taskType, config.getMaxConsecutiveDays());
    }

    private static class ScoredRecommendation {
        LinUCBService.WorkerRecommendation recommendation;
        double mmrScore;
        double historySimilarity;

        ScoredRecommendation(LinUCBService.WorkerRecommendation recommendation,
                           double mmrScore, double historySimilarity) {
            this.recommendation = recommendation;
            this.mmrScore = mmrScore;
            this.historySimilarity = historySimilarity;
        }
    }
}

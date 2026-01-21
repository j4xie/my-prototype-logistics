package com.cretas.aims.service.aps;

import com.cretas.aims.dto.aps.CompletionPrediction;
import com.cretas.aims.dto.aps.EfficiencyHistoryDTO;
import com.cretas.aims.dto.aps.ProgressUpdateRequest;
import com.cretas.aims.dto.aps.ProgressUpdateResponse;
import com.cretas.aims.dto.aps.RiskAssessmentDTO;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * APS 自适应排产优化服务
 *
 * 核心功能:
 * 1. 实时进度追踪 - 监控实际vs计划进度
 * 2. 效率动态计算 - 滚动效率因子
 * 3. 完成概率预测 - 预测准时完成概率
 * 4. 策略权重自适应 - 根据历史效果自动调整
 * 5. 重排触发机制 - 概率低于阈值时触发重排
 *
 * @author Cretas APS Adaptive Scheduling V1.0
 * @since 2026-01-21
 */
public interface APSAdaptiveSchedulingService {

    // ==================== 常量定义 ====================

    /** 完成概率阈值 - 低于此值触发预警 */
    double PROBABILITY_WARNING_THRESHOLD = 0.7;

    /** 完成概率阈值 - 低于此值触发重排 */
    double PROBABILITY_RESCHEDULE_THRESHOLD = 0.5;

    /** 效率计算的滚动窗口(小时) */
    int EFFICIENCY_ROLLING_WINDOW_HOURS = 4;

    /** 策略权重调整的学习率 */
    double STRATEGY_LEARNING_RATE = 0.05;

    // ==================== 实时进度追踪 ====================

    /**
     * 更新任务进度
     *
     * @param taskId 任务ID
     * @param completedQty 已完成数量
     * @param actualEfficiency 实际效率(件/小时)
     * @return 进度更新结果
     */
    ProgressUpdateResult updateTaskProgress(String taskId, double completedQty, Double actualEfficiency);

    /**
     * 获取任务实时状态
     *
     * @param taskId 任务ID
     * @return 任务实时状态
     */
    TaskRealTimeStatus getTaskRealTimeStatus(String taskId);

    /**
     * 获取产线实时状态
     *
     * @param lineId 产线ID
     * @return 产线实时状态
     */
    LineRealTimeStatus getLineRealTimeStatus(String lineId);

    /**
     * 获取全局实时状态仪表盘
     *
     * @return 全局状态
     */
    GlobalDashboard getGlobalDashboard();

    // ==================== 效率动态计算 ====================

    /**
     * 计算产线滚动效率因子
     * 基于最近N小时的实际产出计算
     *
     * @param lineId 产线ID
     * @return 滚动效率因子 (1.0为标准, >1为高效, <1为低效)
     */
    double calculateRollingEfficiency(String lineId);

    /**
     * 效率滚动计算 (EWMA - 指数加权移动平均)
     * alpha = 0.3 (新数据权重)
     *
     * @param lineId 产线ID
     * @param currentEfficiency 当前效率
     * @return 滚动效率因子
     */
    BigDecimal calculateRollingEfficiency(String lineId, BigDecimal currentEfficiency);

    /**
     * 计算工人效率因子
     *
     * @param workerId 工人ID
     * @return 效率因子
     */
    double calculateWorkerEfficiency(String workerId);

    /**
     * 更新产线效率因子到数据库
     *
     * @param lineId 产线ID
     */
    void updateLineEfficiencyFactor(String lineId);

    /**
     * 记录效率历史
     *
     * @param lineId 产线ID
     * @param taskId 任务ID
     * @param actualOutput 实际产出
     * @param expectedOutput 期望产出
     * @param workerCount 工人数量
     */
    void recordEfficiencyHistory(String lineId, String taskId,
        BigDecimal actualOutput, BigDecimal expectedOutput, Integer workerCount);

    /**
     * 获取效率历史记录
     *
     * @param lineId 产线ID
     * @param hours 最近小时数
     * @return 效率历史列表
     */
    List<EfficiencyHistoryDTO> getEfficiencyHistory(String lineId, int hours);

    // ==================== 完成概率预测 ====================

    /**
     * 预测任务准时完成概率
     *
     * 特征输入:
     * - 当前进度百分比
     * - 剩余时间
     * - 产线效率趋势
     * - 历史同类任务完成率
     * - 当前工人配置
     *
     * @param taskId 任务ID
     * @return 完成概率 [0, 1]
     */
    double predictCompletionProbability(String taskId);

    /**
     * 完成概率预测 - 12维特征逻辑回归
     *
     * 特征向量:
     * [0] 进度百分比 (0-1)
     * [1] 剩余时间紧迫度 (0=宽松, 1=紧迫)
     * [2] 产线效率因子 (相对1.0的偏差)
     * [3] 工人配置满足度
     * [4] 历史同类任务完成率
     * [5] 当前延迟程度
     * [6] 物料齐套率
     * [7] 是否紧急订单
     * [8] 时间窗口宽度
     * [9] 偏置项 (1.0)
     * [10] 效率趋势 (上升/下降)
     * [11] 已发生冲突数
     *
     * @param taskId 任务ID
     * @return 完成预测结果
     */
    CompletionPrediction predictTaskCompletion(String taskId);

    /**
     * 获取任务风险评估详情
     *
     * @param taskId 任务ID
     * @return 风险评估DTO
     */
    RiskAssessmentDTO getTaskRiskAssessment(String taskId);

    /**
     * 使用DTO更新任务进度
     *
     * @param taskId 任务ID
     * @param request 进度更新请求
     * @return 进度更新响应
     */
    ProgressUpdateResponse updateTaskProgress(String taskId, ProgressUpdateRequest request);

    /**
     * 批量预测所有进行中任务的完成概率
     *
     * @return 任务ID -> 完成概率
     */
    Map<String, Double> predictAllTasksProbability();

    /**
     * 获取低概率任务列表(需要关注的任务)
     *
     * @param threshold 概率阈值
     * @return 低概率任务列表
     */
    List<TaskRiskInfo> getLowProbabilityTasks(double threshold);

    /**
     * 确定风险等级
     *
     * 风险等级判断标准:
     * - probability >= 0.8: low (绿色)
     * - probability >= 0.6: medium (黄色预警)
     * - probability >= 0.5: high (红色高危)
     * - probability < 0.5: critical (需立即重排)
     *
     * @param probability 完成概率
     * @return 风险等级
     */
    String determineRiskLevel(double probability);

    // ==================== 策略权重自适应 ====================

    /**
     * 根据历史效果自动调整策略权重
     *
     * 评估维度:
     * - 准时完成率 (影响 earliest_deadline 权重)
     * - 换型时间占比 (影响 min_changeover 权重)
     * - 产线利用率 (影响 capacity_match 权重)
     * - 紧急订单满足率 (影响 urgency_first 权重)
     */
    void autoAdjustStrategyWeights();

    /**
     * 获取策略权重调整历史
     *
     * @param days 最近N天
     * @return 调整历史
     */
    List<WeightAdjustmentRecord> getWeightAdjustmentHistory(int days);

    /**
     * 获取各策略的效果评估
     *
     * @return 策略效果评估
     */
    Map<String, StrategyEffectiveness> evaluateStrategyEffectiveness();

    // ==================== 重排触发机制 ====================

    /**
     * 检查是否需要触发重排
     *
     * 触发条件:
     * 1. 有任务完成概率低于阈值
     * 2. 产线发生故障
     * 3. 紧急订单插入
     * 4. 物料短缺
     *
     * @return 重排建议
     */
    RescheduleRecommendation checkRescheduleNeed();

    /**
     * 执行自适应重排
     * 只重排受影响的任务，而不是全部重排
     *
     * @param affectedTaskIds 受影响的任务ID列表
     * @return 重排结果
     */
    SchedulingResult adaptiveReschedule(List<String> affectedTaskIds);

    /**
     * 模拟重排效果(不实际执行)
     *
     * @param affectedTaskIds 受影响的任务ID列表
     * @return 模拟结果
     */
    RescheduleSimulation simulateReschedule(List<String> affectedTaskIds);

    // ==================== 内部类定义 ====================

    /**
     * 排产结果
     */
    class SchedulingResult {
        private boolean success;
        private String scheduleBatchNo;
        private int totalTasks;
        private int scheduledTasks;
        private String message;

        // Getters and setters
        public boolean isSuccess() { return success; }
        public void setSuccess(boolean success) { this.success = success; }
        public String getScheduleBatchNo() { return scheduleBatchNo; }
        public void setScheduleBatchNo(String scheduleBatchNo) { this.scheduleBatchNo = scheduleBatchNo; }
        public int getTotalTasks() { return totalTasks; }
        public void setTotalTasks(int totalTasks) { this.totalTasks = totalTasks; }
        public int getScheduledTasks() { return scheduledTasks; }
        public void setScheduledTasks(int scheduledTasks) { this.scheduledTasks = scheduledTasks; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
    }

    /**
     * 进度更新结果
     */
    class ProgressUpdateResult {
        private String taskId;
        private double previousProgress;
        private double currentProgress;
        private double completionProbability;
        private boolean needsAttention;
        private String message;

        // Getters and setters
        public String getTaskId() { return taskId; }
        public void setTaskId(String taskId) { this.taskId = taskId; }
        public double getPreviousProgress() { return previousProgress; }
        public void setPreviousProgress(double previousProgress) { this.previousProgress = previousProgress; }
        public double getCurrentProgress() { return currentProgress; }
        public void setCurrentProgress(double currentProgress) { this.currentProgress = currentProgress; }
        public double getCompletionProbability() { return completionProbability; }
        public void setCompletionProbability(double completionProbability) { this.completionProbability = completionProbability; }
        public boolean isNeedsAttention() { return needsAttention; }
        public void setNeedsAttention(boolean needsAttention) { this.needsAttention = needsAttention; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
    }

    /**
     * 任务实时状态
     */
    class TaskRealTimeStatus {
        private String taskId;
        private String taskNo;
        private String productName;
        private String lineName;
        private double plannedQty;
        private double completedQty;
        private double progressPercent;
        private LocalDateTime plannedStart;
        private LocalDateTime plannedEnd;
        private LocalDateTime estimatedEnd;  // 基于当前效率预估的完成时间
        private int delayMinutes;            // 预计延迟分钟数
        private double completionProbability;
        private double currentEfficiency;    // 当前效率(件/小时)
        private double plannedEfficiency;    // 计划效率
        private String status;
        private String riskLevel;            // low/medium/high/critical

        // Getters and setters
        public String getTaskId() { return taskId; }
        public void setTaskId(String taskId) { this.taskId = taskId; }
        public String getTaskNo() { return taskNo; }
        public void setTaskNo(String taskNo) { this.taskNo = taskNo; }
        public String getProductName() { return productName; }
        public void setProductName(String productName) { this.productName = productName; }
        public String getLineName() { return lineName; }
        public void setLineName(String lineName) { this.lineName = lineName; }
        public double getPlannedQty() { return plannedQty; }
        public void setPlannedQty(double plannedQty) { this.plannedQty = plannedQty; }
        public double getCompletedQty() { return completedQty; }
        public void setCompletedQty(double completedQty) { this.completedQty = completedQty; }
        public double getProgressPercent() { return progressPercent; }
        public void setProgressPercent(double progressPercent) { this.progressPercent = progressPercent; }
        public LocalDateTime getPlannedStart() { return plannedStart; }
        public void setPlannedStart(LocalDateTime plannedStart) { this.plannedStart = plannedStart; }
        public LocalDateTime getPlannedEnd() { return plannedEnd; }
        public void setPlannedEnd(LocalDateTime plannedEnd) { this.plannedEnd = plannedEnd; }
        public LocalDateTime getEstimatedEnd() { return estimatedEnd; }
        public void setEstimatedEnd(LocalDateTime estimatedEnd) { this.estimatedEnd = estimatedEnd; }
        public int getDelayMinutes() { return delayMinutes; }
        public void setDelayMinutes(int delayMinutes) { this.delayMinutes = delayMinutes; }
        public double getCompletionProbability() { return completionProbability; }
        public void setCompletionProbability(double completionProbability) { this.completionProbability = completionProbability; }
        public double getCurrentEfficiency() { return currentEfficiency; }
        public void setCurrentEfficiency(double currentEfficiency) { this.currentEfficiency = currentEfficiency; }
        public double getPlannedEfficiency() { return plannedEfficiency; }
        public void setPlannedEfficiency(double plannedEfficiency) { this.plannedEfficiency = plannedEfficiency; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public String getRiskLevel() { return riskLevel; }
        public void setRiskLevel(String riskLevel) { this.riskLevel = riskLevel; }
    }

    /**
     * 产线实时状态
     */
    class LineRealTimeStatus {
        private String lineId;
        private String lineName;
        private String status;
        private double rollingEfficiency;     // 滚动效率因子
        private double utilizationRate;       // 利用率
        private int currentWorkerCount;
        private String currentTaskId;
        private String currentProductName;
        private double currentTaskProgress;
        private int todayCompletedTasks;
        private int todayTotalTasks;
        private double todayOnTimeRate;       // 今日准时率
        private LocalDateTime nextAvailableTime;
        private List<String> upcomingTaskIds; // 后续任务ID

        // Getters and setters
        public String getLineId() { return lineId; }
        public void setLineId(String lineId) { this.lineId = lineId; }
        public String getLineName() { return lineName; }
        public void setLineName(String lineName) { this.lineName = lineName; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public double getRollingEfficiency() { return rollingEfficiency; }
        public void setRollingEfficiency(double rollingEfficiency) { this.rollingEfficiency = rollingEfficiency; }
        public double getUtilizationRate() { return utilizationRate; }
        public void setUtilizationRate(double utilizationRate) { this.utilizationRate = utilizationRate; }
        public int getCurrentWorkerCount() { return currentWorkerCount; }
        public void setCurrentWorkerCount(int currentWorkerCount) { this.currentWorkerCount = currentWorkerCount; }
        public String getCurrentTaskId() { return currentTaskId; }
        public void setCurrentTaskId(String currentTaskId) { this.currentTaskId = currentTaskId; }
        public String getCurrentProductName() { return currentProductName; }
        public void setCurrentProductName(String currentProductName) { this.currentProductName = currentProductName; }
        public double getCurrentTaskProgress() { return currentTaskProgress; }
        public void setCurrentTaskProgress(double currentTaskProgress) { this.currentTaskProgress = currentTaskProgress; }
        public int getTodayCompletedTasks() { return todayCompletedTasks; }
        public void setTodayCompletedTasks(int todayCompletedTasks) { this.todayCompletedTasks = todayCompletedTasks; }
        public int getTodayTotalTasks() { return todayTotalTasks; }
        public void setTodayTotalTasks(int todayTotalTasks) { this.todayTotalTasks = todayTotalTasks; }
        public double getTodayOnTimeRate() { return todayOnTimeRate; }
        public void setTodayOnTimeRate(double todayOnTimeRate) { this.todayOnTimeRate = todayOnTimeRate; }
        public LocalDateTime getNextAvailableTime() { return nextAvailableTime; }
        public void setNextAvailableTime(LocalDateTime nextAvailableTime) { this.nextAvailableTime = nextAvailableTime; }
        public List<String> getUpcomingTaskIds() { return upcomingTaskIds; }
        public void setUpcomingTaskIds(List<String> upcomingTaskIds) { this.upcomingTaskIds = upcomingTaskIds; }
    }

    /**
     * 全局仪表盘
     */
    class GlobalDashboard {
        private LocalDateTime updateTime;
        private int totalActiveTasks;
        private int onTrackTasks;           // 正常进行的任务
        private int atRiskTasks;            // 有风险的任务
        private int delayedTasks;           // 已延迟的任务
        private double overallOnTimeRate;   // 整体准时率
        private double averageEfficiency;   // 平均效率
        private double averageCompletionProbability;
        private int activeLines;
        private int idleLines;
        private int maintenanceLines;
        private List<TaskRiskInfo> topRisks;  // 最高风险任务
        private Map<String, Double> strategyWeights;
        private RescheduleRecommendation rescheduleRecommendation;

        // Getters and setters
        public LocalDateTime getUpdateTime() { return updateTime; }
        public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
        public int getTotalActiveTasks() { return totalActiveTasks; }
        public void setTotalActiveTasks(int totalActiveTasks) { this.totalActiveTasks = totalActiveTasks; }
        public int getOnTrackTasks() { return onTrackTasks; }
        public void setOnTrackTasks(int onTrackTasks) { this.onTrackTasks = onTrackTasks; }
        public int getAtRiskTasks() { return atRiskTasks; }
        public void setAtRiskTasks(int atRiskTasks) { this.atRiskTasks = atRiskTasks; }
        public int getDelayedTasks() { return delayedTasks; }
        public void setDelayedTasks(int delayedTasks) { this.delayedTasks = delayedTasks; }
        public double getOverallOnTimeRate() { return overallOnTimeRate; }
        public void setOverallOnTimeRate(double overallOnTimeRate) { this.overallOnTimeRate = overallOnTimeRate; }
        public double getAverageEfficiency() { return averageEfficiency; }
        public void setAverageEfficiency(double averageEfficiency) { this.averageEfficiency = averageEfficiency; }
        public double getAverageCompletionProbability() { return averageCompletionProbability; }
        public void setAverageCompletionProbability(double averageCompletionProbability) { this.averageCompletionProbability = averageCompletionProbability; }
        public int getActiveLines() { return activeLines; }
        public void setActiveLines(int activeLines) { this.activeLines = activeLines; }
        public int getIdleLines() { return idleLines; }
        public void setIdleLines(int idleLines) { this.idleLines = idleLines; }
        public int getMaintenanceLines() { return maintenanceLines; }
        public void setMaintenanceLines(int maintenanceLines) { this.maintenanceLines = maintenanceLines; }
        public List<TaskRiskInfo> getTopRisks() { return topRisks; }
        public void setTopRisks(List<TaskRiskInfo> topRisks) { this.topRisks = topRisks; }
        public Map<String, Double> getStrategyWeights() { return strategyWeights; }
        public void setStrategyWeights(Map<String, Double> strategyWeights) { this.strategyWeights = strategyWeights; }
        public RescheduleRecommendation getRescheduleRecommendation() { return rescheduleRecommendation; }
        public void setRescheduleRecommendation(RescheduleRecommendation rescheduleRecommendation) { this.rescheduleRecommendation = rescheduleRecommendation; }
    }

    /**
     * 任务风险信息
     */
    class TaskRiskInfo {
        private String taskId;
        private String taskNo;
        private String productName;
        private String lineName;
        private double completionProbability;
        private int estimatedDelayMinutes;
        private String riskLevel;
        private String riskReason;
        private List<String> suggestedActions;

        // Getters and setters
        public String getTaskId() { return taskId; }
        public void setTaskId(String taskId) { this.taskId = taskId; }
        public String getTaskNo() { return taskNo; }
        public void setTaskNo(String taskNo) { this.taskNo = taskNo; }
        public String getProductName() { return productName; }
        public void setProductName(String productName) { this.productName = productName; }
        public String getLineName() { return lineName; }
        public void setLineName(String lineName) { this.lineName = lineName; }
        public double getCompletionProbability() { return completionProbability; }
        public void setCompletionProbability(double completionProbability) { this.completionProbability = completionProbability; }
        public int getEstimatedDelayMinutes() { return estimatedDelayMinutes; }
        public void setEstimatedDelayMinutes(int estimatedDelayMinutes) { this.estimatedDelayMinutes = estimatedDelayMinutes; }
        public String getRiskLevel() { return riskLevel; }
        public void setRiskLevel(String riskLevel) { this.riskLevel = riskLevel; }
        public String getRiskReason() { return riskReason; }
        public void setRiskReason(String riskReason) { this.riskReason = riskReason; }
        public List<String> getSuggestedActions() { return suggestedActions; }
        public void setSuggestedActions(List<String> suggestedActions) { this.suggestedActions = suggestedActions; }
    }

    /**
     * 策略效果评估
     */
    class StrategyEffectiveness {
        private String strategyName;
        private double currentWeight;
        private double effectivenessScore;  // 0-1, 效果评分
        private double contributionRate;    // 对整体效果的贡献率
        private String trend;               // improving/stable/declining
        private double suggestedWeight;     // 建议权重

        // Getters and setters
        public String getStrategyName() { return strategyName; }
        public void setStrategyName(String strategyName) { this.strategyName = strategyName; }
        public double getCurrentWeight() { return currentWeight; }
        public void setCurrentWeight(double currentWeight) { this.currentWeight = currentWeight; }
        public double getEffectivenessScore() { return effectivenessScore; }
        public void setEffectivenessScore(double effectivenessScore) { this.effectivenessScore = effectivenessScore; }
        public double getContributionRate() { return contributionRate; }
        public void setContributionRate(double contributionRate) { this.contributionRate = contributionRate; }
        public String getTrend() { return trend; }
        public void setTrend(String trend) { this.trend = trend; }
        public double getSuggestedWeight() { return suggestedWeight; }
        public void setSuggestedWeight(double suggestedWeight) { this.suggestedWeight = suggestedWeight; }
    }

    /**
     * 权重调整记录
     */
    class WeightAdjustmentRecord {
        private LocalDateTime adjustTime;
        private Map<String, Double> previousWeights;
        private Map<String, Double> newWeights;
        private String reason;
        private Map<String, Double> performanceMetrics;

        // Getters and setters
        public LocalDateTime getAdjustTime() { return adjustTime; }
        public void setAdjustTime(LocalDateTime adjustTime) { this.adjustTime = adjustTime; }
        public Map<String, Double> getPreviousWeights() { return previousWeights; }
        public void setPreviousWeights(Map<String, Double> previousWeights) { this.previousWeights = previousWeights; }
        public Map<String, Double> getNewWeights() { return newWeights; }
        public void setNewWeights(Map<String, Double> newWeights) { this.newWeights = newWeights; }
        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
        public Map<String, Double> getPerformanceMetrics() { return performanceMetrics; }
        public void setPerformanceMetrics(Map<String, Double> performanceMetrics) { this.performanceMetrics = performanceMetrics; }
    }

    /**
     * 重排建议
     */
    class RescheduleRecommendation {
        private boolean needReschedule;
        private String urgencyLevel;        // none/low/medium/high/critical
        private List<String> reasons;
        private List<String> affectedTaskIds;
        private int estimatedImprovementMinutes;  // 预计可减少的延迟
        private double expectedOnTimeRateImprovement;  // 预计准时率提升

        // Getters and setters
        public boolean isNeedReschedule() { return needReschedule; }
        public void setNeedReschedule(boolean needReschedule) { this.needReschedule = needReschedule; }
        public String getUrgencyLevel() { return urgencyLevel; }
        public void setUrgencyLevel(String urgencyLevel) { this.urgencyLevel = urgencyLevel; }
        public List<String> getReasons() { return reasons; }
        public void setReasons(List<String> reasons) { this.reasons = reasons; }
        public List<String> getAffectedTaskIds() { return affectedTaskIds; }
        public void setAffectedTaskIds(List<String> affectedTaskIds) { this.affectedTaskIds = affectedTaskIds; }
        public int getEstimatedImprovementMinutes() { return estimatedImprovementMinutes; }
        public void setEstimatedImprovementMinutes(int estimatedImprovementMinutes) { this.estimatedImprovementMinutes = estimatedImprovementMinutes; }
        public double getExpectedOnTimeRateImprovement() { return expectedOnTimeRateImprovement; }
        public void setExpectedOnTimeRateImprovement(double expectedOnTimeRateImprovement) { this.expectedOnTimeRateImprovement = expectedOnTimeRateImprovement; }
    }

    /**
     * 重排模拟结果
     */
    class RescheduleSimulation {
        private Map<String, Double> beforeProbabilities;
        private Map<String, Double> afterProbabilities;
        private int beforeDelayedTasks;
        private int afterDelayedTasks;
        private double beforeOnTimeRate;
        private double afterOnTimeRate;
        private List<TaskRiskInfo> improvedTasks;
        private List<TaskRiskInfo> worsenedTasks;
        private boolean recommendExecute;

        // Getters and setters
        public Map<String, Double> getBeforeProbabilities() { return beforeProbabilities; }
        public void setBeforeProbabilities(Map<String, Double> beforeProbabilities) { this.beforeProbabilities = beforeProbabilities; }
        public Map<String, Double> getAfterProbabilities() { return afterProbabilities; }
        public void setAfterProbabilities(Map<String, Double> afterProbabilities) { this.afterProbabilities = afterProbabilities; }
        public int getBeforeDelayedTasks() { return beforeDelayedTasks; }
        public void setBeforeDelayedTasks(int beforeDelayedTasks) { this.beforeDelayedTasks = beforeDelayedTasks; }
        public int getAfterDelayedTasks() { return afterDelayedTasks; }
        public void setAfterDelayedTasks(int afterDelayedTasks) { this.afterDelayedTasks = afterDelayedTasks; }
        public double getBeforeOnTimeRate() { return beforeOnTimeRate; }
        public void setBeforeOnTimeRate(double beforeOnTimeRate) { this.beforeOnTimeRate = beforeOnTimeRate; }
        public double getAfterOnTimeRate() { return afterOnTimeRate; }
        public void setAfterOnTimeRate(double afterOnTimeRate) { this.afterOnTimeRate = afterOnTimeRate; }
        public List<TaskRiskInfo> getImprovedTasks() { return improvedTasks; }
        public void setImprovedTasks(List<TaskRiskInfo> improvedTasks) { this.improvedTasks = improvedTasks; }
        public List<TaskRiskInfo> getWorsenedTasks() { return worsenedTasks; }
        public void setWorsenedTasks(List<TaskRiskInfo> worsenedTasks) { this.worsenedTasks = worsenedTasks; }
        public boolean isRecommendExecute() { return recommendExecute; }
        public void setRecommendExecute(boolean recommendExecute) { this.recommendExecute = recommendExecute; }
    }
}

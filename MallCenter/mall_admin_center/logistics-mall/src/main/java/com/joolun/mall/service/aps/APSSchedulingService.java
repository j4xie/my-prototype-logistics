package com.joolun.mall.service.aps;

import com.joolun.mall.entity.aps.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * APS 排程服务接口
 * (复用配送调度的多策略模式)
 *
 * 多策略调度 (策略权重可配置):
 * - earliest_deadline (25%): 最早交期优先
 * - shortest_process (20%): 最短工时优先
 * - min_changeover (20%): 最小换型时间
 * - capacity_match (15%): 产能匹配度
 * - material_ready (10%): 物料齐套优先
 * - urgency_first (10%): 紧急度优先
 *
 * 支持10大复杂场景:
 * 1. 多产线协调与人员调配
 * 2. 混批生产优化
 * 3. 工艺约束与时间窗口
 * 4. 跨天排程
 * 5. 设备/模具共享冲突
 * 6. 物料到达约束
 * 7. 多班次管理
 * 8. 质检等待
 * 9. 紧急插单
 * 10. 综合场景
 *
 * @author APS Scheduling V1.0
 * @since 2026-01-21
 */
public interface APSSchedulingService {

    // ==================== 核心调度方法 ====================

    /**
     * 单订单调度
     * 返回产线候选列表，按综合得分排序
     *
     * @param order 生产订单
     * @return 产线候选列表
     */
    List<LineCandidate> scheduleOrder(ProductionOrder order);

    /**
     * 批量调度
     * 对指定日期范围的订单进行优化排程
     *
     * @param startDate 开始日期
     * @param endDate 结束日期
     * @return 排程结果
     */
    SchedulingResult batchSchedule(LocalDate startDate, LocalDate endDate);

    /**
     * 紧急插单
     * 处理紧急订单的插入
     *
     * @param order 紧急订单
     * @return 插单结果
     */
    InsertResult insertUrgentOrder(ProductionOrder order);

    /**
     * 重新排程
     * 从指定时间点重新计算排程
     *
     * @param fromDate 重排起始日期
     * @return 排程结果
     */
    SchedulingResult reschedule(LocalDate fromDate);

    // ==================== 冲突检测 ====================

    /**
     * 检测资源冲突
     *
     * @param tasks 排程任务列表
     * @return 冲突列表
     */
    List<ScheduleConflict> detectConflicts(List<ScheduleTask> tasks);

    /**
     * 尝试解决冲突
     *
     * @param conflict 冲突
     * @return 是否成功解决
     */
    boolean resolveConflict(ScheduleConflict conflict);

    // ==================== 混批优化 ====================

    /**
     * 分析混批机会
     * 找出可以合并生产的订单
     *
     * @param orders 订单列表
     * @return 混批组合列表
     */
    List<MixBatchGroup> analyzeMixBatchOpportunities(List<ProductionOrder> orders);

    /**
     * 执行混批合并
     *
     * @param group 混批组
     * @return 合并后的任务
     */
    ScheduleTask mergeMixBatch(MixBatchGroup group);

    // ==================== 人员调配 ====================

    /**
     * 优化人员分配
     * 根据产线进度调配人员
     *
     * @param date 日期
     * @return 人员分配方案
     */
    List<WorkerAssignment> optimizeWorkerAssignment(LocalDate date);

    /**
     * 人员调配建议
     * 当一条产线即将完成时，建议调配方向
     *
     * @param fromLineId 来源产线
     * @param workerCount 可调配人数
     * @return 调配建议列表
     */
    List<TransferSuggestion> suggestWorkerTransfer(String fromLineId, int workerCount);

    // ==================== 换型优化 ====================

    /**
     * 优化生产顺序
     * 使换型时间最小化
     *
     * @param tasks 任务列表
     * @param lineId 产线ID
     * @return 优化后的顺序
     */
    List<ScheduleTask> optimizeSequence(List<ScheduleTask> tasks, String lineId);

    /**
     * 计算换型时间
     *
     * @param fromCategory 来源类别
     * @param toCategory 目标类别
     * @param lineId 产线ID
     * @return 换型时间(分钟)
     */
    int calculateChangeoverTime(String fromCategory, String toCategory, String lineId);

    // ==================== 配置管理 ====================

    /**
     * 获取调度策略权重
     */
    Map<String, Double> getStrategyWeights();

    /**
     * 更新调度策略权重
     */
    void updateStrategyWeights(Map<String, Double> weights);

    /**
     * 获取排程统计
     */
    Map<String, Object> getSchedulingStats();

    // ==================== 数据类 ====================

    /**
     * 产线候选
     */
    class LineCandidate {
        private String lineId;
        private ProductionLine line;
        private double score;
        private Map<String, Double> strategyScores;
        private int estimatedDuration;
        private int changeoverTime;
        private int availableWorkers;

        public LineCandidate() {}

        public LineCandidate(String lineId, ProductionLine line, double score) {
            this.lineId = lineId;
            this.line = line;
            this.score = score;
        }

        public String getLineId() { return lineId; }
        public void setLineId(String lineId) { this.lineId = lineId; }
        public ProductionLine getLine() { return line; }
        public void setLine(ProductionLine line) { this.line = line; }
        public double getScore() { return score; }
        public void setScore(double score) { this.score = score; }
        public Map<String, Double> getStrategyScores() { return strategyScores; }
        public void setStrategyScores(Map<String, Double> strategyScores) { this.strategyScores = strategyScores; }
        public int getEstimatedDuration() { return estimatedDuration; }
        public void setEstimatedDuration(int estimatedDuration) { this.estimatedDuration = estimatedDuration; }
        public int getChangeoverTime() { return changeoverTime; }
        public void setChangeoverTime(int changeoverTime) { this.changeoverTime = changeoverTime; }
        public int getAvailableWorkers() { return availableWorkers; }
        public void setAvailableWorkers(int availableWorkers) { this.availableWorkers = availableWorkers; }
    }

    /**
     * 排程结果
     */
    class SchedulingResult {
        private String scheduleBatchNo;
        private LocalDate scheduleDate;
        private int totalOrders;
        private int scheduledOrders;
        private int unscheduledOrders;
        private List<ScheduleTask> tasks;
        private List<ScheduleConflict> conflicts;
        private List<WorkerAssignment> workerAssignments;
        private int totalChangeoverMinutes;
        private double lineUtilization;
        private double workerUtilization;
        private double onTimeRate;
        private long elapsedMs;
        private String message;

        public String getScheduleBatchNo() { return scheduleBatchNo; }
        public void setScheduleBatchNo(String scheduleBatchNo) { this.scheduleBatchNo = scheduleBatchNo; }
        public LocalDate getScheduleDate() { return scheduleDate; }
        public void setScheduleDate(LocalDate scheduleDate) { this.scheduleDate = scheduleDate; }
        public int getTotalOrders() { return totalOrders; }
        public void setTotalOrders(int totalOrders) { this.totalOrders = totalOrders; }
        public int getScheduledOrders() { return scheduledOrders; }
        public void setScheduledOrders(int scheduledOrders) { this.scheduledOrders = scheduledOrders; }
        public int getUnscheduledOrders() { return unscheduledOrders; }
        public void setUnscheduledOrders(int unscheduledOrders) { this.unscheduledOrders = unscheduledOrders; }
        public List<ScheduleTask> getTasks() { return tasks; }
        public void setTasks(List<ScheduleTask> tasks) { this.tasks = tasks; }
        public List<ScheduleConflict> getConflicts() { return conflicts; }
        public void setConflicts(List<ScheduleConflict> conflicts) { this.conflicts = conflicts; }
        public List<WorkerAssignment> getWorkerAssignments() { return workerAssignments; }
        public void setWorkerAssignments(List<WorkerAssignment> workerAssignments) { this.workerAssignments = workerAssignments; }
        public int getTotalChangeoverMinutes() { return totalChangeoverMinutes; }
        public void setTotalChangeoverMinutes(int totalChangeoverMinutes) { this.totalChangeoverMinutes = totalChangeoverMinutes; }
        public double getLineUtilization() { return lineUtilization; }
        public void setLineUtilization(double lineUtilization) { this.lineUtilization = lineUtilization; }
        public double getWorkerUtilization() { return workerUtilization; }
        public void setWorkerUtilization(double workerUtilization) { this.workerUtilization = workerUtilization; }
        public double getOnTimeRate() { return onTimeRate; }
        public void setOnTimeRate(double onTimeRate) { this.onTimeRate = onTimeRate; }
        public long getElapsedMs() { return elapsedMs; }
        public void setElapsedMs(long elapsedMs) { this.elapsedMs = elapsedMs; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
    }

    /**
     * 紧急插单结果
     */
    class InsertResult {
        private boolean success;
        private ScheduleTask insertedTask;
        private List<ScheduleTask> affectedTasks;
        private List<ScheduleConflict> newConflicts;
        private String message;

        public boolean isSuccess() { return success; }
        public void setSuccess(boolean success) { this.success = success; }
        public ScheduleTask getInsertedTask() { return insertedTask; }
        public void setInsertedTask(ScheduleTask insertedTask) { this.insertedTask = insertedTask; }
        public List<ScheduleTask> getAffectedTasks() { return affectedTasks; }
        public void setAffectedTasks(List<ScheduleTask> affectedTasks) { this.affectedTasks = affectedTasks; }
        public List<ScheduleConflict> getNewConflicts() { return newConflicts; }
        public void setNewConflicts(List<ScheduleConflict> newConflicts) { this.newConflicts = newConflicts; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
    }

    /**
     * 混批组
     */
    class MixBatchGroup {
        private String groupId;
        private String productCategory;
        private List<ProductionOrder> orders;
        private int totalQty;
        private int savedChangeoverMinutes;
        private String suggestedLineId;

        public String getGroupId() { return groupId; }
        public void setGroupId(String groupId) { this.groupId = groupId; }
        public String getProductCategory() { return productCategory; }
        public void setProductCategory(String productCategory) { this.productCategory = productCategory; }
        public List<ProductionOrder> getOrders() { return orders; }
        public void setOrders(List<ProductionOrder> orders) { this.orders = orders; }
        public int getTotalQty() { return totalQty; }
        public void setTotalQty(int totalQty) { this.totalQty = totalQty; }
        public int getSavedChangeoverMinutes() { return savedChangeoverMinutes; }
        public void setSavedChangeoverMinutes(int savedChangeoverMinutes) { this.savedChangeoverMinutes = savedChangeoverMinutes; }
        public String getSuggestedLineId() { return suggestedLineId; }
        public void setSuggestedLineId(String suggestedLineId) { this.suggestedLineId = suggestedLineId; }
    }

    /**
     * 人员调配建议
     */
    class TransferSuggestion {
        private String toLineId;
        private String toLineName;
        private int suggestedWorkers;
        private String reason;
        private double expectedEfficiencyGain;

        public String getToLineId() { return toLineId; }
        public void setToLineId(String toLineId) { this.toLineId = toLineId; }
        public String getToLineName() { return toLineName; }
        public void setToLineName(String toLineName) { this.toLineName = toLineName; }
        public int getSuggestedWorkers() { return suggestedWorkers; }
        public void setSuggestedWorkers(int suggestedWorkers) { this.suggestedWorkers = suggestedWorkers; }
        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
        public double getExpectedEfficiencyGain() { return expectedEfficiencyGain; }
        public void setExpectedEfficiencyGain(double expectedEfficiencyGain) { this.expectedEfficiencyGain = expectedEfficiencyGain; }
    }
}

package com.cretas.aims.service.aps.impl;

import com.cretas.aims.dto.aps.RescheduleCheckResult;
import com.cretas.aims.dto.aps.RescheduleResult;
import com.cretas.aims.dto.aps.RescheduleTrigger;
import com.cretas.aims.entity.LineSchedule;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.ProductionLine;
import com.cretas.aims.entity.enums.MaterialBatchStatus;
import com.cretas.aims.entity.enums.RescheduleMode;
import com.cretas.aims.entity.enums.TriggerPriority;
import com.cretas.aims.entity.enums.TriggerType;
import com.cretas.aims.event.RescheduleNeededEvent;
import com.cretas.aims.repository.LineScheduleRepository;
import com.cretas.aims.repository.MaterialBatchRepository;
import com.cretas.aims.repository.ProductionLineRepository;
import com.cretas.aims.service.aps.APSAdaptiveSchedulingService;
import com.cretas.aims.service.aps.RescheduleTriggerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * APS 重排触发检测服务实现
 *
 * 核心功能:
 * 1. 检查是否需要重排 - 根据多种触发条件检测
 * 2. 执行重排 - 支持局部重排和全局重排
 * 3. 物料短缺检测 - 检查可能影响生产的物料问题
 *
 * @author Cretas APS V1.0
 * @since 2026-01-21
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RescheduleTriggerServiceImpl implements RescheduleTriggerService {

    private final APSAdaptiveSchedulingService adaptiveService;
    private final LineScheduleRepository lineScheduleRepository;
    private final ProductionLineRepository productionLineRepository;
    private final MaterialBatchRepository materialBatchRepository;
    private final ApplicationEventPublisher eventPublisher;

    /** 完成概率阈值 - 低于此值触发重排 */
    private static final double PROBABILITY_RESCHEDULE_THRESHOLD = 0.5;

    private static final DateTimeFormatter BATCH_NO_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    // ==================== 检查是否需要重排 ====================

    @Override
    public RescheduleCheckResult checkRescheduleNeeded(String factoryId) {
        log.info("开始检查工厂 {} 是否需要重排...", factoryId);

        List<RescheduleTrigger> triggers = new ArrayList<>();

        // 1. 检查产线故障 (优先级: CRITICAL)
        checkLineFaults(factoryId, triggers);

        // 2. 检查低完成概率任务 (优先级: HIGH)
        checkLowCompletionProbabilityTasks(factoryId, triggers);

        // 3. 检查物料短缺 (优先级: MEDIUM)
        checkMaterialShortageForTriggers(factoryId, triggers);

        // 评估是否需要重排
        // 只有当存在 HIGH 或 CRITICAL 级别的触发条件时才需要重排
        boolean needReschedule = triggers.stream()
            .anyMatch(t -> t.getPriority().ordinal() <= TriggerPriority.HIGH.ordinal());

        RescheduleCheckResult result = new RescheduleCheckResult(needReschedule, triggers);

        log.info("工厂 {} 重排检查完成: needReschedule={}, triggers={}, urgencyLevel={}",
            factoryId, needReschedule, triggers.size(), result.getUrgencyLevel());

        return result;
    }

    /**
     * 检查产线故障
     */
    private void checkLineFaults(String factoryId, List<RescheduleTrigger> triggers) {
        List<ProductionLine> faultLines = productionLineRepository
            .findByFactoryIdAndStatusAndDeletedAtIsNull(factoryId, ProductionLine.LineStatus.maintenance);

        for (ProductionLine line : faultLines) {
            triggers.add(new RescheduleTrigger(
                TriggerType.LINE_FAULT,
                TriggerPriority.CRITICAL,
                line.getId(),
                "产线故障: " + line.getName()
            ));
            log.warn("检测到产线故障: factoryId={}, lineId={}, lineName={}",
                factoryId, line.getId(), line.getName());
        }
    }

    /**
     * 检查低完成概率任务
     */
    private void checkLowCompletionProbabilityTasks(String factoryId, List<RescheduleTrigger> triggers) {
        // 获取所有进行中的低概率任务
        List<LineSchedule> inProgressTasks = lineScheduleRepository
            .findByFactoryIdAndStatus(factoryId, LineSchedule.ScheduleStatus.in_progress);

        for (LineSchedule task : inProgressTasks) {
            double probability = task.getPredictedCompletionProb() != null
                ? task.getPredictedCompletionProb().doubleValue()
                : 1.0;

            if (probability < PROBABILITY_RESCHEDULE_THRESHOLD) {
                triggers.add(new RescheduleTrigger(
                    TriggerType.LOW_COMPLETION_PROBABILITY,
                    TriggerPriority.HIGH,
                    task.getId(),
                    String.format("任务完成概率低: %.1f%%", probability * 100)
                ));
                log.warn("检测到低完成概率任务: factoryId={}, taskId={}, probability={}%",
                    factoryId, task.getId(), probability * 100);
            }
        }
    }

    /**
     * 检查物料短缺 (用于触发器)
     */
    private void checkMaterialShortageForTriggers(String factoryId, List<RescheduleTrigger> triggers) {
        List<String> shortageOrderIds = checkMaterialShortage(factoryId);

        for (String orderId : shortageOrderIds) {
            triggers.add(new RescheduleTrigger(
                TriggerType.MATERIAL_SHORTAGE,
                TriggerPriority.MEDIUM,
                orderId,
                "物料短缺"
            ));
        }
    }

    // ==================== 执行重排 ====================

    @Override
    @Transactional
    public RescheduleResult executeReschedule(String factoryId, RescheduleMode mode, List<String> affectedTaskIds) {
        log.info("开始执行重排: factoryId={}, mode={}, affectedTaskIds={}",
            factoryId, mode, affectedTaskIds != null ? affectedTaskIds.size() : 0);

        // 1. 获取重排前状态
        double beforeOnTimeRate = calculateCurrentOnTimeRate(factoryId);

        // 2. 根据模式选择重排策略
        List<LineSchedule> rescheduledTasks;
        if (mode == RescheduleMode.AFFECTED_ONLY && affectedTaskIds != null && !affectedTaskIds.isEmpty()) {
            rescheduledTasks = rescheduleAffectedTasks(factoryId, affectedTaskIds);
        } else {
            rescheduledTasks = rescheduleAll(factoryId);
        }

        // 3. 计算重排后预期效果
        double afterOnTimeRate = calculateProjectedOnTimeRate(factoryId);

        // 4. 计算改善百分比
        double improvementPercent = beforeOnTimeRate > 0
            ? (afterOnTimeRate - beforeOnTimeRate) / beforeOnTimeRate * 100
            : 0;

        // 5. 生成排程批次号
        String batchNo = generateScheduleBatchNo();

        RescheduleResult result = new RescheduleResult(
            batchNo,
            rescheduledTasks.size(),
            beforeOnTimeRate,
            afterOnTimeRate,
            improvementPercent
        );

        log.info("重排完成: batchNo={}, rescheduledCount={}, beforeRate={}, afterRate={}, improvement={}%",
            batchNo, rescheduledTasks.size(), beforeOnTimeRate, afterOnTimeRate, improvementPercent);

        return result;
    }

    /**
     * 局部重排 - 只重排受影响的任务
     */
    private List<LineSchedule> rescheduleAffectedTasks(String factoryId, List<String> taskIds) {
        log.info("执行局部重排: factoryId={}, taskCount={}", factoryId, taskIds.size());

        List<LineSchedule> affectedTasks = lineScheduleRepository.findAllById(taskIds);
        List<LineSchedule> result = new ArrayList<>();

        for (LineSchedule task : affectedTasks) {
            try {
                // 更新调整信息
                task.setAdjustmentCount(task.getAdjustmentCount() != null ? task.getAdjustmentCount() + 1 : 1);
                task.setLastAdjustmentTime(LocalDateTime.now());
                task.setAdjustmentReason("自动重排: 完成概率低");

                // 使用自适应服务重新计算预测
                double newProbability = adaptiveService.predictCompletionProbability(task.getId());
                task.setPredictedCompletionProb(java.math.BigDecimal.valueOf(newProbability));

                // 更新风险等级
                String riskLevel = calculateRiskLevel(newProbability);
                task.setRiskLevel(riskLevel);

                lineScheduleRepository.save(task);
                result.add(task);

                log.debug("任务 {} 重排成功, 新概率: {}%", task.getId(), newProbability * 100);
            } catch (Exception e) {
                log.error("任务 {} 重排失败: {}", task.getId(), e.getMessage());
            }
        }

        return result;
    }

    /**
     * 全局重排 - 重排所有待处理和进行中的任务
     */
    private List<LineSchedule> rescheduleAll(String factoryId) {
        log.info("执行全局重排: factoryId={}", factoryId);

        // 获取所有待处理和进行中的任务
        List<LineSchedule> pendingTasks = lineScheduleRepository
            .findByFactoryIdAndStatus(factoryId, LineSchedule.ScheduleStatus.pending);
        List<LineSchedule> inProgressTasks = lineScheduleRepository
            .findByFactoryIdAndStatus(factoryId, LineSchedule.ScheduleStatus.in_progress);

        List<LineSchedule> allTasks = new ArrayList<>();
        allTasks.addAll(pendingTasks);
        allTasks.addAll(inProgressTasks);

        List<String> taskIds = allTasks.stream()
            .map(LineSchedule::getId)
            .collect(Collectors.toList());

        return rescheduleAffectedTasks(factoryId, taskIds);
    }

    // ==================== 物料短缺检测 ====================

    @Override
    public List<String> checkMaterialShortage(String factoryId) {
        List<String> shortageOrders = new ArrayList<>();

        try {
            // 检查低库存物料
            Long lowStockCount = materialBatchRepository.countLowStockMaterials(factoryId);

            if (lowStockCount != null && lowStockCount > 0) {
                // 获取低库存物料类型ID
                List<MaterialBatch> availableBatches = materialBatchRepository
                    .findByFactoryIdAndStatus(factoryId, MaterialBatchStatus.AVAILABLE);

                // 这里简化处理，实际应该关联到具体的订单
                // 返回工厂ID作为标识，表示该工厂存在物料短缺问题
                if (!availableBatches.isEmpty()) {
                    shortageOrders.add("FACTORY_" + factoryId + "_SHORTAGE");
                }

                log.warn("检测到物料短缺: factoryId={}, lowStockMaterials={}", factoryId, lowStockCount);
            }
        } catch (Exception e) {
            log.error("检查物料短缺失败: factoryId={}, error={}", factoryId, e.getMessage());
        }

        return shortageOrders;
    }

    // ==================== 准时率计算 ====================

    @Override
    public double calculateCurrentOnTimeRate(String factoryId) {
        try {
            // 获取已完成的任务
            List<LineSchedule> completedTasks = lineScheduleRepository
                .findByFactoryIdAndStatus(factoryId, LineSchedule.ScheduleStatus.completed);

            if (completedTasks.isEmpty()) {
                return 1.0; // 没有完成的任务，默认100%
            }

            // 计算准时完成的任务数
            long onTimeTasks = completedTasks.stream()
                .filter(t -> t.getActualEndTime() != null && t.getPlannedEndTime() != null
                    && !t.getActualEndTime().isAfter(t.getPlannedEndTime()))
                .count();

            return (double) onTimeTasks / completedTasks.size();
        } catch (Exception e) {
            log.error("计算当前准时率失败: factoryId={}, error={}", factoryId, e.getMessage());
            return 0.8; // 发生错误时返回默认值
        }
    }

    @Override
    public double calculateProjectedOnTimeRate(String factoryId) {
        try {
            // 获取所有进行中的任务
            List<LineSchedule> inProgressTasks = lineScheduleRepository
                .findByFactoryIdAndStatus(factoryId, LineSchedule.ScheduleStatus.in_progress);

            if (inProgressTasks.isEmpty()) {
                return calculateCurrentOnTimeRate(factoryId);
            }

            // 计算预期准时完成的任务数 (基于完成概率)
            double expectedOnTimeCount = inProgressTasks.stream()
                .mapToDouble(t -> t.getPredictedCompletionProb() != null
                    ? t.getPredictedCompletionProb().doubleValue() : 0.8)
                .sum();

            // 结合已完成任务的准时率
            List<LineSchedule> completedTasks = lineScheduleRepository
                .findByFactoryIdAndStatus(factoryId, LineSchedule.ScheduleStatus.completed);

            long actualOnTimeTasks = completedTasks.stream()
                .filter(t -> t.getActualEndTime() != null && t.getPlannedEndTime() != null
                    && !t.getActualEndTime().isAfter(t.getPlannedEndTime()))
                .count();

            int totalTasks = completedTasks.size() + inProgressTasks.size();
            double totalOnTime = actualOnTimeTasks + expectedOnTimeCount;

            return totalTasks > 0 ? totalOnTime / totalTasks : 0.8;
        } catch (Exception e) {
            log.error("计算预期准时率失败: factoryId={}, error={}", factoryId, e.getMessage());
            return 0.85; // 发生错误时返回默认值
        }
    }

    // ==================== 辅助方法 ====================

    /**
     * 生成排程批次号
     */
    private String generateScheduleBatchNo() {
        return "RS-" + LocalDateTime.now().format(BATCH_NO_FORMATTER);
    }

    /**
     * 计算风险等级
     */
    private String calculateRiskLevel(double probability) {
        if (probability >= 0.8) return "low";
        if (probability >= 0.6) return "medium";
        if (probability >= 0.4) return "high";
        return "critical";
    }

    /**
     * 发布重排需求事件
     * 供定时任务调用
     */
    public void publishRescheduleNeededEvent(String factoryId, RescheduleCheckResult result) {
        RescheduleNeededEvent event = new RescheduleNeededEvent(this, factoryId, result);
        eventPublisher.publishEvent(event);
        log.info("已发布重排需求事件: {}", event);
    }
}

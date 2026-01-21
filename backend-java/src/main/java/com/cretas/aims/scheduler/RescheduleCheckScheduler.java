package com.cretas.aims.scheduler;

import com.cretas.aims.dto.aps.RescheduleCheckResult;
import com.cretas.aims.event.RescheduleNeededEvent;
import com.cretas.aims.repository.FactoryRepository;
import com.cretas.aims.service.aps.RescheduleTriggerService;
import com.cretas.aims.service.aps.impl.RescheduleTriggerServiceImpl;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * APS 重排检查定时任务
 *
 * 功能:
 * - 每15分钟检查所有工厂是否需要重排
 * - 检测到需要重排时发布 RescheduleNeededEvent 事件
 *
 * 触发条件检测 (优先级从高到低):
 * 1. 产线故障 (CRITICAL)
 * 2. 紧急订单插入 (CRITICAL)
 * 3. 完成概率过低 < 50% (HIGH)
 * 4. 物料短缺 (MEDIUM)
 *
 * @author Cretas APS V1.0
 * @since 2026-01-21
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RescheduleCheckScheduler {

    private final RescheduleTriggerService triggerService;
    private final FactoryRepository factoryRepository;
    private final ApplicationEventPublisher eventPublisher;

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /**
     * 每15分钟检查一次所有工厂是否需要重排
     *
     * 检查流程:
     * 1. 获取所有激活的工厂
     * 2. 对每个工厂执行重排检查
     * 3. 如果需要重排，发布 RescheduleNeededEvent 事件
     */
    @Scheduled(fixedRate = 15 * 60 * 1000)  // 15分钟
    public void periodicRescheduleCheck() {
        LocalDateTime startTime = LocalDateTime.now();
        log.info("开始执行定时重排检查任务... [{}]", startTime.format(TIME_FORMATTER));

        int checkedCount = 0;
        int needRescheduleCount = 0;
        int errorCount = 0;

        // 获取所有激活的工厂ID
        List<String> factoryIds = factoryRepository.findAllActiveFactoryIds();

        if (factoryIds.isEmpty()) {
            log.info("没有激活的工厂，跳过重排检查");
            return;
        }

        log.info("准备检查 {} 个工厂", factoryIds.size());

        for (String factoryId : factoryIds) {
            try {
                RescheduleCheckResult result = triggerService.checkRescheduleNeeded(factoryId);
                checkedCount++;

                if (result.isNeedReschedule()) {
                    needRescheduleCount++;

                    // 发布重排需求事件
                    RescheduleNeededEvent event = new RescheduleNeededEvent(this, factoryId, result);
                    eventPublisher.publishEvent(event);

                    log.info("工厂 {} 需要重排: urgencyLevel={}, triggers={}, reasons={}",
                        factoryId,
                        result.getUrgencyLevel(),
                        result.getTriggers().size(),
                        result.getReasons());
                } else {
                    log.debug("工厂 {} 不需要重排", factoryId);
                }
            } catch (Exception e) {
                errorCount++;
                log.error("工厂 {} 重排检查失败: {}", factoryId, e.getMessage(), e);
            }
        }

        long duration = java.time.Duration.between(startTime, LocalDateTime.now()).toMillis();
        log.info("定时重排检查完成: checked={}, needReschedule={}, errors={}, duration={}ms",
            checkedCount, needRescheduleCount, errorCount, duration);
    }

    /**
     * 每小时执行一次综合分析
     * 生成重排趋势报告
     */
    @Scheduled(fixedRate = 60 * 60 * 1000)  // 1小时
    public void hourlyRescheduleAnalysis() {
        log.info("开始执行每小时重排分析...");

        try {
            List<String> factoryIds = factoryRepository.findAllActiveFactoryIds();

            int totalTriggers = 0;
            int criticalCount = 0;
            int highCount = 0;

            for (String factoryId : factoryIds) {
                try {
                    RescheduleCheckResult result = triggerService.checkRescheduleNeeded(factoryId);

                    if (result.getTriggers() != null) {
                        totalTriggers += result.getTriggers().size();

                        criticalCount += result.getTriggers().stream()
                            .filter(t -> t.getPriority() == com.cretas.aims.entity.enums.TriggerPriority.CRITICAL)
                            .count();

                        highCount += result.getTriggers().stream()
                            .filter(t -> t.getPriority() == com.cretas.aims.entity.enums.TriggerPriority.HIGH)
                            .count();
                    }
                } catch (Exception e) {
                    log.warn("工厂 {} 分析失败: {}", factoryId, e.getMessage());
                }
            }

            log.info("每小时重排分析完成: factories={}, totalTriggers={}, critical={}, high={}",
                factoryIds.size(), totalTriggers, criticalCount, highCount);

            // 如果有紧急问题，记录警告日志
            if (criticalCount > 0) {
                log.warn("发现 {} 个紧急重排触发条件，请关注！", criticalCount);
            }
        } catch (Exception e) {
            log.error("每小时重排分析失败: {}", e.getMessage(), e);
        }
    }

    /**
     * 手动触发指定工厂的重排检查
     * 供API调用
     *
     * @param factoryId 工厂ID
     * @return 检查结果
     */
    public RescheduleCheckResult manualCheck(String factoryId) {
        log.info("手动触发工厂 {} 的重排检查", factoryId);
        return triggerService.checkRescheduleNeeded(factoryId);
    }
}

package com.cretas.aims.scheduler;

import com.cretas.aims.entity.LineSchedule;
import com.cretas.aims.entity.enums.FactoryUserRole;
import com.cretas.aims.entity.enums.NotificationType;
import com.cretas.aims.repository.LineScheduleRepository;
import com.cretas.aims.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * 延期检测定时任务
 * 每30分钟检测一次未完成的排程，自动标记超时的排程为延期状态
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-30
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DelayDetectionScheduler {

    private final LineScheduleRepository scheduleRepository;
    private final NotificationService notificationService;

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    /**
     * 每30分钟执行一次延期检测
     * 检测所有进行中的排程，如果超过计划结束时间则标记为延期
     */
    @Scheduled(fixedRate = 30 * 60 * 1000)  // 30分钟
    @Transactional
    public void detectDelayedSchedules() {
        log.info("开始执行延期检测定时任务...");

        LocalDateTime now = LocalDateTime.now();

        // 查询所有进行中且未延期的排程
        List<LineSchedule> activeSchedules = scheduleRepository.findByStatus(
            LineSchedule.ScheduleStatus.in_progress);

        int delayedCount = 0;

        for (LineSchedule schedule : activeSchedules) {
            // 检查是否超过计划结束时间
            if (schedule.getPlannedEndTime() != null &&
                now.isAfter(schedule.getPlannedEndTime())) {

                // 标记为延期
                schedule.setStatus(LineSchedule.ScheduleStatus.delayed);

                // 计算超时时长
                long overtimeMinutes = java.time.Duration.between(
                    schedule.getPlannedEndTime(), now).toMinutes();

                String delayReason = String.format(
                    "超过计划结束时间: 计划 %s，已超时 %d 分钟",
                    schedule.getPlannedEndTime().format(TIME_FORMATTER),
                    overtimeMinutes);

                schedule.setDelayReason(delayReason);
                scheduleRepository.save(schedule);

                log.warn("排程 {} 已超时 {} 分钟，标记为延期",
                    schedule.getId(), overtimeMinutes);

                // 发送延期通知
                try {
                    String factoryId = extractFactoryId(schedule);
                    if (factoryId != null) {
                        // 计算效率（如果有数据）
                        double efficiency = 0.0;
                        if (schedule.getPlannedQuantity() != null &&
                            schedule.getPlannedQuantity() > 0 &&
                            schedule.getCompletedQuantity() != null) {
                            efficiency = (double) schedule.getCompletedQuantity() / schedule.getPlannedQuantity();
                        }

                        notificationService.notifyScheduleDelayed(
                            factoryId, schedule.getId(), delayReason, efficiency);
                    }
                } catch (Exception e) {
                    log.error("发送延期通知失败: scheduleId={}", schedule.getId(), e);
                }

                delayedCount++;
            }
        }

        if (delayedCount > 0) {
            log.info("延期检测完成: 共标记 {} 个排程为延期状态", delayedCount);
        } else {
            log.debug("延期检测完成: 未发现超时排程");
        }
    }

    /**
     * 每小时执行一次效率预警检测
     * 检测进行中的排程，如果进度严重落后则提前预警
     */
    @Scheduled(fixedRate = 60 * 60 * 1000)  // 1小时
    @Transactional
    public void detectEfficiencyWarnings() {
        log.info("开始执行效率预警检测...");

        LocalDateTime now = LocalDateTime.now();

        List<LineSchedule> activeSchedules = scheduleRepository.findByStatus(
            LineSchedule.ScheduleStatus.in_progress);

        int warningCount = 0;

        for (LineSchedule schedule : activeSchedules) {
            // 跳过没有计划时间的排程
            if (schedule.getPlannedStartTime() == null ||
                schedule.getPlannedEndTime() == null ||
                schedule.getPlannedQuantity() == null ||
                schedule.getPlannedQuantity() <= 0) {
                continue;
            }

            // 计算时间进度
            long totalMinutes = java.time.Duration.between(
                schedule.getPlannedStartTime(), schedule.getPlannedEndTime()).toMinutes();
            long elapsedMinutes = java.time.Duration.between(
                schedule.getPlannedStartTime(), now).toMinutes();

            if (totalMinutes <= 0 || elapsedMinutes <= 0) {
                continue;
            }

            // 时间进度比例
            double timeProgress = Math.min(1.0, (double) elapsedMinutes / totalMinutes);

            // 预期完成数量
            int expectedQuantity = (int) Math.ceil(schedule.getPlannedQuantity() * timeProgress);

            // 实际完成数量
            int actualQuantity = schedule.getCompletedQuantity() != null ?
                schedule.getCompletedQuantity() : 0;

            // 计算效率
            double efficiency = expectedQuantity > 0 ?
                (double) actualQuantity / expectedQuantity : 1.0;

            // 如果效率低于50%且时间已过半，发送预警
            if (efficiency < 0.5 && timeProgress >= 0.5) {
                String factoryId = extractFactoryId(schedule);
                if (factoryId != null) {
                    String warningContent = String.format(
                        "排程 %s 进度严重落后！时间进度 %.0f%%，产量进度 %.0f%%，当前效率 %.0f%%",
                        schedule.getId(),
                        timeProgress * 100,
                        (actualQuantity * 100.0 / schedule.getPlannedQuantity()),
                        efficiency * 100);

                    try {
                        // 发送给调度员和车间主任
                        notificationService.sendToRole(
                            factoryId,
                            FactoryUserRole.dispatcher,
                            "生产进度严重落后预警",
                            warningContent,
                            NotificationType.WARNING,
                            "SCHEDULING",
                            schedule.getId());

                        notificationService.sendToRole(
                            factoryId,
                            FactoryUserRole.workshop_supervisor,
                            "生产进度严重落后预警",
                            warningContent,
                            NotificationType.WARNING,
                            "SCHEDULING",
                            schedule.getId());

                        warningCount++;
                    } catch (Exception e) {
                        log.error("发送效率预警通知失败: scheduleId={}", schedule.getId(), e);
                    }
                }
            }
        }

        if (warningCount > 0) {
            log.info("效率预警检测完成: 发送 {} 条预警通知", warningCount);
        } else {
            log.debug("效率预警检测完成: 未发现严重落后的排程");
        }
    }

    /**
     * 从排程获取工厂ID
     */
    private String extractFactoryId(LineSchedule schedule) {
        if (schedule.getPlan() != null) {
            return schedule.getPlan().getFactoryId();
        }
        return null;
    }
}

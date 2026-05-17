package com.cretas.aims.scheduler;

import com.cretas.aims.entity.Reminder;
import com.cretas.aims.entity.enums.ReminderStatus;
import com.cretas.aims.entity.enums.ReminderType;
import com.cretas.aims.entity.inventory.SalesOrder;
import com.cretas.aims.repository.ReminderRepository;
import com.cretas.aims.repository.inventory.SalesOrderRepository;
import com.cretas.aims.service.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * Sprint 4 W2 S-REMIND-1 — 收款提醒每日扫描.
 *
 * <p>每日 08:00 扫描所有工厂的销售订单:
 * <ul>
 *   <li>SNOOZED 到期 (snoozedUntil &lt;= today) 自动转回 PENDING</li>
 *   <li>未结清 (paidAmount &lt; totalAmount) 且 requiredDeliveryDate 在
 *       [today - 365d, today + 7d] 内的订单, 若无活跃提醒则创建
 *       PAYMENT_DUE reminder 分配给 salespersonId 并发通知</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ReminderScanService {

    /** 提醒提前天数 — 交货日期前 N 天触发. */
    private static final int LEAD_DAYS = 7;

    /** 历史扫描窗口 — 仅看 1 年内的历史订单, 避免扫到 ancient data. */
    private static final int LOOKBACK_DAYS = 365;

    private final SalesOrderRepository salesOrderRepository;
    private final ReminderRepository reminderRepository;
    private final NotificationService notificationService;

    /** 每日 08:00 执行. */
    @Scheduled(cron = "0 0 8 * * ?")
    @SchedulerLock(name = "ReminderScanService.scanPaymentDue",
            lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
    @Transactional
    public void scanPaymentDue() {
        LocalDate today = LocalDate.now();

        // 1. SNOOZED 到期回流 PENDING.
        int reactivated = reminderRepository.reactivateExpiredSnoozes(today);
        if (reactivated > 0) {
            log.info("[S-REMIND scan] reactivated {} SNOOZED reminders", reactivated);
        }

        // 2. Per-factory 扫描未结清订单.
        List<String> factoryIds = salesOrderRepository.findDistinctFactoryIds();
        int created = 0;
        for (String factoryId : factoryIds) {
            created += scanFactory(factoryId, today);
        }
        log.info("[S-REMIND scan] created {} new PAYMENT_DUE reminders across {} factories",
                created, factoryIds.size());
    }

    /** 扫描单个工厂. 公开以便测试 / 手动触发. */
    @Transactional
    public int scanFactory(String factoryId, LocalDate today) {
        LocalDate windowStart = today.minusDays(LOOKBACK_DAYS);
        LocalDate windowEnd = today.plusDays(LEAD_DAYS);

        List<SalesOrder> candidates = salesOrderRepository.findUnpaidForReminderScan(
                factoryId, windowStart, windowEnd);

        int created = 0;
        for (SalesOrder so : candidates) {
            if (createReminderIfAbsent(so)) {
                created++;
            }
        }
        return created;
    }

    /** 幂等: 同 source 已有未 DISMISSED 提醒则跳过. 返回 true 表示本次新建. */
    private boolean createReminderIfAbsent(SalesOrder so) {
        var existing = reminderRepository
                .findFirstByFactoryIdAndTypeAndSourceTypeAndSourceIdAndStatusInAndDeletedAtIsNull(
                        so.getFactoryId(),
                        ReminderType.PAYMENT_DUE,
                        "SALES_ORDER",
                        so.getId(),
                        List.of(ReminderStatus.PENDING, ReminderStatus.SNOOZED));
        if (existing.isPresent()) {
            return false;
        }

        Reminder reminder = new Reminder();
        reminder.setFactoryId(so.getFactoryId());
        reminder.setType(ReminderType.PAYMENT_DUE);
        reminder.setSourceType("SALES_ORDER");
        reminder.setSourceId(so.getId());
        reminder.setAssigneeId(so.getSalespersonId());
        // dueDate = max(requiredDeliveryDate, today) — 历史已逾期订单也以 today 为触发日
        LocalDate due = so.getRequiredDeliveryDate();
        reminder.setDueDate(due.isBefore(LocalDate.now()) ? LocalDate.now() : due);
        reminder.setStatus(ReminderStatus.PENDING);
        reminder.setMessage(buildMessage(so));
        reminderRepository.save(reminder);

        notificationService.notifyUser(
                so.getFactoryId(),
                so.getSalespersonId(),
                "[收款提醒] 销售订单 " + so.getOrderNumber(),
                reminder.getMessage());

        return true;
    }

    private String buildMessage(SalesOrder so) {
        // totalAmount / paidAmount 可能被 @PriceSensitive 在 response 层 strip,
        // 但 reminder 是 server-side 生成存库, 这里直接读取实体未脱敏值.
        return String.format("订单 %s 未结清, 交货日期 %s. 请跟进客户回款.",
                so.getOrderNumber(),
                so.getRequiredDeliveryDate());
    }
}

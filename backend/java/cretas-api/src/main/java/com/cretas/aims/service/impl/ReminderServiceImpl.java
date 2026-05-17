package com.cretas.aims.service.impl;

import com.cretas.aims.entity.Reminder;
import com.cretas.aims.entity.enums.ReminderStatus;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.ReminderRepository;
import com.cretas.aims.service.ReminderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * Sprint 4 W2 S-REMIND-1 — 提醒单业务实现.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReminderServiceImpl implements ReminderService {

    private final ReminderRepository reminderRepository;

    @Override
    public Page<Reminder> listMine(String factoryId, Long userId,
                                   List<ReminderStatus> statuses, Pageable pageable) {
        List<ReminderStatus> filter = (statuses == null || statuses.isEmpty())
                ? List.of(ReminderStatus.PENDING, ReminderStatus.SNOOZED)
                : statuses;
        return reminderRepository.findByFactoryIdAndAssigneeIdAndStatusInAndDeletedAtIsNull(
                factoryId, userId, filter, pageable);
    }

    @Override
    public long countPending(String factoryId, Long userId) {
        return reminderRepository.countByFactoryIdAndAssigneeIdAndStatusAndDeletedAtIsNull(
                factoryId, userId, ReminderStatus.PENDING);
    }

    @Override
    @Transactional
    public Reminder snooze(String factoryId, String id, Long userId, LocalDate until) {
        if (until == null || !until.isAfter(LocalDate.now())) {
            throw new BusinessException(400, "snoozedUntil 必须晚于今天");
        }
        Reminder reminder = loadOwned(factoryId, id, userId);
        if (reminder.getStatus() == ReminderStatus.DISMISSED) {
            throw new BusinessException(400, "已 dismiss 的提醒不能 snooze");
        }
        reminder.setStatus(ReminderStatus.SNOOZED);
        reminder.setSnoozedUntil(until);
        return reminderRepository.save(reminder);
    }

    @Override
    @Transactional
    public Reminder dismiss(String factoryId, String id, Long userId) {
        Reminder reminder = loadOwned(factoryId, id, userId);
        if (reminder.getStatus() == ReminderStatus.DISMISSED) {
            return reminder;
        }
        reminder.setStatus(ReminderStatus.DISMISSED);
        reminder.setSnoozedUntil(null);
        return reminderRepository.save(reminder);
    }

    /** 加载提醒并校验 assignee. */
    private Reminder loadOwned(String factoryId, String id, Long userId) {
        Reminder reminder = reminderRepository
                .findByIdAndFactoryIdAndDeletedAtIsNull(id, factoryId)
                .orElseThrow(() -> new BusinessException(404, "提醒不存在"));
        if (!reminder.getAssigneeId().equals(userId)) {
            throw new BusinessException(403, "只能操作分配给自己的提醒");
        }
        return reminder;
    }
}

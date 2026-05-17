package com.cretas.aims.service;

import com.cretas.aims.entity.Reminder;
import com.cretas.aims.entity.enums.ReminderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;

/**
 * Sprint 4 W2 S-REMIND-1 — 提醒单业务接口.
 */
public interface ReminderService {

    /** 我的提醒列表 (按状态过滤, 默认 PENDING+SNOOZED). */
    Page<Reminder> listMine(String factoryId, Long userId,
                            List<ReminderStatus> statuses, Pageable pageable);

    /** Bell badge 计数 — 仅 PENDING. */
    long countPending(String factoryId, Long userId);

    /** Snooze 延后 — 当前用户必须是 assignee. */
    Reminder snooze(String factoryId, String id, Long userId, LocalDate until);

    /** Dismiss 标记处理完成 — 当前用户必须是 assignee. */
    Reminder dismiss(String factoryId, String id, Long userId);
}

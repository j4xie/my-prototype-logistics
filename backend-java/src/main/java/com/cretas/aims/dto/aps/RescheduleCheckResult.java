package com.cretas.aims.dto.aps;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 重排检查结果 DTO
 * 包含是否需要重排的判断和触发原因列表
 *
 * @author Cretas APS V1.0
 * @since 2026-01-21
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RescheduleCheckResult {
    /**
     * 是否需要重排
     */
    private boolean needReschedule;

    /**
     * 触发器列表
     */
    private List<RescheduleTrigger> triggers = new ArrayList<>();

    /**
     * 获取紧急程度
     * @return low/medium/high/critical
     */
    public String getUrgencyLevel() {
        if (triggers == null || triggers.isEmpty()) {
            return "low";
        }

        boolean hasCritical = triggers.stream()
            .anyMatch(t -> t.getPriority() == com.cretas.aims.entity.enums.TriggerPriority.CRITICAL);
        boolean hasHigh = triggers.stream()
            .anyMatch(t -> t.getPriority() == com.cretas.aims.entity.enums.TriggerPriority.HIGH);
        boolean hasMedium = triggers.stream()
            .anyMatch(t -> t.getPriority() == com.cretas.aims.entity.enums.TriggerPriority.MEDIUM);

        if (hasCritical) return "critical";
        if (hasHigh) return "high";
        if (hasMedium) return "medium";
        return "low";
    }

    /**
     * 获取原因描述列表
     */
    public List<String> getReasons() {
        if (triggers == null) {
            return new ArrayList<>();
        }
        return triggers.stream()
            .map(RescheduleTrigger::getDescription)
            .collect(Collectors.toList());
    }

    /**
     * 获取受影响的任务ID列表
     */
    public List<String> getAffectedTaskIds() {
        if (triggers == null) {
            return new ArrayList<>();
        }
        return triggers.stream()
            .map(RescheduleTrigger::getEntityId)
            .filter(id -> id != null && !id.isEmpty())
            .distinct()
            .collect(Collectors.toList());
    }
}

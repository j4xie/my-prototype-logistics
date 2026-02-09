package com.cretas.aims.event;

import com.cretas.aims.dto.aps.RescheduleCheckResult;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.time.LocalDateTime;

/**
 * 重排需求事件
 * 当检测到需要重排时触发此事件
 *
 * @author Cretas APS V1.0
 * @since 2026-01-21
 */
@Getter
public class RescheduleNeededEvent extends ApplicationEvent {

    private final String factoryId;
    private final RescheduleCheckResult checkResult;
    private final LocalDateTime triggeredAt;

    public RescheduleNeededEvent(Object source, String factoryId, RescheduleCheckResult checkResult) {
        super(source);
        this.factoryId = factoryId;
        this.checkResult = checkResult;
        this.triggeredAt = LocalDateTime.now();
    }

    @Override
    public String toString() {
        return String.format("RescheduleNeededEvent[factoryId=%s, urgencyLevel=%s, triggersCount=%d, triggeredAt=%s]",
            factoryId,
            checkResult != null ? checkResult.getUrgencyLevel() : "unknown",
            checkResult != null && checkResult.getTriggers() != null ? checkResult.getTriggers().size() : 0,
            triggeredAt);
    }
}

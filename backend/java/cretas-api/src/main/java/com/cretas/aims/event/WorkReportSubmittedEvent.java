package com.cretas.aims.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;
import java.time.LocalDateTime;

@Getter
public class WorkReportSubmittedEvent extends ApplicationEvent {
    private final String factoryId;
    private final String processTaskId;
    private final String reportId;
    private final Long reportedBy;
    private final LocalDateTime createdAt;

    public WorkReportSubmittedEvent(Object source, String factoryId, String processTaskId,
                                     String reportId, Long reportedBy) {
        super(source);
        this.factoryId = factoryId;
        this.processTaskId = processTaskId;
        this.reportId = reportId;
        this.reportedBy = reportedBy;
        this.createdAt = LocalDateTime.now();
    }
}

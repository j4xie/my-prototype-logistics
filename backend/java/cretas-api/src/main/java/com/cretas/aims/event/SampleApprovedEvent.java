package com.cretas.aims.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;
import java.time.LocalDateTime;

@Getter
public class SampleApprovedEvent extends ApplicationEvent {

    private final String factoryId;
    private final String sampleId;
    private final String sampleName;
    private final Long approvedBy;
    private final LocalDateTime approvedAt;

    public SampleApprovedEvent(Object source, String factoryId, String sampleId,
                                String sampleName, Long approvedBy) {
        super(source);
        this.factoryId = factoryId;
        this.sampleId = sampleId;
        this.sampleName = sampleName;
        this.approvedBy = approvedBy;
        this.approvedAt = LocalDateTime.now();
    }
}

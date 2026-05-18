package com.cretas.aims.dto.sales;

import com.cretas.aims.entity.enums.ServiceComplaintSeverity;
import com.cretas.aims.entity.enums.ServiceComplaintSource;
import com.cretas.aims.entity.enums.ServiceComplaintType;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * P2 #74 S-COMPLAINT-1 — 更新售后服务投诉 DTO. 所有字段 optional, null 表示不变更.
 *
 * <p>仅在 NEW 状态可全量编辑; 其他状态仅可改 handledBy / resolution (走状态机).
 */
@Data
public class ServiceComplaintUpdateRequest {

    private ServiceComplaintType complaintType;

    private ServiceComplaintSeverity severity;

    private ServiceComplaintSource source;

    private String description;

    private Long handledBy;

    private String resolution;

    private LocalDateTime occurredAt;
}

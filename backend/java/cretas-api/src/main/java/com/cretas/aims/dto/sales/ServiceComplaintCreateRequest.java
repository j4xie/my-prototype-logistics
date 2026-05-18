package com.cretas.aims.dto.sales;

import com.cretas.aims.entity.enums.ServiceComplaintSeverity;
import com.cretas.aims.entity.enums.ServiceComplaintSource;
import com.cretas.aims.entity.enums.ServiceComplaintType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * P2 #74 S-COMPLAINT-1 — 创建售后服务投诉 DTO.
 */
@Data
public class ServiceComplaintCreateRequest {

    @NotBlank
    private String customerId;

    private String customerName;

    /** Optional, link to a SalesOrder.id. */
    private String orderId;

    @NotNull
    private ServiceComplaintType complaintType;

    @NotNull
    private ServiceComplaintSeverity severity;

    @NotNull
    private ServiceComplaintSource source;

    @NotBlank
    private String description;

    private Long handledBy;

    private LocalDateTime occurredAt;
}

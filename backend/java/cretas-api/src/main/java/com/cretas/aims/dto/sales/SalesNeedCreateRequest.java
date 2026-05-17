package com.cretas.aims.dto.sales;

import com.cretas.aims.entity.enums.SalesNeedPriority;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Sprint 4 W2 S-NEED-1 — 创建客户需求 DTO.
 */
@Data
public class SalesNeedCreateRequest {

    @NotBlank
    private String customerId;

    private String customerName;

    @NotBlank
    private String productId;

    private String productName;

    @NotNull
    @Positive
    private BigDecimal qtyDemand;

    @NotBlank
    private String unit;

    private LocalDate expectedDeliveryDate;

    private SalesNeedPriority priority;

    private String remark;
}

package com.cretas.aims.dto.sales;

import com.cretas.aims.entity.enums.SalesNeedPriority;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Sprint 4 W2 S-NEED-1 — 更新客户需求 DTO. 仅 DRAFT 状态可更新.
 */
@Data
public class SalesNeedUpdateRequest {

    @Positive
    private BigDecimal qtyDemand;

    private String unit;

    private LocalDate expectedDeliveryDate;

    private SalesNeedPriority priority;

    private String remark;
}

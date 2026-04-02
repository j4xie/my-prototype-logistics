package com.cretas.aims.dto.inventory;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 销售订单更新请求 (仅 DRAFT 状态可编辑)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateSalesOrderRequest {

    private String customerName;

    private String salesperson;

    private String deliveryAddress;

    private String remark;

    private Boolean shippingIncluded;

    private BigDecimal shippingFee;

    private LocalDate requiredDeliveryDate;
}

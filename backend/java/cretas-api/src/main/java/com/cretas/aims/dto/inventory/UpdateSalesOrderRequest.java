package com.cretas.aims.dto.inventory;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

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

    /** 行项目更新 (为null时不更新行项) */
    private List<CreateSalesOrderRequest.SalesOrderItemDTO> items;
}

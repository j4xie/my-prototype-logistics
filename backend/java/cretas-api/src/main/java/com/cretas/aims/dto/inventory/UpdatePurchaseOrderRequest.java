package com.cretas.aims.dto.inventory;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

/**
 * 采购订单更新请求 (仅 DRAFT 状态可编辑).
 *
 * 与 CreatePurchaseOrderRequest 的区别: 全部字段 optional, 允许 partial update.
 * 保留 @Size 格式校验, 加 version 乐观锁.
 *
 * Pattern reference: UpdateSalesOrderRequest (inventory).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdatePurchaseOrderRequest {

    @Size(max = 191, message = "供应商ID长度不能超过191个字符")
    private String supplierId;

    /** 采购类型: DIRECT / HQ_UNIFIED / URGENT */
    @Size(max = 50, message = "采购类型长度不能超过50个字符")
    private String purchaseType;

    private LocalDate orderDate;

    private LocalDate expectedDeliveryDate;

    @Size(max = 5000, message = "备注长度不能超过5000个字符")
    private String remark;

    /** 关联 SO id (可选, 跨模块追踪) */
    @Size(max = 191, message = "销售订单ID长度不能超过191个字符")
    private String salesOrderId;

    /** 行项目更新 (null 时不更新, 全量替换) */
    @Valid
    private List<CreatePurchaseOrderRequest.PurchaseOrderItemDTO> items;

    /** 乐观锁版本号 (编辑时必传, 来自 GET 响应); mismatch → 409 Conflict */
    private Long version;
}

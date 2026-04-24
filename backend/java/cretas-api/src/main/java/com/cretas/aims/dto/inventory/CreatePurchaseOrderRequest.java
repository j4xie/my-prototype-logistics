package com.cretas.aims.dto.inventory;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreatePurchaseOrderRequest {

    @NotBlank(message = "供应商ID不能为空")
    private String supplierId;

    /** 采购类型: DIRECT / HQ_UNIFIED / URGENT */
    private String purchaseType = "DIRECT";

    @NotNull(message = "下单日期不能为空")
    private LocalDate orderDate;

    private LocalDate expectedDeliveryDate;

    private String remark;

    /**
     * W-12 fix (Round 15): optional SO id for cross-module tracking
     * ("按销售订单做定点追踪"). When set, SO detail page's "关联采购" tab shows this PO.
     * FE list.vue previously had a `relatedSalesOrderId` field that got stripped from
     * payload — now renamed + passed through to this field.
     */
    private String salesOrderId;

    @Valid
    @NotEmpty(message = "采购行项目不能为空")
    private List<PurchaseOrderItemDTO> items;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PurchaseOrderItemDTO {

        @NotBlank(message = "原料类型ID不能为空")
        private String materialTypeId;

        private String materialName;

        @NotNull(message = "数量不能为空")
        private BigDecimal quantity;

        @NotBlank(message = "单位不能为空")
        private String unit;

        private BigDecimal unitPrice;

        private BigDecimal taxRate;

        private String remark;

        private String specification;

        private BigDecimal boxQuantity;
    }
}

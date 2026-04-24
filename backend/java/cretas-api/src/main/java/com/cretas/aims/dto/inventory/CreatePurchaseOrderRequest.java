package com.cretas.aims.dto.inventory;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreatePurchaseOrderRequest {

    @NotBlank(message = "供应商ID不能为空")
    @Size(max = 191, message = "供应商ID长度不能超过191个字符")
    private String supplierId;

    /** 采购类型: DIRECT / HQ_UNIFIED / URGENT */
    @Size(max = 50, message = "采购类型长度不能超过50个字符")
    private String purchaseType = "DIRECT";

    @NotNull(message = "下单日期不能为空")
    private LocalDate orderDate;

    private LocalDate expectedDeliveryDate;

    @Size(max = 5000, message = "备注长度不能超过5000个字符")
    private String remark;

    /**
     * W-12 fix (Round 15): optional SO id for cross-module tracking
     * ("按销售订单做定点追踪"). When set, SO detail page's "关联采购" tab shows this PO.
     * FE list.vue previously had a `relatedSalesOrderId` field that got stripped from
     * payload — now renamed + passed through to this field.
     */
    @Size(max = 191, message = "销售订单ID长度不能超过191个字符")
    private String salesOrderId;

    @Valid
    @NotEmpty(message = "采购行项目不能为空")
    private List<PurchaseOrderItemDTO> items;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PurchaseOrderItemDTO {

        @NotBlank(message = "原料类型ID不能为空")
        @Size(max = 191, message = "原料类型ID长度不能超过191个字符")
        private String materialTypeId;

        @Size(max = 200, message = "原料名称长度不能超过200个字符")
        private String materialName;

        @NotNull(message = "数量不能为空")
        private BigDecimal quantity;

        @NotBlank(message = "单位不能为空")
        @Size(max = 20, message = "单位长度不能超过20个字符")
        private String unit;

        private BigDecimal unitPrice;

        private BigDecimal taxRate;

        @Size(max = 5000, message = "备注长度不能超过5000个字符")
        private String remark;

        @Size(max = 500, message = "规格长度不能超过500个字符")
        private String specification;

        private BigDecimal boxQuantity;
    }
}

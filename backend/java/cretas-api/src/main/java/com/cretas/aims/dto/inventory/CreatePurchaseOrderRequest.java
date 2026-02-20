package com.cretas.aims.dto.inventory;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
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
    }
}

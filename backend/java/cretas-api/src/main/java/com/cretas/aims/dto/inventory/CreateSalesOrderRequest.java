package com.cretas.aims.dto.inventory;

import com.cretas.aims.dto.sales.ExtraFeeItem;
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
public class CreateSalesOrderRequest {

    @NotBlank(message = "客户ID不能为空")
    private String customerId;

    private LocalDate orderDate;

    private LocalDate requiredDeliveryDate;

    private String deliveryAddress;

    private BigDecimal discountAmount;

    private String remark;

    private String salesperson;

    private Boolean shippingIncluded;

    private BigDecimal shippingFee;

    /** 其他费用 (装卸/包装/加急等) */
    private List<ExtraFeeItem> extraFees;

    @Valid
    @NotEmpty(message = "订单行项目不能为空")
    private List<SalesOrderItemDTO> items;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SalesOrderItemDTO {

        @NotBlank(message = "产品ID不能为空")
        private String productTypeId;

        private String productName;

        @NotNull(message = "数量不能为空")
        private BigDecimal quantity;

        @NotBlank(message = "单位不能为空")
        private String unit;

        private BigDecimal unitPrice;

        private BigDecimal discountRate;

        private String remark;

        private String specification;

        private BigDecimal boxQuantity;
    }
}

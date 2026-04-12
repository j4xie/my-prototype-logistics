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
import java.util.Map;

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

    /**
     * Canvas V3: 动态字段 (dual-track)
     * 用户在 Canvas 里配的自定义字段, 前端通过这个 Map 传过来, 后端通过 DynamicFieldService
     * 写入 cf_{fieldCode} 物理列. 不配的字段前端不传, 这个 Map 为 null.
     */
    private Map<String, Object> customFields;

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

        private BigDecimal taxRate;

        private String remark;

        private String specification;

        private BigDecimal boxQuantity;
    }
}

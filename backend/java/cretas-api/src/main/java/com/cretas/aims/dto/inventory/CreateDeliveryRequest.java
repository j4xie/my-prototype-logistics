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
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateDeliveryRequest {

    /** 关联的销售订单ID（可选，支持无单出库） */
    private String salesOrderId;

    @NotBlank(message = "客户ID不能为空")
    private String customerId;

    @NotNull(message = "发货日期不能为空")
    private LocalDate deliveryDate;

    private String deliveryAddress;

    private String logisticsCompany;

    private String trackingNumber;

    private String remark;

    @Valid
    @NotEmpty(message = "发货行项目不能为空")
    private List<DeliveryItemDTO> items;

    /**
     * Round 9 Fix (R8-α Gap #1): Canvas V3 dynamic fields map. Customer-configured
     * fields (运输温度, 司机姓名, 车牌号, etc.) land here and are persisted via
     * DynamicFieldService after the delivery record is saved. Previously the entire
     * delivery path silently dropped customFields — the frontend Canvas form would
     * submit them but the backend DTO didn't have the slot. This is the SalesDelivery
     * template pattern for the 16 other modules that still need per-method integration.
     */
    private Map<String, Object> customFields;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DeliveryItemDTO {

        @NotBlank(message = "产品ID不能为空")
        private String productTypeId;

        private String productName;

        @NotNull(message = "发货数量不能为空")
        private BigDecimal deliveredQuantity;

        @NotBlank(message = "单位不能为空")
        private String unit;

        private BigDecimal unitPrice;

        private String remark;
    }
}

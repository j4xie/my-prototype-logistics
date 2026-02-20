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

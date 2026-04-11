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
public class CreateReturnOrderRequest {

    @NotBlank(message = "退货类型不能为空")
    private String returnType; // PURCHASE_RETURN | SALES_RETURN

    @NotBlank(message = "交易对手ID不能为空")
    private String counterpartyId;

    private String sourceOrderId;

    @NotNull(message = "退货日期不能为空")
    private LocalDate returnDate;

    private String reason;

    private String remark;

    @Valid
    @NotEmpty(message = "退货行项目不能为空")
    private List<ReturnOrderItemDTO> items;

    /**
     * Round 11 T2 — Canvas Integration Template slot for factory-configured
     * dynamic fields. Fields like 退货照片, 客诉单号, 退货责任方 land here and
     * are persisted to cf_* columns on return_orders via DynamicFieldService.
     */
    private Map<String, Object> customFields;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReturnOrderItemDTO {

        private String materialTypeId;

        private String productTypeId;

        private String itemName;

        @NotNull(message = "数量不能为空")
        private BigDecimal quantity;

        private BigDecimal unitPrice;

        private String batchNumber;

        private String reason;
    }
}

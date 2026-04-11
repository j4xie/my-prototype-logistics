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
public class CreateReceiveRecordRequest {

    /** 关联的采购订单ID（可选，支持无单入库） */
    private String purchaseOrderId;

    @NotBlank(message = "供应商ID不能为空")
    private String supplierId;

    @NotNull(message = "入库日期不能为空")
    private LocalDate receiveDate;

    private String warehouseId;

    private String remark;

    @Valid
    @NotEmpty(message = "入库行项目不能为空")
    private List<ReceiveItemDTO> items;

    /**
     * Round 11 — Canvas Integration Template slot for factory-configured dynamic fields.
     * Fields like 运输温度记录, 质检报告附件, 外包装状态 land here and are persisted
     * to cf_* columns on purchase_receive_records via DynamicFieldService.
     */
    private Map<String, Object> customFields;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReceiveItemDTO {

        @NotBlank(message = "原料类型ID不能为空")
        private String materialTypeId;

        private String materialName;

        @NotNull(message = "到货数量不能为空")
        private BigDecimal receivedQuantity;

        @NotBlank(message = "单位不能为空")
        private String unit;

        private BigDecimal unitPrice;

        private String qcResult;

        private String remark;
    }
}

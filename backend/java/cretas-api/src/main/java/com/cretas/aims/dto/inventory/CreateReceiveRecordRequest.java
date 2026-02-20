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

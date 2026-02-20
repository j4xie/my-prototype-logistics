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
public class CreateTransferRequest {

    @NotBlank(message = "调拨类型不能为空")
    private String transferType;

    @NotBlank(message = "调入方ID不能为空")
    private String targetFactoryId;

    @NotNull(message = "调拨日期不能为空")
    private LocalDate transferDate;

    private LocalDate expectedArrivalDate;

    private String remark;

    @Valid
    @NotEmpty(message = "调拨行项目不能为空")
    private List<TransferItemDTO> items;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TransferItemDTO {

        /** RAW_MATERIAL 或 FINISHED_GOODS */
        @NotBlank(message = "物品类型不能为空")
        private String itemType;

        /** 原料ID（itemType=RAW_MATERIAL时） */
        private String materialTypeId;

        /** 产品ID（itemType=FINISHED_GOODS时） */
        private String productTypeId;

        private String itemName;

        @NotNull(message = "数量不能为空")
        private BigDecimal quantity;

        @NotBlank(message = "单位不能为空")
        private String unit;

        private BigDecimal unitPrice;

        private String remark;
    }
}

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
public class CreatePriceListRequest {

    @NotBlank(message = "价格表名称不能为空")
    private String name;

    /** PURCHASE_PRICE / TRANSFER_PRICE / SELLING_PRICE */
    @NotBlank(message = "价格类型不能为空")
    private String priceType;

    @NotNull(message = "生效日期不能为空")
    private LocalDate effectiveFrom;

    private LocalDate effectiveTo;

    private String remark;

    @Valid
    @NotEmpty(message = "价格项不能为空")
    private List<PriceItemDTO> items;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PriceItemDTO {

        private String materialTypeId;

        private String productTypeId;

        private String itemName;

        private String unit;

        @NotNull(message = "标准单价不能为空")
        private BigDecimal standardPrice;

        private BigDecimal minPrice;

        private BigDecimal maxPrice;

        private String remark;
    }
}

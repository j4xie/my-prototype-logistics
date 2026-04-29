package com.cretas.aims.dto.inventory;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreatePriceListRequest {

    @NotBlank(message = "价格表名称不能为空")
    @Size(max = 200, message = "价格表名称长度不能超过200个字符")
    private String name;

    /** 客户ID（可选，null=全局价格表） */
    @Size(max = 191, message = "客户ID长度不能超过191个字符")
    private String customerId;

    /** PURCHASE_PRICE / TRANSFER_PRICE / SELLING_PRICE */
    @NotBlank(message = "价格类型不能为空")
    @Size(max = 50, message = "价格类型长度不能超过50个字符")
    private String priceType;

    @NotNull(message = "生效日期不能为空")
    private LocalDate effectiveFrom;

    private LocalDate effectiveTo;

    @Size(max = 5000, message = "备注长度不能超过5000个字符")
    private String remark;

    @Valid
    @NotEmpty(message = "价格项不能为空")
    private List<PriceItemDTO> items;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PriceItemDTO {

        @Size(max = 191, message = "原料类型ID长度不能超过191个字符")
        private String materialTypeId;

        @Size(max = 191, message = "产品类型ID长度不能超过191个字符")
        private String productTypeId;

        @Size(max = 200, message = "品项名称长度不能超过200个字符")
        private String itemName;

        @Size(max = 20, message = "单位长度不能超过20个字符")
        private String unit;

        @NotNull(message = "标准单价不能为空")
        private BigDecimal standardPrice;

        private BigDecimal minPrice;

        private BigDecimal maxPrice;

        @Size(max = 5000, message = "备注长度不能超过5000个字符")
        private String remark;
    }
}

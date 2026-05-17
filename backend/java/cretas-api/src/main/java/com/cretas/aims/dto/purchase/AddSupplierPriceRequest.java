package com.cretas.aims.dto.purchase;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 添加 / 更新供应商报价请求 (P-NUCLEAR-1).
 *
 * <p>Service 层会判断: 若 (inquiry, supplier) 已存在报价则 UPDATE,
 * 否则 INSERT — 防呆 R4 幂等.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AddSupplierPriceRequest {

    @NotBlank(message = "供应商 ID 不能为空")
    @Size(max = 191)
    private String supplierId;

    @NotNull(message = "报价不能为空")
    @Positive(message = "报价必须 > 0")
    private BigDecimal unitPrice;

    private BigDecimal taxRate;

    private LocalDate validUntil;

    private Integer deliveryDays;

    @Size(max = 500)
    private String remark;
}

package com.cretas.aims.dto.purchase;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * 选定中标供应商 + 生成采购单请求 (P-NUCLEAR-1).
 *
 * <p>防呆 R4 (idempotent): InquiryQuote.purchaseOrderId 非空时
 * service 层返回 409 + existingPurchaseOrderId, 不重复创建.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SelectAndConvertRequest {

    @NotBlank(message = "中标供应商 ID 不能为空")
    @Size(max = 191)
    private String selectedSupplierId;

    /** 采购单期望到货日期 (可选, 默认取 inquiry.requiredDate) */
    private LocalDate expectedDeliveryDate;

    /** 采购单备注 (可选) */
    @Size(max = 5000)
    private String remark;
}

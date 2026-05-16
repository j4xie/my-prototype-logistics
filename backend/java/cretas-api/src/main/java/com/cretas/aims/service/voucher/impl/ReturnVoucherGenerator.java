package com.cretas.aims.service.voucher.impl;

import com.cretas.aims.entity.enums.VoucherType;
import com.cretas.aims.entity.finance.VoucherEntry;
import com.cretas.aims.entity.inventory.ReturnOrder;
import com.cretas.aims.service.voucher.AbstractVoucherGenerator;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 退货凭证 generator.
 *
 * 借: 6001 主营业务收入 (冲减收入 — 等同红字 SALES_RECEIPT)
 * 贷: 1122 应收账款 (冲减客户欠款)
 *
 * 业务: ReturnOrder 审批通过 → 财务反向冲销原销售凭证.
 */
@Component
public class ReturnVoucherGenerator extends AbstractVoucherGenerator<ReturnOrder> {

    public static final String BUSINESS_TYPE = "RETURN_ORDER";

    @Override
    public VoucherType getType() {
        return VoucherType.RETURN;
    }

    @Override
    public boolean supports(String businessType) {
        return BUSINESS_TYPE.equals(businessType);
    }

    @Override
    protected String extractSourceBusinessType() {
        return BUSINESS_TYPE;
    }

    @Override
    protected String extractSourceBusinessId(ReturnOrder r) {
        return r.getId();
    }

    @Override
    protected LocalDate extractVoucherDate(ReturnOrder r) {
        return r.getReturnDate();
    }

    @Override
    protected String extractDescription(ReturnOrder r) {
        return "退货单 " + r.getReturnNumber();
    }

    @Override
    public List<VoucherEntry> buildEntries(ReturnOrder r) {
        BigDecimal amount = nullToZero(r.getTotalAmount());
        return List.of(
                debitEntry(1, "6001", "主营业务收入", amount, "退货冲减收入 " + r.getReturnNumber()),
                creditEntry(2, "1122", "应收账款", amount, "客户应收冲减")
        );
    }
}

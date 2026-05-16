package com.cretas.aims.service.voucher.impl;

import com.cretas.aims.entity.enums.VoucherType;
import com.cretas.aims.entity.finance.VoucherEntry;
import com.cretas.aims.entity.restaurant.WastageRecord;
import com.cretas.aims.service.voucher.AbstractVoucherGenerator;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 报销 / 损耗 凭证 generator. (Phase 1 实现绑定 WastageRecord)
 *
 * 借: 6602.01 管理费用-损耗
 * 贷: 1405 库存商品
 *
 * 业务: WastageRecord 审批 APPROVED → 财务记 "损耗费用 + 库存减少".
 */
@Component
public class ExpenseVoucherGenerator extends AbstractVoucherGenerator<WastageRecord> {

    public static final String BUSINESS_TYPE = "WASTAGE_RECORD";

    @Override
    public VoucherType getType() {
        return VoucherType.EXPENSE;
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
    protected String extractSourceBusinessId(WastageRecord w) {
        return w.getId();
    }

    @Override
    protected LocalDate extractVoucherDate(WastageRecord w) {
        return w.getWastageDate();
    }

    @Override
    protected String extractDescription(WastageRecord w) {
        return "损耗单 " + w.getWastageNumber() + " (" + w.getType() + ")";
    }

    @Override
    public List<VoucherEntry> buildEntries(WastageRecord w) {
        BigDecimal amount = nullToZero(w.getEstimatedCost());
        return List.of(
                debitEntry(1, "6602.01", "管理费用-损耗", amount, "损耗 " + w.getWastageNumber()),
                creditEntry(2, "1405", "库存商品", amount, "库存减少 (" + w.getType() + ")")
        );
    }
}

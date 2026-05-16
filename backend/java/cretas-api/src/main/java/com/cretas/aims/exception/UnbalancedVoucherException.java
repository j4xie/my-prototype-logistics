package com.cretas.aims.exception;

import java.math.BigDecimal;

/**
 * 凭证借贷不平时抛. VoucherGenerator.buildEntries 末尾必须 assert
 * sum(debit) == sum(credit), 否则该 Voucher 不允许 persist.
 */
public class UnbalancedVoucherException extends RuntimeException {

    private final BigDecimal totalDebit;
    private final BigDecimal totalCredit;

    public UnbalancedVoucherException(BigDecimal totalDebit, BigDecimal totalCredit) {
        super(String.format("Voucher 借贷不平: debit=%s, credit=%s, diff=%s",
                totalDebit, totalCredit, totalDebit.subtract(totalCredit)));
        this.totalDebit = totalDebit;
        this.totalCredit = totalCredit;
    }

    public BigDecimal getTotalDebit() {
        return totalDebit;
    }

    public BigDecimal getTotalCredit() {
        return totalCredit;
    }
}

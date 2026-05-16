package com.cretas.aims.entity.finance;

import com.cretas.aims.entity.enums.VoucherType;
import com.cretas.aims.exception.UnbalancedVoucherException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class VoucherTest {

    @Test
    void balancedVoucherPassesValidation() {
        Voucher v = Voucher.builder()
                .factoryId("F001")
                .voucherNumber("V-2026-0001")
                .voucherType(VoucherType.SALES_RECEIPT)
                .totalDebit(new BigDecimal("100.00"))
                .totalCredit(new BigDecimal("100.00"))
                .entries(List.of(
                        VoucherEntry.builder().lineNo(1).debit(new BigDecimal("100.00")).credit(BigDecimal.ZERO).build(),
                        VoucherEntry.builder().lineNo(2).debit(BigDecimal.ZERO).credit(new BigDecimal("100.00")).build()
                ))
                .build();
        assertDoesNotThrow(v::validateBalanced);
    }

    @Test
    void unbalancedTotalThrowsException() {
        Voucher v = Voucher.builder()
                .factoryId("F001")
                .totalDebit(new BigDecimal("100.00"))
                .totalCredit(new BigDecimal("99.00"))
                .build();
        assertThrows(UnbalancedVoucherException.class, v::validateBalanced);
    }

    @Test
    void entrySumMismatchThrowsException() {
        // totals 自洽 but entries 不平 — 仍然抛
        Voucher v = Voucher.builder()
                .factoryId("F001")
                .totalDebit(new BigDecimal("100.00"))
                .totalCredit(new BigDecimal("100.00"))
                .entries(List.of(
                        VoucherEntry.builder().lineNo(1).debit(new BigDecimal("80.00")).credit(BigDecimal.ZERO).build(),
                        VoucherEntry.builder().lineNo(2).debit(BigDecimal.ZERO).credit(new BigDecimal("100.00")).build()
                ))
                .build();
        assertThrows(UnbalancedVoucherException.class, v::validateBalanced);
    }

    @Test
    void nullEntryAmountsTreatedAsZero() {
        Voucher v = Voucher.builder()
                .factoryId("F001")
                .totalDebit(new BigDecimal("50.00"))
                .totalCredit(new BigDecimal("50.00"))
                .entries(List.of(
                        VoucherEntry.builder().lineNo(1).debit(new BigDecimal("50.00")).credit(null).build(),
                        VoucherEntry.builder().lineNo(2).debit(null).credit(new BigDecimal("50.00")).build()
                ))
                .build();
        assertDoesNotThrow(v::validateBalanced);
    }
}

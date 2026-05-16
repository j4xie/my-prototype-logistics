package com.cretas.aims.service.voucher;

import com.cretas.aims.entity.enums.VoucherStatus;
import com.cretas.aims.entity.finance.Voucher;
import com.cretas.aims.entity.finance.VoucherEntry;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;

/**
 * Generator 公共基类 — 把 entries 装配成完整 Voucher, 自动调用 validateBalanced().
 *
 * <p>子类实现:
 * <ul>
 *   <li>{@link #getType()}, {@link #supports(String)}, {@link #buildEntries(Object)}</li>
 *   <li>{@link #extractAmount(Object)} — 业务单金额 (用于 totalDebit/totalCredit)</li>
 *   <li>{@link #extractSourceBusinessId(Object)} — 业务单 ID</li>
 *   <li>{@link #extractSourceBusinessType()} — 业务类型字符串</li>
 *   <li>{@link #extractVoucherDate(Object)} — 业务日期</li>
 *   <li>{@link #extractDescription(Object)} — 凭证描述</li>
 * </ul>
 */
public abstract class AbstractVoucherGenerator<T> implements VoucherGenerator<T> {

    @Override
    public Voucher generate(String factoryId, T businessEntity) {
        List<VoucherEntry> entries = buildEntries(businessEntity);
        BigDecimal totalDebit = entries.stream()
                .map(e -> Objects.requireNonNullElse(e.getDebit(), BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalCredit = entries.stream()
                .map(e -> Objects.requireNonNullElse(e.getCredit(), BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Voucher voucher = Voucher.builder()
                .factoryId(factoryId)
                .voucherType(getType())
                .voucherDate(extractVoucherDate(businessEntity))
                .sourceBusinessType(extractSourceBusinessType())
                .sourceBusinessId(extractSourceBusinessId(businessEntity))
                .totalDebit(totalDebit)
                .totalCredit(totalCredit)
                .status(VoucherStatus.DRAFT)
                .description(extractDescription(businessEntity))
                .entries(entries)
                .build();

        // back-ref voucher to entries (JPA cascade requires bidirectional)
        for (VoucherEntry e : entries) {
            e.setVoucher(voucher);
        }

        voucher.validateBalanced();
        return voucher;
    }

    protected abstract String extractSourceBusinessType();

    protected abstract String extractSourceBusinessId(T businessEntity);

    protected abstract LocalDate extractVoucherDate(T businessEntity);

    protected abstract String extractDescription(T businessEntity);

    /**
     * 工具: 构建借方分录 (debit 非零, credit=0).
     */
    protected VoucherEntry debitEntry(int lineNo, String code, String name, BigDecimal amount, String description) {
        return VoucherEntry.builder()
                .lineNo(lineNo)
                .subjectCode(code)
                .subjectName(name)
                .debit(amount)
                .credit(BigDecimal.ZERO)
                .description(description)
                .build();
    }

    /**
     * 工具: 构建贷方分录 (credit 非零, debit=0).
     */
    protected VoucherEntry creditEntry(int lineNo, String code, String name, BigDecimal amount, String description) {
        return VoucherEntry.builder()
                .lineNo(lineNo)
                .subjectCode(code)
                .subjectName(name)
                .debit(BigDecimal.ZERO)
                .credit(amount)
                .description(description)
                .build();
    }

    protected BigDecimal nullToZero(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }
}

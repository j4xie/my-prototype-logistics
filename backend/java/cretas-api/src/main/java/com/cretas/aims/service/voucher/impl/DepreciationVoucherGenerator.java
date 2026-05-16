package com.cretas.aims.service.voucher.impl;

import com.cretas.aims.entity.enums.VoucherType;
import com.cretas.aims.entity.finance.VoucherEntry;
import com.cretas.aims.service.voucher.AbstractVoucherGenerator;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 固定资产折旧凭证 generator.
 *
 * 借: 6602.02 管理费用-折旧
 * 贷: 1602 累计折旧
 *
 * 业务: 月底批量计提折旧 (无现成业务单 entity — 通过 Map<String,Object> 输入).
 * 后续 F-DEPRECIATION-SCHEDULE 引入 DepreciationSchedule entity 时切换为 typed.
 *
 * 期望 input Map keys:
 *   - businessId: String (e.g. "DEP-202605" — 月份标识)
 *   - amount: BigDecimal
 *   - voucherDate: LocalDate
 *   - assetCategory: String (描述用)
 */
@Component
public class DepreciationVoucherGenerator extends AbstractVoucherGenerator<Map<String, Object>> {

    public static final String BUSINESS_TYPE = "DEPRECATION";

    @Override
    public VoucherType getType() {
        return VoucherType.DEPRECATION;
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
    protected String extractSourceBusinessId(Map<String, Object> input) {
        Object v = input.get("businessId");
        return v != null ? v.toString() : null;
    }

    @Override
    protected LocalDate extractVoucherDate(Map<String, Object> input) {
        Object v = input.get("voucherDate");
        if (v instanceof LocalDate ld) return ld;
        if (v instanceof String s) return LocalDate.parse(s);
        return LocalDate.now();
    }

    @Override
    protected String extractDescription(Map<String, Object> input) {
        Object cat = input.get("assetCategory");
        return "固定资产折旧" + (cat != null ? " — " + cat : "");
    }

    @Override
    public List<VoucherEntry> buildEntries(Map<String, Object> input) {
        BigDecimal amount = toBigDecimal(input.get("amount"));
        String description = extractDescription(input);
        return List.of(
                debitEntry(1, "6602.02", "管理费用-折旧", amount, description),
                creditEntry(2, "1602", "累计折旧", amount, "累计折旧增加")
        );
    }

    private BigDecimal toBigDecimal(Object v) {
        Objects.requireNonNull(v, "DepreciationVoucherGenerator: amount is required");
        if (v instanceof BigDecimal bd) return bd;
        if (v instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        return new BigDecimal(v.toString());
    }
}

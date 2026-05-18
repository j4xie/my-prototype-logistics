package com.cretas.aims.service.hr;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * 一次性年终奖个税计算器 — #833 follow-up.
 *
 * <p>独立于月度个税 ({@code SalaryItemServiceImpl#computePersonalTax}).
 * 按中国 2019+ 税法, 一次性年终奖适用专用税率公式:
 *
 * <ol>
 *   <li>monthlyEq = bonusAmount / 12 (找税率档)</li>
 *   <li>在 7-bracket 表中找 monthlyEq 落入的档位 (rate + quickDeduction)</li>
 *   <li>tax = bonusAmount × rate − quickDeduction (注意是 bonusAmount 全额, 不是 monthlyEq)</li>
 * </ol>
 *
 * <p>Brackets (monthly equivalent thresholds, 与月度税表 rates 一致):
 * <pre>
 *   ≤ 3000   : 3%,  扣 0
 *   ≤ 12000  : 10%, 扣 210
 *   ≤ 25000  : 20%, 扣 1410
 *   ≤ 35000  : 25%, 扣 2660
 *   ≤ 55000  : 30%, 扣 4410
 *   ≤ 80000  : 35%, 扣 7160
 *   > 80000  : 45%, 扣 15160
 * </pre>
 *
 * <p>Pure static — no Spring DI. 与 monthly tax compute 不耦合.
 *
 * @author Cretas Team — #833 annual bonus tax follow-up
 * @since 2026-05-18
 */
public final class AnnualBonusTaxCalculator {

    private static final BigDecimal TWELVE = new BigDecimal("12");

    private static final BigDecimal T_3000 = new BigDecimal("3000");
    private static final BigDecimal T_12000 = new BigDecimal("12000");
    private static final BigDecimal T_25000 = new BigDecimal("25000");
    private static final BigDecimal T_35000 = new BigDecimal("35000");
    private static final BigDecimal T_55000 = new BigDecimal("55000");
    private static final BigDecimal T_80000 = new BigDecimal("80000");

    private static final BigDecimal RATE_03 = new BigDecimal("0.03");
    private static final BigDecimal RATE_10 = new BigDecimal("0.10");
    private static final BigDecimal RATE_20 = new BigDecimal("0.20");
    private static final BigDecimal RATE_25 = new BigDecimal("0.25");
    private static final BigDecimal RATE_30 = new BigDecimal("0.30");
    private static final BigDecimal RATE_35 = new BigDecimal("0.35");
    private static final BigDecimal RATE_45 = new BigDecimal("0.45");

    private static final BigDecimal DED_0 = BigDecimal.ZERO;
    private static final BigDecimal DED_210 = new BigDecimal("210");
    private static final BigDecimal DED_1410 = new BigDecimal("1410");
    private static final BigDecimal DED_2660 = new BigDecimal("2660");
    private static final BigDecimal DED_4410 = new BigDecimal("4410");
    private static final BigDecimal DED_7160 = new BigDecimal("7160");
    private static final BigDecimal DED_15160 = new BigDecimal("15160");

    private AnnualBonusTaxCalculator() {
        // static-only
    }

    /**
     * 计算一次性年终奖个税.
     *
     * @param bonusAmount 年终奖金额 (¥). null / ≤0 返 ZERO.
     * @return 应纳个税 (scale=2, HALF_UP).
     */
    public static BigDecimal computeAnnualBonusTax(BigDecimal bonusAmount) {
        if (bonusAmount == null || bonusAmount.signum() <= 0) {
            return BigDecimal.ZERO;
        }
        BracketHit hit = findBracket(bonusAmount);
        BigDecimal tax = bonusAmount.multiply(hit.rate).subtract(hit.quickDeduction);
        if (tax.signum() < 0) tax = BigDecimal.ZERO;
        return tax.setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * 查找适用的税率档 — UI preview 用 (显示 "税率 X% / 速算扣除 Y").
     *
     * @param bonusAmount 年终奖金额 (¥). null / ≤0 返第一档.
     * @return BracketHit 含 rate + quickDeduction + readable label.
     */
    public static BracketHit findBracket(BigDecimal bonusAmount) {
        BigDecimal amount = bonusAmount == null ? BigDecimal.ZERO : bonusAmount;
        if (amount.signum() < 0) amount = BigDecimal.ZERO;
        BigDecimal monthlyEq = amount.divide(TWELVE, 4, RoundingMode.HALF_UP);
        if (monthlyEq.compareTo(T_3000) <= 0) {
            return new BracketHit(RATE_03, DED_0, "≤3000", "3%");
        }
        if (monthlyEq.compareTo(T_12000) <= 0) {
            return new BracketHit(RATE_10, DED_210, "≤12000", "10%");
        }
        if (monthlyEq.compareTo(T_25000) <= 0) {
            return new BracketHit(RATE_20, DED_1410, "≤25000", "20%");
        }
        if (monthlyEq.compareTo(T_35000) <= 0) {
            return new BracketHit(RATE_25, DED_2660, "≤35000", "25%");
        }
        if (monthlyEq.compareTo(T_55000) <= 0) {
            return new BracketHit(RATE_30, DED_4410, "≤55000", "30%");
        }
        if (monthlyEq.compareTo(T_80000) <= 0) {
            return new BracketHit(RATE_35, DED_7160, "≤80000", "35%");
        }
        return new BracketHit(RATE_45, DED_15160, ">80000", "45%");
    }

    /**
     * Bracket hit metadata (供 UI preview 显示档位信息).
     */
    public static final class BracketHit {
        public final BigDecimal rate;
        public final BigDecimal quickDeduction;
        public final String label;
        public final String ratePercent;

        public BracketHit(BigDecimal rate, BigDecimal quickDeduction,
                          String label, String ratePercent) {
            this.rate = rate;
            this.quickDeduction = quickDeduction;
            this.label = label;
            this.ratePercent = ratePercent;
        }
    }
}

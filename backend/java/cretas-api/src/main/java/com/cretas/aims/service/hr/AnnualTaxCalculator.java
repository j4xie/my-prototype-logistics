package com.cretas.aims.service.hr;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * 年度综合所得个税计算器 — #833 follow-up.
 *
 * <p>独立于月度个税 ({@code SalaryItemServiceImpl#computePersonalTax}) 和
 * 一次性年终奖 ({@link AnnualBonusTaxCalculator}). 按中国 2019+ 税法,
 * 综合所得年度汇算适用 ANNUAL bracket 公式:
 *
 * <ol>
 *   <li>annualTaxableIncome = totalSalary − 60000起征点 − 总社保 − 总公积金 − 总专项扣除</li>
 *   <li>在 7-bracket ANNUAL 表中找 annualTaxableIncome 落入的档位 (rate + quickDeduction)</li>
 *   <li>annualTaxDue = annualTaxableIncome × rate − quickDeduction</li>
 * </ol>
 *
 * <p>Brackets (annual, 综合所得):
 * <pre>
 *   ≤ 36000   : 3%,  扣 0
 *   ≤ 144000  : 10%, 扣 2520
 *   ≤ 300000  : 20%, 扣 16920
 *   ≤ 420000  : 25%, 扣 31920
 *   ≤ 660000  : 30%, 扣 52920
 *   ≤ 960000  : 35%, 扣 85920
 *   > 960000  : 45%, 扣 181920
 * </pre>
 *
 * <p>注: 这是 ANNUAL brackets, 跟月度 brackets (3000/12000/...) 不同;
 * 跟一次性年终奖 brackets (3000/12000/... monthlyEq) 也不同.
 *
 * <p>Pure static — no Spring DI.
 *
 * @author Cretas Team — #833 年度汇算 follow-up
 * @since 2026-05-18
 */
public final class AnnualTaxCalculator {

    /** 年度起征点 (60000 = 5000/月 × 12). */
    public static final BigDecimal ANNUAL_THRESHOLD = new BigDecimal("60000");

    private static final BigDecimal T_36000 = new BigDecimal("36000");
    private static final BigDecimal T_144000 = new BigDecimal("144000");
    private static final BigDecimal T_300000 = new BigDecimal("300000");
    private static final BigDecimal T_420000 = new BigDecimal("420000");
    private static final BigDecimal T_660000 = new BigDecimal("660000");
    private static final BigDecimal T_960000 = new BigDecimal("960000");

    private static final BigDecimal RATE_03 = new BigDecimal("0.03");
    private static final BigDecimal RATE_10 = new BigDecimal("0.10");
    private static final BigDecimal RATE_20 = new BigDecimal("0.20");
    private static final BigDecimal RATE_25 = new BigDecimal("0.25");
    private static final BigDecimal RATE_30 = new BigDecimal("0.30");
    private static final BigDecimal RATE_35 = new BigDecimal("0.35");
    private static final BigDecimal RATE_45 = new BigDecimal("0.45");

    private static final BigDecimal DED_0 = BigDecimal.ZERO;
    private static final BigDecimal DED_2520 = new BigDecimal("2520");
    private static final BigDecimal DED_16920 = new BigDecimal("16920");
    private static final BigDecimal DED_31920 = new BigDecimal("31920");
    private static final BigDecimal DED_52920 = new BigDecimal("52920");
    private static final BigDecimal DED_85920 = new BigDecimal("85920");
    private static final BigDecimal DED_181920 = new BigDecimal("181920");

    private AnnualTaxCalculator() {
        // static-only
    }

    /**
     * 计算年度应纳税额.
     *
     * @param annualTaxableIncome 年度应纳税所得额 (¥). null / ≤0 返 ZERO.
     * @return 应纳个税 (scale=2, HALF_UP).
     */
    public static BigDecimal computeAnnualTax(BigDecimal annualTaxableIncome) {
        if (annualTaxableIncome == null || annualTaxableIncome.signum() <= 0) {
            return BigDecimal.ZERO;
        }
        BracketHit hit = findBracket(annualTaxableIncome);
        BigDecimal tax = annualTaxableIncome.multiply(hit.rate).subtract(hit.quickDeduction);
        if (tax.signum() < 0) tax = BigDecimal.ZERO;
        return tax.setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * 查找年度档位 — UI preview 用.
     *
     * @param annualTaxableIncome 年度应纳税所得额 (¥). null / ≤0 返第一档.
     */
    public static BracketHit findBracket(BigDecimal annualTaxableIncome) {
        BigDecimal amount = annualTaxableIncome == null ? BigDecimal.ZERO : annualTaxableIncome;
        if (amount.signum() < 0) amount = BigDecimal.ZERO;
        if (amount.compareTo(T_36000) <= 0) {
            return new BracketHit(RATE_03, DED_0, "≤36000", "3%");
        }
        if (amount.compareTo(T_144000) <= 0) {
            return new BracketHit(RATE_10, DED_2520, "≤144000", "10%");
        }
        if (amount.compareTo(T_300000) <= 0) {
            return new BracketHit(RATE_20, DED_16920, "≤300000", "20%");
        }
        if (amount.compareTo(T_420000) <= 0) {
            return new BracketHit(RATE_25, DED_31920, "≤420000", "25%");
        }
        if (amount.compareTo(T_660000) <= 0) {
            return new BracketHit(RATE_30, DED_52920, "≤660000", "30%");
        }
        if (amount.compareTo(T_960000) <= 0) {
            return new BracketHit(RATE_35, DED_85920, "≤960000", "35%");
        }
        return new BracketHit(RATE_45, DED_181920, ">960000", "45%");
    }

    /**
     * 计算年度应纳税所得额 = totalSalary − 60000 − totalSocial − totalFund − totalSpecial.
     * 防御截到 0.
     */
    public static BigDecimal computeTaxableIncome(BigDecimal totalSalary,
                                                  BigDecimal totalSocialInsurance,
                                                  BigDecimal totalProvidentFund,
                                                  BigDecimal totalSpecialDeductions) {
        BigDecimal salary = totalSalary == null ? BigDecimal.ZERO : totalSalary;
        BigDecimal social = totalSocialInsurance == null ? BigDecimal.ZERO : totalSocialInsurance;
        BigDecimal fund = totalProvidentFund == null ? BigDecimal.ZERO : totalProvidentFund;
        BigDecimal special = totalSpecialDeductions == null ? BigDecimal.ZERO : totalSpecialDeductions;
        BigDecimal taxable = salary.subtract(ANNUAL_THRESHOLD).subtract(social)
                .subtract(fund).subtract(special);
        if (taxable.signum() < 0) taxable = BigDecimal.ZERO;
        return taxable.setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * Bracket hit metadata (供 UI 显示 "适用税率 / 速算扣除").
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

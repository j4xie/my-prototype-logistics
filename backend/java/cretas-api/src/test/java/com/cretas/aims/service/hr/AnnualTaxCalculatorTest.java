package com.cretas.aims.service.hr;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

/**
 * AnnualTaxCalculator 单元测试 — #833 年度汇算 follow-up.
 *
 * <p>覆盖:
 * <ul>
 *   <li>7 个年度档位边界 + 中位值</li>
 *   <li>computeTaxableIncome 计算 (起征点 60000 + 三大扣除)</li>
 *   <li>边界 case: null / 0 / negative</li>
 * </ul>
 *
 * @since 2026-05-18
 */
@DisplayName("AnnualTaxCalculator 综合所得年度个税计算")
class AnnualTaxCalculatorTest {

    private static BigDecimal bd(String s) { return new BigDecimal(s); }

    // ============= computeAnnualTax =============

    @Test
    @DisplayName("null taxable 返 ZERO")
    void nullTaxableReturnsZero() {
        assertEquals(BigDecimal.ZERO, AnnualTaxCalculator.computeAnnualTax(null));
    }

    @Test
    @DisplayName("zero taxable 返 ZERO")
    void zeroTaxableReturnsZero() {
        assertEquals(BigDecimal.ZERO, AnnualTaxCalculator.computeAnnualTax(BigDecimal.ZERO));
    }

    @Test
    @DisplayName("negative taxable 返 ZERO (防御)")
    void negativeTaxableReturnsZero() {
        assertEquals(BigDecimal.ZERO, AnnualTaxCalculator.computeAnnualTax(bd("-100")));
    }

    @Test
    @DisplayName("第1档 30000 → tax = 30000 × 3% − 0 = 900.00")
    void firstBracket() {
        BigDecimal tax = AnnualTaxCalculator.computeAnnualTax(bd("30000"));
        assertEquals(0, bd("900.00").compareTo(tax), "expected 900.00, got " + tax);
    }

    @Test
    @DisplayName("第1档边界 36000 → tax = 36000 × 3% − 0 = 1080.00")
    void firstBracketBoundary() {
        BigDecimal tax = AnnualTaxCalculator.computeAnnualTax(bd("36000"));
        assertEquals(0, bd("1080.00").compareTo(tax), "expected 1080.00, got " + tax);
    }

    @Test
    @DisplayName("第2档 100000 → tax = 100000 × 10% − 2520 = 7480.00")
    void secondBracket() {
        BigDecimal tax = AnnualTaxCalculator.computeAnnualTax(bd("100000"));
        assertEquals(0, bd("7480.00").compareTo(tax), "expected 7480.00, got " + tax);
    }

    @Test
    @DisplayName("第2档边界 144000 → tax = 144000 × 10% − 2520 = 11880.00")
    void secondBracketBoundary() {
        BigDecimal tax = AnnualTaxCalculator.computeAnnualTax(bd("144000"));
        assertEquals(0, bd("11880.00").compareTo(tax), "expected 11880.00, got " + tax);
    }

    @Test
    @DisplayName("第3档 200000 → tax = 200000 × 20% − 16920 = 23080.00")
    void thirdBracket() {
        BigDecimal tax = AnnualTaxCalculator.computeAnnualTax(bd("200000"));
        assertEquals(0, bd("23080.00").compareTo(tax), "expected 23080.00, got " + tax);
    }

    @Test
    @DisplayName("第4档 350000 → tax = 350000 × 25% − 31920 = 55580.00")
    void fourthBracket() {
        BigDecimal tax = AnnualTaxCalculator.computeAnnualTax(bd("350000"));
        assertEquals(0, bd("55580.00").compareTo(tax), "expected 55580.00, got " + tax);
    }

    @Test
    @DisplayName("第5档 500000 → tax = 500000 × 30% − 52920 = 97080.00")
    void fifthBracket() {
        BigDecimal tax = AnnualTaxCalculator.computeAnnualTax(bd("500000"));
        assertEquals(0, bd("97080.00").compareTo(tax), "expected 97080.00, got " + tax);
    }

    @Test
    @DisplayName("第6档 800000 → tax = 800000 × 35% − 85920 = 194080.00")
    void sixthBracket() {
        BigDecimal tax = AnnualTaxCalculator.computeAnnualTax(bd("800000"));
        assertEquals(0, bd("194080.00").compareTo(tax), "expected 194080.00, got " + tax);
    }

    @Test
    @DisplayName("第7档 1500000 → tax = 1500000 × 45% − 181920 = 493080.00")
    void seventhBracket() {
        BigDecimal tax = AnnualTaxCalculator.computeAnnualTax(bd("1500000"));
        assertEquals(0, bd("493080.00").compareTo(tax), "expected 493080.00, got " + tax);
    }

    // ============= findBracket =============

    @Test
    @DisplayName("findBracket(0) → 第1档 3%")
    void findBracketZero() {
        AnnualTaxCalculator.BracketHit hit = AnnualTaxCalculator.findBracket(BigDecimal.ZERO);
        assertEquals("≤36000", hit.label);
        assertEquals("3%", hit.ratePercent);
    }

    @Test
    @DisplayName("findBracket(36001) → 第2档 10% / 扣 2520")
    void findBracketSecond() {
        AnnualTaxCalculator.BracketHit hit = AnnualTaxCalculator.findBracket(bd("36001"));
        assertEquals("≤144000", hit.label);
        assertEquals("10%", hit.ratePercent);
        assertEquals(0, bd("2520").compareTo(hit.quickDeduction));
    }

    @Test
    @DisplayName("findBracket(1000000) → 第7档 45% / 扣 181920")
    void findBracketTop() {
        AnnualTaxCalculator.BracketHit hit = AnnualTaxCalculator.findBracket(bd("1000000"));
        assertEquals(">960000", hit.label);
        assertEquals("45%", hit.ratePercent);
        assertEquals(0, bd("181920").compareTo(hit.quickDeduction));
    }

    // ============= computeTaxableIncome =============

    @Test
    @DisplayName("computeTaxableIncome: 200000 − 60000 − 20000 − 10000 − 12000 = 98000")
    void computeTaxableIncomeNormal() {
        BigDecimal taxable = AnnualTaxCalculator.computeTaxableIncome(
                bd("200000"), bd("20000"), bd("10000"), bd("12000"));
        assertEquals(0, bd("98000.00").compareTo(taxable));
    }

    @Test
    @DisplayName("computeTaxableIncome: 全 null → 截到 0 (起征点 > 0 salary)")
    void computeTaxableIncomeAllNull() {
        BigDecimal taxable = AnnualTaxCalculator.computeTaxableIncome(null, null, null, null);
        assertEquals(0, BigDecimal.ZERO.compareTo(taxable));
    }

    @Test
    @DisplayName("computeTaxableIncome: salary 50000 < 60000 起征点 → 截到 0")
    void computeTaxableIncomeBelowThreshold() {
        BigDecimal taxable = AnnualTaxCalculator.computeTaxableIncome(
                bd("50000"), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
        assertEquals(0, BigDecimal.ZERO.compareTo(taxable));
    }

    @Test
    @DisplayName("computeTaxableIncome: 大扣除让 taxable 为负 → 截到 0")
    void computeTaxableIncomeNegativeTrunc() {
        BigDecimal taxable = AnnualTaxCalculator.computeTaxableIncome(
                bd("100000"), bd("80000"), bd("20000"), bd("30000"));
        assertEquals(0, BigDecimal.ZERO.compareTo(taxable));
    }

    // ============= 综合 case (典型场景) =============

    @Test
    @DisplayName("典型: 年薪 200000 + 三大扣除 → taxable 98000 → tax 7280.00")
    void integrationCase() {
        // taxable = 200000 - 60000 - 20000 - 10000 - 12000 = 98000
        BigDecimal taxable = AnnualTaxCalculator.computeTaxableIncome(
                bd("200000"), bd("20000"), bd("10000"), bd("12000"));
        // 98000 ≤ 144000 → 第2档 10% / 扣 2520
        // tax = 98000 × 0.10 − 2520 = 9800 − 2520 = 7280.00
        BigDecimal tax = AnnualTaxCalculator.computeAnnualTax(taxable);
        assertEquals(0, bd("7280.00").compareTo(tax), "expected 7280.00, got " + tax);
    }
}

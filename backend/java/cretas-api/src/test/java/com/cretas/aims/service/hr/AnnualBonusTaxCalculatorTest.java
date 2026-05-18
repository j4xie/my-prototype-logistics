package com.cretas.aims.service.hr;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

/**
 * AnnualBonusTaxCalculator 单元测试 — #833 follow-up.
 *
 * <p>覆盖 7-bracket 边界 + 边界 case (null / 0 / negative).
 *
 * <p>验证算式: tax = bonusAmount × rate − quickDeduction
 * (bracket 由 monthlyEq = bonus/12 决定)
 *
 * @since 2026-05-18
 */
@DisplayName("AnnualBonusTaxCalculator 一次性年终奖个税计算")
class AnnualBonusTaxCalculatorTest {

    private static BigDecimal bd(String s) { return new BigDecimal(s); }

    @Test
    @DisplayName("null bonus 返 ZERO")
    void nullBonusReturnsZero() {
        assertEquals(BigDecimal.ZERO,
                AnnualBonusTaxCalculator.computeAnnualBonusTax(null));
    }

    @Test
    @DisplayName("zero bonus 返 ZERO")
    void zeroBonusReturnsZero() {
        assertEquals(BigDecimal.ZERO,
                AnnualBonusTaxCalculator.computeAnnualBonusTax(BigDecimal.ZERO));
    }

    @Test
    @DisplayName("negative bonus 返 ZERO (防御)")
    void negativeBonusReturnsZero() {
        assertEquals(BigDecimal.ZERO,
                AnnualBonusTaxCalculator.computeAnnualBonusTax(bd("-100")));
    }

    @Test
    @DisplayName("bonus 12000 → monthlyEq 1000 → 第1档 3% / 扣0 → tax = 12000×0.03 = 360.00")
    void firstBracket() {
        // 12000 / 12 = 1000 ≤ 3000 → 3% rate, 0 deduction
        BigDecimal tax = AnnualBonusTaxCalculator.computeAnnualBonusTax(bd("12000"));
        assertEquals(0, bd("360.00").compareTo(tax),
                "expected 360.00, got " + tax);
    }

    @Test
    @DisplayName("bonus 36000 → monthlyEq 3000 → 第1档边界 → tax = 36000×0.03 = 1080.00")
    void firstBracketBoundary() {
        // 36000 / 12 = 3000 ≤ 3000 → first bracket
        BigDecimal tax = AnnualBonusTaxCalculator.computeAnnualBonusTax(bd("36000"));
        assertEquals(0, bd("1080.00").compareTo(tax),
                "expected 1080.00, got " + tax);
    }

    @Test
    @DisplayName("bonus 36001 → monthlyEq 3000.08 → 第2档 10% / 扣210 → tax = 36001×0.10 − 210 = 3390.10")
    void secondBracketJustOverFirst() {
        BigDecimal tax = AnnualBonusTaxCalculator.computeAnnualBonusTax(bd("36001"));
        // 36001 × 0.10 − 210 = 3600.10 − 210 = 3390.10
        assertEquals(0, bd("3390.10").compareTo(tax),
                "expected 3390.10, got " + tax);
    }

    @Test
    @DisplayName("bonus 144000 → monthlyEq 12000 → 第2档边界 → tax = 144000×0.10 − 210 = 14190.00")
    void secondBracketBoundary() {
        BigDecimal tax = AnnualBonusTaxCalculator.computeAnnualBonusTax(bd("144000"));
        // 144000 × 0.10 − 210 = 14400 − 210 = 14190.00
        assertEquals(0, bd("14190.00").compareTo(tax),
                "expected 14190.00, got " + tax);
    }

    @Test
    @DisplayName("bonus 300000 → monthlyEq 25000 → 第3档 20% / 扣1410 → tax = 300000×0.20 − 1410 = 58590.00")
    void thirdBracket() {
        BigDecimal tax = AnnualBonusTaxCalculator.computeAnnualBonusTax(bd("300000"));
        // 300000 × 0.20 − 1410 = 60000 − 1410 = 58590.00
        assertEquals(0, bd("58590.00").compareTo(tax),
                "expected 58590.00, got " + tax);
    }

    @Test
    @DisplayName("bonus 420000 → monthlyEq 35000 → 第4档 25% / 扣2660 → tax = 420000×0.25 − 2660 = 102340.00")
    void fourthBracket() {
        BigDecimal tax = AnnualBonusTaxCalculator.computeAnnualBonusTax(bd("420000"));
        // 420000 × 0.25 − 2660 = 105000 − 2660 = 102340.00
        assertEquals(0, bd("102340.00").compareTo(tax),
                "expected 102340.00, got " + tax);
    }

    @Test
    @DisplayName("bonus 660000 → monthlyEq 55000 → 第5档 30% / 扣4410 → tax = 660000×0.30 − 4410 = 193590.00")
    void fifthBracket() {
        BigDecimal tax = AnnualBonusTaxCalculator.computeAnnualBonusTax(bd("660000"));
        // 660000 × 0.30 − 4410 = 198000 − 4410 = 193590.00
        assertEquals(0, bd("193590.00").compareTo(tax),
                "expected 193590.00, got " + tax);
    }

    @Test
    @DisplayName("bonus 960000 → monthlyEq 80000 → 第6档 35% / 扣7160 → tax = 960000×0.35 − 7160 = 328840.00")
    void sixthBracket() {
        BigDecimal tax = AnnualBonusTaxCalculator.computeAnnualBonusTax(bd("960000"));
        // 960000 × 0.35 − 7160 = 336000 − 7160 = 328840.00
        assertEquals(0, bd("328840.00").compareTo(tax),
                "expected 328840.00, got " + tax);
    }

    @Test
    @DisplayName("bonus 1200000 → monthlyEq 100000 → 第7档 45% / 扣15160 → tax = 1200000×0.45 − 15160 = 524840.00")
    void seventhBracket() {
        BigDecimal tax = AnnualBonusTaxCalculator.computeAnnualBonusTax(bd("1200000"));
        // 1200000 × 0.45 − 15160 = 540000 − 15160 = 524840.00
        assertEquals(0, bd("524840.00").compareTo(tax),
                "expected 524840.00, got " + tax);
    }

    @Test
    @DisplayName("findBracket 给 UI preview 用 — 36000 返第1档 label")
    void findBracketLabel() {
        AnnualBonusTaxCalculator.BracketHit hit =
                AnnualBonusTaxCalculator.findBracket(bd("36000"));
        assertEquals("3%", hit.ratePercent);
        assertEquals("≤3000", hit.label);
        assertEquals(0, BigDecimal.ZERO.compareTo(hit.quickDeduction));
    }

    @Test
    @DisplayName("findBracket — 1200000 返第7档")
    void findBracketTopTier() {
        AnnualBonusTaxCalculator.BracketHit hit =
                AnnualBonusTaxCalculator.findBracket(bd("1200000"));
        assertEquals("45%", hit.ratePercent);
        assertEquals(">80000", hit.label);
        assertEquals(0, bd("15160").compareTo(hit.quickDeduction));
    }
}

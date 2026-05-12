package com.cretas.aims.entity;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Regression guard for PR #443 follow-up F8 — DisposalRecord leak sweep.
 *
 * <p>Before fix:
 * <ul>
 *   <li>{@link DisposalRecord#estimatedLoss}, {@code actualLoss} and {@code recoveryValue}
 *       had no {@code @PriceSensitive} annotation, so warehouse_manager fetching a
 *       disposal record saw real loss amounts (data leak).</li>
 *   <li>{@link DisposalRecord#getNetLoss()} fell back to {@code BigDecimal.ZERO} when
 *       both {@code actualLoss} and {@code estimatedLoss} were {@code null} (e.g. after
 *       stripping). That made stripped rows appear as "zero net loss" — a worse leak
 *       than {@code null} since it implies "no financial impact".</li>
 * </ul>
 *
 * <p>These tests mirror the {@code ReturnOrderPriceSensitiveTest} pattern — admin sees
 * the real numbers, warehouse_manager (simulated via field=null) sees {@code null} and
 * never 500s.
 */
class DisposalRecordPriceSensitiveTest {

    @Test
    void warehouseManagerStrip_getNetLoss_returnsNull_notZero() {
        // Simulates PriceFieldResponseAdvice strip for warehouse_manager:
        // all three price-sensitive fields are nulled out.
        DisposalRecord record = new DisposalRecord();
        record.setEstimatedLoss(null);  // stripped
        record.setActualLoss(null);     // stripped
        record.setRecoveryValue(null);  // stripped

        assertNull(record.getNetLoss(),
                "Stripped loss fields must propagate to getNetLoss()=null, "
                        + "not ZERO (ZERO would leak 'no financial impact' to warehouse_manager)");
    }

    @Test
    void warehouseManagerStrip_partialNull_actualLossOnlyStripped_stillReturnsNull() {
        // Edge case: ResponseAdvice nulled estimatedLoss + actualLoss but recoveryValue
        // somehow survived (defensive). getNetLoss must still return null — no loss anchor.
        DisposalRecord record = new DisposalRecord();
        record.setEstimatedLoss(null);
        record.setActualLoss(null);
        record.setRecoveryValue(new BigDecimal("10.00"));

        assertNull(record.getNetLoss(),
                "When both loss inputs are null, getNetLoss must return null even if "
                        + "recoveryValue is set — recovery alone cannot infer net loss");
    }

    @Test
    void adminSees_netLoss_actualMinusRecovery() {
        // factory_super_admin: actualLoss preferred over estimatedLoss, recovery subtracted.
        DisposalRecord record = new DisposalRecord();
        record.setEstimatedLoss(new BigDecimal("500.00"));
        record.setActualLoss(new BigDecimal("450.00"));
        record.setRecoveryValue(new BigDecimal("50.00"));

        assertEquals(new BigDecimal("400.00"), record.getNetLoss(),
                "actualLoss (450) - recoveryValue (50) = 400; actualLoss takes precedence over estimatedLoss");
    }

    @Test
    void adminSees_netLoss_estimatedFallback_whenActualMissing() {
        // factory_super_admin: actualLoss not yet recorded, estimatedLoss used as fallback.
        DisposalRecord record = new DisposalRecord();
        record.setEstimatedLoss(new BigDecimal("300.00"));
        record.setActualLoss(null);
        record.setRecoveryValue(null);

        assertEquals(new BigDecimal("300.00"), record.getNetLoss(),
                "estimatedLoss (300) used when actualLoss is null, recoveryValue defaults to ZERO");
    }

    @Test
    void adminSees_netLoss_negativeWhenRecoveryExceedsLoss() {
        // Edge case: recoveryValue > actualLoss → negative netLoss (gain).
        // The math must not clamp at zero.
        DisposalRecord record = new DisposalRecord();
        record.setEstimatedLoss(null);
        record.setActualLoss(new BigDecimal("80.00"));
        record.setRecoveryValue(new BigDecimal("100.00"));

        assertEquals(new BigDecimal("-20.00"), record.getNetLoss(),
                "actualLoss (80) - recoveryValue (100) = -20; recovery exceeding loss is a net gain");
    }
}

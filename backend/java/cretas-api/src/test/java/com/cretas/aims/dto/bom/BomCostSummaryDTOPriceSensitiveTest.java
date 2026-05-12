package com.cretas.aims.dto.bom;

import com.cretas.aims.security.PriceSensitive;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Regression guard for PR #455 BUG-2 — BomCostSummaryDTO leak sweep.
 *
 * <p>{@code GET /api/mobile/{factoryId}/bom/cost-summary/{productId}} returns a
 * {@link BomCostSummaryDTO} containing four roll-up totals plus three nested cost-item lists
 * (material / labor / overhead). Each cost-item carries its own {@code unitPrice} and
 * {@code subtotal}. Before fix none of the BigDecimal monetary fields carried
 * {@code @PriceSensitive}, so a warehouse_manager hitting the endpoint received the full
 * pricing picture — supplier cost, labor rates, overhead allocations, and the grand total.
 *
 * <p>The parameterised cases below introspect each monetary field across the outer DTO and
 * its three inner cost-item classes. Non-monetary fields (quantity, yieldRate, taxRate,
 * allocationRate) are deliberately excluded — rates and quantities are not sensitive per the
 * project's RBAC source-of-truth (PR #415 Option B inline notes).
 */
class BomCostSummaryDTOPriceSensitiveTest {

    @ParameterizedTest(name = "{0}.{1} is @PriceSensitive")
    @CsvSource({
            // Outer DTO — four roll-up totals
            "BomCostSummaryDTO, materialCostTotal",
            "BomCostSummaryDTO, laborCostTotal",
            "BomCostSummaryDTO, overheadCostTotal",
            "BomCostSummaryDTO, totalCost",
            // MaterialCostItem — supplier unit pricing + per-line subtotal
            "MaterialCostItem, unitPrice",
            "MaterialCostItem, subtotal",
            // LaborCostItem — labor rate + per-line subtotal
            "LaborCostItem, unitPrice",
            "LaborCostItem, subtotal",
            // OverheadCostItem — overhead rate + per-line subtotal
            "OverheadCostItem, unitPrice",
            "OverheadCostItem, subtotal",
    })
    void monetaryField_isAnnotated_priceSensitive(String className, String fieldName)
            throws NoSuchFieldException {
        Class<?> target = switch (className) {
            case "BomCostSummaryDTO" -> BomCostSummaryDTO.class;
            case "MaterialCostItem" -> BomCostSummaryDTO.MaterialCostItem.class;
            case "LaborCostItem" -> BomCostSummaryDTO.LaborCostItem.class;
            case "OverheadCostItem" -> BomCostSummaryDTO.OverheadCostItem.class;
            default -> throw new IllegalArgumentException("Unknown class: " + className);
        };

        Field field = target.getDeclaredField(fieldName);
        assertNotNull(
                field.getAnnotation(PriceSensitive.class),
                className + "." + fieldName + " must be @PriceSensitive — leaks via "
                        + "/api/mobile/{factoryId}/bom/cost-summary/{productId} otherwise."
        );
    }
}

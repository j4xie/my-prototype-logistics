package com.cretas.aims.service.config;

import com.cretas.aims.dto.config.EffectiveField;
import com.cretas.aims.service.config.impl.FactoryConfigServiceImpl;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * BUG-1 regression guard (PR #447 follow-up): assert that the priceSensitive flag
 * in module_schemas.field_schema is forwarded into EffectiveField.extra so the
 * Canvas Dynamic SchemaTableRenderer can render stripped null cells as em-dash
 * (mirrors static-Vue v-if defense from PR #423).
 *
 * <p>If line 1149 of FactoryConfigServiceImpl#buildEffectiveFields is ever removed
 * (or the if-key changes), this test fails — preventing the silent regression that
 * caused the bug surfaced by PR #455 E2E.
 */
class FactoryConfigPriceSensitiveTest {

    @Test
    @SuppressWarnings("unchecked")
    void buildEffectiveFields_forwardsPriceSensitiveFlag() throws Exception {
        FactoryConfigServiceImpl svc = new FactoryConfigServiceImpl(null, null, null, null, null);

        Map<String, Object> priceField = new HashMap<>();
        priceField.put("code", "totalAmount");
        priceField.put("type", "decimal");
        priceField.put("label", "订单总金额");
        priceField.put("priceSensitive", true);

        Map<String, Object> nonPriceField = new HashMap<>();
        nonPriceField.put("code", "orderNumber");
        nonPriceField.put("type", "string");
        nonPriceField.put("label", "订单号");

        Map<String, Object> schema = new HashMap<>();
        schema.put("fields", List.of(priceField, nonPriceField));

        Method m = null;
        for (Method candidate : FactoryConfigServiceImpl.class.getDeclaredMethods()) {
            if (candidate.getName().equals("buildEffectiveFields")
                    && candidate.getParameterCount() == 3) {
                m = candidate;
                break;
            }
        }
        if (m == null) {
            throw new IllegalStateException("buildEffectiveFields(3 params) method not found");
        }
        m.setAccessible(true);

        List<EffectiveField> result =
                (List<EffectiveField>) m.invoke(svc, schema, Map.of(), Map.of());

        assertEquals(2, result.size(), "Expected two fields in result");

        EffectiveField totalAmount = result.stream()
                .filter(f -> "totalAmount".equals(f.getCode()))
                .findFirst()
                .orElseThrow();
        assertTrue((Boolean) totalAmount.getExtra().get("priceSensitive"),
                "priceSensitive flag must be forwarded to EffectiveField.extra for fields that carry it");

        EffectiveField orderNumber = result.stream()
                .filter(f -> "orderNumber".equals(f.getCode()))
                .findFirst()
                .orElseThrow();
        assertNull(orderNumber.getExtra().get("priceSensitive"),
                "priceSensitive must NOT appear in extra for fields that don't carry the flag");
    }

    @Test
    @SuppressWarnings("unchecked")
    void buildEffectiveFields_priceSensitiveFalseAlsoForwarded() throws Exception {
        FactoryConfigServiceImpl svc = new FactoryConfigServiceImpl(null, null, null, null, null);

        Map<String, Object> field = new HashMap<>();
        field.put("code", "totalAmount");
        field.put("type", "decimal");
        field.put("label", "订单总金额");
        field.put("priceSensitive", false);

        Map<String, Object> schema = new HashMap<>();
        schema.put("fields", List.of(field));

        Method m = null;
        for (Method candidate : FactoryConfigServiceImpl.class.getDeclaredMethods()) {
            if (candidate.getName().equals("buildEffectiveFields")
                    && candidate.getParameterCount() == 3) {
                m = candidate;
                break;
            }
        }
        m.setAccessible(true);

        List<EffectiveField> result =
                (List<EffectiveField>) m.invoke(svc, schema, Map.of(), Map.of());

        assertEquals(1, result.size());
        assertEquals(Boolean.FALSE, result.get(0).getExtra().get("priceSensitive"),
                "Explicit priceSensitive=false must also flow through (not just true)");
    }
}

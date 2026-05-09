package com.cretas.aims.service.config;

import com.cretas.aims.dto.config.EffectiveField;
import com.cretas.aims.service.config.impl.FactoryConfigServiceImpl;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** T4 PR1: Verify autoGenerate flag is forwarded into EffectiveField.extra. */
class FactoryConfigAutoGenerateTest {

    @Test
    @SuppressWarnings("unchecked")
    void buildEffectiveFields_includesAutoGenerateInExtra() throws Exception {
        // R8 audit follow-up (R7 reviewer Q4): pre-existing tech debt — this test was
        // calling 0-arg ctor but FactoryConfigServiceImpl now requires 5 dependencies.
        // Reflection-only test (calls private buildEffectiveFields), so 5 nulls suffice —
        // the method under test doesn't touch any field via the instance.
        // 2026-05-09: production return type changed from List<Map> to List<EffectiveField>;
        // updated to call the new EffectiveField DTO accessor.
        FactoryConfigServiceImpl svc = new FactoryConfigServiceImpl(null, null, null, null, null);

        Map<String, Object> field = new HashMap<>();
        field.put("code", "orderNumber");
        field.put("type", "string");
        field.put("label", "订单号");
        field.put("autoGenerate", true);
        field.put("required", false);

        Map<String, Object> schema = new HashMap<>();
        schema.put("fields", List.of(field));

        // Locate buildEffectiveFields method via reflection (signature: 3 params)
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

        // Invoke with three map parameters: schema, effectiveFieldConfig, customLabels
        List<EffectiveField> result =
                (List<EffectiveField>) m.invoke(svc, schema, Map.of(), Map.of());

        assertEquals(1, result.size(), "Expected one field in result");
        Map<String, Object> extra = result.get(0).getExtra();
        assertTrue((Boolean) extra.get("autoGenerate"),
            "autoGenerate flag must be forwarded to EffectiveField.extra");
    }
}

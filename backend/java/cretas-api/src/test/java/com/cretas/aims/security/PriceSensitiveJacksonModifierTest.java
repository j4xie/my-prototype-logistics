package com.cretas.aims.security;

import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.inventory.SalesOrder;
import com.cretas.aims.entity.inventory.SalesOrderItem;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.module.SimpleModule;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Integration test for {@link PriceSensitiveSerializerModifier} — proves the
 * Jackson modifier short-circuits {@code @PriceSensitive} properties at the
 * <i>serialization layer</i>, independently of the Java-level defensive null
 * guards on the computed getters.
 *
 * <p>PR #443 follow-up F6 (audit doc Q7): the existing
 * {@link PriceFieldResponseAdviceTest} verifies that
 * {@code SalesOrder.getPayableAmount()} returns {@code null} <i>at the Java
 * level</i> after the advice strips fields and the defensive null guard
 * kicks in. That suite would pass even if the Jackson modifier was broken,
 * because the getter itself returns null. This suite proves the second
 * defensive layer (the modifier) works by:
 *
 * <ol>
 *   <li>Building an entity whose computed getters would return real values
 *       (not stripped) if invoked.</li>
 *   <li>Setting {@link PriceSensitiveContext#hide()} to simulate a
 *       warehouse_manager request.</li>
 *   <li>Serializing with a real {@link ObjectMapper} configured with the
 *       modifier.</li>
 *   <li>Asserting the JSON contains {@code null} for both
 *       {@code @PriceSensitive} fields AND {@code @PriceSensitive} methods —
 *       proving the modifier emitted {@code null} <b>without invoking the
 *       getter</b>.</li>
 * </ol>
 *
 * @author Cretas Team
 * @since 2026-05-12 (PR #443 follow-up F6)
 */
@DisplayName("PriceSensitiveSerializerModifier — Jackson short-circuit (F6)")
class PriceSensitiveJacksonModifierTest {

    private ObjectMapper mapper;

    @BeforeEach
    void setup() {
        // Always start clean — earlier tests may have leaked ThreadLocal state.
        PriceSensitiveContext.clear();

        // Build an ObjectMapper with our modifier installed — same wiring as
        // PriceSensitiveJacksonConfig#priceSensitiveJacksonModule produces in prod.
        mapper = new ObjectMapper();
        SimpleModule module = new SimpleModule("PriceSensitiveModule");
        module.setSerializerModifier(new PriceSensitiveSerializerModifier());
        mapper.registerModule(module);
        // Hibernate proxies aren't relevant here — we use fully-populated POJOs.
    }

    @AfterEach
    void teardown() {
        // Filter would do this in prod — tests mirror the contract.
        PriceSensitiveContext.clear();
    }

    // ───────── Helpers ─────────

    /** SalesOrder where every price field has a real (non-null) value. */
    private SalesOrder salesOrderWithRealPrices() {
        SalesOrder so = new SalesOrder();
        so.setId("so-1");
        so.setOrderNumber("SO-2026-001");
        so.setTotalAmount(new BigDecimal("5000.00"));
        so.setDiscountAmount(new BigDecimal("100.00"));
        so.setTaxAmount(new BigDecimal("650.00"));

        SalesOrderItem item = new SalesOrderItem();
        item.setId(1L);
        item.setProductName("青花椒成品");
        item.setQuantity(new BigDecimal("50.0000"));
        item.setUnitPrice(new BigDecimal("100.0000"));
        item.setCostUnitPrice(new BigDecimal("80.0000"));
        so.setItems(Arrays.asList(item));
        return so;
    }

    // ───────── Tests ─────────

    @Test
    @DisplayName("hide=true: SalesOrder @PriceSensitive fields emit null in JSON")
    void hideFlag_stripsFields() throws Exception {
        PriceSensitiveContext.hide();

        SalesOrder so = salesOrderWithRealPrices();
        String json = mapper.writeValueAsString(so);
        JsonNode root = mapper.readTree(json);

        assertTrue(root.has("totalAmount"), "totalAmount key must be present (Jackson emits explicit null)");
        assertTrue(root.get("totalAmount").isNull(), "totalAmount emitted null: " + json);
        assertTrue(root.get("discountAmount").isNull(), "discountAmount emitted null");
        assertTrue(root.get("taxAmount").isNull(), "taxAmount emitted null");

        // Non-price fields preserved
        assertEquals("SO-2026-001", root.get("orderNumber").asText());
    }

    @Test
    @DisplayName("hide=true: SalesOrder.getPayableAmount() (method-target @PriceSensitive) emits null WITHOUT invoking getter")
    void hideFlag_shortsCircuitsComputedGetter_withoutInvocation() throws Exception {
        PriceSensitiveContext.hide();

        SalesOrder so = salesOrderWithRealPrices();
        // Key: totalAmount is still set to 5000.00 on the Java object —
        // we did NOT call the field-strip advice. If the modifier
        // were broken, getPayableAmount() would be invoked and return
        // 5000 - 100 + 650 = 5550. With the modifier, it must emit null
        // because shouldHide=true.
        assertEquals(new BigDecimal("5550.00"), so.getPayableAmount(),
                "precondition: getter returns real value when not stripped at Java level");

        String json = mapper.writeValueAsString(so);
        JsonNode root = mapper.readTree(json);

        // The @PriceSensitive method getPayableAmount → JSON key "payableAmount".
        assertTrue(root.has("payableAmount"), "payableAmount key emitted: " + json);
        assertTrue(root.get("payableAmount").isNull(),
                "modifier short-circuits — JSON null even though getter would return 5550.00");
    }

    @Test
    @DisplayName("hide=true: SalesOrderItem computed getters (getLineAmount/getCostTotal) emit null at serialization")
    void hideFlag_salesOrderItem_methodGetters_emitNull() throws Exception {
        PriceSensitiveContext.hide();

        SalesOrderItem item = new SalesOrderItem();
        item.setId(1L);
        item.setProductName("青花椒成品");
        item.setQuantity(new BigDecimal("50.0000"));
        item.setUnitPrice(new BigDecimal("100.0000"));
        item.setCostUnitPrice(new BigDecimal("80.0000"));
        item.setTaxRate(new BigDecimal("13.00"));
        item.setDiscountRate(new BigDecimal("5.00"));

        String json = mapper.writeValueAsString(item);
        JsonNode root = mapper.readTree(json);

        assertTrue(root.get("unitPrice").isNull(), "unitPrice null");
        assertTrue(root.get("costUnitPrice").isNull(), "costUnitPrice null");
        assertTrue(root.get("lineAmount").isNull(), "lineAmount (method) null: " + json);
        assertTrue(root.get("costTotal").isNull(), "costTotal (method) null: " + json);
        // Non-price preserved
        assertEquals("青花椒成品", root.get("productName").asText());
    }

    @Test
    @DisplayName("hide=true: MaterialBatch.getTotalCost() (F3 follow-up) emits null at serialization")
    void hideFlag_materialBatch_getTotalCost_emitNull() throws Exception {
        PriceSensitiveContext.hide();

        MaterialBatch batch = new MaterialBatch();
        batch.setId("batch-1");
        batch.setBatchNumber("BATCH-001");
        batch.setUnitPrice(new BigDecimal("88.88"));
        batch.setReceiptQuantity(new BigDecimal("10.00"));

        // Precondition: getTotalCost() returns real value before strip
        // (delegates to getTotalPrice = unitPrice * receiptQuantity).
        // BigDecimal multiplication scale = sum of operand scales = 4.
        assertEquals(0, batch.getTotalCost().compareTo(new BigDecimal("888.80")),
                "precondition: getTotalCost ≈ 888.80 (88.88 × 10.00)");

        String json = mapper.writeValueAsString(batch);
        JsonNode root = mapper.readTree(json);

        assertTrue(root.get("unitPrice").isNull(), "unitPrice field null");
        // F3: getTotalCost @PriceSensitive — emits null via modifier short-circuit
        assertTrue(root.has("totalCost"), "totalCost key emitted");
        assertTrue(root.get("totalCost").isNull(),
                "MaterialBatch.getTotalCost short-circuited at Jackson layer (F3): " + json);
        // Sister getters also null (already annotated in PR #443)
        assertTrue(root.get("totalPrice").isNull(), "totalPrice null");
        assertTrue(root.get("totalValue").isNull(), "totalValue null");
    }

    @Test
    @DisplayName("hide=false (default ThreadLocal): all real values emitted, no short-circuit")
    void hideUnset_allValuesPreserved() throws Exception {
        // Default — ThreadLocal not set, shouldHide returns false.
        // Use BigDecimal.compareTo for scale-tolerant comparisons since Jackson's
        // BigDecimal-as-number serialization may normalize trailing zeros across
        // the JSON round-trip.

        SalesOrder so = salesOrderWithRealPrices();
        String json = mapper.writeValueAsString(so);
        JsonNode root = mapper.readTree(json);

        assertEquals(0, root.get("totalAmount").decimalValue().compareTo(new BigDecimal("5000")),
                "totalAmount preserved when hide flag not set: " + json);
        assertEquals(0, root.get("payableAmount").decimalValue().compareTo(new BigDecimal("5550")),
                "payableAmount real computed value (5000 - 100 + 650): " + json);
        assertNotNull(root.get("items"));
        JsonNode item0 = root.get("items").get(0);
        assertEquals(0, item0.get("unitPrice").decimalValue().compareTo(new BigDecimal("100")),
                "item.unitPrice preserved");
        assertEquals(0, item0.get("lineAmount").decimalValue().compareTo(new BigDecimal("5000")),
                "item.lineAmount (method) computed real value: " + json);
    }
}

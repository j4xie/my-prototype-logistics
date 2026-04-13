package com.cretas.aims.event;

import com.cretas.aims.engine.TriggerChainExecutor;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Round 10 Task 3 — verifies the MaterialBatchCreatedEvent wiring:
 * <ol>
 *   <li>the event class populates every downstream field correctly, and</li>
 *   <li>TriggerChainExecutor.HANDLED_EVENTS contains "MaterialBatchCreatedEvent"
 *       so factory-configured trigger chains on the event will actually fire.</li>
 * </ol>
 *
 * <p>Without the second assertion, a refactor that removes the whitelist entry
 * would silently break customer trigger chains and the failure would only be
 * visible in prod logs.</p>
 */
class MaterialBatchCreatedEventTest {

    @Test
    void constructor_populatesAllFields() {
        Object source = new Object();
        BigDecimal qty = new BigDecimal("12.500");

        MaterialBatchCreatedEvent event = new MaterialBatchCreatedEvent(
                source, "F001", "batch-1", "BN-2026-0001",
                "mt-tomato", qty, "purchase_receive", "po-9");

        assertEquals(source, event.getSource());
        assertEquals("F001", event.getFactoryId());
        assertEquals("batch-1", event.getBatchId());
        assertEquals("BN-2026-0001", event.getBatchNumber());
        assertEquals("mt-tomato", event.getMaterialTypeId());
        assertEquals(qty, event.getReceiptQuantity());
        assertEquals("purchase_receive", event.getSourceDocType());
        assertEquals("po-9", event.getSourceDocId());
        assertNotNull(event.getCreatedAt());
    }

    @Test
    @SuppressWarnings("unchecked")
    void triggerChainExecutor_whitelist_includesThisEvent() throws Exception {
        Field handledEvents = TriggerChainExecutor.class.getDeclaredField("HANDLED_EVENTS");
        handledEvents.setAccessible(true);
        Set<String> events = (Set<String>) handledEvents.get(null);

        assertTrue(events.contains("MaterialBatchCreatedEvent"),
                "TriggerChainExecutor.HANDLED_EVENTS must include 'MaterialBatchCreatedEvent' "
                        + "for Round 10 Canvas Integration Template to work. Without this, "
                        + "factory-configured trigger chains on material_batch module will "
                        + "silently never fire.");
    }
}

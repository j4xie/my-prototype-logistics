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
 * Round 11 T1 — verifies the PurchaseReceiveCreatedEvent wiring:
 * <ol>
 *   <li>the event class populates every downstream field correctly, and</li>
 *   <li>TriggerChainExecutor.HANDLED_EVENTS contains "PurchaseReceiveCreatedEvent"
 *       so factory-configured trigger chains on the event will actually fire.</li>
 * </ol>
 *
 * <p>A refactor that removes the whitelist entry would silently break customer
 * trigger chains configured on this event — only this test catches it at build time.</p>
 */
class PurchaseReceiveCreatedEventTest {

    @Test
    void constructor_populatesAllFields() {
        Object source = new Object();
        BigDecimal total = new BigDecimal("12500.50");

        PurchaseReceiveCreatedEvent event = new PurchaseReceiveCreatedEvent(
                source, "F001", "rcv-1", "RCV-20260411-001",
                "supplier-77", "po-42", total);

        assertEquals(source, event.getSource());
        assertEquals("F001", event.getFactoryId());
        assertEquals("rcv-1", event.getReceiveRecordId());
        assertEquals("RCV-20260411-001", event.getReceiveNumber());
        assertEquals("supplier-77", event.getSupplierId());
        assertEquals("po-42", event.getPurchaseOrderId());
        assertEquals(total, event.getTotalAmount());
        assertNotNull(event.getCreatedAt());
    }

    @Test
    @SuppressWarnings("unchecked")
    void triggerChainExecutor_whitelist_includesThisEvent() throws Exception {
        Field handledEvents = TriggerChainExecutor.class.getDeclaredField("HANDLED_EVENTS");
        handledEvents.setAccessible(true);
        Set<String> events = (Set<String>) handledEvents.get(null);

        assertTrue(events.contains("PurchaseReceiveCreatedEvent"),
                "TriggerChainExecutor.HANDLED_EVENTS must include 'PurchaseReceiveCreatedEvent' "
                        + "for Round 11 T1 Canvas Integration Template to work. Without this, "
                        + "factory-configured trigger chains on the purchase_receipt module "
                        + "will silently never fire.");
    }
}

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
 * Round 11 T2 — verifies the ReturnOrderCreatedEvent wiring:
 * <ol>
 *   <li>the event class populates every downstream field correctly, and</li>
 *   <li>TriggerChainExecutor.HANDLED_EVENTS contains "ReturnOrderCreatedEvent"
 *       so factory-configured trigger chains on the event will fire.</li>
 * </ol>
 */
class ReturnOrderCreatedEventTest {

    @Test
    void constructor_populatesAllFields() {
        Object source = new Object();
        BigDecimal total = new BigDecimal("980.00");

        ReturnOrderCreatedEvent event = new ReturnOrderCreatedEvent(
                source, "F001", "ro-5", "RT-SAL-20260411-003",
                "SALES_RETURN", "customer-88", "so-12", total);

        assertEquals(source, event.getSource());
        assertEquals("F001", event.getFactoryId());
        assertEquals("ro-5", event.getReturnOrderId());
        assertEquals("RT-SAL-20260411-003", event.getReturnNumber());
        assertEquals("SALES_RETURN", event.getReturnType());
        assertEquals("customer-88", event.getCounterpartyId());
        assertEquals("so-12", event.getSourceOrderId());
        assertEquals(total, event.getTotalAmount());
        assertNotNull(event.getCreatedAt());
    }

    @Test
    @SuppressWarnings("unchecked")
    void triggerChainExecutor_whitelist_includesThisEvent() throws Exception {
        Field handledEvents = TriggerChainExecutor.class.getDeclaredField("HANDLED_EVENTS");
        handledEvents.setAccessible(true);
        Set<String> events = (Set<String>) handledEvents.get(null);

        assertTrue(events.contains("ReturnOrderCreatedEvent"),
                "TriggerChainExecutor.HANDLED_EVENTS must include 'ReturnOrderCreatedEvent' "
                        + "for Round 11 T2 Canvas Integration Template to work. Without this, "
                        + "factory-configured trigger chains on the sales_return / purchase_return "
                        + "module will silently never fire.");
    }
}

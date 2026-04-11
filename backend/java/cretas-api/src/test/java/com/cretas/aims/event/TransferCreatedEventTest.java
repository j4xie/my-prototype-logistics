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
 * Round 11 T4 — verifies the TransferCreatedEvent wiring:
 * <ol>
 *   <li>the event class populates every downstream field correctly,</li>
 *   <li>the {@code getFactoryId} alias returns the source factory (for
 *       TriggerChainExecutor normalization), and</li>
 *   <li>TriggerChainExecutor.HANDLED_EVENTS contains "TransferCreatedEvent".</li>
 * </ol>
 */
class TransferCreatedEventTest {

    @Test
    void constructor_populatesAllFields() {
        Object source = new Object();
        BigDecimal total = new BigDecimal("3800.00");

        TransferCreatedEvent event = new TransferCreatedEvent(
                source, "F001", "F002",
                "tr-9", "TR-20260411-001", "INTER_FACTORY",
                "wh-a", "wh-b", total);

        assertEquals(source, event.getSource());
        assertEquals("F001", event.getSourceFactoryId());
        assertEquals("F002", event.getTargetFactoryId());
        assertEquals("tr-9", event.getTransferId());
        assertEquals("TR-20260411-001", event.getTransferNumber());
        assertEquals("INTER_FACTORY", event.getTransferType());
        assertEquals("wh-a", event.getSourceWarehouseId());
        assertEquals("wh-b", event.getTargetWarehouseId());
        assertEquals(total, event.getTotalAmount());
        assertNotNull(event.getCreatedAt());
    }

    @Test
    void getFactoryId_returnsSourceFactory() {
        // TriggerChainExecutor normalizes events via getFactoryId. For transfers
        // the trigger chain lives on the source factory (originator).
        TransferCreatedEvent event = new TransferCreatedEvent(
                new Object(), "F001", "F002", "tr-1", "TR-1", "INTER_FACTORY",
                null, null, BigDecimal.ZERO);
        assertEquals("F001", event.getFactoryId());
    }

    @Test
    @SuppressWarnings("unchecked")
    void triggerChainExecutor_whitelist_includesThisEvent() throws Exception {
        Field handledEvents = TriggerChainExecutor.class.getDeclaredField("HANDLED_EVENTS");
        handledEvents.setAccessible(true);
        Set<String> events = (Set<String>) handledEvents.get(null);

        assertTrue(events.contains("TransferCreatedEvent"),
                "TriggerChainExecutor.HANDLED_EVENTS must include 'TransferCreatedEvent' "
                        + "for Round 11 T4 Canvas Integration Template to work. Without this, "
                        + "factory-configured trigger chains on the transfer module will "
                        + "silently never fire.");
    }
}

package com.cretas.aims.event;

import com.cretas.aims.engine.TriggerChainExecutor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class Round12EventsTest {

    @ParameterizedTest
    @ValueSource(strings = {
            "ShipmentCreatedEvent",
            "ProductionStartedEvent",
            "ProductionCompletedEvent",
            "BatchMaterialConsumedEvent"
    })
    @SuppressWarnings("unchecked")
    void handledEvents_containsRound12Event(String eventName) throws Exception {
        Field f = TriggerChainExecutor.class.getDeclaredField("HANDLED_EVENTS");
        f.setAccessible(true);
        Set<String> events = (Set<String>) f.get(null);
        assertTrue(events.contains(eventName),
                eventName + " must be in HANDLED_EVENTS for trigger chains to fire");
    }

    @Test
    void shipmentCreatedEvent_constructor() {
        ShipmentCreatedEvent e = new ShipmentCreatedEvent(
                this, "F1", "sh-1", "SH-001", "cust-1", "SO-1",
                new BigDecimal("100"), new BigDecimal("5000"));
        assertEquals("F1", e.getFactoryId());
        assertEquals("sh-1", e.getShipmentId());
        assertNotNull(e.getCreatedAt());
    }

    @Test
    void productionStartedEvent_constructor() {
        ProductionStartedEvent e = new ProductionStartedEvent(
                this, "F1", "pp-1", "PP-001", "pt-1");
        assertEquals("F1", e.getFactoryId());
        assertEquals("pp-1", e.getPlanId());
    }

    @Test
    void productionCompletedEvent_constructor() {
        ProductionCompletedEvent e = new ProductionCompletedEvent(
                this, "F1", "pp-1", "PP-001", "pt-1", new BigDecimal("500"));
        assertEquals(new BigDecimal("500"), e.getActualQuantity());
    }

    @Test
    void batchMaterialConsumedEvent_constructor() {
        BatchMaterialConsumedEvent e = new BatchMaterialConsumedEvent(
                this, "F1", "batch-1", new BigDecimal("25"), "pp-1");
        assertEquals("batch-1", e.getBatchId());
        assertEquals(new BigDecimal("25"), e.getConsumedQuantity());
    }
}

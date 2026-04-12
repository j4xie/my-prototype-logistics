package com.cretas.aims.event;

import com.cretas.aims.engine.TriggerChainExecutor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class Round13EventsTest {

    @ParameterizedTest
    @ValueSource(strings = {"InvoiceRequestedEvent", "WorkReportSubmittedEvent"})
    @SuppressWarnings("unchecked")
    void handledEvents_containsRound13Event(String eventName) throws Exception {
        Field f = TriggerChainExecutor.class.getDeclaredField("HANDLED_EVENTS");
        f.setAccessible(true);
        Set<String> events = (Set<String>) f.get(null);
        assertTrue(events.contains(eventName),
                eventName + " must be in HANDLED_EVENTS");
    }

    @Test
    void invoiceRequestedEvent_constructor() {
        InvoiceRequestedEvent e = new InvoiceRequestedEvent(
                this, "F1", "inv-1", "so-1", new BigDecimal("10000"));
        assertEquals("F1", e.getFactoryId());
        assertEquals("inv-1", e.getInvoiceId());
        assertEquals("so-1", e.getSalesOrderId());
        assertNotNull(e.getCreatedAt());
    }

    @Test
    void workReportSubmittedEvent_constructor() {
        WorkReportSubmittedEvent e = new WorkReportSubmittedEvent(
                this, "F1", "task-1", "report-1", 42L);
        assertEquals("F1", e.getFactoryId());
        assertEquals("task-1", e.getProcessTaskId());
        assertEquals(42L, e.getReportedBy());
    }
}

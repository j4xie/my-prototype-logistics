package com.cretas.aims.entity.workreport;

import com.cretas.aims.entity.workreport.EmployeeProcessSegment.CheckoutReason;
import com.cretas.aims.entity.workreport.EmployeeProcessSegment.SegmentStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * P1-1 员工工序片段 schema test (欠退扫码数据模型).
 */
@DisplayName("EmployeeProcessSegment schema (P1-1)")
class EmployeeProcessSegmentSchemaTest {

    @Test
    void shouldHaveFactoryIdAndEmployeeId() {
        assertDoesNotThrow(() -> EmployeeProcessSegment.class.getDeclaredField("factoryId"));
        assertDoesNotThrow(() -> EmployeeProcessSegment.class.getDeclaredField("employeeId"));
    }

    @Test
    void shouldHaveWorkTypeAndProcess() {
        assertDoesNotThrow(() -> EmployeeProcessSegment.class.getDeclaredField("workTypeId"));
        assertDoesNotThrow(() -> EmployeeProcessSegment.class.getDeclaredField("processId"));
        assertDoesNotThrow(() -> EmployeeProcessSegment.class.getDeclaredField("batchId"));
    }

    @Test
    void shouldHaveStartAndEnd() {
        assertDoesNotThrow(() -> EmployeeProcessSegment.class.getDeclaredField("startAt"));
        assertDoesNotThrow(() -> EmployeeProcessSegment.class.getDeclaredField("endAt"));
    }

    @Test
    void shouldHaveStatusAndCheckoutReason() {
        assertDoesNotThrow(() -> EmployeeProcessSegment.class.getDeclaredField("status"));
        assertDoesNotThrow(() -> EmployeeProcessSegment.class.getDeclaredField("checkoutReason"));
    }

    @Test
    void segmentStatus_shouldHaveFourValues() {
        // ACTIVE + CLOSED_NORMAL + CLOSED_EARLY + CLOSED_SWITCH
        assertEquals(4, SegmentStatus.values().length);
    }

    @Test
    void checkoutReason_shouldHaveFiveValues() {
        // END_OF_SHIFT + EARLY_LEAVE + WORK_TYPE_SWITCH + BATCH_DONE + INCIDENT
        assertEquals(5, CheckoutReason.values().length);
    }
}

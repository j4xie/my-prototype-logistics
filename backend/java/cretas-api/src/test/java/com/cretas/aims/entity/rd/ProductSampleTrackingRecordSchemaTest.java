package com.cretas.aims.entity.rd;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

/**
 * P1-8 研发样品追踪记录 schema test.
 */
@DisplayName("ProductSampleTrackingRecord schema (P1-8)")
class ProductSampleTrackingRecordSchemaTest {

    @Test
    void shouldHaveFactoryId() {
        assertDoesNotThrow(() -> ProductSampleTrackingRecord.class.getDeclaredField("factoryId"));
    }

    @Test
    void shouldHaveSampleId() {
        assertDoesNotThrow(() -> ProductSampleTrackingRecord.class.getDeclaredField("sampleId"));
    }

    @Test
    void shouldHaveRecordedAt() {
        assertDoesNotThrow(() -> ProductSampleTrackingRecord.class.getDeclaredField("recordedAt"));
    }

    @Test
    void shouldHaveContent() {
        assertDoesNotThrow(() -> ProductSampleTrackingRecord.class.getDeclaredField("content"));
    }

    @Test
    void shouldHaveAttachmentUrl() {
        assertDoesNotThrow(() -> ProductSampleTrackingRecord.class.getDeclaredField("attachmentUrl"));
    }

    @Test
    void shouldHaveRecordedBy() {
        assertDoesNotThrow(() -> ProductSampleTrackingRecord.class.getDeclaredField("recordedBy"));
    }
}

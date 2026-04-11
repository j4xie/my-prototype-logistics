package com.cretas.aims.entity.rd;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

/**
 * 研发样品 Round 3 字段补齐 — 对照客户截图 14:09 (t014m09s_0047_s.jpg).
 *
 * <p>V20260407_03 补齐 8+4 字段 (V3 Round 2 Agent A), 但客户截图里还缺 6 个:
 * <ul>
 *   <li>productQuotePrice — 成品报价</li>
 *   <li>materialPrice — 原料价格</li>
 *   <li>processingFee — 加工费</li>
 *   <li>mainMaterialInfo — 主原料信息 (详细描述, 区别于 mainMaterial 字段的名称)</li>
 *   <li>mainMaterialYieldRate — 主要原料出成率 (百分比)</li>
 *   <li>mainMaterialImages — 主原料图片 (JSON array of URLs)</li>
 * </ul>
 */
@DisplayName("ProductSample Round 3 字段补齐 (v1 截图 14:09)")
class ProductSampleRound3FieldsTest {

    @Test
    void shouldHaveProductQuotePrice() {
        assertDoesNotThrow(() -> ProductSample.class.getDeclaredField("productQuotePrice"));
    }

    @Test
    void shouldHaveMaterialPrice() {
        assertDoesNotThrow(() -> ProductSample.class.getDeclaredField("materialPrice"));
    }

    @Test
    void shouldHaveProcessingFee() {
        assertDoesNotThrow(() -> ProductSample.class.getDeclaredField("processingFee"));
    }

    @Test
    void shouldHaveMainMaterialInfo() {
        assertDoesNotThrow(() -> ProductSample.class.getDeclaredField("mainMaterialInfo"));
    }

    @Test
    void shouldHaveMainMaterialYieldRate() {
        assertDoesNotThrow(() -> ProductSample.class.getDeclaredField("mainMaterialYieldRate"));
    }

    @Test
    void shouldHaveMainMaterialImages() {
        assertDoesNotThrow(() -> ProductSample.class.getDeclaredField("mainMaterialImages"));
    }
}

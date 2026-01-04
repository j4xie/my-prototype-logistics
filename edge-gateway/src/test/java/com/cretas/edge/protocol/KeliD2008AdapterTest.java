package com.cretas.edge.protocol;

import com.cretas.edge.model.ScaleReading;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 柯力 D2008 协议适配器测试
 */
class KeliD2008AdapterTest {

    private KeliD2008Adapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new KeliD2008Adapter();
    }

    @Test
    @DisplayName("协议名称应该是 KELI_D2008")
    void testProtocolName() {
        assertEquals("KELI_D2008", adapter.getProtocolName());
    }

    @Test
    @DisplayName("解析有效的称重数据帧")
    void testParseValidFrame() {
        // 模拟数据帧: STX + "ST  123.45kg" + ETX
        byte[] data = {
                0x02,                                   // STX
                'S', 'T',                               // 状态：稳定
                ' ', ' ',                               // 空格
                '1', '2', '3', '.', '4', '5',           // 重量值
                'k', 'g',                               // 单位
                0x03                                    // ETX
        };

        Optional<ScaleReading> result = adapter.parse(data);

        assertTrue(result.isPresent());
        ScaleReading reading = result.get();
        assertTrue(reading.isStable());
        assertEquals("kg", reading.getWeightUnit());
        // 123.45 kg = 123450 g
        assertEquals(0, new BigDecimal("123450").compareTo(reading.getWeightGrams()));
    }

    @Test
    @DisplayName("验证有效帧")
    void testIsValidFrame() {
        byte[] validFrame = {0x02, 'S', 'T', ' ', '1', '0', '0', 'g', 0x03};
        assertTrue(adapter.isValidFrame(validFrame));

        byte[] invalidFrame = {0x01, 'S', 'T', ' ', '1', '0', '0', 'g', 0x03};
        assertFalse(adapter.isValidFrame(invalidFrame));
    }

    @Test
    @DisplayName("查找帧结束位置")
    void testFindFrameEnd() {
        byte[] data = {0x02, 'S', 'T', ' ', '1', '0', '0', 'g', 0x03, 0x00};

        int frameEnd = adapter.findFrameEnd(data);
        assertEquals(10, frameEnd); // 包含 BCC 位置
    }

    @Test
    @DisplayName("协议不需要轮询")
    void testRequiresPolling() {
        assertFalse(adapter.requiresPolling());
    }
}

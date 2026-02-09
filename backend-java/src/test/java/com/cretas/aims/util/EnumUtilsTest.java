package com.cretas.aims.util;

import com.cretas.aims.entity.common.UnifiedDeviceType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * EnumUtils 工具类单元测试
 *
 * 测试覆盖:
 * - 有效枚举名转换 (UT-CONV-001)
 * - 无效枚举名带默认值 (UT-CONV-002)
 * - 无效枚举名无默认值 (UT-CONV-003)
 * - null 输入 (UT-CONV-004)
 * - 空字符串 (UT-CONV-005)
 * - 大小写不敏感 (UT-CONV-006)
 * - 带空格处理 (UT-CONV-007)
 *
 * @author Cretas Team
 * @since 2026-01-06
 */
@DisplayName("EnumUtils 工具类测试")
class EnumUtilsTest {

    // 测试用枚举 - 使用 UnifiedDeviceType
    private static final Class<UnifiedDeviceType> ENUM_CLASS = UnifiedDeviceType.class;

    // ==================== valueOf() 带默认值测试 ====================

    @Nested
    @DisplayName("valueOf() 带默认值方法测试")
    class ValueOfWithDefaultTests {

        @Test
        @DisplayName("UT-CONV-001: 有效枚举名转换")
        void testValidEnumNameConversion() {
            UnifiedDeviceType result = EnumUtils.valueOf(ENUM_CLASS, "SCALE", UnifiedDeviceType.TRADITIONAL);
            assertEquals(UnifiedDeviceType.SCALE, result);
        }

        @Test
        @DisplayName("UT-CONV-002: 无效枚举名返回默认值")
        void testInvalidEnumNameReturnsDefault() {
            UnifiedDeviceType result = EnumUtils.valueOf(ENUM_CLASS, "INVALID", UnifiedDeviceType.TRADITIONAL);
            assertEquals(UnifiedDeviceType.TRADITIONAL, result);
        }

        @Test
        @DisplayName("UT-CONV-004: null 输入返回默认值")
        void testNullInputReturnsDefault() {
            UnifiedDeviceType result = EnumUtils.valueOf(ENUM_CLASS, null, UnifiedDeviceType.TRADITIONAL);
            assertEquals(UnifiedDeviceType.TRADITIONAL, result);
        }

        @Test
        @DisplayName("UT-CONV-005: 空字符串返回默认值")
        void testEmptyStringReturnsDefault() {
            UnifiedDeviceType result = EnumUtils.valueOf(ENUM_CLASS, "", UnifiedDeviceType.TRADITIONAL);
            assertEquals(UnifiedDeviceType.TRADITIONAL, result);
        }

        @Test
        @DisplayName("UT-CONV-006: 大小写不敏感")
        void testCaseInsensitive() {
            assertEquals(UnifiedDeviceType.SCALE, EnumUtils.valueOf(ENUM_CLASS, "scale", UnifiedDeviceType.TRADITIONAL));
            assertEquals(UnifiedDeviceType.SCALE, EnumUtils.valueOf(ENUM_CLASS, "Scale", UnifiedDeviceType.TRADITIONAL));
            assertEquals(UnifiedDeviceType.SCALE, EnumUtils.valueOf(ENUM_CLASS, "SCALE", UnifiedDeviceType.TRADITIONAL));
        }

        @Test
        @DisplayName("UT-CONV-007: 带空格处理")
        void testTrimWhitespace() {
            assertEquals(UnifiedDeviceType.SCALE, EnumUtils.valueOf(ENUM_CLASS, " SCALE ", UnifiedDeviceType.TRADITIONAL));
            assertEquals(UnifiedDeviceType.SCALE, EnumUtils.valueOf(ENUM_CLASS, "  scale  ", UnifiedDeviceType.TRADITIONAL));
        }

        @Test
        @DisplayName("支持下划线和横杠互换")
        void testUnderscoreAndHyphenInterchange() {
            // CAMERA_IPC 可以用 CAMERA-IPC 匹配
            assertEquals(UnifiedDeviceType.CAMERA_IPC, EnumUtils.valueOf(ENUM_CLASS, "CAMERA-IPC", UnifiedDeviceType.TRADITIONAL));
        }
    }

    // ==================== safeValueOf() Optional 返回测试 ====================

    @Nested
    @DisplayName("safeValueOf() Optional 返回测试")
    class SafeValueOfTests {

        @Test
        @DisplayName("UT-CONV-003: 无效枚举名返回 Optional.empty()")
        void testInvalidEnumNameReturnsEmpty() {
            Optional<UnifiedDeviceType> result = EnumUtils.safeValueOf(ENUM_CLASS, "INVALID");
            assertTrue(result.isEmpty());
        }

        @Test
        @DisplayName("有效枚举名返回 Optional 包装值")
        void testValidEnumNameReturnsOptional() {
            Optional<UnifiedDeviceType> result = EnumUtils.safeValueOf(ENUM_CLASS, "SCALE");
            assertTrue(result.isPresent());
            assertEquals(UnifiedDeviceType.SCALE, result.get());
        }

        @ParameterizedTest
        @DisplayName("null 和空字符串返回 Optional.empty()")
        @NullAndEmptySource
        void testNullAndEmptyReturnsEmpty(String input) {
            Optional<UnifiedDeviceType> result = EnumUtils.safeValueOf(ENUM_CLASS, input);
            assertTrue(result.isEmpty());
        }
    }

    // ==================== valueOfOrThrow() 异常测试 ====================

    @Nested
    @DisplayName("valueOfOrThrow() 异常测试")
    class ValueOfOrThrowTests {

        @Test
        @DisplayName("有效枚举名正常返回")
        void testValidEnumNameReturns() {
            UnifiedDeviceType result = EnumUtils.valueOfOrThrow(ENUM_CLASS, "SCALE");
            assertEquals(UnifiedDeviceType.SCALE, result);
        }

        @Test
        @DisplayName("无效枚举名抛出 IllegalArgumentException")
        void testInvalidEnumNameThrows() {
            IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> EnumUtils.valueOfOrThrow(ENUM_CLASS, "INVALID")
            );
            assertTrue(exception.getMessage().contains("INVALID"));
            assertTrue(exception.getMessage().contains("Available values"));
        }
    }

    // ==================== fuzzyMatch() 模糊匹配测试 ====================

    @Nested
    @DisplayName("fuzzyMatch() 模糊匹配测试")
    class FuzzyMatchTests {

        @Test
        @DisplayName("精确匹配")
        void testExactMatch() {
            Optional<UnifiedDeviceType> result = EnumUtils.fuzzyMatch(ENUM_CLASS, "SCALE");
            assertTrue(result.isPresent());
            assertEquals(UnifiedDeviceType.SCALE, result.get());
        }

        @Test
        @DisplayName("忽略非字母数字字符")
        void testIgnoreNonAlphanumeric() {
            // normalizeForMatching 会移除非字母数字字符
            Optional<UnifiedDeviceType> result = EnumUtils.fuzzyMatch(ENUM_CLASS, "camera-ipc");
            assertTrue(result.isPresent());
            assertEquals(UnifiedDeviceType.CAMERA_IPC, result.get());
        }

        @Test
        @DisplayName("部分匹配")
        void testPartialMatch() {
            // 包含 "camera" 应该能匹配到某个 CAMERA_* 类型
            Optional<UnifiedDeviceType> result = EnumUtils.fuzzyMatch(ENUM_CLASS, "cameraipc");
            assertTrue(result.isPresent());
            assertTrue(result.get().isCameraDevice());
        }

        @ParameterizedTest
        @DisplayName("null 和空字符串返回 empty")
        @NullAndEmptySource
        void testNullAndEmptyReturnsEmpty(String input) {
            Optional<UnifiedDeviceType> result = EnumUtils.fuzzyMatch(ENUM_CLASS, input);
            assertTrue(result.isEmpty());
        }
    }

    // ==================== 批量转换测试 ====================

    @Nested
    @DisplayName("批量转换测试")
    class BatchConversionTests {

        @Test
        @DisplayName("valuesOf() 批量转换有效值")
        void testValuesOfValidInputs() {
            List<String> inputs = Arrays.asList("SCALE", "SENSOR", "GATEWAY");
            List<UnifiedDeviceType> results = EnumUtils.valuesOf(ENUM_CLASS, inputs);

            assertEquals(3, results.size());
            assertTrue(results.contains(UnifiedDeviceType.SCALE));
            assertTrue(results.contains(UnifiedDeviceType.SENSOR));
            assertTrue(results.contains(UnifiedDeviceType.GATEWAY));
        }

        @Test
        @DisplayName("valuesOf() 跳过无效值")
        void testValuesOfSkipsInvalidValues() {
            List<String> inputs = Arrays.asList("SCALE", "INVALID", "SENSOR");
            List<UnifiedDeviceType> results = EnumUtils.valuesOf(ENUM_CLASS, inputs);

            assertEquals(2, results.size());
            assertTrue(results.contains(UnifiedDeviceType.SCALE));
            assertTrue(results.contains(UnifiedDeviceType.SENSOR));
        }

        @Test
        @DisplayName("valuesOf() 空集合返回空列表")
        void testValuesOfEmptyCollection() {
            List<UnifiedDeviceType> results = EnumUtils.valuesOf(ENUM_CLASS, Arrays.asList());
            assertTrue(results.isEmpty());
        }

        @Test
        @DisplayName("valuesOf() null 集合返回空列表")
        void testValuesOfNullCollection() {
            List<UnifiedDeviceType> results = EnumUtils.valuesOf(ENUM_CLASS, null);
            assertTrue(results.isEmpty());
        }

        @Test
        @DisplayName("fromCsv() 逗号分隔转换")
        void testFromCsv() {
            List<UnifiedDeviceType> results = EnumUtils.fromCsv(ENUM_CLASS, "SCALE,SENSOR,GATEWAY");

            assertEquals(3, results.size());
            assertTrue(results.contains(UnifiedDeviceType.SCALE));
            assertTrue(results.contains(UnifiedDeviceType.SENSOR));
            assertTrue(results.contains(UnifiedDeviceType.GATEWAY));
        }

        @Test
        @DisplayName("fromCsv() 空字符串返回空列表")
        void testFromCsvEmptyString() {
            List<UnifiedDeviceType> results = EnumUtils.fromCsv(ENUM_CLASS, "");
            assertTrue(results.isEmpty());
        }
    }

    // ==================== 查询方法测试 ====================

    @Nested
    @DisplayName("查询方法测试")
    class QueryMethodsTests {

        @Test
        @DisplayName("getEnumNames() 返回所有枚举名")
        void testGetEnumNames() {
            Set<String> names = EnumUtils.getEnumNames(ENUM_CLASS);

            assertTrue(names.contains("SCALE"));
            assertTrue(names.contains("CAMERA_IPC"));
            assertTrue(names.contains("TRADITIONAL"));
            assertEquals(UnifiedDeviceType.values().length, names.size());
        }

        @Test
        @DisplayName("getAll() 返回所有枚举值")
        void testGetAll() {
            List<UnifiedDeviceType> all = EnumUtils.getAll(ENUM_CLASS);
            assertEquals(UnifiedDeviceType.values().length, all.size());
        }

        @Test
        @DisplayName("isValid() 验证有效枚举名")
        void testIsValidWithValidName() {
            assertTrue(EnumUtils.isValid(ENUM_CLASS, "SCALE"));
            assertTrue(EnumUtils.isValid(ENUM_CLASS, "scale")); // 大小写不敏感
        }

        @Test
        @DisplayName("isValid() 验证无效枚举名")
        void testIsValidWithInvalidName() {
            assertFalse(EnumUtils.isValid(ENUM_CLASS, "INVALID"));
            assertFalse(EnumUtils.isValid(ENUM_CLASS, null));
            assertFalse(EnumUtils.isValid(ENUM_CLASS, ""));
        }
    }

    // ==================== byOrdinal() 序数测试 ====================

    @Nested
    @DisplayName("byOrdinal() 序数测试")
    class ByOrdinalTests {

        @Test
        @DisplayName("有效序数返回对应枚举")
        void testValidOrdinal() {
            UnifiedDeviceType first = EnumUtils.byOrdinal(ENUM_CLASS, 0, null);
            assertEquals(UnifiedDeviceType.values()[0], first);
        }

        @Test
        @DisplayName("负数序数返回默认值")
        void testNegativeOrdinalReturnsDefault() {
            UnifiedDeviceType result = EnumUtils.byOrdinal(ENUM_CLASS, -1, UnifiedDeviceType.TRADITIONAL);
            assertEquals(UnifiedDeviceType.TRADITIONAL, result);
        }

        @Test
        @DisplayName("超出范围序数返回默认值")
        void testOutOfRangeOrdinalReturnsDefault() {
            UnifiedDeviceType result = EnumUtils.byOrdinal(ENUM_CLASS, 999, UnifiedDeviceType.TRADITIONAL);
            assertEquals(UnifiedDeviceType.TRADITIONAL, result);
        }

        @Test
        @DisplayName("byOrdinal() Optional 版本")
        void testByOrdinalOptional() {
            Optional<UnifiedDeviceType> valid = EnumUtils.byOrdinal(ENUM_CLASS, 0);
            assertTrue(valid.isPresent());

            Optional<UnifiedDeviceType> invalid = EnumUtils.byOrdinal(ENUM_CLASS, -1);
            assertTrue(invalid.isEmpty());

            Optional<UnifiedDeviceType> outOfRange = EnumUtils.byOrdinal(ENUM_CLASS, 999);
            assertTrue(outOfRange.isEmpty());
        }
    }
}

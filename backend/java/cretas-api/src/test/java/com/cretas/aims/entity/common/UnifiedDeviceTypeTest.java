package com.cretas.aims.entity.common;

import com.cretas.aims.entity.enums.DeviceCategory;
import com.cretas.aims.entity.iot.DeviceType;
import com.cretas.aims.entity.isapi.IsapiDevice;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;

/**
 * UnifiedDeviceType 枚举单元测试
 *
 * 测试覆盖:
 * - DeviceCategory → UnifiedDeviceType 转换 (UT-ENUM-001~004)
 * - IotDevice.DeviceType → UnifiedDeviceType 转换 (UT-ENUM-005~007)
 * - IsapiDevice.DeviceType → UnifiedDeviceType 转换 (UT-ENUM-008~011)
 * - null 输入处理 (UT-ENUM-012)
 * - displayName 正确性 (UT-ENUM-013)
 * - isCamera() 方法 (UT-ENUM-014~015)
 * - isIotDevice() 方法 (UT-ENUM-016~017)
 *
 * @author Cretas Team
 * @since 2026-01-06
 */
@DisplayName("UnifiedDeviceType 枚举测试")
class UnifiedDeviceTypeTest {

    // ==================== DeviceCategory 转换测试 ====================

    @Nested
    @DisplayName("DeviceCategory → UnifiedDeviceType 转换")
    class FromDeviceCategoryTests {

        @Test
        @DisplayName("UT-ENUM-001: TRADITIONAL → TRADITIONAL")
        void testTraditionalConversion() {
            UnifiedDeviceType result = UnifiedDeviceType.fromDeviceCategory(DeviceCategory.TRADITIONAL);
            assertEquals(UnifiedDeviceType.TRADITIONAL, result);
        }

        @Test
        @DisplayName("UT-ENUM-002: IOT_SCALE → SCALE")
        void testIotScaleConversion() {
            UnifiedDeviceType result = UnifiedDeviceType.fromDeviceCategory(DeviceCategory.IOT_SCALE);
            assertEquals(UnifiedDeviceType.SCALE, result);
        }

        @Test
        @DisplayName("UT-ENUM-003: IOT_CAMERA → CAMERA_GENERIC")
        void testIotCameraConversion() {
            UnifiedDeviceType result = UnifiedDeviceType.fromDeviceCategory(DeviceCategory.IOT_CAMERA);
            assertEquals(UnifiedDeviceType.CAMERA_GENERIC, result);
        }

        @Test
        @DisplayName("UT-ENUM-004: IOT_SENSOR → SENSOR")
        void testIotSensorConversion() {
            UnifiedDeviceType result = UnifiedDeviceType.fromDeviceCategory(DeviceCategory.IOT_SENSOR);
            assertEquals(UnifiedDeviceType.SENSOR, result);
        }

        @Test
        @DisplayName("UT-ENUM-012a: null DeviceCategory 输入")
        void testNullDeviceCategoryInput() {
            UnifiedDeviceType result = UnifiedDeviceType.fromDeviceCategory(null);
            assertNull(result);
        }
    }

    // ==================== IotDevice.DeviceType 转换测试 ====================

    @Nested
    @DisplayName("IotDevice.DeviceType → UnifiedDeviceType 转换")
    class FromIotDeviceTypeTests {

        @Test
        @DisplayName("UT-ENUM-005: SCALE → SCALE")
        void testScaleConversion() {
            UnifiedDeviceType result = UnifiedDeviceType.fromIotDeviceType(DeviceType.SCALE);
            assertEquals(UnifiedDeviceType.SCALE, result);
        }

        @Test
        @DisplayName("UT-ENUM-006: CAMERA → CAMERA_GENERIC")
        void testCameraConversion() {
            UnifiedDeviceType result = UnifiedDeviceType.fromIotDeviceType(DeviceType.CAMERA);
            assertEquals(UnifiedDeviceType.CAMERA_GENERIC, result);
        }

        @Test
        @DisplayName("UT-ENUM-007: SENSOR → SENSOR")
        void testSensorConversion() {
            UnifiedDeviceType result = UnifiedDeviceType.fromIotDeviceType(DeviceType.SENSOR);
            assertEquals(UnifiedDeviceType.SENSOR, result);
        }

        @Test
        @DisplayName("GATEWAY → GATEWAY")
        void testGatewayConversion() {
            UnifiedDeviceType result = UnifiedDeviceType.fromIotDeviceType(DeviceType.GATEWAY);
            assertEquals(UnifiedDeviceType.GATEWAY, result);
        }

        @Test
        @DisplayName("UT-ENUM-012b: null IotDeviceType 输入")
        void testNullIotDeviceTypeInput() {
            UnifiedDeviceType result = UnifiedDeviceType.fromIotDeviceType(null);
            assertNull(result);
        }
    }

    // ==================== IsapiDevice.DeviceType 转换测试 ====================

    @Nested
    @DisplayName("IsapiDevice.DeviceType → UnifiedDeviceType 转换")
    class FromIsapiDeviceTypeTests {

        @Test
        @DisplayName("UT-ENUM-008: IPC → CAMERA_IPC")
        void testIpcConversion() {
            UnifiedDeviceType result = UnifiedDeviceType.fromIsapiDeviceType(IsapiDevice.DeviceType.IPC);
            assertEquals(UnifiedDeviceType.CAMERA_IPC, result);
        }

        @Test
        @DisplayName("UT-ENUM-009: NVR → CAMERA_NVR")
        void testNvrConversion() {
            UnifiedDeviceType result = UnifiedDeviceType.fromIsapiDeviceType(IsapiDevice.DeviceType.NVR);
            assertEquals(UnifiedDeviceType.CAMERA_NVR, result);
        }

        @Test
        @DisplayName("UT-ENUM-010: DVR → CAMERA_DVR")
        void testDvrConversion() {
            UnifiedDeviceType result = UnifiedDeviceType.fromIsapiDeviceType(IsapiDevice.DeviceType.DVR);
            assertEquals(UnifiedDeviceType.CAMERA_DVR, result);
        }

        @Test
        @DisplayName("UT-ENUM-011: ENCODER → CAMERA_ENCODER")
        void testEncoderConversion() {
            UnifiedDeviceType result = UnifiedDeviceType.fromIsapiDeviceType(IsapiDevice.DeviceType.ENCODER);
            assertEquals(UnifiedDeviceType.CAMERA_ENCODER, result);
        }

        @Test
        @DisplayName("UT-ENUM-012c: null IsapiDeviceType 输入")
        void testNullIsapiDeviceTypeInput() {
            UnifiedDeviceType result = UnifiedDeviceType.fromIsapiDeviceType(null);
            assertNull(result);
        }
    }

    // ==================== displayName 测试 ====================

    @Nested
    @DisplayName("displayName 属性测试")
    class DisplayNameTests {

        @Test
        @DisplayName("UT-ENUM-013: SCALE displayName = '电子秤'")
        void testScaleDisplayName() {
            assertEquals("电子秤", UnifiedDeviceType.SCALE.getDisplayName());
        }

        @ParameterizedTest
        @DisplayName("所有枚举值都有非空 displayName")
        @EnumSource(UnifiedDeviceType.class)
        void testAllDisplayNamesNotEmpty(UnifiedDeviceType type) {
            assertNotNull(type.getDisplayName());
            assertFalse(type.getDisplayName().isEmpty());
        }
    }

    // ==================== isCameraDevice() 测试 ====================

    @Nested
    @DisplayName("isCameraDevice() 方法测试")
    class IsCameraDeviceTests {

        @Test
        @DisplayName("UT-ENUM-014: CAMERA_IPC.isCameraDevice() = true")
        void testCameraIpcIsCamera() {
            assertTrue(UnifiedDeviceType.CAMERA_IPC.isCameraDevice());
        }

        @Test
        @DisplayName("UT-ENUM-015: SCALE.isCameraDevice() = false")
        void testScaleIsNotCamera() {
            assertFalse(UnifiedDeviceType.SCALE.isCameraDevice());
        }

        @ParameterizedTest
        @DisplayName("所有 CAMERA_* 类型返回 true")
        @EnumSource(value = UnifiedDeviceType.class, names = {"CAMERA_IPC", "CAMERA_NVR", "CAMERA_DVR", "CAMERA_ENCODER", "CAMERA_GENERIC"})
        void testAllCameraTypesReturnTrue(UnifiedDeviceType type) {
            assertTrue(type.isCameraDevice(), type + " should be a camera device");
        }

        @ParameterizedTest
        @DisplayName("非 CAMERA_* 类型返回 false")
        @EnumSource(value = UnifiedDeviceType.class, names = {"TRADITIONAL", "SCALE", "SENSOR", "GATEWAY"})
        void testNonCameraTypesReturnFalse(UnifiedDeviceType type) {
            assertFalse(type.isCameraDevice(), type + " should not be a camera device");
        }
    }

    // ==================== isIotDevice() 测试 ====================

    @Nested
    @DisplayName("isIotDevice() 方法测试")
    class IsIotDeviceTests {

        @Test
        @DisplayName("UT-ENUM-016: SCALE.isIotDevice() = true")
        void testScaleIsIotDevice() {
            assertTrue(UnifiedDeviceType.SCALE.isIotDevice());
        }

        @Test
        @DisplayName("UT-ENUM-017: TRADITIONAL.isIotDevice() = false")
        void testTraditionalIsNotIotDevice() {
            assertFalse(UnifiedDeviceType.TRADITIONAL.isIotDevice());
        }

        @ParameterizedTest
        @DisplayName("IoT 类型返回 true")
        @EnumSource(value = UnifiedDeviceType.class, names = {"SCALE", "CAMERA_IPC", "CAMERA_NVR", "CAMERA_DVR", "CAMERA_ENCODER", "CAMERA_GENERIC", "SENSOR", "GATEWAY"})
        void testIotTypesReturnTrue(UnifiedDeviceType type) {
            assertTrue(type.isIotDevice(), type + " should be an IoT device");
        }

        @Test
        @DisplayName("TRADITIONAL 返回 false")
        void testTraditionalReturnsFalse() {
            assertFalse(UnifiedDeviceType.TRADITIONAL.isIotDevice());
        }
    }

    // ==================== isIsapiDevice() 测试 ====================

    @Nested
    @DisplayName("isIsapiDevice() 方法测试")
    class IsIsapiDeviceTests {

        @ParameterizedTest
        @DisplayName("ISAPI 类型返回 true")
        @EnumSource(value = UnifiedDeviceType.class, names = {"CAMERA_IPC", "CAMERA_NVR", "CAMERA_DVR", "CAMERA_ENCODER"})
        void testIsapiTypesReturnTrue(UnifiedDeviceType type) {
            assertTrue(type.isIsapiDevice(), type + " should be an ISAPI device");
        }

        @ParameterizedTest
        @DisplayName("非 ISAPI 类型返回 false")
        @EnumSource(value = UnifiedDeviceType.class, names = {"TRADITIONAL", "SCALE", "CAMERA_GENERIC", "SENSOR", "GATEWAY"})
        void testNonIsapiTypesReturnFalse(UnifiedDeviceType type) {
            assertFalse(type.isIsapiDevice(), type + " should not be an ISAPI device");
        }
    }

    // ==================== fromValue() JSON 反序列化测试 ====================

    @Nested
    @DisplayName("fromValue() JSON 反序列化测试")
    class FromValueTests {

        @Test
        @DisplayName("通过 frontendValue 反序列化")
        void testFromFrontendValue() {
            assertEquals(UnifiedDeviceType.SCALE, UnifiedDeviceType.fromValue("scale"));
            assertEquals(UnifiedDeviceType.CAMERA_IPC, UnifiedDeviceType.fromValue("camera_ipc"));
        }

        @Test
        @DisplayName("通过枚举名反序列化")
        void testFromEnumName() {
            assertEquals(UnifiedDeviceType.SCALE, UnifiedDeviceType.fromValue("SCALE"));
            assertEquals(UnifiedDeviceType.CAMERA_IPC, UnifiedDeviceType.fromValue("CAMERA_IPC"));
        }

        @Test
        @DisplayName("大小写不敏感")
        void testCaseInsensitive() {
            assertEquals(UnifiedDeviceType.SCALE, UnifiedDeviceType.fromValue("Scale"));
            assertEquals(UnifiedDeviceType.SCALE, UnifiedDeviceType.fromValue("SCALE"));
            assertEquals(UnifiedDeviceType.SCALE, UnifiedDeviceType.fromValue("scale"));
        }

        @Test
        @DisplayName("null 输入返回 null")
        void testNullInput() {
            assertNull(UnifiedDeviceType.fromValue(null));
        }

        @Test
        @DisplayName("无效值抛出异常")
        void testInvalidValue() {
            assertThrows(IllegalArgumentException.class, () -> UnifiedDeviceType.fromValue("INVALID"));
        }
    }

    // ==================== 反向转换测试 (向后兼容) ====================

    @Nested
    @DisplayName("反向转换测试 (向后兼容)")
    class ReverseConversionTests {

        @Test
        @DisplayName("toDeviceCategory() 转换")
        void testToDeviceCategory() {
            assertEquals(DeviceCategory.TRADITIONAL, UnifiedDeviceType.TRADITIONAL.toDeviceCategory());
            assertEquals(DeviceCategory.IOT_SCALE, UnifiedDeviceType.SCALE.toDeviceCategory());
            assertEquals(DeviceCategory.IOT_CAMERA, UnifiedDeviceType.CAMERA_IPC.toDeviceCategory());
            assertEquals(DeviceCategory.IOT_SENSOR, UnifiedDeviceType.SENSOR.toDeviceCategory());
            assertNull(UnifiedDeviceType.GATEWAY.toDeviceCategory()); // GATEWAY 无对应
        }

        @Test
        @DisplayName("toIotDeviceType() 转换")
        void testToIotDeviceType() {
            assertEquals(DeviceType.SCALE, UnifiedDeviceType.SCALE.toIotDeviceType());
            assertEquals(DeviceType.CAMERA, UnifiedDeviceType.CAMERA_IPC.toIotDeviceType());
            assertEquals(DeviceType.SENSOR, UnifiedDeviceType.SENSOR.toIotDeviceType());
            assertEquals(DeviceType.GATEWAY, UnifiedDeviceType.GATEWAY.toIotDeviceType());
        }

        @Test
        @DisplayName("toIsapiDeviceType() 转换")
        void testToIsapiDeviceType() {
            assertEquals(IsapiDevice.DeviceType.IPC, UnifiedDeviceType.CAMERA_IPC.toIsapiDeviceType());
            assertEquals(IsapiDevice.DeviceType.NVR, UnifiedDeviceType.CAMERA_NVR.toIsapiDeviceType());
            assertEquals(IsapiDevice.DeviceType.DVR, UnifiedDeviceType.CAMERA_DVR.toIsapiDeviceType());
            assertEquals(IsapiDevice.DeviceType.ENCODER, UnifiedDeviceType.CAMERA_ENCODER.toIsapiDeviceType());
            assertNull(UnifiedDeviceType.SCALE.toIsapiDeviceType()); // SCALE 无对应
        }
    }

    // ==================== 双向转换一致性测试 ====================

    @Nested
    @DisplayName("双向转换一致性测试")
    class BidirectionalConsistencyTests {

        @Test
        @DisplayName("DeviceCategory 双向转换一致性")
        void testDeviceCategoryBidirectional() {
            for (DeviceCategory category : DeviceCategory.values()) {
                UnifiedDeviceType unified = UnifiedDeviceType.fromDeviceCategory(category);
                DeviceCategory reversed = unified.toDeviceCategory();
                assertEquals(category, reversed,
                    "DeviceCategory." + category + " → UnifiedDeviceType → DeviceCategory 应该保持一致");
            }
        }

        @ParameterizedTest
        @DisplayName("IotDeviceType 双向转换一致性")
        @EnumSource(DeviceType.class)
        void testIotDeviceTypeBidirectional(DeviceType deviceType) {
            UnifiedDeviceType unified = UnifiedDeviceType.fromIotDeviceType(deviceType);
            DeviceType reversed = unified.toIotDeviceType();
            assertEquals(deviceType, reversed,
                "DeviceType." + deviceType + " → UnifiedDeviceType → DeviceType 应该保持一致");
        }

        @ParameterizedTest
        @DisplayName("IsapiDeviceType 双向转换一致性")
        @EnumSource(IsapiDevice.DeviceType.class)
        void testIsapiDeviceTypeBidirectional(IsapiDevice.DeviceType deviceType) {
            UnifiedDeviceType unified = UnifiedDeviceType.fromIsapiDeviceType(deviceType);
            IsapiDevice.DeviceType reversed = unified.toIsapiDeviceType();
            assertEquals(deviceType, reversed,
                "IsapiDevice.DeviceType." + deviceType + " → UnifiedDeviceType → IsapiDevice.DeviceType 应该保持一致");
        }
    }
}

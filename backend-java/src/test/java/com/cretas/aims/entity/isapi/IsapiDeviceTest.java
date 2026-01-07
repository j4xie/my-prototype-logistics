package com.cretas.aims.entity.isapi;

import com.cretas.aims.entity.common.UnifiedDeviceType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * IsapiDevice 实体单元测试
 *
 * 测试覆盖:
 * - equipment_id 类型验证 (UT-ISAPI-001)
 * - FactoryEquipment 关联验证 (UT-ISAPI-002)
 * - null equipment_id 允许 (UT-ISAPI-003)
 * - 有效 equipment_id 关联 (UT-ISAPI-004)
 *
 * @author Cretas Team
 * @since 2026-01-06
 */
@DisplayName("IsapiDevice 实体测试")
class IsapiDeviceTest {

    // ==================== equipment_id 类型测试 ====================

    @Nested
    @DisplayName("equipment_id 字段类型测试")
    class EquipmentIdTypeTests {

        @Test
        @DisplayName("UT-ISAPI-001: equipment_id 类型为 Long")
        void testEquipmentIdIsLongType() throws NoSuchFieldException {
            // 通过反射验证字段类型
            Field equipmentIdField = IsapiDevice.class.getDeclaredField("equipmentId");
            assertEquals(Long.class, equipmentIdField.getType(),
                    "equipment_id 字段应该是 Long 类型，而不是 String");
        }

        @Test
        @DisplayName("UT-ISAPI-003: null equipment_id 允许")
        void testNullEquipmentIdAllowed() {
            // 创建设备实例
            IsapiDevice device = IsapiDevice.builder()
                    .id("test-device-001")
                    .factoryId("F001")
                    .deviceName("测试摄像头")
                    .deviceType(IsapiDevice.DeviceType.IPC)
                    .ipAddress("192.168.1.100")
                    .port(80)
                    .username("admin")
                    .passwordEncrypted("encrypted_pwd")
                    .equipmentId(null) // 显式设置为 null
                    .build();

            // 验证 null 被接受
            assertNull(device.getEquipmentId(), "设备应该允许 equipment_id 为 null");

            // 验证其他字段正常
            assertNotNull(device.getFactoryId());
            assertEquals("F001", device.getFactoryId());
        }

        @Test
        @DisplayName("UT-ISAPI-004: 有效 equipment_id 正确关联设备")
        void testValidEquipmentIdAssociation() {
            Long equipmentId = 12345L;

            IsapiDevice device = IsapiDevice.builder()
                    .id("test-device-002")
                    .factoryId("F001")
                    .deviceName("测试摄像头2")
                    .deviceType(IsapiDevice.DeviceType.NVR)
                    .ipAddress("192.168.1.101")
                    .port(80)
                    .username("admin")
                    .passwordEncrypted("encrypted_pwd")
                    .equipmentId(equipmentId)
                    .build();

            // 验证 equipment_id 正确设置
            assertEquals(equipmentId, device.getEquipmentId(),
                    "equipment_id 应该正确存储 Long 值");

            // 验证可以修改
            device.setEquipmentId(99999L);
            assertEquals(99999L, device.getEquipmentId());
        }
    }

    // ==================== UnifiedDeviceType 集成测试 ====================

    @Nested
    @DisplayName("UnifiedDeviceType 集成测试")
    class UnifiedDeviceTypeIntegrationTests {

        @Test
        @DisplayName("UT-ISAPI-002: getUnifiedDeviceType() 返回正确类型")
        void testUnifiedDeviceTypeConversion() {
            // IPC -> CAMERA_IPC
            IsapiDevice ipcDevice = createDevice(IsapiDevice.DeviceType.IPC);
            assertEquals(UnifiedDeviceType.CAMERA_IPC, ipcDevice.getUnifiedDeviceType());

            // NVR -> CAMERA_NVR
            IsapiDevice nvrDevice = createDevice(IsapiDevice.DeviceType.NVR);
            assertEquals(UnifiedDeviceType.CAMERA_NVR, nvrDevice.getUnifiedDeviceType());

            // DVR -> CAMERA_DVR
            IsapiDevice dvrDevice = createDevice(IsapiDevice.DeviceType.DVR);
            assertEquals(UnifiedDeviceType.CAMERA_DVR, dvrDevice.getUnifiedDeviceType());

            // ENCODER -> CAMERA_ENCODER
            IsapiDevice encoderDevice = createDevice(IsapiDevice.DeviceType.ENCODER);
            assertEquals(UnifiedDeviceType.CAMERA_ENCODER, encoderDevice.getUnifiedDeviceType());
        }

        @Test
        @DisplayName("setUnifiedDeviceType() 正确反向转换")
        void testSetUnifiedDeviceType() {
            IsapiDevice device = createDevice(IsapiDevice.DeviceType.IPC);

            // 设置为 CAMERA_NVR
            device.setUnifiedDeviceType(UnifiedDeviceType.CAMERA_NVR);
            assertEquals(IsapiDevice.DeviceType.NVR, device.getDeviceType());

            // 设置为 CAMERA_DVR
            device.setUnifiedDeviceType(UnifiedDeviceType.CAMERA_DVR);
            assertEquals(IsapiDevice.DeviceType.DVR, device.getDeviceType());
        }

        @Test
        @DisplayName("所有 ISAPI 设备类型返回 isIsapiDevice() = true")
        void testIsIsapiDevice() {
            for (IsapiDevice.DeviceType type : IsapiDevice.DeviceType.values()) {
                IsapiDevice device = createDevice(type);
                UnifiedDeviceType unified = device.getUnifiedDeviceType();
                assertTrue(unified.isIsapiDevice(),
                        type + " 转换后的 UnifiedDeviceType 应该 isIsapiDevice() = true");
            }
        }

        private IsapiDevice createDevice(IsapiDevice.DeviceType type) {
            return IsapiDevice.builder()
                    .id("test-" + type.name())
                    .factoryId("F001")
                    .deviceName("测试设备-" + type.name())
                    .deviceType(type)
                    .ipAddress("192.168.1.1")
                    .port(80)
                    .username("admin")
                    .passwordEncrypted("pwd")
                    .build();
        }
    }

    // ==================== 设备状态和便捷方法测试 ====================

    @Nested
    @DisplayName("设备状态和便捷方法测试")
    class DeviceStatusAndUtilityTests {

        @Test
        @DisplayName("heartbeat() 更新状态为 ONLINE")
        void testHeartbeat() {
            IsapiDevice device = createBasicDevice();
            device.setStatus(IsapiDevice.DeviceStatus.OFFLINE);
            device.setLastError("Previous error");

            device.heartbeat();

            assertEquals(IsapiDevice.DeviceStatus.ONLINE, device.getStatus());
            assertNull(device.getLastError());
            assertNotNull(device.getLastHeartbeatAt());
        }

        @Test
        @DisplayName("markOffline() 设置离线状态")
        void testMarkOffline() {
            IsapiDevice device = createBasicDevice();
            device.setStatus(IsapiDevice.DeviceStatus.ONLINE);

            device.markOffline("Network unreachable");

            assertEquals(IsapiDevice.DeviceStatus.OFFLINE, device.getStatus());
            assertEquals("Network unreachable", device.getLastError());
        }

        @Test
        @DisplayName("markError() 设置错误状态")
        void testMarkError() {
            IsapiDevice device = createBasicDevice();

            device.markError("Authentication failed");

            assertEquals(IsapiDevice.DeviceStatus.ERROR, device.getStatus());
            assertEquals("Authentication failed", device.getLastError());
        }

        @Test
        @DisplayName("getBaseUrl() 正确生成 URL")
        void testGetBaseUrl() {
            IsapiDevice httpDevice = IsapiDevice.builder()
                    .ipAddress("192.168.1.100")
                    .port(80)
                    .protocol(IsapiDevice.Protocol.HTTP)
                    .build();
            assertEquals("http://192.168.1.100:80", httpDevice.getBaseUrl());

            IsapiDevice httpsDevice = IsapiDevice.builder()
                    .ipAddress("192.168.1.100")
                    .port(443)
                    .protocol(IsapiDevice.Protocol.HTTPS)
                    .build();
            assertEquals("https://192.168.1.100:443", httpsDevice.getBaseUrl());
        }

        @Test
        @DisplayName("getRtspBaseUrl() 正确生成 RTSP URL")
        void testGetRtspBaseUrl() {
            IsapiDevice device = IsapiDevice.builder()
                    .ipAddress("192.168.1.100")
                    .rtspPort(554)
                    .build();
            assertEquals("rtsp://192.168.1.100:554", device.getRtspBaseUrl());
        }

        private IsapiDevice createBasicDevice() {
            return IsapiDevice.builder()
                    .id("test-device")
                    .factoryId("F001")
                    .deviceName("测试设备")
                    .deviceType(IsapiDevice.DeviceType.IPC)
                    .ipAddress("192.168.1.1")
                    .port(80)
                    .username("admin")
                    .passwordEncrypted("pwd")
                    .status(IsapiDevice.DeviceStatus.UNKNOWN)
                    .build();
        }
    }

    // ==================== JSON 辅助方法测试 ====================

    @Nested
    @DisplayName("JSON 辅助方法测试")
    class JsonUtilityTests {

        @Test
        @DisplayName("设备能力 JSON 序列化/反序列化")
        void testDeviceCapabilitiesJson() {
            IsapiDevice device = createBasicDevice();

            // 设置能力
            Map<String, Object> capabilities = Map.of(
                    "supportsPtz", true,
                    "maxChannels", 16,
                    "protocols", List.of("RTSP", "HTTP")
            );
            device.setDeviceCapabilities(capabilities);

            // 反序列化验证
            Map<String, Object> retrieved = device.getDeviceCapabilities();
            assertNotNull(retrieved);
            assertEquals(true, retrieved.get("supportsPtz"));
            assertEquals(16, retrieved.get("maxChannels"));
        }

        @Test
        @DisplayName("空设备能力返回空 Map")
        void testEmptyDeviceCapabilities() {
            IsapiDevice device = createBasicDevice();
            Map<String, Object> capabilities = device.getDeviceCapabilities();
            assertNotNull(capabilities);
            assertTrue(capabilities.isEmpty());
        }

        @Test
        @DisplayName("订阅事件 JSON 序列化/反序列化")
        void testSubscribedEventsJson() {
            IsapiDevice device = createBasicDevice();

            // 设置事件
            List<String> events = List.of("lineDetection", "fieldDetection", "faceDetection");
            device.setSubscribedEvents(events);

            // 反序列化验证
            List<String> retrieved = device.getSubscribedEvents();
            assertNotNull(retrieved);
            assertEquals(3, retrieved.size());
            assertTrue(retrieved.contains("lineDetection"));
            assertTrue(retrieved.contains("faceDetection"));
        }

        @Test
        @DisplayName("空订阅事件返回空 List")
        void testEmptySubscribedEvents() {
            IsapiDevice device = createBasicDevice();
            List<String> events = device.getSubscribedEvents();
            assertNotNull(events);
            assertTrue(events.isEmpty());
        }

        private IsapiDevice createBasicDevice() {
            return IsapiDevice.builder()
                    .id("test-device")
                    .factoryId("F001")
                    .deviceName("测试设备")
                    .deviceType(IsapiDevice.DeviceType.IPC)
                    .ipAddress("192.168.1.1")
                    .port(80)
                    .username("admin")
                    .passwordEncrypted("pwd")
                    .build();
        }
    }

    // ==================== 默认值测试 ====================

    @Nested
    @DisplayName("默认值测试")
    class DefaultValueTests {

        @Test
        @DisplayName("Builder 默认值正确")
        void testBuilderDefaults() {
            IsapiDevice device = IsapiDevice.builder()
                    .id("test")
                    .factoryId("F001")
                    .deviceName("Test")
                    .deviceType(IsapiDevice.DeviceType.IPC)
                    .ipAddress("192.168.1.1")
                    .username("admin")
                    .passwordEncrypted("pwd")
                    .build();

            // 验证默认值
            assertEquals(80, device.getPort());
            assertEquals(554, device.getRtspPort());
            assertEquals(443, device.getHttpsPort());
            assertEquals(IsapiDevice.Protocol.HTTP, device.getProtocol());
            assertEquals(1, device.getChannelCount());
            assertFalse(device.getSupportsPtz());
            assertFalse(device.getSupportsAudio());
            assertFalse(device.getSupportsSmart());
            assertEquals(IsapiDevice.DeviceStatus.UNKNOWN, device.getStatus());
            assertFalse(device.getAlertSubscribed());
        }
    }

    // ==================== 通道关系测试 ====================

    @Nested
    @DisplayName("通道关系测试")
    class ChannelRelationshipTests {

        @Test
        @DisplayName("设备可以关联多个通道")
        void testDeviceChannelRelationship() {
            IsapiDevice device = IsapiDevice.builder()
                    .id("test-nvr")
                    .factoryId("F001")
                    .deviceName("测试NVR")
                    .deviceType(IsapiDevice.DeviceType.NVR)
                    .ipAddress("192.168.1.1")
                    .port(80)
                    .username("admin")
                    .passwordEncrypted("pwd")
                    .channelCount(16)
                    .channels(new ArrayList<>())
                    .build();

            // 设备可以有多个通道
            assertEquals(16, device.getChannelCount());
            assertNotNull(device.getChannels());
            assertTrue(device.getChannels().isEmpty());
        }
    }
}

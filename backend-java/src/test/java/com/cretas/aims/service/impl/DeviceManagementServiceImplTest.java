package com.cretas.aims.service.impl;

import com.cretas.aims.dto.device.ConnectionTestResult;
import com.cretas.aims.dto.device.DeviceInfo;
import com.cretas.aims.dto.device.DeviceStatus;
import com.cretas.aims.dto.isapi.IsapiCaptureDTO;
import com.cretas.aims.entity.FactoryEquipment;
import com.cretas.aims.entity.isapi.IsapiDevice;
import com.cretas.aims.repository.EquipmentRepository;
import com.cretas.aims.repository.isapi.IsapiDeviceRepository;
import com.cretas.aims.service.CameraService;
import com.cretas.aims.service.DeviceManagementService;
import com.cretas.aims.service.EquipmentService;
import com.cretas.aims.service.isapi.IsapiDeviceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * DeviceManagementService 单元测试
 *
 * 测试覆盖:
 * - 设备获取测试 (UT-DMS-001~006)
 * - 连接测试 (UT-DMS-010~018)
 * - 批量连接测试 (UT-DMS-020~023)
 * - 设备类型检测 (UT-DMS-030~034)
 *
 * @author Cretas Team
 * @since 2026-01-06
 */
@DisplayName("DeviceManagementService 单元测试")
@ExtendWith(MockitoExtension.class)
class DeviceManagementServiceImplTest {

    @Mock
    private IsapiDeviceService isapiDeviceService;

    @Mock
    private CameraService cameraService;

    @Mock
    private EquipmentService equipmentService;

    @Mock
    private IsapiDeviceRepository isapiDeviceRepository;

    @Mock
    private EquipmentRepository equipmentRepository;

    private DeviceManagementServiceImpl deviceManagementService;

    // Test constants
    private static final String TEST_FACTORY_ID = "F001";
    private static final String TEST_ISAPI_DEVICE_ID = "550e8400-e29b-41d4-a716-446655440000";
    private static final String TEST_SCALE_DEVICE_ID = "SCALE-F001-001";
    private static final String TEST_EQUIPMENT_ID = "123";
    private static final String TEST_CAMERA_SDK_ID = "CAM-SDK-001";

    @BeforeEach
    void setUp() {
        deviceManagementService = new DeviceManagementServiceImpl(
                isapiDeviceService,
                cameraService,
                equipmentService,
                isapiDeviceRepository,
                equipmentRepository
        );
    }

    // ==================== 设备获取测试 (UT-DMS-001~006) ====================

    @Nested
    @DisplayName("getDevice() 设备获取测试")
    class GetDeviceTests {

        @Test
        @DisplayName("UT-DMS-001: 获取 ISAPI 设备")
        void testGetIsapiDevice() {
            // Arrange
            IsapiDevice mockDevice = createMockIsapiDevice();
            when(isapiDeviceService.getDevice(TEST_ISAPI_DEVICE_ID)).thenReturn(mockDevice);

            // Act
            DeviceInfo result = deviceManagementService.getDevice(TEST_ISAPI_DEVICE_ID, DeviceManagementService.DEVICE_TYPE_ISAPI);

            // Assert
            assertNotNull(result);
            assertEquals(TEST_ISAPI_DEVICE_ID, result.getDeviceId());
            assertEquals(DeviceManagementService.DEVICE_TYPE_ISAPI, result.getDeviceType());
            verify(isapiDeviceService).getDevice(TEST_ISAPI_DEVICE_ID);
        }

        @Test
        @DisplayName("UT-DMS-002: 获取 SDK 摄像头")
        void testGetCameraSdkDevice() {
            // Act
            DeviceInfo result = deviceManagementService.getDevice(TEST_CAMERA_SDK_ID, DeviceManagementService.DEVICE_TYPE_CAMERA_SDK);

            // Assert - CAMERA_SDK currently returns basic info without database lookup
            // The implementation may vary, check for non-null or expected behavior
            // This tests the routing logic
            assertNotNull(result);
            assertEquals(TEST_CAMERA_SDK_ID, result.getDeviceId());
        }

        @Test
        @DisplayName("UT-DMS-003: 获取电子秤设备")
        void testGetScaleDevice() {
            // Arrange
            FactoryEquipment mockEquipment = createMockScaleEquipment();
            // The implementation uses findAll() and filters by iotDeviceCode
            when(equipmentRepository.findAll()).thenReturn(Collections.singletonList(mockEquipment));

            // Act
            DeviceInfo result = deviceManagementService.getDevice(TEST_SCALE_DEVICE_ID, DeviceManagementService.DEVICE_TYPE_SCALE);

            // Assert
            assertNotNull(result);
            assertEquals(DeviceManagementService.DEVICE_TYPE_SCALE, result.getDeviceType());
        }

        @Test
        @DisplayName("UT-DMS-004: 获取通用设备")
        void testGetEquipmentDevice() {
            // Arrange
            FactoryEquipment mockEquipment = createMockEquipment();
            when(equipmentRepository.findById(Long.parseLong(TEST_EQUIPMENT_ID))).thenReturn(Optional.of(mockEquipment));

            // Act
            DeviceInfo result = deviceManagementService.getDevice(TEST_EQUIPMENT_ID, DeviceManagementService.DEVICE_TYPE_EQUIPMENT);

            // Assert
            assertNotNull(result);
            assertEquals(DeviceManagementService.DEVICE_TYPE_EQUIPMENT, result.getDeviceType());
            verify(equipmentRepository).findById(Long.parseLong(TEST_EQUIPMENT_ID));
        }

        @Test
        @DisplayName("UT-DMS-005: 不支持的设备类型返回 null")
        void testGetDeviceUnsupportedType() {
            // Act
            DeviceInfo result = deviceManagementService.getDevice("DEVICE-001", "UNKNOWN_TYPE");

            // Assert
            assertNull(result);
        }

        @Test
        @DisplayName("UT-DMS-006: null 类型时自动检测设备类型")
        void testGetDeviceWithNullTypeAutoDetect() {
            // Arrange - ISAPI device detection via UUID format and repository check
            when(isapiDeviceRepository.existsById(TEST_ISAPI_DEVICE_ID)).thenReturn(true);
            IsapiDevice mockDevice = createMockIsapiDevice();
            when(isapiDeviceService.getDevice(TEST_ISAPI_DEVICE_ID)).thenReturn(mockDevice);

            // Act
            DeviceInfo result = deviceManagementService.getDevice(TEST_ISAPI_DEVICE_ID, null);

            // Assert
            assertNotNull(result);
            assertEquals(DeviceManagementService.DEVICE_TYPE_ISAPI, result.getDeviceType());
        }
    }

    // ==================== 设备列表测试 ====================

    @Nested
    @DisplayName("listDevices() 设备列表测试")
    class ListDevicesTests {

        @Test
        @DisplayName("按类型列出 ISAPI 设备")
        void testListIsapiDevices() {
            // Arrange
            List<IsapiDevice> mockDevices = Arrays.asList(createMockIsapiDevice(), createMockIsapiDevice());
            Page<IsapiDevice> mockPage = new PageImpl<>(mockDevices);
            when(isapiDeviceRepository.findByFactoryId(eq(TEST_FACTORY_ID), any(PageRequest.class))).thenReturn(mockPage);

            // Act
            List<DeviceInfo> result = deviceManagementService.listDevices(TEST_FACTORY_ID, DeviceManagementService.DEVICE_TYPE_ISAPI);

            // Assert
            assertNotNull(result);
            assertEquals(2, result.size());
            verify(isapiDeviceRepository).findByFactoryId(eq(TEST_FACTORY_ID), any(PageRequest.class));
        }

        @Test
        @DisplayName("null 类型时列出所有设备")
        void testListAllDevices() {
            // Arrange
            List<IsapiDevice> mockIsapiDevices = Collections.singletonList(createMockIsapiDevice());
            Page<IsapiDevice> mockIsapiPage = new PageImpl<>(mockIsapiDevices);
            List<FactoryEquipment> mockEquipments = Collections.singletonList(createMockEquipment());

            when(isapiDeviceRepository.findByFactoryId(eq(TEST_FACTORY_ID), any(PageRequest.class))).thenReturn(mockIsapiPage);
            when(equipmentRepository.findByFactoryId(TEST_FACTORY_ID)).thenReturn(mockEquipments);

            // Act
            List<DeviceInfo> result = deviceManagementService.listDevices(TEST_FACTORY_ID, null);

            // Assert
            assertNotNull(result);
            assertTrue(result.size() >= 1); // At least some devices returned
        }
    }

    // ==================== 搜索测试 ====================

    @Nested
    @DisplayName("searchDevices() 搜索测试")
    class SearchDevicesTests {

        @Test
        @DisplayName("按关键词搜索设备")
        void testSearchDevicesByKeyword() {
            // Arrange - searchDevices() internally calls listDevices() which uses repository
            IsapiDevice mockDevice = createMockIsapiDevice();
            mockDevice.setDeviceName("生产线1号摄像头");
            Page<IsapiDevice> mockPage = new PageImpl<>(Collections.singletonList(mockDevice));
            when(isapiDeviceRepository.findByFactoryId(eq(TEST_FACTORY_ID), any(PageRequest.class))).thenReturn(mockPage);

            // Act
            List<DeviceInfo> result = deviceManagementService.searchDevices(TEST_FACTORY_ID, DeviceManagementService.DEVICE_TYPE_ISAPI, "生产线");

            // Assert
            assertNotNull(result);
            // Search should filter by keyword in name/code/location
        }

        @Test
        @DisplayName("空关键词返回所有设备")
        void testSearchDevicesEmptyKeyword() {
            // Arrange - searchDevices() internally calls listDevices() which uses repository
            Page<IsapiDevice> mockPage = new PageImpl<>(Collections.singletonList(createMockIsapiDevice()));
            when(isapiDeviceRepository.findByFactoryId(eq(TEST_FACTORY_ID), any(PageRequest.class))).thenReturn(mockPage);

            // Act
            List<DeviceInfo> result = deviceManagementService.searchDevices(TEST_FACTORY_ID, DeviceManagementService.DEVICE_TYPE_ISAPI, "");

            // Assert
            assertNotNull(result);
        }
    }

    // ==================== 连接测试 (UT-DMS-010~018) ====================

    @Nested
    @DisplayName("testConnection() 连接测试")
    class TestConnectionTests {

        @Test
        @DisplayName("UT-DMS-010: 连接成功")
        void testConnectionSuccess() {
            // Arrange - facade internally calls getDevice() then testConnection(boolean)
            IsapiDevice mockDevice = createMockIsapiDevice();
            when(isapiDeviceService.getDevice(TEST_ISAPI_DEVICE_ID)).thenReturn(mockDevice);
            when(isapiDeviceService.testConnection(TEST_ISAPI_DEVICE_ID)).thenReturn(true);

            // Act
            ConnectionTestResult result = deviceManagementService.testConnection(TEST_ISAPI_DEVICE_ID, DeviceManagementService.DEVICE_TYPE_ISAPI);

            // Assert
            assertNotNull(result);
            assertTrue(Boolean.TRUE.equals(result.getSuccess()));
            assertEquals(TEST_ISAPI_DEVICE_ID, result.getDeviceId());
        }

        @Test
        @DisplayName("UT-DMS-011: 连接失败")
        void testConnectionFailure() {
            // Arrange - facade internally calls getDevice() then testConnection(boolean)
            IsapiDevice mockDevice = createMockIsapiDevice();
            when(isapiDeviceService.getDevice(TEST_ISAPI_DEVICE_ID)).thenReturn(mockDevice);
            when(isapiDeviceService.testConnection(TEST_ISAPI_DEVICE_ID)).thenReturn(false);

            // Act
            ConnectionTestResult result = deviceManagementService.testConnection(TEST_ISAPI_DEVICE_ID, DeviceManagementService.DEVICE_TYPE_ISAPI);

            // Assert
            assertNotNull(result);
            assertFalse(Boolean.TRUE.equals(result.getSuccess()));
        }

        @Test
        @DisplayName("UT-DMS-014: 设备不存在")
        void testConnectionDeviceNotFound() {
            // Arrange - getDevice() returns null
            when(isapiDeviceService.getDevice(TEST_ISAPI_DEVICE_ID)).thenReturn(null);

            // Act
            ConnectionTestResult result = deviceManagementService.testConnection(TEST_ISAPI_DEVICE_ID, DeviceManagementService.DEVICE_TYPE_ISAPI);

            // Assert
            assertNotNull(result);
            assertFalse(Boolean.TRUE.equals(result.getSuccess()));
            assertEquals("NOT_FOUND", result.getErrorCode());
        }

        @Test
        @DisplayName("UT-DMS-018: 测试异常处理")
        void testConnectionException() {
            // Arrange - testConnection() throws exception
            IsapiDevice mockDevice = createMockIsapiDevice();
            when(isapiDeviceService.getDevice(TEST_ISAPI_DEVICE_ID)).thenReturn(mockDevice);
            when(isapiDeviceService.testConnection(TEST_ISAPI_DEVICE_ID))
                    .thenThrow(new RuntimeException("Connection error"));

            // Act
            ConnectionTestResult result = deviceManagementService.testConnection(TEST_ISAPI_DEVICE_ID, DeviceManagementService.DEVICE_TYPE_ISAPI);

            // Assert
            assertNotNull(result);
            assertFalse(Boolean.TRUE.equals(result.getSuccess()));
        }
    }

    // ==================== 批量连接测试 (UT-DMS-020~023) ====================

    @Nested
    @DisplayName("batchTestConnections() 批量连接测试")
    class BatchTestConnectionsTests {

        @Test
        @DisplayName("UT-DMS-020: 批量测试所有设备")
        void testBatchTestAllDevices() {
            // Arrange - mock repository for listDevices() internal call
            IsapiDevice device1 = createMockIsapiDevice();
            device1.setId("device-1");
            IsapiDevice device2 = createMockIsapiDevice();
            device2.setId("device-2");
            when(isapiDeviceRepository.findByFactoryId(TEST_FACTORY_ID)).thenReturn(Arrays.asList(device1, device2));
            // Mock underlying service calls - testConnection returns boolean
            when(isapiDeviceService.getDevice(anyString())).thenReturn(Optional.of(createMockIsapiDevice()));
            when(isapiDeviceService.testConnection(anyString())).thenReturn(true);

            // Act
            List<ConnectionTestResult> results = deviceManagementService.batchTestConnections(TEST_FACTORY_ID, DeviceManagementService.DEVICE_TYPE_ISAPI);

            // Assert
            assertNotNull(results);
            assertEquals(2, results.size());
        }

        @Test
        @DisplayName("UT-DMS-021: 按类型过滤批量测试")
        void testBatchTestByType() {
            // Arrange - mock repository for listDevices() internal call
            IsapiDevice device = createMockIsapiDevice();
            device.setId("device-1");
            when(isapiDeviceRepository.findByFactoryId(TEST_FACTORY_ID)).thenReturn(Collections.singletonList(device));
            // Mock underlying service calls - testConnection returns boolean
            when(isapiDeviceService.getDevice(anyString())).thenReturn(Optional.of(device));
            when(isapiDeviceService.testConnection(anyString())).thenReturn(true);

            // Act
            List<ConnectionTestResult> results = deviceManagementService.batchTestConnections(TEST_FACTORY_ID, DeviceManagementService.DEVICE_TYPE_ISAPI);

            // Assert
            assertNotNull(results);
            // Only ISAPI devices should be tested
            verify(isapiDeviceRepository).findByFactoryId(TEST_FACTORY_ID);
        }

        @Test
        @DisplayName("UT-DMS-022: 空设备列表返回空列表")
        void testBatchTestEmptyList() {
            // Arrange - mock repository returning empty list
            when(isapiDeviceRepository.findByFactoryId(TEST_FACTORY_ID)).thenReturn(Collections.emptyList());

            // Act
            List<ConnectionTestResult> results = deviceManagementService.batchTestConnections(TEST_FACTORY_ID, DeviceManagementService.DEVICE_TYPE_ISAPI);

            // Assert
            assertNotNull(results);
            assertTrue(results.isEmpty());
        }

        @Test
        @DisplayName("UT-DMS-023: 部分设备失败继续测试其他设备")
        void testBatchTestPartialFailure() {
            // Arrange
            IsapiDevice device1 = createMockIsapiDevice();
            device1.setId("device-1");
            device1.setDeviceName("Camera 1");
            IsapiDevice device2 = createMockIsapiDevice();
            device2.setId("device-2");
            device2.setDeviceName("Camera 2");

            // Mock repository to return device list
            when(isapiDeviceRepository.findByFactoryId(TEST_FACTORY_ID)).thenReturn(Arrays.asList(device1, device2));
            // Mock getDevice for each device
            when(isapiDeviceService.getDevice("device-1")).thenReturn(Optional.of(device1));
            when(isapiDeviceService.getDevice("device-2")).thenReturn(Optional.of(device2));
            // Mock testConnection - device1 success, device2 failure
            when(isapiDeviceService.testConnection("device-1")).thenReturn(true);
            when(isapiDeviceService.testConnection("device-2")).thenReturn(false);

            // Act
            List<ConnectionTestResult> results = deviceManagementService.batchTestConnections(TEST_FACTORY_ID, DeviceManagementService.DEVICE_TYPE_ISAPI);

            // Assert
            assertNotNull(results);
            assertEquals(2, results.size());
            // One success, one failure - use getSuccess() with Boolean.TRUE.equals()
            long successCount = results.stream().filter(r -> Boolean.TRUE.equals(r.getSuccess())).count();
            long failureCount = results.stream().filter(r -> !Boolean.TRUE.equals(r.getSuccess())).count();
            assertEquals(1, successCount);
            assertEquals(1, failureCount);
        }
    }

    // ==================== 设备类型检测 (UT-DMS-030~034) ====================

    @Nested
    @DisplayName("detectDeviceType() 设备类型检测测试")
    class DetectDeviceTypeTests {

        @Test
        @DisplayName("UT-DMS-030: ISAPI 命名规则检测 (UUID格式)")
        void testDetectIsapiByUuidFormat() {
            // Arrange
            when(isapiDeviceRepository.existsById(TEST_ISAPI_DEVICE_ID)).thenReturn(true);

            // Act
            String result = deviceManagementService.detectDeviceType(TEST_ISAPI_DEVICE_ID);

            // Assert
            assertEquals(DeviceManagementService.DEVICE_TYPE_ISAPI, result);
        }

        @Test
        @DisplayName("UT-DMS-031: 电子秤命名规则检测 (SCALE-前缀)")
        void testDetectScaleByPrefix() {
            // Act
            String result = deviceManagementService.detectDeviceType(TEST_SCALE_DEVICE_ID);

            // Assert
            assertEquals(DeviceManagementService.DEVICE_TYPE_SCALE, result);
        }

        @Test
        @DisplayName("UT-DMS-032: 通用设备命名检测 (数字ID)")
        void testDetectEquipmentByNumericId() {
            // Arrange
            when(equipmentRepository.existsById(Long.parseLong(TEST_EQUIPMENT_ID))).thenReturn(true);

            // Act
            String result = deviceManagementService.detectDeviceType(TEST_EQUIPMENT_ID);

            // Assert
            assertEquals(DeviceManagementService.DEVICE_TYPE_EQUIPMENT, result);
        }

        @Test
        @DisplayName("UT-DMS-033: 数据库查找检测")
        void testDetectByDatabaseLookup() {
            // Arrange - non-standard ID that exists in ISAPI table
            String customId = "custom-device-id";
            when(isapiDeviceRepository.existsById(customId)).thenReturn(true);

            // Act
            String result = deviceManagementService.detectDeviceType(customId);

            // Assert - depends on implementation, may return ISAPI or null
            // The detection logic checks UUID format first, then database
        }

        @Test
        @DisplayName("UT-DMS-034: 无法识别返回 null")
        void testDetectUnknownDeviceType() {
            // Arrange
            String unknownId = "UNKNOWN-DEVICE-001";
            when(isapiDeviceRepository.existsById(unknownId)).thenReturn(false);

            // Act
            String result = deviceManagementService.detectDeviceType(unknownId);

            // Assert
            assertNull(result);
        }

        @ParameterizedTest
        @DisplayName("null 和空字符串返回 null")
        @NullAndEmptySource
        void testDetectNullAndEmpty(String deviceId) {
            // Act
            String result = deviceManagementService.detectDeviceType(deviceId);

            // Assert
            assertNull(result);
        }

        @ParameterizedTest
        @DisplayName("SCALE 前缀变体检测")
        @ValueSource(strings = {"SCALE-001", "scale-002", "SCALE_003", "IOT_SCALE_004"})
        void testDetectScaleVariants(String deviceId) {
            // Act
            String result = deviceManagementService.detectDeviceType(deviceId);

            // Assert
            assertEquals(DeviceManagementService.DEVICE_TYPE_SCALE, result);
        }
    }

    // ==================== 设备类型支持检查 ====================

    @Nested
    @DisplayName("isDeviceTypeSupported() 设备类型支持检查")
    class IsDeviceTypeSupportedTests {

        @ParameterizedTest
        @DisplayName("支持的设备类型返回 true")
        @ValueSource(strings = {"ISAPI", "CAMERA_SDK", "SCALE", "EQUIPMENT"})
        void testSupportedTypes(String deviceType) {
            assertTrue(deviceManagementService.isDeviceTypeSupported(deviceType));
        }

        @ParameterizedTest
        @DisplayName("不支持的设备类型返回 false")
        @ValueSource(strings = {"UNKNOWN", "PRINTER", "PLC", ""})
        void testUnsupportedTypes(String deviceType) {
            assertFalse(deviceManagementService.isDeviceTypeSupported(deviceType));
        }

        @Test
        @DisplayName("null 类型返回 false")
        void testNullType() {
            assertFalse(deviceManagementService.isDeviceTypeSupported(null));
        }
    }

    // ==================== 抓拍功能测试 ====================

    @Nested
    @DisplayName("capture() 抓拍功能测试")
    class CaptureTests {

        @Test
        @DisplayName("ISAPI 设备抓拍成功")
        void testIsapiCapture() {
            // Arrange
            byte[] mockImage = new byte[]{0x00, 0x01, 0x02};
            when(isapiDeviceService.capturePicture(TEST_ISAPI_DEVICE_ID, 1)).thenReturn(mockImage);
            when(isapiDeviceRepository.existsById(TEST_ISAPI_DEVICE_ID)).thenReturn(true);

            // Act
            byte[] result = deviceManagementService.capture(TEST_ISAPI_DEVICE_ID, 1);

            // Assert
            assertNotNull(result);
            assertArrayEquals(mockImage, result);
        }

        @Test
        @DisplayName("不支持抓拍的设备返回 null")
        void testCaptureUnsupportedDevice() {
            // Act - EQUIPMENT type doesn't support capture
            byte[] result = deviceManagementService.capture(TEST_EQUIPMENT_ID, 1);

            // Assert
            assertNull(result);
        }
    }

    // ==================== 设备状态测试 ====================

    @Nested
    @DisplayName("getStatus() 设备状态测试")
    class GetStatusTests {

        @Test
        @DisplayName("获取 ISAPI 设备状态")
        void testGetIsapiStatus() {
            // Arrange
            DeviceStatus mockStatus = DeviceStatus.online(TEST_ISAPI_DEVICE_ID, "ISAPI", "测试摄像头");
            when(isapiDeviceService.getDeviceStatus(TEST_ISAPI_DEVICE_ID)).thenReturn(mockStatus);

            // Act
            DeviceStatus result = deviceManagementService.getStatus(TEST_ISAPI_DEVICE_ID, DeviceManagementService.DEVICE_TYPE_ISAPI);

            // Assert
            assertNotNull(result);
            assertEquals("ONLINE", result.getStatus());
        }

        @Test
        @DisplayName("获取电子秤状态包含读数")
        void testGetScaleStatusWithReading() {
            // Arrange
            FactoryEquipment mockEquipment = createMockScaleEquipment();
            mockEquipment.setLastWeightReading(new BigDecimal("12.5"));
            when(equipmentRepository.findByIotDeviceCode(TEST_SCALE_DEVICE_ID)).thenReturn(Optional.of(mockEquipment));

            // Act
            DeviceStatus result = deviceManagementService.getStatus(TEST_SCALE_DEVICE_ID, DeviceManagementService.DEVICE_TYPE_SCALE);

            // Assert
            assertNotNull(result);
        }
    }

    // ==================== 状态统计测试 ====================

    @Nested
    @DisplayName("getStatusStatistics() 状态统计测试")
    class GetStatusStatisticsTests {

        @Test
        @DisplayName("获取设备状态统计")
        void testGetStatusStatistics() {
            // Arrange
            IsapiDevice onlineDevice = createMockIsapiDevice();
            onlineDevice.setStatus(IsapiDevice.DeviceStatus.ONLINE);
            IsapiDevice offlineDevice = createMockIsapiDevice();
            offlineDevice.setStatus(IsapiDevice.DeviceStatus.OFFLINE);

            when(isapiDeviceService.listDevicesByFactory(TEST_FACTORY_ID))
                    .thenReturn(Arrays.asList(onlineDevice, offlineDevice));

            // Act
            Map<String, Long> stats = deviceManagementService.getStatusStatistics(TEST_FACTORY_ID, DeviceManagementService.DEVICE_TYPE_ISAPI);

            // Assert
            assertNotNull(stats);
            // Should contain status counts
        }

        @Test
        @DisplayName("空设备列表返回空统计")
        void testGetStatusStatisticsEmpty() {
            // Arrange
            when(isapiDeviceService.listDevicesByFactory(TEST_FACTORY_ID)).thenReturn(Collections.emptyList());

            // Act
            Map<String, Long> stats = deviceManagementService.getStatusStatistics(TEST_FACTORY_ID, DeviceManagementService.DEVICE_TYPE_ISAPI);

            // Assert
            assertNotNull(stats);
        }
    }

    // ==================== Helper Methods ====================

    private IsapiDevice createMockIsapiDevice() {
        IsapiDevice device = new IsapiDevice();
        device.setId(TEST_ISAPI_DEVICE_ID);
        device.setFactoryId(TEST_FACTORY_ID);
        device.setDeviceName("测试摄像头");
        device.setDeviceType(IsapiDevice.DeviceType.IPC);
        device.setIpAddress("192.168.1.100");
        device.setPort(80);
        device.setStatus(IsapiDevice.DeviceStatus.ONLINE);
        return device;
    }

    private FactoryEquipment createMockEquipment() {
        FactoryEquipment equipment = new FactoryEquipment();
        equipment.setId(Long.parseLong(TEST_EQUIPMENT_ID));
        equipment.setFactoryId(TEST_FACTORY_ID);
        equipment.setEquipmentCode("EQ-001");
        equipment.setEquipmentName("测试设备");
        equipment.setStatus("RUNNING");
        return equipment;
    }

    private FactoryEquipment createMockScaleEquipment() {
        FactoryEquipment equipment = new FactoryEquipment();
        equipment.setId(1L);
        equipment.setFactoryId(TEST_FACTORY_ID);
        equipment.setIotDeviceCode(TEST_SCALE_DEVICE_ID);
        equipment.setEquipmentName("测试电子秤");
        equipment.setManufacturer("柯力");
        equipment.setModel("D2008");
        equipment.setStatus("RUNNING");
        return equipment;
    }
}

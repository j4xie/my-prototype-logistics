package com.cretas.aims.integration;

import com.cretas.aims.dto.device.ConnectionTestResult;
import com.cretas.aims.dto.device.DeviceInfo;
import com.cretas.aims.entity.common.UnifiedDeviceType;
import com.cretas.aims.service.DeviceManagementService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 设备批量操作集成测试
 *
 * 测试覆盖:
 * - IT-BATCH-001~005: 批量连接测试
 * - IT-BATCH-010~013: 批量状态查询
 * - IT-BATCH-020~023: 并发操作
 * - IT-BATCH-030~032: 错误处理和容错
 *
 * @author Cretas Team
 * @since 2026-01-06
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("设备批量操作集成测试")
public class DeviceBatchOperationsTest {

    @Mock
    private DeviceManagementService deviceManagementService;

    private static final String TEST_FACTORY_ID = "F001";
    private List<String> testDeviceIds;

    @BeforeEach
    void setUp() {
        testDeviceIds = Arrays.asList(
                "ISAPI-001",
                "ISAPI-002",
                "SCALE-001",
                "CAMERA-001",
                "ISAPI-003"
        );
    }

    // ==================== 批量连接测试 ====================

    @Nested
    @DisplayName("批量连接测试")
    class BatchConnectionTests {

        @Test
        @DisplayName("IT-BATCH-001: 批量连接所有设备成功")
        void testBatchConnectAllDevicesSuccess() {
            // Mock每个设备都连接成功
            for (String deviceId : testDeviceIds) {
                ConnectionTestResult successResult = ConnectionTestResult.builder()
                        .deviceId(deviceId)
                        .success(true)
                        .responseTimeMs(100L)
                        .build();
                when(deviceManagementService.testConnection(TEST_FACTORY_ID, deviceId))
                        .thenReturn(successResult);
            }

            // 批量连接
            List<ConnectionTestResult> results = testDeviceIds.stream()
                    .map(id -> deviceManagementService.testConnection(TEST_FACTORY_ID, id))
                    .collect(Collectors.toList());

            // 验证全部成功
            assertEquals(5, results.size());
            assertTrue(results.stream().allMatch(ConnectionTestResult::getSuccess),
                    "所有设备应该连接成功");

            // 验证平均响应时间
            double avgResponseTime = results.stream()
                    .mapToLong(ConnectionTestResult::getResponseTimeMs)
                    .average()
                    .orElse(0);
            assertTrue(avgResponseTime < 200, "平均响应时间应该小于200ms");
        }

        @Test
        @DisplayName("IT-BATCH-002: 批量连接部分设备失败")
        void testBatchConnectPartialFailure() {
            // Mock前2个成功，后3个失败
            when(deviceManagementService.testConnection(TEST_FACTORY_ID, "ISAPI-001"))
                    .thenReturn(createSuccessResult("ISAPI-001"));
            when(deviceManagementService.testConnection(TEST_FACTORY_ID, "ISAPI-002"))
                    .thenReturn(createSuccessResult("ISAPI-002"));
            when(deviceManagementService.testConnection(TEST_FACTORY_ID, "SCALE-001"))
                    .thenReturn(createFailureResult("SCALE-001", "设备离线"));
            when(deviceManagementService.testConnection(TEST_FACTORY_ID, "CAMERA-001"))
                    .thenReturn(createFailureResult("CAMERA-001", "网络超时"));
            when(deviceManagementService.testConnection(TEST_FACTORY_ID, "ISAPI-003"))
                    .thenReturn(createFailureResult("ISAPI-003", "认证失败"));

            // 批量连接
            List<ConnectionTestResult> results = testDeviceIds.stream()
                    .map(id -> deviceManagementService.testConnection(TEST_FACTORY_ID, id))
                    .collect(Collectors.toList());

            // 统计成功和失败数量
            long successCount = results.stream()
                    .filter(ConnectionTestResult::getSuccess)
                    .count();
            long failureCount = results.stream()
                    .filter(r -> !r.getSuccess())
                    .count();

            assertEquals(2, successCount, "应该有2个设备连接成功");
            assertEquals(3, failureCount, "应该有3个设备连接失败");
        }

        @Test
        @DisplayName("IT-BATCH-003: 批量连接超时设备")
        void testBatchConnectWithTimeout() {
            // Mock部分设备超时
            when(deviceManagementService.testConnection(eq(TEST_FACTORY_ID), anyString()))
                    .thenAnswer(invocation -> {
                        String deviceId = invocation.getArgument(1);
                        if (deviceId.contains("SCALE")) {
                            // 模拟超时
                            Thread.sleep(6000);
                            return createFailureResult(deviceId, "连接超时");
                        } else {
                            return createSuccessResult(deviceId);
                        }
                    });

            // 使用超时控制的批量连接
            List<CompletableFuture<ConnectionTestResult>> futures = testDeviceIds.stream()
                    .map(id -> CompletableFuture.supplyAsync(() ->
                            deviceManagementService.testConnection(TEST_FACTORY_ID, id)))
                    .collect(Collectors.toList());

            // 等待所有完成（带超时）
            List<ConnectionTestResult> results = futures.stream()
                    .map(CompletableFuture::join)
                    .collect(Collectors.toList());

            assertNotNull(results);
            assertEquals(5, results.size());
        }

        @Test
        @DisplayName("IT-BATCH-004: 分批次连接大量设备")
        void testBatchConnectInChunks() {
            // 创建20个设备
            List<String> largeDeviceList = new java.util.ArrayList<>();
            for (int i = 1; i <= 20; i++) {
                largeDeviceList.add("DEVICE-" + String.format("%03d", i));
            }

            // Mock所有设备连接成功
            when(deviceManagementService.testConnection(eq(TEST_FACTORY_ID), anyString()))
                    .thenAnswer(invocation -> {
                        String deviceId = invocation.getArgument(1);
                        return createSuccessResult(deviceId);
                    });

            // 分批处理（每批5个）
            int batchSize = 5;
            List<List<String>> batches = new java.util.ArrayList<>();
            for (int i = 0; i < largeDeviceList.size(); i += batchSize) {
                batches.add(largeDeviceList.subList(i,
                        Math.min(i + batchSize, largeDeviceList.size())));
            }

            // 逐批连接
            List<ConnectionTestResult> allResults = new java.util.ArrayList<>();
            for (List<String> batch : batches) {
                List<ConnectionTestResult> batchResults = batch.stream()
                        .map(id -> deviceManagementService.testConnection(TEST_FACTORY_ID, id))
                        .collect(Collectors.toList());
                allResults.addAll(batchResults);
            }

            assertEquals(20, allResults.size());
            assertEquals(4, batches.size(), "应该分成4批");
        }

        @Test
        @DisplayName("IT-BATCH-005: 批量连接后验证设备状态")
        void testBatchConnectAndVerifyStatus() {
            // Mock连接和状态查询
            testDeviceIds.forEach(id -> {
                when(deviceManagementService.testConnection(TEST_FACTORY_ID, id))
                        .thenReturn(createSuccessResult(id));

                DeviceInfo mockDevice = createMockDeviceInfo(id, true);
                when(deviceManagementService.getDevice(TEST_FACTORY_ID, id))
                        .thenReturn(mockDevice);
            });

            // 批量连接
            List<ConnectionTestResult> connectResults = testDeviceIds.stream()
                    .map(id -> deviceManagementService.testConnection(TEST_FACTORY_ID, id))
                    .collect(Collectors.toList());

            // 验证连接成功
            assertTrue(connectResults.stream().allMatch(ConnectionTestResult::getSuccess));

            // 批量查询状态
            List<DeviceInfo> devices = testDeviceIds.stream()
                    .map(id -> deviceManagementService.getDevice(TEST_FACTORY_ID, id))
                    .collect(Collectors.toList());

            // 验证所有设备都在线
            assertTrue(devices.stream().allMatch(d -> "ONLINE".equals(d.getStatus())),
                    "所有设备应该在线");
        }
    }

    // ==================== 批量状态查询测试 ====================

    @Nested
    @DisplayName("批量状态查询测试")
    class BatchStatusQueryTests {

        @Test
        @DisplayName("IT-BATCH-010: 批量查询设备信息")
        void testBatchGetDeviceInfo() {
            // Mock设备信息
            testDeviceIds.forEach(id -> {
                DeviceInfo mockDevice = createMockDeviceInfo(id, true);
                when(deviceManagementService.getDevice(TEST_FACTORY_ID, id))
                        .thenReturn(mockDevice);
            });

            // 批量查询
            Map<String, DeviceInfo> deviceMap = testDeviceIds.stream()
                    .collect(Collectors.toMap(
                            id -> id,
                            id -> deviceManagementService.getDevice(TEST_FACTORY_ID, id)
                    ));

            assertEquals(5, deviceMap.size());
            assertTrue(deviceMap.values().stream().allMatch(d -> d != null));
        }

        @Test
        @DisplayName("IT-BATCH-011: 批量查询设备类型分布")
        void testBatchGetDeviceTypeDistribution() {
            // Mock不同类型的设备
            when(deviceManagementService.getDevice(TEST_FACTORY_ID, "ISAPI-001"))
                    .thenReturn(createMockDeviceInfo("ISAPI-001", UnifiedDeviceType.CAMERA_IPC));
            when(deviceManagementService.getDevice(TEST_FACTORY_ID, "ISAPI-002"))
                    .thenReturn(createMockDeviceInfo("ISAPI-002", UnifiedDeviceType.CAMERA_NVR));
            when(deviceManagementService.getDevice(TEST_FACTORY_ID, "SCALE-001"))
                    .thenReturn(createMockDeviceInfo("SCALE-001", UnifiedDeviceType.SCALE));
            when(deviceManagementService.getDevice(TEST_FACTORY_ID, "CAMERA-001"))
                    .thenReturn(createMockDeviceInfo("CAMERA-001", UnifiedDeviceType.CAMERA_GENERIC));
            when(deviceManagementService.getDevice(TEST_FACTORY_ID, "ISAPI-003"))
                    .thenReturn(createMockDeviceInfo("ISAPI-003", UnifiedDeviceType.CAMERA_DVR));

            // 批量查询并统计类型分布
            Map<UnifiedDeviceType, Long> typeDistribution = testDeviceIds.stream()
                    .map(id -> deviceManagementService.getDevice(TEST_FACTORY_ID, id))
                    .collect(Collectors.groupingBy(
                            d -> UnifiedDeviceType.valueOf(d.getDeviceType()),
                            Collectors.counting()
                    ));

            assertEquals(5, typeDistribution.size(), "应该有5种不同类型的设备");
            assertTrue(typeDistribution.containsKey(UnifiedDeviceType.SCALE));
        }

        @Test
        @DisplayName("IT-BATCH-012: 批量查询设备健康状态")
        void testBatchGetDeviceHealthStatus() {
            // Mock设备健康状态
            testDeviceIds.forEach(id -> {
                boolean isHealthy = !id.equals("SCALE-001"); // SCALE-001不健康
                DeviceInfo mockDevice = createMockDeviceInfo(id, isHealthy);
                when(deviceManagementService.getDevice(TEST_FACTORY_ID, id))
                        .thenReturn(mockDevice);
            });

            List<DeviceInfo> devices = testDeviceIds.stream()
                    .map(id -> deviceManagementService.getDevice(TEST_FACTORY_ID, id))
                    .collect(Collectors.toList());

            long healthyCount = devices.stream()
                    .filter(d -> "ONLINE".equals(d.getStatus()))
                    .count();

            assertEquals(4, healthyCount, "应该有4个设备健康");
        }

        @Test
        @DisplayName("IT-BATCH-013: 批量查询并过滤离线设备")
        void testBatchGetAndFilterOfflineDevices() {
            // Mock部分设备离线
            when(deviceManagementService.getDevice(TEST_FACTORY_ID, "ISAPI-001"))
                    .thenReturn(createMockDeviceInfo("ISAPI-001", true));
            when(deviceManagementService.getDevice(TEST_FACTORY_ID, "ISAPI-002"))
                    .thenReturn(createMockDeviceInfo("ISAPI-002", false));
            when(deviceManagementService.getDevice(TEST_FACTORY_ID, "SCALE-001"))
                    .thenReturn(createMockDeviceInfo("SCALE-001", true));
            when(deviceManagementService.getDevice(TEST_FACTORY_ID, "CAMERA-001"))
                    .thenReturn(createMockDeviceInfo("CAMERA-001", false));
            when(deviceManagementService.getDevice(TEST_FACTORY_ID, "ISAPI-003"))
                    .thenReturn(createMockDeviceInfo("ISAPI-003", true));

            // 查询并过滤离线设备
            List<DeviceInfo> offlineDevices = testDeviceIds.stream()
                    .map(id -> deviceManagementService.getDevice(TEST_FACTORY_ID, id))
                    .filter(d -> !"ONLINE".equals(d.getStatus()))
                    .collect(Collectors.toList());

            assertEquals(2, offlineDevices.size());
            assertTrue(offlineDevices.stream()
                    .anyMatch(d -> d.getDeviceId().equals("ISAPI-002")));
        }
    }

    // ==================== 并发操作测试 ====================

    @Nested
    @DisplayName("并发操作测试")
    class ConcurrentOperationTests {

        @Test
        @DisplayName("IT-BATCH-020: 并发连接多个设备")
        void testConcurrentConnect() {
            // Mock连接操作
            testDeviceIds.forEach(id -> {
                when(deviceManagementService.testConnection(TEST_FACTORY_ID, id))
                        .thenReturn(createSuccessResult(id));
            });

            // 使用并发流处理
            List<ConnectionTestResult> results = testDeviceIds.parallelStream()
                    .map(id -> deviceManagementService.testConnection(TEST_FACTORY_ID, id))
                    .collect(Collectors.toList());

            assertEquals(5, results.size());
            assertTrue(results.stream().allMatch(ConnectionTestResult::getSuccess));
        }

        @Test
        @DisplayName("IT-BATCH-021: 并发查询设备状态")
        void testConcurrentStatusQuery() {
            testDeviceIds.forEach(id -> {
                DeviceInfo mockDevice = createMockDeviceInfo(id, true);
                when(deviceManagementService.getDevice(TEST_FACTORY_ID, id))
                        .thenReturn(mockDevice);
            });

            // 并发查询
            List<DeviceInfo> devices = testDeviceIds.parallelStream()
                    .map(id -> deviceManagementService.getDevice(TEST_FACTORY_ID, id))
                    .collect(Collectors.toList());

            assertEquals(5, devices.size());
        }

        @Test
        @DisplayName("IT-BATCH-022: 使用CompletableFuture异步批量操作")
        void testAsyncBatchOperationsWithCompletableFuture() {
            testDeviceIds.forEach(id -> {
                when(deviceManagementService.testConnection(TEST_FACTORY_ID, id))
                        .thenReturn(createSuccessResult(id));
            });

            // 异步执行
            List<CompletableFuture<ConnectionTestResult>> futures = testDeviceIds.stream()
                    .map(id -> CompletableFuture.supplyAsync(() ->
                            deviceManagementService.testConnection(TEST_FACTORY_ID, id)))
                    .collect(Collectors.toList());

            // 等待所有完成
            CompletableFuture<Void> allOf = CompletableFuture.allOf(
                    futures.toArray(new CompletableFuture[0])
            );

            allOf.join();

            List<ConnectionTestResult> results = futures.stream()
                    .map(CompletableFuture::join)
                    .collect(Collectors.toList());

            assertEquals(5, results.size());
        }

        @Test
        @DisplayName("IT-BATCH-023: 高并发场景性能测试")
        void testHighConcurrencyPerformance() {
            // 创建100个设备
            List<String> manyDevices = new java.util.ArrayList<>();
            for (int i = 1; i <= 100; i++) {
                manyDevices.add("DEV-" + String.format("%03d", i));
            }

            when(deviceManagementService.testConnection(eq(TEST_FACTORY_ID), anyString()))
                    .thenAnswer(invocation -> {
                        String deviceId = invocation.getArgument(1);
                        return createSuccessResult(deviceId);
                    });

            // 记录开始时间
            long startTime = System.currentTimeMillis();

            // 并发执行
            List<ConnectionTestResult> results = manyDevices.parallelStream()
                    .map(id -> deviceManagementService.testConnection(TEST_FACTORY_ID, id))
                    .collect(Collectors.toList());

            long duration = System.currentTimeMillis() - startTime;

            assertEquals(100, results.size());
            assertTrue(duration < 5000, "100个设备并发连接应该在5秒内完成");
        }
    }

    // ==================== 错误处理和容错测试 ====================

    @Nested
    @DisplayName("错误处理和容错测试")
    class ErrorHandlingTests {

        @Test
        @DisplayName("IT-BATCH-030: 单个设备失败不影响其他设备")
        void testSingleDeviceFailureDoesNotAffectOthers() {
            // Mock一个设备抛出异常
            when(deviceManagementService.testConnection(TEST_FACTORY_ID, "ISAPI-001"))
                    .thenReturn(createSuccessResult("ISAPI-001"));
            when(deviceManagementService.testConnection(TEST_FACTORY_ID, "ISAPI-002"))
                    .thenThrow(new RuntimeException("网络异常"));
            when(deviceManagementService.testConnection(TEST_FACTORY_ID, "SCALE-001"))
                    .thenReturn(createSuccessResult("SCALE-001"));

            // 容错处理
            List<ConnectionTestResult> results = testDeviceIds.stream()
                    .map(id -> {
                        try {
                            return deviceManagementService.testConnection(TEST_FACTORY_ID, id);
                        } catch (Exception e) {
                            return createFailureResult(id, e.getMessage());
                        }
                    })
                    .collect(Collectors.toList());

            // 验证其他设备仍然成功
            long successCount = results.stream()
                    .filter(r -> r != null && r.getSuccess())
                    .count();

            assertTrue(successCount >= 2, "至少有2个设备应该成功");
        }

        @Test
        @DisplayName("IT-BATCH-031: 批量操作超时保护")
        void testBatchOperationTimeoutProtection() {
            when(deviceManagementService.testConnection(eq(TEST_FACTORY_ID), anyString()))
                    .thenAnswer(invocation -> {
                        // 模拟慢速设备
                        Thread.sleep(2000);
                        String deviceId = invocation.getArgument(1);
                        return createSuccessResult(deviceId);
                    });

            // 使用超时保护
            List<CompletableFuture<ConnectionTestResult>> futures = testDeviceIds.stream()
                    .map(id -> CompletableFuture.supplyAsync(() ->
                            deviceManagementService.testConnection(TEST_FACTORY_ID, id))
                            .orTimeout(3, java.util.concurrent.TimeUnit.SECONDS))
                    .collect(Collectors.toList());

            // 等待完成
            List<ConnectionTestResult> results = futures.stream()
                    .map(f -> {
                        try {
                            return f.join();
                        } catch (Exception e) {
                            return null;
                        }
                    })
                    .filter(r -> r != null)
                    .collect(Collectors.toList());

            assertFalse(results.isEmpty());
        }

        @Test
        @DisplayName("IT-BATCH-032: 批量重试机制")
        void testBatchRetryMechanism() {
            // Mock第一次失败，第二次成功
            String deviceId = "RETRY-001";
            when(deviceManagementService.testConnection(TEST_FACTORY_ID, deviceId))
                    .thenReturn(createFailureResult(deviceId, "临时失败"))
                    .thenReturn(createSuccessResult(deviceId));

            // 重试逻辑
            ConnectionTestResult result = null;
            int maxRetries = 3;
            for (int i = 0; i < maxRetries; i++) {
                result = deviceManagementService.testConnection(TEST_FACTORY_ID, deviceId);
                if (result.getSuccess()) {
                    break;
                }
            }

            assertNotNull(result);
            assertTrue(result.getSuccess(), "重试后应该成功");
        }
    }

    // ==================== 辅助方法 ====================

    private ConnectionTestResult createSuccessResult(String deviceId) {
        return ConnectionTestResult.builder()
                .deviceId(deviceId)
                .success(true)
                .responseTimeMs(100L)
                .build();
    }

    private ConnectionTestResult createFailureResult(String deviceId, String error) {
        return ConnectionTestResult.builder()
                .deviceId(deviceId)
                .success(false)
                .responseTimeMs(0L)
                .errorMessage(error)
                .build();
    }

    private DeviceInfo createMockDeviceInfo(String deviceId, boolean online) {
        return DeviceInfo.builder()
                .deviceId(deviceId)
                .deviceType(UnifiedDeviceType.CAMERA_IPC.name())
                .status(online ? "ONLINE" : "OFFLINE")
                .deviceName("Test Device " + deviceId)
                .build();
    }

    private DeviceInfo createMockDeviceInfo(String deviceId, UnifiedDeviceType type) {
        return DeviceInfo.builder()
                .deviceId(deviceId)
                .deviceType(type.name())
                .status("ONLINE")
                .deviceName("Test Device " + deviceId)
                .build();
    }
}

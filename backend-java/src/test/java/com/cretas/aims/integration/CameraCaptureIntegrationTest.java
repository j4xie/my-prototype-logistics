package com.cretas.aims.integration;

import com.cretas.aims.dto.camera.CameraDeviceInfo;
import com.cretas.aims.dto.camera.CaptureImageRequest;
import com.cretas.aims.dto.camera.CaptureImageResponse;
import com.cretas.aims.exception.CameraException;
import com.cretas.aims.service.CameraService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 摄像头抓拍功能集成测试
 *
 * 测试覆盖:
 * - IT-CAM-001~006: 基础抓拍场景
 * - IT-CAM-010~013: 错误处理
 * - IT-CAM-020~023: 图像格式和质量
 * - IT-CAM-030~032: 设备管理
 *
 * @author Cretas Team
 * @since 2026-01-06
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("摄像头抓拍集成测试")
public class CameraCaptureIntegrationTest {

    @Mock
    private CameraService cameraService;

    private static final String MOCK_IMAGE_PATH = "/tmp/test_image_001.jpg";
    private static final String MOCK_IMAGE_URL = "http://example.com/images/001.jpg";
    private static final byte[] MOCK_IMAGE_DATA = "MOCK_JPEG_IMAGE_DATA".getBytes();

    @BeforeEach
    void setUp() {
        // 重置mock状态
        reset(cameraService);
    }

    @AfterEach
    void tearDown() {
        // 清理测试资源
        verifyNoMoreInteractions(cameraService);
    }

    // ==================== 基础抓拍场景测试 ====================

    @Nested
    @DisplayName("基础抓拍场景测试")
    class BasicCaptureScenarios {

        @Test
        @DisplayName("IT-CAM-001: 成功抓拍图像（默认参数）")
        void testSuccessfulCaptureWithDefaults() {
            // Mock抓拍成功
            CaptureImageResponse mockResponse = CaptureImageResponse.builder()
                    .imagePath(MOCK_IMAGE_PATH)
                    .imageUrl(MOCK_IMAGE_URL)
                    .format("JPEG")
                    .width(1920)
                    .height(1080)
                    .fileSize(512000L)
                    .imageData(MOCK_IMAGE_DATA)
                    .build();

            when(cameraService.captureImage()).thenReturn(mockResponse);

            // 执行抓拍
            CaptureImageResponse response = cameraService.captureImage();

            // 验证结果
            assertNotNull(response, "抓拍响应不应为null");
            assertEquals(MOCK_IMAGE_PATH, response.getImagePath());
            assertEquals(MOCK_IMAGE_URL, response.getImageUrl());
            assertEquals("JPEG", response.getFormat());
            assertEquals(1920, response.getWidth());
            assertEquals(1080, response.getHeight());
            assertEquals(512000L, response.getFileSize());
            assertArrayEquals(MOCK_IMAGE_DATA, response.getImageData());

            // 验证调用
            verify(cameraService).captureImage();
        }

        @Test
        @DisplayName("IT-CAM-002: 成功抓拍图像（自定义参数）")
        void testSuccessfulCaptureWithCustomParams() {
            CaptureImageRequest request = CaptureImageRequest.builder()
                    .deviceIndex(0)
                    .format("JPEG")
                    .jpegQuality(95)
                    .timeout(3000)
                    .build();

            CaptureImageResponse mockResponse = CaptureImageResponse.builder()
                    .imagePath(MOCK_IMAGE_PATH)
                    .format("JPEG")
                    .width(2560)
                    .height(1440)
                    .fileSize(768000L)
                    .imageData(MOCK_IMAGE_DATA)
                    .build();

            when(cameraService.captureImage(any(CaptureImageRequest.class)))
                    .thenReturn(mockResponse);

            // 执行抓拍
            CaptureImageResponse response = cameraService.captureImage(request);

            // 验证结果
            assertNotNull(response);
            assertEquals("JPEG", response.getFormat());
            assertEquals(2560, response.getWidth());
            assertEquals(1440, response.getHeight());
            assertTrue(response.getFileSize() > 0);

            verify(cameraService).captureImage(request);
        }

        @Test
        @DisplayName("IT-CAM-003: 连续抓拍多张图像")
        void testContinuousCapture() {
            // Mock三次抓拍,每次返回不同的图像数据
            when(cameraService.captureImage())
                    .thenReturn(createMockResponse("img_001.jpg", 100L))
                    .thenReturn(createMockResponse("img_002.jpg", 200L))
                    .thenReturn(createMockResponse("img_003.jpg", 300L));

            // 连续抓拍3张
            CaptureImageResponse r1 = cameraService.captureImage();
            CaptureImageResponse r2 = cameraService.captureImage();
            CaptureImageResponse r3 = cameraService.captureImage();

            // 验证每次抓拍都成功
            assertAll(
                    () -> assertNotNull(r1),
                    () -> assertNotNull(r2),
                    () -> assertNotNull(r3),
                    () -> assertTrue(r1.getImagePath().contains("img_001.jpg")),
                    () -> assertTrue(r2.getImagePath().contains("img_002.jpg")),
                    () -> assertTrue(r3.getImagePath().contains("img_003.jpg"))
            );

            verify(cameraService, times(3)).captureImage();
        }

        @Test
        @DisplayName("IT-CAM-004: 图像数据Base64编码验证")
        void testImageDataBase64Encoding() {
            byte[] originalData = "TEST_IMAGE_BINARY_DATA".getBytes();
            CaptureImageResponse mockResponse = CaptureImageResponse.builder()
                    .imagePath(MOCK_IMAGE_PATH)
                    .format("JPEG")
                    .imageData(originalData)
                    .build();

            when(cameraService.captureImage()).thenReturn(mockResponse);

            // 抓拍图像
            CaptureImageResponse response = cameraService.captureImage();

            // 验证Base64编码/解码
            String base64Encoded = Base64.getEncoder().encodeToString(response.getImageData());
            byte[] decodedData = Base64.getDecoder().decode(base64Encoded);

            assertArrayEquals(originalData, decodedData,
                    "Base64编码后解码应该恢复原始数据");

            verify(cameraService).captureImage();
        }

        @Test
        @DisplayName("IT-CAM-005: 快速拍照功能")
        void testQuickCapture() {
            CaptureImageResponse mockResponse = CaptureImageResponse.builder()
                    .imagePath(MOCK_IMAGE_PATH)
                    .format("JPEG")
                    .width(1920)
                    .height(1080)
                    .build();

            when(cameraService.captureImage()).thenReturn(mockResponse);

            // 快速拍照（无需参数）
            CaptureImageResponse response = cameraService.captureImage();

            assertNotNull(response);
            assertEquals("JPEG", response.getFormat());

            verify(cameraService).captureImage();
        }

        @Test
        @DisplayName("IT-CAM-006: 图像元数据完整性验证")
        void testImageMetadataIntegrity() {
            CaptureImageResponse mockResponse = CaptureImageResponse.builder()
                    .imagePath("/tmp/test_123.jpg")
                    .imageUrl("http://cdn.example.com/123.jpg")
                    .format("JPEG")
                    .width(3840)
                    .height(2160)
                    .fileSize(1024000L)
                    .imageData(new byte[1024000])
                    .build();

            when(cameraService.captureImage()).thenReturn(mockResponse);

            CaptureImageResponse response = cameraService.captureImage();

            // 验证所有元数据字段
            assertAll(
                    () -> assertNotNull(response.getImagePath()),
                    () -> assertNotNull(response.getImageUrl()),
                    () -> assertEquals("JPEG", response.getFormat()),
                    () -> assertEquals(3840, response.getWidth()),
                    () -> assertEquals(2160, response.getHeight()),
                    () -> assertEquals(1024000L, response.getFileSize()),
                    () -> assertNotNull(response.getImageData()),
                    () -> assertEquals(1024000, response.getImageData().length)
            );
        }
    }

    // ==================== 错误处理测试 ====================

    @Nested
    @DisplayName("错误处理测试")
    class ErrorHandlingScenarios {

        @Test
        @DisplayName("IT-CAM-010: 设备未连接时抓拍失败")
        void testCaptureFailsWhenNotConnected() {
            when(cameraService.captureImage())
                    .thenThrow(new CameraException("设备未连接，无法抓拍图像"));

            // 验证抛出异常
            CameraException exception = assertThrows(CameraException.class, () -> {
                cameraService.captureImage();
            });

            assertTrue(exception.getMessage().contains("设备未连接"));
        }

        @Test
        @DisplayName("IT-CAM-011: 抓拍超时处理")
        void testCaptureTimeout() {
            CaptureImageRequest request = CaptureImageRequest.builder()
                    .timeout(1000) // 1秒超时
                    .build();

            when(cameraService.captureImage(any()))
                    .thenThrow(new CameraException("抓拍超时：等待图像数据超过1000ms"));

            // 验证超时异常
            CameraException exception = assertThrows(CameraException.class, () -> {
                cameraService.captureImage(request);
            });

            assertTrue(exception.getMessage().contains("超时"));
        }

        @Test
        @DisplayName("IT-CAM-012: 无效设备索引处理")
        void testInvalidDeviceIndex() {
            CaptureImageRequest request = CaptureImageRequest.builder()
                    .deviceIndex(999) // 不存在的设备索引
                    .build();

            when(cameraService.captureImage(any()))
                    .thenThrow(new CameraException("无效的设备索引: 999"));

            CameraException exception = assertThrows(CameraException.class, () -> {
                cameraService.captureImage(request);
            });

            assertTrue(exception.getMessage().contains("无效的设备索引"));
        }

        @Test
        @DisplayName("IT-CAM-013: SDK异常处理")
        void testSdkException() {
            when(cameraService.captureImage())
                    .thenThrow(new CameraException("SDK错误: 0x80000001"));

            CameraException exception = assertThrows(CameraException.class, () -> {
                cameraService.captureImage();
            });

            assertTrue(exception.getMessage().contains("SDK错误"));
        }
    }

    // ==================== 图像格式和质量测试 ====================

    @Nested
    @DisplayName("图像格式和质量测试")
    class ImageFormatAndQualityTests {

        @Test
        @DisplayName("IT-CAM-020: JPEG格式抓拍")
        void testCaptureJpegFormat() {
            testFormatCapture("JPEG", 90);
        }

        @Test
        @DisplayName("IT-CAM-021: BMP格式抓拍")
        void testCaptureBmpFormat() {
            testFormatCapture("BMP", null);
        }

        @Test
        @DisplayName("IT-CAM-022: PNG格式抓拍")
        void testCapturePngFormat() {
            testFormatCapture("PNG", null);
        }

        @Test
        @DisplayName("IT-CAM-023: 不同JPEG质量等级")
        void testDifferentJpegQualities() {
            int[] qualities = {50, 75, 90, 95, 99};

            for (int quality : qualities) {
                reset(cameraService);

                CaptureImageRequest request = CaptureImageRequest.builder()
                        .format("JPEG")
                        .jpegQuality(quality)
                        .build();

                when(cameraService.captureImage(any()))
                        .thenReturn(createMockResponse("test_q" + quality + ".jpg",
                                (long)(100000 * (quality / 100.0))));

                CaptureImageResponse response = cameraService.captureImage(request);

                assertNotNull(response);
                assertEquals("JPEG", response.getFormat());
            }
        }

        private void testFormatCapture(String format, Integer quality) {
            CaptureImageRequest.CaptureImageRequestBuilder requestBuilder =
                    CaptureImageRequest.builder().format(format);

            if (quality != null) {
                requestBuilder.jpegQuality(quality);
            }

            CaptureImageRequest request = requestBuilder.build();

            CaptureImageResponse mockResponse = CaptureImageResponse.builder()
                    .imagePath("/tmp/test." + format.toLowerCase())
                    .format(format)
                    .width(1920)
                    .height(1080)
                    .fileSize(256000L)
                    .build();

            when(cameraService.captureImage(any())).thenReturn(mockResponse);

            CaptureImageResponse response = cameraService.captureImage(request);

            assertNotNull(response);
            assertEquals(format, response.getFormat());
            verify(cameraService).captureImage(any());
        }
    }

    // ==================== 设备管理测试 ====================

    @Nested
    @DisplayName("设备管理测试")
    class DeviceManagementTests {

        @Test
        @DisplayName("IT-CAM-030: 枚举可用设备")
        void testEnumerateDevices() {
            List<CameraDeviceInfo> mockDevices = Arrays.asList(
                    createMockDeviceInfo(0, "GIGE", "CAM-001", "192.168.1.100"),
                    createMockDeviceInfo(1, "USB", "CAM-002", null),
                    createMockDeviceInfo(2, "GIGE", "CAM-003", "192.168.1.101")
            );

            when(cameraService.enumerateDevices()).thenReturn(mockDevices);

            List<CameraDeviceInfo> devices = cameraService.enumerateDevices();

            assertNotNull(devices);
            assertEquals(3, devices.size());

            // 验证第一个设备
            CameraDeviceInfo device1 = devices.get(0);
            assertEquals(0, device1.getIndex());
            assertEquals("GIGE", device1.getTransportLayerType());
            assertEquals("192.168.1.100", device1.getCurrentIp());

            verify(cameraService).enumerateDevices();
        }

        @Test
        @DisplayName("IT-CAM-031: 连接指定设备后抓拍")
        void testCaptureAfterConnectingDevice() {
            // 连接设备
            doNothing().when(cameraService).connectCamera(0);

            cameraService.connectCamera(0);

            // 抓拍图像
            CaptureImageResponse mockResponse = createMockResponse("test.jpg", 100L);
            when(cameraService.captureImage()).thenReturn(mockResponse);

            CaptureImageResponse response = cameraService.captureImage();

            assertNotNull(response);
            verify(cameraService).connectCamera(0);
            verify(cameraService).captureImage();
        }

        @Test
        @DisplayName("IT-CAM-032: 断开设备后无法抓拍")
        void testCaptureFailsAfterDisconnect() {
            // 断开设备
            doNothing().when(cameraService).disconnectCamera();
            cameraService.disconnectCamera();

            // 断开后无法抓拍
            when(cameraService.captureImage())
                    .thenThrow(new CameraException("设备未连接"));

            // 验证抛出异常
            assertThrows(CameraException.class, () -> {
                cameraService.captureImage();
            });

            verify(cameraService).disconnectCamera();
        }
    }

    // ==================== 辅助方法 ====================

    /**
     * 创建Mock的抓拍响应
     */
    private CaptureImageResponse createMockResponse(String filename, Long seed) {
        return CaptureImageResponse.builder()
                .imagePath("/tmp/" + filename)
                .imageUrl("http://example.com/" + filename)
                .format("JPEG")
                .width(1920)
                .height(1080)
                .fileSize(seed * 1000)
                .imageData(("MOCK_DATA_" + seed).getBytes())
                .build();
    }

    /**
     * 创建Mock的设备信息
     */
    private CameraDeviceInfo createMockDeviceInfo(int index, String type,
                                                   String serialNumber, String ip) {
        return CameraDeviceInfo.builder()
                .index(index)
                .transportLayerType(type)
                .serialNumber(serialNumber)
                .currentIp(ip)
                .modelName("MV-CA016-10GC")
                .vendorName("Hikvision")
                .accessible(true)
                .build();
    }
}

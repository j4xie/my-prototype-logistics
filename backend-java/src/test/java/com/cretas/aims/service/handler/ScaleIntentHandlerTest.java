package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.entity.config.AIIntentConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * ScaleIntentHandler 路由测试
 *
 * 验证主处理器正确将意图路由到子处理器:
 * - ScaleDeviceIntentHandler: 设备管理 (6个意图)
 * - ScaleProtocolIntentHandler: 协议管理 (5个意图)
 * - ScaleTroubleshootIntentHandler: 故障排查 (2个意图)
 *
 * 测试覆盖:
 * - UT-SIH-001~006: 设备意图路由
 * - UT-SIH-007~011: 协议意图路由
 * - UT-SIH-012~013: 故障排查意图路由
 * - UT-SIH-014: 未知意图处理
 *
 * @author Cretas Team
 * @since 2026-01-06
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ScaleIntentHandler 路由测试")
class ScaleIntentHandlerTest {

    @Mock
    private ScaleDeviceIntentHandler deviceHandler;

    @Mock
    private ScaleProtocolIntentHandler protocolHandler;

    @Mock
    private ScaleTroubleshootIntentHandler troubleshootHandler;

    private ScaleIntentHandler scaleIntentHandler;

    // 测试常量
    private static final String FACTORY_ID = "F001";
    private static final Long USER_ID = 1L;
    private static final String USER_ROLE = "factory_super_admin";

    @BeforeEach
    void setUp() {
        scaleIntentHandler = new ScaleIntentHandler(deviceHandler, protocolHandler, troubleshootHandler);
    }

    // ==================== 基础方法测试 ====================

    @Nested
    @DisplayName("基础方法测试")
    class BasicMethodTests {

        @Test
        @DisplayName("getSupportedCategory() 返回 'SCALE'")
        void testGetSupportedCategory() {
            assertEquals("SCALE", scaleIntentHandler.getSupportedCategory());
        }

        @Test
        @DisplayName("supportsSemanticsMode() 返回 true")
        void testSupportsSemanticsMode() {
            assertTrue(scaleIntentHandler.supportsSemanticsMode());
        }
    }

    // ==================== 设备意图路由测试 ====================

    @Nested
    @DisplayName("设备意图路由测试")
    class DeviceIntentRoutingTests {

        @Test
        @DisplayName("UT-SIH-001: SCALE_ADD_DEVICE 路由到 ScaleDeviceIntentHandler")
        void testScaleAddDeviceRouting() {
            // Arrange
            IntentExecuteRequest request = createRequest("添加一台柯力D2008电子秤");
            AIIntentConfig config = createConfig("SCALE_ADD_DEVICE", "添加秤设备");

            IntentExecuteResponse expectedResponse = createSuccessResponse("SCALE_ADD_DEVICE", "设备添加成功");
            when(deviceHandler.handleAddDevice(eq(FACTORY_ID), any(), any(), eq(USER_ID)))
                    .thenReturn(expectedResponse);

            // Act
            IntentExecuteResponse result = scaleIntentHandler.handle(FACTORY_ID, request, config, USER_ID, USER_ROLE);

            // Assert
            verify(deviceHandler, times(1)).handleAddDevice(eq(FACTORY_ID), any(), any(), eq(USER_ID));
            verifyNoInteractions(protocolHandler, troubleshootHandler);
            assertEquals(expectedResponse, result);
        }

        @Test
        @DisplayName("UT-SIH-002: SCALE_ADD_DEVICE_VISION 路由到 ScaleDeviceIntentHandler")
        void testScaleAddDeviceVisionRouting() {
            // Arrange
            IntentExecuteRequest request = createRequest("识别这张秤的铭牌图片");
            AIIntentConfig config = createConfig("SCALE_ADD_DEVICE_VISION", "图像识别添加设备");

            IntentExecuteResponse expectedResponse = createSuccessResponse("SCALE_ADD_DEVICE_VISION", "图像识别成功");
            when(deviceHandler.handleAddDeviceVision(eq(FACTORY_ID), any(), any(), eq(USER_ID)))
                    .thenReturn(expectedResponse);

            // Act
            IntentExecuteResponse result = scaleIntentHandler.handle(FACTORY_ID, request, config, USER_ID, USER_ROLE);

            // Assert
            verify(deviceHandler, times(1)).handleAddDeviceVision(eq(FACTORY_ID), any(), any(), eq(USER_ID));
            verifyNoInteractions(protocolHandler, troubleshootHandler);
            assertEquals(expectedResponse, result);
        }

        @Test
        @DisplayName("UT-SIH-003: SCALE_LIST_DEVICES 路由到 ScaleDeviceIntentHandler")
        void testScaleListDevicesRouting() {
            // Arrange
            IntentExecuteRequest request = createRequest("查看所有电子秤设备");
            AIIntentConfig config = createConfig("SCALE_LIST_DEVICES", "列出秤设备");

            IntentExecuteResponse expectedResponse = createSuccessResponse("SCALE_LIST_DEVICES", "查询成功");
            when(deviceHandler.handleListDevices(eq(FACTORY_ID), any(), any()))
                    .thenReturn(expectedResponse);

            // Act
            IntentExecuteResponse result = scaleIntentHandler.handle(FACTORY_ID, request, config, USER_ID, USER_ROLE);

            // Assert
            verify(deviceHandler, times(1)).handleListDevices(eq(FACTORY_ID), any(), any());
            verifyNoInteractions(protocolHandler, troubleshootHandler);
            assertEquals(expectedResponse, result);
        }

        @Test
        @DisplayName("UT-SIH-004: SCALE_DEVICE_DETAIL 路由到 ScaleDeviceIntentHandler")
        void testScaleDeviceDetailRouting() {
            // Arrange
            IntentExecuteRequest request = createRequest("查看秤 SCALE-001 的详情");
            AIIntentConfig config = createConfig("SCALE_DEVICE_DETAIL", "秤设备详情");

            IntentExecuteResponse expectedResponse = createSuccessResponse("SCALE_DEVICE_DETAIL", "查询成功");
            when(deviceHandler.handleDeviceDetail(eq(FACTORY_ID), any(), any()))
                    .thenReturn(expectedResponse);

            // Act
            IntentExecuteResponse result = scaleIntentHandler.handle(FACTORY_ID, request, config, USER_ID, USER_ROLE);

            // Assert
            verify(deviceHandler, times(1)).handleDeviceDetail(eq(FACTORY_ID), any(), any());
            verifyNoInteractions(protocolHandler, troubleshootHandler);
            assertEquals(expectedResponse, result);
        }

        @Test
        @DisplayName("UT-SIH-005: SCALE_UPDATE_DEVICE 路由到 ScaleDeviceIntentHandler")
        void testScaleUpdateDeviceRouting() {
            // Arrange
            IntentExecuteRequest request = createRequest("更新秤 SCALE-001 的配置");
            AIIntentConfig config = createConfig("SCALE_UPDATE_DEVICE", "更新秤设备");

            IntentExecuteResponse expectedResponse = createSuccessResponse("SCALE_UPDATE_DEVICE", "更新成功");
            when(deviceHandler.handleUpdateDevice(eq(FACTORY_ID), any(), any(), eq(USER_ID)))
                    .thenReturn(expectedResponse);

            // Act
            IntentExecuteResponse result = scaleIntentHandler.handle(FACTORY_ID, request, config, USER_ID, USER_ROLE);

            // Assert
            verify(deviceHandler, times(1)).handleUpdateDevice(eq(FACTORY_ID), any(), any(), eq(USER_ID));
            verifyNoInteractions(protocolHandler, troubleshootHandler);
            assertEquals(expectedResponse, result);
        }

        @Test
        @DisplayName("UT-SIH-006: SCALE_DELETE_DEVICE 路由到 ScaleDeviceIntentHandler")
        void testScaleDeleteDeviceRouting() {
            // Arrange
            IntentExecuteRequest request = createRequest("删除秤 SCALE-001");
            AIIntentConfig config = createConfig("SCALE_DELETE_DEVICE", "删除秤设备");

            IntentExecuteResponse expectedResponse = createSuccessResponse("SCALE_DELETE_DEVICE", "删除成功");
            when(deviceHandler.handleDeleteDevice(eq(FACTORY_ID), any(), any(), eq(USER_ID)))
                    .thenReturn(expectedResponse);

            // Act
            IntentExecuteResponse result = scaleIntentHandler.handle(FACTORY_ID, request, config, USER_ID, USER_ROLE);

            // Assert
            verify(deviceHandler, times(1)).handleDeleteDevice(eq(FACTORY_ID), any(), any(), eq(USER_ID));
            verifyNoInteractions(protocolHandler, troubleshootHandler);
            assertEquals(expectedResponse, result);
        }
    }

    // ==================== 协议意图路由测试 ====================

    @Nested
    @DisplayName("协议意图路由测试")
    class ProtocolIntentRoutingTests {

        @Test
        @DisplayName("UT-SIH-007: SCALE_ADD_MODEL 路由到 ScaleProtocolIntentHandler")
        void testScaleAddModelRouting() {
            // Arrange
            IntentExecuteRequest request = createRequest("添加新型号 柯力 D2009");
            AIIntentConfig config = createConfig("SCALE_ADD_MODEL", "添加秤型号");

            IntentExecuteResponse expectedResponse = createSuccessResponse("SCALE_ADD_MODEL", "型号添加成功");
            when(protocolHandler.handleAddModel(eq(FACTORY_ID), any(), any(), eq(USER_ID)))
                    .thenReturn(expectedResponse);

            // Act
            IntentExecuteResponse result = scaleIntentHandler.handle(FACTORY_ID, request, config, USER_ID, USER_ROLE);

            // Assert
            verify(protocolHandler, times(1)).handleAddModel(eq(FACTORY_ID), any(), any(), eq(USER_ID));
            verifyNoInteractions(deviceHandler, troubleshootHandler);
            assertEquals(expectedResponse, result);
        }

        @Test
        @DisplayName("UT-SIH-008: SCALE_PROTOCOL_DETECT 路由到 ScaleProtocolIntentHandler")
        void testScaleProtocolDetectRouting() {
            // Arrange
            IntentExecuteRequest request = createRequest("识别这个数据的协议 02 2B 30 30 30 30 31 32 33 34 03");
            AIIntentConfig config = createConfig("SCALE_PROTOCOL_DETECT", "协议自动识别");

            IntentExecuteResponse expectedResponse = createSuccessResponse("SCALE_PROTOCOL_DETECT", "协议识别成功");
            when(protocolHandler.handleProtocolDetect(eq(FACTORY_ID), any(), any()))
                    .thenReturn(expectedResponse);

            // Act
            IntentExecuteResponse result = scaleIntentHandler.handle(FACTORY_ID, request, config, USER_ID, USER_ROLE);

            // Assert
            verify(protocolHandler, times(1)).handleProtocolDetect(eq(FACTORY_ID), any(), any());
            verifyNoInteractions(deviceHandler, troubleshootHandler);
            assertEquals(expectedResponse, result);
        }

        @Test
        @DisplayName("UT-SIH-009: SCALE_LIST_PROTOCOLS 路由到 ScaleProtocolIntentHandler")
        void testScaleListProtocolsRouting() {
            // Arrange
            IntentExecuteRequest request = createRequest("查看所有可用的协议列表");
            AIIntentConfig config = createConfig("SCALE_LIST_PROTOCOLS", "列出协议");

            IntentExecuteResponse expectedResponse = createSuccessResponse("SCALE_LIST_PROTOCOLS", "查询成功");
            when(protocolHandler.handleListProtocols(eq(FACTORY_ID), any(), any()))
                    .thenReturn(expectedResponse);

            // Act
            IntentExecuteResponse result = scaleIntentHandler.handle(FACTORY_ID, request, config, USER_ID, USER_ROLE);

            // Assert
            verify(protocolHandler, times(1)).handleListProtocols(eq(FACTORY_ID), any(), any());
            verifyNoInteractions(deviceHandler, troubleshootHandler);
            assertEquals(expectedResponse, result);
        }

        @Test
        @DisplayName("UT-SIH-010: SCALE_TEST_PARSE 路由到 ScaleProtocolIntentHandler")
        void testScaleTestParseRouting() {
            // Arrange
            IntentExecuteRequest request = createRequest("测试解析这个数据");
            AIIntentConfig config = createConfig("SCALE_TEST_PARSE", "测试解析");

            IntentExecuteResponse expectedResponse = createSuccessResponse("SCALE_TEST_PARSE", "解析成功");
            when(protocolHandler.handleTestParse(eq(FACTORY_ID), any(), any()))
                    .thenReturn(expectedResponse);

            // Act
            IntentExecuteResponse result = scaleIntentHandler.handle(FACTORY_ID, request, config, USER_ID, USER_ROLE);

            // Assert
            verify(protocolHandler, times(1)).handleTestParse(eq(FACTORY_ID), any(), any());
            verifyNoInteractions(deviceHandler, troubleshootHandler);
            assertEquals(expectedResponse, result);
        }

        @Test
        @DisplayName("UT-SIH-011: SCALE_CONFIG_GENERATE 路由到 ScaleProtocolIntentHandler")
        void testScaleConfigGenerateRouting() {
            // Arrange
            IntentExecuteRequest request = createRequest("生成协议配置");
            AIIntentConfig config = createConfig("SCALE_CONFIG_GENERATE", "生成配置");

            IntentExecuteResponse expectedResponse = createSuccessResponse("SCALE_CONFIG_GENERATE", "配置生成成功");
            when(protocolHandler.handleConfigGenerate(eq(FACTORY_ID), any(), any()))
                    .thenReturn(expectedResponse);

            // Act
            IntentExecuteResponse result = scaleIntentHandler.handle(FACTORY_ID, request, config, USER_ID, USER_ROLE);

            // Assert
            verify(protocolHandler, times(1)).handleConfigGenerate(eq(FACTORY_ID), any(), any());
            verifyNoInteractions(deviceHandler, troubleshootHandler);
            assertEquals(expectedResponse, result);
        }
    }

    // ==================== 故障排查意图路由测试 ====================

    @Nested
    @DisplayName("故障排查意图路由测试")
    class TroubleshootIntentRoutingTests {

        @Test
        @DisplayName("UT-SIH-012: SCALE_TROUBLESHOOT 路由到 ScaleTroubleshootIntentHandler")
        void testScaleTroubleshootRouting() {
            // Arrange
            IntentExecuteRequest request = createRequest("电子秤显示不稳定怎么办");
            AIIntentConfig config = createConfig("SCALE_TROUBLESHOOT", "故障排查");

            IntentExecuteResponse expectedResponse = createSuccessResponse("SCALE_TROUBLESHOOT", "排查建议");
            when(troubleshootHandler.handleTroubleshoot(eq(FACTORY_ID), any(), any()))
                    .thenReturn(expectedResponse);

            // Act
            IntentExecuteResponse result = scaleIntentHandler.handle(FACTORY_ID, request, config, USER_ID, USER_ROLE);

            // Assert
            verify(troubleshootHandler, times(1)).handleTroubleshoot(eq(FACTORY_ID), any(), any());
            verifyNoInteractions(deviceHandler, protocolHandler);
            assertEquals(expectedResponse, result);
        }

        @Test
        @DisplayName("UT-SIH-013: SCALE_CALIBRATE 路由到 ScaleTroubleshootIntentHandler")
        void testScaleCalibrateRouting() {
            // Arrange
            IntentExecuteRequest request = createRequest("如何校准电子秤");
            AIIntentConfig config = createConfig("SCALE_CALIBRATE", "秤校准");

            IntentExecuteResponse expectedResponse = createSuccessResponse("SCALE_CALIBRATE", "校准指导");
            when(troubleshootHandler.handleCalibrate(eq(FACTORY_ID), any(), any()))
                    .thenReturn(expectedResponse);

            // Act
            IntentExecuteResponse result = scaleIntentHandler.handle(FACTORY_ID, request, config, USER_ID, USER_ROLE);

            // Assert
            verify(troubleshootHandler, times(1)).handleCalibrate(eq(FACTORY_ID), any(), any());
            verifyNoInteractions(deviceHandler, protocolHandler);
            assertEquals(expectedResponse, result);
        }
    }

    // ==================== 未知意图测试 ====================

    @Nested
    @DisplayName("未知意图测试")
    class UnknownIntentTests {

        @Test
        @DisplayName("UT-SIH-014: 未知意图返回错误响应")
        void testUnknownIntentReturnsError() {
            // Arrange
            IntentExecuteRequest request = createRequest("未知操作");
            AIIntentConfig config = createConfig("UNKNOWN_INTENT", "未知意图");

            // Act
            IntentExecuteResponse result = scaleIntentHandler.handle(FACTORY_ID, request, config, USER_ID, USER_ROLE);

            // Assert
            verifyNoInteractions(deviceHandler, protocolHandler, troubleshootHandler);
            assertNotNull(result);
            assertEquals("FAILED", result.getStatus());
            assertTrue(result.getMessage().contains("不支持的意图代码"));
            assertTrue(result.getMessage().contains("UNKNOWN_INTENT"));
        }

        @ParameterizedTest
        @DisplayName("多个未知意图代码都返回错误")
        @ValueSource(strings = {"INVALID_CODE", "SCALE_UNKNOWN", "RANDOM_INTENT", ""})
        void testMultipleUnknownIntentsReturnError(String intentCode) {
            // Arrange
            IntentExecuteRequest request = createRequest("测试");
            AIIntentConfig config = createConfig(intentCode, "测试意图");

            // Act
            IntentExecuteResponse result = scaleIntentHandler.handle(FACTORY_ID, request, config, USER_ID, USER_ROLE);

            // Assert
            verifyNoInteractions(deviceHandler, protocolHandler, troubleshootHandler);
            assertEquals("FAILED", result.getStatus());
        }
    }

    // ==================== Preview 方法测试 ====================

    @Nested
    @DisplayName("Preview 方法测试")
    class PreviewTests {

        @Test
        @DisplayName("preview() 返回预览响应")
        void testPreviewReturnsPreviewResponse() {
            // Arrange
            IntentExecuteRequest request = createRequest("添加电子秤");
            AIIntentConfig config = createConfig("SCALE_ADD_DEVICE", "添加秤设备");

            // Act
            IntentExecuteResponse result = scaleIntentHandler.preview(FACTORY_ID, request, config, USER_ID, USER_ROLE);

            // Assert
            assertNotNull(result);
            assertEquals("PREVIEW", result.getStatus());
            assertEquals("SCALE_ADD_DEVICE", result.getIntentCode());
            assertNotNull(result.getConfirmableAction());
            assertNotNull(result.getConfirmableAction().getConfirmToken());
            assertEquals(300, result.getConfirmableAction().getExpiresInSeconds());
        }

        @Test
        @DisplayName("preview() 包含正确的预览消息")
        void testPreviewContainsCorrectMessage() {
            // Arrange
            IntentExecuteRequest request = createRequest("删除秤");
            AIIntentConfig config = createConfig("SCALE_DELETE_DEVICE", "删除秤设备");

            // Act
            IntentExecuteResponse result = scaleIntentHandler.preview(FACTORY_ID, request, config, USER_ID, USER_ROLE);

            // Assert
            assertTrue(result.getMessage().contains("删除"));
        }
    }

    // ==================== 异常处理测试 ====================

    @Nested
    @DisplayName("异常处理测试")
    class ExceptionHandlingTests {

        @Test
        @DisplayName("子处理器抛出异常时返回失败响应")
        void testExceptionHandling() {
            // Arrange
            IntentExecuteRequest request = createRequest("添加秤");
            AIIntentConfig config = createConfig("SCALE_ADD_DEVICE", "添加秤设备");

            when(deviceHandler.handleAddDevice(any(), any(), any(), any()))
                    .thenThrow(new RuntimeException("数据库连接失败"));

            // Act
            IntentExecuteResponse result = scaleIntentHandler.handle(FACTORY_ID, request, config, USER_ID, USER_ROLE);

            // Assert
            assertNotNull(result);
            assertEquals("FAILED", result.getStatus());
            assertTrue(result.getMessage().contains("执行失败"));
        }
    }

    // ==================== Helper Methods ====================

    private IntentExecuteRequest createRequest(String userInput) {
        IntentExecuteRequest request = new IntentExecuteRequest();
        request.setUserInput(userInput);
        return request;
    }

    private AIIntentConfig createConfig(String intentCode, String intentName) {
        AIIntentConfig config = new AIIntentConfig();
        config.setIntentCode(intentCode);
        config.setIntentName(intentName);
        config.setIntentCategory("SCALE");
        return config;
    }

    private IntentExecuteResponse createSuccessResponse(String intentCode, String message) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentCode)
                .intentCategory("SCALE")
                .status("SUCCESS")
                .message(message)
                .executedAt(LocalDateTime.now())
                .build();
    }
}

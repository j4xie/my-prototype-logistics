package com.cretas.aims.service.calibration;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.ai.dto.ChatCompletionRequest;
import com.cretas.aims.ai.dto.ChatCompletionResponse;
import com.cretas.aims.config.DashScopeConfig;
import com.cretas.aims.entity.calibration.ReflectionMemory;
import com.cretas.aims.repository.calibration.ReflectionMemoryRepository;
import com.cretas.aims.service.calibration.impl.CorrectionAgentServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * 纠错 Agent 服务单元测试
 *
 * 测试基于 CRITIC + Reflexion 论文的纠错逻辑：
 * 1. 外部验证结果处理
 * 2. LLM 纠错响应解析
 * 3. 反思记忆存储
 * 4. 重试决策逻辑
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CorrectionAgentServiceTest {

    @Mock
    private DashScopeClient dashScopeClient;

    @Mock
    private DashScopeConfig dashScopeConfig;

    @Mock
    private ReflectionMemoryRepository reflectionMemoryRepository;

    private CorrectionAgentServiceImpl correctionAgentService;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        correctionAgentService = new CorrectionAgentServiceImpl(
                dashScopeClient,
                dashScopeConfig,
                reflectionMemoryRepository,
                objectMapper
        );

        // 配置默认的纠错模型
        when(dashScopeConfig.getCorrectionModel()).thenReturn("qwen-turbo");
    }

    /**
     * 创建模拟的 ChatCompletionResponse
     */
    private ChatCompletionResponse createMockResponse(String content) {
        ChatCompletionResponse.Message message = new ChatCompletionResponse.Message();
        message.setRole("assistant");
        message.setContent(content);

        ChatCompletionResponse.Choice choice = new ChatCompletionResponse.Choice();
        choice.setIndex(0);
        choice.setMessage(message);
        choice.setFinishReason("stop");

        ChatCompletionResponse response = new ChatCompletionResponse();
        response.setId("test-id");
        response.setObject("chat.completion");
        response.setModel("qwen-turbo");
        response.setChoices(List.of(choice));

        return response;
    }

    /**
     * 创建带错误的模拟响应
     */
    private ChatCompletionResponse createErrorResponse(String errorMessage) {
        ChatCompletionResponse.Error error = new ChatCompletionResponse.Error();
        error.setMessage(errorMessage);
        error.setType("error");

        ChatCompletionResponse response = new ChatCompletionResponse();
        response.setError(error);

        return response;
    }

    // ==================== 正常纠错场景测试 ====================

    @Test
    @DisplayName("测试：正常纠错 - 扩大时间范围策略")
    void testAnalyzeAndCorrect_ExpandRangeStrategy() {
        // Given: 模拟 LLM 返回扩大时间范围的纠错建议
        String llmResponse = """
            ```json
            {
                "errorAnalysis": "查询时间范围太窄，2026-01-19当天没有数据",
                "correctionStrategy": "EXPAND_RANGE",
                "correctedParams": {
                    "startDate": "2026-01-01",
                    "endDate": "2026-01-19",
                    "materialType": "带鱼"
                },
                "reflection": "当查询单日无数据时，应自动扩展到近期范围",
                "confidence": 0.85
            }
            ```
            """;

        ChatCompletionResponse mockResponse = createMockResponse(llmResponse);

        when(dashScopeClient.chatCompletion(any(ChatCompletionRequest.class)))
                .thenReturn(mockResponse);
        when(reflectionMemoryRepository.findByToolNameOrderByCreatedAtDesc(anyString()))
                .thenReturn(Collections.emptyList());

        // When: 调用纠错 Agent
        Map<String, Object> originalParams = new HashMap<>();
        originalParams.put("startDate", "2026-01-19");
        originalParams.put("endDate", "2026-01-19");
        originalParams.put("materialType", "带鱼");

        ExternalVerifierService.VerificationResult verificationResult =
                new ExternalVerifierService.VerificationResult(
                        false, 0, "NO_DATA",
                        Map.of("suggestion", "建议扩大查询时间范围"),
                        "建议查询更大的时间范围"
                );

        CorrectionAgentService.CorrectionResult result = correctionAgentService.analyzeAndCorrect(
                "查一下今天的带鱼库存",
                "material_batch_query",
                originalParams,
                "查询结果为空",
                verificationResult,
                1
        );

        // Then: 验证纠错结果
        assertTrue(result.shouldRetry(), "应该建议重试");
        assertEquals("EXPAND_RANGE", result.correctionStrategy());
        assertEquals(0.85, result.confidence(), 0.01);
        assertNotNull(result.correctedParams());
        assertEquals("2026-01-01", result.correctedParams().get("startDate"));
        assertEquals("2026-01-19", result.correctedParams().get("endDate"));
        assertNotNull(result.reflection());

        // 验证反思被保存
        verify(reflectionMemoryRepository).save(any(ReflectionMemory.class));
    }

    @Test
    @DisplayName("测试：正常纠错 - 修正参数格式策略")
    void testAnalyzeAndCorrect_FixFormatStrategy() {
        // Given: 模拟日期格式错误的纠错
        String llmResponse = """
            {
                "errorAnalysis": "日期格式错误，应使用 YYYY-MM-DD 格式",
                "correctionStrategy": "FIX_FORMAT",
                "correctedParams": {
                    "startDate": "2026-01-15",
                    "endDate": "2026-01-19"
                },
                "reflection": "日期参数必须是 YYYY-MM-DD 格式，不能使用中文日期",
                "confidence": 0.95
            }
            """;

        ChatCompletionResponse mockResponse = createMockResponse(llmResponse);

        when(dashScopeClient.chatCompletion(any(ChatCompletionRequest.class)))
                .thenReturn(mockResponse);
        when(reflectionMemoryRepository.findByToolNameOrderByCreatedAtDesc(anyString()))
                .thenReturn(Collections.emptyList());

        // When
        Map<String, Object> originalParams = new HashMap<>();
        originalParams.put("startDate", "1月15日");
        originalParams.put("endDate", "1月19日");

        CorrectionAgentService.CorrectionResult result = correctionAgentService.analyzeAndCorrect(
                "查一下1月15日到19日的库存",
                "material_batch_query",
                originalParams,
                "日期解析失败: Invalid date format",
                null,
                1
        );

        // Then
        assertTrue(result.shouldRetry());
        assertEquals("FIX_FORMAT", result.correctionStrategy());
        assertEquals(0.95, result.confidence(), 0.01);
        assertEquals("2026-01-15", result.correctedParams().get("startDate"));
    }

    @Test
    @DisplayName("测试：正常纠错 - 更换查询条件策略")
    void testAnalyzeAndCorrect_ChangeConditionStrategy() {
        // Given: 模拟更换查询条件的纠错
        String llmResponse = """
            {
                "errorAnalysis": "批次号不存在，但根据上下文可能是想查物料类型",
                "correctionStrategy": "CHANGE_CONDITION",
                "correctedParams": {
                    "materialType": "带鱼",
                    "status": "AVAILABLE"
                },
                "reflection": "当批次号查询失败时，尝试按物料类型查询",
                "confidence": 0.72
            }
            """;

        ChatCompletionResponse mockResponse = createMockResponse(llmResponse);

        when(dashScopeClient.chatCompletion(any(ChatCompletionRequest.class)))
                .thenReturn(mockResponse);
        when(reflectionMemoryRepository.findByToolNameOrderByCreatedAtDesc(anyString()))
                .thenReturn(Collections.emptyList());

        // When
        Map<String, Object> originalParams = new HashMap<>();
        originalParams.put("batchNumber", "NOT_EXIST_BATCH_123");

        ExternalVerifierService.VerificationResult verificationResult =
                new ExternalVerifierService.VerificationResult(
                        false, 0, "BATCH_NOT_FOUND",
                        Map.of("similarBatches", List.of()),
                        "批次号不存在，建议按物料类型查询"
                );

        CorrectionAgentService.CorrectionResult result = correctionAgentService.analyzeAndCorrect(
                "查一下带鱼批次NOT_EXIST_BATCH_123的信息",
                "material_batch_query",
                originalParams,
                "批次不存在",
                verificationResult,
                1
        );

        // Then
        assertTrue(result.shouldRetry());
        assertEquals("CHANGE_CONDITION", result.correctionStrategy());
        assertEquals("带鱼", result.correctedParams().get("materialType"));
    }

    // ==================== 放弃重试场景测试 ====================

    @Test
    @DisplayName("测试：低置信度 - 放弃重试")
    void testAnalyzeAndCorrect_LowConfidence_NoRetry() {
        // Given: 模拟低置信度的响应
        String llmResponse = """
            {
                "errorAnalysis": "无法确定错误原因",
                "correctionStrategy": "RE_QUERY",
                "correctedParams": {
                    "startDate": "2026-01-01"
                },
                "reflection": "错误原因不明确",
                "confidence": 0.25
            }
            """;

        ChatCompletionResponse mockResponse = createMockResponse(llmResponse);

        when(dashScopeClient.chatCompletion(any(ChatCompletionRequest.class)))
                .thenReturn(mockResponse);
        when(reflectionMemoryRepository.findByToolNameOrderByCreatedAtDesc(anyString()))
                .thenReturn(Collections.emptyList());

        // When
        CorrectionAgentService.CorrectionResult result = correctionAgentService.analyzeAndCorrect(
                "查询",
                "material_batch_query",
                new HashMap<>(),
                "未知错误",
                null,
                1
        );

        // Then: 置信度低于 0.3 应该不重试
        assertFalse(result.shouldRetry(), "低置信度不应重试");
    }

    @Test
    @DisplayName("测试：ABANDON 策略 - 放弃重试")
    void testAnalyzeAndCorrect_AbandonStrategy_NoRetry() {
        // Given: 模拟 LLM 建议放弃
        String llmResponse = """
            {
                "errorAnalysis": "权限不足，无法执行此操作",
                "correctionStrategy": "ABANDON",
                "correctedParams": null,
                "reflection": "权限错误无法通过参数修正解决",
                "confidence": 0.90
            }
            """;

        ChatCompletionResponse mockResponse = createMockResponse(llmResponse);

        when(dashScopeClient.chatCompletion(any(ChatCompletionRequest.class)))
                .thenReturn(mockResponse);
        when(reflectionMemoryRepository.findByToolNameOrderByCreatedAtDesc(anyString()))
                .thenReturn(Collections.emptyList());

        // When
        CorrectionAgentService.CorrectionResult result = correctionAgentService.analyzeAndCorrect(
                "删除所有数据",
                "dangerous_operation",
                new HashMap<>(),
                "Permission denied",
                null,
                1
        );

        // Then
        assertFalse(result.shouldRetry(), "ABANDON 策略不应重试");
    }

    @Test
    @DisplayName("测试：超过最大重试次数 - 放弃重试")
    void testShouldRetry_MaxRetriesExceeded() {
        // When
        boolean shouldRetry = correctionAgentService.shouldRetry(
                "查询失败",
                null,
                3  // MAX_RETRIES = 3
        );

        // Then
        assertFalse(shouldRetry, "超过最大重试次数不应重试");
    }

    @Test
    @DisplayName("测试：权限错误 - 不重试")
    void testShouldRetry_PermissionDenied() {
        // When
        boolean shouldRetry = correctionAgentService.shouldRetry(
                "Permission denied: insufficient privileges",
                null,
                1
        );

        // Then
        assertFalse(shouldRetry, "权限错误不应重试");
    }

    @Test
    @DisplayName("测试：API Key 错误 - 不重试")
    void testShouldRetry_ApiKeyError() {
        // When
        boolean shouldRetry = correctionAgentService.shouldRetry(
                "Invalid API key provided",
                null,
                1
        );

        // Then
        assertFalse(shouldRetry, "API Key 错误不应重试");
    }

    @Test
    @DisplayName("测试：表为空 - 不重试")
    void testShouldRetry_TableEmpty() {
        // Given
        ExternalVerifierService.VerificationResult verificationResult =
                new ExternalVerifierService.VerificationResult(
                        false, 0, "TABLE_EMPTY",
                        Map.of(),
                        "表中没有任何数据"
                );

        // When
        boolean shouldRetry = correctionAgentService.shouldRetry(
                "查询结果为空",
                verificationResult,
                1
        );

        // Then
        assertFalse(shouldRetry, "表为空时不应重试");
    }

    // ==================== 历史反思测试 ====================

    @Test
    @DisplayName("测试：获取历史反思记录")
    void testGetHistoricalReflections() {
        // Given
        ReflectionMemory memory1 = ReflectionMemory.builder()
                .toolName("material_batch_query")
                .originalError("日期格式错误")
                .reflectionContent("使用 YYYY-MM-DD 格式")
                .wasSuccessful(true)
                .build();

        ReflectionMemory memory2 = ReflectionMemory.builder()
                .toolName("material_batch_query")
                .originalError("批次不存在")
                .reflectionContent("尝试按物料类型查询")
                .wasSuccessful(false)
                .build();

        when(reflectionMemoryRepository.findByToolNameOrderByCreatedAtDesc("material_batch_query"))
                .thenReturn(List.of(memory1, memory2));

        // When
        String reflections = correctionAgentService.getHistoricalReflections(
                null, "material_batch_query", 3);

        // Then
        assertNotNull(reflections);
        assertTrue(reflections.contains("成功"));
        assertTrue(reflections.contains("失败"));
        assertTrue(reflections.contains("YYYY-MM-DD"));
    }

    @Test
    @DisplayName("测试：无历史反思记录")
    void testGetHistoricalReflections_Empty() {
        // Given
        when(reflectionMemoryRepository.findByToolNameOrderByCreatedAtDesc("new_tool"))
                .thenReturn(Collections.emptyList());

        // When
        String reflections = correctionAgentService.getHistoricalReflections(
                null, "new_tool", 3);

        // Then
        assertEquals("无历史反思记录", reflections);
    }

    // ==================== 异常处理测试 ====================

    @Test
    @DisplayName("测试：LLM 调用失败 - 返回不重试")
    void testAnalyzeAndCorrect_LlmCallFailed() {
        // Given
        when(dashScopeClient.chatCompletion(any(ChatCompletionRequest.class)))
                .thenReturn(null);
        when(reflectionMemoryRepository.findByToolNameOrderByCreatedAtDesc(anyString()))
                .thenReturn(Collections.emptyList());

        // When
        CorrectionAgentService.CorrectionResult result = correctionAgentService.analyzeAndCorrect(
                "测试",
                "test_tool",
                new HashMap<>(),
                "测试错误",
                null,
                1
        );

        // Then
        assertFalse(result.shouldRetry(), "LLM 调用失败不应重试");
    }

    @Test
    @DisplayName("测试：LLM 返回错误 - 返回不重试")
    void testAnalyzeAndCorrect_LlmReturnError() {
        // Given
        ChatCompletionResponse errorResponse = createErrorResponse("Rate limit exceeded");

        when(dashScopeClient.chatCompletion(any(ChatCompletionRequest.class)))
                .thenReturn(errorResponse);
        when(reflectionMemoryRepository.findByToolNameOrderByCreatedAtDesc(anyString()))
                .thenReturn(Collections.emptyList());

        // When
        CorrectionAgentService.CorrectionResult result = correctionAgentService.analyzeAndCorrect(
                "测试",
                "test_tool",
                new HashMap<>(),
                "测试错误",
                null,
                1
        );

        // Then
        assertFalse(result.shouldRetry(), "LLM 返回错误不应重试");
    }

    @Test
    @DisplayName("测试：无法解析 JSON - 返回不重试")
    void testAnalyzeAndCorrect_InvalidJsonResponse() {
        // Given
        ChatCompletionResponse mockResponse = createMockResponse("这不是 JSON 格式的响应");

        when(dashScopeClient.chatCompletion(any(ChatCompletionRequest.class)))
                .thenReturn(mockResponse);
        when(reflectionMemoryRepository.findByToolNameOrderByCreatedAtDesc(anyString()))
                .thenReturn(Collections.emptyList());

        // When
        CorrectionAgentService.CorrectionResult result = correctionAgentService.analyzeAndCorrect(
                "测试",
                "test_tool",
                new HashMap<>(),
                "测试错误",
                null,
                1
        );

        // Then
        assertFalse(result.shouldRetry(), "无法解析响应不应重试");
    }

    // ==================== Prompt 构建验证 ====================

    @Test
    @DisplayName("测试：验证 Prompt 包含关键信息")
    void testPromptContainsKeyInfo() {
        // Given
        ArgumentCaptor<ChatCompletionRequest> requestCaptor =
                ArgumentCaptor.forClass(ChatCompletionRequest.class);

        String llmResponse = "{\"errorAnalysis\":\"test\",\"correctionStrategy\":\"ABANDON\",\"confidence\":0.5}";
        ChatCompletionResponse mockResponse = createMockResponse(llmResponse);

        when(dashScopeClient.chatCompletion(requestCaptor.capture()))
                .thenReturn(mockResponse);
        when(reflectionMemoryRepository.findByToolNameOrderByCreatedAtDesc(anyString()))
                .thenReturn(Collections.emptyList());

        Map<String, Object> params = new HashMap<>();
        params.put("batchNumber", "MB-2026-001");
        params.put("startDate", "2026-01-01");

        ExternalVerifierService.VerificationResult verificationResult =
                new ExternalVerifierService.VerificationResult(
                        true, 5, "DATA_FOUND",
                        Map.of("recentRecords", 5),
                        "数据存在但不匹配条件"
                );

        // When
        correctionAgentService.analyzeAndCorrect(
                "查一下批次MB-2026-001的信息",
                "material_batch_query",
                params,
                "No matching records",
                verificationResult,
                1
        );

        // Then: 验证 Prompt 内容
        ChatCompletionRequest capturedRequest = requestCaptor.getValue();
        assertNotNull(capturedRequest);
        assertEquals("qwen-turbo", capturedRequest.getModel());

        String prompt = (String) capturedRequest.getMessages().get(0).getContent();

        // 验证 Prompt 包含关键信息
        assertTrue(prompt.contains("查一下批次MB-2026-001的信息"), "应包含用户意图");
        assertTrue(prompt.contains("material_batch_query"), "应包含工具名称");
        assertTrue(prompt.contains("MB-2026-001"), "应包含原始参数");
        assertTrue(prompt.contains("No matching records"), "应包含错误信息");
        assertTrue(prompt.contains("DATA_FOUND"), "应包含验证结果");
        assertTrue(prompt.contains("RE_QUERY") || prompt.contains("EXPAND_RANGE"), "应包含策略说明");
    }

    // ==================== 反思保存验证 ====================

    @Test
    @DisplayName("测试：验证反思正确保存")
    void testReflectionSavedCorrectly() {
        // Given
        ArgumentCaptor<ReflectionMemory> memoryCaptor =
                ArgumentCaptor.forClass(ReflectionMemory.class);

        String llmResponse = """
            {
                "errorAnalysis": "时间范围太窄",
                "correctionStrategy": "EXPAND_RANGE",
                "correctedParams": {"startDate": "2026-01-01"},
                "reflection": "扩大时间范围可以获取更多数据",
                "confidence": 0.88
            }
            """;

        ChatCompletionResponse mockResponse = createMockResponse(llmResponse);

        when(dashScopeClient.chatCompletion(any(ChatCompletionRequest.class)))
                .thenReturn(mockResponse);
        when(reflectionMemoryRepository.findByToolNameOrderByCreatedAtDesc(anyString()))
                .thenReturn(Collections.emptyList());

        // When
        correctionAgentService.analyzeAndCorrect(
                "测试查询",
                "material_batch_query",
                new HashMap<>(),
                "查询失败",
                null,
                1
        );

        // Then
        verify(reflectionMemoryRepository).save(memoryCaptor.capture());
        ReflectionMemory savedMemory = memoryCaptor.getValue();

        assertEquals("material_batch_query", savedMemory.getToolName());
        assertEquals("查询失败", savedMemory.getOriginalError());
        assertEquals("扩大时间范围可以获取更多数据", savedMemory.getReflectionContent());
        assertEquals("EXPAND_RANGE", savedMemory.getCorrectionStrategy());
        assertEquals(0.88, savedMemory.getConfidence(), 0.01);
        assertFalse(savedMemory.isWasSuccessful(), "初始应为未成功");
    }

    // ==================== 边界条件测试 ====================

    @Test
    @DisplayName("测试：空响应内容 - 返回不重试")
    void testAnalyzeAndCorrect_EmptyContent() {
        // Given
        ChatCompletionResponse mockResponse = createMockResponse("");

        when(dashScopeClient.chatCompletion(any(ChatCompletionRequest.class)))
                .thenReturn(mockResponse);
        when(reflectionMemoryRepository.findByToolNameOrderByCreatedAtDesc(anyString()))
                .thenReturn(Collections.emptyList());

        // When
        CorrectionAgentService.CorrectionResult result = correctionAgentService.analyzeAndCorrect(
                "测试",
                "test_tool",
                new HashMap<>(),
                "测试错误",
                null,
                1
        );

        // Then
        assertFalse(result.shouldRetry(), "空响应不应重试");
    }

    @Test
    @DisplayName("测试：正常可重试场景 - 首次尝试")
    void testShouldRetry_FirstAttempt_Retryable() {
        // When
        boolean shouldRetry = correctionAgentService.shouldRetry(
                "Connection timeout",
                null,
                1
        );

        // Then
        assertTrue(shouldRetry, "首次尝试的可重试错误应该重试");
    }
}

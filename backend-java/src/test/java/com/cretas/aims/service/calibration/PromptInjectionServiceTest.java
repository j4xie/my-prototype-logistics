package com.cretas.aims.service.calibration;

import com.cretas.aims.dto.calibration.FailureType;
import com.cretas.aims.dto.calibration.RecoveryPrompt;
import com.cretas.aims.entity.calibration.CorrectionRecord;
import com.cretas.aims.entity.calibration.ToolCallRecord;
import com.cretas.aims.repository.calibration.CorrectionRecordRepository;
import com.cretas.aims.repository.calibration.ToolCallRecordRepository;
import com.cretas.aims.service.calibration.impl.PromptInjectionServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 提示注入服务单元测试
 *
 * 测试 PromptInjectionService 的核心功能：
 * 1. 失败类型分析 - analyzeFailure
 * 2. 恢复提示生成 - generateRecoveryPrompt
 * 3. 替代工具推荐 - suggestAlternativeTools
 * 4. 参数修复建议 - suggestParameterFixes
 * 5. 恢复决策逻辑 - shouldAttemptRecovery
 * 6. 快速恢复 - quickRecover
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("PromptInjectionService 单元测试")
class PromptInjectionServiceTest {

    @Mock
    private ToolCallRecordRepository toolCallRecordRepository;

    @Mock
    private CorrectionRecordRepository correctionRecordRepository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private PromptInjectionServiceImpl promptInjectionService;

    private static final String TEST_FACTORY_ID = "F001";
    private static final String TEST_SESSION_ID = "session-123";
    private static final Long TEST_TOOL_CALL_ID = 1L;

    @BeforeEach
    void setUp() {
        // 每个测试前的初始化
    }

    // ==================== 失败类型分析测试 ====================

    @Nested
    @DisplayName("analyzeFailure - 失败类型分析")
    class AnalyzeFailureTests {

        @ParameterizedTest
        @DisplayName("参数错误类型识别")
        @CsvSource({
            "PARAMETER_ERROR, 参数格式不正确",
            "INVALID_PARAM, Invalid parameter: startDate",
            ", 缺少必填参数 batchId",
            ", missing required field: quantity"
        })
        void analyzeFailure_ParameterErrors(String errorType, String errorMessage) {
            FailureType result = promptInjectionService.analyzeFailure(errorType, errorMessage);
            assertEquals(FailureType.PARAMETER_ERROR, result);
        }

        @ParameterizedTest
        @DisplayName("权限错误类型识别")
        @CsvSource({
            "FORBIDDEN, 权限不足无法执行此操作",
            "UNAUTHORIZED, Access denied",
            ", 无权访问该资源",
            ", Forbidden: insufficient privileges"
        })
        void analyzeFailure_PermissionErrors(String errorType, String errorMessage) {
            FailureType result = promptInjectionService.analyzeFailure(errorType, errorMessage);
            assertEquals(FailureType.PERMISSION_ERROR, result);
        }

        @ParameterizedTest
        @DisplayName("服务不可用类型识别")
        @CsvSource({
            "TIMEOUT, 请求超时",
            "SERVICE_ERROR, Service unavailable",
            ", 连接失败请重试",
            ", Connection refused to database"
        })
        void analyzeFailure_ServiceUnavailable(String errorType, String errorMessage) {
            FailureType result = promptInjectionService.analyzeFailure(errorType, errorMessage);
            assertEquals(FailureType.SERVICE_UNAVAILABLE, result);
        }

        @ParameterizedTest
        @DisplayName("数据未找到类型识别")
        @CsvSource({
            "NOT_FOUND, 批次未找到",
            ", 数据不存在",
            ", No data available for the given criteria",
            ", Empty result set"
        })
        void analyzeFailure_DataNotFound(String errorType, String errorMessage) {
            FailureType result = promptInjectionService.analyzeFailure(errorType, errorMessage);
            assertEquals(FailureType.DATA_NOT_FOUND, result);
        }

        @ParameterizedTest
        @DisplayName("验证失败类型识别")
        @CsvSource({
            "VALIDATION_ERROR, 数据验证失败",
            ", 日期格式错误",
            ", Validation failed: invalid email format",
            ", 数值不合法"
        })
        void analyzeFailure_ValidationErrors(String errorType, String errorMessage) {
            FailureType result = promptInjectionService.analyzeFailure(errorType, errorMessage);
            assertEquals(FailureType.VALIDATION_ERROR, result);
        }

        @ParameterizedTest
        @DisplayName("业务逻辑错误类型识别")
        @CsvSource({
            "BUSINESS_ERROR, 业务异常：订单已完成",
            ", 操作不允许：库存不足",
            ", 状态不允许此操作",
            ", 流程错误：需要先完成质检"
        })
        void analyzeFailure_BusinessErrors(String errorType, String errorMessage) {
            FailureType result = promptInjectionService.analyzeFailure(errorType, errorMessage);
            assertEquals(FailureType.BUSINESS_ERROR, result);
        }

        @ParameterizedTest
        @DisplayName("资源冲突类型识别")
        @CsvSource({
            "CONFLICT, 资源冲突",
            ", 批次号已存在",
            ", Duplicate key: batchNumber",
            ", 记录重复"
        })
        void analyzeFailure_ResourceConflict(String errorType, String errorMessage) {
            FailureType result = promptInjectionService.analyzeFailure(errorType, errorMessage);
            assertEquals(FailureType.RESOURCE_CONFLICT, result);
        }

        @Test
        @DisplayName("未知错误返回 UNKNOWN")
        void analyzeFailure_Unknown_ShouldReturnUnknown() {
            FailureType result = promptInjectionService.analyzeFailure("RANDOM", "一些随机错误消息");
            assertEquals(FailureType.UNKNOWN, result);
        }

        @Test
        @DisplayName("空输入返回 UNKNOWN")
        void analyzeFailure_NullInputs_ShouldReturnUnknown() {
            assertEquals(FailureType.UNKNOWN, promptInjectionService.analyzeFailure(null, null));
            assertEquals(FailureType.UNKNOWN, promptInjectionService.analyzeFailure("", ""));
        }
    }

    // ==================== 恢复提示生成测试 ====================

    @Nested
    @DisplayName("generateRecoveryPrompt - 恢复提示生成")
    class GenerateRecoveryPromptTests {

        @Test
        @DisplayName("参数错误 - 生成包含参数检查指导的提示")
        void generateRecoveryPrompt_ParameterError_ShouldContainParamGuidance() {
            RecoveryPrompt prompt = promptInjectionService.generateRecoveryPrompt(
                FailureType.PARAMETER_ERROR,
                "MaterialBatchQueryTool",
                "{\"startDate\": \"invalid\"}",
                "日期格式不正确"
            );

            assertNotNull(prompt);
            assertNotNull(prompt.getSystemPrompt());
            assertTrue(prompt.getSystemPrompt().contains("参数"));
            assertTrue(prompt.isShouldRetry());
            assertEquals(FailureType.PARAMETER_ERROR, prompt.getFailureType());
            assertEquals("MaterialBatchQueryTool", prompt.getFailedToolName());
        }

        @Test
        @DisplayName("数据未找到 - 生成扩大搜索范围的建议")
        void generateRecoveryPrompt_DataNotFound_ShouldSuggestBroaderSearch() {
            RecoveryPrompt prompt = promptInjectionService.generateRecoveryPrompt(
                FailureType.DATA_NOT_FOUND,
                "MaterialBatchQueryTool",
                "{\"batchNumber\": \"NOT_EXIST\"}",
                "批次未找到"
            );

            assertNotNull(prompt);
            assertNotNull(prompt.getSuggestions());
            assertTrue(prompt.getSuggestions().size() > 0);
            assertTrue(prompt.getSuggestions().stream()
                .anyMatch(s -> s.contains("扩大") || s.contains("范围") || s.contains("条件")));
        }

        @Test
        @DisplayName("服务不可用 - 建议重试或使用替代工具")
        void generateRecoveryPrompt_ServiceUnavailable_ShouldSuggestRetryOrAlternative() {
            RecoveryPrompt prompt = promptInjectionService.generateRecoveryPrompt(
                FailureType.SERVICE_UNAVAILABLE,
                "MaterialBatchQueryTool",
                "{}",
                "服务超时"
            );

            assertNotNull(prompt);
            assertTrue(prompt.isShouldRetry());
            assertNotNull(prompt.getSuggestions());
            assertTrue(prompt.getSuggestions().stream()
                .anyMatch(s -> s.contains("重试") || s.contains("替代")));
        }

        @Test
        @DisplayName("权限错误 - 不可自动恢复需要用户确认")
        void generateRecoveryPrompt_PermissionError_ShouldRequireConfirmation() {
            RecoveryPrompt prompt = promptInjectionService.generateRecoveryPrompt(
                FailureType.PERMISSION_ERROR,
                "DeleteBatchTool",
                "{}",
                "权限不足"
            );

            assertNotNull(prompt);
            assertFalse(prompt.isShouldRetry());
            assertTrue(prompt.isRequiresUserConfirmation());
            assertNotNull(prompt.getUserConfirmationPrompt());
        }

        @Test
        @DisplayName("带上下文生成 - 应包含原始查询")
        void generateRecoveryPromptWithContext_ShouldIncludeOriginalQuery() {
            String originalQuery = "查询今天的带鱼库存";
            Map<String, Object> context = Map.of("factoryId", "F001");

            RecoveryPrompt prompt = promptInjectionService.generateRecoveryPromptWithContext(
                FailureType.DATA_NOT_FOUND,
                "MaterialBatchQueryTool",
                "{\"materialType\": \"带鱼\"}",
                "未找到数据",
                originalQuery,
                context
            );

            assertNotNull(prompt);
            assertNotNull(prompt.getUserPrompt());
            assertTrue(prompt.getUserPrompt().contains(originalQuery));
        }

        @Test
        @DisplayName("生成提示应包含最大重试次数")
        void generateRecoveryPrompt_ShouldIncludeMaxRetryCount() {
            RecoveryPrompt prompt = promptInjectionService.generateRecoveryPrompt(
                FailureType.PARAMETER_ERROR,
                "TestTool",
                "{}",
                "错误"
            );

            assertEquals(PromptInjectionService.MAX_RETRY_ATTEMPTS, prompt.getMaxRetryCount());
        }
    }

    // ==================== 替代工具推荐测试 ====================

    @Nested
    @DisplayName("suggestAlternativeTools - 替代工具推荐")
    class SuggestAlternativeToolsTests {

        @Test
        @DisplayName("物料类工具 - 应推荐其他物料工具")
        void suggestAlternativeTools_MaterialTool_ShouldSuggestMaterialAlternatives() {
            List<String> alternatives = promptInjectionService.suggestAlternativeTools("MaterialBatchQueryTool");

            assertNotNull(alternatives);
            assertFalse(alternatives.isEmpty());
            assertFalse(alternatives.contains("MaterialBatchQueryTool"));
            assertTrue(alternatives.stream().allMatch(t -> t.contains("Material") || t.contains("Batch")));
        }

        @Test
        @DisplayName("质检类工具 - 应推荐其他质检工具")
        void suggestAlternativeTools_QualityTool_ShouldSuggestQualityAlternatives() {
            List<String> alternatives = promptInjectionService.suggestAlternativeTools("QualityCheckQueryTool");

            assertNotNull(alternatives);
            assertFalse(alternatives.isEmpty());
            assertTrue(alternatives.stream().allMatch(t -> t.contains("Quality")));
        }

        @Test
        @DisplayName("设备类工具 - 应推荐其他设备工具")
        void suggestAlternativeTools_EquipmentTool_ShouldSuggestEquipmentAlternatives() {
            List<String> alternatives = promptInjectionService.suggestAlternativeTools("EquipmentListTool");

            assertNotNull(alternatives);
            assertFalse(alternatives.isEmpty());
            assertTrue(alternatives.stream().allMatch(t -> t.contains("Equipment")));
        }

        @Test
        @DisplayName("空工具名 - 返回空列表")
        void suggestAlternativeTools_NullOrEmpty_ShouldReturnEmptyList() {
            assertTrue(promptInjectionService.suggestAlternativeTools(null).isEmpty());
            assertTrue(promptInjectionService.suggestAlternativeTools("").isEmpty());
        }

        @Test
        @DisplayName("替代工具数量限制 - 最多返回3个")
        void suggestAlternativeTools_ShouldLimitToThree() {
            List<String> alternatives = promptInjectionService.suggestAlternativeTools("MaterialBatchQueryTool");
            assertTrue(alternatives.size() <= 3);
        }
    }

    // ==================== 参数修复建议测试 ====================

    @Nested
    @DisplayName("suggestParameterFixes - 参数修复建议")
    class SuggestParameterFixesTests {

        @Test
        @DisplayName("缺少必填参数 - 应识别并建议")
        void suggestParameterFixes_MissingRequired_ShouldSuggestFix() {
            Map<String, Object> fixes = promptInjectionService.suggestParameterFixes(
                "MaterialBatchQueryTool",
                "{\"startDate\": \"2026-01-01\"}",
                "missing required: batchId"
            );

            assertNotNull(fixes);
            assertTrue(fixes.containsKey("batchId"), "fixes should contain 'batchId' key, actual keys: " + fixes.keySet());
            @SuppressWarnings("unchecked")
            Map<String, Object> fix = (Map<String, Object>) fixes.get("batchId");
            assertEquals("缺少必填参数", fix.get("issue"));
        }

        @Test
        @DisplayName("日期格式错误 - 应提供日期格式建议")
        void suggestParameterFixes_DateFormatError_ShouldSuggestDateFormat() {
            Map<String, Object> fixes = promptInjectionService.suggestParameterFixes(
                "MaterialBatchQueryTool",
                "{\"startDate\": \"2026/01/01\"}",
                "日期格式错误"
            );

            assertNotNull(fixes);
            assertTrue(fixes.containsKey("_dateFormat"));
            @SuppressWarnings("unchecked")
            Map<String, Object> fix = (Map<String, Object>) fixes.get("_dateFormat");
            assertTrue(((String) fix.get("suggestion")).contains("yyyy-MM-dd"));
        }

        @Test
        @DisplayName("数字格式错误 - 应提供数字格式建议")
        void suggestParameterFixes_NumberFormatError_ShouldSuggestNumberFormat() {
            Map<String, Object> fixes = promptInjectionService.suggestParameterFixes(
                "MaterialBatchQueryTool",
                "{\"quantity\": \"abc\"}",
                "数字格式错误: quantity"
            );

            assertNotNull(fixes);
            assertTrue(fixes.containsKey("_numberFormat"));
        }

        @Test
        @DisplayName("空错误消息 - 返回空修复建议")
        void suggestParameterFixes_EmptyErrorMessage_ShouldReturnEmpty() {
            Map<String, Object> fixes = promptInjectionService.suggestParameterFixes(
                "TestTool",
                "{}",
                null
            );

            assertNotNull(fixes);
            assertTrue(fixes.isEmpty());
        }
    }

    // ==================== 恢复决策测试 ====================

    @Nested
    @DisplayName("shouldAttemptRecovery - 恢复决策")
    class ShouldAttemptRecoveryTests {

        @Test
        @DisplayName("首次失败 - 应允许恢复")
        void shouldAttemptRecovery_FirstFailure_ShouldAllowRecovery() {
            ToolCallRecord record = ToolCallRecord.builder()
                .id(TEST_TOOL_CALL_ID)
                .toolName("MaterialBatchQueryTool")
                .factoryId(TEST_FACTORY_ID)
                .sessionId(TEST_SESSION_ID)
                .retryCount(0)
                .errorType("PARAMETER_ERROR")
                .errorMessage("参数错误")
                .executionStatus(ToolCallRecord.ExecutionStatus.FAILED)
                .build();

            when(toolCallRecordRepository.findById(TEST_TOOL_CALL_ID)).thenReturn(Optional.of(record));

            boolean result = promptInjectionService.shouldAttemptRecovery(TEST_TOOL_CALL_ID);

            assertTrue(result);
        }

        @Test
        @DisplayName("已达最大重试次数 - 不允许恢复")
        void shouldAttemptRecovery_MaxRetriesReached_ShouldNotAllowRecovery() {
            ToolCallRecord record = ToolCallRecord.builder()
                .id(TEST_TOOL_CALL_ID)
                .toolName("MaterialBatchQueryTool")
                .retryCount(PromptInjectionService.MAX_RETRY_ATTEMPTS)
                .errorType("PARAMETER_ERROR")
                .errorMessage("参数错误")
                .build();

            when(toolCallRecordRepository.findById(TEST_TOOL_CALL_ID)).thenReturn(Optional.of(record));

            boolean result = promptInjectionService.shouldAttemptRecovery(TEST_TOOL_CALL_ID);

            assertFalse(result);
        }

        @Test
        @DisplayName("不可恢复的错误类型 - 不允许恢复")
        void shouldAttemptRecovery_UnrecoverableError_ShouldNotAllowRecovery() {
            ToolCallRecord record = ToolCallRecord.builder()
                .id(TEST_TOOL_CALL_ID)
                .toolName("DeleteTool")
                .retryCount(0)
                .errorType("PERMISSION_ERROR")
                .errorMessage("权限不足")
                .build();

            when(toolCallRecordRepository.findById(TEST_TOOL_CALL_ID)).thenReturn(Optional.of(record));

            boolean result = promptInjectionService.shouldAttemptRecovery(TEST_TOOL_CALL_ID);

            assertFalse(result);
        }

        @Test
        @DisplayName("记录不存在 - 不允许恢复")
        void shouldAttemptRecovery_RecordNotFound_ShouldNotAllowRecovery() {
            when(toolCallRecordRepository.findById(TEST_TOOL_CALL_ID)).thenReturn(Optional.empty());

            boolean result = promptInjectionService.shouldAttemptRecovery(TEST_TOOL_CALL_ID);

            assertFalse(result);
        }

        @Test
        @DisplayName("空 ID - 不允许恢复")
        void shouldAttemptRecovery_NullId_ShouldNotAllowRecovery() {
            boolean result = promptInjectionService.shouldAttemptRecovery(null);

            assertFalse(result);
        }
    }

    // ==================== 快速恢复测试 ====================

    @Nested
    @DisplayName("quickRecover - 快速恢复")
    class QuickRecoverTests {

        @Test
        @DisplayName("可恢复错误 - 应返回恢复提示")
        void quickRecover_RecoverableError_ShouldReturnPrompt() {
            ToolCallRecord record = ToolCallRecord.builder()
                .id(TEST_TOOL_CALL_ID)
                .toolName("MaterialBatchQueryTool")
                .retryCount(0)
                .errorType("PARAMETER_ERROR")
                .errorMessage("参数错误")
                .build();

            when(toolCallRecordRepository.findById(TEST_TOOL_CALL_ID)).thenReturn(Optional.of(record));

            RecoveryPrompt prompt = promptInjectionService.quickRecover(
                TEST_TOOL_CALL_ID,
                "MaterialBatchQueryTool",
                "{\"startDate\": \"invalid\"}",
                "PARAMETER_ERROR",
                "日期格式不正确"
            );

            assertNotNull(prompt);
            assertTrue(prompt.isShouldRetry());
            assertEquals(FailureType.PARAMETER_ERROR, prompt.getFailureType());
        }

        @Test
        @DisplayName("不可恢复错误 - 应返回 unrecoverable 提示")
        void quickRecover_UnrecoverableError_ShouldReturnUnrecoverable() {
            RecoveryPrompt prompt = promptInjectionService.quickRecover(
                null,
                "DeleteTool",
                "{}",
                "PERMISSION_ERROR",
                "权限不足"
            );

            assertNotNull(prompt);
            assertFalse(prompt.isShouldRetry());
            assertEquals(FailureType.PERMISSION_ERROR, prompt.getFailureType());
        }

        @Test
        @DisplayName("无 toolCallId - 仍应生成恢复提示")
        void quickRecover_NullToolCallId_ShouldStillGeneratePrompt() {
            RecoveryPrompt prompt = promptInjectionService.quickRecover(
                null,
                "MaterialBatchQueryTool",
                "{}",
                "DATA_NOT_FOUND",
                "未找到数据"
            );

            assertNotNull(prompt);
            assertTrue(prompt.isShouldRetry());
            assertEquals(FailureType.DATA_NOT_FOUND, prompt.getFailureType());
        }
    }

    // ==================== 恢复尝试记录测试 ====================

    @Nested
    @DisplayName("recordRecoveryAttempt - 恢复尝试记录")
    class RecordRecoveryAttemptTests {

        @Test
        @DisplayName("成功恢复 - 应更新记录状态")
        void recordRecoveryAttempt_Success_ShouldUpdateStatus() {
            ToolCallRecord record = ToolCallRecord.builder()
                .id(TEST_TOOL_CALL_ID)
                .toolName("MaterialBatchQueryTool")
                .factoryId(TEST_FACTORY_ID)
                .sessionId(TEST_SESSION_ID)
                .retryCount(0)
                .executionStatus(ToolCallRecord.ExecutionStatus.FAILED)
                .build();

            RecoveryPrompt prompt = RecoveryPrompt.builder()
                .failureType(FailureType.PARAMETER_ERROR)
                .systemPrompt("测试系统提示")
                .originalError("测试错误")
                .currentRetryCount(0)
                .build();

            when(toolCallRecordRepository.findById(TEST_TOOL_CALL_ID)).thenReturn(Optional.of(record));
            when(toolCallRecordRepository.save(any(ToolCallRecord.class))).thenReturn(record);
            when(correctionRecordRepository.save(any(CorrectionRecord.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

            promptInjectionService.recordRecoveryAttempt(TEST_TOOL_CALL_ID, prompt, true);

            verify(toolCallRecordRepository).save(any(ToolCallRecord.class));
            verify(correctionRecordRepository).save(argThat(r ->
                r.getCorrectionSuccess() && "RECOVERED".equals(r.getFinalStatus())
            ));
        }

        @Test
        @DisplayName("恢复失败 - 应记录失败状态")
        void recordRecoveryAttempt_Failure_ShouldRecordFailure() {
            ToolCallRecord record = ToolCallRecord.builder()
                .id(TEST_TOOL_CALL_ID)
                .toolName("MaterialBatchQueryTool")
                .factoryId(TEST_FACTORY_ID)
                .sessionId(TEST_SESSION_ID)
                .retryCount(1)
                .executionStatus(ToolCallRecord.ExecutionStatus.FAILED)
                .build();

            RecoveryPrompt prompt = RecoveryPrompt.builder()
                .failureType(FailureType.PARAMETER_ERROR)
                .systemPrompt("测试系统提示")
                .originalError("测试错误")
                .currentRetryCount(1)
                .build();

            when(toolCallRecordRepository.findById(TEST_TOOL_CALL_ID)).thenReturn(Optional.of(record));
            when(toolCallRecordRepository.save(any(ToolCallRecord.class))).thenReturn(record);
            when(correctionRecordRepository.save(any(CorrectionRecord.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

            promptInjectionService.recordRecoveryAttempt(TEST_TOOL_CALL_ID, prompt, false);

            verify(correctionRecordRepository).save(argThat(r ->
                !r.getCorrectionSuccess() && "FAILED".equals(r.getFinalStatus())
            ));
        }

        @Test
        @DisplayName("空 toolCallId - 不应抛出异常")
        void recordRecoveryAttempt_NullId_ShouldNotThrow() {
            RecoveryPrompt prompt = RecoveryPrompt.builder()
                .failureType(FailureType.PARAMETER_ERROR)
                .build();

            assertDoesNotThrow(() ->
                promptInjectionService.recordRecoveryAttempt(null, prompt, true)
            );

            verify(toolCallRecordRepository, never()).save(any());
            verify(correctionRecordRepository, never()).save(any());
        }
    }

    // ==================== 恢复成功率测试 ====================

    @Nested
    @DisplayName("getRecoverySuccessRate - 恢复成功率")
    class GetRecoverySuccessRateTests {

        @Test
        @DisplayName("有历史数据 - 应计算正确的成功率")
        void getRecoverySuccessRate_WithHistory_ShouldCalculateCorrectly() {
            CorrectionRecord successRecord = CorrectionRecord.builder().correctionSuccess(true).build();
            CorrectionRecord failRecord = CorrectionRecord.builder().correctionSuccess(false).build();

            List<CorrectionRecord> records = List.of(
                successRecord, successRecord, successRecord, successRecord, successRecord,
                successRecord, successRecord, failRecord, failRecord, failRecord
            );

            when(correctionRecordRepository.findByErrorCategory(any(), any()))
                .thenReturn(new PageImpl<>(records));

            Double rate = promptInjectionService.getRecoverySuccessRate(
                "MaterialBatchQueryTool", FailureType.PARAMETER_ERROR);

            assertNotNull(rate);
            assertEquals(0.7, rate, 0.01);
        }

        @Test
        @DisplayName("无历史数据 - 应返回 null")
        void getRecoverySuccessRate_NoHistory_ShouldReturnNull() {
            when(correctionRecordRepository.findByErrorCategory(any(), any()))
                .thenReturn(new PageImpl<>(Collections.emptyList()));

            Double rate = promptInjectionService.getRecoverySuccessRate(
                "MaterialBatchQueryTool", FailureType.PARAMETER_ERROR);

            assertNull(rate);
        }

        @Test
        @DisplayName("空输入 - 应返回 null")
        void getRecoverySuccessRate_NullInputs_ShouldReturnNull() {
            assertNull(promptInjectionService.getRecoverySuccessRate(null, FailureType.PARAMETER_ERROR));
            assertNull(promptInjectionService.getRecoverySuccessRate("Tool", null));
        }
    }

    // ==================== FailureType 枚举测试 ====================

    @Nested
    @DisplayName("FailureType - 枚举属性测试")
    class FailureTypeEnumTests {

        @Test
        @DisplayName("PERMISSION_ERROR 应不可恢复")
        void permissionError_ShouldNotBeRecoverable() {
            assertFalse(FailureType.PERMISSION_ERROR.isRecoverable());
        }

        @Test
        @DisplayName("PARAMETER_ERROR 应可恢复")
        void parameterError_ShouldBeRecoverable() {
            assertTrue(FailureType.PARAMETER_ERROR.isRecoverable());
        }

        @Test
        @DisplayName("所有类型应有非空描述和提示")
        void allTypes_ShouldHaveDescriptionAndHint() {
            for (FailureType type : FailureType.values()) {
                assertNotNull(type.getCode());
                assertNotNull(type.getDescription());
                assertNotNull(type.getDefaultRecoveryHint());
                assertFalse(type.getDescription().isEmpty());
                assertFalse(type.getDefaultRecoveryHint().isEmpty());
            }
        }
    }

    // ==================== RecoveryPrompt DTO 测试 ====================

    @Nested
    @DisplayName("RecoveryPrompt - DTO 功能测试")
    class RecoveryPromptDTOTests {

        @Test
        @DisplayName("canRetry - 未达最大重试且允许重试应返回 true")
        void canRetry_BelowMaxAndShouldRetry_ShouldReturnTrue() {
            RecoveryPrompt prompt = RecoveryPrompt.builder()
                .shouldRetry(true)
                .currentRetryCount(1)
                .maxRetryCount(3)
                .build();

            assertTrue(prompt.canRetry());
        }

        @Test
        @DisplayName("canRetry - 达到最大重试应返回 false")
        void canRetry_AtMaxRetry_ShouldReturnFalse() {
            RecoveryPrompt prompt = RecoveryPrompt.builder()
                .shouldRetry(true)
                .currentRetryCount(3)
                .maxRetryCount(3)
                .build();

            assertFalse(prompt.canRetry());
        }

        @Test
        @DisplayName("hasAlternativeTool - 有替代工具应返回 true")
        void hasAlternativeTool_WithAlternative_ShouldReturnTrue() {
            RecoveryPrompt prompt = RecoveryPrompt.builder()
                .alternativeTool("AlternativeTool")
                .build();

            assertTrue(prompt.hasAlternativeTool());
        }

        @Test
        @DisplayName("hasParameterFixes - 有修复建议应返回 true")
        void hasParameterFixes_WithFixes_ShouldReturnTrue() {
            RecoveryPrompt prompt = RecoveryPrompt.builder()
                .parameterFixes(Map.of("param1", "fix1"))
                .build();

            assertTrue(prompt.hasParameterFixes());
        }

        @Test
        @DisplayName("静态工厂方法 - simple 应正确创建")
        void simpleFactory_ShouldCreateCorrectly() {
            RecoveryPrompt prompt = RecoveryPrompt.simple(
                "系统提示",
                "用户提示",
                List.of("建议1", "建议2")
            );

            assertEquals("系统提示", prompt.getSystemPrompt());
            assertEquals("用户提示", prompt.getUserPrompt());
            assertEquals(2, prompt.getSuggestions().size());
            assertTrue(prompt.isShouldRetry());
        }

        @Test
        @DisplayName("静态工厂方法 - unrecoverable 应正确创建")
        void unrecoverableFactory_ShouldCreateCorrectly() {
            RecoveryPrompt prompt = RecoveryPrompt.unrecoverable(
                "无法恢复的原因",
                FailureType.PERMISSION_ERROR
            );

            assertFalse(prompt.isShouldRetry());
            assertEquals(FailureType.PERMISSION_ERROR, prompt.getFailureType());
        }
    }
}

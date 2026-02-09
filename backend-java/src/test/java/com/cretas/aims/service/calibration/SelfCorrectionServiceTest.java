package com.cretas.aims.service.calibration;

import com.cretas.aims.entity.calibration.CorrectionRecord;
import com.cretas.aims.entity.calibration.CorrectionRecord.CorrectionStrategy;
import com.cretas.aims.entity.calibration.CorrectionRecord.ErrorCategory;
import com.cretas.aims.repository.calibration.CorrectionRecordRepository;
import com.cretas.aims.service.calibration.impl.SelfCorrectionServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 自我纠错服务单元测试
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("SelfCorrectionService 单元测试")
class SelfCorrectionServiceTest {

    @Mock
    private CorrectionRecordRepository correctionRecordRepository;

    @InjectMocks
    private SelfCorrectionServiceImpl selfCorrectionService;

    private static final String TEST_SESSION_ID = "test-session-123";
    private static final String TEST_FACTORY_ID = "F001";
    private static final Long TEST_TOOL_CALL_ID = 1L;

    @BeforeEach
    void setUp() {
        // 每个测试前的初始化
    }

    @ParameterizedTest
    @DisplayName("错误分类 - 数据不足类错误")
    @CsvSource({
        "数据不完整,DATA_INSUFFICIENT",
        "信息不足,DATA_INSUFFICIENT",
        "未找到相关数据,DATA_INSUFFICIENT",
        "数据为空,DATA_INSUFFICIENT",
        "no results,DATA_INSUFFICIENT"
    })
    void classifyError_DataInsufficientErrors(String errorMessage, String expectedCategory) {
        ErrorCategory result = selfCorrectionService.classifyError(errorMessage, null);
        assertEquals(ErrorCategory.valueOf(expectedCategory), result);
    }

    @ParameterizedTest
    @DisplayName("错误分类 - 格式错误类")
    @CsvSource({
        "格式错误,FORMAT_ERROR",
        "解析失败,FORMAT_ERROR",
        "JSON错误,FORMAT_ERROR",
        "格式不正确,FORMAT_ERROR"
    })
    void classifyError_FormatErrors(String errorMessage, String expectedCategory) {
        ErrorCategory result = selfCorrectionService.classifyError(errorMessage, null);
        assertEquals(ErrorCategory.valueOf(expectedCategory), result);
    }

    @ParameterizedTest
    @DisplayName("错误分类 - 分析错误类")
    @CsvSource({
        "分析错误,ANALYSIS_ERROR",
        "计算错误,ANALYSIS_ERROR",
        "统计失败,ANALYSIS_ERROR",
        "结果异常,ANALYSIS_ERROR"
    })
    void classifyError_AnalysisErrors(String errorMessage, String expectedCategory) {
        ErrorCategory result = selfCorrectionService.classifyError(errorMessage, null);
        assertEquals(ErrorCategory.valueOf(expectedCategory), result);
    }

    @ParameterizedTest
    @DisplayName("错误分类 - 逻辑错误类")
    @CsvSource({
        "逻辑错误,LOGIC_ERROR",
        "规则冲突,LOGIC_ERROR",
        "条件不满足,LOGIC_ERROR",
        "推理失败,LOGIC_ERROR"
    })
    void classifyError_LogicErrors(String errorMessage, String expectedCategory) {
        ErrorCategory result = selfCorrectionService.classifyError(errorMessage, null);
        assertEquals(ErrorCategory.valueOf(expectedCategory), result);
    }

    @Test
    @DisplayName("错误分类 - 未知错误返回UNKNOWN")
    void classifyError_UnknownError_ShouldReturnUnknown() {
        ErrorCategory result = selfCorrectionService.classifyError("某个随机错误消息", null);
        assertEquals(ErrorCategory.UNKNOWN, result);
    }

    @Test
    @DisplayName("错误分类 - 空消息返回UNKNOWN")
    void classifyError_EmptyMessage_ShouldReturnUnknown() {
        assertEquals(ErrorCategory.UNKNOWN, selfCorrectionService.classifyError(null, null));
        assertEquals(ErrorCategory.UNKNOWN, selfCorrectionService.classifyError("", null));
    }

    @Test
    @DisplayName("确定策略 - 数据不足应使用重新检索策略")
    void determineStrategy_DataInsufficient_ShouldReturnReRetrieve() {
        CorrectionStrategy strategy = selfCorrectionService.determineStrategy(ErrorCategory.DATA_INSUFFICIENT);
        assertEquals(CorrectionStrategy.RE_RETRIEVE, strategy);
    }

    @Test
    @DisplayName("确定策略 - 分析错误应使用重新分析策略")
    void determineStrategy_AnalysisError_ShouldReturnReAnalyze() {
        CorrectionStrategy strategy = selfCorrectionService.determineStrategy(ErrorCategory.ANALYSIS_ERROR);
        assertEquals(CorrectionStrategy.RE_ANALYZE, strategy);
    }

    @Test
    @DisplayName("确定策略 - 格式错误应使用格式修复策略")
    void determineStrategy_FormatError_ShouldReturnFormatFix() {
        CorrectionStrategy strategy = selfCorrectionService.determineStrategy(ErrorCategory.FORMAT_ERROR);
        assertEquals(CorrectionStrategy.FORMAT_FIX, strategy);
    }

    @Test
    @DisplayName("确定策略 - 逻辑错误应使用提示注入策略")
    void determineStrategy_LogicError_ShouldReturnPromptInjection() {
        CorrectionStrategy strategy = selfCorrectionService.determineStrategy(ErrorCategory.LOGIC_ERROR);
        assertEquals(CorrectionStrategy.PROMPT_INJECTION, strategy);
    }

    @Test
    @DisplayName("确定策略 - 未知错误应使用完全重试策略")
    void determineStrategy_Unknown_ShouldReturnFullRetry() {
        CorrectionStrategy strategy = selfCorrectionService.determineStrategy(ErrorCategory.UNKNOWN);
        assertEquals(CorrectionStrategy.FULL_RETRY, strategy);
    }

    @Test
    @DisplayName("创建纠错记录 - 应正确保存记录")
    void createCorrectionRecord_ShouldSaveRecord() {
        String errorType = "PARAMETER_ERROR";
        String errorMessage = "参数格式错误";

        CorrectionRecord savedRecord = CorrectionRecord.builder()
            .id(1L)
            .toolCallId(TEST_TOOL_CALL_ID)
            .factoryId(TEST_FACTORY_ID)
            .sessionId(TEST_SESSION_ID)
            .errorType(errorType)
            .errorCategory(ErrorCategory.FORMAT_ERROR)
            .correctionStrategy(CorrectionStrategy.FORMAT_FIX)
            .build();

        when(correctionRecordRepository.save(any(CorrectionRecord.class))).thenReturn(savedRecord);

        CorrectionRecord result = selfCorrectionService.createCorrectionRecord(
            TEST_TOOL_CALL_ID, TEST_FACTORY_ID, TEST_SESSION_ID, errorType, errorMessage);

        assertNotNull(result);
        assertEquals(ErrorCategory.FORMAT_ERROR, result.getErrorCategory());
        assertEquals(CorrectionStrategy.FORMAT_FIX, result.getCorrectionStrategy());
        verify(correctionRecordRepository).save(any(CorrectionRecord.class));
    }

    @Test
    @DisplayName("记录纠错结果 - 成功时应更新状态")
    void recordCorrectionOutcome_Success_ShouldUpdateStatus() {
        Long recordId = 1L;
        CorrectionRecord record = CorrectionRecord.builder()
            .id(recordId)
            .correctionSuccess(false)
            .build();

        when(correctionRecordRepository.findById(recordId)).thenReturn(Optional.of(record));
        when(correctionRecordRepository.save(any(CorrectionRecord.class))).thenReturn(record);

        selfCorrectionService.recordCorrectionOutcome(recordId, true, "SUCCESS");

        verify(correctionRecordRepository).save(argThat(r ->
            r.getCorrectionSuccess() && "SUCCESS".equals(r.getFinalStatus())
        ));
    }

    @Test
    @DisplayName("判断是否应重试 - 纠错轮次小于3应返回true")
    void shouldRetry_LessThan3Attempts_ShouldReturnTrue() {
        // 模拟已有2轮纠错记录
        CorrectionRecord record = CorrectionRecord.builder()
            .toolCallId(TEST_TOOL_CALL_ID)
            .correctionRounds(2)
            .build();

        when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(TEST_TOOL_CALL_ID))
            .thenReturn(List.of(record));

        boolean result = selfCorrectionService.shouldRetry(TEST_TOOL_CALL_ID);

        assertTrue(result, "纠错轮次小于3时应允许重试");
    }

    @Test
    @DisplayName("判断是否应重试 - 纠错轮次达到3应返回false")
    void shouldRetry_Reached3Attempts_ShouldReturnFalse() {
        // 模拟已有3轮纠错记录
        CorrectionRecord record = CorrectionRecord.builder()
            .toolCallId(TEST_TOOL_CALL_ID)
            .correctionRounds(3)
            .build();

        when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(TEST_TOOL_CALL_ID))
            .thenReturn(List.of(record));

        boolean result = selfCorrectionService.shouldRetry(TEST_TOOL_CALL_ID);

        assertFalse(result, "纠错轮次达到3时不应允许重试");
    }

    @Test
    @DisplayName("生成纠正提示 - 数据不足类应包含重新检索指导")
    void generateCorrectionPrompt_DataInsufficient_ShouldContainReRetrieveGuidance() {
        String prompt = selfCorrectionService.generateCorrectionPrompt(
            ErrorCategory.DATA_INSUFFICIENT, "未找到相关数据");

        assertNotNull(prompt);
        assertTrue(prompt.length() > 0);
        // 检查提示内容是否包含相关指导
        assertTrue(prompt.contains("数据") || prompt.contains("检索") || prompt.contains("查询"));
    }

    @Test
    @DisplayName("获取当前纠错轮次")
    void getCurrentRound_ShouldReturnCorrectRound() {
        CorrectionRecord record1 = CorrectionRecord.builder().correctionRounds(1).build();
        CorrectionRecord record2 = CorrectionRecord.builder().correctionRounds(2).build();

        when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(TEST_TOOL_CALL_ID))
            .thenReturn(List.of(record2, record1));

        int round = selfCorrectionService.getCurrentRound(TEST_TOOL_CALL_ID);

        assertEquals(2, round, "应返回最新的纠错轮次");
    }

    @Test
    @DisplayName("获取剩余重试次数")
    void getRemainingRetries_ShouldCalculateCorrectly() {
        // 模拟已有1轮纠错记录
        CorrectionRecord record = CorrectionRecord.builder()
            .toolCallId(TEST_TOOL_CALL_ID)
            .correctionRounds(1)
            .build();

        when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(TEST_TOOL_CALL_ID))
            .thenReturn(List.of(record));

        int remaining = selfCorrectionService.getRemainingRetries(TEST_TOOL_CALL_ID);

        assertEquals(2, remaining, "剩余重试次数应为 3 - 1 = 2");
    }
}

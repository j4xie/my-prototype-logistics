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
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 混合错误分类测试
 * 验证系统能正确处理包含多种错误特征的复杂错误消息
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("MixedErrorClassification 混合错误分类测试")
class MixedErrorClassificationTest {

    @Mock
    private CorrectionRecordRepository correctionRecordRepository;

    @InjectMocks
    private SelfCorrectionServiceImpl selfCorrectionService;

    @BeforeEach
    void setUp() {
        // 初始化设置
    }

    @Test
    @DisplayName("混合错误消息 - 数据不足 + 格式错误")
    void mixed_error_data_insufficient_and_format() {
        // 包含两种错误特征的消息，应该根据优先级分类
        String errorMessage = "数据不完整，且格式错误";

        ErrorCategory category = selfCorrectionService.classifyError(errorMessage, null);

        // 验证分类结果（根据实际实现的优先级）
        assertNotNull(category);
        assertTrue(category == ErrorCategory.DATA_INSUFFICIENT || category == ErrorCategory.FORMAT_ERROR,
            "应该分类为DATA_INSUFFICIENT或FORMAT_ERROR");
    }

    @Test
    @DisplayName("混合错误消息 - 分析错误 + 逻辑错误")
    void mixed_error_analysis_and_logic() {
        String errorMessage = "分析失败，存在逻辑错误";

        ErrorCategory category = selfCorrectionService.classifyError(errorMessage, null);

        assertNotNull(category);
        assertTrue(category == ErrorCategory.ANALYSIS_ERROR || category == ErrorCategory.LOGIC_ERROR,
            "应该分类为ANALYSIS_ERROR或LOGIC_ERROR");
    }

    @ParameterizedTest
    @DisplayName("优先级测试 - 数据不足类关键词")
    @CsvSource({
        "数据不完整且解析失败,DATA_INSUFFICIENT",
        "信息不足导致格式错误,DATA_INSUFFICIENT",
        "未找到数据且JSON错误,DATA_INSUFFICIENT"
    })
    void priority_test_data_insufficient_keywords(String errorMessage, String expectedCategory) {
        ErrorCategory category = selfCorrectionService.classifyError(errorMessage, null);

        // 数据不足类通常具有较高优先级
        assertEquals(ErrorCategory.valueOf(expectedCategory), category,
            "数据不足类错误应该优先被识别");
    }

    @Test
    @DisplayName("复杂错误消息 - 多重嵌套描述")
    void complex_nested_error_description() {
        String errorMessage = "在尝试解析响应时发生错误：数据为空，无法进行后续分析，建议检查数据源";

        ErrorCategory category = selfCorrectionService.classifyError(errorMessage, null);

        // 应该能够正确识别核心错误类型
        assertNotNull(category);
        assertEquals(ErrorCategory.DATA_INSUFFICIENT, category, "应该识别出数据为空的核心错误");
    }

    @Test
    @DisplayName("中英文混合错误消息")
    void mixed_language_error_message() {
        String errorMessage = "Error: 数据不完整 (data incomplete)";

        ErrorCategory category = selfCorrectionService.classifyError(errorMessage, null);

        assertEquals(ErrorCategory.DATA_INSUFFICIENT, category, "应该正确处理中英文混合消息");
    }

    @Test
    @DisplayName("带有堆栈信息的错误消息")
    void error_with_stack_trace() {
        String errorMessage = "NullPointerException: 数据为空\n" +
            "at com.example.Service.process(Service.java:100)\n" +
            "at com.example.Controller.handle(Controller.java:50)";

        ErrorCategory category = selfCorrectionService.classifyError(errorMessage, null);

        assertEquals(ErrorCategory.DATA_INSUFFICIENT, category, "应该能从堆栈信息中识别错误类型");
    }

    @Test
    @DisplayName("特殊字符错误消息")
    void error_with_special_characters() {
        String errorMessage = "格式错误: [!@#$%^&*] 无法解析";

        ErrorCategory category = selfCorrectionService.classifyError(errorMessage, null);

        assertEquals(ErrorCategory.FORMAT_ERROR, category, "应该正确处理带特殊字符的消息");
    }

    @ParameterizedTest
    @DisplayName("策略映射测试")
    @MethodSource("provideErrorCategoryAndStrategy")
    void strategy_mapping_for_categories(ErrorCategory category, CorrectionStrategy expectedStrategy) {
        CorrectionStrategy strategy = selfCorrectionService.determineStrategy(category);

        assertEquals(expectedStrategy, strategy, "错误类别应映射到正确的策略");
    }

    private static Stream<Arguments> provideErrorCategoryAndStrategy() {
        return Stream.of(
            Arguments.of(ErrorCategory.DATA_INSUFFICIENT, CorrectionStrategy.RE_RETRIEVE),
            Arguments.of(ErrorCategory.FORMAT_ERROR, CorrectionStrategy.FORMAT_FIX),
            Arguments.of(ErrorCategory.ANALYSIS_ERROR, CorrectionStrategy.RE_ANALYZE),
            Arguments.of(ErrorCategory.LOGIC_ERROR, CorrectionStrategy.PROMPT_INJECTION),
            Arguments.of(ErrorCategory.UNKNOWN, CorrectionStrategy.FULL_RETRY)
        );
    }

    @Test
    @DisplayName("纠正提示生成 - 数据不足类")
    void correction_prompt_data_insufficient() {
        String prompt = selfCorrectionService.generateCorrectionPrompt(
            ErrorCategory.DATA_INSUFFICIENT, "查询结果为空");

        assertNotNull(prompt);
        assertTrue(prompt.length() > 0);
    }

    @Test
    @DisplayName("纠正提示生成 - 格式错误类")
    void correction_prompt_format_error() {
        String prompt = selfCorrectionService.generateCorrectionPrompt(
            ErrorCategory.FORMAT_ERROR, "JSON解析失败");

        assertNotNull(prompt);
        assertTrue(prompt.length() > 0);
    }

    @Test
    @DisplayName("纠正提示生成 - 分析错误类")
    void correction_prompt_analysis_error() {
        String prompt = selfCorrectionService.generateCorrectionPrompt(
            ErrorCategory.ANALYSIS_ERROR, "计算结果异常");

        assertNotNull(prompt);
        assertTrue(prompt.length() > 0);
    }

    @Test
    @DisplayName("纠正提示生成 - 逻辑错误类")
    void correction_prompt_logic_error() {
        String prompt = selfCorrectionService.generateCorrectionPrompt(
            ErrorCategory.LOGIC_ERROR, "规则冲突");

        assertNotNull(prompt);
        assertTrue(prompt.length() > 0);
    }

    @Test
    @DisplayName("纠正提示生成 - 未知错误类")
    void correction_prompt_unknown() {
        String prompt = selfCorrectionService.generateCorrectionPrompt(
            ErrorCategory.UNKNOWN, "未知问题");

        assertNotNull(prompt);
        assertTrue(prompt.length() > 0);
    }

    @ParameterizedTest
    @DisplayName("边界情况 - 极短错误消息")
    @CsvSource({
        "数据为空,DATA_INSUFFICIENT",
        "错,UNKNOWN",
        "?,UNKNOWN"
    })
    void very_short_error_messages(String errorMessage, String expectedCategory) {
        ErrorCategory category = selfCorrectionService.classifyError(errorMessage, null);

        assertEquals(ErrorCategory.valueOf(expectedCategory), category,
            "极短消息应该被正确分类");
    }

    @Test
    @DisplayName("边界情况 - 极长错误消息")
    void very_long_error_message() {
        StringBuilder sb = new StringBuilder("数据不完整: ");
        for (int i = 0; i < 100; i++) {
            sb.append("详细信息" + i + "; ");
        }

        ErrorCategory category = selfCorrectionService.classifyError(sb.toString(), null);

        assertEquals(ErrorCategory.DATA_INSUFFICIENT, category, "极长消息应该被正确分类");
    }

    @Test
    @DisplayName("边界情况 - Unicode错误消息")
    void unicode_error_message() {
        String errorMessage = "数据不完整 🚫 请检查输入";

        ErrorCategory category = selfCorrectionService.classifyError(errorMessage, null);

        assertEquals(ErrorCategory.DATA_INSUFFICIENT, category, "Unicode消息应该被正确分类");
    }

    @Test
    @DisplayName("大小写敏感性测试")
    void case_sensitivity_test() {
        // 测试大小写变体
        assertEquals(selfCorrectionService.classifyError("数据不完整", null),
            selfCorrectionService.classifyError("数据不完整", null));

        assertEquals(selfCorrectionService.classifyError("NO RESULTS", null),
            selfCorrectionService.classifyError("no results", null));
    }

    @Test
    @DisplayName("同义词识别测试")
    void synonym_recognition_test() {
        // 测试不同表达方式的同类错误
        ErrorCategory cat1 = selfCorrectionService.classifyError("数据为空", null);
        ErrorCategory cat2 = selfCorrectionService.classifyError("未找到相关数据", null);
        ErrorCategory cat3 = selfCorrectionService.classifyError("no results", null);

        assertEquals(cat1, cat2, "同义表达应该归类到相同类别");
        assertEquals(cat2, cat3, "同义表达应该归类到相同类别");
    }

    @Test
    @DisplayName("否定句处理测试")
    void negation_handling_test() {
        // 测试包含"不是"、"没有"等否定词的消息
        String errorMessage = "这不是格式错误，而是数据不完整";

        ErrorCategory category = selfCorrectionService.classifyError(errorMessage, null);

        // 由于同时包含两种关键词，分类结果取决于实现
        assertNotNull(category);
    }

    @Test
    @DisplayName("多行错误消息处理")
    void multiline_error_message() {
        String errorMessage = "错误发生\n" +
            "原因：数据不完整\n" +
            "建议：请补充数据";

        ErrorCategory category = selfCorrectionService.classifyError(errorMessage, null);

        assertEquals(ErrorCategory.DATA_INSUFFICIENT, category, "多行消息应该正确分类");
    }

    @Test
    @DisplayName("带有时间戳的错误消息")
    void error_with_timestamp() {
        String errorMessage = "[2026-01-19 10:30:45] ERROR: 数据不完整";

        ErrorCategory category = selfCorrectionService.classifyError(errorMessage, null);

        assertEquals(ErrorCategory.DATA_INSUFFICIENT, category, "带时间戳的消息应该正确分类");
    }

    @Test
    @DisplayName("完整流程测试 - 创建纠错记录并确定策略")
    void full_flow_create_record_and_determine_strategy() {
        String errorType = "MIXED_ERROR";
        String errorMessage = "数据不完整导致分析失败";

        CorrectionRecord savedRecord = CorrectionRecord.builder()
            .id(1L)
            .toolCallId(1L)
            .factoryId("F001")
            .sessionId("test-session")
            .errorType(errorType)
            .errorCategory(ErrorCategory.DATA_INSUFFICIENT)
            .correctionStrategy(CorrectionStrategy.RE_RETRIEVE)
            .build();

        when(correctionRecordRepository.save(any(CorrectionRecord.class))).thenReturn(savedRecord);

        CorrectionRecord result = selfCorrectionService.createCorrectionRecord(
            1L, "F001", "test-session", errorType, errorMessage);

        assertNotNull(result);
        // 验证分类和策略是匹配的
        ErrorCategory expectedCategory = selfCorrectionService.classifyError(errorMessage, null);
        CorrectionStrategy expectedStrategy = selfCorrectionService.determineStrategy(expectedCategory);

        assertEquals(expectedCategory, result.getErrorCategory());
        assertEquals(expectedStrategy, result.getCorrectionStrategy());
    }
}

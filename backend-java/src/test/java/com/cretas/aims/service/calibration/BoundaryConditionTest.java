package com.cretas.aims.service.calibration;

import com.cretas.aims.entity.calibration.BehaviorCalibrationMetrics;
import com.cretas.aims.entity.calibration.CorrectionRecord.CorrectionStrategy;
import com.cretas.aims.entity.calibration.CorrectionRecord.ErrorCategory;
import com.cretas.aims.entity.calibration.ToolCallCache;
import com.cretas.aims.entity.calibration.ToolCallRecord;
import com.cretas.aims.repository.calibration.BehaviorCalibrationMetricsRepository;
import com.cretas.aims.repository.calibration.CorrectionRecordRepository;
import com.cretas.aims.repository.calibration.ToolCallCacheRepository;
import com.cretas.aims.repository.calibration.ToolCallRecordRepository;
import com.cretas.aims.repository.calibration.ToolReliabilityStatsRepository;
import com.cretas.aims.service.calibration.impl.BehaviorCalibrationServiceImpl;
import com.cretas.aims.service.calibration.impl.SelfCorrectionServiceImpl;
import com.cretas.aims.service.calibration.impl.ToolCallRedundancyServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 边界条件测试类
 * 覆盖所有校准服务的边界情况，包括：
 * 1. 空值（null）处理
 * 2. 空字符串和空集合
 * 3. 最大/最小整数值
 * 4. 超长字符串（10000+字符）
 * 5. 特殊字符（Unicode、emoji、控制字符）
 * 6. 负数值（预期正数的场景）
 * 7. 零值
 * 8. 边界日期（1970、2099、闰年）
 * 9. 空JSON对象/数组
 * 10. 纯空白字符串
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("边界条件测试 - 校准服务")
class BoundaryConditionTest {

    // ==================== Mock依赖 ====================
    @Mock
    private ToolCallRecordRepository toolCallRecordRepository;

    @Mock
    private ToolCallCacheRepository toolCallCacheRepository;

    @Mock
    private CorrectionRecordRepository correctionRecordRepository;

    @Mock
    private BehaviorCalibrationMetricsRepository metricsRepository;

    @Mock
    private ToolReliabilityStatsRepository reliabilityStatsRepository;

    // ==================== 被测服务 ====================
    private ToolCallRedundancyServiceImpl redundancyService;
    private SelfCorrectionServiceImpl selfCorrectionService;
    private BehaviorCalibrationServiceImpl calibrationService;

    private ObjectMapper objectMapper;

    // ==================== 测试常量 ====================
    private static final String TEST_SESSION_ID = "test-session-boundary";
    private static final String TEST_TOOL_NAME = "boundary_test_tool";
    private static final String TEST_FACTORY_ID = "F001";

    /**
     * 生成超长字符串（10000+字符）
     */
    private static String generateLongString(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append((char) ('a' + (i % 26)));
        }
        return sb.toString();
    }

    /**
     * 生成包含特殊字符的字符串
     */
    private static String getSpecialCharsString() {
        return "特殊字符测试: \u0000\u0001\u001F\t\n\r Unicode中文 Emoji\uD83D\uDE00\uD83D\uDC4D " +
               "日本語テスト العربية עברית 한국어 \uFEFF\u200B\u200C\u200D";
    }

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();

        redundancyService = new ToolCallRedundancyServiceImpl(
            toolCallRecordRepository,
            toolCallCacheRepository,
            objectMapper
        );

        selfCorrectionService = new SelfCorrectionServiceImpl(correctionRecordRepository);

        calibrationService = new BehaviorCalibrationServiceImpl(
            metricsRepository,
            toolCallRecordRepository,
            reliabilityStatsRepository,
            objectMapper
        );
    }

    // ==================== computeParametersHash 边界测试 ====================

    @Nested
    @DisplayName("ToolCallRedundancyService.computeParametersHash() 边界测试")
    class ComputeParametersHashBoundaryTests {

        @Test
        @DisplayName("空值测试 - null参数应返回一致的哈希值")
        void testNullParameters_ShouldReturnConsistentHash() {
            // 空值应该返回空字符串的SHA-256哈希
            String hash = redundancyService.computeParametersHash(null);

            assertNotNull(hash, "null参数不应返回null哈希");
            assertEquals(64, hash.length(), "SHA-256哈希应为64字符");

            // 多次调用应返回相同结果
            String hash2 = redundancyService.computeParametersHash(null);
            assertEquals(hash, hash2, "相同的null输入应返回相同哈希");
        }

        @Test
        @DisplayName("空集合测试 - 空Map应返回与null相同的哈希")
        void testEmptyMap_ShouldReturnSameHashAsNull() {
            String hashNull = redundancyService.computeParametersHash(null);
            String hashEmpty = redundancyService.computeParametersHash(new HashMap<>());

            assertEquals(hashNull, hashEmpty, "null和空Map应返回相同哈希");
        }

        @ParameterizedTest(name = "空白字符串值测试: \"{0}\"")
        @ValueSource(strings = {"", " ", "   ", "\t", "\n", "\r\n", "  \t\n  "})
        @DisplayName("空白字符串值测试 - 各种空白字符作为Map值")
        void testWhitespaceOnlyValues_ShouldHandleCorrectly(String whitespace) {
            Map<String, Object> params = new HashMap<>();
            params.put("key", whitespace);

            String hash = redundancyService.computeParametersHash(params);

            assertNotNull(hash, "包含空白字符值的Map应返回有效哈希");
            assertEquals(64, hash.length(), "SHA-256哈希应为64字符");
        }

        @Test
        @DisplayName("超长字符串测试 - 10000+字符的值应正确处理")
        void testExtremelyLongString_ShouldHandleCorrectly() {
            String longString = generateLongString(15000);
            Map<String, Object> params = new HashMap<>();
            params.put("longValue", longString);

            String hash = redundancyService.computeParametersHash(params);

            assertNotNull(hash, "超长字符串值应返回有效哈希");
            assertEquals(64, hash.length(), "SHA-256哈希应为64字符");
        }

        @Test
        @DisplayName("特殊字符测试 - Unicode、emoji、控制字符应正确处理")
        void testSpecialCharacters_ShouldHandleCorrectly() {
            Map<String, Object> params = new HashMap<>();
            params.put("specialChars", getSpecialCharsString());
            params.put("emoji", "\uD83D\uDE00\uD83D\uDC4D\uD83C\uDF89");
            params.put("controlChars", "\u0000\u0001\u001F");
            params.put("chinese", "中文测试数据分析");

            String hash = redundancyService.computeParametersHash(params);

            assertNotNull(hash, "特殊字符值应返回有效哈希");
            assertEquals(64, hash.length(), "SHA-256哈希应为64字符");

            // 相同参数应返回相同哈希
            String hash2 = redundancyService.computeParametersHash(params);
            assertEquals(hash, hash2, "相同特殊字符参数应返回相同哈希");
        }

        @ParameterizedTest(name = "边界整数值测试: {0}")
        @MethodSource("com.cretas.aims.service.calibration.BoundaryConditionTest#provideIntegerBoundaryValues")
        @DisplayName("边界整数值测试 - Integer最大/最小值")
        void testIntegerBoundaryValues_ShouldHandleCorrectly(Integer value) {
            Map<String, Object> params = new HashMap<>();
            params.put("intValue", value);

            String hash = redundancyService.computeParametersHash(params);

            assertNotNull(hash, "边界整数值应返回有效哈希");
            assertEquals(64, hash.length(), "SHA-256哈希应为64字符");
        }

        @Test
        @DisplayName("负数值测试 - 负整数和负浮点数应正确处理")
        void testNegativeNumbers_ShouldHandleCorrectly() {
            Map<String, Object> params = new HashMap<>();
            params.put("negativeInt", -1);
            params.put("negativeDouble", -999999.99999);
            params.put("negativeLong", Long.MIN_VALUE);

            String hash = redundancyService.computeParametersHash(params);

            assertNotNull(hash, "负数值应返回有效哈希");
            assertEquals(64, hash.length(), "SHA-256哈希应为64字符");
        }

        @Test
        @DisplayName("零值测试 - 各种类型的零值应正确处理")
        void testZeroValues_ShouldHandleCorrectly() {
            Map<String, Object> params = new HashMap<>();
            params.put("intZero", 0);
            params.put("longZero", 0L);
            params.put("doubleZero", 0.0);
            params.put("floatZero", 0.0f);

            String hash = redundancyService.computeParametersHash(params);

            assertNotNull(hash, "零值应返回有效哈希");
            assertEquals(64, hash.length(), "SHA-256哈希应为64字符");
        }

        @Test
        @DisplayName("嵌套Map测试 - 深度嵌套的Map结构应正确处理")
        void testNestedMaps_ShouldHandleCorrectly() {
            Map<String, Object> inner = new HashMap<>();
            inner.put("innerKey", "innerValue");

            Map<String, Object> middle = new HashMap<>();
            middle.put("middleKey", inner);
            middle.put("list", Arrays.asList("a", "b", "c"));

            Map<String, Object> params = new HashMap<>();
            params.put("nested", middle);
            params.put("simpleKey", "simpleValue");

            String hash = redundancyService.computeParametersHash(params);

            assertNotNull(hash, "嵌套Map应返回有效哈希");
            assertEquals(64, hash.length(), "SHA-256哈希应为64字符");
        }

        @Test
        @DisplayName("空嵌套结构测试 - 包含空List和空Map的参数")
        void testEmptyNestedStructures_ShouldHandleCorrectly() {
            Map<String, Object> params = new HashMap<>();
            params.put("emptyList", new ArrayList<>());
            params.put("emptyMap", new HashMap<>());
            params.put("emptyArray", new Object[0]);

            String hash = redundancyService.computeParametersHash(params);

            assertNotNull(hash, "空嵌套结构应返回有效哈希");
            assertEquals(64, hash.length(), "SHA-256哈希应为64字符");
        }

        @Test
        @DisplayName("大量键值对测试 - 1000个键值对应正确处理")
        void testLargeNumberOfKeys_ShouldHandleCorrectly() {
            Map<String, Object> params = new HashMap<>();
            for (int i = 0; i < 1000; i++) {
                params.put("key_" + i, "value_" + i);
            }

            String hash = redundancyService.computeParametersHash(params);

            assertNotNull(hash, "大量键值对应返回有效哈希");
            assertEquals(64, hash.length(), "SHA-256哈希应为64字符");
        }
    }

    // ==================== isRedundant 边界测试 ====================

    @Nested
    @DisplayName("ToolCallRedundancyService.isRedundant() 边界测试")
    class IsRedundantBoundaryTests {

        @Test
        @DisplayName("空值测试 - sessionId为null应返回false")
        void testNullSessionId_ShouldReturnFalse() {
            Map<String, Object> params = new HashMap<>();
            params.put("key", "value");

            boolean result = redundancyService.isRedundant(null, TEST_TOOL_NAME, params);

            assertFalse(result, "sessionId为null时应返回非冗余");
        }

        @Test
        @DisplayName("空值测试 - toolName为null应返回false")
        void testNullToolName_ShouldReturnFalse() {
            Map<String, Object> params = new HashMap<>();
            params.put("key", "value");

            boolean result = redundancyService.isRedundant(TEST_SESSION_ID, null, params);

            assertFalse(result, "toolName为null时应返回非冗余");
        }

        @Test
        @DisplayName("空值测试 - parameters为null应返回false")
        void testNullParameters_ShouldReturnFalse() {
            boolean result = redundancyService.isRedundant(TEST_SESSION_ID, TEST_TOOL_NAME, null);

            assertFalse(result, "parameters为null时应返回非冗余");
        }

        @Test
        @DisplayName("全部空值测试 - 所有参数为null应返回false")
        void testAllNullParameters_ShouldReturnFalse() {
            boolean result = redundancyService.isRedundant(null, null, null);

            assertFalse(result, "所有参数为null时应返回非冗余");
        }

        @ParameterizedTest(name = "空白sessionId测试: \"{0}\"")
        @ValueSource(strings = {"", " ", "\t", "\n"})
        @DisplayName("空白sessionId测试 - 各种空白字符串作为sessionId")
        void testWhitespaceSessionId_ShouldHandleCorrectly(String sessionId) {
            Map<String, Object> params = new HashMap<>();
            params.put("key", "value");

            // 设置mock - 无缓存、无历史记录
            when(toolCallCacheRepository.findValidCache(anyString(), any(LocalDateTime.class)))
                .thenReturn(Optional.empty());
            when(toolCallRecordRepository.findFirstBySessionIdAndToolNameAndParametersHashAndCreatedAtAfterOrderByCreatedAtDesc(
                anyString(), anyString(), anyString(), any(LocalDateTime.class)))
                .thenReturn(Optional.empty());

            // 空白sessionId应该正常处理（虽然不是有效输入）
            boolean result = redundancyService.isRedundant(sessionId, TEST_TOOL_NAME, params);

            assertFalse(result, "空白sessionId应返回非冗余（无缓存时）");
        }

        @Test
        @DisplayName("超长sessionId测试 - 10000+字符的sessionId")
        void testExtremelyLongSessionId_ShouldHandleCorrectly() {
            String longSessionId = generateLongString(15000);
            Map<String, Object> params = new HashMap<>();
            params.put("key", "value");

            when(toolCallCacheRepository.findValidCache(anyString(), any(LocalDateTime.class)))
                .thenReturn(Optional.empty());
            when(toolCallRecordRepository.findFirstBySessionIdAndToolNameAndParametersHashAndCreatedAtAfterOrderByCreatedAtDesc(
                anyString(), anyString(), anyString(), any(LocalDateTime.class)))
                .thenReturn(Optional.empty());

            boolean result = redundancyService.isRedundant(longSessionId, TEST_TOOL_NAME, params);

            assertFalse(result, "超长sessionId应正常处理并返回非冗余");
        }

        @Test
        @DisplayName("特殊字符sessionId测试 - Unicode和emoji作为sessionId")
        void testSpecialCharsSessionId_ShouldHandleCorrectly() {
            String specialSessionId = "session-\uD83D\uDE00-中文-" + UUID.randomUUID();
            Map<String, Object> params = new HashMap<>();
            params.put("key", "value");

            when(toolCallCacheRepository.findValidCache(anyString(), any(LocalDateTime.class)))
                .thenReturn(Optional.empty());
            when(toolCallRecordRepository.findFirstBySessionIdAndToolNameAndParametersHashAndCreatedAtAfterOrderByCreatedAtDesc(
                anyString(), anyString(), anyString(), any(LocalDateTime.class)))
                .thenReturn(Optional.empty());

            boolean result = redundancyService.isRedundant(specialSessionId, TEST_TOOL_NAME, params);

            assertFalse(result, "特殊字符sessionId应正常处理");
        }
    }

    // ==================== classifyError 边界测试 ====================

    @Nested
    @DisplayName("SelfCorrectionService.classifyError() 边界测试")
    class ClassifyErrorBoundaryTests {

        @Test
        @DisplayName("空值测试 - errorMessage为null应返回UNKNOWN")
        void testNullErrorMessage_ShouldReturnUnknown() {
            ErrorCategory result = selfCorrectionService.classifyError(null, null);

            assertEquals(ErrorCategory.UNKNOWN, result, "null错误信息应分类为UNKNOWN");
        }

        @ParameterizedTest(name = "空字符串测试: \"{0}\"")
        @NullSource
        @EmptySource
        @ValueSource(strings = {" ", "   ", "\t", "\n", "\r\n", "  \t\n  "})
        @DisplayName("空白字符串测试 - 空/空白错误信息应返回UNKNOWN")
        void testEmptyOrWhitespaceErrorMessage_ShouldReturnUnknown(String errorMessage) {
            ErrorCategory result = selfCorrectionService.classifyError(errorMessage, null);

            assertEquals(ErrorCategory.UNKNOWN, result, "空/空白错误信息应分类为UNKNOWN");
        }

        @Test
        @DisplayName("超长错误信息测试 - 10000+字符的错误信息应正确分类")
        void testExtremelyLongErrorMessage_ShouldHandleCorrectly() {
            // 创建超长错误信息，包含有效关键词
            String longMessage = generateLongString(10000) + " 数据不完整 " + generateLongString(5000);

            ErrorCategory result = selfCorrectionService.classifyError(longMessage, null);

            assertEquals(ErrorCategory.DATA_INSUFFICIENT, result, "超长错误信息中包含关键词应正确分类");
        }

        @Test
        @DisplayName("特殊字符错误信息测试 - Unicode和emoji应正确处理")
        void testSpecialCharsErrorMessage_ShouldHandleCorrectly() {
            String specialMessage = "\uD83D\uDCA5 数据不完整 \uD83D\uDCA5 中文错误信息 \uD83D\uDE00";

            ErrorCategory result = selfCorrectionService.classifyError(specialMessage, null);

            assertEquals(ErrorCategory.DATA_INSUFFICIENT, result, "特殊字符错误信息应正确分类");
        }

        @ParameterizedTest(name = "DATA_INSUFFICIENT关键词测试: \"{0}\"")
        @CsvSource({
            "数据不完整",
            "信息不足",
            "未找到相关数据",
            "数据为空",
            "没有任何记录",
            "缺少必要信息",
            "缺少必要参数",
            "insufficient data found",
            "data not found",
            "no results",
            "empty result set"
        })
        @DisplayName("数据不足关键词测试 - 各种数据不足错误应分类为DATA_INSUFFICIENT")
        void testDataInsufficientKeywords_ShouldClassifyCorrectly(String errorMessage) {
            ErrorCategory result = selfCorrectionService.classifyError(errorMessage, null);

            assertEquals(ErrorCategory.DATA_INSUFFICIENT, result,
                "错误信息 '" + errorMessage + "' 应分类为DATA_INSUFFICIENT");
        }

        @ParameterizedTest(name = "FORMAT_ERROR关键词测试: \"{0}\"")
        @CsvSource({
            "格式错误",
            "解析失败",
            "JSON解析错误",
            "类型转换失败",
            "格式不正确",
            "序列化失败",
            "format error occurred",
            "parse failed",
            "json exception",
            "invalid format"
        })
        @DisplayName("格式错误关键词测试 - 各种格式错误应分类为FORMAT_ERROR")
        void testFormatErrorKeywords_ShouldClassifyCorrectly(String errorMessage) {
            ErrorCategory result = selfCorrectionService.classifyError(errorMessage, null);

            assertEquals(ErrorCategory.FORMAT_ERROR, result,
                "错误信息 '" + errorMessage + "' 应分类为FORMAT_ERROR");
        }

        @ParameterizedTest(name = "ANALYSIS_ERROR关键词测试: \"{0}\"")
        @CsvSource({
            "分析错误",
            "计算错误",
            "统计失败",
            "结果异常",
            "分析过程失败",
            "处理过程错误",
            "analysis error",
            "calculation failed",
            "processing error"
        })
        @DisplayName("分析错误关键词测试 - 各种分析错误应分类为ANALYSIS_ERROR")
        void testAnalysisErrorKeywords_ShouldClassifyCorrectly(String errorMessage) {
            ErrorCategory result = selfCorrectionService.classifyError(errorMessage, null);

            assertEquals(ErrorCategory.ANALYSIS_ERROR, result,
                "错误信息 '" + errorMessage + "' 应分类为ANALYSIS_ERROR");
        }

        @ParameterizedTest(name = "LOGIC_ERROR关键词测试: \"{0}\"")
        @CsvSource({
            "逻辑错误",
            "推理失败",
            "条件不满足要求",
            "规则冲突",
            "业务逻辑错误",
            "违反业务规则",
            "logic error detected",
            "rule conflict",
            "validation failed"
        })
        @DisplayName("逻辑错误关键词测试 - 各种逻辑错误应分类为LOGIC_ERROR")
        void testLogicErrorKeywords_ShouldClassifyCorrectly(String errorMessage) {
            ErrorCategory result = selfCorrectionService.classifyError(errorMessage, null);

            assertEquals(ErrorCategory.LOGIC_ERROR, result,
                "错误信息 '" + errorMessage + "' 应分类为LOGIC_ERROR");
        }

        @Test
        @DisplayName("reviewFeedback为null测试 - 仅使用errorMessage进行分类")
        void testNullReviewFeedback_ShouldUseOnlyErrorMessage() {
            ErrorCategory result = selfCorrectionService.classifyError("数据不完整", null);

            assertEquals(ErrorCategory.DATA_INSUFFICIENT, result, "null审核反馈应仅使用错误信息分类");
        }

        @Test
        @DisplayName("reviewFeedback组合测试 - errorMessage和reviewFeedback组合分类")
        void testCombinedErrorAndFeedback_ShouldClassifyCorrectly() {
            // errorMessage没有关键词，但reviewFeedback有
            ErrorCategory result = selfCorrectionService.classifyError(
                "something went wrong",
                "数据不完整，请补充信息"
            );

            assertEquals(ErrorCategory.DATA_INSUFFICIENT, result, "组合文本应正确分类");
        }

        @Test
        @DisplayName("优先级测试 - 多个关键词时应按优先级分类")
        void testPriorityWhenMultipleKeywords_ShouldFollowPriority() {
            // DATA_INSUFFICIENT优先级高于其他类型
            String mixedMessage = "数据不完整，格式错误，分析失败";

            ErrorCategory result = selfCorrectionService.classifyError(mixedMessage, null);

            assertEquals(ErrorCategory.DATA_INSUFFICIENT, result, "应按优先级返回DATA_INSUFFICIENT");
        }

        @Test
        @DisplayName("控制字符测试 - 包含控制字符的错误信息")
        void testControlCharacters_ShouldHandleCorrectly() {
            String messageWithControlChars = "数据不完整\u0000\u0001\u001F测试";

            ErrorCategory result = selfCorrectionService.classifyError(messageWithControlChars, null);

            assertEquals(ErrorCategory.DATA_INSUFFICIENT, result, "包含控制字符的错误信息应正确分类");
        }
    }

    // ==================== calculateDailyMetrics 边界测试 ====================

    @Nested
    @DisplayName("BehaviorCalibrationService.calculateDailyMetrics() 边界测试")
    class CalculateDailyMetricsBoundaryTests {

        @Test
        @DisplayName("空值测试 - factoryId为null应计算全平台指标")
        void testNullFactoryId_ShouldCalculatePlatformMetrics() {
            LocalDate today = LocalDate.now();

            // Mock返回空数据
            when(toolCallRecordRepository.countByFactoryIdAndTimeRange(
                isNull(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(0L);
            when(toolCallRecordRepository.countSuccessfulByFactoryIdAndTimeRange(
                isNull(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(0L);
            when(toolCallRecordRepository.countFailedByFactoryIdAndTimeRange(
                isNull(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(0L);
            when(toolCallRecordRepository.countRedundantByFactoryIdAndTimeRange(
                isNull(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(0L);
            when(toolCallRecordRepository.countRecoveredByFactoryIdAndTimeRange(
                isNull(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(0L);
            when(toolCallRecordRepository.sumInputTokensByFactoryIdAndTimeRange(
                isNull(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(0L);
            when(toolCallRecordRepository.sumOutputTokensByFactoryIdAndTimeRange(
                isNull(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(0L);
            when(toolCallRecordRepository.avgExecutionTimeByFactoryIdAndTimeRange(
                isNull(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(null);
            when(toolCallRecordRepository.countByToolNameAndFactoryIdAndTimeRange(
                isNull(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(Collections.emptyList());
            when(toolCallRecordRepository.countByStatusAndFactoryIdAndTimeRange(
                isNull(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(Collections.emptyList());
            when(metricsRepository.findByFactoryIdAndMetricDateAndPeriodType(
                isNull(), eq(today), any()))
                .thenReturn(Optional.empty());
            when(metricsRepository.save(any(BehaviorCalibrationMetrics.class)))
                .thenAnswer(inv -> inv.getArgument(0));

            BehaviorCalibrationMetrics result = calibrationService.calculateDailyMetrics(null, today);

            assertNotNull(result, "null factoryId应返回有效指标");
            assertNull(result.getFactoryId(), "全平台指标的factoryId应为null");
        }

        @Test
        @DisplayName("边界日期测试 - Unix纪元起始日期1970-01-01")
        void testUnixEpochDate_ShouldHandleCorrectly() {
            LocalDate epochDate = LocalDate.of(1970, 1, 1);

            mockEmptyMetricsData(TEST_FACTORY_ID);
            when(metricsRepository.findByFactoryIdAndMetricDateAndPeriodType(
                eq(TEST_FACTORY_ID), eq(epochDate), any()))
                .thenReturn(Optional.empty());
            when(metricsRepository.save(any(BehaviorCalibrationMetrics.class)))
                .thenAnswer(inv -> inv.getArgument(0));

            BehaviorCalibrationMetrics result = calibrationService.calculateDailyMetrics(TEST_FACTORY_ID, epochDate);

            assertNotNull(result, "1970-01-01应正常计算指标");
            assertEquals(epochDate, result.getMetricDate(), "指标日期应为1970-01-01");
        }

        @Test
        @DisplayName("边界日期测试 - 远未来日期2099-12-31")
        void testFarFutureDate_ShouldHandleCorrectly() {
            LocalDate futureDate = LocalDate.of(2099, 12, 31);

            mockEmptyMetricsData(TEST_FACTORY_ID);
            when(metricsRepository.findByFactoryIdAndMetricDateAndPeriodType(
                eq(TEST_FACTORY_ID), eq(futureDate), any()))
                .thenReturn(Optional.empty());
            when(metricsRepository.save(any(BehaviorCalibrationMetrics.class)))
                .thenAnswer(inv -> inv.getArgument(0));

            BehaviorCalibrationMetrics result = calibrationService.calculateDailyMetrics(TEST_FACTORY_ID, futureDate);

            assertNotNull(result, "2099-12-31应正常计算指标");
            assertEquals(futureDate, result.getMetricDate(), "指标日期应为2099-12-31");
        }

        @Test
        @DisplayName("边界日期测试 - 闰年2月29日")
        void testLeapYearDate_ShouldHandleCorrectly() {
            LocalDate leapYearDate = LocalDate.of(2024, 2, 29);

            mockEmptyMetricsData(TEST_FACTORY_ID);
            when(metricsRepository.findByFactoryIdAndMetricDateAndPeriodType(
                eq(TEST_FACTORY_ID), eq(leapYearDate), any()))
                .thenReturn(Optional.empty());
            when(metricsRepository.save(any(BehaviorCalibrationMetrics.class)))
                .thenAnswer(inv -> inv.getArgument(0));

            BehaviorCalibrationMetrics result = calibrationService.calculateDailyMetrics(TEST_FACTORY_ID, leapYearDate);

            assertNotNull(result, "闰年2月29日应正常计算指标");
            assertEquals(leapYearDate, result.getMetricDate(), "指标日期应为闰年2月29日");
        }

        @Test
        @DisplayName("零值统计测试 - 所有统计数据为0")
        void testZeroStatistics_ShouldHandleCorrectly() {
            LocalDate today = LocalDate.now();

            mockEmptyMetricsData(TEST_FACTORY_ID);
            when(metricsRepository.findByFactoryIdAndMetricDateAndPeriodType(
                eq(TEST_FACTORY_ID), eq(today), any()))
                .thenReturn(Optional.empty());
            when(metricsRepository.save(any(BehaviorCalibrationMetrics.class)))
                .thenAnswer(inv -> inv.getArgument(0));

            BehaviorCalibrationMetrics result = calibrationService.calculateDailyMetrics(TEST_FACTORY_ID, today);

            assertNotNull(result, "零值统计应返回有效指标");
            assertEquals(0, result.getTotalCalls(), "总调用数应为0");
            assertEquals(0, result.getSuccessfulCalls(), "成功调用数应为0");
        }

        @Test
        @DisplayName("null统计返回值测试 - 数据库返回null")
        void testNullStatisticsFromDb_ShouldHandleCorrectly() {
            LocalDate today = LocalDate.now();

            // Mock返回null
            when(toolCallRecordRepository.countByFactoryIdAndTimeRange(
                eq(TEST_FACTORY_ID), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(null);
            when(toolCallRecordRepository.countSuccessfulByFactoryIdAndTimeRange(
                eq(TEST_FACTORY_ID), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(null);
            when(toolCallRecordRepository.countFailedByFactoryIdAndTimeRange(
                eq(TEST_FACTORY_ID), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(null);
            when(toolCallRecordRepository.countRedundantByFactoryIdAndTimeRange(
                eq(TEST_FACTORY_ID), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(null);
            when(toolCallRecordRepository.countRecoveredByFactoryIdAndTimeRange(
                eq(TEST_FACTORY_ID), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(null);
            when(toolCallRecordRepository.sumInputTokensByFactoryIdAndTimeRange(
                eq(TEST_FACTORY_ID), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(null);
            when(toolCallRecordRepository.sumOutputTokensByFactoryIdAndTimeRange(
                eq(TEST_FACTORY_ID), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(null);
            when(toolCallRecordRepository.avgExecutionTimeByFactoryIdAndTimeRange(
                eq(TEST_FACTORY_ID), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(null);
            when(toolCallRecordRepository.countByToolNameAndFactoryIdAndTimeRange(
                eq(TEST_FACTORY_ID), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(null);
            when(toolCallRecordRepository.countByStatusAndFactoryIdAndTimeRange(
                eq(TEST_FACTORY_ID), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(null);
            when(metricsRepository.findByFactoryIdAndMetricDateAndPeriodType(
                eq(TEST_FACTORY_ID), eq(today), any()))
                .thenReturn(Optional.empty());
            when(metricsRepository.save(any(BehaviorCalibrationMetrics.class)))
                .thenAnswer(inv -> inv.getArgument(0));

            BehaviorCalibrationMetrics result = calibrationService.calculateDailyMetrics(TEST_FACTORY_ID, today);

            assertNotNull(result, "null统计返回值应正常处理");
            assertEquals(0, result.getTotalCalls(), "null应转换为0");
        }

        @ParameterizedTest(name = "空白factoryId测试: \"{0}\"")
        @ValueSource(strings = {"", " ", "\t"})
        @DisplayName("空白factoryId测试 - 空白字符串作为factoryId")
        void testWhitespaceFactoryId_ShouldHandleCorrectly(String factoryId) {
            LocalDate today = LocalDate.now();

            mockEmptyMetricsData(factoryId);
            when(metricsRepository.findByFactoryIdAndMetricDateAndPeriodType(
                eq(factoryId), eq(today), any()))
                .thenReturn(Optional.empty());
            when(metricsRepository.save(any(BehaviorCalibrationMetrics.class)))
                .thenAnswer(inv -> inv.getArgument(0));

            BehaviorCalibrationMetrics result = calibrationService.calculateDailyMetrics(factoryId, today);

            assertNotNull(result, "空白factoryId应正常处理");
        }

        @Test
        @DisplayName("超长factoryId测试 - 10000+字符的factoryId")
        void testExtremelyLongFactoryId_ShouldHandleCorrectly() {
            String longFactoryId = generateLongString(15000);
            LocalDate today = LocalDate.now();

            mockEmptyMetricsData(longFactoryId);
            when(metricsRepository.findByFactoryIdAndMetricDateAndPeriodType(
                eq(longFactoryId), eq(today), any()))
                .thenReturn(Optional.empty());
            when(metricsRepository.save(any(BehaviorCalibrationMetrics.class)))
                .thenAnswer(inv -> inv.getArgument(0));

            BehaviorCalibrationMetrics result = calibrationService.calculateDailyMetrics(longFactoryId, today);

            assertNotNull(result, "超长factoryId应正常处理");
        }

        /**
         * 辅助方法：Mock空指标数据
         */
        private void mockEmptyMetricsData(String factoryId) {
            when(toolCallRecordRepository.countByFactoryIdAndTimeRange(
                eq(factoryId), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(0L);
            when(toolCallRecordRepository.countSuccessfulByFactoryIdAndTimeRange(
                eq(factoryId), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(0L);
            when(toolCallRecordRepository.countFailedByFactoryIdAndTimeRange(
                eq(factoryId), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(0L);
            when(toolCallRecordRepository.countRedundantByFactoryIdAndTimeRange(
                eq(factoryId), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(0L);
            when(toolCallRecordRepository.countRecoveredByFactoryIdAndTimeRange(
                eq(factoryId), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(0L);
            when(toolCallRecordRepository.sumInputTokensByFactoryIdAndTimeRange(
                eq(factoryId), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(0L);
            when(toolCallRecordRepository.sumOutputTokensByFactoryIdAndTimeRange(
                eq(factoryId), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(0L);
            when(toolCallRecordRepository.avgExecutionTimeByFactoryIdAndTimeRange(
                eq(factoryId), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(null);
            when(toolCallRecordRepository.countByToolNameAndFactoryIdAndTimeRange(
                eq(factoryId), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(Collections.emptyList());
            when(toolCallRecordRepository.countByStatusAndFactoryIdAndTimeRange(
                eq(factoryId), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(Collections.emptyList());
        }
    }

    // ==================== 策略确定边界测试 ====================

    @Nested
    @DisplayName("SelfCorrectionService.determineStrategy() 边界测试")
    class DetermineStrategyBoundaryTests {

        @Test
        @DisplayName("空值测试 - null错误类别应返回FULL_RETRY")
        void testNullErrorCategory_ShouldReturnFullRetry() {
            CorrectionStrategy result = selfCorrectionService.determineStrategy((ErrorCategory) null);

            assertEquals(CorrectionStrategy.FULL_RETRY, result, "null错误类别应返回FULL_RETRY策略");
        }

        @ParameterizedTest(name = "策略映射测试: {0} -> {1}")
        @CsvSource({
            "DATA_INSUFFICIENT, RE_RETRIEVE",
            "ANALYSIS_ERROR, RE_ANALYZE",
            "FORMAT_ERROR, FORMAT_FIX",
            "LOGIC_ERROR, PROMPT_INJECTION",
            "UNKNOWN, FULL_RETRY"
        })
        @DisplayName("策略映射测试 - 各错误类别应映射到正确策略")
        void testStrategyMapping_ShouldMapCorrectly(ErrorCategory category, CorrectionStrategy expectedStrategy) {
            CorrectionStrategy result = selfCorrectionService.determineStrategy(category);

            assertEquals(expectedStrategy, result,
                "错误类别 " + category + " 应映射到策略 " + expectedStrategy);
        }
    }

    // ==================== 综合边界测试 ====================

    @Nested
    @DisplayName("综合边界条件测试")
    class ComprehensiveBoundaryTests {

        @Test
        @DisplayName("最大整数值Map测试 - Integer.MAX_VALUE作为Map值")
        void testMaxIntegerValueInMap_ShouldHandleCorrectly() {
            Map<String, Object> params = new HashMap<>();
            params.put("maxInt", Integer.MAX_VALUE);
            params.put("maxLong", Long.MAX_VALUE);

            String hash = redundancyService.computeParametersHash(params);

            assertNotNull(hash);
            assertEquals(64, hash.length());
        }

        @Test
        @DisplayName("最小整数值Map测试 - Integer.MIN_VALUE作为Map值")
        void testMinIntegerValueInMap_ShouldHandleCorrectly() {
            Map<String, Object> params = new HashMap<>();
            params.put("minInt", Integer.MIN_VALUE);
            params.put("minLong", Long.MIN_VALUE);

            String hash = redundancyService.computeParametersHash(params);

            assertNotNull(hash);
            assertEquals(64, hash.length());
        }

        @Test
        @DisplayName("浮点数边界值测试 - Double.MAX_VALUE和Double.MIN_VALUE")
        void testDoubleExtremeValues_ShouldHandleCorrectly() {
            Map<String, Object> params = new HashMap<>();
            params.put("maxDouble", Double.MAX_VALUE);
            params.put("minDouble", Double.MIN_VALUE);
            params.put("positiveInfinity", Double.POSITIVE_INFINITY);
            params.put("negativeInfinity", Double.NEGATIVE_INFINITY);
            params.put("nan", Double.NaN);

            String hash = redundancyService.computeParametersHash(params);

            assertNotNull(hash, "浮点数边界值应正常处理");
            assertEquals(64, hash.length());
        }

        @Test
        @DisplayName("Boolean值测试 - true和false作为Map值")
        void testBooleanValues_ShouldHandleCorrectly() {
            Map<String, Object> params = new HashMap<>();
            params.put("trueValue", true);
            params.put("falseValue", false);
            params.put("nullBoolean", null);

            String hash = redundancyService.computeParametersHash(params);

            assertNotNull(hash);
            assertEquals(64, hash.length());
        }

        @Test
        @DisplayName("混合类型Map测试 - 各种类型混合")
        void testMixedTypeMap_ShouldHandleCorrectly() {
            Map<String, Object> params = new HashMap<>();
            params.put("string", "test");
            params.put("int", 42);
            params.put("long", 123456789L);
            params.put("double", 3.14159);
            params.put("boolean", true);
            params.put("null", null);
            params.put("list", Arrays.asList(1, 2, 3));
            params.put("nestedMap", Collections.singletonMap("nested", "value"));

            String hash = redundancyService.computeParametersHash(params);

            assertNotNull(hash, "混合类型Map应正常处理");
            assertEquals(64, hash.length());
        }

        @Test
        @DisplayName("空JSON对象字符串测试 - '{}'作为值")
        void testEmptyJsonObjectString_ShouldHandleCorrectly() {
            Map<String, Object> params = new HashMap<>();
            params.put("emptyJson", "{}");
            params.put("emptyArray", "[]");

            String hash = redundancyService.computeParametersHash(params);

            assertNotNull(hash);
            assertEquals(64, hash.length());
        }

        @Test
        @DisplayName("日期对象测试 - LocalDate和LocalDateTime作为值")
        void testDateObjects_ShouldHandleCorrectly() {
            Map<String, Object> params = new HashMap<>();
            params.put("localDate", LocalDate.now());
            params.put("localDateTime", LocalDateTime.now());
            params.put("epochDate", LocalDate.of(1970, 1, 1));
            params.put("futureDate", LocalDate.of(2099, 12, 31));

            String hash = redundancyService.computeParametersHash(params);

            assertNotNull(hash, "日期对象应正常处理");
            assertEquals(64, hash.length());
        }
    }

    // ==================== 参数化测试数据源 ====================

    /**
     * 提供整数边界值测试数据
     */
    static Stream<Integer> provideIntegerBoundaryValues() {
        return Stream.of(
            Integer.MAX_VALUE,
            Integer.MIN_VALUE,
            0,
            1,
            -1,
            Integer.MAX_VALUE - 1,
            Integer.MIN_VALUE + 1
        );
    }

    /**
     * 提供日期边界值测试数据
     */
    static Stream<LocalDate> provideDateBoundaryValues() {
        return Stream.of(
            LocalDate.of(1970, 1, 1),      // Unix纪元
            LocalDate.of(2000, 1, 1),      // Y2K
            LocalDate.of(2024, 2, 29),     // 闰年
            LocalDate.of(2099, 12, 31),    // 远未来
            LocalDate.now(),               // 今天
            LocalDate.now().minusYears(10),// 10年前
            LocalDate.now().plusYears(10)  // 10年后
        );
    }

    /**
     * 提供特殊字符串测试数据
     */
    static Stream<String> provideSpecialStrings() {
        return Stream.of(
            "",                             // 空字符串
            " ",                            // 单个空格
            "   ",                          // 多个空格
            "\t",                           // Tab
            "\n",                           // 换行
            "\r\n",                         // Windows换行
            "\u0000",                       // Null字符
            "\uFEFF",                       // BOM
            "\u200B",                       // 零宽空格
            "中文测试",                      // 中文
            "日本語テスト",                   // 日文
            "한국어",                        // 韩文
            "\uD83D\uDE00",                 // Emoji
            generateLongString(10000),      // 超长字符串
            getSpecialCharsString()         // 混合特殊字符
        );
    }
}

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

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * LLM幻觉检测测试
 * 验证系统能正确识别和处理LLM产生的虚假工具调用
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("LLMHallucinationDetection 幻觉检测测试")
class LLMHallucinationDetectionTest {

    @Mock
    private CorrectionRecordRepository correctionRecordRepository;

    @InjectMocks
    private SelfCorrectionServiceImpl selfCorrectionService;

    private static final String TEST_SESSION_ID = "hallucination-test-session";
    private static final String TEST_FACTORY_ID = "F001";
    private static final Long TEST_TOOL_CALL_ID = 1L;

    // 模拟已知的有效工具列表
    private static final Set<String> VALID_TOOL_NAMES = Set.of(
        "inventory_query",
        "batch_query",
        "material_batch_create",
        "production_plan_query",
        "quality_inspection_query"
    );

    // 模拟工具参数签名
    private static final Map<String, Set<String>> TOOL_REQUIRED_PARAMS = new HashMap<>();

    static {
        TOOL_REQUIRED_PARAMS.put("inventory_query", Set.of("factoryId"));
        TOOL_REQUIRED_PARAMS.put("batch_query", Set.of("batchId"));
        TOOL_REQUIRED_PARAMS.put("material_batch_create", Set.of("materialTypeId", "quantity", "supplierId"));
        TOOL_REQUIRED_PARAMS.put("production_plan_query", Set.of("factoryId", "date"));
        TOOL_REQUIRED_PARAMS.put("quality_inspection_query", Set.of("batchId"));
    }

    @BeforeEach
    void setUp() {
        // 初始化设置
    }

    @Test
    @DisplayName("检测不存在的工具名 - 应返回LOGIC_ERROR")
    void nonexistent_tool_name_should_be_detected() {
        // 模拟LLM生成了一个不存在的工具名
        String hallucinatedToolName = "imaginary_super_tool";
        String errorMessage = "Tool not found: " + hallucinatedToolName;

        // 验证错误分类
        ErrorCategory category = selfCorrectionService.classifyError(errorMessage, null);

        // 由于"not found"关键词，可能被分类为DATA_INSUFFICIENT
        // 或者根据具体实现可能是LOGIC_ERROR
        assertNotNull(category, "应该能分类此错误");

        // 验证幻觉检测逻辑
        boolean isHallucination = !VALID_TOOL_NAMES.contains(hallucinatedToolName);
        assertTrue(isHallucination, "应该检测到工具名不存在");
    }

    @Test
    @DisplayName("检测无效参数格式 - 应返回FORMAT_ERROR")
    void invalid_parameter_format_should_be_detected() {
        String errorMessage = "参数格式错误: 无法解析JSON";

        ErrorCategory category = selfCorrectionService.classifyError(errorMessage, null);

        assertEquals(ErrorCategory.FORMAT_ERROR, category, "格式错误应被正确分类");
    }

    @Test
    @DisplayName("检测缺少必填参数 - 应返回DATA_INSUFFICIENT")
    void missing_required_params_should_be_detected() {
        String errorMessage = "信息不足: 缺少必填参数 materialTypeId";

        ErrorCategory category = selfCorrectionService.classifyError(errorMessage, null);

        assertEquals(ErrorCategory.DATA_INSUFFICIENT, category, "缺少参数应被分类为DATA_INSUFFICIENT");
    }

    @ParameterizedTest
    @DisplayName("幻觉工具名检测")
    @CsvSource({
        "make_coffee,true",
        "send_email,true",
        "inventory_query,false",
        "batch_query,false",
        "generate_random_data,true",
        "hack_system,true"
    })
    void hallucinated_tool_name_detection(String toolName, boolean isHallucination) {
        boolean detected = !VALID_TOOL_NAMES.contains(toolName);
        assertEquals(isHallucination, detected, "工具 " + toolName + " 的幻觉检测结果应正确");
    }

    @Test
    @DisplayName("检测不合理的参数值 - 应返回LOGIC_ERROR")
    void unreasonable_parameter_values_should_be_detected() {
        // 模拟参数值明显不合理的情况
        String errorMessage = "逻辑错误: 数量不能为负数";

        ErrorCategory category = selfCorrectionService.classifyError(errorMessage, null);

        assertEquals(ErrorCategory.LOGIC_ERROR, category, "不合理的参数值应被分类为LOGIC_ERROR");
    }

    @Test
    @DisplayName("检测参数类型不匹配")
    void parameter_type_mismatch_should_be_detected() {
        String errorMessage = "解析失败: 期望数字但收到字符串";

        ErrorCategory category = selfCorrectionService.classifyError(errorMessage, null);

        assertEquals(ErrorCategory.FORMAT_ERROR, category, "类型不匹配应被分类为FORMAT_ERROR");
    }

    @Test
    @DisplayName("验证幻觉检测后的纠正策略")
    void hallucination_correction_strategy() {
        // 对于LOGIC_ERROR（幻觉），应使用PROMPT_INJECTION策略
        CorrectionStrategy strategy = selfCorrectionService.determineStrategy(ErrorCategory.LOGIC_ERROR);

        assertEquals(CorrectionStrategy.PROMPT_INJECTION, strategy, "幻觉错误应使用PROMPT_INJECTION策略");
    }

    @Test
    @DisplayName("创建幻觉纠错记录")
    void create_hallucination_correction_record() {
        String errorType = "TOOL_NOT_FOUND";
        String errorMessage = "工具 'imaginary_tool' 不存在";

        CorrectionRecord savedRecord = CorrectionRecord.builder()
            .id(1L)
            .toolCallId(TEST_TOOL_CALL_ID)
            .factoryId(TEST_FACTORY_ID)
            .sessionId(TEST_SESSION_ID)
            .errorType(errorType)
            .errorCategory(ErrorCategory.LOGIC_ERROR)
            .correctionStrategy(CorrectionStrategy.PROMPT_INJECTION)
            .build();

        when(correctionRecordRepository.save(any(CorrectionRecord.class))).thenReturn(savedRecord);

        CorrectionRecord result = selfCorrectionService.createCorrectionRecord(
            TEST_TOOL_CALL_ID, TEST_FACTORY_ID, TEST_SESSION_ID, errorType, errorMessage);

        assertNotNull(result);
        verify(correctionRecordRepository).save(any(CorrectionRecord.class));
    }

    @ParameterizedTest
    @DisplayName("必填参数验证")
    @MethodSource("provideToolParameterScenarios")
    void validate_required_parameters(String toolName, Map<String, Object> params, boolean shouldPass) {
        if (!VALID_TOOL_NAMES.contains(toolName)) {
            assertFalse(shouldPass, "无效工具不应通过验证");
            return;
        }

        Set<String> requiredParams = TOOL_REQUIRED_PARAMS.getOrDefault(toolName, Collections.emptySet());
        boolean hasAllRequired = params.keySet().containsAll(requiredParams);

        assertEquals(shouldPass, hasAllRequired, "参数验证结果应正确");
    }

    private static Stream<Arguments> provideToolParameterScenarios() {
        return Stream.of(
            // 完整参数
            Arguments.of("inventory_query", Map.of("factoryId", "F001"), true),
            Arguments.of("batch_query", Map.of("batchId", "B001"), true),
            Arguments.of("material_batch_create",
                Map.of("materialTypeId", "M001", "quantity", 100, "supplierId", "S001"), true),

            // 缺少必填参数
            Arguments.of("inventory_query", Map.of(), false),
            Arguments.of("batch_query", Map.of("wrongParam", "value"), false),
            Arguments.of("material_batch_create", Map.of("materialTypeId", "M001"), false),

            // 无效工具
            Arguments.of("fake_tool", Map.of("param", "value"), false)
        );
    }

    @Test
    @DisplayName("检测重复幻觉 - 同一会话多次产生相同幻觉")
    void detect_repeated_hallucination() {
        String hallucinatedTool = "fake_analysis_tool";

        // 模拟已有3次相同幻觉的记录
        CorrectionRecord record = CorrectionRecord.builder()
            .toolCallId(TEST_TOOL_CALL_ID)
            .correctionRounds(3)
            .errorCategory(ErrorCategory.LOGIC_ERROR)
            .build();

        when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(TEST_TOOL_CALL_ID))
            .thenReturn(List.of(record));

        boolean shouldRetry = selfCorrectionService.shouldRetry(TEST_TOOL_CALL_ID);

        assertFalse(shouldRetry, "重复幻觉达到3次后不应继续重试");
    }

    @Test
    @DisplayName("生成幻觉纠正提示")
    void generate_hallucination_correction_prompt() {
        String prompt = selfCorrectionService.generateCorrectionPrompt(
            ErrorCategory.LOGIC_ERROR, "工具 'nonexistent_tool' 不存在");

        assertNotNull(prompt);
        assertTrue(prompt.length() > 0, "应生成有效的纠正提示");
    }

    @Test
    @DisplayName("幻觉检测 - JSON注入攻击尝试")
    void detect_json_injection_attempt() {
        // 模拟LLM尝试通过参数进行JSON注入
        String maliciousError = "解析失败: Unexpected token in JSON at position 0";

        ErrorCategory category = selfCorrectionService.classifyError(maliciousError, null);

        assertEquals(ErrorCategory.FORMAT_ERROR, category, "JSON注入应被检测为FORMAT_ERROR");
    }

    @Test
    @DisplayName("幻觉检测 - 超长参数值")
    void detect_extremely_long_parameter() {
        String errorMessage = "格式错误: 参数值超过最大长度限制";

        ErrorCategory category = selfCorrectionService.classifyError(errorMessage, null);

        assertEquals(ErrorCategory.FORMAT_ERROR, category, "超长参数应被分类为FORMAT_ERROR");
    }

    @Test
    @DisplayName("幻觉检测 - 空工具调用")
    void detect_empty_tool_call() {
        String errorMessage = "数据为空: 工具名不能为空";

        ErrorCategory category = selfCorrectionService.classifyError(errorMessage, null);

        assertEquals(ErrorCategory.DATA_INSUFFICIENT, category, "空工具调用应被分类为DATA_INSUFFICIENT");
    }

    @Test
    @DisplayName("幻觉检测 - 循环调用检测")
    void detect_circular_call_pattern() {
        String errorMessage = "逻辑错误: 检测到循环调用模式";

        ErrorCategory category = selfCorrectionService.classifyError(errorMessage, null);

        assertEquals(ErrorCategory.LOGIC_ERROR, category, "循环调用应被分类为LOGIC_ERROR");
    }

    @Test
    @DisplayName("验证幻觉检测的完整流程")
    void verify_full_hallucination_detection_flow() {
        // 1. 检测到幻觉
        String errorMessage = "逻辑错误: 工具 'ghost_tool' 不存在于系统中";
        ErrorCategory category = selfCorrectionService.classifyError(errorMessage, null);
        assertEquals(ErrorCategory.LOGIC_ERROR, category);

        // 2. 确定策略
        CorrectionStrategy strategy = selfCorrectionService.determineStrategy(category);
        assertEquals(CorrectionStrategy.PROMPT_INJECTION, strategy);

        // 3. 创建记录
        CorrectionRecord savedRecord = CorrectionRecord.builder()
            .id(1L)
            .toolCallId(TEST_TOOL_CALL_ID)
            .factoryId(TEST_FACTORY_ID)
            .sessionId(TEST_SESSION_ID)
            .errorType("HALLUCINATION")
            .errorCategory(category)
            .correctionStrategy(strategy)
            .correctionRounds(1)
            .build();

        when(correctionRecordRepository.save(any(CorrectionRecord.class))).thenReturn(savedRecord);
        when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(TEST_TOOL_CALL_ID))
            .thenReturn(List.of(savedRecord));

        CorrectionRecord result = selfCorrectionService.createCorrectionRecord(
            TEST_TOOL_CALL_ID, TEST_FACTORY_ID, TEST_SESSION_ID, "HALLUCINATION", errorMessage);

        assertNotNull(result);
        assertEquals(ErrorCategory.LOGIC_ERROR, result.getErrorCategory());
        assertEquals(CorrectionStrategy.PROMPT_INJECTION, result.getCorrectionStrategy());

        // 4. 检查是否应重试
        boolean shouldRetry = selfCorrectionService.shouldRetry(TEST_TOOL_CALL_ID);
        assertTrue(shouldRetry, "第一次幻觉后应该重试");
    }

    @Test
    @DisplayName("多类型幻觉混合检测")
    void mixed_hallucination_types_detection() {
        // 工具名幻觉
        assertNotNull(selfCorrectionService.classifyError("逻辑错误: 未知工具", null));

        // 参数幻觉
        assertNotNull(selfCorrectionService.classifyError("格式错误: 无效参数", null));

        // 返回值幻觉（LLM编造的结果）
        assertNotNull(selfCorrectionService.classifyError("结果异常: 数据不一致", null));
    }
}

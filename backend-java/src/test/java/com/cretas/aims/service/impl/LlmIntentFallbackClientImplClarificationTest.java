package com.cretas.aims.service.impl;

import com.cretas.aims.entity.config.AIIntentConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.MockitoAnnotations;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 测试 LlmIntentFallbackClientImpl 的澄清问题生成功能
 */
class LlmIntentFallbackClientImplClarificationTest {

    @InjectMocks
    private LlmIntentFallbackClientImpl client;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    /**
     * 测试参数名到友好名称的映射
     */
    @Test
    void testGetParameterFriendlyName() throws Exception {
        // 使用反射访问私有方法
        Method method = LlmIntentFallbackClientImpl.class.getDeclaredMethod(
                "getParameterFriendlyName", String.class);
        method.setAccessible(true);

        // 测试已知参数
        assertEquals("批次编号", method.invoke(client, "batchId"));
        assertEquals("数量", method.invoke(client, "quantity"));
        assertEquals("材料类型", method.invoke(client, "materialTypeId"));
        assertEquals("供应商", method.invoke(client, "supplierId"));

        // 测试未知参数（应返回原值）
        assertEquals("unknownParam", method.invoke(client, "unknownParam"));

        // 测试 null
        assertEquals("信息", method.invoke(client, null));
    }

    /**
     * 测试模板生成澄清问题 - 单个参数
     */
    @Test
    void testGenerateTemplateClarificationQuestions_SingleParam() throws Exception {
        Method method = LlmIntentFallbackClientImpl.class.getDeclaredMethod(
                "generateTemplateClarificationQuestions",
                AIIntentConfig.class,
                List.class);
        method.setAccessible(true);

        AIIntentConfig intent = AIIntentConfig.builder()
                .intentCode("UPDATE_BATCH")
                .intentName("批次更新")
                .build();

        List<String> missingParams = Arrays.asList("batchId");

        @SuppressWarnings("unchecked")
        List<String> questions = (List<String>) method.invoke(client, intent, missingParams);

        assertNotNull(questions);
        assertEquals(1, questions.size());
        assertTrue(questions.get(0).contains("批次编号"));
    }

    /**
     * 测试模板生成澄清问题 - 多个参数
     */
    @Test
    void testGenerateTemplateClarificationQuestions_MultipleParams() throws Exception {
        Method method = LlmIntentFallbackClientImpl.class.getDeclaredMethod(
                "generateTemplateClarificationQuestions",
                AIIntentConfig.class,
                List.class);
        method.setAccessible(true);

        AIIntentConfig intent = AIIntentConfig.builder()
                .intentCode("UPDATE_BATCH")
                .intentName("批次更新")
                .build();

        List<String> missingParams = Arrays.asList("batchId", "quantity", "supplierId");

        @SuppressWarnings("unchecked")
        List<String> questions = (List<String>) method.invoke(client, intent, missingParams);

        assertNotNull(questions);
        assertTrue(questions.size() <= 3, "Should return at most 3 questions");
        assertTrue(questions.size() >= 1, "Should return at least 1 question");

        // 第一个问题应该是汇总问题
        String firstQuestion = questions.get(0);
        assertTrue(firstQuestion.contains("批次编号"));
        assertTrue(firstQuestion.contains("数量"));
        assertTrue(firstQuestion.contains("供应商"));
    }

    /**
     * 测试解析澄清问题 - 标准格式
     */
    @Test
    void testParseClarificationQuestions_Standard() throws Exception {
        Method method = LlmIntentFallbackClientImpl.class.getDeclaredMethod(
                "parseClarificationQuestions", String.class);
        method.setAccessible(true);

        String llmResponse = "请问是哪个批次的材料？\n需要更新多少数量？\n供应商是哪一家？";

        @SuppressWarnings("unchecked")
        List<String> questions = (List<String>) method.invoke(client, llmResponse);

        assertNotNull(questions);
        assertEquals(3, questions.size());
        assertEquals("请问是哪个批次的材料？", questions.get(0));
        assertEquals("需要更新多少数量？", questions.get(1));
        assertEquals("供应商是哪一家？", questions.get(2));
    }

    /**
     * 测试解析澄清问题 - 带编号格式
     */
    @Test
    void testParseClarificationQuestions_WithNumbers() throws Exception {
        Method method = LlmIntentFallbackClientImpl.class.getDeclaredMethod(
                "parseClarificationQuestions", String.class);
        method.setAccessible(true);

        String llmResponse = "1. 请问是哪个批次的材料？\n2. 需要更新多少数量？\n3. 供应商是哪一家？";

        @SuppressWarnings("unchecked")
        List<String> questions = (List<String>) method.invoke(client, llmResponse);

        assertNotNull(questions);
        assertEquals(3, questions.size());
        // 编号应该被移除
        assertFalse(questions.get(0).startsWith("1."));
        assertFalse(questions.get(1).startsWith("2."));
    }

    /**
     * 测试解析澄清问题 - 空输入
     */
    @Test
    void testParseClarificationQuestions_Empty() throws Exception {
        Method method = LlmIntentFallbackClientImpl.class.getDeclaredMethod(
                "parseClarificationQuestions", String.class);
        method.setAccessible(true);

        @SuppressWarnings("unchecked")
        List<String> questions1 = (List<String>) method.invoke(client, "");
        assertTrue(questions1.isEmpty());

        @SuppressWarnings("unchecked")
        List<String> questions2 = (List<String>) method.invoke(client, (String) null);
        assertTrue(questions2.isEmpty());
    }

    /**
     * 测试解析澄清问题 - 超过3个问题（应只返回前3个）
     */
    @Test
    void testParseClarificationQuestions_MoreThanThree() throws Exception {
        Method method = LlmIntentFallbackClientImpl.class.getDeclaredMethod(
                "parseClarificationQuestions", String.class);
        method.setAccessible(true);

        String llmResponse = "问题1？\n问题2？\n问题3？\n问题4？\n问题5？";

        @SuppressWarnings("unchecked")
        List<String> questions = (List<String>) method.invoke(client, llmResponse);

        assertNotNull(questions);
        assertEquals(3, questions.size(), "Should return at most 3 questions");
    }

    /**
     * 测试构建澄清问题提示词
     */
    @Test
    void testBuildClarificationPrompt() throws Exception {
        Method method = LlmIntentFallbackClientImpl.class.getDeclaredMethod(
                "buildClarificationPrompt",
                String.class,
                AIIntentConfig.class,
                List.class);
        method.setAccessible(true);

        AIIntentConfig intent = AIIntentConfig.builder()
                .intentCode("UPDATE_BATCH")
                .intentName("批次更新")
                .build();

        List<String> missingParams = Arrays.asList("batchId", "quantity");

        String prompt = (String) method.invoke(
                client,
                "更新批次数量",
                intent,
                missingParams);

        assertNotNull(prompt);
        assertTrue(prompt.contains("批次更新"), "Should contain intent name");
        assertTrue(prompt.contains("更新批次数量"), "Should contain user input");
        assertTrue(prompt.contains("批次编号"), "Should contain friendly parameter name");
        assertTrue(prompt.contains("数量"), "Should contain friendly parameter name");
        assertTrue(prompt.contains("1-3"), "Should mention question count limit");
    }
}

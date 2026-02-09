package com.cretas.aims.ai.tool;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.ai.dto.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tool Calling 功能测试
 *
 * 测试 DashScopeClient 的 OpenAI Function Calling 支持
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-06
 */
@SpringBootTest
class ToolExecutionTest {

    @Autowired
    private DashScopeClient dashScopeClient;

    @Autowired
    private ObjectMapper objectMapper;

    private List<Tool> testTools;

    @BeforeEach
    void setUp() {
        // 定义测试工具
        testTools = List.of(
                Tool.of(
                        "search_materials",
                        "搜索原料信息，返回匹配的原料列表",
                        Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "keyword", Map.of("type", "string", "description", "搜索关键词")
                                ),
                                "required", List.of("keyword")
                        )
                ),
                Tool.of(
                        "get_inventory_stats",
                        "获取库存统计数据",
                        Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "category", Map.of("type", "string", "description", "原料类别")
                                ),
                                "required", List.of()
                        )
                )
        );
    }

    /**
     * 测试基础 Tool Calling
     */
    @Test
    void testBasicToolCalling() {
        if (!dashScopeClient.isAvailable()) {
            System.out.println("DashScope 未配置，跳过测试");
            return;
        }

        // 调用 LLM
        ChatCompletionResponse response = dashScopeClient.chatWithTools(
                "你是一个仓库管理助手，可以帮助用户查询原料和库存信息。",
                "帮我查找包含'面粉'的原料",
                testTools
        );

        // 验证响应
        assertNotNull(response);
        assertFalse(response.hasError(), "LLM 调用不应该有错误");

        // 检查是否包含工具调用
        if (dashScopeClient.hasToolCalls(response)) {
            ToolCall toolCall = dashScopeClient.getFirstToolCall(response);
            assertNotNull(toolCall, "应该包含工具调用");
            assertNotNull(toolCall.getId(), "工具调用应该有 ID");
            assertEquals("function", toolCall.getType(), "工具类型应该是 function");

            System.out.println("LLM 请求调用工具: " + toolCall.getFunction().getName());
            System.out.println("参数: " + toolCall.getFunction().getArguments());
        } else {
            System.out.println("LLM 直接返回文本: " + response.getContent());
        }
    }

    /**
     * 测试多轮对话 Tool Calling
     */
    @Test
    void testMultiTurnToolCalling() throws Exception {
        if (!dashScopeClient.isAvailable()) {
            System.out.println("DashScope 未配置，跳过测试");
            return;
        }

        List<ChatMessage> conversation = new java.util.ArrayList<>();
        conversation.add(ChatMessage.system("你是一个仓库管理助手。"));
        conversation.add(ChatMessage.user("帮我查找面粉原料"));

        // Round 1: LLM 请求调用工具
        ChatCompletionResponse response1 = dashScopeClient.chatCompletionWithTools(
                conversation,
                testTools,
                "auto"
        );

        if (dashScopeClient.hasToolCalls(response1)) {
            ToolCall toolCall = dashScopeClient.getFirstToolCall(response1);

            System.out.println("Round 1 - LLM 请求工具: " + toolCall.getFunction().getName());

            // 将工具调用添加到对话历史
            conversation.add(ChatMessage.assistant(null, List.of(toolCall)));

            // 模拟工具执行结果
            String toolResult = objectMapper.writeValueAsString(Map.of(
                    "success", true,
                    "results", List.of(
                            Map.of("id", "M001", "name", "高筋面粉", "quantity", 100, "unit", "kg"),
                            Map.of("id", "M002", "name", "低筋面粉", "quantity", 50, "unit", "kg")
                    )
            ));

            // 将工具结果添加到对话历史
            conversation.add(ChatMessage.tool(toolResult, toolCall.getId()));

            // Round 2: LLM 处理工具结果
            ChatCompletionResponse response2 = dashScopeClient.chatCompletionWithTools(
                    conversation,
                    testTools,
                    "auto"
            );

            String finalAnswer = response2.getContent();
            System.out.println("Round 2 - LLM 最终回答: " + finalAnswer);

            assertNotNull(finalAnswer, "应该返回最终答案");
            assertFalse(finalAnswer.isEmpty(), "最终答案不应为空");
        } else {
            System.out.println("LLM 直接返回: " + response1.getContent());
        }
    }

    /**
     * 测试强制工具调用
     */
    @Test
    void testForcedToolChoice() {
        if (!dashScopeClient.isAvailable()) {
            System.out.println("DashScope 未配置，跳过测试");
            return;
        }

        List<ChatMessage> messages = List.of(
                ChatMessage.system("你是一个仓库管理助手。"),
                ChatMessage.user("显示库存统计")
        );

        // 强制调用 get_inventory_stats 工具
        ChatCompletionResponse response = dashScopeClient.chatCompletionWithTools(
                messages,
                testTools,
                "get_inventory_stats"
        );

        // 验证响应
        assertNotNull(response);

        if (dashScopeClient.hasToolCalls(response)) {
            ToolCall toolCall = dashScopeClient.getFirstToolCall(response);
            assertEquals("get_inventory_stats", toolCall.getFunction().getName(),
                    "应该调用指定的工具");
            System.out.println("强制调用工具成功: " + toolCall.getFunction().getName());
        } else {
            System.out.println("LLM 返回: " + response.getContent());
        }
    }

    /**
     * 测试工具调用辅助方法
     */
    @Test
    void testToolCallHelperMethods() {
        // 创建模拟响应
        ChatCompletionResponse response = new ChatCompletionResponse();

        ChatCompletionResponse.Message message = new ChatCompletionResponse.Message();
        message.setRole("assistant");
        message.setToolCalls(List.of(
                ToolCall.of("call_123", "search_materials", "{\"keyword\": \"面粉\"}"),
                ToolCall.of("call_456", "get_inventory_stats", "{\"category\": \"原料\"}")
        ));

        ChatCompletionResponse.Choice choice = new ChatCompletionResponse.Choice();
        choice.setMessage(message);

        response.setChoices(List.of(choice));

        // 测试辅助方法
        assertTrue(dashScopeClient.hasToolCalls(response), "应该包含工具调用");

        ToolCall firstCall = dashScopeClient.getFirstToolCall(response);
        assertNotNull(firstCall);
        assertEquals("call_123", firstCall.getId());
        assertEquals("search_materials", firstCall.getFunction().getName());

        List<ToolCall> allCalls = dashScopeClient.getAllToolCalls(response);
        assertEquals(2, allCalls.size(), "应该有 2 个工具调用");
    }

    /**
     * 测试 Tool 定义构建
     */
    @Test
    void testToolDefinitionBuilding() throws Exception {
        Tool tool = Tool.of(
                "test_function",
                "测试函数",
                Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "param1", Map.of("type", "string", "description", "参数1")
                        ),
                        "required", List.of("param1")
                )
        );

        // 验证工具定义
        assertEquals("function", tool.getType());
        assertEquals("test_function", tool.getFunction().getName());
        assertEquals("测试函数", tool.getFunction().getDescription());
        assertNotNull(tool.getFunction().getParameters());

        // 验证 JSON 序列化
        String json = objectMapper.writeValueAsString(tool);
        System.out.println("Tool JSON: " + json);

        assertTrue(json.contains("\"type\":\"function\""));
        assertTrue(json.contains("\"name\":\"test_function\""));
    }

    /**
     * 测试 ChatMessage 工具消息构建
     */
    @Test
    void testChatMessageToolSupport() throws Exception {
        // 测试 assistant 消息带 tool_calls
        ToolCall toolCall = ToolCall.of("call_123", "search", "{\"q\":\"test\"}");
        ChatMessage assistantMsg = ChatMessage.assistant(null, List.of(toolCall));

        assertEquals("assistant", assistantMsg.getRole());
        assertNotNull(assistantMsg.getToolCalls());
        assertEquals(1, assistantMsg.getToolCalls().size());

        // 测试 tool 消息
        ChatMessage toolMsg = ChatMessage.tool("{\"result\":\"success\"}", "call_123");

        assertEquals("tool", toolMsg.getRole());
        assertEquals("{\"result\":\"success\"}", toolMsg.getContent());
        assertEquals("call_123", toolMsg.getToolCallId());

        // 验证 JSON 序列化
        String json = objectMapper.writeValueAsString(toolMsg);
        System.out.println("Tool Message JSON: " + json);

        assertTrue(json.contains("\"role\":\"tool\""));
        assertTrue(json.contains("\"tool_call_id\":\"call_123\""));
    }
}

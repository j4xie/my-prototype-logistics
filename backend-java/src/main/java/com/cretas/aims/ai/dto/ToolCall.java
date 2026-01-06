package com.cretas.aims.ai.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * OpenAI Function Calling - 工具调用
 *
 * 当 LLM 决定调用某个工具时，会在响应中返回此结构。
 * 包含工具的唯一 ID、类型以及具体的函数调用信息。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-06
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ToolCall {

    /**
     * 工具调用的唯一标识符
     * 用于在后续请求中引用此次工具调用的结果
     */
    private String id;

    /**
     * 工具类型（固定为 "function"）
     */
    @Builder.Default
    private String type = "function";

    /**
     * 函数调用信息
     */
    private FunctionCall function;

    /**
     * 函数调用详情
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class FunctionCall {
        /**
         * 函数名称（必须匹配工具定义中的 name）
         */
        private String name;

        /**
         * 函数参数（JSON 字符串格式）
         *
         * 示例: "{\"intent_code\":\"QUERY_MATERIAL\",\"intent_name\":\"查询原料\"}"
         */
        private String arguments;
    }

    /**
     * 快速创建 ToolCall
     *
     * @param id 工具调用 ID
     * @param functionName 函数名
     * @param arguments 参数 JSON 字符串
     * @return ToolCall 实例
     */
    public static ToolCall of(String id, String functionName, String arguments) {
        return ToolCall.builder()
                .id(id)
                .type("function")
                .function(FunctionCall.builder()
                        .name(functionName)
                        .arguments(arguments)
                        .build())
                .build();
    }
}

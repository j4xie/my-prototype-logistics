package com.cretas.aims.ai.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * OpenAI Function Calling - 工具定义
 *
 * 用于告诉 LLM 有哪些工具可用，以及如何调用它们。
 * LLM 会根据用户输入，自主决定是否调用工具。
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
public class Tool {

    /**
     * 工具类型（固定为 "function"）
     */
    @Builder.Default
    private String type = "function";

    /**
     * 函数定义
     */
    private FunctionDefinition function;

    /**
     * 函数定义
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class FunctionDefinition {
        /**
         * 函数名称（唯一标识）
         */
        private String name;

        /**
         * 函数描述（LLM 用于判断何时调用）
         */
        private String description;

        /**
         * 参数定义（JSON Schema 格式）
         *
         * 示例:
         * {
         *   "type": "object",
         *   "properties": {
         *     "intent_code": {"type": "string", "description": "意图代码"},
         *     "intent_name": {"type": "string", "description": "意图名称"}
         *   },
         *   "required": ["intent_code", "intent_name"]
         * }
         */
        private Map<String, Object> parameters;

        /**
         * 是否严格模式（某些模型支持）
         */
        private Boolean strict;
    }

    /**
     * 快速创建工具定义
     *
     * @param name 函数名
     * @param description 函数描述
     * @param parameters 参数 JSON Schema
     * @return 工具定义
     */
    public static Tool of(String name, String description, Map<String, Object> parameters) {
        return Tool.builder()
                .type("function")
                .function(FunctionDefinition.builder()
                        .name(name)
                        .description(description)
                        .parameters(parameters)
                        .build())
                .build();
    }
}

package com.cretas.aims.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * AI 状态机解析响应
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AIStateMachineParseResponse {

    /**
     * 是否成功
     */
    private Boolean success;

    /**
     * 状态机名称
     */
    private String machineName;

    /**
     * 状态机描述
     */
    private String machineDescription;

    /**
     * 初始状态
     */
    private String initialState;

    /**
     * 状态列表
     */
    private List<StateDefinitionDTO> states;

    /**
     * 转换列表
     */
    private List<TransitionDefinitionDTO> transitions;

    /**
     * AI 解释
     */
    private String aiExplanation;

    /**
     * 建议
     */
    private List<String> suggestions;

    /**
     * 消息
     */
    private String message;

    /**
     * 状态定义 DTO
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StateDefinitionDTO {
        private String code;
        private String name;
        private String description;
        private String color;
        private Boolean isFinal;
    }

    /**
     * 转换定义 DTO
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TransitionDefinitionDTO {
        private String fromState;
        private String toState;
        private String event;
        private String guard;
        private String action;
        private String description;
    }
}

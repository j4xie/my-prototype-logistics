package com.cretas.aims.dto.skill;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Skill执行上下文DTO
 *
 * 封装Skill执行所需的所有上下文信息，包括：
 * - 用户和工厂标识
 * - 会话信息
 * - 用户查询和提取的参数
 * - 对话历史
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SkillContext {

    /**
     * 工厂ID
     * 用于限定数据查询范围和权限校验
     */
    private String factoryId;

    /**
     * 用户ID
     * 执行Skill的用户标识
     */
    private String userId;

    /**
     * 会话ID
     * 用于多轮对话追踪和上下文延续
     */
    private String sessionId;

    /**
     * 用户原始查询
     * 用户输入的自然语言问题或指令
     */
    private String userQuery;

    /**
     * 提取的参数
     * 从用户查询中解析出的结构化参数
     * key: 参数名称 (如 startDate, productType)
     * value: 参数值
     */
    private Map<String, Object> extractedParams;

    /**
     * 对话历史
     * 用于多轮对话的上下文保持
     * 包含之前的问答记录
     */
    private Map<String, Object> conversationHistory;
}

package com.cretas.aims.dto.conversation;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 对话消息 DTO
 *
 * 表示对话中的一条消息
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-15
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversationMessage {

    /**
     * 消息角色
     */
    public enum Role {
        USER,
        ASSISTANT,
        SYSTEM
    }

    /**
     * 角色
     */
    private Role role;

    /**
     * 消息内容
     */
    private String content;

    /**
     * 时间戳
     */
    private LocalDateTime timestamp;

    /**
     * 意图代码 (如果识别到)
     */
    private String intentCode;

    /**
     * 元数据
     */
    private Map<String, Object> metadata;

    /**
     * 消息中识别到的实体
     * key: 实体类型, value: 实体值
     */
    private Map<String, Object> entities;

    /**
     * 创建用户消息
     */
    public static ConversationMessage user(String content) {
        return ConversationMessage.builder()
                .role(Role.USER)
                .content(content)
                .timestamp(LocalDateTime.now())
                .build();
    }

    /**
     * 创建助手消息
     */
    public static ConversationMessage assistant(String content) {
        return ConversationMessage.builder()
                .role(Role.ASSISTANT)
                .content(content)
                .timestamp(LocalDateTime.now())
                .build();
    }

    /**
     * 创建带意图的助手消息
     */
    public static ConversationMessage assistant(String content, String intentCode) {
        return ConversationMessage.builder()
                .role(Role.ASSISTANT)
                .content(content)
                .intentCode(intentCode)
                .timestamp(LocalDateTime.now())
                .build();
    }

    /**
     * 创建系统消息
     */
    public static ConversationMessage system(String content) {
        return ConversationMessage.builder()
                .role(Role.SYSTEM)
                .content(content)
                .timestamp(LocalDateTime.now())
                .build();
    }
}

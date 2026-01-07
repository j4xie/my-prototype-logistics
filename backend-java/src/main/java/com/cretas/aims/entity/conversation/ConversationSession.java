package com.cretas.aims.entity.conversation;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.*;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 多轮对话会话实体
 *
 * 当 Layer 1-4 置信度 < 30% 且无明确匹配时触发 Layer 5 多轮对话模式。
 * 支持最多 5 轮对话来澄清用户意图。
 *
 * 生命周期:
 * 1. ACTIVE - 对话进行中
 * 2. COMPLETED - 成功识别意图
 * 3. TIMEOUT - 超时未响应
 * 4. CANCELLED - 用户取消
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-06
 */
@Entity
@Table(name = "conversation_sessions", indexes = {
    @Index(name = "idx_cs_factory_user", columnList = "factory_id, user_id"),
    @Index(name = "idx_cs_status", columnList = "status"),
    @Index(name = "idx_cs_created_at", columnList = "created_at")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversationSession {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    /**
     * 会话ID (UUID)
     */
    @Id
    @Column(name = "session_id", length = 36)
    private String sessionId;

    /**
     * 工厂ID
     */
    @Column(name = "factory_id", length = 50)
    private String factoryId;

    /**
     * 用户ID
     */
    @Column(name = "user_id")
    private Long userId;

    /**
     * 用户最初的输入
     */
    @Column(name = "original_input", columnDefinition = "TEXT", nullable = false)
    private String originalInput;

    /**
     * 最终识别的意图代码 (对话结束后填充)
     */
    @Column(name = "final_intent_code", length = 100)
    private String finalIntentCode;

    /**
     * 当前轮次 (最多5轮)
     */
    @Column(name = "current_round", nullable = false)
    @Builder.Default
    private Integer currentRound = 0;

    /**
     * 最大轮次限制
     */
    @Column(name = "max_rounds")
    @Builder.Default
    private Integer maxRounds = 5;

    /**
     * 会话状态
     */
    @Column(name = "status", length = 20, nullable = false)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private SessionStatus status = SessionStatus.ACTIVE;

    /**
     * 对话历史 JSON
     * 格式: [{"role": "user/assistant", "content": "...", "timestamp": "..."}]
     */
    @Column(name = "messages_json", columnDefinition = "TEXT")
    private String messagesJson;

    /**
     * 候选意图列表 JSON
     * 格式: [{"intentCode": "...", "confidence": 0.5}]
     */
    @Column(name = "candidates_json", columnDefinition = "TEXT")
    private String candidatesJson;

    /**
     * 最后识别的置信度
     */
    @Column(name = "last_confidence")
    private Double lastConfidence;

    /**
     * 超时时间（分钟）
     */
    @Column(name = "timeout_minutes")
    @Builder.Default
    private Integer timeoutMinutes = 10;

    /**
     * 创建时间
     */
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    /**
     * 更新时间
     */
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * 最后活跃时间
     */
    @Column(name = "last_active_at")
    private LocalDateTime lastActiveAt;

    /**
     * 完成时间
     */
    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @PrePersist
    protected void onCreate() {
        if (sessionId == null) {
            sessionId = java.util.UUID.randomUUID().toString();
        }
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (lastActiveAt == null) {
            lastActiveAt = LocalDateTime.now();
        }
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // ========== 会话状态枚举 ==========

    public enum SessionStatus {
        /** 对话进行中 */
        ACTIVE,
        /** 成功识别意图 */
        COMPLETED,
        /** 超时未响应 */
        TIMEOUT,
        /** 用户取消 */
        CANCELLED,
        /** 达到最大轮次仍未识别 */
        MAX_ROUNDS_REACHED
    }

    // ========== 对话消息类 ==========

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Message {
        private String role; // "user" or "assistant"
        private String content;
        private LocalDateTime timestamp;

        public static Message user(String content) {
            return Message.builder()
                    .role("user")
                    .content(content)
                    .timestamp(LocalDateTime.now())
                    .build();
        }

        public static Message assistant(String content) {
            return Message.builder()
                    .role("assistant")
                    .content(content)
                    .timestamp(LocalDateTime.now())
                    .build();
        }
    }

    // ========== 候选意图类 ==========

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CandidateIntent {
        private String intentCode;
        private String intentName;
        private Double confidence;
        private String reasoning;
    }

    // ========== 便捷方法 ==========

    /**
     * 获取消息列表
     */
    public List<Message> getMessages() {
        if (messagesJson == null || messagesJson.isEmpty()) {
            return new ArrayList<>();
        }
        try {
            return OBJECT_MAPPER.readValue(messagesJson, new TypeReference<List<Message>>() {});
        } catch (JsonProcessingException e) {
            return new ArrayList<>();
        }
    }

    /**
     * 设置消息列表
     */
    public void setMessages(List<Message> messages) {
        try {
            this.messagesJson = OBJECT_MAPPER.writeValueAsString(messages);
        } catch (JsonProcessingException e) {
            this.messagesJson = "[]";
        }
    }

    /**
     * 添加消息
     */
    public void addMessage(Message message) {
        List<Message> messages = getMessages();
        messages.add(message);
        setMessages(messages);
        this.lastActiveAt = LocalDateTime.now();
    }

    /**
     * 添加用户消息
     */
    public void addUserMessage(String content) {
        addMessage(Message.user(content));
    }

    /**
     * 添加助手消息
     */
    public void addAssistantMessage(String content) {
        addMessage(Message.assistant(content));
    }

    /**
     * 获取候选意图列表
     */
    public List<CandidateIntent> getCandidates() {
        if (candidatesJson == null || candidatesJson.isEmpty()) {
            return new ArrayList<>();
        }
        try {
            return OBJECT_MAPPER.readValue(candidatesJson, new TypeReference<List<CandidateIntent>>() {});
        } catch (JsonProcessingException e) {
            return new ArrayList<>();
        }
    }

    /**
     * 设置候选意图列表
     */
    public void setCandidates(List<CandidateIntent> candidates) {
        try {
            this.candidatesJson = OBJECT_MAPPER.writeValueAsString(candidates);
        } catch (JsonProcessingException e) {
            this.candidatesJson = "[]";
        }
    }

    /**
     * 进入下一轮
     */
    public boolean nextRound() {
        if (currentRound >= maxRounds) {
            return false;
        }
        this.currentRound++;
        this.lastActiveAt = LocalDateTime.now();
        return true;
    }

    /**
     * 检查是否已超时
     */
    public boolean isExpired() {
        if (status != SessionStatus.ACTIVE) {
            return false;
        }
        if (lastActiveAt == null) {
            return false;
        }
        LocalDateTime expireTime = lastActiveAt.plusMinutes(timeoutMinutes);
        return LocalDateTime.now().isAfter(expireTime);
    }

    /**
     * 检查是否可以继续对话
     */
    public boolean canContinue() {
        return status == SessionStatus.ACTIVE && currentRound < maxRounds && !isExpired();
    }

    /**
     * 完成会话
     */
    public void complete(String intentCode, double confidence) {
        this.finalIntentCode = intentCode;
        this.lastConfidence = confidence;
        this.status = SessionStatus.COMPLETED;
        this.completedAt = LocalDateTime.now();
    }

    /**
     * 超时会话
     */
    public void timeout() {
        this.status = SessionStatus.TIMEOUT;
        this.completedAt = LocalDateTime.now();
    }

    /**
     * 取消会话
     */
    public void cancel() {
        this.status = SessionStatus.CANCELLED;
        this.completedAt = LocalDateTime.now();
    }

    /**
     * 达到最大轮次
     */
    public void maxRoundsReached() {
        this.status = SessionStatus.MAX_ROUNDS_REACHED;
        this.completedAt = LocalDateTime.now();
    }

    /**
     * 构建对话历史字符串 (用于发送给 LLM)
     */
    public String buildConversationHistory() {
        List<Message> messages = getMessages();
        if (messages.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (Message msg : messages) {
            String role = "user".equals(msg.getRole()) ? "用户" : "助手";
            sb.append(role).append(": ").append(msg.getContent()).append("\n\n");
        }
        return sb.toString();
    }

    /**
     * 创建新会话
     */
    public static ConversationSession create(String factoryId, Long userId, String originalInput) {
        ConversationSession session = ConversationSession.builder()
                .factoryId(factoryId)
                .userId(userId)
                .originalInput(originalInput)
                .currentRound(1)
                .maxRounds(5)
                .status(SessionStatus.ACTIVE)
                .timeoutMinutes(10)
                .build();

        // 添加初始用户消息
        session.addUserMessage(originalInput);

        return session;
    }
}

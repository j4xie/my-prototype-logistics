package com.cretas.aims.entity.integration;

import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Type;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 钉钉 Webhook 消息日志 (双向, INBOUND/OUTBOUND).
 *
 * <p>per SCHEMA_DESIGN §2.4 — C-AI-1 钉钉机器人 PoC.
 *
 * <p>不继承 BaseEntity — 审计日志只读, 不软删.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "dingtalk_webhook_logs", indexes = {
        @Index(name = "idx_dwl_factory_time", columnList = "factory_id,received_at"),
        @Index(name = "idx_dwl_session", columnList = "session_id"),
        @Index(name = "idx_dwl_user_dingtalk", columnList = "dingtalk_user_id"),
        @Index(name = "idx_dwl_status_retry", columnList = "status,next_retry_at"),
        @Index(name = "idx_dwl_ai_audit", columnList = "ai_audit_log_id")
})
public class DingTalkWebhookLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "factory_id", length = 50)
    private String factoryId;

    @Enumerated(EnumType.STRING)
    @Column(name = "direction", nullable = false, length = 10)
    private Direction direction;

    @Column(name = "message_type", nullable = false, length = 30)
    private String messageType;

    @Column(name = "dingtalk_corp_id", length = 100)
    private String dingtalkCorpId;

    @Column(name = "dingtalk_chat_id", length = 100)
    private String dingtalkChatId;

    @Column(name = "dingtalk_user_id", length = 100)
    private String dingtalkUserId;

    @Column(name = "dingtalk_user_name", length = 100)
    private String dingtalkUserName;

    @Column(name = "dingtalk_message_id", length = 200)
    private String dingtalkMessageId;

    @Column(name = "webhook_url", length = 500)
    private String webhookUrl;

    @Column(name = "message_content", columnDefinition = "TEXT", nullable = false)
    private String messageContent;

    @Type(JsonBinaryType.class)
    @Column(name = "message_payload", columnDefinition = "jsonb")
    private Map<String, Object> messagePayload;

    @Builder.Default
    @Column(name = "is_sensitive", nullable = false)
    private Boolean isSensitive = false;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "ai_audit_log_id")
    private Long aiAuditLogId;

    @Column(name = "intent_code", length = 100)
    private String intentCode;

    @Column(name = "session_id", length = 100)
    private String sessionId;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private Status status = Status.PENDING;

    @Column(name = "error_message", length = 2000)
    private String errorMessage;

    @Builder.Default
    @Column(name = "retry_count", nullable = false)
    private Integer retryCount = 0;

    @Column(name = "next_retry_at")
    private LocalDateTime nextRetryAt;

    @Column(name = "received_at", nullable = false)
    private LocalDateTime receivedAt;

    @Column(name = "delivered_at")
    private LocalDateTime deliveredAt;

    @Column(name = "created_at", updatable = false, nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        if (receivedAt == null) receivedAt = now;
        if (status == null) status = Status.PENDING;
        if (isSensitive == null) isSensitive = false;
        if (retryCount == null) retryCount = 0;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum Direction { INBOUND, OUTBOUND }

    public enum Status { PENDING, SENT, DELIVERED, FAILED, IGNORED }
}

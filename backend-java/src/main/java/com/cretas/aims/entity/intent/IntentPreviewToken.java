package com.cretas.aims.entity.intent;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.persistence.*;
import java.time.LocalDateTime;

/**
 * 意图预览令牌实体 - TCC (Try-Confirm-Cancel) 模式支持
 *
 * 用于实现预览-确认机制:
 * 1. Try (Preview): 生成 token，持久化预览数据，返回给前端
 * 2. Confirm: 验证 token 有效性，执行实际操作
 * 3. Cancel: token 过期或用户取消，清理资源
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Entity
@Table(name = "intent_preview_tokens", indexes = {
    @Index(name = "idx_ipt_token", columnList = "token", unique = true),
    @Index(name = "idx_ipt_factory_user", columnList = "factory_id, user_id"),
    @Index(name = "idx_ipt_status", columnList = "status"),
    @Index(name = "idx_ipt_expires", columnList = "expires_at")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IntentPreviewToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 令牌值 (UUID)
     */
    @Column(name = "token", length = 64, nullable = false, unique = true)
    private String token;

    /**
     * 工厂ID
     */
    @Column(name = "factory_id", length = 50, nullable = false)
    private String factoryId;

    /**
     * 用户ID
     */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /**
     * 用户名
     */
    @Column(name = "username", length = 100)
    private String username;

    /**
     * 意图代码
     */
    @Column(name = "intent_code", length = 100, nullable = false)
    private String intentCode;

    /**
     * 意图名称
     */
    @Column(name = "intent_name", length = 200)
    private String intentName;

    /**
     * 实体类型 (如 PRODUCT_TYPE, PRODUCTION_BATCH)
     */
    @Column(name = "entity_type", length = 50)
    private String entityType;

    /**
     * 实体ID
     */
    @Column(name = "entity_id", length = 100)
    private String entityId;

    /**
     * 操作类型 (CREATE, UPDATE, DELETE)
     */
    @Column(name = "operation", length = 20)
    private String operation;

    /**
     * 预览数据 (JSON)
     * 包含操作的完整参数，confirm 时使用
     */
    @Column(name = "preview_data", columnDefinition = "TEXT")
    private String previewData;

    /**
     * 当前值快照 (JSON)
     * 用于对比显示修改内容
     */
    @Column(name = "current_values", columnDefinition = "TEXT")
    private String currentValues;

    /**
     * 新值 (JSON)
     * 预期的修改结果
     */
    @Column(name = "new_values", columnDefinition = "TEXT")
    private String newValues;

    /**
     * 令牌状态
     */
    @Column(name = "status", length = 20, nullable = false)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private TokenStatus status = TokenStatus.PENDING;

    /**
     * 创建时间
     */
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    /**
     * 过期时间
     */
    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    /**
     * 确认/取消时间
     */
    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    /**
     * 确认/取消结果描述
     */
    @Column(name = "resolution_message", length = 500)
    private String resolutionMessage;

    /**
     * 客户端信息 (用于安全验证)
     */
    @Column(name = "client_info", length = 200)
    private String clientInfo;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (expiresAt == null) {
            // 默认 5 分钟过期
            expiresAt = LocalDateTime.now().plusMinutes(5);
        }
    }

    /**
     * 令牌状态枚举
     */
    public enum TokenStatus {
        /** 待确认 */
        PENDING,
        /** 已确认执行 */
        CONFIRMED,
        /** 已取消 */
        CANCELLED,
        /** 已过期 */
        EXPIRED,
        /** 执行失败 */
        FAILED
    }

    /**
     * 检查令牌是否有效 (状态为 PENDING 且未过期)
     */
    public boolean isValid() {
        return status == TokenStatus.PENDING && LocalDateTime.now().isBefore(expiresAt);
    }

    /**
     * 检查令牌是否已过期
     */
    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiresAt);
    }

    /**
     * 确认令牌 (执行操作)
     */
    public void confirm(String message) {
        this.status = TokenStatus.CONFIRMED;
        this.resolvedAt = LocalDateTime.now();
        this.resolutionMessage = message;
    }

    /**
     * 取消令牌
     */
    public void cancel(String reason) {
        this.status = TokenStatus.CANCELLED;
        this.resolvedAt = LocalDateTime.now();
        this.resolutionMessage = reason;
    }

    /**
     * 标记为过期
     */
    public void expire() {
        this.status = TokenStatus.EXPIRED;
        this.resolvedAt = LocalDateTime.now();
        this.resolutionMessage = "令牌已过期";
    }

    /**
     * 标记为执行失败
     */
    public void fail(String errorMessage) {
        this.status = TokenStatus.FAILED;
        this.resolvedAt = LocalDateTime.now();
        this.resolutionMessage = errorMessage;
    }

    /**
     * 创建预览令牌
     */
    public static IntentPreviewToken create(String factoryId, Long userId, String username,
                                             String intentCode, String intentName,
                                             String entityType, String entityId,
                                             String operation, int expiresInSeconds) {
        return IntentPreviewToken.builder()
                .token(java.util.UUID.randomUUID().toString())
                .factoryId(factoryId)
                .userId(userId)
                .username(username)
                .intentCode(intentCode)
                .intentName(intentName)
                .entityType(entityType)
                .entityId(entityId)
                .operation(operation)
                .status(TokenStatus.PENDING)
                .expiresAt(LocalDateTime.now().plusSeconds(expiresInSeconds))
                .build();
    }

    /**
     * 获取剩余有效秒数
     */
    public long getRemainingSeconds() {
        if (isExpired()) return 0;
        return java.time.Duration.between(LocalDateTime.now(), expiresAt).getSeconds();
    }
}

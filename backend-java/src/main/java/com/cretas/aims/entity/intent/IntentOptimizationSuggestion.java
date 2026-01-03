package com.cretas.aims.entity.intent;

import com.cretas.aims.entity.BaseEntity;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.GenericGenerator;

import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 意图优化建议实体
 *
 * 自动生成的规则优化建议，用于:
 * - 添加缺失关键词
 * - 调整意图优先级
 * - 添加正则表达式
 * - 合并/拆分意图
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
@Entity
@Table(name = "intent_optimization_suggestions",
       indexes = {
           @Index(name = "idx_factory_intent", columnList = "factory_id, intent_code"),
           @Index(name = "idx_status", columnList = "status"),
           @Index(name = "idx_impact_score", columnList = "impact_score")
       })
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class IntentOptimizationSuggestion extends BaseEntity {

    @Id
    @GeneratedValue(generator = "uuid2")
    @GenericGenerator(name = "uuid2", strategy = "uuid2")
    @Column(name = "id", length = 36)
    private String id;

    /**
     * 工厂ID
     */
    @Column(name = "factory_id", nullable = false, length = 20)
    private String factoryId;

    /**
     * 相关意图代码
     */
    @Column(name = "intent_code", length = 50)
    private String intentCode;

    // ==================== 建议类型 ====================

    /**
     * 建议类型
     */
    @Column(name = "suggestion_type", nullable = false, length = 30)
    @Enumerated(EnumType.STRING)
    private SuggestionType suggestionType;

    // ==================== 建议内容 ====================

    /**
     * 建议标题
     */
    @Column(name = "suggestion_title", nullable = false, length = 200)
    private String suggestionTitle;

    /**
     * 建议详情
     */
    @Column(name = "suggestion_detail", columnDefinition = "TEXT", nullable = false)
    private String suggestionDetail;

    // ==================== 支持数据 ====================

    /**
     * 支持该建议的用户输入样例 (JSON Array)
     */
    @Column(name = "supporting_examples", columnDefinition = "JSON")
    private String supportingExamples;

    /**
     * 相关问题出现频率
     */
    @Builder.Default
    @Column(name = "frequency", nullable = false)
    private Integer frequency = 0;

    /**
     * 预估影响分数 (0-100)
     */
    @Column(name = "impact_score", precision = 5, scale = 2)
    private BigDecimal impactScore;

    // ==================== 状态管理 ====================

    /**
     * 状态
     */
    @Builder.Default
    @Column(name = "status", nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private SuggestionStatus status = SuggestionStatus.PENDING;

    /**
     * 应用时间
     */
    @Column(name = "applied_at")
    private LocalDateTime appliedAt;

    /**
     * 应用人ID
     */
    @Column(name = "applied_by")
    private Long appliedBy;

    /**
     * 拒绝原因
     */
    @Column(name = "reject_reason", columnDefinition = "TEXT")
    private String rejectReason;

    /**
     * 过期时间（建议有效期30天）
     */
    @Column(name = "expired_at")
    private LocalDateTime expiredAt;

    // ==================== 枚举类型 ====================

    /**
     * 建议类型枚举
     */
    public enum SuggestionType {
        ADD_KEYWORD,     // 添加关键词
        ADJUST_PRIORITY, // 调整优先级
        ADD_REGEX,       // 添加正则表达式
        MERGE_INTENT,    // 合并意图
        SPLIT_INTENT     // 拆分意图
    }

    /**
     * 状态枚举
     */
    public enum SuggestionStatus {
        PENDING,  // 待处理
        APPLIED,  // 已应用
        REJECTED, // 已拒绝
        EXPIRED   // 已过期
    }

    // ==================== 便捷方法 ====================

    /**
     * 应用建议
     */
    public void apply(Long userId) {
        this.status = SuggestionStatus.APPLIED;
        this.appliedAt = LocalDateTime.now();
        this.appliedBy = userId;
    }

    /**
     * 拒绝建议
     */
    public void reject(String reason) {
        this.status = SuggestionStatus.REJECTED;
        this.rejectReason = reason;
    }

    /**
     * 检查是否已过期
     */
    public boolean isExpired() {
        if (expiredAt == null) return false;
        return LocalDateTime.now().isAfter(expiredAt);
    }

    /**
     * 设置默认过期时间（30天后）
     */
    @PrePersist
    public void setDefaultExpiredAt() {
        if (expiredAt == null) {
            expiredAt = LocalDateTime.now().plusDays(30);
        }
    }
}

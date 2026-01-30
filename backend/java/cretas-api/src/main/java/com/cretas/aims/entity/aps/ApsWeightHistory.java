package com.cretas.aims.entity.aps;

import com.cretas.aims.entity.BaseEntity;
import lombok.*;
import lombok.experimental.SuperBuilder;

import javax.persistence.*;
import java.time.LocalDateTime;

/**
 * APS 权重调整历史实体
 *
 * <p>记录APS调度权重的调整历史，用于：
 * <ul>
 *   <li>追踪权重变化</li>
 *   <li>分析调整效果</li>
 *   <li>支持权重回滚</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Entity
@Table(name = "aps_weight_history",
       indexes = {
           @Index(name = "idx_aps_weight_factory", columnList = "factory_id"),
           @Index(name = "idx_aps_weight_adjusted", columnList = "adjusted_at")
       })
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class ApsWeightHistory extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 工厂ID
     */
    @Column(name = "factory_id", nullable = false, length = 32)
    private String factoryId;

    /**
     * 调整时间
     */
    @Column(name = "adjusted_at", nullable = false)
    private LocalDateTime adjustedAt;

    /**
     * 调整前权重 (JSON)
     * 结构: { "urgency": 0.3, "efficiency": 0.25, "deadline": 0.25, "skill": 0.2 }
     */
    @Column(name = "weights_before", columnDefinition = "JSON")
    private String weightsBefore;

    /**
     * 调整后权重 (JSON)
     * 结构: { "urgency": 0.35, "efficiency": 0.2, "deadline": 0.3, "skill": 0.15 }
     */
    @Column(name = "weights_after", columnDefinition = "JSON")
    private String weightsAfter;

    /**
     * 触发原因
     * 如: MANUAL, AUTO_OPTIMIZATION, DELAY_DETECTED, EFFICIENCY_DROP
     */
    @Column(name = "trigger_reason", length = 50)
    private String triggerReason;

    /**
     * 性能指标 (JSON)
     * 结构: { "before": {"onTimeRate": 0.85, "avgEfficiency": 0.78},
     *         "after": {"onTimeRate": 0.90, "avgEfficiency": 0.82} }
     */
    @Column(name = "performance_metrics", columnDefinition = "JSON")
    private String performanceMetrics;

    // ==================== 触发原因常量 ====================

    public static final String TRIGGER_MANUAL = "MANUAL";
    public static final String TRIGGER_AUTO_OPTIMIZATION = "AUTO_OPTIMIZATION";
    public static final String TRIGGER_DELAY_DETECTED = "DELAY_DETECTED";
    public static final String TRIGGER_EFFICIENCY_DROP = "EFFICIENCY_DROP";
}

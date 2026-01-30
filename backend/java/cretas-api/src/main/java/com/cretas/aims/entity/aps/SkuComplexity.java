package com.cretas.aims.entity.aps;

import com.cretas.aims.entity.BaseEntity;
import lombok.*;
import lombok.experimental.SuperBuilder;

import javax.persistence.*;
import java.time.LocalDateTime;

/**
 * SKU 复杂度实体
 *
 * <p>记录SKU的生产复杂度信息，用于：
 * <ul>
 *   <li>APS调度时的任务分配</li>
 *   <li>工人技能匹配</li>
 *   <li>产能预测</li>
 * </ul>
 *
 * <p>复杂度来源：
 * <ul>
 *   <li>MANUAL: 人工配置</li>
 *   <li>AI_SOP: 基于SOP文档AI分析</li>
 *   <li>AI_LEARNED: 基于历史数据AI学习</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Entity
@Table(name = "sku_complexity",
       indexes = {
           @Index(name = "idx_sku_complexity_factory", columnList = "factory_id"),
           @Index(name = "idx_sku_complexity_code", columnList = "sku_code"),
           @Index(name = "idx_sku_complexity_level", columnList = "complexity_level")
       },
       uniqueConstraints = {
           @UniqueConstraint(name = "uk_sku_factory", columnNames = {"factory_id", "sku_code"})
       })
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class SkuComplexity extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 工厂ID
     */
    @Column(name = "factory_id", nullable = false, length = 32)
    private String factoryId;

    /**
     * SKU编码
     */
    @Column(name = "sku_code", nullable = false, length = 64)
    private String skuCode;

    /**
     * 复杂度等级 (1-5)
     * 1: 简单
     * 2: 较简单
     * 3: 中等
     * 4: 较复杂
     * 5: 复杂
     */
    @Builder.Default
    @Column(name = "complexity_level")
    private Integer complexityLevel = 3;

    /**
     * 最低技能要求等级 (1-5)
     */
    @Builder.Default
    @Column(name = "min_skill_required")
    private Integer minSkillRequired = 1;

    /**
     * 复杂度来源
     * MANUAL: 人工配置
     * AI_SOP: 基于SOP文档AI分析
     * AI_LEARNED: 基于历史数据AI学习
     */
    @Builder.Default
    @Column(name = "source_type", length = 20)
    private String sourceType = SOURCE_MANUAL;

    /**
     * 关联的SOP文档ID (当sourceType=AI_SOP时)
     */
    @Column(name = "source_sop_id", length = 36)
    private String sourceSopId;

    /**
     * AI分析原因/说明
     */
    @Column(name = "analysis_reason", columnDefinition = "TEXT")
    private String analysisReason;

    /**
     * 工序步骤数
     */
    @Column(name = "step_count")
    private Integer stepCount;

    /**
     * 平均每步耗时（分钟）
     */
    @Column(name = "avg_step_time_minutes")
    private Integer avgStepTimeMinutes;

    /**
     * 质检点数量
     */
    @Column(name = "quality_check_count")
    private Integer qualityCheckCount;

    /**
     * 是否需要特殊设备
     */
    @Builder.Default
    @Column(name = "special_equipment_required")
    private Boolean specialEquipmentRequired = false;

    /**
     * 分析时间
     */
    @Column(name = "analyzed_at")
    private LocalDateTime analyzedAt;

    // ==================== 来源类型常量 ====================

    public static final String SOURCE_MANUAL = "MANUAL";
    public static final String SOURCE_AI_SOP = "AI_SOP";
    public static final String SOURCE_AI_LEARNED = "AI_LEARNED";

    /**
     * 判断是否为AI分析的结果
     */
    public boolean isAiAnalyzed() {
        return SOURCE_AI_SOP.equals(this.sourceType) || SOURCE_AI_LEARNED.equals(this.sourceType);
    }

    /**
     * 计算预估总工时（分钟）
     */
    public Integer getEstimatedTotalMinutes() {
        if (stepCount != null && avgStepTimeMinutes != null) {
            return stepCount * avgStepTimeMinutes;
        }
        return null;
    }
}

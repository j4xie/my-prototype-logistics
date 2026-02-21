package com.cretas.aims.entity.smartbi;

import com.cretas.aims.entity.BaseEntity;
import lombok.*;
import lombok.experimental.SuperBuilder;

import org.hibernate.annotations.GenericGenerator;

import javax.persistence.*;
import java.time.LocalDateTime;

/**
 * SKU 复杂度实体
 *
 * <p>存储 SKU 的生产复杂度分析结果，用于排产优化和工时预估。
 *
 * <p>复杂度等级 (1-5):
 * <ul>
 *   <li>1: 简单 - 少于5步，基础操作</li>
 *   <li>2: 较简单 - 5-10步，需要基础培训</li>
 *   <li>3: 中等 - 10-15步，需要熟练技能</li>
 *   <li>4: 较复杂 - 15-20步，需要专业认证</li>
 *   <li>5: 复杂 - 超过20步，需要高级认证</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Entity
@Table(name = "smart_bi_sku_complexity",
       indexes = {
           @Index(name = "idx_sku_complexity_factory", columnList = "factory_id"),
           @Index(name = "idx_sku_complexity_sku", columnList = "sku_code"),
           @Index(name = "idx_sku_complexity_level", columnList = "complexity_level"),
           @Index(name = "idx_sku_complexity_source", columnList = "source_type")
       },
       uniqueConstraints = {
           @UniqueConstraint(name = "uk_sku_complexity_factory_sku",
                            columnNames = {"factory_id", "sku_code"})
       })
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class SkuComplexity extends BaseEntity {

    @Id
    @GeneratedValue(generator = "uuid2")
    @GenericGenerator(name = "uuid2", strategy = "uuid2")
    @Column(length = 36)
    private String id;

    /**
     * 工厂ID
     */
    @Column(name = "factory_id", nullable = false, length = 32)
    private String factoryId;

    /**
     * SKU 编码
     */
    @Column(name = "sku_code", nullable = false, length = 64)
    private String skuCode;

    /**
     * SKU 名称（冗余存储，便于查询）
     */
    @Column(name = "sku_name", length = 128)
    private String skuName;

    /**
     * 复杂度等级 (1-5)
     */
    @Column(name = "complexity_level", nullable = false)
    private Integer complexityLevel;

    /**
     * 来源类型
     * AI_SOP: AI 自动分析 SOP 得出
     * MANUAL: 手动设置
     * HISTORY: 历史数据统计
     */
    @Column(name = "source_type", length = 20)
    private String sourceType;

    /**
     * 分析原因/说明
     */
    @Column(name = "analysis_reason", columnDefinition = "TEXT")
    private String analysisReason;

    /**
     * 关联的 SOP 配置ID
     */
    @Column(name = "sop_config_id", length = 36)
    private String sopConfigId;

    /**
     * 分析详情 (JSON)
     * 格式:
     * {
     *   "stepCount": 12,
     *   "skillRequired": 3,
     *   "qualityCheckCount": 4,
     *   "specialEquipment": true,
     *   "estimatedMinutes": 45
     * }
     */
    @Column(name = "analysis_detail_json", columnDefinition = "JSON")
    private String analysisDetailJson;

    /**
     * 工序步骤数
     */
    @Column(name = "step_count")
    private Integer stepCount;

    /**
     * 技能要求等级 (1-5)
     */
    @Column(name = "skill_required")
    private Integer skillRequired;

    /**
     * 质检点数量
     */
    @Column(name = "quality_check_count")
    private Integer qualityCheckCount;

    /**
     * 是否需要特殊设备
     */
    @Builder.Default
    @Column(name = "special_equipment")
    private Boolean specialEquipment = false;

    /**
     * 预估工时（分钟）
     */
    @Column(name = "estimated_minutes")
    private Integer estimatedMinutes;

    /**
     * 分析时间
     */
    @Column(name = "analyzed_at")
    private LocalDateTime analyzedAt;

    /**
     * 分析者（用户ID或'AI'）
     */
    @Column(name = "analyzed_by", length = 50)
    private String analyzedBy;

    // ==================== 来源类型常量 ====================

    public static final String SOURCE_AI_SOP = "AI_SOP";
    public static final String SOURCE_MANUAL = "MANUAL";
    public static final String SOURCE_HISTORY = "HISTORY";

    // ==================== 复杂度等级常量 ====================

    public static final int LEVEL_SIMPLE = 1;
    public static final int LEVEL_EASY = 2;
    public static final int LEVEL_MEDIUM = 3;
    public static final int LEVEL_HARD = 4;
    public static final int LEVEL_COMPLEX = 5;

    /**
     * 获取复杂度描述
     */
    public String getComplexityDescription() {
        switch (complexityLevel) {
            case LEVEL_SIMPLE: return "简单";
            case LEVEL_EASY: return "较简单";
            case LEVEL_MEDIUM: return "中等";
            case LEVEL_HARD: return "较复杂";
            case LEVEL_COMPLEX: return "复杂";
            default: return "未知";
        }
    }
}

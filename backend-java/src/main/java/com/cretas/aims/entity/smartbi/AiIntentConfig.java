package com.cretas.aims.entity.smartbi;

import com.cretas.aims.entity.BaseEntity;
import lombok.*;
import lombok.experimental.SuperBuilder;

import javax.persistence.*;

/**
 * AI 意图配置实体
 *
 * <p>支持动态配置自然语言意图识别规则，无需修改代码即可添加新的意图。
 *
 * <p>意图分类：
 * <ul>
 *   <li>QUERY: 查询类意图（销售查询、财务查询等）</li>
 *   <li>ANALYSIS: 分析类意图（趋势分析、对比分析等）</li>
 *   <li>ALERT: 告警类意图（预警查询、异常检测等）</li>
 *   <li>ACTION: 操作类意图（导出报表、设置阈值等）</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Entity
@Table(name = "ai_intent_configs",
       indexes = {
           @Index(name = "idx_intent_code", columnList = "intent_code"),
           @Index(name = "idx_intent_category", columnList = "category"),
           @Index(name = "idx_intent_factory", columnList = "factory_id"),
           @Index(name = "idx_intent_active", columnList = "is_active")
       },
       uniqueConstraints = {
           @UniqueConstraint(name = "uk_intent_code_factory",
                            columnNames = {"intent_code", "factory_id"})
       })
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class AiIntentConfig extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 意图代码（唯一标识）
     * 如：QUERY_SALES_OVERVIEW, COMPARE_DEPARTMENT, ANALYZE_TREND
     */
    @Column(name = "intent_code", nullable = false, length = 64)
    private String intentCode;

    /**
     * 意图名称（用于显示）
     * 如：销售概览查询, 部门对比, 趋势分析
     */
    @Column(name = "intent_name", nullable = false, length = 128)
    private String intentName;

    /**
     * 意图分类：QUERY, ANALYSIS, ALERT, ACTION
     */
    @Column(name = "category", nullable = false, length = 32)
    private String category;

    /**
     * 关键词列表 (JSON 数组)
     * 用于匹配用户输入，如：["销售额", "营业额", "总销量"]
     */
    @Column(name = "keywords", columnDefinition = "JSON")
    private String keywords;

    /**
     * 正则表达式模式列表 (JSON 数组)
     * 用于更精确的意图匹配
     */
    @Column(name = "patterns", columnDefinition = "JSON")
    private String patterns;

    /**
     * 示例问句 (JSON 数组)
     * 用于训练和测试，如：["本月销售额是多少", "这个月卖了多少"]
     */
    @Column(name = "examples", columnDefinition = "JSON")
    private String examples;

    /**
     * 响应模板
     * 支持占位符，如：在 {period} 期间，{dimension} 的 {metric} 为 {value}
     */
    @Column(name = "response_template", columnDefinition = "TEXT")
    private String responseTemplate;

    /**
     * 后续问题建议 (JSON 数组)
     * 用于引导用户深入查询
     */
    @Column(name = "follow_up_questions", columnDefinition = "JSON")
    private String followUpQuestions;

    /**
     * 关联的分析服务
     * 如：salesAnalysisService, departmentAnalysisService
     */
    @Column(name = "analysis_service", length = 64)
    private String analysisService;

    /**
     * 关联的方法名
     * 如：getSalesOverview, getDepartmentRanking
     */
    @Column(name = "method_name", length = 64)
    private String methodName;

    /**
     * 优先级（数值越小越优先匹配）
     */
    @Builder.Default
    @Column(name = "priority")
    private Integer priority = 100;

    /**
     * 置信度阈值（0-1之间）
     * 只有置信度高于此值才会触发此意图
     */
    @Builder.Default
    @Column(name = "confidence_threshold")
    private Double confidenceThreshold = 0.6;

    /**
     * 意图描述
     */
    @Column(name = "description", length = 255)
    private String description;

    /**
     * 工厂ID，null 表示全局配置
     */
    @Column(name = "factory_id", length = 32)
    private String factoryId;

    /**
     * 是否启用
     */
    @Builder.Default
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    // ==================== 分类常量 ====================

    public static final String CATEGORY_QUERY = "QUERY";
    public static final String CATEGORY_ANALYSIS = "ANALYSIS";
    public static final String CATEGORY_ALERT = "ALERT";
    public static final String CATEGORY_ACTION = "ACTION";

    /**
     * 判断是否为查询类意图
     */
    public boolean isQueryIntent() {
        return CATEGORY_QUERY.equals(this.category);
    }

    /**
     * 判断是否为分析类意图
     */
    public boolean isAnalysisIntent() {
        return CATEGORY_ANALYSIS.equals(this.category);
    }

    /**
     * 判断是否为告警类意图
     */
    public boolean isAlertIntent() {
        return CATEGORY_ALERT.equals(this.category);
    }

    /**
     * 判断是否为操作类意图
     */
    public boolean isActionIntent() {
        return CATEGORY_ACTION.equals(this.category);
    }
}

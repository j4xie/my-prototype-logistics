package com.cretas.aims.dto.smartbi;

import com.cretas.aims.entity.smartbi.enums.RecommendationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 推荐建议 DTO
 *
 * 用于表示 SmartBI 系统生成的智能建议，包括：
 * - 建议类型和优先级
 * - 建议标题和描述
 * - 预期影响
 * - 具体行动项
 * - 相关数据
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Recommendation {

    /**
     * 推荐ID
     * 自动生成的唯一标识
     */
    @Builder.Default
    private String id = UUID.randomUUID().toString();

    /**
     * 推荐类型
     */
    private RecommendationType type;

    /**
     * 推荐标题
     * 简洁的建议标题
     */
    private String title;

    /**
     * 推荐描述
     * 详细的建议说明
     */
    private String description;

    /**
     * 优先级
     * 1-5，数值越小优先级越高
     */
    @Builder.Default
    private int priority = 3;

    /**
     * 预期影响
     * 采纳建议后的预期效果说明
     */
    private String impact;

    /**
     * 行动项列表
     * 具体的执行步骤
     */
    @Builder.Default
    private List<String> actionItems = new ArrayList<>();

    /**
     * 相关数据
     * 支持建议的相关业务数据
     */
    @Builder.Default
    private Map<String, Object> relatedData = new HashMap<>();

    /**
     * 目标对象ID
     * 建议针对的业务对象ID
     */
    private String targetId;

    /**
     * 目标对象名称
     * 建议针对的业务对象名称
     */
    private String targetName;

    /**
     * 创建时间
     */
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    /**
     * 添加行动项
     *
     * @param actionItem 行动项描述
     * @return 当前对象（支持链式调用）
     */
    public Recommendation addActionItem(String actionItem) {
        if (this.actionItems == null) {
            this.actionItems = new ArrayList<>();
        }
        this.actionItems.add(actionItem);
        return this;
    }

    /**
     * 添加相关数据
     *
     * @param key   数据键
     * @param value 数据值
     * @return 当前对象（支持链式调用）
     */
    public Recommendation addRelatedData(String key, Object value) {
        if (this.relatedData == null) {
            this.relatedData = new HashMap<>();
        }
        this.relatedData.put(key, value);
        return this;
    }

    /**
     * 快速创建销售提升建议
     */
    public static Recommendation salesImprovement(String title, String description,
                                                   String impact, List<String> actionItems) {
        return Recommendation.builder()
                .type(RecommendationType.SALES_IMPROVEMENT)
                .title(title)
                .description(description)
                .impact(impact)
                .actionItems(actionItems != null ? actionItems : new ArrayList<>())
                .priority(1)
                .build();
    }

    /**
     * 快速创建成本优化建议
     */
    public static Recommendation costReduction(String title, String description,
                                                String impact, List<String> actionItems) {
        return Recommendation.builder()
                .type(RecommendationType.COST_REDUCTION)
                .title(title)
                .description(description)
                .impact(impact)
                .actionItems(actionItems != null ? actionItems : new ArrayList<>())
                .priority(2)
                .build();
    }

    /**
     * 快速创建客户维护建议
     */
    public static Recommendation customerRetention(String title, String description,
                                                    String impact, List<String> actionItems) {
        return Recommendation.builder()
                .type(RecommendationType.CUSTOMER_RETENTION)
                .title(title)
                .description(description)
                .impact(impact)
                .actionItems(actionItems != null ? actionItems : new ArrayList<>())
                .priority(2)
                .build();
    }

    /**
     * 快速创建催收提醒建议
     */
    public static Recommendation collectionAlert(String title, String description,
                                                  String impact, List<String> actionItems) {
        return Recommendation.builder()
                .type(RecommendationType.COLLECTION_ALERT)
                .title(title)
                .description(description)
                .impact(impact)
                .actionItems(actionItems != null ? actionItems : new ArrayList<>())
                .priority(1)
                .build();
    }

    /**
     * 获取类型显示名称
     *
     * @return 类型显示名称
     */
    public String getTypeName() {
        return type != null ? type.getDisplayName() : "";
    }

    /**
     * 判断是否为高优先级建议
     *
     * @return 如果优先级 <= 2 则返回 true
     */
    public boolean isHighPriority() {
        return priority <= 2;
    }
}

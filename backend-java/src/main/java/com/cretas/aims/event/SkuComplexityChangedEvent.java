package com.cretas.aims.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.time.LocalDateTime;

/**
 * SKU 复杂度变更事件
 *
 * <p>当 SKU 复杂度被更新时触发此事件，用于:
 * <ul>
 *   <li>重新计算排产特征权重</li>
 *   <li>更新工时预估模型</li>
 *   <li>通知相关部门</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Getter
public class SkuComplexityChangedEvent extends ApplicationEvent {

    /**
     * 工厂ID
     */
    private final String factoryId;

    /**
     * SKU 编码
     */
    private final String skuCode;

    /**
     * SKU 名称
     */
    private final String skuName;

    /**
     * 新的复杂度等级
     */
    private final Integer newComplexity;

    /**
     * 旧的复杂度等级（null 表示新建）
     */
    private final Integer oldComplexity;

    /**
     * 变更来源 (AI_SOP, MANUAL, HISTORY)
     */
    private final String sourceType;

    /**
     * 变更原因
     */
    private final String reason;

    /**
     * 变更时间
     */
    private final LocalDateTime changedAt;

    /**
     * 变更者（用户ID或'AI'）
     */
    private final String changedBy;

    /**
     * 构造函数
     *
     * @param source 事件源
     * @param factoryId 工厂ID
     * @param skuCode SKU编码
     * @param skuName SKU名称
     * @param newComplexity 新复杂度
     * @param oldComplexity 旧复杂度
     * @param sourceType 来源类型
     * @param reason 变更原因
     * @param changedBy 变更者
     */
    public SkuComplexityChangedEvent(Object source,
                                     String factoryId,
                                     String skuCode,
                                     String skuName,
                                     Integer newComplexity,
                                     Integer oldComplexity,
                                     String sourceType,
                                     String reason,
                                     String changedBy) {
        super(source);
        this.factoryId = factoryId;
        this.skuCode = skuCode;
        this.skuName = skuName;
        this.newComplexity = newComplexity;
        this.oldComplexity = oldComplexity;
        this.sourceType = sourceType;
        this.reason = reason;
        this.changedBy = changedBy;
        this.changedAt = LocalDateTime.now();
    }

    /**
     * 简化构造函数
     */
    public SkuComplexityChangedEvent(Object source,
                                     String factoryId,
                                     String skuCode,
                                     Integer newComplexity) {
        this(source, factoryId, skuCode, null, newComplexity, null, null, null, null);
    }

    /**
     * 判断是否为新建
     */
    public boolean isNew() {
        return oldComplexity == null;
    }

    /**
     * 判断复杂度是否增加
     */
    public boolean isComplexityIncreased() {
        return oldComplexity != null && newComplexity > oldComplexity;
    }

    /**
     * 判断复杂度是否降低
     */
    public boolean isComplexityDecreased() {
        return oldComplexity != null && newComplexity < oldComplexity;
    }

    /**
     * 获取复杂度变化量
     */
    public int getComplexityDelta() {
        return oldComplexity != null ? newComplexity - oldComplexity : newComplexity;
    }

    /**
     * 判断是否为AI分析结果
     */
    public boolean isAiAnalyzed() {
        return "AI_SOP".equals(sourceType);
    }

    /**
     * 获取新复杂度描述
     */
    public String getNewComplexityDescription() {
        return getComplexityDescription(newComplexity);
    }

    /**
     * 获取旧复杂度描述
     */
    public String getOldComplexityDescription() {
        return oldComplexity != null ? getComplexityDescription(oldComplexity) : "无";
    }

    private String getComplexityDescription(int level) {
        switch (level) {
            case 1: return "简单";
            case 2: return "较简单";
            case 3: return "中等";
            case 4: return "较复杂";
            case 5: return "复杂";
            default: return "未知";
        }
    }

    @Override
    public String toString() {
        return String.format("SkuComplexityChangedEvent[factoryId=%s, skuCode=%s, %d->%d, source=%s]",
                factoryId, skuCode,
                oldComplexity != null ? oldComplexity : 0,
                newComplexity,
                sourceType);
    }
}

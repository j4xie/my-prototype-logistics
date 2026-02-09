package com.cretas.aims.entity.smartbi;

import com.cretas.aims.entity.BaseEntity;
import lombok.*;
import lombok.experimental.SuperBuilder;

import javax.persistence.*;

/**
 * SmartBI 指标公式配置实体
 *
 * 支持动态配置指标计算公式，无需修改代码即可调整计算逻辑。
 *
 * 公式类型：
 * - SIMPLE: 简单字段映射，直接使用基础字段值
 * - DERIVED: 派生指标，基于其他指标计算（如毛利率 = 毛利 / 销售额）
 * - CUSTOM: 自定义公式，使用 SpEL 表达式计算
 *
 * 聚合方式：
 * - SUM: 求和
 * - AVG: 平均值
 * - COUNT: 计数
 * - COUNT_DISTINCT: 去重计数
 * - MAX: 最大值
 * - MIN: 最小值
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Entity
@Table(name = "smart_bi_metric_formulas",
       indexes = {
           @Index(name = "idx_metric_code", columnList = "metric_code"),
           @Index(name = "idx_metric_factory", columnList = "factory_id"),
           @Index(name = "idx_metric_active", columnList = "is_active"),
           @Index(name = "idx_metric_type", columnList = "formula_type")
       },
       uniqueConstraints = {
           @UniqueConstraint(name = "uk_metric_factory",
                            columnNames = {"metric_code", "factory_id"})
       })
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class SmartBiMetricFormula extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 指标代码（唯一标识）
     * 如：sales_amount, gross_margin_rate, avg_order_value
     */
    @Column(name = "metric_code", nullable = false, length = 64)
    private String metricCode;

    /**
     * 指标名称（用于显示）
     * 如：销售额, 毛利率, 客单价
     */
    @Column(name = "metric_name", nullable = false, length = 128)
    private String metricName;

    /**
     * 公式类型：SIMPLE / DERIVED / CUSTOM
     */
    @Column(name = "formula_type", nullable = false, length = 32)
    private String formulaType;

    /**
     * 基础字段名（SIMPLE 类型使用）
     * 直接映射到数据源的字段名
     */
    @Column(name = "base_field", length = 64)
    private String baseField;

    /**
     * 公式表达式（DERIVED 和 CUSTOM 类型使用）
     * 支持 SpEL 语法，变量使用 # 前缀
     * 如：#grossProfit / #salesAmount * 100
     */
    @Column(name = "formula_expression", columnDefinition = "TEXT")
    private String formulaExpression;

    /**
     * 聚合方式：SUM / AVG / COUNT / COUNT_DISTINCT / MAX / MIN
     */
    @Builder.Default
    @Column(name = "aggregation", length = 32)
    private String aggregation = "SUM";

    /**
     * 单位：元, %, 个, 件 等
     */
    @Column(name = "unit", length = 32)
    private String unit;

    /**
     * 格式化模式
     * 如：#,##0.00（千分位两位小数）, 0.00%（百分比）, +0.00;-0.00（正负号）
     */
    @Column(name = "format_pattern", length = 32)
    private String formatPattern;

    /**
     * 指标描述
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

    /**
     * 公式类型常量
     */
    public static final String TYPE_SIMPLE = "SIMPLE";
    public static final String TYPE_DERIVED = "DERIVED";
    public static final String TYPE_CUSTOM = "CUSTOM";

    /**
     * 聚合方式常量
     */
    public static final String AGG_SUM = "SUM";
    public static final String AGG_AVG = "AVG";
    public static final String AGG_COUNT = "COUNT";
    public static final String AGG_COUNT_DISTINCT = "COUNT_DISTINCT";
    public static final String AGG_MAX = "MAX";
    public static final String AGG_MIN = "MIN";

    /**
     * 判断是否为简单字段映射
     */
    public boolean isSimple() {
        return TYPE_SIMPLE.equals(this.formulaType);
    }

    /**
     * 判断是否为派生指标
     */
    public boolean isDerived() {
        return TYPE_DERIVED.equals(this.formulaType);
    }

    /**
     * 判断是否为自定义公式
     */
    public boolean isCustom() {
        return TYPE_CUSTOM.equals(this.formulaType);
    }
}

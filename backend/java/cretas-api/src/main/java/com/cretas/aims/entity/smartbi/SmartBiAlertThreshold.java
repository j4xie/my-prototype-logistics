package com.cretas.aims.entity.smartbi;

import com.cretas.aims.entity.BaseEntity;
import lombok.*;
import lombok.experimental.SuperBuilder;

import javax.persistence.*;
import java.math.BigDecimal;

/**
 * SmartBI 告警阈值配置实体
 * 支持动态配置各类业务指标的告警阈值，无需硬编码
 *
 * 阈值类型：
 * - SALES: 销售相关阈值（销售额、订单量等）
 * - FINANCE: 财务相关阈值（利润率、成本等）
 * - DEPARTMENT: 部门绩效阈值
 * - PRODUCTION: 生产相关阈值
 * - QUALITY: 质量相关阈值
 *
 * 比较操作符：
 * - GT: 大于 (Greater Than)
 * - LT: 小于 (Less Than)
 * - GTE: 大于等于 (Greater Than or Equal)
 * - LTE: 小于等于 (Less Than or Equal)
 * - EQ: 等于 (Equal)
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Entity
@Table(name = "smart_bi_alert_thresholds",
       indexes = {
           @Index(name = "idx_threshold_type", columnList = "threshold_type"),
           @Index(name = "idx_threshold_metric", columnList = "metric_code"),
           @Index(name = "idx_threshold_factory", columnList = "factory_id"),
           @Index(name = "idx_threshold_active", columnList = "is_active")
       },
       uniqueConstraints = {
           @UniqueConstraint(name = "uk_type_metric_factory",
                            columnNames = {"threshold_type", "metric_code", "factory_id"})
       })
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class SmartBiAlertThreshold extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 阈值类型：SALES, FINANCE, DEPARTMENT, PRODUCTION, QUALITY 等
     */
    @Column(name = "threshold_type", nullable = false, length = 64)
    private String thresholdType;

    /**
     * 指标代码：如 SALES_AMOUNT, PROFIT_RATE, ORDER_COUNT 等
     */
    @Column(name = "metric_code", nullable = false, length = 64)
    private String metricCode;

    /**
     * 警告阈值（黄色告警）
     */
    @Column(name = "warning_value", precision = 15, scale = 4)
    private BigDecimal warningValue;

    /**
     * 严重阈值（红色告警）
     */
    @Column(name = "critical_value", precision = 15, scale = 4)
    private BigDecimal criticalValue;

    /**
     * 比较操作符：GT, LT, GTE, LTE, EQ
     * 默认 GT（大于）
     */
    @Builder.Default
    @Column(name = "comparison_operator", length = 16)
    private String comparisonOperator = "GT";

    /**
     * 单位：%, 元, 件, 次 等
     */
    @Column(name = "unit", length = 32)
    private String unit;

    /**
     * 阈值描述
     */
    @Column(name = "description", length = 255)
    private String description;

    /**
     * 工厂ID，null 表示全局配置
     * 工厂级别配置会覆盖全局配置
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
     * 检查值是否触发警告阈值
     *
     * @param value 待检查的值
     * @return true 如果触发警告
     */
    public boolean isWarning(BigDecimal value) {
        if (warningValue == null || value == null) {
            return false;
        }
        return compare(value, warningValue);
    }

    /**
     * 检查值是否触发严重阈值
     *
     * @param value 待检查的值
     * @return true 如果触发严重告警
     */
    public boolean isCritical(BigDecimal value) {
        if (criticalValue == null || value == null) {
            return false;
        }
        return compare(value, criticalValue);
    }

    /**
     * 根据比较操作符进行比较
     */
    private boolean compare(BigDecimal value, BigDecimal threshold) {
        int cmp = value.compareTo(threshold);
        switch (comparisonOperator) {
            case "GT":
                return cmp > 0;
            case "LT":
                return cmp < 0;
            case "GTE":
                return cmp >= 0;
            case "LTE":
                return cmp <= 0;
            case "EQ":
                return cmp == 0;
            default:
                return cmp > 0;
        }
    }

    /**
     * 获取告警级别
     *
     * @param value 待检查的值
     * @return 告警级别: CRITICAL, WARNING, NORMAL
     */
    public String getAlertLevel(BigDecimal value) {
        if (isCritical(value)) {
            return "CRITICAL";
        }
        if (isWarning(value)) {
            return "WARNING";
        }
        return "NORMAL";
    }
}

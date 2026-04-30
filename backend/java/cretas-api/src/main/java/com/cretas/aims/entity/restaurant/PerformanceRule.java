package com.cretas.aims.entity.restaurant;

import com.cretas.aims.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDate;
import java.util.Map;
import org.hibernate.annotations.Where;

/**
 * Performance rule: defines KPI weights and thresholds for store manager evaluation.
 * Customer [T 23:44-24:00]: '规则变必须每月1号, 不能中间变'.
 */
@Entity
@Table(name = "restaurant_performance_rules",
       uniqueConstraints = @UniqueConstraint(columnNames = {"factory_id", "store_id", "effective_month"}))
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@EqualsAndHashCode(callSuper = false)
@Where(clause = "deleted_at IS NULL")
public class PerformanceRule extends BaseEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(length = 36)
    private String id;

    @Column(name = "factory_id", nullable = false, length = 64)
    private String factoryId;

    @Column(name = "store_id", length = 64)
    private String storeId;

    @Column(name = "effective_month", nullable = false)
    private LocalDate effectiveMonth;

    /** JSON: {"controllable_profit": {"weight": 40, "target": 200000}, "labor_productivity": {"weight": 30, ...}} */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "kpi_weights", columnDefinition = "jsonb")
    private Map<String, Object> kpiWeights;

    /** JSON: non-controllable items to exclude from profit calc. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "non_controllable_items", columnDefinition = "jsonb")
    private Map<String, Object> nonControllableItems;

    /** Role required to modify: OWNER, FINANCE_DIRECTOR. */
    @Column(name = "modify_role", length = 32) @Builder.Default
    private String modifyRole = "OWNER";

    @Column(name = "created_by", length = 64)
    private String createdBy;

    @Column(name = "is_active") @Builder.Default
    private Boolean isActive = true;
}

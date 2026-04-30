package com.cretas.aims.entity.restaurant;

import com.cretas.aims.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import org.hibernate.annotations.Where;

/**
 * Piecework commission config: defines per-unit rates for specific roles.
 * Customer [T 33:16-34:18]: '迎宾按客单量, 基础2000单=5000元, 超出部分3元/单'.
 * Customer [T 35:01-37:00]: '服务员不按个人, 小组一起算'.
 */
@Entity
@Table(name = "restaurant_piecework_configs",
       uniqueConstraints = @UniqueConstraint(columnNames = {"factory_id", "store_id", "role", "effective_month"}))
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@EqualsAndHashCode(callSuper = false)
@Where(clause = "deleted_at IS NULL")
public class PieceworkConfig extends BaseEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(length = 36)
    private String id;

    @Column(name = "factory_id", nullable = false, length = 64)
    private String factoryId;

    @Column(name = "store_id", length = 64)
    private String storeId;

    /** Role: HOSTESS, SERVICE_TEAM, KITCHEN_TEAM, RUNNER_TEAM. */
    @Column(name = "role", nullable = false, length = 32)
    private String role;

    /** INDIVIDUAL or TEAM. */
    @Column(name = "calc_mode", nullable = false, length = 16)
    @Builder.Default
    private String calcMode = "TEAM";

    /** Base unit count threshold (e.g., 2000 covers for hostess). */
    @Column(name = "base_threshold")
    private Integer baseThreshold;

    /** Base salary for meeting threshold. */
    @Column(name = "base_salary", precision = 10, scale = 2)
    private BigDecimal baseSalary;

    /** Per-unit bonus above threshold (e.g., ¥3/cover). */
    @Column(name = "per_unit_bonus", precision = 8, scale = 2)
    private BigDecimal perUnitBonus;

    /** Unit type: COVER (客人数), TABLE (桌数), DISH (菜品数). */
    @Column(name = "unit_type", length = 16) @Builder.Default
    private String unitType = "COVER";

    /** Team size (for TEAM mode, used to split the pool). */
    @Column(name = "team_size")
    private Integer teamSize;

    @Column(name = "effective_month")
    private java.time.LocalDate effectiveMonth;

    @Column(name = "is_active") @Builder.Default
    private Boolean isActive = true;
}

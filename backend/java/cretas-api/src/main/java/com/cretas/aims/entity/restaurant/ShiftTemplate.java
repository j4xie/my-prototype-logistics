package com.cretas.aims.entity.restaurant;

import com.cretas.aims.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Shift template: defines a recurring shift pattern for a store.
 * E.g., "早班 08:00-14:00", "晚班 16:00-22:00", "通班 08:00-22:00".
 * Customer [T 28:06]: '可能早中晚班, 上班打卡到中午结束下班'.
 */
@Entity
@Table(name = "restaurant_shift_templates")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@EqualsAndHashCode(callSuper = false)
public class ShiftTemplate extends BaseEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(length = 36)
    private String id;

    @Column(name = "factory_id", nullable = false, length = 64)
    private String factoryId;

    @Column(name = "store_id", length = 64)
    private String storeId;

    @Column(name = "template_name", nullable = false, length = 64)
    private String templateName;

    /** Shift start time as "HH:mm" string. */
    @Column(name = "start_time", nullable = false, length = 5)
    private String startTime;

    /** Shift end time as "HH:mm" string. */
    @Column(name = "end_time", nullable = false, length = 5)
    private String endTime;

    /** Duration in hours (auto-calculated or manually set). */
    @Column(name = "duration_hours", precision = 4, scale = 1)
    private BigDecimal durationHours;

    /** Applicable employee types: FULL_TIME, PART_TIME, BOTH. */
    @Column(name = "employee_type", length = 20)
    @Builder.Default
    private String employeeType = "BOTH";

    @Column(name = "is_active") @Builder.Default
    private Boolean isActive = true;
}

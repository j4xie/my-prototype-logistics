package com.cretas.aims.entity.restaurant;

import com.cretas.aims.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import org.hibernate.annotations.Where;

/**
 * Daily shift assignment: who works which shift on which day.
 * Customer [T 29:05]: '排班, 首先公式制肯定是先排班'.
 */
@Entity
@Table(name = "restaurant_shift_schedules",
       uniqueConstraints = @UniqueConstraint(columnNames = {"factory_id", "store_id", "employee_id", "shift_date"}))
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@EqualsAndHashCode(callSuper = false)
@Where(clause = "deleted_at IS NULL")
public class ShiftSchedule extends BaseEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(length = 36)
    private String id;

    @Column(name = "factory_id", nullable = false, length = 64)
    private String factoryId;

    @Column(name = "store_id", nullable = false, length = 64)
    private String storeId;

    @Column(name = "employee_id", nullable = false, length = 64)
    private String employeeId;

    @Column(name = "employee_name", length = 64)
    private String employeeName;

    @Column(name = "shift_date", nullable = false)
    private LocalDate shiftDate;

    /** FK to ShiftTemplate.id — which shift pattern. */
    @Column(name = "shift_template_id", length = 36)
    private String shiftTemplateId;

    /** Actual hours worked (filled after clock-out). */
    @Column(name = "actual_hours", precision = 4, scale = 1)
    private BigDecimal actualHours;

    /** FULL_TIME or PART_TIME. */
    @Column(name = "employee_type", nullable = false, length = 20)
    private String employeeType;

    /** Hourly rate for part-timers (e.g., ¥40/hr). */
    @Column(name = "hourly_rate", precision = 8, scale = 2)
    private BigDecimal hourlyRate;

    /** SCHEDULED, CHECKED_IN, COMPLETED, ABSENT, CANCELLED. */
    @Column(name = "status", length = 20) @Builder.Default
    private String status = "SCHEDULED";
}

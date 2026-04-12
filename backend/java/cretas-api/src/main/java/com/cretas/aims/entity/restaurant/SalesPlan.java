package com.cretas.aims.entity.restaurant;

import com.cretas.aims.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

@Entity
@Table(name = "restaurant_sales_plans",
       uniqueConstraints = @UniqueConstraint(columnNames = {"factory_id", "store_id", "plan_month"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = false)
public class SalesPlan extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(length = 36)
    private String id;

    @Column(name = "factory_id", nullable = false, length = 64)
    private String factoryId;

    @Column(name = "store_id", length = 64)
    private String storeId;

    @Column(name = "plan_month", nullable = false)
    private LocalDate planMonth;

    @Column(name = "target_revenue", nullable = false, precision = 14, scale = 2)
    private BigDecimal targetRevenue;

    @Column(name = "target_order_count")
    private Integer targetOrderCount;

    @Column(name = "target_avg_ticket", precision = 10, scale = 2)
    private BigDecimal targetAvgTicket;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "daily_adjustments", columnDefinition = "jsonb")
    private Map<String, Object> dailyAdjustments;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "holiday_adjustments", columnDefinition = "jsonb")
    private Map<String, Object> holidayAdjustments;

    @Column(name = "notes", length = 500)
    private String notes;

    @Column(name = "created_by", length = 64)
    private String createdBy;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;
}

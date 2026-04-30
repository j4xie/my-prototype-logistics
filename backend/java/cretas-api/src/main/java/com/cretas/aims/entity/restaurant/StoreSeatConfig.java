package com.cretas.aims.entity.restaurant;

import com.cretas.aims.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Where;

@Entity
@Table(name = "store_seat_configs",
       uniqueConstraints = @UniqueConstraint(columnNames = {"factory_id", "store_id", "table_number"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = false)
@Where(clause = "deleted_at IS NULL")
public class StoreSeatConfig extends BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(length = 36)
    private String id;

    @Column(name = "factory_id", nullable = false, length = 64)
    private String factoryId;

    @Column(name = "store_id", nullable = false, length = 64)
    private String storeId;

    @Column(name = "table_number", nullable = false, length = 32)
    private String tableNumber;

    @Column(name = "seat_count", nullable = false)
    private Integer seatCount;

    @Column(name = "zone", length = 64)
    private String zone;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;
}

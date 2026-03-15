package com.cretas.aims.entity;

import lombok.*;
import javax.persistence.*;

@Data
@EqualsAndHashCode(callSuper = true)
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Entity
@Table(name = "work_processes", indexes = {
    @Index(name = "idx_wp_factory", columnList = "factory_id"),
    @Index(name = "idx_wp_factory_active", columnList = "factory_id, is_active")
})
public class WorkProcess extends BaseEntity {

    @Id
    @Column(name = "id", nullable = false, length = 50)
    private String id;

    @Column(name = "factory_id", nullable = false, length = 50)
    private String factoryId;

    @Column(name = "process_name", nullable = false, length = 100)
    private String processName;

    @Column(name = "process_category", length = 50)
    private String processCategory;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "unit", nullable = false, length = 20)
    @Builder.Default
    private String unit = "kg";

    @Column(name = "estimated_minutes")
    private Integer estimatedMinutes;

    @Column(name = "sort_order")
    @Builder.Default
    private Integer sortOrder = 0;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;
}

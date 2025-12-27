package com.cretas.aims.entity;

import lombok.Data;
import lombok.EqualsAndHashCode;

import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 产线配置实体
 * 用于管理工厂的生产线信息，支持调度系统
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Entity
@Table(name = "production_lines")
public class ProductionLine extends BaseEntity {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "factory_id", length = 50, nullable = false)
    private String factoryId;

    @Column(name = "department_id")
    private Long departmentId;

    @Column(length = 100, nullable = false)
    private String name;

    @Column(name = "line_code", length = 50)
    private String lineCode;

    @Column(name = "line_type", length = 50)
    private String lineType; // processing, packaging, quality_check

    @Column(name = "min_workers")
    private Integer minWorkers = 1;

    @Column(name = "max_workers")
    private Integer maxWorkers = 10;

    @Column(name = "required_skill_level")
    private Integer requiredSkillLevel = 1; // 1-5

    @Column(name = "hourly_capacity", precision = 10, scale = 2)
    private BigDecimal hourlyCapacity;

    @Column(name = "equipment_ids", columnDefinition = "TEXT")
    private String equipmentIds; // 逗号分隔的设备ID

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private LineStatus status = LineStatus.active;

    public enum LineStatus {
        active, maintenance, inactive
    }

    @PrePersist
    public void prePersist() {
        if (this.id == null) {
            this.id = java.util.UUID.randomUUID().toString();
        }
    }
}

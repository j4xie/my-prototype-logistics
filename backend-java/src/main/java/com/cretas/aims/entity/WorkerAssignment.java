package com.cretas.aims.entity;

import lombok.Data;

import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 工人分配实体
 * 记录工人被分配到哪个产线排程
 */
@Data
@Entity
@Table(name = "worker_assignments")
public class WorkerAssignment {

    @Id
    @Column(length = 36)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "schedule_id", nullable = false)
    private LineSchedule schedule;

    @Column(name = "schedule_id", insertable = false, updatable = false)
    private String scheduleId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "assigned_at")
    private LocalDateTime assignedAt;

    @Column(name = "actual_start_time")
    private LocalDateTime actualStartTime;

    @Column(name = "actual_end_time")
    private LocalDateTime actualEndTime;

    @Column(name = "is_temporary")
    private Boolean isTemporary = false;

    @Column(name = "labor_cost", precision = 10, scale = 2)
    private BigDecimal laborCost;

    @Column(name = "performance_score")
    private Integer performanceScore; // 1-100

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private AssignmentStatus status = AssignmentStatus.assigned;

    @Column(columnDefinition = "TEXT")
    private String notes;

    public enum AssignmentStatus {
        assigned, checked_in, working, checked_out, absent
    }

    @PrePersist
    public void prePersist() {
        if (this.id == null) {
            this.id = java.util.UUID.randomUUID().toString();
        }
        if (this.assignedAt == null) {
            this.assignedAt = LocalDateTime.now();
        }
    }
}

package com.cretas.aims.entity;

import lombok.Data;
import lombok.EqualsAndHashCode;

import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 工单实体类
 * 用于管理生产工单，关联生产批次和工人任务分配
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
@Data
@Entity
@Table(name = "work_orders")
@EqualsAndHashCode(callSuper = true)
public class WorkOrder extends BaseEntity {

    @Id
    @Column(name = "id", length = 50)
    private String id;

    /**
     * 工单编号
     */
    @Column(name = "order_number", nullable = false, unique = true, length = 50)
    private String orderNumber;

    /**
     * 工厂ID
     */
    @Column(name = "factory_id", nullable = false, length = 20)
    private String factoryId;

    /**
     * 关联的生产批次ID
     */
    @Column(name = "production_batch_id")
    private Long productionBatchId;

    /**
     * 关联的生产计划ID
     */
    @Column(name = "production_plan_id", length = 50)
    private String productionPlanId;

    /**
     * 工单类型: PRODUCTION/QUALITY_CHECK/MAINTENANCE/PACKAGING
     */
    @Column(name = "order_type", length = 30)
    private String orderType;

    /**
     * 工单标题
     */
    @Column(name = "title", length = 200)
    private String title;

    /**
     * 工单描述
     */
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    /**
     * 工单状态: PENDING/IN_PROGRESS/COMPLETED/CANCELLED
     */
    @Column(name = "status", length = 20)
    private String status;

    /**
     * 优先级: LOW/MEDIUM/HIGH/URGENT
     */
    @Column(name = "priority", length = 10)
    private String priority;

    /**
     * 分配给的用户ID
     */
    @Column(name = "assigned_to")
    private Long assignedTo;

    /**
     * 分配给的部门ID
     */
    @Column(name = "department_id", length = 50)
    private String departmentId;

    /**
     * 计划开始时间
     */
    @Column(name = "planned_start_time")
    private LocalDateTime plannedStartTime;

    /**
     * 计划结束时间
     */
    @Column(name = "planned_end_time")
    private LocalDateTime plannedEndTime;

    /**
     * 实际开始时间
     */
    @Column(name = "actual_start_time")
    private LocalDateTime actualStartTime;

    /**
     * 实际结束时间
     */
    @Column(name = "actual_end_time")
    private LocalDateTime actualEndTime;

    /**
     * 预估工时（小时）
     */
    @Column(name = "estimated_hours", precision = 10, scale = 2)
    private BigDecimal estimatedHours;

    /**
     * 实际工时（小时）
     */
    @Column(name = "actual_hours", precision = 10, scale = 2)
    private BigDecimal actualHours;

    /**
     * 完成进度百分比
     */
    @Column(name = "progress")
    private Integer progress;

    /**
     * 备注
     */
    @Column(name = "remarks", columnDefinition = "TEXT")
    private String remarks;

    /**
     * 创建者ID
     */
    @Column(name = "created_by")
    private Long createdBy;

    /**
     * 更新者ID
     */
    @Column(name = "updated_by")
    private Long updatedBy;
}

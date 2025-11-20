package com.cretas.aims.entity;

import lombok.*;
import javax.persistence.*;
import java.math.BigDecimal;
/**
 * 批次工作会话关联实体类
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"batch", "workSession", "employee"})
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "batch_work_sessions",
       indexes = {
           @Index(name = "idx_batchwork_batch", columnList = "batch_id"),
           @Index(name = "idx_batchwork_session", columnList = "work_session_id")
       }
)
public class BatchWorkSession extends BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;  // 统一为 Long
    @Column(name = "batch_id", nullable = false)
    private Long batchId;  // 统一为 Long，与 ProcessingBatch.id 类型一致
    @Column(name = "work_session_id", nullable = false)
    private Integer workSessionId;
    @Column(name = "employee_id", nullable = false)
    private Integer employeeId;
    @Column(name = "work_minutes", nullable = false)
    private Integer workMinutes;
    @Column(name = "labor_cost", nullable = false, precision = 10, scale = 2)
    private BigDecimal laborCost;
    // 关联关系
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", referencedColumnName = "id", insertable = false, updatable = false)
    private ProcessingBatch batch;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "work_session_id", referencedColumnName = "id", insertable = false, updatable = false)
    private EmployeeWorkSession workSession;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", referencedColumnName = "id", insertable = false, updatable = false)
    private User employee;
}

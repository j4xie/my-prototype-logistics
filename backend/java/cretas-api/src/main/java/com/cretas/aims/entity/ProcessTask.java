package com.cretas.aims.entity;

import com.cretas.aims.entity.enums.ProcessTaskStatus;
import lombok.*;
import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@EqualsAndHashCode(callSuper = true)
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Entity
@Table(name = "process_tasks", indexes = {
    @Index(name = "idx_pt_factory_status", columnList = "factory_id, status"),
    @Index(name = "idx_pt_factory_product", columnList = "factory_id, product_type_id"),
    @Index(name = "idx_pt_run", columnList = "production_run_id")
})
public class ProcessTask extends BaseEntity {

    @Id
    @Column(name = "id", nullable = false, length = 50)
    private String id;

    @Column(name = "factory_id", nullable = false, length = 50)
    private String factoryId;

    @Column(name = "production_run_id", nullable = false, length = 50)
    private String productionRunId;

    @Column(name = "product_type_id", nullable = false, length = 50)
    private String productTypeId;

    @Column(name = "work_process_id", nullable = false, length = 50)
    private String workProcessId;

    @Column(name = "source_customer_name", length = 100)
    private String sourceCustomerName;

    @Column(name = "source_doc_type", length = 20)
    private String sourceDocType;

    @Column(name = "source_doc_id", length = 50)
    private String sourceDocId;

    @Column(name = "workflow_version_id")
    private Integer workflowVersionId;

    @Column(name = "planned_quantity", nullable = false, precision = 10, scale = 2)
    private BigDecimal plannedQuantity;

    @Column(name = "completed_quantity", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal completedQuantity = BigDecimal.ZERO;

    @Column(name = "pending_quantity", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal pendingQuantity = BigDecimal.ZERO;

    @Column(name = "unit", nullable = false, length = 20)
    private String unit;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "expected_end_date")
    private LocalDate expectedEndDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private ProcessTaskStatus status = ProcessTaskStatus.PENDING;

    @Column(name = "previous_terminal_status", length = 20)
    private String previousTerminalStatus;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Version
    @Column(name = "version")
    private Long version;
}

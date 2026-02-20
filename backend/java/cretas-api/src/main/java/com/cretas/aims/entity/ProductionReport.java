package com.cretas.aims.entity;

import com.vladmihalcea.hibernate.type.json.JsonType;
import lombok.*;
import org.hibernate.annotations.Type;
import org.hibernate.annotations.TypeDef;

import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "production_reports", indexes = {
        @Index(name = "idx_pr_factory_date", columnList = "factory_id, report_date"),
        @Index(name = "idx_pr_batch", columnList = "batch_id"),
        @Index(name = "idx_pr_worker", columnList = "worker_id"),
        @Index(name = "idx_pr_type", columnList = "report_type")
})
@TypeDef(name = "json", typeClass = JsonType.class)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductionReport {

    public static class ReportType {
        public static final String PROGRESS = "PROGRESS";
        public static final String HOURS = "HOURS";
    }

    public enum Status {
        DRAFT, SUBMITTED, APPROVED, REJECTED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "factory_id", nullable = false, length = 50)
    private String factoryId;

    @Column(name = "batch_id")
    private Long batchId;

    @Column(name = "worker_id", nullable = false)
    private Long workerId;

    @Column(name = "report_type", nullable = false, length = 30)
    private String reportType;

    @Column(name = "schema_id", length = 36)
    private String schemaId;

    @Column(name = "report_date", nullable = false)
    private LocalDate reportDate;

    @Column(name = "reporter_name", length = 100)
    private String reporterName;

    @Column(name = "process_category", length = 200)
    private String processCategory;

    @Column(name = "product_name", length = 200)
    private String productName;

    @Column(name = "output_quantity", precision = 12, scale = 2)
    private BigDecimal outputQuantity;

    @Column(name = "good_quantity", precision = 12, scale = 2)
    private BigDecimal goodQuantity;

    @Column(name = "defect_quantity", precision = 12, scale = 2)
    private BigDecimal defectQuantity;

    @Column(name = "total_work_minutes")
    private Integer totalWorkMinutes;

    @Column(name = "total_workers")
    private Integer totalWorkers;

    @Column(name = "operation_volume", precision = 10, scale = 2)
    private BigDecimal operationVolume;

    @Type(type = "json")
    @Column(name = "hour_entries", columnDefinition = "jsonb")
    private List<Map<String, Object>> hourEntries;

    @Type(type = "json")
    @Column(name = "non_production_entries", columnDefinition = "jsonb")
    private List<Map<String, Object>> nonProductionEntries;

    @Column(name = "production_start_time")
    private LocalTime productionStartTime;

    @Column(name = "production_end_time")
    private LocalTime productionEndTime;

    @Type(type = "json")
    @Column(name = "custom_fields", columnDefinition = "jsonb")
    private Map<String, Object> customFields;

    @Type(type = "json")
    @Column(name = "photos", columnDefinition = "jsonb")
    private List<String> photos;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20)
    @Builder.Default
    private Status status = Status.SUBMITTED;

    @Column(name = "synced_to_smartbi")
    @Builder.Default
    private Boolean syncedToSmartbi = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

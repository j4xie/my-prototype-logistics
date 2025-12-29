package com.cretas.aims.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
/**
 * 质量检验实体类
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"productionBatch", "inspector"})
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Entity
@Table(name = "quality_inspections",
       indexes = {
           @Index(name = "idx_inspection_factory", columnList = "factory_id"),
           @Index(name = "idx_inspection_batch", columnList = "production_batch_id"),
           @Index(name = "idx_inspection_date", columnList = "inspection_date")
       }
)
public class QualityInspection extends BaseEntity {
    @Id
    @Column(name = "id", nullable = false, length = 191)
    private String id;
    @Column(name = "factory_id", nullable = false)
    private String factoryId;
    @Column(name = "production_batch_id", nullable = false)
    private Long productionBatchId;
    @Column(name = "inspector_id", nullable = false)
    private Long inspectorId;
    @Column(name = "inspection_date", nullable = false)
    private LocalDate inspectionDate;
    @Column(name = "sample_size", nullable = false, precision = 10, scale = 2)
    private BigDecimal sampleSize;
    @Column(name = "pass_count", nullable = false, precision = 10, scale = 2)
    private BigDecimal passCount;
    @Column(name = "fail_count", nullable = false, precision = 10, scale = 2)
    private BigDecimal failCount;
    @Column(name = "pass_rate", precision = 5, scale = 2)
    private BigDecimal passRate;
    @Column(name = "result", length = 20)
    private String result;  // PASS, FAIL, CONDITIONAL
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;
    // 关联关系 (使用 @JsonIgnore 防止循环引用)
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "production_batch_id", referencedColumnName = "id", insertable = false, updatable = false)
    private ProductionBatch productionBatch;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inspector_id", referencedColumnName = "id", insertable = false, updatable = false)
    private User inspector;
}

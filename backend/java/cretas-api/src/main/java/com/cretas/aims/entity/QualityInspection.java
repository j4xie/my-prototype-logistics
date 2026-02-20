package com.cretas.aims.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.vladmihalcea.hibernate.type.json.JsonBinaryType;
import lombok.*;
import org.hibernate.annotations.Type;
import org.hibernate.annotations.TypeDef;
import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
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
@TypeDef(name = "jsonb", typeClass = JsonBinaryType.class)
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

    /**
     * 持久化前自动生成 ID
     */
    @PrePersist
    public void prePersist() {
        if (this.id == null || this.id.isEmpty()) {
            this.id = java.util.UUID.randomUUID().toString();
        }
    }

    // ==================== 计算字段 ====================

    /**
     * 缺陷率 (计算字段，不存储在数据库)
     * defectRate = failCount / sampleSize * 100
     */
    @Transient
    public java.math.BigDecimal getDefectRate() {
        if (sampleSize == null || sampleSize.compareTo(java.math.BigDecimal.ZERO) == 0) {
            return java.math.BigDecimal.ZERO;
        }
        if (failCount == null) {
            return java.math.BigDecimal.ZERO;
        }
        return failCount.multiply(java.math.BigDecimal.valueOf(100))
                .divide(sampleSize, 2, java.math.RoundingMode.HALF_UP);
    }

    /**
     * 质量等级 (计算字段，基于合格率)
     * A: >= 95%
     * B: >= 85%
     * C: >= 70%
     * D: < 70%
     */
    @Transient
    public String getQualityGrade() {
        if (passRate == null) {
            return null;
        }
        double rate = passRate.doubleValue();
        if (rate >= 95) return "A";
        if (rate >= 85) return "B";
        if (rate >= 70) return "C";
        return "D";
    }

    // AI-configured custom fields stored as JSONB
    @Type(type = "jsonb")
    @Column(name = "custom_fields", columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> customFields = new HashMap<>();

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

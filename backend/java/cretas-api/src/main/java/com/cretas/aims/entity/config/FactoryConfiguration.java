package com.cretas.aims.entity.config;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "factory_configurations",
    indexes = {
        @Index(name = "idx_fc_factory_status", columnList = "factory_id, status")
    },
    uniqueConstraints = {
        @UniqueConstraint(name = "idx_fc_factory_version", columnNames = {"factory_id", "config_version"})
    })
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class FactoryConfiguration {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "factory_id", length = 50, nullable = false)
    private String factoryId;

    @Column(name = "template_id")
    private Long templateId;

    @Column(name = "config_version", nullable = false)
    private Integer configVersion = 1;

    @Column(name = "status", length = 16, nullable = false)
    private String status = "DRAFT";

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    @Column(name = "published_by")
    private Long publishedBy;

    @Column(name = "rollback_version")
    private Integer rollbackVersion;

    @Column(name = "change_summary", columnDefinition = "TEXT")
    private String changeSummary;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

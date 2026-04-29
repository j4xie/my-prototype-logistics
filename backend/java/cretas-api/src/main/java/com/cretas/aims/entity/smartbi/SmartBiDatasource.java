package com.cretas.aims.entity.smartbi;

import com.cretas.aims.entity.BaseEntity;
import com.cretas.aims.entity.smartbi.enums.DatasourceType;
import lombok.*;
import lombok.experimental.SuperBuilder;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.Where;

/**
 * SmartBI Datasource Entity - Represents a data source for BI analysis
 *
 * Supports multiple source types:
 * - EXCEL: Uploaded Excel files
 * - API: External API integrations
 * - DB: Direct database connections
 *
 * Tracks schema versioning for data evolution management.
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Entity
@Table(name = "smart_bi_datasource",
       indexes = {
           @Index(name = "idx_datasource_factory", columnList = "factory_id"),
           @Index(name = "idx_datasource_type", columnList = "source_type"),
           @Index(name = "idx_datasource_name", columnList = "name")
       },
       uniqueConstraints = {
           @UniqueConstraint(name = "uk_factory_datasource_name", columnNames = {"factory_id", "name"})
       })
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"fieldDefinitions"})
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Where(clause = "deleted_at IS NULL")
public class SmartBiDatasource extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Data source name (unique per factory)
     */
    @Column(name = "name", nullable = false, length = 100)
    private String name;

    /**
     * Data source type
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 20)
    private DatasourceType sourceType;

    /**
     * Factory ID that owns this datasource
     */
    @Column(name = "factory_id", nullable = false, length = 50)
    private String factoryId;

    /**
     * Current schema version number
     * Incremented on each schema change
     */
    @Builder.Default
    @Column(name = "schema_version", nullable = false)
    private Integer schemaVersion = 1;

    /**
     * Timestamp of last schema modification
     */
    @Column(name = "last_schema_change")
    private LocalDateTime lastSchemaChange;

    /**
     * Description of the data source
     */
    @Column(name = "description", length = 500)
    private String description;

    /**
     * Connection configuration JSON (for API/DB types)
     * Structure varies by source type:
     * - API: { "url": "...", "headers": {...}, "auth": {...} }
     * - DB: { "host": "...", "port": 3306, "database": "...", "table": "..." }
     */
    @Column(name = "connection_config", columnDefinition = "JSON")
    private String connectionConfig;

    /**
     * Whether this datasource is active
     */
    @Builder.Default
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    /**
     * Unique short code within factory (Apr 16 2026 — for client-side config).
     */
    @Column(name = "code", length = 100)
    private String code;

    /**
     * Refresh interval in minutes (DATABASE/API only; null = manual).
     */
    @Column(name = "refresh_interval")
    private Integer refreshInterval;

    /**
     * For sourceType=EXCEL, points to smart_bi_pg_excel_uploads.id
     * so the DataSource row can be looked up by uploadId and vice-versa.
     */
    @Column(name = "linked_upload_id")
    private Long linkedUploadId;

    /**
     * Field definitions for this datasource
     */
    @OneToMany(mappedBy = "datasource", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    private List<SmartBiFieldDefinition> fieldDefinitions = new ArrayList<>();

    /**
     * Increment schema version and update timestamp
     */
    public void incrementSchemaVersion() {
        this.schemaVersion++;
        this.lastSchemaChange = LocalDateTime.now();
    }
}

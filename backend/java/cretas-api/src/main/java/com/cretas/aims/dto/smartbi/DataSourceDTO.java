package com.cretas.aims.dto.smartbi;

import com.cretas.aims.entity.smartbi.SmartBiDatasource;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DataSource DTO for SmartBI config UI (Apr 16 2026).
 *
 * Aligns field names with the frontend TypeScript interface:
 *   type: 'DATABASE' | 'API' | 'EXCEL' | 'CUSTOM'
 *   code, connectionConfig, refreshInterval, isActive, linkedUploadId
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DataSourceDTO {
    private Long id;
    private String factoryId;
    private String name;
    private String code;
    /** Frontend-friendly type: DATABASE / API / EXCEL / CUSTOM */
    private String type;
    private String description;
    private String connectionConfig;
    private Integer refreshInterval;
    private Boolean isActive;
    private Long linkedUploadId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static DataSourceDTO fromEntity(SmartBiDatasource e) {
        if (e == null) return null;
        return DataSourceDTO.builder()
                .id(e.getId())
                .factoryId(e.getFactoryId())
                .name(e.getName())
                .code(e.getCode())
                .type(e.getSourceType() != null ? e.getSourceType().toClientType() : null)
                .description(e.getDescription())
                .connectionConfig(e.getConnectionConfig())
                .refreshInterval(e.getRefreshInterval())
                .isActive(e.getIsActive())
                .linkedUploadId(e.getLinkedUploadId())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }
}

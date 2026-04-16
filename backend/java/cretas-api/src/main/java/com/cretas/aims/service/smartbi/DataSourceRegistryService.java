package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.DataSourceDTO;
import com.cretas.aims.entity.smartbi.SmartBiDatasource;
import com.cretas.aims.entity.smartbi.enums.DatasourceType;
import com.cretas.aims.repository.smartbi.SmartBiDatasourceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Unified DataSource registry service (Apr 16 2026).
 *
 * Serves two clients:
 * 1. SmartBIConfigController /data-sources CRUD (pagination + filter)
 * 2. SmartBIUploadFlowServiceImpl — upsertExcelFromUpload() sync hook
 *    so uploaded Excel files appear in "SmartBI 配置 → 数据源" page.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DataSourceRegistryService {

    private final SmartBiDatasourceRepository repository;

    /**
     * Pagination + keyword filter.
     *
     * @param factoryId optional; if present, filter to that factory only. Platform admins can pass null to list all.
     * @param keyword   substring match on name (case-insensitive)
     * @param type      frontend type (DATABASE/API/EXCEL/CUSTOM); null = any
     * @param isActive  optional filter
     */
    @Transactional(readOnly = true)
    public Page<DataSourceDTO> list(String factoryId, String keyword, String type, Boolean isActive,
                                     int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        // Simple filter via Java stream (dataset is small, < 10K rows per factory).
        // Could refine with Specification if it grows.
        var all = factoryId != null
                ? repository.findByFactoryId(factoryId)
                : repository.findAll();
        var kw = keyword != null ? keyword.trim().toLowerCase() : null;
        DatasourceType typeFilter = (type != null && !type.isBlank()) ? DatasourceType.fromClientType(type) : null;
        var filtered = all.stream()
                .filter(d -> kw == null || kw.isEmpty()
                        || (d.getName() != null && d.getName().toLowerCase().contains(kw))
                        || (d.getCode() != null && d.getCode().toLowerCase().contains(kw)))
                .filter(d -> typeFilter == null || typeFilter == d.getSourceType())
                .filter(d -> isActive == null || Boolean.valueOf(isActive).equals(d.getIsActive()))
                .sorted((a, b) -> {
                    if (a.getCreatedAt() == null && b.getCreatedAt() == null) return 0;
                    if (a.getCreatedAt() == null) return 1;
                    if (b.getCreatedAt() == null) return -1;
                    return b.getCreatedAt().compareTo(a.getCreatedAt());
                })
                .toList();
        int from = Math.min(page * size, filtered.size());
        int to = Math.min(from + size, filtered.size());
        var pageSlice = filtered.subList(from, to).stream().map(DataSourceDTO::fromEntity).toList();
        return new org.springframework.data.domain.PageImpl<>(pageSlice, pageable, filtered.size());
    }

    @Transactional(readOnly = true)
    public DataSourceDTO getById(String factoryId, Long id) {
        return repository.findByIdAndFactoryId(id, factoryId)
                .map(DataSourceDTO::fromEntity)
                .orElse(null);
    }

    @Transactional
    public DataSourceDTO create(String factoryId, DataSourceDTO dto) {
        // Pre-check so the UNIQUE (factory_id, name) collision never reaches
        // Hibernate. Without this, a duplicate save() leaves the session with
        // a null-id entity; any subsequent flush in the same transaction throws
        // AssertionFailure "don't flush the Session after an exception occurs",
        // and the caller sees UnexpectedRollbackException instead of a 400.
        if (dto.getName() != null && repository.existsByFactoryIdAndName(factoryId, dto.getName())) {
            throw new IllegalArgumentException("数据源名称已存在: " + dto.getName());
        }
        SmartBiDatasource entity = SmartBiDatasource.builder()
                .factoryId(factoryId)
                .name(dto.getName())
                .code(dto.getCode())
                .sourceType(DatasourceType.fromClientType(dto.getType()))
                .description(dto.getDescription())
                .connectionConfig(dto.getConnectionConfig())
                .refreshInterval(dto.getRefreshInterval())
                .isActive(dto.getIsActive() != null ? dto.getIsActive() : true)
                .linkedUploadId(dto.getLinkedUploadId())
                .schemaVersion(1)
                .build();
        return DataSourceDTO.fromEntity(repository.save(entity));
    }

    @Transactional
    public DataSourceDTO update(String factoryId, Long id, DataSourceDTO dto) {
        var existing = repository.findByIdAndFactoryId(id, factoryId).orElse(null);
        if (existing == null) return null;
        if (dto.getName() != null) existing.setName(dto.getName());
        if (dto.getCode() != null) existing.setCode(dto.getCode());
        if (dto.getType() != null) existing.setSourceType(DatasourceType.fromClientType(dto.getType()));
        if (dto.getDescription() != null) existing.setDescription(dto.getDescription());
        if (dto.getConnectionConfig() != null) existing.setConnectionConfig(dto.getConnectionConfig());
        if (dto.getRefreshInterval() != null) existing.setRefreshInterval(dto.getRefreshInterval());
        if (dto.getIsActive() != null) existing.setIsActive(dto.getIsActive());
        return DataSourceDTO.fromEntity(repository.save(existing));
    }

    @Transactional
    public boolean delete(String factoryId, Long id) {
        var existing = repository.findByIdAndFactoryId(id, factoryId).orElse(null);
        if (existing == null) return false;
        repository.delete(existing);
        return true;
    }

    /**
     * Upsert a DataSource row linked to an uploaded Excel file.
     *
     * Called from SmartBIUploadFlowServiceImpl after persistence succeeds so
     * "SmartBI 配置 → 数据源" page includes user-uploaded Excel/CSV files.
     *
     * If a row already exists for this uploadId (re-upload / retry), the existing
     * row is updated in place (preserves id + downstream references).
     */
    @Transactional
    public DataSourceDTO upsertFromExcelUpload(String factoryId, Long uploadId, String fileName,
                                                String detectedDataType, Integer rowCount) {
        // Primary lookup: same uploadId → existing row for this upload.
        Optional<SmartBiDatasource> existing = repository.findByFactoryIdAndLinkedUploadId(factoryId, uploadId);

        // Fallback lookup: different uploadId but same filename (user re-uploaded
        // the same file as a new upload record). Collapse into the existing row
        // instead of letting the UNIQUE (factory_id, name) constraint reject it.
        String targetName = fileName != null ? fileName : ("Excel #" + uploadId);
        if (existing.isEmpty()) {
            existing = repository.findByFactoryIdAndName(factoryId, targetName);
        }

        SmartBiDatasource entity = existing.orElseGet(() -> SmartBiDatasource.builder()
                .factoryId(factoryId)
                .sourceType(DatasourceType.EXCEL)
                .linkedUploadId(uploadId)
                .schemaVersion(1)
                .isActive(true)
                .build());

        // Always advance linkedUploadId to the latest upload so downstream lookups
        // by uploadId resolve to the current row.
        entity.setLinkedUploadId(uploadId);
        entity.setName(targetName);
        entity.setCode("EXCEL_" + uploadId);
        String desc = (detectedDataType != null ? detectedDataType : "EXCEL") +
                (rowCount != null ? " · " + rowCount + " 行" : "");
        entity.setDescription(desc);
        entity.setIsActive(true);

        SmartBiDatasource saved = repository.save(entity);
        log.info("DataSource row {} for upload {} (factory {}): id={}, name={}",
                existing.isPresent() ? "updated" : "created",
                uploadId, factoryId, saved.getId(), saved.getName());
        return DataSourceDTO.fromEntity(saved);
    }
}

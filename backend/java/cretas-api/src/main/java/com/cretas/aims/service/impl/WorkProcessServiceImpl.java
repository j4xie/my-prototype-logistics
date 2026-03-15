package com.cretas.aims.service.impl;

import com.cretas.aims.dto.WorkProcessDTO;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.WorkProcess;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.WorkProcessRepository;
import com.cretas.aims.service.WorkProcessService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WorkProcessServiceImpl implements WorkProcessService {

    private static final Logger log = LoggerFactory.getLogger(WorkProcessServiceImpl.class);
    private final WorkProcessRepository workProcessRepository;

    @Override
    @Transactional
    public WorkProcessDTO create(String factoryId, WorkProcessDTO dto) {
        log.info("Creating work process '{}' for factory: {}", dto.getProcessName(), factoryId);

        if (workProcessRepository.existsByFactoryIdAndProcessName(factoryId, dto.getProcessName())) {
            throw new BusinessException("工序名称已存在: " + dto.getProcessName());
        }

        WorkProcess entity = WorkProcess.builder()
                .id(UUID.randomUUID().toString())
                .factoryId(factoryId)
                .processName(dto.getProcessName())
                .processCategory(dto.getProcessCategory())
                .description(dto.getDescription())
                .unit(dto.getUnit() != null ? dto.getUnit() : "kg")
                .estimatedMinutes(dto.getEstimatedMinutes())
                .sortOrder(dto.getSortOrder() != null ? dto.getSortOrder() : 0)
                .isActive(true)
                .build();

        WorkProcess saved = workProcessRepository.save(entity);
        return toDTO(saved);
    }

    @Override
    public PageResponse<WorkProcessDTO> list(String factoryId, Pageable pageable) {
        log.debug("Listing work processes for factory: {}", factoryId);
        Page<WorkProcess> page = workProcessRepository.findByFactoryId(factoryId, pageable);
        List<WorkProcessDTO> content = page.getContent().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
        return PageResponse.of(content, page.getNumber() + 1, page.getSize(), page.getTotalElements());
    }

    @Override
    public List<WorkProcessDTO> listActive(String factoryId) {
        log.debug("Listing active work processes for factory: {}", factoryId);
        return workProcessRepository.findByFactoryIdAndIsActiveTrueOrderBySortOrderAsc(factoryId)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public WorkProcessDTO getById(String factoryId, String id) {
        WorkProcess entity = workProcessRepository.findByFactoryIdAndId(factoryId, id)
                .orElseThrow(() -> new ResourceNotFoundException("WorkProcess", "id", id));
        return toDTO(entity);
    }

    @Override
    @Transactional
    public WorkProcessDTO update(String factoryId, String id, WorkProcessDTO dto) {
        log.info("Updating work process {} for factory: {}", id, factoryId);
        WorkProcess entity = workProcessRepository.findByFactoryIdAndId(factoryId, id)
                .orElseThrow(() -> new ResourceNotFoundException("WorkProcess", "id", id));

        if (dto.getProcessName() != null) entity.setProcessName(dto.getProcessName());
        if (dto.getProcessCategory() != null) entity.setProcessCategory(dto.getProcessCategory());
        if (dto.getUnit() != null) entity.setUnit(dto.getUnit());
        if (dto.getEstimatedMinutes() != null) entity.setEstimatedMinutes(dto.getEstimatedMinutes());
        if (dto.getDescription() != null) entity.setDescription(dto.getDescription());
        if (dto.getSortOrder() != null) entity.setSortOrder(dto.getSortOrder());

        WorkProcess saved = workProcessRepository.save(entity);
        return toDTO(saved);
    }

    @Override
    @Transactional
    public void delete(String factoryId, String id) {
        log.info("Deleting work process {} for factory: {}", id, factoryId);
        WorkProcess entity = workProcessRepository.findByFactoryIdAndId(factoryId, id)
                .orElseThrow(() -> new ResourceNotFoundException("WorkProcess", "id", id));
        workProcessRepository.delete(entity);
    }

    @Override
    @Transactional
    public WorkProcessDTO toggleStatus(String factoryId, String id) {
        log.info("Toggling work process status {} for factory: {}", id, factoryId);
        WorkProcess entity = workProcessRepository.findByFactoryIdAndId(factoryId, id)
                .orElseThrow(() -> new ResourceNotFoundException("WorkProcess", "id", id));
        entity.setIsActive(!entity.getIsActive());
        WorkProcess saved = workProcessRepository.save(entity);
        return toDTO(saved);
    }

    @Override
    @Transactional
    public void updateSortOrder(String factoryId, List<WorkProcessDTO.SortOrderUpdate> updates) {
        log.info("Updating sort order for {} work processes in factory: {}", updates.size(), factoryId);
        for (WorkProcessDTO.SortOrderUpdate update : updates) {
            workProcessRepository.findByFactoryIdAndId(factoryId, update.getId())
                    .ifPresent(wp -> {
                        wp.setSortOrder(update.getSortOrder());
                        workProcessRepository.save(wp);
                    });
        }
    }

    private WorkProcessDTO toDTO(WorkProcess entity) {
        return WorkProcessDTO.builder()
                .id(entity.getId())
                .processName(entity.getProcessName())
                .processCategory(entity.getProcessCategory())
                .description(entity.getDescription())
                .unit(entity.getUnit())
                .estimatedMinutes(entity.getEstimatedMinutes())
                .sortOrder(entity.getSortOrder())
                .isActive(entity.getIsActive())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}

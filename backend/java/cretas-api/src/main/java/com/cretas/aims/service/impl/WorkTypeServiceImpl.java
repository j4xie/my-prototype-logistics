package com.cretas.aims.service.impl;

import com.cretas.aims.dto.WorkTypeDTO;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.WorkType;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.WorkTypeRepository;
import com.cretas.aims.service.WorkTypeService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 工作类型管理服务实现类
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Service
@RequiredArgsConstructor
public class WorkTypeServiceImpl implements WorkTypeService {
    private static final Logger log = LoggerFactory.getLogger(WorkTypeServiceImpl.class);

    private final WorkTypeRepository workTypeRepository;

    @Override
    @Transactional
    public WorkTypeDTO createWorkType(String factoryId, WorkTypeDTO dto) {
        log.info("Creating work type for factory: {}", factoryId);

        // 检查名称是否已存在
        if (workTypeRepository.existsByFactoryIdAndName(factoryId, dto.getName())) {
            throw new BusinessException("工作类型名称已存在: " + dto.getName());
        }

        WorkType workType = new WorkType();
        workType.setId(java.util.UUID.randomUUID().toString());
        workType.setFactoryId(factoryId);
        workType.setName(dto.getName());
        workType.setCode(dto.getCode());
        workType.setTypeCode(dto.getCode() != null ? dto.getCode() : "DEFAULT");
        workType.setTypeName(dto.getName());
        workType.setDescription(dto.getDescription());
        workType.setDepartment(dto.getDepartment());
        workType.setHourlyRate(dto.getHourlyRate());
        workType.setBillingType(dto.getBillingType());
        workType.setHazardLevel(dto.getHazardLevel() != null ? dto.getHazardLevel() : 0);
        workType.setCertificationRequired(dto.getCertificationRequired() != null ? dto.getCertificationRequired() : false);
        workType.setRequiredSkills(dto.getRequiredSkills());
        workType.setIsActive(true);
        workType.setIsDefault(false);
        workType.setDisplayOrder(dto.getDisplayOrder() != null ? dto.getDisplayOrder() : 0);
        workType.setColor(dto.getColor());
        workType.setIcon(dto.getIcon());

        // 设置工资率 - 使用正确的字段名
        if (dto.getBaseRate() != null) {
            workType.setBaseRate(dto.getBaseRate());
        }

        // 设置加班倍率
        workType.setOvertimeRateMultiplier(
            dto.getOvertimeRateMultiplier() != null ?
            dto.getOvertimeRateMultiplier() :
            new BigDecimal("1.5")
        );

        // 设置假期倍率
        workType.setHolidayRateMultiplier(
            dto.getHolidayRateMultiplier() != null ?
            dto.getHolidayRateMultiplier() :
            new BigDecimal("2.0")
        );

        // 设置夜班倍率
        workType.setNightShiftRateMultiplier(
            dto.getNightShiftRateMultiplier() != null ?
            dto.getNightShiftRateMultiplier() :
            new BigDecimal("1.3")
        );

        WorkType saved = workTypeRepository.save(workType);
        return convertToDTO(saved);
    }

    @Override
    public PageResponse<WorkTypeDTO> getWorkTypes(String factoryId, Pageable pageable) {
        log.debug("Getting work types for factory: {}", factoryId);

        Page<WorkType> page = workTypeRepository.findByFactoryId(factoryId, pageable);

        List<WorkTypeDTO> dtos = page.getContent().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());

        return PageResponse.of(dtos, page.getNumber(), page.getSize(), page.getTotalElements());
    }

    @Override
    public List<WorkTypeDTO> getAllActiveWorkTypes(String factoryId) {
        log.debug("Getting all active work types for factory: {}", factoryId);

        List<WorkType> workTypes = workTypeRepository.findByFactoryIdAndIsActiveTrue(factoryId);
        return workTypes.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public WorkTypeDTO getWorkTypeById(String factoryId, String id) {
        log.debug("Getting work type by id: {} for factory: {}", id, factoryId);

        WorkType workType = workTypeRepository.findById(id)
                .filter(w -> w.getFactoryId().equals(factoryId))
                .orElseThrow(() -> new ResourceNotFoundException("工作类型不存在: " + id));

        return convertToDTO(workType);
    }

    @Override
    @Transactional
    public WorkTypeDTO updateWorkType(String factoryId, String id, WorkTypeDTO dto) {
        log.info("Updating work type: {} for factory: {}", id, factoryId);

        WorkType workType = workTypeRepository.findById(id)
                .filter(w -> w.getFactoryId().equals(factoryId))
                .orElseThrow(() -> new ResourceNotFoundException("工作类型不存在: " + id));

        // 检查新名称是否与其他工作类型冲突
        if (!workType.getName().equals(dto.getName()) &&
            workTypeRepository.existsByFactoryIdAndName(factoryId, dto.getName())) {
            throw new BusinessException("工作类型名称已存在: " + dto.getName());
        }

        // 更新基本字段
        workType.setName(dto.getName());
        workType.setCode(dto.getCode());
        workType.setTypeCode(dto.getCode() != null ? dto.getCode() : workType.getTypeCode());
        workType.setTypeName(dto.getName());
        workType.setDescription(dto.getDescription());
        workType.setDepartment(dto.getDepartment());
        workType.setHourlyRate(dto.getHourlyRate());
        workType.setBillingType(dto.getBillingType());
        workType.setRequiredSkills(dto.getRequiredSkills());
        workType.setColor(dto.getColor());
        workType.setIcon(dto.getIcon());
        workType.setIsActive(dto.getIsActive());

        // 更新危险等级和认证要求
        if (dto.getHazardLevel() != null) {
            workType.setHazardLevel(dto.getHazardLevel());
        }
        if (dto.getCertificationRequired() != null) {
            workType.setCertificationRequired(dto.getCertificationRequired());
        }

        // 更新显示相关
        if (dto.getDisplayOrder() != null) {
            workType.setDisplayOrder(dto.getDisplayOrder());
        }

        // 更新工资率 - 使用正确的字段名
        if (dto.getBaseRate() != null) {
            workType.setBaseRate(dto.getBaseRate());
        }
        if (dto.getOvertimeRateMultiplier() != null) {
            workType.setOvertimeRateMultiplier(dto.getOvertimeRateMultiplier());
        }
        if (dto.getHolidayRateMultiplier() != null) {
            workType.setHolidayRateMultiplier(dto.getHolidayRateMultiplier());
        }
        if (dto.getNightShiftRateMultiplier() != null) {
            workType.setNightShiftRateMultiplier(dto.getNightShiftRateMultiplier());
        }

        WorkType saved = workTypeRepository.save(workType);
        return convertToDTO(saved);
    }

    @Override
    @Transactional
    public void deleteWorkType(String factoryId, String id) {
        log.info("Deleting work type: {} for factory: {}", id, factoryId);

        WorkType workType = workTypeRepository.findById(id)
                .filter(w -> w.getFactoryId().equals(factoryId))
                .orElseThrow(() -> new ResourceNotFoundException("工作类型不存在: " + id));

        if (Boolean.TRUE.equals(workType.getIsDefault())) {
            throw new BusinessException("不能删除默认工作类型");
        }

        // TODO: 检查是否有关联的考勤记录
        workTypeRepository.delete(workType);
    }

    @Override
    @Transactional
    public WorkTypeDTO toggleWorkTypeStatus(String factoryId, String id) {
        log.info("Toggling work type status: {} for factory: {}", id, factoryId);

        WorkType workType = workTypeRepository.findById(id)
                .filter(w -> w.getFactoryId().equals(factoryId))
                .orElseThrow(() -> new ResourceNotFoundException("工作类型不存在: " + id));

        workType.setIsActive(!workType.getIsActive());
        WorkType saved = workTypeRepository.save(workType);
        return convertToDTO(saved);
    }

    @Override
    @Transactional
    public void initializeDefaultWorkTypes(String factoryId) {
        log.info("Initializing default work types for factory: {}", factoryId);

        // 检查是否已有工作类型
        long count = workTypeRepository.countByFactoryId(factoryId);
        if (count > 0) {
            log.info("Factory {} already has work types, skipping initialization", factoryId);
            return;
        }

        List<WorkTypeDTO> defaultTypes = getDefaultWorkTypes();
        for (WorkTypeDTO dto : defaultTypes) {
            createWorkType(factoryId, dto);
        }

        log.info("Created {} default work types for factory: {}", defaultTypes.size(), factoryId);
    }

    @Override
    public WorkTypeDTO.WorkTypeStats getWorkTypeStats(String factoryId) {
        log.debug("Getting work type stats for factory: {}", factoryId);

        List<WorkType> allTypes = workTypeRepository.findByFactoryId(factoryId);
        List<WorkType> activeTypes = workTypeRepository.findByFactoryIdAndIsActiveTrue(factoryId);

        // TODO: 从考勤记录中获取实际使用数据
        return WorkTypeDTO.WorkTypeStats.builder()
                .totalTypes(allTypes.size())
                .activeTypes(activeTypes.size())
                .inactiveTypes(allTypes.size() - activeTypes.size())
                .lastUpdated(LocalDateTime.now())
                .build();
    }

    @Override
    @Transactional
    public void updateDisplayOrder(String factoryId, List<WorkTypeDTO.DisplayOrderUpdate> updates) {
        log.info("Updating display order for {} work types in factory: {}", updates.size(), factoryId);

        for (WorkTypeDTO.DisplayOrderUpdate update : updates) {
            WorkType workType = workTypeRepository.findById(update.getId())
                    .filter(w -> w.getFactoryId().equals(factoryId))
                    .orElseThrow(() -> new ResourceNotFoundException("工作类型不存在: " + update.getId()));

            workType.setDisplayOrder(update.getDisplayOrder());
            workTypeRepository.save(workType);
        }
    }

    /**
     * 获取默认工作类型列表
     */
    private List<WorkTypeDTO> getDefaultWorkTypes() {
        List<WorkTypeDTO> defaults = new ArrayList<>();

        defaults.add(WorkTypeDTO.builder()
                .name("农场作业")
                .code("FARMING")
                .description("农场日常作业，包括种植、收割等")
                .department("farming")
                .billingType("HOURLY")
                .baseRate(new BigDecimal("50.00"))
                .overtimeRateMultiplier(new BigDecimal("1.5"))
                .holidayRateMultiplier(new BigDecimal("2.0"))
                .nightShiftRateMultiplier(new BigDecimal("1.3"))
                .hazardLevel(1)
                .displayOrder(1)
                .color("#4CAF50")
                .icon("agriculture")
                .isDefault(true)
                .build());

        defaults.add(WorkTypeDTO.builder()
                .name("加工作业")
                .code("PROCESSING")
                .description("产品加工处理作业")
                .department("processing")
                .billingType("HOURLY")
                .baseRate(new BigDecimal("60.00"))
                .overtimeRateMultiplier(new BigDecimal("1.5"))
                .holidayRateMultiplier(new BigDecimal("2.0"))
                .nightShiftRateMultiplier(new BigDecimal("1.3"))
                .hazardLevel(2)
                .displayOrder(2)
                .color("#2196F3")
                .icon("precision_manufacturing")
                .isDefault(true)
                .build());

        defaults.add(WorkTypeDTO.builder()
                .name("物流运输")
                .code("LOGISTICS")
                .description("产品运输配送作业")
                .department("logistics")
                .billingType("PIECE")
                .baseRate(new BigDecimal("80.00"))
                .overtimeRateMultiplier(new BigDecimal("1.5"))
                .holidayRateMultiplier(new BigDecimal("2.0"))
                .nightShiftRateMultiplier(new BigDecimal("1.5"))
                .hazardLevel(1)
                .displayOrder(3)
                .color("#FF9800")
                .icon("local_shipping")
                .isDefault(true)
                .build());

        defaults.add(WorkTypeDTO.builder()
                .name("质检作业")
                .code("QUALITY")
                .description("产品质量检验作业")
                .department("quality")
                .billingType("HOURLY")
                .baseRate(new BigDecimal("70.00"))
                .overtimeRateMultiplier(new BigDecimal("1.5"))
                .holidayRateMultiplier(new BigDecimal("2.0"))
                .nightShiftRateMultiplier(new BigDecimal("1.2"))
                .hazardLevel(0)
                .displayOrder(4)
                .color("#9C27B0")
                .icon("verified_user")
                .isDefault(true)
                .build());

        defaults.add(WorkTypeDTO.builder()
                .name("管理工作")
                .code("MANAGEMENT")
                .description("行政管理工作")
                .department("management")
                .billingType("MONTHLY")
                .baseRate(new BigDecimal("8000.00"))
                .overtimeRateMultiplier(new BigDecimal("1.5"))
                .holidayRateMultiplier(new BigDecimal("2.0"))
                .nightShiftRateMultiplier(new BigDecimal("1.0"))
                .hazardLevel(0)
                .displayOrder(5)
                .color("#607D8B")
                .icon("business")
                .isDefault(true)
                .build());

        return defaults;
    }

    /**
     * 转换实体到DTO
     */
    private WorkTypeDTO convertToDTO(WorkType workType) {
        return WorkTypeDTO.builder()
                .id(workType.getId())
                .factoryId(workType.getFactoryId())
                .name(workType.getName())
                .code(workType.getCode())
                .description(workType.getDescription())
                .department(workType.getDepartment())
                .hourlyRate(workType.getHourlyRate())
                .billingType(workType.getBillingType())
                .baseRate(workType.getBaseRate())
                .overtimeRateMultiplier(workType.getOvertimeRateMultiplier())
                .holidayRateMultiplier(workType.getHolidayRateMultiplier())
                .nightShiftRateMultiplier(workType.getNightShiftRateMultiplier())
                .hazardLevel(workType.getHazardLevel())
                .certificationRequired(workType.getCertificationRequired())
                .requiredSkills(workType.getRequiredSkills())
                .isActive(workType.getIsActive())
                .isDefault(workType.getIsDefault())
                .displayOrder(workType.getDisplayOrder())
                .color(workType.getColor())
                .icon(workType.getIcon())
                .createdAt(workType.getCreatedAt())
                .updatedAt(workType.getUpdatedAt())
                .build();
    }
}

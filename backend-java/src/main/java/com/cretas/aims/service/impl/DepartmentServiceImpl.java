package com.cretas.aims.service.impl;

import com.cretas.aims.dto.DepartmentDTO;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.Department;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.EntityNotFoundException;
import com.cretas.aims.repository.DepartmentRepository;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.service.DepartmentService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 部门服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-19
 */
@Service
public class DepartmentServiceImpl implements DepartmentService {

    private static final Logger log = LoggerFactory.getLogger(DepartmentServiceImpl.class);

    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;

    // Manual constructor (Lombok @RequiredArgsConstructor not working)
    public DepartmentServiceImpl(DepartmentRepository departmentRepository, UserRepository userRepository) {
        this.departmentRepository = departmentRepository;
        this.userRepository = userRepository;
    }

    @Override
    @Transactional
    public DepartmentDTO createDepartment(String factoryId, DepartmentDTO dto) {
        log.info("创建部门: factoryId={}, name={}", factoryId, dto.getName());

        // 检查部门编码唯一性
        if (dto.getCode() != null && !dto.getCode().isEmpty()) {
            if (departmentRepository.existsByFactoryIdAndCode(factoryId, dto.getCode())) {
                throw new BusinessException("部门编码已存在: " + dto.getCode());
            }
        }

        Department department = new Department();
        department.setFactoryId(factoryId);
        department.setName(dto.getName());
        department.setCode(dto.getCode());
        department.setDescription(dto.getDescription());
        department.setManagerUserId(dto.getManagerUserId());
        department.setParentDepartmentId(dto.getParentDepartmentId());
        department.setIsActive(dto.getIsActive() != null ? dto.getIsActive() : true);
        department.setDisplayOrder(dto.getDisplayOrder() != null ? dto.getDisplayOrder() : 0);
        department.setColor(dto.getColor());
        department.setIcon(dto.getIcon());
        department.setCreatedAt(LocalDateTime.now());
        department.setUpdatedAt(LocalDateTime.now());

        department = departmentRepository.save(department);
        log.info("部门创建成功: id={}", department.getId());

        return convertToDTO(department);
    }

    @Override
    @Transactional
    public DepartmentDTO updateDepartment(String factoryId, Integer id, DepartmentDTO dto) {
        log.info("更新部门: factoryId={}, id={}", factoryId, id);

        Department department = departmentRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Department", String.valueOf(id)));

        if (!department.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权限操作此部门");
        }

        // 检查部门编码唯一性
        if (dto.getCode() != null && !dto.getCode().equals(department.getCode())) {
            if (departmentRepository.existsByFactoryIdAndCode(factoryId, dto.getCode())) {
                throw new BusinessException("部门编码已存在: " + dto.getCode());
            }
            department.setCode(dto.getCode());
        }

        // 更新其他字段
        if (dto.getName() != null) department.setName(dto.getName());
        if (dto.getDescription() != null) department.setDescription(dto.getDescription());
        if (dto.getManagerUserId() != null) department.setManagerUserId(dto.getManagerUserId());
        if (dto.getParentDepartmentId() != null) department.setParentDepartmentId(dto.getParentDepartmentId());
        if (dto.getIsActive() != null) department.setIsActive(dto.getIsActive());
        if (dto.getDisplayOrder() != null) department.setDisplayOrder(dto.getDisplayOrder());
        if (dto.getColor() != null) department.setColor(dto.getColor());
        if (dto.getIcon() != null) department.setIcon(dto.getIcon());

        department.setUpdatedAt(LocalDateTime.now());
        department = departmentRepository.save(department);

        log.info("部门更新成功: id={}", id);
        return convertToDTO(department);
    }

    @Override
    @Transactional
    public void deleteDepartment(String factoryId, Integer id) {
        log.info("删除部门: factoryId={}, id={}", factoryId, id);

        Department department = departmentRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Department", String.valueOf(id)));

        if (!department.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权限操作此部门");
        }

        // 检查是否有子部门
        List<Department> childDepartments = departmentRepository.findByFactoryIdAndParentDepartmentId(factoryId, id);
        if (!childDepartments.isEmpty()) {
            throw new BusinessException("该部门下有子部门，无法删除");
        }

        // 检查是否有员工
        long employeeCount = userRepository.countByFactoryIdAndDepartment(factoryId, department.getName());
        if (employeeCount > 0) {
            throw new BusinessException("该部门下有员工，无法删除");
        }

        departmentRepository.delete(department);
        log.info("部门删除成功: id={}", id);
    }

    @Override
    public DepartmentDTO getDepartmentById(String factoryId, Integer id) {
        log.debug("获取部门详情: factoryId={}, id={}", factoryId, id);

        Department department = departmentRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Department", String.valueOf(id)));

        if (!department.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权限查看此部门");
        }

        return convertToDTO(department);
    }

    @Override
    public PageResponse<DepartmentDTO> getDepartments(String factoryId, Pageable pageable) {
        log.debug("获取部门列表: factoryId={}, page={}, size={}",
                factoryId, pageable.getPageNumber(), pageable.getPageSize());

        Page<Department> page = departmentRepository.findByFactoryId(factoryId, pageable);
        List<DepartmentDTO> dtos = page.getContent().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());

        return PageResponse.of(
                dtos,
                pageable.getPageNumber() + 1, // Spring Data使用0-based，前端使用1-based
                pageable.getPageSize(),
                page.getTotalElements()
        );
    }

    @Override
    public List<DepartmentDTO> getAllActiveDepartments(String factoryId) {
        log.debug("获取活跃部门: factoryId={}", factoryId);

        List<Department> departments = departmentRepository.findByFactoryIdAndIsActive(factoryId, true);
        return departments.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public PageResponse<DepartmentDTO> searchDepartments(String factoryId, String keyword, Pageable pageable) {
        log.debug("搜索部门: factoryId={}, keyword={}", factoryId, keyword);

        Page<Department> page = departmentRepository.searchDepartments(factoryId, keyword, pageable);
        List<DepartmentDTO> dtos = page.getContent().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());

        return PageResponse.of(
                dtos,
                pageable.getPageNumber() + 1,
                pageable.getPageSize(),
                page.getTotalElements()
        );
    }

    @Override
    public List<DepartmentDTO> getDepartmentTree(String factoryId) {
        log.debug("获取部门树: factoryId={}", factoryId);

        List<Department> allDepartments = departmentRepository.findByFactoryId(factoryId);

        // 构建树形结构（顶级部门）
        return allDepartments.stream()
                .filter(d -> d.getParentDepartmentId() == null)
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public boolean checkCodeExists(String factoryId, String code, Integer excludeId) {
        log.debug("检查部门编码: factoryId={}, code={}, excludeId={}", factoryId, code, excludeId);

        if (excludeId != null) {
            Department existing = departmentRepository.findByFactoryIdAndCode(factoryId, code).orElse(null);
            return existing != null && !existing.getId().equals(excludeId);
        }

        return departmentRepository.existsByFactoryIdAndCode(factoryId, code);
    }

    @Override
    @Transactional
    public void initializeDefaultDepartments(String factoryId) {
        log.info("初始化默认部门: factoryId={}", factoryId);

        // 检查是否已有部门
        long count = departmentRepository.countByFactoryId(factoryId);
        if (count > 0) {
            log.info("工厂已有部门，跳过初始化: count={}", count);
            return;
        }

        // 基于Department枚举创建默认部门
        List<Department> defaultDepartments = Arrays.asList(
                createDefaultDepartment(factoryId, "FARMING", "养殖部门", "负责原料养殖和采购", "#4CAF50", 1),
                createDefaultDepartment(factoryId, "PROCESSING", "加工部门", "负责产品加工生产", "#2196F3", 2),
                createDefaultDepartment(factoryId, "LOGISTICS", "物流部门", "负责运输和配送", "#FF9800", 3),
                createDefaultDepartment(factoryId, "QUALITY", "质量部门", "负责质量控制和检验", "#F44336", 4),
                createDefaultDepartment(factoryId, "MANAGEMENT", "管理部门", "负责企业管理和运营", "#9C27B0", 5)
        );

        departmentRepository.saveAll(defaultDepartments);
        log.info("默认部门初始化成功: count={}", defaultDepartments.size());
    }

    @Override
    @Transactional
    public void updateDepartmentsStatus(String factoryId, List<Integer> ids, Boolean isActive) {
        log.info("批量更新部门状态: factoryId={}, ids={}, isActive={}", factoryId, ids, isActive);

        for (Integer id : ids) {
            Department department = departmentRepository.findById(id)
                    .orElseThrow(() -> new EntityNotFoundException("Department", String.valueOf(id)));

            if (!department.getFactoryId().equals(factoryId)) {
                throw new BusinessException("无权限操作部门: " + id);
            }

            department.setIsActive(isActive);
            department.setUpdatedAt(LocalDateTime.now());
            departmentRepository.save(department);
        }

        log.info("批量更新部门状态成功: count={}", ids.size());
    }

    // ========== 私有辅助方法 ==========

    /**
     * 创建默认部门
     */
    private Department createDefaultDepartment(String factoryId, String code, String name,
                                               String description, String color, Integer displayOrder) {
        Department department = new Department();
        department.setFactoryId(factoryId);
        department.setCode(code);
        department.setName(name);
        department.setDescription(description);
        department.setColor(color);
        department.setIsActive(true);
        department.setDisplayOrder(displayOrder);
        department.setCreatedAt(LocalDateTime.now());
        department.setUpdatedAt(LocalDateTime.now());
        return department;
    }

    /**
     * Entity转DTO
     */
    private DepartmentDTO convertToDTO(Department department) {
        DepartmentDTO dto = DepartmentDTO.builder()
                .id(department.getId())
                .factoryId(department.getFactoryId())
                .name(department.getName())
                .code(department.getCode())
                .description(department.getDescription())
                .managerUserId(department.getManagerUserId())
                .parentDepartmentId(department.getParentDepartmentId())
                .isActive(department.getIsActive())
                .displayOrder(department.getDisplayOrder())
                .color(department.getColor())
                .icon(department.getIcon())
                .createdBy(null) // BaseEntity doesn't have createdBy field
                .createdAt(department.getCreatedAt())
                .updatedAt(department.getUpdatedAt())
                .build();

        // 查询负责人姓名（如果有）
        if (department.getManagerUserId() != null) {
            userRepository.findById(department.getManagerUserId()).ifPresent(user -> {
                dto.setManagerName(user.getFullName());
            });
        }

        // 查询父部门名称（如果有）
        if (department.getParentDepartmentId() != null) {
            departmentRepository.findById(department.getParentDepartmentId()).ifPresent(parent -> {
                dto.setParentDepartmentName(parent.getName());
            });
        }

        // 统计部门员工数量
        Long employeeCount = userRepository.countByFactoryIdAndDepartment(
                department.getFactoryId(), department.getName());
        dto.setEmployeeCount(employeeCount);

        return dto;
    }
}

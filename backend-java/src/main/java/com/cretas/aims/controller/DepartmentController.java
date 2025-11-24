package com.cretas.aims.controller;

import com.cretas.aims.dto.DepartmentDTO;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.service.DepartmentService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;
import java.util.Map;

/**
 * 部门管理控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-19
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/departments")
@Tag(name = "部门管理", description = "部门管理相关接口")
public class DepartmentController {

    private static final Logger log = LoggerFactory.getLogger(DepartmentController.class);

    private final DepartmentService departmentService;

    // Manual constructor (Lombok @RequiredArgsConstructor not working)
    public DepartmentController(DepartmentService departmentService) {
        this.departmentService = departmentService;
    }

    /**
     * 创建部门
     */
    @PostMapping
    @Operation(summary = "创建部门")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ApiResponse<DepartmentDTO> createDepartment(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Valid DepartmentDTO dto) {
        log.info("创建部门: factoryId={}, name={}", factoryId, dto.getName());
        DepartmentDTO result = departmentService.createDepartment(factoryId, dto);
        return ApiResponse.success(result);
    }

    /**
     * 分页查询部门列表
     */
    @GetMapping
    @Operation(summary = "获取部门列表")
    public ApiResponse<PageResponse<DepartmentDTO>> getDepartments(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码（1-based）") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小") Integer size,
            @RequestParam(defaultValue = "displayOrder") @Parameter(description = "排序字段") String sortBy,
            @RequestParam(defaultValue = "ASC") @Parameter(description = "排序方向") String sortDirection) {

        log.debug("获取部门列表: factoryId={}, page={}, size={}", factoryId, page, size);

        Sort.Direction direction = "ASC".equalsIgnoreCase(sortDirection) ?
                Sort.Direction.ASC : Sort.Direction.DESC;
        // 将1-based页码转换为0-based（Spring Data JPA使用0-based）
        Pageable pageable = PageRequest.of(page - 1, size, Sort.by(direction, sortBy));

        PageResponse<DepartmentDTO> response = departmentService.getDepartments(factoryId, pageable);
        return ApiResponse.success(response);
    }

    /**
     * 获取所有活跃部门
     */
    @GetMapping("/active")
    @Operation(summary = "获取所有活跃部门")
    public ApiResponse<List<DepartmentDTO>> getAllActiveDepartments(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.debug("获取活跃部门: factoryId={}", factoryId);
        List<DepartmentDTO> departments = departmentService.getAllActiveDepartments(factoryId);
        return ApiResponse.success(departments);
    }

    /**
     * 获取部门详情
     */
    @GetMapping("/{id}")
    @Operation(summary = "获取部门详情")
    public ApiResponse<DepartmentDTO> getDepartmentById(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "部门ID") Integer id) {
        log.debug("获取部门详情: factoryId={}, id={}", factoryId, id);
        DepartmentDTO department = departmentService.getDepartmentById(factoryId, id);
        return ApiResponse.success(department);
    }

    /**
     * 更新部门
     */
    @PutMapping("/{id}")
    @Operation(summary = "更新部门")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ApiResponse<DepartmentDTO> updateDepartment(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "部门ID") Integer id,
            @RequestBody @Valid DepartmentDTO dto) {
        log.info("更新部门: factoryId={}, id={}", factoryId, id);
        DepartmentDTO result = departmentService.updateDepartment(factoryId, id, dto);
        return ApiResponse.success(result);
    }

    /**
     * 删除部门
     */
    @DeleteMapping("/{id}")
    @Operation(summary = "删除部门")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ApiResponse<Void> deleteDepartment(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "部门ID") Integer id) {
        log.info("删除部门: factoryId={}, id={}", factoryId, id);
        departmentService.deleteDepartment(factoryId, id);
        return ApiResponse.success(null);
    }

    /**
     * 搜索部门
     */
    @GetMapping("/search")
    @Operation(summary = "搜索部门")
    public ApiResponse<PageResponse<DepartmentDTO>> searchDepartments(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "搜索关键词") String keyword,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码（1-based）") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小") Integer size) {

        log.debug("搜索部门: factoryId={}, keyword={}", factoryId, keyword);

        // 将1-based页码转换为0-based（Spring Data JPA使用0-based）
        Pageable pageable = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.ASC, "displayOrder"));
        PageResponse<DepartmentDTO> response = departmentService.searchDepartments(factoryId, keyword, pageable);
        return ApiResponse.success(response);
    }

    /**
     * 获取部门树形结构
     */
    @GetMapping("/tree")
    @Operation(summary = "获取部门树形结构")
    public ApiResponse<List<DepartmentDTO>> getDepartmentTree(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.debug("获取部门树: factoryId={}", factoryId);
        List<DepartmentDTO> tree = departmentService.getDepartmentTree(factoryId);
        return ApiResponse.success(tree);
    }

    /**
     * 检查部门编码是否存在
     */
    @GetMapping("/check-code")
    @Operation(summary = "检查部门编码是否存在")
    public ApiResponse<Map<String, Boolean>> checkCodeExists(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "部门编码") String code,
            @RequestParam(required = false) @Parameter(description = "排除的部门ID") Integer excludeId) {

        log.debug("检查部门编码: factoryId={}, code={}", factoryId, code);
        boolean exists = departmentService.checkCodeExists(factoryId, code, excludeId);
        return ApiResponse.success(Map.of("exists", exists));
    }

    /**
     * 初始化默认部门
     */
    @PostMapping("/initialize")
    @Operation(summary = "初始化默认部门")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ApiResponse<Void> initializeDefaultDepartments(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.info("初始化默认部门: factoryId={}", factoryId);
        departmentService.initializeDefaultDepartments(factoryId);
        return ApiResponse.success(null);
    }

    /**
     * 批量更新部门状态
     */
    @PutMapping("/batch-status")
    @Operation(summary = "批量更新部门状态")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ApiResponse<Void> updateDepartmentsStatus(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Parameter(description = "请求体") Map<String, Object> request) {

        @SuppressWarnings("unchecked")
        List<Integer> ids = (List<Integer>) request.get("ids");
        Boolean isActive = (Boolean) request.get("isActive");

        log.info("批量更新部门状态: factoryId={}, ids={}, isActive={}", factoryId, ids, isActive);
        departmentService.updateDepartmentsStatus(factoryId, ids, isActive);
        return ApiResponse.success(null);
    }
}

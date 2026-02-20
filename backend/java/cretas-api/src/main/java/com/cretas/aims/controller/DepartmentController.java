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
@Tag(name = "部门管理", description = "部门管理相关接口，包括部门的创建、查询、更新、删除，部门树形结构查询、搜索、批量状态管理、默认部门初始化等功能")
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
    @Operation(summary = "创建部门", description = "创建新的部门，需要管理员权限。部门编码必须唯一，可设置上级部门形成层级结构")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ApiResponse<DepartmentDTO> createDepartment(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable String factoryId,
            @Parameter(description = "部门信息，包含名称、编码、上级部门等")
            @RequestBody @Valid DepartmentDTO dto) {
        log.info("创建部门: factoryId={}, name={}", factoryId, dto.getName());
        DepartmentDTO result = departmentService.createDepartment(factoryId, dto);
        return ApiResponse.success(result);
    }

    /**
     * 分页查询部门列表
     */
    @GetMapping
    @Operation(summary = "获取部门列表", description = "分页查询工厂下的所有部门，支持自定义排序。默认按显示顺序升序排列")
    public ApiResponse<PageResponse<DepartmentDTO>> getDepartments(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable String factoryId,
            @Parameter(description = "页码（1-based）", example = "1")
            @RequestParam(defaultValue = "1") Integer page,
            @Parameter(description = "每页大小", example = "20")
            @RequestParam(defaultValue = "20") Integer size,
            @Parameter(description = "排序字段: displayOrder/name/code/createdAt", example = "displayOrder")
            @RequestParam(defaultValue = "displayOrder") String sortBy,
            @Parameter(description = "排序方向: ASC/DESC", example = "ASC")
            @RequestParam(defaultValue = "ASC") String sortDirection) {

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
    @Operation(summary = "获取所有活跃部门", description = "获取工厂下所有启用状态的部门列表，常用于下拉选择框数据源")
    public ApiResponse<List<DepartmentDTO>> getAllActiveDepartments(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable String factoryId) {
        log.debug("获取活跃部门: factoryId={}", factoryId);
        List<DepartmentDTO> departments = departmentService.getAllActiveDepartments(factoryId);
        return ApiResponse.success(departments);
    }

    /**
     * 获取部门详情
     */
    @GetMapping("/{id}")
    @Operation(summary = "获取部门详情", description = "根据部门ID获取部门的详细信息，包含上级部门、员工数量等")
    public ApiResponse<DepartmentDTO> getDepartmentById(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable String factoryId,
            @Parameter(description = "部门ID", example = "1", required = true)
            @PathVariable Integer id) {
        log.debug("获取部门详情: factoryId={}, id={}", factoryId, id);
        DepartmentDTO department = departmentService.getDepartmentById(factoryId, id);
        return ApiResponse.success(department);
    }

    /**
     * 更新部门
     */
    @PutMapping("/{id}")
    @Operation(summary = "更新部门", description = "更新部门信息，需要管理员权限。可修改名称、编码、上级部门、排序等属性")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ApiResponse<DepartmentDTO> updateDepartment(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable String factoryId,
            @Parameter(description = "部门ID", example = "1", required = true)
            @PathVariable Integer id,
            @Parameter(description = "更新的部门信息")
            @RequestBody @Valid DepartmentDTO dto) {
        log.info("更新部门: factoryId={}, id={}", factoryId, id);
        DepartmentDTO result = departmentService.updateDepartment(factoryId, id, dto);
        return ApiResponse.success(result);
    }

    /**
     * 删除部门
     */
    @DeleteMapping("/{id}")
    @Operation(summary = "删除部门", description = "删除指定部门，需要管理员权限。如果部门下有员工或子部门，删除将失败")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ApiResponse<Void> deleteDepartment(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable String factoryId,
            @Parameter(description = "部门ID", example = "1", required = true)
            @PathVariable Integer id) {
        log.info("删除部门: factoryId={}, id={}", factoryId, id);
        departmentService.deleteDepartment(factoryId, id);
        return ApiResponse.success(null);
    }

    /**
     * 搜索部门
     */
    @GetMapping("/search")
    @Operation(summary = "搜索部门", description = "根据关键词搜索部门，支持按部门名称和编码模糊匹配")
    public ApiResponse<PageResponse<DepartmentDTO>> searchDepartments(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable String factoryId,
            @Parameter(description = "搜索关键词，匹配部门名称或编码", example = "生产", required = true)
            @RequestParam String keyword,
            @Parameter(description = "页码（1-based）", example = "1")
            @RequestParam(defaultValue = "1") Integer page,
            @Parameter(description = "每页大小", example = "20")
            @RequestParam(defaultValue = "20") Integer size) {

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
    @Operation(summary = "获取部门树形结构", description = "获取工厂下所有部门的层级树形结构，包含父子关系")
    public ApiResponse<List<DepartmentDTO>> getDepartmentTree(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable String factoryId) {
        log.debug("获取部门树: factoryId={}", factoryId);
        List<DepartmentDTO> tree = departmentService.getDepartmentTree(factoryId);
        return ApiResponse.success(tree);
    }

    /**
     * 检查部门编码是否存在
     */
    @GetMapping("/check-code")
    @Operation(summary = "检查部门编码是否存在", description = "验证部门编码在工厂内是否唯一，用于创建或编辑部门时的前端校验")
    public ApiResponse<Map<String, Boolean>> checkCodeExists(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable String factoryId,
            @Parameter(description = "部门编码", example = "DEPT-001", required = true)
            @RequestParam String code,
            @Parameter(description = "排除的部门ID（编辑时排除自身）", example = "1")
            @RequestParam(required = false) Integer excludeId) {

        log.debug("检查部门编码: factoryId={}, code={}", factoryId, code);
        boolean exists = departmentService.checkCodeExists(factoryId, code, excludeId);
        return ApiResponse.success(Map.of("exists", exists));
    }

    /**
     * 初始化默认部门
     */
    @PostMapping("/initialize")
    @Operation(summary = "初始化默认部门", description = "为新工厂初始化默认的部门结构，包含生产、质检、仓储等基础部门。需要管理员权限")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ApiResponse<Void> initializeDefaultDepartments(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable String factoryId) {
        log.info("初始化默认部门: factoryId={}", factoryId);
        departmentService.initializeDefaultDepartments(factoryId);
        return ApiResponse.success(null);
    }

    /**
     * 批量更新部门状态
     */
    @PutMapping("/batch-status")
    @Operation(summary = "批量更新部门状态", description = "批量启用或禁用多个部门，需要管理员权限。请求体需包含 ids (部门ID数组) 和 isActive (目标状态)")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ApiResponse<Void> updateDepartmentsStatus(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable String factoryId,
            @Parameter(description = "请求体: {ids: [1,2,3], isActive: true}")
            @RequestBody Map<String, Object> request) {

        @SuppressWarnings("unchecked")
        List<Integer> ids = (List<Integer>) request.get("ids");
        Boolean isActive = (Boolean) request.get("isActive");

        log.info("批量更新部门状态: factoryId={}, ids={}, isActive={}", factoryId, ids, isActive);
        departmentService.updateDepartmentsStatus(factoryId, ids, isActive);
        return ApiResponse.success(null);
    }
}

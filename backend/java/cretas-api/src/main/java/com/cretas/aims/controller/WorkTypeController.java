package com.cretas.aims.controller;

import com.cretas.aims.dto.WorkTypeDTO;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.service.WorkTypeService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

/**
 * 工作类型管理控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/work-types")
@Tag(name = "工作类型管理", description = "工作类型管理相关接口，包括工作类型的创建、查询、更新、删除，状态切换、默认类型初始化、显示顺序调整、工作类型统计等功能")
@RequiredArgsConstructor
public class WorkTypeController {

    private final WorkTypeService workTypeService;

    @PostMapping
    @Operation(summary = "创建工作类型", description = "创建新的工作类型，包含名称、编码、颜色、计件规则等配置信息")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ApiResponse<WorkTypeDTO> createWorkType(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Valid WorkTypeDTO dto) {
        log.info("Creating work type for factory: {}", factoryId);
        WorkTypeDTO result = workTypeService.createWorkType(factoryId, dto);
        return ApiResponse.success(result);
    }

    @GetMapping
    @Operation(summary = "获取工作类型列表", description = "分页获取工作类型列表，支持按指定字段排序")
    public ApiResponse<PageResponse<WorkTypeDTO>> getWorkTypes(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码", example = "1") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小", example = "20") Integer size,
            @RequestParam(defaultValue = "displayOrder") @Parameter(description = "排序字段", example = "displayOrder") String sortBy,
            @RequestParam(defaultValue = "ASC") @Parameter(description = "排序方向", example = "ASC") String sortDirection) {

        log.debug("Getting work types for factory: {}", factoryId);

        Sort.Direction direction = "ASC".equalsIgnoreCase(sortDirection) ?
                Sort.Direction.ASC : Sort.Direction.DESC;
        // 前端使用1-based索引，Spring Data使用0-based索引，需要减1
        Pageable pageable = PageRequest.of(Math.max(0, page - 1), size, Sort.by(direction, sortBy));

        PageResponse<WorkTypeDTO> response = workTypeService.getWorkTypes(factoryId, pageable);
        return ApiResponse.success(response);
    }

    @GetMapping("/active")
    @Operation(summary = "获取所有活跃的工作类型", description = "获取所有状态为活跃的工作类型，用于下拉选择等场景")
    public ApiResponse<List<WorkTypeDTO>> getAllActiveWorkTypes(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        log.debug("Getting all active work types for factory: {}", factoryId);
        List<WorkTypeDTO> workTypes = workTypeService.getAllActiveWorkTypes(factoryId);
        return ApiResponse.success(workTypes);
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取工作类型详情", description = "根据ID获取单个工作类型的详细信息")
    public ApiResponse<WorkTypeDTO> getWorkTypeById(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "工作类型ID", example = "WT001") String id) {
        log.debug("Getting work type: {} for factory: {}", id, factoryId);
        WorkTypeDTO workType = workTypeService.getWorkTypeById(factoryId, id);
        return ApiResponse.success(workType);
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新工作类型", description = "更新工作类型的配置信息，包括名称、编码、颜色、计件规则等")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ApiResponse<WorkTypeDTO> updateWorkType(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "工作类型ID", example = "WT001") String id,
            @RequestBody @Valid WorkTypeDTO dto) {
        log.info("Updating work type: {} for factory: {}", id, factoryId);
        WorkTypeDTO result = workTypeService.updateWorkType(factoryId, id, dto);
        return ApiResponse.success(result);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除工作类型", description = "删除指定的工作类型，仅管理员可操作")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> deleteWorkType(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "工作类型ID", example = "WT001") String id) {
        log.info("Deleting work type: {} for factory: {}", id, factoryId);
        workTypeService.deleteWorkType(factoryId, id);
        return ApiResponse.success();
    }

    @PutMapping("/{id}/toggle-status")
    @Operation(summary = "切换工作类型状态", description = "切换工作类型的启用/禁用状态")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ApiResponse<WorkTypeDTO> toggleWorkTypeStatus(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "工作类型ID", example = "WT001") String id) {
        log.info("Toggling work type status: {} for factory: {}", id, factoryId);
        WorkTypeDTO result = workTypeService.toggleWorkTypeStatus(factoryId, id);
        return ApiResponse.success(result);
    }

    @PostMapping("/initialize-defaults")
    @Operation(summary = "初始化默认工作类型", description = "为工厂初始化一套默认的工作类型配置，仅管理员可操作")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> initializeDefaultWorkTypes(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        log.info("Initializing default work types for factory: {}", factoryId);
        workTypeService.initializeDefaultWorkTypes(factoryId);
        return ApiResponse.success();
    }

    @GetMapping("/stats")
    @Operation(summary = "获取工作类型统计信息", description = "获取工作类型的统计数据，包括总数、活跃数、禁用数等")
    public ApiResponse<WorkTypeDTO.WorkTypeStats> getWorkTypeStats(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        log.debug("Getting work type stats for factory: {}", factoryId);
        WorkTypeDTO.WorkTypeStats stats = workTypeService.getWorkTypeStats(factoryId);
        return ApiResponse.success(stats);
    }

    @PutMapping("/display-order")
    @Operation(summary = "更新显示顺序", description = "批量更新工作类型的显示顺序")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ApiResponse<Void> updateDisplayOrder(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Valid List<WorkTypeDTO.DisplayOrderUpdate> updates) {
        log.info("Updating display order for {} work types in factory: {}", updates.size(), factoryId);
        workTypeService.updateDisplayOrder(factoryId, updates);
        return ApiResponse.success();
    }
}
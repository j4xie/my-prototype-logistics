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
@Tag(name = "工作类型管理", description = "工作类型管理相关接口")
@RequiredArgsConstructor
public class WorkTypeController {

    private final WorkTypeService workTypeService;

    @PostMapping
    @Operation(summary = "创建工作类型")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ApiResponse<WorkTypeDTO> createWorkType(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Valid WorkTypeDTO dto) {
        log.info("Creating work type for factory: {}", factoryId);
        WorkTypeDTO result = workTypeService.createWorkType(factoryId, dto);
        return ApiResponse.success(result);
    }

    @GetMapping
    @Operation(summary = "获取工作类型列表")
    public ApiResponse<PageResponse<WorkTypeDTO>> getWorkTypes(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(defaultValue = "0") @Parameter(description = "页码") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小") Integer size,
            @RequestParam(defaultValue = "displayOrder") @Parameter(description = "排序字段") String sortBy,
            @RequestParam(defaultValue = "ASC") @Parameter(description = "排序方向") String sortDirection) {

        log.debug("Getting work types for factory: {}", factoryId);

        Sort.Direction direction = "ASC".equalsIgnoreCase(sortDirection) ?
                Sort.Direction.ASC : Sort.Direction.DESC;
        // 前端使用1-based索引，Spring Data使用0-based索引，需要减1
        Pageable pageable = PageRequest.of(Math.max(0, page - 1), size, Sort.by(direction, sortBy));

        PageResponse<WorkTypeDTO> response = workTypeService.getWorkTypes(factoryId, pageable);
        return ApiResponse.success(response);
    }

    @GetMapping("/active")
    @Operation(summary = "获取所有活跃的工作类型")
    public ApiResponse<List<WorkTypeDTO>> getAllActiveWorkTypes(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.debug("Getting all active work types for factory: {}", factoryId);
        List<WorkTypeDTO> workTypes = workTypeService.getAllActiveWorkTypes(factoryId);
        return ApiResponse.success(workTypes);
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取工作类型详情")
    public ApiResponse<WorkTypeDTO> getWorkTypeById(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "工作类型ID") String id) {
        log.debug("Getting work type: {} for factory: {}", id, factoryId);
        WorkTypeDTO workType = workTypeService.getWorkTypeById(factoryId, id);
        return ApiResponse.success(workType);
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新工作类型")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ApiResponse<WorkTypeDTO> updateWorkType(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "工作类型ID") String id,
            @RequestBody @Valid WorkTypeDTO dto) {
        log.info("Updating work type: {} for factory: {}", id, factoryId);
        WorkTypeDTO result = workTypeService.updateWorkType(factoryId, id, dto);
        return ApiResponse.success(result);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除工作类型")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> deleteWorkType(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "工作类型ID") String id) {
        log.info("Deleting work type: {} for factory: {}", id, factoryId);
        workTypeService.deleteWorkType(factoryId, id);
        return ApiResponse.success();
    }

    @PutMapping("/{id}/toggle-status")
    @Operation(summary = "切换工作类型状态")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ApiResponse<WorkTypeDTO> toggleWorkTypeStatus(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "工作类型ID") String id) {
        log.info("Toggling work type status: {} for factory: {}", id, factoryId);
        WorkTypeDTO result = workTypeService.toggleWorkTypeStatus(factoryId, id);
        return ApiResponse.success(result);
    }

    @PostMapping("/initialize-defaults")
    @Operation(summary = "初始化默认工作类型")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> initializeDefaultWorkTypes(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.info("Initializing default work types for factory: {}", factoryId);
        workTypeService.initializeDefaultWorkTypes(factoryId);
        return ApiResponse.success();
    }

    @GetMapping("/stats")
    @Operation(summary = "获取工作类型统计信息")
    public ApiResponse<WorkTypeDTO.WorkTypeStats> getWorkTypeStats(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.debug("Getting work type stats for factory: {}", factoryId);
        WorkTypeDTO.WorkTypeStats stats = workTypeService.getWorkTypeStats(factoryId);
        return ApiResponse.success(stats);
    }

    @PutMapping("/display-order")
    @Operation(summary = "更新显示顺序")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ApiResponse<Void> updateDisplayOrder(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Valid List<WorkTypeDTO.DisplayOrderUpdate> updates) {
        log.info("Updating display order for {} work types in factory: {}", updates.size(), factoryId);
        workTypeService.updateDisplayOrder(factoryId, updates);
        return ApiResponse.success();
    }
}
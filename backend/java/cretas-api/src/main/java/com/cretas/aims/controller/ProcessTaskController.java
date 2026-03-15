package com.cretas.aims.controller;

import com.cretas.aims.dto.ProcessTaskDTO;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.service.ProcessTaskService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/process-tasks")
@Tag(name = "工序任务管理", description = "PROCESS模式的工序任务调度管理")
@RequiredArgsConstructor
public class ProcessTaskController {

    private final ProcessTaskService processTaskService;

    @PostMapping
    @Operation(summary = "创建工序任务")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ApiResponse<ProcessTaskDTO> create(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Valid ProcessTaskDTO dto) {
        log.info("Creating process task for factory: {}", factoryId);
        return ApiResponse.success(processTaskService.create(factoryId, dto));
    }

    @GetMapping("/active")
    @Operation(summary = "获取活跃工序任务(PENDING/IN_PROGRESS/SUPPLEMENTING)")
    public ApiResponse<List<ProcessTaskDTO>> getActiveTasks(
            @PathVariable String factoryId) {
        return ApiResponse.success(processTaskService.getActiveTasks(factoryId));
    }

    @GetMapping
    @Operation(summary = "工序任务列表(分页，可按状态/产品筛选)")
    public ApiResponse<PageResponse<ProcessTaskDTO>> list(
            @PathVariable String factoryId,
            @RequestParam(required = false) @Parameter(description = "状态筛选") String status,
            @RequestParam(required = false) @Parameter(description = "产品类型ID筛选") String productTypeId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "20") Integer size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "DESC") String sortDirection) {
        Sort.Direction direction = "ASC".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(Math.max(0, page - 1), size, Sort.by(direction, sortBy));
        return ApiResponse.success(processTaskService.list(factoryId, status, productTypeId, pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "工序任务详情")
    public ApiResponse<ProcessTaskDTO> getById(
            @PathVariable String factoryId,
            @PathVariable String id) {
        return ApiResponse.success(processTaskService.getById(factoryId, id));
    }

    @PutMapping("/{id}/status")
    @Operation(summary = "更新任务状态")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ApiResponse<ProcessTaskDTO> updateStatus(
            @PathVariable String factoryId,
            @PathVariable String id,
            @RequestBody @Valid ProcessTaskDTO.StatusUpdateRequest request) {
        return ApiResponse.success(processTaskService.updateStatus(factoryId, id, request));
    }

    @PutMapping("/{id}/close")
    @Operation(summary = "关闭任务")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ApiResponse<ProcessTaskDTO> closeTask(
            @PathVariable String factoryId,
            @PathVariable String id,
            @RequestParam(required = false) String notes) {
        return ApiResponse.success(processTaskService.closeTask(factoryId, id, notes));
    }

    @PostMapping("/generate-from-product")
    @Operation(summary = "根据产品工序配置批量生成任务")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ApiResponse<List<ProcessTaskDTO>> generateFromProduct(
            @PathVariable String factoryId,
            @RequestBody Map<String, Object> body) {
        Long createdBy = body.containsKey("createdBy") ? Long.valueOf(body.get("createdBy").toString()) : 0L;
        String productTypeId = (String) body.get("productTypeId");
        String sourceCustomerName = (String) body.getOrDefault("sourceCustomerName", null);

        // Parse plannedQuantities: { "wp-001": 100, "wp-002": 200 }
        Map<String, BigDecimal> plannedQuantities = new java.util.HashMap<>();
        try {
            Object raw = body.get("plannedQuantities");
            if (raw instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> rawMap = (Map<String, Object>) raw;
                rawMap.forEach((k, v) -> plannedQuantities.put(k, new BigDecimal(v.toString())));
            }
        } catch (Exception e) {
            log.warn("Failed to parse plannedQuantities, using defaults: {}", e.getMessage());
        }

        return ApiResponse.success(processTaskService.generateFromProduct(
                factoryId, productTypeId, plannedQuantities, sourceCustomerName, createdBy));
    }

    @GetMapping("/{id}/summary")
    @Operation(summary = "任务汇总(三级累计)")
    public ApiResponse<ProcessTaskDTO.TaskSummary> getTaskSummary(
            @PathVariable String factoryId,
            @PathVariable String id) {
        return ApiResponse.success(processTaskService.getTaskSummary(factoryId, id));
    }

    @GetMapping("/run/{productionRunId}")
    @Operation(summary = "生产运行实例总览")
    public ApiResponse<ProcessTaskDTO.RunOverview> getRunOverview(
            @PathVariable String factoryId,
            @PathVariable String productionRunId) {
        return ApiResponse.success(processTaskService.getRunOverview(factoryId, productionRunId));
    }
}

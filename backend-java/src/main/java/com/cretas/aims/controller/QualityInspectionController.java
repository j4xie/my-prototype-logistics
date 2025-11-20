package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.QualityInspection;
import com.cretas.aims.service.QualityInspectionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;

/**
 * 质量检验控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-19
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/quality-inspections")
@RequiredArgsConstructor
@Tag(name = "质量检验管理")
public class QualityInspectionController {

    private final QualityInspectionService qualityInspectionService;

    /**
     * 获取质量检验记录列表
     */
    @GetMapping
    @Operation(summary = "获取质量检验记录列表", description = "分页获取质量检验记录")
    public ApiResponse<PageResponse<QualityInspection>> getInspections(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @Parameter(description = "生产批次ID") String productionBatchId,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小") Integer size) {

        log.info("获取质量检验记录列表: factoryId={}, productionBatchId={}, page={}, size={}",
                factoryId, productionBatchId, page, size);

        PageRequest pageRequest = new PageRequest();
        pageRequest.setPage(page);
        pageRequest.setSize(size);

        PageResponse<QualityInspection> result = qualityInspectionService.getInspections(
                factoryId, productionBatchId, pageRequest);

        return ApiResponse.success(result);
    }

    /**
     * 获取质量检验记录详情
     */
    @GetMapping("/{inspectionId}")
    @Operation(summary = "获取质量检验记录详情", description = "根据ID获取质量检验记录详情")
    public ApiResponse<QualityInspection> getInspectionById(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "检验记录ID") String inspectionId) {

        log.info("获取质量检验记录详情: factoryId={}, inspectionId={}", factoryId, inspectionId);

        QualityInspection inspection = qualityInspectionService.getInspectionById(factoryId, inspectionId);

        return ApiResponse.success(inspection);
    }

    /**
     * 创建质量检验记录
     */
    @PostMapping
    @Operation(summary = "创建质量检验记录", description = "创建新的质量检验记录")
    public ApiResponse<QualityInspection> createInspection(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @Valid @RequestBody @Parameter(description = "质量检验记录") QualityInspection inspection) {

        log.info("创建质量检验记录: factoryId={}, productionBatchId={}",
                factoryId, inspection.getProductionBatchId());

        QualityInspection created = qualityInspectionService.createInspection(factoryId, inspection);

        return ApiResponse.success(created);
    }

    /**
     * 更新质量检验记录
     */
    @PutMapping("/{inspectionId}")
    @Operation(summary = "更新质量检验记录", description = "更新质量检验记录")
    public ApiResponse<QualityInspection> updateInspection(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "检验记录ID") String inspectionId,
            @Valid @RequestBody @Parameter(description = "质量检验记录") QualityInspection inspection) {

        log.info("更新质量检验记录: factoryId={}, inspectionId={}", factoryId, inspectionId);

        QualityInspection updated = qualityInspectionService.updateInspection(factoryId, inspectionId, inspection);

        return ApiResponse.success(updated);
    }
}

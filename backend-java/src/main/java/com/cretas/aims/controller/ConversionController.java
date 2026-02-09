package com.cretas.aims.controller;

import com.cretas.aims.dto.ConversionDTO;
import com.cretas.aims.dto.ConversionChangeHistoryDTO;
import com.cretas.aims.dto.ConversionHistoryAnalysisDTO;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.service.ConversionService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import org.springframework.format.annotation.DateTimeFormat;

import javax.validation.Valid;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 转换率管理控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/conversions")
@Tag(name = "转换率管理", description = "原材料到产品转换率管理相关接口，包括转换率配置的创建、查询、计算、批量操作、历史记录追踪等功能，支持根据历史数据智能推荐转换率，可计算原材料需求量和产品产出量")
@RequiredArgsConstructor
public class ConversionController {

    private final ConversionService conversionService;

    @PostMapping
    @Operation(summary = "创建转换率配置", description = "创建新的原材料到产品转换率配置，需指定原材料类型、产品类型、转换率和损耗率等信息")
    public ApiResponse<ConversionDTO> createConversion(
            @PathVariable @Parameter(description = "工厂ID", example = "F001", required = true) String factoryId,
            @RequestBody @Valid @Parameter(description = "转换率配置信息，包含materialTypeId、productTypeId、conversionRate、lossRate等") ConversionDTO dto) {
        log.info("创建转换率配置: factoryId={}, materialTypeId={}, productTypeId={}",
                factoryId, dto.getMaterialTypeId(), dto.getProductTypeId());
        ConversionDTO result = conversionService.createConversion(factoryId, dto);
        return ApiResponse.success(result);
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新转换率配置", description = "更新已有的转换率配置信息，修改后会自动记录变更历史")
    public ApiResponse<ConversionDTO> updateConversion(
            @PathVariable @Parameter(description = "工厂ID", example = "F001", required = true) String factoryId,
            @PathVariable @Parameter(description = "转换率ID（UUID格式）", example = "550e8400-e29b-41d4-a716-446655440000", required = true) String id,
            @RequestBody @Valid @Parameter(description = "更新的转换率配置信息") ConversionDTO dto) {
        log.info("更新转换率配置: factoryId={}, id={}", factoryId, id);
        ConversionDTO result = conversionService.updateConversion(factoryId, id, dto);
        return ApiResponse.success(result);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除转换率配置", description = "删除指定的转换率配置，删除后相关的生产计划将无法自动计算原材料需求")
    public ApiResponse<Void> deleteConversion(
            @PathVariable @Parameter(description = "工厂ID", example = "F001", required = true) String factoryId,
            @PathVariable @Parameter(description = "转换率ID（UUID格式）", example = "550e8400-e29b-41d4-a716-446655440000", required = true) String id) {
        log.info("删除转换率配置: factoryId={}, id={}", factoryId, id);
        conversionService.deleteConversion(factoryId, id);
        return ApiResponse.success();
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取转换率详情", description = "根据ID获取转换率配置的详细信息，包括原材料类型、产品类型、转换率、损耗率、激活状态等")
    public ApiResponse<ConversionDTO> getConversion(
            @PathVariable @Parameter(description = "工厂ID", example = "F001", required = true) String factoryId,
            @PathVariable @Parameter(description = "转换率ID（UUID格式）", example = "550e8400-e29b-41d4-a716-446655440000", required = true) String id) {
        log.debug("获取转换率详情: factoryId={}, id={}", factoryId, id);
        ConversionDTO result = conversionService.getConversion(factoryId, id);
        return ApiResponse.success(result);
    }

    @GetMapping
    @Operation(summary = "分页查询转换率配置", description = "分页获取工厂的转换率配置列表，支持按激活状态筛选和自定义排序。返回分页信息和转换率配置详情")
    public ApiResponse<PageResponse<ConversionDTO>> getConversions(
            @PathVariable @Parameter(description = "工厂ID", example = "F001", required = true) String factoryId,
            @RequestParam(required = false) @Parameter(description = "激活状态过滤：true-仅激活，false-仅停用，null-全部", example = "true") Boolean isActive,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码（1-based）", example = "1") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小", example = "20") Integer size,
            @RequestParam(defaultValue = "id") @Parameter(description = "排序字段：id/materialTypeId/productTypeId/conversionRate", example = "id") String sort,
            @RequestParam(defaultValue = "DESC") @Parameter(description = "排序方向：ASC/DESC", example = "DESC") String direction) {
        log.debug("分页查询转换率配置: factoryId={}, isActive={}, page={}, size={}",
                factoryId, isActive, page, size);

        Sort.Direction sortDirection = "ASC".equalsIgnoreCase(direction) ?
                Sort.Direction.ASC : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(page, size, Sort.by(sortDirection, sort));

        PageResponse<ConversionDTO> result = conversionService.getConversions(factoryId, isActive, pageable);
        return ApiResponse.success(result);
    }

    @GetMapping("/material/{materialTypeId}")
    @Operation(summary = "根据原材料类型查询转换率", description = "获取指定原材料类型可转换的所有产品及其转换率，用于查看一种原料能生产哪些产品")
    public ApiResponse<List<ConversionDTO>> getConversionsByMaterial(
            @PathVariable @Parameter(description = "工厂ID", example = "F001", required = true) String factoryId,
            @PathVariable @Parameter(description = "原材料类型ID", example = "RMT-F001-001", required = true) String materialTypeId) {
        log.debug("根据原材料类型查询转换率: factoryId={}, materialTypeId={}", factoryId, materialTypeId);
        List<ConversionDTO> results = conversionService.getConversionsByMaterial(factoryId, materialTypeId);
        return ApiResponse.success(results);
    }

    @GetMapping("/product/{productTypeId}")
    @Operation(summary = "根据产品类型查询转换率", description = "获取生产指定产品所需的所有原材料及其转换率，用于查看一种产品需要哪些原料")
    public ApiResponse<List<ConversionDTO>> getConversionsByProduct(
            @PathVariable @Parameter(description = "工厂ID", example = "F001", required = true) String factoryId,
            @PathVariable @Parameter(description = "产品类型ID", example = "PT-F001-001", required = true) String productTypeId) {
        log.debug("根据产品类型查询转换率: factoryId={}, productTypeId={}", factoryId, productTypeId);
        List<ConversionDTO> results = conversionService.getConversionsByProduct(factoryId, productTypeId);
        return ApiResponse.success(results);
    }

    @GetMapping("/rate")
    @Operation(summary = "获取特定原材料和产品的转换率", description = "根据原材料类型ID和产品类型ID查询对应的转换率配置，用于获取特定材料-产品组合的转换关系")
    public ApiResponse<ConversionDTO> getConversionRate(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam @Parameter(description = "原材料类型ID", example = "RMT-F001-001") String materialTypeId,
            @RequestParam @Parameter(description = "产品类型ID", example = "PT-F001-001") String productTypeId) {
        log.debug("获取特定转换率: factoryId={}, materialTypeId={}, productTypeId={}",
                factoryId, materialTypeId, productTypeId);
        ConversionDTO result = conversionService.getConversionRate(factoryId, materialTypeId, productTypeId);
        return ApiResponse.success(result);
    }

    @PostMapping("/calculate/material-requirement")
    @Operation(summary = "计算原材料需求量", description = "根据产品类型和目标产量，自动计算所需各种原材料的数量，考虑转换率和损耗率")
    public ApiResponse<List<ConversionService.MaterialRequirement>> calculateMaterialRequirement(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam @Parameter(description = "产品类型ID", example = "PT-F001-001") String productTypeId,
            @RequestParam @Parameter(description = "产品数量（kg）", example = "100") BigDecimal productQuantity) {
        log.info("计算原材料需求: factoryId={}, productTypeId={}, quantity={}",
                factoryId, productTypeId, productQuantity);
        List<ConversionService.MaterialRequirement> results =
                conversionService.calculateMaterialRequirement(factoryId, productTypeId, productQuantity);
        return ApiResponse.success(results);
    }

    @PostMapping("/calculate/product-output")
    @Operation(summary = "计算产品产出量", description = "根据原材料类型和投入量，计算可生产的各种产品数量，考虑转换率和损耗率")
    public ApiResponse<List<ConversionService.ProductOutput>> calculateProductOutput(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam @Parameter(description = "原材料类型ID", example = "RMT-F001-001") String materialTypeId,
            @RequestParam @Parameter(description = "原材料数量（kg）", example = "200") BigDecimal materialQuantity) {
        log.info("计算产品产出: factoryId={}, materialTypeId={}, quantity={}",
                factoryId, materialTypeId, materialQuantity);
        List<ConversionService.ProductOutput> results =
                conversionService.calculateProductOutput(factoryId, materialTypeId, materialQuantity);
        return ApiResponse.success(results);
    }

    @PutMapping("/batch/activate")
    @Operation(summary = "批量激活/停用转换率配置", description = "批量更新多个转换率配置的激活状态，激活后的配置才能用于生产计算")
    public ApiResponse<Void> updateActiveStatus(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Parameter(description = "转换率ID列表（UUID数组）") List<String> ids,
            @RequestParam @Parameter(description = "激活状态：true-激活，false-停用", example = "true") Boolean isActive) {
        log.info("批量更新激活状态: factoryId={}, ids={}, isActive={}", factoryId, ids, isActive);
        conversionService.updateActiveStatus(factoryId, ids, isActive);
        return ApiResponse.success();
    }

    @PostMapping("/import")
    @Operation(summary = "批量导入转换率配置", description = "批量导入多个转换率配置，支持从外部系统或Excel导入数据，会自动校验并跳过重复配置")
    public ApiResponse<List<ConversionDTO>> importConversions(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Valid @Parameter(description = "转换率配置列表，包含materialTypeId、productTypeId、conversionRate等") List<ConversionDTO> conversions) {
        log.info("批量导入转换率: factoryId={}, count={}", factoryId, conversions.size());
        List<ConversionDTO> results = conversionService.importConversions(factoryId, conversions);
        return ApiResponse.success(results);
    }

    @GetMapping("/export")
    @Operation(summary = "导出转换率配置", description = "导出工厂的所有转换率配置，用于备份或迁移到其他工厂")
    public ApiResponse<List<ConversionDTO>> exportConversions(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        log.info("导出转换率配置: factoryId={}", factoryId);
        List<ConversionDTO> results = conversionService.exportConversions(factoryId);
        return ApiResponse.success(results);
    }

    @PostMapping("/validate")
    @Operation(summary = "验证转换率配置", description = "验证转换率配置是否有效，检查原材料类型和产品类型是否存在、转换率是否合理、是否与现有配置冲突等")
    public ApiResponse<ConversionService.ValidationResult> validateConversion(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Valid @Parameter(description = "待验证的转换率配置信息") ConversionDTO dto) {
        log.debug("验证转换率配置: factoryId={}", factoryId);
        ConversionService.ValidationResult result = conversionService.validateConversion(factoryId, dto);
        return ApiResponse.success(result);
    }

    @GetMapping("/statistics")
    @Operation(summary = "获取转换率统计信息", description = "获取工厂转换率配置的统计数据，包括总数、激活数、各材料/产品类型分布等")
    public ApiResponse<ConversionService.ConversionStatistics> getStatistics(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        log.debug("获取转换率统计: factoryId={}", factoryId);
        ConversionService.ConversionStatistics stats = conversionService.getStatistics(factoryId);
        return ApiResponse.success(stats);
    }

    @GetMapping("/suggest")
    @Operation(summary = "基于历史数据建议转换率", description = "根据已完成生产批次的历史数据自动计算建议的转换率和损耗率，需要有足够的历史生产数据才能给出准确建议")
    public ApiResponse<ConversionService.SuggestedConversion> suggestConversionFromHistory(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam @Parameter(description = "原材料类型ID", example = "RMT-F001-001") String materialTypeId,
            @RequestParam @Parameter(description = "产品类型ID", example = "PT-F001-001") String productTypeId) {
        log.info("获取建议转换率: factoryId={}, materialTypeId={}, productTypeId={}",
                factoryId, materialTypeId, productTypeId);
        ConversionService.SuggestedConversion suggestion =
                conversionService.suggestConversionFromHistory(factoryId, materialTypeId, productTypeId);
        return ApiResponse.success(suggestion);
    }

    // ========== 变更历史相关接口 ==========

    @GetMapping("/{id}/history")
    @Operation(summary = "获取转换率变更历史", description = "获取单个转换率配置的变更历史记录，包括每次变更的时间、操作人、变更前后的值等")
    public ApiResponse<PageResponse<ConversionChangeHistoryDTO>> getChangeHistory(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "转换率ID（UUID格式）", example = "550e8400-e29b-41d4-a716-446655440000") String id,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码（1-based）", example = "1") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小", example = "20") Integer size) {
        log.debug("获取转换率变更历史: factoryId={}, conversionId={}", factoryId, id);
        Pageable pageable = PageRequest.of(page - 1, size);
        PageResponse<ConversionChangeHistoryDTO> result = conversionService.getChangeHistory(factoryId, id, pageable);
        return ApiResponse.success(result);
    }

    @GetMapping("/{id}/history/count")
    @Operation(summary = "获取变更次数", description = "获取单个转换率配置的历史变更总次数，用于显示变更频率")
    public ApiResponse<Long> getChangeCount(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "转换率ID（UUID格式）", example = "550e8400-e29b-41d4-a716-446655440000") String id) {
        log.debug("获取转换率变更次数: conversionId={}", id);
        long count = conversionService.getChangeCount(id);
        return ApiResponse.success(count);
    }

    @GetMapping("/material/{materialTypeId}/history")
    @Operation(summary = "获取原料类型的变更历史", description = "获取某原料类型所有相关转换率配置的变更历史，用于追踪特定原料的转换率调整情况")
    public ApiResponse<PageResponse<ConversionChangeHistoryDTO>> getMaterialHistory(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "原材料类型ID", example = "RMT-F001-001") String materialTypeId,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码（1-based）", example = "1") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小", example = "20") Integer size) {
        log.debug("获取原料类型变更历史: factoryId={}, materialTypeId={}", factoryId, materialTypeId);
        Pageable pageable = PageRequest.of(page - 1, size);
        PageResponse<ConversionChangeHistoryDTO> result = conversionService.getMaterialHistory(factoryId, materialTypeId, pageable);
        return ApiResponse.success(result);
    }

    @GetMapping("/history/analysis")
    @Operation(summary = "获取变更历史分析数据", description = "获取指定时间范围内的转换率变更趋势数据，用于AI分析转换率的调整规律和优化建议")
    public ApiResponse<ConversionHistoryAnalysisDTO> getHistoryForAnalysis(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam @Parameter(description = "开始日期（格式：yyyy-MM-dd）", example = "2025-01-01") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @Parameter(description = "结束日期（格式：yyyy-MM-dd）", example = "2025-12-31") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        log.info("获取变更历史分析数据: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);
        ConversionHistoryAnalysisDTO result = conversionService.getHistoryForAnalysis(factoryId, startDate, endDate);
        return ApiResponse.success(result);
    }
}
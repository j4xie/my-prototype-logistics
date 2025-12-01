package com.cretas.aims.controller;

import com.cretas.aims.dto.ConversionDTO;
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

import javax.validation.Valid;
import java.math.BigDecimal;
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
@Tag(name = "转换率管理", description = "原材料到产品转换率管理相关接口")
@RequiredArgsConstructor
public class ConversionController {

    private final ConversionService conversionService;

    @PostMapping
    @Operation(summary = "创建转换率配置")
    public ApiResponse<ConversionDTO> createConversion(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Valid ConversionDTO dto) {
        log.info("创建转换率配置: factoryId={}, materialTypeId={}, productTypeId={}",
                factoryId, dto.getMaterialTypeId(), dto.getProductTypeId());
        ConversionDTO result = conversionService.createConversion(factoryId, dto);
        return ApiResponse.success(result);
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新转换率配置")
    public ApiResponse<ConversionDTO> updateConversion(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "转换率ID") Integer id,
            @RequestBody @Valid ConversionDTO dto) {
        log.info("更新转换率配置: factoryId={}, id={}", factoryId, id);
        ConversionDTO result = conversionService.updateConversion(factoryId, id, dto);
        return ApiResponse.success(result);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除转换率配置")
    public ApiResponse<Void> deleteConversion(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "转换率ID") Integer id) {
        log.info("删除转换率配置: factoryId={}, id={}", factoryId, id);
        conversionService.deleteConversion(factoryId, id);
        return ApiResponse.success();
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取转换率详情")
    public ApiResponse<ConversionDTO> getConversion(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "转换率ID") Integer id) {
        log.debug("获取转换率详情: factoryId={}, id={}", factoryId, id);
        ConversionDTO result = conversionService.getConversion(factoryId, id);
        return ApiResponse.success(result);
    }

    @GetMapping
    @Operation(summary = "分页查询转换率配置")
    public ApiResponse<PageResponse<ConversionDTO>> getConversions(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @Parameter(description = "是否激活") Boolean isActive,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小") Integer size,
            @RequestParam(defaultValue = "id") @Parameter(description = "排序字段") String sort,
            @RequestParam(defaultValue = "DESC") @Parameter(description = "排序方向") String direction) {
        log.debug("分页查询转换率配置: factoryId={}, isActive={}, page={}, size={}",
                factoryId, isActive, page, size);

        Sort.Direction sortDirection = "ASC".equalsIgnoreCase(direction) ?
                Sort.Direction.ASC : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(page, size, Sort.by(sortDirection, sort));

        PageResponse<ConversionDTO> result = conversionService.getConversions(factoryId, isActive, pageable);
        return ApiResponse.success(result);
    }

    @GetMapping("/material/{materialTypeId}")
    @Operation(summary = "根据原材料类型查询转换率")
    public ApiResponse<List<ConversionDTO>> getConversionsByMaterial(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "原材料类型ID") String materialTypeId) {
        log.debug("根据原材料类型查询转换率: factoryId={}, materialTypeId={}", factoryId, materialTypeId);
        List<ConversionDTO> results = conversionService.getConversionsByMaterial(factoryId, materialTypeId);
        return ApiResponse.success(results);
    }

    @GetMapping("/product/{productTypeId}")
    @Operation(summary = "根据产品类型查询转换率")
    public ApiResponse<List<ConversionDTO>> getConversionsByProduct(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "产品类型ID") String productTypeId) {
        log.debug("根据产品类型查询转换率: factoryId={}, productTypeId={}", factoryId, productTypeId);
        List<ConversionDTO> results = conversionService.getConversionsByProduct(factoryId, productTypeId);
        return ApiResponse.success(results);
    }

    @GetMapping("/rate")
    @Operation(summary = "获取特定原材料和产品的转换率")
    public ApiResponse<ConversionDTO> getConversionRate(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "原材料类型ID") String materialTypeId,
            @RequestParam @Parameter(description = "产品类型ID") String productTypeId) {
        log.debug("获取特定转换率: factoryId={}, materialTypeId={}, productTypeId={}",
                factoryId, materialTypeId, productTypeId);
        ConversionDTO result = conversionService.getConversionRate(factoryId, materialTypeId, productTypeId);
        return ApiResponse.success(result);
    }

    @PostMapping("/calculate/material-requirement")
    @Operation(summary = "计算原材料需求量")
    public ApiResponse<List<ConversionService.MaterialRequirement>> calculateMaterialRequirement(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "产品类型ID") String productTypeId,
            @RequestParam @Parameter(description = "产品数量") BigDecimal productQuantity) {
        log.info("计算原材料需求: factoryId={}, productTypeId={}, quantity={}",
                factoryId, productTypeId, productQuantity);
        List<ConversionService.MaterialRequirement> results =
                conversionService.calculateMaterialRequirement(factoryId, productTypeId, productQuantity);
        return ApiResponse.success(results);
    }

    @PostMapping("/calculate/product-output")
    @Operation(summary = "计算产品产出量")
    public ApiResponse<List<ConversionService.ProductOutput>> calculateProductOutput(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "原材料类型ID") String materialTypeId,
            @RequestParam @Parameter(description = "原材料数量") BigDecimal materialQuantity) {
        log.info("计算产品产出: factoryId={}, materialTypeId={}, quantity={}",
                factoryId, materialTypeId, materialQuantity);
        List<ConversionService.ProductOutput> results =
                conversionService.calculateProductOutput(factoryId, materialTypeId, materialQuantity);
        return ApiResponse.success(results);
    }

    @PutMapping("/batch/activate")
    @Operation(summary = "批量激活/停用转换率配置")
    public ApiResponse<Void> updateActiveStatus(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Parameter(description = "转换率ID列表") List<Integer> ids,
            @RequestParam @Parameter(description = "激活状态") Boolean isActive) {
        log.info("批量更新激活状态: factoryId={}, ids={}, isActive={}", factoryId, ids, isActive);
        conversionService.updateActiveStatus(factoryId, ids, isActive);
        return ApiResponse.success();
    }

    @PostMapping("/import")
    @Operation(summary = "批量导入转换率配置")
    public ApiResponse<List<ConversionDTO>> importConversions(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Valid @Parameter(description = "转换率列表") List<ConversionDTO> conversions) {
        log.info("批量导入转换率: factoryId={}, count={}", factoryId, conversions.size());
        List<ConversionDTO> results = conversionService.importConversions(factoryId, conversions);
        return ApiResponse.success(results);
    }

    @GetMapping("/export")
    @Operation(summary = "导出转换率配置")
    public ApiResponse<List<ConversionDTO>> exportConversions(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.info("导出转换率配置: factoryId={}", factoryId);
        List<ConversionDTO> results = conversionService.exportConversions(factoryId);
        return ApiResponse.success(results);
    }

    @PostMapping("/validate")
    @Operation(summary = "验证转换率配置")
    public ApiResponse<ConversionService.ValidationResult> validateConversion(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Valid ConversionDTO dto) {
        log.debug("验证转换率配置: factoryId={}", factoryId);
        ConversionService.ValidationResult result = conversionService.validateConversion(factoryId, dto);
        return ApiResponse.success(result);
    }

    @GetMapping("/statistics")
    @Operation(summary = "获取转换率统计信息")
    public ApiResponse<ConversionService.ConversionStatistics> getStatistics(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.debug("获取转换率统计: factoryId={}", factoryId);
        ConversionService.ConversionStatistics stats = conversionService.getStatistics(factoryId);
        return ApiResponse.success(stats);
    }
}
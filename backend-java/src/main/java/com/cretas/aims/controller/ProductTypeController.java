package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.producttype.ProductTypeDTO;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.service.ProductTypeService;
import com.cretas.aims.utils.TokenUtils;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotEmpty;
import java.util.List;

/**
 * 产品类型控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/product-types")
@RequiredArgsConstructor
@Tag(name = "产品类型管理")
@Validated
public class ProductTypeController {

    private final ProductTypeService productTypeService;
    private final MobileService mobileService;

    /**
     * 创建产品类型
     */
    @PostMapping
    @Operation(summary = "创建产品类型", description = "创建新的产品类型")
    public ApiResponse<ProductTypeDTO> createProductType(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Valid @Parameter(description = "产品类型信息") ProductTypeDTO dto,
            @RequestHeader("Authorization") String authorization) {
        log.info("创建产品类型: factoryId={}, code={}", factoryId, dto.getCode());
        // 获取当前用户ID
        String token = TokenUtils.extractToken(authorization);
        Integer userId = mobileService.getUserFromToken(token).getId();
        dto.setCreatedBy(userId);
        ProductTypeDTO result = productTypeService.createProductType(factoryId, dto);
        return ApiResponse.success(result);
    }

    /**
     * 更新产品类型
     */
    @PutMapping("/{id}")
    @Operation(summary = "更新产品类型", description = "更新产品类型信息")
    public ApiResponse<ProductTypeDTO> updateProductType(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "产品类型ID") String id,
            @RequestBody @Valid @Parameter(description = "产品类型信息") ProductTypeDTO dto) {
        log.info("更新产品类型: factoryId={}, id={}", factoryId, id);
        ProductTypeDTO result = productTypeService.updateProductType(factoryId, id, dto);
        return ApiResponse.success(result);
    }

    /**
     * 删除产品类型
     */
    @DeleteMapping("/{id}")
    @Operation(summary = "删除产品类型", description = "删除指定的产品类型")
    public ApiResponse<Void> deleteProductType(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "产品类型ID") String id) {
        log.info("删除产品类型: factoryId={}, id={}", factoryId, id);
        productTypeService.deleteProductType(factoryId, id);
        return ApiResponse.success();
    }

    /**
     * 获取产品类型详情
     */
    @GetMapping("/{id}")
    @Operation(summary = "获取产品类型详情", description = "根据ID获取产品类型详细信息")
    public ApiResponse<ProductTypeDTO> getProductTypeById(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "产品类型ID") String id) {
        log.info("获取产品类型详情: factoryId={}, id={}", factoryId, id);
        ProductTypeDTO result = productTypeService.getProductTypeById(factoryId, id);
        return ApiResponse.success(result);
    }

    /**
     * 获取产品类型列表
     */
    @GetMapping
    @Operation(summary = "获取产品类型列表", description = "分页获取产品类型列表")
    public ApiResponse<PageResponse<ProductTypeDTO>> getProductTypes(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小") Integer size) {
        log.info("获取产品类型列表: factoryId={}, page={}, size={}", factoryId, page, size);
        PageRequest pageRequest = new PageRequest();
        pageRequest.setPage(page);
        pageRequest.setSize(size);
        PageResponse<ProductTypeDTO> result = productTypeService.getProductTypes(factoryId, pageRequest);
        return ApiResponse.success(result);
    }

    /**
     * 获取激活的产品类型
     */
    @GetMapping("/active")
    @Operation(summary = "获取激活的产品类型", description = "获取所有激活状态的产品类型")
    public ApiResponse<List<ProductTypeDTO>> getActiveProductTypes(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.info("获取激活的产品类型: factoryId={}", factoryId);
        List<ProductTypeDTO> result = productTypeService.getActiveProductTypes(factoryId);
        return ApiResponse.success(result);
    }

    /**
     * 根据类别获取产品类型
     */
    @GetMapping("/category/{category}")
    @Operation(summary = "根据类别获取产品类型", description = "获取指定类别的产品类型")
    public ApiResponse<List<ProductTypeDTO>> getProductTypesByCategory(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "产品类别") String category) {
        log.info("根据类别获取产品类型: factoryId={}, category={}", factoryId, category);
        List<ProductTypeDTO> result = productTypeService.getProductTypesByCategory(factoryId, category);
        return ApiResponse.success(result);
    }

    /**
     * 搜索产品类型
     */
    @GetMapping("/search")
    @Operation(summary = "搜索产品类型", description = "根据关键字搜索产品类型")
    public ApiResponse<PageResponse<ProductTypeDTO>> searchProductTypes(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "搜索关键字") String keyword,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小") Integer size) {
        log.info("搜索产品类型: factoryId={}, keyword={}", factoryId, keyword);
        PageRequest pageRequest = new PageRequest();
        pageRequest.setPage(page);
        pageRequest.setSize(size);
        PageResponse<ProductTypeDTO> result = productTypeService.searchProductTypes(factoryId, keyword, pageRequest);
        return ApiResponse.success(result);
    }

    /**
     * 获取产品类别列表
     */
    @GetMapping("/categories")
    @Operation(summary = "获取产品类别列表", description = "获取所有产品类别")
    public ApiResponse<List<String>> getProductCategories(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.info("获取产品类别列表: factoryId={}", factoryId);
        List<String> result = productTypeService.getProductCategories(factoryId);
        return ApiResponse.success(result);
    }

    /**
     * 批量更新状态
     */
    @PutMapping("/batch/status")
    @Operation(summary = "批量更新状态", description = "批量更新产品类型的激活状态")
    public ApiResponse<Void> updateProductTypesStatus(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @NotEmpty @Parameter(description = "产品类型ID列表") List<String> ids,
            @RequestParam @Parameter(description = "激活状态") Boolean isActive) {
        log.info("批量更新产品类型状态: factoryId={}, ids={}, isActive={}", factoryId, ids, isActive);
        productTypeService.updateProductTypesStatus(factoryId, ids, isActive);
        return ApiResponse.success();
    }

    /**
     * 检查产品编码是否存在
     */
    @GetMapping("/check-code")
    @Operation(summary = "检查产品编码", description = "检查产品编码是否已存在")
    public ApiResponse<Boolean> checkCodeExists(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "产品编码") String code,
            @RequestParam(required = false) @Parameter(description = "排除的产品ID") String excludeId) {
        log.info("检查产品编码: factoryId={}, code={}, excludeId={}", factoryId, code, excludeId);
        boolean exists = productTypeService.checkCodeExists(factoryId, code, excludeId);
        return ApiResponse.success(exists);
    }

    /**
     * 初始化默认产品类型
     */
    @PostMapping("/init-defaults")
    @Operation(summary = "初始化默认产品类型", description = "为工厂初始化默认的产品类型")
    public ApiResponse<Void> initializeDefaultProductTypes(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.info("初始化默认产品类型: factoryId={}", factoryId);
        productTypeService.initializeDefaultProductTypes(factoryId);
        return ApiResponse.success();
    }
}
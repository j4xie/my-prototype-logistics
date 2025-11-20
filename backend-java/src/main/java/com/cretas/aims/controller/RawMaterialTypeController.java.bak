package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.material.RawMaterialTypeDTO;
import com.cretas.aims.service.RawMaterialTypeService;
import com.cretas.aims.service.MobileService;
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
 * 原材料类型控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/raw-material-types")
@RequiredArgsConstructor
@Tag(name = "原材料类型管理")
@Validated
public class RawMaterialTypeController {

    private final RawMaterialTypeService materialTypeService;
    private final MobileService mobileService;

    /**
     * 创建原材料类型
     */
    @PostMapping
    @Operation(summary = "创建原材料类型", description = "创建新的原材料类型")
    public ApiResponse<RawMaterialTypeDTO> createMaterialType(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestHeader(value = "Authorization", required = false) @Parameter(description = "访问令牌") String authorization,
            @RequestBody @Valid @Parameter(description = "原材料类型信息") RawMaterialTypeDTO dto) {
        log.info("创建原材料类型: factoryId={}, code={}", factoryId, dto.getCode());

        // 获取当前用户ID
        Integer userId = null;
        if (authorization != null && !authorization.trim().isEmpty()) {
            try {
                String token = TokenUtils.extractToken(authorization);
                var userDTO = mobileService.getUserFromToken(token);
                userId = userDTO.getId();
                log.info("从Token获取用户ID: {}", userId);
            } catch (Exception e) {
                log.warn("无法从token获取用户信息: {}", e.getMessage());
            }
        }

        // 设置创建者ID
        if (userId != null) {
            dto.setCreatedBy(userId);
        }

        RawMaterialTypeDTO result = materialTypeService.createMaterialType(factoryId, dto);
        return ApiResponse.success(result);
    }

    /**
     * 更新原材料类型
     */
    @PutMapping("/{id}")
    @Operation(summary = "更新原材料类型", description = "更新原材料类型信息")
    public ApiResponse<RawMaterialTypeDTO> updateMaterialType(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "原材料类型ID") Integer id,
            @RequestBody @Valid @Parameter(description = "原材料类型信息") RawMaterialTypeDTO dto) {
        log.info("更新原材料类型: factoryId={}, id={}", factoryId, id);
        RawMaterialTypeDTO result = materialTypeService.updateMaterialType(factoryId, id, dto);
        return ApiResponse.success(result);
    }

    /**
     * 删除原材料类型
     */
    @DeleteMapping("/{id}")
    @Operation(summary = "删除原材料类型", description = "删除指定的原材料类型")
    public ApiResponse<Void> deleteMaterialType(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "原材料类型ID") Integer id) {
        log.info("删除原材料类型: factoryId={}, id={}", factoryId, id);
        materialTypeService.deleteMaterialType(factoryId, id);
        return ApiResponse.success();
    }

    /**
     * 获取原材料类型详情
     */
    @GetMapping("/{id}")
    @Operation(summary = "获取原材料类型详情", description = "根据ID获取原材料类型详细信息")
    public ApiResponse<RawMaterialTypeDTO> getMaterialTypeById(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "原材料类型ID") Integer id) {
        log.info("获取原材料类型详情: factoryId={}, id={}", factoryId, id);
        RawMaterialTypeDTO result = materialTypeService.getMaterialTypeById(factoryId, id);
        return ApiResponse.success(result);
    }

    /**
     * 获取原材料类型列表
     */
    @GetMapping
    @Operation(summary = "获取原材料类型列表", description = "分页获取原材料类型列表")
    public ApiResponse<PageResponse<RawMaterialTypeDTO>> getMaterialTypes(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小") Integer size) {
        log.info("获取原材料类型列表: factoryId={}, page={}, size={}", factoryId, page, size);
        PageRequest pageRequest = new PageRequest();
        pageRequest.setPage(page);
        pageRequest.setSize(size);
        PageResponse<RawMaterialTypeDTO> result = materialTypeService.getMaterialTypes(factoryId, pageRequest);
        return ApiResponse.success(result);
    }

    /**
     * 获取激活的原材料类型
     */
    @GetMapping("/active")
    @Operation(summary = "获取激活的原材料类型", description = "获取所有激活状态的原材料类型")
    public ApiResponse<List<RawMaterialTypeDTO>> getActiveMaterialTypes(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.info("获取激活的原材料类型: factoryId={}", factoryId);
        List<RawMaterialTypeDTO> result = materialTypeService.getActiveMaterialTypes(factoryId);
        return ApiResponse.success(result);
    }

    /**
     * 根据类别获取原材料类型
     */
    @GetMapping("/category/{category}")
    @Operation(summary = "根据类别获取原材料类型", description = "获取指定类别的原材料类型")
    public ApiResponse<List<RawMaterialTypeDTO>> getMaterialTypesByCategory(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "原材料类别") String category) {
        log.info("根据类别获取原材料类型: factoryId={}, category={}", factoryId, category);
        List<RawMaterialTypeDTO> result = materialTypeService.getMaterialTypesByCategory(factoryId, category);
        return ApiResponse.success(result);
    }

    /**
     * 根据存储类型获取原材料类型
     */
    @GetMapping("/storage-type/{storageType}")
    @Operation(summary = "根据存储类型获取原材料类型", description = "获取指定存储类型的原材料类型")
    public ApiResponse<List<RawMaterialTypeDTO>> getMaterialTypesByStorageType(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "存储类型") String storageType) {
        log.info("根据存储类型获取原材料类型: factoryId={}, storageType={}", factoryId, storageType);
        List<RawMaterialTypeDTO> result = materialTypeService.getMaterialTypesByStorageType(factoryId, storageType);
        return ApiResponse.success(result);
    }

    /**
     * 搜索原材料类型
     */
    @GetMapping("/search")
    @Operation(summary = "搜索原材料类型", description = "根据关键字搜索原材料类型")
    public ApiResponse<PageResponse<RawMaterialTypeDTO>> searchMaterialTypes(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "搜索关键字") String keyword,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小") Integer size) {
        log.info("搜索原材料类型: factoryId={}, keyword={}", factoryId, keyword);
        PageRequest pageRequest = new PageRequest();
        pageRequest.setPage(page);
        pageRequest.setSize(size);
        PageResponse<RawMaterialTypeDTO> result = materialTypeService.searchMaterialTypes(factoryId, keyword, pageRequest);
        return ApiResponse.success(result);
    }

    /**
     * 获取原材料类别列表
     */
    @GetMapping("/categories")
    @Operation(summary = "获取原材料类别列表", description = "获取所有原材料类别")
    public ApiResponse<List<String>> getMaterialCategories(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.info("获取原材料类别列表: factoryId={}", factoryId);
        List<String> result = materialTypeService.getMaterialCategories(factoryId);
        return ApiResponse.success(result);
    }

    /**
     * 获取库存预警的原材料
     */
    @GetMapping("/low-stock")
    @Operation(summary = "获取库存预警", description = "获取库存低于最小值的原材料类型")
    public ApiResponse<List<RawMaterialTypeDTO>> getLowStockMaterials(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.info("获取库存预警的原材料: factoryId={}", factoryId);
        List<RawMaterialTypeDTO> result = materialTypeService.getLowStockMaterials(factoryId);
        return ApiResponse.success(result);
    }

    /**
     * 批量更新状态
     */
    @PutMapping("/batch/status")
    @Operation(summary = "批量更新状态", description = "批量更新原材料类型的激活状态")
    public ApiResponse<Void> updateMaterialTypesStatus(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @NotEmpty @Parameter(description = "原材料类型ID列表") List<Integer> ids,
            @RequestParam @Parameter(description = "激活状态") Boolean isActive) {
        log.info("批量更新原材料类型状态: factoryId={}, ids={}, isActive={}", factoryId, ids, isActive);
        materialTypeService.updateMaterialTypesStatus(factoryId, ids, isActive);
        return ApiResponse.success();
    }

    /**
     * 检查原材料编码是否存在
     */
    @GetMapping("/check-code")
    @Operation(summary = "检查原材料编码", description = "检查原材料编码是否已存在")
    public ApiResponse<Boolean> checkCodeExists(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "原材料编码") String code,
            @RequestParam(required = false) @Parameter(description = "排除的原材料ID") Integer excludeId) {
        log.info("检查原材料编码: factoryId={}, code={}, excludeId={}", factoryId, code, excludeId);
        boolean exists = materialTypeService.checkCodeExists(factoryId, code, excludeId);
        return ApiResponse.success(exists);
    }
}
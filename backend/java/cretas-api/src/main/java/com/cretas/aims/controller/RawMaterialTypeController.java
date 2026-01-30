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
@Tag(name = "原材料类型管理", description = "原材料类型配置管理接口，包括原材料类型的创建、查询、更新、删除，按类别/存储类型筛选，库存预警查询，批量状态管理等功能")
@Validated
public class RawMaterialTypeController {

    private final RawMaterialTypeService materialTypeService;
    private final MobileService mobileService;

    /**
     * 创建原材料类型
     */
    @PostMapping
    @Operation(summary = "创建原材料类型", description = "创建新的原材料类型，需指定名称、编码、类别、单位、存储类型等信息")
    public ApiResponse<RawMaterialTypeDTO> createMaterialType(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestHeader(value = "Authorization", required = false) @Parameter(description = "访问令牌", example = "Bearer eyJhbGciOiJIUzI1NiJ9...") String authorization,
            @RequestBody @Valid @Parameter(description = "原材料类型信息，包含name、code、category、unit、storageType等字段") RawMaterialTypeDTO dto) {
        log.info("创建原材料类型: factoryId={}, code={}", factoryId, dto.getCode());

        // 获取当前用户ID
        Long userId = null;
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
    @Operation(summary = "更新原材料类型", description = "更新原材料类型信息，可修改名称、类别、单位、存储条件等")
    public ApiResponse<RawMaterialTypeDTO> updateMaterialType(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "原材料类型ID", example = "RMT-F001-001") String id,
            @RequestBody @Valid @Parameter(description = "更新的原材料类型信息") RawMaterialTypeDTO dto) {
        log.info("更新原材料类型: factoryId={}, id={}", factoryId, id);
        RawMaterialTypeDTO result = materialTypeService.updateMaterialType(factoryId, id, dto);
        return ApiResponse.success(result);
    }

    /**
     * 删除原材料类型
     */
    @DeleteMapping("/{id}")
    @Operation(summary = "删除原材料类型", description = "删除指定的原材料类型，已关联的原材料批次不受影响")
    public ApiResponse<Void> deleteMaterialType(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "原材料类型ID", example = "RMT-F001-001") String id) {
        log.info("删除原材料类型: factoryId={}, id={}", factoryId, id);
        materialTypeService.deleteMaterialType(factoryId, id);
        return ApiResponse.success();
    }

    /**
     * 获取原材料类型详情
     */
    @GetMapping("/{id}")
    @Operation(summary = "获取原材料类型详情", description = "根据ID获取原材料类型详细信息，包括名称、编码、类别、单位、存储条件等")
    public ApiResponse<RawMaterialTypeDTO> getMaterialTypeById(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "原材料类型ID", example = "RMT-F001-001") String id) {
        log.info("获取原材料类型详情: factoryId={}, id={}", factoryId, id);
        RawMaterialTypeDTO result = materialTypeService.getMaterialTypeById(factoryId, id);
        return ApiResponse.success(result);
    }

    /**
     * 获取原材料类型列表
     */
    @GetMapping
    @Operation(summary = "获取原材料类型列表", description = "分页获取工厂的原材料类型列表，返回分页信息和类型详情")
    public ApiResponse<PageResponse<RawMaterialTypeDTO>> getMaterialTypes(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码（1-based）", example = "1") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小", example = "20") Integer size) {
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
    @Operation(summary = "获取激活的原材料类型", description = "获取所有激活状态的原材料类型，常用于下拉选择框")
    public ApiResponse<List<RawMaterialTypeDTO>> getActiveMaterialTypes(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        log.info("获取激活的原材料类型: factoryId={}", factoryId);
        List<RawMaterialTypeDTO> result = materialTypeService.getActiveMaterialTypes(factoryId);
        return ApiResponse.success(result);
    }

    /**
     * 根据类别获取原材料类型
     */
    @GetMapping("/category/{category}")
    @Operation(summary = "根据类别获取原材料类型", description = "获取指定类别的原材料类型列表，如鱼类、蔬菜类等")
    public ApiResponse<List<RawMaterialTypeDTO>> getMaterialTypesByCategory(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "原材料类别", example = "鱼类") String category) {
        log.info("根据类别获取原材料类型: factoryId={}, category={}", factoryId, category);
        List<RawMaterialTypeDTO> result = materialTypeService.getMaterialTypesByCategory(factoryId, category);
        return ApiResponse.success(result);
    }

    /**
     * 根据存储类型获取原材料类型
     */
    @GetMapping("/storage-type/{storageType}")
    @Operation(summary = "根据存储类型获取原材料类型", description = "获取指定存储类型的原材料类型，如冷冻、冷藏、常温等")
    public ApiResponse<List<RawMaterialTypeDTO>> getMaterialTypesByStorageType(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "存储类型：FROZEN-冷冻/REFRIGERATED-冷藏/ROOM_TEMP-常温", example = "FROZEN") String storageType) {
        log.info("根据存储类型获取原材料类型: factoryId={}, storageType={}", factoryId, storageType);
        List<RawMaterialTypeDTO> result = materialTypeService.getMaterialTypesByStorageType(factoryId, storageType);
        return ApiResponse.success(result);
    }

    /**
     * 搜索原材料类型
     */
    @GetMapping("/search")
    @Operation(summary = "搜索原材料类型", description = "根据关键字搜索原材料类型，匹配名称、编码、类别等字段")
    public ApiResponse<PageResponse<RawMaterialTypeDTO>> searchMaterialTypes(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam @Parameter(description = "搜索关键字", example = "带鱼") String keyword,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码（1-based）", example = "1") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小", example = "20") Integer size) {
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
    @Operation(summary = "获取原材料类别列表", description = "获取工厂所有已配置的原材料类别名称列表")
    public ApiResponse<List<String>> getMaterialCategories(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        log.info("获取原材料类别列表: factoryId={}", factoryId);
        List<String> result = materialTypeService.getMaterialCategories(factoryId);
        return ApiResponse.success(result);
    }

    /**
     * 获取库存预警的原材料
     */
    @GetMapping("/low-stock")
    @Operation(summary = "获取库存预警", description = "获取库存数量低于最小库存阈值的原材料类型列表，用于预警提醒")
    public ApiResponse<List<RawMaterialTypeDTO>> getLowStockMaterials(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        log.info("获取库存预警的原材料: factoryId={}", factoryId);
        List<RawMaterialTypeDTO> result = materialTypeService.getLowStockMaterials(factoryId);
        return ApiResponse.success(result);
    }

    /**
     * 批量更新状态
     */
    @PutMapping("/batch/status")
    @Operation(summary = "批量更新状态", description = "批量更新多个原材料类型的激活/停用状态")
    public ApiResponse<Void> updateMaterialTypesStatus(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @NotEmpty @Parameter(description = "原材料类型ID列表") List<String> ids,
            @RequestParam @Parameter(description = "激活状态：true-激活，false-停用", example = "true") Boolean isActive) {
        log.info("批量更新原材料类型状态: factoryId={}, ids={}, isActive={}", factoryId, ids, isActive);
        materialTypeService.updateMaterialTypesStatus(factoryId, ids, isActive);
        return ApiResponse.success();
    }

    /**
     * 检查原材料编码是否存在
     */
    @GetMapping("/check-code")
    @Operation(summary = "检查原材料编码", description = "检查原材料编码是否已存在，用于新增或编辑时的唯一性校验")
    public ApiResponse<Boolean> checkCodeExists(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam @Parameter(description = "原材料编码", example = "FISH-001") String code,
            @RequestParam(required = false) @Parameter(description = "排除的原材料ID（编辑时传入当前ID）", example = "RMT-F001-001") String excludeId) {
        log.info("检查原材料编码: factoryId={}, code={}, excludeId={}", factoryId, code, excludeId);
        boolean exists = materialTypeService.checkCodeExists(factoryId, code, excludeId);
        return ApiResponse.success(exists);
    }
}
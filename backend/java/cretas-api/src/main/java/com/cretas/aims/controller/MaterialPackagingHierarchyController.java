package com.cretas.aims.controller;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.material.MaterialPackagingHierarchyDTO;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.service.MaterialPackagingHierarchyService;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.utils.TokenUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 原料包装层级 Controller.
 *
 * 三级单位换算 (例: 三文鱼 一级 kg, 10 kg/箱, 12 箱/柜).
 * 一级必填, 二/三级可选 (Service 层 + DB CHECK 双重校验).
 *
 * @since 2026-05-06
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/material-packaging")
@RequiredArgsConstructor
@Tag(name = "原料包装层级", description = "原料的三级单位换算配置 (kg/箱/柜)")
public class MaterialPackagingHierarchyController {

    private final MaterialPackagingHierarchyService service;
    private final MobileService mobileService;

    @GetMapping
    @Operation(summary = "列出工厂全部包装层级", description = "用于报表/批量管理")
    public ApiResponse<List<MaterialPackagingHierarchyDTO>> list(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        return ApiResponse.success(service.listByFactory(factoryId));
    }

    @GetMapping("/by-material/{materialTypeId}")
    @Operation(summary = "查询某原料的包装层级", description = "无配置返回 success=true, data=null")
    public ApiResponse<MaterialPackagingHierarchyDTO> getByMaterial(
            @PathVariable String factoryId,
            @PathVariable String materialTypeId) {
        return ApiResponse.success(service.getByMaterialTypeId(factoryId, materialTypeId).orElse(null));
    }

    @RequirePermission({"production:read_write"})
    @PutMapping("/by-material/{materialTypeId}")
    @Operation(summary = "保存某原料的包装层级 (upsert)", description = "已存在则更新, 不存在则创建")
    public ApiResponse<MaterialPackagingHierarchyDTO> upsert(
            @PathVariable String factoryId,
            @PathVariable String materialTypeId,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody @Valid MaterialPackagingHierarchyDTO dto) {
        Long userId = extractUserId(authorization);
        return ApiResponse.success(service.upsert(factoryId, materialTypeId, dto, userId));
    }

    @RequirePermission({"production:read_write"})
    @DeleteMapping("/by-material/{materialTypeId}")
    @Operation(summary = "删除某原料的包装层级", description = "软删除")
    public ApiResponse<Void> delete(
            @PathVariable String factoryId,
            @PathVariable String materialTypeId) {
        service.deleteByMaterialTypeId(factoryId, materialTypeId);
        return ApiResponse.success();
    }

    private Long extractUserId(String authorization) {
        if (authorization == null || authorization.trim().isEmpty()) {
            return null;
        }
        try {
            String token = TokenUtils.extractToken(authorization);
            return mobileService.getUserFromToken(token).getId();
        } catch (Exception e) {
            log.warn("无法从 token 提取 userId: {}", e.getMessage());
            return null;
        }
    }
}

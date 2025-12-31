package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.config.SystemEnum;
import com.cretas.aims.entity.config.UnitOfMeasurement;
import com.cretas.aims.service.SystemEnumService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 系统配置控制器
 *
 * 提供系统枚举和计量单位的管理API:
 * - 枚举配置的CRUD操作
 * - 计量单位的CRUD操作
 * - 单位换算功能
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/system-config")
@RequiredArgsConstructor
@Tag(name = "系统配置", description = "系统枚举和计量单位管理API")
public class SystemConfigController {

    private final SystemEnumService systemEnumService;

    // ==================== 枚举查询 ====================

    @GetMapping("/enums/{enumGroup}")
    @Operation(summary = "获取枚举组的所有值", description = "根据枚举组获取所有枚举值，支持工厂级覆盖")
    public ResponseEntity<ApiResponse<List<SystemEnum>>> getEnumsByGroup(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "枚举组") @PathVariable String enumGroup) {

        log.debug("Getting enums for factory: {}, group: {}", factoryId, enumGroup);
        List<SystemEnum> enums = systemEnumService.getEnumsByGroup(factoryId, enumGroup);
        return ResponseEntity.ok(ApiResponse.success(enums));
    }

    @GetMapping("/enums/groups")
    @Operation(summary = "获取所有枚举组", description = "获取系统中所有可用的枚举组列表")
    public ResponseEntity<ApiResponse<List<String>>> getAllEnumGroups(
            @Parameter(description = "工厂ID") @PathVariable String factoryId) {

        List<String> groups = systemEnumService.getAllEnumGroups();
        return ResponseEntity.ok(ApiResponse.success(groups));
    }

    @GetMapping("/enums/{enumGroup}/{enumCode}")
    @Operation(summary = "获取单个枚举值", description = "根据枚举组和代码获取单个枚举配置")
    public ResponseEntity<ApiResponse<SystemEnum>> getEnum(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "枚举组") @PathVariable String enumGroup,
            @Parameter(description = "枚举代码") @PathVariable String enumCode) {

        return systemEnumService.getEnum(factoryId, enumGroup, enumCode)
                .map(e -> ResponseEntity.ok(ApiResponse.success(e)))
                .orElse(ResponseEntity.ok(ApiResponse.error("枚举值不存在")));
    }

    @GetMapping("/enums/{enumGroup}/labels")
    @Operation(summary = "获取枚举组的标签映射", description = "获取枚举组的代码-标签映射表")
    public ResponseEntity<ApiResponse<Map<String, String>>> getEnumLabelsMap(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "枚举组") @PathVariable String enumGroup) {

        Map<String, String> labelsMap = systemEnumService.getEnumLabelsMap(factoryId, enumGroup);
        return ResponseEntity.ok(ApiResponse.success(labelsMap));
    }

    @GetMapping("/enums/{enumGroup}/{enumCode}/validate")
    @Operation(summary = "验证枚举值", description = "验证枚举值是否有效")
    public ResponseEntity<ApiResponse<Boolean>> validateEnum(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "枚举组") @PathVariable String enumGroup,
            @Parameter(description = "枚举代码") @PathVariable String enumCode) {

        boolean isValid = systemEnumService.isValidEnum(factoryId, enumGroup, enumCode);
        return ResponseEntity.ok(ApiResponse.success(isValid));
    }

    // ==================== 枚举管理 ====================

    @PostMapping("/enums")
    @Operation(summary = "创建枚举值", description = "创建工厂级枚举覆盖配置")
    public ResponseEntity<ApiResponse<SystemEnum>> createEnum(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @RequestBody SystemEnum systemEnum) {

        systemEnum.setFactoryId(factoryId);
        SystemEnum created = systemEnumService.createEnum(systemEnum);
        log.info("Created enum: {}/{} for factory: {}",
                systemEnum.getEnumGroup(), systemEnum.getEnumCode(), factoryId);
        return ResponseEntity.ok(ApiResponse.success("枚举创建成功", created));
    }

    @PutMapping("/enums/{enumGroup}/{enumCode}")
    @Operation(summary = "更新枚举值", description = "更新枚举配置")
    public ResponseEntity<ApiResponse<SystemEnum>> updateEnum(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "枚举组") @PathVariable String enumGroup,
            @Parameter(description = "枚举代码") @PathVariable String enumCode,
            @RequestBody SystemEnum systemEnum) {

        systemEnum.setFactoryId(factoryId);
        systemEnum.setEnumGroup(enumGroup);
        systemEnum.setEnumCode(enumCode);
        SystemEnum updated = systemEnumService.updateEnum(systemEnum);
        log.info("Updated enum: {}/{} for factory: {}", enumGroup, enumCode, factoryId);
        return ResponseEntity.ok(ApiResponse.success("枚举更新成功", updated));
    }

    @DeleteMapping("/enums/{enumGroup}/{enumCode}")
    @Operation(summary = "删除枚举值", description = "删除工厂级枚举覆盖（系统内置不可删除）")
    public ResponseEntity<ApiResponse<Void>> deleteEnum(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "枚举组") @PathVariable String enumGroup,
            @Parameter(description = "枚举代码") @PathVariable String enumCode) {

        systemEnumService.deleteEnum(factoryId, enumGroup, enumCode);
        log.info("Deleted enum: {}/{} for factory: {}", enumGroup, enumCode, factoryId);
        return ResponseEntity.ok(ApiResponse.success("枚举删除成功", (Void) null));
    }

    // ==================== 计量单位查询 ====================

    @GetMapping("/units")
    @Operation(summary = "获取计量单位", description = "获取计量单位列表，可按分类筛选")
    public ResponseEntity<ApiResponse<List<UnitOfMeasurement>>> getUnits(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "单位分类（可选）") @RequestParam(required = false) String category) {

        List<UnitOfMeasurement> units;
        if (category != null && !category.isEmpty()) {
            units = systemEnumService.getUnitsByCategory(factoryId, category);
        } else {
            units = systemEnumService.getAllUnits(factoryId);
        }
        return ResponseEntity.ok(ApiResponse.success(units));
    }

    @GetMapping("/units/categories")
    @Operation(summary = "获取单位分类", description = "获取所有可用的单位分类列表")
    public ResponseEntity<ApiResponse<List<String>>> getUnitCategories(
            @Parameter(description = "工厂ID") @PathVariable String factoryId) {

        List<String> categories = systemEnumService.getAllUnitCategories();
        return ResponseEntity.ok(ApiResponse.success(categories));
    }

    @GetMapping("/units/{unitCode}")
    @Operation(summary = "获取单个单位", description = "根据单位代码获取单位配置")
    public ResponseEntity<ApiResponse<UnitOfMeasurement>> getUnit(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "单位代码") @PathVariable String unitCode) {

        return systemEnumService.getUnit(factoryId, unitCode)
                .map(u -> ResponseEntity.ok(ApiResponse.success(u)))
                .orElse(ResponseEntity.ok(ApiResponse.error("计量单位不存在")));
    }

    @GetMapping("/units/base/{category}")
    @Operation(summary = "获取基础单位", description = "获取指定分类的基础单位")
    public ResponseEntity<ApiResponse<UnitOfMeasurement>> getBaseUnit(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "单位分类") @PathVariable String category) {

        return systemEnumService.getBaseUnit(factoryId, category)
                .map(u -> ResponseEntity.ok(ApiResponse.success(u)))
                .orElse(ResponseEntity.ok(ApiResponse.error("未找到该分类的基础单位")));
    }

    // ==================== 单位换算 ====================

    @PostMapping("/units/convert")
    @Operation(summary = "单位换算", description = "将数值从一个单位换算为另一个单位")
    public ResponseEntity<ApiResponse<UnitConversionResult>> convertUnit(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @RequestBody UnitConversionRequest request) {

        BigDecimal result = systemEnumService.convertUnit(
                factoryId, request.getValue(), request.getFromUnit(), request.getToUnit());

        UnitConversionResult conversionResult = new UnitConversionResult();
        conversionResult.setOriginalValue(request.getValue());
        conversionResult.setFromUnit(request.getFromUnit());
        conversionResult.setToUnit(request.getToUnit());
        conversionResult.setConvertedValue(result);

        return ResponseEntity.ok(ApiResponse.success(conversionResult));
    }

    // ==================== 计量单位管理 ====================

    @PostMapping("/units")
    @Operation(summary = "创建计量单位", description = "创建工厂级计量单位配置")
    public ResponseEntity<ApiResponse<UnitOfMeasurement>> createUnit(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @RequestBody UnitOfMeasurement unit) {

        unit.setFactoryId(factoryId);
        UnitOfMeasurement created = systemEnumService.createUnit(unit);
        log.info("Created unit: {} for factory: {}", unit.getUnitCode(), factoryId);
        return ResponseEntity.ok(ApiResponse.success("计量单位创建成功", created));
    }

    @PutMapping("/units/{unitCode}")
    @Operation(summary = "更新计量单位", description = "更新计量单位配置")
    public ResponseEntity<ApiResponse<UnitOfMeasurement>> updateUnit(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "单位代码") @PathVariable String unitCode,
            @RequestBody UnitOfMeasurement unit) {

        unit.setFactoryId(factoryId);
        unit.setUnitCode(unitCode);
        UnitOfMeasurement updated = systemEnumService.updateUnit(unit);
        log.info("Updated unit: {} for factory: {}", unitCode, factoryId);
        return ResponseEntity.ok(ApiResponse.success("计量单位更新成功", updated));
    }

    @DeleteMapping("/units/{unitCode}")
    @Operation(summary = "删除计量单位", description = "删除工厂级计量单位配置（系统内置不可删除）")
    public ResponseEntity<ApiResponse<Void>> deleteUnit(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "单位代码") @PathVariable String unitCode) {

        systemEnumService.deleteUnit(factoryId, unitCode);
        log.info("Deleted unit: {} for factory: {}", unitCode, factoryId);
        return ResponseEntity.ok(ApiResponse.success("计量单位删除成功", (Void) null));
    }

    // ==================== 缓存管理 ====================

    @PostMapping("/cache/clear")
    @Operation(summary = "清除缓存", description = "清除工厂的枚举和单位缓存")
    public ResponseEntity<ApiResponse<Void>> clearCache(
            @Parameter(description = "工厂ID") @PathVariable String factoryId) {

        systemEnumService.clearEnumCache(factoryId);
        systemEnumService.clearUnitCache(factoryId);
        log.info("Cleared system config cache for factory: {}", factoryId);
        return ResponseEntity.ok(ApiResponse.success("缓存已清除", (Void) null));
    }

    // ==================== DTO Classes ====================

    /**
     * 单位换算请求
     */
    @lombok.Data
    public static class UnitConversionRequest {
        private BigDecimal value;
        private String fromUnit;
        private String toUnit;
    }

    /**
     * 单位换算结果
     */
    @lombok.Data
    public static class UnitConversionResult {
        private BigDecimal originalValue;
        private String fromUnit;
        private String toUnit;
        private BigDecimal convertedValue;
    }
}

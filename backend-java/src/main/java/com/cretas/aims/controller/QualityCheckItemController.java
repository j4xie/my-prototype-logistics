package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.config.*;
import com.cretas.aims.entity.enums.QualityCheckCategory;
import com.cretas.aims.service.QualityCheckItemService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 质检项配置控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/quality-check-items")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "质检项配置", description = "质检项的增删改查、绑定管理和统计接口")
public class QualityCheckItemController {

    private final QualityCheckItemService qualityCheckItemService;

    // ==================== 质检项 CRUD ====================

    /**
     * 创建质检项
     */
    @PostMapping
    @Operation(summary = "创建质检项", description = "创建新的质检检验项目")
    public ResponseEntity<ApiResponse<QualityCheckItemDTO>> create(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @Valid @RequestBody CreateQualityCheckItemRequest request,
            HttpServletRequest httpRequest) {
        Long userId = getUserId(httpRequest);
        QualityCheckItemDTO item = qualityCheckItemService.createQualityCheckItem(factoryId, request, userId);
        return ResponseEntity.ok(ApiResponse.success("创建成功", item));
    }

    /**
     * 更新质检项
     */
    @PutMapping("/{itemId}")
    @Operation(summary = "更新质检项", description = "更新质检项的配置信息")
    public ResponseEntity<ApiResponse<QualityCheckItemDTO>> update(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "质检项ID", example = "QCI-001") String itemId,
            @Valid @RequestBody UpdateQualityCheckItemRequest request) {
        QualityCheckItemDTO item = qualityCheckItemService.updateQualityCheckItem(factoryId, itemId, request);
        return ResponseEntity.ok(ApiResponse.success("更新成功", item));
    }

    /**
     * 删除质检项
     */
    @DeleteMapping("/{itemId}")
    @Operation(summary = "删除质检项", description = "删除指定的质检项")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "质检项ID", example = "QCI-001") String itemId) {
        qualityCheckItemService.deleteQualityCheckItem(factoryId, itemId);
        return ResponseEntity.ok(ApiResponse.success("删除成功", null));
    }

    /**
     * 获取单个质检项
     */
    @GetMapping("/{itemId}")
    @Operation(summary = "获取质检项详情", description = "获取单个质检项的详细信息")
    public ResponseEntity<ApiResponse<QualityCheckItemDTO>> getById(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "质检项ID", example = "QCI-001") String itemId) {
        QualityCheckItemDTO item = qualityCheckItemService.getQualityCheckItem(factoryId, itemId);
        return ResponseEntity.ok(ApiResponse.success(item));
    }

    /**
     * 分页查询质检项
     */
    @GetMapping
    @Operation(summary = "分页查询质检项", description = "分页获取质检项列表")
    public ResponseEntity<ApiResponse<Page<QualityCheckItemDTO>>> list(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码", example = "1") int page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页数量", example = "20") int size,
            @RequestParam(defaultValue = "category,sortOrder") @Parameter(description = "排序字段", example = "category,sortOrder") String sort) {
        String[] sortFields = sort.split(",");
        List<Sort.Order> orders = Arrays.stream(sortFields)
                .map(field -> Sort.Order.asc(field.trim()))
                .collect(Collectors.toList());
        PageRequest pageRequest = PageRequest.of(page - 1, size, Sort.by(orders));
        Page<QualityCheckItemDTO> items = qualityCheckItemService.getQualityCheckItems(factoryId, pageRequest);
        return ResponseEntity.ok(ApiResponse.success(items));
    }

    // ==================== 查询接口 ====================

    /**
     * 按类别查询
     */
    @GetMapping("/category/{category}")
    @Operation(summary = "按类别查询质检项", description = "获取指定类别的所有质检项")
    public ResponseEntity<ApiResponse<List<QualityCheckItemDTO>>> getByCategory(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "质检类别", example = "SENSORY") QualityCheckCategory category) {
        List<QualityCheckItemDTO> items = qualityCheckItemService.getByCategory(factoryId, category);
        return ResponseEntity.ok(ApiResponse.success(items));
    }

    /**
     * 获取必检项
     */
    @GetMapping("/required")
    @Operation(summary = "获取必检项", description = "获取所有必须检验的质检项")
    public ResponseEntity<ApiResponse<List<QualityCheckItemDTO>>> getRequired(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        List<QualityCheckItemDTO> items = qualityCheckItemService.getRequiredItems(factoryId);
        return ResponseEntity.ok(ApiResponse.success(items));
    }

    /**
     * 获取关键项
     */
    @GetMapping("/critical")
    @Operation(summary = "获取关键项", description = "获取所有关键质检项，这些项目对产品质量有重大影响")
    public ResponseEntity<ApiResponse<List<QualityCheckItemDTO>>> getCritical(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        List<QualityCheckItemDTO> items = qualityCheckItemService.getCriticalItems(factoryId);
        return ResponseEntity.ok(ApiResponse.success(items));
    }

    /**
     * 获取所有启用的质检项
     */
    @GetMapping("/enabled")
    @Operation(summary = "获取启用的质检项", description = "获取所有当前启用的质检项")
    public ResponseEntity<ApiResponse<List<QualityCheckItemDTO>>> getEnabled(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        List<QualityCheckItemDTO> items = qualityCheckItemService.getEnabledItems(factoryId);
        return ResponseEntity.ok(ApiResponse.success(items));
    }

    /**
     * 获取系统默认模板
     */
    @GetMapping("/templates")
    @Operation(summary = "获取系统默认模板", description = "获取系统预置的质检项模板，可用于快速初始化工厂配置")
    public ResponseEntity<ApiResponse<List<QualityCheckItemDTO>>> getSystemTemplates() {
        List<QualityCheckItemDTO> items = qualityCheckItemService.getSystemDefaultItems();
        return ResponseEntity.ok(ApiResponse.success(items));
    }

    // ==================== 统计接口 ====================

    /**
     * 获取统计信息
     */
    @GetMapping("/statistics")
    @Operation(summary = "获取统计信息", description = "获取质检项的统计汇总信息")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getStatistics(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        Map<String, Object> stats = qualityCheckItemService.getStatistics(factoryId);
        return ResponseEntity.ok(ApiResponse.success(stats));
    }

    /**
     * 按类别统计
     */
    @GetMapping("/statistics/by-category")
    @Operation(summary = "按类别统计", description = "统计各质检类别的质检项数量")
    public ResponseEntity<ApiResponse<Map<QualityCheckCategory, Long>>> countByCategory(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        Map<QualityCheckCategory, Long> counts = qualityCheckItemService.countByCategory(factoryId);
        return ResponseEntity.ok(ApiResponse.success(counts));
    }

    // ==================== 批量操作 ====================

    /**
     * 批量启用
     */
    @PostMapping("/batch/enable")
    @Operation(summary = "批量启用质检项", description = "批量启用指定的质检项")
    public ResponseEntity<ApiResponse<Integer>> batchEnable(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody List<String> itemIds) {
        int count = qualityCheckItemService.batchUpdateEnabled(itemIds, true);
        return ResponseEntity.ok(ApiResponse.success("批量启用成功，共 " + count + " 项", count));
    }

    /**
     * 批量禁用
     */
    @PostMapping("/batch/disable")
    @Operation(summary = "批量禁用质检项", description = "批量禁用指定的质检项")
    public ResponseEntity<ApiResponse<Integer>> batchDisable(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody List<String> itemIds) {
        int count = qualityCheckItemService.batchUpdateEnabled(itemIds, false);
        return ResponseEntity.ok(ApiResponse.success("批量禁用成功，共 " + count + " 项", count));
    }

    /**
     * 从系统模板复制
     */
    @PostMapping("/copy-from-template")
    @Operation(summary = "从系统模板复制", description = "将系统默认质检项模板复制到当前工厂")
    public ResponseEntity<ApiResponse<List<QualityCheckItemDTO>>> copyFromTemplate(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            HttpServletRequest httpRequest) {
        Long userId = getUserId(httpRequest);
        List<QualityCheckItemDTO> items = qualityCheckItemService.copyFromSystemTemplate(factoryId, userId);
        return ResponseEntity.ok(ApiResponse.success("复制成功，共 " + items.size() + " 项", items));
    }

    // ==================== 绑定管理 ====================

    /**
     * 绑定质检项到产品
     */
    @PostMapping("/bindings")
    @Operation(summary = "绑定质检项到产品", description = "将质检项绑定到指定产品类型")
    public ResponseEntity<ApiResponse<QualityCheckItemBindingDTO>> bind(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @Valid @RequestBody BindQualityCheckItemRequest request) {
        QualityCheckItemBindingDTO binding = qualityCheckItemService.bindToProduct(factoryId, request);
        return ResponseEntity.ok(ApiResponse.success("绑定成功", binding));
    }

    /**
     * 解除绑定
     */
    @DeleteMapping("/bindings/{bindingId}")
    @Operation(summary = "解除绑定", description = "解除质检项与产品的绑定关系")
    public ResponseEntity<ApiResponse<Void>> unbind(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "绑定ID", example = "BND-001") String bindingId) {
        qualityCheckItemService.unbindFromProduct(factoryId, bindingId);
        return ResponseEntity.ok(ApiResponse.success("解除绑定成功", null));
    }

    /**
     * 更新绑定配置
     */
    @PutMapping("/bindings/{bindingId}")
    @Operation(summary = "更新绑定配置", description = "更新质检项与产品的绑定配置")
    public ResponseEntity<ApiResponse<QualityCheckItemBindingDTO>> updateBinding(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "绑定ID", example = "BND-001") String bindingId,
            @Valid @RequestBody BindQualityCheckItemRequest request) {
        QualityCheckItemBindingDTO binding = qualityCheckItemService.updateBinding(factoryId, bindingId, request);
        return ResponseEntity.ok(ApiResponse.success("更新成功", binding));
    }

    /**
     * 获取产品的质检项绑定
     */
    @GetMapping("/bindings/product/{productTypeId}")
    @Operation(summary = "获取产品的质检项绑定", description = "获取指定产品类型的所有质检项绑定")
    public ResponseEntity<ApiResponse<List<QualityCheckItemBindingDTO>>> getProductBindings(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "产品类型ID", example = "PT-001") String productTypeId) {
        List<QualityCheckItemBindingDTO> bindings = qualityCheckItemService.getProductBindings(factoryId, productTypeId);
        return ResponseEntity.ok(ApiResponse.success(bindings));
    }

    /**
     * 批量绑定质检项到产品
     */
    @PostMapping("/bindings/batch")
    @Operation(summary = "批量绑定质检项", description = "批量将多个质检项绑定到指定产品类型")
    public ResponseEntity<ApiResponse<List<QualityCheckItemBindingDTO>>> batchBind(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam @Parameter(description = "产品类型ID", example = "PT-001") String productTypeId,
            @RequestBody List<String> itemIds) {
        List<QualityCheckItemBindingDTO> bindings = qualityCheckItemService.batchBindToProduct(factoryId, productTypeId, itemIds);
        return ResponseEntity.ok(ApiResponse.success("批量绑定成功，共 " + bindings.size() + " 项", bindings));
    }

    /**
     * 检查绑定是否存在
     */
    @GetMapping("/bindings/exists")
    @Operation(summary = "检查绑定是否存在", description = "检查指定产品与质检项的绑定是否存在")
    public ResponseEntity<ApiResponse<Boolean>> checkBindingExists(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam @Parameter(description = "产品类型ID", example = "PT-001") String productTypeId,
            @RequestParam @Parameter(description = "质检项ID", example = "QCI-001") String qualityCheckItemId) {
        boolean exists = qualityCheckItemService.isBindingExists(productTypeId, qualityCheckItemId);
        return ResponseEntity.ok(ApiResponse.success(exists));
    }

    /**
     * 验证检测值
     */
    @PostMapping("/{itemId}/validate")
    @Operation(summary = "验证检测值", description = "验证检测值是否符合质检项的合格标准")
    public ResponseEntity<ApiResponse<Boolean>> validateValue(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "质检项ID", example = "QCI-001") String itemId,
            @RequestParam(required = false) @Parameter(description = "产品类型ID", example = "PT-001") String productTypeId,
            @RequestBody Object value) {
        boolean valid = qualityCheckItemService.validateCheckValue(factoryId, itemId, productTypeId, value);
        return ResponseEntity.ok(ApiResponse.success(valid ? "合格" : "不合格", valid));
    }

    // ==================== 辅助方法 ====================

    private Long getUserId(HttpServletRequest request) {
        Object userId = request.getAttribute("userId");
        if (userId instanceof Long) {
            return (Long) userId;
        } else if (userId instanceof Integer) {
            return ((Integer) userId).longValue();
        } else if (userId instanceof String) {
            try {
                return Long.parseLong((String) userId);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }
}

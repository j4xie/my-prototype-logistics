package com.cretas.aims.controller;

import com.cretas.aims.dto.ApiResponse;
import com.cretas.aims.dto.config.*;
import com.cretas.aims.entity.enums.QualityCheckCategory;
import com.cretas.aims.service.QualityCheckItemService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.util.List;
import java.util.Map;

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
public class QualityCheckItemController {

    private final QualityCheckItemService qualityCheckItemService;

    // ==================== 质检项 CRUD ====================

    /**
     * 创建质检项
     */
    @PostMapping
    public ResponseEntity<ApiResponse<QualityCheckItemDTO>> create(
            @PathVariable String factoryId,
            @Valid @RequestBody CreateQualityCheckItemRequest request,
            HttpServletRequest httpRequest) {
        Long userId = getUserId(httpRequest);
        QualityCheckItemDTO item = qualityCheckItemService.createQualityCheckItem(factoryId, request, userId);
        return ResponseEntity.ok(ApiResponse.success(item, "创建成功"));
    }

    /**
     * 更新质检项
     */
    @PutMapping("/{itemId}")
    public ResponseEntity<ApiResponse<QualityCheckItemDTO>> update(
            @PathVariable String factoryId,
            @PathVariable String itemId,
            @Valid @RequestBody UpdateQualityCheckItemRequest request) {
        QualityCheckItemDTO item = qualityCheckItemService.updateQualityCheckItem(factoryId, itemId, request);
        return ResponseEntity.ok(ApiResponse.success(item, "更新成功"));
    }

    /**
     * 删除质检项
     */
    @DeleteMapping("/{itemId}")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable String factoryId,
            @PathVariable String itemId) {
        qualityCheckItemService.deleteQualityCheckItem(factoryId, itemId);
        return ResponseEntity.ok(ApiResponse.success(null, "删除成功"));
    }

    /**
     * 获取单个质检项
     */
    @GetMapping("/{itemId}")
    public ResponseEntity<ApiResponse<QualityCheckItemDTO>> getById(
            @PathVariable String factoryId,
            @PathVariable String itemId) {
        QualityCheckItemDTO item = qualityCheckItemService.getQualityCheckItem(factoryId, itemId);
        return ResponseEntity.ok(ApiResponse.success(item));
    }

    /**
     * 分页查询质检项
     */
    @GetMapping
    public ResponseEntity<ApiResponse<Page<QualityCheckItemDTO>>> list(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "category,sortOrder") String sort) {
        PageRequest pageRequest = PageRequest.of(page - 1, size, Sort.by(sort.split(",")));
        Page<QualityCheckItemDTO> items = qualityCheckItemService.getQualityCheckItems(factoryId, pageRequest);
        return ResponseEntity.ok(ApiResponse.success(items));
    }

    // ==================== 查询接口 ====================

    /**
     * 按类别查询
     */
    @GetMapping("/category/{category}")
    public ResponseEntity<ApiResponse<List<QualityCheckItemDTO>>> getByCategory(
            @PathVariable String factoryId,
            @PathVariable QualityCheckCategory category) {
        List<QualityCheckItemDTO> items = qualityCheckItemService.getByCategory(factoryId, category);
        return ResponseEntity.ok(ApiResponse.success(items));
    }

    /**
     * 获取必检项
     */
    @GetMapping("/required")
    public ResponseEntity<ApiResponse<List<QualityCheckItemDTO>>> getRequired(
            @PathVariable String factoryId) {
        List<QualityCheckItemDTO> items = qualityCheckItemService.getRequiredItems(factoryId);
        return ResponseEntity.ok(ApiResponse.success(items));
    }

    /**
     * 获取关键项
     */
    @GetMapping("/critical")
    public ResponseEntity<ApiResponse<List<QualityCheckItemDTO>>> getCritical(
            @PathVariable String factoryId) {
        List<QualityCheckItemDTO> items = qualityCheckItemService.getCriticalItems(factoryId);
        return ResponseEntity.ok(ApiResponse.success(items));
    }

    /**
     * 获取所有启用的质检项
     */
    @GetMapping("/enabled")
    public ResponseEntity<ApiResponse<List<QualityCheckItemDTO>>> getEnabled(
            @PathVariable String factoryId) {
        List<QualityCheckItemDTO> items = qualityCheckItemService.getEnabledItems(factoryId);
        return ResponseEntity.ok(ApiResponse.success(items));
    }

    /**
     * 获取系统默认模板
     */
    @GetMapping("/templates")
    public ResponseEntity<ApiResponse<List<QualityCheckItemDTO>>> getSystemTemplates() {
        List<QualityCheckItemDTO> items = qualityCheckItemService.getSystemDefaultItems();
        return ResponseEntity.ok(ApiResponse.success(items));
    }

    // ==================== 统计接口 ====================

    /**
     * 获取统计信息
     */
    @GetMapping("/statistics")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getStatistics(
            @PathVariable String factoryId) {
        Map<String, Object> stats = qualityCheckItemService.getStatistics(factoryId);
        return ResponseEntity.ok(ApiResponse.success(stats));
    }

    /**
     * 按类别统计
     */
    @GetMapping("/statistics/by-category")
    public ResponseEntity<ApiResponse<Map<QualityCheckCategory, Long>>> countByCategory(
            @PathVariable String factoryId) {
        Map<QualityCheckCategory, Long> counts = qualityCheckItemService.countByCategory(factoryId);
        return ResponseEntity.ok(ApiResponse.success(counts));
    }

    // ==================== 批量操作 ====================

    /**
     * 批量启用
     */
    @PostMapping("/batch/enable")
    public ResponseEntity<ApiResponse<Integer>> batchEnable(
            @PathVariable String factoryId,
            @RequestBody List<String> itemIds) {
        int count = qualityCheckItemService.batchUpdateEnabled(itemIds, true);
        return ResponseEntity.ok(ApiResponse.success(count, "批量启用成功，共 " + count + " 项"));
    }

    /**
     * 批量禁用
     */
    @PostMapping("/batch/disable")
    public ResponseEntity<ApiResponse<Integer>> batchDisable(
            @PathVariable String factoryId,
            @RequestBody List<String> itemIds) {
        int count = qualityCheckItemService.batchUpdateEnabled(itemIds, false);
        return ResponseEntity.ok(ApiResponse.success(count, "批量禁用成功，共 " + count + " 项"));
    }

    /**
     * 从系统模板复制
     */
    @PostMapping("/copy-from-template")
    public ResponseEntity<ApiResponse<List<QualityCheckItemDTO>>> copyFromTemplate(
            @PathVariable String factoryId,
            HttpServletRequest httpRequest) {
        Long userId = getUserId(httpRequest);
        List<QualityCheckItemDTO> items = qualityCheckItemService.copyFromSystemTemplate(factoryId, userId);
        return ResponseEntity.ok(ApiResponse.success(items, "复制成功，共 " + items.size() + " 项"));
    }

    // ==================== 绑定管理 ====================

    /**
     * 绑定质检项到产品
     */
    @PostMapping("/bindings")
    public ResponseEntity<ApiResponse<QualityCheckItemBindingDTO>> bind(
            @PathVariable String factoryId,
            @Valid @RequestBody BindQualityCheckItemRequest request) {
        QualityCheckItemBindingDTO binding = qualityCheckItemService.bindToProduct(factoryId, request);
        return ResponseEntity.ok(ApiResponse.success(binding, "绑定成功"));
    }

    /**
     * 解除绑定
     */
    @DeleteMapping("/bindings/{bindingId}")
    public ResponseEntity<ApiResponse<Void>> unbind(
            @PathVariable String factoryId,
            @PathVariable String bindingId) {
        qualityCheckItemService.unbindFromProduct(factoryId, bindingId);
        return ResponseEntity.ok(ApiResponse.success(null, "解除绑定成功"));
    }

    /**
     * 更新绑定配置
     */
    @PutMapping("/bindings/{bindingId}")
    public ResponseEntity<ApiResponse<QualityCheckItemBindingDTO>> updateBinding(
            @PathVariable String factoryId,
            @PathVariable String bindingId,
            @Valid @RequestBody BindQualityCheckItemRequest request) {
        QualityCheckItemBindingDTO binding = qualityCheckItemService.updateBinding(factoryId, bindingId, request);
        return ResponseEntity.ok(ApiResponse.success(binding, "更新成功"));
    }

    /**
     * 获取产品的质检项绑定
     */
    @GetMapping("/bindings/product/{productTypeId}")
    public ResponseEntity<ApiResponse<List<QualityCheckItemBindingDTO>>> getProductBindings(
            @PathVariable String factoryId,
            @PathVariable String productTypeId) {
        List<QualityCheckItemBindingDTO> bindings = qualityCheckItemService.getProductBindings(factoryId, productTypeId);
        return ResponseEntity.ok(ApiResponse.success(bindings));
    }

    /**
     * 批量绑定质检项到产品
     */
    @PostMapping("/bindings/batch")
    public ResponseEntity<ApiResponse<List<QualityCheckItemBindingDTO>>> batchBind(
            @PathVariable String factoryId,
            @RequestParam String productTypeId,
            @RequestBody List<String> itemIds) {
        List<QualityCheckItemBindingDTO> bindings = qualityCheckItemService.batchBindToProduct(factoryId, productTypeId, itemIds);
        return ResponseEntity.ok(ApiResponse.success(bindings, "批量绑定成功，共 " + bindings.size() + " 项"));
    }

    /**
     * 检查绑定是否存在
     */
    @GetMapping("/bindings/exists")
    public ResponseEntity<ApiResponse<Boolean>> checkBindingExists(
            @PathVariable String factoryId,
            @RequestParam String productTypeId,
            @RequestParam String qualityCheckItemId) {
        boolean exists = qualityCheckItemService.isBindingExists(productTypeId, qualityCheckItemId);
        return ResponseEntity.ok(ApiResponse.success(exists));
    }

    /**
     * 验证检测值
     */
    @PostMapping("/{itemId}/validate")
    public ResponseEntity<ApiResponse<Boolean>> validateValue(
            @PathVariable String factoryId,
            @PathVariable String itemId,
            @RequestParam(required = false) String productTypeId,
            @RequestBody Object value) {
        boolean valid = qualityCheckItemService.validateCheckValue(factoryId, itemId, productTypeId, value);
        return ResponseEntity.ok(ApiResponse.success(valid, valid ? "合格" : "不合格"));
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

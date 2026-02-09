package com.cretas.aims.service;

import com.cretas.aims.dto.config.*;
import com.cretas.aims.entity.enums.QualityCheckCategory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;

/**
 * 质检项配置服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
public interface QualityCheckItemService {

    // ==================== 质检项 CRUD ====================

    /**
     * 创建质检项
     */
    QualityCheckItemDTO createQualityCheckItem(String factoryId, CreateQualityCheckItemRequest request, Long userId);

    /**
     * 更新质检项
     */
    QualityCheckItemDTO updateQualityCheckItem(String factoryId, String itemId, UpdateQualityCheckItemRequest request);

    /**
     * 删除质检项（软删除）
     */
    void deleteQualityCheckItem(String factoryId, String itemId);

    /**
     * 获取单个质检项
     */
    QualityCheckItemDTO getQualityCheckItem(String factoryId, String itemId);

    /**
     * 分页查询质检项
     */
    Page<QualityCheckItemDTO> getQualityCheckItems(String factoryId, Pageable pageable);

    // ==================== 查询方法 ====================

    /**
     * 按类别查询
     */
    List<QualityCheckItemDTO> getByCategory(String factoryId, QualityCheckCategory category);

    /**
     * 查询必检项
     */
    List<QualityCheckItemDTO> getRequiredItems(String factoryId);

    /**
     * 查询关键项（CRITICAL严重程度）
     */
    List<QualityCheckItemDTO> getCriticalItems(String factoryId);

    /**
     * 获取所有启用的质检项
     */
    List<QualityCheckItemDTO> getEnabledItems(String factoryId);

    /**
     * 获取系统默认质检项模板
     */
    List<QualityCheckItemDTO> getSystemDefaultItems();

    // ==================== 统计方法 ====================

    /**
     * 按类别统计
     */
    Map<QualityCheckCategory, Long> countByCategory(String factoryId);

    /**
     * 获取统计概览
     */
    Map<String, Object> getStatistics(String factoryId);

    // ==================== 批量操作 ====================

    /**
     * 批量启用/禁用
     */
    int batchUpdateEnabled(List<String> itemIds, boolean enabled);

    /**
     * 从系统模板复制质检项到工厂
     */
    List<QualityCheckItemDTO> copyFromSystemTemplate(String factoryId, Long userId);

    // ==================== 绑定管理 ====================

    /**
     * 绑定质检项到产品
     */
    QualityCheckItemBindingDTO bindToProduct(String factoryId, BindQualityCheckItemRequest request);

    /**
     * 解除绑定
     */
    void unbindFromProduct(String factoryId, String bindingId);

    /**
     * 更新绑定配置
     */
    QualityCheckItemBindingDTO updateBinding(String factoryId, String bindingId, BindQualityCheckItemRequest request);

    /**
     * 获取产品的所有质检项绑定
     */
    List<QualityCheckItemBindingDTO> getProductBindings(String factoryId, String productTypeId);

    /**
     * 批量绑定质检项到产品
     */
    List<QualityCheckItemBindingDTO> batchBindToProduct(String factoryId, String productTypeId, List<String> itemIds);

    /**
     * 检查绑定是否存在
     */
    boolean isBindingExists(String productTypeId, String qualityCheckItemId);

    /**
     * 验证检测值是否合格
     */
    boolean validateCheckValue(String factoryId, String itemId, String productTypeId, Object value);
}

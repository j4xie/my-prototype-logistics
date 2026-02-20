package com.cretas.aims.service;

import java.util.List;
import java.util.Map;

/**
 * 原材料规格配置服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-04
 */
public interface MaterialSpecConfigService {

    /**
     * 获取工厂的所有规格配置
     * @param factoryId 工厂ID
     * @return Map<类别, 规格列表>，例如 {"海鲜": ["整条", "切片"], "肉类": [...]}
     */
    Map<String, List<String>> getAllSpecConfigs(String factoryId);

    /**
     * 获取指定类别的规格配置
     * @param factoryId 工厂ID
     * @param category 类别名称
     * @return 规格列表
     */
    List<String> getSpecsByCategory(String factoryId, String category);

    /**
     * 更新指定类别的规格配置
     * @param factoryId 工厂ID
     * @param category 类别名称
     * @param specifications 规格列表
     */
    void updateCategorySpecs(String factoryId, String category, List<String> specifications);

    /**
     * 重置为系统默认配置
     * @param factoryId 工厂ID
     * @param category 类别名称
     * @return 默认规格列表
     */
    List<String> resetToDefault(String factoryId, String category);

    /**
     * 初始化工厂的默认规格配置
     * （工厂创建时调用）
     * @param factoryId 工厂ID
     */
    void initializeDefaultConfigs(String factoryId);

    /**
     * 获取系统默认配置
     * @return Map<类别, 规格列表>
     */
    Map<String, List<String>> getSystemDefaultConfigs();
}

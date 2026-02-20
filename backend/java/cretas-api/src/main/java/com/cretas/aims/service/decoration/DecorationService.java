package com.cretas.aims.service.decoration;

import com.cretas.aims.dto.decoration.*;

/**
 * 装饰服务接口
 * 管理工厂首页布局配置
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
public interface DecorationService {

    /**
     * 获取首页布局配置
     *
     * @param factoryId 工厂ID
     * @return 布局配置DTO
     */
    HomeLayoutDTO getHomeLayout(String factoryId);

    /**
     * 保存布局草稿
     *
     * @param factoryId 工厂ID
     * @param request 保存请求
     * @return 保存后的布局配置
     */
    HomeLayoutDTO saveDraft(String factoryId, HomeLayoutDTO.SaveRequest request);

    /**
     * 发布布局配置
     *
     * @param factoryId 工厂ID
     * @return 发布后的布局配置
     */
    HomeLayoutDTO publishLayout(String factoryId);

    /**
     * AI生成布局
     *
     * @param factoryId 工厂ID
     * @param request AI生成请求
     * @return AI生成响应
     */
    AILayoutResponse generateLayoutWithAI(String factoryId, AILayoutRequest request);

    /**
     * 获取智能布局建议
     *
     * @param factoryId 工厂ID
     * @return 布局建议
     */
    LayoutSuggestionDTO getSuggestions(String factoryId);

    /**
     * 记录模块点击事件
     *
     * @param factoryId 工厂ID
     * @param moduleId 模块ID
     */
    void recordModuleClick(String factoryId, String moduleId);

    /**
     * 重置为默认布局
     *
     * @param factoryId 工厂ID
     * @return 重置后的布局配置
     */
    HomeLayoutDTO resetToDefault(String factoryId);

    /**
     * 获取可用模块列表
     *
     * @param factoryId 工厂ID
     * @return 可用模块列表
     */
    java.util.List<HomeLayoutDTO.ModuleConfig> getAvailableModules(String factoryId);
}

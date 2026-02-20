package com.cretas.aims.service;

import com.cretas.aims.entity.LowcodeComponentDefinition;
import com.cretas.aims.entity.LowcodePageConfig;

import java.util.List;
import java.util.Optional;

/**
 * 低代码服务接口
 * 管理页面配置、组件定义等低代码相关功能
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
public interface LowcodeService {

    /**
     * 获取页面配置列表
     * 支持按工厂ID和角色代码筛选
     *
     * @param factoryId 工厂ID
     * @param roleCode  角色代码（可为null，返回所有）
     * @return 页面配置列表
     */
    List<LowcodePageConfig> getPages(String factoryId, String roleCode);

    /**
     * 获取单个页面配置
     * 支持配置继承逻辑：角色配置 -> 工厂默认 -> 系统默认
     *
     * @param factoryId 工厂ID
     * @param pageId    页面唯一标识
     * @param roleCode  角色代码
     * @return 页面配置（如果存在）
     */
    Optional<LowcodePageConfig> getPage(String factoryId, String pageId, String roleCode);

    /**
     * 创建新页面配置
     *
     * @param factoryId 工厂ID
     * @param config    页面配置
     * @return 创建后的页面配置
     */
    LowcodePageConfig createPage(String factoryId, LowcodePageConfig config);

    /**
     * 更新现有页面配置
     * 自动增加版本号
     *
     * @param factoryId 工厂ID
     * @param pageId    页面唯一标识
     * @param config    更新的页面配置
     * @return 更新后的页面配置
     */
    LowcodePageConfig updatePage(String factoryId, String pageId, LowcodePageConfig config);

    /**
     * 发布页面配置
     * 设置 status=1（已发布状态）
     *
     * @param factoryId 工厂ID
     * @param pageId    页面唯一标识
     * @return 发布后的页面配置
     */
    LowcodePageConfig publishPage(String factoryId, String pageId);

    /**
     * 删除页面配置
     *
     * @param factoryId 工厂ID
     * @param pageId    页面唯一标识
     */
    void deletePage(String factoryId, String pageId);

    /**
     * 获取组件定义列表
     * 返回系统组件 + 工厂自定义组件，按权限过滤
     *
     * @param factoryId 工厂ID
     * @param roleCode  角色代码（用于权限过滤）
     * @return 组件定义列表
     */
    List<LowcodeComponentDefinition> getComponents(String factoryId, String roleCode);

    /**
     * 获取单个组件定义
     *
     * @param componentType 组件类型标识
     * @return 组件定义（如果存在）
     */
    Optional<LowcodeComponentDefinition> getComponent(String componentType);
}

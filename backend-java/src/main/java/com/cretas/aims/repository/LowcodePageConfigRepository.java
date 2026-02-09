package com.cretas.aims.repository;

import com.cretas.aims.entity.LowcodePageConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 低代码页面配置数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-14
 */
@Repository
public interface LowcodePageConfigRepository extends JpaRepository<LowcodePageConfig, Long> {

    /**
     * 根据页面ID、工厂ID和角色代码查找配置
     * 用于获取特定角色的页面定制配置
     *
     * @param pageId 页面唯一标识
     * @param factoryId 工厂ID
     * @param roleCode 角色代码
     * @return 页面配置（如果存在）
     */
    Optional<LowcodePageConfig> findByPageIdAndFactoryIdAndRoleCode(String pageId, String factoryId, String roleCode);

    /**
     * 根据工厂ID和状态查找页面配置列表
     *
     * @param factoryId 工厂ID
     * @param status 状态（0-草稿, 1-已发布）
     * @return 页面配置列表
     */
    List<LowcodePageConfig> findByFactoryIdAndStatus(String factoryId, Integer status);

    /**
     * 根据工厂ID和页面类型查找页面配置列表
     *
     * @param factoryId 工厂ID
     * @param pageType 页面类型（home, dashboard, form, list, detail）
     * @return 页面配置列表
     */
    List<LowcodePageConfig> findByFactoryIdAndPageType(String factoryId, String pageType);

    /**
     * 根据工厂ID和页面ID查找配置
     * 用于获取工厂级别的通用页面配置
     *
     * @param factoryId 工厂ID
     * @param pageId 页面唯一标识
     * @return 页面配置（如果存在）
     */
    Optional<LowcodePageConfig> findByFactoryIdAndPageId(String factoryId, String pageId);
}

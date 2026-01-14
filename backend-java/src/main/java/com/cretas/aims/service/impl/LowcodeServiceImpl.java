package com.cretas.aims.service.impl;

import com.cretas.aims.entity.LowcodeComponentDefinition;
import com.cretas.aims.entity.LowcodePageConfig;
import com.cretas.aims.repository.LowcodeComponentDefinitionRepository;
import com.cretas.aims.repository.LowcodePageConfigRepository;
import com.cretas.aims.service.LowcodeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * 低代码服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LowcodeServiceImpl implements LowcodeService {

    private final LowcodePageConfigRepository pageConfigRepository;
    private final LowcodeComponentDefinitionRepository componentDefinitionRepository;

    /**
     * 系统默认工厂ID，用于系统级别的默认配置
     */
    private static final String SYSTEM_FACTORY_ID = "SYSTEM";

    @Override
    public List<LowcodePageConfig> getPages(String factoryId, String roleCode) {
        log.debug("获取页面配置列表: factoryId={}, roleCode={}", factoryId, roleCode);

        List<LowcodePageConfig> pages;

        if (roleCode != null && !roleCode.isEmpty()) {
            // 按角色筛选：获取指定角色的配置 + 工厂默认配置（roleCode为空）
            pages = pageConfigRepository.findAll().stream()
                    .filter(p -> factoryId.equals(p.getFactoryId()))
                    .filter(p -> roleCode.equals(p.getRoleCode()) || p.getRoleCode() == null || p.getRoleCode().isEmpty())
                    .collect(Collectors.toList());
        } else {
            // 获取工厂所有配置
            pages = pageConfigRepository.findAll().stream()
                    .filter(p -> factoryId.equals(p.getFactoryId()))
                    .collect(Collectors.toList());
        }

        log.debug("找到 {} 个页面配置", pages.size());
        return pages;
    }

    @Override
    public Optional<LowcodePageConfig> getPage(String factoryId, String pageId, String roleCode) {
        log.debug("获取页面配置: factoryId={}, pageId={}, roleCode={}", factoryId, pageId, roleCode);

        // 配置继承逻辑：角色配置 -> 工厂默认 -> 系统默认

        // 1. 优先查找角色级别的配置
        if (roleCode != null && !roleCode.isEmpty()) {
            Optional<LowcodePageConfig> roleConfig = pageConfigRepository
                    .findByPageIdAndFactoryIdAndRoleCode(pageId, factoryId, roleCode);
            if (roleConfig.isPresent()) {
                log.debug("找到角色级别配置: roleCode={}", roleCode);
                return roleConfig;
            }
        }

        // 2. 查找工厂默认配置（roleCode为空或null）
        Optional<LowcodePageConfig> factoryConfig = pageConfigRepository
                .findByFactoryIdAndPageId(factoryId, pageId);
        if (factoryConfig.isPresent() &&
            (factoryConfig.get().getRoleCode() == null || factoryConfig.get().getRoleCode().isEmpty())) {
            log.debug("找到工厂默认配置: factoryId={}", factoryId);
            return factoryConfig;
        }

        // 3. 查找系统默认配置
        Optional<LowcodePageConfig> systemConfig = pageConfigRepository
                .findByFactoryIdAndPageId(SYSTEM_FACTORY_ID, pageId);
        if (systemConfig.isPresent()) {
            log.debug("使用系统默认配置: pageId={}", pageId);
            return systemConfig;
        }

        log.debug("未找到页面配置: pageId={}", pageId);
        return Optional.empty();
    }

    @Override
    @Transactional
    public LowcodePageConfig createPage(String factoryId, LowcodePageConfig config) {
        log.info("创建页面配置: factoryId={}, pageId={}", factoryId, config.getPageId());

        // 设置工厂ID
        config.setFactoryId(factoryId);

        // 初始化版本号和状态
        if (config.getVersion() == null) {
            config.setVersion(1);
        }
        if (config.getStatus() == null) {
            config.setStatus(0); // 默认为草稿状态
        }

        LowcodePageConfig saved = pageConfigRepository.save(config);
        log.info("页面配置已创建: id={}, pageId={}", saved.getId(), saved.getPageId());

        return saved;
    }

    @Override
    @Transactional
    public LowcodePageConfig updatePage(String factoryId, String pageId, LowcodePageConfig config) {
        log.info("更新页面配置: factoryId={}, pageId={}", factoryId, pageId);

        // 查找现有配置
        LowcodePageConfig existing = pageConfigRepository.findByFactoryIdAndPageId(factoryId, pageId)
                .orElseThrow(() -> new IllegalArgumentException("页面配置不存在: pageId=" + pageId));

        // 更新配置字段
        if (config.getPageName() != null) {
            existing.setPageName(config.getPageName());
        }
        if (config.getPageType() != null) {
            existing.setPageType(config.getPageType());
        }
        if (config.getLayoutConfig() != null) {
            existing.setLayoutConfig(config.getLayoutConfig());
        }
        if (config.getThemeConfig() != null) {
            existing.setThemeConfig(config.getThemeConfig());
        }
        if (config.getDataBindings() != null) {
            existing.setDataBindings(config.getDataBindings());
        }
        if (config.getEventHandlers() != null) {
            existing.setEventHandlers(config.getEventHandlers());
        }
        if (config.getPermissions() != null) {
            existing.setPermissions(config.getPermissions());
        }
        if (config.getRoleCode() != null) {
            existing.setRoleCode(config.getRoleCode());
        }
        if (config.getAiGenerated() != null) {
            existing.setAiGenerated(config.getAiGenerated());
        }
        if (config.getAiPrompt() != null) {
            existing.setAiPrompt(config.getAiPrompt());
        }
        if (config.getParentConfigId() != null) {
            existing.setParentConfigId(config.getParentConfigId());
        }

        // 增加版本号
        existing.setVersion(existing.getVersion() + 1);

        LowcodePageConfig saved = pageConfigRepository.save(existing);
        log.info("页面配置已更新: id={}, version={}", saved.getId(), saved.getVersion());

        return saved;
    }

    @Override
    @Transactional
    public LowcodePageConfig publishPage(String factoryId, String pageId) {
        log.info("发布页面配置: factoryId={}, pageId={}", factoryId, pageId);

        LowcodePageConfig config = pageConfigRepository.findByFactoryIdAndPageId(factoryId, pageId)
                .orElseThrow(() -> new IllegalArgumentException("页面配置不存在: pageId=" + pageId));

        // 设置为已发布状态
        config.setStatus(1);
        config.setVersion(config.getVersion() + 1);

        LowcodePageConfig saved = pageConfigRepository.save(config);
        log.info("页面配置已发布: id={}, version={}", saved.getId(), saved.getVersion());

        return saved;
    }

    @Override
    @Transactional
    public void deletePage(String factoryId, String pageId) {
        log.info("删除页面配置: factoryId={}, pageId={}", factoryId, pageId);

        LowcodePageConfig config = pageConfigRepository.findByFactoryIdAndPageId(factoryId, pageId)
                .orElseThrow(() -> new IllegalArgumentException("页面配置不存在: pageId=" + pageId));

        pageConfigRepository.delete(config);
        log.info("页面配置已删除: id={}", config.getId());
    }

    @Override
    public List<LowcodeComponentDefinition> getComponents(String factoryId, String roleCode) {
        log.debug("获取组件定义列表: factoryId={}, roleCode={}", factoryId, roleCode);

        List<LowcodeComponentDefinition> components = new ArrayList<>();

        // 1. 获取所有启用的系统组件
        List<LowcodeComponentDefinition> systemComponents = componentDefinitionRepository
                .findByStatusOrderBySortOrderAsc(1).stream()
                .filter(c -> c.getIsSystem() != null && c.getIsSystem() == 1)
                .collect(Collectors.toList());
        components.addAll(systemComponents);

        // 2. 获取工厂自定义组件
        List<LowcodeComponentDefinition> factoryComponents = componentDefinitionRepository
                .findByIsSystemOrFactoryId(0, factoryId).stream()
                .filter(c -> c.getStatus() != null && c.getStatus() == 1)
                .filter(c -> factoryId.equals(c.getFactoryId()))
                .collect(Collectors.toList());
        components.addAll(factoryComponents);

        // 3. 按权限过滤（如果需要基于roleCode进行过滤）
        // 这里可以扩展实现基于角色的组件权限控制
        // 目前简单返回所有可用组件

        // 按sortOrder排序
        components.sort((a, b) -> {
            int orderA = a.getSortOrder() != null ? a.getSortOrder() : Integer.MAX_VALUE;
            int orderB = b.getSortOrder() != null ? b.getSortOrder() : Integer.MAX_VALUE;
            return Integer.compare(orderA, orderB);
        });

        log.debug("找到 {} 个组件定义（系统: {}, 工厂自定义: {}）",
                components.size(), systemComponents.size(), factoryComponents.size());

        return components;
    }

    @Override
    public Optional<LowcodeComponentDefinition> getComponent(String componentType) {
        log.debug("获取组件定义: componentType={}", componentType);

        Optional<LowcodeComponentDefinition> component = componentDefinitionRepository
                .findByComponentType(componentType);

        if (component.isPresent()) {
            log.debug("找到组件定义: id={}, name={}",
                    component.get().getId(), component.get().getName());
        } else {
            log.debug("未找到组件定义: componentType={}", componentType);
        }

        return component;
    }
}

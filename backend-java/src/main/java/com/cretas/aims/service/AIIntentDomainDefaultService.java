package com.cretas.aims.service;

import com.cretas.aims.entity.config.AIIntentDomainDefault;

import java.util.List;
import java.util.Optional;

/**
 * AI意图域默认配置服务接口
 *
 * 提供域默认意图的查询和管理功能:
 * - 根据域名获取默认意图
 * - 支持工厂级覆盖平台级配置
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-10
 */
public interface AIIntentDomainDefaultService {

    /**
     * 获取主默认意图代码
     * 查找顺序: 工厂级配置 -> 平台级配置
     *
     * @param factoryId 工厂ID（可为null，表示只查平台级）
     * @param domainName 域名（如SCALE, ALERT等）
     * @return 主默认意图代码，如果未找到则返回空
     */
    Optional<String> getPrimaryIntent(String factoryId, String domainName);

    /**
     * 获取次默认意图代码
     * 查找顺序: 工厂级配置 -> 平台级配置
     *
     * @param factoryId 工厂ID（可为null，表示只查平台级）
     * @param domainName 域名（如SCALE, ALERT等）
     * @return 次默认意图代码，如果未找到或未配置则返回空
     */
    Optional<String> getSecondaryIntent(String factoryId, String domainName);

    /**
     * 获取域默认配置实体
     * 查找顺序: 工厂级配置 -> 平台级配置
     *
     * @param factoryId 工厂ID（可为null，表示只查平台级）
     * @param domainName 域名
     * @return 域默认配置实体
     */
    Optional<AIIntentDomainDefault> getDomainDefault(String factoryId, String domainName);

    /**
     * 获取工厂可见的所有域默认配置
     * 包含工厂级和平台级配置
     *
     * @param factoryId 工厂ID
     * @return 域默认配置列表
     */
    List<AIIntentDomainDefault> getVisibleDomainDefaults(String factoryId);

    /**
     * 获取所有平台级域默认配置
     *
     * @return 平台级域默认配置列表
     */
    List<AIIntentDomainDefault> getAllPlatformDefaults();

    /**
     * 获取所有已配置的域名列表
     *
     * @return 域名列表
     */
    List<String> getAllDomainNames();

    /**
     * 创建或更新域默认配置
     *
     * @param factoryId 工厂ID（null表示平台级）
     * @param domainName 域名
     * @param primaryIntentCode 主默认意图代码
     * @param secondaryIntentCode 次默认意图代码（可为null）
     * @return 创建或更新后的配置实体
     */
    AIIntentDomainDefault saveOrUpdate(String factoryId, String domainName,
                                        String primaryIntentCode, String secondaryIntentCode);

    /**
     * 删除域默认配置（软删除）
     *
     * @param id 配置ID
     */
    void delete(String id);

    /**
     * 检查域默认配置是否存在
     *
     * @param factoryId 工厂ID（null表示平台级）
     * @param domainName 域名
     * @return 是否存在
     */
    boolean exists(String factoryId, String domainName);
}

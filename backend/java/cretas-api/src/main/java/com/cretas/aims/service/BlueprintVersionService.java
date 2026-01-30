package com.cretas.aims.service;

import com.cretas.aims.dto.blueprint.*;

import java.util.List;

/**
 * 蓝图版本管理服务接口
 *
 * Sprint 3 任务: S3-7 蓝图版本管理
 *
 * 功能说明:
 * 1. 版本历史管理 - 记录蓝图的每次变更
 * 2. 版本发布 - 创建正式发布版本
 * 3. 版本推送 - 通知绑定工厂有新版本
 * 4. 工厂升级 - 将工厂升级到新蓝图版本
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
public interface BlueprintVersionService {

    // ==================== 版本历史管理 ====================

    /**
     * 获取蓝图的版本历史
     *
     * @param blueprintId 蓝图ID
     * @return 版本历史列表 (按版本号降序)
     */
    List<BlueprintVersionDTO> getVersionHistory(String blueprintId);

    /**
     * 获取特定版本详情
     *
     * @param blueprintId 蓝图ID
     * @param version 版本号
     * @return 版本详情
     */
    BlueprintVersionDTO getVersion(String blueprintId, Integer version);

    /**
     * 获取蓝图的最新版本
     *
     * @param blueprintId 蓝图ID
     * @return 最新版本详情
     */
    BlueprintVersionDTO getLatestVersion(String blueprintId);

    /**
     * 创建新版本 (蓝图更新时自动调用)
     *
     * @param blueprintId 蓝图ID
     * @param changeType 变更类型
     * @param changeDescription 变更说明
     * @param createdBy 创建人
     * @return 新版本信息
     */
    BlueprintVersionDTO createVersion(String blueprintId, String changeType,
                                       String changeDescription, Long createdBy);

    /**
     * 比较两个版本的差异
     *
     * @param blueprintId 蓝图ID
     * @param fromVersion 起始版本
     * @param toVersion 目标版本
     * @return 差异摘要
     */
    BlueprintVersionDTO.VersionChangeSummary compareVersions(String blueprintId,
                                                              Integer fromVersion, Integer toVersion);

    // ==================== 版本发布 ====================

    /**
     * 发布新版本
     * 将当前蓝图状态标记为正式发布版本
     *
     * @param blueprintId 蓝图ID
     * @param request 发布请求
     * @return 发布的版本信息
     */
    BlueprintVersionDTO publishVersion(String blueprintId, PublishVersionRequest request);

    /**
     * 获取所有发布版本
     *
     * @param blueprintId 蓝图ID
     * @return 发布版本列表
     */
    List<BlueprintVersionDTO> getPublishedVersions(String blueprintId);

    // ==================== 工厂绑定管理 ====================

    /**
     * 获取蓝图绑定的所有工厂
     *
     * @param blueprintId 蓝图ID
     * @return 绑定的工厂列表
     */
    List<FactoryBindingDTO> getBindingFactories(String blueprintId);

    /**
     * 获取工厂的蓝图绑定信息
     *
     * @param factoryId 工厂ID
     * @return 绑定信息
     */
    FactoryBindingDTO getFactoryBinding(String factoryId);

    /**
     * 创建工厂蓝图绑定
     *
     * @param factoryId 工厂ID
     * @param blueprintId 蓝图ID
     * @param version 应用的版本
     * @return 绑定信息
     */
    FactoryBindingDTO createBinding(String factoryId, String blueprintId, Integer version);

    /**
     * 更新绑定设置 (自动更新策略等)
     *
     * @param factoryId 工厂ID
     * @param autoUpdate 是否自动更新
     * @param updatePolicy 更新策略
     * @return 更新后的绑定信息
     */
    FactoryBindingDTO updateBindingSettings(String factoryId, Boolean autoUpdate, String updatePolicy);

    // ==================== 版本升级推送 ====================

    /**
     * 获取需要升级的工厂列表
     * 返回所有使用旧版本蓝图的工厂
     *
     * @param blueprintId 蓝图ID
     * @return 需要升级的工厂列表
     */
    List<FactoryBindingDTO> getOutdatedFactories(String blueprintId);

    /**
     * 升级单个工厂到新版本
     *
     * @param factoryId 工厂ID
     * @param request 升级请求
     * @return 升级结果
     */
    VersionUpgradeResult upgradeFactory(String factoryId, UpgradeFactoryRequest request);

    /**
     * 批量升级工厂
     *
     * @param factoryIds 工厂ID列表
     * @param request 升级请求
     * @return 升级结果列表
     */
    List<VersionUpgradeResult> batchUpgradeFactories(List<String> factoryIds, UpgradeFactoryRequest request);

    /**
     * 预览升级效果 (dry-run)
     *
     * @param factoryId 工厂ID
     * @param targetVersion 目标版本
     * @return 预览结果
     */
    VersionUpgradeResult previewUpgrade(String factoryId, Integer targetVersion);

    /**
     * 通知工厂有新版本可用
     *
     * @param blueprintId 蓝图ID
     * @param version 新版本号
     */
    void notifyFactoriesOfNewVersion(String blueprintId, Integer version);

    /**
     * 执行自动更新
     * 检查并自动升级配置了自动更新的工厂
     *
     * @param blueprintId 蓝图ID
     * @return 自动升级的工厂数量
     */
    int processAutoUpdates(String blueprintId);

    /**
     * 回滚工厂到指定版本
     *
     * @param factoryId 工厂ID
     * @param targetVersion 目标版本
     * @param reason 回滚原因
     * @return 回滚结果
     */
    VersionUpgradeResult rollbackFactory(String factoryId, Integer targetVersion, String reason);
}

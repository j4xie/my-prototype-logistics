package com.cretas.aims.service;

import com.cretas.aims.entity.config.ConfigChangeSet;
import com.cretas.aims.entity.config.ConfigChangeSet.ConfigType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;

/**
 * 配置变更集服务接口
 *
 * 核心功能:
 * 1. 创建变更集 - 自动生成差异
 * 2. 预览差异 - 前端展示变更内容
 * 3. 审批/拒绝 - 变更审批流程
 * 4. 应用变更 - 使变更生效
 * 5. 回滚变更 - 撤销已应用的变更
 *
 * @author Cretas Team
 * @since 2025-12-30
 */
public interface ConfigChangeSetService {

    // ========== 创建与查询 ==========

    /**
     * 创建配置变更集
     *
     * @param factoryId 工厂ID
     * @param configType 配置类型
     * @param configId 配置ID
     * @param configName 配置名称
     * @param beforeSnapshot 变更前快照 (JSON)
     * @param afterSnapshot 变更后快照 (JSON)
     * @param createdBy 创建者ID
     * @param createdByName 创建者名称
     * @return 创建的变更集
     */
    ConfigChangeSet createChangeSet(
            String factoryId,
            ConfigType configType,
            String configId,
            String configName,
            String beforeSnapshot,
            String afterSnapshot,
            Long createdBy,
            String createdByName);

    /**
     * 获取变更集详情
     */
    ConfigChangeSet getChangeSetById(String changeSetId);

    /**
     * 分页查询工厂的变更集
     */
    Page<ConfigChangeSet> getChangeSets(String factoryId, Pageable pageable);

    /**
     * 按状态查询变更集
     */
    Page<ConfigChangeSet> getChangeSetsByStatus(
            String factoryId, ConfigChangeSet.ChangeStatus status, Pageable pageable);

    /**
     * 获取待审批的变更集列表
     */
    List<ConfigChangeSet> getPendingChangeSets(String factoryId);

    /**
     * 统计待审批数量
     */
    long countPendingChangeSets(String factoryId);

    /**
     * 获取配置的变更历史
     */
    List<ConfigChangeSet> getChangeHistory(ConfigType configType, String configId);

    // ========== 差异预览 ==========

    /**
     * 预览变更差异
     *
     * @param changeSetId 变更集ID
     * @return 差异详情 Map，包含:
     *         - beforeSnapshot: 变更前配置
     *         - afterSnapshot: 变更后配置
     *         - diff: 结构化差异
     *         - summary: 人类可读摘要
     */
    Map<String, Object> previewDiff(String changeSetId);

    /**
     * 计算两个JSON配置的差异
     *
     * @param beforeJson 变更前JSON
     * @param afterJson 变更后JSON
     * @return 差异JSON，格式: { "added": [...], "removed": [...], "modified": [...] }
     */
    String computeDiff(String beforeJson, String afterJson);

    /**
     * 生成变更摘要 (人类可读)
     */
    String generateChangeSummary(String diffJson, ConfigType configType);

    // ========== 审批流程 ==========

    /**
     * 审批通过变更集
     *
     * @param changeSetId 变更集ID
     * @param approverId 审批者ID
     * @param approverName 审批者名称
     * @param comment 审批备注
     * @return 更新后的变更集
     */
    ConfigChangeSet approveChangeSet(
            String changeSetId,
            Long approverId,
            String approverName,
            String comment);

    /**
     * 拒绝变更集
     *
     * @param changeSetId 变更集ID
     * @param approverId 审批者ID
     * @param approverName 审批者名称
     * @param reason 拒绝原因
     * @return 更新后的变更集
     */
    ConfigChangeSet rejectChangeSet(
            String changeSetId,
            Long approverId,
            String approverName,
            String reason);

    // ========== 应用与回滚 ==========

    /**
     * 应用变更集 (使变更生效)
     *
     * @param changeSetId 变更集ID
     * @return 更新后的变更集
     */
    ConfigChangeSet applyChangeSet(String changeSetId);

    /**
     * 回滚变更集
     *
     * @param changeSetId 变更集ID
     * @param userId 操作者ID
     * @param reason 回滚原因
     * @return 更新后的变更集
     */
    ConfigChangeSet rollbackChangeSet(String changeSetId, Long userId, String reason);

    /**
     * 获取可回滚的变更集列表
     */
    List<ConfigChangeSet> getRollbackableChangeSets(String factoryId);

    // ========== 辅助方法 ==========

    /**
     * 检查是否有待处理的变更
     */
    boolean hasPendingChange(String configId);

    /**
     * 获取配置的当前版本号
     */
    Integer getCurrentVersion(String configId);

    /**
     * 按配置类型统计各状态数量
     */
    Map<String, Long> getStatusStatistics(String factoryId, ConfigType configType);

    // ========== Dry-Run 预览 ==========

    /**
     * Dry-run 预览变更效果
     * 在创建 ChangeSet 之前，预览即将产生的差异
     *
     * @param configType 配置类型
     * @param configId 配置ID
     * @param configName 配置名称
     * @param beforeSnapshot 变更前快照 (JSON)
     * @param afterSnapshot 变更后快照 (JSON)
     * @return 预览结果，包含:
     *         - diff: 结构化差异
     *         - changeSummary: 人类可读摘要
     *         - fromVersion: 当前版本号
     *         - toVersion: 变更后版本号
     *         - hasPendingChange: 是否有未完成的变更
     *         - warnings: 潜在问题警告列表
     */
    Map<String, Object> dryRun(
            ConfigType configType,
            String configId,
            String configName,
            String beforeSnapshot,
            String afterSnapshot);
}

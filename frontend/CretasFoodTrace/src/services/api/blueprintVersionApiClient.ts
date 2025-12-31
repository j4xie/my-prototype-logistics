/**
 * 蓝图版本管理 API 客户端
 *
 * Sprint 3 任务: S3-8 蓝图管理界面
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */

import { apiClient } from './apiClient';
import { logger } from '../../utils/logger';

const blueprintLogger = logger.createContextLogger('BlueprintVersionAPI');

// ==================== 类型定义 ====================

export interface BlueprintVersion {
  id: string;
  blueprintId: string;
  version: number;
  changeType: 'CREATE' | 'UPDATE' | 'PUBLISH' | 'DEPRECATE';
  changeDescription?: string;
  changeSummary?: VersionChangeSummary;
  isPublished: boolean;
  publishedAt?: string;
  createdBy?: number;
  createdAt: string;
}

export interface VersionChangeSummary {
  formChanges?: string[];
  ruleChanges?: string[];
  productTypeChanges?: string[];
  addedFields?: string[];
  removedFields?: string[];
  modifiedFields?: string[];
}

export interface FactoryBinding {
  id: string;
  factoryId: string;
  factoryName?: string;
  blueprintId: string;
  blueprintName?: string;
  appliedVersion: number;
  latestVersion: number;
  autoUpdate: boolean;
  updatePolicy: 'MANUAL' | 'AUTO_MINOR' | 'AUTO_ALL';
  lastAppliedAt?: string;
  pendingVersion?: number;
  notificationStatus: 'NONE' | 'PENDING' | 'NOTIFIED' | 'DISMISSED';
  needsUpgrade: boolean;
  versionsBehind?: number;
}

export interface PublishVersionRequest {
  releaseNotes: string;
  notify?: boolean;
}

export interface UpgradeFactoryRequest {
  targetVersion?: number;
  force?: boolean;
  reason?: string;
}

export interface VersionUpgradeResult {
  success: boolean;
  factoryId: string;
  fromVersion?: number;
  toVersion?: number;
  summary: string;
  appliedChanges?: string[];
  errors?: string[];
  warnings?: string[];
}

// ==================== API 客户端 ====================

class BlueprintVersionApiClient {
  private basePath = '/api/platform/blueprints';

  // ==================== 版本历史 ====================

  /**
   * 获取版本历史
   */
  async getVersionHistory(blueprintId: string): Promise<BlueprintVersion[]> {
    blueprintLogger.debug('获取版本历史', { blueprintId });

    const response = await apiClient.get<{ success: boolean; data: BlueprintVersion[] }>(
      `${this.basePath}/${blueprintId}/versions`
    );

    if (response.success && response.data) {
      blueprintLogger.info('版本历史加载成功', { count: response.data.length });
      return response.data;
    }

    blueprintLogger.warn('版本历史响应格式异常', { response });
    return [];
  }

  /**
   * 获取指定版本
   */
  async getVersion(blueprintId: string, version: number): Promise<BlueprintVersion | null> {
    blueprintLogger.debug('获取指定版本', { blueprintId, version });

    const response = await apiClient.get<{ success: boolean; data: BlueprintVersion }>(
      `${this.basePath}/${blueprintId}/versions/${version}`
    );

    if (response.success && response.data) {
      return response.data;
    }

    return null;
  }

  /**
   * 获取最新版本
   */
  async getLatestVersion(blueprintId: string): Promise<BlueprintVersion | null> {
    blueprintLogger.debug('获取最新版本', { blueprintId });

    const response = await apiClient.get<{ success: boolean; data: BlueprintVersion }>(
      `${this.basePath}/${blueprintId}/versions/latest`
    );

    if (response.success && response.data) {
      return response.data;
    }

    return null;
  }

  /**
   * 获取发布版本列表
   */
  async getPublishedVersions(blueprintId: string): Promise<BlueprintVersion[]> {
    blueprintLogger.debug('获取发布版本列表', { blueprintId });

    const response = await apiClient.get<{ success: boolean; data: BlueprintVersion[] }>(
      `${this.basePath}/${blueprintId}/versions/published`
    );

    if (response.success && response.data) {
      return response.data;
    }

    return [];
  }

  /**
   * 比较版本差异
   */
  async compareVersions(
    blueprintId: string,
    fromVersion: number,
    toVersion: number
  ): Promise<VersionChangeSummary | null> {
    blueprintLogger.debug('比较版本差异', { blueprintId, fromVersion, toVersion });

    const response = await apiClient.get<{ success: boolean; data: VersionChangeSummary }>(
      `${this.basePath}/${blueprintId}/versions/compare`,
      { params: { fromVersion, toVersion } }
    );

    if (response.success && response.data) {
      return response.data;
    }

    return null;
  }

  // ==================== 版本发布 ====================

  /**
   * 发布新版本
   */
  async publishVersion(
    blueprintId: string,
    request: PublishVersionRequest
  ): Promise<BlueprintVersion | null> {
    blueprintLogger.info('发布新版本', { blueprintId });

    const response = await apiClient.post<{ success: boolean; data: BlueprintVersion }>(
      `${this.basePath}/${blueprintId}/versions/publish`,
      request
    );

    if (response.success && response.data) {
      blueprintLogger.info('版本发布成功', { version: response.data.version });
      return response.data;
    }

    return null;
  }

  // ==================== 工厂绑定管理 ====================

  /**
   * 获取绑定的工厂列表
   */
  async getBindingFactories(blueprintId: string): Promise<FactoryBinding[]> {
    blueprintLogger.debug('获取绑定工厂列表', { blueprintId });

    const response = await apiClient.get<{ success: boolean; data: FactoryBinding[] }>(
      `${this.basePath}/${blueprintId}/bindings`
    );

    if (response.success && response.data) {
      blueprintLogger.info('绑定工厂列表加载成功', { count: response.data.length });
      return response.data;
    }

    return [];
  }

  /**
   * 获取工厂的蓝图绑定信息
   */
  async getFactoryBinding(factoryId: string): Promise<FactoryBinding | null> {
    blueprintLogger.debug('获取工厂绑定信息', { factoryId });

    const response = await apiClient.get<{ success: boolean; data: FactoryBinding }>(
      `${this.basePath}/factory/${factoryId}/binding`
    );

    if (response.success && response.data) {
      return response.data;
    }

    return null;
  }

  /**
   * 更新绑定设置
   */
  async updateBindingSettings(
    factoryId: string,
    autoUpdate?: boolean,
    updatePolicy?: string
  ): Promise<FactoryBinding | null> {
    blueprintLogger.info('更新绑定设置', { factoryId, autoUpdate, updatePolicy });

    const params: Record<string, string | boolean | undefined> = {};
    if (autoUpdate !== undefined) params.autoUpdate = autoUpdate;
    if (updatePolicy) params.updatePolicy = updatePolicy;

    const response = await apiClient.put<{ success: boolean; data: FactoryBinding }>(
      `${this.basePath}/factory/${factoryId}/binding/settings`,
      null,
      { params }
    );

    if (response.success && response.data) {
      return response.data;
    }

    return null;
  }

  // ==================== 版本升级 ====================

  /**
   * 获取需要升级的工厂列表
   */
  async getOutdatedFactories(blueprintId: string): Promise<FactoryBinding[]> {
    blueprintLogger.debug('获取需要升级的工厂', { blueprintId });

    const response = await apiClient.get<{ success: boolean; data: FactoryBinding[] }>(
      `${this.basePath}/${blueprintId}/outdated-factories`
    );

    if (response.success && response.data) {
      return response.data;
    }

    return [];
  }

  /**
   * 升级工厂版本
   */
  async upgradeFactory(
    factoryId: string,
    request: UpgradeFactoryRequest
  ): Promise<VersionUpgradeResult | null> {
    blueprintLogger.info('升级工厂版本', { factoryId, targetVersion: request.targetVersion });

    const response = await apiClient.post<{ success: boolean; data: VersionUpgradeResult }>(
      `${this.basePath}/factory/${factoryId}/upgrade`,
      request
    );

    if (response.success && response.data) {
      blueprintLogger.info('工厂升级结果', { success: response.data.success });
      return response.data;
    }

    return null;
  }

  /**
   * 批量升级工厂
   */
  async batchUpgradeFactories(
    factoryIds: string[],
    request: UpgradeFactoryRequest
  ): Promise<VersionUpgradeResult[]> {
    blueprintLogger.info('批量升级工厂', { count: factoryIds.length });

    const response = await apiClient.post<{ success: boolean; data: VersionUpgradeResult[] }>(
      `${this.basePath}/batch-upgrade`,
      request,
      { params: { factoryIds: factoryIds.join(',') } }
    );

    if (response.success && response.data) {
      return response.data;
    }

    return [];
  }

  /**
   * 预览升级效果
   */
  async previewUpgrade(
    factoryId: string,
    targetVersion?: number
  ): Promise<VersionUpgradeResult | null> {
    blueprintLogger.debug('预览升级效果', { factoryId, targetVersion });

    const params: Record<string, number | undefined> = {};
    if (targetVersion) params.targetVersion = targetVersion;

    const response = await apiClient.get<{ success: boolean; data: VersionUpgradeResult }>(
      `${this.basePath}/factory/${factoryId}/upgrade/preview`,
      { params }
    );

    if (response.success && response.data) {
      return response.data;
    }

    return null;
  }

  /**
   * 回滚工厂版本
   */
  async rollbackFactory(
    factoryId: string,
    targetVersion: number,
    reason?: string
  ): Promise<VersionUpgradeResult | null> {
    blueprintLogger.info('回滚工厂版本', { factoryId, targetVersion, reason });

    const response = await apiClient.post<{ success: boolean; data: VersionUpgradeResult }>(
      `${this.basePath}/factory/${factoryId}/rollback`,
      null,
      { params: { targetVersion, reason: reason || '手动回滚' } }
    );

    if (response.success && response.data) {
      return response.data;
    }

    return null;
  }

  /**
   * 通知工厂新版本
   */
  async notifyFactories(blueprintId: string, version: number): Promise<boolean> {
    blueprintLogger.info('通知工厂新版本', { blueprintId, version });

    const response = await apiClient.post<{ success: boolean }>(
      `${this.basePath}/${blueprintId}/notify-factories`,
      null,
      { params: { version } }
    );

    return response.success;
  }

  /**
   * 执行自动更新
   */
  async processAutoUpdates(blueprintId: string): Promise<number> {
    blueprintLogger.info('执行自动更新', { blueprintId });

    const response = await apiClient.post<{ success: boolean; data: { upgradedCount: number } }>(
      `${this.basePath}/${blueprintId}/process-auto-updates`
    );

    if (response.success && response.data) {
      return response.data.upgradedCount;
    }

    return 0;
  }
}

export const blueprintVersionApiClient = new BlueprintVersionApiClient();

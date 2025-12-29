import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 工厂设置管理API客户端 - MVP精简版
 * MVP保留：8个核心API（基础设置+AI设置+库存设置+生产设置）
 * 已移除：14个高级API（通知、工作时间、批量操作、导入导出等）
 * 路径：/api/mobile/{factoryId}/factory-settings/*
 *
 * 业务场景：管理工厂的基础配置、AI参数、库存规则、生产参数
 */

class FactorySettingsApiClient {
  private getPath(factoryId?: string) {
    // 注意：后端路径是 /settings，不是 /factory-settings
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/settings`;
  }

  // ===== 基础设置 (2个API) =====

  // 1. 获取工厂基本设置
  // 后端端点: GET /api/mobile/{factoryId}/settings (根路径)
  async getBasicSettings(factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}`);
  }

  // 2. 更新工厂基本设置
  // 后端端点: PUT /api/mobile/{factoryId}/settings (根路径)
  async updateBasicSettings(data: any, factoryId?: string) {
    return await apiClient.put(`${this.getPath(factoryId)}`, data);
  }

  // ===== AI设置 (2个API) =====

  // 3. 获取AI设置
  async getAISettings(factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/ai`);
  }

  // 4. 更新AI设置
  async updateAISettings(data: any, factoryId?: string) {
    return await apiClient.put(`${this.getPath(factoryId)}/ai`, data);
  }

  // ===== 库存设置 (2个API) =====

  // 5. 获取库存设置
  async getInventorySettings(factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/inventory`);
  }

  // 6. 更新库存设置
  async updateInventorySettings(data: any, factoryId?: string) {
    return await apiClient.put(`${this.getPath(factoryId)}/inventory`, data);
  }

  // ===== 生产设置 (2个API) =====

  // 7. 获取生产设置（工作时间、班次等）
  async getProductionSettings(factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/production`);
  }

  // 8. 更新生产设置
  async updateProductionSettings(data: any, factoryId?: string) {
    return await apiClient.put(`${this.getPath(factoryId)}/production`, data);
  }

  // ===== AI使用统计（可选功能） =====
  
  // 9. 获取AI使用统计
  async getAIUsageStats(factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/ai/usage-stats`);
  }

  // ===== MVP暂不使用的功能 =====
  /*
   * 以下功能在MVP阶段暂不实现，后续根据需要逐步添加：
   *
   * 通知设置相关（2个）：
   * - getNotificationSettings: 获取通知设置（MVP暂不需要推送通知配置）
   * - updateNotificationSettings: 更新通知设置
   *   GET/PUT /api/mobile/{factoryId}/factory-settings/notifications
   *
   * 工作时间设置（2个）：
   * - getWorkTimeSettings: 获取工作时间设置（已合并到生产设置中）
   * - updateWorkTimeSettings: 更新工作时间设置
   *   GET/PUT /api/mobile/{factoryId}/factory-settings/work-time
   *
   * 质量标准设置（2个）：
   * - getQualityStandards: 获取质量标准（后期质检模块需要）
   * - updateQualityStandards: 更新质量标准
   *   GET/PUT /api/mobile/{factoryId}/factory-settings/quality-standards
   *
   * 批量操作（1个）：
   * - batchUpdateSettings: 批量更新设置（单个更新已足够）
   *   PUT /api/mobile/{factoryId}/factory-settings/batch
   *
   * 全局操作（2个）：
   * - getAllSettings: 获取所有设置（可分别调用各类设置API）
   * - resetToDefaults: 重置为默认设置（高级功能）
   *   GET /api/mobile/{factoryId}/factory-settings
   *   POST /api/mobile/{factoryId}/factory-settings/reset-defaults
   *
   * 设置管理（3个）：
   * - getSettingsHistory: 设置历史（审计功能）
   * - validateSettings: 验证设置（前端可验证）
   * - getSettingCategories: 获取类别列表（前端已知）
   * - getSettingsByCategory: 按类别获取（分别调用即可）
   *   GET /api/mobile/{factoryId}/factory-settings/history
   *   POST /api/mobile/{factoryId}/factory-settings/validate
   *   GET /api/mobile/{factoryId}/factory-settings/categories
   *   GET /api/mobile/{factoryId}/factory-settings/category/{category}
   *
   * 导入导出（2个）：
   * - exportSettings: 导出设置（MVP暂不需要）
   * - importSettings: 导入设置（MVP暂不需要）
   *   GET /api/mobile/{factoryId}/factory-settings/export
   *   POST /api/mobile/{factoryId}/factory-settings/import
   *
   * 如需使用这些功能，请查看Git历史或参考完整版API文档
   */
}

export const factorySettingsApiClient = new FactorySettingsApiClient();
export default factorySettingsApiClient;

package com.cretas.aims.service;

import com.cretas.aims.dto.FactorySettingsDTO;
import java.util.Map;
/**
 * 工厂设置服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public interface FactorySettingsService {
    /**
     * 获取工厂设置
     */
    FactorySettingsDTO getSettings(String factoryId);

    /**
     * 创建或更新工厂设置
     */
    FactorySettingsDTO saveSettings(String factoryId, FactorySettingsDTO dto);

    /**
     * 获取AI设置
     */
    FactorySettingsDTO.AISettings getAiSettings(String factoryId);

    /**
     * 更新AI设置
     */
    FactorySettingsDTO.AISettings updateAiSettings(String factoryId, FactorySettingsDTO.AISettings aiSettings);

    /**
     * 获取AI使用统计
     */
    Map<String, Object> getAiUsageStats(String factoryId, String period);

    /**
     * 获取通知设置
     */
    FactorySettingsDTO.NotificationSettings getNotificationSettings(String factoryId);

    /**
     * 更新通知设置
     */
    FactorySettingsDTO.NotificationSettings updateNotificationSettings(String factoryId,
                                                                      FactorySettingsDTO.NotificationSettings settings);

    /**
     * 获取工作时间设置
     */
    FactorySettingsDTO.WorkTimeSettings getWorkTimeSettings(String factoryId);

    /**
     * 更新工作时间设置
     */
    FactorySettingsDTO.WorkTimeSettings updateWorkTimeSettings(String factoryId,
                                                               FactorySettingsDTO.WorkTimeSettings settings);

    /**
     * 获取生产设置
     */
    FactorySettingsDTO.ProductionSettings getProductionSettings(String factoryId);

    /**
     * 更新生产设置
     */
    FactorySettingsDTO.ProductionSettings updateProductionSettings(String factoryId,
                                                                  FactorySettingsDTO.ProductionSettings settings);

    /**
     * 获取库存设置
     */
    FactorySettingsDTO.InventorySettings getInventorySettings(String factoryId);

    /**
     * 更新库存设置
     */
    FactorySettingsDTO.InventorySettings updateInventorySettings(String factoryId,
                                                                FactorySettingsDTO.InventorySettings settings);

    /**
     * 获取数据保留设置
     */
    FactorySettingsDTO.DataRetentionSettings getDataRetentionSettings(String factoryId);

    /**
     * 更新数据保留设置
     */
    FactorySettingsDTO.DataRetentionSettings updateDataRetentionSettings(String factoryId,
                                                                        FactorySettingsDTO.DataRetentionSettings settings);

    /**
     * 更新功能开关
     */
    void updateFeatureToggle(String factoryId, String feature, Boolean enabled);

    /**
     * 获取功能开关状态
     */
    Map<String, Boolean> getFeatureToggles(String factoryId);

    /**
     * 更新显示设置
     */
    void updateDisplaySettings(String factoryId, String language, String timezone,
                              String dateFormat, String currency);

    /**
     * 获取显示设置
     */
    Map<String, String> getDisplaySettings(String factoryId);

    /**
     * 重置为默认设置
     */
    FactorySettingsDTO resetToDefaults(String factoryId);

    /**
     * 导出设置
     */
    String exportSettings(String factoryId);

    /**
     * 导入设置
     */
    FactorySettingsDTO importSettings(String factoryId, String settingsJson);
}

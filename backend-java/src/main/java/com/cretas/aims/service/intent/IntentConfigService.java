package com.cretas.aims.service.intent;

import com.cretas.aims.entity.config.AIIntentConfig;
import java.util.List;
import java.util.Optional;

/**
 * 意图配置管理服务
 *
 * 负责意图配置的 CRUD 操作和缓存管理
 *
 * @author Cretas Team
 * @version 1.0.0
 */
public interface IntentConfigService {

    /**
     * 获取所有激活的意图配置（带租户隔离）
     */
    List<AIIntentConfig> getAllIntents(String factoryId);

    /**
     * 获取所有激活的意图配置（全局）
     */
    List<AIIntentConfig> getAllIntents();

    /**
     * 根据意图编码获取意图配置（带租户隔离）
     */
    Optional<AIIntentConfig> getIntentByCode(String factoryId, String intentCode);

    /**
     * 根据意图编码获取意图配置（全局）
     * @deprecated 推荐使用带 factoryId 的方法
     */
    @Deprecated
    Optional<AIIntentConfig> getIntentByCode(String intentCode);

    /**
     * 根据意图编码获取配置（内部使用，返回可能为 null）
     */
    AIIntentConfig getIntentConfigByCode(String factoryId, String intentCode);

    /**
     * 创建新的意图配置
     */
    AIIntentConfig createIntent(AIIntentConfig intentConfig);

    /**
     * 更新意图配置
     */
    AIIntentConfig updateIntent(AIIntentConfig intentConfig);

    /**
     * 删除意图配置（软删除）
     */
    void deleteIntent(String intentCode);

    /**
     * 设置意图激活状态
     */
    void setIntentActive(String intentCode, boolean active);

    /**
     * 获取意图配额消耗
     */
    int getQuotaCost(String intentCode);

    /**
     * 获取意图缓存 TTL
     */
    int getCacheTtl(String intentCode);

    /**
     * 清除意图缓存
     */
    void clearCache();

    /**
     * 刷新意图缓存
     */
    void refreshCache();

    /**
     * 根据分类获取意图列表
     */
    List<AIIntentConfig> getIntentsByCategory(String factoryId, String category);

    /**
     * 根据敏感度获取意图列表
     */
    List<AIIntentConfig> getIntentsBySensitivity(String factoryId, String sensitivity);
}

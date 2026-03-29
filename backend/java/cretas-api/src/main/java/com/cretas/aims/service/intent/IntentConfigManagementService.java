package com.cretas.aims.service.intent;

import com.cretas.aims.entity.config.AIIntentConfig;

import java.util.List;
import java.util.Optional;

/**
 * Intent Config Management Service
 *
 * Handles CRUD operations, permission checking, quota management,
 * and cache management for intent configurations.
 *
 * @author Cretas Team
 * @version 2.0.0 (refactored from AIIntentServiceImpl)
 */
public interface IntentConfigManagementService {

    // ==================== Intent Queries ====================

    Optional<AIIntentConfig> getIntentByCode(String factoryId, String intentCode);

    @Deprecated
    Optional<AIIntentConfig> getIntentByCode(String intentCode);

    List<AIIntentConfig> getAllIntents(String factoryId);

    @Deprecated
    List<AIIntentConfig> getAllIntents();

    List<AIIntentConfig> getIntentsByCategory(String factoryId, String category);

    @Deprecated
    List<AIIntentConfig> getIntentsByCategory(String category);

    List<AIIntentConfig> getIntentsBySensitivity(String factoryId, String sensitivityLevel);

    @Deprecated
    List<AIIntentConfig> getIntentsBySensitivity(String sensitivityLevel);

    List<String> getAllCategories(String factoryId);

    @Deprecated
    List<String> getAllCategories();

    // ==================== CRUD ====================

    AIIntentConfig createIntent(AIIntentConfig intentConfig);

    AIIntentConfig updateIntent(AIIntentConfig intentConfig);

    void deleteIntent(String intentCode);

    void setIntentActive(String intentCode, boolean active);

    // ==================== Permission & Quota ====================

    boolean hasPermission(String factoryId, String intentCode, String userRole);

    @Deprecated
    boolean hasPermission(String intentCode, String userRole);

    boolean requiresApproval(String factoryId, String intentCode);

    @Deprecated
    boolean requiresApproval(String intentCode);

    Optional<String> getApprovalChainId(String factoryId, String intentCode);

    @Deprecated
    Optional<String> getApprovalChainId(String intentCode);

    int getQuotaCost(String factoryId, String intentCode);

    @Deprecated
    int getQuotaCost(String intentCode);

    int getCacheTtl(String factoryId, String intentCode);

    @Deprecated
    int getCacheTtl(String intentCode);

    // ==================== Cache Management ====================

    void clearCache();

    void refreshCache();

    // ==================== Helper ====================

    /**
     * Get intent config by code, with factory fallback.
     * Used internally by other sub-services.
     */
    AIIntentConfig getIntentConfigByCode(String factoryId, String intentCode);

    /**
     * Resolve business domain (FACTORY / RESTAURANT) for a given factoryId.
     */
    String resolveBusinessDomain(String factoryId);
}

package com.cretas.aims.service.impl;

import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.config.AIIntentConfigHistory;
import com.cretas.aims.repository.config.AIIntentConfigHistoryRepository;
import com.cretas.aims.repository.config.AIIntentConfigRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

/**
 * 意图配置回滚服务（简化版）
 *
 * 功能：
 * - 保存配置前自动创建快照
 * - 一键回滚到上个版本
 * - 记录变更历史用于审计
 *
 * 设计原则：
 * - 不做复杂灰度系统
 * - 人工监控 + 一键回滚
 * - 版本快照保证可回滚性
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-04
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IntentConfigRollbackService {

    private final AIIntentConfigRepository configRepo;
    private final AIIntentConfigHistoryRepository historyRepo;
    private final ObjectMapper objectMapper;

    // ==================== 快照保存 ====================

    /**
     * 创建快照（公开方法，供外部调用者在修改对象前使用）
     *
     * ★ 重要：必须在修改配置对象之前调用此方法！
     * 因为 Hibernate 一级缓存的原因，修改对象后再调用 findById 会返回同一个已修改的对象
     *
     * @param config 配置对象（未修改前的状态）
     * @return JSON 快照字符串
     */
    public String createSnapshotForUpdate(AIIntentConfig config) {
        return createSnapshot(config);
    }

    /**
     * 使用预先创建的快照保存配置
     *
     * @param config 已修改的配置对象
     * @param preCreatedSnapshot 修改前创建的快照
     * @param changedBy 修改人ID
     * @param changedByName 修改人姓名
     * @param reason 修改原因
     * @return 保存后的配置
     */
    @Transactional
    public AIIntentConfig saveWithPreCreatedSnapshot(AIIntentConfig config,
                                                      String preCreatedSnapshot,
                                                      Long changedBy,
                                                      String changedByName,
                                                      String reason) {
        // 1. 如果是新配置（没有ID），直接保存
        if (config.getId() == null) {
            config.setConfigVersion(1);
            AIIntentConfig saved = configRepo.save(config);

            // 记录创建历史
            recordHistory(saved, AIIntentConfigHistory.ChangeType.CREATE,
                    changedBy, changedByName, reason, null);

            log.info("Created new intent config: code={}, version=1",
                    saved.getIntentCode());
            return saved;
        }

        // 2. 设置预先创建的快照
        config.setPreviousSnapshot(preCreatedSnapshot);

        // 3. 递增版本号
        int oldVersion = config.getConfigVersion() != null ? config.getConfigVersion() : 0;
        int newVersion = oldVersion + 1;
        config.setConfigVersion(newVersion);

        // 4. 保存配置
        AIIntentConfig saved = configRepo.save(config);

        // 5. 记录历史
        recordHistory(saved, AIIntentConfigHistory.ChangeType.UPDATE,
                changedBy, changedByName, reason, null);

        log.info("Updated intent config with pre-created snapshot: code={}, version={} -> {}",
                saved.getIntentCode(), oldVersion, newVersion);

        return saved;
    }

    /**
     * 保存配置时自动创建快照（旧方法，不推荐在修改后调用）
     *
     * ⚠️ 警告：如果在同一事务中先修改了对象再调用此方法，快照会是修改后的值！
     * 推荐使用 createSnapshotForUpdate + saveWithPreCreatedSnapshot 组合
     *
     * @param config 要保存的配置
     * @param changedBy 修改人ID
     * @param changedByName 修改人姓名
     * @param reason 修改原因
     */
    @Transactional
    public AIIntentConfig saveWithSnapshot(AIIntentConfig config,
                                           Long changedBy,
                                           String changedByName,
                                           String reason) {
        // 1. 如果是新配置（没有ID），直接保存
        if (config.getId() == null) {
            config.setConfigVersion(1);
            AIIntentConfig saved = configRepo.save(config);

            // 记录创建历史
            recordHistory(saved, AIIntentConfigHistory.ChangeType.CREATE,
                    changedBy, changedByName, reason, null);

            log.info("Created new intent config: code={}, version=1",
                    saved.getIntentCode());
            return saved;
        }

        // 2. 获取当前版本
        Optional<AIIntentConfig> existingOpt = configRepo.findById(config.getId());
        if (existingOpt.isEmpty()) {
            throw new IllegalArgumentException("Config not found: " + config.getId());
        }

        AIIntentConfig existing = existingOpt.get();

        // 3. 保存当前状态作为快照
        String snapshot = createSnapshot(existing);
        config.setPreviousSnapshot(snapshot);

        // 4. 递增版本号
        int newVersion = (existing.getConfigVersion() != null ? existing.getConfigVersion() : 0) + 1;
        config.setConfigVersion(newVersion);

        // 5. 计算变更的字段
        String changedFields = calculateChangedFields(existing, config);

        // 6. 保存配置
        AIIntentConfig saved = configRepo.save(config);

        // 7. 记录历史
        recordHistory(saved, AIIntentConfigHistory.ChangeType.UPDATE,
                changedBy, changedByName, reason, changedFields);

        log.info("Updated intent config: code={}, version={} -> {}",
                saved.getIntentCode(), existing.getConfigVersion(), newVersion);

        return saved;
    }

    // ==================== 回滚操作 ====================

    /**
     * 回滚单个配置到上个版本
     *
     * @param configId 配置ID
     * @param rollbackBy 操作人ID
     * @param rollbackByName 操作人姓名
     * @param reason 回滚原因
     * @return 回滚后的配置
     */
    @Transactional
    @CacheEvict(value = {"allIntents", "intentsByCategory", "intentCategories"}, allEntries = true)
    public AIIntentConfig rollbackToLastVersion(String configId,
                                                  Long rollbackBy,
                                                  String rollbackByName,
                                                  String reason) {
        // 1. 获取当前配置
        AIIntentConfig config = configRepo.findById(configId)
                .orElseThrow(() -> new IllegalArgumentException("Config not found: " + configId));

        // 2. 检查是否有快照可回滚
        if (config.getPreviousSnapshot() == null || config.getPreviousSnapshot().isEmpty()) {
            throw new IllegalStateException("No previous snapshot available for rollback: " + configId);
        }

        // 3. 保存当前状态（以备再次回滚）
        String currentSnapshot = createSnapshot(config);

        // 4. 从快照恢复
        restoreFromSnapshot(config, config.getPreviousSnapshot());

        // 5. 设置新快照为当前状态（支持"反向回滚"）
        config.setPreviousSnapshot(currentSnapshot);

        // 6. 更新版本号（回滚也算一个新版本）
        int newVersion = (config.getConfigVersion() != null ? config.getConfigVersion() : 0) + 1;
        config.setConfigVersion(newVersion);

        // 7. 保存
        AIIntentConfig saved = configRepo.save(config);

        // 8. 记录历史
        recordHistory(saved, AIIntentConfigHistory.ChangeType.ROLLBACK,
                rollbackBy, rollbackByName, reason, null);

        log.info("Rolled back config: code={}, to version {}",
                saved.getIntentCode(), newVersion);

        return saved;
    }

    /**
     * 回滚工厂的所有配置到上个版本
     *
     * @param factoryId 工厂ID
     * @param rollbackBy 操作人ID
     * @param rollbackByName 操作人姓名
     * @param reason 回滚原因
     * @return 回滚结果摘要
     */
    @Transactional
    @CacheEvict(value = {"allIntents", "intentsByCategory", "intentCategories"}, allEntries = true)
    public Map<String, Object> rollbackFactoryToLastVersion(String factoryId,
                                                              Long rollbackBy,
                                                              String rollbackByName,
                                                              String reason) {
        log.info("Starting factory rollback: factoryId={}, by={}", factoryId, rollbackByName);

        List<AIIntentConfig> configs = configRepo.findByFactoryIdOrPlatformLevel(factoryId);

        int success = 0;
        int skipped = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();

        for (AIIntentConfig config : configs) {
            try {
                if (config.getPreviousSnapshot() == null || config.getPreviousSnapshot().isEmpty()) {
                    skipped++;
                    continue;
                }

                rollbackToLastVersion(config.getId(), rollbackBy, rollbackByName, reason);
                success++;

            } catch (Exception e) {
                failed++;
                errors.add(String.format("%s: %s", config.getIntentCode(), e.getMessage()));
                log.error("Failed to rollback config: code={}, error={}",
                        config.getIntentCode(), e.getMessage());
            }
        }

        log.info("Factory rollback completed: factoryId={}, success={}, skipped={}, failed={}",
                factoryId, success, skipped, failed);

        Map<String, Object> result = new HashMap<>();
        result.put("factoryId", factoryId);
        result.put("totalConfigs", configs.size());
        result.put("successCount", success);
        result.put("skippedCount", skipped);
        result.put("failedCount", failed);
        result.put("errors", errors);
        result.put("rollbackAt", LocalDateTime.now());
        result.put("rollbackBy", rollbackByName);

        return result;
    }

    /**
     * 回滚到特定历史版本
     *
     * @param configId 配置ID
     * @param targetVersion 目标版本号
     * @param rollbackBy 操作人ID
     * @param rollbackByName 操作人姓名
     * @param reason 回滚原因
     * @return 回滚后的配置
     */
    @Transactional
    @CacheEvict(value = {"allIntents", "intentsByCategory", "intentCategories"}, allEntries = true)
    public AIIntentConfig rollbackToVersion(String configId,
                                             int targetVersion,
                                             Long rollbackBy,
                                             String rollbackByName,
                                             String reason) {
        // 1. 获取目标版本的历史记录
        AIIntentConfigHistory history = historyRepo
                .findByIntentConfigIdAndVersionNumber(configId, targetVersion)
                .orElseThrow(() -> new IllegalArgumentException(
                        String.format("Version %d not found for config: %s", targetVersion, configId)));

        // 2. 获取当前配置
        AIIntentConfig config = configRepo.findById(configId)
                .orElseThrow(() -> new IllegalArgumentException("Config not found: " + configId));

        // 3. 保存当前状态作为快照
        config.setPreviousSnapshot(createSnapshot(config));

        // 4. 从历史快照恢复
        restoreFromSnapshot(config, history.getSnapshot());

        // 5. 更新版本号
        int newVersion = (config.getConfigVersion() != null ? config.getConfigVersion() : 0) + 1;
        config.setConfigVersion(newVersion);

        // 6. 保存
        AIIntentConfig saved = configRepo.save(config);

        // 7. 记录历史
        String fullReason = String.format("回滚到版本 %d: %s", targetVersion, reason);
        recordHistory(saved, AIIntentConfigHistory.ChangeType.ROLLBACK,
                rollbackBy, rollbackByName, fullReason, null);

        log.info("Rolled back config: code={}, to historical version {}, new version={}",
                saved.getIntentCode(), targetVersion, newVersion);

        return saved;
    }

    // ==================== 历史查询 ====================

    /**
     * 获取配置的版本历史
     */
    public List<AIIntentConfigHistory> getVersionHistory(String configId) {
        return historyRepo.findByIntentConfigIdOrderByVersionNumberDesc(configId);
    }

    /**
     * 获取工厂的配置变更历史
     */
    public List<AIIntentConfigHistory> getFactoryChangeHistory(String factoryId) {
        return historyRepo.findByFactoryIdOrderByChangedAtDesc(factoryId);
    }

    // ==================== 工具方法 ====================

    /**
     * 创建配置快照
     */
    private String createSnapshot(AIIntentConfig config) {
        try {
            Map<String, Object> snapshot = new LinkedHashMap<>();
            snapshot.put("intentCode", config.getIntentCode());
            snapshot.put("intentName", config.getIntentName());
            snapshot.put("intentCategory", config.getIntentCategory());
            snapshot.put("sensitivityLevel", config.getSensitivityLevel());
            snapshot.put("keywords", config.getKeywords());
            snapshot.put("regexPattern", config.getRegexPattern());
            snapshot.put("description", config.getDescription());
            snapshot.put("handlerClass", config.getHandlerClass());
            snapshot.put("requiredRoles", config.getRequiredRoles());
            snapshot.put("quotaCost", config.getQuotaCost());
            snapshot.put("cacheTtlMinutes", config.getCacheTtlMinutes());
            snapshot.put("requiresApproval", config.getRequiresApproval());
            snapshot.put("maxTokens", config.getMaxTokens());
            snapshot.put("responseTemplate", config.getResponseTemplate());
            snapshot.put("isActive", config.getIsActive());
            snapshot.put("priority", config.getPriority());
            snapshot.put("metadata", config.getMetadata());
            snapshot.put("semanticDomain", config.getSemanticDomain());
            snapshot.put("semanticAction", config.getSemanticAction());
            snapshot.put("semanticObject", config.getSemanticObject());
            snapshot.put("configVersion", config.getConfigVersion());
            snapshot.put("snapshotAt", LocalDateTime.now().toString());

            return objectMapper.writeValueAsString(snapshot);
        } catch (JsonProcessingException e) {
            log.error("Failed to create snapshot: {}", e.getMessage());
            throw new RuntimeException("Failed to create config snapshot", e);
        }
    }

    /**
     * 从快照恢复配置
     */
    @SuppressWarnings("unchecked")
    private void restoreFromSnapshot(AIIntentConfig config, String snapshot) {
        try {
            Map<String, Object> data = objectMapper.readValue(snapshot, Map.class);

            // 恢复关键字段（不恢复 ID、factoryId 等标识字段）
            if (data.containsKey("intentName")) {
                config.setIntentName((String) data.get("intentName"));
            }
            if (data.containsKey("keywords")) {
                config.setKeywords((String) data.get("keywords"));
            }
            if (data.containsKey("regexPattern")) {
                config.setRegexPattern((String) data.get("regexPattern"));
            }
            if (data.containsKey("description")) {
                config.setDescription((String) data.get("description"));
            }
            if (data.containsKey("sensitivityLevel")) {
                config.setSensitivityLevel((String) data.get("sensitivityLevel"));
            }
            if (data.containsKey("handlerClass")) {
                config.setHandlerClass((String) data.get("handlerClass"));
            }
            if (data.containsKey("requiredRoles")) {
                config.setRequiredRoles((String) data.get("requiredRoles"));
            }
            if (data.containsKey("quotaCost")) {
                config.setQuotaCost(((Number) data.get("quotaCost")).intValue());
            }
            if (data.containsKey("cacheTtlMinutes")) {
                config.setCacheTtlMinutes(((Number) data.get("cacheTtlMinutes")).intValue());
            }
            if (data.containsKey("requiresApproval")) {
                config.setRequiresApproval((Boolean) data.get("requiresApproval"));
            }
            if (data.containsKey("maxTokens")) {
                config.setMaxTokens(((Number) data.get("maxTokens")).intValue());
            }
            if (data.containsKey("responseTemplate")) {
                config.setResponseTemplate((String) data.get("responseTemplate"));
            }
            if (data.containsKey("isActive")) {
                config.setIsActive((Boolean) data.get("isActive"));
            }
            if (data.containsKey("priority")) {
                config.setPriority(((Number) data.get("priority")).intValue());
            }
            if (data.containsKey("metadata")) {
                config.setMetadata((String) data.get("metadata"));
            }
            if (data.containsKey("semanticDomain")) {
                config.setSemanticDomain((String) data.get("semanticDomain"));
            }
            if (data.containsKey("semanticAction")) {
                config.setSemanticAction((String) data.get("semanticAction"));
            }
            if (data.containsKey("semanticObject")) {
                config.setSemanticObject((String) data.get("semanticObject"));
            }

        } catch (JsonProcessingException e) {
            log.error("Failed to restore from snapshot: {}", e.getMessage());
            throw new RuntimeException("Failed to restore config from snapshot", e);
        }
    }

    /**
     * 计算变更的字段
     */
    private String calculateChangedFields(AIIntentConfig old, AIIntentConfig newConfig) {
        try {
            List<String> changedFields = new ArrayList<>();

            if (!Objects.equals(old.getIntentName(), newConfig.getIntentName())) {
                changedFields.add("intentName");
            }
            if (!Objects.equals(old.getKeywords(), newConfig.getKeywords())) {
                changedFields.add("keywords");
            }
            if (!Objects.equals(old.getDescription(), newConfig.getDescription())) {
                changedFields.add("description");
            }
            if (!Objects.equals(old.getSensitivityLevel(), newConfig.getSensitivityLevel())) {
                changedFields.add("sensitivityLevel");
            }
            if (!Objects.equals(old.getRegexPattern(), newConfig.getRegexPattern())) {
                changedFields.add("regexPattern");
            }
            if (!Objects.equals(old.getHandlerClass(), newConfig.getHandlerClass())) {
                changedFields.add("handlerClass");
            }
            if (!Objects.equals(old.getIsActive(), newConfig.getIsActive())) {
                changedFields.add("isActive");
            }
            if (!Objects.equals(old.getPriority(), newConfig.getPriority())) {
                changedFields.add("priority");
            }

            return objectMapper.writeValueAsString(changedFields);
        } catch (JsonProcessingException e) {
            return "[]";
        }
    }

    /**
     * 记录历史
     */
    private void recordHistory(AIIntentConfig config,
                                AIIntentConfigHistory.ChangeType changeType,
                                Long changedBy,
                                String changedByName,
                                String reason,
                                String changedFields) {
        try {
            AIIntentConfigHistory history = AIIntentConfigHistory.builder()
                    .intentConfigId(config.getId())
                    .factoryId(config.getFactoryId())
                    .intentCode(config.getIntentCode())
                    .versionNumber(config.getConfigVersion())
                    .snapshot(createSnapshot(config))
                    .changedBy(changedBy)
                    .changedByName(changedByName)
                    .changedAt(LocalDateTime.now())
                    .changeReason(reason)
                    .changeType(changeType)
                    .changedFields(changedFields)
                    .build();

            historyRepo.save(history);

        } catch (Exception e) {
            // 历史记录失败不应阻断主流程
            log.error("Failed to record history: configId={}, error={}",
                    config.getId(), e.getMessage());
        }
    }
}

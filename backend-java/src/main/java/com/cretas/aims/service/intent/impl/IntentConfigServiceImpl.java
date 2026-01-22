package com.cretas.aims.service.intent.impl;

import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.repository.config.AIIntentConfigRepository;
import com.cretas.aims.service.impl.IntentConfigRollbackService;
import com.cretas.aims.service.intent.IntentConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 意图配置管理服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IntentConfigServiceImpl implements IntentConfigService {

    private final AIIntentConfigRepository intentRepository;
    private final IntentConfigRollbackService rollbackService;

    @Override
    @Cacheable(value = "allIntents", key = "#factoryId")
    public List<AIIntentConfig> getAllIntents(String factoryId) {
        if (factoryId == null || factoryId.isBlank()) {
            log.warn("getAllIntents called without factoryId, returning empty list");
            return List.of();
        }
        return intentRepository.findByFactoryIdOrPlatformLevel(factoryId);
    }

    @Override
    @Deprecated
    @Cacheable(value = "allIntents_legacy")
    public List<AIIntentConfig> getAllIntents() {
        log.warn("Deprecated getAllIntents() called without factoryId");
        return intentRepository.findByIsActiveTrueAndDeletedAtIsNullOrderByPriorityDesc();
    }

    @Override
    public Optional<AIIntentConfig> getIntentByCode(String factoryId, String intentCode) {
        if (factoryId == null || factoryId.isBlank()) {
            log.warn("getIntentByCode called without factoryId, returning empty");
            return Optional.empty();
        }
        if (intentCode == null || intentCode.isBlank()) {
            return Optional.empty();
        }

        return getAllIntents(factoryId).stream()
                .filter(intent -> intentCode.equals(intent.getIntentCode()))
                .findFirst();
    }

    @Override
    @Deprecated
    public Optional<AIIntentConfig> getIntentByCode(String intentCode) {
        return intentRepository.findByIntentCodeAndIsActiveTrueAndDeletedAtIsNull(intentCode);
    }

    @Override
    public AIIntentConfig getIntentConfigByCode(String factoryId, String intentCode) {
        return getIntentByCode(factoryId, intentCode).orElse(null);
    }

    @Override
    @Transactional
    @CacheEvict(value = {"allIntents", "intentsByCategory", "intentCategories", "intentsBySensitivity",
            "allIntents_legacy", "intentsByCategory_legacy", "intentCategories_legacy"}, allEntries = true)
    public AIIntentConfig createIntent(AIIntentConfig intentConfig) {
        if (intentRepository.existsByIntentCodeAndDeletedAtIsNull(intentConfig.getIntentCode())) {
            throw new IllegalArgumentException("意图代码已存在: " + intentConfig.getIntentCode());
        }
        return intentRepository.save(intentConfig);
    }

    @Override
    @Transactional
    @CacheEvict(value = {"allIntents", "intentsByCategory", "intentCategories", "intentsBySensitivity",
            "allIntents_legacy", "intentsByCategory_legacy", "intentCategories_legacy"}, allEntries = true)
    public AIIntentConfig updateIntent(AIIntentConfig intentConfig) {
        AIIntentConfig existing = intentRepository
                .findByIntentCodeAndDeletedAtIsNull(intentConfig.getIntentCode())
                .orElseThrow(() -> new IllegalArgumentException("意图配置不存在: " + intentConfig.getIntentCode()));

        // 创建快照用于回滚
        String previousSnapshot = rollbackService.createSnapshotForUpdate(existing);

        // 部分更新
        updateNonNullFields(existing, intentConfig);

        return intentRepository.save(existing);
    }

    @Override
    @Transactional
    @CacheEvict(value = {"allIntents", "intentsByCategory", "intentCategories", "intentsBySensitivity",
            "allIntents_legacy", "intentsByCategory_legacy", "intentCategories_legacy"}, allEntries = true)
    public void deleteIntent(String intentCode) {
        AIIntentConfig intent = intentRepository
                .findByIntentCodeAndDeletedAtIsNull(intentCode)
                .orElseThrow(() -> new IllegalArgumentException("意图配置不存在: " + intentCode));

        intent.setDeletedAt(LocalDateTime.now());
        intentRepository.save(intent);
        log.info("Soft deleted intent: {}", intentCode);
    }

    @Override
    @Transactional
    @CacheEvict(value = {"allIntents", "intentsByCategory", "intentCategories", "intentsBySensitivity",
            "allIntents_legacy", "intentsByCategory_legacy", "intentCategories_legacy"}, allEntries = true)
    public void setIntentActive(String intentCode, boolean active) {
        AIIntentConfig intent = intentRepository
                .findByIntentCodeAndDeletedAtIsNull(intentCode)
                .orElseThrow(() -> new IllegalArgumentException("意图配置不存在: " + intentCode));

        intent.setIsActive(active);
        intentRepository.save(intent);
        log.info("Set intent {} active status to {}", intentCode, active);
    }

    @Override
    public int getQuotaCost(String intentCode) {
        return getIntentByCode(intentCode)
                .map(AIIntentConfig::getQuotaCost)
                .orElse(1);
    }

    @Override
    public int getCacheTtl(String intentCode) {
        return getIntentByCode(intentCode)
                .map(AIIntentConfig::getCacheTtlMinutes)
                .orElse(0);
    }

    @Override
    @CacheEvict(value = {"allIntents", "intentsByCategory", "intentCategories", "intentsBySensitivity",
            "allIntents_legacy", "intentsByCategory_legacy", "intentCategories_legacy"}, allEntries = true)
    public void clearCache() {
        log.info("Intent cache cleared");
    }

    @Override
    @CacheEvict(value = {"allIntents", "intentsByCategory", "intentCategories", "intentsBySensitivity",
            "allIntents_legacy", "intentsByCategory_legacy", "intentCategories_legacy"}, allEntries = true)
    public void refreshCache() {
        log.info("Intent cache refreshed");
    }

    @Override
    @Cacheable(value = "intentsByCategory", key = "#factoryId + ':' + #category")
    public List<AIIntentConfig> getIntentsByCategory(String factoryId, String category) {
        if (factoryId == null || factoryId.isBlank()) {
            log.warn("getIntentsByCategory called without factoryId");
            return List.of();
        }
        return getAllIntents(factoryId).stream()
                .filter(c -> category.equals(c.getIntentCategory()))
                .toList();
    }

    @Override
    @Cacheable(value = "intentsBySensitivity", key = "#factoryId + ':' + #sensitivity")
    public List<AIIntentConfig> getIntentsBySensitivity(String factoryId, String sensitivity) {
        if (factoryId == null || factoryId.isBlank()) {
            log.warn("getIntentsBySensitivity called without factoryId");
            return List.of();
        }
        return getAllIntents(factoryId).stream()
                .filter(c -> sensitivity.equals(c.getSensitivityLevel()))
                .toList();
    }

    /**
     * 更新非空字段
     */
    private void updateNonNullFields(AIIntentConfig existing, AIIntentConfig updated) {
        if (updated.getIntentName() != null) {
            existing.setIntentName(updated.getIntentName());
        }
        if (updated.getIntentCategory() != null) {
            existing.setIntentCategory(updated.getIntentCategory());
        }
        if (updated.getSensitivityLevel() != null) {
            existing.setSensitivityLevel(updated.getSensitivityLevel());
        }
        if (updated.getRequiredRoles() != null) {
            existing.setRequiredRoles(updated.getRequiredRoles());
        }
        if (updated.getQuotaCost() != null) {
            existing.setQuotaCost(updated.getQuotaCost());
        }
        if (updated.getCacheTtlMinutes() != null) {
            existing.setCacheTtlMinutes(updated.getCacheTtlMinutes());
        }
        if (updated.getRequiresApproval() != null) {
            existing.setRequiresApproval(updated.getRequiresApproval());
        }
        if (updated.getApprovalChainId() != null) {
            existing.setApprovalChainId(updated.getApprovalChainId());
        }
        if (updated.getKeywords() != null) {
            existing.setKeywords(updated.getKeywords());
        }
        if (updated.getRegexPattern() != null) {
            existing.setRegexPattern(updated.getRegexPattern());
        }
        if (updated.getDescription() != null) {
            existing.setDescription(updated.getDescription());
        }
        if (updated.getHandlerClass() != null) {
            existing.setHandlerClass(updated.getHandlerClass());
        }
        if (updated.getMaxTokens() != null) {
            existing.setMaxTokens(updated.getMaxTokens());
        }
        if (updated.getResponseTemplate() != null) {
            existing.setResponseTemplate(updated.getResponseTemplate());
        }
        if (updated.getPriority() != null) {
            existing.setPriority(updated.getPriority());
        }
    }
}

package com.cretas.aims.service.impl;

import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.repository.config.AIIntentConfigRepository;
import com.cretas.aims.service.AIIntentService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * AI意图服务实现
 *
 * 提供AI请求的意图识别和配置管理:
 * - 基于关键词匹配和正则表达式的意图识别
 * - 支持角色权限校验
 * - 支持缓存优化
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AIIntentServiceImpl implements AIIntentService {

    private final AIIntentConfigRepository intentRepository;
    private final ObjectMapper objectMapper;

    // ==================== 意图识别 ====================

    @Override
    public Optional<AIIntentConfig> recognizeIntent(String userInput) {
        if (userInput == null || userInput.trim().isEmpty()) {
            return Optional.empty();
        }

        List<AIIntentConfig> allIntents = getAllIntents();
        String normalizedInput = userInput.toLowerCase().trim();

        // 优先使用正则匹配
        for (AIIntentConfig intent : allIntents) {
            if (matchesByRegex(intent, normalizedInput)) {
                log.debug("Intent matched by regex: {} for input: {}", intent.getIntentCode(), userInput);
                return Optional.of(intent);
            }
        }

        // 然后使用关键词匹配
        List<AIIntentConfig> keywordMatches = new ArrayList<>();
        for (AIIntentConfig intent : allIntents) {
            int matchScore = calculateKeywordMatchScore(intent, normalizedInput);
            if (matchScore > 0) {
                keywordMatches.add(intent);
            }
        }

        // 按优先级和匹配分数排序，返回最佳匹配
        if (!keywordMatches.isEmpty()) {
            keywordMatches.sort((a, b) -> {
                int priorityCompare = b.getPriority().compareTo(a.getPriority());
                if (priorityCompare != 0) return priorityCompare;
                return calculateKeywordMatchScore(b, normalizedInput) -
                       calculateKeywordMatchScore(a, normalizedInput);
            });
            AIIntentConfig bestMatch = keywordMatches.get(0);
            log.debug("Intent matched by keywords: {} for input: {}", bestMatch.getIntentCode(), userInput);
            return Optional.of(bestMatch);
        }

        log.debug("No intent matched for input: {}", userInput);
        return Optional.empty();
    }

    @Override
    public List<AIIntentConfig> recognizeAllIntents(String userInput) {
        if (userInput == null || userInput.trim().isEmpty()) {
            return Collections.emptyList();
        }

        List<AIIntentConfig> allIntents = getAllIntents();
        String normalizedInput = userInput.toLowerCase().trim();

        return allIntents.stream()
                .filter(intent -> matchesByRegex(intent, normalizedInput) ||
                                  calculateKeywordMatchScore(intent, normalizedInput) > 0)
                .sorted(Comparator.comparing(AIIntentConfig::getPriority).reversed())
                .collect(Collectors.toList());
    }

    @Override
    public Optional<AIIntentConfig> getIntentByCode(String intentCode) {
        return intentRepository.findByIntentCodeAndIsActiveTrueAndDeletedAtIsNull(intentCode);
    }

    // ==================== 权限校验 ====================

    @Override
    public boolean hasPermission(String intentCode, String userRole) {
        Optional<AIIntentConfig> intentOpt = getIntentByCode(intentCode);
        if (intentOpt.isEmpty()) {
            return false;
        }

        AIIntentConfig intent = intentOpt.get();
        String requiredRolesJson = intent.getRequiredRoles();

        // 如果没有配置角色限制，则所有角色都可以访问
        if (requiredRolesJson == null || requiredRolesJson.isEmpty()) {
            return true;
        }

        try {
            List<String> requiredRoles = objectMapper.readValue(requiredRolesJson,
                    new TypeReference<List<String>>() {});
            return requiredRoles.isEmpty() || requiredRoles.contains(userRole);
        } catch (Exception e) {
            log.warn("Failed to parse required roles for intent {}: {}", intentCode, e.getMessage());
            return false;
        }
    }

    @Override
    public boolean requiresApproval(String intentCode) {
        return getIntentByCode(intentCode)
                .map(AIIntentConfig::needsApproval)
                .orElse(false);
    }

    @Override
    public Optional<String> getApprovalChainId(String intentCode) {
        return getIntentByCode(intentCode)
                .filter(AIIntentConfig::needsApproval)
                .map(AIIntentConfig::getApprovalChainId);
    }

    // ==================== 配额管理 ====================

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

    // ==================== 意图查询 ====================

    @Override
    @Cacheable(value = "allIntents")
    public List<AIIntentConfig> getAllIntents() {
        return intentRepository.findByIsActiveTrueAndDeletedAtIsNullOrderByPriorityDesc();
    }

    @Override
    @Cacheable(value = "intentsByCategory", key = "#category")
    public List<AIIntentConfig> getIntentsByCategory(String category) {
        return intentRepository.findByIntentCategoryAndIsActiveTrueAndDeletedAtIsNullOrderByPriorityDesc(category);
    }

    @Override
    public List<AIIntentConfig> getIntentsBySensitivity(String sensitivityLevel) {
        return intentRepository.findBySensitivityLevelAndIsActiveTrueAndDeletedAtIsNull(sensitivityLevel);
    }

    @Override
    @Cacheable(value = "intentCategories")
    public List<String> getAllCategories() {
        return intentRepository.findAllCategories();
    }

    // ==================== 意图管理 ====================

    @Override
    @Transactional
    @CacheEvict(value = {"allIntents", "intentsByCategory", "intentCategories"}, allEntries = true)
    public AIIntentConfig createIntent(AIIntentConfig intentConfig) {
        if (intentRepository.existsByIntentCodeAndDeletedAtIsNull(intentConfig.getIntentCode())) {
            throw new IllegalArgumentException("意图代码已存在: " + intentConfig.getIntentCode());
        }

        return intentRepository.save(intentConfig);
    }

    @Override
    @Transactional
    @CacheEvict(value = {"allIntents", "intentsByCategory", "intentCategories"}, allEntries = true)
    public AIIntentConfig updateIntent(AIIntentConfig intentConfig) {
        AIIntentConfig existing = intentRepository
                .findByIntentCodeAndDeletedAtIsNull(intentConfig.getIntentCode())
                .orElseThrow(() -> new IllegalArgumentException("意图配置不存在: " + intentConfig.getIntentCode()));

        existing.setIntentName(intentConfig.getIntentName());
        existing.setIntentCategory(intentConfig.getIntentCategory());
        existing.setSensitivityLevel(intentConfig.getSensitivityLevel());
        existing.setRequiredRoles(intentConfig.getRequiredRoles());
        existing.setQuotaCost(intentConfig.getQuotaCost());
        existing.setCacheTtlMinutes(intentConfig.getCacheTtlMinutes());
        existing.setRequiresApproval(intentConfig.getRequiresApproval());
        existing.setApprovalChainId(intentConfig.getApprovalChainId());
        existing.setKeywords(intentConfig.getKeywords());
        existing.setRegexPattern(intentConfig.getRegexPattern());
        existing.setDescription(intentConfig.getDescription());
        existing.setHandlerClass(intentConfig.getHandlerClass());
        existing.setMaxTokens(intentConfig.getMaxTokens());
        existing.setResponseTemplate(intentConfig.getResponseTemplate());
        existing.setPriority(intentConfig.getPriority());
        existing.setMetadata(intentConfig.getMetadata());

        return intentRepository.save(existing);
    }

    @Override
    @Transactional
    @CacheEvict(value = {"allIntents", "intentsByCategory", "intentCategories"}, allEntries = true)
    public void deleteIntent(String intentCode) {
        AIIntentConfig existing = intentRepository
                .findByIntentCodeAndDeletedAtIsNull(intentCode)
                .orElseThrow(() -> new IllegalArgumentException("意图配置不存在: " + intentCode));

        existing.setDeletedAt(LocalDateTime.now());
        intentRepository.save(existing);
    }

    @Override
    @Transactional
    @CacheEvict(value = {"allIntents", "intentsByCategory"}, allEntries = true)
    public void setIntentActive(String intentCode, boolean active) {
        AIIntentConfig existing = intentRepository
                .findByIntentCodeAndDeletedAtIsNull(intentCode)
                .orElseThrow(() -> new IllegalArgumentException("意图配置不存在: " + intentCode));

        existing.setIsActive(active);
        intentRepository.save(existing);
    }

    // ==================== 缓存管理 ====================

    @Override
    @CacheEvict(value = {"allIntents", "intentsByCategory", "intentCategories"}, allEntries = true)
    public void clearCache() {
        log.info("Cleared AI intent config cache");
    }

    @Override
    public void refreshCache() {
        clearCache();
        getAllIntents(); // 重新加载缓存
        log.info("Refreshed AI intent config cache");
    }

    // ==================== 私有方法 ====================

    /**
     * 使用正则表达式匹配意图
     */
    private boolean matchesByRegex(AIIntentConfig intent, String input) {
        String regexPattern = intent.getRegexPattern();
        if (regexPattern == null || regexPattern.isEmpty()) {
            return false;
        }

        try {
            return Pattern.compile(regexPattern, Pattern.CASE_INSENSITIVE)
                    .matcher(input)
                    .find();
        } catch (Exception e) {
            log.warn("Invalid regex pattern for intent {}: {}", intent.getIntentCode(), regexPattern);
            return false;
        }
    }

    /**
     * 计算关键词匹配分数
     * 返回匹配的关键词数量
     */
    private int calculateKeywordMatchScore(AIIntentConfig intent, String input) {
        String keywordsJson = intent.getKeywords();
        if (keywordsJson == null || keywordsJson.isEmpty()) {
            return 0;
        }

        try {
            List<String> keywords = objectMapper.readValue(keywordsJson,
                    new TypeReference<List<String>>() {});

            int score = 0;
            for (String keyword : keywords) {
                if (input.contains(keyword.toLowerCase())) {
                    score++;
                }
            }
            return score;
        } catch (Exception e) {
            log.warn("Failed to parse keywords for intent {}: {}", intent.getIntentCode(), e.getMessage());
            return 0;
        }
    }
}

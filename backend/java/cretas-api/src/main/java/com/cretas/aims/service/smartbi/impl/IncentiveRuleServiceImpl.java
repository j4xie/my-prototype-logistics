package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.entity.smartbi.SmartBiIncentiveRule;
import com.cretas.aims.repository.smartbi.SmartBiIncentiveRuleRepository;
import com.cretas.aims.service.smartbi.IncentiveRuleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

/**
 * Incentive Rule Service Implementation
 *
 * <p>Implements cached incentive rule management with the following features:
 * <ul>
 *   <li>In-memory caching with thread-safe operations</li>
 *   <li>Automatic cache warming on startup</li>
 *   <li>Support for global and factory-specific rules</li>
 *   <li>Value range matching for multi-level incentives</li>
 *   <li>Hot reload capability for rule updates</li>
 * </ul>
 *
 * <p>Cache Strategy:
 * <ul>
 *   <li>Rules are cached by rule code on first access</li>
 *   <li>Factory-specific rules are cached separately</li>
 *   <li>Cache is invalidated via reload() method</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IncentiveRuleServiceImpl implements IncentiveRuleService {

    private final SmartBiIncentiveRuleRepository repository;

    /**
     * Cache for global rules (rule_code -> list of rules)
     */
    private final Map<String, List<SmartBiIncentiveRule>> globalRuleCache = new ConcurrentHashMap<>();

    /**
     * Cache for factory-specific rules (rule_code:factory_id -> list of rules)
     */
    private final Map<String, List<SmartBiIncentiveRule>> factoryRuleCache = new ConcurrentHashMap<>();

    /**
     * Cache statistics
     */
    private final AtomicLong cacheHits = new AtomicLong(0);
    private final AtomicLong cacheMisses = new AtomicLong(0);
    private volatile long lastReloadTime = 0;

    /**
     * Initialize cache on startup
     */
    @PostConstruct
    public void init() {
        log.info("Initializing IncentiveRuleService, warming up cache...");
        try {
            warmUpCache();
            log.info("IncentiveRuleService initialized successfully, loaded {} rule codes",
                    globalRuleCache.size());
        } catch (Exception e) {
            log.warn("Failed to warm up incentive rule cache: {}", e.getMessage());
        }
    }

    /**
     * Warm up cache with all active rules
     */
    private void warmUpCache() {
        List<SmartBiIncentiveRule> allRules = repository.findByIsActiveTrueOrderByRuleCodeAscSortOrderAsc();

        // Group rules by code and cache globally
        Map<String, List<SmartBiIncentiveRule>> globalRules = allRules.stream()
                .filter(r -> r.getFactoryId() == null)
                .collect(Collectors.groupingBy(SmartBiIncentiveRule::getRuleCode));

        globalRuleCache.clear();
        globalRuleCache.putAll(globalRules);

        // Cache factory-specific rules
        Map<String, List<SmartBiIncentiveRule>> factoryRules = allRules.stream()
                .filter(r -> r.getFactoryId() != null)
                .collect(Collectors.groupingBy(r -> buildFactoryCacheKey(r.getRuleCode(), r.getFactoryId())));

        factoryRuleCache.clear();
        factoryRuleCache.putAll(factoryRules);

        lastReloadTime = System.currentTimeMillis();
        log.debug("Cache warmed up: {} global rule codes, {} factory-specific entries",
                globalRuleCache.size(), factoryRuleCache.size());
    }

    @Override
    public List<SmartBiIncentiveRule> getRulesByCode(String ruleCode) {
        if (ruleCode == null || ruleCode.isEmpty()) {
            return Collections.emptyList();
        }

        List<SmartBiIncentiveRule> cached = globalRuleCache.get(ruleCode);
        if (cached != null) {
            cacheHits.incrementAndGet();
            return new ArrayList<>(cached);
        }

        cacheMisses.incrementAndGet();
        log.debug("Cache miss for rule code: {}", ruleCode);

        // Load from database and cache
        List<SmartBiIncentiveRule> rules = repository.findByRuleCodeAndIsActiveTrueOrderBySortOrderAsc(ruleCode);
        List<SmartBiIncentiveRule> globalRules = rules.stream()
                .filter(r -> r.getFactoryId() == null)
                .collect(Collectors.toList());

        if (!globalRules.isEmpty()) {
            globalRuleCache.put(ruleCode, globalRules);
        }

        return new ArrayList<>(globalRules);
    }

    @Override
    public List<SmartBiIncentiveRule> getRulesByCode(String ruleCode, String factoryId) {
        if (ruleCode == null || ruleCode.isEmpty()) {
            return Collections.emptyList();
        }

        // Try factory-specific rules first
        if (factoryId != null && !factoryId.isEmpty()) {
            String cacheKey = buildFactoryCacheKey(ruleCode, factoryId);
            List<SmartBiIncentiveRule> factoryRules = factoryRuleCache.get(cacheKey);

            if (factoryRules != null && !factoryRules.isEmpty()) {
                cacheHits.incrementAndGet();
                return new ArrayList<>(factoryRules);
            }

            // Load factory rules from database
            factoryRules = repository.findByRuleCodeAndFactoryIdAndIsActiveTrueOrderBySortOrderAsc(
                    ruleCode, factoryId);

            if (!factoryRules.isEmpty()) {
                cacheMisses.incrementAndGet();
                factoryRuleCache.put(cacheKey, factoryRules);
                return new ArrayList<>(factoryRules);
            }
        }

        // Fall back to global rules
        return getRulesByCode(ruleCode);
    }

    @Override
    public SmartBiIncentiveRule matchRule(String ruleCode, BigDecimal value) {
        return matchRule(ruleCode, value, null);
    }

    @Override
    public SmartBiIncentiveRule matchRule(String ruleCode, BigDecimal value, String factoryId) {
        if (ruleCode == null || value == null) {
            log.debug("Cannot match rule: ruleCode={}, value={}", ruleCode, value);
            return null;
        }

        List<SmartBiIncentiveRule> rules = getRulesByCode(ruleCode, factoryId);

        for (SmartBiIncentiveRule rule : rules) {
            if (rule.matches(value)) {
                log.debug("Matched rule: code={}, level={}, value={}, range={}",
                        ruleCode, rule.getLevelName(), value, rule.getRangeDisplay());
                return rule;
            }
        }

        log.debug("No matching rule found: code={}, value={}", ruleCode, value);
        return null;
    }

    @Override
    public BigDecimal calculateReward(String ruleCode, BigDecimal value, BigDecimal baseAmount) {
        return calculateReward(ruleCode, value, baseAmount, null);
    }

    @Override
    public BigDecimal calculateReward(String ruleCode, BigDecimal value, BigDecimal baseAmount, String factoryId) {
        SmartBiIncentiveRule matchedRule = matchRule(ruleCode, value, factoryId);

        if (matchedRule == null) {
            log.debug("No rule matched for reward calculation: code={}, value={}", ruleCode, value);
            return BigDecimal.ZERO;
        }

        BigDecimal reward = matchedRule.calculateReward(baseAmount);
        log.debug("Calculated reward: code={}, level={}, value={}, baseAmount={}, reward={}",
                ruleCode, matchedRule.getLevelName(), value, baseAmount, reward);

        return reward;
    }

    @Override
    public List<String> getAllRuleCodes() {
        if (!globalRuleCache.isEmpty()) {
            return new ArrayList<>(globalRuleCache.keySet());
        }

        return repository.findAllDistinctRuleCodes();
    }

    @Override
    public Map<String, List<SmartBiIncentiveRule>> getAllRulesGrouped() {
        if (!globalRuleCache.isEmpty()) {
            Map<String, List<SmartBiIncentiveRule>> result = new LinkedHashMap<>();
            globalRuleCache.forEach((key, value) -> result.put(key, new ArrayList<>(value)));
            return result;
        }

        List<SmartBiIncentiveRule> allRules = repository.findByIsActiveTrueOrderByRuleCodeAscSortOrderAsc();
        return allRules.stream()
                .collect(Collectors.groupingBy(
                        SmartBiIncentiveRule::getRuleCode,
                        LinkedHashMap::new,
                        Collectors.toList()
                ));
    }

    @Override
    public boolean ruleExists(String ruleCode) {
        if (ruleCode == null || ruleCode.isEmpty()) {
            return false;
        }

        // Check cache first
        if (globalRuleCache.containsKey(ruleCode)) {
            return true;
        }

        return repository.existsByRuleCodeAndIsActiveTrue(ruleCode);
    }

    @Override
    public void reload() {
        log.info("Reloading incentive rules cache...");

        long startTime = System.currentTimeMillis();

        // Clear all caches
        globalRuleCache.clear();
        factoryRuleCache.clear();

        // Reset statistics
        cacheHits.set(0);
        cacheMisses.set(0);

        // Warm up cache again
        warmUpCache();

        long duration = System.currentTimeMillis() - startTime;
        log.info("Incentive rules cache reloaded in {} ms, {} global rule codes loaded",
                duration, globalRuleCache.size());
    }

    @Override
    public Map<String, Object> getCacheStats() {
        Map<String, Object> stats = new LinkedHashMap<>();
        long hits = cacheHits.get();
        long misses = cacheMisses.get();
        long total = hits + misses;

        stats.put("globalRuleCodes", globalRuleCache.size());
        stats.put("factoryRuleEntries", factoryRuleCache.size());
        stats.put("cacheHits", hits);
        stats.put("cacheMisses", misses);
        stats.put("hitRate", total > 0 ? String.format("%.2f%%", (hits * 100.0 / total)) : "N/A");
        stats.put("lastReloadTime", lastReloadTime > 0 ? new Date(lastReloadTime) : null);

        // Count total rules
        int totalRules = globalRuleCache.values().stream()
                .mapToInt(List::size)
                .sum();
        totalRules += factoryRuleCache.values().stream()
                .mapToInt(List::size)
                .sum();
        stats.put("totalCachedRules", totalRules);

        return stats;
    }

    /**
     * Build cache key for factory-specific rules
     */
    private String buildFactoryCacheKey(String ruleCode, String factoryId) {
        return ruleCode + ":" + factoryId;
    }
}

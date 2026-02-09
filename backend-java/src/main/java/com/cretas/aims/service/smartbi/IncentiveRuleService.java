package com.cretas.aims.service.smartbi;

import com.cretas.aims.entity.smartbi.SmartBiIncentiveRule;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Incentive Rule Service Interface
 *
 * <p>Provides incentive rule management and calculation capabilities:
 * <ul>
 *   <li>Rule retrieval by code with caching</li>
 *   <li>Value-based rule matching</li>
 *   <li>Reward calculation (rate-based or fixed)</li>
 *   <li>Hot reload support for rule changes</li>
 * </ul>
 *
 * <p>Usage examples:
 * <pre>
 * // Get matching rule for sales target completion
 * SmartBiIncentiveRule rule = incentiveRuleService.matchRule("SALES_TARGET", new BigDecimal("125"));
 *
 * // Calculate reward for sales performance
 * BigDecimal reward = incentiveRuleService.calculateReward("SALES_TARGET",
 *     new BigDecimal("125"), new BigDecimal("100000"));
 * </pre>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
public interface IncentiveRuleService {

    /**
     * Get all active rules for a given rule code
     *
     * @param ruleCode The rule code (e.g., SALES_TARGET, QUALITY_SCORE)
     * @return List of rules ordered by sort order
     */
    List<SmartBiIncentiveRule> getRulesByCode(String ruleCode);

    /**
     * Get all active rules for a rule code and factory (with global fallback)
     *
     * @param ruleCode The rule code
     * @param factoryId The factory ID
     * @return List of applicable rules
     */
    List<SmartBiIncentiveRule> getRulesByCode(String ruleCode, String factoryId);

    /**
     * Match a value against rules and return the matching rule
     *
     * @param ruleCode The rule code
     * @param value The value to match (e.g., completion percentage)
     * @return Matching rule, or null if no rule matches
     */
    SmartBiIncentiveRule matchRule(String ruleCode, BigDecimal value);

    /**
     * Match a value against factory-specific rules
     *
     * @param ruleCode The rule code
     * @param value The value to match
     * @param factoryId The factory ID
     * @return Matching rule, or null if no rule matches
     */
    SmartBiIncentiveRule matchRule(String ruleCode, BigDecimal value, String factoryId);

    /**
     * Calculate reward based on rule and base amount
     *
     * @param ruleCode The rule code
     * @param value The value that determines the matching rule
     * @param baseAmount The base amount for reward calculation
     * @return Calculated reward amount, or ZERO if no rule matches
     */
    BigDecimal calculateReward(String ruleCode, BigDecimal value, BigDecimal baseAmount);

    /**
     * Calculate reward with factory-specific rules
     *
     * @param ruleCode The rule code
     * @param value The value that determines the matching rule
     * @param baseAmount The base amount for reward calculation
     * @param factoryId The factory ID
     * @return Calculated reward amount, or ZERO if no rule matches
     */
    BigDecimal calculateReward(String ruleCode, BigDecimal value, BigDecimal baseAmount, String factoryId);

    /**
     * Get all available rule codes
     *
     * @return List of distinct rule codes
     */
    List<String> getAllRuleCodes();

    /**
     * Get all rules grouped by rule code
     *
     * @return Map of rule code to list of rules
     */
    Map<String, List<SmartBiIncentiveRule>> getAllRulesGrouped();

    /**
     * Check if a rule code exists
     *
     * @param ruleCode The rule code to check
     * @return true if the rule exists
     */
    boolean ruleExists(String ruleCode);

    /**
     * Reload all rules from database (clear cache)
     * Call this after rules are modified in the database
     */
    void reload();

    /**
     * Get cache statistics for monitoring
     *
     * @return Map containing cache hit rate, size, etc.
     */
    Map<String, Object> getCacheStats();
}

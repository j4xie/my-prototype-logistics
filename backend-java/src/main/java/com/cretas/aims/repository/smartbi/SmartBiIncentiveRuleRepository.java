package com.cretas.aims.repository.smartbi;

import com.cretas.aims.entity.smartbi.SmartBiIncentiveRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * SmartBI Incentive Rule Repository
 *
 * <p>Provides data access for incentive rule configurations:
 * <ul>
 *   <li>Query rules by code with active filtering</li>
 *   <li>Support factory-specific rule overrides</li>
 *   <li>Ordered retrieval for level progression</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Repository
public interface SmartBiIncentiveRuleRepository extends JpaRepository<SmartBiIncentiveRule, Long> {

    /**
     * Find all active rules by rule code, ordered by sort order
     *
     * @param ruleCode The rule code (e.g., SALES_TARGET)
     * @return List of active rules ordered by sortOrder ascending
     */
    List<SmartBiIncentiveRule> findByRuleCodeAndIsActiveTrueOrderBySortOrderAsc(String ruleCode);

    /**
     * Find active rules by rule code and factory ID
     *
     * @param ruleCode The rule code
     * @param factoryId The factory ID
     * @return List of factory-specific active rules
     */
    List<SmartBiIncentiveRule> findByRuleCodeAndFactoryIdAndIsActiveTrueOrderBySortOrderAsc(
            String ruleCode, String factoryId);

    /**
     * Find all active rules ordered by rule code and sort order
     *
     * @return All active rules properly ordered
     */
    List<SmartBiIncentiveRule> findByIsActiveTrueOrderByRuleCodeAscSortOrderAsc();

    /**
     * Find global rules (factory_id is null) by rule code
     *
     * @param ruleCode The rule code
     * @return List of global rules for the given code
     */
    @Query("SELECT r FROM SmartBiIncentiveRule r WHERE r.ruleCode = :ruleCode " +
           "AND r.factoryId IS NULL AND r.isActive = true ORDER BY r.sortOrder ASC")
    List<SmartBiIncentiveRule> findGlobalRulesByCode(@Param("ruleCode") String ruleCode);

    /**
     * Find rules applicable to a factory (factory-specific or global)
     *
     * @param ruleCode The rule code
     * @param factoryId The factory ID
     * @return List of applicable rules (factory-specific takes precedence)
     */
    @Query("SELECT r FROM SmartBiIncentiveRule r WHERE r.ruleCode = :ruleCode " +
           "AND r.isActive = true AND (r.factoryId = :factoryId OR r.factoryId IS NULL) " +
           "ORDER BY CASE WHEN r.factoryId IS NOT NULL THEN 0 ELSE 1 END, r.sortOrder ASC")
    List<SmartBiIncentiveRule> findApplicableRules(
            @Param("ruleCode") String ruleCode,
            @Param("factoryId") String factoryId);

    /**
     * Get all distinct rule codes
     *
     * @return List of distinct rule codes
     */
    @Query("SELECT DISTINCT r.ruleCode FROM SmartBiIncentiveRule r WHERE r.isActive = true")
    List<String> findAllDistinctRuleCodes();

    /**
     * Check if rules exist for a given code
     *
     * @param ruleCode The rule code to check
     * @return true if at least one active rule exists
     */
    boolean existsByRuleCodeAndIsActiveTrue(String ruleCode);
}

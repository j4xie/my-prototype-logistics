package com.cretas.aims.repository;

import com.cretas.aims.entity.rules.DroolsRule;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Drools 规则 Repository
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
@Repository
public interface DroolsRuleRepository extends JpaRepository<DroolsRule, String> {

    /**
     * 按工厂ID查询所有启用的规则
     */
    List<DroolsRule> findByFactoryIdAndEnabledTrue(String factoryId);

    /**
     * 按工厂ID和规则组查询启用的规则
     */
    List<DroolsRule> findByFactoryIdAndRuleGroupAndEnabledTrueOrderByPriorityDesc(
            String factoryId, String ruleGroup);

    /**
     * 按工厂ID查询所有规则（分页）
     */
    Page<DroolsRule> findByFactoryId(String factoryId, Pageable pageable);

    /**
     * 按工厂ID和规则组查询（分页）
     */
    Page<DroolsRule> findByFactoryIdAndRuleGroup(String factoryId, String ruleGroup, Pageable pageable);

    /**
     * 按唯一键查询
     */
    Optional<DroolsRule> findByFactoryIdAndRuleGroupAndRuleName(
            String factoryId, String ruleGroup, String ruleName);

    /**
     * 检查规则名是否存在
     */
    boolean existsByFactoryIdAndRuleGroupAndRuleName(
            String factoryId, String ruleGroup, String ruleName);

    /**
     * 按工厂ID统计规则数量
     */
    long countByFactoryId(String factoryId);

    /**
     * 按工厂ID和规则组统计
     */
    long countByFactoryIdAndRuleGroup(String factoryId, String ruleGroup);

    /**
     * 获取工厂的所有规则组
     */
    @Query("SELECT DISTINCT r.ruleGroup FROM DroolsRule r WHERE r.factoryId = :factoryId")
    List<String> findDistinctRuleGroupsByFactoryId(@Param("factoryId") String factoryId);

    /**
     * 按优先级排序查询工厂规则
     */
    @Query("SELECT r FROM DroolsRule r WHERE r.factoryId = :factoryId AND r.enabled = true ORDER BY r.priority DESC, r.ruleGroup, r.ruleName")
    List<DroolsRule> findAllEnabledByFactoryIdOrderByPriority(@Param("factoryId") String factoryId);

    /**
     * 搜索规则
     */
    @Query("SELECT r FROM DroolsRule r WHERE r.factoryId = :factoryId " +
           "AND (r.ruleName LIKE %:keyword% OR r.ruleDescription LIKE %:keyword%)")
    Page<DroolsRule> searchByKeyword(@Param("factoryId") String factoryId,
                                      @Param("keyword") String keyword,
                                      Pageable pageable);
}

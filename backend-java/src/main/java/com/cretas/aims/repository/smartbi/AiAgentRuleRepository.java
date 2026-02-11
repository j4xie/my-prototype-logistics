package com.cretas.aims.repository.smartbi;

import com.cretas.aims.entity.smartbi.AiAgentRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * AI Agent 规则配置 Repository
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Repository
public interface AiAgentRuleRepository extends JpaRepository<AiAgentRule, String> {

    /**
     * 根据触发类型查找启用的规则（全局规则）
     *
     * @param triggerType 触发类型
     * @return 规则列表，按优先级排序
     */
    @Query("SELECT r FROM AiAgentRule r WHERE r.triggerType = :triggerType " +
           "AND r.isActive = true AND r.factoryId = 'DEFAULT' ORDER BY r.priority ASC")
    List<AiAgentRule> findByTriggerTypeAndIsActiveTrue(@Param("triggerType") String triggerType);

    /**
     * 根据工厂ID和触发类型查找启用的规则
     *
     * @param factoryId 工厂ID
     * @param triggerType 触发类型
     * @return 规则列表，按优先级排序
     */
    @Query("SELECT r FROM AiAgentRule r WHERE r.triggerType = :triggerType " +
           "AND r.isActive = true AND (r.factoryId = :factoryId OR r.factoryId = 'DEFAULT') " +
           "ORDER BY r.priority ASC")
    List<AiAgentRule> findByFactoryIdAndTriggerTypeAndIsActiveTrue(
            @Param("factoryId") String factoryId,
            @Param("triggerType") String triggerType);

    /**
     * 根据触发类型和触发实体查找启用的规则
     *
     * @param triggerType 触发类型
     * @param triggerEntity 触发实体
     * @param factoryId 工厂ID
     * @return 规则列表，按优先级排序
     */
    @Query("SELECT r FROM AiAgentRule r WHERE r.triggerType = :triggerType " +
           "AND r.triggerEntity = :triggerEntity " +
           "AND r.isActive = true AND (r.factoryId = :factoryId OR r.factoryId = 'DEFAULT') " +
           "ORDER BY r.priority ASC")
    List<AiAgentRule> findByTriggerTypeAndTriggerEntityAndFactoryId(
            @Param("triggerType") String triggerType,
            @Param("triggerEntity") String triggerEntity,
            @Param("factoryId") String factoryId);

    /**
     * 查找工厂的所有启用规则
     *
     * @param factoryId 工厂ID
     * @return 规则列表
     */
    @Query("SELECT r FROM AiAgentRule r WHERE r.isActive = true " +
           "AND (r.factoryId = :factoryId OR r.factoryId = 'DEFAULT') " +
           "ORDER BY r.triggerType, r.priority ASC")
    List<AiAgentRule> findAllActiveByFactoryId(@Param("factoryId") String factoryId);

    /**
     * 统计指定触发类型的规则数量
     *
     * @param triggerType 触发类型
     * @return 规则数量
     */
    long countByTriggerTypeAndIsActiveTrue(String triggerType);

    /**
     * 根据规则名称查找
     *
     * @param ruleName 规则名称
     * @return 规则列表
     */
    List<AiAgentRule> findByRuleName(String ruleName);

    /**
     * 根据工厂ID查找规则（包含指定工厂和默认工厂的所有规则，含禁用的）
     *
     * @param factoryId1 工厂ID
     * @param factoryId2 第二个工厂ID（通常为 "DEFAULT"）
     * @return 规则列表
     */
    List<AiAgentRule> findByFactoryIdOrFactoryId(String factoryId1, String factoryId2);
}

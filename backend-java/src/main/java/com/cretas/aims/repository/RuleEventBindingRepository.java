package com.cretas.aims.repository;

import com.cretas.aims.entity.rules.RuleEventBinding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 规则事件绑定 Repository
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
@Repository
public interface RuleEventBindingRepository extends JpaRepository<RuleEventBinding, String> {

    /**
     * 查询工厂的所有事件绑定
     */
    List<RuleEventBinding> findByFactoryIdAndEnabledTrue(String factoryId);

    /**
     * 按实体类型和事件类型查询绑定
     */
    List<RuleEventBinding> findByFactoryIdAndEntityTypeAndEventTypeAndEnabledTrueOrderByPriorityDesc(
            String factoryId, String entityType, String eventType);

    /**
     * 按实体类型查询所有绑定
     */
    List<RuleEventBinding> findByFactoryIdAndEntityTypeAndEnabledTrue(
            String factoryId, String entityType);

    /**
     * 按唯一键查询
     */
    Optional<RuleEventBinding> findByFactoryIdAndEntityTypeAndEventTypeAndRuleGroup(
            String factoryId, String entityType, String eventType, String ruleGroup);

    /**
     * 检查绑定是否存在
     */
    boolean existsByFactoryIdAndEntityTypeAndEventTypeAndRuleGroup(
            String factoryId, String entityType, String eventType, String ruleGroup);

    /**
     * 删除指定规则组的所有绑定
     */
    void deleteByFactoryIdAndRuleGroup(String factoryId, String ruleGroup);

    /**
     * 获取工厂配置的所有实体类型
     */
    @Query("SELECT DISTINCT b.entityType FROM RuleEventBinding b WHERE b.factoryId = :factoryId")
    List<String> findDistinctEntityTypesByFactoryId(@Param("factoryId") String factoryId);

    /**
     * 获取实体类型的所有事件类型
     */
    @Query("SELECT DISTINCT b.eventType FROM RuleEventBinding b " +
           "WHERE b.factoryId = :factoryId AND b.entityType = :entityType")
    List<String> findDistinctEventTypesByFactoryIdAndEntityType(
            @Param("factoryId") String factoryId,
            @Param("entityType") String entityType);
}

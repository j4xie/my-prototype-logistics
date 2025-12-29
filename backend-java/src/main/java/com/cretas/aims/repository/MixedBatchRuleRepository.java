package com.cretas.aims.repository;

import com.cretas.aims.entity.MixedBatchRule;
import com.cretas.aims.entity.enums.MixedBatchType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 混批规则仓库
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
@Repository
public interface MixedBatchRuleRepository extends JpaRepository<MixedBatchRule, String> {

    /**
     * 按工厂查询所有规则
     */
    List<MixedBatchRule> findByFactoryId(String factoryId);

    /**
     * 按工厂和规则类型查询
     */
    Optional<MixedBatchRule> findByFactoryIdAndRuleType(String factoryId, MixedBatchType ruleType);

    /**
     * 查询工厂的启用规则
     */
    List<MixedBatchRule> findByFactoryIdAndIsEnabledTrue(String factoryId);

    /**
     * 查询特定类型的启用规则
     */
    Optional<MixedBatchRule> findByFactoryIdAndRuleTypeAndIsEnabledTrue(String factoryId, MixedBatchType ruleType);

    /**
     * 检查规则是否存在
     */
    boolean existsByFactoryIdAndRuleType(String factoryId, MixedBatchType ruleType);

    /**
     * 删除工厂的所有规则
     */
    void deleteByFactoryId(String factoryId);
}

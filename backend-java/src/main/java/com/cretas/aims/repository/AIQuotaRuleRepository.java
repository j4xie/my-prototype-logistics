package com.cretas.aims.repository;

import com.cretas.aims.entity.AIQuotaRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * AI配额规则数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Repository
public interface AIQuotaRuleRepository extends JpaRepository<AIQuotaRule, Long> {

    /**
     * 查找工厂的配额规则
     *
     * @param factoryId 工厂ID
     * @return 配额规则（如果存在）
     */
    Optional<AIQuotaRule> findByFactoryIdAndEnabledTrue(String factoryId);

    /**
     * 查找所有启用的规则
     *
     * @return 启用的规则列表
     */
    List<AIQuotaRule> findByEnabledTrueOrderByPriorityDesc();

    /**
     * 查找全局默认规则（factoryId为null）
     *
     * @return 全局默认规则
     */
    Optional<AIQuotaRule> findByFactoryIdIsNullAndEnabledTrue();

    /**
     * 检查工厂是否已有配额规则
     *
     * @param factoryId 工厂ID
     * @return 是否存在
     */
    boolean existsByFactoryId(String factoryId);

    /**
     * 查找工厂的所有规则（包括禁用的）
     *
     * @param factoryId 工厂ID
     * @return 规则列表
     */
    List<AIQuotaRule> findByFactoryIdOrderByPriorityDesc(String factoryId);

    /**
     * 获取工厂的有效配额规则（优先级最高的启用规则）
     *
     * @param factoryId 工厂ID
     * @return 有效规则
     */
    Optional<AIQuotaRule> findFirstByFactoryIdAndEnabledTrueOrderByPriorityDescCreatedAtDesc(String factoryId);

    /**
     * 删除工厂的所有规则
     *
     * @param factoryId 工厂ID
     */
    void deleteByFactoryId(String factoryId);
}

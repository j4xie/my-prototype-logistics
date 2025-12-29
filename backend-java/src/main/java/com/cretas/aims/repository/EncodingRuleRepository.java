package com.cretas.aims.repository;

import com.cretas.aims.entity.config.EncodingRule;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 编码规则数据访问接口
 *
 * 支持:
 * - 按工厂和实体类型查询
 * - 系统级规则查询 (factoryId = null)
 * - 序列号原子更新
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
@Repository
public interface EncodingRuleRepository extends JpaRepository<EncodingRule, String> {

    /**
     * 根据工厂ID和实体类型查找启用的编码规则
     * 优先返回工厂级规则，如果没有则返回系统级规则
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @return 编码规则列表（工厂级优先）
     */
    @Query("SELECT e FROM EncodingRule e WHERE e.entityType = :entityType " +
           "AND (e.factoryId = :factoryId OR e.factoryId IS NULL) " +
           "AND e.enabled = true " +
           "ORDER BY CASE WHEN e.factoryId IS NOT NULL THEN 0 ELSE 1 END")
    List<EncodingRule> findByFactoryIdAndEntityType(
            @Param("factoryId") String factoryId,
            @Param("entityType") String entityType);

    /**
     * 查找工厂特定实体类型的启用规则
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @return 编码规则（如果存在）
     */
    default Optional<EncodingRule> findActiveByFactoryIdAndEntityType(String factoryId, String entityType) {
        List<EncodingRule> rules = findByFactoryIdAndEntityType(factoryId, entityType);
        return rules.isEmpty() ? Optional.empty() : Optional.of(rules.get(0));
    }

    /**
     * 查找工厂的所有编码规则
     *
     * @param factoryId 工厂ID
     * @return 编码规则列表
     */
    List<EncodingRule> findByFactoryIdAndEnabledTrue(String factoryId);

    /**
     * 分页查询工厂的编码规则
     *
     * @param factoryId 工厂ID
     * @param pageable 分页参数
     * @return 分页编码规则列表
     */
    Page<EncodingRule> findByFactoryId(String factoryId, Pageable pageable);

    /**
     * 查询系统级编码规则（factoryId = null）
     *
     * @return 系统级编码规则列表
     */
    List<EncodingRule> findByFactoryIdIsNullAndEnabledTrue();

    /**
     * 检查工厂是否存在指定实体类型的编码规则
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @return 是否存在
     */
    boolean existsByFactoryIdAndEntityType(String factoryId, String entityType);

    /**
     * 原子递增序列号
     * 使用悲观锁确保线程安全
     *
     * @param ruleId 规则ID
     * @return 更新的行数
     */
    @Modifying
    @Query("UPDATE EncodingRule e SET e.currentSequence = e.currentSequence + 1 WHERE e.id = :ruleId")
    int incrementSequence(@Param("ruleId") String ruleId);

    /**
     * 重置序列号
     *
     * @param ruleId 规则ID
     * @param lastResetDate 最后重置日期
     * @return 更新的行数
     */
    @Modifying
    @Query("UPDATE EncodingRule e SET e.currentSequence = 0, e.lastResetDate = :lastResetDate WHERE e.id = :ruleId")
    int resetSequence(@Param("ruleId") String ruleId, @Param("lastResetDate") String lastResetDate);

    /**
     * 获取并锁定编码规则（用于生成序号）
     *
     * @param ruleId 规则ID
     * @return 编码规则
     */
    @Query("SELECT e FROM EncodingRule e WHERE e.id = :ruleId")
    Optional<EncodingRule> findByIdForUpdate(@Param("ruleId") String ruleId);

    /**
     * 统计工厂的编码规则数量
     *
     * @param factoryId 工厂ID
     * @return 规则数量
     */
    long countByFactoryIdAndEnabledTrue(String factoryId);

    /**
     * 按实体类型查询所有启用的编码规则
     *
     * @param entityType 实体类型
     * @return 编码规则列表
     */
    List<EncodingRule> findByEntityTypeAndEnabledTrue(String entityType);
}

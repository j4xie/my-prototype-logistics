package com.cretas.aims.repository;

import com.cretas.aims.entity.PieceRateRule;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * 计件单价规则数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
@Repository
public interface PieceRateRuleRepository extends JpaRepository<PieceRateRule, Long> {

    /**
     * 根据工厂ID查找所有计件规则
     */
    List<PieceRateRule> findByFactoryId(String factoryId);

    /**
     * 根据工厂ID查找所有计件规则（按优先级降序）
     */
    List<PieceRateRule> findByFactoryIdOrderByPriorityDesc(String factoryId);

    /**
     * 分页查找工厂的计件规则
     */
    Page<PieceRateRule> findByFactoryId(String factoryId, Pageable pageable);

    /**
     * 查找工厂的有效规则
     */
    List<PieceRateRule> findByFactoryIdAndIsActive(String factoryId, Boolean isActive);

    /**
     * 按工厂ID查询所有启用的规则（按优先级降序）
     */
    List<PieceRateRule> findByFactoryIdAndIsActiveTrueOrderByPriorityDesc(String factoryId);

    /**
     * 根据工序类型查找规则
     */
    List<PieceRateRule> findByFactoryIdAndProcessStageType(String factoryId, String processStageType);

    /**
     * 按工厂+工序类型查询启用的规则
     */
    List<PieceRateRule> findByFactoryIdAndProcessStageTypeAndIsActiveTrue(String factoryId, String processStageType);

    /**
     * 根据工作类型查找规则
     */
    List<PieceRateRule> findByFactoryIdAndWorkTypeId(String factoryId, String workTypeId);

    /**
     * 根据产品类型查找规则
     */
    List<PieceRateRule> findByFactoryIdAndProductTypeId(String factoryId, String productTypeId);

    /**
     * 按工厂+产品类型查询启用的规则
     */
    List<PieceRateRule> findByFactoryIdAndProductTypeIdAndIsActiveTrue(String factoryId, String productTypeId);

    /**
     * 查找指定日期有效的规则 (按优先级排序)
     */
    @Query("SELECT r FROM PieceRateRule r WHERE r.factoryId = :factoryId " +
           "AND r.isActive = true " +
           "AND (r.effectiveFrom IS NULL OR r.effectiveFrom <= :date) " +
           "AND (r.effectiveTo IS NULL OR r.effectiveTo >= :date) " +
           "ORDER BY r.priority DESC")
    List<PieceRateRule> findEffectiveRules(
            @Param("factoryId") String factoryId,
            @Param("date") LocalDate date);

    /**
     * 查找指定日期和工序类型有效的规则 (按优先级排序)
     */
    @Query("SELECT r FROM PieceRateRule r WHERE r.factoryId = :factoryId " +
           "AND r.processStageType = :processStageType " +
           "AND r.isActive = true " +
           "AND (r.effectiveFrom IS NULL OR r.effectiveFrom <= :date) " +
           "AND (r.effectiveTo IS NULL OR r.effectiveTo >= :date) " +
           "ORDER BY r.priority DESC")
    List<PieceRateRule> findEffectiveRulesByProcessStage(
            @Param("factoryId") String factoryId,
            @Param("processStageType") String processStageType,
            @Param("date") LocalDate date);

    /**
     * 查找指定条件下最高优先级的规则
     */
    @Query("SELECT r FROM PieceRateRule r WHERE r.factoryId = :factoryId " +
           "AND r.isActive = true " +
           "AND (r.processStageType = :processStageType OR r.processStageType IS NULL) " +
           "AND (r.productTypeId = :productTypeId OR r.productTypeId IS NULL) " +
           "AND (r.effectiveFrom IS NULL OR r.effectiveFrom <= :date) " +
           "AND (r.effectiveTo IS NULL OR r.effectiveTo >= :date) " +
           "ORDER BY r.priority DESC")
    List<PieceRateRule> findMatchingRules(
            @Param("factoryId") String factoryId,
            @Param("processStageType") String processStageType,
            @Param("productTypeId") String productTypeId,
            @Param("date") LocalDate date);

    /**
     * 获取最高优先级的匹配规则
     */
    default Optional<PieceRateRule> findBestMatchingRule(String factoryId,
            String processStageType, String productTypeId, LocalDate date) {
        List<PieceRateRule> rules = findMatchingRules(factoryId, processStageType, productTypeId, date);
        return rules.isEmpty() ? Optional.empty() : Optional.of(rules.get(0));
    }

    /**
     * 统计工厂的规则数量
     */
    long countByFactoryId(String factoryId);

    /**
     * 统计工厂的有效规则数量
     */
    long countByFactoryIdAndIsActive(String factoryId, Boolean isActive);

    /**
     * 检查规则名称是否存在
     */
    boolean existsByFactoryIdAndName(String factoryId, String name);
}

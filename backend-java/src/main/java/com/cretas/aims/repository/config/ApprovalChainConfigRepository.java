package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.ApprovalChainConfig;
import com.cretas.aims.entity.config.ApprovalChainConfig.DecisionType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 审批链路配置 Repository
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-30
 */
@Repository
public interface ApprovalChainConfigRepository extends JpaRepository<ApprovalChainConfig, String> {

    /**
     * 根据工厂ID查询所有启用的审批链配置
     */
    List<ApprovalChainConfig> findByFactoryIdAndEnabledTrueOrderByPriorityDesc(String factoryId);

    /**
     * 根据工厂ID和决策类型查询配置
     */
    List<ApprovalChainConfig> findByFactoryIdAndDecisionTypeAndEnabledTrueOrderByApprovalLevel(
            String factoryId, DecisionType decisionType);

    /**
     * 根据工厂ID、决策类型和审批级别查询配置
     */
    Optional<ApprovalChainConfig> findByFactoryIdAndDecisionTypeAndApprovalLevelAndEnabledTrue(
            String factoryId, DecisionType decisionType, Integer approvalLevel);

    /**
     * 根据工厂ID和决策类型查询第一级审批配置
     */
    @Query("SELECT c FROM ApprovalChainConfig c WHERE c.factoryId = :factoryId " +
           "AND c.decisionType = :decisionType AND c.enabled = true " +
           "ORDER BY c.approvalLevel ASC")
    List<ApprovalChainConfig> findFirstLevelConfig(
            @Param("factoryId") String factoryId,
            @Param("decisionType") DecisionType decisionType);

    /**
     * 根据升级配置ID查询
     */
    Optional<ApprovalChainConfig> findByIdAndEnabledTrue(String id);

    /**
     * 检查配置名称是否存在
     */
    boolean existsByFactoryIdAndDecisionTypeAndName(
            String factoryId, DecisionType decisionType, String name);

    /**
     * 根据工厂ID查询所有配置 (包括禁用的)
     */
    List<ApprovalChainConfig> findByFactoryIdOrderByDecisionTypeAscPriorityDesc(String factoryId);

    /**
     * 根据工厂ID和决策类型查询最大审批级别
     */
    @Query("SELECT MAX(c.approvalLevel) FROM ApprovalChainConfig c " +
           "WHERE c.factoryId = :factoryId AND c.decisionType = :decisionType AND c.enabled = true")
    Integer findMaxApprovalLevel(
            @Param("factoryId") String factoryId,
            @Param("decisionType") DecisionType decisionType);

    /**
     * 统计工厂各决策类型的配置数量
     */
    @Query("SELECT c.decisionType, COUNT(c) FROM ApprovalChainConfig c " +
           "WHERE c.factoryId = :factoryId AND c.enabled = true " +
           "GROUP BY c.decisionType")
    List<Object[]> countByFactoryIdGroupByDecisionType(@Param("factoryId") String factoryId);
}

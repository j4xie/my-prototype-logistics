package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.ConfigChangeSet;
import com.cretas.aims.entity.config.ConfigChangeSet.ChangeStatus;
import com.cretas.aims.entity.config.ConfigChangeSet.ConfigType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 配置变更集仓库
 *
 * @author Cretas Team
 * @since 2025-12-30
 */
@Repository
public interface ConfigChangeSetRepository extends JpaRepository<ConfigChangeSet, String> {

    /**
     * 按工厂ID分页查询变更集
     */
    Page<ConfigChangeSet> findByFactoryIdOrderByCreatedAtDesc(String factoryId, Pageable pageable);

    /**
     * 按工厂ID和状态查询
     */
    Page<ConfigChangeSet> findByFactoryIdAndStatusOrderByCreatedAtDesc(
            String factoryId, ChangeStatus status, Pageable pageable);

    /**
     * 按配置类型和配置ID查询历史变更
     */
    List<ConfigChangeSet> findByConfigTypeAndConfigIdOrderByCreatedAtDesc(
            ConfigType configType, String configId);

    /**
     * 按配置ID查询最新的已应用变更
     */
    Optional<ConfigChangeSet> findFirstByConfigIdAndStatusOrderByAppliedAtDesc(
            String configId, ChangeStatus status);

    /**
     * 查询待审批的变更集
     */
    @Query("SELECT c FROM ConfigChangeSet c WHERE c.factoryId = :factoryId " +
           "AND c.status = 'PENDING' ORDER BY c.createdAt ASC")
    List<ConfigChangeSet> findPendingChangeSets(@Param("factoryId") String factoryId);

    /**
     * 统计待审批数量
     */
    @Query("SELECT COUNT(c) FROM ConfigChangeSet c WHERE c.factoryId = :factoryId " +
           "AND c.status = 'PENDING'")
    long countPendingByFactoryId(@Param("factoryId") String factoryId);

    /**
     * 查询可回滚的变更集
     */
    @Query("SELECT c FROM ConfigChangeSet c WHERE c.factoryId = :factoryId " +
           "AND c.status = 'APPLIED' AND c.isRollbackable = true " +
           "ORDER BY c.appliedAt DESC")
    List<ConfigChangeSet> findRollbackableChangeSets(@Param("factoryId") String factoryId);

    /**
     * 按创建者查询
     */
    Page<ConfigChangeSet> findByFactoryIdAndCreatedByOrderByCreatedAtDesc(
            String factoryId, Long createdBy, Pageable pageable);

    /**
     * 查询指定时间范围内的变更
     */
    @Query("SELECT c FROM ConfigChangeSet c WHERE c.factoryId = :factoryId " +
           "AND c.createdAt BETWEEN :startTime AND :endTime " +
           "ORDER BY c.createdAt DESC")
    List<ConfigChangeSet> findByFactoryIdAndCreatedAtBetween(
            @Param("factoryId") String factoryId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    /**
     * 检查是否有未完成的变更 (同一配置的PENDING状态)
     */
    @Query("SELECT COUNT(c) > 0 FROM ConfigChangeSet c WHERE c.configId = :configId " +
           "AND c.status = 'PENDING'")
    boolean existsPendingChangeForConfig(@Param("configId") String configId);

    /**
     * 查询特定配置的最新已应用版本号
     */
    @Query("SELECT c.toVersion FROM ConfigChangeSet c WHERE c.configId = :configId " +
           "AND c.status = 'APPLIED' ORDER BY c.toVersion DESC")
    Optional<Integer> findLatestAppliedVersion(@Param("configId") String configId);

    /**
     * 按配置类型统计各状态数量
     */
    @Query("SELECT c.status, COUNT(c) FROM ConfigChangeSet c " +
           "WHERE c.factoryId = :factoryId AND c.configType = :configType " +
           "GROUP BY c.status")
    List<Object[]> countByStatusAndConfigType(
            @Param("factoryId") String factoryId,
            @Param("configType") ConfigType configType);
}

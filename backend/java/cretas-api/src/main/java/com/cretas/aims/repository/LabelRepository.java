package com.cretas.aims.repository;

import com.cretas.aims.entity.Label;
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
 * 标签数据访问接口
 * 用于管理产品追溯标签、条码、二维码等
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
@Repository
public interface LabelRepository extends JpaRepository<Label, String> {

    /**
     * 根据工厂ID分页查询标签
     */
    Page<Label> findByFactoryIdAndDeletedAtIsNull(String factoryId, Pageable pageable);

    /**
     * 根据ID和工厂ID查询
     */
    Optional<Label> findByIdAndFactoryIdAndDeletedAtIsNull(String id, String factoryId);

    /**
     * 根据标签编码查询（全局唯一）
     */
    Optional<Label> findByLabelCodeAndDeletedAtIsNull(String labelCode);

    /**
     * 根据追溯码查询
     */
    Optional<Label> findByTraceCodeAndDeletedAtIsNull(String traceCode);

    /**
     * 根据批次ID查询关联的标签
     */
    List<Label> findByBatchIdAndDeletedAtIsNull(String batchId);

    /**
     * 根据生产批次ID查询标签
     */
    List<Label> findByProductionBatchIdAndDeletedAtIsNull(Long productionBatchId);

    /**
     * 根据标签类型查询
     */
    Page<Label> findByFactoryIdAndLabelTypeAndDeletedAtIsNull(
            String factoryId, String labelType, Pageable pageable);

    /**
     * 根据状态查询
     */
    Page<Label> findByFactoryIdAndStatusAndDeletedAtIsNull(
            String factoryId, String status, Pageable pageable);

    /**
     * 统计工厂标签数量
     */
    long countByFactoryIdAndDeletedAtIsNull(String factoryId);

    /**
     * 统计特定状态的标签数量
     */
    long countByFactoryIdAndStatusAndDeletedAtIsNull(String factoryId, String status);

    /**
     * 查询即将过期的标签（基于产品过期日期）
     */
    @Query("SELECT l FROM Label l WHERE l.factoryId = :factoryId " +
           "AND l.expiryDate IS NOT NULL AND l.expiryDate BETWEEN :now AND :expiryThreshold " +
           "AND l.deletedAt IS NULL ORDER BY l.expiryDate")
    List<Label> findExpiringLabels(
            @Param("factoryId") String factoryId,
            @Param("now") LocalDateTime now,
            @Param("expiryThreshold") LocalDateTime expiryThreshold);

    /**
     * 查询已过期的标签
     */
    @Query("SELECT l FROM Label l WHERE l.factoryId = :factoryId " +
           "AND l.expiryDate IS NOT NULL AND l.expiryDate < :now " +
           "AND l.status != 'VOIDED' AND l.deletedAt IS NULL")
    List<Label> findExpiredLabels(
            @Param("factoryId") String factoryId,
            @Param("now") LocalDateTime now);

    /**
     * 检查标签编码是否存在
     */
    boolean existsByLabelCodeAndDeletedAtIsNull(String labelCode);

    /**
     * 检查追溯码是否存在
     */
    boolean existsByTraceCodeAndDeletedAtIsNull(String traceCode);
}

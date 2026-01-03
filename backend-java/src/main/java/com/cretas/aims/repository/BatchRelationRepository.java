package com.cretas.aims.repository;

import com.cretas.aims.entity.BatchRelation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 批次关联数据访问接口
 * 用于追溯生产批次与原材料批次的关联关系
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
@Repository
public interface BatchRelationRepository extends JpaRepository<BatchRelation, String> {

    /**
     * 根据工厂ID分页查询批次关联
     */
    Page<BatchRelation> findByFactoryIdAndDeletedAtIsNull(String factoryId, Pageable pageable);

    /**
     * 根据ID和工厂ID查询
     */
    Optional<BatchRelation> findByIdAndFactoryIdAndDeletedAtIsNull(String id, String factoryId);

    /**
     * 根据生产批次ID查询所有关联的原材料批次
     */
    List<BatchRelation> findByProductionBatchIdAndDeletedAtIsNull(Long productionBatchId);

    /**
     * 根据原材料批次ID查询所有关联的生产批次
     */
    List<BatchRelation> findByMaterialBatchIdAndDeletedAtIsNull(String materialBatchId);

    /**
     * 根据关联类型查询
     */
    List<BatchRelation> findByFactoryIdAndRelationTypeAndDeletedAtIsNull(
            String factoryId, String relationType);

    /**
     * 检查特定的生产-原料批次关联是否存在
     */
    boolean existsByProductionBatchIdAndMaterialBatchIdAndDeletedAtIsNull(
            Long productionBatchId, String materialBatchId);

    /**
     * 统计生产批次使用的原材料批次数量
     */
    long countByProductionBatchIdAndDeletedAtIsNull(Long productionBatchId);

    /**
     * 统计原材料批次被使用的次数
     */
    long countByMaterialBatchIdAndDeletedAtIsNull(String materialBatchId);

    /**
     * 查询未验证的批次关联
     */
    List<BatchRelation> findByFactoryIdAndVerifiedFalseAndDeletedAtIsNull(String factoryId);

    /**
     * 正向追溯：根据原材料批次查询所有下游生产批次
     */
    @Query("SELECT br FROM BatchRelation br WHERE br.materialBatchId = :materialBatchId " +
           "AND br.deletedAt IS NULL ORDER BY br.usedAt DESC")
    List<BatchRelation> traceForward(@Param("materialBatchId") String materialBatchId);

    /**
     * 反向追溯：根据生产批次查询所有上游原材料批次
     */
    @Query("SELECT br FROM BatchRelation br WHERE br.productionBatchId = :productionBatchId " +
           "AND br.deletedAt IS NULL ORDER BY br.usedAt DESC")
    List<BatchRelation> traceBackward(@Param("productionBatchId") Long productionBatchId);
}

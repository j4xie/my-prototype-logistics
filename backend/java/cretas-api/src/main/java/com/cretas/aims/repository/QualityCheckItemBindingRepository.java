package com.cretas.aims.repository;

import com.cretas.aims.entity.config.QualityCheckItemBinding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 质检项绑定 Repository
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
@Repository
public interface QualityCheckItemBindingRepository extends JpaRepository<QualityCheckItemBinding, String> {

    /**
     * 查询产品的所有质检项绑定
     */
    List<QualityCheckItemBinding> findByProductTypeIdAndEnabledTrueAndDeletedAtIsNull(
            String productTypeId);

    /**
     * 查询产品的所有质检项绑定（带质检项详情）
     */
    @Query("SELECT b FROM QualityCheckItemBinding b " +
           "JOIN FETCH b.qualityCheckItem q " +
           "WHERE b.productTypeId = :productTypeId " +
           "AND b.enabled = true AND b.deletedAt IS NULL " +
           "AND q.enabled = true AND q.deletedAt IS NULL " +
           "ORDER BY b.sortOrder, q.category, q.sortOrder")
    List<QualityCheckItemBinding> findByProductTypeIdWithItems(
            @Param("productTypeId") String productTypeId);

    /**
     * 查询特定绑定
     */
    Optional<QualityCheckItemBinding> findByProductTypeIdAndQualityCheckItemIdAndDeletedAtIsNull(
            String productTypeId, String qualityCheckItemId);

    /**
     * 检查绑定是否存在
     */
    boolean existsByProductTypeIdAndQualityCheckItemIdAndDeletedAtIsNull(
            String productTypeId, String qualityCheckItemId);

    /**
     * 删除产品的所有绑定
     */
    void deleteByProductTypeId(String productTypeId);

    /**
     * 删除质检项的所有绑定
     */
    void deleteByQualityCheckItemId(String qualityCheckItemId);

    /**
     * 统计使用某质检项的产品数量
     */
    long countByQualityCheckItemIdAndEnabledTrueAndDeletedAtIsNull(String qualityCheckItemId);

    /**
     * 查询工厂的所有绑定
     */
    List<QualityCheckItemBinding> findByFactoryIdAndDeletedAtIsNull(String factoryId);
}

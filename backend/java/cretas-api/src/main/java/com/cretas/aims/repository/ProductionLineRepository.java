package com.cretas.aims.repository;

import com.cretas.aims.entity.ProductionLine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 产线配置 Repository
 */
@Repository
public interface ProductionLineRepository extends JpaRepository<ProductionLine, String> {

    List<ProductionLine> findByFactoryIdAndDeletedAtIsNull(String factoryId);

    List<ProductionLine> findByFactoryIdAndStatusAndDeletedAtIsNull(
        String factoryId, ProductionLine.LineStatus status);

    Optional<ProductionLine> findByIdAndFactoryIdAndDeletedAtIsNull(String id, String factoryId);

    Optional<ProductionLine> findByFactoryIdAndLineCodeAndDeletedAtIsNull(
        String factoryId, String lineCode);

    List<ProductionLine> findByFactoryIdAndDepartmentIdAndDeletedAtIsNull(
        String factoryId, Long departmentId);

    @Query("SELECT pl FROM ProductionLine pl WHERE pl.factoryId = :factoryId " +
           "AND pl.status = 'active' AND pl.deletedAt IS NULL " +
           "ORDER BY pl.departmentId, pl.name")
    List<ProductionLine> findActiveLinesByFactory(@Param("factoryId") String factoryId);

    @Query("SELECT COUNT(pl) FROM ProductionLine pl WHERE pl.factoryId = :factoryId " +
           "AND pl.status = :status AND pl.deletedAt IS NULL")
    long countByFactoryIdAndStatus(
        @Param("factoryId") String factoryId,
        @Param("status") ProductionLine.LineStatus status);

    /**
     * 根据状态查询产线（不限工厂，用于全局检查）
     */
    List<ProductionLine> findByStatusAndDeletedAtIsNull(ProductionLine.LineStatus status);

    /**
     * 统计指定状态的产线数量（不限工厂）
     */
    long countByStatusAndDeletedAtIsNull(ProductionLine.LineStatus status);
}

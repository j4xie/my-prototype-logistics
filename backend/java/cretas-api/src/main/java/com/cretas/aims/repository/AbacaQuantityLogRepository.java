package com.cretas.aims.repository;

import com.cretas.aims.entity.warehouse.AbacaQuantityLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * 抄码品称重日志 Repository.
 *
 * <p>软删除由 entity 的 @Where(deleted_at IS NULL) 自动过滤.</p>
 */
@Repository
public interface AbacaQuantityLogRepository extends JpaRepository<AbacaQuantityLog, String> {

    /** 按批次查询全部称重记录 (按箱号升序). */
    List<AbacaQuantityLog> findByFactoryIdAndMaterialBatchIdOrderByBoxIndexAsc(
            String factoryId, String materialBatchId);

    /** 按原料类型查询称重历史 (按称重时间降序). */
    List<AbacaQuantityLog> findByFactoryIdAndRawMaterialTypeIdOrderByWeighedAtDesc(
            String factoryId, String rawMaterialTypeId);

    /** 详情 — 含工厂隔离防越权. */
    Optional<AbacaQuantityLog> findByIdAndFactoryId(String id, String factoryId);

    /** 批次累计称重 (汇总用), 工厂隔离. */
    @Query("SELECT COALESCE(SUM(a.actualWeight), 0) FROM AbacaQuantityLog a " +
           "WHERE a.factoryId = :factoryId AND a.materialBatchId = :materialBatchId")
    BigDecimal sumActualWeightByBatch(@Param("factoryId") String factoryId,
                                      @Param("materialBatchId") String materialBatchId);

    /** 批次称重箱数 (count), 工厂隔离. */
    long countByFactoryIdAndMaterialBatchId(String factoryId, String materialBatchId);

    /** 该批次下一个 boxIndex (现有最大值 + 1, 找不到返 1). */
    @Query("SELECT COALESCE(MAX(a.boxIndex), 0) FROM AbacaQuantityLog a " +
           "WHERE a.factoryId = :factoryId AND a.materialBatchId = :materialBatchId")
    Integer maxBoxIndexByBatch(@Param("factoryId") String factoryId,
                               @Param("materialBatchId") String materialBatchId);
}

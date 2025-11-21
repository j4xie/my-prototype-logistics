package com.cretas.aims.repository;

import com.cretas.aims.entity.MaterialBatchAdjustment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;
/**
 * 原材料批次调整记录数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Repository
public interface MaterialBatchAdjustmentRepository extends JpaRepository<MaterialBatchAdjustment, String> {
    /**
     * 根据批次ID查找调整记录
     */
    List<MaterialBatchAdjustment> findByMaterialBatchId(String materialBatchId);
     /**
     * 根据调整类型查找记录
      */
    List<MaterialBatchAdjustment> findByAdjustmentType(String adjustmentType);
     /**
     * 根据时间范围查找调整记录
      */
    @Query("SELECT a FROM MaterialBatchAdjustment a WHERE a.adjustmentTime BETWEEN :startTime AND :endTime")
    List<MaterialBatchAdjustment> findByTimeRange(@Param("startTime") LocalDateTime startTime,
                                                  @Param("endTime") LocalDateTime endTime);
     /**
     * 根据调整人查找记录
      */
    List<MaterialBatchAdjustment> findByAdjustedBy(Integer adjustedBy);
     /**
     * 获取批次的调整历史（按时间倒序）
      */
    List<MaterialBatchAdjustment> findByMaterialBatchIdOrderByAdjustmentTimeDesc(String materialBatchId);
     /**
     * 统计批次的调整次数
      */
    @Query("SELECT COUNT(a) FROM MaterialBatchAdjustment a WHERE a.materialBatchId = :materialBatchId")
    Long countAdjustmentsByBatch(@Param("materialBatchId") String materialBatchId);
     /**
     * 获取指定批次和类型的调整记录
      */
    List<MaterialBatchAdjustment> findByMaterialBatchIdAndAdjustmentType(String materialBatchId, String adjustmentType);
}

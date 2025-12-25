package com.cretas.aims.repository;

import com.cretas.aims.entity.MaterialBatchAdjustment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 原材料批次调整记录数据访问层
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Repository
public interface MaterialBatchAdjustmentRepository extends JpaRepository<MaterialBatchAdjustment, String> {

    /**
     * 根据批次ID查询调整记录
     */
    List<MaterialBatchAdjustment> findByMaterialBatchIdOrderByAdjustmentTimeDesc(String materialBatchId);

    /**
     * 根据调整类型查询
     */
    List<MaterialBatchAdjustment> findByMaterialBatchIdAndAdjustmentType(String materialBatchId, String adjustmentType);

    /**
     * 根据时间范围查询
     */
    List<MaterialBatchAdjustment> findByMaterialBatchIdAndAdjustmentTimeBetweenOrderByAdjustmentTimeDesc(
            String materialBatchId, LocalDateTime startTime, LocalDateTime endTime);

    /**
     * 根据调整人查询
     */
    List<MaterialBatchAdjustment> findByAdjustedByOrderByAdjustmentTimeDesc(Long adjustedBy);

    /**
     * 统计批次调整次数
     */
    long countByMaterialBatchId(String materialBatchId);
}

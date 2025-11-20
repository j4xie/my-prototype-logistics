package com.cretas.aims.repository;

import com.cretas.aims.entity.EquipmentUsage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;
/**
 * 设备使用记录数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Repository
public interface EquipmentUsageRepository extends JpaRepository<EquipmentUsage, Long> {
    /**
     * 根据设备ID查找使用记录
     */
    List<EquipmentUsage> findByEquipmentId(String equipmentId);
     /**
     * 根据生产批次ID查找使用记录
      */
    List<EquipmentUsage> findByProductionBatchId(String productionBatchId);
     /**
     * 根据设备ID和开始时间查找使用记录
      */
    List<EquipmentUsage> findByEquipmentIdAndStartTimeAfter(String equipmentId, LocalDateTime startTime);
     /**
     * 根据设备ID和时间范围查找使用记录
      */
    List<EquipmentUsage> findByEquipmentIdAndStartTimeBetween(String equipmentId,
                                                               LocalDateTime startTime,
                                                               LocalDateTime endTime);
}

package com.cretas.aims.repository;

import com.cretas.aims.entity.EquipmentMaintenance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

/**
 * 设备维护记录数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-20
 */
@Repository
public interface EquipmentMaintenanceRepository extends JpaRepository<EquipmentMaintenance, Long> {

    /**
     * 根据设备ID查找维护记录（按日期倒序）
     * equipmentId 类型改为 Long，与 FactoryEquipment.id 一致
     */
    List<EquipmentMaintenance> findByEquipmentIdOrderByMaintenanceDateDesc(Long equipmentId);

    /**
     * 根据设备ID和日期范围查找维护记录
     */
    @Query("SELECT m FROM EquipmentMaintenance m WHERE m.equipmentId = :equipmentId " +
           "AND m.maintenanceDate BETWEEN :startDate AND :endDate " +
           "ORDER BY m.maintenanceDate DESC")
    List<EquipmentMaintenance> findByEquipmentIdAndDateRange(
            @Param("equipmentId") Long equipmentId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 统计设备在指定日期范围内的维护次数
     */
    @Query("SELECT COUNT(m) FROM EquipmentMaintenance m WHERE m.equipmentId = :equipmentId " +
           "AND m.maintenanceDate BETWEEN :startDate AND :endDate")
    Long countByEquipmentIdAndDateRange(
            @Param("equipmentId") Long equipmentId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 计算设备在指定日期范围内的总维护成本
     */
    @Query("SELECT COALESCE(SUM(m.cost), 0) FROM EquipmentMaintenance m WHERE m.equipmentId = :equipmentId " +
           "AND m.maintenanceDate BETWEEN :startDate AND :endDate")
    java.math.BigDecimal sumCostByEquipmentIdAndDateRange(
            @Param("equipmentId") Long equipmentId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 查找最近一次维护记录
     */
    @Query("SELECT m FROM EquipmentMaintenance m WHERE m.equipmentId = :equipmentId " +
           "ORDER BY m.maintenanceDate DESC")
    List<EquipmentMaintenance> findLatestByEquipmentId(@Param("equipmentId") Long equipmentId,
                                                        org.springframework.data.domain.Pageable pageable);
}

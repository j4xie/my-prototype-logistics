package com.cretas.aims.repository;

import com.cretas.aims.entity.FactoryEquipment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * 设备数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Repository
public interface EquipmentRepository extends JpaRepository<FactoryEquipment, Long> {

    /**
     * 根据ID和工厂ID查找设备
     */
    Optional<FactoryEquipment> findByIdAndFactoryId(Long id, String factoryId);

    /**
     * 根据工厂ID查找设备（分页）
     */
    Page<FactoryEquipment> findByFactoryId(String factoryId, Pageable pageable);

    /**
     * 根据工厂ID查找所有设备（不分页）
     */
    List<FactoryEquipment> findByFactoryId(String factoryId);

    /**
     * 根据工厂ID和状态查找设备
     */
    List<FactoryEquipment> findByFactoryIdAndStatus(String factoryId, String status);

    /**
     * 根据名称搜索设备
     * 注意：equipmentName/model使用双向模糊（无法使用索引），equipmentCode使用右模糊（可使用索引）
     */
    @Query("SELECT e FROM FactoryEquipment e WHERE e.factoryId = :factoryId " +
           "AND (e.equipmentName LIKE CONCAT('%', :keyword, '%') OR e.equipmentCode LIKE CONCAT(:keyword, '%') OR e.model LIKE CONCAT('%', :keyword, '%'))")
    List<FactoryEquipment> searchByKeyword(@Param("factoryId") String factoryId, @Param("keyword") String keyword);

    /**
     * 根据类型查找设备
     */
    List<FactoryEquipment> findByFactoryIdAndType(String factoryId, String type);

    /**
     * 检查设备代码是否存在
     */
    boolean existsByEquipmentCode(String equipmentCode);

    /**
     * 检查设备代码是否存在（在指定工厂）
     */
    boolean existsByFactoryIdAndEquipmentCode(String factoryId, String equipmentCode);

    /**
     * 查找需要维护的设备
     */
    @Query("SELECT e FROM FactoryEquipment e WHERE e.factoryId = :factoryId " +
           "AND e.nextMaintenanceDate <= :date AND e.status != 'scrapped'")
    List<FactoryEquipment> findEquipmentNeedingMaintenance(@Param("factoryId") String factoryId,
                                                          @Param("date") LocalDate date);

    /**
     * 查找保修即将到期的设备
     */
    @Query("SELECT e FROM FactoryEquipment e WHERE e.factoryId = :factoryId " +
           "AND e.warrantyExpiryDate BETWEEN CURRENT_DATE AND :warningDate")
    List<FactoryEquipment> findEquipmentWithExpiringWarranty(@Param("factoryId") String factoryId,
                                                            @Param("warningDate") LocalDate warningDate);

    /**
     * 统计设备总价值
     */
    @Query("SELECT SUM(e.purchasePrice) FROM FactoryEquipment e WHERE e.factoryId = :factoryId " +
           "AND e.status != 'scrapped'")
    BigDecimal calculateTotalEquipmentValue(@Param("factoryId") String factoryId);

    /**
     * 统计设备数量（按状态）
     */
    @Query("SELECT e.status, COUNT(e) FROM FactoryEquipment e WHERE e.factoryId = :factoryId " +
           "GROUP BY e.status")
    List<Object[]> countByStatus(@Param("factoryId") String factoryId);

    /**
     * 统计设备数量（按类型）
     */
    @Query("SELECT e.type, COUNT(e) FROM FactoryEquipment e WHERE e.factoryId = :factoryId " +
           "GROUP BY e.type")
    List<Object[]> countByType(@Param("factoryId") String factoryId);

    /**
     * 计算设备平均使用小时数
     */
    @Query("SELECT AVG(e.totalRunningHours) FROM FactoryEquipment e WHERE e.factoryId = :factoryId " +
           "AND e.status != 'scrapped'")
    Double calculateAverageRunningHours(@Param("factoryId") String factoryId);

    /**
     * 查找高使用率设备
     */
    @Query("SELECT e FROM FactoryEquipment e WHERE e.factoryId = :factoryId " +
           "AND e.totalRunningHours > :threshold ORDER BY e.totalRunningHours DESC")
    List<FactoryEquipment> findHighUsageEquipment(@Param("factoryId") String factoryId,
                                                 @Param("threshold") Integer threshold);

    /**
     * 计算设备总运行成本
     */
    @Query("SELECT SUM(e.hourlyCost * e.totalRunningHours) FROM FactoryEquipment e " +
           "WHERE e.factoryId = :factoryId")
    BigDecimal calculateTotalOperatingCost(@Param("factoryId") String factoryId);

    /**
     * 检查设备是否有关联的使用记录
     */
    @Query("SELECT COUNT(u) > 0 FROM BatchEquipmentUsage u WHERE u.equipmentId = :equipmentId")
    boolean hasUsageRecords(@Param("equipmentId") Long equipmentId);

    /**
     * 统计工厂的设备总数
     */
    long countByFactoryId(String factoryId);

    /**
     * 统计工厂特定状态的设备数量
     */
    long countByFactoryIdAndStatus(String factoryId, String status);

    /**
     * 查找需要维护的设备（简化版）
     */
    @Query("SELECT e FROM FactoryEquipment e WHERE e.factoryId = :factoryId " +
           "AND e.lastMaintenanceDate < :date")
    List<FactoryEquipment> findMaintenanceDue(@Param("factoryId") String factoryId,
                                              @Param("date") LocalDate date);

    /**
     * 批量查询多个设备 - 解决 N+1 查询问题
     * @param ids 设备ID集合
     * @return 设备列表
     */
    List<FactoryEquipment> findByIdIn(java.util.Collection<Long> ids);

    /**
     * 查询所有不重复的工厂ID - 解决 findAll() 全表扫描性能问题
     * @return 工厂ID集合
     */
    @Query("SELECT DISTINCT e.factoryId FROM FactoryEquipment e WHERE e.deletedAt IS NULL")
    Set<String> findDistinctFactoryIds();

    /**
     * 根据设备编码和设备类别查找设备（忽略大小写）
     * 解决 findAll() 全表扫描性能问题
     * @param equipmentCode 设备编码
     * @param deviceCategory 设备类别
     * @return 设备（可选）
     */
    Optional<FactoryEquipment> findByEquipmentCodeIgnoreCaseAndDeviceCategory(
            String equipmentCode, com.cretas.aims.entity.enums.DeviceCategory deviceCategory);

    /**
     * 根据IoT设备编码和设备类别查找设备（忽略大小写）
     * 解决 findAll() 全表扫描性能问题
     * @param iotDeviceCode IoT设备编码
     * @param deviceCategory 设备类别
     * @return 设备（可选）
     */
    Optional<FactoryEquipment> findByIotDeviceCodeIgnoreCaseAndDeviceCategory(
            String iotDeviceCode, com.cretas.aims.entity.enums.DeviceCategory deviceCategory);
}

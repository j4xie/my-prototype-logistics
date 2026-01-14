package com.cretas.aims.repository;

import com.cretas.aims.entity.ProductionLineSupervisor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 产线-车间主任关联 Repository
 */
@Repository
public interface ProductionLineSupervisorRepository extends JpaRepository<ProductionLineSupervisor, String> {

    /**
     * 查询某条产线的所有负责人
     */
    List<ProductionLineSupervisor> findByProductionLineId(String productionLineId);

    /**
     * 查询某条产线的主要负责人
     */
    Optional<ProductionLineSupervisor> findByProductionLineIdAndIsPrimaryTrue(String productionLineId);

    /**
     * 查询某个车间主任负责的所有产线
     */
    List<ProductionLineSupervisor> findBySupervisorUserId(Long supervisorUserId);

    /**
     * 查询某个工厂内某车间主任负责的产线
     */
    List<ProductionLineSupervisor> findByFactoryIdAndSupervisorUserId(String factoryId, Long supervisorUserId);

    /**
     * 查询某工厂的所有产线-主任配置
     */
    List<ProductionLineSupervisor> findByFactoryId(String factoryId);

    /**
     * 检查产线-主任关联是否存在
     */
    boolean existsByProductionLineIdAndSupervisorUserId(String productionLineId, Long supervisorUserId);

    /**
     * 删除特定关联
     */
    void deleteByProductionLineIdAndSupervisorUserId(String productionLineId, Long supervisorUserId);

    /**
     * 查询产线负责人列表（带用户信息）
     */
    @Query("SELECT pls FROM ProductionLineSupervisor pls WHERE pls.factoryId = :factoryId " +
           "AND pls.productionLineId = :lineId ORDER BY pls.isPrimary DESC, pls.assignedAt")
    List<ProductionLineSupervisor> findSupervisorsByLine(
        @Param("factoryId") String factoryId,
        @Param("lineId") String lineId);

    /**
     * 查询车间主任负责的产线ID列表
     */
    @Query("SELECT pls.productionLineId FROM ProductionLineSupervisor pls " +
           "WHERE pls.factoryId = :factoryId AND pls.supervisorUserId = :userId")
    List<String> findLineIdsBySupervisor(
        @Param("factoryId") String factoryId,
        @Param("userId") Long userId);
}

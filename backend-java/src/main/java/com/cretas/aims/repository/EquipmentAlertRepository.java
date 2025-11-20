package com.cretas.aims.repository;

import com.cretas.aims.entity.EquipmentAlert;
import com.cretas.aims.entity.enums.AlertStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 设备告警数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-19
 */
@Repository
public interface EquipmentAlertRepository extends JpaRepository<EquipmentAlert, Integer>, JpaSpecificationExecutor<EquipmentAlert> {

    /**
     * 根据工厂ID和告警ID查询
     */
    Optional<EquipmentAlert> findByFactoryIdAndId(String factoryId, Integer id);

    /**
     * 根据工厂ID查询所有告警
     */
    List<EquipmentAlert> findByFactoryIdOrderByTriggeredAtDesc(String factoryId);

    /**
     * 根据工厂ID和状态查询
     */
    List<EquipmentAlert> findByFactoryIdAndStatusOrderByTriggeredAtDesc(String factoryId, AlertStatus status);

    /**
     * 根据设备ID查询告警
     */
    List<EquipmentAlert> findByEquipmentIdOrderByTriggeredAtDesc(Integer equipmentId);

    /**
     * 根据设备ID和状态查询告警
     */
    List<EquipmentAlert> findByEquipmentIdAndStatusOrderByTriggeredAtDesc(Integer equipmentId, AlertStatus status);

    /**
     * 根据工厂ID分页查询告警
     */
    Page<EquipmentAlert> findByFactoryId(String factoryId, Pageable pageable);

    /**
     * 根据工厂ID和状态分页查询告警
     */
    Page<EquipmentAlert> findByFactoryIdAndStatus(String factoryId, AlertStatus status, Pageable pageable);
}

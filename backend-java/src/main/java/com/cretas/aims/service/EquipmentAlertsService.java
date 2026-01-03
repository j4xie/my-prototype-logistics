package com.cretas.aims.service;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.equipment.CreateEquipmentAlertRequest;
import com.cretas.aims.dto.equipment.EquipmentAlertDTO;
import com.cretas.aims.entity.enums.AlertStatus;

import java.util.Map;

/**
 * 设备告警服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-27
 */
public interface EquipmentAlertsService {

    /**
     * 获取告警列表（分页）
     */
    PageResponse<EquipmentAlertDTO> getAlertList(String factoryId, PageRequest pageRequest,
                                                  String keyword, String severity, String status);

    /**
     * 获取告警统计
     */
    Map<String, Object> getAlertStatistics(String factoryId);

    /**
     * 获取告警详情
     */
    EquipmentAlertDTO getAlertById(String factoryId, Integer alertId);

    /**
     * 确认告警
     */
    EquipmentAlertDTO acknowledgeAlert(String factoryId, Integer alertId, Long userId, String userName);

    /**
     * 处理告警
     */
    EquipmentAlertDTO resolveAlert(String factoryId, Integer alertId, Long userId, String userName, String resolution);

    /**
     * 创建告警
     */
    EquipmentAlertDTO createAlert(String factoryId, CreateEquipmentAlertRequest request);
}

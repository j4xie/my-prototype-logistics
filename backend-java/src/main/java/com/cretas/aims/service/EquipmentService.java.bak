package com.cretas.aims.service;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.equipment.CreateEquipmentRequest;
import com.cretas.aims.dto.equipment.EquipmentDTO;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
/**
 * 设备服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public interface EquipmentService {
    /**
     * 创建设备
     */
    EquipmentDTO createEquipment(String factoryId, CreateEquipmentRequest request, Integer userId);
     /**
     * 更新设备
      */
    EquipmentDTO updateEquipment(String factoryId, Integer equipmentId, CreateEquipmentRequest request);
     /**
     * 删除设备
      */
    void deleteEquipment(String factoryId, Integer equipmentId);
     /**
     * 获取设备详情
      */
    EquipmentDTO getEquipmentById(String factoryId, Integer equipmentId);
     /**
     * 获取设备列表（分页）
      */
    PageResponse<EquipmentDTO> getEquipmentList(String factoryId, PageRequest pageRequest);
     /**
     * 按状态获取设备
      */
    List<EquipmentDTO> getEquipmentByStatus(String factoryId, String status);
     /**
     * 按类型获取设备
      */
    List<EquipmentDTO> getEquipmentByType(String factoryId, String type);
     /**
     * 搜索设备
      */
    List<EquipmentDTO> searchEquipment(String factoryId, String keyword);
     /**
     * 更新设备状态
      */
    EquipmentDTO updateEquipmentStatus(String factoryId, Integer equipmentId, String status);
     /**
     * 启动设备
      */
    EquipmentDTO startEquipment(String factoryId, Integer equipmentId);
     /**
     * 停止设备
      */
    EquipmentDTO stopEquipment(String factoryId, Integer equipmentId, Integer runningHours);
     /**
     * 记录设备维护
      */
    EquipmentDTO recordMaintenance(String factoryId, Integer equipmentId, LocalDate maintenanceDate,
                                  BigDecimal cost, String description);
     /**
     * 获取需要维护的设备
      */
    List<EquipmentDTO> getEquipmentNeedingMaintenance(String factoryId);
     /**
     * 获取保修即将到期的设备
      */
    List<EquipmentDTO> getEquipmentWithExpiringWarranty(String factoryId, Integer daysAhead);
     /**
     * 计算设备折旧后价值
      */
    BigDecimal calculateDepreciatedValue(String factoryId, Integer equipmentId);
     /**
     * 获取设备使用统计
      */
    Map<String, Object> getEquipmentStatistics(String factoryId, Integer equipmentId);
     /**
     * 获取设备使用历史
      */
    List<Map<String, Object>> getEquipmentUsageHistory(String factoryId, Integer equipmentId);
     /**
     * 获取设备维护历史
      */
    List<Map<String, Object>> getEquipmentMaintenanceHistory(String factoryId, Integer equipmentId);
     /**
     * 获取工厂设备总体统计
      */
    Map<String, Object> getOverallEquipmentStatistics(String factoryId);
     /**
     * 获取设备效率报告
      */
    Map<String, Object> getEquipmentEfficiencyReport(String factoryId, Integer equipmentId,
                                                    LocalDate startDate, LocalDate endDate);
     /**
     * 批量导入设备
      */
    List<EquipmentDTO> importEquipment(String factoryId, List<CreateEquipmentRequest> requests, Integer userId);
     /**
     * 导出设备列表
      */
    byte[] exportEquipmentList(String factoryId);
     /**
     * 报废设备
      */
    EquipmentDTO scrapEquipment(String factoryId, Integer equipmentId, String reason);
     /**
     * 计算设备OEE（整体设备效率）
      */
    Double calculateOEE(String factoryId, Integer equipmentId, LocalDate startDate, LocalDate endDate);
}

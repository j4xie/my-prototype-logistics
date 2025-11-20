package com.cretas.aims.service;

import com.cretas.aims.dto.DeviceActivationDTO;
import com.cretas.aims.dto.common.PageResponse;
import org.springframework.data.domain.Pageable;
import java.time.LocalDateTime;
import java.util.List;
/**
 * 设备激活服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public interface DeviceActivationService {
    /**
     * 生成激活码
     */
    List<DeviceActivationDTO> generateActivationCodes(String factoryId,
                                                     DeviceActivationDTO.GenerateRequest request);
     /**
     * 验证激活码
      */
    DeviceActivationDTO validateActivationCode(String activationCode);
     /**
     * 激活设备
      */
    DeviceActivationDTO activateDevice(DeviceActivationDTO.ActivateRequest request);
     /**
     * 撤销激活
      */
    void revokeActivation(String factoryId, Integer activationId);
     /**
     * 批量撤销激活
      */
    void revokeActivationBatch(String factoryId, List<Integer> activationIds);
     /**
     * 更新激活码状态
      */
    DeviceActivationDTO updateActivationStatus(String factoryId, Integer activationId, String status);
     /**
     * 获取激活记录
      */
    DeviceActivationDTO getActivation(String factoryId, Integer activationId);
     /**
     * 根据激活码获取记录
      */
    DeviceActivationDTO getActivationByCode(String activationCode);
     /**
     * 根据设备ID获取激活记录
      */
    DeviceActivationDTO getActivationByDevice(String factoryId, String deviceId);
     /**
     * 分页查询激活记录
      */
    PageResponse<DeviceActivationDTO> getActivations(String factoryId, String status,
                                                    String deviceType, Pageable pageable);
     /**
     * 获取激活统计
      */
    DeviceActivationDTO.ActivationStatistics getStatistics(String factoryId);
     /**
     * 获取最近激活的设备
      */
    List<DeviceActivationDTO> getRecentActivations(String factoryId, Integer limit);
     /**
     * 获取即将过期的激活
      */
    List<DeviceActivationDTO> getExpiringActivations(String factoryId, Integer days);
     /**
     * 获取非活跃设备
      */
    List<DeviceActivationDTO> getInactiveDevices(String factoryId, Integer inactiveDays);
     /**
     * 更新设备活跃时间
      */
    void updateDeviceActivity(String factoryId, String deviceId);
     /**
     * 延长激活有效期
      */
    DeviceActivationDTO extendExpiration(String factoryId, Integer activationId, Integer additionalDays);
     /**
     * 检查设备是否已激活
      */
    boolean isDeviceActivated(String factoryId, String deviceId);
     /**
     * 检查激活码是否有效
      */
    boolean isActivationCodeValid(String activationCode);
     /**
     * 清理过期的激活记录
      */
    void cleanupExpiredActivations();
     /**
     * 导出激活记录
      */
    String exportActivations(String factoryId, LocalDateTime startDate, LocalDateTime endDate);
     /**
     * 批量导入激活码
      */
    List<DeviceActivationDTO> importActivationCodes(String factoryId, List<String> codes);
     /**
     * 获取设备激活历史
      */
    List<DeviceActivationDTO> getDeviceActivationHistory(String factoryId, String deviceId);
     /**
     * 转移激活到新设备
      */
    DeviceActivationDTO transferActivation(String factoryId, String oldDeviceId, String newDeviceId);
}

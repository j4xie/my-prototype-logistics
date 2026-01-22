package com.cretas.aims.service.scheduling;

import com.cretas.aims.dto.scheduling.SchedulingAlertDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.List;

/**
 * 调度告警服务接口
 *
 * 负责告警管理，包括：
 * - 告警查询
 * - 告警确认
 * - 告警解决
 *
 * @author Cretas Team
 * @version 1.0.0
 */
public interface SchedulingAlertService {

    /**
     * 获取未解决的告警
     */
    List<SchedulingAlertDTO> getUnresolvedAlerts(String factoryId);

    /**
     * 分页获取告警列表
     */
    Page<SchedulingAlertDTO> getAlerts(String factoryId, String severity, String alertType, Pageable pageable);

    /**
     * 确认告警
     */
    SchedulingAlertDTO acknowledgeAlert(String factoryId, String alertId, Long userId);

    /**
     * 解决告警
     */
    SchedulingAlertDTO resolveAlert(String factoryId, String alertId, Long userId, String resolutionNotes);

    /**
     * 创建告警
     */
    void createAlert(String factoryId, String alertType, String severity, String message, String relatedEntityId);
}

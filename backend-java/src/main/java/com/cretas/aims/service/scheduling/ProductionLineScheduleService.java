package com.cretas.aims.service.scheduling;

import com.cretas.aims.dto.scheduling.*;
import java.util.List;

/**
 * 产线排程服务接口
 *
 * 负责产线排程管理，包括：
 * - 排程 CRUD
 * - 排程状态管理
 * - 进度更新
 * - 产线管理
 *
 * @author Cretas Team
 * @version 1.0.0
 */
public interface ProductionLineScheduleService {

    /**
     * 获取排程详情
     */
    LineScheduleDTO getSchedule(String factoryId, String scheduleId);

    /**
     * 更新排程
     */
    LineScheduleDTO updateSchedule(String factoryId, String scheduleId, UpdateScheduleRequest request);

    /**
     * 开始排程
     */
    LineScheduleDTO startSchedule(String factoryId, String scheduleId);

    /**
     * 完成排程
     */
    LineScheduleDTO completeSchedule(String factoryId, String scheduleId, Integer completedQuantity);

    /**
     * 更新进度
     */
    LineScheduleDTO updateProgress(String factoryId, String scheduleId, Integer completedQuantity);

    /**
     * 获取产线列表
     */
    List<ProductionLineDTO> getProductionLines(String factoryId, String status);

    /**
     * 创建产线
     */
    ProductionLineDTO createProductionLine(String factoryId, ProductionLineDTO request);

    /**
     * 更新产线
     */
    ProductionLineDTO updateProductionLine(String factoryId, String lineId, ProductionLineDTO request);

    /**
     * 更新产线状态
     */
    ProductionLineDTO updateProductionLineStatus(String factoryId, String lineId, String status);
}

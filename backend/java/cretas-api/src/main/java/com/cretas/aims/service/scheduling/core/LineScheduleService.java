package com.cretas.aims.service.scheduling.core;

import com.cretas.aims.dto.scheduling.*;

/**
 * 产线排程操作：查询、更新、开始、完成、进度更新（含效率计算与延期检测）
 */
public interface LineScheduleService {

    LineScheduleDTO getSchedule(String factoryId, String scheduleId);

    LineScheduleDTO updateSchedule(String factoryId, String scheduleId, UpdateScheduleRequest request);

    LineScheduleDTO startSchedule(String factoryId, String scheduleId);

    LineScheduleDTO completeSchedule(String factoryId, String scheduleId, Integer completedQuantity);

    LineScheduleDTO updateProgress(String factoryId, String scheduleId, Integer completedQuantity);
}

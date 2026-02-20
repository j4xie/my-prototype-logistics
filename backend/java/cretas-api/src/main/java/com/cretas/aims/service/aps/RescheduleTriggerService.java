package com.cretas.aims.service.aps;

import com.cretas.aims.dto.aps.RescheduleCheckResult;
import com.cretas.aims.dto.aps.RescheduleResult;
import com.cretas.aims.entity.enums.RescheduleMode;

import java.util.List;

/**
 * APS 重排触发检测服务
 *
 * 核心功能:
 * 1. 检查是否需要重排 - 根据多种触发条件检测
 * 2. 执行重排 - 支持局部重排和全局重排
 * 3. 物料短缺检测 - 检查可能影响生产的物料问题
 *
 * 触发条件优先级 (从高到低):
 * 1. 产线故障 (CRITICAL)
 * 2. 紧急订单插入 (CRITICAL)
 * 3. 完成概率过低 < 50% (HIGH)
 * 4. 物料短缺 (MEDIUM)
 *
 * @author Cretas APS V1.0
 * @since 2026-01-21
 */
public interface RescheduleTriggerService {

    /**
     * 检查是否需要重排
     *
     * @param factoryId 工厂ID
     * @return 重排检查结果，包含是否需要重排、触发原因列表
     */
    RescheduleCheckResult checkRescheduleNeeded(String factoryId);

    /**
     * 执行重排
     *
     * @param factoryId       工厂ID
     * @param mode            重排模式: AFFECTED_ONLY (局部重排) 或 FULL (全局重排)
     * @param affectedTaskIds 受影响的任务ID列表 (mode=AFFECTED_ONLY 时必填)
     * @return 重排结果
     */
    RescheduleResult executeReschedule(String factoryId, RescheduleMode mode, List<String> affectedTaskIds);

    /**
     * 检查物料短缺
     * 检查可能影响生产计划的物料短缺情况
     *
     * @param factoryId 工厂ID
     * @return 存在物料短缺的订单ID列表
     */
    List<String> checkMaterialShortage(String factoryId);

    /**
     * 计算当前准时率
     *
     * @param factoryId 工厂ID
     * @return 当前准时率 [0, 1]
     */
    double calculateCurrentOnTimeRate(String factoryId);

    /**
     * 计算重排后预期准时率
     *
     * @param factoryId 工厂ID
     * @return 预期准时率 [0, 1]
     */
    double calculateProjectedOnTimeRate(String factoryId);
}

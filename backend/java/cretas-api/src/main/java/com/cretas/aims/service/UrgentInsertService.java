package com.cretas.aims.service;

import com.cretas.aims.dto.production.ProductionPlanDTO;
import com.cretas.aims.dto.scheduling.ConfirmUrgentInsertRequest;
import com.cretas.aims.dto.scheduling.GetInsertSlotsRequest;
import com.cretas.aims.dto.scheduling.InsertSlotDTO;

import java.util.List;
import java.util.Map;

/**
 * 紧急插单服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
public interface UrgentInsertService {

    /**
     * 获取可用的插单时段列表
     *
     * @param factoryId 工厂ID
     * @param request 请求参数
     * @return 按推荐分数排序的时段列表
     */
    List<InsertSlotDTO> getAvailableSlots(String factoryId, GetInsertSlotsRequest request);

    /**
     * 分析插单影响
     *
     * @param factoryId 工厂ID
     * @param slotId 时段ID
     * @param request 请求参数
     * @return 影响分析结果
     */
    Map<String, Object> analyzeInsertImpact(String factoryId, String slotId, GetInsertSlotsRequest request);

    /**
     * 确认紧急插单（创建生产计划）
     *
     * @param factoryId 工厂ID
     * @param userId 操作用户ID
     * @param request 确认请求
     * @return 创建的生产计划
     */
    ProductionPlanDTO confirmInsert(String factoryId, Long userId, ConfirmUrgentInsertRequest request);

    /**
     * 强制插入（需要审批）
     *
     * @param factoryId 工厂ID
     * @param userId 操作用户ID
     * @param request 确认请求
     * @return 创建的生产计划（待审批状态）
     */
    ProductionPlanDTO forceInsert(String factoryId, Long userId, ConfirmUrgentInsertRequest request);

    /**
     * 生成/刷新插单时段
     * 根据当前排产情况计算可用时段
     *
     * @param factoryId 工厂ID
     * @param hoursAhead 未来多少小时
     * @return 生成的时段数量
     */
    int generateInsertSlots(String factoryId, int hoursAhead);

    /**
     * 获取单个时段详情
     *
     * @param factoryId 工厂ID
     * @param slotId 时段ID
     * @return 时段详情
     */
    InsertSlotDTO getSlotDetail(String factoryId, String slotId);

    /**
     * 标记时段为已选中
     *
     * @param factoryId 工厂ID
     * @param slotId 时段ID
     */
    void markSlotAsSelected(String factoryId, String slotId);

    /**
     * 释放已选中的时段
     *
     * @param factoryId 工厂ID
     * @param slotId 时段ID
     */
    void releaseSlot(String factoryId, String slotId);

    /**
     * 清理过期时段
     *
     * @param factoryId 工厂ID
     * @return 清理数量
     */
    int cleanupExpiredSlots(String factoryId);

    /**
     * 获取紧急插单统计
     *
     * @param factoryId 工厂ID
     * @return 统计信息
     */
    Map<String, Object> getUrgentInsertStatistics(String factoryId);

    /**
     * 审批强制插单
     *
     * @param factoryId   工厂ID
     * @param planId      计划ID
     * @param approverId  审批人ID
     * @param approved    是否批准
     * @param comment     审批备注
     * @return 更新后的计划
     */
    ProductionPlanDTO approveForceInsert(
            String factoryId, String planId, Long approverId, boolean approved, String comment);

    /**
     * 获取待审批的强制插单列表
     *
     * @param factoryId 工厂ID
     * @return 待审批计划列表
     */
    List<ProductionPlanDTO> getPendingForceInsertApprovals(String factoryId);
}

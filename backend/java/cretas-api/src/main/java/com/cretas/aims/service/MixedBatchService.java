package com.cretas.aims.service;

import com.cretas.aims.dto.production.ProductionPlanDTO;
import com.cretas.aims.dto.scheduling.DetectMixedBatchRequest;
import com.cretas.aims.dto.scheduling.MixedBatchGroupDTO;
import com.cretas.aims.dto.scheduling.MixedBatchRuleDTO;
import com.cretas.aims.entity.enums.MixedBatchType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;

/**
 * 混批排产服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
public interface MixedBatchService {

    // ==================== 混批检测 ====================

    /**
     * AI检测可合批订单
     *
     * @param factoryId 工厂ID
     * @param request 检测请求
     * @return 检测到的混批组列表
     */
    List<MixedBatchGroupDTO> detectMixedBatches(String factoryId, DetectMixedBatchRequest request);

    /**
     * 自动检测并创建混批建议
     * 定时任务调用
     *
     * @param factoryId 工厂ID
     * @return 创建的混批组数量
     */
    int autoDetectAndCreate(String factoryId);

    // ==================== 混批组管理 ====================

    /**
     * 获取混批建议列表
     *
     * @param factoryId 工厂ID
     * @param status 状态筛选 (可选)
     * @param groupType 类型筛选 (可选)
     * @param pageable 分页参数
     * @return 分页结果
     */
    Page<MixedBatchGroupDTO> getMixedBatchGroups(String factoryId, String status,
                                                  MixedBatchType groupType, Pageable pageable);

    /**
     * 获取待确认的混批组列表
     *
     * @param factoryId 工厂ID
     * @return 待确认列表 (按推荐分数降序)
     */
    List<MixedBatchGroupDTO> getPendingGroups(String factoryId);

    /**
     * 获取混批组详情
     *
     * @param factoryId 工厂ID
     * @param groupId 混批组ID
     * @return 混批组详情
     */
    MixedBatchGroupDTO getGroupDetail(String factoryId, String groupId);

    /**
     * 确认混批 - 创建生产计划
     *
     * @param factoryId 工厂ID
     * @param groupId 混批组ID
     * @param userId 操作用户ID
     * @return 创建的生产计划
     */
    ProductionPlanDTO confirmMixedBatch(String factoryId, String groupId, Long userId);

    /**
     * 拒绝混批
     *
     * @param factoryId 工厂ID
     * @param groupId 混批组ID
     * @param userId 操作用户ID
     * @param reason 拒绝原因
     */
    void rejectMixedBatch(String factoryId, String groupId, Long userId, String reason);

    /**
     * 更新混批组订单
     * 添加或移除订单
     *
     * @param factoryId 工厂ID
     * @param groupId 混批组ID
     * @param orderIds 新的订单ID列表
     * @return 更新后的混批组
     */
    MixedBatchGroupDTO updateGroupOrders(String factoryId, String groupId, List<String> orderIds);

    // ==================== 规则管理 ====================

    /**
     * 获取混批规则列表
     *
     * @param factoryId 工厂ID
     * @return 规则列表
     */
    List<MixedBatchRuleDTO> getRules(String factoryId);

    /**
     * 获取特定类型的规则
     *
     * @param factoryId 工厂ID
     * @param ruleType 规则类型
     * @return 规则详情
     */
    MixedBatchRuleDTO getRule(String factoryId, MixedBatchType ruleType);

    /**
     * 创建或更新规则
     *
     * @param factoryId 工厂ID
     * @param ruleDTO 规则信息
     * @return 保存后的规则
     */
    MixedBatchRuleDTO saveRule(String factoryId, MixedBatchRuleDTO ruleDTO);

    /**
     * 启用/禁用规则
     *
     * @param factoryId 工厂ID
     * @param ruleType 规则类型
     * @param enabled 是否启用
     */
    void toggleRule(String factoryId, MixedBatchType ruleType, boolean enabled);

    // ==================== 统计与清理 ====================

    /**
     * 获取混批统计信息
     *
     * @param factoryId 工厂ID
     * @return 统计信息
     */
    Map<String, Object> getStatistics(String factoryId);

    /**
     * 清理过期的混批组
     *
     * @param factoryId 工厂ID
     * @return 清理数量
     */
    int cleanupExpiredGroups(String factoryId);

    /**
     * 标记过期的混批组
     *
     * @param factoryId 工厂ID
     * @return 标记数量
     */
    int markExpiredGroups(String factoryId);
}

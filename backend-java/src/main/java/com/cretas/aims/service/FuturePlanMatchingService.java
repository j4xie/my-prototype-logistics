package com.cretas.aims.service;

import com.cretas.aims.dto.MatchResultDTO;
import com.cretas.aims.entity.MaterialBatch;

import java.util.List;

/**
 * 未来计划自动匹配服务接口
 *
 * 当新原材料批次入库时，自动匹配到待处理的未来生产计划
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-25
 */
public interface FuturePlanMatchingService {

    /**
     * 当新批次入库时，自动匹配到未来计划
     *
     * 匹配规则：
     * 1. 只匹配 PENDING 状态的 FUTURE 类型计划
     * 2. 只匹配创建时间早于批次入库时间的计划
     * 3. 按计划创建时间排序，先到先得
     * 4. 支持部分匹配（批次数量不足时）
     *
     * @param newBatch 新入库的原材料批次
     * @return 匹配结果列表
     */
    List<MatchResultDTO> matchBatchToFuturePlans(MaterialBatch newBatch);

    /**
     * 手动触发匹配（用于补充匹配或重新匹配）
     *
     * @param factoryId 工厂ID
     * @param batchId 批次ID
     * @return 匹配结果列表
     */
    List<MatchResultDTO> triggerManualMatching(String factoryId, String batchId);

    /**
     * 释放计划的已分配原料（计划取消时调用）
     *
     * @param planId 计划ID
     */
    void releasePlanAllocations(String planId);
}

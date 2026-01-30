package com.cretas.aims.service;

import com.cretas.aims.entity.enums.ProcessingStageType;

import java.util.List;
import java.util.Map;

/**
 * 统一特征工程服务接口
 *
 * 为 LinUCB 人员推荐和 LLM+ML 混合预测提供统一的特征提取能力，
 * 消除硬编码默认值，确保特征计算的一致性和准确性。
 *
 * Phase 4 更新: 特征维度从 12 扩展到 16
 *
 * 特征维度说明:
 * - 任务特征 (8维): 任务量、截止时间、产品类型、优先级、复杂度、车间、工艺类型、工艺所需技能
 * - 工人特征 (8维): 技能等级、经验天数、近期效率、临时工标记、今日工时、疲劳度、工艺专项技能、工艺历史效率
 * - 组合特征 (16维): 任务特征 + 工人特征
 *
 * @author Cretas Team
 * @version 2.0.0
 * @since 2025-12-28
 */
public interface FeatureEngineeringService {

    // ==================== 任务特征提取 ====================

    /**
     * 从任务信息中提取特征向量 (8维)
     *
     * Phase 4 扩展: 从 6 维扩展到 8 维
     *
     * 特征说明:
     * [0] 任务量 (归一化到 0-1)
     * [1] 截止时间/小时 (归一化到 0-1)
     * [2] 产品类型编码 (hash编码 0-1)
     * [3] 优先级 (0-1, 原值/10)
     * [4] 复杂度 (0-1, 原值/5)
     * [5] 车间编码 (hash编码 0-1)
     * [6] 工艺类型编码 (ProcessingStageType ordinal / count, 0-1)  [NEW]
     * [7] 工艺所需技能等级 (归一化 1-5 → 0-1)  [NEW]
     *
     * @param factoryId 工厂ID
     * @param taskInfo 任务信息Map，支持的key:
     *                 - quantity: 任务数量
     *                 - deadlineHours: 截止时间(小时)
     *                 - productType: 产品类型ID
     *                 - priority: 优先级 1-10
     *                 - complexity: 复杂度 1-5
     *                 - workshopId: 车间ID
     *                 - stageType: 工艺类型 (ProcessingStageType 或 String)  [NEW]
     * @return 8维特征向量
     */
    double[] extractTaskFeatures(String factoryId, Map<String, Object> taskInfo);

    /**
     * 从生产计划中提取任务特征
     *
     * @param factoryId 工厂ID
     * @param planId 生产计划ID
     * @return 8维特征向量
     */
    double[] extractTaskFeaturesFromPlan(String factoryId, String planId);

    /**
     * 从加工批次中提取任务特征
     *
     * @param factoryId 工厂ID
     * @param batchId 加工批次ID
     * @return 8维特征向量
     */
    double[] extractTaskFeaturesFromBatch(String factoryId, Long batchId);

    // ==================== 工人特征提取 ====================

    /**
     * 从工人ID提取特征向量 (8维)
     *
     * Phase 4 扩展: 从 6 维扩展到 8 维
     *
     * 特征说明:
     * [0] 技能等级 (归一化 1-5 → 0-1)
     * [1] 经验天数 (归一化到 0-1, 上限365天)
     * [2] 近期效率 (从反馈记录计算, 0-1)
     * [3] 是否临时工 (0=正式工, 0.5=临时工)
     * [4] 今日已工作时长 (归一化到 0-1, 上限12小时)
     * [5] 疲劳度 (根据工作时长计算, 0-1)
     * [6] 工艺专项技能 (从 User.skillLevels 解析, 归一化 1-5 → 0-1)  [NEW]
     * [7] 工艺历史效率 (从 IndividualEfficiencyService 获取, 0-1)  [NEW]
     *
     * @param factoryId 工厂ID
     * @param workerId 工人ID
     * @return 8维特征向量
     */
    double[] extractWorkerFeatures(String factoryId, Long workerId);

    /**
     * 从工人ID提取特征向量 (8维)，支持工艺上下文
     *
     * Phase 4 新增: 支持工艺维度的特征提取
     *
     * @param factoryId 工厂ID
     * @param workerId 工人ID
     * @param stageType 工艺类型，用于提取工艺相关特征 [6] 和 [7]
     * @return 8维特征向量
     */
    double[] extractWorkerFeatures(String factoryId, Long workerId, ProcessingStageType stageType);

    /**
     * 从工人信息Map提取特征向量 (8维)
     * 用于无法查询数据库的场景
     *
     * @param workerInfo 工人信息Map，支持的key:
     *                   - skillLevel: 技能等级 1-5
     *                   - experienceDays: 经验天数
     *                   - recentEfficiency: 近期效率 0-1
     *                   - isTemporary: 是否临时工
     *                   - todayWorkHours: 今日工时
     *                   - fatigueLevel: 疲劳度 0-1
     *                   - stageSkillLevel: 工艺专项技能 1-5  [NEW]
     *                   - stageEfficiency: 工艺历史效率 0-1  [NEW]
     * @return 8维特征向量
     */
    double[] extractWorkerFeatures(Map<String, Object> workerInfo);

    // ==================== 特征组合 ====================

    /**
     * 合并任务特征和工人特征为上下文向量 (16维)
     *
     * Phase 4 更新: 从 12 维扩展到 16 维
     *
     * @param taskFeatures 8维任务特征
     * @param workerFeatures 8维工人特征
     * @return 16维组合特征向量
     */
    double[] combineFeatures(double[] taskFeatures, double[] workerFeatures);

    // ==================== 批量特征提取 ====================

    /**
     * 提取工人组的聚合特征
     * 用于 LLM+ML 混合预测，需要工人组的统计特征
     *
     * 返回的Map包含:
     * - avg_worker_experience_days: 平均经验天数
     * - avg_skill_level: 平均技能等级
     * - temporary_worker_ratio: 临时工比例
     * - avg_recent_efficiency: 平均近期效率
     * - total_available_hours: 可用总工时
     * - worker_count: 工人数量
     *
     * @param factoryId 工厂ID
     * @param workerIds 工人ID列表
     * @return 聚合特征Map
     */
    Map<String, Object> extractWorkerGroupFeatures(String factoryId, List<Long> workerIds);

    /**
     * 批量提取多个工人的特征向量
     *
     * @param factoryId 工厂ID
     * @param workerIds 工人ID列表
     * @return workerId -> 8维特征向量 的映射
     */
    Map<Long, double[]> extractMultipleWorkerFeatures(String factoryId, List<Long> workerIds);

    // ==================== 产品/设备特征 ====================

    /**
     * 提取产品类型的复杂度特征
     *
     * @param factoryId 工厂ID
     * @param productTypeId 产品类型ID
     * @return 复杂度值 1-5
     */
    int getProductComplexity(String factoryId, String productTypeId);

    /**
     * 提取设备相关特征
     *
     * 返回的Map包含:
     * - equipment_age_days: 设备使用天数
     * - equipment_utilization: 设备利用率 0-1
     * - maintenance_status: 维护状态 0=正常, 1=需维护
     *
     * @param factoryId 工厂ID
     * @param equipmentIds 设备ID列表
     * @return 设备特征Map
     */
    Map<String, Object> extractEquipmentFeatures(String factoryId, List<String> equipmentIds);

    // ==================== 工具方法 ====================

    /**
     * 归一化数值到 [0, 1] 区间
     *
     * @param value 原始值
     * @param min 最小值
     * @param max 最大值
     * @return 归一化后的值
     */
    double normalize(double value, double min, double max);

    /**
     * 将字符串编码为 [0, 1] 区间的数值
     * 使用hash算法确保相同字符串产生相同编码
     *
     * @param value 字符串值
     * @return 编码后的数值 0-1
     */
    double encodeString(String value);
}

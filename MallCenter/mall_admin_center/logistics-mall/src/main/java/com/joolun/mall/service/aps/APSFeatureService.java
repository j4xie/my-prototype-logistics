package com.joolun.mall.service.aps;

import com.joolun.mall.entity.aps.ProductionLine;
import com.joolun.mall.entity.aps.ProductionOrder;

import java.util.Map;

/**
 * APS 特征工程服务
 * (复用配送调度的特征工程模式)
 *
 * 特征维度设计 (128维):
 * - 订单特征 (48维): 产品属性、时间约束、资源需求、物料状态
 * - 产线特征 (48维): 产能属性、当前状态、人员配置、维护状态
 * - 交叉特征 (32维): 订单-产线匹配度
 *
 * @author APS Scheduling V1.0
 * @since 2026-01-21
 */
public interface APSFeatureService {

    /**
     * 订单特征维度
     */
    int ORDER_FEATURE_DIM = 48;

    /**
     * 产线特征维度
     */
    int LINE_FEATURE_DIM = 48;

    /**
     * 交叉特征维度
     */
    int CROSS_FEATURE_DIM = 32;

    /**
     * 总特征维度
     */
    int TOTAL_FEATURE_DIM = ORDER_FEATURE_DIM + LINE_FEATURE_DIM + CROSS_FEATURE_DIM;

    /**
     * 构建订单特征向量 (48维)
     *
     * 特征分解:
     * [0-7]:   产品属性 (类别编码、规格编码、复杂度)
     * [8-15]:  时间约束 (交期紧急度、时间窗口宽度、可跨天)
     * [16-23]: 资源需求 (技能等级、人员数、设备类型、模具)
     * [24-31]: 物料状态 (齐套率、预计到达、缺料风险)
     * [32-39]: 数量特征 (数量级别、可拆分、可混批)
     * [40-47]: 优先级特征 (优先级、紧急标记、客户等级)
     *
     * @param order 生产订单
     * @return 48维特征向量
     */
    double[] buildOrderFeatureVector(ProductionOrder order);

    /**
     * 构建产线特征向量 (48维)
     *
     * 特征分解:
     * [0-7]:   产能属性 (标准产能、最大产能、效率系数)
     * [8-15]:  当前状态 (运行状态、当前负载、预计空闲时间)
     * [16-23]: 人员配置 (当前人数、可加人数、技能分布)
     * [24-31]: 产品兼容 (可生产类别、换型历史、当前类别)
     * [32-39]: 维护状态 (距下次维护、故障率、运行时长)
     * [40-47]: 班次信息 (当前班次、剩余工时、可加班)
     *
     * @param line 生产线
     * @return 48维特征向量
     */
    double[] buildLineFeatureVector(ProductionLine line);

    /**
     * 构建订单-产线匹配特征向量 (32维交叉特征)
     *
     * 特征分解:
     * [0-7]:   产能匹配 (产能满足度、效率预估)
     * [8-15]:  换型特征 (换型时间、需清洁、需换模)
     * [16-23]: 人员匹配 (人员满足度、技能匹配度)
     * [24-31]: 时间匹配 (交期满足度、空闲时间匹配)
     *
     * @param order 生产订单
     * @param line 生产线
     * @return 32维交叉特征向量
     */
    double[] buildMatchFeatureVector(ProductionOrder order, ProductionLine line);

    /**
     * 构建完整特征向量 (128维)
     *
     * @param order 生产订单
     * @param line 生产线
     * @return 128维完整特征向量
     */
    double[] buildFullFeatureVector(ProductionOrder order, ProductionLine line);

    /**
     * 计算订单生产时长预估 (分钟)
     *
     * @param order 订单
     * @param line 产线
     * @return 预估生产时长(分钟)
     */
    int estimateProductionDuration(ProductionOrder order, ProductionLine line);

    /**
     * 计算换型时间 (分钟)
     *
     * @param fromCategory 来源产品类别
     * @param toCategory 目标产品类别
     * @param lineId 产线ID
     * @return 换型时间(分钟)
     */
    int calculateChangeoverTime(String fromCategory, String toCategory, String lineId);

    /**
     * 获取特征统计信息
     */
    Map<String, Object> getFeatureStats();
}

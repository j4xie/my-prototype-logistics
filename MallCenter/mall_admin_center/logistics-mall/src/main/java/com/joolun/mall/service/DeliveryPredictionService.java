package com.joolun.mall.service;

import com.joolun.mall.entity.DeliveryFeedback;
import com.joolun.mall.entity.DeliveryOrder;
import com.joolun.mall.entity.DeliveryVehicle;

import java.util.List;
import java.util.Map;

/**
 * 配送时间预测服务
 *
 * 模型设计: 类似CTR预测
 * - 输入: 订单特征(64) + 车辆特征(64) + 交叉特征(32) = 160维
 * - 输出: 预测配送时长 (回归) 或 准时概率 (分类)
 * - 算法: 线性回归 + L2正则 + 在线SGD更新
 *
 * @author Delivery Scheduling V4.0
 * @since 2026-01-20
 */
public interface DeliveryPredictionService {

    /**
     * 预测配送时长 (分钟)
     *
     * @param order 配送订单
     * @param vehicle 配送车辆
     * @return 预测时长(分钟)
     */
    double predictDeliveryDuration(DeliveryOrder order, DeliveryVehicle vehicle);

    /**
     * 预测准时概率
     *
     * @param order 配送订单
     * @param vehicle 配送车辆
     * @return 准时概率 [0, 1]
     */
    double predictOnTimeRate(DeliveryOrder order, DeliveryVehicle vehicle);

    /**
     * 批量预测配送时长
     *
     * @param order 配送订单
     * @param vehicles 车辆列表
     * @return 车辆ID -> 预测时长 映射
     */
    Map<String, Double> batchPredictDuration(DeliveryOrder order, List<DeliveryVehicle> vehicles);

    /**
     * 在线学习更新模型
     *
     * @param feedback 配送反馈
     */
    void updateModel(DeliveryFeedback feedback);

    /**
     * 批量更新模型
     *
     * @param feedbackList 反馈列表
     */
    void batchUpdateModel(List<DeliveryFeedback> feedbackList);

    /**
     * 获取模型权重
     *
     * @return 权重向量
     */
    double[] getModelWeights();

    /**
     * 重置模型权重
     */
    void resetModelWeights();

    /**
     * 获取模型统计信息
     *
     * @return 统计信息 (维度、样本数、MAE、准时率准确度等)
     */
    Map<String, Object> getModelStats();

    /**
     * 获取特征重要性排名
     *
     * @return 特征名称 -> 重要性分数
     */
    Map<String, Double> getFeatureImportance();
}

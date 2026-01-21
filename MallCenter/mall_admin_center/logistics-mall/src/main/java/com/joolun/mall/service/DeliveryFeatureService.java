package com.joolun.mall.service;

import com.joolun.mall.entity.DeliveryOrder;
import com.joolun.mall.entity.DeliveryVehicle;

import java.util.Map;

/**
 * 配送调度特征工程服务
 *
 * 特征维度设计 (160维):
 * - 订单特征 (64维): 地理位置、时间窗口、货物属性、客户特征、区域统计、时间特征
 * - 车辆特征 (64维): 基础属性、当前状态、司机特征、历史表现、路线特征、实时状态
 * - 交叉特征 (32维): 订单-车辆匹配度
 *
 * @author Delivery Scheduling V4.0
 * @since 2026-01-20
 */
public interface DeliveryFeatureService {

    /**
     * 订单特征维度
     */
    int ORDER_FEATURE_DIM = 64;

    /**
     * 车辆特征维度
     */
    int VEHICLE_FEATURE_DIM = 64;

    /**
     * 交叉特征维度
     */
    int CROSS_FEATURE_DIM = 32;

    /**
     * 总特征维度
     */
    int TOTAL_FEATURE_DIM = ORDER_FEATURE_DIM + VEHICLE_FEATURE_DIM + CROSS_FEATURE_DIM;

    /**
     * 构建订单特征向量 (64维)
     *
     * 特征分解:
     * [0-7]:   地理位置 (经纬度归一化、区域编码、距离仓库)
     * [8-15]:  时间窗口 (开始/结束时间归一化、窗口宽度、紧急度)
     * [16-23]: 货物属性 (重量、体积、件数、冷链标记)
     * [24-31]: 客户特征 (历史准时率、投诉率、价值等级)
     * [32-47]: 区域统计 (区域订单密度、平均配送时长、拥堵指数)
     * [48-63]: 时间特征 (小时、星期、节假日、促销期)
     *
     * @param order 配送订单
     * @return 64维特征向量
     */
    double[] buildOrderFeatureVector(DeliveryOrder order);

    /**
     * 构建车辆特征向量 (64维)
     *
     * 特征分解:
     * [0-7]:   基础属性 (载重、容积、类型编码)
     * [8-15]:  当前状态 (已装载量、剩余容量、当前位置)
     * [16-23]: 司机特征 (驾龄、评分、熟悉区域编码)
     * [24-31]: 历史表现 (准时率、日均单量、平均评分)
     * [32-47]: 路线特征 (当前路线长度、预计完成时间、顺路度)
     * [48-63]: 实时状态 (疲劳度、工作时长、休息状态)
     *
     * @param vehicle 配送车辆
     * @return 64维特征向量
     */
    double[] buildVehicleFeatureVector(DeliveryVehicle vehicle);

    /**
     * 构建订单-车辆匹配特征向量 (32维交叉特征)
     *
     * @param order 配送订单
     * @param vehicle 配送车辆
     * @return 32维交叉特征向量
     */
    double[] buildMatchFeatureVector(DeliveryOrder order, DeliveryVehicle vehicle);

    /**
     * 构建完整特征向量 (160维)
     *
     * @param order 配送订单
     * @param vehicle 配送车辆
     * @return 160维完整特征向量
     */
    double[] buildFullFeatureVector(DeliveryOrder order, DeliveryVehicle vehicle);

    /**
     * 计算两点之间的距离 (km)
     * 使用Haversine公式
     *
     * @param lat1 纬度1
     * @param lng1 经度1
     * @param lat2 纬度2
     * @param lng2 经度2
     * @return 距离(km)
     */
    double calculateDistance(double lat1, double lng1, double lat2, double lng2);

    /**
     * 获取特征统计信息
     *
     * @return 统计信息
     */
    Map<String, Object> getFeatureStats();
}

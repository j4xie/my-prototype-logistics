package com.joolun.mall.service;

import java.util.Map;

/**
 * 配送模拟数据生成服务
 *
 * 订单生成策略:
 * - 区域分布: 按商圈热度分布 (市中心60%、郊区30%、远郊10%)
 * - 时间窗口: 上午9-12点(40%)、下午14-18点(50%)、晚间(10%)
 * - 货物特征: 小件(60%)、中件(30%)、大件(10%)
 * - 优先级: 普通(70%)、加急(20%)、特急(10%)
 *
 * 反馈生成策略:
 * P(on_time) = base_rate * distance_factor * traffic_factor * driver_factor * weather_factor
 * - base_rate = 0.85
 * - distance_factor = exp(-distance / 20km)
 * - traffic_factor = 时段拥堵系数 (高峰0.7, 平峰1.0, 低峰1.1)
 * - driver_factor = 司机历史准时率
 * - weather_factor = 天气影响 (晴1.0, 雨0.85, 雪0.7)
 *
 * @author Delivery Scheduling V4.0
 * @since 2026-01-20
 */
public interface DeliverySimulationService {

    /**
     * 生成模拟订单
     *
     * @param count 订单数量
     * @param days 生成天数
     * @return 生成结果统计
     */
    Map<String, Object> generateSimulatedOrders(int count, int days);

    /**
     * 生成模拟车辆
     *
     * @param count 车辆数量
     * @return 生成结果统计
     */
    Map<String, Object> generateSimulatedVehicles(int count);

    /**
     * 生成模拟配送反馈
     * 对已完成的模拟订单生成反馈数据用于训练
     *
     * @param days 反馈天数
     * @return 生成结果统计
     */
    Map<String, Object> generateSimulatedFeedback(int days);

    /**
     * 清理模拟数据
     *
     * @return 清理结果统计
     */
    Map<String, Object> clearSimulatedData();

    /**
     * 获取模拟数据统计
     *
     * @return 统计信息
     */
    Map<String, Object> getSimulationStats();

    /**
     * 执行完整模拟流程
     * 1. 生成订单
     * 2. 生成车辆
     * 3. 执行调度
     * 4. 生成反馈
     * 5. 训练模型
     *
     * @param orderCount 订单数量
     * @param vehicleCount 车辆数量
     * @param days 天数
     * @return 完整模拟结果
     */
    Map<String, Object> runFullSimulation(int orderCount, int vehicleCount, int days);
}

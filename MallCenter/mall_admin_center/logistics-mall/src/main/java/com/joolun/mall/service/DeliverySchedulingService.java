package com.joolun.mall.service;

import com.joolun.mall.entity.DeliveryOrder;
import com.joolun.mall.entity.DeliveryRoute;
import com.joolun.mall.entity.DeliveryVehicle;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 配送调度服务
 *
 * 实现多策略调度 (类似多路召回):
 * - nearest_vehicle (25%): 最近车辆优先
 * - capacity_match (20%): 容量最匹配
 * - time_window_fit (20%): 时间窗口最契合
 * - route_optimization (15%): 路线优化 (顺路)
 * - driver_preference (10%): 司机区域偏好
 * - workload_balance (10%): 工作量均衡
 *
 * @author Delivery Scheduling V4.0
 * @since 2026-01-20
 */
public interface DeliverySchedulingService {

    /**
     * 为单个订单调度车辆
     * 返回车辆候选列表，按综合得分排序
     *
     * @param order 配送订单
     * @return 车辆候选列表
     */
    List<VehicleCandidate> scheduleOrder(DeliveryOrder order);

    /**
     * 批量调度优化
     * 对指定日期的所有待调度订单进行优化分配
     *
     * @param date 调度日期
     * @return 调度结果
     */
    SchedulingResult batchSchedule(LocalDate date);

    /**
     * 批量调度优化 (指定订单和车辆)
     *
     * @param orders 订单列表
     * @param vehicles 可用车辆列表
     * @return 调度结果
     */
    SchedulingResult batchSchedule(List<DeliveryOrder> orders, List<DeliveryVehicle> vehicles);

    /**
     * 获取订单的最优车辆
     *
     * @param orderId 订单ID
     * @return 最优车辆ID
     */
    String getBestVehicle(String orderId);

    /**
     * 确认调度分配
     *
     * @param orderId 订单ID
     * @param vehicleId 车辆ID
     * @return 是否成功
     */
    boolean confirmSchedule(String orderId, String vehicleId);

    /**
     * 获取调度策略权重
     *
     * @return 策略权重配置
     */
    Map<String, Double> getStrategyWeights();

    /**
     * 更新调度策略权重
     *
     * @param weights 新权重配置
     */
    void updateStrategyWeights(Map<String, Double> weights);

    /**
     * 获取调度统计信息
     *
     * @return 统计信息
     */
    Map<String, Object> getSchedulingStats();

    /**
     * 车辆候选数据类
     */
    class VehicleCandidate {
        private String vehicleId;
        private DeliveryVehicle vehicle;
        private double score;
        private Map<String, Double> strategyScores;
        private double estimatedDuration;
        private double distance;

        public VehicleCandidate() {}

        public VehicleCandidate(String vehicleId, DeliveryVehicle vehicle, double score) {
            this.vehicleId = vehicleId;
            this.vehicle = vehicle;
            this.score = score;
        }

        // Getters and Setters
        public String getVehicleId() { return vehicleId; }
        public void setVehicleId(String vehicleId) { this.vehicleId = vehicleId; }
        public DeliveryVehicle getVehicle() { return vehicle; }
        public void setVehicle(DeliveryVehicle vehicle) { this.vehicle = vehicle; }
        public double getScore() { return score; }
        public void setScore(double score) { this.score = score; }
        public Map<String, Double> getStrategyScores() { return strategyScores; }
        public void setStrategyScores(Map<String, Double> strategyScores) { this.strategyScores = strategyScores; }
        public double getEstimatedDuration() { return estimatedDuration; }
        public void setEstimatedDuration(double estimatedDuration) { this.estimatedDuration = estimatedDuration; }
        public double getDistance() { return distance; }
        public void setDistance(double distance) { this.distance = distance; }
    }

    /**
     * 调度结果数据类
     */
    class SchedulingResult {
        private LocalDate date;
        private int totalOrders;
        private int scheduledOrders;
        private int unscheduledOrders;
        private List<DeliveryRoute> routes;
        private Map<String, List<String>> vehicleOrderMap;
        private long elapsedMs;
        private String message;

        // Getters and Setters
        public LocalDate getDate() { return date; }
        public void setDate(LocalDate date) { this.date = date; }
        public int getTotalOrders() { return totalOrders; }
        public void setTotalOrders(int totalOrders) { this.totalOrders = totalOrders; }
        public int getScheduledOrders() { return scheduledOrders; }
        public void setScheduledOrders(int scheduledOrders) { this.scheduledOrders = scheduledOrders; }
        public int getUnscheduledOrders() { return unscheduledOrders; }
        public void setUnscheduledOrders(int unscheduledOrders) { this.unscheduledOrders = unscheduledOrders; }
        public List<DeliveryRoute> getRoutes() { return routes; }
        public void setRoutes(List<DeliveryRoute> routes) { this.routes = routes; }
        public Map<String, List<String>> getVehicleOrderMap() { return vehicleOrderMap; }
        public void setVehicleOrderMap(Map<String, List<String>> vehicleOrderMap) { this.vehicleOrderMap = vehicleOrderMap; }
        public long getElapsedMs() { return elapsedMs; }
        public void setElapsedMs(long elapsedMs) { this.elapsedMs = elapsedMs; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
    }
}

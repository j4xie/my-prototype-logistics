package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.joolun.mall.entity.DeliveryOrder;
import com.joolun.mall.entity.DeliveryRoute;
import com.joolun.mall.entity.DeliveryVehicle;
import com.joolun.mall.mapper.DeliveryOrderMapper;
import com.joolun.mall.mapper.DeliveryRouteMapper;
import com.joolun.mall.mapper.DeliveryVehicleMapper;
import com.joolun.mall.service.DeliveryFeatureService;
import com.joolun.mall.service.DeliveryPredictionService;
import com.joolun.mall.service.DeliverySchedulingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.annotation.PostConstruct;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

/**
 * 配送调度服务实现
 *
 * 多策略调度 (类似多路召回):
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
@Slf4j
@Service
@RequiredArgsConstructor
public class DeliverySchedulingServiceImpl implements DeliverySchedulingService {

    private final DeliveryOrderMapper deliveryOrderMapper;
    private final DeliveryVehicleMapper deliveryVehicleMapper;
    private final DeliveryRouteMapper deliveryRouteMapper;
    private final DeliveryFeatureService featureService;
    private final DeliveryPredictionService predictionService;

    // 调度策略权重
    private final ConcurrentHashMap<String, Double> strategyWeights = new ConcurrentHashMap<>();

    // 策略名称常量
    private static final String STRATEGY_NEAREST = "nearest_vehicle";
    private static final String STRATEGY_CAPACITY = "capacity_match";
    private static final String STRATEGY_TIME = "time_window_fit";
    private static final String STRATEGY_ROUTE = "route_optimization";
    private static final String STRATEGY_DRIVER = "driver_preference";
    private static final String STRATEGY_WORKLOAD = "workload_balance";

    // 统计
    private final AtomicInteger totalScheduled = new AtomicInteger(0);

    @PostConstruct
    public void init() {
        // 初始化默认权重
        strategyWeights.put(STRATEGY_NEAREST, 0.25);
        strategyWeights.put(STRATEGY_CAPACITY, 0.20);
        strategyWeights.put(STRATEGY_TIME, 0.20);
        strategyWeights.put(STRATEGY_ROUTE, 0.15);
        strategyWeights.put(STRATEGY_DRIVER, 0.10);
        strategyWeights.put(STRATEGY_WORKLOAD, 0.10);

        log.info("配送调度服务初始化完成，策略权重: {}", strategyWeights);
    }

    @Override
    public List<VehicleCandidate> scheduleOrder(DeliveryOrder order) {
        if (order == null) {
            return Collections.emptyList();
        }

        log.debug("开始调度订单: orderId={}", order.getId());

        // 获取可用车辆
        List<DeliveryVehicle> vehicles = getAvailableVehicles(order);
        if (vehicles.isEmpty()) {
            log.warn("没有可用车辆: orderId={}", order.getId());
            return Collections.emptyList();
        }

        List<VehicleCandidate> candidates = new ArrayList<>();

        for (DeliveryVehicle vehicle : vehicles) {
            // 计算各策略得分
            Map<String, Double> strategyScores = calculateStrategyScores(order, vehicle);

            // 加权综合得分
            double totalScore = 0;
            for (Map.Entry<String, Double> entry : strategyScores.entrySet()) {
                double weight = strategyWeights.getOrDefault(entry.getKey(), 0.0);
                totalScore += weight * entry.getValue();
            }

            // 使用预测模型调整得分
            double predictedDuration = predictionService.predictDeliveryDuration(order, vehicle);
            double onTimeRate = predictionService.predictOnTimeRate(order, vehicle);
            totalScore *= (0.5 + 0.5 * onTimeRate);  // 准时率加权

            // 计算距离
            double distance = featureService.calculateDistance(
                order.getLatitude() != null ? order.getLatitude().doubleValue() : 31.23,
                order.getLongitude() != null ? order.getLongitude().doubleValue() : 121.47,
                vehicle.getCurrentLat() != null ? vehicle.getCurrentLat().doubleValue() : 31.23,
                vehicle.getCurrentLng() != null ? vehicle.getCurrentLng().doubleValue() : 121.47
            );

            VehicleCandidate candidate = new VehicleCandidate(vehicle.getId(), vehicle, totalScore);
            candidate.setStrategyScores(strategyScores);
            candidate.setEstimatedDuration(predictedDuration);
            candidate.setDistance(distance);

            candidates.add(candidate);
        }

        // 按得分降序排序
        candidates.sort((a, b) -> Double.compare(b.getScore(), a.getScore()));

        log.debug("订单调度完成: orderId={}, 候选车辆数={}", order.getId(), candidates.size());
        return candidates;
    }

    @Override
    @Transactional
    public SchedulingResult batchSchedule(LocalDate date) {
        log.info("开始批量调度: date={}", date);
        long startTime = System.currentTimeMillis();

        // 获取待调度订单
        List<DeliveryOrder> orders = deliveryOrderMapper.selectPendingOrdersByDate(date);
        log.info("待调度订单数: {}", orders.size());

        // 获取可用车辆
        List<DeliveryVehicle> vehicles = deliveryVehicleMapper.selectAvailableVehicles();
        log.info("可用车辆数: {}", vehicles.size());

        return batchSchedule(orders, vehicles);
    }

    @Override
    @Transactional
    public SchedulingResult batchSchedule(List<DeliveryOrder> orders, List<DeliveryVehicle> vehicles) {
        long startTime = System.currentTimeMillis();
        SchedulingResult result = new SchedulingResult();
        result.setDate(LocalDate.now());
        result.setTotalOrders(orders.size());

        if (orders.isEmpty() || vehicles.isEmpty()) {
            result.setScheduledOrders(0);
            result.setUnscheduledOrders(orders.size());
            result.setMessage("没有可调度的订单或车辆");
            result.setElapsedMs(System.currentTimeMillis() - startTime);
            return result;
        }

        // 按优先级和时间窗口排序订单
        orders.sort((a, b) -> {
            int priorityCompare = Integer.compare(
                b.getPriority() != null ? b.getPriority() : 3,
                a.getPriority() != null ? a.getPriority() : 3
            );
            if (priorityCompare != 0) return priorityCompare;
            if (a.getExpectedStart() == null) return 1;
            if (b.getExpectedStart() == null) return -1;
            return a.getExpectedStart().compareTo(b.getExpectedStart());
        });

        // 车辆订单分配映射
        Map<String, List<String>> vehicleOrderMap = new HashMap<>();
        Map<String, Integer> vehicleSequence = new HashMap<>();
        for (DeliveryVehicle v : vehicles) {
            vehicleOrderMap.put(v.getId(), new ArrayList<>());
            vehicleSequence.put(v.getId(), 0);
        }

        int scheduledCount = 0;
        List<DeliveryOrder> updateOrders = new ArrayList<>();

        // 贪心调度
        for (DeliveryOrder order : orders) {
            List<VehicleCandidate> candidates = scheduleOrder(order);

            if (!candidates.isEmpty()) {
                // 选择最优车辆
                VehicleCandidate best = candidates.get(0);
                String vehicleId = best.getVehicleId();

                // 更新订单
                order.setVehicleId(vehicleId);
                order.setSequenceInRoute(vehicleSequence.get(vehicleId) + 1);
                order.setScheduledTime(LocalDateTime.now().plusMinutes((long) best.getEstimatedDuration()));
                order.setStatus("scheduled");
                updateOrders.add(order);

                // 更新映射
                vehicleOrderMap.get(vehicleId).add(order.getId());
                vehicleSequence.put(vehicleId, vehicleSequence.get(vehicleId) + 1);

                scheduledCount++;
            }
        }

        // 批量更新数据库
        for (DeliveryOrder order : updateOrders) {
            deliveryOrderMapper.updateById(order);
        }

        // 创建路线
        List<DeliveryRoute> routes = createRoutes(vehicleOrderMap, vehicles);
        result.setRoutes(routes);

        result.setScheduledOrders(scheduledCount);
        result.setUnscheduledOrders(orders.size() - scheduledCount);
        result.setVehicleOrderMap(vehicleOrderMap);
        result.setElapsedMs(System.currentTimeMillis() - startTime);
        result.setMessage("调度完成");

        totalScheduled.addAndGet(scheduledCount);

        log.info("批量调度完成: total={}, scheduled={}, elapsed={}ms",
                orders.size(), scheduledCount, result.getElapsedMs());

        return result;
    }

    @Override
    public String getBestVehicle(String orderId) {
        DeliveryOrder order = deliveryOrderMapper.selectById(orderId);
        if (order == null) {
            return null;
        }

        List<VehicleCandidate> candidates = scheduleOrder(order);
        return candidates.isEmpty() ? null : candidates.get(0).getVehicleId();
    }

    @Override
    @Transactional
    public boolean confirmSchedule(String orderId, String vehicleId) {
        DeliveryOrder order = deliveryOrderMapper.selectById(orderId);
        if (order == null) {
            return false;
        }

        order.setVehicleId(vehicleId);
        order.setStatus("scheduled");
        order.setScheduledTime(LocalDateTime.now());

        return deliveryOrderMapper.updateById(order) > 0;
    }

    @Override
    public Map<String, Double> getStrategyWeights() {
        return new HashMap<>(strategyWeights);
    }

    @Override
    public void updateStrategyWeights(Map<String, Double> weights) {
        if (weights == null || weights.isEmpty()) {
            return;
        }

        // 归一化
        double total = weights.values().stream().mapToDouble(Double::doubleValue).sum();
        if (Math.abs(total - 1.0) > 0.01) {
            for (Map.Entry<String, Double> entry : weights.entrySet()) {
                weights.put(entry.getKey(), entry.getValue() / total);
            }
        }

        strategyWeights.putAll(weights);
        log.info("调度策略权重已更新: {}", strategyWeights);
    }

    @Override
    public Map<String, Object> getSchedulingStats() {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalScheduled", totalScheduled.get());
        stats.put("strategyWeights", new HashMap<>(strategyWeights));
        stats.put("predictionModelStats", predictionService.getModelStats());
        return stats;
    }

    // ==================== 私有方法 ====================

    private List<DeliveryVehicle> getAvailableVehicles(DeliveryOrder order) {
        List<DeliveryVehicle> vehicles;

        // 如果需要冷链，只返回冷链车
        if (Boolean.TRUE.equals(order.getRequiresCold())) {
            vehicles = deliveryVehicleMapper.selectColdChainVehicles();
        } else {
            vehicles = deliveryVehicleMapper.selectAvailableVehicles();
        }

        // 过滤容量不足的车辆
        double orderWeight = order.getWeight() != null ? order.getWeight().doubleValue() : 0;
        double orderVolume = order.getVolume() != null ? order.getVolume().doubleValue() : 0;

        return vehicles.stream()
            .filter(v -> {
                double remainWeight = v.getMaxWeight() != null ?
                    v.getMaxWeight().doubleValue() -
                    (v.getCurrentLoadWeight() != null ? v.getCurrentLoadWeight().doubleValue() : 0) : 500;
                double remainVolume = v.getMaxVolume() != null ?
                    v.getMaxVolume().doubleValue() -
                    (v.getCurrentLoadVolume() != null ? v.getCurrentLoadVolume().doubleValue() : 0) : 5;
                return remainWeight >= orderWeight && remainVolume >= orderVolume;
            })
            .collect(Collectors.toList());
    }

    private Map<String, Double> calculateStrategyScores(DeliveryOrder order, DeliveryVehicle vehicle) {
        Map<String, Double> scores = new HashMap<>();

        // 1. 最近车辆策略
        double distance = featureService.calculateDistance(
            order.getLatitude() != null ? order.getLatitude().doubleValue() : 31.23,
            order.getLongitude() != null ? order.getLongitude().doubleValue() : 121.47,
            vehicle.getCurrentLat() != null ? vehicle.getCurrentLat().doubleValue() : 31.23,
            vehicle.getCurrentLng() != null ? vehicle.getCurrentLng().doubleValue() : 121.47
        );
        scores.put(STRATEGY_NEAREST, Math.exp(-distance / 10.0));

        // 2. 容量匹配策略
        double orderWeight = order.getWeight() != null ? order.getWeight().doubleValue() : 0;
        double remainWeight = vehicle.getMaxWeight() != null ?
            vehicle.getMaxWeight().doubleValue() -
            (vehicle.getCurrentLoadWeight() != null ? vehicle.getCurrentLoadWeight().doubleValue() : 0) : 500;
        scores.put(STRATEGY_CAPACITY, remainWeight > 0 ? Math.min(1.0, orderWeight / remainWeight) : 0);

        // 3. 时间窗口匹配策略
        double timeScore = 1.0;
        if (order.getExpectedStart() != null) {
            double estimatedArrival = distance / 30.0 * 60;  // 假设30km/h
            long minutesToStart = java.time.temporal.ChronoUnit.MINUTES.between(
                LocalDateTime.now(), order.getExpectedStart());
            if (estimatedArrival <= minutesToStart) {
                timeScore = 1.0;
            } else {
                timeScore = Math.exp(-(estimatedArrival - minutesToStart) / 30.0);
            }
        }
        scores.put(STRATEGY_TIME, timeScore);

        // 4. 路线优化策略 (简化: 基于距离)
        scores.put(STRATEGY_ROUTE, Math.exp(-distance / 20.0));

        // 5. 司机偏好策略 (简化: 基于评分)
        double rating = vehicle.getDriverRating() != null ? vehicle.getDriverRating().doubleValue() : 4.0;
        scores.put(STRATEGY_DRIVER, rating / 5.0);

        // 6. 工作量均衡策略
        int dailyOrders = vehicle.getDailyOrderCount() != null ? vehicle.getDailyOrderCount() : 0;
        scores.put(STRATEGY_WORKLOAD, dailyOrders < 30 ? 1.0 : Math.max(0, 1.0 - (dailyOrders - 30) / 20.0));

        return scores;
    }

    private List<DeliveryRoute> createRoutes(Map<String, List<String>> vehicleOrderMap,
                                              List<DeliveryVehicle> vehicles) {
        List<DeliveryRoute> routes = new ArrayList<>();
        LocalDate today = LocalDate.now();

        for (DeliveryVehicle vehicle : vehicles) {
            List<String> orderIds = vehicleOrderMap.get(vehicle.getId());
            if (orderIds == null || orderIds.isEmpty()) {
                continue;
            }

            DeliveryRoute route = new DeliveryRoute();
            route.setVehicleId(vehicle.getId());
            route.setRouteDate(today);
            route.setTotalOrders(orderIds.size());
            route.setStatus("planned");
            route.setIsSimulated(vehicle.getIsSimulated());
            route.setRouteSequence(String.join(",", orderIds));

            deliveryRouteMapper.insert(route);
            routes.add(route);
        }

        return routes;
    }
}

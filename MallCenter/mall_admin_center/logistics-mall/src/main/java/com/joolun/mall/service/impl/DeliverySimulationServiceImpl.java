package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.joolun.mall.entity.DeliveryFeedback;
import com.joolun.mall.entity.DeliveryOrder;
import com.joolun.mall.entity.DeliveryVehicle;
import com.joolun.mall.mapper.DeliveryFeedbackMapper;
import com.joolun.mall.mapper.DeliveryOrderMapper;
import com.joolun.mall.mapper.DeliveryVehicleMapper;
import com.joolun.mall.service.DeliveryFeatureService;
import com.joolun.mall.service.DeliveryPredictionService;
import com.joolun.mall.service.DeliverySchedulingService;
import com.joolun.mall.service.DeliverySimulationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 配送模拟数据生成服务实现
 *
 * @author Delivery Scheduling V4.0
 * @since 2026-01-20
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DeliverySimulationServiceImpl implements DeliverySimulationService {

    private final DeliveryOrderMapper orderMapper;
    private final DeliveryVehicleMapper vehicleMapper;
    private final DeliveryFeedbackMapper feedbackMapper;
    private final DeliverySchedulingService schedulingService;
    private final DeliveryPredictionService predictionService;
    private final DeliveryFeatureService featureService;

    private final Random random = new Random();

    // 上海区域配置
    private static final String[] DISTRICTS = {
        "浦东新区", "黄浦区", "静安区", "徐汇区", "长宁区",
        "普陀区", "虹口区", "杨浦区", "闵行区", "宝山区",
        "嘉定区", "松江区", "青浦区", "奉贤区", "金山区"
    };

    // 区域分布权重 (市中心60%, 郊区30%, 远郊10%)
    private static final double[] DISTRICT_WEIGHTS = {
        0.15, 0.10, 0.10, 0.10, 0.08,  // 市中心
        0.05, 0.05, 0.05, 0.08, 0.05,  // 郊区
        0.04, 0.04, 0.04, 0.04, 0.03   // 远郊
    };

    // 区域中心坐标
    private static final double[][] DISTRICT_CENTERS = {
        {31.22, 121.54}, {31.23, 121.49}, {31.23, 121.45}, {31.19, 121.44}, {31.22, 121.42},
        {31.25, 121.40}, {31.27, 121.48}, {31.27, 121.53}, {31.11, 121.38}, {31.40, 121.49},
        {31.38, 121.26}, {31.00, 121.23}, {31.15, 121.12}, {30.92, 121.47}, {30.74, 121.34}
    };

    // 车辆类型配置
    private static final String[] VEHICLE_TYPES = {"small", "medium", "large", "cold_chain"};
    private static final double[][] VEHICLE_SPECS = {
        {200, 2},   // small: 200kg, 2m³
        {500, 5},   // medium: 500kg, 5m³
        {1000, 10}, // large: 1000kg, 10m³
        {500, 5}    // cold_chain: 500kg, 5m³
    };

    @Override
    @Transactional
    public Map<String, Object> generateSimulatedOrders(int count, int days) {
        log.info("开始生成模拟订单: count={}, days={}", count, days);
        long startTime = System.currentTimeMillis();

        Map<String, Object> stats = new LinkedHashMap<>();
        int created = 0;
        Map<String, Integer> districtCounts = new HashMap<>();

        int ordersPerDay = count / Math.max(1, days);
        LocalDate today = LocalDate.now();

        for (int d = 0; d < days; d++) {
            LocalDate date = today.plusDays(d);

            for (int i = 0; i < ordersPerDay; i++) {
                try {
                    DeliveryOrder order = generateOrder(date);
                    orderMapper.insert(order);
                    created++;

                    districtCounts.merge(order.getDistrict(), 1, Integer::sum);
                } catch (Exception e) {
                    log.debug("生成订单失败: {}", e.getMessage());
                }
            }
        }

        stats.put("requested", count);
        stats.put("created", created);
        stats.put("days", days);
        stats.put("districtDistribution", districtCounts);
        stats.put("elapsedMs", System.currentTimeMillis() - startTime);

        log.info("模拟订单生成完成: created={}, elapsed={}ms", created, stats.get("elapsedMs"));
        return stats;
    }

    @Override
    @Transactional
    public Map<String, Object> generateSimulatedVehicles(int count) {
        log.info("开始生成模拟车辆: count={}", count);

        Map<String, Object> stats = new LinkedHashMap<>();
        int created = 0;
        Map<String, Integer> typeCounts = new HashMap<>();

        for (int i = 0; i < count; i++) {
            try {
                DeliveryVehicle vehicle = generateVehicle(i);
                vehicleMapper.insert(vehicle);
                created++;

                typeCounts.merge(vehicle.getVehicleType(), 1, Integer::sum);
            } catch (Exception e) {
                log.debug("生成车辆失败: {}", e.getMessage());
            }
        }

        stats.put("requested", count);
        stats.put("created", created);
        stats.put("typeDistribution", typeCounts);

        log.info("模拟车辆生成完成: created={}", created);
        return stats;
    }

    @Override
    @Transactional
    public Map<String, Object> generateSimulatedFeedback(int days) {
        log.info("开始生成模拟反馈: days={}", days);

        Map<String, Object> stats = new LinkedHashMap<>();
        int created = 0;
        int onTimeCount = 0;
        double totalDelay = 0;

        // 获取已调度的订单
        LocalDateTime cutoff = LocalDateTime.now().minusDays(days);
        LambdaQueryWrapper<DeliveryOrder> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(DeliveryOrder::getStatus, "scheduled")
               .eq(DeliveryOrder::getIsSimulated, true)
               .ge(DeliveryOrder::getCreatedAt, cutoff);

        List<DeliveryOrder> orders = orderMapper.selectList(wrapper);
        log.info("获取到待生成反馈的订单: {}", orders.size());

        for (DeliveryOrder order : orders) {
            try {
                DeliveryFeedback feedback = generateFeedback(order);
                feedbackMapper.insert(feedback);
                created++;

                if (Boolean.TRUE.equals(feedback.getIsOnTime())) {
                    onTimeCount++;
                }
                if (feedback.getDelayMinutes() != null) {
                    totalDelay += feedback.getDelayMinutes();
                }

                // 更新订单状态
                order.setStatus("completed");
                order.setActualEndTime(LocalDateTime.now());
                orderMapper.updateById(order);

            } catch (Exception e) {
                log.debug("生成反馈失败: {}", e.getMessage());
            }
        }

        stats.put("orders", orders.size());
        stats.put("feedbackCreated", created);
        stats.put("onTimeCount", onTimeCount);
        stats.put("onTimeRate", created > 0 ? (double) onTimeCount / created : 0);
        stats.put("avgDelay", created > 0 ? totalDelay / created : 0);

        // 用反馈数据训练模型
        if (created > 0) {
            List<DeliveryFeedback> feedbackList = feedbackMapper.selectRecentFeedback(cutoff, 1000);
            predictionService.batchUpdateModel(feedbackList);
            stats.put("modelUpdated", true);
        }

        log.info("模拟反馈生成完成: created={}, onTimeRate={:.2%}", created,
                 (double) stats.get("onTimeRate"));
        return stats;
    }

    @Override
    @Transactional
    public Map<String, Object> clearSimulatedData() {
        log.info("开始清理模拟数据");

        Map<String, Object> stats = new LinkedHashMap<>();

        // 删除模拟订单
        LambdaQueryWrapper<DeliveryOrder> orderWrapper = new LambdaQueryWrapper<>();
        orderWrapper.eq(DeliveryOrder::getIsSimulated, true);
        int deletedOrders = orderMapper.delete(orderWrapper);

        // 删除模拟车辆
        LambdaQueryWrapper<DeliveryVehicle> vehicleWrapper = new LambdaQueryWrapper<>();
        vehicleWrapper.eq(DeliveryVehicle::getIsSimulated, true);
        int deletedVehicles = vehicleMapper.delete(vehicleWrapper);

        // 删除模拟反馈
        LambdaQueryWrapper<DeliveryFeedback> feedbackWrapper = new LambdaQueryWrapper<>();
        feedbackWrapper.eq(DeliveryFeedback::getIsSimulated, true);
        int deletedFeedback = feedbackMapper.delete(feedbackWrapper);

        stats.put("deletedOrders", deletedOrders);
        stats.put("deletedVehicles", deletedVehicles);
        stats.put("deletedFeedback", deletedFeedback);

        log.info("模拟数据清理完成: orders={}, vehicles={}, feedback={}",
                 deletedOrders, deletedVehicles, deletedFeedback);
        return stats;
    }

    @Override
    public Map<String, Object> getSimulationStats() {
        Map<String, Object> stats = new LinkedHashMap<>();

        stats.put("simulatedOrders", orderMapper.countSimulatedOrders());
        stats.put("simulatedVehicles", vehicleMapper.countSimulatedVehicles());
        stats.put("predictionModelStats", predictionService.getModelStats());

        return stats;
    }

    @Override
    @Transactional
    public Map<String, Object> runFullSimulation(int orderCount, int vehicleCount, int days) {
        log.info("开始完整模拟: orders={}, vehicles={}, days={}", orderCount, vehicleCount, days);
        long startTime = System.currentTimeMillis();

        Map<String, Object> result = new LinkedHashMap<>();

        // 1. 清理旧数据
        Map<String, Object> clearStats = clearSimulatedData();
        result.put("clearStats", clearStats);

        // 2. 生成车辆
        Map<String, Object> vehicleStats = generateSimulatedVehicles(vehicleCount);
        result.put("vehicleStats", vehicleStats);

        // 3. 生成订单
        Map<String, Object> orderStats = generateSimulatedOrders(orderCount, days);
        result.put("orderStats", orderStats);

        // 4. 执行调度
        DeliverySchedulingService.SchedulingResult schedulingResult =
            schedulingService.batchSchedule(LocalDate.now());
        result.put("schedulingResult", Map.of(
            "totalOrders", schedulingResult.getTotalOrders(),
            "scheduledOrders", schedulingResult.getScheduledOrders(),
            "unscheduledOrders", schedulingResult.getUnscheduledOrders()
        ));

        // 5. 生成反馈
        Map<String, Object> feedbackStats = generateSimulatedFeedback(days);
        result.put("feedbackStats", feedbackStats);

        result.put("totalElapsedMs", System.currentTimeMillis() - startTime);

        log.info("完整模拟完成: elapsed={}ms", result.get("totalElapsedMs"));
        return result;
    }

    // ==================== 私有方法 ====================

    private DeliveryOrder generateOrder(LocalDate date) {
        DeliveryOrder order = new DeliveryOrder();
        order.setOrderId("SIM_" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        order.setCustomerId("SIM_CUST_" + random.nextInt(1000));

        // 选择区域 (按权重)
        int districtIdx = selectByWeight(DISTRICT_WEIGHTS);
        order.setDistrict(DISTRICTS[districtIdx]);

        // 生成坐标 (区域中心 + 随机偏移)
        double[] center = DISTRICT_CENTERS[districtIdx];
        double lat = center[0] + (random.nextDouble() - 0.5) * 0.1;
        double lng = center[1] + (random.nextDouble() - 0.5) * 0.1;
        order.setLatitude(BigDecimal.valueOf(lat));
        order.setLongitude(BigDecimal.valueOf(lng));
        order.setDeliveryAddress(DISTRICTS[districtIdx] + "模拟地址" + random.nextInt(1000));

        // 时间窗口
        int startHour = random.nextDouble() < 0.4 ? 9 + random.nextInt(3) : 14 + random.nextInt(4);
        LocalDateTime expectedStart = date.atTime(startHour, 0);
        order.setExpectedStart(expectedStart);
        order.setExpectedEnd(expectedStart.plusHours(2 + random.nextInt(3)));

        // 优先级
        double priorityRoll = random.nextDouble();
        if (priorityRoll < 0.7) {
            order.setPriority(3);  // 普通 70%
        } else if (priorityRoll < 0.9) {
            order.setPriority(4);  // 加急 20%
        } else {
            order.setPriority(5);  // 特急 10%
        }

        // 货物属性
        double sizeRoll = random.nextDouble();
        if (sizeRoll < 0.6) {
            // 小件 60%
            order.setWeight(BigDecimal.valueOf(5 + random.nextDouble() * 20));
            order.setVolume(BigDecimal.valueOf(0.05 + random.nextDouble() * 0.2));
            order.setItemCount(1 + random.nextInt(5));
        } else if (sizeRoll < 0.9) {
            // 中件 30%
            order.setWeight(BigDecimal.valueOf(25 + random.nextDouble() * 75));
            order.setVolume(BigDecimal.valueOf(0.25 + random.nextDouble() * 0.75));
            order.setItemCount(5 + random.nextInt(15));
        } else {
            // 大件 10%
            order.setWeight(BigDecimal.valueOf(100 + random.nextDouble() * 200));
            order.setVolume(BigDecimal.valueOf(1 + random.nextDouble() * 3));
            order.setItemCount(10 + random.nextInt(30));
        }

        // 冷链需求 (10%)
        order.setRequiresCold(random.nextDouble() < 0.1);

        order.setStatus("pending");
        order.setIsSimulated(true);

        return order;
    }

    private DeliveryVehicle generateVehicle(int index) {
        DeliveryVehicle vehicle = new DeliveryVehicle();

        // 车辆类型 (small:40%, medium:35%, large:15%, cold_chain:10%)
        double typeRoll = random.nextDouble();
        int typeIdx;
        if (typeRoll < 0.4) typeIdx = 0;
        else if (typeRoll < 0.75) typeIdx = 1;
        else if (typeRoll < 0.9) typeIdx = 2;
        else typeIdx = 3;

        vehicle.setVehicleType(VEHICLE_TYPES[typeIdx]);
        vehicle.setMaxWeight(BigDecimal.valueOf(VEHICLE_SPECS[typeIdx][0]));
        vehicle.setMaxVolume(BigDecimal.valueOf(VEHICLE_SPECS[typeIdx][1]));

        // 车牌号
        String[] prefixes = {"沪A", "沪B", "沪C", "沪D"};
        vehicle.setPlateNumber(prefixes[random.nextInt(4)] +
                              String.format("%05d", random.nextInt(100000)));

        // 司机信息
        vehicle.setDriverId("SIM_DRV_" + index);
        vehicle.setDriverName("模拟司机" + index);
        vehicle.setDriverPhone("138" + String.format("%08d", random.nextInt(100000000)));
        vehicle.setDriverExperienceYears(1 + random.nextInt(15));
        vehicle.setDriverRating(BigDecimal.valueOf(3.5 + random.nextDouble() * 1.5));

        // 当前位置 (仓库附近)
        vehicle.setCurrentLat(BigDecimal.valueOf(31.23 + (random.nextDouble() - 0.5) * 0.05));
        vehicle.setCurrentLng(BigDecimal.valueOf(121.47 + (random.nextDouble() - 0.5) * 0.05));

        vehicle.setCurrentLoadWeight(BigDecimal.ZERO);
        vehicle.setCurrentLoadVolume(BigDecimal.ZERO);
        vehicle.setDailyOrderCount(0);
        vehicle.setOnTimeRate(BigDecimal.valueOf(0.80 + random.nextDouble() * 0.18));
        vehicle.setStatus("available");
        vehicle.setIsSimulated(true);

        return vehicle;
    }

    private DeliveryFeedback generateFeedback(DeliveryOrder order) {
        DeliveryFeedback feedback = new DeliveryFeedback();
        feedback.setOrderId(order.getId());
        feedback.setVehicleId(order.getVehicleId());

        // 计算距离
        double distance = featureService.calculateDistance(
            order.getLatitude() != null ? order.getLatitude().doubleValue() : 31.23,
            order.getLongitude() != null ? order.getLongitude().doubleValue() : 121.47,
            31.23, 121.47  // 仓库位置
        );
        feedback.setDistanceKm(BigDecimal.valueOf(distance));

        // 预测时长
        int predictedDuration = (int) (distance / 30.0 * 60) + 10;  // 30km/h + 10分钟装卸
        feedback.setPredictedDuration(predictedDuration);

        // 实际时长 (加入随机因素)
        double baseRate = 0.85;
        double distanceFactor = Math.exp(-distance / 20.0);
        double trafficFactor = getTrafficFactor();
        double weatherFactor = getWeatherFactor();

        double onTimeProb = baseRate * (0.5 + 0.5 * distanceFactor) * trafficFactor * weatherFactor;
        boolean isOnTime = random.nextDouble() < onTimeProb;

        int delay = 0;
        if (!isOnTime) {
            delay = 5 + random.nextInt(30);  // 5-35分钟延误
        }

        feedback.setActualDuration(predictedDuration + delay);
        feedback.setIsOnTime(isOnTime);
        feedback.setDelayMinutes(delay);

        if (delay > 0) {
            String[] reasons = {"交通拥堵", "客户不在", "地址不清", "天气原因", "车辆故障"};
            feedback.setDelayReason(reasons[random.nextInt(reasons.length)]);
        }

        // 天气和交通
        String[] weathers = {"晴", "多云", "小雨", "大雨"};
        feedback.setWeatherCondition(weathers[random.nextInt(4)]);
        String[] traffics = {"畅通", "缓行", "拥堵"};
        feedback.setTrafficLevel(traffics[random.nextInt(3)]);

        // 客户评分
        if (isOnTime) {
            feedback.setCustomerRating(4 + random.nextInt(2));  // 4-5
        } else if (delay < 15) {
            feedback.setCustomerRating(3 + random.nextInt(2));  // 3-4
        } else {
            feedback.setCustomerRating(1 + random.nextInt(3));  // 1-3
        }

        feedback.setIsSimulated(true);

        return feedback;
    }

    private int selectByWeight(double[] weights) {
        double sum = Arrays.stream(weights).sum();
        double roll = random.nextDouble() * sum;
        double cumulative = 0;
        for (int i = 0; i < weights.length; i++) {
            cumulative += weights[i];
            if (roll < cumulative) {
                return i;
            }
        }
        return weights.length - 1;
    }

    private double getTrafficFactor() {
        int hour = LocalDateTime.now().getHour();
        if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
            return 0.7;  // 高峰
        } else if (hour >= 22 || hour <= 6) {
            return 1.1;  // 低峰
        }
        return 1.0;  // 平峰
    }

    private double getWeatherFactor() {
        double roll = random.nextDouble();
        if (roll < 0.7) return 1.0;   // 晴/多云 70%
        if (roll < 0.9) return 0.85;  // 小雨 20%
        return 0.7;                    // 大雨 10%
    }
}

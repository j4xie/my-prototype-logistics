package com.joolun.mall.service.impl;

import com.joolun.mall.entity.DeliveryOrder;
import com.joolun.mall.entity.DeliveryVehicle;
import com.joolun.mall.mapper.DeliveryOrderMapper;
import com.joolun.mall.service.DeliveryFeatureService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.TimeUnit;

/**
 * 配送特征工程服务实现
 *
 * 构建160维特征向量用于配送时间预测和调度优化
 *
 * @author Delivery Scheduling V4.0
 * @since 2026-01-20
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DeliveryFeatureServiceImpl implements DeliveryFeatureService {

    private final DeliveryOrderMapper deliveryOrderMapper;
    private final StringRedisTemplate redisTemplate;

    // 仓库位置 (上海市中心)
    private static final double WAREHOUSE_LAT = 31.2304;
    private static final double WAREHOUSE_LNG = 121.4737;

    // 特征归一化参数
    private static final double MAX_DISTANCE = 50.0;  // 最大配送距离 km
    private static final double MAX_WEIGHT = 1000.0;  // 最大重量 kg
    private static final double MAX_VOLUME = 10.0;    // 最大体积 m³
    private static final double MAX_DRIVER_YEARS = 20; // 最大驾龄

    // 区域编码映射
    private static final Map<String, Integer> DISTRICT_CODES = new HashMap<>();
    static {
        DISTRICT_CODES.put("浦东新区", 1);
        DISTRICT_CODES.put("黄浦区", 2);
        DISTRICT_CODES.put("静安区", 3);
        DISTRICT_CODES.put("徐汇区", 4);
        DISTRICT_CODES.put("长宁区", 5);
        DISTRICT_CODES.put("普陀区", 6);
        DISTRICT_CODES.put("虹口区", 7);
        DISTRICT_CODES.put("杨浦区", 8);
        DISTRICT_CODES.put("闵行区", 9);
        DISTRICT_CODES.put("宝山区", 10);
        DISTRICT_CODES.put("嘉定区", 11);
        DISTRICT_CODES.put("松江区", 12);
        DISTRICT_CODES.put("青浦区", 13);
        DISTRICT_CODES.put("奉贤区", 14);
        DISTRICT_CODES.put("金山区", 15);
        DISTRICT_CODES.put("崇明区", 16);
    }

    // 车辆类型编码
    private static final Map<String, Integer> VEHICLE_TYPE_CODES = new HashMap<>();
    static {
        VEHICLE_TYPE_CODES.put("small", 1);
        VEHICLE_TYPE_CODES.put("medium", 2);
        VEHICLE_TYPE_CODES.put("large", 3);
        VEHICLE_TYPE_CODES.put("cold_chain", 4);
    }

    @Override
    public double[] buildOrderFeatureVector(DeliveryOrder order) {
        double[] features = new double[ORDER_FEATURE_DIM];
        Arrays.fill(features, 0);

        if (order == null) {
            return features;
        }

        try {
            int idx = 0;

            // [0-7]: 地理位置特征
            double lat = order.getLatitude() != null ? order.getLatitude().doubleValue() : WAREHOUSE_LAT;
            double lng = order.getLongitude() != null ? order.getLongitude().doubleValue() : WAREHOUSE_LNG;

            features[idx++] = normalizeLatitude(lat);                          // 0: 纬度归一化
            features[idx++] = normalizeLongitude(lng);                         // 1: 经度归一化
            features[idx++] = encodeDistrict(order.getDistrict());            // 2: 区域编码
            double distToWarehouse = calculateDistance(lat, lng, WAREHOUSE_LAT, WAREHOUSE_LNG);
            features[idx++] = Math.min(1.0, distToWarehouse / MAX_DISTANCE);  // 3: 距离仓库归一化
            features[idx++] = isDowntown(order.getDistrict()) ? 1.0 : 0.0;    // 4: 是否市中心
            features[idx++] = getAreaDensity(order.getDistrict());            // 5: 区域密度
            features[idx++] = Math.sin(2 * Math.PI * lat / 180);              // 6: 纬度周期性
            features[idx++] = Math.cos(2 * Math.PI * lng / 180);              // 7: 经度周期性

            // [8-15]: 时间窗口特征
            LocalDateTime expectedStart = order.getExpectedStart();
            LocalDateTime expectedEnd = order.getExpectedEnd();
            LocalDateTime now = LocalDateTime.now();

            features[idx++] = expectedStart != null ? normalizeHour(expectedStart.getHour()) : 0.5;  // 8: 开始时间归一化
            features[idx++] = expectedEnd != null ? normalizeHour(expectedEnd.getHour()) : 0.5;      // 9: 结束时间归一化

            double windowMinutes = 0;
            if (expectedStart != null && expectedEnd != null) {
                windowMinutes = ChronoUnit.MINUTES.between(expectedStart, expectedEnd);
            }
            features[idx++] = Math.min(1.0, windowMinutes / 480.0);           // 10: 窗口宽度 (8小时=1)

            double urgency = 0;
            if (expectedStart != null) {
                long minutesToStart = ChronoUnit.MINUTES.between(now, expectedStart);
                urgency = minutesToStart > 0 ? Math.exp(-minutesToStart / 120.0) : 1.0;  // 2小时衰减
            }
            features[idx++] = urgency;                                        // 11: 紧急度

            int priority = order.getPriority() != null ? order.getPriority() : 3;
            features[idx++] = priority / 5.0;                                 // 12: 优先级归一化
            features[idx++] = priority >= 4 ? 1.0 : 0.0;                     // 13: 是否高优先级
            features[idx++] = expectedStart != null && expectedStart.getHour() < 12 ? 1.0 : 0.0; // 14: 是否上午配送
            features[idx++] = windowMinutes < 120 ? 1.0 : 0.0;               // 15: 是否窄时间窗

            // [16-23]: 货物属性特征
            double weight = order.getWeight() != null ? order.getWeight().doubleValue() : 0;
            double volume = order.getVolume() != null ? order.getVolume().doubleValue() : 0;
            int itemCount = order.getItemCount() != null ? order.getItemCount() : 0;

            features[idx++] = Math.min(1.0, weight / MAX_WEIGHT);            // 16: 重量归一化
            features[idx++] = Math.min(1.0, volume / MAX_VOLUME);            // 17: 体积归一化
            features[idx++] = Math.min(1.0, itemCount / 100.0);              // 18: 件数归一化
            features[idx++] = Boolean.TRUE.equals(order.getRequiresCold()) ? 1.0 : 0.0; // 19: 冷链标记
            features[idx++] = weight > 100 ? 1.0 : 0.0;                      // 20: 是否大件
            features[idx++] = volume > 1.0 ? 1.0 : 0.0;                      // 21: 是否大体积
            features[idx++] = calculateWeightVolumeRatio(weight, volume);    // 22: 重量体积比
            features[idx++] = itemCount > 10 ? 1.0 : 0.0;                    // 23: 是否多件

            // [24-31]: 客户特征 (简化版，从历史数据获取)
            String customerId = order.getCustomerId();
            double[] customerFeatures = getCustomerFeatures(customerId);
            System.arraycopy(customerFeatures, 0, features, idx, 8);
            idx += 8;

            // [32-47]: 区域统计特征
            double[] areaFeatures = getAreaFeatures(order.getDistrict());
            System.arraycopy(areaFeatures, 0, features, idx, 16);
            idx += 16;

            // [48-63]: 时间特征
            double[] timeFeatures = buildTimeFeatures(now);
            System.arraycopy(timeFeatures, 0, features, idx, 16);

        } catch (Exception e) {
            log.warn("构建订单特征向量失败: {}", e.getMessage());
        }

        return features;
    }

    @Override
    public double[] buildVehicleFeatureVector(DeliveryVehicle vehicle) {
        double[] features = new double[VEHICLE_FEATURE_DIM];
        Arrays.fill(features, 0);

        if (vehicle == null) {
            return features;
        }

        try {
            int idx = 0;

            // [0-7]: 基础属性
            double maxWeight = vehicle.getMaxWeight() != null ? vehicle.getMaxWeight().doubleValue() : 500;
            double maxVolume = vehicle.getMaxVolume() != null ? vehicle.getMaxVolume().doubleValue() : 5;

            features[idx++] = Math.min(1.0, maxWeight / MAX_WEIGHT);         // 0: 最大载重归一化
            features[idx++] = Math.min(1.0, maxVolume / MAX_VOLUME);         // 1: 最大容积归一化
            features[idx++] = encodeVehicleType(vehicle.getVehicleType());   // 2: 车辆类型编码
            features[idx++] = "cold_chain".equals(vehicle.getVehicleType()) ? 1.0 : 0.0; // 3: 冷链车标记
            features[idx++] = maxWeight > 500 ? 1.0 : 0.0;                   // 4: 是否大型车
            features[idx++] = maxWeight < 200 ? 1.0 : 0.0;                   // 5: 是否小型车
            features[idx++] = Math.log(maxWeight + 1) / Math.log(MAX_WEIGHT); // 6: 载重对数归一化
            features[idx++] = Math.log(maxVolume + 1) / Math.log(MAX_VOLUME); // 7: 容积对数归一化

            // [8-15]: 当前状态
            double currentWeight = vehicle.getCurrentLoadWeight() != null ?
                vehicle.getCurrentLoadWeight().doubleValue() : 0;
            double currentVolume = vehicle.getCurrentLoadVolume() != null ?
                vehicle.getCurrentLoadVolume().doubleValue() : 0;

            features[idx++] = maxWeight > 0 ? currentWeight / maxWeight : 0;  // 8: 重量装载率
            features[idx++] = maxVolume > 0 ? currentVolume / maxVolume : 0;  // 9: 体积装载率
            features[idx++] = maxWeight > 0 ? (maxWeight - currentWeight) / maxWeight : 1.0; // 10: 剩余容量率

            double lat = vehicle.getCurrentLat() != null ? vehicle.getCurrentLat().doubleValue() : WAREHOUSE_LAT;
            double lng = vehicle.getCurrentLng() != null ? vehicle.getCurrentLng().doubleValue() : WAREHOUSE_LNG;
            features[idx++] = normalizeLatitude(lat);                        // 11: 当前纬度
            features[idx++] = normalizeLongitude(lng);                       // 12: 当前经度
            double distToWarehouse = calculateDistance(lat, lng, WAREHOUSE_LAT, WAREHOUSE_LNG);
            features[idx++] = Math.min(1.0, distToWarehouse / MAX_DISTANCE); // 13: 距离仓库
            features[idx++] = "available".equals(vehicle.getStatus()) ? 1.0 : 0.0; // 14: 是否可用
            features[idx++] = currentWeight == 0 && currentVolume == 0 ? 1.0 : 0.0; // 15: 是否空车

            // [16-23]: 司机特征
            int driverYears = vehicle.getDriverExperienceYears() != null ?
                vehicle.getDriverExperienceYears() : 0;
            double driverRating = vehicle.getDriverRating() != null ?
                vehicle.getDriverRating().doubleValue() : 4.0;

            features[idx++] = Math.min(1.0, driverYears / MAX_DRIVER_YEARS); // 16: 驾龄归一化
            features[idx++] = driverRating / 5.0;                            // 17: 评分归一化
            features[idx++] = driverYears >= 5 ? 1.0 : 0.0;                  // 18: 是否老司机
            features[idx++] = driverRating >= 4.5 ? 1.0 : 0.0;              // 19: 是否高评分
            features[idx++] = 0.5;                                           // 20: 熟悉区域编码 (简化)
            features[idx++] = 0.5;                                           // 21: 区域经验 (简化)
            features[idx++] = Math.log(driverYears + 1) / Math.log(MAX_DRIVER_YEARS); // 22: 驾龄对数
            features[idx++] = driverRating > 4.0 && driverYears > 3 ? 1.0 : 0.0; // 23: 优质司机

            // [24-31]: 历史表现
            double onTimeRate = vehicle.getOnTimeRate() != null ?
                vehicle.getOnTimeRate().doubleValue() : 0.85;
            int dailyOrders = vehicle.getDailyOrderCount() != null ?
                vehicle.getDailyOrderCount() : 0;

            features[idx++] = onTimeRate;                                    // 24: 准时率
            features[idx++] = Math.min(1.0, dailyOrders / 50.0);            // 25: 日单量归一化
            features[idx++] = driverRating;                                  // 26: 平均评分
            features[idx++] = onTimeRate >= 0.9 ? 1.0 : 0.0;                // 27: 是否高准时率
            features[idx++] = dailyOrders > 20 ? 1.0 : 0.0;                 // 28: 是否高单量
            features[idx++] = onTimeRate * driverRating / 5.0;              // 29: 综合表现分
            features[idx++] = Math.exp(-(1.0 - onTimeRate) * 10);           // 30: 准时率指数
            features[idx++] = dailyOrders < 10 ? 1.0 : 0.0;                 // 31: 是否低负载

            // [32-47]: 路线特征 (简化版)
            double[] routeFeatures = getVehicleRouteFeatures(vehicle.getId());
            System.arraycopy(routeFeatures, 0, features, idx, 16);
            idx += 16;

            // [48-63]: 实时状态 (简化版)
            double[] realtimeFeatures = getVehicleRealtimeFeatures(vehicle);
            System.arraycopy(realtimeFeatures, 0, features, idx, 16);

        } catch (Exception e) {
            log.warn("构建车辆特征向量失败: {}", e.getMessage());
        }

        return features;
    }

    @Override
    public double[] buildMatchFeatureVector(DeliveryOrder order, DeliveryVehicle vehicle) {
        double[] features = new double[CROSS_FEATURE_DIM];
        Arrays.fill(features, 0);

        if (order == null || vehicle == null) {
            return features;
        }

        try {
            int idx = 0;

            // 距离匹配
            double orderLat = order.getLatitude() != null ? order.getLatitude().doubleValue() : WAREHOUSE_LAT;
            double orderLng = order.getLongitude() != null ? order.getLongitude().doubleValue() : WAREHOUSE_LNG;
            double vehicleLat = vehicle.getCurrentLat() != null ? vehicle.getCurrentLat().doubleValue() : WAREHOUSE_LAT;
            double vehicleLng = vehicle.getCurrentLng() != null ? vehicle.getCurrentLng().doubleValue() : WAREHOUSE_LNG;

            double distance = calculateDistance(orderLat, orderLng, vehicleLat, vehicleLng);
            features[idx++] = Math.exp(-distance / 10.0);                    // 0: 距离衰减
            features[idx++] = Math.min(1.0, distance / MAX_DISTANCE);        // 1: 距离归一化
            features[idx++] = distance < 5 ? 1.0 : 0.0;                      // 2: 是否近距离
            features[idx++] = distance > 20 ? 1.0 : 0.0;                     // 3: 是否远距离

            // 容量匹配
            double orderWeight = order.getWeight() != null ? order.getWeight().doubleValue() : 0;
            double orderVolume = order.getVolume() != null ? order.getVolume().doubleValue() : 0;
            double remainWeight = vehicle.getMaxWeight() != null ?
                vehicle.getMaxWeight().doubleValue() -
                (vehicle.getCurrentLoadWeight() != null ? vehicle.getCurrentLoadWeight().doubleValue() : 0) : 500;
            double remainVolume = vehicle.getMaxVolume() != null ?
                vehicle.getMaxVolume().doubleValue() -
                (vehicle.getCurrentLoadVolume() != null ? vehicle.getCurrentLoadVolume().doubleValue() : 0) : 5;

            features[idx++] = remainWeight >= orderWeight ? 1.0 : 0.0;       // 4: 重量可容纳
            features[idx++] = remainVolume >= orderVolume ? 1.0 : 0.0;       // 5: 体积可容纳
            features[idx++] = remainWeight > 0 ? Math.min(1.0, orderWeight / remainWeight) : 0; // 6: 重量利用率
            features[idx++] = remainVolume > 0 ? Math.min(1.0, orderVolume / remainVolume) : 0; // 7: 体积利用率

            // 冷链匹配
            boolean requiresCold = Boolean.TRUE.equals(order.getRequiresCold());
            boolean isColdChain = "cold_chain".equals(vehicle.getVehicleType());
            features[idx++] = requiresCold && isColdChain ? 1.0 : 0.0;       // 8: 冷链匹配
            features[idx++] = requiresCold && !isColdChain ? 0.0 : 1.0;      // 9: 冷链满足
            features[idx++] = !requiresCold && isColdChain ? 0.5 : 1.0;      // 10: 冷链资源利用

            // 时间匹配
            LocalDateTime expectedStart = order.getExpectedStart();
            double estimatedArrival = distance / 30.0 * 60;  // 假设30km/h
            double timeMatch = 1.0;
            if (expectedStart != null) {
                LocalDateTime now = LocalDateTime.now();
                long minutesToStart = ChronoUnit.MINUTES.between(now, expectedStart);
                if (estimatedArrival > minutesToStart) {
                    timeMatch = Math.exp(-(estimatedArrival - minutesToStart) / 30.0);
                }
            }
            features[idx++] = timeMatch;                                     // 11: 时间窗口匹配度

            // 司机匹配
            double driverRating = vehicle.getDriverRating() != null ? vehicle.getDriverRating().doubleValue() : 4.0;
            int priority = order.getPriority() != null ? order.getPriority() : 3;
            features[idx++] = priority >= 4 && driverRating >= 4.5 ? 1.0 : 0.5; // 12: 优先级-司机匹配

            // 区域匹配 (简化)
            features[idx++] = 0.5;                                           // 13: 区域熟悉度
            features[idx++] = 0.5;                                           // 14: 顺路度

            // 工作量匹配
            int dailyOrders = vehicle.getDailyOrderCount() != null ? vehicle.getDailyOrderCount() : 0;
            features[idx++] = dailyOrders < 30 ? 1.0 : Math.max(0, 1.0 - (dailyOrders - 30) / 20.0); // 15: 工作量余量

            // 填充剩余特征
            for (int i = idx; i < CROSS_FEATURE_DIM; i++) {
                features[i] = 0.5;
            }

        } catch (Exception e) {
            log.warn("构建匹配特征向量失败: {}", e.getMessage());
        }

        return features;
    }

    @Override
    public double[] buildFullFeatureVector(DeliveryOrder order, DeliveryVehicle vehicle) {
        double[] orderFeatures = buildOrderFeatureVector(order);
        double[] vehicleFeatures = buildVehicleFeatureVector(vehicle);
        double[] matchFeatures = buildMatchFeatureVector(order, vehicle);

        double[] fullFeatures = new double[TOTAL_FEATURE_DIM];
        System.arraycopy(orderFeatures, 0, fullFeatures, 0, ORDER_FEATURE_DIM);
        System.arraycopy(vehicleFeatures, 0, fullFeatures, ORDER_FEATURE_DIM, VEHICLE_FEATURE_DIM);
        System.arraycopy(matchFeatures, 0, fullFeatures, ORDER_FEATURE_DIM + VEHICLE_FEATURE_DIM, CROSS_FEATURE_DIM);

        return fullFeatures;
    }

    @Override
    public double calculateDistance(double lat1, double lng1, double lat2, double lng2) {
        // Haversine公式
        final double R = 6371.0; // 地球半径 km

        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                   Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                   Math.sin(dLng / 2) * Math.sin(dLng / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    @Override
    public Map<String, Object> getFeatureStats() {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("orderFeatureDim", ORDER_FEATURE_DIM);
        stats.put("vehicleFeatureDim", VEHICLE_FEATURE_DIM);
        stats.put("crossFeatureDim", CROSS_FEATURE_DIM);
        stats.put("totalFeatureDim", TOTAL_FEATURE_DIM);
        stats.put("districtCount", DISTRICT_CODES.size());
        stats.put("vehicleTypeCount", VEHICLE_TYPE_CODES.size());
        return stats;
    }

    // ==================== 辅助方法 ====================

    private double normalizeLatitude(double lat) {
        // 上海纬度范围约 30.7 - 31.9
        return (lat - 30.7) / 1.2;
    }

    private double normalizeLongitude(double lng) {
        // 上海经度范围约 120.8 - 122.1
        return (lng - 120.8) / 1.3;
    }

    private double normalizeHour(int hour) {
        return hour / 24.0;
    }

    private double encodeDistrict(String district) {
        if (district == null) return 0;
        return DISTRICT_CODES.getOrDefault(district, 0) / 16.0;
    }

    private double encodeVehicleType(String type) {
        if (type == null) return 0;
        return VEHICLE_TYPE_CODES.getOrDefault(type, 1) / 4.0;
    }

    private boolean isDowntown(String district) {
        if (district == null) return false;
        return district.contains("黄浦") || district.contains("静安") ||
               district.contains("徐汇") || district.contains("长宁");
    }

    private double getAreaDensity(String district) {
        // 简化: 市中心密度高
        if (isDowntown(district)) return 0.9;
        if (district != null && (district.contains("浦东") || district.contains("闵行"))) return 0.7;
        return 0.5;
    }

    private double calculateWeightVolumeRatio(double weight, double volume) {
        if (volume <= 0) return 0.5;
        double ratio = weight / volume;  // 密度
        return Math.min(1.0, ratio / 1000.0);  // 1000 kg/m³ 归一化
    }

    private double[] getCustomerFeatures(String customerId) {
        double[] features = new double[8];
        Arrays.fill(features, 0.5);  // 默认中等值
        // TODO: 从历史数据获取客户特征
        return features;
    }

    private double[] getAreaFeatures(String district) {
        double[] features = new double[16];
        Arrays.fill(features, 0.5);
        if (district != null) {
            features[0] = getAreaDensity(district);
            features[1] = isDowntown(district) ? 0.8 : 0.4;  // 平均配送时长
        }
        return features;
    }

    private double[] buildTimeFeatures(LocalDateTime now) {
        double[] features = new double[16];

        int hour = now.getHour();
        int dayOfWeek = now.getDayOfWeek().getValue();
        int dayOfMonth = now.getDayOfMonth();
        int month = now.getMonthValue();

        features[0] = hour / 24.0;                              // 小时归一化
        features[1] = dayOfWeek / 7.0;                          // 星期归一化
        features[2] = dayOfMonth / 31.0;                        // 日期归一化
        features[3] = month / 12.0;                             // 月份归一化
        features[4] = (dayOfWeek >= 6) ? 1.0 : 0.0;            // 是否周末
        features[5] = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19) ? 1.0 : 0.0; // 高峰时段
        features[6] = (hour >= 12 && hour <= 14) || (hour >= 18 && hour <= 21) ? 1.0 : 0.0; // 活跃时段
        features[7] = (hour >= 0 && hour <= 6) ? 1.0 : 0.0;    // 深夜时段
        features[8] = Math.sin(2 * Math.PI * hour / 24);        // 小时周期sin
        features[9] = Math.cos(2 * Math.PI * hour / 24);        // 小时周期cos
        features[10] = Math.sin(2 * Math.PI * dayOfWeek / 7);   // 星期周期sin
        features[11] = Math.cos(2 * Math.PI * dayOfWeek / 7);   // 星期周期cos
        features[12] = dayOfMonth <= 5 ? 1.0 : 0.0;            // 月初
        features[13] = dayOfMonth >= 25 ? 1.0 : 0.0;           // 月末
        features[14] = dayOfWeek == 1 ? 1.0 : 0.0;             // 周一
        features[15] = dayOfWeek == 5 ? 1.0 : 0.0;             // 周五

        return features;
    }

    private double[] getVehicleRouteFeatures(String vehicleId) {
        double[] features = new double[16];
        Arrays.fill(features, 0.5);  // 默认值
        // TODO: 从当前路线获取特征
        return features;
    }

    private double[] getVehicleRealtimeFeatures(DeliveryVehicle vehicle) {
        double[] features = new double[16];
        Arrays.fill(features, 0.5);

        // 简化的实时状态特征
        if (vehicle != null) {
            int dailyOrders = vehicle.getDailyOrderCount() != null ? vehicle.getDailyOrderCount() : 0;
            features[0] = Math.min(1.0, dailyOrders / 50.0);  // 今日工作量
            features[1] = dailyOrders > 30 ? 0.7 : 1.0;       // 疲劳度估算
            features[2] = "available".equals(vehicle.getStatus()) ? 1.0 : 0.0;
        }

        return features;
    }
}

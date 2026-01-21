package com.joolun.mall.service.aps.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.joolun.mall.entity.aps.ChangeoverMatrix;
import com.joolun.mall.entity.aps.ProductionLine;
import com.joolun.mall.entity.aps.ProductionOrder;
import com.joolun.mall.mapper.aps.ChangeoverMatrixMapper;
import com.joolun.mall.mapper.aps.ProductionLineMapper;
import com.joolun.mall.service.aps.APSFeatureService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

/**
 * APS 特征工程服务实现
 * 复用配送调度的特征工程模式，为生产排程提供特征向量
 *
 * 特征维度设计 (128维):
 * - 订单特征 (48维): 产品属性、时间约束、资源需求、物料状态、数量特征、优先级特征
 * - 产线特征 (48维): 产能属性、当前状态、人员配置、产品兼容、维护状态、班次信息
 * - 交叉特征 (32维): 产能匹配、换型特征、人员匹配、时间匹配
 *
 * @author APS Scheduling V1.0
 * @since 2026-01-21
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class APSFeatureServiceImpl implements APSFeatureService {

    private final ChangeoverMatrixMapper changeoverMatrixMapper;
    private final ProductionLineMapper productionLineMapper;

    // 特征归一化参数
    private static final double MAX_QUANTITY = 10000.0;
    private static final double MAX_DURATION_HOURS = 24.0;
    private static final double MAX_CHANGEOVER_MINUTES = 120.0;
    private static final double MAX_CAPACITY = 1000.0;
    private static final double MAX_WORKERS = 20.0;
    private static final int DEFAULT_CHANGEOVER_MINUTES = 30;

    // 统计计数
    private final AtomicLong featureExtractionCount = new AtomicLong(0);
    private final AtomicLong changeoverQueryCount = new AtomicLong(0);

    // 产品类别编码缓存
    private final Map<String, Integer> categoryEncodingCache = new HashMap<>();
    private int categoryEncodingIndex = 0;

    @Override
    public double[] buildOrderFeatureVector(ProductionOrder order) {
        double[] features = new double[ORDER_FEATURE_DIM];
        Arrays.fill(features, 0);

        if (order == null) {
            return features;
        }

        try {
            // [0-7]: 产品属性 (类别编码、规格编码、复杂度)
            double[] productFeatures = extractProductAttributeFeatures(order);
            System.arraycopy(productFeatures, 0, features, 0, Math.min(productFeatures.length, 8));

            // [8-15]: 时间约束 (交期紧急度、时间窗口宽度、可跨天)
            double[] timeConstraintFeatures = extractTimeConstraintFeatures(order);
            System.arraycopy(timeConstraintFeatures, 0, features, 8, Math.min(timeConstraintFeatures.length, 8));

            // [16-23]: 资源需求 (技能等级、人员数、设备类型、模具)
            double[] resourceFeatures = extractResourceRequirementFeatures(order);
            System.arraycopy(resourceFeatures, 0, features, 16, Math.min(resourceFeatures.length, 8));

            // [24-31]: 物料状态 (齐套率、预计到达、缺料风险)
            double[] materialFeatures = extractMaterialStatusFeatures(order);
            System.arraycopy(materialFeatures, 0, features, 24, Math.min(materialFeatures.length, 8));

            // [32-39]: 数量特征 (数量级别、可拆分、可混批)
            double[] quantityFeatures = extractQuantityFeatures(order);
            System.arraycopy(quantityFeatures, 0, features, 32, Math.min(quantityFeatures.length, 8));

            // [40-47]: 优先级特征 (优先级、紧急标记、客户等级)
            double[] priorityFeatures = extractPriorityFeatures(order);
            System.arraycopy(priorityFeatures, 0, features, 40, Math.min(priorityFeatures.length, 8));

            featureExtractionCount.incrementAndGet();

        } catch (Exception e) {
            log.warn("构建订单特征向量失败: orderId={}, error={}", order.getId(), e.getMessage());
        }

        return normalizeFeatures(features);
    }

    @Override
    public double[] buildLineFeatureVector(ProductionLine line) {
        double[] features = new double[LINE_FEATURE_DIM];
        Arrays.fill(features, 0);

        if (line == null) {
            return features;
        }

        try {
            // [0-7]: 产能属性 (标准产能、最大产能、效率系数)
            double[] capacityFeatures = extractCapacityFeatures(line);
            System.arraycopy(capacityFeatures, 0, features, 0, Math.min(capacityFeatures.length, 8));

            // [8-15]: 当前状态 (运行状态、当前负载、预计空闲时间)
            double[] stateFeatures = extractCurrentStateFeatures(line);
            System.arraycopy(stateFeatures, 0, features, 8, Math.min(stateFeatures.length, 8));

            // [16-23]: 人员配置 (当前人数、可加人数、技能分布)
            double[] workerFeatures = extractWorkerConfigFeatures(line);
            System.arraycopy(workerFeatures, 0, features, 16, Math.min(workerFeatures.length, 8));

            // [24-31]: 产品兼容 (可生产类别、换型历史、当前类别)
            double[] compatibilityFeatures = extractProductCompatibilityFeatures(line);
            System.arraycopy(compatibilityFeatures, 0, features, 24, Math.min(compatibilityFeatures.length, 8));

            // [32-39]: 维护状态 (距下次维护、故障率、运行时长)
            double[] maintenanceFeatures = extractMaintenanceFeatures(line);
            System.arraycopy(maintenanceFeatures, 0, features, 32, Math.min(maintenanceFeatures.length, 8));

            // [40-47]: 班次信息 (当前班次、剩余工时、可加班)
            double[] shiftFeatures = extractShiftFeatures(line);
            System.arraycopy(shiftFeatures, 0, features, 40, Math.min(shiftFeatures.length, 8));

            featureExtractionCount.incrementAndGet();

        } catch (Exception e) {
            log.warn("构建产线特征向量失败: lineId={}, error={}", line.getId(), e.getMessage());
        }

        return normalizeFeatures(features);
    }

    @Override
    public double[] buildMatchFeatureVector(ProductionOrder order, ProductionLine line) {
        double[] features = new double[CROSS_FEATURE_DIM];
        Arrays.fill(features, 0);

        if (order == null || line == null) {
            return features;
        }

        try {
            // [0-7]: 产能匹配 (产能满足度、效率预估)
            double[] capacityMatchFeatures = extractCapacityMatchFeatures(order, line);
            System.arraycopy(capacityMatchFeatures, 0, features, 0, Math.min(capacityMatchFeatures.length, 8));

            // [8-15]: 换型特征 (换型时间、需清洁、需换模)
            double[] changeoverFeatures = extractChangeoverFeatures(order, line);
            System.arraycopy(changeoverFeatures, 0, features, 8, Math.min(changeoverFeatures.length, 8));

            // [16-23]: 人员匹配 (人员满足度、技能匹配度)
            double[] workerMatchFeatures = extractWorkerMatchFeatures(order, line);
            System.arraycopy(workerMatchFeatures, 0, features, 16, Math.min(workerMatchFeatures.length, 8));

            // [24-31]: 时间匹配 (交期满足度、空闲时间匹配)
            double[] timeMatchFeatures = extractTimeMatchFeatures(order, line);
            System.arraycopy(timeMatchFeatures, 0, features, 24, Math.min(timeMatchFeatures.length, 8));

            featureExtractionCount.incrementAndGet();

        } catch (Exception e) {
            log.warn("构建匹配特征向量失败: orderId={}, lineId={}, error={}",
                    order.getId(), line.getId(), e.getMessage());
        }

        return normalizeFeatures(features);
    }

    @Override
    public double[] buildFullFeatureVector(ProductionOrder order, ProductionLine line) {
        double[] fullFeatures = new double[TOTAL_FEATURE_DIM];
        Arrays.fill(fullFeatures, 0);

        // 订单特征 (0-47)
        double[] orderFeatures = buildOrderFeatureVector(order);
        System.arraycopy(orderFeatures, 0, fullFeatures, 0, ORDER_FEATURE_DIM);

        // 产线特征 (48-95)
        double[] lineFeatures = buildLineFeatureVector(line);
        System.arraycopy(lineFeatures, 0, fullFeatures, ORDER_FEATURE_DIM, LINE_FEATURE_DIM);

        // 交叉特征 (96-127)
        double[] matchFeatures = buildMatchFeatureVector(order, line);
        System.arraycopy(matchFeatures, 0, fullFeatures, ORDER_FEATURE_DIM + LINE_FEATURE_DIM, CROSS_FEATURE_DIM);

        return fullFeatures;
    }

    @Override
    public int estimateProductionDuration(ProductionOrder order, ProductionLine line) {
        if (order == null || line == null) {
            return 60; // 默认1小时
        }

        try {
            // 获取计划数量
            double plannedQty = order.getPlannedQty() != null ?
                    order.getPlannedQty().doubleValue() : 100;

            // 获取产线标准产能 (件/小时)
            double standardCapacity = line.getStandardCapacity() != null ?
                    line.getStandardCapacity().doubleValue() : 100;

            // 获取效率系数
            double efficiencyFactor = line.getEfficiencyFactor() != null ?
                    line.getEfficiencyFactor().doubleValue() : 1.0;

            // 考虑人员配置对效率的影响
            int currentWorkers = line.getCurrentWorkerCount() != null ? line.getCurrentWorkerCount() : 0;
            int standardWorkers = line.getStandardWorkerCount() != null ? line.getStandardWorkerCount() : 4;
            double workerEfficiency = currentWorkers > 0 ?
                    Math.min(1.2, (double) currentWorkers / standardWorkers) : 0.8;

            // 有效产能 = 标准产能 * 效率系数 * 人员效率
            double effectiveCapacity = standardCapacity * efficiencyFactor * workerEfficiency;
            if (effectiveCapacity <= 0) {
                effectiveCapacity = 50; // 保底
            }

            // 生产时长(分钟) = 数量 / 有效产能 * 60
            double durationHours = plannedQty / effectiveCapacity;
            int durationMinutes = (int) Math.ceil(durationHours * 60);

            // 添加前置和后置等待时间
            int preWait = order.getPreWaitTime() != null ? order.getPreWaitTime() : 0;
            int postWait = order.getPostWaitTime() != null ? order.getPostWaitTime() : 0;
            durationMinutes += preWait + postWait;

            // 限制在合理范围
            return Math.max(15, Math.min(durationMinutes, 24 * 60)); // 15分钟 ~ 24小时

        } catch (Exception e) {
            log.warn("估算生产时长失败: orderId={}, lineId={}, error={}",
                    order.getId(), line.getId(), e.getMessage());
            return 60;
        }
    }

    @Override
    public int calculateChangeoverTime(String fromCategory, String toCategory, String lineId) {
        changeoverQueryCount.incrementAndGet();

        // 同类别不需要换型
        if (fromCategory == null || toCategory == null) {
            return DEFAULT_CHANGEOVER_MINUTES;
        }
        if (fromCategory.equals(toCategory)) {
            return 0;
        }

        try {
            // 1. 尝试查询精确匹配 (指定产线)
            if (lineId != null) {
                ChangeoverMatrix matrix = changeoverMatrixMapper.selectOne(
                        new LambdaQueryWrapper<ChangeoverMatrix>()
                                .eq(ChangeoverMatrix::getLineId, lineId)
                                .eq(ChangeoverMatrix::getFromCategory, fromCategory)
                                .eq(ChangeoverMatrix::getToCategory, toCategory)
                                .isNull(ChangeoverMatrix::getDeletedAt)
                );
                if (matrix != null) {
                    return calculateTotalChangeoverTime(matrix);
                }
            }

            // 2. 尝试查询通用配置 (lineId为空)
            ChangeoverMatrix generalMatrix = changeoverMatrixMapper.selectOne(
                    new LambdaQueryWrapper<ChangeoverMatrix>()
                            .isNull(ChangeoverMatrix::getLineId)
                            .eq(ChangeoverMatrix::getFromCategory, fromCategory)
                            .eq(ChangeoverMatrix::getToCategory, toCategory)
                            .isNull(ChangeoverMatrix::getDeletedAt)
            );
            if (generalMatrix != null) {
                return calculateTotalChangeoverTime(generalMatrix);
            }

            // 3. 没有找到配置，返回默认值
            log.debug("未找到换型时间配置: from={}, to={}, lineId={}, 使用默认值={}",
                    fromCategory, toCategory, lineId, DEFAULT_CHANGEOVER_MINUTES);
            return DEFAULT_CHANGEOVER_MINUTES;

        } catch (Exception e) {
            log.warn("查询换型时间失败: from={}, to={}, lineId={}, error={}",
                    fromCategory, toCategory, lineId, e.getMessage());
            return DEFAULT_CHANGEOVER_MINUTES;
        }
    }

    @Override
    public Map<String, Object> getFeatureStats() {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("featureExtractionCount", featureExtractionCount.get());
        stats.put("changeoverQueryCount", changeoverQueryCount.get());
        stats.put("orderFeatureDim", ORDER_FEATURE_DIM);
        stats.put("lineFeatureDim", LINE_FEATURE_DIM);
        stats.put("crossFeatureDim", CROSS_FEATURE_DIM);
        stats.put("totalFeatureDim", TOTAL_FEATURE_DIM);
        stats.put("categoryEncodingCacheSize", categoryEncodingCache.size());
        stats.put("defaultChangeoverMinutes", DEFAULT_CHANGEOVER_MINUTES);
        return stats;
    }

    // ==================== 订单特征提取私有方法 ====================

    /**
     * 提取产品属性特征 (8维)
     * [0]: 类别编码 (归一化)
     * [1-4]: 类别one-hot (4个主要类别)
     * [5]: 规格复杂度
     * [6]: 是否有工艺路线
     * [7]: 工序数量归一化
     */
    private double[] extractProductAttributeFeatures(ProductionOrder order) {
        double[] features = new double[8];

        // 类别编码
        String category = order.getProductCategory();
        if (category != null) {
            int encoded = categoryEncodingCache.computeIfAbsent(category, k -> categoryEncodingIndex++);
            features[0] = Math.min(1.0, encoded / 20.0); // 假设最多20个类别

            // 简单的one-hot编码 (前4个常见类别)
            int catIndex = encoded % 4;
            if (catIndex < 4) {
                features[1 + catIndex] = 1.0;
            }
        }

        // 规格复杂度 (基于规格字符串长度)
        String spec = order.getProductSpec();
        features[5] = spec != null ? Math.min(1.0, spec.length() / 50.0) : 0;

        // 是否有工艺路线
        features[6] = order.getRoutingId() != null ? 1.0 : 0;

        // 工序数量
        Integer totalOps = order.getTotalOperations();
        features[7] = totalOps != null ? Math.min(1.0, totalOps / 10.0) : 0.3;

        return features;
    }

    /**
     * 提取时间约束特征 (8维)
     * [0]: 交期紧急度 (越小越紧急)
     * [1]: 时间窗口宽度
     * [2]: 是否可跨天
     * [3]: 距离最早开始时间
     * [4]: 是否已超期
     * [5]: 剩余可用时间
     * [6]: 时间紧迫程度指数
     * [7]: 计划vs交期富余度
     */
    private double[] extractTimeConstraintFeatures(ProductionOrder order) {
        double[] features = new double[8];
        LocalDateTime now = LocalDateTime.now();

        // 交期紧急度
        LocalDateTime deadline = order.getLatestEnd();
        if (deadline != null) {
            long hoursToDeadline = ChronoUnit.HOURS.between(now, deadline);
            features[0] = Math.max(0, Math.min(1.0, hoursToDeadline / (MAX_DURATION_HOURS * 7))); // 7天内归一化
            features[4] = hoursToDeadline < 0 ? 1.0 : 0; // 是否已超期
            features[6] = Math.exp(-Math.max(0, hoursToDeadline) / 48.0); // 时间紧迫程度指数
        }

        // 时间窗口宽度
        LocalDateTime earliest = order.getEarliestStart();
        if (earliest != null && deadline != null) {
            long windowHours = ChronoUnit.HOURS.between(earliest, deadline);
            features[1] = Math.min(1.0, windowHours / (MAX_DURATION_HOURS * 3)); // 3天归一化
        }

        // 是否可跨天
        features[2] = Boolean.TRUE.equals(order.getAllowCrossDay()) ? 1.0 : 0;

        // 距离最早开始时间
        if (earliest != null) {
            long hoursToStart = ChronoUnit.HOURS.between(now, earliest);
            features[3] = hoursToStart > 0 ? Math.min(1.0, hoursToStart / MAX_DURATION_HOURS) : 0;
        }

        // 剩余可用时间 (考虑标准工时)
        BigDecimal stdTime = order.getStandardTime();
        if (deadline != null && stdTime != null) {
            long availableMinutes = ChronoUnit.MINUTES.between(now, deadline);
            double requiredMinutes = stdTime.doubleValue();
            features[5] = Math.max(0, Math.min(1.0, (availableMinutes - requiredMinutes) / (480.0))); // 8小时富余
        }

        // 计划vs交期富余度
        if (order.getPlannedEnd() != null && deadline != null) {
            long margin = ChronoUnit.HOURS.between(order.getPlannedEnd(), deadline);
            features[7] = Math.max(0, Math.min(1.0, margin / MAX_DURATION_HOURS));
        }

        return features;
    }

    /**
     * 提取资源需求特征 (8维)
     * [0]: 技能等级要求 (归一化 1-5)
     * [1]: 人员数量要求
     * [2]: 是否指定设备
     * [3]: 是否需要模具
     * [4]: 是否已指定产线
     * [5]: 设备类型编码
     * [6]: 资源需求复杂度
     * [7]: 约束紧密度
     */
    private double[] extractResourceRequirementFeatures(ProductionOrder order) {
        double[] features = new double[8];

        // 技能等级
        Integer skillLevel = order.getRequiredSkillLevel();
        features[0] = skillLevel != null ? skillLevel / 5.0 : 0.5;

        // 人员数量
        Integer workerCount = order.getRequiredWorkerCount();
        features[1] = workerCount != null ? Math.min(1.0, workerCount / MAX_WORKERS) : 0.3;

        // 是否指定设备
        features[2] = order.getRequiredEquipmentType() != null ? 1.0 : 0;

        // 是否需要模具
        features[3] = order.getRequiredMoldId() != null ? 1.0 : 0;

        // 是否已指定产线
        features[4] = order.getAssignedLineId() != null ? 1.0 : 0;

        // 设备类型编码 (简单hash)
        String equipType = order.getRequiredEquipmentType();
        features[5] = equipType != null ? (Math.abs(equipType.hashCode()) % 100) / 100.0 : 0;

        // 资源需求复杂度 (综合评估)
        int constraintCount = 0;
        if (order.getRequiredEquipmentType() != null) constraintCount++;
        if (order.getRequiredMoldId() != null) constraintCount++;
        if (order.getAssignedLineId() != null) constraintCount++;
        if (skillLevel != null && skillLevel > 3) constraintCount++;
        features[6] = constraintCount / 4.0;

        // 约束紧密度
        features[7] = (features[2] + features[3] + features[4]) / 3.0;

        return features;
    }

    /**
     * 提取物料状态特征 (8维)
     * [0]: 物料齐套状态编码
     * [1]: 是否齐套
     * [2]: 是否部分齐套
     * [3]: 是否等待中
     * [4]: 预计到达时间距今
     * [5]: 缺料风险
     * [6]: 有BOM
     * [7]: 物料就绪度
     */
    private double[] extractMaterialStatusFeatures(ProductionOrder order) {
        double[] features = new double[8];

        String materialStatus = order.getMaterialStatus();
        if (materialStatus != null) {
            switch (materialStatus) {
                case "ready":
                    features[0] = 1.0;
                    features[1] = 1.0;
                    features[7] = 1.0;
                    break;
                case "partial":
                    features[0] = 0.5;
                    features[2] = 1.0;
                    features[5] = 0.3;
                    features[7] = 0.5;
                    break;
                case "waiting":
                    features[0] = 0.1;
                    features[3] = 1.0;
                    features[5] = 0.7;
                    features[7] = 0.1;
                    break;
                default:
                    features[0] = 0.3;
                    features[5] = 0.5;
                    features[7] = 0.3;
            }
        }

        // 预计到达时间
        LocalDateTime arrivalTime = order.getMaterialArrivalTime();
        if (arrivalTime != null) {
            long hoursToArrival = ChronoUnit.HOURS.between(LocalDateTime.now(), arrivalTime);
            features[4] = hoursToArrival > 0 ?
                    Math.min(1.0, hoursToArrival / MAX_DURATION_HOURS) : 0;
            // 如果已经过了预计到达时间但还没ready，增加风险
            if (hoursToArrival < 0 && !"ready".equals(materialStatus)) {
                features[5] = Math.min(1.0, features[5] + 0.3);
            }
        }

        // 有BOM
        features[6] = order.getBomId() != null ? 1.0 : 0;

        return features;
    }

    /**
     * 提取数量特征 (8维)
     * [0]: 数量归一化
     * [1]: 数量级别 (小/中/大)
     * [2]: 是否可拆分
     * [3]: 是否可混批
     * [4]: 已完成比例
     * [5]: 剩余数量
     * [6]: 是否大批量
     * [7]: 是否小批量
     */
    private double[] extractQuantityFeatures(ProductionOrder order) {
        double[] features = new double[8];

        BigDecimal plannedQty = order.getPlannedQty();
        BigDecimal completedQty = order.getCompletedQty();

        if (plannedQty != null) {
            double qty = plannedQty.doubleValue();
            features[0] = Math.min(1.0, qty / MAX_QUANTITY);

            // 数量级别
            if (qty < 100) {
                features[1] = 0.2;
                features[7] = 1.0; // 小批量
            } else if (qty < 500) {
                features[1] = 0.5;
            } else {
                features[1] = 0.8;
                features[6] = 1.0; // 大批量
            }

            // 已完成比例
            if (completedQty != null && qty > 0) {
                features[4] = completedQty.doubleValue() / qty;
                features[5] = Math.min(1.0, (qty - completedQty.doubleValue()) / MAX_QUANTITY);
            } else {
                features[5] = features[0];
            }
        }

        // 是否可拆分
        features[2] = Boolean.TRUE.equals(order.getAllowSplit()) ? 1.0 : 0;

        // 是否可混批
        features[3] = Boolean.TRUE.equals(order.getAllowMixBatch()) ? 1.0 : 0;

        return features;
    }

    /**
     * 提取优先级特征 (8维)
     * [0]: 优先级归一化 (1-10)
     * [1]: 是否紧急
     * [2]: 是否高优先级 (>=8)
     * [3]: 是否低优先级 (<=3)
     * [4]: 优先级权重
     * [5]: 紧急程度综合
     * [6]: 是否模拟数据
     * [7]: 状态编码
     */
    private double[] extractPriorityFeatures(ProductionOrder order) {
        double[] features = new double[8];

        Integer priority = order.getPriority();
        if (priority != null) {
            features[0] = priority / 10.0;
            features[2] = priority >= 8 ? 1.0 : 0;
            features[3] = priority <= 3 ? 1.0 : 0;
            features[4] = Math.pow(priority / 10.0, 2); // 非线性权重
        } else {
            features[0] = 0.5;
        }

        // 是否紧急
        features[1] = Boolean.TRUE.equals(order.getIsUrgent()) ? 1.0 : 0;

        // 紧急程度综合
        features[5] = (features[0] + features[1] * 0.5) / 1.5;

        // 是否模拟数据
        features[6] = Boolean.TRUE.equals(order.getIsSimulated()) ? 1.0 : 0;

        // 状态编码
        String status = order.getStatus();
        if (status != null) {
            switch (status) {
                case "pending":
                    features[7] = 0.2;
                    break;
                case "scheduled":
                    features[7] = 0.4;
                    break;
                case "in_progress":
                    features[7] = 0.6;
                    break;
                case "completed":
                    features[7] = 1.0;
                    break;
                default:
                    features[7] = 0.1;
            }
        }

        return features;
    }

    // ==================== 产线特征提取私有方法 ====================

    /**
     * 提取产能属性特征 (8维)
     * [0]: 标准产能归一化
     * [1]: 最大产能归一化
     * [2]: 效率系数
     * [3]: 产能利用率潜力
     * [4]: 产能弹性
     * [5]: 产线类型编码
     * [6]: 是否高产能产线
     * [7]: 产能稳定性
     */
    private double[] extractCapacityFeatures(ProductionLine line) {
        double[] features = new double[8];

        BigDecimal stdCapacity = line.getStandardCapacity();
        BigDecimal maxCapacity = line.getMaxCapacity();
        BigDecimal effFactor = line.getEfficiencyFactor();

        // 标准产能
        if (stdCapacity != null) {
            features[0] = Math.min(1.0, stdCapacity.doubleValue() / MAX_CAPACITY);
            features[6] = stdCapacity.doubleValue() > 500 ? 1.0 : 0;
        }

        // 最大产能
        if (maxCapacity != null) {
            features[1] = Math.min(1.0, maxCapacity.doubleValue() / MAX_CAPACITY);
        }

        // 效率系数
        if (effFactor != null) {
            features[2] = (effFactor.doubleValue() - 0.5) / 1.0; // 归一化到0-1 (假设0.5-1.5)
        } else {
            features[2] = 0.5;
        }

        // 产能利用率潜力
        if (stdCapacity != null && maxCapacity != null && stdCapacity.doubleValue() > 0) {
            features[3] = (maxCapacity.doubleValue() - stdCapacity.doubleValue()) /
                    stdCapacity.doubleValue();
        }

        // 产能弹性
        features[4] = features[1] - features[0];

        // 产线类型编码
        String lineType = line.getLineType();
        if (lineType != null) {
            switch (lineType) {
                case "assembly":
                    features[5] = 0.25;
                    break;
                case "packaging":
                    features[5] = 0.5;
                    break;
                case "processing":
                    features[5] = 0.75;
                    break;
                case "mixing":
                    features[5] = 1.0;
                    break;
                default:
                    features[5] = 0.1;
            }
        }

        // 产能稳定性 (效率系数接近1越稳定)
        features[7] = effFactor != null ?
                1.0 - Math.abs(effFactor.doubleValue() - 1.0) : 0.5;

        return features;
    }

    /**
     * 提取当前状态特征 (8维)
     * [0]: 运行状态编码
     * [1]: 是否可用
     * [2]: 是否运行中
     * [3]: 当前负载 (今日产出)
     * [4]: 预计空闲时间距今
     * [5]: 是否即将空闲
     * [6]: 当前产品类别编码
     * [7]: 状态健康度
     */
    private double[] extractCurrentStateFeatures(ProductionLine line) {
        double[] features = new double[8];

        String status = line.getStatus();
        if (status != null) {
            switch (status) {
                case "available":
                    features[0] = 1.0;
                    features[1] = 1.0;
                    features[7] = 1.0;
                    break;
                case "running":
                    features[0] = 0.8;
                    features[1] = 1.0;
                    features[2] = 1.0;
                    features[7] = 0.9;
                    break;
                case "maintenance":
                    features[0] = 0.3;
                    features[7] = 0.5;
                    break;
                case "offline":
                    features[0] = 0;
                    features[7] = 0;
                    break;
                default:
                    features[0] = 0.5;
                    features[7] = 0.5;
            }
        }

        // 今日产出
        BigDecimal todayOutput = line.getTodayOutput();
        if (todayOutput != null) {
            features[3] = Math.min(1.0, todayOutput.doubleValue() / MAX_QUANTITY);
        }

        // 预计空闲时间
        LocalDateTime freeTime = line.getEstimatedFreeTime();
        if (freeTime != null) {
            long minutesToFree = ChronoUnit.MINUTES.between(LocalDateTime.now(), freeTime);
            if (minutesToFree <= 0) {
                features[4] = 1.0; // 已空闲
                features[5] = 1.0;
            } else {
                features[4] = Math.max(0, 1.0 - minutesToFree / (8.0 * 60)); // 8小时内归一化
                features[5] = minutesToFree <= 60 ? 1.0 : 0; // 1小时内即将空闲
            }
        }

        // 当前产品类别编码
        String currentCategory = line.getCurrentProductCategory();
        if (currentCategory != null) {
            int encoded = categoryEncodingCache.computeIfAbsent(currentCategory, k -> categoryEncodingIndex++);
            features[6] = Math.min(1.0, encoded / 20.0);
        }

        return features;
    }

    /**
     * 提取人员配置特征 (8维)
     * [0]: 当前人数归一化
     * [1]: 标准人数归一化
     * [2]: 人员配置率
     * [3]: 可增加人数
     * [4]: 是否人员不足
     * [5]: 是否人员充足
     * [6]: 人员弹性
     * [7]: 人员效率系数
     */
    private double[] extractWorkerConfigFeatures(ProductionLine line) {
        double[] features = new double[8];

        Integer currentWorkers = line.getCurrentWorkerCount();
        Integer stdWorkers = line.getStandardWorkerCount();
        Integer minWorkers = line.getMinWorkerCount();
        Integer maxWorkers = line.getMaxWorkerCount();

        // 当前人数
        if (currentWorkers != null) {
            features[0] = Math.min(1.0, currentWorkers / MAX_WORKERS);
        }

        // 标准人数
        if (stdWorkers != null) {
            features[1] = Math.min(1.0, stdWorkers / MAX_WORKERS);
        }

        // 人员配置率
        if (currentWorkers != null && stdWorkers != null && stdWorkers > 0) {
            features[2] = Math.min(1.5, (double) currentWorkers / stdWorkers);
            features[4] = currentWorkers < minWorkers ? 1.0 : 0;
            features[5] = currentWorkers >= stdWorkers ? 1.0 : 0;
        }

        // 可增加人数
        if (currentWorkers != null && maxWorkers != null) {
            features[3] = Math.min(1.0, (maxWorkers - currentWorkers) / MAX_WORKERS);
        }

        // 人员弹性
        if (minWorkers != null && maxWorkers != null && minWorkers > 0) {
            features[6] = (double) (maxWorkers - minWorkers) / maxWorkers;
        }

        // 人员效率系数
        features[7] = features[2] > 0 ? Math.min(1.2, features[2]) : 0.5;

        return features;
    }

    /**
     * 提取产品兼容特征 (8维)
     * [0]: 可生产类别数量
     * [1]: 是否多功能产线
     * [2]: 是否专用产线
     * [3]: 当前类别与历史匹配度
     * [4]: 类别切换频率
     * [5]: 兼容性评分
     * [6]: 是否有当前订单
     * [7]: 产线专业度
     */
    private double[] extractProductCompatibilityFeatures(ProductionLine line) {
        double[] features = new double[8];

        String categories = line.getProductCategories();
        if (categories != null && !categories.isEmpty()) {
            String[] catArray = categories.split(",");
            int catCount = catArray.length;

            features[0] = Math.min(1.0, catCount / 10.0); // 假设最多10个类别
            features[1] = catCount >= 3 ? 1.0 : 0; // 多功能
            features[2] = catCount == 1 ? 1.0 : 0; // 专用
            features[5] = catCount > 0 ? 1.0 / catCount : 0; // 兼容性 (越专注越高)
            features[7] = 1.0 - features[0]; // 专业度
        }

        // 是否有当前订单
        features[6] = line.getCurrentOrderId() != null ? 1.0 : 0;

        return features;
    }

    /**
     * 提取维护状态特征 (8维)
     * [0]: 距下次维护时间
     * [1]: 维护周期归一化
     * [2]: 自上次维护运行时长
     * [3]: 维护需求紧迫度
     * [4]: 是否即将维护
     * [5]: 设备健康度
     * [6]: 运行时长占比
     * [7]: 维护风险
     */
    private double[] extractMaintenanceFeatures(ProductionLine line) {
        double[] features = new double[8];

        // 下次维护时间
        LocalDateTime nextMaint = line.getNextMaintenanceTime();
        if (nextMaint != null) {
            long hoursToMaint = ChronoUnit.HOURS.between(LocalDateTime.now(), nextMaint);
            features[0] = hoursToMaint > 0 ?
                    Math.min(1.0, hoursToMaint / (24.0 * 7)) : 0; // 一周内归一化
            features[4] = hoursToMaint <= 24 ? 1.0 : 0; // 24小时内需要维护
            features[3] = hoursToMaint > 0 ? Math.exp(-hoursToMaint / 48.0) : 1.0;
        }

        // 维护周期
        Integer maintCycle = line.getMaintenanceCycleHours();
        if (maintCycle != null) {
            features[1] = Math.min(1.0, maintCycle / (24.0 * 30)); // 一个月归一化
        }

        // 自上次维护运行时长
        BigDecimal runningHours = line.getRunningHoursSinceMaintenance();
        if (runningHours != null && maintCycle != null && maintCycle > 0) {
            features[2] = Math.min(1.0, runningHours.doubleValue() / maintCycle);
            features[6] = features[2];
            features[7] = features[2] > 0.8 ? 0.8 : features[2] * 0.5; // 维护风险
        }

        // 设备健康度
        features[5] = 1.0 - features[7];

        return features;
    }

    /**
     * 提取班次信息特征 (8维)
     * [0]: 班次模式编码
     * [1]: 当前班次进度
     * [2]: 剩余工时
     * [3]: 是否可加班
     * [4]: 是否早班
     * [5]: 是否夜班
     * [6]: 班次效率
     * [7]: 时间利用率
     */
    private double[] extractShiftFeatures(ProductionLine line) {
        double[] features = new double[8];
        LocalTime now = LocalTime.now();

        // 班次模式
        String shiftMode = line.getShiftMode();
        if (shiftMode != null) {
            switch (shiftMode) {
                case "single":
                    features[0] = 0.33;
                    features[3] = 1.0; // 单班次更可能加班
                    break;
                case "double":
                    features[0] = 0.66;
                    features[3] = 0.5;
                    break;
                case "triple":
                    features[0] = 1.0;
                    features[3] = 0.2;
                    break;
                default:
                    features[0] = 0.33;
            }
        }

        // 判断当前班次
        LocalTime shift1Start = line.getShift1Start();
        LocalTime shift1End = line.getShift1End();
        LocalTime shift2Start = line.getShift2Start();
        LocalTime shift2End = line.getShift2End();

        if (shift1Start != null && shift1End != null) {
            if (now.isAfter(shift1Start) && now.isBefore(shift1End)) {
                features[4] = 1.0; // 早班
                // 计算班次进度
                long totalMinutes = ChronoUnit.MINUTES.between(shift1Start, shift1End);
                long elapsed = ChronoUnit.MINUTES.between(shift1Start, now);
                features[1] = totalMinutes > 0 ? (double) elapsed / totalMinutes : 0;
                features[2] = 1.0 - features[1];
                features[6] = 1.0; // 早班效率最高
            }
        }

        if (shift2Start != null && shift2End != null) {
            if (now.isAfter(shift2Start) && now.isBefore(shift2End)) {
                features[5] = 1.0; // 中/夜班
                long totalMinutes = ChronoUnit.MINUTES.between(shift2Start, shift2End);
                long elapsed = ChronoUnit.MINUTES.between(shift2Start, now);
                features[1] = totalMinutes > 0 ? (double) elapsed / totalMinutes : 0;
                features[2] = 1.0 - features[1];
                features[6] = 0.9; // 夜班效率稍低
            }
        }

        // 时间利用率
        features[7] = features[1] * features[6];

        return features;
    }

    // ==================== 交叉特征提取私有方法 ====================

    /**
     * 提取产能匹配特征 (8维)
     * [0]: 产能满足度
     * [1]: 效率预估
     * [2]: 生产时长适配度
     * [3]: 产能利用率
     * [4]: 是否产能充足
     * [5]: 是否产能紧张
     * [6]: 产能匹配分数
     * [7]: 负载均衡度
     */
    private double[] extractCapacityMatchFeatures(ProductionOrder order, ProductionLine line) {
        double[] features = new double[8];

        BigDecimal plannedQty = order.getPlannedQty();
        BigDecimal stdCapacity = line.getStandardCapacity();

        if (plannedQty != null && stdCapacity != null && stdCapacity.doubleValue() > 0) {
            double qty = plannedQty.doubleValue();
            double capacity = stdCapacity.doubleValue();

            // 生产所需小时数
            double hoursNeeded = qty / capacity;

            // 产能满足度 (8小时内完成为满分)
            features[0] = hoursNeeded <= 8 ? 1.0 : Math.exp(-(hoursNeeded - 8) / 4.0);

            // 生产时长适配度
            features[2] = hoursNeeded >= 2 && hoursNeeded <= 8 ? 1.0 : 0.5;

            // 产能利用率
            features[3] = Math.min(1.0, hoursNeeded / 8.0);

            // 是否产能充足/紧张
            features[4] = hoursNeeded <= 4 ? 1.0 : 0;
            features[5] = hoursNeeded > 8 ? 1.0 : 0;

            // 产能匹配分数 (越接近标准8小时越好)
            features[6] = 1.0 - Math.abs(hoursNeeded - 6) / 6.0;
        }

        // 效率预估 (结合效率系数和人员配置)
        BigDecimal effFactor = line.getEfficiencyFactor();
        Integer currentWorkers = line.getCurrentWorkerCount();
        Integer stdWorkers = line.getStandardWorkerCount();

        double efficiency = effFactor != null ? effFactor.doubleValue() : 1.0;
        if (currentWorkers != null && stdWorkers != null && stdWorkers > 0) {
            efficiency *= Math.min(1.2, (double) currentWorkers / stdWorkers);
        }
        features[1] = Math.min(1.0, efficiency);

        // 负载均衡度
        features[7] = features[3] > 0.3 && features[3] < 0.8 ? 1.0 : 0.5;

        return features;
    }

    /**
     * 提取换型特征 (8维)
     * [0]: 换型时间归一化
     * [1]: 是否需要换型
     * [2]: 换型时间短
     * [3]: 换型时间长
     * [4]: 需要清洁
     * [5]: 需要换模
     * [6]: 换型成本
     * [7]: 换型效率
     */
    private double[] extractChangeoverFeatures(ProductionOrder order, ProductionLine line) {
        double[] features = new double[8];

        String fromCategory = line.getCurrentProductCategory();
        String toCategory = order.getProductCategory();

        int changeoverTime = calculateChangeoverTime(fromCategory, toCategory, line.getId());

        // 换型时间归一化
        features[0] = Math.min(1.0, changeoverTime / MAX_CHANGEOVER_MINUTES);

        // 是否需要换型
        features[1] = changeoverTime > 0 ? 1.0 : 0;

        // 换型时间等级
        features[2] = changeoverTime <= 15 ? 1.0 : 0; // 短
        features[3] = changeoverTime >= 60 ? 1.0 : 0; // 长

        // 查询换型矩阵获取详细信息
        if (fromCategory != null && toCategory != null && !fromCategory.equals(toCategory)) {
            try {
                ChangeoverMatrix matrix = changeoverMatrixMapper.selectOne(
                        new LambdaQueryWrapper<ChangeoverMatrix>()
                                .eq(ChangeoverMatrix::getFromCategory, fromCategory)
                                .eq(ChangeoverMatrix::getToCategory, toCategory)
                                .and(w -> w.eq(ChangeoverMatrix::getLineId, line.getId())
                                        .or().isNull(ChangeoverMatrix::getLineId))
                                .isNull(ChangeoverMatrix::getDeletedAt)
                                .last("LIMIT 1")
                );

                if (matrix != null) {
                    features[4] = Boolean.TRUE.equals(matrix.getRequiresCleaning()) ? 1.0 : 0;
                    features[5] = Boolean.TRUE.equals(matrix.getRequiresMoldChange()) ? 1.0 : 0;
                    features[6] = matrix.getChangeoverCost() != null ?
                            Math.min(1.0, matrix.getChangeoverCost() / 1000.0) : 0;
                }
            } catch (Exception e) {
                log.debug("查询换型矩阵详情失败: {}", e.getMessage());
            }
        }

        // 换型效率 (换型时间越短效率越高)
        features[7] = 1.0 - features[0];

        return features;
    }

    /**
     * 提取人员匹配特征 (8维)
     * [0]: 人员满足度
     * [1]: 技能匹配度
     * [2]: 是否人员充足
     * [3]: 人员缺口
     * [4]: 技能超配
     * [5]: 技能不足
     * [6]: 人员适配分数
     * [7]: 综合人员匹配度
     */
    private double[] extractWorkerMatchFeatures(ProductionOrder order, ProductionLine line) {
        double[] features = new double[8];

        Integer requiredWorkers = order.getRequiredWorkerCount();
        Integer currentWorkers = line.getCurrentWorkerCount();
        Integer requiredSkill = order.getRequiredSkillLevel();

        // 人员满足度
        if (requiredWorkers != null && currentWorkers != null) {
            if (requiredWorkers > 0) {
                features[0] = Math.min(1.0, (double) currentWorkers / requiredWorkers);
            } else {
                features[0] = 1.0;
            }
            features[2] = currentWorkers >= requiredWorkers ? 1.0 : 0;
            features[3] = requiredWorkers > currentWorkers ?
                    Math.min(1.0, (requiredWorkers - currentWorkers) / MAX_WORKERS) : 0;
        } else {
            features[0] = 0.8; // 默认值
        }

        // 技能匹配度 (假设产线有平均技能等级)
        if (requiredSkill != null) {
            // 简单假设: 产线有足够技能人员
            features[1] = requiredSkill <= 3 ? 1.0 : 0.7;
            features[4] = requiredSkill <= 2 ? 1.0 : 0;
            features[5] = requiredSkill >= 4 ? 0.5 : 0;
        } else {
            features[1] = 0.8;
        }

        // 人员适配分数
        features[6] = (features[0] + features[1]) / 2;

        // 综合人员匹配度
        features[7] = features[6] * (1 - features[3] * 0.5);

        return features;
    }

    /**
     * 提取时间匹配特征 (8维)
     * [0]: 交期满足度
     * [1]: 空闲时间匹配
     * [2]: 可按时完成
     * [3]: 延期风险
     * [4]: 时间富余
     * [5]: 时间紧迫
     * [6]: 时间窗口匹配度
     * [7]: 综合时间匹配度
     */
    private double[] extractTimeMatchFeatures(ProductionOrder order, ProductionLine line) {
        double[] features = new double[8];
        LocalDateTime now = LocalDateTime.now();

        // 预估生产时长
        int durationMinutes = estimateProductionDuration(order, line);

        // 换型时间
        int changeoverMinutes = calculateChangeoverTime(
                line.getCurrentProductCategory(),
                order.getProductCategory(),
                line.getId()
        );

        // 产线空闲时间
        LocalDateTime freeTime = line.getEstimatedFreeTime();
        LocalDateTime startTime = freeTime != null && freeTime.isAfter(now) ? freeTime : now;
        startTime = startTime.plusMinutes(changeoverMinutes);

        // 预计完成时间
        LocalDateTime expectedEnd = startTime.plusMinutes(durationMinutes);

        // 交期
        LocalDateTime deadline = order.getLatestEnd();

        if (deadline != null) {
            long minutesToDeadline = ChronoUnit.MINUTES.between(now, deadline);
            long minutesNeeded = ChronoUnit.MINUTES.between(now, expectedEnd);

            // 交期满足度
            if (expectedEnd.isBefore(deadline) || expectedEnd.equals(deadline)) {
                features[0] = 1.0;
                features[2] = 1.0;
                long margin = ChronoUnit.MINUTES.between(expectedEnd, deadline);
                features[4] = Math.min(1.0, margin / (8.0 * 60)); // 8小时内的富余
            } else {
                long delay = ChronoUnit.MINUTES.between(deadline, expectedEnd);
                features[0] = Math.max(0, 1.0 - delay / (4.0 * 60)); // 4小时延误为0分
                features[3] = Math.min(1.0, delay / (8.0 * 60)); // 延期风险
            }

            // 时间紧迫
            features[5] = minutesToDeadline < minutesNeeded * 1.2 ? 1.0 : 0;
        }

        // 空闲时间匹配
        if (freeTime != null) {
            long waitMinutes = ChronoUnit.MINUTES.between(now, freeTime);
            if (waitMinutes <= 0) {
                features[1] = 1.0; // 立即可用
            } else {
                features[1] = Math.max(0, 1.0 - waitMinutes / (4.0 * 60)); // 4小时等待为0分
            }
        } else {
            features[1] = 1.0; // 假设可用
        }

        // 时间窗口匹配度
        LocalDateTime earliest = order.getEarliestStart();
        if (earliest != null) {
            if (startTime.isAfter(earliest) || startTime.equals(earliest)) {
                features[6] = 1.0;
            } else {
                long tooEarly = ChronoUnit.MINUTES.between(startTime, earliest);
                features[6] = Math.max(0, 1.0 - tooEarly / (60.0)); // 1小时过早为0
            }
        } else {
            features[6] = 1.0;
        }

        // 综合时间匹配度
        features[7] = (features[0] * 0.4 + features[1] * 0.3 + features[6] * 0.3);

        return features;
    }

    // ==================== 工具方法 ====================

    /**
     * 计算换型总时间 (包括清洁、换模、调试)
     */
    private int calculateTotalChangeoverTime(ChangeoverMatrix matrix) {
        int total = matrix.getChangeoverMinutes() != null ? matrix.getChangeoverMinutes() : 0;

        if (Boolean.TRUE.equals(matrix.getRequiresCleaning()) && matrix.getCleaningMinutes() != null) {
            total += matrix.getCleaningMinutes();
        }

        if (Boolean.TRUE.equals(matrix.getRequiresMoldChange()) && matrix.getMoldChangeMinutes() != null) {
            total += matrix.getMoldChangeMinutes();
        }

        if (Boolean.TRUE.equals(matrix.getRequiresCalibration()) && matrix.getCalibrationMinutes() != null) {
            total += matrix.getCalibrationMinutes();
        }

        return total;
    }

    /**
     * 归一化特征向量
     */
    private double[] normalizeFeatures(double[] features) {
        if (features == null || features.length == 0) {
            return features;
        }

        double[] normalized = new double[features.length];
        for (int i = 0; i < features.length; i++) {
            // 限制在 [0, 1] 区间
            normalized[i] = Math.max(0, Math.min(1, features[i]));

            // 处理 NaN 和 Infinity
            if (Double.isNaN(normalized[i]) || Double.isInfinite(normalized[i])) {
                normalized[i] = 0;
            }
        }
        return normalized;
    }
}

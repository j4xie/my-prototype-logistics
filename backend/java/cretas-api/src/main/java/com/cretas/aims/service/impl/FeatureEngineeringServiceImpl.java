package com.cretas.aims.service.impl;

import com.cretas.aims.entity.ProductType;
import com.cretas.aims.entity.User;
import com.cretas.aims.entity.FactoryEquipment;
import com.cretas.aims.entity.ProductionPlan;
import com.cretas.aims.entity.ProductionBatch;
import com.cretas.aims.entity.enums.ProcessingStageType;
import com.cretas.aims.repository.*;
import com.cretas.aims.service.FeatureEngineeringService;
import com.cretas.aims.service.IndividualEfficiencyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * 统一特征工程服务实现
 *
 * 为 LinUCB 和 LLM+ML 混合预测提供一致的特征提取
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
@Slf4j
@Service
public class FeatureEngineeringServiceImpl implements FeatureEngineeringService {

    private final UserRepository userRepository;
    private final WorkerAllocationFeedbackRepository feedbackRepository;
    private final ProductTypeRepository productTypeRepository;
    private final EquipmentRepository equipmentRepository;
    private final ProductionPlanRepository productionPlanRepository;
    private final ProductionBatchRepository productionBatchRepository;
    private final TimeClockRecordRepository timeClockRecordRepository;

    // Phase 4: 注入个人效率服务 (使用 @Lazy 避免循环依赖)
    private final IndividualEfficiencyService individualEfficiencyService;

    // Phase 4: 特征维度从 6+6=12 扩展到 8+8=16
    private static final int TASK_FEATURE_DIM = 8;
    private static final int WORKER_FEATURE_DIM = 8;

    // 构造函数注入 (使用 @Lazy 避免循环依赖)
    public FeatureEngineeringServiceImpl(
            UserRepository userRepository,
            WorkerAllocationFeedbackRepository feedbackRepository,
            ProductTypeRepository productTypeRepository,
            EquipmentRepository equipmentRepository,
            ProductionPlanRepository productionPlanRepository,
            ProductionBatchRepository productionBatchRepository,
            TimeClockRecordRepository timeClockRecordRepository,
            @Lazy IndividualEfficiencyService individualEfficiencyService) {
        this.userRepository = userRepository;
        this.feedbackRepository = feedbackRepository;
        this.productTypeRepository = productTypeRepository;
        this.equipmentRepository = equipmentRepository;
        this.productionPlanRepository = productionPlanRepository;
        this.productionBatchRepository = productionBatchRepository;
        this.timeClockRecordRepository = timeClockRecordRepository;
        this.individualEfficiencyService = individualEfficiencyService;
    }

    // ==================== 任务特征提取 ====================

    @Override
    public double[] extractTaskFeatures(String factoryId, Map<String, Object> taskInfo) {
        double[] features = new double[TASK_FEATURE_DIM];

        // [0] 任务量 (归一化到 0-1, 范围 0-1000)
        features[0] = normalize(getDouble(taskInfo, "quantity", 100), 0, 1000);

        // [1] 截止时间/小时 (归一化到 0-1, 范围 0-24)
        features[1] = normalize(getDouble(taskInfo, "deadlineHours", 8), 0, 24);

        // [2] 产品类型编码 (hash编码 0-1)
        String productType = getString(taskInfo, "productType", "default");
        features[2] = encodeString(productType);

        // [3] 优先级 (0-1, 原值/10)
        features[3] = getDouble(taskInfo, "priority", 5) / 10.0;

        // [4] 复杂度 (0-1, 原值/5)
        // 尝试从数据库获取精确复杂度
        String productTypeId = getString(taskInfo, "productTypeId", null);
        if (productTypeId != null && factoryId != null) {
            int complexity = getProductComplexity(factoryId, productTypeId);
            features[4] = complexity / 5.0;
        } else {
            features[4] = getDouble(taskInfo, "complexity", 3) / 5.0;
        }

        // [5] 车间编码 (hash编码 0-1)
        String workshopId = getString(taskInfo, "workshopId", "default");
        features[5] = encodeString(workshopId);

        // Phase 4 新增特征:
        // [6] 工艺类型编码 (ProcessingStageType hash, 0-1)
        ProcessingStageType stageType = getStageType(taskInfo);
        features[6] = encodeStageType(stageType);

        // [7] 工艺所需技能等级 (归一化 1-5 → 0-1)
        int requiredSkillLevel = getRequiredSkillLevelForStage(stageType);
        features[7] = normalize(requiredSkillLevel, 1, 5);

        return features;
    }

    /**
     * 从任务信息中获取工艺类型
     */
    private ProcessingStageType getStageType(Map<String, Object> taskInfo) {
        if (taskInfo == null) {
            return ProcessingStageType.OTHER;
        }

        Object stageTypeObj = taskInfo.get("stageType");
        if (stageTypeObj instanceof ProcessingStageType) {
            return (ProcessingStageType) stageTypeObj;
        }

        if (stageTypeObj instanceof String) {
            try {
                return ProcessingStageType.valueOf((String) stageTypeObj);
            } catch (IllegalArgumentException e) {
                log.debug("无法解析工艺类型: {}", stageTypeObj);
            }
        }

        return ProcessingStageType.OTHER;
    }

    /**
     * 编码工艺类型为 0-1 范围的特征值
     */
    private double encodeStageType(ProcessingStageType stageType) {
        if (stageType == null) {
            return 0.5;
        }
        // 使用序号编码，归一化到 0-1
        return (double) stageType.ordinal() / ProcessingStageType.values().length;
    }

    /**
     * 获取工艺所需的技能等级
     * 不同工艺对技能要求不同
     */
    private int getRequiredSkillLevelForStage(ProcessingStageType stageType) {
        if (stageType == null) {
            return 3; // 默认中等
        }

        // 根据工艺复杂度确定所需技能等级
        return switch (stageType) {
            // 高技能要求 (等级 5)
            case QUALITY_CHECK, METAL_DETECTION, INSPECTION -> 5;
            // 较高技能要求 (等级 4)
            case CUTTING, SLICING, DICING, MINCING, TRIMMING -> 4;
            // 中等技能要求 (等级 3)
            case MARINATING, SEASONING, FRYING, COOKING, BAKING, STEAMING -> 3;
            // 较低技能要求 (等级 2)
            case FREEZING, THAWING, COOLING, CHILLING, WASHING, DRAINING, PREPARATION, SORTING -> 2;
            // 基础技能 (等级 1)
            case PACKAGING, LABELING, WEIGHT_CHECK, BOXING, RECEIVING, CLEANING, LINE_CHANGE, OTHER -> 1;
        };
    }

    @Override
    public double[] extractTaskFeaturesFromPlan(String factoryId, String planId) {
        Map<String, Object> taskInfo = new HashMap<>();

        try {
            Optional<ProductionPlan> planOpt = productionPlanRepository.findById(planId);
            if (planOpt.isPresent()) {
                ProductionPlan plan = planOpt.get();

                taskInfo.put("quantity", plan.getPlannedQuantity() != null ?
                        plan.getPlannedQuantity().doubleValue() : 100.0);

                // 计算截止时间（小时）
                if (plan.getExpectedCompletionDate() != null) {
                    long hours = ChronoUnit.HOURS.between(LocalDateTime.now(), plan.getExpectedCompletionDate().atStartOfDay());
                    taskInfo.put("deadlineHours", Math.max(0, hours));
                } else {
                    taskInfo.put("deadlineHours", 8.0);
                }

                taskInfo.put("productTypeId", plan.getProductTypeId());
                taskInfo.put("productType", plan.getProductTypeId());
                taskInfo.put("priority", plan.getPriority() != null ? plan.getPriority() : 5);

                // 从产品类型获取复杂度
                if (plan.getProductTypeId() != null) {
                    int complexity = getProductComplexity(factoryId, plan.getProductTypeId());
                    taskInfo.put("complexity", complexity);
                }
            }
        } catch (Exception e) {
            log.warn("从生产计划提取特征失败: planId={}, error={}", planId, e.getMessage());
        }

        return extractTaskFeatures(factoryId, taskInfo);
    }

    @Override
    public double[] extractTaskFeaturesFromBatch(String factoryId, Long batchId) {
        Map<String, Object> taskInfo = new HashMap<>();

        try {
            Optional<ProductionBatch> batchOpt = productionBatchRepository.findById(batchId);
            if (batchOpt.isPresent()) {
                ProductionBatch batch = batchOpt.get();

                taskInfo.put("quantity", batch.getPlannedQuantity() != null ?
                        batch.getPlannedQuantity().doubleValue() : 100.0);

                // 计算截止时间
                if (batch.getEndTime() != null) {
                    long hours = ChronoUnit.HOURS.between(LocalDateTime.now(), batch.getEndTime());
                    taskInfo.put("deadlineHours", Math.max(0, hours));
                } else {
                    taskInfo.put("deadlineHours", 8.0);
                }

                taskInfo.put("productTypeId", batch.getProductTypeId());
                taskInfo.put("productType", batch.getProductTypeId());
                taskInfo.put("priority", 5); // 批次默认优先级
            }
        } catch (Exception e) {
            log.warn("从加工批次提取特征失败: batchId={}, error={}", batchId, e.getMessage());
        }

        return extractTaskFeatures(factoryId, taskInfo);
    }

    // ==================== 工人特征提取 ====================

    @Override
    public double[] extractWorkerFeatures(String factoryId, Long workerId) {
        double[] features = new double[WORKER_FEATURE_DIM];

        try {
            Optional<User> userOpt = userRepository.findById(workerId);
            if (userOpt.isPresent()) {
                User worker = userOpt.get();
                features = extractWorkerFeaturesFromUser(factoryId, worker);
            } else {
                // 用户不存在，返回默认特征
                features = getDefaultWorkerFeatures();
            }
        } catch (Exception e) {
            log.warn("提取工人特征失败: workerId={}, error={}", workerId, e.getMessage());
            features = getDefaultWorkerFeatures();
        }

        return features;
    }

    @Override
    public double[] extractWorkerFeatures(String factoryId, Long workerId, ProcessingStageType stageType) {
        double[] features = new double[WORKER_FEATURE_DIM];

        try {
            Optional<User> userOpt = userRepository.findById(workerId);
            if (userOpt.isPresent()) {
                User worker = userOpt.get();
                features = extractWorkerFeaturesFromUser(factoryId, worker, stageType);
            } else {
                // 用户不存在，返回默认特征
                features = getDefaultWorkerFeatures();
            }
        } catch (Exception e) {
            log.warn("提取工人特征失败: workerId={}, stageType={}, error={}", workerId, stageType, e.getMessage());
            features = getDefaultWorkerFeatures();
        }

        return features;
    }

    /**
     * 从 User 实体提取工人特征 (无工艺上下文，使用默认值)
     */
    private double[] extractWorkerFeaturesFromUser(String factoryId, User worker) {
        return extractWorkerFeaturesFromUser(factoryId, worker, null);
    }

    /**
     * 从 User 实体提取工人特征 (包含工艺上下文)
     * Phase 4: 扩展到 8 维特征
     */
    private double[] extractWorkerFeaturesFromUser(String factoryId, User worker, ProcessingStageType stageType) {
        double[] features = new double[WORKER_FEATURE_DIM];

        // [0] 技能等级 (归一化 1-5 → 0-1)
        int skillLevel = parseSkillLevel(worker.getSkillLevels());
        features[0] = normalize(skillLevel, 1, 5);

        // [1] 经验天数 (归一化到 0-1, 上限365天)
        long experienceDays = 90; // 默认值
        if (worker.getHireDate() != null) {
            experienceDays = ChronoUnit.DAYS.between(worker.getHireDate(), LocalDate.now());
        }
        features[1] = normalize(experienceDays, 0, 365);

        // [2] 近期效率 (从反馈记录计算, 0-1)
        Double avgEfficiency = null;
        try {
            avgEfficiency = feedbackRepository.calculateAvgEfficiency(factoryId, worker.getId());
        } catch (Exception e) {
            log.debug("计算工人效率失败: workerId={}", worker.getId());
        }
        features[2] = avgEfficiency != null ? avgEfficiency : 0.8;

        // [3] 是否临时工 (0=正式工, 0.5=临时工)
        boolean isTemporary = worker.getHireType() != null &&
                "TEMPORARY".equalsIgnoreCase(worker.getHireType().name());
        features[3] = isTemporary ? 0.5 : 1.0;

        // [4] 今日已工作时长 (归一化到 0-1, 上限12小时)
        double todayHours = calculateTodayWorkHours(factoryId, worker.getId());
        features[4] = normalize(todayHours, 0, 12);

        // [5] 疲劳度 (根据工作时长计算, 0-1)
        // 疲劳度公式: 工作时长超过6小时开始累积
        double fatigueLevel = todayHours > 6 ? Math.min(1.0, (todayHours - 6) / 6.0) : 0;
        features[5] = fatigueLevel;

        // Phase 4 新增特征:
        // [6] 该工艺专项技能 (从 User.skillLevels 解析, 归一化 1-5 → 0-1)
        int stageSkillLevel = parseSkillLevelForStage(worker.getSkillLevels(), stageType);
        features[6] = normalize(stageSkillLevel, 1, 5);

        // [7] 该工艺历史效率 (从 IndividualEfficiencyService 获取, 0-1)
        double stageEfficiency = getWorkerStageEfficiency(factoryId, worker.getId(), stageType);
        features[7] = stageEfficiency;

        return features;
    }

    /**
     * 解析工人在特定工艺上的技能等级
     * Phase 4: 支持工艺维度的技能追踪
     */
    private int parseSkillLevelForStage(String skillLevelsJson, ProcessingStageType stageType) {
        if (stageType == null || skillLevelsJson == null || skillLevelsJson.isEmpty()) {
            return 3; // 默认中等
        }

        try {
            // 解析 JSON: {"SLICING": 4, "PACKAGING": 3}
            String cleaned = skillLevelsJson.replaceAll("[{}\"\\s]", "");
            String[] pairs = cleaned.split(",");

            for (String pair : pairs) {
                String[] kv = pair.split(":");
                if (kv.length == 2) {
                    String key = kv[0].trim();
                    // 匹配工艺类型名称
                    if (stageType.name().equalsIgnoreCase(key) ||
                        stageType.getName().equals(key)) {
                        try {
                            return Integer.parseInt(kv[1].trim());
                        } catch (NumberFormatException ignored) {
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.debug("解析工艺技能等级失败: stageType={}", stageType);
        }

        // 如果没有找到特定工艺的技能，返回平均技能等级
        return parseSkillLevel(skillLevelsJson);
    }

    /**
     * 获取工人在特定工艺上的历史效率
     * Phase 4: 从 IndividualEfficiencyService 获取
     */
    private double getWorkerStageEfficiency(String factoryId, Long workerId, ProcessingStageType stageType) {
        if (stageType == null || individualEfficiencyService == null) {
            return 0.8; // 默认效率
        }

        try {
            Map<ProcessingStageType, BigDecimal> efficiencies =
                    individualEfficiencyService.getWorkerEfficiencyByStage(factoryId, workerId);

            if (efficiencies != null && efficiencies.containsKey(stageType)) {
                BigDecimal efficiency = efficiencies.get(stageType);
                // 归一化效率值到 0-1 (假设效率范围 0.5-1.5)
                return Math.max(0, Math.min(1, (efficiency.doubleValue() - 0.5) / 1.0));
            }
        } catch (Exception e) {
            log.debug("获取工人工艺效率失败: workerId={}, stageType={}", workerId, stageType);
        }

        return 0.8; // 默认效率
    }

    @Override
    public double[] extractWorkerFeatures(Map<String, Object> workerInfo) {
        double[] features = new double[WORKER_FEATURE_DIM];

        // [0] 技能等级
        features[0] = normalize(getDouble(workerInfo, "skillLevel", 3), 1, 5);

        // [1] 经验天数
        features[1] = normalize(getDouble(workerInfo, "experienceDays", 90), 0, 365);

        // [2] 近期效率
        features[2] = getDouble(workerInfo, "recentEfficiency", 0.8);

        // [3] 是否临时工
        boolean isTemporary = getBoolean(workerInfo, "isTemporary", false);
        features[3] = isTemporary ? 0.5 : 1.0;

        // [4] 今日工时
        features[4] = normalize(getDouble(workerInfo, "todayWorkHours", 0), 0, 12);

        // [5] 疲劳度
        features[5] = getDouble(workerInfo, "fatigueLevel", 0);

        // Phase 4 新增特征:
        // [6] 该工艺专项技能 (默认使用平均技能)
        features[6] = normalize(getDouble(workerInfo, "stageSkillLevel", 3), 1, 5);

        // [7] 该工艺历史效率 (默认 0.8)
        features[7] = getDouble(workerInfo, "stageEfficiency", 0.8);

        return features;
    }

    /**
     * 获取默认工人特征 (8 维)
     * Phase 4: 扩展到 8 维
     */
    private double[] getDefaultWorkerFeatures() {
        return new double[] {
                0.6,  // [0] 技能等级 3/5
                0.25, // [1] 经验天数 90/365
                0.8,  // [2] 默认效率
                1.0,  // [3] 正式工
                0.0,  // [4] 今日工时
                0.0,  // [5] 疲劳度
                0.6,  // [6] 工艺专项技能 3/5 (Phase 4)
                0.8   // [7] 工艺历史效率 (Phase 4)
        };
    }

    // ==================== 特征组合 ====================

    @Override
    public double[] combineFeatures(double[] taskFeatures, double[] workerFeatures) {
        if (taskFeatures == null || workerFeatures == null) {
            throw new IllegalArgumentException("特征数组不能为空");
        }

        double[] combined = new double[taskFeatures.length + workerFeatures.length];
        System.arraycopy(taskFeatures, 0, combined, 0, taskFeatures.length);
        System.arraycopy(workerFeatures, 0, combined, taskFeatures.length, workerFeatures.length);

        return combined;
    }

    // ==================== 批量特征提取 ====================

    @Override
    public Map<String, Object> extractWorkerGroupFeatures(String factoryId, List<Long> workerIds) {
        Map<String, Object> groupFeatures = new HashMap<>();

        if (workerIds == null || workerIds.isEmpty()) {
            // 返回默认值
            groupFeatures.put("avg_worker_experience_days", 90);
            groupFeatures.put("avg_skill_level", 3.0);
            groupFeatures.put("temporary_worker_ratio", 0.1);
            groupFeatures.put("avg_recent_efficiency", 0.8);
            groupFeatures.put("total_available_hours", 0.0);
            groupFeatures.put("worker_count", 0);
            return groupFeatures;
        }

        // 获取所有工人
        List<User> workers = userRepository.findAllById(workerIds);

        if (workers.isEmpty()) {
            groupFeatures.put("avg_worker_experience_days", 90);
            groupFeatures.put("avg_skill_level", 3.0);
            groupFeatures.put("temporary_worker_ratio", 0.1);
            groupFeatures.put("avg_recent_efficiency", 0.8);
            groupFeatures.put("total_available_hours", 0.0);
            groupFeatures.put("worker_count", 0);
            return groupFeatures;
        }

        // 计算聚合特征
        double totalExperienceDays = 0;
        double totalSkillLevel = 0;
        int temporaryCount = 0;
        double totalEfficiency = 0;
        int efficiencyCount = 0;
        double totalAvailableHours = 0;

        for (User worker : workers) {
            // 经验天数
            if (worker.getHireDate() != null) {
                long days = ChronoUnit.DAYS.between(worker.getHireDate(), LocalDate.now());
                totalExperienceDays += days;
            } else {
                totalExperienceDays += 90; // 默认
            }

            // 技能等级
            totalSkillLevel += parseSkillLevel(worker.getSkillLevels());

            // 临时工统计
            if (worker.getHireType() != null &&
                    "TEMPORARY".equalsIgnoreCase(worker.getHireType().name())) {
                temporaryCount++;
            }

            // 效率
            try {
                Double eff = feedbackRepository.calculateAvgEfficiency(factoryId, worker.getId());
                if (eff != null) {
                    totalEfficiency += eff;
                    efficiencyCount++;
                }
            } catch (Exception e) {
                // 忽略单个查询失败
            }

            // 可用工时 (12小时 - 今日已工作时长)
            double todayHours = calculateTodayWorkHours(factoryId, worker.getId());
            totalAvailableHours += Math.max(0, 12 - todayHours);
        }

        int workerCount = workers.size();
        groupFeatures.put("worker_count", workerCount);
        groupFeatures.put("avg_worker_experience_days", totalExperienceDays / workerCount);
        groupFeatures.put("avg_skill_level", totalSkillLevel / workerCount);
        groupFeatures.put("temporary_worker_ratio", (double) temporaryCount / workerCount);
        groupFeatures.put("avg_recent_efficiency", efficiencyCount > 0 ?
                totalEfficiency / efficiencyCount : 0.8);
        groupFeatures.put("total_available_hours", totalAvailableHours);

        return groupFeatures;
    }

    @Override
    public Map<Long, double[]> extractMultipleWorkerFeatures(String factoryId, List<Long> workerIds) {
        Map<Long, double[]> result = new HashMap<>();

        if (workerIds == null || workerIds.isEmpty()) {
            return result;
        }

        for (Long workerId : workerIds) {
            result.put(workerId, extractWorkerFeatures(factoryId, workerId));
        }

        return result;
    }

    // ==================== 产品/设备特征 ====================

    @Override
    public int getProductComplexity(String factoryId, String productTypeId) {
        try {
            Optional<ProductType> productOpt = productTypeRepository.findById(productTypeId);
            if (productOpt.isPresent()) {
                ProductType product = productOpt.get();
                // 假设 ProductType 有 complexity 字段，如果没有则根据工序数量估算
                // 这里简化处理，返回默认值或根据类别推断
                return estimateComplexityFromProduct(product);
            }
        } catch (Exception e) {
            log.debug("获取产品复杂度失败: productTypeId={}", productTypeId);
        }

        return 3; // 默认中等复杂度
    }

    /**
     * 根据产品类型估算复杂度
     */
    private int estimateComplexityFromProduct(ProductType product) {
        // 这里可以根据产品名称、类别等推断复杂度
        // 简化实现：使用默认值
        // TODO: 可以添加复杂度字段到 ProductType 实体
        return 3;
    }

    @Override
    public Map<String, Object> extractEquipmentFeatures(String factoryId, List<String> equipmentIds) {
        Map<String, Object> features = new HashMap<>();

        if (equipmentIds == null || equipmentIds.isEmpty()) {
            features.put("equipment_age_days", 365);
            features.put("equipment_utilization", 0.7);
            features.put("maintenance_status", 0);
            return features;
        }

        try {
            // Convert String IDs to Long IDs
            List<Long> longIds = equipmentIds.stream()
                    .map(id -> {
                        try {
                            return Long.parseLong(id);
                        } catch (NumberFormatException e) {
                            return null;
                        }
                    })
                    .filter(Objects::nonNull)
                    .toList();

            List<FactoryEquipment> equipments = equipmentRepository.findAllById(longIds);

            double totalAgeDays = 0;
            int needMaintenance = 0;

            for (FactoryEquipment eq : equipments) {
                // 设备使用天数（使用购买日期）
                if (eq.getPurchaseDate() != null) {
                    long days = ChronoUnit.DAYS.between(eq.getPurchaseDate(), LocalDate.now());
                    totalAgeDays += days;
                } else {
                    totalAgeDays += 365;
                }

                // 维护状态
                if ("MAINTENANCE_REQUIRED".equals(eq.getStatus())) {
                    needMaintenance++;
                }
            }

            int eqCount = equipments.size();
            features.put("equipment_age_days", totalAgeDays / eqCount);
            features.put("equipment_utilization", 0.7); // TODO: 从实际运行数据计算
            features.put("maintenance_status", needMaintenance > 0 ? 1 : 0);

        } catch (Exception e) {
            log.warn("提取设备特征失败: {}", e.getMessage());
            features.put("equipment_age_days", 365);
            features.put("equipment_utilization", 0.7);
            features.put("maintenance_status", 0);
        }

        return features;
    }

    // ==================== 工具方法 ====================

    @Override
    public double normalize(double value, double min, double max) {
        if (max <= min) {
            return 0.0;
        }
        return Math.max(0, Math.min(1, (value - min) / (max - min)));
    }

    @Override
    public double encodeString(String value) {
        if (value == null || value.isEmpty()) {
            return 0.5;
        }
        // 使用 hash 编码到 [0, 1]
        int hash = Math.abs(value.hashCode());
        return (hash % 1000) / 1000.0;
    }

    /**
     * 解析技能等级 JSON
     */
    private int parseSkillLevel(String skillLevelsJson) {
        if (skillLevelsJson == null || skillLevelsJson.isEmpty()) {
            return 3; // 默认等级
        }

        try {
            // 简单解析 JSON，计算平均技能等级
            // 格式: {"切片": 3, "质检": 2}
            String cleaned = skillLevelsJson.replaceAll("[{}\"\\s]", "");
            String[] pairs = cleaned.split(",");

            int totalLevel = 0;
            int count = 0;

            for (String pair : pairs) {
                String[] kv = pair.split(":");
                if (kv.length == 2) {
                    try {
                        totalLevel += Integer.parseInt(kv[1].trim());
                        count++;
                    } catch (NumberFormatException ignored) {
                    }
                }
            }

            return count > 0 ? totalLevel / count : 3;
        } catch (Exception e) {
            return 3;
        }
    }

    /**
     * 计算工人今日工作时长
     */
    private double calculateTodayWorkHours(String factoryId, Long workerId) {
        try {
            LocalDate today = LocalDate.now();
            LocalDateTime startOfDay = today.atStartOfDay();
            LocalDateTime endOfDay = today.plusDays(1).atStartOfDay();

            // 查询今日打卡记录
            // TODO: 根据实际的 TimeClockRecordRepository 方法调整
            // 这里简化返回0
            return 0.0;
        } catch (Exception e) {
            return 0.0;
        }
    }

    // ==================== 辅助方法 ====================

    private double getDouble(Map<String, Object> map, String key, double defaultValue) {
        if (map == null || !map.containsKey(key)) {
            return defaultValue;
        }
        Object value = map.get(key);
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        try {
            return Double.parseDouble(value.toString());
        } catch (Exception e) {
            return defaultValue;
        }
    }

    private String getString(Map<String, Object> map, String key, String defaultValue) {
        if (map == null || !map.containsKey(key)) {
            return defaultValue;
        }
        Object value = map.get(key);
        return value != null ? value.toString() : defaultValue;
    }

    private boolean getBoolean(Map<String, Object> map, String key, boolean defaultValue) {
        if (map == null || !map.containsKey(key)) {
            return defaultValue;
        }
        Object value = map.get(key);
        if (value instanceof Boolean) {
            return (Boolean) value;
        }
        return Boolean.parseBoolean(value.toString());
    }
}

package com.cretas.aims.service;

import com.cretas.aims.dto.scheduling.ChainImpactResult;
import com.cretas.aims.dto.scheduling.InsertSlotDTO;
import com.cretas.aims.entity.ProductionPlan;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 影响分析服务接口
 * 提供科学的多维度影响分析算法
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-30
 */
public interface ImpactAnalysisService {

    // ======= 快速可行性检查 (Layer 1) =======

    /**
     * 快速可行性检查
     * O(n) 时间复杂度，用于快速过滤不可行的时段
     *
     * @param factoryId       工厂ID
     * @param startTime       开始时间
     * @param endTime         结束时间
     * @param requiredQuantity 需求产量
     * @param productTypeId   产品类型ID（用于检查原料）
     * @return 可行性检查结果
     */
    FeasibilityResult checkFeasibility(
            String factoryId,
            LocalDateTime startTime,
            LocalDateTime endTime,
            BigDecimal requiredQuantity,
            String productTypeId
    );

    /**
     * 可行性检查结果
     */
    class FeasibilityResult {
        private boolean feasible;
        private String reason;
        private Map<String, Object> details;

        public static FeasibilityResult feasible() {
            FeasibilityResult result = new FeasibilityResult();
            result.feasible = true;
            return result;
        }

        public static FeasibilityResult notFeasible(String reason) {
            FeasibilityResult result = new FeasibilityResult();
            result.feasible = false;
            result.reason = reason;
            return result;
        }

        public static FeasibilityResult notFeasible(String reason, Map<String, Object> details) {
            FeasibilityResult result = notFeasible(reason);
            result.details = details;
            return result;
        }

        public boolean isFeasible() { return feasible; }
        public String getReason() { return reason; }
        public Map<String, Object> getDetails() { return details; }
    }

    // ======= 多维度推荐评分 (Layer 2) =======

    /**
     * 计算多维度推荐评分
     *
     * 公式:
     * Score = w₁×CapacityFactor + w₂×WorkerFactor + w₃×DeadlineFactor
     *       + w₄×ImpactFactor + w₅×SwitchCostFactor
     *
     * 权重: w₁=0.30, w₂=0.20, w₃=0.20, w₄=0.15, w₅=0.15
     *
     * @param factoryId       工厂ID
     * @param slotStartTime   时段开始时间
     * @param slotEndTime     时段结束时间
     * @param requiredQuantity 需求产量
     * @param productTypeId   产品类型ID
     * @param deadline        交期
     * @return 推荐评分详情
     */
    RecommendScoreResult calculateRecommendScore(
            String factoryId,
            LocalDateTime slotStartTime,
            LocalDateTime slotEndTime,
            BigDecimal requiredQuantity,
            String productTypeId,
            LocalDateTime deadline
    );

    /**
     * 推荐评分结果
     */
    class RecommendScoreResult {
        private int totalScore;           // 0-100
        private double capacityFactor;    // 0-1
        private double workerFactor;      // 0-1
        private double deadlineFactor;    // 0-1
        private double impactFactor;      // 0-1 (负向，越小影响越大)
        private double switchCostFactor;  // 0-1 (负向，换线成本)
        private String recommendationReason;

        // Getters and Setters
        public int getTotalScore() { return totalScore; }
        public void setTotalScore(int totalScore) { this.totalScore = totalScore; }
        public double getCapacityFactor() { return capacityFactor; }
        public void setCapacityFactor(double capacityFactor) { this.capacityFactor = capacityFactor; }
        public double getWorkerFactor() { return workerFactor; }
        public void setWorkerFactor(double workerFactor) { this.workerFactor = workerFactor; }
        public double getDeadlineFactor() { return deadlineFactor; }
        public void setDeadlineFactor(double deadlineFactor) { this.deadlineFactor = deadlineFactor; }
        public double getImpactFactor() { return impactFactor; }
        public void setImpactFactor(double impactFactor) { this.impactFactor = impactFactor; }
        public double getSwitchCostFactor() { return switchCostFactor; }
        public void setSwitchCostFactor(double switchCostFactor) { this.switchCostFactor = switchCostFactor; }
        public String getRecommendationReason() { return recommendationReason; }
        public void setRecommendationReason(String recommendationReason) { this.recommendationReason = recommendationReason; }

        /**
         * 计算综合评分
         */
        public void calculateTotalScore() {
            // 权重配置
            final double W_CAPACITY = 0.30;
            final double W_WORKER = 0.20;
            final double W_DEADLINE = 0.20;
            final double W_IMPACT = 0.15;
            final double W_SWITCH = 0.15;

            double score = W_CAPACITY * capacityFactor * 100
                         + W_WORKER * workerFactor * 100
                         + W_DEADLINE * deadlineFactor * 100
                         + W_IMPACT * impactFactor * 100
                         + W_SWITCH * switchCostFactor * 100;

            this.totalScore = (int) Math.round(Math.min(100, Math.max(0, score)));
        }

        /**
         * 生成推荐理由
         */
        public void generateRecommendationReason() {
            StringBuilder reason = new StringBuilder();

            if (capacityFactor >= 0.8) {
                reason.append("产能充足; ");
            } else if (capacityFactor < 0.5) {
                reason.append("产能紧张; ");
            }

            if (workerFactor >= 0.8) {
                reason.append("人员充足; ");
            } else if (workerFactor < 0.6) {
                reason.append("人员偏紧; ");
            }

            if (deadlineFactor >= 0.7) {
                reason.append("交期紧迫需优先; ");
            }

            if (impactFactor >= 0.8) {
                reason.append("影响极小; ");
            } else if (impactFactor < 0.5) {
                reason.append("影响较大需评估; ");
            }

            if (switchCostFactor >= 0.8) {
                reason.append("无需换线");
            } else if (switchCostFactor < 0.5) {
                reason.append("需换线调整");
            }

            this.recommendationReason = reason.toString().trim();
            if (this.recommendationReason.endsWith(";")) {
                this.recommendationReason = this.recommendationReason.substring(0, this.recommendationReason.length() - 1);
            }
        }
    }

    // ======= 链式影响计算 (Layer 2) =======

    /**
     * 使用BFS算法计算链式影响
     * 计算插入新计划后对现有计划的级联延误影响
     *
     * @param factoryId       工厂ID
     * @param insertStartTime 插入开始时间
     * @param insertEndTime   插入结束时间
     * @param productTypeId   产品类型ID
     * @param requiredQuantity 需求产量
     * @return 链式影响分析结果
     */
    ChainImpactResult calculateChainImpact(
            String factoryId,
            LocalDateTime insertStartTime,
            LocalDateTime insertEndTime,
            String productTypeId,
            BigDecimal requiredQuantity
    );

    /**
     * 针对特定时段计算链式影响
     *
     * @param factoryId 工厂ID
     * @param slot      插单时段
     * @param request   插单请求详情
     * @return 链式影响分析结果
     */
    ChainImpactResult calculateChainImpactForSlot(
            String factoryId,
            InsertSlotDTO slot,
            Map<String, Object> request
    );

    // ======= 资源验证 =======

    /**
     * 检查原料是否充足
     *
     * @param factoryId       工厂ID
     * @param productTypeId   产品类型ID
     * @param requiredQuantity 需求产量
     * @return 原料检查结果
     */
    ResourceCheckResult checkMaterialAvailability(
            String factoryId,
            String productTypeId,
            BigDecimal requiredQuantity
    );

    /**
     * 检查设备是否可用
     *
     * @param factoryId   工厂ID
     * @param startTime   开始时间
     * @param endTime     结束时间
     * @param productionLineId 产线ID (可选)
     * @return 设备检查结果
     */
    ResourceCheckResult checkEquipmentAvailability(
            String factoryId,
            LocalDateTime startTime,
            LocalDateTime endTime,
            String productionLineId
    );

    /**
     * 检查工人是否充足
     *
     * @param factoryId       工厂ID
     * @param startTime       开始时间
     * @param endTime         结束时间
     * @param requiredWorkers 所需工人数
     * @return 工人检查结果
     */
    ResourceCheckResult checkWorkerAvailability(
            String factoryId,
            LocalDateTime startTime,
            LocalDateTime endTime,
            int requiredWorkers
    );

    /**
     * 资源检查结果
     */
    class ResourceCheckResult {
        private boolean available;
        private String resourceType;      // MATERIAL/EQUIPMENT/WORKER
        private String message;
        private BigDecimal requiredAmount;
        private BigDecimal availableAmount;
        private Double utilizationRate;   // 利用率

        public static ResourceCheckResult available(String resourceType, BigDecimal available, BigDecimal required) {
            ResourceCheckResult result = new ResourceCheckResult();
            result.available = true;
            result.resourceType = resourceType;
            result.availableAmount = available;
            result.requiredAmount = required;
            if (required != null && required.compareTo(BigDecimal.ZERO) > 0) {
                result.utilizationRate = required.divide(available, 4, java.math.RoundingMode.HALF_UP)
                        .doubleValue();
            }
            return result;
        }

        public static ResourceCheckResult unavailable(String resourceType, String message, BigDecimal available, BigDecimal required) {
            ResourceCheckResult result = new ResourceCheckResult();
            result.available = false;
            result.resourceType = resourceType;
            result.message = message;
            result.availableAmount = available;
            result.requiredAmount = required;
            return result;
        }

        // Getters
        public boolean isAvailable() { return available; }
        public String getResourceType() { return resourceType; }
        public String getMessage() { return message; }
        public BigDecimal getRequiredAmount() { return requiredAmount; }
        public BigDecimal getAvailableAmount() { return availableAmount; }
        public Double getUtilizationRate() { return utilizationRate; }
    }

    // ======= 换线成本计算 =======

    /**
     * 计算换线成本
     *
     * @param factoryId         工厂ID
     * @param currentProductType 当前产品类型
     * @param newProductType     新产品类型
     * @return 换线成本 (分钟)
     */
    int calculateSwitchCost(String factoryId, String currentProductType, String newProductType);

    /**
     * 判断换线类型
     *
     * @param currentProductType 当前产品类型
     * @param newProductType     新产品类型
     * @return 换线类型: NONE/SAME_MATERIAL/FULL_SWITCH
     */
    String determineSwitchType(String currentProductType, String newProductType);

    // ======= 工厂产能配置 =======

    /**
     * 获取工厂产能配置
     *
     * @param factoryId 工厂ID
     * @return 产能配置
     */
    FactoryCapacityConfig getFactoryCapacityConfig(String factoryId);

    /**
     * 工厂产能配置
     */
    class FactoryCapacityConfig {
        private String factoryId;
        private BigDecimal dailyCapacity;           // 日产能 (kg)
        private BigDecimal hourlyCapacity;          // 时产能 (kg)
        private int standardShiftWorkers;           // 标准班次工人数
        private int maxWorkers;                     // 最大工人数
        private int minWorkers;                     // 最小工人数
        private int switchCostMinutes;              // 标准换线时间 (分钟)
        private int materialSwitchCostMinutes;      // 同材料换线时间 (分钟)
        private LocalDateTime workStartTime;        // 工作开始时间
        private LocalDateTime workEndTime;          // 工作结束时间
        private boolean allowOvertime;              // 是否允许加班

        // Getters and Setters
        public String getFactoryId() { return factoryId; }
        public void setFactoryId(String factoryId) { this.factoryId = factoryId; }
        public BigDecimal getDailyCapacity() { return dailyCapacity; }
        public void setDailyCapacity(BigDecimal dailyCapacity) { this.dailyCapacity = dailyCapacity; }
        public BigDecimal getHourlyCapacity() { return hourlyCapacity; }
        public void setHourlyCapacity(BigDecimal hourlyCapacity) { this.hourlyCapacity = hourlyCapacity; }
        public int getStandardShiftWorkers() { return standardShiftWorkers; }
        public void setStandardShiftWorkers(int standardShiftWorkers) { this.standardShiftWorkers = standardShiftWorkers; }
        public int getMaxWorkers() { return maxWorkers; }
        public void setMaxWorkers(int maxWorkers) { this.maxWorkers = maxWorkers; }
        public int getMinWorkers() { return minWorkers; }
        public void setMinWorkers(int minWorkers) { this.minWorkers = minWorkers; }
        public int getSwitchCostMinutes() { return switchCostMinutes; }
        public void setSwitchCostMinutes(int switchCostMinutes) { this.switchCostMinutes = switchCostMinutes; }
        public int getMaterialSwitchCostMinutes() { return materialSwitchCostMinutes; }
        public void setMaterialSwitchCostMinutes(int materialSwitchCostMinutes) { this.materialSwitchCostMinutes = materialSwitchCostMinutes; }
        public LocalDateTime getWorkStartTime() { return workStartTime; }
        public void setWorkStartTime(LocalDateTime workStartTime) { this.workStartTime = workStartTime; }
        public LocalDateTime getWorkEndTime() { return workEndTime; }
        public void setWorkEndTime(LocalDateTime workEndTime) { this.workEndTime = workEndTime; }
        public boolean isAllowOvertime() { return allowOvertime; }
        public void setAllowOvertime(boolean allowOvertime) { this.allowOvertime = allowOvertime; }

        /**
         * 获取默认配置 (当数据库没有配置时)
         */
        public static FactoryCapacityConfig getDefault(String factoryId) {
            FactoryCapacityConfig config = new FactoryCapacityConfig();
            config.factoryId = factoryId;
            config.dailyCapacity = new BigDecimal("5000");    // 5000kg/天
            config.hourlyCapacity = new BigDecimal("500");    // 500kg/小时
            config.standardShiftWorkers = 6;
            config.maxWorkers = 10;
            config.minWorkers = 3;
            config.switchCostMinutes = 30;                    // 30分钟换线
            config.materialSwitchCostMinutes = 15;            // 同材料15分钟
            config.allowOvertime = true;
            return config;
        }
    }
}

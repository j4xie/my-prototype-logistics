package com.cretas.aims.dto.scheduling;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 紧急插单时段DTO
 * 增强版：包含多维度评分、链式影响分析、时段锁定功能
 *
 * @author Cretas Team
 * @version 2.0.0
 * @since 2025-12-28
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "紧急插单时段信息")
public class InsertSlotDTO {

    @Schema(description = "时段ID")
    private String id;

    @Schema(description = "工厂ID")
    private String factoryId;

    @Schema(description = "产线ID")
    private String productionLineId;

    @Schema(description = "产线名称")
    private String productionLineName;

    @Schema(description = "开始时间")
    private LocalDateTime startTime;

    @Schema(description = "结束时间")
    private LocalDateTime endTime;

    @Schema(description = "时段时长（小时）")
    private Double durationHours;

    @Schema(description = "可用产能 (kg)")
    private BigDecimal availableCapacity;

    @Schema(description = "影响等级: none/low/medium/high/critical")
    private String impactLevel;

    @Schema(description = "影响等级显示名称")
    private String impactLevelDisplayName;

    @Schema(description = "受影响的计划列表 (简化版)")
    private List<ImpactedPlanDTO> impactedPlans;

    @Schema(description = "所需人员数")
    private Integer requiredWorkers;

    @Schema(description = "可用人员数")
    private Integer availableWorkers;

    @Schema(description = "人员是否充足")
    private Boolean hasEnoughWorkers;

    @Schema(description = "换型成本 (分钟)")
    private Integer switchCostMinutes;

    @Schema(description = "推荐分数 (0-100)")
    private Integer recommendScore;

    @Schema(description = "推荐理由")
    private String recommendationReason;

    @Schema(description = "状态: available/selected/expired/locked")
    private String status;

    @Schema(description = "是否可用")
    private Boolean isAvailable;

    // ======= 新增：多维度评分详情 =======

    @Schema(description = "评分详情 (5维度权重分解)")
    private ScoreBreakdown scoreBreakdown;

    // ======= 新增：链式影响分析详情 =======

    @Schema(description = "影响分析详情")
    private ImpactDetails impactDetails;

    @Schema(description = "完整链式影响分析结果 (含受影响计划详情)")
    private ChainImpactResult chainImpactResult;

    // ======= 新增：时段锁定机制 =======

    @Schema(description = "是否已被锁定")
    @Builder.Default
    private Boolean isLocked = false;

    @Schema(description = "锁定者用户ID")
    private Long lockedBy;

    @Schema(description = "锁定者用户名")
    private String lockedByUsername;

    @Schema(description = "锁定过期时间")
    private LocalDateTime lockExpireAt;

    @Schema(description = "锁定剩余秒数")
    private Integer lockRemainingSeconds;

    // ======= 新增：可行性状态 =======

    @Schema(description = "是否通过可行性检查")
    @Builder.Default
    private Boolean isFeasible = true;

    @Schema(description = "不可行原因 (当isFeasible=false时)")
    private String infeasibleReason;

    // ======= 新增：资源状态 =======

    @Schema(description = "原料是否充足")
    private Boolean hasSufficientMaterial;

    @Schema(description = "设备是否可用")
    private Boolean hasAvailableEquipment;

    /**
     * 评分详情 - 5维度权重分解
     *
     * 公式: Score = w₁×CapacityFactor + w₂×WorkerFactor + w₃×DeadlineFactor
     *              + w₄×ImpactFactor + w₅×SwitchCostFactor
     * 权重: w₁=0.30, w₂=0.20, w₃=0.20, w₄=0.15, w₅=0.15
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "多维度评分详情")
    public static class ScoreBreakdown {

        @Schema(description = "产能利用率因子 (0-1)，越高越好")
        private Double capacityFactor;

        @Schema(description = "工人可用性因子 (0-1)，越高越好")
        private Double workerFactor;

        @Schema(description = "交期紧迫度因子 (0-1)，越高表示越紧迫需优先")
        private Double deadlineFactor;

        @Schema(description = "影响程度因子 (0-1)，越高表示影响越小")
        private Double impactFactor;

        @Schema(description = "换线成本因子 (0-1)，越高表示换线成本越低")
        private Double switchCostFactor;

        @Schema(description = "产能评分贡献 (capacityFactor × 30)")
        private Integer capacityScore;

        @Schema(description = "工人评分贡献 (workerFactor × 20)")
        private Integer workerScore;

        @Schema(description = "交期评分贡献 (deadlineFactor × 20)")
        private Integer deadlineScore;

        @Schema(description = "影响评分贡献 (impactFactor × 15)")
        private Integer impactScore;

        @Schema(description = "换线评分贡献 (switchCostFactor × 15)")
        private Integer switchCostScore;

        /**
         * 计算各维度得分贡献
         */
        public void calculateScores() {
            this.capacityScore = (int) Math.round((capacityFactor != null ? capacityFactor : 0) * 30);
            this.workerScore = (int) Math.round((workerFactor != null ? workerFactor : 0) * 20);
            this.deadlineScore = (int) Math.round((deadlineFactor != null ? deadlineFactor : 0) * 20);
            this.impactScore = (int) Math.round((impactFactor != null ? impactFactor : 0) * 15);
            this.switchCostScore = (int) Math.round((switchCostFactor != null ? switchCostFactor : 0) * 15);
        }

        /**
         * 获取总分
         */
        public int getTotalScore() {
            calculateScores();
            return capacityScore + workerScore + deadlineScore + impactScore + switchCostScore;
        }
    }

    /**
     * 影响分析详情 - 链式影响统计
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "影响分析详情")
    public static class ImpactDetails {

        @Schema(description = "直接冲突的计划数")
        private Integer directConflicts;

        @Schema(description = "级联延误的计划数")
        private Integer cascadeDelays;

        @Schema(description = "总受影响计划数")
        private Integer totalAffectedPlans;

        @Schema(description = "最大延误时间 (小时)")
        private Double maxDelayHours;

        @Schema(description = "平均延误时间 (小时)")
        private Double averageDelayHours;

        @Schema(description = "是否影响VIP客户")
        private Boolean affectsVipCustomer;

        @Schema(description = "受影响VIP客户数")
        private Integer affectedVipCustomerCount;

        @Schema(description = "变为紧急状态的计划数 (CR < 1)")
        private Integer criticalCrPlans;

        @Schema(description = "超期计划数")
        private Integer exceedingDeadlinePlans;

        @Schema(description = "影响评分 (0-100，越高影响越大)")
        private Integer impactScore;

        @Schema(description = "是否需要审批")
        private Boolean requiresApproval;

        @Schema(description = "审批级别: SUPERVISOR/MANAGER/DIRECTOR")
        private String approvalLevel;

        /**
         * 判断是否高风险
         */
        public boolean isHighRisk() {
            return (affectsVipCustomer != null && affectsVipCustomer) ||
                   (criticalCrPlans != null && criticalCrPlans > 0) ||
                   (exceedingDeadlinePlans != null && exceedingDeadlinePlans > 0) ||
                   (impactScore != null && impactScore >= 50);
        }
    }

    /**
     * 受影响计划DTO (简化版，用于列表展示)
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "受影响计划信息")
    public static class ImpactedPlanDTO {

        @Schema(description = "计划ID")
        private String planId;

        @Schema(description = "计划编号")
        private String planNumber;

        @Schema(description = "计划名称/产品名称")
        private String planName;

        @Schema(description = "延迟时间（分钟）")
        private Integer delayMinutes;

        @Schema(description = "原计划完成时间")
        private LocalDateTime originalEndTime;

        @Schema(description = "延迟后完成时间")
        private LocalDateTime delayedEndTime;

        @Schema(description = "是否VIP客户")
        private Boolean isVipCustomer;

        @Schema(description = "影响类型: DIRECT/CASCADE")
        private String impactType;

        @Schema(description = "影响层级 (1=直接, 2+=级联)")
        private Integer impactLevel;
    }

    // ======= 便捷方法 =======

    /**
     * 从 ChainImpactResult 填充影响详情
     */
    public void populateFromChainImpact(ChainImpactResult result) {
        if (result == null) return;

        this.chainImpactResult = result;
        this.impactLevel = result.getImpactLevel();
        this.impactLevelDisplayName = result.getImpactLevelDisplayName();

        // 填充 ImpactDetails
        this.impactDetails = ImpactDetails.builder()
                .directConflicts(result.getDirectConflicts())
                .cascadeDelays(result.getCascadeDelays())
                .totalAffectedPlans(result.getTotalAffectedPlans())
                .maxDelayHours(result.getMaxDelayMinutes() != null ?
                        result.getMaxDelayMinutes() / 60.0 : 0.0)
                .averageDelayHours(result.getAverageDelayMinutes() != null ?
                        result.getAverageDelayMinutes() / 60.0 : 0.0)
                .affectsVipCustomer(result.getAffectedVipCustomers() != null &&
                        result.getAffectedVipCustomers() > 0)
                .affectedVipCustomerCount(result.getAffectedVipCustomers())
                .criticalCrPlans(result.getCriticalCrPlans())
                .exceedingDeadlinePlans(result.getExceedingDeadlinePlans())
                .impactScore(result.getImpactScore())
                .requiresApproval(result.getRequiresApproval())
                .approvalLevel(result.getApprovalLevel())
                .build();
    }

    /**
     * 检查锁定是否有效
     */
    public boolean isLockValid() {
        if (isLocked == null || !isLocked) return false;
        if (lockExpireAt == null) return false;
        return LocalDateTime.now().isBefore(lockExpireAt);
    }

    /**
     * 计算锁定剩余秒数
     */
    public void updateLockRemainingSeconds() {
        if (!isLockValid()) {
            this.lockRemainingSeconds = 0;
            return;
        }
        long seconds = java.time.Duration.between(LocalDateTime.now(), lockExpireAt).getSeconds();
        this.lockRemainingSeconds = (int) Math.max(0, seconds);
    }
}

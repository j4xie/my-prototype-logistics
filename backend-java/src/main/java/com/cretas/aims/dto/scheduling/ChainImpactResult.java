package com.cretas.aims.dto.scheduling;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * 链式影响分析结果DTO
 * 包含BFS算法计算的级联延误影响
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-30
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "链式影响分析结果")
public class ChainImpactResult {

    @Schema(description = "受影响的计划列表")
    @Builder.Default
    private List<AffectedPlanDTO> affectedPlans = new ArrayList<>();

    @Schema(description = "影响等级: none/low/medium/high/critical")
    private String impactLevel;

    @Schema(description = "影响等级显示名称")
    private String impactLevelDisplayName;

    // ======= 统计信息 =======

    @Schema(description = "直接冲突计划数")
    private Integer directConflicts;

    @Schema(description = "级联延误计划数")
    private Integer cascadeDelays;

    @Schema(description = "总受影响计划数")
    private Integer totalAffectedPlans;

    @Schema(description = "最大延误时间（分钟）")
    private Integer maxDelayMinutes;

    @Schema(description = "平均延误时间（分钟）")
    private Double averageDelayMinutes;

    @Schema(description = "总延误时间（分钟）")
    private Integer totalDelayMinutes;

    @Schema(description = "涉及VIP客户数")
    private Integer affectedVipCustomers;

    @Schema(description = "变为紧急的计划数 (CR < 1)")
    private Integer criticalCrPlans;

    @Schema(description = "超期计划数")
    private Integer exceedingDeadlinePlans;

    // ======= 评分详情 =======

    @Schema(description = "影响综合评分 (0-100，越高越严重)")
    private Integer impactScore;

    @Schema(description = "评分详情")
    private ScoreBreakdown scoreBreakdown;

    @Schema(description = "是否需要审批")
    private Boolean requiresApproval;

    @Schema(description = "审批级别: SUPERVISOR/MANAGER/DIRECTOR")
    private String approvalLevel;

    @Schema(description = "风险预警信息")
    @Builder.Default
    private List<String> riskWarnings = new ArrayList<>();

    /**
     * 评分详情
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "影响评分详情")
    public static class ScoreBreakdown {

        @Schema(description = "直接冲突得分 (0-25)")
        private Integer directConflictScore;

        @Schema(description = "级联延误得分 (0-25)")
        private Integer cascadeDelayScore;

        @Schema(description = "最大延误时长得分 (0-20)")
        private Integer maxDelayDurationScore;

        @Schema(description = "VIP客户影响得分 (0-15)")
        private Integer vipCustomerScore;

        @Schema(description = "紧急计划影响得分 (0-15)")
        private Integer criticalCrScore;
    }

    /**
     * 计算综合评分
     */
    public void calculateImpactScore() {
        if (scoreBreakdown == null) {
            scoreBreakdown = new ScoreBreakdown();
        }

        // 直接冲突得分 (0-25)
        int directScore = 0;
        if (directConflicts != null) {
            if (directConflicts >= 6) directScore = 25;
            else if (directConflicts >= 4) directScore = 20;
            else if (directConflicts >= 2) directScore = 15;
            else if (directConflicts >= 1) directScore = 8;
        }
        scoreBreakdown.setDirectConflictScore(directScore);

        // 级联延误得分 (0-25)
        int cascadeScore = 0;
        if (cascadeDelays != null) {
            if (cascadeDelays >= 6) cascadeScore = 25;
            else if (cascadeDelays >= 3) cascadeScore = 18;
            else if (cascadeDelays >= 1) cascadeScore = 10;
        }
        scoreBreakdown.setCascadeDelayScore(cascadeScore);

        // 最大延误时长得分 (0-20)
        int delayScore = 0;
        if (maxDelayMinutes != null) {
            if (maxDelayMinutes >= 480) delayScore = 20;  // > 8小时
            else if (maxDelayMinutes >= 240) delayScore = 15; // > 4小时
            else if (maxDelayMinutes >= 120) delayScore = 10; // > 2小时
            else if (maxDelayMinutes >= 60) delayScore = 5;   // > 1小时
        }
        scoreBreakdown.setMaxDelayDurationScore(delayScore);

        // VIP客户影响得分 (0-15)
        int vipScore = 0;
        if (affectedVipCustomers != null && affectedVipCustomers > 0) {
            vipScore = Math.min(15, affectedVipCustomers * 8);
        }
        scoreBreakdown.setVipCustomerScore(vipScore);

        // 紧急计划影响得分 (0-15)
        int criticalScore = 0;
        if (criticalCrPlans != null) {
            if (criticalCrPlans >= 3) criticalScore = 15;
            else if (criticalCrPlans >= 1) criticalScore = 10;
        }
        scoreBreakdown.setCriticalCrScore(criticalScore);

        // 综合评分
        this.impactScore = directScore + cascadeScore + delayScore + vipScore + criticalScore;
    }

    /**
     * 根据评分确定影响等级
     */
    public void determineImpactLevel() {
        if (impactScore == null) {
            calculateImpactScore();
        }

        if (impactScore >= 70) {
            this.impactLevel = "critical";
            this.impactLevelDisplayName = "极高影响";
            this.requiresApproval = true;
            this.approvalLevel = "DIRECTOR";
        } else if (impactScore >= 50) {
            this.impactLevel = "high";
            this.impactLevelDisplayName = "高影响";
            this.requiresApproval = true;
            this.approvalLevel = "MANAGER";
        } else if (impactScore >= 30) {
            this.impactLevel = "medium";
            this.impactLevelDisplayName = "中等影响";
            this.requiresApproval = false;
            this.approvalLevel = null;
        } else if (impactScore > 0) {
            this.impactLevel = "low";
            this.impactLevelDisplayName = "低影响";
            this.requiresApproval = false;
            this.approvalLevel = null;
        } else {
            this.impactLevel = "none";
            this.impactLevelDisplayName = "无影响";
            this.requiresApproval = false;
            this.approvalLevel = null;
        }
    }

    /**
     * 生成风险预警信息
     */
    public void generateRiskWarnings() {
        if (riskWarnings == null) {
            riskWarnings = new ArrayList<>();
        }
        riskWarnings.clear();

        if (affectedVipCustomers != null && affectedVipCustomers > 0) {
            riskWarnings.add(String.format("涉及 %d 个VIP客户订单", affectedVipCustomers));
        }

        if (exceedingDeadlinePlans != null && exceedingDeadlinePlans > 0) {
            riskWarnings.add(String.format("%d 个计划将超过交期", exceedingDeadlinePlans));
        }

        if (criticalCrPlans != null && criticalCrPlans > 0) {
            riskWarnings.add(String.format("%d 个计划将变为紧急状态", criticalCrPlans));
        }

        if (maxDelayMinutes != null && maxDelayMinutes >= 240) {
            riskWarnings.add(String.format("最大延误时间达 %.1f 小时", maxDelayMinutes / 60.0));
        }

        if (cascadeDelays != null && cascadeDelays >= 3) {
            riskWarnings.add(String.format("将产生 %d 个级联延误", cascadeDelays));
        }
    }

    /**
     * 计算所有统计信息
     */
    public void calculateStatistics() {
        if (affectedPlans == null || affectedPlans.isEmpty()) {
            this.directConflicts = 0;
            this.cascadeDelays = 0;
            this.totalAffectedPlans = 0;
            this.maxDelayMinutes = 0;
            this.averageDelayMinutes = 0.0;
            this.totalDelayMinutes = 0;
            this.affectedVipCustomers = 0;
            this.criticalCrPlans = 0;
            this.exceedingDeadlinePlans = 0;
            return;
        }

        int direct = 0;
        int cascade = 0;
        int vipCount = 0;
        int criticalCount = 0;
        int exceedingCount = 0;
        int maxDelay = 0;
        int totalDelay = 0;

        for (AffectedPlanDTO plan : affectedPlans) {
            // 统计直接冲突和级联延误
            if (plan.getImpactLevel() != null && plan.getImpactLevel() == 1) {
                direct++;
            } else {
                cascade++;
            }

            // VIP客户统计
            if (Boolean.TRUE.equals(plan.getIsVipCustomer())) {
                vipCount++;
            }

            // 紧急计划统计 (CR < 1)
            if (Boolean.TRUE.equals(plan.getBecomesUrgent())) {
                criticalCount++;
            }

            // 超期计划统计
            if (Boolean.TRUE.equals(plan.getExceedsDeadline())) {
                exceedingCount++;
            }

            // 延误时间统计
            if (plan.getDelayMinutes() != null) {
                int delay = plan.getDelayMinutes();
                if (delay > maxDelay) {
                    maxDelay = delay;
                }
                totalDelay += delay;
            }
        }

        this.directConflicts = direct;
        this.cascadeDelays = cascade;
        this.totalAffectedPlans = affectedPlans.size();
        this.maxDelayMinutes = maxDelay;
        this.totalDelayMinutes = totalDelay;
        this.averageDelayMinutes = affectedPlans.isEmpty() ? 0.0 :
                (double) totalDelay / affectedPlans.size();
        this.affectedVipCustomers = vipCount;
        this.criticalCrPlans = criticalCount;
        this.exceedingDeadlinePlans = exceedingCount;
    }
}

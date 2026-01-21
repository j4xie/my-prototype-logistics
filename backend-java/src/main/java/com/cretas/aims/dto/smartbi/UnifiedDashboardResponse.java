package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 统一仪表盘响应 DTO
 *
 * 聚合所有分析维度的数据，提供一站式经营数据概览：
 * - 销售概览
 * - 财务概览
 * - 库存健康
 * - 生产OEE
 * - 质量分析
 * - 采购分析
 * - 预警与建议
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-20
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UnifiedDashboardResponse {

    /**
     * 时间周期
     */
    private String period;

    /**
     * 数据开始日期
     */
    private LocalDate startDate;

    /**
     * 数据结束日期
     */
    private LocalDate endDate;

    // ==================== 各维度汇总数据 ====================

    /**
     * 销售汇总
     */
    private DashboardResponse sales;

    /**
     * 财务汇总
     */
    private DashboardResponse finance;

    /**
     * 库存健康汇总
     */
    private DashboardResponse inventory;

    /**
     * 生产OEE汇总
     */
    private DashboardResponse production;

    /**
     * 质量分析汇总
     */
    private DashboardResponse quality;

    /**
     * 采购分析汇总
     */
    private DashboardResponse procurement;

    // ==================== 部门与区域排名 ====================

    /**
     * 部门排名
     */
    private List<RankingItem> departmentRanking;

    /**
     * 区域排名
     */
    private List<RankingItem> regionRanking;

    // ==================== 预警与建议 ====================

    /**
     * 预警列表
     */
    private List<Alert> alerts;

    /**
     * AI 建议列表
     */
    private List<Recommendation> recommendations;

    /**
     * AI 洞察列表
     */
    private List<AIInsight> aiInsights;

    // ==================== 元数据 ====================

    /**
     * 生成时间
     */
    private LocalDateTime generatedAt;

    /**
     * 是否来自缓存
     */
    @Builder.Default
    private boolean fromCache = false;

    /**
     * 缓存过期时间
     */
    private LocalDateTime cacheExpireAt;

    /**
     * 数据版本（用于前端缓存校验）
     */
    private String dataVersion;

    /**
     * 快速创建统一仪表盘响应
     */
    public static UnifiedDashboardResponse of(String period, LocalDate startDate, LocalDate endDate) {
        return UnifiedDashboardResponse.builder()
                .period(period)
                .startDate(startDate)
                .endDate(endDate)
                .generatedAt(LocalDateTime.now())
                .fromCache(false)
                .build();
    }

    /**
     * 标记为缓存数据
     */
    public UnifiedDashboardResponse markAsFromCache(LocalDateTime expireAt) {
        this.fromCache = true;
        this.cacheExpireAt = expireAt;
        return this;
    }

    /**
     * 获取预警数量
     */
    public int getAlertCount() {
        return alerts != null ? alerts.size() : 0;
    }

    /**
     * 获取紧急预警数量
     */
    public long getUrgentAlertCount() {
        return alerts != null ? alerts.stream().filter(Alert::isUrgent).count() : 0;
    }

    /**
     * 获取高优先级建议数量
     */
    public long getHighPriorityRecommendationCount() {
        return recommendations != null ?
                recommendations.stream().filter(Recommendation::isHighPriority).count() : 0;
    }
}

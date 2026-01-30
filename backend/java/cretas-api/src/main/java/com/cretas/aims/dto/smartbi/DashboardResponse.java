package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 仪表盘响应 DTO
 *
 * 用于返回完整的仪表盘数据，包括：
 * - 时间周期信息
 * - KPI 卡片数据
 * - 多维度排行榜
 * - 图表配置
 * - AI 洞察和预警
 * - 智能建议
 *
 * @author Cretas Team
 * @version 1.1.0
 * @since 2026-01-18
 * @deprecated 此类将作为 {@link UnifiedDashboardResponse} 的内部组件使用。
 *             对于新的仪表盘接口，请优先使用 {@link UnifiedDashboardResponse}，
 *             它提供多维度聚合视图（销售、财务、库存、生产、质量、采购）。
 *             此类仍可用于单一维度的仪表盘数据返回。
 * @see UnifiedDashboardResponse
 */
@Deprecated
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardResponse {

    /**
     * 时间周期标识
     * 例如：TODAY, THIS_WEEK, THIS_MONTH, THIS_QUARTER, THIS_YEAR
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

    /**
     * KPI 卡片列表
     * 包含关键业务指标
     */
    private List<KPICard> kpiCards;

    /**
     * 旧版 KPI 卡片列表（兼容）
     * @deprecated 请使用 kpiCards
     */
    @Deprecated
    private List<MetricResult> metricCards;

    /**
     * 多维度排行榜
     * Key: 排行榜类型（如 sales_person, department, product）
     * Value: 排行榜数据列表
     */
    private Map<String, List<RankingItem>> rankings;

    /**
     * 图表配置映射
     * Key: 图表标识（如 sales_trend, category_distribution）
     * Value: 图表配置
     */
    private Map<String, ChartConfig> charts;

    /**
     * 旧版图表列表（兼容）
     * @deprecated 请使用 charts Map
     */
    @Deprecated
    private List<ChartConfig> chartList;

    /**
     * AI 洞察列表
     * AI 自动发现的业务洞察
     */
    private List<AIInsight> aiInsights;

    /**
     * 预警列表
     * 需要关注的业务预警
     */
    private List<Alert> alerts;

    /**
     * 建议列表
     * AI 生成的智能建议
     */
    private List<Recommendation> recommendations;

    /**
     * 旧版建议列表（兼容）
     * @deprecated 请使用 recommendations
     */
    @Deprecated
    private List<String> suggestions;

    /**
     * 仪表盘生成时间
     */
    private LocalDateTime generatedAt;

    /**
     * 最后更新时间（兼容）
     * @deprecated 请使用 generatedAt
     */
    @Deprecated
    private LocalDateTime lastUpdated;

    /**
     * 是否来自缓存
     * true 表示数据来自缓存，false 表示实时计算
     */
    @Builder.Default
    private boolean fromCache = false;

    /**
     * 缓存过期时间
     * 当 fromCache 为 true 时，表示缓存的过期时间
     */
    private LocalDateTime cacheExpireAt;

    /**
     * 快速创建仪表盘响应
     */
    public static DashboardResponse of(String period, LocalDate startDate, LocalDate endDate,
                                        List<KPICard> kpiCards) {
        return DashboardResponse.builder()
                .period(period)
                .startDate(startDate)
                .endDate(endDate)
                .kpiCards(kpiCards)
                .generatedAt(LocalDateTime.now())
                .fromCache(false)
                .build();
    }

    /**
     * 标记为缓存数据
     */
    public DashboardResponse markAsFromCache(LocalDateTime expireAt) {
        this.fromCache = true;
        this.cacheExpireAt = expireAt;
        return this;
    }
}

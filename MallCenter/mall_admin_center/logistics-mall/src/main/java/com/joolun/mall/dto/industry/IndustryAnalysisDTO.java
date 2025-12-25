package com.joolun.mall.dto.industry;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 行业分析报告 - 完整响应DTO
 * 包含行业亮点、趋势、竞争格局、市场机会、AI洞察
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IndustryAnalysisDTO {

    /**
     * 报告生成时间
     */
    private LocalDateTime generatedAt;

    /**
     * 下次刷新时间 (缓存过期时间)
     */
    private LocalDateTime nextRefreshAt;

    /**
     * 是否来自缓存
     */
    private Boolean fromCache;

    /**
     * 缓存剩余时间 (秒)
     */
    private Long cacheRemainingSeconds;

    /**
     * 分析状态: success/partial/failed
     */
    private String status;

    /**
     * 错误信息 (如果有)
     */
    private String errorMessage;

    // ========== 报告内容 ==========

    /**
     * 行业亮点指标 (4个)
     * 市场规模、年增长率、参与企业、渗透率
     */
    private List<HighlightMetric> highlights;

    /**
     * 行业趋势 (3个)
     * AI智能溯源、区块链标准化、全链路数字化
     */
    private List<TrendItem> trends;

    /**
     * 竞争格局 - Top5企业
     */
    private List<CompetitorRank> competitors;

    /**
     * 市场机会 (3个)
     * 中小企业转型、跨境溯源、政策红利
     */
    private List<OpportunityCard> opportunities;

    /**
     * AI智能洞察 (5条)
     */
    private List<InsightItem> insights;

    /**
     * 报告标题
     */
    private String reportTitle;

    /**
     * 报告副标题/日期范围
     */
    private String reportSubtitle;

    /**
     * AI模型版本
     */
    private String aiModelVersion;
}

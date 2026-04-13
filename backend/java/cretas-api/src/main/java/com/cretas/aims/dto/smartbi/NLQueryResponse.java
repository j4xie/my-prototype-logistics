package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * 自然语言查询响应 DTO
 *
 * 用于返回自然语言查询的处理结果，包括：
 * - 意图识别结果和置信度
 * - AI 生成的响应文本
 * - 查询数据和图表配置
 * - 后续问题建议
 * - 需要澄清时的追问
 *
 * @author Cretas Team
 * @version 1.1.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NLQueryResponse {

    /**
     * 识别的意图
     * 例如：SALES_QUERY, TREND_ANALYSIS, RANKING_QUERY
     */
    private String intent;

    /**
     * 意图识别置信度
     * 范围 0.0 - 1.0，越高表示越确定
     */
    @Builder.Default
    private double confidence = 0.0;

    /**
     * AI 生成的响应文本
     * 对查询结果的自然语言描述
     */
    private String responseText;

    /**
     * 返回的数据
     * 可以是列表、对象或其他结构化数据
     */
    private Object data;

    /**
     * 提取的参数
     * 从自然语言中提取的结构化参数
     */
    private Map<String, Object> parameters;

    /**
     * 图表配置（单个图表）
     * 推荐的可视化展示配置
     */
    private ChartConfig chartConfig;

    /**
     * 图表列表（多个图表）
     * 当需要展示多个图表时使用
     */
    private List<ChartConfig> charts;

    /**
     * 后续问题建议
     * 用户可能感兴趣的相关问题
     */
    private List<String> suggestions;

    /**
     * 推荐的后续问题（兼容旧版本）
     * @deprecated 请使用 suggestions 字段
     */
    @Deprecated
    private List<String> followUpQuestions;

    /**
     * 是否需要澄清
     * 当意图不明确或缺少关键参数时为 true
     */
    @Builder.Default
    private boolean needsClarification = false;

    /**
     * 澄清问题
     * 当 needsClarification 为 true 时，向用户提出的澄清问题
     */
    private String clarificationQuestion;

    /**
     * 预测结果
     * 当查询意图为 FORECAST 时，包含结构化的预测数据
     */
    private ForecastResult forecast;

    // ==================== P5.6 Tool-Skill Chat Integration (additive) ====================

    /**
     * 餐饮诊断意图代码 (P5.6)
     * 当查询被路由到 Tool-Skill 管线时填充，如 "RESTAURANT_COST_RIGIDITY".
     * Legacy SmartBI 意图走 intent 字段，两者互斥。
     */
    private String intentCode;

    /**
     * 执行的 Tool 名称 (P5.6)
     * 如 "restaurant_cost_rigidity_analysis"，用于前端调试和日志。
     */
    private String toolName;

    /**
     * 执行的 Skill 名称 (P5.6)
     * 当 Tool-Skill 管线使用 Skill 编排时填充，直接调用 Tool 时为 null。
     */
    private String skillName;

    /**
     * 结构化段落输出 (P5.6)
     * 由餐饮 Tool 调用 Python section endpoint 返回的结构化卡片数据.
     * 每个元素是一个 SectionPayload map: {sectionName, status, data, warnings, fromCache, computedAtMs}.
     * Legacy 查询此字段为 null，前端根据存在与否决定是否渲染 section 卡片.
     */
    private List<Map<String, Object>> sections;

    /**
     * 后续引导问题 (P5.6)
     * Tool 根据分析结果生成的 3-4 个 context-aware 下一步问题，前端渲染为可点击 chips.
     * 与 suggestions 的区别: chips 是结构化数据驱动的 (例如"看看具体的菜品毛利"), suggestions 是静态模板.
     */
    private List<String> followUpChips;

    /**
     * 简短状态消息 (P5.6)
     * 补充 responseText, 用于 web-admin chat 渲染单行标题或 toast.
     */
    private String message;

    // ==================== Helpers ====================

    /**
     * 获取有效的建议列表
     * 优先返回 suggestions，兼容旧版 followUpQuestions
     *
     * @return 建议列表
     */
    public List<String> getEffectiveSuggestions() {
        return suggestions != null && !suggestions.isEmpty() ? suggestions : followUpQuestions;
    }

    /**
     * 快速创建成功响应
     */
    public static NLQueryResponse success(String intent, String responseText, Object data) {
        return NLQueryResponse.builder()
                .intent(intent)
                .confidence(1.0)
                .responseText(responseText)
                .data(data)
                .needsClarification(false)
                .build();
    }

    /**
     * 快速创建带图表的成功响应
     */
    public static NLQueryResponse successWithChart(String intent, String responseText,
                                                    Object data, ChartConfig chartConfig) {
        return NLQueryResponse.builder()
                .intent(intent)
                .confidence(1.0)
                .responseText(responseText)
                .data(data)
                .chartConfig(chartConfig)
                .needsClarification(false)
                .build();
    }

    /**
     * 快速创建需要澄清的响应
     */
    public static NLQueryResponse needClarification(String clarificationQuestion) {
        return NLQueryResponse.builder()
                .needsClarification(true)
                .clarificationQuestion(clarificationQuestion)
                .build();
    }
}

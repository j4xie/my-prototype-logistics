package com.cretas.aims.dto.arena;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * ArenaRL 比较评估量规 DTO
 *
 * 定义两两比较时的评估维度和权重：
 * - 意图匹配维度
 * - 工具选择维度
 * - 自定义维度支持
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class ComparisonRubric {

    /**
     * 量规名称
     */
    private String name;

    /**
     * 量规描述
     */
    private String description;

    /**
     * 评估维度列表
     */
    private List<Dimension> dimensions;

    /**
     * 评估维度内部类
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Dimension {
        /**
         * 维度ID
         */
        private String id;

        /**
         * 维度名称
         */
        private String name;

        /**
         * 维度描述
         */
        private String description;

        /**
         * 维度权重 (0.0-1.0)
         */
        private Double weight;

        /**
         * 评分标准描述
         * 用于指导 LLM 如何评分
         */
        private String scoringCriteria;
    }

    /**
     * 意图识别默认量规
     * 用于比较两个意图候选
     */
    public static ComparisonRubric intentDisambiguationRubric() {
        return ComparisonRubric.builder()
                .name("Intent Disambiguation Rubric")
                .description("用于评估两个意图候选哪个更匹配用户输入")
                .dimensions(List.of(
                        Dimension.builder()
                                .id("semantic_alignment")
                                .name("语义对齐")
                                .description("候选意图与用户输入的语义匹配程度")
                                .weight(0.30)
                                .scoringCriteria("评估候选意图的定义是否与用户表达的核心诉求一致。" +
                                        "1.0=完全匹配, 0.5=部分匹配, 0.0=不相关")
                                .build(),
                        Dimension.builder()
                                .id("parameter_coverage")
                                .name("参数覆盖")
                                .description("用户输入中提及的实体是否能被候选意图的参数捕获")
                                .weight(0.25)
                                .scoringCriteria("检查用户提到的时间、数量、名称等是否对应意图的必填/选填参数。" +
                                        "1.0=完全覆盖, 0.5=部分覆盖, 0.0=参数不匹配")
                                .build(),
                        Dimension.builder()
                                .id("domain_match")
                                .name("领域匹配")
                                .description("候选意图的业务领域是否与用户上下文一致")
                                .weight(0.20)
                                .scoringCriteria("判断意图所属的功能模块(生产/库存/质检)是否与用户场景吻合。" +
                                        "1.0=完全吻合, 0.5=相关领域, 0.0=无关领域")
                                .build(),
                        Dimension.builder()
                                .id("action_type_match")
                                .name("操作类型匹配")
                                .description("用户意图的操作类型(查询/创建/更新/删除)是否匹配")
                                .weight(0.15)
                                .scoringCriteria("识别用户想要执行的操作类型，与候选意图的 actionType 对比。" +
                                        "1.0=完全匹配, 0.5=可兼容, 0.0=冲突")
                                .build(),
                        Dimension.builder()
                                .id("ambiguity_resolution")
                                .name("歧义消解能力")
                                .description("候选意图是否能有效消解用户输入中的歧义")
                                .weight(0.10)
                                .scoringCriteria("如果用户输入存在多种解读，评估候选意图是否提供了合理的默认解释。" +
                                        "1.0=完美消解, 0.5=部分消解, 0.0=引入更多歧义")
                                .build()
                ))
                .build();
    }

    /**
     * 工具选择默认量规
     * 用于比较两个工具候选
     */
    public static ComparisonRubric toolSelectionRubric() {
        return ComparisonRubric.builder()
                .name("Tool Selection Rubric")
                .description("用于评估两个工具候选哪个更适合执行用户请求")
                .dimensions(List.of(
                        Dimension.builder()
                                .id("capability_match")
                                .name("能力匹配")
                                .description("工具的功能是否与用户需求匹配")
                                .weight(0.35)
                                .scoringCriteria("评估工具的核心功能是否能完成用户请求的任务。" +
                                        "1.0=完全胜任, 0.5=部分胜任, 0.0=无法完成")
                                .build(),
                        Dimension.builder()
                                .id("parameter_fit")
                                .name("参数适配")
                                .description("用户提供的信息是否能满足工具的参数需求")
                                .weight(0.30)
                                .scoringCriteria("检查用户输入能否提供工具所需的必填参数。" +
                                        "1.0=完全满足, 0.5=部分满足需推断, 0.0=缺失关键参数")
                                .build(),
                        Dimension.builder()
                                .id("specificity")
                                .name("精确度")
                                .description("工具的粒度是否与用户需求的精确度匹配")
                                .weight(0.20)
                                .scoringCriteria("判断工具是过于通用还是过于具体。" +
                                        "1.0=粒度完美, 0.5=可接受, 0.0=粒度不匹配")
                                .build(),
                        Dimension.builder()
                                .id("side_effects")
                                .name("副作用风险")
                                .description("工具执行是否可能产生非预期的副作用")
                                .weight(0.15)
                                .scoringCriteria("评估工具是否会执行用户未明确请求的额外操作。" +
                                        "1.0=无副作用, 0.5=可控副作用, 0.0=高风险副作用")
                                .build()
                ))
                .build();
    }

    /**
     * Agent 分析默认量规
     * 用于比较多个 Agent 分析结果
     */
    public static ComparisonRubric agentAnalysisRubric() {
        return ComparisonRubric.builder()
                .name("Agent Analysis Rubric")
                .description("用于评估两个 Agent 分析结果哪个更优")
                .dimensions(List.of(
                        Dimension.builder()
                                .id("relevance")
                                .name("相关性")
                                .description("分析结果与用户问题的相关程度")
                                .weight(0.30)
                                .scoringCriteria("评估分析是否直接回答了用户的核心问题。" +
                                        "1.0=高度相关, 0.5=部分相关, 0.0=离题")
                                .build(),
                        Dimension.builder()
                                .id("completeness")
                                .name("完整性")
                                .description("分析是否覆盖了问题的所有关键方面")
                                .weight(0.25)
                                .scoringCriteria("检查分析是否遗漏重要维度或数据。" +
                                        "1.0=完整覆盖, 0.5=基本覆盖, 0.0=严重遗漏")
                                .build(),
                        Dimension.builder()
                                .id("accuracy")
                                .name("准确性")
                                .description("分析中的数据和结论是否准确")
                                .weight(0.25)
                                .scoringCriteria("验证引用的数据是否正确，推理是否合理。" +
                                        "1.0=完全准确, 0.5=基本准确, 0.0=存在错误")
                                .build(),
                        Dimension.builder()
                                .id("actionability")
                                .name("可操作性")
                                .description("分析结果是否提供了可执行的建议")
                                .weight(0.20)
                                .scoringCriteria("评估分析是否给出了具体的下一步行动建议。" +
                                        "1.0=清晰可行, 0.5=需要细化, 0.0=无法执行")
                                .build()
                ))
                .build();
    }

    /**
     * 计算加权总分
     * @param dimensionScores 各维度分数 (key: dimensionId, value: 0.0-1.0)
     * @return 加权总分
     */
    public double calculateWeightedScore(Map<String, Double> dimensionScores) {
        if (dimensions == null || dimensions.isEmpty()) {
            return 0.0;
        }

        double weightedSum = 0.0;
        double totalWeight = 0.0;

        for (Dimension dim : dimensions) {
            Double score = dimensionScores.get(dim.getId());
            if (score != null) {
                weightedSum += score * dim.getWeight();
                totalWeight += dim.getWeight();
            }
        }

        return totalWeight > 0 ? weightedSum / totalWeight : 0.0;
    }
}

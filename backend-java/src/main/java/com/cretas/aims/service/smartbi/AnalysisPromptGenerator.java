package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.DataFeatureResult;
import com.cretas.aims.dto.smartbi.FieldMappingResult;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

/**
 * AI 分析 Prompt 动态生成器
 *
 * 根据数据特征自动生成精准的分析 Prompt：
 * - 财务数据 + 预实对比字段 → 预算执行分析 Prompt
 * - 销售数据 + 时间序列 → 趋势分析 Prompt
 * - 成本数据 + 多项明细 → 成本结构分析 Prompt
 * - 通用数据 → 智能对比分析 Prompt
 *
 * 支持中英文自动适配
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-23
 */
@Slf4j
@Component
public class AnalysisPromptGenerator {

    // ==================== Prompt 模板常量 ====================

    /**
     * 预算执行分析 Prompt（中文）
     */
    private static final String BUDGET_ANALYSIS_PROMPT_ZH = """
请分析以下财务数据的预算执行情况：

## 分析数据
{{dataJson}}

## 请重点分析以下方面：
1. **整体预算完成率**：计算实际支出与预算的比率，评估整体执行情况
2. **超预算项目识别**：哪些项目/部门超出预算？超出比例是多少？
3. **节约项目识别**：哪些项目/部门有预算结余？节约比例是多少？
4. **差异原因分析**：主要的预算差异可能由什么原因导致？
5. **下期预算建议**：基于执行情况，对下一期预算编制有什么建议？

请用简洁专业的语言回答，控制在300字以内。
""";

    /**
     * 预算执行分析 Prompt（英文）
     */
    private static final String BUDGET_ANALYSIS_PROMPT_EN = """
Please analyze the budget execution of the following financial data:

## Analysis Data
{{dataJson}}

## Focus on the following aspects:
1. **Overall Budget Completion Rate**: Calculate the ratio of actual to budget, assess execution
2. **Over-Budget Items**: Which items/departments exceeded budget? By what percentage?
3. **Under-Budget Items**: Which items/departments have budget surplus? Saving percentage?
4. **Variance Analysis**: What are the main causes of budget variances?
5. **Next Period Recommendations**: Based on execution, what budget planning suggestions?

Please answer concisely and professionally, within 300 words.
""";

    /**
     * 趋势分析 Prompt（中文）
     */
    private static final String TREND_ANALYSIS_PROMPT_ZH = """
请分析以下时间序列数据的趋势变化：

## 分析数据
{{dataJson}}

## 请重点分析以下方面：
1. **整体趋势判断**：数据是呈上升、下降还是平稳趋势？
2. **季节性波动**：是否存在周期性或季节性波动模式？
3. **异常点识别**：是否有明显异常的数据点？可能的原因是什么？
4. **同比/环比分析**：与上期相比变化如何？
5. **趋势预测**：基于当前趋势，对未来走势有什么判断？

请用简洁专业的语言回答，控制在300字以内。
""";

    /**
     * 趋势分析 Prompt（英文）
     */
    private static final String TREND_ANALYSIS_PROMPT_EN = """
Please analyze the trend of the following time series data:

## Analysis Data
{{dataJson}}

## Focus on the following aspects:
1. **Overall Trend**: Is the data trending up, down, or stable?
2. **Seasonality**: Are there cyclical or seasonal patterns?
3. **Anomaly Detection**: Are there obvious anomalies? Possible causes?
4. **YoY/MoM Comparison**: How does it compare to previous periods?
5. **Trend Forecast**: Based on current trends, what's the future outlook?

Please answer concisely and professionally, within 300 words.
""";

    /**
     * 成本结构分析 Prompt（中文）
     */
    private static final String STRUCTURE_ANALYSIS_PROMPT_ZH = """
请分析以下数据的结构组成：

## 分析数据
{{dataJson}}

## 请重点分析以下方面：
1. **各项占比情况**：各分类/项目在整体中的占比是多少？
2. **占比合理性**：哪些项目占比过高或过低？是否合理？
3. **结构变化**：与历史数据相比，结构有什么变化？
4. **行业对比**：与行业平均水平相比如何？（如有参考数据）
5. **优化建议**：结构上有什么优化空间？

请用简洁专业的语言回答，控制在300字以内。
""";

    /**
     * 成本结构分析 Prompt（英文）
     */
    private static final String STRUCTURE_ANALYSIS_PROMPT_EN = """
Please analyze the composition structure of the following data:

## Analysis Data
{{dataJson}}

## Focus on the following aspects:
1. **Proportion Analysis**: What's the share of each category/item in the total?
2. **Reasonableness**: Which items have unusually high or low proportions?
3. **Structural Changes**: How has the structure changed compared to historical data?
4. **Industry Benchmark**: How does it compare to industry averages? (if available)
5. **Optimization Suggestions**: What structural improvements can be made?

Please answer concisely and professionally, within 300 words.
""";

    /**
     * 对比分析 Prompt（中文）
     */
    private static final String COMPARISON_ANALYSIS_PROMPT_ZH = """
请对比分析以下数据：

## 分析数据
{{dataJson}}

## 请重点分析以下方面：
1. **关键差异**：不同分组/维度之间的主要差异是什么？
2. **表现最佳**：哪个分组/项目表现最好？有什么特点？
3. **表现最差**：哪个分组/项目表现最差？可能的原因？
4. **差距分析**：最好与最差之间的差距有多大？
5. **改进建议**：针对表现较差的分组，有什么改进建议？

请用简洁专业的语言回答，控制在300字以内。
""";

    /**
     * 对比分析 Prompt（英文）
     */
    private static final String COMPARISON_ANALYSIS_PROMPT_EN = """
Please compare and analyze the following data:

## Analysis Data
{{dataJson}}

## Focus on the following aspects:
1. **Key Differences**: What are the main differences between groups/dimensions?
2. **Best Performer**: Which group/item performs best? What are its characteristics?
3. **Worst Performer**: Which group/item performs worst? Possible causes?
4. **Gap Analysis**: How large is the gap between best and worst?
5. **Improvement Suggestions**: What improvements can be made for underperformers?

Please answer concisely and professionally, within 300 words.
""";

    /**
     * 通用分析 Prompt（中文）
     */
    private static final String GENERAL_ANALYSIS_PROMPT_ZH = """
请分析以下数据：

## 分析数据
{{dataJson}}

## 请提供以下分析：
1. **数据概述**：数据的整体情况是怎样的？
2. **关键发现**：从数据中能发现哪些重要信息？
3. **异常识别**：是否有需要关注的异常情况？
4. **业务洞察**：这些数据反映了什么业务问题或机会？
5. **行动建议**：基于分析，有什么建议的行动？

请用简洁专业的语言回答，控制在200字以内。
""";

    /**
     * 通用分析 Prompt（英文）
     */
    private static final String GENERAL_ANALYSIS_PROMPT_EN = """
Please analyze the following data:

## Analysis Data
{{dataJson}}

## Please provide the following analysis:
1. **Data Overview**: What's the overall picture of the data?
2. **Key Findings**: What important insights can be found?
3. **Anomaly Detection**: Are there any concerns or anomalies?
4. **Business Insights**: What business issues or opportunities does this reveal?
5. **Action Recommendations**: Based on the analysis, what actions are suggested?

Please answer concisely and professionally, within 200 words.
""";

    // ==================== 系统提示词 ====================

    private static final String SYSTEM_PROMPT_ZH = "你是一个专业的数据分析师。请根据提供的数据生成简洁、专业、有洞察力的分析结论。" +
            "分析应结合数据特点，提供具体的数字和百分比，避免泛泛而谈。使用中文回答。";

    private static final String SYSTEM_PROMPT_EN = "You are a professional data analyst. Please generate concise, professional, and insightful analysis based on the provided data. " +
            "The analysis should include specific numbers and percentages, avoiding vague statements. Answer in English.";

    // ==================== 字段检测关键词 ====================

    // 预算相关字段
    private static final Set<String> BUDGET_FIELD_KEYWORDS = Set.of(
            "budget", "预算", "budget_amount", "budgetamount", "plan", "计划",
            "planned", "target", "目标", "quota", "定额"
    );

    // 实际值相关字段
    private static final Set<String> ACTUAL_FIELD_KEYWORDS = Set.of(
            "actual", "实际", "actual_amount", "actualamount", "real",
            "执行", "execute", "spent", "支出"
    );

    // 时间相关字段
    private static final Set<String> TIME_FIELD_KEYWORDS = Set.of(
            "date", "time", "日期", "时间", "month", "月份", "year", "年",
            "quarter", "季度", "week", "周", "period", "期间"
    );

    // 分类相关字段
    private static final Set<String> CATEGORY_FIELD_KEYWORDS = Set.of(
            "category", "分类", "type", "类型", "department", "部门",
            "region", "区域", "product", "产品", "item", "项目"
    );

    // ==================== 公开方法 ====================

    /**
     * 根据分析上下文生成 Prompt
     *
     * @param context 分析上下文
     * @return 生成的 Prompt
     */
    public GeneratedPrompt generatePrompt(AnalysisContext context) {
        if (context == null) {
            log.warn("分析上下文为空，使用默认 Prompt");
            return createDefaultPrompt(context);
        }

        // 1. 确定分析模板类型
        AnalysisTemplateType templateType = determineTemplateType(context);
        log.info("检测到分析类型: {}", templateType);

        // 2. 检测语言
        boolean isChinese = detectChineseData(context);
        log.debug("数据语言: {}", isChinese ? "中文" : "英文");

        // 3. 获取对应模板
        String promptTemplate = getPromptTemplate(templateType, isChinese);
        String systemPrompt = isChinese ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN;

        // 4. 填充模板
        String filledPrompt = fillTemplate(promptTemplate, context);

        // 5. 增强 Prompt（添加数据特定的分析提示）
        String enhancedPrompt = enrichPrompt(filledPrompt, context, templateType);

        return GeneratedPrompt.builder()
                .systemPrompt(systemPrompt)
                .userPrompt(enhancedPrompt)
                .templateType(templateType)
                .language(isChinese ? "zh" : "en")
                .build();
    }

    /**
     * 简化方法：直接根据数据类型和聚合数据生成 Prompt
     *
     * @param dataType       数据类型（SALES, FINANCE 等）
     * @param fieldMappings  字段映射列表
     * @param aggregatedData 聚合后的数据
     * @return 生成的 Prompt
     */
    public GeneratedPrompt generatePrompt(String dataType,
                                          List<FieldMappingResult> fieldMappings,
                                          Map<String, Object> aggregatedData) {
        AnalysisContext context = AnalysisContext.builder()
                .dataType(dataType)
                .fieldMappings(fieldMappings)
                .aggregatedData(aggregatedData)
                .build();

        return generatePrompt(context);
    }

    // ==================== 模板类型判断 ====================

    /**
     * 确定分析模板类型
     */
    private AnalysisTemplateType determineTemplateType(AnalysisContext context) {
        // 1. 检查是否有预算和实际值字段 → 预算分析
        if (hasBudgetAndActualFields(context)) {
            log.debug("检测到预算和实际值字段，使用预算分析模板");
            return AnalysisTemplateType.BUDGET_ANALYSIS;
        }

        // 2. 检查是否有时间序列 → 趋势分析
        if (hasTimeSeriesData(context)) {
            log.debug("检测到时间序列数据，使用趋势分析模板");
            return AnalysisTemplateType.TREND_ANALYSIS;
        }

        // 3. 检查是否有多个分类项目 → 结构分析
        if (hasMultipleCategoriesForStructure(context)) {
            log.debug("检测到多分类数据，使用结构分析模板");
            return AnalysisTemplateType.STRUCTURE_ANALYSIS;
        }

        // 4. 检查是否有对比维度 → 对比分析
        if (hasComparisonDimensions(context)) {
            log.debug("检测到对比维度，使用对比分析模板");
            return AnalysisTemplateType.COMPARISON_ANALYSIS;
        }

        // 5. 默认使用通用分析
        log.debug("未检测到特定模式，使用通用分析模板");
        return AnalysisTemplateType.GENERAL_ANALYSIS;
    }

    /**
     * 检查是否有预算和实际值字段
     */
    private boolean hasBudgetAndActualFields(AnalysisContext context) {
        if (context.getFieldMappings() == null) {
            // 检查聚合数据中是否有预算相关字段
            if (context.getAggregatedData() != null) {
                Map<String, Object> data = context.getAggregatedData();
                boolean hasBudget = data.containsKey("totalBudget") || data.containsKey("budgetAmount");
                boolean hasActual = data.containsKey("totalActual") || data.containsKey("actualAmount");
                return hasBudget && hasActual;
            }
            return false;
        }

        boolean hasBudget = false;
        boolean hasActual = false;

        for (FieldMappingResult mapping : context.getFieldMappings()) {
            String fieldName = toLowerCase(mapping.getStandardField());
            String originalName = toLowerCase(mapping.getOriginalColumn());

            if (matchesKeywords(fieldName, BUDGET_FIELD_KEYWORDS) ||
                matchesKeywords(originalName, BUDGET_FIELD_KEYWORDS)) {
                hasBudget = true;
            }

            if (matchesKeywords(fieldName, ACTUAL_FIELD_KEYWORDS) ||
                matchesKeywords(originalName, ACTUAL_FIELD_KEYWORDS)) {
                hasActual = true;
            }

            if (hasBudget && hasActual) {
                return true;
            }
        }

        return hasBudget && hasActual;
    }

    /**
     * 检查是否有时间序列数据
     */
    private boolean hasTimeSeriesData(AnalysisContext context) {
        // 检查字段映射中是否有日期字段
        if (context.getFieldMappings() != null) {
            for (FieldMappingResult mapping : context.getFieldMappings()) {
                if ("DATE".equals(mapping.getDataType())) {
                    return true;
                }
                String fieldName = toLowerCase(mapping.getStandardField());
                String originalName = toLowerCase(mapping.getOriginalColumn());

                if (matchesKeywords(fieldName, TIME_FIELD_KEYWORDS) ||
                    matchesKeywords(originalName, TIME_FIELD_KEYWORDS)) {
                    return true;
                }
            }
        }

        // 检查数据特征
        if (context.getDataFeatures() != null) {
            for (DataFeatureResult feature : context.getDataFeatures()) {
                if (feature.getDataType() == DataFeatureResult.DataType.DATE) {
                    return true;
                }
            }
        }

        // 检查聚合数据
        if (context.getAggregatedData() != null) {
            return context.getAggregatedData().containsKey("byDate") ||
                   context.getAggregatedData().containsKey("byMonth") ||
                   context.getAggregatedData().containsKey("byYear");
        }

        return false;
    }

    /**
     * 检查是否有多个分类适合结构分析
     */
    private boolean hasMultipleCategoriesForStructure(AnalysisContext context) {
        // 检查聚合数据中是否有分类维度
        if (context.getAggregatedData() != null) {
            Map<String, Object> data = context.getAggregatedData();

            // 检查是否有多个分类
            int categoryDimensions = 0;
            if (data.containsKey("byCategory") && data.get("byCategory") instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, ?> categories = (Map<String, ?>) data.get("byCategory");
                if (categories.size() >= 3) {
                    categoryDimensions++;
                }
            }
            if (data.containsKey("byDepartment") && data.get("byDepartment") instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, ?> departments = (Map<String, ?>) data.get("byDepartment");
                if (departments.size() >= 3) {
                    categoryDimensions++;
                }
            }

            return categoryDimensions >= 1;
        }

        // 检查字段映射中的分类字段
        if (context.getFieldMappings() != null) {
            int categoryFields = 0;
            for (FieldMappingResult mapping : context.getFieldMappings()) {
                if ("CATEGORICAL".equals(mapping.getDataType())) {
                    categoryFields++;
                }
            }
            return categoryFields >= 1;
        }

        return false;
    }

    /**
     * 检查是否有对比维度
     */
    private boolean hasComparisonDimensions(AnalysisContext context) {
        if (context.getAggregatedData() == null) {
            return false;
        }

        Map<String, Object> data = context.getAggregatedData();

        // 检查是否有多个分组维度
        int groupDimensions = 0;
        if (data.containsKey("byRegion") && data.get("byRegion") instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, ?> regions = (Map<String, ?>) data.get("byRegion");
            if (regions.size() >= 2) {
                groupDimensions++;
            }
        }
        if (data.containsKey("byDepartment") && data.get("byDepartment") instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, ?> departments = (Map<String, ?>) data.get("byDepartment");
            if (departments.size() >= 2) {
                groupDimensions++;
            }
        }
        if (data.containsKey("byCategory") && data.get("byCategory") instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, ?> categories = (Map<String, ?>) data.get("byCategory");
            if (categories.size() >= 2) {
                groupDimensions++;
            }
        }

        return groupDimensions >= 1;
    }

    // ==================== 语言检测 ====================

    /**
     * 检测数据是否为中文
     */
    private boolean detectChineseData(AnalysisContext context) {
        // 检查字段映射中的原始列名
        if (context.getFieldMappings() != null) {
            for (FieldMappingResult mapping : context.getFieldMappings()) {
                if (containsChinese(mapping.getOriginalColumn())) {
                    return true;
                }
            }
        }

        // 检查聚合数据的 key
        if (context.getAggregatedData() != null) {
            for (String key : context.getAggregatedData().keySet()) {
                if (containsChinese(key)) {
                    return true;
                }
            }
        }

        // 默认使用中文
        return true;
    }

    /**
     * 检查字符串是否包含中文
     */
    private boolean containsChinese(String str) {
        if (str == null || str.isEmpty()) {
            return false;
        }
        for (char c : str.toCharArray()) {
            if (Character.UnicodeScript.of(c) == Character.UnicodeScript.HAN) {
                return true;
            }
        }
        return false;
    }

    // ==================== 模板获取和填充 ====================

    /**
     * 获取 Prompt 模板
     */
    private String getPromptTemplate(AnalysisTemplateType templateType, boolean isChinese) {
        switch (templateType) {
            case BUDGET_ANALYSIS:
                return isChinese ? BUDGET_ANALYSIS_PROMPT_ZH : BUDGET_ANALYSIS_PROMPT_EN;
            case TREND_ANALYSIS:
                return isChinese ? TREND_ANALYSIS_PROMPT_ZH : TREND_ANALYSIS_PROMPT_EN;
            case STRUCTURE_ANALYSIS:
                return isChinese ? STRUCTURE_ANALYSIS_PROMPT_ZH : STRUCTURE_ANALYSIS_PROMPT_EN;
            case COMPARISON_ANALYSIS:
                return isChinese ? COMPARISON_ANALYSIS_PROMPT_ZH : COMPARISON_ANALYSIS_PROMPT_EN;
            default:
                return isChinese ? GENERAL_ANALYSIS_PROMPT_ZH : GENERAL_ANALYSIS_PROMPT_EN;
        }
    }

    /**
     * 填充模板
     */
    private String fillTemplate(String template, AnalysisContext context) {
        if (template == null || context == null) {
            return template;
        }

        String result = template;

        // 替换数据占位符
        if (context.getDataJson() != null) {
            result = result.replace("{{dataJson}}", context.getDataJson());
        } else if (context.getAggregatedData() != null) {
            result = result.replace("{{dataJson}}", formatDataForPrompt(context.getAggregatedData()));
        } else {
            result = result.replace("{{dataJson}}", "暂无数据");
        }

        return result;
    }

    /**
     * 格式化数据用于 Prompt
     */
    private String formatDataForPrompt(Map<String, Object> data) {
        if (data == null || data.isEmpty()) {
            return "暂无数据";
        }

        StringBuilder sb = new StringBuilder();

        // 添加汇总数据
        if (data.containsKey("totalAmount")) {
            sb.append("- 总金额: ").append(data.get("totalAmount")).append("\n");
        }
        if (data.containsKey("totalCost")) {
            sb.append("- 总成本: ").append(data.get("totalCost")).append("\n");
        }
        if (data.containsKey("totalBudget")) {
            sb.append("- 预算总额: ").append(data.get("totalBudget")).append("\n");
        }
        if (data.containsKey("totalActual")) {
            sb.append("- 实际总额: ").append(data.get("totalActual")).append("\n");
        }
        if (data.containsKey("recordCount")) {
            sb.append("- 记录数: ").append(data.get("recordCount")).append("\n");
        }

        // 添加按时间分组的数据
        if (data.containsKey("byDate") && data.get("byDate") instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, ?> byDate = (Map<String, ?>) data.get("byDate");
            if (!byDate.isEmpty()) {
                sb.append("\n### 按日期分组:\n");
                byDate.forEach((k, v) -> sb.append("  - ").append(k).append(": ").append(v).append("\n"));
            }
        }

        // 添加按分类分组的数据
        if (data.containsKey("byCategory") && data.get("byCategory") instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, ?> byCategory = (Map<String, ?>) data.get("byCategory");
            if (!byCategory.isEmpty()) {
                sb.append("\n### 按分类分组:\n");
                byCategory.forEach((k, v) -> sb.append("  - ").append(k).append(": ").append(v).append("\n"));
            }
        }

        // 添加按部门分组的数据
        if (data.containsKey("byDepartment") && data.get("byDepartment") instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, ?> byDept = (Map<String, ?>) data.get("byDepartment");
            if (!byDept.isEmpty()) {
                sb.append("\n### 按部门分组:\n");
                byDept.forEach((k, v) -> sb.append("  - ").append(k).append(": ").append(v).append("\n"));
            }
        }

        // 添加按区域分组的数据
        if (data.containsKey("byRegion") && data.get("byRegion") instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, ?> byRegion = (Map<String, ?>) data.get("byRegion");
            if (!byRegion.isEmpty()) {
                sb.append("\n### 按区域分组:\n");
                byRegion.forEach((k, v) -> sb.append("  - ").append(k).append(": ").append(v).append("\n"));
            }
        }

        // 添加预算差异信息
        if (data.containsKey("budgetVariance")) {
            sb.append("\n### 预算差异:\n");
            sb.append("  - 差异金额: ").append(data.get("budgetVariance")).append("\n");
            if (data.containsKey("budgetVarianceRate")) {
                sb.append("  - 差异率: ").append(data.get("budgetVarianceRate")).append("%\n");
            }
        }

        return sb.toString();
    }

    /**
     * 增强 Prompt（添加数据特定的分析提示）
     */
    private String enrichPrompt(String basePrompt, AnalysisContext context,
                                 AnalysisTemplateType templateType) {
        if (context == null || context.getAggregatedData() == null) {
            return basePrompt;
        }

        StringBuilder enrichments = new StringBuilder();

        // 根据模板类型添加额外提示
        switch (templateType) {
            case BUDGET_ANALYSIS:
                enrichWithBudgetHints(enrichments, context);
                break;
            case TREND_ANALYSIS:
                enrichWithTrendHints(enrichments, context);
                break;
            case STRUCTURE_ANALYSIS:
                enrichWithStructureHints(enrichments, context);
                break;
            default:
                break;
        }

        if (enrichments.length() > 0) {
            return basePrompt + "\n\n## 额外分析提示:\n" + enrichments;
        }

        return basePrompt;
    }

    /**
     * 添加预算分析相关提示
     */
    private void enrichWithBudgetHints(StringBuilder sb, AnalysisContext context) {
        Map<String, Object> data = context.getAggregatedData();

        if (data.containsKey("budgetVarianceRate")) {
            Object varianceRate = data.get("budgetVarianceRate");
            if (varianceRate instanceof Number) {
                double rate = ((Number) varianceRate).doubleValue();
                if (rate > 10) {
                    sb.append("- 注意：预算超支率超过10%，请重点分析超支原因\n");
                } else if (rate < -10) {
                    sb.append("- 注意：预算结余率超过10%，请分析是否存在预算编制过高的问题\n");
                }
            }
        }
    }

    /**
     * 添加趋势分析相关提示
     */
    private void enrichWithTrendHints(StringBuilder sb, AnalysisContext context) {
        Map<String, Object> data = context.getAggregatedData();

        if (data.containsKey("byDate") && data.get("byDate") instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, ?> byDate = (Map<String, ?>) data.get("byDate");
            if (byDate.size() >= 6) {
                sb.append("- 数据点较多（").append(byDate.size()).append("期），请注意识别长期趋势\n");
            } else if (byDate.size() < 3) {
                sb.append("- 数据点较少，趋势判断可能不够准确，请谨慎解读\n");
            }
        }
    }

    /**
     * 添加结构分析相关提示
     */
    private void enrichWithStructureHints(StringBuilder sb, AnalysisContext context) {
        Map<String, Object> data = context.getAggregatedData();

        if (data.containsKey("byCategory") && data.get("byCategory") instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, BigDecimal> byCategory = (Map<String, BigDecimal>) data.get("byCategory");

            // 计算是否有单一分类占比过高
            BigDecimal total = byCategory.values().stream()
                    .filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            if (total.compareTo(BigDecimal.ZERO) > 0) {
                for (Map.Entry<String, BigDecimal> entry : byCategory.entrySet()) {
                    if (entry.getValue() != null) {
                        double ratio = entry.getValue().divide(total, 4, BigDecimal.ROUND_HALF_UP)
                                .doubleValue() * 100;
                        if (ratio > 50) {
                            sb.append("- 注意：\"").append(entry.getKey())
                                    .append("\" 占比超过50%，请关注集中度风险\n");
                            break;
                        }
                    }
                }
            }
        }
    }

    // ==================== 辅助方法 ====================

    /**
     * 创建默认 Prompt
     */
    private GeneratedPrompt createDefaultPrompt(AnalysisContext context) {
        return GeneratedPrompt.builder()
                .systemPrompt(SYSTEM_PROMPT_ZH)
                .userPrompt(GENERAL_ANALYSIS_PROMPT_ZH.replace("{{dataJson}}",
                        context != null && context.getDataJson() != null ?
                                context.getDataJson() : "暂无数据"))
                .templateType(AnalysisTemplateType.GENERAL_ANALYSIS)
                .language("zh")
                .build();
    }

    /**
     * 转换为小写
     */
    private String toLowerCase(String str) {
        return str != null ? str.toLowerCase() : "";
    }

    /**
     * 检查字符串是否匹配关键词集合
     */
    private boolean matchesKeywords(String str, Set<String> keywords) {
        if (str == null || str.isEmpty()) {
            return false;
        }
        String lower = str.toLowerCase();
        for (String keyword : keywords) {
            if (lower.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    // ==================== 内部类定义 ====================

    /**
     * 分析模板类型枚举
     */
    public enum AnalysisTemplateType {
        /**
         * 预算执行分析
         */
        BUDGET_ANALYSIS,

        /**
         * 趋势分析
         */
        TREND_ANALYSIS,

        /**
         * 结构分析
         */
        STRUCTURE_ANALYSIS,

        /**
         * 对比分析
         */
        COMPARISON_ANALYSIS,

        /**
         * 通用分析
         */
        GENERAL_ANALYSIS
    }

    /**
     * 分析上下文
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AnalysisContext {
        /**
         * 数据类型（SALES, FINANCE 等）
         */
        private String dataType;

        /**
         * 字段映射列表
         */
        private List<FieldMappingResult> fieldMappings;

        /**
         * 数据特征列表
         */
        private List<DataFeatureResult> dataFeatures;

        /**
         * 聚合后的数据
         */
        private Map<String, Object> aggregatedData;

        /**
         * 数据 JSON 字符串（可选，如果不提供会从 aggregatedData 生成）
         */
        private String dataJson;

        /**
         * 工厂 ID
         */
        private String factoryId;

        /**
         * 自定义分析提示（可选）
         */
        private String customHint;
    }

    /**
     * 生成的 Prompt
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GeneratedPrompt {
        /**
         * 系统提示词
         */
        private String systemPrompt;

        /**
         * 用户提示词（包含数据）
         */
        private String userPrompt;

        /**
         * 使用的模板类型
         */
        private AnalysisTemplateType templateType;

        /**
         * 检测到的语言 (zh/en)
         */
        private String language;
    }
}

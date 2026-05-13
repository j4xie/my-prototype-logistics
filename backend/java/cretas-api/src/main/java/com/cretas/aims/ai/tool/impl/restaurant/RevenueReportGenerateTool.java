package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.client.PythonSmartBIClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 收入管理报表生成 AI Tool — 青花椒 (R_QINGHUAJIAO_REAL) and future R_*_REAL chains.
 *
 * <p>Spec §8.4 / Task H3. Thin Java wrapper around Python /prepare endpoint.
 * Mirrors {@code FinancialChartGenerateTool} pattern.
 *
 * <p>Intent binding: see Flyway migration
 * {@code V20260513_02__revenue_report_intent.sql} which inserts a row into
 * {@code ai_intent_configs} with {@code intent_code = REVENUE_REPORT_GENERATE}
 * and {@code tool_name = revenue_report_generate} (matches {@link #getToolName()}).
 *
 * <p>LLM contract:
 * <ul>
 *   <li>{@code date_from}/{@code date_to} REQUIRED, YYYY-MM-DD; LLM must resolve
 *     '上周'/'本月' etc. before invoking.</li>
 *   <li>{@code store_names} optional; empty → all stores.</li>
 *   <li>{@code meal_periods} optional enum [午市, 晚市]; LLM may pass synonyms
 *     (下午茶, 夜宵) — Tool internalizes via {@link MealPeriodNormalizer}.</li>
 * </ul>
 *
 * @author Cretas Team
 * @since 2026-05-13
 */
@Slf4j
@Component
public class RevenueReportGenerateTool extends AbstractBusinessTool {

    @Autowired
    private PythonSmartBIClient pythonClient;

    @Override
    public String getToolName() {
        return "revenue_report_generate";
    }

    @Override
    public String getDescription() {
        return "生成餐饮收入管理报表（同比/环比/堂食外卖占比/客单人数分析）。" +
                "参数: date_from / date_to 必填 YYYY-MM-DD（LLM 须先 resolve '上周'/'本月' 等短语）；" +
                "store_names 可选，省略 = 全部门店；" +
                "meal_periods 可选 enum ['午市','晚市']（'下午茶'/'夜宵' 自动归一）。" +
                "适用场景：客户要求生成本期或对比期间的门店收入分析 Excel。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> dateFrom = new HashMap<>();
        dateFrom.put("type", "string");
        dateFrom.put("format", "date");
        dateFrom.put("description", "本期开始日期 YYYY-MM-DD (LLM 必须先 resolve '上周'/'本月' 等短语)");
        properties.put("date_from", dateFrom);

        Map<String, Object> dateTo = new HashMap<>();
        dateTo.put("type", "string");
        dateTo.put("format", "date");
        dateTo.put("description", "本期结束日期 YYYY-MM-DD (含)");
        properties.put("date_to", dateTo);

        Map<String, Object> storeNames = new HashMap<>();
        storeNames.put("type", "array");
        storeNames.put("items", Map.of("type", "string"));
        storeNames.put("description", "门店名列表 (支持模糊匹配); 省略 = 全部门店");
        properties.put("store_names", storeNames);

        Map<String, Object> mealPeriods = new HashMap<>();
        mealPeriods.put("type", "array");
        mealPeriods.put("items", Map.of("type", "string", "enum", List.of("午市", "晚市")));
        mealPeriods.put(
            "description",
            "班次过滤; 省略 = 全班次。Tool 内化映射: '下午茶' -> '午市', '夜宵' -> '晚市'"
        );
        properties.put("meal_periods", mealPeriods);

        schema.put("properties", properties);
        schema.put("required", List.of("date_from", "date_to"));
        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return List.of("date_from", "date_to");
    }

    @Override
    @SuppressWarnings("unchecked")
    protected Map<String, Object> doExecute(
            String factoryId,
            Map<String, Object> params,
            Map<String, Object> context) throws Exception {

        log.info("生成收入管理报表 - factoryId={}, params={}", factoryId, params);

        // 1. Normalize meal_periods (LLM synonyms → enum). Reject unknowns.
        List<String> rawMealPeriods = (List<String>) params.getOrDefault(
            "meal_periods", Collections.emptyList()
        );
        List<String> mealPeriods;
        try {
            mealPeriods = MealPeriodNormalizer.normalize(rawMealPeriods);
        } catch (IllegalArgumentException e) {
            return buildSimpleResult("班次参数错误: " + e.getMessage(), null);
        }

        // 2. Build Python /prepare request.
        Map<String, Object> request = new HashMap<>();
        request.put("store_names", params.getOrDefault("store_names", Collections.emptyList()));
        request.put("date_from", params.get("date_from"));
        request.put("date_to", params.get("date_to"));
        request.put("meal_periods", mealPeriods);

        // 3. Call Python.
        String endpoint = "/api/smartbi/" + factoryId + "/revenue-report/prepare";
        Map<String, Object> response = pythonClient.callRevenueReport(endpoint, request);

        if (response == null) {
            return buildSimpleResult("收入管理报表生成失败：Python 服务不可用", null);
        }

        Boolean success = (Boolean) response.get("success");
        if (Boolean.FALSE.equals(success)) {
            String error = (String) response.getOrDefault("error", "未知错误");
            return buildSimpleResult("收入管理报表生成失败: " + error, response);
        }

        Map<String, Object> data = (Map<String, Object>) response.get("data");
        if (data == null) {
            return buildSimpleResult("收入管理报表响应缺少 data 字段", response);
        }
        Map<String, Object> summary = (Map<String, Object>) data.getOrDefault(
            "summary", Collections.emptyMap()
        );

        Object fileSizeRaw = summary.get("file_size_bytes");
        double fileKb = (fileSizeRaw instanceof Number)
            ? ((Number) fileSizeRaw).doubleValue() / 1024.0 : 0;
        boolean cacheHit = Boolean.TRUE.equals(summary.get("cache_hit"));

        String message = String.format(
            "已生成 %s ~ %s 收入管理报表（%s 门店，文件 %.1f KB%s）",
            params.get("date_from"), params.get("date_to"),
            String.valueOf(summary.getOrDefault("store_count", "?")),
            fileKb,
            cacheHit ? "，缓存命中" : ""
        );
        return buildSimpleResult(message, Map.of(
            "download_url", data.getOrDefault("download_url", ""),
            "summary", summary
        ));
    }
}

package com.cretas.aims.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * AI成本分析服务
 * 负责调用AI服务进行批次成本分析
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Service
public class AIAnalysisService {
    private static final Logger log = LoggerFactory.getLogger(AIAnalysisService.class);

    @Value("${cretas.ai.service.url:http://localhost:8085}")
    private String aiServiceUrl;

    @Value("${cretas.ai.service.timeout:30000}")
    private int timeout;

    private final RestTemplate restTemplate;

    public AIAnalysisService() {
        this.restTemplate = new RestTemplate();
    }

    /**
     * 调用AI分析批次成本
     *
     * @param factoryId 工厂ID
     * @param batchId 批次ID
     * @param costData 成本数据
     * @param sessionId 会话ID（可选，用于多轮对话）
     * @param customMessage 自定义问题（可选）
     * @return AI分析结果
     */
    public Map<String, Object> analyzeCost(String factoryId, String batchId,
                                           Map<String, Object> costData,
                                           String sessionId,
                                           String customMessage) {
        // 默认开启思考模式
        return analyzeCost(factoryId, batchId, costData, sessionId, customMessage, true, 50);
    }

    /**
     * 调用AI分析批次成本（支持思考模式）
     *
     * @param factoryId 工厂ID
     * @param batchId 批次ID
     * @param costData 成本数据
     * @param sessionId 会话ID（可选，用于多轮对话）
     * @param customMessage 自定义问题（可选）
     * @param enableThinking 是否启用思考模式（默认true）
     * @param thinkingBudget 思考预算 10-100（默认50）
     * @return AI分析结果
     */
    public Map<String, Object> analyzeCost(String factoryId, String batchId,
                                           Map<String, Object> costData,
                                           String sessionId,
                                           String customMessage,
                                           Boolean enableThinking,
                                           Integer thinkingBudget) {
        try {
            // 1. 格式化成本数据为AI提示词
            String message = customMessage != null && !customMessage.trim().isEmpty()
                ? customMessage
                : formatCostDataForAI(factoryId, batchId, costData);

            // 2. 构建请求
            String url = aiServiceUrl + "/api/ai/chat";
            Map<String, Object> request = new HashMap<>();
            request.put("message", message);
            request.put("user_id", factoryId + "_batch_" + batchId);

            if (sessionId != null && !sessionId.trim().isEmpty()) {
                request.put("session_id", sessionId);
            }

            // 思考模式参数（默认开启）
            request.put("enable_thinking", enableThinking != null ? enableThinking : true);
            request.put("thinking_budget", thinkingBudget != null ? thinkingBudget : 50);

            // 3. 发送请求
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

            log.info("调用AI服务: url={}, batchId={}, factoryId={}, enableThinking={}",
                    url, batchId, factoryId, enableThinking);
            ResponseEntity<Map> response = restTemplate.exchange(
                url, HttpMethod.POST, entity, Map.class);

            // 4. 处理响应
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> result = new HashMap<>();
                Map<String, Object> body = response.getBody();

                result.put("success", true);
                result.put("aiAnalysis", body.get("aiAnalysis"));  // Python服务返回的字段名
                result.put("reasoningContent", body.get("reasoningContent")); // 思考过程
                result.put("thinkingEnabled", body.get("thinkingEnabled"));   // 是否使用了思考模式
                result.put("sessionId", body.get("sessionId"));     // 驼峰命名
                result.put("messageCount", body.get("messageCount")); // 驼峰命名

                log.info("AI分析成功: batchId={}, sessionId={}, thinkingEnabled={}",
                        batchId, body.get("sessionId"), body.get("thinkingEnabled"));
                return result;
            } else {
                throw new RuntimeException("AI服务返回错误: " + response.getStatusCode());
            }

        } catch (Exception e) {
            log.error("AI分析失败: factoryId={}, batchId={}, error={}",
                     factoryId, batchId, e.getMessage(), e);

            // 返回友好的错误信息
            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("success", false);
            errorResult.put("error", "AI服务暂时不可用，请稍后重试");
            errorResult.put("errorDetail", e.getMessage());
            return errorResult;
        }
    }

    /**
     * 格式化成本数据为AI提示词（增强版 - 包含完整业务链数据）
     */
    @SuppressWarnings("unchecked")
    private String formatCostDataForAI(String factoryId, String batchId, Map<String, Object> costData) {
        StringBuilder sb = new StringBuilder();

        // 判断是否为增强版数据
        boolean isEnhanced = costData.containsKey("batchInfo") && costData.containsKey("materialConsumptions");

        if (isEnhanced) {
            return formatEnhancedCostData(costData);
        } else {
            // 使用原有简化格式（向后兼容）
            return formatBasicCostData(costData);
        }
    }

    /**
     * 格式化增强版成本数据（完整业务链数据）
     */
    @SuppressWarnings("unchecked")
    private String formatEnhancedCostData(Map<String, Object> costData) {
        StringBuilder sb = new StringBuilder();

        // ========== 1. 基本信息 ==========
        Map<String, Object> batchInfo = (Map<String, Object>) costData.get("batchInfo");
        if (batchInfo != null) {
            sb.append("【批次信息】\n");
            sb.append(getStringValue(batchInfo, "batchNumber", "N/A")).append(" - ");
            sb.append(getStringValue(batchInfo, "productName", "N/A"));
            sb.append(" | 状态: ").append(getStringValue(batchInfo, "status", "N/A")).append("\n");
            sb.append("计划: ").append(formatMoney(getBigDecimalValue(batchInfo, "plannedQuantity"))).append("kg");
            sb.append(" | 实际: ").append(formatMoney(getBigDecimalValue(batchInfo, "actualQuantity"))).append("kg");
            sb.append(" | 良品: ").append(formatMoney(getBigDecimalValue(batchInfo, "goodQuantity"))).append("kg");
            sb.append(" | 次品: ").append(formatMoney(getBigDecimalValue(batchInfo, "defectQuantity"))).append("kg\n");
            sb.append("良品率: ").append(formatPercent(batchInfo.get("yieldRate"))).append("%");
            sb.append(" | 效率: ").append(formatPercent(batchInfo.get("efficiency"))).append("%\n\n");
        }

        // ========== 2. 生产计划对比 ==========
        Map<String, Object> planComparison = (Map<String, Object>) costData.get("productionPlanComparison");
        if (planComparison != null) {
            sb.append("【生产计划】\n");
            sb.append("计划号: ").append(getStringValue(planComparison, "planNumber", "N/A"));
            sb.append(" | 完成率: ").append(formatPercent(planComparison.get("completionRate"))).append("%\n\n");
        }

        // ========== 3. 原材料消耗 ==========
        List<Map<String, Object>> materials = (List<Map<String, Object>>) costData.get("materialConsumptions");
        int materialCount = getIntValue(costData, "materialConsumptionCount");
        if (materials != null && !materials.isEmpty()) {
            sb.append("【原材料消耗】共").append(materialCount).append("种\n");
            for (int i = 0; i < Math.min(materials.size(), 5); i++) {  // 最多显示5种
                Map<String, Object> m = materials.get(i);
                sb.append("• ").append(getStringValue(m, "materialName", "N/A"));
                sb.append(": ").append(formatMoney(getBigDecimalValue(m, "quantity")));
                sb.append(getStringValue(m, "unit", "kg"));
                sb.append(" ¥").append(formatMoney(getBigDecimalValue(m, "cost")));

                Map<String, Object> supplier = (Map<String, Object>) m.get("supplier");
                if (supplier != null) {
                    sb.append(" (").append(getStringValue(supplier, "name", "")).append(")");
                }
                sb.append("\n");
            }
            if (materials.size() > 5) {
                sb.append("... 还有").append(materials.size() - 5).append("种原材料\n");
            }
            sb.append("原材料总成本: ¥").append(formatMoney(getBigDecimalValue(costData, "totalMaterialCost"))).append("\n\n");
        }

        // ========== 4. 设备使用 ==========
        List<Map<String, Object>> equipment = (List<Map<String, Object>>) costData.get("equipmentUsages");
        int equipmentCount = getIntValue(costData, "equipmentUsageCount");
        int totalHours = getIntValue(costData, "totalEquipmentHours");
        if (equipment != null && !equipment.isEmpty()) {
            sb.append("【设备使用】共").append(equipmentCount).append("台, ").append(totalHours).append("小时\n");
            for (int i = 0; i < Math.min(equipment.size(), 3); i++) {  // 最多显示3台
                Map<String, Object> e = equipment.get(i);
                sb.append("• ").append(getStringValue(e, "equipmentName", "N/A"));
                sb.append(": ").append(getIntValue(e, "durationHours")).append("h");
                sb.append(" ¥").append(formatMoney(getBigDecimalValue(e, "cost"))).append("\n");
            }
            sb.append("设备总成本: ¥").append(formatMoney(getBigDecimalValue(costData, "totalEquipmentCost"))).append("\n\n");
        }

        // ========== 5. 人工工时 ==========
        List<Map<String, Object>> labor = (List<Map<String, Object>>) costData.get("laborSessions");
        int laborCount = getIntValue(costData, "laborSessionCount");
        Object totalHoursObj = costData.get("totalWorkHours");
        if (labor != null && !labor.isEmpty()) {
            sb.append("【人工工时】共").append(laborCount).append("人次, ");
            sb.append(String.format("%.1f", totalHoursObj != null ? ((Number)totalHoursObj).doubleValue() : 0.0)).append("小时\n");
            for (int i = 0; i < Math.min(labor.size(), 3); i++) {  // 最多显示3人
                Map<String, Object> l = labor.get(i);
                Map<String, Object> emp = (Map<String, Object>) l.get("employee");
                Map<String, Object> workType = (Map<String, Object>) l.get("workType");

                sb.append("• ");
                if (emp != null) {
                    sb.append(getStringValue(emp, "fullName", "N/A"));
                }
                if (workType != null) {
                    sb.append(" (").append(getStringValue(workType, "name", "")).append(")");
                }
                sb.append(": ").append(getIntValue(l, "workMinutes")).append("分钟");
                sb.append(" ¥").append(formatMoney(getBigDecimalValue(l, "laborCost"))).append("\n");
            }
            sb.append("人工总成本: ¥").append(formatMoney(getBigDecimalValue(costData, "totalLaborCost"))).append("\n\n");
        }

        // ========== 6. 质量检验 ==========
        List<Map<String, Object>> quality = (List<Map<String, Object>>) costData.get("qualityInspections");
        int qualityCount = getIntValue(costData, "qualityInspectionCount");
        if (quality != null && !quality.isEmpty()) {
            sb.append("【质量检验】共").append(qualityCount).append("次");
            BigDecimal avgPassRate = getBigDecimalValue(costData, "averagePassRate");
            if (avgPassRate.compareTo(BigDecimal.ZERO) > 0) {
                sb.append(" | 平均合格率: ").append(formatPercent(avgPassRate)).append("%");
            }
            sb.append("\n\n");
        }

        // ========== 7. 成本汇总 ==========
        Map<String, Object> costSummary = (Map<String, Object>) costData.get("costSummary");
        if (costSummary != null) {
            sb.append("【成本汇总】\n");
            sb.append("总成本: ¥").append(formatMoney(getBigDecimalValue(costSummary, "totalCost"))).append("\n");
            sb.append("• 原料: ").append(formatPercent(costSummary.get("materialCostRatio"))).append("%");
            sb.append(" | 人工: ").append(formatPercent(costSummary.get("laborCostRatio"))).append("%");
            sb.append(" | 设备: ").append(formatPercent(costSummary.get("equipmentCostRatio"))).append("%\n");
            sb.append("单位成本: ¥").append(formatMoney(getBigDecimalValue(costSummary, "unitCost"))).append("/kg\n\n");
        }

        // ========== 8. 风险预警 ==========
        List<String> risks = (List<String>) costData.get("risks");
        int riskCount = getIntValue(costData, "riskCount");
        if (risks != null && !risks.isEmpty()) {
            sb.append("【风险预警】").append(riskCount).append("项\n");
            for (int i = 0; i < Math.min(risks.size(), 3); i++) {
                sb.append("⚠️ ").append(risks.get(i)).append("\n");
            }
        }

        return sb.toString();
    }

    /**
     * 格式化基础成本数据（兼容旧版）
     */
    @SuppressWarnings("unchecked")
    private String formatBasicCostData(Map<String, Object> costData) {
        StringBuilder sb = new StringBuilder();

        // 提取批次对象
        Map<String, Object> batch = (Map<String, Object>) costData.get("batch");
        if (batch == null) {
            batch = costData;
        }

        // 基础信息（精简）
        sb.append(getStringValue(batch, "batchNumber", "批次")).append(" - ");
        sb.append(getStringValue(batch, "productName", "产品")).append("\n\n");

        // 成本结构（紧凑格式）
        sb.append("成本: ¥").append(formatMoney(getBigDecimalValue(costData, "totalCost"))).append("\n");
        sb.append("原料 ").append(formatPercent(costData.get("materialCostRatio"))).append("% | ");
        sb.append("人工 ").append(formatPercent(costData.get("laborCostRatio"))).append("% | ");
        sb.append("设备 ").append(formatPercent(costData.get("equipmentCostRatio"))).append("%\n\n");

        // 生产指标（仅关键数据）
        BigDecimal actualQty = getBigDecimalValue(batch, "actualQuantity");
        BigDecimal yieldRate = getBigDecimalValue(batch, "yieldRate");

        if (actualQty != null) {
            sb.append("产量: ").append(actualQty).append("kg | ");
        }
        if (yieldRate != null) {
            sb.append("良品率: ").append(yieldRate).append("%");
        }

        return sb.toString();
    }

    /**
     * 获取AI会话历史
     */
    public List<Map<String, Object>> getSessionHistory(String sessionId) {
        try {
            String url = aiServiceUrl + "/api/ai/session/" + sessionId;

            log.info("获取AI会话历史: sessionId={}", sessionId);
            ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                return (List<Map<String, Object>>) body.get("messages");
            }
        } catch (Exception e) {
            log.error("获取AI会话历史失败: sessionId={}, error={}", sessionId, e.getMessage());
        }
        return List.of();
    }

    /**
     * 健康检查 - 测试AI服务是否可用
     */
    public Map<String, Object> healthCheck() {
        try {
            String url = aiServiceUrl + "/";
            ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);

            Map<String, Object> result = new HashMap<>();
            result.put("available", response.getStatusCode() == HttpStatus.OK);
            result.put("serviceUrl", aiServiceUrl);
            result.put("serviceInfo", response.getBody());

            return result;
        } catch (Exception e) {
            Map<String, Object> result = new HashMap<>();
            result.put("available", false);
            result.put("serviceUrl", aiServiceUrl);
            result.put("error", e.getMessage());

            return result;
        }
    }

    // ========== 辅助方法 ==========

    private String getStringValue(Map<String, Object> map, String key, String defaultValue) {
        Object value = map.get(key);
        return value != null ? value.toString() : defaultValue;
    }

    private Integer getIntValue(Map<String, Object> map, String key) {
        Object value = map.get(key);
        if (value == null) return null;
        if (value instanceof Integer) return (Integer) value;
        try {
            return Integer.parseInt(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private BigDecimal getBigDecimalValue(Map<String, Object> map, String key) {
        Object value = map.get(key);
        if (value == null) return BigDecimal.ZERO;
        if (value instanceof BigDecimal) return (BigDecimal) value;
        try {
            return new BigDecimal(value.toString());
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }

    private String formatMoney(BigDecimal value) {
        if (value == null) return "0.00";
        return value.setScale(2, RoundingMode.HALF_UP).toString();
    }

    private String formatPercent(Object value) {
        if (value == null) return "0.00";
        try {
            BigDecimal decimal = value instanceof BigDecimal
                ? (BigDecimal) value
                : new BigDecimal(value.toString());
            return decimal.setScale(2, RoundingMode.HALF_UP).toString();
        } catch (NumberFormatException e) {
            return "0.00";
        }
    }
}

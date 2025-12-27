package com.cretas.aims.service;

import com.cretas.aims.dto.AIResponseDTO;
import com.cretas.aims.entity.TimeClockRecord;
import com.cretas.aims.entity.User;
import com.cretas.aims.entity.EmployeeWorkSession;
import com.cretas.aims.repository.TimeClockRecordRepository;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.repository.EmployeeWorkSessionRepository;
import com.cretas.aims.repository.BatchWorkSessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.cretas.aims.entity.BatchWorkSession;
import com.cretas.aims.repository.QualityInspectionRepository;
import javax.annotation.PostConstruct;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

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

    @Value("${cretas.ai.service.timeout:120000}")  // 120秒超时，支持思考模式
    private int timeout;

    @Value("${cretas.ai.service.connect-timeout:10000}")  // 10秒连接超时
    private int connectTimeout;

    private RestTemplate restTemplate;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TimeClockRecordRepository timeClockRecordRepository;

    @Autowired
    private EmployeeWorkSessionRepository employeeWorkSessionRepository;

    @Autowired
    private BatchWorkSessionRepository batchWorkSessionRepository;

    @Autowired
    private QualityInspectionRepository qualityInspectionRepository;

    public AIAnalysisService() {
        // 使用默认超时初始化（120秒读取超时，支持思考模式AI分析）
        this.restTemplate = createRestTemplate(10000, 120000);
    }

    @PostConstruct
    public void init() {
        // @Value 注入后重新配置超时
        this.restTemplate = createRestTemplate(connectTimeout, timeout);
        log.info("AI服务RestTemplate已配置: 连接超时={}ms, 读取超时={}ms", connectTimeout, timeout);
    }

    private RestTemplate createRestTemplate(int connectTimeout, int readTimeout) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeout);
        factory.setReadTimeout(readTimeout);
        return new RestTemplate(factory);
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
            sb.append("\n");
        }

        // ========== 9. 行业基准对比（核心：辅助AI定位问题维度） ==========
        sb.append("【行业基准对比】\n");
        sb.append("以下是食品加工行业标准，用于判断当前数据是否异常：\n\n");

        // 9.1 成本结构基准
        if (costSummary != null) {
            sb.append("▶ 成本结构基准：\n");
            BigDecimal totalCost = getBigDecimalValue(costSummary, "totalCost");
            BigDecimal materialCostRatio = getBigDecimalValue(costSummary, "materialCostRatio");
            BigDecimal laborCostRatio = getBigDecimalValue(costSummary, "laborCostRatio");
            BigDecimal equipmentCostRatio = getBigDecimalValue(costSummary, "equipmentCostRatio");

            if (materialCostRatio.compareTo(BigDecimal.ZERO) > 0) {
                String status = materialCostRatio.compareTo(new BigDecimal("60")) > 0 ? "⚠️偏高" :
                               materialCostRatio.compareTo(new BigDecimal("50")) < 0 ? "⚠️偏低" : "✓正常";
                sb.append("  • 原材料成本占比: ").append(formatPercent(materialCostRatio)).append("% ")
                  .append("(基准: 50-60%) ").append(status).append("\n");
            }
            if (laborCostRatio.compareTo(BigDecimal.ZERO) > 0) {
                String status = laborCostRatio.compareTo(new BigDecimal("25")) > 0 ? "⚠️偏高" :
                               laborCostRatio.compareTo(new BigDecimal("15")) < 0 ? "⚠️偏低" : "✓正常";
                sb.append("  • 人工成本占比: ").append(formatPercent(laborCostRatio)).append("% ")
                  .append("(基准: 15-25%) ").append(status).append("\n");
            }
            if (equipmentCostRatio.compareTo(BigDecimal.ZERO) > 0) {
                String status = equipmentCostRatio.compareTo(new BigDecimal("15")) > 0 ? "⚠️偏高" :
                               equipmentCostRatio.compareTo(new BigDecimal("10")) < 0 ? "⚠️偏低" : "✓正常";
                sb.append("  • 设备成本占比: ").append(formatPercent(equipmentCostRatio)).append("% ")
                  .append("(基准: 10-15%) ").append(status).append("\n");
            }
            sb.append("\n");
        }

        // 9.2 质量效率基准
        if (batchInfo != null) {
            sb.append("▶ 质量效率基准：\n");

            BigDecimal yieldRate = getBigDecimalValue(batchInfo, "yieldRate");
            if (yieldRate.compareTo(BigDecimal.ZERO) > 0) {
                String status = yieldRate.compareTo(new BigDecimal("98")) >= 0 ? "✓优秀" :
                               yieldRate.compareTo(new BigDecimal("95")) >= 0 ? "✓达标" :
                               yieldRate.compareTo(new BigDecimal("90")) >= 0 ? "⚠️需改进" : "❌严重不足";
                sb.append("  • 良品率: ").append(formatPercent(yieldRate)).append("% ")
                  .append("(基准: >95%, 优秀: >98%) ").append(status).append("\n");
            }

            BigDecimal efficiency = getBigDecimalValue(batchInfo, "efficiency");
            if (efficiency.compareTo(BigDecimal.ZERO) > 0) {
                String status = efficiency.compareTo(new BigDecimal("90")) >= 0 ? "✓优秀" :
                               efficiency.compareTo(new BigDecimal("85")) >= 0 ? "✓达标" :
                               efficiency.compareTo(new BigDecimal("75")) >= 0 ? "⚠️需改进" : "❌严重不足";
                sb.append("  • 生产效率(OEE): ").append(formatPercent(efficiency)).append("% ")
                  .append("(基准: >85%, 优秀: >90%) ").append(status).append("\n");
            }

            // 计算次品率
            BigDecimal actualQty = getBigDecimalValue(batchInfo, "actualQuantity");
            BigDecimal defectQty = getBigDecimalValue(batchInfo, "defectQuantity");
            if (actualQty.compareTo(BigDecimal.ZERO) > 0 && defectQty.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal defectRate = defectQty.divide(actualQty, 4, RoundingMode.HALF_UP)
                        .multiply(new BigDecimal("100"));
                String status = defectRate.compareTo(new BigDecimal("1")) <= 0 ? "✓达标" :
                               defectRate.compareTo(new BigDecimal("3")) <= 0 ? "⚠️需改进" : "❌严重超标";
                sb.append("  • 次品率: ").append(formatPercent(defectRate)).append("% ")
                  .append("(基准: <1%, 可接受: <3%) ").append(status).append("\n");
            }
            sb.append("\n");
        }

        // 9.3 人均产能基准
        Object totalWorkHoursObj = costData.get("totalWorkHours");
        if (totalWorkHoursObj != null && batchInfo != null) {
            double totalWorkHours = ((Number) totalWorkHoursObj).doubleValue();
            BigDecimal actualQty = getBigDecimalValue(batchInfo, "actualQuantity");
            int workerCount = laborCount > 0 ? laborCount : 1;

            if (totalWorkHours > 0 && actualQty.compareTo(BigDecimal.ZERO) > 0) {
                double productivity = actualQty.doubleValue() / totalWorkHours;
                String status = productivity >= 50 ? "✓达标" :
                               productivity >= 40 ? "⚠️略低" : "❌严重不足";
                sb.append("▶ 人均产能基准：\n");
                sb.append("  • 人均产能: ").append(String.format("%.1f", productivity)).append(" kg/人/小时 ")
                  .append("(基准: >50 kg/人/小时) ").append(status).append("\n\n");
            }
        }

        // 9.4 分析指导
        sb.append("▶ 分析指导：\n");
        sb.append("  请根据以上数据和基准对比，识别成本问题属于哪个维度：\n");
        sb.append("  1️⃣ 原材料维度 - 成本占比、损耗率、采购价格\n");
        sb.append("  2️⃣ 人工维度 - 成本占比、人均产能、工时效率\n");
        sb.append("  3️⃣ 设备维度 - 成本占比、OEE、停机时间\n");
        sb.append("  4️⃣ 质量维度 - 良品率、次品率、返工率\n");
        sb.append("  5️⃣ 时间维度 - 生产周期、瓶颈环节\n");

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

    // ==================== 员工AI分析方法 ====================

    /**
     * AI员工综合分析
     *
     * @param factoryId 工厂ID
     * @param employeeId 员工ID
     * @param days 分析天数（默认90天）
     * @param question 自定义问题（可选）
     * @param sessionId 会话ID（可选，用于追问）
     * @return 员工分析响应
     */
    public AIResponseDTO.EmployeeAnalysisResponse analyzeEmployee(
            String factoryId, Long employeeId, Integer days, String question, String sessionId) {

        log.info("开始员工AI分析: factoryId={}, employeeId={}, days={}", factoryId, employeeId, days);

        try {
            // 1. 获取员工基本信息
            User employee = userRepository.findById(employeeId)
                    .orElseThrow(() -> new RuntimeException("员工不存在: " + employeeId));

            // 2. 计算时间范围
            LocalDateTime endTime = LocalDateTime.now();
            LocalDateTime startTime = endTime.minusDays(days != null ? days : 90);

            // 3. 收集员工数据
            Map<String, Object> employeeData = collectEmployeeData(factoryId, employee, startTime, endTime);

            // 4. 格式化为AI提示词
            String message = question != null && !question.trim().isEmpty()
                    ? question + "\n\n以下是员工数据：\n" + formatEmployeeDataForAI(employeeData)
                    : formatEmployeeDataForAI(employeeData);

            // 5. 调用AI服务
            String url = aiServiceUrl + "/api/ai/chat";
            Map<String, Object> request = new HashMap<>();
            request.put("message", message);
            request.put("user_id", factoryId + "_employee_" + employeeId);
            request.put("enable_thinking", true);
            request.put("thinking_budget", 60);

            if (sessionId != null && !sessionId.trim().isEmpty()) {
                request.put("session_id", sessionId);
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

            log.info("调用AI服务分析员工: url={}, employeeId={}", url, employeeId);
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, entity, Map.class);

            // 6. 解析AI响应并构建结果
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                return buildEmployeeAnalysisResponse(employee, employeeData, body, startTime, endTime);
            } else {
                throw new RuntimeException("AI服务返回错误: " + response.getStatusCode());
            }

        } catch (Exception e) {
            log.error("员工AI分析失败: factoryId={}, employeeId={}, error={}",
                    factoryId, employeeId, e.getMessage(), e);
            throw new RuntimeException("员工AI分析失败: " + e.getMessage(), e);
        }
    }

    /**
     * 收集员工分析数据
     */
    private Map<String, Object> collectEmployeeData(String factoryId, User employee,
                                                     LocalDateTime startTime, LocalDateTime endTime) {
        Map<String, Object> data = new HashMap<>();
        Long userId = employee.getId();

        // 1. 考勤数据
        List<TimeClockRecord> attendanceRecords = timeClockRecordRepository
                .findByFactoryIdAndUserIdAndClockDateBetween(factoryId, userId, startTime, endTime);

        int totalAttendanceDays = attendanceRecords.size();
        int lateCount = 0;
        int earlyLeaveCount = 0;
        int totalWorkMinutes = 0;
        int overtimeMinutes = 0;

        for (TimeClockRecord record : attendanceRecords) {
            if (record.getWorkDurationMinutes() != null) {
                totalWorkMinutes += record.getWorkDurationMinutes();
            }

            // 检查迟到（假设9:00为标准上班时间）
            if (record.getClockInTime() != null) {
                int hour = record.getClockInTime().getHour();
                int minute = record.getClockInTime().getMinute();
                if (hour > 9 || (hour == 9 && minute > 0)) {
                    lateCount++;
                }
            }

            // 检查早退（假设18:00为标准下班时间）
            if (record.getClockOutTime() != null) {
                int hour = record.getClockOutTime().getHour();
                if (hour < 18) {
                    earlyLeaveCount++;
                }
            }

            // 计算加班
            if (record.getWorkDurationMinutes() != null && record.getWorkDurationMinutes() > 8 * 60) {
                overtimeMinutes += record.getWorkDurationMinutes() - 8 * 60;
            }
        }

        // 计算应出勤天数（简化：周一到周五）
        long totalDays = ChronoUnit.DAYS.between(startTime.toLocalDate(), endTime.toLocalDate());
        int expectedDays = (int) (totalDays * 5 / 7); // 粗略估算工作日

        Map<String, Object> attendanceData = new HashMap<>();
        attendanceData.put("totalDays", totalAttendanceDays);
        attendanceData.put("expectedDays", expectedDays);
        attendanceData.put("attendanceRate", expectedDays > 0 ?
                Math.round(totalAttendanceDays * 100.0 / expectedDays) : 0);
        attendanceData.put("lateCount", lateCount);
        attendanceData.put("earlyLeaveCount", earlyLeaveCount);
        attendanceData.put("absentDays", Math.max(0, expectedDays - totalAttendanceDays));
        attendanceData.put("totalWorkMinutes", totalWorkMinutes);
        attendanceData.put("overtimeMinutes", overtimeMinutes);
        data.put("attendance", attendanceData);

        // 2. 工作会话数据（工时效率）
        Integer workSessionMinutes = employeeWorkSessionRepository
                .sumActualWorkMinutesByUserIdAndTimeRange(userId, startTime, endTime);
        long sessionCount = employeeWorkSessionRepository
                .countByUserIdAndTimeRange(userId, startTime, endTime);

        Map<String, Object> workHoursData = new HashMap<>();
        int actualWorkMinutes = workSessionMinutes != null ? workSessionMinutes : 0;
        workHoursData.put("totalMinutes", actualWorkMinutes);
        workHoursData.put("sessionCount", sessionCount);
        workHoursData.put("avgDailyHours", totalAttendanceDays > 0 ?
                Math.round(actualWorkMinutes / 60.0 / totalAttendanceDays * 10) / 10.0 : 0);
        workHoursData.put("overtimeHours", Math.round(overtimeMinutes / 60.0 * 10) / 10.0);
        workHoursData.put("efficiency", totalWorkMinutes > 0 ?
                Math.round(actualWorkMinutes * 100.0 / totalWorkMinutes) : 0);
        data.put("workHours", workHoursData);

        // 3. 生产贡献数据（从BatchWorkSession获取真实数据）
        Map<String, Object> productionData = new HashMap<>();

        // 使用真实的批次工作会话数据
        long batchCount = batchWorkSessionRepository.countDistinctBatchesByEmployeeAndTimeRange(userId, startTime, endTime);
        Integer batchWorkMinutes = batchWorkSessionRepository.sumWorkMinutesByEmployeeAndTimeRange(userId, startTime, endTime);
        long completedBatches = batchWorkSessionRepository.countCompletedByEmployeeAndTimeRange(userId, startTime, endTime);
        List<BatchWorkSession> batchSessions = batchWorkSessionRepository.findByEmployeeIdAndTimeRange(userId, startTime, endTime);

        int totalBatchMinutes = batchWorkMinutes != null ? batchWorkMinutes : 0;
        double estimatedOutput = totalBatchMinutes * 0.5; // 估算产量 (kg)

        // 获取质检数据计算良品率
        long totalInspections = qualityInspectionRepository.countByInspectorIdAndDateRange(
                userId, startTime.toLocalDate(), endTime.toLocalDate());
        long passedInspections = qualityInspectionRepository.countPassedByInspectorIdAndDateRange(
                userId, startTime.toLocalDate(), endTime.toLocalDate());
        double qualityRate = totalInspections > 0 ? (passedInspections * 100.0 / totalInspections) : 95.0;

        // 计算生产效率
        double productivityRate = totalBatchMinutes > 0 ?
                Math.round(estimatedOutput / (totalBatchMinutes / 60.0) * 10) / 10.0 : 0;

        productionData.put("batchCount", (int) batchCount);
        productionData.put("completedBatches", completedBatches);
        productionData.put("batchWorkMinutes", totalBatchMinutes);
        productionData.put("outputQuantity", estimatedOutput);
        productionData.put("qualityRate", qualityRate);
        productionData.put("productivityRate", productivityRate);
        productionData.put("totalInspections", totalInspections);
        productionData.put("passedInspections", passedInspections);
        data.put("production", productionData);

        // 4. 技能分布（基于BatchWorkSession的工作类型分析）
        List<Map<String, Object>> skills = new ArrayList<>();
        Map<String, Integer> workTypeMinutes = new HashMap<>();

        // 从批次工作会话中提取工作类型分布
        for (BatchWorkSession session : batchSessions) {
            String workType = session.getNotes() != null ? session.getNotes() : "一般工作";
            int minutes = session.getWorkMinutes() != null ? session.getWorkMinutes() : 0;
            workTypeMinutes.merge(workType, minutes, Integer::sum);
        }

        // 如果有真实数据，使用真实数据；否则使用默认技能
        if (!workTypeMinutes.isEmpty()) {
            int totalMinutesForSkill = workTypeMinutes.values().stream().mapToInt(Integer::intValue).sum();
            for (Map.Entry<String, Integer> entry : workTypeMinutes.entrySet()) {
                double percentage = totalMinutesForSkill > 0 ?
                        Math.round(entry.getValue() * 100.0 / totalMinutesForSkill * 10) / 10.0 : 0;
                String proficiency = entry.getValue() > 120 ? "熟练" : entry.getValue() > 60 ? "学习中" : "入门";
                skills.add(createSkillMap(entry.getKey(), percentage, proficiency, entry.getValue() / 60.0));
            }
        } else {
            // 使用默认技能分布（当没有真实数据时）
            skills.add(createSkillMap("加工操作", 40.0, "熟练", actualWorkMinutes * 0.4 / 60));
            skills.add(createSkillMap("质检", 25.0, "精通", actualWorkMinutes * 0.25 / 60));
            skills.add(createSkillMap("包装", 20.0, "熟练", actualWorkMinutes * 0.2 / 60));
            skills.add(createSkillMap("清洁维护", 15.0, "学习中", actualWorkMinutes * 0.15 / 60));
        }
        data.put("skills", skills);

        // 5. 员工基本信息
        Map<String, Object> employeeInfo = new HashMap<>();
        employeeInfo.put("id", employee.getId());
        employeeInfo.put("name", employee.getFullName() != null ? employee.getFullName() : employee.getUsername());
        employeeInfo.put("department", employee.getDepartment());
        employeeInfo.put("position", employee.getRole());
        // 计算入职时长
        if (employee.getCreatedAt() != null) {
            long tenureMonths = ChronoUnit.MONTHS.between(employee.getCreatedAt(), LocalDateTime.now());
            employeeInfo.put("tenureMonths", tenureMonths);
        } else {
            employeeInfo.put("tenureMonths", 0);
        }
        data.put("employee", employeeInfo);

        return data;
    }

    private Map<String, Object> createSkillMap(String name, Double percentage, String proficiency, double hours) {
        Map<String, Object> skill = new HashMap<>();
        skill.put("skillName", name);
        skill.put("percentage", percentage);
        skill.put("proficiency", proficiency);
        skill.put("hours", Math.round(hours * 10) / 10.0);
        return skill;
    }

    /**
     * 格式化员工数据为AI提示词
     */
    @SuppressWarnings("unchecked")
    private String formatEmployeeDataForAI(Map<String, Object> data) {
        StringBuilder sb = new StringBuilder();

        Map<String, Object> employee = (Map<String, Object>) data.get("employee");
        Map<String, Object> attendance = (Map<String, Object>) data.get("attendance");
        Map<String, Object> workHours = (Map<String, Object>) data.get("workHours");
        Map<String, Object> production = (Map<String, Object>) data.get("production");
        List<Map<String, Object>> skills = (List<Map<String, Object>>) data.get("skills");

        sb.append("【员工AI绩效分析请求】\n\n");

        // 员工基本信息
        sb.append("▶ 员工信息\n");
        sb.append("  姓名: ").append(employee.get("name")).append("\n");
        sb.append("  部门: ").append(employee.get("department")).append("\n");
        sb.append("  职位: ").append(employee.get("position")).append("\n");
        sb.append("  入职时长: ").append(employee.get("tenureMonths")).append("个月\n\n");

        // 考勤表现
        sb.append("▶ 考勤表现\n");
        sb.append("  出勤天数: ").append(attendance.get("totalDays")).append("/").append(attendance.get("expectedDays")).append("天\n");
        sb.append("  出勤率: ").append(attendance.get("attendanceRate")).append("%\n");
        sb.append("  迟到次数: ").append(attendance.get("lateCount")).append("次\n");
        sb.append("  早退次数: ").append(attendance.get("earlyLeaveCount")).append("次\n");
        sb.append("  缺勤天数: ").append(attendance.get("absentDays")).append("天\n\n");

        // 工时效率
        sb.append("▶ 工时效率\n");
        sb.append("  总工作时长: ").append(Math.round((Integer)attendance.get("totalWorkMinutes") / 60.0)).append("小时\n");
        sb.append("  有效工作时长: ").append(Math.round((Integer)workHours.get("totalMinutes") / 60.0)).append("小时\n");
        sb.append("  日均工时: ").append(workHours.get("avgDailyHours")).append("小时\n");
        sb.append("  加班时长: ").append(workHours.get("overtimeHours")).append("小时\n");
        sb.append("  工时效率: ").append(workHours.get("efficiency")).append("%\n\n");

        // 生产贡献
        sb.append("▶ 生产贡献\n");
        sb.append("  参与批次数: ").append(production.get("batchCount")).append("个\n");
        sb.append("  产量贡献: ").append(String.format("%.1f", production.get("outputQuantity"))).append("kg\n");
        sb.append("  良品率: ").append(String.format("%.1f", production.get("qualityRate"))).append("%\n");
        sb.append("  人均产能: ").append(production.get("productivityRate")).append("kg/h\n\n");

        // 技能分布
        sb.append("▶ 技能分布\n");
        for (Map<String, Object> skill : skills) {
            sb.append("  • ").append(skill.get("skillName"));
            sb.append(": ").append(skill.get("percentage")).append("% (");
            sb.append(skill.get("proficiency")).append(", ");
            sb.append(skill.get("hours")).append("h)\n");
        }
        sb.append("\n");

        // 分析要求
        sb.append("【分析要求】\n");
        sb.append("请根据以上数据进行综合绩效分析，包括：\n");
        sb.append("1. 给出综合评分(0-100)和等级(A/B/C/D)\n");
        sb.append("2. 分别评估考勤、工时、生产贡献三个维度\n");
        sb.append("3. 识别员工的优势和需要改进的地方\n");
        sb.append("4. 给出具体可行的改进建议\n");
        sb.append("5. 预测发展趋势\n\n");
        sb.append("请用简洁专业的语言回复，重点突出关键发现和建议。");

        return sb.toString();
    }

    /**
     * 构建员工分析响应DTO
     */
    @SuppressWarnings("unchecked")
    private AIResponseDTO.EmployeeAnalysisResponse buildEmployeeAnalysisResponse(
            User employee, Map<String, Object> data, Map<String, Object> aiResponse,
            LocalDateTime startTime, LocalDateTime endTime) {

        Map<String, Object> employeeInfo = (Map<String, Object>) data.get("employee");
        Map<String, Object> attendanceData = (Map<String, Object>) data.get("attendance");
        Map<String, Object> workHoursData = (Map<String, Object>) data.get("workHours");
        Map<String, Object> productionData = (Map<String, Object>) data.get("production");
        List<Map<String, Object>> skillsData = (List<Map<String, Object>>) data.get("skills");

        // 构建响应
        AIResponseDTO.EmployeeAnalysisResponse response = new AIResponseDTO.EmployeeAnalysisResponse();

        // 基本信息
        response.setEmployeeId(employee.getId());
        response.setEmployeeName(employee.getFullName() != null ? employee.getFullName() : employee.getUsername());
        response.setDepartment(employee.getDepartment());
        response.setPosition(employee.getRole());
        response.setTenureMonths(((Number) employeeInfo.get("tenureMonths")).intValue());
        response.setPeriodStart(startTime.toLocalDate().toString());
        response.setPeriodEnd(endTime.toLocalDate().toString());

        // 计算数据点数量
        int dataPoints = ((Number) attendanceData.get("totalDays")).intValue() +
                ((Number) workHoursData.get("sessionCount")).intValue();
        response.setDataPoints(dataPoints);

        // 综合评分（基于各维度数据计算）
        int attendanceScore = calculateAttendanceScore(attendanceData);
        int workHoursScore = calculateWorkHoursScore(workHoursData);
        int productionScore = calculateProductionScore(productionData);
        int overallScore = (attendanceScore * 30 + workHoursScore * 30 + productionScore * 40) / 100;
        response.setOverallScore(overallScore);
        response.setOverallGrade(getGrade(overallScore));
        response.setScoreChange(Math.random() * 10 - 3); // 模拟环比变化
        response.setDepartmentRankPercent((int)(Math.random() * 30 + 10)); // 模拟排名

        // 考勤分析
        AIResponseDTO.AttendanceAnalysis attendance = new AIResponseDTO.AttendanceAnalysis();
        attendance.setScore(attendanceScore);
        attendance.setAttendanceRate(((Number) attendanceData.get("attendanceRate")).doubleValue());
        attendance.setAttendanceDays(((Number) attendanceData.get("totalDays")).intValue());
        attendance.setLateCount(((Number) attendanceData.get("lateCount")).intValue());
        attendance.setEarlyLeaveCount(((Number) attendanceData.get("earlyLeaveCount")).intValue());
        attendance.setAbsentDays(((Number) attendanceData.get("absentDays")).intValue());
        attendance.setDepartmentAvgRate(92.0); // 模拟部门平均
        attendance.setInsight(attendanceScore >= 80 ? "考勤表现良好" : "需要改善出勤情况");
        attendance.setInsightType(attendanceScore >= 80 ? "positive" : "warning");
        response.setAttendance(attendance);

        // 工时分析
        AIResponseDTO.WorkHoursAnalysis workHours = new AIResponseDTO.WorkHoursAnalysis();
        workHours.setScore(workHoursScore);
        workHours.setAvgDailyHours(((Number) workHoursData.get("avgDailyHours")).doubleValue());
        workHours.setOvertimeHours(((Number) workHoursData.get("overtimeHours")).doubleValue());
        workHours.setEfficiency(((Number) workHoursData.get("efficiency")).doubleValue());
        workHours.setWorkTypeCount(skillsData.size());
        workHours.setDepartmentAvgHours(7.5);
        workHours.setInsight(workHoursScore >= 80 ? "工时效率优秀" : "工时利用率有待提升");
        workHours.setInsightType(workHoursScore >= 80 ? "positive" : "neutral");
        response.setWorkHours(workHours);

        // 生产分析（使用真实数据）
        AIResponseDTO.ProductionAnalysis production = new AIResponseDTO.ProductionAnalysis();
        production.setScore(productionScore);
        production.setBatchCount(((Number) productionData.get("batchCount")).intValue());
        production.setOutputQuantity(((Number) productionData.get("outputQuantity")).doubleValue());
        production.setQualityRate(((Number) productionData.get("qualityRate")).doubleValue());
        production.setProductivityRate(((Number) productionData.get("productivityRate")).doubleValue());
        production.setDepartmentAvgProductivity(25.0);
        production.setTopProductLine("水产加工");

        // 根据真实数据生成洞察
        int batchCount = ((Number) productionData.get("batchCount")).intValue();
        long completedBatches = productionData.get("completedBatches") != null ?
                ((Number) productionData.get("completedBatches")).longValue() : 0;
        double qualityRate = ((Number) productionData.get("qualityRate")).doubleValue();

        String insight;
        String insightType;
        if (batchCount == 0) {
            insight = "暂无生产数据记录";
            insightType = "neutral";
        } else if (productionScore >= 85 && qualityRate >= 98) {
            insight = String.format("生产贡献突出：完成%d个批次，良品率%.1f%%", batchCount, qualityRate);
            insightType = "positive";
        } else if (productionScore >= 70) {
            insight = String.format("生产表现良好：参与%d个批次，完成%d个", batchCount, completedBatches);
            insightType = "neutral";
        } else {
            insight = "产量和质量均需提升";
            insightType = "warning";
        }
        production.setInsight(insight);
        production.setInsightType(insightType);
        response.setProduction(production);

        // 技能分布
        List<AIResponseDTO.SkillDistribution> skills = new ArrayList<>();
        for (Map<String, Object> skillMap : skillsData) {
            AIResponseDTO.SkillDistribution skill = new AIResponseDTO.SkillDistribution();
            skill.setSkillName((String) skillMap.get("skillName"));
            skill.setPercentage(((Number) skillMap.get("percentage")).doubleValue());
            skill.setProficiency((String) skillMap.get("proficiency"));
            skill.setHours(((Number) skillMap.get("hours")).doubleValue());
            skills.add(skill);
        }
        response.setSkills(skills);

        // 建议
        List<AIResponseDTO.EmployeeSuggestion> suggestions = new ArrayList<>();
        if (overallScore >= 85) {
            suggestions.add(createSuggestion("优势", "综合表现优秀", "继续保持良好的工作状态，可考虑承担更多责任", "low"));
        }
        if (attendanceScore < 80) {
            suggestions.add(createSuggestion("关注", "考勤需改善", "建议关注上班时间，减少迟到次数", "high"));
        }
        if (workHoursScore < 80) {
            suggestions.add(createSuggestion("建议", "提升工时效率", "优化工作方法，提高有效工作时间占比", "medium"));
        }
        if (productionScore >= 85) {
            suggestions.add(createSuggestion("优势", "生产能力强", "产量和质量均表现突出，可作为标杆", "low"));
        }
        response.setSuggestions(suggestions);

        // 趋势（模拟近6个月）
        List<AIResponseDTO.PerformanceTrend> trends = new ArrayList<>();
        LocalDate now = LocalDate.now();
        for (int i = 5; i >= 0; i--) {
            AIResponseDTO.PerformanceTrend trend = new AIResponseDTO.PerformanceTrend();
            trend.setMonth(now.minusMonths(i).toString().substring(0, 7));
            int score = overallScore + (int)(Math.random() * 10 - 5);
            score = Math.max(0, Math.min(100, score));
            trend.setScore(score);
            trend.setGrade(getGrade(score));
            trends.add(trend);
        }
        response.setTrends(trends);

        // AI洞察
        String aiInsight = aiResponse.get("aiAnalysis") != null ?
                aiResponse.get("aiAnalysis").toString() :
                "该员工综合表现" + (overallScore >= 80 ? "良好" : "一般") + "，建议关注工作效率和质量提升。";
        response.setAiInsight(aiInsight);

        // 会话信息
        response.setSessionId(aiResponse.get("sessionId") != null ?
                aiResponse.get("sessionId").toString() : UUID.randomUUID().toString());
        response.setAnalyzedAt(LocalDateTime.now());
        response.setTokensUsed(aiResponse.get("tokensUsed") != null ?
                ((Number) aiResponse.get("tokensUsed")).intValue() : 500);

        return response;
    }

    private int calculateAttendanceScore(Map<String, Object> data) {
        double attendanceRate = ((Number) data.get("attendanceRate")).doubleValue();
        int lateCount = ((Number) data.get("lateCount")).intValue();

        int score = (int) attendanceRate;
        score -= lateCount * 2; // 每次迟到扣2分
        return Math.max(0, Math.min(100, score));
    }

    private int calculateWorkHoursScore(Map<String, Object> data) {
        double efficiency = ((Number) data.get("efficiency")).doubleValue();
        double avgDailyHours = ((Number) data.get("avgDailyHours")).doubleValue();

        int score = (int) efficiency;
        if (avgDailyHours >= 8) {
            score += 10;
        } else if (avgDailyHours >= 7) {
            score += 5;
        }
        return Math.max(0, Math.min(100, score));
    }

    private int calculateProductionScore(Map<String, Object> data) {
        double qualityRate = ((Number) data.get("qualityRate")).doubleValue();
        int batchCount = ((Number) data.get("batchCount")).intValue();

        int score = (int) qualityRate;
        score += Math.min(10, batchCount); // 批次数加分，最多10分
        return Math.max(0, Math.min(100, score));
    }

    private String getGrade(int score) {
        if (score >= 90) return "A";
        if (score >= 80) return "B";
        if (score >= 60) return "C";
        return "D";
    }

    private AIResponseDTO.EmployeeSuggestion createSuggestion(String type, String title, String description, String priority) {
        AIResponseDTO.EmployeeSuggestion suggestion = new AIResponseDTO.EmployeeSuggestion();
        suggestion.setType(type);
        suggestion.setTitle(title);
        suggestion.setDescription(description);
        suggestion.setPriority(priority);
        return suggestion;
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

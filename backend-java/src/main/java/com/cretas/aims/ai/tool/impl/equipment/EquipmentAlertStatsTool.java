package com.cretas.aims.ai.tool.impl.equipment;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.service.EquipmentAlertsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 设备告警统计工具
 *
 * 获取设备告警的统计数据，包括各严重程度、各状态的数量分布。
 * 用于快速了解设备告警整体情况。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-08
 */
@Slf4j
@Component
public class EquipmentAlertStatsTool extends AbstractBusinessTool {

    @Autowired
    private EquipmentAlertsService equipmentAlertsService;

    @Override
    public String getToolName() {
        return "equipment_alert_stats";
    }

    @Override
    public String getDescription() {
        return "获取设备告警统计信息。返回各严重程度(CRITICAL/WARNING/INFO)和各状态(ACTIVE/ACKNOWLEDGED/RESOLVED/IGNORED)的告警数量。" +
                "适用场景：了解设备告警整体情况、生成设备告警报表、监控设备健康状态。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // startDate: 开始日期（可选）
        Map<String, Object> startDate = new HashMap<>();
        startDate.put("type", "string");
        startDate.put("format", "date");
        startDate.put("description", "统计开始日期，格式：yyyy-MM-dd");
        properties.put("startDate", startDate);

        // endDate: 结束日期（可选）
        Map<String, Object> endDate = new HashMap<>();
        endDate.put("type", "string");
        endDate.put("format", "date");
        endDate.put("description", "统计结束日期，格式：yyyy-MM-dd");
        properties.put("endDate", endDate);

        schema.put("properties", properties);
        schema.put("required", Collections.emptyList());

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Collections.emptyList();
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行设备告警统计查询 - 工厂ID: {}, 参数: {}", factoryId, params);

        // 解析筛选参数（暂时未使用，为后续扩展预留）
        String startDate = getString(params, "startDate");
        String endDate = getString(params, "endDate");

        // 调用服务获取统计数据
        Map<String, Object> statistics = equipmentAlertsService.getAlertStatistics(factoryId);

        // 构建结果
        Map<String, Object> result = new HashMap<>();
        result.put("statistics", statistics);

        // 添加统计时间范围
        Map<String, Object> timeRange = new HashMap<>();
        if (startDate != null) timeRange.put("startDate", startDate);
        if (endDate != null) timeRange.put("endDate", endDate);
        if (!timeRange.isEmpty()) {
            result.put("queryConditions", timeRange);
        }

        // 添加健康状态评估
        result.put("healthAssessment", assessHealth(statistics));

        // 添加建议
        result.put("recommendations", generateRecommendations(statistics));

        log.info("设备告警统计查询完成 - 工厂ID: {}", factoryId);

        return result;
    }

    /**
     * 评估设备健康状态
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> assessHealth(Map<String, Object> statistics) {
        Map<String, Object> assessment = new HashMap<>();

        int criticalCount = 0;
        int activeCount = 0;

        // 尝试从统计数据中提取关键指标
        if (statistics != null) {
            Object bySeverity = statistics.get("bySeverity");
            if (bySeverity == null) {
                bySeverity = statistics.get("byLevel");
            }
            if (bySeverity instanceof Map) {
                Map<String, Object> severityMap = (Map<String, Object>) bySeverity;
                Object critical = severityMap.get("CRITICAL");
                if (critical instanceof Number) {
                    criticalCount = ((Number) critical).intValue();
                }
            }

            Object byStatus = statistics.get("byStatus");
            if (byStatus instanceof Map) {
                Map<String, Object> statusMap = (Map<String, Object>) byStatus;
                Object active = statusMap.get("ACTIVE");
                if (active instanceof Number) {
                    activeCount = ((Number) active).intValue();
                }
            }
        }

        // 评估健康等级
        String healthLevel;
        String healthDescription;

        if (criticalCount > 0) {
            healthLevel = "CRITICAL";
            healthDescription = "设备存在严重告警，需要立即处理";
        } else if (activeCount > 10) {
            healthLevel = "WARNING";
            healthDescription = "设备活动告警较多，建议及时处理";
        } else if (activeCount > 0) {
            healthLevel = "FAIR";
            healthDescription = "设备存在少量告警，运行基本正常";
        } else {
            healthLevel = "HEALTHY";
            healthDescription = "设备运行正常，无待处理告警";
        }

        assessment.put("level", healthLevel);
        assessment.put("description", healthDescription);
        assessment.put("criticalAlerts", criticalCount);
        assessment.put("activeAlerts", activeCount);

        return assessment;
    }

    /**
     * 生成处理建议
     */
    @SuppressWarnings("unchecked")
    private List<String> generateRecommendations(Map<String, Object> statistics) {
        List<String> recommendations = new ArrayList<>();

        if (statistics == null) {
            recommendations.add("建议检查设备告警系统是否正常运行");
            return recommendations;
        }

        // 从统计数据中提取信息生成建议
        Object bySeverity = statistics.get("bySeverity");
        if (bySeverity == null) {
            bySeverity = statistics.get("byLevel");
        }
        if (bySeverity instanceof Map) {
            Map<String, Object> severityMap = (Map<String, Object>) bySeverity;
            Object critical = severityMap.get("CRITICAL");
            if (critical instanceof Number && ((Number) critical).intValue() > 0) {
                recommendations.add("存在严重设备告警，请优先处理CRITICAL级别的问题");
            }
        }

        Object byStatus = statistics.get("byStatus");
        if (byStatus instanceof Map) {
            Map<String, Object> statusMap = (Map<String, Object>) byStatus;

            Object active = statusMap.get("ACTIVE");
            if (active instanceof Number && ((Number) active).intValue() > 5) {
                recommendations.add("活动设备告警数量较多，建议安排人员集中处理");
            }

            Object acknowledged = statusMap.get("ACKNOWLEDGED");
            if (acknowledged instanceof Number && ((Number) acknowledged).intValue() > 10) {
                recommendations.add("已确认但未解决的设备告警较多，建议跟进处理进度");
            }
        }

        if (recommendations.isEmpty()) {
            recommendations.add("设备告警状态良好，请继续保持监控");
        }

        return recommendations;
    }
}

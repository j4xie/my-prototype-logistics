package com.cretas.aims.ai.tool.impl.processing;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.dto.ProcessTaskDTO;
import com.cretas.aims.service.ProcessTaskService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Component
public class ProcessTaskAnalysisTool extends AbstractBusinessTool {

    @Autowired
    private ProcessTaskService processTaskService;

    @Override
    public String getToolName() {
        return "process_task_analysis";
    }

    @Override
    public String getDescription() {
        return "分析工序任务整体完成情况，统计各状态任务数量、完成率、延期风险等。" +
                "适用场景：查看工序生产整体进度、分析产能瓶颈、判断延期风险。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();
        properties.put("productionRunId", Map.of("type", "string",
                "description", "生产批次运行ID，传入则分析该批次下所有工序任务"));

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
        log.info("分析工序任务 - 工厂ID: {}, 参数: {}", factoryId, params);

        String productionRunId = getString(params, "productionRunId");

        if (productionRunId != null && !productionRunId.isEmpty()) {
            return analyzeByRun(factoryId, productionRunId);
        }

        return analyzeAll(factoryId);
    }

    private Map<String, Object> analyzeAll(String factoryId) {
        List<ProcessTaskDTO> activeTasks = processTaskService.getActiveTasks(factoryId);

        Map<String, Long> statusCounts = activeTasks.stream()
                .collect(Collectors.groupingBy(ProcessTaskDTO::getStatus, Collectors.counting()));

        BigDecimal totalPlanned = activeTasks.stream()
                .map(ProcessTaskDTO::getPlannedQuantity)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalCompleted = activeTasks.stream()
                .map(ProcessTaskDTO::getCompletedQuantity)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal overallProgress = totalPlanned.compareTo(BigDecimal.ZERO) > 0
                ? totalCompleted.multiply(new BigDecimal("100")).divide(totalPlanned, 1, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        long atRiskCount = activeTasks.stream()
                .filter(t -> "IN_PROGRESS".equals(t.getStatus()) && t.getExpectedEndDate() != null
                        && t.getExpectedEndDate().isBefore(java.time.LocalDate.now())
                        && t.getCompletedQuantity() != null && t.getPlannedQuantity() != null
                        && t.getCompletedQuantity().compareTo(t.getPlannedQuantity()) < 0)
                .count();

        Map<String, Object> analysis = new LinkedHashMap<>();
        analysis.put("totalActiveTasks", activeTasks.size());
        analysis.put("statusDistribution", statusCounts);
        analysis.put("totalPlannedQuantity", totalPlanned);
        analysis.put("totalCompletedQuantity", totalCompleted);
        analysis.put("overallProgressPercent", overallProgress);
        analysis.put("atRiskTasks", atRiskCount);

        Map<String, Object> result = new HashMap<>();
        result.put("message", String.format("工序任务分析完成：共 %d 个活跃任务，总体完成率 %s%%，%d 个延期风险",
                activeTasks.size(), overallProgress, atRiskCount));
        result.put("data", analysis);

        return result;
    }

    private Map<String, Object> analyzeByRun(String factoryId, String productionRunId) {
        ProcessTaskDTO.RunOverview overview = processTaskService.getRunOverview(factoryId, productionRunId);

        List<Map<String, Object>> taskDetails = overview.getTasks().stream().map(t -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("processName", t.getProcessName());
            item.put("status", t.getStatus());
            item.put("plannedQuantity", t.getPlannedQuantity());
            item.put("completedQuantity", t.getCompletedQuantity());
            item.put("unit", t.getUnit());
            return item;
        }).collect(Collectors.toList());

        Map<String, Object> runData = new LinkedHashMap<>();
        runData.put("productionRunId", overview.getProductionRunId());
        runData.put("productName", overview.getProductName());
        runData.put("customerName", overview.getSourceCustomerName());
        runData.put("overallProgressPercent", overview.getOverallProgress());
        runData.put("totalSteps", overview.getTasks().size());
        runData.put("tasks", taskDetails);

        Map<String, Object> result = new HashMap<>();
        result.put("message", String.format("生产批次「%s」分析完成，共 %d 道工序，总进度 %s%%",
                overview.getProductName(), overview.getTasks().size(), overview.getOverallProgress()));
        result.put("data", runData);

        return result;
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        if ("productionRunId".equals(paramName)) {
            return "请提供生产批次运行ID（productionRunId），或留空分析所有活跃任务";
        }
        return null;
    }
}

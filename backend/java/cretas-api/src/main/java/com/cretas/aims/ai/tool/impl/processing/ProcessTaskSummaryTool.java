package com.cretas.aims.ai.tool.impl.processing;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.dto.ProcessTaskDTO;
import com.cretas.aims.service.ProcessTaskService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Component
public class ProcessTaskSummaryTool extends AbstractBusinessTool {

    @Autowired
    private ProcessTaskService processTaskService;

    @Override
    public String getToolName() {
        return "process_task_summary";
    }

    @Override
    public String getDescription() {
        return "查询工序任务详细摘要，包含完成量、待审批量、参与工人、报工记录等。" +
                "适用场景：查看某个任务的详细进度、人员参与情况、报工明细。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();
        properties.put("taskId", Map.of("type", "string", "description", "工序任务ID"));

        schema.put("properties", properties);
        schema.put("required", List.of("taskId"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return List.of("taskId");
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        String taskId = getString(params, "taskId");
        log.info("查询工序任务摘要 - 工厂ID: {}, 任务ID: {}", factoryId, taskId);

        ProcessTaskDTO.TaskSummary summary = processTaskService.getTaskSummary(factoryId, taskId);

        Map<String, Object> summaryData = new LinkedHashMap<>();
        summaryData.put("taskId", summary.getTaskId());
        summaryData.put("processName", summary.getProcessName());
        summaryData.put("productName", summary.getProductName());
        summaryData.put("status", summary.getStatus());
        summaryData.put("plannedQuantity", summary.getPlannedQuantity());
        summaryData.put("completedQuantity", summary.getCompletedQuantity());
        summaryData.put("pendingQuantity", summary.getPendingQuantity());
        summaryData.put("unit", summary.getUnit());
        summaryData.put("totalWorkers", summary.getTotalWorkers());
        summaryData.put("totalReports", summary.getTotalReports());

        if (summary.getWorkerSummaries() != null) {
            summaryData.put("workers", summary.getWorkerSummaries().stream().map(w -> {
                Map<String, Object> worker = new LinkedHashMap<>();
                worker.put("workerName", w.getWorkerName());
                worker.put("totalQuantity", w.getTotalQuantity());
                worker.put("reportCount", w.getReportCount());
                return worker;
            }).collect(Collectors.toList()));
        }

        Map<String, Object> result = new HashMap<>();
        result.put("message", String.format("任务「%s」摘要查询完成", summary.getProcessName()));
        result.put("data", summaryData);

        return result;
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        if ("taskId".equals(paramName)) {
            return "请提供要查询的工序任务ID（taskId）";
        }
        return null;
    }
}

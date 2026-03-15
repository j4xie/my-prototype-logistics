package com.cretas.aims.ai.tool.impl.processing;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.dto.ProcessTaskDTO;
import com.cretas.aims.service.ProcessTaskService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Component
public class ProcessTaskQueryTool extends AbstractBusinessTool {

    @Autowired
    private ProcessTaskService processTaskService;

    @Override
    public String getToolName() {
        return "process_task_query";
    }

    @Override
    public String getDescription() {
        return "查询工序任务列表，支持按状态筛选。" +
                "适用场景：查看当前进行中的工序任务、待完成任务、已完成任务列表。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> status = new HashMap<>();
        status.put("type", "string");
        status.put("description", "任务状态筛选: PENDING/IN_PROGRESS/COMPLETED/CLOSED/SUPPLEMENTING，不传则查所有活跃任务");
        status.put("enum", List.of("PENDING", "IN_PROGRESS", "COMPLETED", "CLOSED", "SUPPLEMENTING"));
        properties.put("status", status);

        Map<String, Object> productTypeId = new HashMap<>();
        productTypeId.put("type", "string");
        productTypeId.put("description", "产品类型ID筛选");
        properties.put("productTypeId", productTypeId);

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
        log.info("查询工序任务 - 工厂ID: {}, 参数: {}", factoryId, params);

        String status = getString(params, "status");
        String productTypeId = getString(params, "productTypeId");

        List<ProcessTaskDTO> tasks;

        if (status == null && productTypeId == null) {
            tasks = processTaskService.getActiveTasks(factoryId);
        } else {
            var page = processTaskService.list(factoryId, status, productTypeId,
                    PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "createdAt")));
            tasks = page.getContent();
        }

        List<Map<String, Object>> taskList = tasks.stream().map(t -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", t.getId());
            item.put("processName", t.getProcessName());
            item.put("productName", t.getProductName());
            item.put("status", t.getStatus());
            item.put("plannedQuantity", t.getPlannedQuantity());
            item.put("completedQuantity", t.getCompletedQuantity());
            item.put("pendingQuantity", t.getPendingQuantity());
            item.put("unit", t.getUnit());
            item.put("startDate", t.getStartDate());
            return item;
        }).collect(Collectors.toList());

        Map<String, Object> result = new HashMap<>();
        result.put("message", String.format("查询到 %d 个工序任务", taskList.size()));
        result.put("data", Map.of("tasks", taskList, "total", taskList.size()));

        return result;
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        Map<String, String> questions = Map.of(
            "status", "请问要查看哪种状态的任务？（PENDING-待开始/IN_PROGRESS-进行中/COMPLETED-已完成/CLOSED-已关闭/SUPPLEMENTING-补报中）"
        );
        return questions.get(paramName);
    }
}

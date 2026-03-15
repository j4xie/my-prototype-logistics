package com.cretas.aims.ai.tool.impl.processing;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.dto.ProcessTaskDTO;
import com.cretas.aims.service.ProcessTaskService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@Slf4j
@Component
public class ProcessTaskCreateTool extends AbstractBusinessTool {

    @Autowired
    private ProcessTaskService processTaskService;

    @Override
    public String getToolName() {
        return "process_task_create";
    }

    @Override
    public String getDescription() {
        return "创建工序任务（工序制生产模式）。需要指定产品、工序、计划产量等信息。" +
                "适用场景：新建生产任务、安排工序生产计划。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        properties.put("productTypeId", Map.of("type", "string", "description", "产品类型ID"));
        properties.put("workProcessId", Map.of("type", "string", "description", "工序ID"));
        properties.put("plannedQuantity", Map.of("type", "number", "description", "计划产量"));
        properties.put("unit", Map.of("type", "string", "description", "计量单位，如 kg/个/箱", "default", "kg"));
        properties.put("startDate", Map.of("type", "string", "description", "开始日期，格式 yyyy-MM-dd，默认今日", "format", "date"));
        properties.put("expectedEndDate", Map.of("type", "string", "description", "预期结束日期，格式 yyyy-MM-dd", "format", "date"));
        properties.put("notes", Map.of("type", "string", "description", "备注"));

        schema.put("properties", properties);
        schema.put("required", List.of("productTypeId", "workProcessId", "plannedQuantity"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return List.of("productTypeId", "workProcessId", "plannedQuantity");
    }

    @Override
    public boolean supportsPreview() {
        return true;
    }

    @Override
    protected Map<String, Object> doPreview(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        Map<String, Object> preview = new LinkedHashMap<>();
        preview.put("status", "PREVIEW");
        preview.put("message", "即将创建工序任务");
        preview.put("productTypeId", getString(params, "productTypeId"));
        preview.put("workProcessId", getString(params, "workProcessId"));
        preview.put("plannedQuantity", getBigDecimal(params, "plannedQuantity"));
        preview.put("unit", getStringOrDefault(params, "unit", "kg"));
        preview.put("startDate", getStringOrDefault(params, "startDate", LocalDate.now().toString()));
        return preview;
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("创建工序任务 - 工厂ID: {}, 参数: {}", factoryId, params);

        ProcessTaskDTO dto = ProcessTaskDTO.builder()
                .productTypeId(getString(params, "productTypeId"))
                .workProcessId(getString(params, "workProcessId"))
                .plannedQuantity(getBigDecimal(params, "plannedQuantity"))
                .unit(getStringOrDefault(params, "unit", "kg"))
                .startDate(parseDate(getString(params, "startDate")))
                .expectedEndDate(parseDate(getString(params, "expectedEndDate")))
                .notes(getString(params, "notes"))
                .build();

        ProcessTaskDTO created = processTaskService.create(factoryId, dto);

        Map<String, Object> result = new HashMap<>();
        result.put("message", String.format("工序任务创建成功，任务ID: %s", created.getId()));
        result.put("data", Map.of(
                "id", created.getId(),
                "processName", created.getProcessName() != null ? created.getProcessName() : "",
                "productName", created.getProductName() != null ? created.getProductName() : "",
                "plannedQuantity", created.getPlannedQuantity(),
                "unit", created.getUnit(),
                "status", created.getStatus()
        ));

        return result;
    }

    private LocalDate parseDate(String dateStr) {
        if (dateStr == null || dateStr.isEmpty()) return null;
        return LocalDate.parse(dateStr);
    }

    private String getStringOrDefault(Map<String, Object> params, String key, String defaultVal) {
        String val = getString(params, key);
        return val != null ? val : defaultVal;
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        Map<String, String> questions = Map.of(
            "productTypeId", "请提供要生产的产品类型（productTypeId）",
            "workProcessId", "请提供工序ID（workProcessId）",
            "plannedQuantity", "请提供计划产量（plannedQuantity）"
        );
        return questions.get(paramName);
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        Map<String, String> names = Map.of(
            "productTypeId", "产品类型",
            "workProcessId", "工序",
            "plannedQuantity", "计划产量"
        );
        return names.getOrDefault(paramName, paramName);
    }
}

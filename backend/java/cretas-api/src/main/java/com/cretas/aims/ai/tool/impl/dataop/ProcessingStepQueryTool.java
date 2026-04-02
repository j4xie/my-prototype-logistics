package com.cretas.aims.ai.tool.impl.dataop;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 加工步骤查询工具
 *
 * 查询生产批次的当前加工步骤和进度。
 * Intent Code: QUERY_PROCESSING_CURRENT_STEP / QUERY_PROCESSING_STEP
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class ProcessingStepQueryTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "processing_step_query";
    }

    @Override
    public String getDescription() {
        return "查询生产批次的当前加工步骤和进度。" +
                "适用场景：查看批次当前状态、加工进度、当前工序。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> batchId = new HashMap<>();
        batchId.put("type", "string");
        batchId.put("description", "批次ID或批次号");
        properties.put("batchId", batchId);

        schema.put("properties", properties);
        schema.put("required", Collections.singletonList("batchId"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Collections.singletonList("batchId");
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        // 加工步骤查询服务未接入 — 禁止降级处理，返回明确错误而非模拟数据
        return buildSimpleResult("error", java.util.Map.of(
                "success", false,
                "error", "加工步骤查询服务尚未接入，请联系管理员配置 ProcessingService",
                "code", "SERVICE_NOT_AVAILABLE"));
    }
}

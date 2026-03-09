package com.cretas.aims.ai.tool.impl.dataop;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 溯源码生成工具
 *
 * 为指定批次生成溯源码/溯源链接。
 * Intent Code: TRACE_GENERATE
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class TraceGenerateTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "trace_generate";
    }

    @Override
    public String getDescription() {
        return "为指定批次生成溯源码和溯源链接。" +
                "适用场景：生成溯源码、生成二维码、获取溯源链接。";
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
        log.info("生成溯源码 - 工厂ID: {}, 参数: {}", factoryId, params);

        String batchId = getString(params, "batchId");

        Map<String, Object> result = new HashMap<>();
        result.put("batchId", batchId);
        result.put("traceUrl", "https://trace.cretas.com/" + batchId);
        result.put("message", "溯源码已生成，批次: " + batchId);

        return result;
    }
}

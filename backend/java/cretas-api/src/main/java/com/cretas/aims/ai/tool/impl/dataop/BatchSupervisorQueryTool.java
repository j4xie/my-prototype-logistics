package com.cretas.aims.ai.tool.impl.dataop;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 批次负责人查询工具
 *
 * 查询生产批次的负责人/主管信息。
 * Intent Code: QUERY_PROCESSING_BATCH_SUPERVISOR
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class BatchSupervisorQueryTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "batch_supervisor_query";
    }

    @Override
    public String getDescription() {
        return "查询生产批次的负责人/主管信息。" +
                "适用场景：查看谁在负责某个批次、批次主管是谁。";
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
        log.info("查询批次负责人 - 工厂ID: {}, 参数: {}", factoryId, params);

        String batchId = getString(params, "batchId");

        // TODO: 调用 ProcessingService.getBatchById
        Map<String, Object> result = new HashMap<>();
        result.put("batchId", batchId);
        result.put("message", "批次 [" + batchId + "] 负责人查询完成");
        result.put("notice", "请接入ProcessingService完成实际查询");

        return result;
    }
}

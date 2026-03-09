package com.cretas.aims.ai.tool.impl.dataop;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 批量删除确认工具
 *
 * 处理批量删除操作，需要确认后执行。
 * Intent Code: DATA_BATCH_DELETE
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class BatchDeleteConfirmTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "batch_delete_confirm";
    }

    @Override
    public String getDescription() {
        return "执行批量删除操作。此为高危操作，必须确认后执行。" +
                "适用场景：批量删除数据、清理过期数据。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> entityType = new HashMap<>();
        entityType.put("type", "string");
        entityType.put("description", "要删除的数据类型");
        properties.put("entityType", entityType);

        Map<String, Object> filter = new HashMap<>();
        filter.put("type", "string");
        filter.put("description", "筛选条件描述");
        properties.put("filter", filter);

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
        log.info("批量删除确认 - 工厂ID: {}", factoryId);

        Map<String, Object> result = new HashMap<>();
        result.put("status", "NEED_CONFIRM");
        result.put("message", "批量删除操作需要确认。请提供要删除的数据类型和筛选条件。\n此操作不可撤销！");

        return result;
    }
}

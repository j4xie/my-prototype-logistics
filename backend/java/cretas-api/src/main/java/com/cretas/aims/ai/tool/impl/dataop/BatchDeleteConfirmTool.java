package com.cretas.aims.ai.tool.impl.dataop;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.service.MaterialBatchService;
import com.cretas.aims.service.ProcessingService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
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

    @Autowired
    private ProcessingService processingService;

    @Autowired
    private MaterialBatchService materialBatchService;

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
        entityType.put("description", "要删除的数据类型，如 PRODUCTION_BATCH、MATERIAL_BATCH");
        properties.put("entityType", entityType);

        Map<String, Object> ids = new HashMap<>();
        ids.put("type", "array");
        ids.put("description", "要删除的记录ID列表");
        properties.put("ids", ids);

        Map<String, Object> filter = new HashMap<>();
        filter.put("type", "string");
        filter.put("description", "筛选条件描述（当不提供ids时使用）");
        properties.put("filter", filter);

        Map<String, Object> confirmed = new HashMap<>();
        confirmed.put("type", "boolean");
        confirmed.put("description", "是否已确认（必须为true才会执行删除）");
        properties.put("confirmed", confirmed);

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
        Boolean confirmed = (Boolean) params.get("confirmed");
        String entityType = getString(params, "entityType");

        // Safety gate: require explicit confirmation
        if (!Boolean.TRUE.equals(confirmed)) {
            return buildSimpleResult("删除操作需要确认", Map.of(
                    "message", "批量删除是高危操作，请传入 confirmed=true 明确确认执行",
                    "entityType", entityType != null ? entityType : "未指定",
                    "tip", "支持的实体类型: PRODUCTION_BATCH(取消生产批次), MATERIAL_BATCH(删除原材料批次)"));
        }

        if (entityType == null || entityType.isBlank()) {
            return buildSimpleResult("缺少实体类型", Map.of(
                    "message", "请指定要删除的实体类型: PRODUCTION_BATCH 或 MATERIAL_BATCH",
                    "confirmed", true));
        }

        // Get ids list if provided
        Object idsObj = params.get("ids");
        List<String> idList = new ArrayList<>();
        if (idsObj instanceof List<?>) {
            for (Object id : (List<?>) idsObj) {
                if (id != null) idList.add(id.toString());
            }
        }

        if (idList.isEmpty()) {
            return buildSimpleResult("缺少删除目标", Map.of(
                    "message", "请提供要删除的记录ID列表 (ids 参数)",
                    "entityType", entityType));
        }

        try {
            int deletedCount = 0;
            List<String> errors = new ArrayList<>();

            switch (entityType.toUpperCase()) {
                case "PRODUCTION_BATCH" -> {
                    for (String id : idList) {
                        try {
                            // Cancel production batch as soft-delete alternative
                            processingService.cancelProduction(factoryId, id, "AI批量删除操作");
                            deletedCount++;
                        } catch (Exception ex) {
                            errors.add("批次 " + id + " 取消失败: " + ex.getMessage());
                        }
                    }
                }
                case "MATERIAL_BATCH" -> {
                    for (String id : idList) {
                        try {
                            materialBatchService.deleteMaterialBatch(factoryId, id);
                            deletedCount++;
                        } catch (Exception ex) {
                            errors.add("批次 " + id + " 删除失败: " + ex.getMessage());
                        }
                    }
                }
                default -> {
                    return buildSimpleResult("不支持的实体类型", Map.of(
                            "entityType", entityType,
                            "supported", Arrays.asList("PRODUCTION_BATCH", "MATERIAL_BATCH")));
                }
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("entityType", entityType);
            result.put("requestedCount", idList.size());
            result.put("deletedCount", deletedCount);
            result.put("errors", errors);
            result.put("success", errors.isEmpty());

            return buildSimpleResult(deletedCount > 0 ? "批量删除完成" : "批量删除失败", result);
        } catch (Exception e) {
            log.error("批量删除失败: factoryId={}, entityType={}", factoryId, entityType, e);
            throw e;
        }
    }
}

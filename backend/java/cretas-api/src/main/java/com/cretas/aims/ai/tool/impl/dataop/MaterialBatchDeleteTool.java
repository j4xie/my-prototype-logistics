package com.cretas.aims.ai.tool.impl.dataop;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 原料批次删除工具
 *
 * 删除原料批次，只能删除未使用的批次。需要确认操作。
 * Intent Code: MATERIAL_BATCH_DELETE
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class MaterialBatchDeleteTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "material_batch_delete";
    }

    @Override
    public String getDescription() {
        return "删除原料批次。只能删除未使用的批次，已使用的批次只能标记为报废。" +
                "适用场景：删除错误入库的批次、移除未使用的原料批次。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> batchId = new HashMap<>();
        batchId.put("type", "string");
        batchId.put("description", "原料批次ID或批次号");
        properties.put("batchId", batchId);

        Map<String, Object> confirmed = new HashMap<>();
        confirmed.put("type", "boolean");
        confirmed.put("description", "是否已确认删除");
        properties.put("confirmed", confirmed);

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
        log.info("删除原料批次 - 工厂ID: {}, 参数: {}", factoryId, params);

        String batchId = getString(params, "batchId");
        Boolean confirmed = getBoolean(params, "confirmed", false);

        Map<String, Object> result = new HashMap<>();
        result.put("batchId", batchId);

        if (!confirmed) {
            result.put("status", "NEED_CONFIRM");
            result.put("message", "确认删除原料批次 [" + batchId + "]？已使用的批次只能标记为报废。");
        } else {
            // TODO: 调用 MaterialBatchService.deleteMaterialBatch
            result.put("message", "原料批次 [" + batchId + "] 已删除。");
            result.put("operation", "DELETE");
        }
        result.put("notice", "请接入MaterialBatchService完成实际操作");

        return result;
    }
}

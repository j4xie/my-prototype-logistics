package com.cretas.aims.ai.tool.impl.dataop;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 供应商删除工具
 *
 * 删除供应商，需要确认操作。
 * Intent Code: SUPPLIER_DELETE
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class SupplierDeleteTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "supplier_delete";
    }

    @Override
    public String getDescription() {
        return "删除供应商。此为不可恢复操作，需要确认。" +
                "适用场景：移除供应商、删除不再合作的供应商。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> supplierId = new HashMap<>();
        supplierId.put("type", "string");
        supplierId.put("description", "供应商ID");
        properties.put("supplierId", supplierId);

        Map<String, Object> confirmed = new HashMap<>();
        confirmed.put("type", "boolean");
        confirmed.put("description", "是否已确认删除");
        properties.put("confirmed", confirmed);

        schema.put("properties", properties);
        schema.put("required", Collections.singletonList("supplierId"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Collections.singletonList("supplierId");
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("删除供应商 - 工厂ID: {}, 参数: {}", factoryId, params);

        String supplierId = getString(params, "supplierId");
        Boolean confirmed = getBoolean(params, "confirmed", false);

        Map<String, Object> result = new HashMap<>();
        result.put("supplierId", supplierId);

        if (!confirmed) {
            result.put("status", "NEED_CONFIRM");
            result.put("message", "确认删除供应商 [" + supplierId + "]？此操作不可恢复。");
        } else {
            // TODO: 调用 SupplierService.deleteSupplier
            result.put("message", "供应商 [" + supplierId + "] 已删除。");
            result.put("operation", "DELETE");
        }
        result.put("notice", "请接入SupplierService完成实际操作");

        return result;
    }
}

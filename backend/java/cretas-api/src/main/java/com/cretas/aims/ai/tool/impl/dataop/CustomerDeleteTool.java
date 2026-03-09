package com.cretas.aims.ai.tool.impl.dataop;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 客户删除工具
 *
 * 删除客户，需要确认操作。关联订单和出货记录将失去客户信息。
 * Intent Code: CUSTOMER_DELETE
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class CustomerDeleteTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "customer_delete";
    }

    @Override
    public String getDescription() {
        return "删除客户。此为不可恢复操作，关联订单和出货记录将失去客户信息。" +
                "适用场景：移除客户、删除不再合作的客户。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> customerId = new HashMap<>();
        customerId.put("type", "string");
        customerId.put("description", "客户ID");
        properties.put("customerId", customerId);

        Map<String, Object> confirmed = new HashMap<>();
        confirmed.put("type", "boolean");
        confirmed.put("description", "是否已确认删除");
        properties.put("confirmed", confirmed);

        schema.put("properties", properties);
        schema.put("required", Collections.singletonList("customerId"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Collections.singletonList("customerId");
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("删除客户 - 工厂ID: {}, 参数: {}", factoryId, params);

        String customerId = getString(params, "customerId");
        Boolean confirmed = getBoolean(params, "confirmed", false);

        Map<String, Object> result = new HashMap<>();
        result.put("customerId", customerId);

        if (!confirmed) {
            result.put("status", "NEED_CONFIRM");
            result.put("message", "确认删除客户 [" + customerId + "]？关联订单和出货记录将失去客户信息。");
        } else {
            // TODO: 调用 CustomerService.deleteCustomer
            result.put("message", "客户 [" + customerId + "] 已删除。");
            result.put("operation", "DELETE");
        }
        result.put("notice", "请接入CustomerService完成实际操作");

        return result;
    }
}

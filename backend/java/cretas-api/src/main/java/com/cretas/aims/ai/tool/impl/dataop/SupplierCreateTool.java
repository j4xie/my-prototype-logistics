package com.cretas.aims.ai.tool.impl.dataop;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 供应商创建工具
 *
 * 新增供应商，需要提供名称、联系人和电话。
 * Intent Code: SUPPLIER_CREATE
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class SupplierCreateTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "supplier_create";
    }

    @Override
    public String getDescription() {
        return "新增供应商。需要提供供应商名称、联系人和联系电话。" +
                "适用场景：添加新供应商、录入供应商信息。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> name = new HashMap<>();
        name.put("type", "string");
        name.put("description", "供应商名称");
        properties.put("name", name);

        Map<String, Object> contactPerson = new HashMap<>();
        contactPerson.put("type", "string");
        contactPerson.put("description", "联系人姓名");
        properties.put("contactPerson", contactPerson);

        Map<String, Object> phone = new HashMap<>();
        phone.put("type", "string");
        phone.put("description", "联系电话");
        properties.put("phone", phone);

        Map<String, Object> address = new HashMap<>();
        address.put("type", "string");
        address.put("description", "地址（可选）");
        properties.put("address", address);

        Map<String, Object> email = new HashMap<>();
        email.put("type", "string");
        email.put("description", "邮箱（可选）");
        properties.put("email", email);

        schema.put("properties", properties);
        schema.put("required", Arrays.asList("name", "contactPerson", "phone"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Arrays.asList("name", "contactPerson", "phone");
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        return switch (paramName) {
            case "name" -> "请提供供应商名称。";
            case "contactPerson" -> "请提供联系人姓名。";
            case "phone" -> "请提供联系电话。";
            default -> super.getParameterQuestion(paramName);
        };
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("创建供应商 - 工厂ID: {}, 参数: {}", factoryId, params);

        String name = getString(params, "name");
        String contactPerson = getString(params, "contactPerson");
        String phone = getString(params, "phone");

        // TODO: 调用 SupplierService.createSupplier
        Map<String, Object> result = new HashMap<>();
        result.put("message", "供应商「" + name + "」创建成功！联系人: " + contactPerson);
        result.put("name", name);
        result.put("contactPerson", contactPerson);
        result.put("phone", phone);
        result.put("notice", "请接入SupplierService完成实际创建");

        return result;
    }
}

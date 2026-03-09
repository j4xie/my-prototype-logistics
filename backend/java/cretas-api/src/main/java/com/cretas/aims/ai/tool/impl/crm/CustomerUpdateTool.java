package com.cretas.aims.ai.tool.impl.crm;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.dto.customer.CreateCustomerRequest;
import com.cretas.aims.dto.customer.CustomerDTO;
import com.cretas.aims.service.CustomerService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.*;

@Slf4j
@Component
public class CustomerUpdateTool extends AbstractBusinessTool {

    @Autowired
    private CustomerService customerService;

    @Override
    public String getToolName() {
        return "customer_update";
    }

    @Override
    public String getDescription() {
        return "更新客户信息。根据客户ID更新客户的联系人、电话、地址、类型等字段。" +
                "适用场景：修改客户信息、更新联系方式、变更客户类型。";
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

        Map<String, Object> name = new HashMap<>();
        name.put("type", "string");
        name.put("description", "客户名称");
        properties.put("name", name);

        Map<String, Object> contactPerson = new HashMap<>();
        contactPerson.put("type", "string");
        contactPerson.put("description", "联系人姓名");
        properties.put("contactPerson", contactPerson);

        Map<String, Object> phone = new HashMap<>();
        phone.put("type", "string");
        phone.put("description", "联系电话");
        properties.put("phone", phone);

        Map<String, Object> shippingAddress = new HashMap<>();
        shippingAddress.put("type", "string");
        shippingAddress.put("description", "收货地址");
        properties.put("shippingAddress", shippingAddress);

        Map<String, Object> type = new HashMap<>();
        type.put("type", "string");
        type.put("description", "客户类型");
        properties.put("type", type);

        schema.put("properties", properties);
        schema.put("required", Arrays.asList("customerId"));
        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Collections.singletonList("customerId");
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        String customerId = getString(params, "customerId");

        CreateCustomerRequest request = new CreateCustomerRequest();
        String name = getString(params, "name");
        if (name != null) request.setName(name);
        String contactPerson = getString(params, "contactPerson");
        if (contactPerson != null) request.setContactPerson(contactPerson);
        String phone = getString(params, "phone");
        if (phone != null) request.setPhone(phone);
        String shippingAddress = getString(params, "shippingAddress");
        if (shippingAddress != null) request.setShippingAddress(shippingAddress);
        String type = getString(params, "type");
        if (type != null) request.setType(type);

        CustomerDTO customer = customerService.updateCustomer(factoryId, customerId, request);

        Map<String, Object> result = new HashMap<>();
        result.put("customer", customer);
        result.put("message", "客户信息更新成功: " + customer.getName());
        return result;
    }
}

package com.cretas.aims.ai.tool.impl.system;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 审批流程配置工具
 *
 * 查询和配置采购审批流程。
 * Intent Code: APPROVAL_CONFIG_PURCHASE_ORDER
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class ApprovalConfigTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "approval_config";
    }

    @Override
    public String getDescription() {
        return "查询和配置采购审批流程。支持查看当前审批链配置、审批级别和审批角色。" +
                "适用场景：查看采购审批流程、配置审批链、管理审批角色分配。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> decisionType = new HashMap<>();
        decisionType.put("type", "string");
        decisionType.put("description", "审批决策类型");
        decisionType.put("enum", Arrays.asList("PURCHASE_ORDER", "SUPPLIER_APPROVAL", "PRODUCTION_PLAN"));
        properties.put("decisionType", decisionType);

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
        log.info("查询审批配置 - 工厂ID: {}", factoryId);

        String decisionType = getString(params, "decisionType", "PURCHASE_ORDER");

        // TODO: 调用 ApprovalChainService.getConfigsByDecisionType
        Map<String, Object> result = new HashMap<>();
        result.put("message", "采购审批流程配置查询完成");
        result.put("factoryId", factoryId);
        result.put("decisionType", decisionType);
        result.put("notice", "请接入ApprovalChainService完成实际查询");

        return result;
    }
}

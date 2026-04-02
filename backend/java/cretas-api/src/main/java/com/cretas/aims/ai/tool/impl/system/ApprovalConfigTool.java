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
        // 审批流程配置服务未接入 — 禁止降级处理，返回明确错误而非模拟数据
        return buildSimpleResult("error", java.util.Map.of(
                "success", false,
                "error", "审批流程配置服务尚未接入，请联系管理员配置 ApprovalChainService",
                "code", "SERVICE_NOT_AVAILABLE"));
    }
}

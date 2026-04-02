package com.cretas.aims.ai.tool.impl.dataop;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 审批记录查询工具
 *
 * 查询审批记录，包括待审批和已审批的记录。
 * Intent Code: QUERY_APPROVAL_RECORD
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class ApprovalRecordQueryTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "approval_record_query";
    }

    @Override
    public String getDescription() {
        return "查询审批记录，包括待审批和已审批的记录。" +
                "适用场景：查看审批历史、待审批事项。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");
        schema.put("properties", new HashMap<>());
        schema.put("required", Collections.emptyList());
        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Collections.emptyList();
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        // 审批记录查询服务未接入 — 禁止降级处理，返回明确错误而非模拟数据
        return buildSimpleResult("error", java.util.Map.of(
                "success", false,
                "error", "审批记录查询服务尚未接入，请联系管理员配置 ApprovalService",
                "code", "SERVICE_NOT_AVAILABLE"));
    }
}

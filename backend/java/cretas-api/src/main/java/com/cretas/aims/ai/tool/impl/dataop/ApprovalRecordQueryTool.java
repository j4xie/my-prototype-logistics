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
        log.info("查询审批记录 - 工厂ID: {}", factoryId);

        Map<String, Object> result = new HashMap<>();
        result.put("queryType", "approval_record");
        result.put("factoryId", factoryId);
        result.put("message", "审批记录查询功能已就绪。请前往审批管理页面查看待审批和已审批记录。");

        return result;
    }
}

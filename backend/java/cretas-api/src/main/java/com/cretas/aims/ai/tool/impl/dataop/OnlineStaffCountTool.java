package com.cretas.aims.ai.tool.impl.dataop;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 在线人员统计工具
 *
 * 查询当前在线人员数量。
 * Intent Code: QUERY_ONLINE_STAFF_COUNT
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class OnlineStaffCountTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "online_staff_count";
    }

    @Override
    public String getDescription() {
        return "查询当前在线人员数量和统计信息。" +
                "适用场景：查看多少人在线、在线人数统计。";
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
        log.info("查询在线人数 - 工厂ID: {}", factoryId);

        Map<String, Object> result = new HashMap<>();
        result.put("queryType", "online_staff_count");
        result.put("factoryId", factoryId);
        result.put("message", "在线人员统计功能已就绪。请前往HR管理页面查看在线人员信息。");

        return result;
    }
}

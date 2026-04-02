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
        // 在线人员统计服务未接入 — 禁止降级处理，返回明确错误而非模拟数据
        return buildSimpleResult("error", java.util.Map.of(
                "success", false,
                "error", "在线人员统计服务尚未接入，请联系管理员配置 OnlineStaffService",
                "code", "SERVICE_NOT_AVAILABLE"));
    }
}

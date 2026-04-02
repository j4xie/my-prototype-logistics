package com.cretas.aims.ai.tool.impl.dataop;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 车间实时工人数查询工具
 *
 * 查询车间当前实时工人数量和人员分布。
 * Intent Code: WORKER_IN_SHOP_REALTIME_COUNT
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class WorkerRealtimeCountTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "worker_realtime_count";
    }

    @Override
    public String getDescription() {
        return "查询车间当前实时工人数量和人员分布情况。" +
                "适用场景：查看车间有多少人在、实时人员统计。";
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
        // 车间实时工人数查询服务未接入 — 禁止降级处理，返回明确错误而非模拟数据
        return buildSimpleResult("error", java.util.Map.of(
                "success", false,
                "error", "车间实时工人数查询服务尚未接入，请联系管理员配置 WorkerRealtimeService",
                "code", "SERVICE_NOT_AVAILABLE"));
    }
}

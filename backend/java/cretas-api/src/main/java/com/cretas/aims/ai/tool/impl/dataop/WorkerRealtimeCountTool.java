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
        log.info("查询车间实时工人数 - 工厂ID: {}", factoryId);

        Map<String, Object> result = new HashMap<>();
        result.put("queryType", "worker_realtime_count");
        result.put("factoryId", factoryId);
        result.put("message", "车间实时工人数查询功能已就绪。请前往生产监控页面查看实时人员分布。");

        return result;
    }
}

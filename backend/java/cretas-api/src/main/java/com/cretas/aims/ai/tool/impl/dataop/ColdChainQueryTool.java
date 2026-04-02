package com.cretas.aims.ai.tool.impl.dataop;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 冷链温度查询工具
 *
 * 查询冷库温度记录。
 * Intent Code: COLD_CHAIN_TEMPERATURE
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class ColdChainQueryTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "cold_chain_query";
    }

    @Override
    public String getDescription() {
        return "查询冷库温度记录。支持按冷库编号和时间范围查询。" +
                "适用场景：查看冷库温度、温度历史记录、冷链监控。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> warehouseId = new HashMap<>();
        warehouseId.put("type", "string");
        warehouseId.put("description", "冷库编号或名称");
        properties.put("warehouseId", warehouseId);

        Map<String, Object> timeRange = new HashMap<>();
        timeRange.put("type", "string");
        timeRange.put("description", "时间范围，如'今天'、'最近7天'");
        properties.put("timeRange", timeRange);

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
        // 冷链温度查询服务未接入 — 禁止降级处理，返回明确错误而非模拟数据
        return buildSimpleResult("error", java.util.Map.of(
                "success", false,
                "error", "冷链温度查询服务尚未接入，请联系管理员配置 ColdChainService",
                "code", "SERVICE_NOT_AVAILABLE"));
    }
}

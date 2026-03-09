package com.cretas.aims.ai.tool.impl.system;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 上下文继续工具
 *
 * 处理用户请求继续上一次操作的场景。
 * Intent Code: CONTEXT_CONTINUE / CONTINUE_LAST_OPERATION / SYSTEM_RESUME_LAST_ACTION
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class ContextContinueTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "context_continue";
    }

    @Override
    public String getDescription() {
        return "处理用户请求继续上一次操作的场景，引导用户提供更具体的查询意图。" +
                "适用场景：用户说'继续'、'接着'、'然后呢'等。";
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
        log.info("上下文继续 - 工厂ID: {}", factoryId);

        Map<String, Object> result = new HashMap<>();
        result.put("message", "请告诉我您想继续查询什么？例如：「查看库存」「查看今天的生产数据」「看一下设备状态」");

        return result;
    }
}

package com.cretas.aims.ai.tool.impl.system;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 翻页工具
 *
 * 处理用户请求翻页/下一页的场景。
 * Intent Code: PAGINATION_NEXT / NAVIGATION_NEXT_PAGE
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class PaginationNextTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "pagination_next";
    }

    @Override
    public String getDescription() {
        return "处理翻页请求，引导用户指定要翻页的数据类型。" +
                "适用场景：用户说'下一页'、'翻页'、'更多'等。";
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
        log.info("翻页请求 - 工厂ID: {}", factoryId);

        Map<String, Object> result = new HashMap<>();
        result.put("message", "请告诉我您想查看哪类数据的下一页？例如：「下一页库存」「下一页订单」");

        return result;
    }
}

package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.service.workflow.WorkflowNodeRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
// Moved from "/api/workflow" to "/api/mobile/workflow" so 139 nginx gateway
// proxies it (gateway only forwards /api/mobile/** to backend). Old URL
// returned index.html (Vite SPA fallback) — caused R20-F2 (workflow designer
// renders 766 empty 📦 tiles because v-for iterates over HTML string chars).
// Frontend api/workflow.ts updated in sync.
@RequestMapping("/api/mobile/workflow")
@RequiredArgsConstructor
public class WorkflowNodeController {

    private final WorkflowNodeRegistry workflowNodeRegistry;

    @GetMapping("/node-schemas")
    public ApiResponse<List<Map<String, Object>>> getNodeSchemas() {
        return ApiResponse.success(workflowNodeRegistry.getAllNodeSchemas());
    }

    @GetMapping("/node-schemas/by-category")
    public ApiResponse<List<Map<String, Object>>> getNodeSchemasByCategory(
            @RequestParam String category) {
        return ApiResponse.success(workflowNodeRegistry.getNodeSchemasByCategory(category));
    }

    /**
     * 工作流配置校验 (最小可用版).
     *
     * 接收前端工作流设计器序列化后的配置 JSON, 做基础结构校验:
     * <ul>
     *   <li>必须包含至少一个 nodes/states 节点</li>
     *   <li>必须包含至少一个 edges/transitions 连线 (空图允许单节点流程,只警告)</li>
     *   <li>各节点/连线必须是 JSON 对象或数组形态</li>
     * </ul>
     *
     * 返回格式: {@code { valid: bool, errors: [...], warnings: [...] }}
     *
     * <p><b>说明</b>: 深度业务校验 (初始态唯一性/孤立节点/事件命名重复等) 目前由前端
     * {@code validateWorkflow()} 函数承担. 本后端接口仅保证路径 200,
     * 防止将来若有 client 改为 server-side 校验时直接 404.
     *
     * @since 2026-04-14
     */
    @RequestMapping(value = "/validate", method = {RequestMethod.POST, RequestMethod.PUT})
    public ApiResponse<Map<String, Object>> validateWorkflow(@RequestBody(required = false) Map<String, Object> payload) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (payload == null || payload.isEmpty()) {
            errors.add("请求体为空,缺少工作流配置");
        } else {
            Object nodes = firstNonNull(payload.get("nodes"), payload.get("states"));
            Object edges = firstNonNull(payload.get("edges"), payload.get("transitions"));

            if (!isNonEmptyCollection(nodes)) {
                errors.add("缺少 nodes/states,工作流至少需要一个节点");
            }
            if (edges != null && !(edges instanceof Collection<?>) && !(edges instanceof Object[])) {
                errors.add("edges/transitions 必须是数组");
            } else if (!isNonEmptyCollection(edges)) {
                warnings.add("工作流没有连线,单节点流程请确认是否符合预期");
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("valid", errors.isEmpty());
        result.put("errors", errors);
        result.put("warnings", warnings);
        return ApiResponse.success(errors.isEmpty() ? "校验通过" : "校验未通过", result);
    }

    private static Object firstNonNull(Object a, Object b) {
        return a != null ? a : b;
    }

    private static boolean isNonEmptyCollection(Object value) {
        if (value == null) return false;
        if (value instanceof Collection<?>) return !((Collection<?>) value).isEmpty();
        if (value instanceof Object[]) return ((Object[]) value).length > 0;
        return false;
    }
}

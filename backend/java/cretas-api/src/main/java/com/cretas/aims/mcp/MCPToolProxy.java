package com.cretas.aims.mcp;

import com.cretas.aims.ai.dto.ToolCall;
import com.cretas.aims.ai.tool.ToolExecutor;
import com.cretas.aims.mcp.MCPProtocol.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/**
 * MCP Tool Proxy — 将外部 MCP 服务器上的工具包装为本地 ToolExecutor
 *
 * <p>通过 HTTP 调用外部 MCP 服务器的 {@code tools/call} 端点来执行工具。
 * 工具名称自动添加 {@code mcp_} 前缀以区分本地工具和外部工具。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-09
 */
@Slf4j
public class MCPToolProxy implements ToolExecutor {

    private final String serverUrl;
    private final MCPToolDefinition toolDefinition;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    /**
     * 创建 MCP Tool Proxy
     *
     * @param serverUrl 外部 MCP 服务器的基础 URL（如 http://localhost:9000/api/mcp）
     * @param toolDefinition 工具定义（从外部服务器的 tools/list 获取）
     * @param restTemplate Spring RestTemplate 实例
     * @param objectMapper Jackson ObjectMapper 实例
     */
    public MCPToolProxy(String serverUrl, MCPToolDefinition toolDefinition,
                        RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.serverUrl = serverUrl.endsWith("/") ? serverUrl.substring(0, serverUrl.length() - 1) : serverUrl;
        this.toolDefinition = toolDefinition;
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * 工具名称，添加 "mcp_" 前缀以区分外部工具
     */
    @Override
    public String getToolName() {
        return "mcp_" + toolDefinition.getName();
    }

    @Override
    public String getDescription() {
        return toolDefinition.getDescription();
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        return toolDefinition.getInputSchema() != null
                ? toolDefinition.getInputSchema()
                : Map.of("type", "object", "properties", Map.of());
    }

    /**
     * 通过 HTTP 调用外部 MCP 服务器执行工具
     *
     * @param toolCall 工具调用对象（包含参数 JSON）
     * @param context 执行上下文
     * @return 外部工具的执行结果（JSON 字符串）
     * @throws Exception 网络或执行异常
     */
    @Override
    public String execute(ToolCall toolCall, Map<String, Object> context) throws Exception {
        String callUrl = serverUrl + "/tools/call";
        String requestId = toolCall.getId() != null ? toolCall.getId() : UUID.randomUUID().toString();

        log.info("MCP Proxy 调用外部工具: server={}, tool={}", serverUrl, toolDefinition.getName());

        try {
            // 解析参数
            Object arguments;
            String argsStr = toolCall.getFunction() != null ? toolCall.getFunction().getArguments() : "{}";
            try {
                arguments = objectMapper.readValue(argsStr, Map.class);
            } catch (Exception e) {
                arguments = Map.of();
            }

            // 构建 MCP 请求
            Map<String, Object> params = new LinkedHashMap<>();
            params.put("name", toolDefinition.getName());  // 使用原始名称（不带 mcp_ 前缀）
            params.put("arguments", arguments);
            if (context != null && !context.isEmpty()) {
                params.put("context", context);
            }

            MCPRequest mcpRequest = MCPRequest.builder()
                    .id(requestId)
                    .method("tools/call")
                    .params(params)
                    .build();

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<MCPRequest> httpEntity = new HttpEntity<>(mcpRequest, headers);

            ResponseEntity<MCPResponse> response = restTemplate.exchange(
                    callUrl, HttpMethod.POST, httpEntity, MCPResponse.class);

            MCPResponse mcpResponse = response.getBody();
            if (mcpResponse == null) {
                throw new RuntimeException("MCP 服务器返回空响应: " + serverUrl);
            }

            if (mcpResponse.getError() != null) {
                MCPError error = mcpResponse.getError();
                throw new RuntimeException(String.format("MCP 工具执行错误 [%d]: %s",
                        error.getCode(), error.getMessage()));
            }

            // 返回结果 JSON
            return objectMapper.writeValueAsString(mcpResponse.getResult());

        } catch (Exception e) {
            log.error("MCP Proxy 调用失败: server={}, tool={}, error={}",
                    serverUrl, toolDefinition.getName(), e.getMessage());
            throw e;
        }
    }
}

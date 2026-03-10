package com.cretas.aims.mcp;

import com.cretas.aims.ai.tool.ToolRegistry;
import com.cretas.aims.mcp.MCPProtocol.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import javax.annotation.PostConstruct;
import java.util.*;

/**
 * MCP Client Adapter — 发现并注册外部 MCP 服务器上的工具
 *
 * <p>在应用启动时，连接配置的外部 MCP 服务器，发现其暴露的工具，
 * 并将它们以 {@link MCPToolProxy} 的形式注册到 {@link ToolRegistry}。
 *
 * <p>仅在 {@code cretas.mcp.external-servers} 配置属性存在时激活。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-09
 */
@Slf4j
@Service
@ConditionalOnProperty(name = "cretas.mcp.external-servers")
public class MCPClientAdapter {

    @Autowired
    private ToolRegistry toolRegistry;

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * 外部 MCP 服务器 URL 列表（逗号分隔）
     * 示例: http://localhost:9000/api/mcp,http://other-server:8080/api/mcp
     */
    @Value("${cretas.mcp.external-servers}")
    private String externalServersConfig;

    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * 启动时自动发现并注册外部 MCP 工具
     */
    @PostConstruct
    public void discoverAndRegister() {
        if (externalServersConfig == null || externalServersConfig.isBlank()) {
            log.info("MCP Client: 无外部服务器配置，跳过");
            return;
        }

        String[] serverUrls = externalServersConfig.split(",");
        int totalRegistered = 0;

        for (String rawUrl : serverUrls) {
            String serverUrl = rawUrl.trim();
            if (serverUrl.isEmpty()) continue;

            try {
                int count = discoverToolsFromServer(serverUrl);
                totalRegistered += count;
                log.info("MCP Client: 从 {} 注册了 {} 个外部工具", serverUrl, count);
            } catch (Exception e) {
                log.warn("MCP Client: 连接外部服务器失败 {} — {}", serverUrl, e.getMessage());
            }
        }

        log.info("MCP Client: 外部工具发现完成，共注册 {} 个工具", totalRegistered);
    }

    /**
     * 从单个 MCP 服务器发现工具
     *
     * @param serverUrl 服务器基础 URL
     * @return 成功注册的工具数量
     */
    @SuppressWarnings("unchecked")
    private int discoverToolsFromServer(String serverUrl) {
        String listUrl = serverUrl.endsWith("/")
                ? serverUrl + "tools/list"
                : serverUrl + "/tools/list";

        log.info("MCP Client: 发现工具 — {}", listUrl);

        // 构建 tools/list 请求
        MCPRequest request = MCPRequest.builder()
                .id(UUID.randomUUID().toString())
                .method("tools/list")
                .params(Map.of())
                .build();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<MCPRequest> httpEntity = new HttpEntity<>(request, headers);

        ResponseEntity<MCPResponse> response = restTemplate.exchange(
                listUrl, HttpMethod.POST, httpEntity, MCPResponse.class);

        MCPResponse mcpResponse = response.getBody();
        if (mcpResponse == null || mcpResponse.getResult() == null) {
            log.warn("MCP Client: 服务器 {} 返回空结果", serverUrl);
            return 0;
        }

        // 解析工具列表
        Map<String, Object> result = (Map<String, Object>) mcpResponse.getResult();
        List<Map<String, Object>> toolMaps = (List<Map<String, Object>>) result.get("tools");

        if (toolMaps == null || toolMaps.isEmpty()) {
            log.info("MCP Client: 服务器 {} 无可用工具", serverUrl);
            return 0;
        }

        int registered = 0;
        for (Map<String, Object> toolMap : toolMaps) {
            try {
                MCPToolDefinition definition = MCPToolDefinition.builder()
                        .name((String) toolMap.get("name"))
                        .description((String) toolMap.get("description"))
                        .inputSchema((Map<String, Object>) toolMap.get("inputSchema"))
                        .build();

                MCPToolProxy proxy = new MCPToolProxy(serverUrl, definition, restTemplate, objectMapper);

                // 检查是否已存在同名工具
                String proxyName = proxy.getToolName();
                if (toolRegistry.hasExecutor(proxyName)) {
                    log.warn("MCP Client: 跳过重复工具 {} (来自 {})", proxyName, serverUrl);
                    continue;
                }

                toolRegistry.registerExternal(proxyName, proxy);
                registered++;
                log.info("MCP Client: 注册外部工具 {} (来自 {})", proxyName, serverUrl);

            } catch (Exception e) {
                log.warn("MCP Client: 注册工具失败 — {}", e.getMessage());
            }
        }

        return registered;
    }
}

package com.cretas.aims.service.workflow;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 工作流节点注册中心
 *
 * 复用 ToolRegistry 模式: Spring DI 自动收集所有 WorkflowNodeDescriptor 实现。
 * 提供 API 给前端画布和 AI Agent 获取可用节点类型。
 */
@Slf4j
@Component
public class WorkflowNodeRegistry {

    private final Map<String, WorkflowNodeDescriptor> nodeMap = new ConcurrentHashMap<>();

    @Autowired(required = false)
    private List<WorkflowNodeDescriptor> descriptors;

    @PostConstruct
    public void init() {
        if (descriptors == null || descriptors.isEmpty()) {
            log.info("未找到 WorkflowNodeDescriptor 实现");
            return;
        }

        for (WorkflowNodeDescriptor descriptor : descriptors) {
            String nodeType = descriptor.getNodeType();
            if (nodeType == null || nodeType.isEmpty()) {
                log.warn("跳过注册: 节点类型为空 - {}", descriptor.getClass().getSimpleName());
                continue;
            }

            if (!descriptor.isEnabled()) {
                log.info("节点已禁用，跳过注册: {}", nodeType);
                continue;
            }

            if (nodeMap.containsKey(nodeType)) {
                log.error("节点类型冲突: {} (已存在: {}, 当前: {})",
                        nodeType,
                        nodeMap.get(nodeType).getClass().getSimpleName(),
                        descriptor.getClass().getSimpleName());
                continue;
            }

            nodeMap.put(nodeType, descriptor);
            log.info("✅ 注册工作流节点: type={}, name={}, category={}",
                    nodeType, descriptor.getDisplayName(), descriptor.getCategory());
        }

        log.info("🔧 WorkflowNodeRegistry 初始化完成，共注册 {} 个节点类型", nodeMap.size());
    }

    public WorkflowNodeDescriptor getNode(String nodeType) {
        return nodeMap.get(nodeType);
    }

    public Collection<WorkflowNodeDescriptor> getAllNodes() {
        return Collections.unmodifiableCollection(nodeMap.values());
    }

    public List<Map<String, Object>> getAllNodeSchemas() {
        return nodeMap.values().stream()
                .map(this::toSchemaMap)
                .collect(Collectors.toList());
    }

    public List<Map<String, Object>> getNodeSchemasByCategory(String category) {
        return nodeMap.values().stream()
                .filter(d -> category.equals(d.getCategory()))
                .map(this::toSchemaMap)
                .collect(Collectors.toList());
    }

    private Map<String, Object> toSchemaMap(WorkflowNodeDescriptor descriptor) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("nodeType", descriptor.getNodeType());
        schema.put("displayName", descriptor.getDisplayName());
        schema.put("description", descriptor.getDescription());
        schema.put("icon", descriptor.getIcon());
        schema.put("color", descriptor.getColor());
        schema.put("category", descriptor.getCategory());
        schema.put("configSchema", descriptor.getConfigSchema());
        schema.put("defaultConfig", descriptor.getDefaultConfig());
        schema.put("allowedNextNodes", descriptor.getAllowedNextNodes());
        schema.put("availableGuards", descriptor.getAvailableGuards());
        return schema;
    }

    public int getRegisteredCount() {
        return nodeMap.size();
    }
}

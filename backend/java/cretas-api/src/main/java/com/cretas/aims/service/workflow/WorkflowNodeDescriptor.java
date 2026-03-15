package com.cretas.aims.service.workflow;

import java.util.List;
import java.util.Map;

/**
 * 工作流节点描述器接口
 *
 * 复用 ToolExecutor + ToolRegistry 模式实现自描述组件注册。
 * 每个节点类型实现此接口，通过 @Component 自动注册到 WorkflowNodeRegistry。
 */
public interface WorkflowNodeDescriptor {

    /**
     * 节点类型唯一标识
     */
    String getNodeType();

    /**
     * 节点显示名称
     */
    String getDisplayName();

    /**
     * 节点描述
     */
    String getDescription();

    /**
     * 节点图标（前端渲染用）
     */
    default String getIcon() {
        return "mdi-circle";
    }

    /**
     * 节点颜色
     */
    default String getColor() {
        return "#409EFF";
    }

    /**
     * 节点配置 JSON Schema
     * 前端根据此 Schema 动态生成属性面板
     */
    Map<String, Object> getConfigSchema();

    /**
     * 默认配置
     */
    default Map<String, Object> getDefaultConfig() {
        return Map.of();
    }

    /**
     * 允许的下游节点类型
     */
    List<String> getAllowedNextNodes();

    /**
     * 可用的 guard 函数列表
     */
    default List<String> getAvailableGuards() {
        return List.of();
    }

    /**
     * 节点分组（用于设计器节点库分类）
     */
    default String getCategory() {
        return "通用";
    }

    /**
     * 是否启用
     */
    default boolean isEnabled() {
        return true;
    }
}

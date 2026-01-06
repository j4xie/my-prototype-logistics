package com.cretas.aims.ai.tool;

import com.cretas.aims.ai.dto.Tool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tool 注册中心
 *
 * 管理所有可用的工具执行器，类似于 IntentExecutorServiceImpl 的 handlerMap。
 * 使用 Spring 依赖注入自动收集所有 ToolExecutor 实现。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-06
 */
@Slf4j
@Component
public class ToolRegistry {

    /**
     * 工具执行器映射表: toolName -> ToolExecutor
     * 使用 ConcurrentHashMap 保证线程安全
     */
    private final Map<String, ToolExecutor> toolMap = new ConcurrentHashMap<>();

    /**
     * Spring 自动注入所有 ToolExecutor 实现
     */
    @Autowired(required = false)
    @Lazy
    private List<ToolExecutor> toolExecutors;

    /**
     * 初始化时注册所有工具
     */
    @PostConstruct
    public void init() {
        if (toolExecutors == null || toolExecutors.isEmpty()) {
            log.warn("⚠️  未找到任何 ToolExecutor 实现，Tool Calling 功能将不可用");
            return;
        }

        for (ToolExecutor executor : toolExecutors) {
            String toolName = executor.getToolName();
            if (toolName == null || toolName.isEmpty()) {
                log.warn("⚠️  跳过注册：工具名称为空 - {}", executor.getClass().getSimpleName());
                continue;
            }

            if (!executor.isEnabled()) {
                log.info("⏸️  工具已禁用，跳过注册: {}", toolName);
                continue;
            }

            if (toolMap.containsKey(toolName)) {
                log.error("❌ 工具名称冲突: {} (已存在: {}, 当前: {})",
                        toolName,
                        toolMap.get(toolName).getClass().getSimpleName(),
                        executor.getClass().getSimpleName());
                continue;
            }

            toolMap.put(toolName, executor);
            log.info("✅ 注册工具: name={}, class={}, requiresPermission={}",
                    toolName,
                    executor.getClass().getSimpleName(),
                    executor.requiresPermission());
        }

        log.info("🔧 Tool Registry 初始化完成，共注册 {} 个工具", toolMap.size());
    }

    /**
     * 根据工具名称获取执行器
     *
     * @param toolName 工具名称
     * @return Optional 包装的执行器
     */
    public Optional<ToolExecutor> getExecutor(String toolName) {
        return Optional.ofNullable(toolMap.get(toolName));
    }

    /**
     * 检查工具是否存在
     *
     * @param toolName 工具名称
     * @return true 表示存在且启用
     */
    public boolean hasExecutor(String toolName) {
        return toolMap.containsKey(toolName);
    }

    /**
     * 获取所有启用的工具名称
     *
     * @return 工具名称列表
     */
    public List<String> getAllToolNames() {
        return new ArrayList<>(toolMap.keySet());
    }

    /**
     * 获取所有工具的 Tool Definition（用于 LLM API 调用）
     *
     * @return Tool Definition 列表
     */
    public List<Tool> getAllToolDefinitions() {
        List<Tool> tools = new ArrayList<>();
        for (ToolExecutor executor : toolMap.values()) {
            Tool tool = Tool.of(
                    executor.getToolName(),
                    executor.getDescription(),
                    executor.getParametersSchema()
            );
            tools.add(tool);
        }
        return tools;
    }

    /**
     * 获取所有工具的 Tool Definition（过滤权限）
     *
     * @param userRole 用户角色
     * @return 当前用户有权限使用的工具列表
     */
    public List<Tool> getToolDefinitionsForRole(String userRole) {
        List<Tool> tools = new ArrayList<>();
        for (ToolExecutor executor : toolMap.values()) {
            // 如果工具不需要权限，或用户有权限，则包含此工具
            if (!executor.requiresPermission() || executor.hasPermission(userRole)) {
                Tool tool = Tool.of(
                        executor.getToolName(),
                        executor.getDescription(),
                        executor.getParametersSchema()
                );
                tools.add(tool);
            }
        }
        return tools;
    }

    /**
     * 获取工具数量统计
     *
     * @return 工具数量
     */
    public int getToolCount() {
        return toolMap.size();
    }

    /**
     * 清空注册表（仅用于测试）
     */
    public void clear() {
        toolMap.clear();
        log.warn("⚠️  Tool Registry 已清空");
    }
}

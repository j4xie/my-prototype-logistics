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
 * 管理所有可用的工具执行器。
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
     * 按工具名称前缀过滤，获取指定领域的工具定义
     *
     * <p>用于 Tool Calling 场景下的领域过滤：只发送与用户查询相关的工具给 LLM，
     * 而不是全部 136 个工具。可将 LLM 处理时间从 ~10s 降低到 ~3s。</p>
     *
     * @param toolPrefixes 工具名称前缀集合（如 "material_", "report_"）
     * @param alwaysIncludePrefixes 始终包含的前缀（如元工具 "create_new_"）
     * @param userRole 用户角色（用于权限过滤）
     * @return 过滤后的工具列表
     */
    public List<Tool> getToolDefinitionsForDomains(
            Set<String> toolPrefixes,
            Set<String> alwaysIncludePrefixes,
            String userRole) {
        List<Tool> tools = new ArrayList<>();
        for (ToolExecutor executor : toolMap.values()) {
            // 权限检查
            if (executor.requiresPermission() && !executor.hasPermission(userRole)) {
                continue;
            }

            String toolName = executor.getToolName();
            boolean matched = false;

            // 检查是否匹配领域前缀
            for (String prefix : toolPrefixes) {
                if (toolName.startsWith(prefix)) {
                    matched = true;
                    break;
                }
            }

            // 检查是否是始终包含的工具
            if (!matched && alwaysIncludePrefixes != null) {
                for (String prefix : alwaysIncludePrefixes) {
                    if (toolName.startsWith(prefix)) {
                        matched = true;
                        break;
                    }
                }
            }

            if (matched) {
                tools.add(Tool.of(
                        executor.getToolName(),
                        executor.getDescription(),
                        executor.getParametersSchema()
                ));
            }
        }
        return tools;
    }

    /**
     * 根据工具名称提取所属领域分类
     *
     * 工具命名规则: {domain}_{action}，例如 "material_batch_query" → "material"
     *
     * @param toolName 工具名称
     * @return 领域分类 (工具名称的第一个下划线前缀)；若无下划线则返回原名称
     */
    public String getToolCategory(String toolName) {
        if (toolName == null || toolName.isEmpty()) {
            return "unknown";
        }
        int underscoreIndex = toolName.indexOf('_');
        if (underscoreIndex > 0) {
            return toolName.substring(0, underscoreIndex);
        }
        return toolName;
    }

    /**
     * 按领域分类分组所有已注册的工具
     *
     * 返回 Map: domain → [toolName1, toolName2, ...]
     * 领域通过工具名称的第一个下划线前缀提取。
     *
     * @return 领域分类 → 工具名称列表 的映射
     */
    public Map<String, List<String>> getToolsByCategory() {
        Map<String, List<String>> categoryMap = new LinkedHashMap<>();
        for (String toolName : toolMap.keySet()) {
            String category = getToolCategory(toolName);
            categoryMap.computeIfAbsent(category, k -> new ArrayList<>()).add(toolName);
        }
        return categoryMap;
    }

    /**
     * 获取有限数量的工具定义 (用于 Progressive Discovery)
     *
     * 当工具总数超过 maxTools 时，只返回前 maxTools 个工具定义，
     * 避免向 LLM 发送过多工具导致 token 超限或响应变慢。
     *
     * @param maxTools 最大返回数量
     * @return 不超过 maxTools 个的 Tool Definition 列表
     */
    public List<Tool> getToolDefinitionsLimited(int maxTools) {
        if (maxTools <= 0) {
            return Collections.emptyList();
        }
        List<Tool> tools = new ArrayList<>();
        int count = 0;
        for (ToolExecutor executor : toolMap.values()) {
            if (count >= maxTools) {
                break;
            }
            tools.add(Tool.of(
                    executor.getToolName(),
                    executor.getDescription(),
                    executor.getParametersSchema()
            ));
            count++;
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
     * 注册外部工具（如 MCP 代理工具）
     *
     * <p>用于运行时动态注册非 Spring 管理的 ToolExecutor 实例，
     * 例如通过 MCP Client 发现的外部工具。
     *
     * @param name 工具名称
     * @param executor 工具执行器实例
     * @return true 表示注册成功，false 表示名称已被占用
     */
    public boolean registerExternal(String name, ToolExecutor executor) {
        if (name == null || name.isEmpty() || executor == null) {
            log.warn("⚠️  registerExternal: 无效参数 name={}, executor={}", name, executor);
            return false;
        }

        if (toolMap.containsKey(name)) {
            log.warn("⚠️  registerExternal: 工具名称已存在 — {}", name);
            return false;
        }

        toolMap.put(name, executor);
        log.info("✅ 注册外部工具: name={}, class={}", name, executor.getClass().getSimpleName());
        return true;
    }

    /**
     * 注销外部工具
     *
     * @param name 工具名称
     * @return true 表示注销成功
     */
    public boolean unregisterExternal(String name) {
        ToolExecutor removed = toolMap.remove(name);
        if (removed != null) {
            log.info("🗑️  注销外部工具: name={}", name);
            return true;
        }
        return false;
    }

    /**
     * 清空注册表（仅用于测试）
     */
    public void clear() {
        toolMap.clear();
        log.warn("⚠️  Tool Registry 已清空");
    }
}

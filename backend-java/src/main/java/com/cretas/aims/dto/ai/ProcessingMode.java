package com.cretas.aims.dto.ai;

import lombok.Getter;

/**
 * 处理模式枚举
 *
 * 定义了不同复杂度查询的处理方式。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Getter
public enum ProcessingMode {

    /**
     * 快速模式 - 简单查询，直接 Tool 执行
     * 适用于: 明确意图 + 单一数据源
     */
    FAST("快速模式", "直接 Tool 执行，快速返回", 1),

    /**
     * 分析模式 - 需要数据整合
     * 适用于: 多数据源查询 + 基础分析
     */
    ANALYSIS("分析模式", "分析路由 + 单 Agent", 3),

    /**
     * 多 Agent 模式 - 复杂分析
     * 适用于: 多维度分析 + 行业对比
     */
    MULTI_AGENT("多 Agent 模式", "多 Agent 协作 + CRAG", 4),

    /**
     * 深度推理模式 - 战略级分析
     * 适用于: 战略建议 + 多轮推理
     */
    DEEP_REASONING("深度推理模式", "多 Agent + 深度思考 + 多轮迭代", 5);

    private final String displayName;
    private final String description;
    private final int level;

    ProcessingMode(String displayName, String description, int level) {
        this.displayName = displayName;
        this.description = description;
        this.level = level;
    }

    /**
     * 根据复杂度等级返回处理模式
     */
    public static ProcessingMode fromLevel(int level) {
        if (level <= 2) return FAST;
        if (level == 3) return ANALYSIS;
        if (level == 4) return MULTI_AGENT;
        return DEEP_REASONING;
    }
}

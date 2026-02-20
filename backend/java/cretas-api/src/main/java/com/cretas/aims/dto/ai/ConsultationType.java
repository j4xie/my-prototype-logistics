package com.cretas.aims.dto.ai;

import lombok.Getter;
import java.util.Arrays;
import java.util.List;

/**
 * 咨询类型枚举
 *
 * 用于 Agentic RAG 路由，对 GENERAL_QUESTION 类型进行细分路由。
 * 不同的咨询类型会路由到不同的处理路径：
 * - KNOWLEDGE_SEARCH: 知识库检索（RAG）
 * - WEB_SEARCH: 网络搜索
 * - TRACEABILITY: 追溯查询（转换为业务意图）
 * - GENERAL: 通用 LLM 对话
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
@Getter
public enum ConsultationType {

    /**
     * 知识库检索 - 标准、规范、流程相关咨询
     *
     * 触发关键词：标准、规范、流程、要求、规定、怎么做、SOP、
     *           法规、条例、指南、手册、操作规程
     *
     * 处理方式：调用向量知识库检索相关文档
     */
    KNOWLEDGE_SEARCH("知识库检索", Arrays.asList(
            "标准", "规范", "流程", "要求", "规定", "怎么做", "SOP",
            "法规", "条例", "指南", "手册", "操作规程", "制度",
            "GB", "ISO", "HACCP", "GMP", "食品安全", "卫生标准"
    )),

    /**
     * 网络搜索 - 最新资讯、行情、政策动态
     *
     * 触发关键词：最新、行情、市场、趋势、政策、新闻、法规更新、
     *           价格走势、市场动态、行业资讯
     *
     * 处理方式：调用网络搜索 API 获取实时信息
     */
    WEB_SEARCH("网络搜索", Arrays.asList(
            "最新", "行情", "市场", "趋势", "政策", "新闻", "法规更新",
            "价格走势", "市场动态", "行业资讯", "近期", "今年",
            "新规", "最新消息", "动态", "更新", "变化"
    )),

    /**
     * 追溯查询 - 产品追溯、来源查询
     *
     * 触发关键词：追溯、来源、批次、产地、供应商、原产地、
     *           溯源、追踪、来源地
     *
     * 处理方式：转换为业务意图，调用追溯相关接口
     */
    TRACEABILITY("追溯查询", Arrays.asList(
            "追溯", "来源", "批次", "产地", "供应商", "原产地",
            "溯源", "追踪", "来源地", "哪里来", "谁供应",
            "追溯码", "二维码", "追踪号"
    )),

    /**
     * 通用咨询 - 无法归类到特定类型的一般性咨询
     *
     * 处理方式：直接调用 LLM 生成对话式回复
     */
    GENERAL("通用咨询", Arrays.asList());

    /**
     * 显示名称
     */
    private final String displayName;

    /**
     * 触发关键词列表
     */
    private final List<String> keywords;

    ConsultationType(String displayName, List<String> keywords) {
        this.displayName = displayName;
        this.keywords = keywords;
    }

    /**
     * 根据关键词匹配度判断是否为该类型
     *
     * @param input 用户输入
     * @return 匹配的关键词数量
     */
    public int getMatchScore(String input) {
        if (input == null || input.isEmpty() || keywords.isEmpty()) {
            return 0;
        }
        String normalizedInput = input.toLowerCase();
        return (int) keywords.stream()
                .filter(keyword -> normalizedInput.contains(keyword.toLowerCase()))
                .count();
    }
}

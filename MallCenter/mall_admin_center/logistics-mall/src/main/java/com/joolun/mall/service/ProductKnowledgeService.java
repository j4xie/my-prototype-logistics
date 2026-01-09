package com.joolun.mall.service;

import com.joolun.mall.entity.GoodsSpu;

import java.util.List;

/**
 * 商品知识库服务接口 - RAG (Retrieval Augmented Generation)
 * 用于构建商品知识上下文，增强 AI 对话能力
 */
public interface ProductKnowledgeService {

    /**
     * 构建单个商品的知识上下文
     * 包括：商品名称、描述、卖点、价格、分类、库存等信息
     *
     * @param productId 商品ID
     * @return 商品知识上下文字符串
     */
    String buildProductContext(String productId);

    /**
     * 构建分类的知识上下文
     * 包括：分类名称、描述、该分类下的商品统计信息
     *
     * @param categoryId 分类ID
     * @return 分类知识上下文字符串
     */
    String buildCategoryContext(String categoryId);

    /**
     * 检索与查询相关的知识
     * 使用向量搜索和关键词匹配，返回最相关的商品列表
     *
     * @param query 用户查询
     * @param topK  返回前K个最相关的结果
     * @return 相关商品列表
     */
    List<GoodsSpu> retrieveRelevantKnowledge(String query, int topK);

    /**
     * 用商品知识增强 AI 提示
     * 将商品详细信息注入到系统提示中，使 AI 能基于真实商品数据回答
     *
     * @param userQuery 用户查询
     * @param products  相关商品列表
     * @return 增强后的系统提示
     */
    String enhancePromptWithKnowledge(String userQuery, List<GoodsSpu> products);

    /**
     * 构建商品比较上下文
     * 用于用户询问多个商品对比时
     *
     * @param productIds 商品ID列表
     * @return 商品比较上下文
     */
    String buildComparisonContext(List<String> productIds);

    /**
     * 构建价格相关知识上下文
     * 用于用户询问价格相关问题
     *
     * @param products 商品列表
     * @return 价格知识上下文
     */
    String buildPriceContext(List<GoodsSpu> products);

    /**
     * 构建溯源知识上下文
     * 用于用户询问商品来源、质量等问题
     *
     * @param productId 商品ID
     * @return 溯源知识上下文
     */
    String buildTraceabilityContext(String productId);

    /**
     * 获取热门商品知识摘要
     * 用于快速推荐场景
     *
     * @param limit 数量限制
     * @return 热门商品知识摘要
     */
    String getHotProductsSummary(int limit);
}

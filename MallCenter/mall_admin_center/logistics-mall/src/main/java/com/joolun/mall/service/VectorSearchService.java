package com.joolun.mall.service;

import com.joolun.mall.entity.GoodsSpu;

import java.util.List;

/**
 * 向量搜索服务接口
 * 使用通义千问 text-embedding-v3 进行语义搜索
 */
public interface VectorSearchService {

    /**
     * 生成文本的向量表示
     * @param text 输入文本
     * @return 向量数组 (1536维)
     */
    float[] generateEmbedding(String text);

    /**
     * 计算两个向量的余弦相似度
     * @param v1 向量1
     * @param v2 向量2
     * @return 相似度 (0-1)
     */
    double cosineSimilarity(float[] v1, float[] v2);

    /**
     * 语义搜索商品
     * @param query 用户查询
     * @param limit 返回数量
     * @return 匹配的商品列表（按相似度排序）
     */
    List<GoodsSpu> searchSimilarProducts(String query, int limit);

    /**
     * 为商品生成向量
     * @param product 商品实体
     * @return 商品向量
     */
    float[] vectorizeProduct(GoodsSpu product);

    /**
     * 批量向量化商品（用于初始化或更新）
     * @param products 商品列表
     */
    void batchVectorizeProducts(List<GoodsSpu> products);

    /**
     * 刷新单个商品的向量缓存
     * @param productId 商品ID
     */
    void refreshProductVector(String productId);

    /**
     * 检查向量搜索服务是否可用
     * @return true如果服务可用
     */
    boolean isAvailable();
}

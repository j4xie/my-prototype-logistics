package com.joolun.mall.service;

import com.joolun.mall.entity.GoodsSpu;
import java.util.List;
import java.util.Map;

/**
 * 多路召回服务
 * 实现多策略召回融合，生成高质量候选集
 *
 * 召回策略权重配置:
 * - 热度召回: 21%
 * - 协同过滤: 18%
 * - 品类召回: 18%
 * - 时间衰减: 15%
 * - 语义召回: 10%
 * - 聚类规则: 8%
 * - 新品召回: 5%
 * - 高评分商家: 5%
 */
public interface MultiRecallService {

    /**
     * 执行多路召回，返回融合后的候选商品
     * @param wxUserId 用户ID
     * @param limit 每路召回数量
     * @return 去重后的候选商品列表（带召回来源标记）
     */
    List<GoodsSpu> multiRecall(String wxUserId, int limit);

    /**
     * 热度召回 - 基于销量和浏览量
     * @param limit 召回数量限制
     * @return 热门商品列表
     */
    List<GoodsSpu> recallByPopularity(int limit);

    /**
     * 时间衰减召回 - 最近浏览的相似商品
     * @param wxUserId 用户ID
     * @param limit 召回数量限制
     * @return 基于最近浏览的相似商品列表
     */
    List<GoodsSpu> recallByRecentView(String wxUserId, int limit);

    /**
     * 品类召回 - 用户偏好品类的热门商品
     * @param wxUserId 用户ID
     * @param limit 召回数量限制
     * @return 用户偏好品类的商品列表
     */
    List<GoodsSpu> recallByCategory(String wxUserId, int limit);

    /**
     * 协同过滤召回
     * @param wxUserId 用户ID
     * @param limit 召回数量限制
     * @return 协同过滤推荐的商品列表
     */
    List<GoodsSpu> recallByCollaborativeFiltering(String wxUserId, int limit);

    /**
     * 新品召回 - 7天内上架的商品
     * @param limit 召回数量限制
     * @return 新品商品列表
     */
    List<GoodsSpu> recallByNewArrival(int limit);

    /**
     * 高评分商家召回
     * @param limit 召回数量限制
     * @return 高评分商家的商品列表
     */
    List<GoodsSpu> recallByHighRatingMerchant(int limit);

    /**
     * 语义召回 - 基于用户兴趣的向量相似度
     * @param wxUserId 用户ID
     * @param limit 召回数量限制
     * @return 语义相似商品列表
     */
    List<GoodsSpu> recallBySemantic(String wxUserId, int limit);

    /**
     * 聚类规则召回 - 根据用户所属聚类强制召回匹配品类的商品
     * 作为"保底"机制，确保推荐与用户聚类偏好相关
     *
     * @param wxUserId 用户ID
     * @param limit 召回数量限制
     * @return 聚类偏好品类的商品列表
     */
    List<GoodsSpu> recallByClusterRule(String wxUserId, int limit);

    /**
     * 获取召回统计信息
     * @return 各路召回的命中数统计
     */
    Map<String, Integer> getRecallStats();

    /**
     * 更新召回权重配置
     * @param weights 权重配置 (key: 召回策略名, value: 权重值)
     */
    void updateRecallWeights(Map<String, Double> weights);

    /**
     * 获取当前召回权重配置
     * @return 当前权重配置
     */
    Map<String, Double> getRecallWeights();
}

package com.joolun.mall.service;

import com.joolun.mall.entity.GoodsSpu;

import java.util.List;

/**
 * 特征工程服务接口
 * 为 LinUCB 推荐算法提供 128 维特征向量
 *
 * 特征维度分配:
 * - 用户特征: 64 维
 *   - 基础属性 (0-7): 用户等级、注册天数、最近活跃度等
 *   - 行为序列 (8-31): 最近浏览、收藏、购买商品的embedding均值
 *   - 偏好特征 (32-47): 价格敏感度、品牌偏好、品类偏好
 *   - 时间特征 (48-63): 周几、时段、节假日
 *
 * - 商品特征: 64 维
 *   - 基础属性 (0-7): 价格归一化、库存状态、上架时间
 *   - 向量嵌入 (8-39): 商品文本embedding压缩
 *   - 统计特征 (40-55): 销量、评分、浏览量
 *   - 上下文特征 (56-63): 分类热度、竞品数量
 *
 * @author LinUCB Enhancement
 * @since 2026-01-10
 */
public interface FeatureEngineeringService {

    /**
     * 用户特征维度
     */
    int USER_FEATURE_DIM = 64;

    /**
     * 商品特征维度
     */
    int ITEM_FEATURE_DIM = 64;

    /**
     * 总特征维度
     */
    int TOTAL_FEATURE_DIM = USER_FEATURE_DIM + ITEM_FEATURE_DIM;

    /**
     * 构建用户特征向量 (64维)
     *
     * @param wxUserId 微信用户ID
     * @return 64维用户特征向量
     */
    double[] buildUserFeatureVector(String wxUserId);

    /**
     * 构建商品特征向量 (64维)
     *
     * @param product 商品实体
     * @return 64维商品特征向量
     */
    double[] buildProductFeatureVector(GoodsSpu product);

    /**
     * 构建分类特征向量 (64维)
     * 用于分类级别的LinUCB探索
     *
     * @param category 分类ID
     * @param allCategories 所有活跃分类列表
     * @return 64维分类特征向量
     */
    double[] buildCategoryFeatureVector(String category, List<String> allCategories);

    /**
     * 拼接用户和商品特征向量
     *
     * @param userFeatures 用户特征向量
     * @param itemFeatures 商品特征向量
     * @return 128维组合特征向量
     */
    double[] concatenateFeatures(double[] userFeatures, double[] itemFeatures);

    /**
     * 批量构建商品特征向量
     *
     * @param products 商品列表
     * @return 商品ID -> 特征向量的映射
     */
    java.util.Map<String, double[]> batchBuildProductFeatures(List<GoodsSpu> products);

    /**
     * 获取用户行为序列特征
     * 基于最近浏览、收藏、购买行为提取embedding均值
     *
     * @param wxUserId 用户ID
     * @return 24维行为序列特征
     */
    double[] extractBehaviorSequenceFeatures(String wxUserId);

    /**
     * 获取用户偏好特征
     * 包括价格敏感度、品牌偏好、品类偏好
     *
     * @param wxUserId 用户ID
     * @return 16维偏好特征
     */
    double[] extractPreferenceFeatures(String wxUserId);

    /**
     * 获取时间上下文特征
     * 包括周几、时段、是否节假日等
     *
     * @return 16维时间特征
     */
    double[] extractTimeContextFeatures();

    /**
     * 获取商品文本嵌入特征
     * 将商品名称、描述等文本压缩为低维向量
     *
     * @param product 商品实体
     * @return 32维文本嵌入特征
     */
    double[] extractProductEmbeddingFeatures(GoodsSpu product);

    /**
     * 获取商品统计特征
     * 包括销量、评分、浏览量等
     *
     * @param product 商品实体
     * @return 16维统计特征
     */
    double[] extractProductStatisticsFeatures(GoodsSpu product);

    /**
     * 特征归一化
     * 将特征值缩放到 [0, 1] 区间
     *
     * @param features 原始特征向量
     * @return 归一化后的特征向量
     */
    double[] normalizeFeatures(double[] features);

    /**
     * 检查特征服务是否可用
     *
     * @return true 如果服务可用
     */
    boolean isAvailable();
}

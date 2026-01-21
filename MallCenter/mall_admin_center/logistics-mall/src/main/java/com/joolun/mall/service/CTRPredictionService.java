package com.joolun.mall.service;

import com.joolun.mall.entity.GoodsSpu;

import java.util.List;
import java.util.Map;

/**
 * CTR预测服务
 * 使用逻辑回归+特征交叉预测点击率
 *
 * 特征维度分配:
 * - 用户特征: 64维
 * - 商品特征: 64维
 * - 交叉特征: 40维 (用户品类偏好x商品品类、用户价格偏好x商品价格、行为趋势、转化率等)
 * - 总特征维度: 168维
 *
 * 模型参数:
 * - 学习率: 0.01
 * - L2正则化: lambda = 0.001
 * - 在线学习: SGD更新
 *
 * @author CTR Enhancement
 * @since 2026-01-19
 */
public interface CTRPredictionService {

    /**
     * 用户特征维度
     */
    int USER_FEATURE_DIM = 64;

    /**
     * 商品特征维度
     */
    int ITEM_FEATURE_DIM = 64;

    /**
     * 交叉特征维度 (V3.0: 40→72 增加32维深度交叉特征)
     *
     * 新增特征 [40-55]: 用户-商品深度交叉 (16维)
     * - 购买频率×热度、价格匹配度、多样性交叉等
     *
     * 新增特征 [56-63]: 行为序列特征 (8维)
     * - 浏览序列熵、复购概率、最近浏览相似度等
     *
     * 新增特征 [64-71]: 上下文特征 (8维)
     * - 小时/星期归一化、周末标记、促销期、设备类型等
     */
    int CROSS_FEATURE_DIM = 72;

    /**
     * 总特征维度 (V3.0: 168→200)
     */
    int TOTAL_FEATURE_DIM = USER_FEATURE_DIM + ITEM_FEATURE_DIM + CROSS_FEATURE_DIM;

    /**
     * 预测用户对商品的点击概率
     *
     * @param wxUserId 微信用户ID
     * @param product 商品实体
     * @return 点击概率 [0, 1]
     */
    double predictCTR(String wxUserId, GoodsSpu product);

    /**
     * 批量预测CTR
     *
     * @param wxUserId 微信用户ID
     * @param products 商品列表
     * @return 商品ID -> CTR预测值的映射
     */
    Map<String, Double> batchPredictCTR(String wxUserId, List<GoodsSpu> products);

    /**
     * 基于CTR预测重排序商品列表
     * 按照预测的点击概率从高到低排序
     *
     * @param wxUserId 微信用户ID
     * @param products 原始商品列表
     * @return 按CTR排序后的商品列表
     */
    List<GoodsSpu> rerankByCTR(String wxUserId, List<GoodsSpu> products);

    /**
     * 更新模型参数（在线学习）
     * 使用SGD更新权重向量
     *
     * @param wxUserId 用户ID
     * @param productId 商品ID
     * @param clicked 是否点击 (true=点击, false=曝光未点击)
     */
    void updateModel(String wxUserId, String productId, boolean clicked);

    /**
     * 批量更新模型参数
     * 用于处理批量反馈数据
     *
     * @param feedbackList 反馈列表，每个元素包含 [wxUserId, productId, clicked]
     */
    void batchUpdateModel(List<CTRFeedback> feedbackList);

    /**
     * 获取特征重要性
     * 基于权重绝对值计算各特征的重要性
     *
     * @return 特征名称 -> 重要性分数的映射
     */
    Map<String, Double> getFeatureImportance();

    /**
     * 获取当前模型的权重向量
     *
     * @return 权重向量 (168维)
     */
    double[] getModelWeights();

    /**
     * 重置模型权重
     * 将权重初始化为小随机值
     */
    void resetModelWeights();

    /**
     * 获取模型统计信息
     *
     * @return 统计信息映射，包括训练样本数、正样本率、学习率等
     */
    Map<String, Object> getModelStats();

    /**
     * CTR反馈数据结构
     */
    class CTRFeedback {
        private String wxUserId;
        private String productId;
        private boolean clicked;

        public CTRFeedback() {}

        public CTRFeedback(String wxUserId, String productId, boolean clicked) {
            this.wxUserId = wxUserId;
            this.productId = productId;
            this.clicked = clicked;
        }

        public String getWxUserId() {
            return wxUserId;
        }

        public void setWxUserId(String wxUserId) {
            this.wxUserId = wxUserId;
        }

        public String getProductId() {
            return productId;
        }

        public void setProductId(String productId) {
            this.productId = productId;
        }

        public boolean isClicked() {
            return clicked;
        }

        public void setClicked(boolean clicked) {
            this.clicked = clicked;
        }
    }
}

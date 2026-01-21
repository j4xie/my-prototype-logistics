package com.joolun.mall.service;

import com.joolun.mall.entity.GoodsSpu;

import java.util.List;
import java.util.Map;

/**
 * 推荐系统离线评估服务
 *
 * 提供多种评估指标用于衡量推荐质量:
 * - NDCG@K: 归一化折损累积增益，衡量排序质量
 * - Hit@K: 命中率，用户是否点击了推荐的商品
 * - MAP: 平均精度均值，综合排序和相关性
 * - MRR: 平均倒数排名，首个相关项目的位置
 * - Coverage: 商品覆盖率，推荐系统覆盖的商品多样性
 * - ILD: 列表内多样性 (Intra-List Diversity)
 *
 * @author Recommendation Enhancement
 * @since 2026-01-20
 */
public interface RecommendationEvaluationService {

    /**
     * 计算NDCG@K (Normalized Discounted Cumulative Gain)
     *
     * NDCG = DCG / IDCG
     * DCG = Σ(rel_i / log2(i+1))
     *
     * @param recommendations 推荐列表
     * @param relevantItems 相关商品ID列表（用户实际点击/购买的商品）
     * @param k 评估的前K个
     * @return NDCG值 [0, 1]
     */
    double calculateNDCG(List<GoodsSpu> recommendations, List<String> relevantItems, int k);

    /**
     * 计算Hit@K (命中率)
     *
     * Hit@K = 1 if any relevant item in top-K, else 0
     *
     * @param recommendations 推荐列表
     * @param relevantItems 相关商品ID列表
     * @param k 评估的前K个
     * @return 命中率 [0, 1]
     */
    double calculateHitRate(List<GoodsSpu> recommendations, List<String> relevantItems, int k);

    /**
     * 计算MAP (Mean Average Precision)
     *
     * AP = Σ(P@k × rel(k)) / |relevant items|
     * MAP = mean(AP) over all users
     *
     * @param recommendations 推荐列表
     * @param relevantItems 相关商品ID列表
     * @return MAP值 [0, 1]
     */
    double calculateMAP(List<GoodsSpu> recommendations, List<String> relevantItems);

    /**
     * 计算MRR (Mean Reciprocal Rank)
     *
     * MRR = 1 / rank of first relevant item
     *
     * @param recommendations 推荐列表
     * @param relevantItems 相关商品ID列表
     * @return MRR值 [0, 1]
     */
    double calculateMRR(List<GoodsSpu> recommendations, List<String> relevantItems);

    /**
     * 计算Precision@K
     *
     * Precision@K = |relevant items in top-K| / K
     *
     * @param recommendations 推荐列表
     * @param relevantItems 相关商品ID列表
     * @param k 评估的前K个
     * @return Precision值 [0, 1]
     */
    double calculatePrecision(List<GoodsSpu> recommendations, List<String> relevantItems, int k);

    /**
     * 计算Recall@K
     *
     * Recall@K = |relevant items in top-K| / |total relevant items|
     *
     * @param recommendations 推荐列表
     * @param relevantItems 相关商品ID列表
     * @param k 评估的前K个
     * @return Recall值 [0, 1]
     */
    double calculateRecall(List<GoodsSpu> recommendations, List<String> relevantItems, int k);

    /**
     * 计算Coverage (商品覆盖率)
     *
     * Coverage = |unique items recommended| / |total items|
     *
     * @param recommendations 推荐列表
     * @param totalItems 系统中商品总数
     * @return 覆盖率 [0, 1]
     */
    double calculateCoverage(List<GoodsSpu> recommendations, int totalItems);

    /**
     * 计算ILD (Intra-List Diversity) - 列表内多样性
     *
     * ILD = avg(diversity(i, j)) for all pairs (i, j) in recommendations
     *
     * 多样性计算:
     * - 品类不同: +0.4
     * - 商户不同: +0.3
     * - 价格差异: +0.3 × (price_diff / max_price)
     *
     * @param recommendations 推荐列表
     * @return ILD值 [0, 1]
     */
    double calculateILD(List<GoodsSpu> recommendations);

    /**
     * 生成完整的评估报告
     *
     * @param wxUserId 用户ID
     * @param recommendations 推荐列表
     * @return 评估报告，包含所有指标
     */
    EvaluationReport generateEvaluationReport(String wxUserId, List<GoodsSpu> recommendations);

    /**
     * 批量评估多个用户的推荐结果
     *
     * @param userRecommendations 用户ID -> 推荐列表的映射
     * @return 汇总评估报告
     */
    Map<String, Object> batchEvaluate(Map<String, List<GoodsSpu>> userRecommendations);

    /**
     * 获取评估统计历史
     *
     * @param days 最近N天
     * @return 历史评估数据
     */
    Map<String, Object> getEvaluationHistory(int days);

    /**
     * 评估报告数据类
     */
    class EvaluationReport {
        private String userId;
        private int recommendationCount;
        private int relevantCount;

        // 排序质量指标
        private double ndcg5;
        private double ndcg10;
        private double hit5;
        private double hit10;
        private double map;
        private double mrr;

        // 精度指标
        private double precision5;
        private double precision10;
        private double recall5;
        private double recall10;

        // 多样性指标
        private double coverage;
        private double ild;

        // 元数据
        private long evaluationTimeMs;
        private String evaluationTime;
        private boolean coldStartMode;  // 是否为冷启动用户评估

        // Getters and Setters
        public String getUserId() {
            return userId;
        }

        public void setUserId(String userId) {
            this.userId = userId;
        }

        public int getRecommendationCount() {
            return recommendationCount;
        }

        public void setRecommendationCount(int recommendationCount) {
            this.recommendationCount = recommendationCount;
        }

        public int getRelevantCount() {
            return relevantCount;
        }

        public void setRelevantCount(int relevantCount) {
            this.relevantCount = relevantCount;
        }

        public double getNdcg5() {
            return ndcg5;
        }

        public void setNdcg5(double ndcg5) {
            this.ndcg5 = ndcg5;
        }

        public double getNdcg10() {
            return ndcg10;
        }

        public void setNdcg10(double ndcg10) {
            this.ndcg10 = ndcg10;
        }

        public double getHit5() {
            return hit5;
        }

        public void setHit5(double hit5) {
            this.hit5 = hit5;
        }

        public double getHit10() {
            return hit10;
        }

        public void setHit10(double hit10) {
            this.hit10 = hit10;
        }

        public double getMap() {
            return map;
        }

        public void setMap(double map) {
            this.map = map;
        }

        public double getMrr() {
            return mrr;
        }

        public void setMrr(double mrr) {
            this.mrr = mrr;
        }

        public double getPrecision5() {
            return precision5;
        }

        public void setPrecision5(double precision5) {
            this.precision5 = precision5;
        }

        public double getPrecision10() {
            return precision10;
        }

        public void setPrecision10(double precision10) {
            this.precision10 = precision10;
        }

        public double getRecall5() {
            return recall5;
        }

        public void setRecall5(double recall5) {
            this.recall5 = recall5;
        }

        public double getRecall10() {
            return recall10;
        }

        public void setRecall10(double recall10) {
            this.recall10 = recall10;
        }

        public double getCoverage() {
            return coverage;
        }

        public void setCoverage(double coverage) {
            this.coverage = coverage;
        }

        public double getIld() {
            return ild;
        }

        public void setIld(double ild) {
            this.ild = ild;
        }

        public long getEvaluationTimeMs() {
            return evaluationTimeMs;
        }

        public void setEvaluationTimeMs(long evaluationTimeMs) {
            this.evaluationTimeMs = evaluationTimeMs;
        }

        public String getEvaluationTime() {
            return evaluationTime;
        }

        public void setEvaluationTime(String evaluationTime) {
            this.evaluationTime = evaluationTime;
        }

        public boolean isColdStartMode() {
            return coldStartMode;
        }

        public void setColdStartMode(boolean coldStartMode) {
            this.coldStartMode = coldStartMode;
        }
    }
}

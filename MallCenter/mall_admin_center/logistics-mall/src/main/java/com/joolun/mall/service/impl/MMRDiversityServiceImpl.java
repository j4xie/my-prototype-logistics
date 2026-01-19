package com.joolun.mall.service.impl;

import com.joolun.mall.config.StrategyInterventionConfig;
import com.joolun.mall.entity.GoodsSpu;
import com.joolun.mall.service.MMRDiversityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

/**
 * MMR多样性控制服务实现
 * 基于抖音推荐系统"多样性控制"设计
 *
 * 核心算法: Maximal Marginal Relevance (MMR)
 *
 * 贪心选择过程:
 * 1. 选择分数最高的商品加入结果集
 * 2. 对于剩余商品，计算 MMR = λ×Score - (1-λ)×MaxSim
 * 3. 选择MMR最高的商品加入结果集
 * 4. 重复直到达到limit数量
 *
 * 相似度计算:
 * - 分类相同: +0.5
 * - 价格差<20%: +0.3
 * - 同一商家: +0.2
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MMRDiversityServiceImpl implements MMRDiversityService {

    private final StrategyInterventionConfig config;

    @Override
    public List<GoodsSpu> applyMMRReranking(List<GoodsSpu> products, Map<String, Double> scores, int limit) {
        if (products == null || products.isEmpty()) {
            return products;
        }

        if (products.size() <= limit) {
            return products;
        }

        double lambda = config.getMmrLambda();
        double maxMerchantRatio = config.getMaxMerchantRatio();
        List<GoodsSpu> selected = new ArrayList<>();
        List<GoodsSpu> candidates = new ArrayList<>(products);

        // 商户配额追踪: merchantId -> count
        Map<Long, Integer> merchantCounts = new HashMap<>();

        // 选择分数最高的商品作为起点
        GoodsSpu first = candidates.stream()
                .max(Comparator.comparingDouble(p -> scores.getOrDefault(p.getId(), 0.0)))
                .orElse(candidates.get(0));
        selected.add(first);
        candidates.remove(first);
        merchantCounts.merge(first.getMerchantId(), 1, Integer::sum);

        // 贪心选择
        while (selected.size() < limit && !candidates.isEmpty()) {
            GoodsSpu best = null;
            double bestMMR = Double.NEGATIVE_INFINITY;

            // 计算当前阶段单商户允许的最大数量
            int maxPerMerchant = (int) Math.ceil(limit * maxMerchantRatio);

            for (GoodsSpu candidate : candidates) {
                // 检查商户配额
                Long merchantId = candidate.getMerchantId();
                int currentCount = merchantCounts.getOrDefault(merchantId, 0);
                if (currentCount >= maxPerMerchant) {
                    // 跳过已达配额的商户商品
                    continue;
                }

                double relevanceScore = scores.getOrDefault(candidate.getId(), 0.0);
                double mmrScore = calculateMMRScore(candidate, relevanceScore, selected, lambda);

                if (mmrScore > bestMMR) {
                    bestMMR = mmrScore;
                    best = candidate;
                }
            }

            if (best != null) {
                selected.add(best);
                candidates.remove(best);
                merchantCounts.merge(best.getMerchantId(), 1, Integer::sum);
            } else {
                // 如果所有候选都达到配额，放宽限制继续选择
                GoodsSpu fallback = findFallbackCandidate(candidates, scores, selected, lambda);
                if (fallback != null) {
                    selected.add(fallback);
                    candidates.remove(fallback);
                    merchantCounts.merge(fallback.getMerchantId(), 1, Integer::sum);
                    log.debug("商户配额已满，使用fallback选择: merchantId={}", fallback.getMerchantId());
                } else {
                    break;
                }
            }
        }

        log.info("MMR重排序完成: 输入 {} 件，输出 {} 件，λ={}，商户分布={}",
                products.size(), selected.size(), lambda, merchantCounts);

        // 记录多样性分析
        if (log.isDebugEnabled()) {
            Map<String, Object> analysis = getDiversityAnalysis(selected);
            log.debug("多样性分析: {}", analysis);
        }

        return selected;
    }

    @Override
    public List<GoodsSpu> applyMMRReranking(List<GoodsSpu> products, int limit) {
        if (products == null || products.isEmpty()) {
            return products;
        }

        // 使用位置作为默认分数 (越靠前分数越高)
        Map<String, Double> scores = new HashMap<>();
        for (int i = 0; i < products.size(); i++) {
            GoodsSpu product = products.get(i);
            // 归一化分数: 第1个是1.0，最后一个接近0
            double score = 1.0 - (double) i / products.size();
            scores.put(product.getId(), score);
        }

        return applyMMRReranking(products, scores, limit);
    }

    @Override
    public double calculateSimilarity(GoodsSpu product1, GoodsSpu product2) {
        if (product1 == null || product2 == null) {
            return 0.0;
        }

        if (product1.getId().equals(product2.getId())) {
            return 1.0;
        }

        double similarity = 0.0;

        // 1. 分类相似度
        if (isSameCategory(product1, product2)) {
            similarity += config.getSameCategorySimilarity();
        }

        // 2. 商家相似度
        if (isSameMerchant(product1, product2)) {
            similarity += config.getSameMerchantSimilarity();
        }

        // 3. 价格相似度
        if (isSimilarPrice(product1, product2)) {
            similarity += config.getSimilarPriceSimilarity();
        }

        return Math.min(1.0, similarity);
    }

    @Override
    public double calculateMaxSimilarity(GoodsSpu product, List<GoodsSpu> selectedProducts) {
        if (selectedProducts == null || selectedProducts.isEmpty()) {
            return 0.0;
        }

        return selectedProducts.stream()
                .mapToDouble(selected -> calculateSimilarity(product, selected))
                .max()
                .orElse(0.0);
    }

    @Override
    public double calculateMMRScore(GoodsSpu product, double relevanceScore,
                                     List<GoodsSpu> selectedProducts, double lambda) {
        double maxSimilarity = calculateMaxSimilarity(product, selectedProducts);
        return lambda * relevanceScore - (1 - lambda) * maxSimilarity;
    }

    @Override
    public Map<String, Object> getDiversityAnalysis(List<GoodsSpu> products) {
        Map<String, Object> analysis = new LinkedHashMap<>();

        if (products == null || products.isEmpty()) {
            analysis.put("count", 0);
            return analysis;
        }

        analysis.put("count", products.size());

        // 分类分布
        Map<String, Long> categoryDistribution = products.stream()
                .filter(p -> p.getCategoryFirst() != null)
                .collect(Collectors.groupingBy(GoodsSpu::getCategoryFirst, Collectors.counting()));
        analysis.put("categoryDistribution", categoryDistribution);
        analysis.put("categoryCount", categoryDistribution.size());

        // 商家分布
        Map<Long, Long> merchantDistribution = products.stream()
                .filter(p -> p.getMerchantId() != null)
                .collect(Collectors.groupingBy(GoodsSpu::getMerchantId, Collectors.counting()));
        analysis.put("merchantCount", merchantDistribution.size());

        // 价格分布
        DoubleSummaryStatistics priceStats = products.stream()
                .filter(p -> p.getSalesPrice() != null)
                .mapToDouble(p -> p.getSalesPrice().doubleValue())
                .summaryStatistics();
        analysis.put("priceStats", Map.of(
                "min", priceStats.getMin(),
                "max", priceStats.getMax(),
                "avg", priceStats.getAverage()
        ));

        // 计算多样性分数 (0-1，越高越多样)
        double diversityScore = calculateDiversityScore(products, categoryDistribution);
        analysis.put("diversityScore", diversityScore);

        return analysis;
    }

    @Override
    public boolean checkDiversityThreshold(List<GoodsSpu> products, int minCategories, double maxSameCategoryRatio) {
        if (products == null || products.isEmpty()) {
            return true;
        }

        Map<String, Long> categoryDistribution = products.stream()
                .filter(p -> p.getCategoryFirst() != null)
                .collect(Collectors.groupingBy(GoodsSpu::getCategoryFirst, Collectors.counting()));

        // 检查分类数
        if (categoryDistribution.size() < minCategories) {
            log.warn("多样性不足: 分类数 {} < {}", categoryDistribution.size(), minCategories);
            return false;
        }

        // 检查最大同类占比
        long maxCount = categoryDistribution.values().stream()
                .max(Long::compareTo)
                .orElse(0L);
        double maxRatio = (double) maxCount / products.size();

        if (maxRatio > maxSameCategoryRatio) {
            log.warn("多样性不足: 同分类最大占比 {} > {}", maxRatio, maxSameCategoryRatio);
            return false;
        }

        return true;
    }

    // ==================== 私有方法 ====================

    /**
     * 当所有商户都达到配额时的fallback选择
     * 选择MMR分数最高的候选
     */
    private GoodsSpu findFallbackCandidate(List<GoodsSpu> candidates, Map<String, Double> scores,
                                            List<GoodsSpu> selected, double lambda) {
        if (candidates.isEmpty()) {
            return null;
        }

        GoodsSpu best = null;
        double bestMMR = Double.NEGATIVE_INFINITY;

        for (GoodsSpu candidate : candidates) {
            double relevanceScore = scores.getOrDefault(candidate.getId(), 0.0);
            double mmrScore = calculateMMRScore(candidate, relevanceScore, selected, lambda);

            if (mmrScore > bestMMR) {
                bestMMR = mmrScore;
                best = candidate;
            }
        }

        return best;
    }

    /**
     * 检查是否同分类
     */
    private boolean isSameCategory(GoodsSpu p1, GoodsSpu p2) {
        if (p1.getCategoryFirst() == null || p2.getCategoryFirst() == null) {
            return false;
        }
        return p1.getCategoryFirst().equals(p2.getCategoryFirst());
    }

    /**
     * 检查是否同商家
     */
    private boolean isSameMerchant(GoodsSpu p1, GoodsSpu p2) {
        if (p1.getMerchantId() == null || p2.getMerchantId() == null) {
            return false;
        }
        return p1.getMerchantId().equals(p2.getMerchantId());
    }

    /**
     * 检查价格是否相近 (差<20%)
     */
    private boolean isSimilarPrice(GoodsSpu p1, GoodsSpu p2) {
        BigDecimal price1 = p1.getSalesPrice();
        BigDecimal price2 = p2.getSalesPrice();

        if (price1 == null || price2 == null ||
            price1.compareTo(BigDecimal.ZERO) <= 0 ||
            price2.compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }

        double p1Val = price1.doubleValue();
        double p2Val = price2.doubleValue();
        double maxPrice = Math.max(p1Val, p2Val);
        double minPrice = Math.min(p1Val, p2Val);

        double ratio = 1 - (minPrice / maxPrice);
        return ratio < config.getSimilarPriceThreshold();
    }

    /**
     * 计算多样性分数
     * 基于分类分布的熵
     */
    private double calculateDiversityScore(List<GoodsSpu> products, Map<String, Long> categoryDistribution) {
        if (products.isEmpty() || categoryDistribution.isEmpty()) {
            return 0.0;
        }

        int total = products.size();
        double entropy = 0.0;

        for (Long count : categoryDistribution.values()) {
            if (count > 0) {
                double p = (double) count / total;
                entropy -= p * Math.log(p);
            }
        }

        // 归一化: 最大熵 = log(分类数)
        double maxEntropy = Math.log(categoryDistribution.size());
        if (maxEntropy > 0) {
            return entropy / maxEntropy;
        }

        return 0.0;
    }
}

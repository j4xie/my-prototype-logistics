package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.joolun.mall.entity.GoodsSpu;
import com.joolun.mall.entity.RecommendationLog;
import com.joolun.mall.entity.UserClusterAssignment;
import com.joolun.mall.mapper.GoodsSpuMapper;
import com.joolun.mall.mapper.RecommendationLogMapper;
import com.joolun.mall.service.CollaborativeFilteringService;
import com.joolun.mall.service.RecommendationEvaluationService;
import com.joolun.mall.service.UserClusterService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 推荐系统离线评估服务实现
 *
 * 实现多种评估指标:
 * - NDCG: 使用log2折损
 * - Hit@K: 二值判定
 * - MAP: 平均精度
 * - MRR: 倒数排名
 * - Coverage: 商品覆盖
 * - ILD: 品类+商户+价格多样性
 *
 * @author Recommendation Enhancement
 * @since 2026-01-20
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RecommendationEvaluationServiceImpl implements RecommendationEvaluationService {

    private final RecommendationLogMapper recommendationLogMapper;
    private final GoodsSpuMapper goodsSpuMapper;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final CollaborativeFilteringService collaborativeFilteringService;
    private final UserClusterService userClusterService;

    // Redis缓存键
    private static final String EVALUATION_HISTORY_PREFIX = "rec:eval:history:";
    private static final String EVALUATION_STATS_KEY = "rec:eval:stats";
    private static final long HISTORY_TTL_DAYS = 30;

    // ILD权重配置 - V4.0扩展6维度
    private static final double ILD_WEIGHT_CATEGORY = 0.25;   // 从0.4降到0.25
    private static final double ILD_WEIGHT_MERCHANT = 0.20;   // 从0.3降到0.20
    private static final double ILD_WEIGHT_PRICE = 0.15;      // 从0.3降到0.15
    private static final double ILD_WEIGHT_BRAND = 0.15;      // 新增: 品牌多样性
    private static final double ILD_WEIGHT_ORIGIN = 0.10;     // 新增: 产地多样性
    private static final double ILD_WEIGHT_PROMOTION = 0.15;  // 新增: 促销状态多样性

    // 价格归一化最大值
    private static final double MAX_PRICE_FOR_NORM = 1000.0;

    @Override
    public double calculateNDCG(List<GoodsSpu> recommendations, List<String> relevantItems, int k) {
        if (recommendations == null || recommendations.isEmpty() || relevantItems == null || relevantItems.isEmpty()) {
            return 0.0;
        }

        Set<String> relevantSet = new HashSet<>(relevantItems);
        int evalLength = Math.min(k, recommendations.size());

        // 计算DCG
        double dcg = 0.0;
        for (int i = 0; i < evalLength; i++) {
            String productId = recommendations.get(i).getId();
            if (relevantSet.contains(productId)) {
                // 相关性为1（二值判定），折损因子为log2(i+2)
                dcg += 1.0 / (Math.log(i + 2) / Math.log(2));
            }
        }

        // 计算IDCG（理想DCG）
        int idealCount = Math.min(relevantItems.size(), evalLength);
        double idcg = 0.0;
        for (int i = 0; i < idealCount; i++) {
            idcg += 1.0 / (Math.log(i + 2) / Math.log(2));
        }

        if (idcg == 0) {
            return 0.0;
        }

        return dcg / idcg;
    }

    @Override
    public double calculateHitRate(List<GoodsSpu> recommendations, List<String> relevantItems, int k) {
        if (recommendations == null || recommendations.isEmpty() || relevantItems == null || relevantItems.isEmpty()) {
            return 0.0;
        }

        Set<String> relevantSet = new HashSet<>(relevantItems);
        int evalLength = Math.min(k, recommendations.size());

        for (int i = 0; i < evalLength; i++) {
            if (relevantSet.contains(recommendations.get(i).getId())) {
                return 1.0;  // 命中
            }
        }

        return 0.0;  // 未命中
    }

    @Override
    public double calculateMAP(List<GoodsSpu> recommendations, List<String> relevantItems) {
        if (recommendations == null || recommendations.isEmpty() || relevantItems == null || relevantItems.isEmpty()) {
            return 0.0;
        }

        Set<String> relevantSet = new HashSet<>(relevantItems);
        double sumPrecision = 0.0;
        int relevantCount = 0;

        for (int i = 0; i < recommendations.size(); i++) {
            String productId = recommendations.get(i).getId();
            if (relevantSet.contains(productId)) {
                relevantCount++;
                // P@k = 到位置k为止的命中数 / k
                double precisionAtK = (double) relevantCount / (i + 1);
                sumPrecision += precisionAtK;
            }
        }

        if (relevantCount == 0) {
            return 0.0;
        }

        // AP = Σ(P@k × rel(k)) / |relevant items|
        return sumPrecision / relevantItems.size();
    }

    @Override
    public double calculateMRR(List<GoodsSpu> recommendations, List<String> relevantItems) {
        if (recommendations == null || recommendations.isEmpty() || relevantItems == null || relevantItems.isEmpty()) {
            return 0.0;
        }

        Set<String> relevantSet = new HashSet<>(relevantItems);

        for (int i = 0; i < recommendations.size(); i++) {
            if (relevantSet.contains(recommendations.get(i).getId())) {
                // 返回第一个相关项的倒数排名
                return 1.0 / (i + 1);
            }
        }

        return 0.0;
    }

    @Override
    public double calculatePrecision(List<GoodsSpu> recommendations, List<String> relevantItems, int k) {
        if (recommendations == null || recommendations.isEmpty() || relevantItems == null || relevantItems.isEmpty()) {
            return 0.0;
        }

        Set<String> relevantSet = new HashSet<>(relevantItems);
        int evalLength = Math.min(k, recommendations.size());
        int hitCount = 0;

        for (int i = 0; i < evalLength; i++) {
            if (relevantSet.contains(recommendations.get(i).getId())) {
                hitCount++;
            }
        }

        return (double) hitCount / evalLength;
    }

    @Override
    public double calculateRecall(List<GoodsSpu> recommendations, List<String> relevantItems, int k) {
        if (recommendations == null || recommendations.isEmpty() || relevantItems == null || relevantItems.isEmpty()) {
            return 0.0;
        }

        Set<String> relevantSet = new HashSet<>(relevantItems);
        int evalLength = Math.min(k, recommendations.size());
        int hitCount = 0;

        for (int i = 0; i < evalLength; i++) {
            if (relevantSet.contains(recommendations.get(i).getId())) {
                hitCount++;
            }
        }

        return (double) hitCount / relevantItems.size();
    }

    @Override
    public double calculateCoverage(List<GoodsSpu> recommendations, int totalItems) {
        if (recommendations == null || recommendations.isEmpty() || totalItems <= 0) {
            return 0.0;
        }

        // 计算唯一商品数
        long uniqueItems = recommendations.stream()
                .map(GoodsSpu::getId)
                .distinct()
                .count();

        return (double) uniqueItems / totalItems;
    }

    @Override
    public double calculateILD(List<GoodsSpu> recommendations) {
        if (recommendations == null || recommendations.size() < 2) {
            return 0.0;
        }

        double totalDiversity = 0.0;
        int pairCount = 0;

        // 计算所有商品对的多样性
        for (int i = 0; i < recommendations.size(); i++) {
            for (int j = i + 1; j < recommendations.size(); j++) {
                GoodsSpu product1 = recommendations.get(i);
                GoodsSpu product2 = recommendations.get(j);
                double pairDiversity = calculatePairDiversity(product1, product2);
                totalDiversity += pairDiversity;
                pairCount++;
            }
        }

        if (pairCount == 0) {
            return 0.0;
        }

        return totalDiversity / pairCount;
    }

    /**
     * 计算两个商品之间的多样性 (V4.0: 6维度)
     *
     * 多样性 = 0.25 × 品类 + 0.20 × 商户 + 0.15 × 价格 + 0.15 × 品牌 + 0.10 × 产地 + 0.15 × 促销
     */
    private double calculatePairDiversity(GoodsSpu product1, GoodsSpu product2) {
        double diversity = 0.0;

        // 1. 品类多样性 (0.25)
        boolean categoryDifferent = !Objects.equals(product1.getCategoryFirst(), product2.getCategoryFirst());
        if (categoryDifferent) {
            diversity += ILD_WEIGHT_CATEGORY;
        }

        // 2. 商户多样性 (0.20)
        boolean merchantDifferent = !Objects.equals(product1.getMerchantId(), product2.getMerchantId());
        if (merchantDifferent) {
            diversity += ILD_WEIGHT_MERCHANT;
        }

        // 3. 价格多样性 (0.15)
        BigDecimal price1 = product1.getSalesPrice();
        BigDecimal price2 = product2.getSalesPrice();
        if (price1 != null && price2 != null) {
            double priceDiff = Math.abs(price1.doubleValue() - price2.doubleValue());
            double normalizedDiff = Math.min(1.0, priceDiff / MAX_PRICE_FOR_NORM);
            diversity += ILD_WEIGHT_PRICE * normalizedDiff;
        }

        // 4. 品牌多样性 (0.15) - 使用商品名称前缀作为品牌代理
        String brand1 = extractBrand(product1);
        String brand2 = extractBrand(product2);
        if (!Objects.equals(brand1, brand2)) {
            diversity += ILD_WEIGHT_BRAND;
        }

        // 5. 产地多样性 (0.10) - 使用二级分类作为产地代理
        boolean originDifferent = !Objects.equals(product1.getCategorySecond(), product2.getCategorySecond());
        if (originDifferent) {
            diversity += ILD_WEIGHT_ORIGIN;
        }

        // 6. 促销状态多样性 (0.15) - 使用市场价与销售价差异作为促销代理
        boolean hasDiscount1 = product1.getMarketPrice() != null &&
                               product1.getSalesPrice() != null &&
                               product1.getMarketPrice().compareTo(product1.getSalesPrice()) > 0;
        boolean hasDiscount2 = product2.getMarketPrice() != null &&
                               product2.getSalesPrice() != null &&
                               product2.getMarketPrice().compareTo(product2.getSalesPrice()) > 0;
        if (hasDiscount1 != hasDiscount2) {
            diversity += ILD_WEIGHT_PROMOTION;
        }

        return diversity;
    }

    /**
     * 提取品牌信息 (从商品名称前缀)
     */
    private String extractBrand(GoodsSpu product) {
        if (product == null || product.getName() == null) {
            return "";
        }
        String name = product.getName();
        // 取名称前4个字作为品牌代理
        return name.length() > 4 ? name.substring(0, 4) : name;
    }

    @Override
    public EvaluationReport generateEvaluationReport(String wxUserId, List<GoodsSpu> recommendations) {
        long startTime = System.currentTimeMillis();
        EvaluationReport report = new EvaluationReport();
        report.setUserId(wxUserId);
        report.setRecommendationCount(recommendations != null ? recommendations.size() : 0);

        if (recommendations == null || recommendations.isEmpty()) {
            report.setEvaluationTimeMs(System.currentTimeMillis() - startTime);
            report.setEvaluationTime(LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
            return report;
        }

        // 获取用户的相关商品（点击/购买的商品）
        List<String> relevantItems = getRelevantItems(wxUserId);
        boolean isColdStart = relevantItems.isEmpty();

        // 冷启动用户使用代理相关集
        if (isColdStart) {
            relevantItems = getRelevantItemsForColdStart(wxUserId);
            log.info("冷启动用户评估: userId={}, 使用代理相关集size={}", wxUserId, relevantItems.size());
        }
        report.setRelevantCount(relevantItems.size());
        report.setColdStartMode(isColdStart);

        // 计算排序质量指标
        report.setNdcg5(calculateNDCG(recommendations, relevantItems, 5));
        report.setNdcg10(calculateNDCG(recommendations, relevantItems, 10));
        report.setHit5(calculateHitRate(recommendations, relevantItems, 5));
        report.setHit10(calculateHitRate(recommendations, relevantItems, 10));
        report.setMap(calculateMAP(recommendations, relevantItems));
        report.setMrr(calculateMRR(recommendations, relevantItems));

        // 计算精度指标
        report.setPrecision5(calculatePrecision(recommendations, relevantItems, 5));
        report.setPrecision10(calculatePrecision(recommendations, relevantItems, 10));
        report.setRecall5(calculateRecall(recommendations, relevantItems, 5));
        report.setRecall10(calculateRecall(recommendations, relevantItems, 10));

        // 计算多样性指标
        int totalItems = getTotalItemCount();
        report.setCoverage(calculateCoverage(recommendations, totalItems));
        report.setIld(calculateILD(recommendations));

        // 元数据
        report.setEvaluationTimeMs(System.currentTimeMillis() - startTime);
        report.setEvaluationTime(LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));

        // 保存评估历史
        saveEvaluationHistory(report);

        log.info("生成评估报告: userId={}, coldStart={}, NDCG@10={:.4f}, Hit@10={:.4f}, Coverage={:.4f}, ILD={:.4f}",
                wxUserId, report.isColdStartMode(), report.getNdcg10(), report.getHit10(), report.getCoverage(), report.getIld());

        return report;
    }

    @Override
    public Map<String, Object> batchEvaluate(Map<String, List<GoodsSpu>> userRecommendations) {
        Map<String, Object> result = new LinkedHashMap<>();

        if (userRecommendations == null || userRecommendations.isEmpty()) {
            result.put("userCount", 0);
            result.put("error", "No user recommendations provided");
            return result;
        }

        List<EvaluationReport> reports = new ArrayList<>();

        for (Map.Entry<String, List<GoodsSpu>> entry : userRecommendations.entrySet()) {
            try {
                EvaluationReport report = generateEvaluationReport(entry.getKey(), entry.getValue());
                reports.add(report);
            } catch (Exception e) {
                log.warn("评估用户推荐失败: userId={}, error={}", entry.getKey(), e.getMessage());
            }
        }

        // 计算汇总统计
        result.put("userCount", reports.size());
        result.put("avgNdcg5", reports.stream().mapToDouble(EvaluationReport::getNdcg5).average().orElse(0));
        result.put("avgNdcg10", reports.stream().mapToDouble(EvaluationReport::getNdcg10).average().orElse(0));
        result.put("avgHit5", reports.stream().mapToDouble(EvaluationReport::getHit5).average().orElse(0));
        result.put("avgHit10", reports.stream().mapToDouble(EvaluationReport::getHit10).average().orElse(0));
        result.put("avgMap", reports.stream().mapToDouble(EvaluationReport::getMap).average().orElse(0));
        result.put("avgMrr", reports.stream().mapToDouble(EvaluationReport::getMrr).average().orElse(0));
        result.put("avgPrecision5", reports.stream().mapToDouble(EvaluationReport::getPrecision5).average().orElse(0));
        result.put("avgPrecision10", reports.stream().mapToDouble(EvaluationReport::getPrecision10).average().orElse(0));
        result.put("avgRecall5", reports.stream().mapToDouble(EvaluationReport::getRecall5).average().orElse(0));
        result.put("avgRecall10", reports.stream().mapToDouble(EvaluationReport::getRecall10).average().orElse(0));
        result.put("avgCoverage", reports.stream().mapToDouble(EvaluationReport::getCoverage).average().orElse(0));
        result.put("avgIld", reports.stream().mapToDouble(EvaluationReport::getIld).average().orElse(0));
        result.put("evaluationTime", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));

        log.info("批量评估完成: {} 用户, avgNDCG@10={:.4f}, avgHit@10={:.4f}",
                reports.size(),
                (double) result.get("avgNdcg10"),
                (double) result.get("avgHit10"));

        return result;
    }

    @Override
    public Map<String, Object> getEvaluationHistory(int days) {
        Map<String, Object> history = new LinkedHashMap<>();
        history.put("days", days);

        try {
            List<Map<String, Object>> dailyStats = new ArrayList<>();
            LocalDateTime now = LocalDateTime.now();

            for (int i = 0; i < days; i++) {
                LocalDateTime date = now.minusDays(i);
                String dateKey = date.format(DateTimeFormatter.ISO_LOCAL_DATE);
                String cacheKey = EVALUATION_HISTORY_PREFIX + dateKey;

                String statsJson = redisTemplate.opsForValue().get(cacheKey);
                if (statsJson != null) {
                    Map<String, Object> stats = objectMapper.readValue(statsJson, Map.class);
                    stats.put("date", dateKey);
                    dailyStats.add(stats);
                }
            }

            history.put("dailyStats", dailyStats);
            history.put("dataPoints", dailyStats.size());

            // 计算趋势（最近7天 vs 之前7天）
            if (dailyStats.size() >= 14) {
                double recentNdcg = dailyStats.subList(0, 7).stream()
                        .mapToDouble(s -> ((Number) s.getOrDefault("avgNdcg10", 0.0)).doubleValue())
                        .average().orElse(0);
                double previousNdcg = dailyStats.subList(7, 14).stream()
                        .mapToDouble(s -> ((Number) s.getOrDefault("avgNdcg10", 0.0)).doubleValue())
                        .average().orElse(0);
                history.put("ndcgTrend", previousNdcg > 0 ? (recentNdcg - previousNdcg) / previousNdcg : 0);
            }

        } catch (Exception e) {
            log.warn("获取评估历史失败: {}", e.getMessage());
            history.put("error", e.getMessage());
        }

        return history;
    }

    /**
     * 获取用户的相关商品（已点击或已购买）
     */
    private List<String> getRelevantItems(String wxUserId) {
        if (wxUserId == null || wxUserId.isEmpty()) {
            return Collections.emptyList();
        }

        try {
            LambdaQueryWrapper<RecommendationLog> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(RecommendationLog::getWxUserId, wxUserId)
                    .and(w -> w.eq(RecommendationLog::getIsClicked, true)
                            .or().eq(RecommendationLog::getIsPurchased, true))
                    .ge(RecommendationLog::getCreateTime, LocalDateTime.now().minusDays(30));

            List<RecommendationLog> logs = recommendationLogMapper.selectList(wrapper);

            return logs.stream()
                    .map(RecommendationLog::getProductId)
                    .filter(Objects::nonNull)
                    .distinct()
                    .collect(Collectors.toList());

        } catch (Exception e) {
            log.warn("获取用户相关商品失败: wxUserId={}, error={}", wxUserId, e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * 获取商品总数
     */
    private int getTotalItemCount() {
        try {
            LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(GoodsSpu::getShelf, "1")
                    .isNull(GoodsSpu::getDelFlag);
            return goodsSpuMapper.selectCount(wrapper).intValue();
        } catch (Exception e) {
            log.warn("获取商品总数失败: {}", e.getMessage());
            return 1000;  // 默认值
        }
    }

    /**
     * 获取冷启动用户的相关商品集
     * 使用聚类内高活跃用户的购买商品作为代理相关集
     */
    private List<String> getRelevantItemsForColdStart(String wxUserId) {
        try {
            // 尝试获取用户聚类
            UserClusterAssignment assignment =
                userClusterService.getUserClusterAssignment(wxUserId);

            if (assignment != null) {
                // 有聚类: 使用同聚类高活跃用户的购买商品
                List<GoodsSpu> clusterProducts = collaborativeFilteringService
                    .getUserBasedRecommendations(wxUserId, 100);
                return clusterProducts.stream()
                    .map(GoodsSpu::getId)
                    .collect(Collectors.toList());
            }

            // 无聚类: 使用全局热门商品
            return getGlobalPopularItems(50);
        } catch (Exception e) {
            log.warn("获取冷启动相关商品失败: {}", e.getMessage());
            return getGlobalPopularItems(50);
        }
    }

    /**
     * 获取全局热门商品
     */
    private List<String> getGlobalPopularItems(int limit) {
        LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(GoodsSpu::getShelf, "1")
               .isNull(GoodsSpu::getDelFlag)
               .orderByDesc(GoodsSpu::getSaleNum)
               .last("LIMIT " + limit);

        return goodsSpuMapper.selectList(wrapper).stream()
            .map(GoodsSpu::getId)
            .collect(Collectors.toList());
    }

    /**
     * 保存评估历史
     */
    private void saveEvaluationHistory(EvaluationReport report) {
        try {
            String dateKey = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE);
            String cacheKey = EVALUATION_HISTORY_PREFIX + dateKey;

            // 获取或创建当天的统计
            String existingJson = redisTemplate.opsForValue().get(cacheKey);
            Map<String, Object> dailyStats;

            if (existingJson != null) {
                dailyStats = objectMapper.readValue(existingJson, Map.class);
            } else {
                dailyStats = new HashMap<>();
                dailyStats.put("count", 0);
                dailyStats.put("sumNdcg10", 0.0);
                dailyStats.put("sumHit10", 0.0);
                dailyStats.put("sumCoverage", 0.0);
                dailyStats.put("sumIld", 0.0);
            }

            // 更新统计
            int count = ((Number) dailyStats.get("count")).intValue() + 1;
            dailyStats.put("count", count);
            dailyStats.put("sumNdcg10", ((Number) dailyStats.get("sumNdcg10")).doubleValue() + report.getNdcg10());
            dailyStats.put("sumHit10", ((Number) dailyStats.get("sumHit10")).doubleValue() + report.getHit10());
            dailyStats.put("sumCoverage", ((Number) dailyStats.get("sumCoverage")).doubleValue() + report.getCoverage());
            dailyStats.put("sumIld", ((Number) dailyStats.get("sumIld")).doubleValue() + report.getIld());

            // 计算平均值
            dailyStats.put("avgNdcg10", ((Number) dailyStats.get("sumNdcg10")).doubleValue() / count);
            dailyStats.put("avgHit10", ((Number) dailyStats.get("sumHit10")).doubleValue() / count);
            dailyStats.put("avgCoverage", ((Number) dailyStats.get("sumCoverage")).doubleValue() / count);
            dailyStats.put("avgIld", ((Number) dailyStats.get("sumIld")).doubleValue() / count);

            // 保存
            String statsJson = objectMapper.writeValueAsString(dailyStats);
            redisTemplate.opsForValue().set(cacheKey, statsJson, HISTORY_TTL_DAYS, TimeUnit.DAYS);

        } catch (Exception e) {
            log.debug("保存评估历史失败: {}", e.getMessage());
        }
    }
}

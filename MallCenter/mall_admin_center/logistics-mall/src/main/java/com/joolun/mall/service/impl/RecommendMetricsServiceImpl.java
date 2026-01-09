package com.joolun.mall.service.impl;

import com.joolun.mall.service.ABTestService;
import com.joolun.mall.service.RecommendMetricsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.TimeUnit;

/**
 * 推荐系统指标监控服务实现
 * 基于 Redis 实现实时指标收集和统计
 */
@Slf4j
@Service
public class RecommendMetricsServiceImpl implements RecommendMetricsService {

    private final RedisTemplate<String, Object> redisTemplate;
    private final ABTestService abTestService;

    public RecommendMetricsServiceImpl(
            @Qualifier("stringObjectRedisTemplate") RedisTemplate<String, Object> redisTemplate,
            ABTestService abTestService) {
        this.redisTemplate = redisTemplate;
        this.abTestService = abTestService;
    }

    private static final String METRICS_KEY_PREFIX = "mall:recommend:metrics:";
    private static final String SOURCE_METRICS_KEY = "mall:recommend:source:";
    private static final String EXPRESS_MATCH_KEY = "mall:recommend:express_match:";
    private static final int METRICS_TTL_DAYS = 90;

    @Override
    public void recordImpressions(Long userId, List<String> productIds, String source) {
        if (productIds == null || productIds.isEmpty()) {
            return;
        }

        String dateKey = getDateKey();
        String key = METRICS_KEY_PREFIX + "impressions:" + dateKey;
        String sourceKey = SOURCE_METRICS_KEY + source + ":" + dateKey;

        // 记录曝光次数
        redisTemplate.opsForHash().increment(key, "total", productIds.size());
        redisTemplate.opsForHash().increment(key, "users", 1);
        redisTemplate.opsForHash().increment(sourceKey, "impressions", productIds.size());

        // 记录各实验组的曝光
        recordExperimentMetric(userId, "impression", productIds.size());

        setExpire(key);
        setExpire(sourceKey);

        log.debug("记录曝光: userId={}, count={}, source={}", userId, productIds.size(), source);
    }

    @Override
    public void recordClick(Long userId, String productId, String source) {
        String dateKey = getDateKey();
        String key = METRICS_KEY_PREFIX + "clicks:" + dateKey;
        String sourceKey = SOURCE_METRICS_KEY + source + ":" + dateKey;

        redisTemplate.opsForHash().increment(key, "total", 1);
        redisTemplate.opsForHash().increment(key, "users", 1);
        redisTemplate.opsForHash().increment(sourceKey, "clicks", 1);

        // 记录热门商品点击
        String hotKey = METRICS_KEY_PREFIX + "hot_products:" + dateKey;
        redisTemplate.opsForZSet().incrementScore(hotKey, productId, 1);
        setExpire(hotKey);

        // 记录各实验组的点击
        recordExperimentMetric(userId, "click", 1);

        setExpire(key);
        setExpire(sourceKey);

        log.debug("记录点击: userId={}, productId={}, source={}", userId, productId, source);
    }

    @Override
    public void recordPurchase(Long userId, String productId, double amount, String source) {
        String dateKey = getDateKey();
        String key = METRICS_KEY_PREFIX + "purchases:" + dateKey;
        String sourceKey = SOURCE_METRICS_KEY + source + ":" + dateKey;

        redisTemplate.opsForHash().increment(key, "total", 1);
        redisTemplate.opsForHash().increment(key, "amount", (long) (amount * 100)); // 存储分
        redisTemplate.opsForHash().increment(key, "users", 1);
        redisTemplate.opsForHash().increment(sourceKey, "purchases", 1);
        redisTemplate.opsForHash().increment(sourceKey, "gmv", (long) (amount * 100));

        // 记录各实验组的购买
        recordExperimentMetric(userId, "purchase", 1);

        setExpire(key);
        setExpire(sourceKey);

        log.debug("记录购买: userId={}, productId={}, amount={}, source={}", userId, productId, amount, source);
    }

    @Override
    public void recordChatSatisfaction(Long userId, String sessionId, boolean satisfied) {
        String dateKey = getDateKey();
        String key = METRICS_KEY_PREFIX + "chat_satisfaction:" + dateKey;

        redisTemplate.opsForHash().increment(key, "total", 1);
        if (satisfied) {
            redisTemplate.opsForHash().increment(key, "satisfied", 1);
        }

        setExpire(key);

        log.debug("记录满意度: userId={}, sessionId={}, satisfied={}", userId, sessionId, satisfied);
    }

    @Override
    public void recordExpressMatchUsage(Long userId, List<String> keywords, boolean accepted) {
        String dateKey = getDateKey();
        String key = EXPRESS_MATCH_KEY + dateKey;

        redisTemplate.opsForHash().increment(key, "total_offers", 1);
        if (accepted) {
            redisTemplate.opsForHash().increment(key, "accepted", 1);
        }

        // 记录热门需求关键词
        if (keywords != null) {
            String hotKeywordsKey = EXPRESS_MATCH_KEY + "hot_keywords:" + dateKey;
            for (String keyword : keywords) {
                redisTemplate.opsForZSet().incrementScore(hotKeywordsKey, keyword, 1);
            }
            setExpire(hotKeywordsKey);
        }

        // 记录到实验指标
        abTestService.recordMetric(userId, ABTestService.EXP_EXPRESS_MATCH,
                accepted ? "accepted" : "declined", 1);

        setExpire(key);

        log.debug("记录极速匹配: userId={}, keywords={}, accepted={}", userId, keywords, accepted);
    }

    @Override
    public Map<String, Object> getRealtimeMetrics() {
        Map<String, Object> metrics = new HashMap<>();
        String dateKey = getDateKey();

        // 今日曝光
        Map<Object, Object> impressions = redisTemplate.opsForHash()
                .entries(METRICS_KEY_PREFIX + "impressions:" + dateKey);
        metrics.put("todayImpressions", getDoubleValue(impressions, "total"));

        // 今日点击
        Map<Object, Object> clicks = redisTemplate.opsForHash()
                .entries(METRICS_KEY_PREFIX + "clicks:" + dateKey);
        metrics.put("todayClicks", getDoubleValue(clicks, "total"));

        // 今日购买
        Map<Object, Object> purchases = redisTemplate.opsForHash()
                .entries(METRICS_KEY_PREFIX + "purchases:" + dateKey);
        metrics.put("todayPurchases", getDoubleValue(purchases, "total"));
        metrics.put("todayGMV", getDoubleValue(purchases, "amount") / 100);

        // 计算CTR和CVR
        double imp = getDoubleValue(impressions, "total");
        double clk = getDoubleValue(clicks, "total");
        double pur = getDoubleValue(purchases, "total");

        metrics.put("ctr", imp > 0 ? String.format("%.2f%%", clk / imp * 100) : "0.00%");
        metrics.put("cvr", clk > 0 ? String.format("%.2f%%", pur / clk * 100) : "0.00%");

        // AI对话满意度
        Map<Object, Object> satisfaction = redisTemplate.opsForHash()
                .entries(METRICS_KEY_PREFIX + "chat_satisfaction:" + dateKey);
        double totalChat = getDoubleValue(satisfaction, "total");
        double satisfiedChat = getDoubleValue(satisfaction, "satisfied");
        metrics.put("chatSatisfactionRate",
                totalChat > 0 ? String.format("%.1f%%", satisfiedChat / totalChat * 100) : "N/A");

        // 极速匹配服务
        Map<Object, Object> expressMatch = redisTemplate.opsForHash()
                .entries(EXPRESS_MATCH_KEY + dateKey);
        double totalOffers = getDoubleValue(expressMatch, "total_offers");
        double accepted = getDoubleValue(expressMatch, "accepted");
        metrics.put("expressMatchOffers", (int) totalOffers);
        metrics.put("expressMatchAcceptRate",
                totalOffers > 0 ? String.format("%.1f%%", accepted / totalOffers * 100) : "N/A");

        // 热门商品
        Set<Object> hotProducts = redisTemplate.opsForZSet()
                .reverseRange(METRICS_KEY_PREFIX + "hot_products:" + dateKey, 0, 9);
        metrics.put("hotProducts", hotProducts != null ? new ArrayList<>(hotProducts) : new ArrayList<>());

        metrics.put("generatedAt", new Date().toString());

        return metrics;
    }

    @Override
    public Map<String, Object> getMetricsReport(int days) {
        Map<String, Object> report = new HashMap<>();
        report.put("period", days + "天");

        double totalImpressions = 0, totalClicks = 0, totalPurchases = 0, totalGMV = 0;
        List<Map<String, Object>> dailyData = new ArrayList<>();

        LocalDate today = LocalDate.now();
        for (int i = 0; i < days; i++) {
            String dateKey = today.minusDays(i).format(DateTimeFormatter.ISO_DATE);
            Map<String, Object> dayData = new HashMap<>();
            dayData.put("date", dateKey);

            Map<Object, Object> impressions = redisTemplate.opsForHash()
                    .entries(METRICS_KEY_PREFIX + "impressions:" + dateKey);
            Map<Object, Object> clicks = redisTemplate.opsForHash()
                    .entries(METRICS_KEY_PREFIX + "clicks:" + dateKey);
            Map<Object, Object> purchases = redisTemplate.opsForHash()
                    .entries(METRICS_KEY_PREFIX + "purchases:" + dateKey);

            double dayImp = getDoubleValue(impressions, "total");
            double dayClk = getDoubleValue(clicks, "total");
            double dayPur = getDoubleValue(purchases, "total");
            double dayGMV = getDoubleValue(purchases, "amount") / 100;

            dayData.put("impressions", (int) dayImp);
            dayData.put("clicks", (int) dayClk);
            dayData.put("purchases", (int) dayPur);
            dayData.put("gmv", dayGMV);
            dayData.put("ctr", dayImp > 0 ? String.format("%.2f%%", dayClk / dayImp * 100) : "0.00%");
            dayData.put("cvr", dayClk > 0 ? String.format("%.2f%%", dayPur / dayClk * 100) : "0.00%");

            dailyData.add(dayData);

            totalImpressions += dayImp;
            totalClicks += dayClk;
            totalPurchases += dayPur;
            totalGMV += dayGMV;
        }

        report.put("dailyData", dailyData);
        report.put("totalImpressions", (int) totalImpressions);
        report.put("totalClicks", (int) totalClicks);
        report.put("totalPurchases", (int) totalPurchases);
        report.put("totalGMV", totalGMV);
        report.put("avgCTR", totalImpressions > 0 ?
                String.format("%.2f%%", totalClicks / totalImpressions * 100) : "0.00%");
        report.put("avgCVR", totalClicks > 0 ?
                String.format("%.2f%%", totalPurchases / totalClicks * 100) : "0.00%");

        return report;
    }

    @Override
    public Map<String, Object> getSourceAnalysis(int days) {
        Map<String, Object> analysis = new HashMap<>();
        String[] sources = {"ai_chat", "search", "homepage", "category", "express_match"};

        LocalDate today = LocalDate.now();
        for (String source : sources) {
            Map<String, Object> sourceData = new HashMap<>();
            double totalImp = 0, totalClk = 0, totalPur = 0, totalGMV = 0;

            for (int i = 0; i < days; i++) {
                String dateKey = today.minusDays(i).format(DateTimeFormatter.ISO_DATE);
                String key = SOURCE_METRICS_KEY + source + ":" + dateKey;
                Map<Object, Object> metrics = redisTemplate.opsForHash().entries(key);

                totalImp += getDoubleValue(metrics, "impressions");
                totalClk += getDoubleValue(metrics, "clicks");
                totalPur += getDoubleValue(metrics, "purchases");
                totalGMV += getDoubleValue(metrics, "gmv") / 100;
            }

            sourceData.put("impressions", (int) totalImp);
            sourceData.put("clicks", (int) totalClk);
            sourceData.put("purchases", (int) totalPur);
            sourceData.put("gmv", totalGMV);
            sourceData.put("ctr", totalImp > 0 ? String.format("%.2f%%", totalClk / totalImp * 100) : "0.00%");
            sourceData.put("cvr", totalClk > 0 ? String.format("%.2f%%", totalPur / totalClk * 100) : "0.00%");

            analysis.put(source, sourceData);
        }

        analysis.put("period", days + "天");
        return analysis;
    }

    /**
     * 记录实验指标
     */
    private void recordExperimentMetric(Long userId, String metricName, double value) {
        // 为各个实验记录指标
        String[] experiments = {
                ABTestService.EXP_VECTOR_SEARCH,
                ABTestService.EXP_EXPRESS_MATCH,
                ABTestService.EXP_RAG_KNOWLEDGE,
                ABTestService.EXP_FEATURE_128D
        };

        for (String exp : experiments) {
            if (abTestService.isExperimentEnabled(exp)) {
                abTestService.recordMetric(userId, exp, metricName, value);
            }
        }
    }

    private String getDateKey() {
        return LocalDate.now().format(DateTimeFormatter.ISO_DATE);
    }

    private void setExpire(String key) {
        redisTemplate.expire(key, METRICS_TTL_DAYS, TimeUnit.DAYS);
    }

    private double getDoubleValue(Map<Object, Object> map, String key) {
        Object value = map.get(key);
        if (value == null) {
            return 0;
        }
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        try {
            return Double.parseDouble(value.toString());
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}

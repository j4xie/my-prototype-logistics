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
import java.util.UUID;

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
    private static final String AB_COMPARISON_KEY = "mall:recommend:ab:";
    private static final String DIVERSITY_KEY = "mall:recommend:diversity:";
    private static final String RETENTION_KEY = "mall:recommend:retention:";
    private static final String CLICK_DEPTH_KEY = "mall:recommend:click_depth:";
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

        // 记录A/B测试购买和GMV数据
        recordABTestPurchase(userId, amount, dateKey);

        setExpire(key);
        setExpire(sourceKey);

        log.debug("记录购买: userId={}, productId={}, amount={}, source={}", userId, productId, amount, source);
    }

    /**
     * 记录A/B测试购买指标（包含GMV）
     */
    private void recordABTestPurchase(Long userId, double amount, String dateKey) {
        String[] experiments = {
                ABTestService.EXP_VECTOR_SEARCH,
                ABTestService.EXP_EXPRESS_MATCH,
                ABTestService.EXP_RAG_KNOWLEDGE,
                ABTestService.EXP_FEATURE_128D
        };

        for (String exp : experiments) {
            if (abTestService.isExperimentEnabled(exp)) {
                String group = abTestService.getUserGroup(userId, exp);
                if (group != null) {
                    String key = AB_COMPARISON_KEY + exp + ":" + group + ":" + dateKey;
                    redisTemplate.opsForHash().increment(key, "purchases", 1);
                    redisTemplate.opsForHash().increment(key, "gmv", (long) (amount * 100));
                    setExpire(key);
                }
            }
        }
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

    @Override
    public Map<String, Object> getABTestComparison(String experimentName, int days) {
        Map<String, Object> result = new HashMap<>();
        result.put("experimentName", experimentName);
        result.put("period", days + "天");

        // 获取实验组列表
        String[] groups = {"control", "treatment", "treatment_b"};
        List<Map<String, Object>> groupStats = new ArrayList<>();

        LocalDate today = LocalDate.now();
        for (String group : groups) {
            Map<String, Object> groupData = new HashMap<>();
            groupData.put("group", group);

            double totalImpressions = 0, totalClicks = 0, totalPurchases = 0, totalGMV = 0;
            int totalUsers = 0;

            for (int i = 0; i < days; i++) {
                String dateKey = today.minusDays(i).format(DateTimeFormatter.ISO_DATE);
                String key = AB_COMPARISON_KEY + experimentName + ":" + group + ":" + dateKey;
                Map<Object, Object> metrics = redisTemplate.opsForHash().entries(key);

                totalImpressions += getDoubleValue(metrics, "impressions");
                totalClicks += getDoubleValue(metrics, "clicks");
                totalPurchases += getDoubleValue(metrics, "purchases");
                totalGMV += getDoubleValue(metrics, "gmv") / 100;
                totalUsers += (int) getDoubleValue(metrics, "users");
            }

            groupData.put("users", totalUsers);
            groupData.put("impressions", (int) totalImpressions);
            groupData.put("clicks", (int) totalClicks);
            groupData.put("purchases", (int) totalPurchases);
            groupData.put("gmv", totalGMV);
            groupData.put("ctr", totalImpressions > 0 ?
                    String.format("%.2f%%", totalClicks / totalImpressions * 100) : "0.00%");
            groupData.put("cvr", totalClicks > 0 ?
                    String.format("%.2f%%", totalPurchases / totalClicks * 100) : "0.00%");
            groupData.put("arpu", totalUsers > 0 ?
                    String.format("%.2f", totalGMV / totalUsers) : "0.00");

            groupStats.add(groupData);
        }

        result.put("groups", groupStats);

        // 计算统计显著性提示
        if (groupStats.size() >= 2) {
            Map<String, Object> controlGroup = groupStats.get(0);
            Map<String, Object> treatmentGroup = groupStats.get(1);
            double controlCvr = parsePercentage((String) controlGroup.get("cvr"));
            double treatmentCvr = parsePercentage((String) treatmentGroup.get("cvr"));

            if (treatmentCvr > controlCvr) {
                double lift = controlCvr > 0 ? ((treatmentCvr - controlCvr) / controlCvr * 100) : 0;
                result.put("insight", String.format("实验组转化率提升 %.1f%%", lift));
            } else if (controlCvr > treatmentCvr) {
                double drop = controlCvr > 0 ? ((controlCvr - treatmentCvr) / controlCvr * 100) : 0;
                result.put("insight", String.format("实验组转化率下降 %.1f%%，建议回滚", drop));
            } else {
                result.put("insight", "两组转化率相近，建议继续观察");
            }
        }

        return result;
    }

    @Override
    public Map<String, Object> getDiversityScore(int days) {
        Map<String, Object> result = new HashMap<>();
        result.put("period", days + "天");

        LocalDate today = LocalDate.now();
        List<Map<String, Object>> dailyData = new ArrayList<>();
        double totalDiversityScore = 0;
        int validDays = 0;

        for (int i = 0; i < days; i++) {
            String dateKey = today.minusDays(i).format(DateTimeFormatter.ISO_DATE);
            Map<String, Object> dayData = new HashMap<>();
            dayData.put("date", dateKey);

            // 获取当天推荐的总商品数
            String totalKey = DIVERSITY_KEY + "total:" + dateKey;
            Object totalObj = redisTemplate.opsForValue().get(totalKey);
            long totalRecommendations = totalObj != null ? Long.parseLong(totalObj.toString()) : 0;

            // 获取当天推荐的不同类目数（使用HyperLogLog或Set）
            String categoriesKey = DIVERSITY_KEY + "categories:" + dateKey;
            Long uniqueCategories = redisTemplate.opsForHyperLogLog().size(categoriesKey);

            double diversityScore = 0;
            if (totalRecommendations > 0 && uniqueCategories != null && uniqueCategories > 0) {
                // 多样性评分 = 不同类目数 / 理想最大类目数（假设100为基准）
                diversityScore = Math.min(1.0, uniqueCategories.doubleValue() / 100.0);
                totalDiversityScore += diversityScore;
                validDays++;
            }

            dayData.put("totalRecommendations", totalRecommendations);
            dayData.put("uniqueCategories", uniqueCategories != null ? uniqueCategories : 0);
            dayData.put("diversityScore", String.format("%.2f", diversityScore));
            dailyData.add(dayData);
        }

        result.put("dailyData", dailyData);
        result.put("avgDiversityScore", validDays > 0 ?
                String.format("%.2f", totalDiversityScore / validDays) : "0.00");

        // 获取类目分布（Top 10）
        String latestDateKey = today.format(DateTimeFormatter.ISO_DATE);
        String categoryDistKey = DIVERSITY_KEY + "category_dist:" + latestDateKey;
        Set<Object> topCategories = redisTemplate.opsForZSet()
                .reverseRange(categoryDistKey, 0, 9);
        result.put("topCategories", topCategories != null ? new ArrayList<>(topCategories) : new ArrayList<>());

        return result;
    }

    @Override
    public Map<String, Object> getRetentionRate(int days) {
        Map<String, Object> result = new HashMap<>();
        result.put("period", days + "天");

        LocalDate today = LocalDate.now();
        List<Map<String, Object>> cohortData = new ArrayList<>();

        // 分析过去每一天的用户群组在后续几天的留存
        for (int cohortDay = days; cohortDay > 0; cohortDay--) {
            LocalDate cohortDate = today.minusDays(cohortDay);
            String cohortDateKey = cohortDate.format(DateTimeFormatter.ISO_DATE);

            Map<String, Object> cohort = new HashMap<>();
            cohort.put("cohortDate", cohortDateKey);

            // 获取该天通过推荐访问的用户数
            String dayZeroKey = RETENTION_KEY + "users:" + cohortDateKey;
            Long dayZeroUsers = redisTemplate.opsForSet().size(dayZeroKey);
            cohort.put("day0Users", dayZeroUsers != null ? dayZeroUsers : 0);

            // 计算后续几天的留存
            List<Map<String, Object>> retentionDays = new ArrayList<>();
            for (int retainDay = 1; retainDay <= Math.min(7, cohortDay); retainDay++) {
                LocalDate retainDate = cohortDate.plusDays(retainDay);
                String retainDateKey = retainDate.format(DateTimeFormatter.ISO_DATE);
                String retainKey = RETENTION_KEY + "users:" + retainDateKey;

                // 计算交集（两天都访问的用户数）
                String tempKey = RETENTION_KEY + "temp:" + UUID.randomUUID();
                try {
                    Long intersectCount = redisTemplate.opsForSet()
                            .intersectAndStore(dayZeroKey, retainKey, tempKey);

                    Map<String, Object> retainData = new HashMap<>();
                    retainData.put("day", retainDay);
                    retainData.put("retainedUsers", intersectCount != null ? intersectCount : 0);

                    double retentionRate = 0;
                    if (dayZeroUsers != null && dayZeroUsers > 0 && intersectCount != null) {
                        retentionRate = (double) intersectCount / dayZeroUsers * 100;
                    }
                    retainData.put("retentionRate", String.format("%.1f%%", retentionRate));
                    retentionDays.add(retainData);
                } finally {
                    redisTemplate.delete(tempKey);
                }
            }
            cohort.put("retention", retentionDays);
            cohortData.add(cohort);
        }

        result.put("cohorts", cohortData);

        // 计算平均留存率（Day1, Day3, Day7）
        Map<String, Object> avgRetention = calculateAverageRetention(cohortData);
        result.put("averageRetention", avgRetention);

        return result;
    }

    @Override
    public Map<String, Object> getClickDepthAnalysis(int days) {
        Map<String, Object> result = new HashMap<>();
        result.put("period", days + "天");

        LocalDate today = LocalDate.now();
        List<Map<String, Object>> dailyData = new ArrayList<>();
        double totalAvgPosition = 0;
        long totalClicks = 0;

        for (int i = 0; i < days; i++) {
            String dateKey = today.minusDays(i).format(DateTimeFormatter.ISO_DATE);
            Map<String, Object> dayData = new HashMap<>();
            dayData.put("date", dateKey);

            // 获取当天点击位置分布
            String positionKey = CLICK_DEPTH_KEY + "positions:" + dateKey;
            Map<Object, Object> positionDist = redisTemplate.opsForHash().entries(positionKey);

            long dayClicks = 0;
            double dayTotalPosition = 0;
            Map<String, Long> positionCounts = new HashMap<>();

            for (Map.Entry<Object, Object> entry : positionDist.entrySet()) {
                int position = Integer.parseInt(entry.getKey().toString());
                long count = Long.parseLong(entry.getValue().toString());

                dayClicks += count;
                dayTotalPosition += position * count;

                // 分组统计：1-3, 4-6, 7-10, 10+
                String bucket = getPositionBucket(position);
                positionCounts.merge(bucket, count, Long::sum);
            }

            double avgPosition = dayClicks > 0 ? dayTotalPosition / dayClicks : 0;
            dayData.put("totalClicks", dayClicks);
            dayData.put("avgClickPosition", String.format("%.1f", avgPosition));
            dayData.put("positionDistribution", positionCounts);

            dailyData.add(dayData);

            totalAvgPosition += avgPosition * dayClicks;
            totalClicks += dayClicks;
        }

        result.put("dailyData", dailyData);
        result.put("overallAvgPosition", totalClicks > 0 ?
                String.format("%.1f", totalAvgPosition / totalClicks) : "N/A");

        // 点击深度分析洞察
        double overallAvg = totalClicks > 0 ? totalAvgPosition / totalClicks : 0;
        if (overallAvg > 0 && overallAvg <= 3) {
            result.put("insight", "用户主要点击前3位商品，推荐排序效果良好");
        } else if (overallAvg > 3 && overallAvg <= 6) {
            result.put("insight", "用户浏览深度中等，建议优化首屏推荐质量");
        } else if (overallAvg > 6) {
            result.put("insight", "用户需要深度浏览才能找到感兴趣商品，排序算法需优化");
        } else {
            result.put("insight", "数据不足，暂无分析");
        }

        return result;
    }

    @Override
    public void recordImpressionsWithCategory(Long userId, List<String> productIds,
                                              List<String> categoryIds, String source) {
        if (productIds == null || productIds.isEmpty()) {
            return;
        }

        // 调用原有的曝光记录方法
        recordImpressions(userId, productIds, source);

        String dateKey = getDateKey();

        // 记录多样性相关数据
        if (categoryIds != null && !categoryIds.isEmpty()) {
            // 记录总推荐数
            String totalKey = DIVERSITY_KEY + "total:" + dateKey;
            redisTemplate.opsForValue().increment(totalKey, productIds.size());
            setExpire(totalKey);

            // 使用 HyperLogLog 记录不同类目数
            String categoriesKey = DIVERSITY_KEY + "categories:" + dateKey;
            redisTemplate.opsForHyperLogLog().add(categoriesKey, categoryIds.toArray());
            setExpire(categoriesKey);

            // 记录类目分布（用于Top分析）
            String categoryDistKey = DIVERSITY_KEY + "category_dist:" + dateKey;
            for (String categoryId : categoryIds) {
                redisTemplate.opsForZSet().incrementScore(categoryDistKey, categoryId, 1);
            }
            setExpire(categoryDistKey);
        }

        // 记录用户留存数据
        String retentionKey = RETENTION_KEY + "users:" + dateKey;
        redisTemplate.opsForSet().add(retentionKey, userId.toString());
        setExpire(retentionKey);

        // 记录A/B测试数据
        recordABTestMetric(userId, "impressions", productIds.size(), dateKey);

        log.debug("记录曝光(带类目): userId={}, count={}, categories={}, source={}",
                userId, productIds.size(), categoryIds != null ? categoryIds.size() : 0, source);
    }

    @Override
    public void recordClickWithPosition(Long userId, String productId, int position, String source) {
        // 调用原有的点击记录方法
        recordClick(userId, productId, source);

        String dateKey = getDateKey();

        // 记录点击深度
        String positionKey = CLICK_DEPTH_KEY + "positions:" + dateKey;
        redisTemplate.opsForHash().increment(positionKey, String.valueOf(position), 1);
        setExpire(positionKey);

        // 记录用户留存数据
        String retentionKey = RETENTION_KEY + "users:" + dateKey;
        redisTemplate.opsForSet().add(retentionKey, userId.toString());
        setExpire(retentionKey);

        // 记录A/B测试数据
        recordABTestMetric(userId, "clicks", 1, dateKey);

        log.debug("记录点击(带位置): userId={}, productId={}, position={}, source={}",
                userId, productId, position, source);
    }

    /**
     * 记录A/B测试指标
     */
    private void recordABTestMetric(Long userId, String metricName, double value, String dateKey) {
        String[] experiments = {
                ABTestService.EXP_VECTOR_SEARCH,
                ABTestService.EXP_EXPRESS_MATCH,
                ABTestService.EXP_RAG_KNOWLEDGE,
                ABTestService.EXP_FEATURE_128D
        };

        for (String exp : experiments) {
            if (abTestService.isExperimentEnabled(exp)) {
                String group = abTestService.getUserGroup(userId, exp);
                if (group != null) {
                    String key = AB_COMPARISON_KEY + exp + ":" + group + ":" + dateKey;
                    redisTemplate.opsForHash().increment(key, metricName, (long) value);

                    // 记录独立用户数
                    String userSetKey = AB_COMPARISON_KEY + exp + ":" + group + ":users:" + dateKey;
                    Boolean isNew = redisTemplate.opsForSet().add(userSetKey, userId.toString()) != null;
                    if (Boolean.TRUE.equals(isNew)) {
                        redisTemplate.opsForHash().increment(key, "users", 1);
                    }

                    setExpire(key);
                    setExpire(userSetKey);
                }
            }
        }
    }

    /**
     * 计算平均留存率
     */
    private Map<String, Object> calculateAverageRetention(List<Map<String, Object>> cohortData) {
        Map<String, Object> avgRetention = new HashMap<>();
        Map<Integer, List<Double>> dayRates = new HashMap<>();

        for (Map<String, Object> cohort : cohortData) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> retention = (List<Map<String, Object>>) cohort.get("retention");
            if (retention != null) {
                for (Map<String, Object> dayData : retention) {
                    int day = (int) dayData.get("day");
                    String rateStr = (String) dayData.get("retentionRate");
                    double rate = parsePercentage(rateStr);
                    dayRates.computeIfAbsent(day, k -> new ArrayList<>()).add(rate);
                }
            }
        }

        for (Map.Entry<Integer, List<Double>> entry : dayRates.entrySet()) {
            List<Double> rates = entry.getValue();
            double avg = rates.stream().mapToDouble(Double::doubleValue).average().orElse(0);
            avgRetention.put("day" + entry.getKey(), String.format("%.1f%%", avg));
        }

        return avgRetention;
    }

    /**
     * 获取点击位置分组
     */
    private String getPositionBucket(int position) {
        if (position <= 3) {
            return "1-3";
        } else if (position <= 6) {
            return "4-6";
        } else if (position <= 10) {
            return "7-10";
        } else {
            return "10+";
        }
    }

    /**
     * 解析百分比字符串
     */
    private double parsePercentage(String percentStr) {
        if (percentStr == null || percentStr.isEmpty()) {
            return 0;
        }
        try {
            return Double.parseDouble(percentStr.replace("%", ""));
        } catch (NumberFormatException e) {
            return 0;
        }
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

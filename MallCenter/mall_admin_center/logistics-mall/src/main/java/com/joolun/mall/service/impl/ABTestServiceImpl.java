package com.joolun.mall.service.impl;

import com.joolun.mall.service.ABTestService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.TimeUnit;

/**
 * A/B 测试服务实现
 * 基于 Redis 实现实验分组和指标记录
 */
@Slf4j
@Service
public class ABTestServiceImpl implements ABTestService {

    private final RedisTemplate<String, Object> redisTemplate;

    public ABTestServiceImpl(
            @Qualifier("stringObjectRedisTemplate") RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    private static final String EXPERIMENT_USER_GROUP_KEY = "mall:abtest:user:group:";
    private static final String EXPERIMENT_METRIC_KEY = "mall:abtest:metric:";
    private static final String EXPERIMENT_CONFIG_KEY = "mall:abtest:config:";

    // 实验配置
    private static final Map<String, ExperimentConfig> EXPERIMENTS = new HashMap<>();

    static {
        // 向量搜索实验 - 50% 流量
        EXPERIMENTS.put(EXP_VECTOR_SEARCH, new ExperimentConfig(
                true, 50, Arrays.asList("control", "treatment")
        ));
        // 极速匹配实验 - 100% 流量（全量上线）
        EXPERIMENTS.put(EXP_EXPRESS_MATCH, new ExperimentConfig(
                true, 100, Arrays.asList("control", "treatment")
        ));
        // RAG知识库实验 - 30% 流量
        EXPERIMENTS.put(EXP_RAG_KNOWLEDGE, new ExperimentConfig(
                true, 30, Arrays.asList("control", "treatment")
        ));
        // 128维特征实验 - 20% 流量
        EXPERIMENTS.put(EXP_FEATURE_128D, new ExperimentConfig(
                true, 20, Arrays.asList("control", "treatment")
        ));
    }

    @Override
    public String assignGroup(Long userId, String experimentName) {
        if (!isExperimentEnabled(experimentName)) {
            return "control";
        }

        // 检查用户是否已分组
        String existingGroup = getUserGroup(userId, experimentName);
        if (existingGroup != null) {
            return existingGroup;
        }

        ExperimentConfig config = EXPERIMENTS.get(experimentName);
        if (config == null) {
            return "control";
        }

        // 基于用户ID哈希确定是否进入实验
        int hash = Math.abs((userId.toString() + experimentName).hashCode());
        int percentile = hash % 100;

        if (percentile >= config.trafficPercent) {
            // 不在实验流量内
            return "control";
        }

        // 在实验流量内，随机分配实验组
        int groupIndex = hash % config.groups.size();
        String group = config.groups.get(groupIndex);

        // 保存用户分组
        String key = EXPERIMENT_USER_GROUP_KEY + experimentName + ":" + userId;
        redisTemplate.opsForValue().set(key, group, 30, TimeUnit.DAYS);

        log.debug("用户分组: userId={}, experiment={}, group={}", userId, experimentName, group);
        return group;
    }

    @Override
    public void recordMetric(Long userId, String experimentName, String metricName, double value) {
        String group = getUserGroup(userId, experimentName);
        if (group == null) {
            group = assignGroup(userId, experimentName);
        }

        String dateStr = LocalDate.now().format(DateTimeFormatter.ISO_DATE);
        String key = EXPERIMENT_METRIC_KEY + experimentName + ":" + group + ":" + dateStr;

        // 使用 Hash 存储指标
        redisTemplate.opsForHash().increment(key, metricName + ":sum", value);
        redisTemplate.opsForHash().increment(key, metricName + ":count", 1);

        // 设置过期时间 (保留90天数据)
        redisTemplate.expire(key, 90, TimeUnit.DAYS);

        log.debug("记录指标: experiment={}, group={}, metric={}, value={}",
                experimentName, group, metricName, value);
    }

    @Override
    public Map<String, Object> getExperimentStats(String experimentName) {
        Map<String, Object> stats = new HashMap<>();
        stats.put("experimentName", experimentName);
        stats.put("enabled", isExperimentEnabled(experimentName));

        ExperimentConfig config = EXPERIMENTS.get(experimentName);
        if (config == null) {
            stats.put("error", "实验不存在");
            return stats;
        }

        stats.put("trafficPercent", config.trafficPercent);
        stats.put("groups", config.groups);

        // 获取最近7天的指标数据
        Map<String, Map<String, Object>> groupStats = new HashMap<>();
        LocalDate today = LocalDate.now();

        for (String group : config.groups) {
            Map<String, Object> metrics = new HashMap<>();
            double totalClick = 0, totalPurchase = 0, totalImpressions = 0;
            int days = 0;

            for (int i = 0; i < 7; i++) {
                String dateStr = today.minusDays(i).format(DateTimeFormatter.ISO_DATE);
                String key = EXPERIMENT_METRIC_KEY + experimentName + ":" + group + ":" + dateStr;

                Map<Object, Object> dayMetrics = redisTemplate.opsForHash().entries(key);
                if (!dayMetrics.isEmpty()) {
                    days++;
                    totalClick += getDoubleValue(dayMetrics, "click:sum");
                    totalPurchase += getDoubleValue(dayMetrics, "purchase:sum");
                    totalImpressions += getDoubleValue(dayMetrics, "impression:count");
                }
            }

            // 计算指标
            double ctr = totalImpressions > 0 ? totalClick / totalImpressions * 100 : 0;
            double cvr = totalClick > 0 ? totalPurchase / totalClick * 100 : 0;

            metrics.put("totalClicks", totalClick);
            metrics.put("totalPurchases", totalPurchase);
            metrics.put("totalImpressions", totalImpressions);
            metrics.put("ctr", String.format("%.2f%%", ctr));
            metrics.put("cvr", String.format("%.2f%%", cvr));
            metrics.put("daysWithData", days);

            groupStats.put(group, metrics);
        }

        stats.put("groupStats", groupStats);
        stats.put("period", "最近7天");
        stats.put("generatedAt", LocalDate.now().toString());

        return stats;
    }

    @Override
    public boolean isExperimentEnabled(String experimentName) {
        ExperimentConfig config = EXPERIMENTS.get(experimentName);
        return config != null && config.enabled;
    }

    @Override
    public String getUserGroup(Long userId, String experimentName) {
        String key = EXPERIMENT_USER_GROUP_KEY + experimentName + ":" + userId;
        Object group = redisTemplate.opsForValue().get(key);
        return group != null ? group.toString() : null;
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

    /**
     * 实验配置
     */
    private static class ExperimentConfig {
        boolean enabled;
        int trafficPercent;
        List<String> groups;

        ExperimentConfig(boolean enabled, int trafficPercent, List<String> groups) {
            this.enabled = enabled;
            this.trafficPercent = trafficPercent;
            this.groups = groups;
        }
    }
}

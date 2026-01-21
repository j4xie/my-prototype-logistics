package com.joolun.mall.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.joolun.mall.entity.UserRecommendationProfile;
import com.joolun.mall.mapper.UserRecommendationProfileMapper;
import com.joolun.mall.service.AdaptiveExplorationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 自适应探索率服务实现
 *
 * 核心算法:
 * 1. 基于用户状态的探索率
 * 2. LinUCB: score = μ + α × sqrt(log(t)/n)
 * 3. Thompson Sampling: Beta(α, β) 分布采样
 *
 * @author Recommendation Enhancement
 * @since 2026-01-20
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdaptiveExplorationServiceImpl implements AdaptiveExplorationService {

    private final UserRecommendationProfileMapper profileMapper;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    // Redis缓存键
    private static final String EXPLORATION_STATS_PREFIX = "explore:stats:";
    private static final String UCB_COUNTS_PREFIX = "explore:ucb:";
    private static final String THOMPSON_ALPHA_PREFIX = "explore:ts:alpha:";
    private static final String THOMPSON_BETA_PREFIX = "explore:ts:beta:";
    private static final String ACTIVITY_HISTORY_PREFIX = "explore:activity:";

    // LinUCB参数
    private static final double UCB_ALPHA = 1.0;  // 探索系数

    // Thompson Sampling初始参数
    private static final double PRIOR_ALPHA = 1.0;
    private static final double PRIOR_BETA = 1.0;

    // 缓存过期时间
    private static final long STATS_TTL_HOURS = 24;
    private static final long ACTIVITY_TTL_DAYS = 14;

    // 统计
    private final AtomicLong totalExplorations = new AtomicLong(0);
    private final AtomicLong totalExploits = new AtomicLong(0);

    private final Random random = new Random();

    @Override
    public double calculateExplorationRate(String wxUserId) {
        if (wxUserId == null || wxUserId.isEmpty()) {
            return RATE_WARMING;  // 默认返回预热期探索率
        }

        try {
            // 获取用户画像
            UserRecommendationProfile profile = profileMapper.selectByWxUserId(wxUserId);
            String status = getUserStatusFromProfile(profile);

            double rate;
            switch (status) {
                case STATUS_COLD_START:
                    rate = RATE_COLD_START;
                    break;
                case STATUS_WARMING:
                    rate = RATE_WARMING;
                    break;
                case STATUS_MATURE:
                    // 成熟用户检查活跃度是否下降
                    if (isActivityDecreasing(wxUserId)) {
                        rate = RATE_MATURE_DECLINING;
                        log.debug("成熟用户活跃度下降，提高探索率: wxUserId={}", wxUserId);
                    } else {
                        rate = RATE_MATURE;
                    }
                    break;
                case STATUS_INACTIVE:
                    rate = RATE_INACTIVE;
                    break;
                default:
                    rate = RATE_WARMING;
            }

            // 确保在合理范围内
            rate = Math.max(MIN_EXPLORATION_RATE, Math.min(MAX_EXPLORATION_RATE, rate));

            log.debug("自适应探索率: wxUserId={}, status={}, rate={:.2f}", wxUserId, status, rate);
            return rate;

        } catch (Exception e) {
            log.warn("计算探索率失败: wxUserId={}, error={}", wxUserId, e.getMessage());
            return RATE_WARMING;
        }
    }

    @Override
    public String getUserStatus(String wxUserId) {
        if (wxUserId == null || wxUserId.isEmpty()) {
            return STATUS_COLD_START;
        }

        UserRecommendationProfile profile = profileMapper.selectByWxUserId(wxUserId);
        return getUserStatusFromProfile(profile);
    }

    /**
     * 从画像中获取用户状态
     */
    private String getUserStatusFromProfile(UserRecommendationProfile profile) {
        if (profile == null) {
            return STATUS_COLD_START;
        }

        String status = profile.getProfileStatus();
        if (status == null || status.isEmpty()) {
            // 根据行为数判断
            Integer behaviorCount = profile.getBehaviorCount();
            if (behaviorCount == null || behaviorCount < 5) {
                return STATUS_COLD_START;
            } else if (behaviorCount < 20) {
                return STATUS_WARMING;
            } else {
                return STATUS_MATURE;
            }
        }

        // 检查是否不活跃
        LocalDateTime lastActive = profile.getLastActiveTime();
        if (lastActive != null && lastActive.isBefore(LocalDateTime.now().minusDays(14))) {
            return STATUS_INACTIVE;
        }

        return status;
    }

    @Override
    public boolean isActivityDecreasing(String wxUserId) {
        if (wxUserId == null || wxUserId.isEmpty()) {
            return false;
        }

        try {
            String key = ACTIVITY_HISTORY_PREFIX + wxUserId;
            String historyJson = redisTemplate.opsForValue().get(key);

            if (historyJson == null) {
                // 没有历史记录，从画像获取
                UserRecommendationProfile profile = profileMapper.selectByWxUserId(wxUserId);
                if (profile == null) {
                    return false;
                }

                // 简化判断：基于最后活跃时间判断
                LocalDateTime lastActive = profile.getLastActiveTime();
                if (lastActive == null) {
                    return false;
                }

                // 如果最后活跃时间超过7天，认为活跃度下降
                long daysSinceActive = java.time.temporal.ChronoUnit.DAYS.between(lastActive, LocalDateTime.now());
                return daysSinceActive > 7;
            }

            // 从缓存解析历史
            Map<String, Integer> history = objectMapper.readValue(historyJson,
                    new TypeReference<Map<String, Integer>>() {});

            // 比较最近7天和之前7天
            LocalDateTime now = LocalDateTime.now();
            int recentCount = 0;
            int previousCount = 0;

            for (int i = 0; i < 7; i++) {
                String dateKey = now.minusDays(i).format(DateTimeFormatter.ISO_LOCAL_DATE);
                recentCount += history.getOrDefault(dateKey, 0);
            }

            for (int i = 7; i < 14; i++) {
                String dateKey = now.minusDays(i).format(DateTimeFormatter.ISO_LOCAL_DATE);
                previousCount += history.getOrDefault(dateKey, 0);
            }

            return previousCount > 0 && recentCount < previousCount * 0.7;

        } catch (Exception e) {
            log.debug("检查活跃度下降失败: wxUserId={}, error={}", wxUserId, e.getMessage());
            return false;
        }
    }

    @Override
    public double calculateLinUCBScore(String wxUserId, String productId, double predictedCTR) {
        try {
            String countKey = UCB_COUNTS_PREFIX + wxUserId + ":" + productId;
            String globalCountKey = UCB_COUNTS_PREFIX + "global:" + wxUserId;

            // 获取该商品的曝光次数
            String countStr = redisTemplate.opsForValue().get(countKey);
            long itemCount = countStr != null ? Long.parseLong(countStr) : 0;

            // 获取用户总曝光次数
            String globalStr = redisTemplate.opsForValue().get(globalCountKey);
            long totalCount = globalStr != null ? Long.parseLong(globalStr) : 1;

            // LinUCB: score = μ + α × sqrt(log(t)/n)
            // 其中 μ 是预测CTR，t 是总次数，n 是该商品次数
            double explorationBonus = 0;
            if (itemCount > 0) {
                explorationBonus = UCB_ALPHA * Math.sqrt(Math.log(totalCount + 1) / (itemCount + 1));
            } else {
                // 未曝光过的商品给予较大探索奖励
                explorationBonus = UCB_ALPHA * Math.sqrt(Math.log(totalCount + 1));
            }

            double score = predictedCTR + explorationBonus;
            log.debug("LinUCB分数: user={}, product={}, ctr={:.4f}, bonus={:.4f}, score={:.4f}",
                    wxUserId, productId, predictedCTR, explorationBonus, score);

            return score;

        } catch (Exception e) {
            log.debug("LinUCB计算失败: {}", e.getMessage());
            return predictedCTR;
        }
    }

    @Override
    public double sampleThompson(String wxUserId, String productId) {
        try {
            String alphaKey = THOMPSON_ALPHA_PREFIX + wxUserId + ":" + productId;
            String betaKey = THOMPSON_BETA_PREFIX + wxUserId + ":" + productId;

            // 获取Alpha和Beta参数
            String alphaStr = redisTemplate.opsForValue().get(alphaKey);
            String betaStr = redisTemplate.opsForValue().get(betaKey);

            double alpha = alphaStr != null ? Double.parseDouble(alphaStr) : PRIOR_ALPHA;
            double beta = betaStr != null ? Double.parseDouble(betaStr) : PRIOR_BETA;

            // 从Beta(alpha, beta)分布采样
            double sample = sampleBeta(alpha, beta);

            log.debug("Thompson采样: user={}, product={}, alpha={:.2f}, beta={:.2f}, sample={:.4f}",
                    wxUserId, productId, alpha, beta, sample);

            return sample;

        } catch (Exception e) {
            log.debug("Thompson采样失败: {}", e.getMessage());
            return 0.5;  // 返回中性值
        }
    }

    /**
     * 从Beta分布采样 (使用Gamma分布)
     * Beta(α, β) = Gamma(α) / (Gamma(α) + Gamma(β))
     */
    private double sampleBeta(double alpha, double beta) {
        double x = sampleGamma(alpha);
        double y = sampleGamma(beta);
        return x / (x + y);
    }

    /**
     * 从Gamma分布采样 (使用Marsaglia and Tsang's method)
     */
    private double sampleGamma(double shape) {
        if (shape < 1) {
            // 对于 shape < 1，使用 Ahrens-Dieter 方法
            return sampleGamma(shape + 1) * Math.pow(random.nextDouble(), 1.0 / shape);
        }

        double d = shape - 1.0 / 3.0;
        double c = 1.0 / Math.sqrt(9.0 * d);

        while (true) {
            double x, v;
            do {
                x = random.nextGaussian();
                v = 1.0 + c * x;
            } while (v <= 0);

            v = v * v * v;
            double u = random.nextDouble();

            if (u < 1 - 0.0331 * (x * x) * (x * x)) {
                return d * v;
            }

            if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
                return d * v;
            }
        }
    }

    @Override
    public void updateExplorationStats(String wxUserId, String productId, boolean clicked) {
        try {
            // 更新UCB计数
            String countKey = UCB_COUNTS_PREFIX + wxUserId + ":" + productId;
            String globalCountKey = UCB_COUNTS_PREFIX + "global:" + wxUserId;

            redisTemplate.opsForValue().increment(countKey, 1);
            redisTemplate.opsForValue().increment(globalCountKey, 1);
            redisTemplate.expire(countKey, STATS_TTL_HOURS, TimeUnit.HOURS);
            redisTemplate.expire(globalCountKey, STATS_TTL_HOURS, TimeUnit.HOURS);

            // 更新Thompson Sampling参数
            String alphaKey = THOMPSON_ALPHA_PREFIX + wxUserId + ":" + productId;
            String betaKey = THOMPSON_BETA_PREFIX + wxUserId + ":" + productId;

            if (clicked) {
                // 点击: alpha += 1
                redisTemplate.opsForValue().increment(alphaKey, 1);
            } else {
                // 未点击: beta += 1
                redisTemplate.opsForValue().increment(betaKey, 1);
            }

            redisTemplate.expire(alphaKey, STATS_TTL_HOURS, TimeUnit.HOURS);
            redisTemplate.expire(betaKey, STATS_TTL_HOURS, TimeUnit.HOURS);

            // 初始化先验（如果是新记录）
            String alphaStr = redisTemplate.opsForValue().get(alphaKey);
            String betaStr = redisTemplate.opsForValue().get(betaKey);

            if (alphaStr == null) {
                redisTemplate.opsForValue().set(alphaKey, String.valueOf(PRIOR_ALPHA + (clicked ? 1 : 0)),
                        STATS_TTL_HOURS, TimeUnit.HOURS);
            }
            if (betaStr == null) {
                redisTemplate.opsForValue().set(betaKey, String.valueOf(PRIOR_BETA + (clicked ? 0 : 1)),
                        STATS_TTL_HOURS, TimeUnit.HOURS);
            }

            // 更新活跃度历史
            updateActivityHistory(wxUserId);

            log.debug("更新探索统计: user={}, product={}, clicked={}", wxUserId, productId, clicked);

        } catch (Exception e) {
            log.debug("更新探索统计失败: {}", e.getMessage());
        }
    }

    /**
     * 更新用户活跃度历史
     */
    private void updateActivityHistory(String wxUserId) {
        try {
            String key = ACTIVITY_HISTORY_PREFIX + wxUserId;
            String historyJson = redisTemplate.opsForValue().get(key);

            Map<String, Integer> history;
            if (historyJson != null) {
                history = objectMapper.readValue(historyJson,
                        new TypeReference<Map<String, Integer>>() {});
            } else {
                history = new HashMap<>();
            }

            String today = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE);
            history.put(today, history.getOrDefault(today, 0) + 1);

            // 只保留最近14天
            LocalDateTime cutoff = LocalDateTime.now().minusDays(14);
            history.entrySet().removeIf(entry -> {
                try {
                    LocalDateTime date = LocalDateTime.parse(entry.getKey() + "T00:00:00");
                    return date.isBefore(cutoff);
                } catch (Exception e) {
                    return true;
                }
            });

            String newJson = objectMapper.writeValueAsString(history);
            redisTemplate.opsForValue().set(key, newJson, ACTIVITY_TTL_DAYS, TimeUnit.DAYS);

        } catch (Exception e) {
            log.debug("更新活跃度历史失败: {}", e.getMessage());
        }
    }

    @Override
    public boolean shouldExplore(String wxUserId) {
        double explorationRate = calculateExplorationRate(wxUserId);
        boolean shouldExplore = random.nextDouble() < explorationRate;

        if (shouldExplore) {
            totalExplorations.incrementAndGet();
        } else {
            totalExploits.incrementAndGet();
        }

        log.debug("探索决策: wxUserId={}, rate={:.2f}, explore={}", wxUserId, explorationRate, shouldExplore);
        return shouldExplore;
    }

    @Override
    public Map<String, Object> getExplorationStats() {
        Map<String, Object> stats = new LinkedHashMap<>();

        stats.put("totalExplorations", totalExplorations.get());
        stats.put("totalExploits", totalExploits.get());

        long total = totalExplorations.get() + totalExploits.get();
        if (total > 0) {
            stats.put("actualExplorationRate", (double) totalExplorations.get() / total);
        } else {
            stats.put("actualExplorationRate", 0.0);
        }

        stats.put("rateConfig", Map.of(
                "cold_start", RATE_COLD_START,
                "warming", RATE_WARMING,
                "mature", RATE_MATURE,
                "inactive", RATE_INACTIVE,
                "mature_declining", RATE_MATURE_DECLINING
        ));

        stats.put("ucbAlpha", UCB_ALPHA);
        stats.put("priorAlpha", PRIOR_ALPHA);
        stats.put("priorBeta", PRIOR_BETA);

        return stats;
    }

    @Override
    public Map<String, Object> getUserExplorationHistory(String wxUserId) {
        Map<String, Object> history = new LinkedHashMap<>();

        if (wxUserId == null || wxUserId.isEmpty()) {
            history.put("error", "Invalid user ID");
            return history;
        }

        history.put("userId", wxUserId);
        history.put("status", getUserStatus(wxUserId));
        history.put("explorationRate", calculateExplorationRate(wxUserId));
        history.put("isActivityDecreasing", isActivityDecreasing(wxUserId));

        try {
            String activityKey = ACTIVITY_HISTORY_PREFIX + wxUserId;
            String activityJson = redisTemplate.opsForValue().get(activityKey);
            if (activityJson != null) {
                Map<String, Integer> activityData = objectMapper.readValue(activityJson,
                        new TypeReference<Map<String, Integer>>() {});
                history.put("activityHistory", activityData);
            }
        } catch (Exception e) {
            log.debug("获取活跃度历史失败: {}", e.getMessage());
        }

        return history;
    }
}
